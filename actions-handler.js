#!/usr/bin/env node

/**
 * GitHub Actions-based Webhook Handler
 * Runs inside GitHub Actions to process webhook events
 */

const crypto = require('crypto');
const { App } = require('@octokit/app');
const { Octokit } = require('@octokit/rest');

class ActionsWebhookHandler {
    constructor() {
        this.appId = process.env.GITHUB_APP_ID;
        this.privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
        this.webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
        this.event = process.env.WEBHOOK_EVENT;
        this.payloadBase64 = process.env.WEBHOOK_PAYLOAD;
        this.signature = process.env.WEBHOOK_SIGNATURE;

        // Validate required environment variables
        if (!this.appId || !this.privateKey) {
            throw new Error('Missing required GitHub App credentials');
        }

        // Initialize GitHub App
        this.app = new App({
            appId: this.appId,
            privateKey: this.privateKey
        });
    }

    /**
     * Decode and parse the webhook payload
     */
    getPayload() {
        if (!this.payloadBase64) {
            throw new Error('No webhook payload provided');
        }

        // Decode from base64
        const payloadString = Buffer.from(this.payloadBase64, 'base64').toString('utf8');
        return JSON.parse(payloadString);
    }

    /**
     * Verify webhook signature (if provided)
     */
    verifySignature(payload) {
        if (!this.signature || !this.webhookSecret) {
            console.log('⚠️  Skipping signature verification (no signature or secret provided)');
            return true;
        }

        const expectedSignature = `sha256=${crypto
            .createHmac('sha256', this.webhookSecret)
            .update(JSON.stringify(payload))
            .digest('hex')}`;

        const isValid = crypto.timingSafeEqual(
            Buffer.from(this.signature),
            Buffer.from(expectedSignature)
        );

        if (!isValid) {
            console.error('❌ Invalid webhook signature');
        }

        return isValid;
    }

    /**
     * Process the webhook event
     */
    async processWebhook() {
        console.log(`📨 Processing webhook event: ${this.event}`);

        // Get and verify payload
        const payload = this.getPayload();

        // Log event details
        console.log(`Event: ${this.event}`);
        console.log(`Delivery ID: ${payload.delivery || 'N/A'}`);

        // Verify signature
        if (!this.verifySignature(payload)) {
            throw new Error('Invalid webhook signature');
        }

        // Handle different event types
        switch (this.event) {
            case 'installation.created':
                await this.handleInstallationCreated(payload);
                break;

            case 'installation.deleted':
                await this.handleInstallationDeleted(payload);
                break;

            case 'installation_repositories.added':
                await this.handleRepositoriesAdded(payload);
                break;

            case 'installation_repositories.removed':
                await this.handleRepositoriesRemoved(payload);
                break;

            default:
                console.log(`ℹ️  Event ${this.event} received but no handler defined`);
        }

        console.log('✅ Webhook processed successfully');
    }

    /**
     * Handle installation created event
     */
    async handleInstallationCreated(payload) {
        const { installation, repositories } = payload;
        const installationId = installation.id;

        console.log(`🚀 New installation: ${installationId}`);
        console.log(`📦 Repositories: ${repositories ? repositories.length : 0}`);

        // Installation webhook already includes repository list
        if (repositories && repositories.length > 0) {
            // The secrets provisioning happens in the workflow itself
            // This handler just logs and validates
            console.log('Repositories to configure:');
            repositories.forEach(repo => {
                console.log(`  - ${repo.full_name}`);
            });
        }

        // Store installation metadata (for tracking)
        console.log(`::set-output name=installation_id::${installationId}`);
        console.log(`::set-output name=account::${installation.account.login}`);
        console.log(`::set-output name=account_type::${installation.account.type}`);
    }

    /**
     * Handle installation deleted event
     */
    async handleInstallationDeleted(payload) {
        const { installation } = payload;
        const installationId = installation.id;

        console.log(`🗑️  Installation deleted: ${installationId}`);
        console.log(`Account: ${installation.account.login}`);

        // Note: GitHub automatically removes the app's access to repositories
        // We just log this for audit purposes
    }

    /**
     * Handle repositories added to installation
     */
    async handleRepositoriesAdded(payload) {
        const { installation, repositories_added } = payload;
        const installationId = installation.id;

        console.log(`📦 Adding ${repositories_added.length} repositories to installation ${installationId}`);

        repositories_added.forEach(repo => {
            console.log(`  + ${repo.full_name}`);
        });

        // The actual secret provisioning happens in the workflow
        console.log(`::set-output name=installation_id::${installationId}`);
        console.log(`::set-output name=repos_added::${repositories_added.length}`);
    }

    /**
     * Handle repositories removed from installation
     */
    async handleRepositoriesRemoved(payload) {
        const { installation, repositories_removed } = payload;
        const installationId = installation.id;

        console.log(`📦 Removing ${repositories_removed.length} repositories from installation ${installationId}`);

        repositories_removed.forEach(repo => {
            console.log(`  - ${repo.full_name}`);
        });

        // Note: GitHub automatically removes the app's access
        // Secrets remain in the repository but the app can't access them
    }

    /**
     * Main execution
     */
    async run() {
        try {
            await this.processWebhook();
            process.exit(0);
        } catch (error) {
            console.error('❌ Error processing webhook:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }
}

// Run if executed directly
if (require.main === module) {
    const handler = new ActionsWebhookHandler();
    handler.run();
}

module.exports = ActionsWebhookHandler;