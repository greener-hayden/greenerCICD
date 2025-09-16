/**
 * Greener CI/CD Worker - Enhanced with D1 Database Support
 * Includes automatic migration handling
 */

// Import security utilities
import { escapeHtml, safeHtml, raw } from './utils/sanitize.js';
import { getEnv, getEnvVar } from './utils/env.js';
import { parseRequiredString, parseOptionalString, parsePositiveInt, readJson, parseStringArray } from './utils/validation.js';
import { makeNonce, securityHeaders } from './utils/csp.js';
import { enforceRateLimit, getClientKey, RateLimitError } from './utils/rateLimit.js';
import { setCsrfCookie, getCsrfToken, requireCsrf, cachedGet } from './utils/http.js';
import { getSharedStyles } from './utils/styles.js';

// Import migration system
import { runMigrations, getMigrationStatus } from './migrations/index.js';
import { scheduled as cronMigrations } from './cron-migrations.js';

// Database helper functions
const dbHelpers = {
  async getAdminSession(db, token) {
    return await db.prepare(
      'SELECT * FROM admin_sessions WHERE token = ? AND expires_at > datetime("now")'
    ).bind(token).first();
  },
  
  async getUserSession(db, token) {
    return await db.prepare(
      'SELECT * FROM user_sessions WHERE session_token = ? AND expires_at > datetime("now")'
    ).bind(token).first();
  },
  
  async createAuditLog(db, entry) {
    await db.prepare(
      'INSERT INTO audit_log (user_type, user_id, action, resource, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      entry.userType || 'system',
      entry.userId || null,
      entry.action,
      entry.resource || null,
      entry.details || null,
      entry.ipAddress || null
    ).run();
  }
};

// Migration status cache
let migrationCache = {
  status: null,
  checkedAt: 0,
  running: false
};

// Main fetch handler for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    // Check and run migrations with caching
    if (env.DB && env.AUTO_MIGRATE !== 'false') {
      const now = Date.now();
      const cacheExpiry = 5 * 60 * 1000; // 5 minutes
      
      // Only check migrations if cache expired and not already running
      if (!migrationCache.running && (now - migrationCache.checkedAt > cacheExpiry)) {
        migrationCache.running = true;
        ctx.waitUntil(
          getMigrationStatus(env.DB).then(async (status) => {
            if (status.pending > 0) {
              console.log(`Running ${status.pending} pending migrations...`);
              await runMigrations(env.DB);
            }
            migrationCache.status = status;
            migrationCache.checkedAt = now;
            migrationCache.running = false;
          }).catch(err => {
            console.error('Migration check failed:', err);
            migrationCache.running = false;
          })
        );
      }
    }
    
    return handleRequest(request, env, ctx);
  },
  
  // Scheduled cron handler for periodic migration checks
  async scheduled(event, env, ctx) {
    if (env.DB) {
      await cronMigrations(event, env, ctx);
    }
  }
};

/**
 * Main request handler with database support
 */
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    // Validate environment variables
    const validatedEnv = {
      ...getEnv(env),
      DB: env.DB, // Add database binding
      PROXY_URL: env.PROXY_URL || 'https://greener-cicd-webhook-proxy.hg230.workers.dev'
    };
    
    // Apply rate limiting
    const clientKey = getClientKey(request);
    await enforceRateLimit(validatedEnv, clientKey, 60, 60);
    
    // Route handling with security and database
    switch (path) {
      case '/':
        return request.method === 'POST' 
          ? handleWebhook(request, validatedEnv) 
          : cachedGet(request, 300, () => handleHome(validatedEnv));
      
      // Admin routes
      case '/admin':
        return handleAdminPage(request, validatedEnv);
      case '/admin/setup':
        return handleAdminSetup(request, validatedEnv);
      case '/admin/login':
        return handleAdminLogin(request, validatedEnv);
      case '/admin/dashboard':
        return handleAdminDashboard(request, validatedEnv);
      
      // API routes with database
      case '/api/admin/login':
        return handleApiAdminLogin(request, validatedEnv);
      case '/api/links':
        return handleApiLinks(request, validatedEnv);
      case '/api/access/init':
        return handleApiAccessInit(request, validatedEnv);
      case '/api/migration/status':
        return handleMigrationStatus(validatedEnv);
      
      // User access routes
      case '/access':
        return handleUserAccess(request, validatedEnv);
      
      // Legacy routes
      case '/configure':
        return handleConfigure(url.searchParams, validatedEnv);
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
    return handleError(error, env.DB);
  }
}

/**
 * Handle admin setup page
 */
async function handleAdminSetup(request, env) {
  if (!env.DB) {
    return new Response('Database not configured', { status: 500 });
  }
  
  // Check if admin already exists
  const admin = await env.DB.prepare('SELECT 1 FROM admin LIMIT 1').first();
  
  if (admin) {
    return Response.redirect(new URL('/admin/login', env.PROXY_URL).toString());
  }
  
  if (request.method === 'POST') {
    // Process admin setup
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');
    
    if (!username || !password) {
      return new Response('Username and password required', { status: 400 });
    }
    
    // Hash password using PBKDF2 with random salt
    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const iterations = 100000;
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: iterations,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Create admin
    await env.DB.prepare(
      'INSERT INTO admin (username, password_hash, password_salt, iterations) VALUES (?, ?, ?, ?)'
    ).bind(username, passwordHash, saltHex, iterations).run();
    
    // Log the setup
    await dbHelpers.createAuditLog(env.DB, {
      action: 'admin_created',
      details: `Admin user ${username} created`,
      ipAddress: request.headers.get('CF-Connecting-IP')
    });
    
    return Response.redirect(new URL('/admin/login', env.PROXY_URL).toString());
  }
  
  // Show setup form
  const nonce = makeNonce();
  return new Response(renderAdminSetupPage(nonce), {
    headers: {
      'Content-Type': 'text/html',
      ...securityHeaders(nonce)
    }
  });
}

/**
 * Handle migration status endpoint
 */
async function handleMigrationStatus(env) {
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const status = await getMigrationStatus(env.DB);
    return new Response(JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Render admin setup page
 */
function renderAdminSetupPage(nonce) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Setup - Greener CI/CD</title>
  <link rel="stylesheet" href="/styles.css">
  <style nonce="${nonce}">
    .setup-container {
      max-width: 400px;
      margin: 100px auto;
      padding: 2rem;
      background: var(--bg-surface);
      border-radius: 8px;
      border: 1px solid var(--border);
    }
    .setup-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .form-group label {
      font-weight: 500;
      color: var(--text-primary);
    }
    .form-group input {
      padding: 0.5rem;
      border: 1px solid var(--border);
      border-radius: 4px;
      font-size: 14px;
    }
    .form-group input:focus {
      outline: 2px solid var(--primary);
      outline-offset: 1px;
    }
    .submit-btn {
      margin-top: 1rem;
      padding: 0.75rem;
      background: var(--success);
      color: white;
      border: none;
      border-radius: 4px;
      font-weight: 500;
      cursor: pointer;
    }
    .submit-btn:hover {
      background: var(--success-hover);
    }
  </style>
</head>
<body>
  <div class="setup-container">
    <h1>Initial Admin Setup</h1>
    <p>Create your administrator account to manage Greener CI/CD.</p>
    
    <form method="POST" class="setup-form">
      <div class="form-group">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" required 
               placeholder="Enter username" required>
      </div>
      
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required 
               placeholder="Enter a strong password" minlength="8">
      </div>
      
      <button type="submit" class="submit-btn">Create Admin Account</button>
    </form>
  </div>
</body>
</html>`;
}

/**
 * Error handler with database logging
 */
async function handleError(error, db) {
  // Log to database if available
  if (db && !(error instanceof RateLimitError)) {
    try {
      await dbHelpers.createAuditLog(db, {
        action: 'error',
        details: error.message
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }
  
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
 * Handle admin page redirect
 */
async function handleAdminPage(request, env) {
  // Check if admin exists
  const admin = await env.DB.prepare('SELECT 1 FROM admin LIMIT 1').first();
  
  if (!admin) {
    return Response.redirect(new URL('/admin/setup', env.PROXY_URL).toString());
  }
  
  // Check for existing session
  const cookie = request.headers.get('Cookie');
  const sessionToken = cookie?.match(/admin_session=([^;]+)/)?.[1];
  
  if (sessionToken) {
    const session = await dbHelpers.getAdminSession(env.DB, sessionToken);
    if (session) {
      return Response.redirect(new URL('/admin/dashboard', env.PROXY_URL).toString());
    }
  }
  
  return Response.redirect(new URL('/admin/login', env.PROXY_URL).toString());
}

/**
 * Handle admin login page and authentication
 */
async function handleAdminLogin(request, env) {
  if (!env.DB) {
    return new Response('Database not configured', { status: 500 });
  }
  
  if (request.method === 'POST') {
    const formData = await request.formData();
    const username = formData.get('username');
    const password = formData.get('password');
    
    if (!username || !password) {
      return renderAdminLoginPage({ error: 'Username and password required' });
    }
    
    // Get admin user
    const admin = await env.DB.prepare(
      'SELECT * FROM admin WHERE username = ?'
    ).bind(username).first();
    
    if (!admin) {
      await dbHelpers.createAuditLog(env.DB, {
        action: 'failed_login',
        details: `Invalid username: ${username}`,
        ipAddress: request.headers.get('CF-Connecting-IP')
      });
      return renderAdminLoginPage({ error: 'Invalid credentials' });
    }
    
    // Verify password using PBKDF2
    const encoder = new TextEncoder();
    const salt = new Uint8Array(admin.password_salt.match(/.{2}/g).map(byte => parseInt(byte, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: admin.iterations || 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      256
    );
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (passwordHash !== admin.password_hash) {
      await dbHelpers.createAuditLog(env.DB, {
        action: 'failed_login',
        details: `Invalid password for user: ${username}`,
        ipAddress: request.headers.get('CF-Connecting-IP')
      });
      return renderAdminLoginPage({ error: 'Invalid credentials' });
    }
    
    // Create session
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    await env.DB.prepare(
      'INSERT INTO admin_sessions (token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?)'
    ).bind(
      sessionToken,
      expiresAt.toISOString(),
      request.headers.get('CF-Connecting-IP'),
      request.headers.get('User-Agent')
    ).run();
    
    await dbHelpers.createAuditLog(env.DB, {
      action: 'admin_login',
      details: `Admin ${username} logged in`,
      ipAddress: request.headers.get('CF-Connecting-IP')
    });
    
    // Set cookie and redirect
    const response = Response.redirect(new URL('/admin/dashboard', env.PROXY_URL).toString());
    response.headers.set('Set-Cookie', `admin_session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`);
    return response;
  }
  
  return renderAdminLoginPage();
}

/**
 * Render admin login page
 */
function renderAdminLoginPage(options = {}) {
  const nonce = makeNonce();
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login - Greener CI/CD</title>
  <link rel="stylesheet" href="/styles.css">
  <style nonce="${nonce}">
    body {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .login-container {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      padding: 3rem;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 100%;
      max-width: 400px;
      animation: slideUp 0.5s ease;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .login-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .login-header h1 {
      color: #333;
      font-size: 2rem;
      margin: 0 0 0.5rem 0;
    }
    .login-header p {
      color: #666;
      margin: 0;
    }
    .error-message {
      background: #ff4757;
      color: white;
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1.5rem;
      animation: shake 0.5s;
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-10px); }
      75% { transform: translateX(10px); }
    }
    .form-group {
      margin-bottom: 1.5rem;
    }
    .form-group label {
      display: block;
      color: #555;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }
    .form-group input {
      width: 100%;
      padding: 0.75rem;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 1rem;
      transition: border-color 0.3s;
    }
    .form-group input:focus {
      outline: none;
      border-color: #667eea;
    }
    .submit-btn {
      width: 100%;
      padding: 1rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .submit-btn:hover {
      transform: translateY(-2px);
    }
    .submit-btn:active {
      transform: translateY(0);
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="login-header">
      <h1>🔐 Admin Login</h1>
      <p>Greener CI/CD Control Panel</p>
    </div>
    ${options.error ? `<div class="error-message">${escapeHtml(options.error)}</div>` : ''}
    <form method="POST">
      <div class="form-group">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" required autofocus>
      </div>
      <div class="form-group">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required>
      </div>
      <button type="submit" class="submit-btn">Sign In</button>
    </form>
  </div>
</body>
</html>`;
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      ...securityHeaders(nonce)
    }
  });
}

/**
 * Handle admin dashboard
 */
async function handleAdminDashboard(request, env) {
  if (!env.DB) {
    return new Response('Database not configured', { status: 500 });
  }
  
  // Verify admin session
  const cookie = request.headers.get('Cookie');
  const sessionToken = cookie?.match(/admin_session=([^;]+)/)?.[1];
  
  if (!sessionToken) {
    return Response.redirect(new URL('/admin/login', env.PROXY_URL).toString());
  }
  
  const session = await dbHelpers.getAdminSession(env.DB, sessionToken);
  if (!session) {
    return Response.redirect(new URL('/admin/login', env.PROXY_URL).toString());
  }
  
  // Handle logout
  if (request.method === 'POST') {
    const formData = await request.formData();
    if (formData.get('action') === 'logout') {
      await env.DB.prepare('DELETE FROM admin_sessions WHERE token = ?').bind(sessionToken).run();
      const response = Response.redirect(new URL('/admin/login', env.PROXY_URL).toString());
      response.headers.set('Set-Cookie', 'admin_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0');
      return response;
    }
  }
  
  // Get statistics
  const stats = {
    totalLinks: await env.DB.prepare('SELECT COUNT(*) as count FROM access_links').first(),
    activeLinks: await env.DB.prepare('SELECT COUNT(*) as count FROM access_links WHERE active = 1').first(),
    totalSessions: await env.DB.prepare('SELECT COUNT(*) as count FROM user_sessions').first(),
    recentLogs: await env.DB.prepare('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 10').all()
  };
  
  return renderAdminDashboard(stats, await getMigrationStatus(env.DB));
}

/**
 * Render admin dashboard
 */
function renderAdminDashboard(stats, migrationStatus) {
  const nonce = makeNonce();
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Dashboard - Greener CI/CD</title>
  <link rel="stylesheet" href="/styles.css">
  <style nonce="${nonce}">
    body {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 2rem;
    }
    .dashboard {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 15px;
      padding: 2rem;
      margin-bottom: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }
    .header h1 {
      margin: 0;
      color: #333;
      font-size: 2rem;
    }
    .logout-btn {
      background: #ff4757;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: transform 0.2s;
    }
    .logout-btn:hover {
      transform: translateY(-2px);
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 15px;
      padding: 1.5rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      animation: slideIn 0.5s ease;
    }
    @keyframes slideIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .stat-card h3 {
      margin: 0 0 1rem 0;
      color: #666;
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .stat-card .value {
      font-size: 2.5rem;
      font-weight: bold;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .section {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 15px;
      padding: 2rem;
      margin-bottom: 2rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }
    .section h2 {
      margin: 0 0 1.5rem 0;
      color: #333;
    }
    .log-table {
      width: 100%;
      border-collapse: collapse;
    }
    .log-table th {
      text-align: left;
      padding: 0.75rem;
      border-bottom: 2px solid #e0e0e0;
      color: #666;
      font-weight: 600;
    }
    .log-table td {
      padding: 0.75rem;
      border-bottom: 1px solid #f0f0f0;
    }
    .log-table tr:hover {
      background: #f8f8f8;
    }
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .status-success {
      background: #10b981;
      color: white;
    }
    .status-pending {
      background: #f59e0b;
      color: white;
    }
  </style>
</head>
<body>
  <div class="dashboard">
    <div class="header">
      <h1>🚀 Admin Dashboard</h1>
      <form method="POST" style="display: inline;">
        <input type="hidden" name="action" value="logout">
        <button type="submit" class="logout-btn">Logout</button>
      </form>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Links</h3>
        <div class="value">${stats.totalLinks?.count || 0}</div>
      </div>
      <div class="stat-card">
        <h3>Active Links</h3>
        <div class="value">${stats.activeLinks?.count || 0}</div>
      </div>
      <div class="stat-card">
        <h3>Active Sessions</h3>
        <div class="value">${stats.totalSessions?.count || 0}</div>
      </div>
      <div class="stat-card">
        <h3>Migration Status</h3>
        <div class="value">
          <span class="status-badge ${migrationStatus.pending > 0 ? 'status-pending' : 'status-success'}">
            ${migrationStatus.pending > 0 ? `${migrationStatus.pending} Pending` : 'Up to date'}
          </span>
        </div>
      </div>
    </div>
    
    <div class="section">
      <h2>Recent Activity</h2>
      <table class="log-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>Details</th>
            <th>IP Address</th>
          </tr>
        </thead>
        <tbody>
          ${stats.recentLogs?.results?.map(log => `
            <tr>
              <td>${new Date(log.timestamp).toLocaleString()}</td>
              <td>${escapeHtml(log.action)}</td>
              <td>${escapeHtml(log.details || '-')}</td>
              <td>${escapeHtml(log.ip_address || '-')}</td>
            </tr>
          `).join('') || '<tr><td colspan="4">No activity yet</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      ...securityHeaders(nonce)
    }
  });
}

/**
 * Handle API admin login
 */
async function handleApiAdminLogin(request, env) {
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'Database not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const data = await request.json();
  const { username, password } = data;
  
  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'Username and password required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Get admin user
  const admin = await env.DB.prepare(
    'SELECT * FROM admin WHERE username = ?'
  ).bind(username).first();
  
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Verify password
  const encoder = new TextEncoder();
  const salt = new Uint8Array(admin.password_salt.match(/.{2}/g).map(byte => parseInt(byte, 16)));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: admin.iterations || 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  if (passwordHash !== admin.password_hash) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Create session token
  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  
  await env.DB.prepare(
    'INSERT INTO admin_sessions (token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?)'
  ).bind(
    sessionToken,
    expiresAt.toISOString(),
    request.headers.get('CF-Connecting-IP'),
    request.headers.get('User-Agent')
  ).run();
  
  return new Response(JSON.stringify({ 
    success: true, 
    token: sessionToken,
    expiresAt: expiresAt.toISOString()
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleApiLinks(request, env) {
  return new Response(JSON.stringify({ links: [] }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleApiAccessInit(request, env) {
  return new Response(JSON.stringify({ success: false }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleUserAccess(request, env) {
  return new Response('User access page - To be implemented', { status: 200 });
}

// Import and re-export necessary functions from worker.js
import { 
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
} from './worker.js';