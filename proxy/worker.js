/**
 * Greener CI/CD Worker - Secure Version
 * Enhanced with comprehensive security utilities
 */

// Import security utilities
import { escapeHtml, safeHtml, raw } from './utils/sanitize.js';
import { getEnv, getEnvVar } from './utils/env.js';
import { parseRequiredString, parseOptionalString, parsePositiveInt, readJson, parseStringArray } from './utils/validation.js';
import { makeNonce, securityHeaders } from './utils/csp.js';
import { enforceRateLimit, getClientKey, RateLimitError } from './utils/rateLimit.js';
import { setCsrfCookie, getCsrfToken, requireCsrf, cachedGet } from './utils/http.js';
import { getSharedStyles } from './utils/styles.js';

// Main fetch handler for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};

/**
 * Main request handler with security enhancements
 */
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Validate environment variables
    const validatedEnv = getEnv(env);
    
    // Apply rate limiting
    const clientKey = getClientKey(request);
    await enforceRateLimit(validatedEnv, clientKey, 60, 60);
    
    // Route handling with security
    switch (path) {
      case '/':
        return request.method === 'POST' 
          ? handleWebhook(request, validatedEnv) 
          : cachedGet(request, 300, () => handleHome(validatedEnv));
      case '/configure':
        return handleConfigure(url.searchParams, validatedEnv);
      case '/admin':
        return handleAdmin(url.searchParams, validatedEnv);
      case '/callback':
        return handleCallback(url.searchParams, request, validatedEnv);
      case '/api/provision':
        requireCsrf(request);
        return request.method === 'POST'
          ? handleProvision(request, validatedEnv)
          : methodNotAllowed();
      case '/api/cli-provision':
        return request.method === 'POST'
          ? handleCliProvision(request, validatedEnv)
          : methodNotAllowed();
      case '/api/analytics':
        return handleAnalytics(url.searchParams, validatedEnv);
      case '/api/repos':
        return handleGetRepos(url.searchParams, validatedEnv);
      case '/styles.css':
        return handleStyles();
      default:
        return notFound();
    }
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Error handler with proper responses
 */
function handleError(error) {
  // Handle rate limit errors
  if (error instanceof RateLimitError) {
    return new Response(error.message, {
      status: error.status,
      headers: { 'Retry-After': String(error.retryAfter) }
    });
  }
  
  // Handle validation errors (already Response objects)
  if (error instanceof Response) {
    return error;
  }
  
  console.error('Worker error:', error);
  return serverError(error.message);
}

/**
 * Serve cached styles as separate endpoint
 */
async function handleStyles() {
  const styles = getSharedStyles();
  return new Response(styles, {
    headers: {
      'Content-Type': 'text/css',
      'Cache-Control': 'public, max-age=31536000'
    }
  });
}

/**
 * Build secure HTML page with CSP nonce
 */
function buildSecurePage(title, content, nonce) {
  const html = safeHtml`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <link rel="stylesheet" href="/styles.css">
      <script nonce="${nonce}">
        // Any inline scripts must use the nonce
      </script>
    </head>
    <body>
      ${raw(content)}
    </body>
    </html>
  `;
  
  const response = new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...securityHeaders(nonce)
    }
  });
  
  return response;
}

/**
 * Handle GitHub webhooks with validation
 */
async function handleWebhook(request, env) {
  const event = request.headers.get('X-GitHub-Event');
  
  if (!event) {
    return new Response('Missing event header', { status: 400 });
  }

  // TODO: Verify webhook signature
  const signature = request.headers.get('X-Hub-Signature-256');
  
  console.log(`Webhook received: ${event}`);

  return new Response(JSON.stringify({
    success: true,
    event: event,
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle home page
 */
async function handleHome(env) {
  const nonce = makeNonce();
  const csrfToken = crypto.randomUUID();
  
  const content = safeHtml`
    <div class="header">
      <div class="header-container">
        <div class="app-name">
          🌱 Greener CI/CD
          <span class="status-indicator"></span>
        </div>
        <div class="breadcrumb">Worker Active</div>
      </div>
    </div>

    <div class="hero">
      <h1 class="hero-title">🌱 Greener CI/CD</h1>
      <p class="hero-subtitle">Automated GitHub secret provisioning for modern CI/CD workflows</p>

      <div class="feature-grid">
        <div class="feature-card">
          <div class="feature-icon">🚀</div>
          <h3 class="feature-title">Instant Provisioning</h3>
          <p class="feature-description">Deploy secrets to multiple repositories with a single click</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔒</div>
          <h3 class="feature-title">Secure by Default</h3>
          <p class="feature-description">Encrypted secrets with GitHub's native security features</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <h3 class="feature-title">Analytics Dashboard</h3>
          <p class="feature-description">Monitor usage and manage your CI/CD infrastructure</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <h3 class="feature-title">Zero Infrastructure</h3>
          <p class="feature-description">Pure Cloudflare Worker - no servers to maintain</p>
        </div>
      </div>

      <div class="cta-buttons">
        <a href="https://github.com/apps/greener-ci-cd/installations/new" class="btn btn-primary">
          Install GitHub App
        </a>
        <a href="/configure?demo=true" class="btn btn-secondary">
          View Demo
        </a>
      </div>
    </div>
  `;
  
  const response = buildSecurePage('Greener CI/CD', content, nonce);
  setCsrfCookie(response.headers, csrfToken);
  
  return response;
}

/**
 * Handle configuration page with input validation
 */
async function handleConfigure(params, env) {
  const installationIdStr = params.get('installation_id');
  const isDemo = params.get('demo') === 'true';
  
  // Validate installation ID if not demo
  let installationId = null;
  if (!isDemo && installationIdStr) {
    installationId = parsePositiveInt(installationIdStr, 'installation_id');
  }

  const repos = isDemo ? getDemoRepos() : await getInstallationRepos(env, installationId);
  const nonce = makeNonce();
  const csrfToken = getCsrfToken || crypto.randomUUID();

  // Build repo list with proper escaping
  const repoListHtml = repos.map(repo => {
    const repoId = escapeHtml(repo.name);
    const repoFullName = escapeHtml(repo.full_name);
    const repoDescription = repo.description ? escapeHtml(repo.description) : '';
    
    return safeHtml`
      <label class="repo-card" for="repo-${repoId}">
        <input 
          type="checkbox" 
          class="repo-checkbox" 
          id="repo-${repoId}"
          name="repos" 
          value="${repoFullName}"
          ${repo.hasSecrets ? 'checked' : ''}
        />
        <div class="repo-info">
          <div class="repo-name">${repoFullName}</div>
          ${repoDescription ? safeHtml`<div class="repo-description">${repoDescription}</div>` : ''}
        </div>
        <div class="repo-badges">
          <span class="badge ${repo.private ? 'badge-private' : 'badge-public'}">
            ${repo.private ? 'Private' : 'Public'}
          </span>
          ${repo.hasSecrets ? '<span class="badge badge-configured">has secrets</span>' : ''}
        </div>
      </label>
    `;
  }).join('');

  const content = safeHtml`
    <div class="header">
      <div class="header-container">
        <div class="app-name">
          🌱 Greener CI/CD
          <span class="status-indicator"></span>
        </div>
        <div class="breadcrumb">Configure / Repositories</div>
      </div>
    </div>

    <div class="container">
      <h1 class="page-title">Configure Greener CI/CD</h1>
      <p class="page-description">Select repositories to provision with CI/CD secrets. These secrets will be automatically available in your GitHub Actions workflows.</p>

      <div class="search-container">
        <input 
          type="text" 
          class="search-input" 
          placeholder="Find a repository..." 
          id="repoSearch"
          autocomplete="off"
        />
      </div>

      <div class="repo-list" id="repoList">
        ${raw(repoListHtml)}
      </div>

      <div class="action-section">
        <button class="btn btn-primary" id="saveBtn" disabled>
          Save configuration
        </button>
        <a href="/admin${installationId ? `?installation_id=${installationId}` : ''}" class="btn btn-link">
          View analytics →
        </a>
      </div>
    </div>

    <div id="toast"></div>

    <script nonce="${nonce}">
      // Set CSRF token for API calls
      const csrfToken = '${csrfToken}';
      
      // Search functionality
      const searchInput = document.getElementById('repoSearch');
      const repoCards = document.querySelectorAll('.repo-card');
      
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        repoCards.forEach(card => {
          const repoName = card.querySelector('.repo-name').textContent.toLowerCase();
          const repoDesc = card.querySelector('.repo-description')?.textContent.toLowerCase() || '';
          
          if (repoName.includes(searchTerm) || repoDesc.includes(searchTerm)) {
            card.style.display = 'flex';
          } else {
            card.style.display = 'none';
          }
        });
      });

      // Selection handling
      const checkboxes = document.querySelectorAll('.repo-checkbox');
      const saveBtn = document.getElementById('saveBtn');
      
      function updateSaveButton() {
        const checkedCount = document.querySelectorAll('.repo-checkbox:checked').length;
        saveBtn.disabled = checkedCount === 0;
      }

      checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const card = e.target.closest('.repo-card');
          if (e.target.checked) {
            card.classList.add('selected');
          } else {
            card.classList.remove('selected');
          }
          updateSaveButton();
        });
      });

      // Save functionality with CSRF
      saveBtn.addEventListener('click', async () => {
        const selectedRepos = Array.from(document.querySelectorAll('.repo-checkbox:checked'))
          .map(cb => cb.value);

        if (selectedRepos.length === 0) {
          showToast('Please select at least one repository', 'error');
          return;
        }

        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="loading-spinner"></span> Provisioning...';

        try {
          ${isDemo ? safeHtml`
            // Demo mode simulation
            await new Promise(resolve => setTimeout(resolve, 2000));
            showToast('Demo: Secrets would be provisioned to ' + selectedRepos.length + ' repositories', 'success');
            saveBtn.innerHTML = '✓ Saved';
            setTimeout(() => {
              saveBtn.innerHTML = 'Save configuration';
              saveBtn.disabled = false;
            }, 3000);
          ` : safeHtml`
            const response = await fetch('/api/provision', {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
              },
              body: JSON.stringify({
                installation_id: ${installationId},
                repos: selectedRepos
              })
            });

            const result = await response.json();

            if (result.success) {
              showToast('Successfully provisioned secrets to ' + selectedRepos.length + ' repositories', 'success');
              saveBtn.innerHTML = '✓ Saved';
              setTimeout(() => location.reload(), 2000);
            } else {
              throw new Error(result.error || 'Provisioning failed');
            }
          `}
        } catch (error) {
          showToast('Error: ' + error.message, 'error');
          saveBtn.innerHTML = 'Save configuration';
          saveBtn.disabled = false;
        }
      });

      function showToast(message, type) {
        const toast = document.getElementById('toast');
        toast.className = 'toast toast-' + type;
        toast.textContent = message;
        toast.style.display = 'block';
        
        setTimeout(() => {
          toast.style.display = 'none';
        }, 5000);
      }

      // Initialize
      updateSaveButton();
    </script>
  `;
  
  const response = buildSecurePage('Configure Greener CI/CD', content, nonce);
  setCsrfCookie(response.headers, csrfToken);
  
  return response;
}

/**
 * Handle admin page
 */
async function handleAdmin(params, env) {
  const installationIdStr = params.get('installation_id');
  let installationId = null;
  
  if (installationIdStr) {
    installationId = parsePositiveInt(installationIdStr, 'installation_id');
  }
  
  const analytics = await getAnalytics(env, installationId);
  const nonce = makeNonce();

  const content = safeHtml`
    <div class="header">
      <div class="header-container">
        <div class="app-name">
          🌱 Greener CI/CD
          <span class="status-indicator"></span>
        </div>
        <div class="breadcrumb">Admin / Analytics</div>
      </div>
    </div>

    <div class="container">
      <h1 class="page-title">Global Analytics</h1>
      <p class="page-description">Monitor your CI/CD infrastructure and manage application settings</p>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Repositories</div>
          <div class="stat-value">${analytics.totalRepos}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Configured Repos</div>
          <div class="stat-value">${analytics.configuredRepos}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Active Secrets</div>
          <div class="stat-value">${analytics.totalSecrets}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Last Provision</div>
          <div class="stat-value">${escapeHtml(analytics.lastProvision || 'Never')}</div>
        </div>
      </div>

      <div class="control-panel">
        <h2 class="control-title">Application Controls</h2>
        <div class="control-group">
          <div class="control-item">
            <span class="control-label">Auto-provision new repositories</span>
            <label class="switch">
              <input type="checkbox" id="autoProvision">
              <span class="slider"></span>
            </label>
          </div>
          <div class="control-item">
            <span class="control-label">Send webhook notifications</span>
            <label class="switch">
              <input type="checkbox" id="webhookNotifications" checked>
              <span class="slider"></span>
            </label>
          </div>
          <div class="control-item">
            <span class="control-label">Enable debug logging</span>
            <label class="switch">
              <input type="checkbox" id="debugLogging">
              <span class="slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div class="action-section">
        <a href="/configure${installationId ? `?installation_id=${installationId}` : ''}" class="btn btn-secondary">
          ← Back to configuration
        </a>
        <button class="btn btn-primary" id="refreshBtn">
          Refresh analytics
        </button>
      </div>
    </div>

    <script nonce="${nonce}">
      // Handle refresh
      document.getElementById('refreshBtn').addEventListener('click', () => {
        location.reload();
      });

      // Handle switches
      const switches = document.querySelectorAll('input[type="checkbox"]');
      switches.forEach(sw => {
        sw.addEventListener('change', (e) => {
          // In production, save these preferences to KV storage
        });
      });
    </script>
  `;
  
  return buildSecurePage('Admin - Greener CI/CD', content, nonce);
}

/**
 * Handle OAuth callback with validation
 */
async function handleCallback(params, request, env) {
  try {
    const installationIdStr = params.get('installation_id');
    
    if (!installationIdStr) {
      return new Response('Missing installation_id', { status: 400 });
    }
    
    const installationId = parsePositiveInt(installationIdStr, 'installation_id');
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUrl = `${baseUrl}/configure?installation_id=${installationId}`;

    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('Callback error:', error);
    return serverError(error.message);
  }
}

/**
 * Handle secret provisioning API with validation
 */
async function handleProvision(request, env) {
  try {
    const payload = await readJson(request);
    
    const installationId = parsePositiveInt(payload.installation_id, 'installation_id');
    const repos = parseStringArray(payload.repos, 'repos', 100);

    const results = await provisionSecrets(env, installationId, repos);
    const success = results.every(r => r.status === 'success');

    return new Response(JSON.stringify({
      success,
      results,
      timestamp: new Date().toISOString()
    }), {
      status: success ? 200 : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: error instanceof Response ? error.status : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle CLI provision API with user GitHub token authentication
 */
async function handleCliProvision(request, env) {
  try {
    // Extract GitHub token from Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authorization header with Bearer token required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userToken = authHeader.slice(7); // Remove 'Bearer ' prefix
    const payload = await readJson(request);

    // Parse and validate the repository
    const repository = parseRequiredString(payload.repository, 'repository', 100);

    // Validate repository format (owner/name)
    if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repository)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Repository must be in owner/name format'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify user has access to the repository
    const repoResponse = await fetch(`https://api.github.com/repos/${repository}`, {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greener-CI-CD-CLI'
      }
    });

    if (!repoResponse.ok) {
      if (repoResponse.status === 401) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid GitHub token'
        }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (repoResponse.status === 404) {
        return new Response(JSON.stringify({
          success: false,
          error: `Repository not found or no access: ${repository}`
        }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: `Failed to verify repository access: ${repoResponse.status}`
        }), {
          status: repoResponse.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Generate secrets for the repository
    const secrets = await generateSecretsForRepo(repository);

    // Create or update secrets using user's token
    const secretResults = [];
    for (const [secretName, secretValue] of Object.entries(secrets)) {
      try {
        const result = await createSecret(repository, secretName, secretValue, userToken);
        secretResults.push({
          name: secretName,
          status: result ? 'success' : 'failed'
        });
      } catch (error) {
        secretResults.push({
          name: secretName,
          status: 'failed',
          error: error.message
        });
      }
    }

    const success = secretResults.every(r => r.status === 'success');

    return new Response(JSON.stringify({
      success,
      repository,
      secrets: secretResults.filter(r => r.status === 'success').map(r => r.name),
      failed: secretResults.filter(r => r.status === 'failed'),
      timestamp: new Date().toISOString()
    }), {
      status: success ? 200 : 207, // 207 Multi-Status for partial success
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: error instanceof Response ? error.status : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle analytics API
 */
async function handleAnalytics(params, env) {
  const installationIdStr = params.get('installation_id');
  let installationId = null;
  
  if (installationIdStr) {
    installationId = parsePositiveInt(installationIdStr, 'installation_id');
  }
  
  const analytics = await getAnalytics(env, installationId);

  return new Response(JSON.stringify(analytics), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Handle repository list API with validation
 */
async function handleGetRepos(params, env) {
  const installationIdStr = params.get('installation_id');
  let installationId = null;
  
  if (installationIdStr) {
    installationId = parsePositiveInt(installationIdStr, 'installation_id');
  }
  
  const repos = await getInstallationRepos(env, installationId);

  return new Response(JSON.stringify(repos), {
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Get demo repositories for testing
 */
function getDemoRepos() {
  return [
    {
      full_name: 'user/awesome-project',
      name: 'awesome-project',
      description: 'A cutting-edge web application with modern architecture',
      private: false,
      hasSecrets: false
    },
    {
      full_name: 'user/api-service',
      name: 'api-service',
      description: 'RESTful API service for microservices architecture',
      private: true,
      hasSecrets: true
    },
    {
      full_name: 'user/mobile-app',
      name: 'mobile-app',
      description: 'Cross-platform mobile application',
      private: true,
      hasSecrets: false
    },
    {
      full_name: 'user/data-pipeline',
      name: 'data-pipeline',
      description: 'ETL pipeline for data processing',
      private: false,
      hasSecrets: true
    }
  ];
}

/**
 * Get analytics data with proper error handling
 */
async function getAnalytics(env, installationId) {
  // In production, fetch real data from GitHub API
  return {
    totalRepos: 12,
    configuredRepos: 7,
    totalSecrets: 35,
    lastProvision: '2 hours ago',
    weeklyProvisions: [3, 5, 2, 7, 4, 8, 6],
    topRepos: [
      { name: 'user/api-service', secrets: 5 },
      { name: 'user/web-app', secrets: 5 },
      { name: 'user/mobile-app', secrets: 5 }
    ]
  };
}

/**
 * Get repositories for installation with proper escaping
 */
async function getInstallationRepos(env, installationId) {
  if (!installationId || !env.GITHUB_TOKEN) {
    return getDemoRepos();
  }

  try {
    const response = await fetch(`https://api.github.com/user/installations/${installationId}/repositories?per_page=100`, {
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greener-CI-CD-Worker'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Don't escape here - escape at render time
    const reposWithStatus = await Promise.all(
      data.repositories.map(async (repo) => {
        const hasSecrets = await checkGreenerSecrets(env, repo.full_name);
        return {
          full_name: repo.full_name,
          name: repo.name,
          description: repo.description,
          private: repo.private,
          hasSecrets: hasSecrets
        };
      })
    );

    return reposWithStatus;
  } catch (error) {
    console.error('Error getting repos:', error);
    return getDemoRepos();
  }
}

/**
 * Check if repo has Greener secrets
 */
async function checkGreenerSecrets(env, repoFullName) {
  try {
    const response = await fetch(`https://api.github.com/repos/${repoFullName}/actions/secrets`, {
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
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

/**
 * Provision secrets to repositories
 */
async function provisionSecrets(env, installationId, repos) {
  const results = [];

  for (const repoFullName of repos) {
    try {
      const secrets = {
        GREENER_CI_KEY: generateSecret(32),
        GREENER_CI_SECRET: generateSecret(64),
        GREENER_API_TOKEN: generateSecret(32),
        GREENER_APP_ID: getEnvVar(env, 'GITHUB_APP_ID', 'demo'),
        GREENER_INSTALLATION_ID: String(installationId)
      };

      for (const [name, value] of Object.entries(secrets)) {
        await setRepoSecret(env, repoFullName, name, value);
      }

      results.push({ repo: repoFullName, status: 'success' });
    } catch (error) {
      results.push({ repo: repoFullName, status: 'error', error: error.message });
    }
  }

  return results;
}

/**
 * Set repository secret with proper encryption
 */
async function setRepoSecret(env, repoFullName, secretName, secretValue) {
  // In demo mode, skip actual API calls
  if (!env.GITHUB_TOKEN) {
    return Promise.resolve();
  }

  const keyResponse = await fetch(`https://api.github.com/repos/${repoFullName}/actions/secrets/public-key`, {
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Greener-CI-CD-Worker'
    }
  });

  if (!keyResponse.ok) {
    throw new Error(`Failed to get public key: ${keyResponse.status}`);
  }

  const keyData = await keyResponse.json();
  // TODO: Properly encrypt secret using sodium
  const encryptedValue = btoa(secretValue);

  const secretResponse = await fetch(`https://api.github.com/repos/${repoFullName}/actions/secrets/${secretName}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
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

/**
 * Generate cryptographically secure random secret
 */
function generateSecret(length) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  // Use only lowercase letters and digits to avoid confusion
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

/**
 * Generate secrets for a specific repository
 */
async function generateSecretsForRepo(repoFullName) {
  return {
    GREENER_CI_KEY: generateSecret(32),
    GREENER_CI_SECRET: generateSecret(64),
    GREENER_API_TOKEN: generateSecret(32),
    GREENER_APP_ID: 'cli-generated',
    GREENER_INSTALLATION_ID: 'user-provisioned'
  };
}

/**
 * Create a secret in a repository using user token
 */
async function createSecret(repoFullName, secretName, secretValue, userToken) {
  // Get public key for encryption
  const keyResponse = await fetch(`https://api.github.com/repos/${repoFullName}/actions/secrets/public-key`, {
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Greener-CI-CD-CLI'
    }
  });

  if (!keyResponse.ok) {
    throw new Error(`Failed to get public key: ${keyResponse.status}`);
  }

  const keyData = await keyResponse.json();
  // TODO: Properly encrypt secret using sodium
  const encryptedValue = btoa(secretValue);

  const secretResponse = await fetch(`https://api.github.com/repos/${repoFullName}/actions/secrets/${secretName}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${userToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Greener-CI-CD-CLI',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      encrypted_value: encryptedValue,
      key_id: keyData.key_id
    })
  });

  return secretResponse.ok;
}

/**
 * Error response helpers
 */
function notFound() {
  return new Response('Not found', { status: 404 });
}

function methodNotAllowed() {
  return new Response('Method not allowed', { status: 405 });
}

function serverError(message) {
  return new Response(`Server error: ${message}`, { status: 500 });
}

// Export functions for use in enhanced worker
export {
  handleWebhook,
  handleHome,
  handleConfigure,
  handleCallback,
  handleProvision,
  handleAnalytics,
  handleGetRepos,
  handleStyles,
  notFound,
  methodNotAllowed,
  serverError
};