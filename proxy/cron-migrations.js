/**
 * Cloudflare Worker Cron Trigger for Automatic Migrations
 * This can be added to the main worker or deployed separately
 */

import { runMigrations, getMigrationStatus } from './migrations/index.js';

/**
 * Scheduled trigger for automatic migration checks
 * Add this to wrangler.toml:
 * [triggers]
 * crons = ["0 */6 * * *"]  # Run every 6 hours
 */
export async function scheduled(event, env, ctx) {
  console.log(`[CRON] Migration check triggered at ${new Date().toISOString()}`);
  
  if (!env.DB) {
    console.error('[CRON] No database binding found');
    return;
  }
  
  try {
    // Check current status
    const statusBefore = await getMigrationStatus(env.DB);
    console.log('[CRON] Current status:', {
      applied: statusBefore.applied,
      pending: statusBefore.pending
    });
    
    if (statusBefore.pending > 0) {
      console.log(`[CRON] Found ${statusBefore.pending} pending migrations`);
      
      // Run migrations
      const result = await runMigrations(env.DB);
      console.log('[CRON] Migration result:', result);
      
      // Send notification if configured
      if (env.WEBHOOK_URL) {
        await sendNotification(env.WEBHOOK_URL, {
          type: 'migration_complete',
          migrations_run: result.new,
          total: result.total
        });
      }
    } else {
      console.log('[CRON] No pending migrations');
    }
  } catch (error) {
    console.error('[CRON] Migration error:', error);
    
    // Send error notification if configured
    if (env.WEBHOOK_URL) {
      await sendNotification(env.WEBHOOK_URL, {
        type: 'migration_error',
        error: error.message
      });
    }
  }
}

/**
 * Send webhook notification
 */
async function sendNotification(webhookUrl, data) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        ...data
      })
    });
  } catch (error) {
    console.error('[CRON] Failed to send notification:', error);
  }
}

/**
 * Export for use in main worker
 */
export function setupCronMigrations(env) {
  return {
    scheduled: (event, ctx) => scheduled(event, env, ctx)
  };
}