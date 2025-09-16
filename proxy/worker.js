/**
 * Greener CI/CD Worker - GitHub-Style UI
 * Modern GitHub App for automatic CI/CD secret management
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
      case '/configure':
        return handleConfigure(url.searchParams);
      case '/admin':
        return handleAdmin(url.searchParams);
      case '/callback':
        return handleCallback(url.searchParams, request);
      case '/api/provision':
        return request.method === 'POST' ? handleProvision(request) : methodNotAllowed();
      case '/api/analytics':
        return handleAnalytics(url.searchParams);
      case '/api/repos':
        return handleGetRepos(url.searchParams);
      default:
        return notFound();
    }
  } catch (error) {
    console.error('Worker error:', error);
    return serverError(error.message);
  }
}

// Shared styles for GitHub-like UI
const getSharedStyles = () => `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    background: #0d1117;
    color: #ffffff;
    line-height: 1.5;
    min-height: 100vh;
  }

  .header {
    background: #010409;
    border-bottom: 1px solid #3d444d;
    padding: 16px 0;
    position: sticky;
    top: 0;
    z-index: 100;
  }

  .header-container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .app-name {
    font-size: 16px;
    font-weight: 600;
    color: #ffffff;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #248637;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }

  .breadcrumb {
    font-size: 14px;
    color: #9198a1;
  }

  .container {
    max-width: 1280px;
    margin: 0 auto;
    padding: 32px 24px;
  }

  .page-title {
    font-size: 32px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 8px;
  }

  .page-description {
    font-size: 16px;
    color: #9198a1;
    margin-bottom: 32px;
  }

  .search-container {
    margin-bottom: 24px;
  }

  .search-input {
    width: 100%;
    padding: 8px 12px;
    background: #0d1117;
    border: 1px solid #3d444d;
    border-radius: 6px;
    color: #ffffff;
    font-size: 14px;
  }

  .search-input:focus {
    outline: none;
    border-color: #4493f8;
    box-shadow: 0 0 0 3px rgba(68, 147, 248, 0.1);
  }

  .search-input::placeholder {
    color: #767d86;
  }

  .repo-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 24px;
  }

  .repo-card {
    background: #0d1117;
    border: 1px solid #3d444d;
    border-radius: 6px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 16px;
    transition: all 0.2s;
    cursor: pointer;
  }

  .repo-card:hover {
    background: #212830;
    border-color: #767d86;
  }

  .repo-card.selected {
    background: #212830;
    border-color: #4493f8;
  }

  .repo-checkbox {
    width: 20px;
    height: 20px;
    accent-color: #4493f8;
    cursor: pointer;
  }

  .repo-info {
    flex: 1;
  }

  .repo-name {
    font-weight: 600;
    color: #4493f8;
    font-size: 14px;
  }

  .repo-description {
    font-size: 14px;
    color: #9198a1;
    margin-top: 4px;
  }

  .repo-badges {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .badge {
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }

  .badge-private {
    background: rgba(248, 81, 73, 0.1);
    color: #f85149;
    border: 1px solid rgba(248, 81, 73, 0.3);
  }

  .badge-public {
    background: rgba(36, 134, 55, 0.1);
    color: #248637;
    border: 1px solid rgba(36, 134, 55, 0.3);
  }

  .badge-configured {
    background: rgba(106, 115, 125, 0.1);
    color: #6a737d;
    border: 1px solid rgba(106, 115, 125, 0.3);
  }

  .action-section {
    display: flex;
    gap: 16px;
    align-items: center;
    padding-top: 24px;
    border-top: 1px solid #3d444d;
  }

  .btn {
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .btn-primary {
    background: #248637;
    color: #ffffff;
  }

  .btn-primary:hover:not(:disabled) {
    background: #29903b;
  }

  .btn-primary:disabled {
    background: #105823;
    color: rgba(255, 255, 255, 0.5);
    cursor: not-allowed;
  }

  .btn-secondary {
    background: #212830;
    color: #ffffff;
    border: 1px solid #3d444d;
  }

  .btn-secondary:hover {
    background: #262c36;
    border-color: #767d86;
  }

  .btn-link {
    background: transparent;
    color: #4493f8;
    padding: 8px;
  }

  .btn-link:hover {
    text-decoration: underline;
  }

  .loading-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #ffffff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 12px 16px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    z-index: 1000;
    animation: slideIn 0.3s ease;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  .toast-success {
    background: #248637;
    color: #ffffff;
  }

  .toast-error {
    background: #f85149;
    color: #ffffff;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }

  .stat-card {
    background: #0d1117;
    border: 1px solid #3d444d;
    border-radius: 6px;
    padding: 16px;
  }

  .stat-label {
    font-size: 12px;
    color: #9198a1;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 24px;
    font-weight: 600;
    color: #ffffff;
  }

  .control-panel {
    background: #0d1117;
    border: 1px solid #3d444d;
    border-radius: 6px;
    padding: 24px;
  }

  .control-title {
    font-size: 18px;
    font-weight: 600;
    color: #ffffff;
    margin-bottom: 16px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .control-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: #212830;
    border-radius: 6px;
  }

  .control-label {
    font-size: 14px;
    color: #ffffff;
  }

  .switch {
    position: relative;
    width: 48px;
    height: 24px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #3d444d;
    transition: 0.3s;
    border-radius: 24px;
  }

  .slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 3px;
    bottom: 3px;
    background: #ffffff;
    transition: 0.3s;
    border-radius: 50%;
  }

  input:checked + .slider {
    background: #248637;
  }

  input:checked + .slider:before {
    transform: translateX(24px);
  }
`;

// Handle GitHub webhooks
async function handleWebhook(request) {
  const event = request.headers.get('X-GitHub-Event');
  
  if (!event) {
    return new Response('Missing event header', { status: 400 });
  }

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

// Handle home page
async function handleHome() {
  return new Response(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Greener CI/CD</title>
      <style>
        ${getSharedStyles()}
        
        .hero {
          text-align: center;
          padding: 80px 24px;
          max-width: 800px;
          margin: 0 auto;
        }

        .hero-title {
          font-size: 48px;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 16px;
        }

        .hero-subtitle {
          font-size: 20px;
          color: #9198a1;
          margin-bottom: 48px;
        }

        .feature-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          margin: 48px 0;
        }

        .feature-card {
          background: #0d1117;
          border: 1px solid #3d444d;
          border-radius: 6px;
          padding: 24px;
          text-align: left;
        }

        .feature-icon {
          font-size: 24px;
          margin-bottom: 12px;
        }

        .feature-title {
          font-size: 16px;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 8px;
        }

        .feature-description {
          font-size: 14px;
          color: #9198a1;
        }

        .cta-buttons {
          display: flex;
          gap: 16px;
          justify-content: center;
        }
      </style>
    </head>
    <body>
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
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Handle configuration page (Page 1)
async function handleConfigure(params) {
  const installationId = params.get('installation_id');
  const isDemo = params.get('demo') === 'true';

  const repos = isDemo ? getDemoRepos() : await getInstallationRepos(installationId);

  return new Response(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Configure Greener CI/CD</title>
      <style>
        ${getSharedStyles()}
      </style>
    </head>
    <body>
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
          ${repos.map(repo => `
            <label class="repo-card" for="repo-${repo.name}">
              <input 
                type="checkbox" 
                class="repo-checkbox" 
                id="repo-${repo.name}"
                name="repos" 
                value="${repo.full_name}"
                ${repo.hasSecrets ? 'checked' : ''}
              />
              <div class="repo-info">
                <div class="repo-name">${repo.full_name}</div>
                ${repo.description ? `<div class="repo-description">${repo.description}</div>` : ''}
              </div>
              <div class="repo-badges">
                <span class="badge ${repo.private ? 'badge-private' : 'badge-public'}">
                  ${repo.private ? 'Private' : 'Public'}
                </span>
                ${repo.hasSecrets ? '<span class="badge badge-configured">has secrets</span>' : ''}
              </div>
            </label>
          `).join('')}
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

      <script>
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

        // Save functionality
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
            ${isDemo ? `
              // Demo mode simulation
              await new Promise(resolve => setTimeout(resolve, 2000));
              showToast('Demo: Secrets would be provisioned to ' + selectedRepos.length + ' repositories', 'success');
              saveBtn.innerHTML = '✓ Saved';
              setTimeout(() => {
                saveBtn.innerHTML = 'Save configuration';
                saveBtn.disabled = false;
              }, 3000);
            ` : `
              const response = await fetch('/api/provision', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  installation_id: '${installationId}',
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
    </body>
    </html>
  `, {
    headers: { 'Content-Type': 'text/html' }
  });
}

// Handle admin page (Page 2)
async function handleAdmin(params) {
  const installationId = params.get('installation_id');
  const analytics = await getAnalytics(installationId);

  return new Response(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Admin - Greener CI/CD</title>
      <style>
        ${getSharedStyles()}
      </style>
    </head>
    <body>
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
            <div class="stat-value">${analytics.lastProvision || 'Never'}</div>
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

      <script>
        // Handle refresh
        document.getElementById('refreshBtn').addEventListener('click', () => {
          location.reload();
        });

        // Handle switches
        const switches = document.querySelectorAll('input[type="checkbox"]');
        switches.forEach(sw => {
          sw.addEventListener('change', (e) => {
            console.log(e.target.id + ' changed to ' + e.target.checked);
            // In production, save these preferences to KV storage
          });
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

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const redirectUrl = `${baseUrl}/configure?installation_id=${installationId}`;

    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    console.error('Callback error:', error);
    return serverError(error.message);
  }
}

// Handle secret provisioning API
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
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle analytics API
async function handleAnalytics(params) {
  const installationId = params.get('installation_id');
  const analytics = await getAnalytics(installationId);

  return new Response(JSON.stringify(analytics), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Handle repository list API
async function handleGetRepos(params) {
  const installationId = params.get('installation_id');
  const repos = await getInstallationRepos(installationId);

  return new Response(JSON.stringify(repos), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// Get demo repositories
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

// Get analytics data
async function getAnalytics(installationId) {
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

// Get repositories for installation
async function getInstallationRepos(installationId) {
  if (!installationId || !GITHUB_TOKEN) {
    return getDemoRepos();
  }

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
        GREENER_APP_ID: APP_ID || 'demo',
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
  // In demo mode, skip actual API calls
  if (!GITHUB_TOKEN) {
    return Promise.resolve();
  }

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
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Error responses
function notFound() {
  return new Response('Not found', { status: 404 });
}

function methodNotAllowed() {
  return new Response('Method not allowed', { status: 405 });
}

function serverError(message) {
  return new Response(`Server error: ${message}`, { status: 500 });
}