/**
 * Ultra-Minimal Greener CI/CD Worker
 * Pure GitHub + Cloudflare system with environment variables only
 */

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
        return handleCallback(url.searchParams, request);
      case '/provision':
        return request.method === 'POST' ? handleProvision(request) : new Response('Method not allowed', { status: 405 });
      case '/demo':
        return handleDemo(url.searchParams);
      default:
        return new Response('Not found', { status: 404 });
    }
  } catch (error) {
    console.error('Worker error:', error);
    return new Response(`Error: ${error.message}`, { status: 500 });
  }
}

// Handle GitHub webhooks
async function handleWebhook(request) {
  const event = request.headers.get('X-GitHub-Event');

  if (!event) {
    return new Response('Missing event header', { status: 400 });
  }

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
               max-width: 700px; margin: 50px auto; padding: 20px; background: #f6f8fa; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .status { color: #28a745; font-weight: 500; }
        .button { display: inline-block; background: #28a745; color: white; padding: 12px 24px;
                 border-radius: 6px; text-decoration: none; font-weight: 500; margin: 10px 5px; }
        .button:hover { background: #218838; }
        .button-secondary { background: #6f42c1; }
        .button-secondary:hover { background: #5a32a3; }
        .features { list-style: none; padding: 0; }
        .features li { padding: 8px 0; }
        .features li:before { content: "✅ "; margin-right: 8px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🌱 Greener CI/CD</h1>
        <p class="status">✅ Worker is running</p>

        <h2>Instant GitHub Secret Provisioning</h2>
        <p>Ultra-minimal GitHub App for automatic CI/CD secret management. Install once, get secrets everywhere.</p>

        <ul class="features">
          <li>Install GitHub App → instant secret provisioning</li>
          <li>Clean web interface for repo selection</li>
          <li>Zero infrastructure - pure Cloudflare Worker</li>
          <li>Real-time provisioning with live feedback</li>
        </ul>

        <div style="margin: 30px 0;">
          <a href="https://github.com/apps/greener-ci-cd/installations/new" class="button">
            🚀 Install GitHub App
          </a>
          <a href="/demo?installation_id=demo" class="button button-secondary">
            📱 Try Demo
          </a>
        </div>

        <h3>How it works:</h3>
        <ol>
          <li><strong>Install GitHub App</strong> → Redirected to setup page</li>
          <li><strong>Select repositories</strong> → Choose which repos need CI/CD secrets</li>
          <li><strong>Click provision</strong> → Instant secret deployment</li>
          <li><strong>Use secrets</strong> → GREENER_* secrets available in Actions</li>
        </ol>

        <p><small>Generated secrets: GREENER_CI_KEY, GREENER_CI_SECRET, GREENER_API_TOKEN, GREENER_APP_ID, GREENER_INSTALLATION_ID</small></p>
      </div>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Handle setup page
async function handleSetup(params) {
  const installationId = params.get('installation_id');

  if (!installationId) {
    return new Response('Missing installation_id', { status: 400 });
  }

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

// Handle demo page
async function handleDemo(params) {
  return new Response(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Greener CI/CD - Demo</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
               max-width: 700px; margin: 50px auto; padding: 20px; background: #f6f8fa; }
        .container { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .repo { padding: 10px; border: 1px solid #e1e4e8; margin: 5px 0; border-radius: 6px; }
        .repo:hover { background: #f6f8fa; }
        button { background: #28a745; color: white; border: none; padding: 12px 24px;
                border-radius: 6px; cursor: pointer; font-size: 16px; }
        button:hover { background: #218838; }
        .demo-note { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🌱 Greener CI/CD Demo</h1>

        <div class="demo-note">
          <strong>📱 Demo Mode</strong><br>
          This is a preview of the setup interface. In real usage, this page shows your actual GitHub repositories.
        </div>

        <p>Select repositories to add automatic secret provisioning:</p>

        <form id="demoForm">
          <div class="repo">
            <label>
              <input type="checkbox" name="repos" value="user/awesome-project" checked>
              <strong>user/awesome-project</strong>
            </label>
          </div>

          <div class="repo">
            <label>
              <input type="checkbox" name="repos" value="user/web-app">
              <strong>user/web-app</strong> <span style="color: #6f42c1;">(has secrets)</span>
            </label>
          </div>

          <div class="repo">
            <label>
              <input type="checkbox" name="repos" value="user/api-service">
              <strong>user/api-service</strong>
            </label>
          </div>

          <br>
          <button type="submit">🚀 Provision CI/CD Secrets (Demo)</button>
        </form>

        <p style="margin-top: 30px;">
          <a href="/" style="text-decoration: none; color: #586069;">← Back to home</a>
        </p>
      </div>

      <script>
        document.getElementById('demoForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const button = e.target.querySelector('button');

          button.textContent = '⏳ Provisioning...';
          button.disabled = true;

          setTimeout(() => {
            button.textContent = '✅ Demo Complete!';
            button.style.background = '#28a745';
            alert('Demo: In real usage, secrets would be provisioned to selected repositories!');
            setTimeout(() => {
              button.textContent = '🚀 Provision CI/CD Secrets (Demo)';
              button.disabled = false;
            }, 3000);
          }, 2000);
        });
      </script>
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Handle OAuth callback
async function handleCallback(params, request) {
  try {
    const installationId = params.get('installation_id');

    if (!installationId) {
      return new Response('Missing installation_id', { status: 400 });
    }

    // Get the base URL from the request
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUrl = `${baseUrl}/setup?installation_id=${installationId}`;

    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('Callback error:', error);
    return new Response(`Callback error: ${error.message}`, { status: 500 });
  }
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

// Get repositories for installation
async function getInstallationRepos(installationId) {
  try {
    const response = await fetch(`https://api.github.com/installation/repositories`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greener-CI-CD-Worker'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();

    const reposWithStatus = await Promise.all(
      data.repositories.map(async (repo) => {
        const hasSecrets = await checkGreenerSecrets(repo.full_name);
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

// Check if repo has Greener secrets
async function checkGreenerSecrets(repoFullName) {
  try {
    const response = await fetch(`https://api.github.com/repos/${repoFullName}/actions/secrets`, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
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

// Provision secrets to repositories
async function provisionSecrets(installationId, repos) {
  const results = [];

  for (const repoFullName of repos) {
    try {
      const secrets = {
        GREENER_CI_KEY: generateSecret(32),
        GREENER_CI_SECRET: generateSecret(64),
        GREENER_API_TOKEN: generateSecret(32),
        GREENER_APP_ID: APP_ID,
        GREENER_INSTALLATION_ID: installationId
      };

      for (const [name, value] of Object.entries(secrets)) {
        await setRepoSecret(repoFullName, name, value);
      }

      results.push({ repo: repoFullName, status: 'success' });
    } catch (error) {
      results.push({ repo: repoFullName, status: 'error', error: error.message });
    }
  }

  return results;
}

// Set repository secret
async function setRepoSecret(repoFullName, secretName, secretValue) {
  const keyResponse = await fetch(`https://api.github.com/repos/${repoFullName}/actions/secrets/public-key`, {
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Greener-CI-CD-Worker'
    }
  });

  if (!keyResponse.ok) {
    throw new Error(`Failed to get public key: ${keyResponse.status}`);
  }

  const keyData = await keyResponse.json();
  const encryptedValue = btoa(secretValue);

  const secretResponse = await fetch(`https://api.github.com/repos/${repoFullName}/actions/secrets/${secretName}`, {
    method: 'PUT',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
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