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

// Main fetch handler for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    // Run migrations in background on first request
    if (env.DB && env.AUTO_MIGRATE !== 'false') {
      ctx.waitUntil(
        runMigrations(env.DB).catch(err => 
          console.error('Background migration failed:', err)
        )
      );
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
    
    // Hash password using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(password + env.GITHUB_OWNER); // Use env var as salt
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const passwordHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Create admin
    await env.DB.prepare(
      'INSERT INTO admin (username, password_hash) VALUES (?, ?)'
    ).bind(username, passwordHash).run();
    
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
               placeholder="admin" value="admin">
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

// Placeholder functions for routes (implement as needed)
async function handleAdminPage(request, env) {
  return Response.redirect(new URL('/admin/setup', env.PROXY_URL).toString());
}

async function handleAdminLogin(request, env) {
  return new Response('Admin login page - To be implemented', { status: 200 });
}

async function handleAdminDashboard(request, env) {
  return new Response('Admin dashboard - To be implemented', { status: 200 });
}

async function handleApiAdminLogin(request, env) {
  return new Response(JSON.stringify({ message: 'Login endpoint' }), {
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

// Re-export existing functions
export * from './worker.js';