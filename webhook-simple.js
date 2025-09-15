#!/usr/bin/env node

// Ultra-simple GitHub App webhook handler (<50 lines)
const crypto = require('crypto');

// Verify webhook signature
function verifySignature(payload, signature, secret) {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// Handle webhook
async function handleWebhook(event, payload) {
  const { installation, repositories, repositories_added, repositories_removed } = JSON.parse(payload);

  console.log(`📨 Event: ${event}, Installation: ${installation?.id || 'unknown'}`);

  // Handle repository changes
  const repos = repositories || repositories_added || [];
  const removed = repositories_removed || [];

  if (repos.length > 0) {
    console.log(`➕ Setting secrets for ${repos.length} repositories:`);

    // Trigger the sync workflow via GitHub API
    const response = await fetch(
      `https://api.github.com/repos/greener-hayden/dotfiles/actions/workflows/sync-app-secrets.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `token ${process.env.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({ ref: 'main' })
      }
    );

    if (response.ok) {
      console.log('✅ Triggered secret sync workflow');
    } else {
      console.error('❌ Failed to trigger workflow:', response.status);
      process.exit(1);  // Retry webhook
    }
  }

  if (removed.length > 0) {
    console.log(`➖ Removed ${removed.length} repositories (secrets remain for security)`);
  }
}

// Main
if (require.main === module) {
  const event = process.env.X_GITHUB_EVENT;
  const payload = process.env.WEBHOOK_PAYLOAD;
  const signature = process.env.X_HUB_SIGNATURE_256;

  if (!verifySignature(payload, signature, process.env.WEBHOOK_SECRET)) {
    console.error('❌ Invalid signature');
    process.exit(1);
  }

  handleWebhook(event, payload).catch(console.error);
}