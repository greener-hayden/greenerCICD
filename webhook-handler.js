#!/usr/bin/env node

/**
 * GitHub App Webhook Handler for Greener CI/CD App
 * Handles installation events and automatically provisions secrets
 */

const crypto = require('crypto');
const { App } = require('@octokit/app');
const { Octokit } = require('@octokit/rest');
const sodium = require('libsodium-wrappers');

// Configuration from environment variables
const config = {
  appId: process.env.GITHUB_APP_ID,
  privateKey: process.env.GITHUB_APP_PRIVATE_KEY,
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET
};

class GreenerCICDApp {
  constructor() {
    this.app = new App({
      appId: config.appId,
      privateKey: config.privateKey,
      webhooks: {
        secret: config.webhookSecret
      }
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', this.app.webhooks.secret)
      .update(payload)
      .digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Generate unique installation credentials
   */
  generateInstallationCredentials(installationId) {
    const key = crypto.randomBytes(32).toString('hex');
    const secret = crypto.randomBytes(64).toString('hex');
    const apiToken = crypto.randomBytes(32).toString('hex');

    return {
      GREENER_CI_KEY: key,
      GREENER_CI_SECRET: secret,
      GREENER_API_TOKEN: apiToken,
      GREENER_APP_ID: String(this.app.appId),
      GREENER_INSTALLATION_ID: String(installationId)
    };
  }

  /**
   * Encrypt secret for GitHub repository
   */
  async encryptSecret(publicKey, secretValue) {
    await sodium.ready;

    const binkey = sodium.from_base64(publicKey, sodium.base64_variants.ORIGINAL);
    const binsec = sodium.from_string(secretValue);

    const encBytes = sodium.crypto_box_seal(binsec, binkey);
    return sodium.to_base64(encBytes, sodium.base64_variants.ORIGINAL);
  }

  /**
   * Set repository secrets
   */
  async setRepositorySecrets(octokit, owner, repo, secrets) {
    try {
      // Get repository public key for secret encryption
      const { data: publicKey } = await octokit.actions.getRepoPublicKey({
        owner,
        repo
      });

      // Set each secret
      for (const [name, value] of Object.entries(secrets)) {
        const encryptedValue = await this.encryptSecret(publicKey.key, value);

        await octokit.actions.createOrUpdateRepoSecret({
          owner,
          repo,
          secret_name: name,
          encrypted_value: encryptedValue,
          key_id: publicKey.key_id
        });

        console.log(`✅ Set secret ${name} for ${owner}/${repo}`);
      }

      // Also create environment-specific secrets if needed
      await this.setEnvironmentSecrets(octokit, owner, repo, secrets);

    } catch (error) {
      console.error(`❌ Failed to set secrets for ${owner}/${repo}:`, error.message);
      throw error;
    }
  }

  /**
   * Set environment-specific secrets
   */
  async setEnvironmentSecrets(octokit, owner, repo, secrets) {
    const environments = ['development', 'staging', 'production'];

    for (const environment of environments) {
      try {
        // Create environment if it doesn't exist
        await octokit.repos.createOrUpdateEnvironment({
          owner,
          repo,
          environment_name: environment
        });

        // Get environment public key
        const { data: publicKey } = await octokit.actions.getEnvironmentPublicKey({
          repository_id: (await octokit.repos.get({ owner, repo })).data.id,
          environment_name: environment
        });

        // Set environment-specific secrets
        for (const [name, value] of Object.entries(secrets)) {
          const envSecretName = `${name}_${environment.toUpperCase()}`;
          const encryptedValue = await this.encryptSecret(publicKey.key, value);

          await octokit.actions.createOrUpdateEnvironmentSecret({
            repository_id: (await octokit.repos.get({ owner, repo })).data.id,
            environment_name: environment,
            secret_name: envSecretName,
            encrypted_value: encryptedValue,
            key_id: publicKey.key_id
          });
        }

        console.log(`✅ Set environment secrets for ${environment} in ${owner}/${repo}`);
      } catch (error) {
        console.warn(`⚠️  Could not set secrets for environment ${environment}:`, error.message);
      }
    }
  }

  /**
   * Handle installation created event
   */
  async handleInstallation(payload) {
    const { installation, repositories } = payload;
    const installationId = installation.id;

    console.log(`🚀 New installation: ${installationId}`);
    console.log(`📦 Repositories: ${repositories.length}`);

    // Get installation client
    const octokit = await this.app.getInstallationOctokit(installationId);

    // Generate unique credentials for this installation
    const credentials = this.generateInstallationCredentials(installationId);

    // Store credentials in your database (implement this based on your storage)
    await this.storeInstallationCredentials(installationId, credentials);

    // Set secrets for each repository
    for (const repo of repositories) {
      await this.setRepositorySecrets(
        octokit,
        repo.full_name.split('/')[0],
        repo.name,
        credentials
      );
    }

    // Create initial workflow file if needed
    for (const repo of repositories) {
      await this.createInitialWorkflow(
        octokit,
        repo.full_name.split('/')[0],
        repo.name
      );
    }

    console.log(`✅ Installation ${installationId} configured successfully`);
  }

  /**
   * Handle repository added to installation
   */
  async handleRepositoryAdded(payload) {
    const { installation, repositories_added } = payload;
    const installationId = installation.id;

    console.log(`📦 Adding ${repositories_added.length} repositories to installation ${installationId}`);

    const octokit = await this.app.getInstallationOctokit(installationId);

    // Retrieve stored credentials for this installation
    const credentials = await this.getInstallationCredentials(installationId);

    // Set secrets for newly added repositories
    for (const repo of repositories_added) {
      await this.setRepositorySecrets(
        octokit,
        repo.full_name.split('/')[0],
        repo.name,
        credentials
      );
    }
  }

  /**
   * Create initial CI/CD workflow file
   */
  async createInitialWorkflow(octokit, owner, repo) {
    const workflowContent = `name: Greener CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Authenticate with Greener CI/CD
        run: |
          echo "Authenticating with Greener CI/CD..."
          echo "App ID: \${{ secrets.GREENER_APP_ID }}"
          echo "Installation ID: \${{ secrets.GREENER_INSTALLATION_ID }}"
        env:
          GREENER_CI_KEY: \${{ secrets.GREENER_CI_KEY }}
          GREENER_CI_SECRET: \${{ secrets.GREENER_CI_SECRET }}
          GREENER_API_TOKEN: \${{ secrets.GREENER_API_TOKEN }}

      - name: Run CI/CD Pipeline
        run: |
          # Your CI/CD commands here
          echo "Running Greener CI/CD pipeline..."
`;

    try {
      // Check if workflow already exists
      const workflowPath = '.github/workflows/greener-ci.yml';

      try {
        await octokit.repos.getContent({
          owner,
          repo,
          path: workflowPath
        });
        console.log(`ℹ️  Workflow already exists in ${owner}/${repo}`);
        return;
      } catch (error) {
        // File doesn't exist, create it
        if (error.status === 404) {
          await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: workflowPath,
            message: '🚀 Add Greener CI/CD workflow',
            content: Buffer.from(workflowContent).toString('base64'),
            committer: {
              name: 'Greener CI/CD App',
              email: 'ci@greener-hayden.dev'
            }
          });
          console.log(`✅ Created workflow file in ${owner}/${repo}`);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Could not create workflow file:`, error.message);
    }
  }

  /**
   * Store installation credentials (implement based on your storage solution)
   */
  async storeInstallationCredentials(installationId, credentials) {
    // This is a placeholder - implement actual storage
    // Options: PostgreSQL, MongoDB, Redis, AWS Secrets Manager, etc.
    console.log(`💾 Storing credentials for installation ${installationId}`);

    // For development, you might use a JSON file
    const fs = require('fs').promises;
    const dbPath = './installations.json';

    try {
      const db = JSON.parse(await fs.readFile(dbPath, 'utf8').catch(() => '{}'));
      db[installationId] = {
        ...credentials,
        createdAt: new Date().toISOString()
      };
      await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
    } catch (error) {
      console.error('Failed to store credentials:', error);
    }
  }

  /**
   * Retrieve installation credentials
   */
  async getInstallationCredentials(installationId) {
    // This is a placeholder - implement actual retrieval
    const fs = require('fs').promises;
    const dbPath = './installations.json';

    try {
      const db = JSON.parse(await fs.readFile(dbPath, 'utf8'));
      return db[installationId];
    } catch (error) {
      console.error('Failed to retrieve credentials:', error);
      return null;
    }
  }

  /**
   * Main webhook handler
   */
  async handleWebhook(eventName, payload) {
    console.log(`📨 Received webhook: ${eventName}`);

    switch (eventName) {
      case 'installation.created':
        await this.handleInstallation(payload);
        break;

      case 'installation_repositories.added':
        await this.handleRepositoryAdded(payload);
        break;

      case 'installation.deleted':
        console.log(`🗑️  Installation ${payload.installation.id} deleted`);
        // Clean up stored credentials
        break;

      case 'installation_repositories.removed':
        console.log(`📦 Repositories removed from installation ${payload.installation.id}`);
        break;

      default:
        console.log(`ℹ️  Unhandled event: ${eventName}`);
    }
  }
}

// Express server setup (if running as standalone webhook handler)
if (require.main === module) {
  const express = require('express');
  const app = express();
  const PORT = process.env.PORT || 3000;

  const greenerApp = new GreenerCICDApp();

  app.use(express.json());

  app.post('/webhooks/github', async (req, res) => {
    const signature = req.headers['x-hub-signature-256'];
    const event = req.headers['x-github-event'];

    if (!greenerApp.verifyWebhookSignature(JSON.stringify(req.body), signature)) {
      return res.status(401).send('Invalid signature');
    }

    try {
      await greenerApp.handleWebhook(event, req.body);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Webhook handling error:', error);
      res.status(500).send('Internal server error');
    }
  });

  app.listen(PORT, () => {
    console.log(`🚀 Greener CI/CD webhook handler listening on port ${PORT}`);
  });
}

module.exports = GreenerCICDApp;