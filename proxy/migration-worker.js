/**
 * Cloudflare Worker for Database Migrations
 * Handles automatic migration execution on deployment
 */

import { runMigrations, getMigrationStatus } from './migrations/index.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Check for DB binding
    if (!env.DB) {
      return new Response('Database not configured', { status: 500 });
    }
    
    try {
      switch (path) {
        case '/migrate':
          return await handleMigrate(request, env);
        case '/status':
          return await handleStatus(env);
        case '/health':
          return new Response('OK', { status: 200 });
        default:
          return new Response('Migration Worker - Use /migrate or /status', { 
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
          });
      }
    } catch (error) {
      console.error('Migration error:', error);
      return new Response(`Error: ${error.message}`, { status: 500 });
    }
  },
  
  // Run migrations on worker startup (scheduled event)
  async scheduled(event, env, ctx) {
    console.log('Running scheduled migration check...');
    try {
      const result = await runMigrations(env.DB);
      console.log('Migration result:', result);
    } catch (error) {
      console.error('Scheduled migration failed:', error);
    }
  }
};

/**
 * Handle migration execution
 */
async function handleMigrate(request, env) {
  // Verify authorization
  const authHeader = request.headers.get('Authorization');
  const expectedToken = env.MIGRATION_TOKEN;
  
  if (!expectedToken) {
    return new Response('Migration token not configured', { status: 500 });
  }
  
  if (authHeader !== `Bearer ${expectedToken}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Run migrations
  const result = await runMigrations(env.DB);
  
  return new Response(JSON.stringify({
    success: true,
    ...result
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Get migration status
 */
async function handleStatus(env) {
  const status = await getMigrationStatus(env.DB);
  
  return new Response(JSON.stringify(status), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}