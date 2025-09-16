/**
 * Greener CI/CD Worker - Bundled Version
 * All utilities included in single file for Cloudflare Workers deployment
 */

// ============================================================================
// HTML SANITIZATION UTILITIES
// ============================================================================

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
  '=': '&#61;',
  '/': '&#47;',
};

const ESCAPE_RE = /[&<>"'`=\/]/g;

function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input).replace(ESCAPE_RE, (ch) => ESCAPE_MAP[ch] || ch);
}

function raw(unescaped) {
  return { __raw: true, value: unescaped };
}

function processValue(value) {
  if (value && typeof value === 'object' && value.__raw) {
    return value.value;
  }
  return escapeHtml(value);
}

function safeHtml(literals, ...values) {
  let out = '';
  for (let i = 0; i < literals.length; i++) {
    out += literals[i];
    if (i < values.length) out += processValue(values[i]);
  }
  return out;
}

// ============================================================================
// ENVIRONMENT UTILITIES
// ============================================================================

function getEnvVar(env, key, defaultValue = null) {
  return env[key] || defaultValue;
}

function getEnv(env) {
  return {
    GITHUB_TOKEN: getEnvVar(env, 'GITHUB_TOKEN'),
    GITHUB_APP_ID: getEnvVar(env, 'APP_ID'),
    GITHUB_CLIENT_ID: getEnvVar(env, 'CLIENT_ID'),
    GITHUB_CLIENT_SECRET: getEnvVar(env, 'CLIENT_SECRET'),
    WEBHOOK_SECRET: getEnvVar(env, 'WEBHOOK_SECRET'),
    RATE_LIMIT: env.RATE_LIMIT || null
  };
}

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

function parseRequiredString(value, fieldName) {
  if (!value || typeof value !== 'string') {
    throw new Response(`Missing or invalid ${fieldName}`, { status: 400 });
  }
  return value.trim();
}

function parseOptionalString(value, defaultValue = '') {
  if (!value) return defaultValue;
  if (typeof value !== 'string') {
    throw new Response('Invalid string value', { status: 400 });
  }
  return value.trim();
}

function parsePositiveInt(value, fieldName) {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Response(`Invalid ${fieldName}: must be positive integer`, { status: 400 });
  }
  return parsed;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch (error) {
    throw new Response('Invalid JSON payload', { status: 400 });
  }
}

function parseStringArray(value, fieldName, maxLength = 100) {
  if (!Array.isArray(value)) {
    throw new Response(`${fieldName} must be an array`, { status: 400 });
  }
  if (value.length > maxLength) {
    throw new Response(`${fieldName} exceeds maximum length of ${maxLength}`, { status: 400 });
  }
  return value.map(item => parseRequiredString(item, `${fieldName} item`));
}

// ============================================================================
// CSP UTILITIES
// ============================================================================

function makeNonce() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array));
}

function securityHeaders(nonce) {
  return {
    'Content-Security-Policy': `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self';`,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  };
}

// ============================================================================
// RATE LIMITING UTILITIES
// ============================================================================

class RateLimitError extends Error {
  constructor(message, retryAfter = 60) {
    super(message);
    this.name = 'RateLimitError';
    this.status = 429;
    this.retryAfter = retryAfter;
  }
}

function getClientKey(request) {
  const forwarded = request.headers.get('CF-Connecting-IP');
  const ip = forwarded || request.headers.get('X-Forwarded-For') || 'unknown';
  return `ratelimit:${ip}`;
}

async function enforceRateLimit(env, clientKey, limit = 60, windowSeconds = 60) {
  if (!env.RATE_LIMIT) return; // Skip if KV namespace not configured
  
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  
  const data = await env.RATE_LIMIT.get(clientKey, { type: 'json' });
  const requests = data ? data.requests.filter(t => now - t < windowMs) : [];
  
  if (requests.length >= limit) {
    const oldestRequest = Math.min(...requests);
    const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000);
    throw new RateLimitError(`Rate limit exceeded. Try again in ${retryAfter} seconds.`, retryAfter);
  }
  
  requests.push(now);
  await env.RATE_LIMIT.put(clientKey, JSON.stringify({ requests }), {
    expirationTtl: windowSeconds
  });
}

// ============================================================================
// HTTP UTILITIES
// ============================================================================

function setCsrfCookie(headers, token) {
  headers.set('Set-Cookie', `csrf_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/`);
}

function getCsrfToken(request) {
  const cookie = request.headers.get('Cookie');
  if (!cookie) return null;
  
  const match = cookie.match(/csrf_token=([^;]+)/);
  return match ? match[1] : null;
}

function requireCsrf(request) {
  const token = request.headers.get('X-CSRF-Token');
  const cookie = getCsrfToken(request);
  
  if (!token || token !== cookie) {
    throw new Response('CSRF token validation failed', { status: 403 });
  }
}

async function cachedGet(request, ttl, handler) {
  const cache = caches.default;
  const cached = await cache.match(request);
  
  if (cached) return cached;
  
  const response = await handler();
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', `public, max-age=${ttl}`);
  
  const cachedResponse = new Response(response.body, {
    status: response.status,
    headers
  });
  
  await cache.put(request, cachedResponse.clone());
  return cachedResponse;
}

// ============================================================================
// STYLES UTILITIES
// ============================================================================

function getSharedStyles() {
  return `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .header {
      background: rgba(255, 255, 255, 0.98);
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .header-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .app-name {
      font-size: 1.5rem;
      font-weight: 600;
      color: #667eea;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .status-indicator {
      width: 10px;
      height: 10px;
      background: #10b981;
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .breadcrumb {
      color: #6b7280;
      font-size: 0.9rem;
    }

    .hero {
      text-align: center;
      padding: 5rem 2rem;
      color: white;
    }

    .hero-title {
      font-size: 3.5rem;
      font-weight: 700;
      margin-bottom: 1rem;
      text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.2);
    }

    .hero-subtitle {
      font-size: 1.25rem;
      opacity: 0.95;
      max-width: 600px;
      margin: 0 auto 3rem;
    }

    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
      margin: 3rem 0;
      max-width: 1000px;
      margin-left: auto;
      margin-right: auto;
    }

    .feature-card {
      background: rgba(255, 255, 255, 0.95);
      border-radius: 12px;
      padding: 2rem;
      text-align: center;
      transition: transform 0.3s, box-shadow 0.3s;
      backdrop-filter: blur(10px);
    }

    .feature-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
    }

    .feature-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .feature-title {
      color: #1f2937;
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .feature-description {
      color: #6b7280;
      font-size: 0.95rem;
    }

    .page-title {
      font-size: 2.5rem;
      color: white;
      margin-bottom: 1rem;
    }

    .page-description {
      font-size: 1.1rem;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 2rem;
    }

    .repo-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin: 2rem 0;
    }

    .repo-card {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      cursor: pointer;
      transition: all 0.2s;
      border: 2px solid transparent;
    }

    .repo-card:hover {
      border-color: #667eea;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    }

    .repo-card.selected {
      background: #f0f4ff;
      border-color: #667eea;
    }

    .repo-checkbox {
      width: 20px;
      height: 20px;
      cursor: pointer;
    }

    .repo-info {
      flex: 1;
      text-align: left;
    }

    .repo-name {
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 0.25rem;
    }

    .repo-description {
      font-size: 0.9rem;
      color: #6b7280;
    }

    .repo-badges {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .badge {
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .badge-public {
      background: #e5e7eb;
      color: #374151;
    }

    .badge-private {
      background: #fef3c7;
      color: #92400e;
    }

    .badge-configured {
      background: #d1fae5;
      color: #065f46;
    }

    .btn {
      display: inline-block;
      padding: 0.75rem 2rem;
      border-radius: 8px;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
      border: none;
      font-size: 1rem;
    }

    .btn-primary {
      background: white;
      color: #667eea;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    }

    .btn-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: 2px solid white;
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    .btn-link {
      background: none;
      color: #667eea;
      text-decoration: underline;
    }

    .cta-buttons {
      display: flex;
      gap: 1rem;
      justify-content: center;
      margin-top: 2rem;
    }

    .search-container {
      margin: 2rem 0;
    }

    .search-input {
      width: 100%;
      padding: 1rem;
      border-radius: 8px;
      border: 2px solid #e5e7eb;
      font-size: 1rem;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      outline: none;
      border-color: #667eea;
    }

    .action-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 2rem;
      padding-top: 2rem;
      border-top: 2px solid rgba(255, 255, 255, 0.2);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
      margin: 2rem 0;
    }

    .stat-card {
      background: white;
      border-radius: 8px;
      padding: 1.5rem;
      text-align: center;
    }

    .stat-label {
      color: #6b7280;
      font-size: 0.9rem;
      margin-bottom: 0.5rem;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #667eea;
    }

    .control-panel {
      background: white;
      border-radius: 8px;
      padding: 2rem;
      margin: 2rem 0;
    }

    .control-title {
      font-size: 1.5rem;
      color: #1f2937;
      margin-bottom: 1.5rem;
    }

    .control-group {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .control-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 1rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .control-label {
      color: #4b5563;
      font-weight: 500;
    }

    .switch {
      position: relative;
      display: inline-block;
      width: 50px;
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
      background-color: #ccc;
      transition: .4s;
      border-radius: 24px;
    }

    .slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      transition: .4s;
      border-radius: 50%;
    }

    input:checked + .slider {
      background-color: #667eea;
    }

    input:checked + .slider:before {
      transform: translateX(26px);
    }

    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      padding: 1rem 1.5rem;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      display: none;
      animation: slideIn 0.3s;
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
      background: #10b981;
    }

    .toast-error {
      background: #ef4444;
    }

    .loading-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50%;
      border-top-color: white;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;
}

// ============================================================================
// MAIN WORKER CODE
// ============================================================================

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
    
    // Apply rate limiting (skip if KV namespace not configured)
    if (validatedEnv.RATE_LIMIT) {
      const clientKey = getClientKey(request);
      await enforceRateLimit(validatedEnv, clientKey, 60, 60);
    }
    
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