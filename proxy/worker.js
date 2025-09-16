/**
 * Ultra-Minimal Greener CI/CD Worker
 * Handles GitHub App installation, setup, and secret provisioning
 */

// Configuration
const CONFIG = {
  GITHUB_OWNER: 'greener-hayden',
  APP_ID: null, // Set via environment
  CLIENT_ID: null, // Set via environment
  CLIENT_SECRET: null, // Set via environment
  WEBHOOK_SECRET: null, // Set via environment
  GITHUB_TOKEN: null // Set via environment
};

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    switch (path) {
      case '/':
        return request.method === 'POST' ? handleWebhook(request) : handleHome();
      case '/setup':
        return handleSetup(url.searchParams);
      case '/callback':
        return handleCallback(url.searchParams);
      case '/provision':
        return request.method === 'POST' ? handleProvision(request) : new Response('Method not allowed', { status: 405 });
      default:
        return new Response('Not found', { status: 404 });
    }
  } catch (error) {
    console.error('Worker error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

// Handle GitHub webhooks (simplified)
async function handleWebhook(request) {
  const event = request.headers.get('X-GitHub-Event');
  const signature = request.headers.get('X-Hub-Signature-256');

  if (!event) {
    return new Response('Missing event header', { status: 400 });
  }

  // Only log webhook for debugging - setup page handles provisioning
  console.log(`Webhook received: ${event}`);

  return new Response(JSON.stringify({
    success: true,
    message: 'Webhook received - use setup page for provisioning'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle home page
async function handleHome() {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Greener CI/CD</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
               max-width: 600px; margin: 50px auto; padding: 20px; }
        .status { color: #28a745; }
      </style>
    </head>
    <body>
      <h1>🌱 Greener CI/CD</h1>
      <p class="status">✅ Worker is running</p>
      <p>This is the webhook endpoint for the Greener CI/CD GitHub App.</p>
      <p>Install the GitHub App to get started with automatic secret provisioning.</p>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Handle setup page (post-installation)
async function handleSetup(params) {
  const installationId = params.get('installation_id');
  const code = params.get('code');

  if (!installationId) {
    return new Response('Missing installation_id', { status: 400 });
  }

  // If we have an OAuth code, process it
  if (code) {
    return await processSetup(installationId, code);
  }

  // Get installation repositories
  const repos = await getInstallationRepos(installationId);

  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Setup Greener CI/CD</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
               max-width: 700px; margin: 50px auto; padding: 20px; background: #f6f8fa; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .repo { padding: 10px; border: 1px solid #e1e4e8; margin: 5px 0; border-radius: 6px; }
        .repo:hover { background: #f6f8fa; }
        button { background: #28a745; color: white; border: none; padding: 12px 24px;
                border-radius: 6px; cursor: pointer; font-size: 16px; }
        button:hover { background: #218838; }
        .existing { color: #6f42c1; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🌱 Setup Greener CI/CD</h1>
        <p>Select repositories to add automatic secret provisioning:</p>

        <form id="setupForm">
          <input type="hidden" name="installation_id" value="${installationId}">
          ${repos.map(repo => {
            const hasSecrets = repo.hasGreenerSecrets ? ' <span class="existing">(has secrets)</span>' : '';
            return `
              <div class="repo">
                <label>
                  <input type="checkbox" name="repos" value="${repo.full_name}" ${repo.hasGreenerSecrets ? 'checked' : ''}>
                  <strong>${repo.full_name}</strong>${hasSecrets}
                </label>
              </div>
            `;
          }).join('')}

          <br>
          <button type="submit">🚀 Provision CI/CD Secrets</button>
        </form>
      </div>

      <script>
        document.getElementById('setupForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const repos = formData.getAll('repos');
          const installationId = formData.get('installation_id');

          if (repos.length === 0) {
            alert('Please select at least one repository');
            return;
          }

          const button = e.target.querySelector('button');
          button.textContent = '⏳ Provisioning...';
          button.disabled = true;

          try {
            const response = await fetch('/provision', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ installation_id: installationId, repos })
            });

            const result = await response.json();

            if (result.success) {
              button.textContent = '✅ Success!';
              button.style.background = '#28a745';
              setTimeout(() => location.reload(), 2000);
            } else {
              throw new Error(result.error || 'Provisioning failed');
            }
          } catch (error) {
            button.textContent = '❌ Failed';
            button.style.background = '#dc3545';
            alert('Error: ' + error.message);
            setTimeout(() => {
              button.textContent = '🚀 Provision CI/CD Secrets';
              button.style.background = '#28a745';
              button.disabled = false;
            }, 3000);
          }
        });
      </script>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Handle OAuth callback
async function handleCallback(params) {
  const code = params.get('code');
  const installationId = params.get('installation_id');

  if (!code) {
    return Response.redirect('/setup?installation_id=' + installationId);
  }

  // Exchange code for access token (if needed for enhanced features)
  return Response.redirect('/setup?installation_id=' + installationId + '&code=' + code);
}

// Handle secret provisioning
async function handleProvision(request) {
  try {
    const { installation_id, repos } = await request.json();

    if (!installation_id || !repos || !Array.isArray(repos)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing installation_id or repos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const results = await provisionSecrets(installation_id, repos);

    const success = results.every(r => r.status === 'success');

    return new Response(JSON.stringify({
      success,
      results
    }), {
      status: success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Process setup and provision secrets
async function processSetup(installationId, code) {
  // In a minimal setup, we might not need the OAuth token
  // Just redirect back to setup page
  return Response.redirect('/setup?installation_id=' + installationId);
}

// Get repositories for an installation
async function getInstallationRepos(installationId) {
  try {
    // Get installation access token
    const installationToken = await getInstallationToken(installationId);

    // Get repositories
    const response = await fetch(`https://api.github.com/installation/repositories`, {
      headers: {
        'Authorization': `token ${installationToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greener-CI-CD-Worker'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    // Check which repos already have Greener secrets
    const reposWithStatus = await Promise.all(
      data.repositories.map(async (repo) => {
        const hasSecrets = await checkGreenerSecrets(repo.full_name, installationToken);
        return {
          full_name: repo.full_name,
          name: repo.name,
          hasGreenerSecrets: hasSecrets
        };
      })
    );

    return reposWithStatus;
  } catch (error) {
    console.error('Error getting repos:', error);
    return [];
  }
}

// Get installation access token
async function getInstallationToken(installationId) {
  // For now, use the personal access token
  // In production, you'd generate a JWT and get installation token
  return GITHUB_TOKEN || CONFIG.GITHUB_TOKEN;
}

// Check if repo has Greener secrets
async function checkGreenerSecrets(repoFullName, token) {
  try {
    const response = await fetch(`https://api.github.com/repos/${repoFullName}/actions/secrets`, {
      headers: {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greener-CI-CD-Worker'
      }
    });

    if (!response.ok) return false;

    const data = await response.json();
    return data.secrets.some(secret => secret.name.startsWith('GREENER_'));
  } catch (error) {
    return false;
  }
}

// Handle secret provisioning
async function provisionSecrets(installationId, repos) {
  const installationToken = await getInstallationToken(installationId);
  const results = [];

  for (const repoFullName of repos) {
    try {
      // Generate unique secrets for this repo
      const secrets = {
        GREENER_CI_KEY: generateSecret(32),
        GREENER_CI_SECRET: generateSecret(64),
        GREENER_API_TOKEN: generateSecret(32),
        GREENER_APP_ID: APP_ID || CONFIG.APP_ID || 'your-app-id',
        GREENER_INSTALLATION_ID: installationId
      };

      // Set each secret
      for (const [name, value] of Object.entries(secrets)) {
        await setRepoSecret(repoFullName, name, value, installationToken);
      }

      results.push({ repo: repoFullName, status: 'success' });
    } catch (error) {
      results.push({ repo: repoFullName, status: 'error', error: error.message });
    }
  }

  return results;
}

// Set repository secret
async function setRepoSecret(repoFullName, secretName, secretValue, token) {
  // Get repository public key
  const keyResponse = await fetch(`https://api.github.com/repos/${repoFullName}/actions/secrets/public-key`, {
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Greener-CI-CD-Worker'
    }
  });

  if (!keyResponse.ok) {
    throw new Error(`Failed to get public key: ${keyResponse.status}`);
  }

  const keyData = await keyResponse.json();

  // Encrypt secret value (simplified - in production use libsodium)
  const encryptedValue = btoa(secretValue); // Base64 for demo - use proper encryption

  // Set secret
  const secretResponse = await fetch(`https://api.github.com/repos/${repoFullName}/actions/secrets/${secretName}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Greener-CI-CD-Worker',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      encrypted_value: encryptedValue,
      key_id: keyData.key_id
    })
  });

  if (!secretResponse.ok) {
    throw new Error(`Failed to set secret: ${secretResponse.status}`);
  }
}

// Generate random secret
function generateSecret(length) {
  const chars = 'abcdef0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}