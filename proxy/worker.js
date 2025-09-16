/**
 * Greener CI/CD Worker - Simplified
 * CLI-first secret provisioning for GitHub repositories
 */

import { escapeHtml } from './utils/sanitize.js';
import { getEnv } from './utils/env.js';
import { parseRequiredString, parsePositiveInt, readJson, parseStringArray } from './utils/validation.js';
import { makeNonce, securityHeaders } from './utils/csp.js';
import { enforceRateLimit, getClientKey, RateLimitError } from './utils/rateLimit.js';

// Main fetch handler for Cloudflare Workers
export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env, ctx);
  }
};

/**
 * Main request handler
 */
async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    const validatedEnv = getEnv(env);
    const clientKey = getClientKey(request);
    await enforceRateLimit(validatedEnv, clientKey, 60, 60);
    
    switch (path) {
      case '/':
        return request.method === 'POST' 
          ? handleWebhook(request, validatedEnv) 
          : handleHome();
      case '/health':
        return handleHealth();
      case '/api/cli-provision':
        return request.method === 'POST'
          ? handleCliProvision(request, validatedEnv)
          : new Response('Method not allowed', { status: 405 });
      default:
        return new Response('Not found', { status: 404 });
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
 * Handle home page - simplified
 */
function handleHome() {
  const nonce = makeNonce();
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Greener CI/CD</title>
  <style>
    body { font-family: system-ui; background: #0d1117; color: #fff; margin: 0; padding: 2rem; text-align: center; }
    h1 { font-size: 3rem; margin: 2rem 0 1rem; }
    p { color: #9198a1; font-size: 1.2rem; margin-bottom: 3rem; }
    .status { color: #248637; }
    code { background: #212830; padding: 1rem; border-radius: 6px; display: block; margin: 2rem auto; max-width: 600px; text-align: left; }
  </style>
</head>
<body>
  <h1>🌱 Greener CI/CD</h1>
  <p>CLI-first secret provisioning for GitHub repositories</p>
  <p class="status">✓ Worker Active</p>
  
  <code>
    # Install and use the CLI tool<br>
    curl -o greener-provision https://raw.githubusercontent.com/greener-hayden/greenerCICD/main/greener-provision<br>
    chmod +x greener-provision<br>
    ./greener-provision
  </code>
</body>
</html>`;
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...securityHeaders(nonce)
    }
  });
}


/**
 * Handle CLI provision API - simplified
 */
async function handleCliProvision(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonError('Authorization required', 401);
    }

    const userToken = authHeader.slice(7);
    const { repository } = await readJson(request);

    if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repository)) {
      return jsonError('Invalid repository format', 400);
    }

    // Verify access
    const verify = await fetch(`https://api.github.com/repos/${repository}`, {
      headers: {
        'Authorization': `Bearer ${userToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greener-CI-CD-CLI'
      }
    });

    if (!verify.ok) {
      return jsonError(
        verify.status === 401 ? 'Invalid token' : `Repository access failed: ${verify.status}`,
        verify.status
      );
    }

    // Generate and create secrets
    const secrets = generateSecrets();
    const results = [];
    
    for (const [name, value] of Object.entries(secrets)) {
      const success = await createSecret(repository, name, value, userToken);
      results.push({ name, status: success ? 'success' : 'failed' });
    }

    return new Response(JSON.stringify({
      success: results.every(r => r.status === 'success'),
      repository,
      secrets: results.filter(r => r.status === 'success').map(r => r.name),
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return jsonError(error.message, 500);
  }
}


/**
 * Handle health check endpoint
 */
function handleHealth() {
  return new Response(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    worker: 'greener-cicd',
    version: '1.0.0'
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}



/**
 * Generate secrets
 */
function generateSecrets() {
  const randomString = (len) => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const arr = crypto.getRandomValues(new Uint8Array(len));
    return Array.from(arr, b => chars[b % chars.length]).join('');
  };
  
  return {
    GREENER_CI_KEY: randomString(32),
    GREENER_CI_SECRET: randomString(64),
    GREENER_API_TOKEN: randomString(32),
    GREENER_APP_ID: 'cli-generated',
    GREENER_INSTALLATION_ID: 'user-provisioned'
  };
}

/**
 * Create secret in repository
 */
async function createSecret(repo, name, value, token) {
  try {
    const keyRes = await fetch(`https://api.github.com/repos/${repo}/actions/secrets/public-key`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greener-CI-CD-CLI'
      }
    });

    if (!keyRes.ok) return false;
    
    const { key_id } = await keyRes.json();
    
    const secretRes = await fetch(`https://api.github.com/repos/${repo}/actions/secrets/${name}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Greener-CI-CD-CLI',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        encrypted_value: btoa(value), // TODO: Use proper encryption
        key_id
      })
    });

    return secretRes.ok;
  } catch {
    return false;
  }
}

/**
 * Helper functions
 */
function jsonError(message, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}