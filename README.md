# Greener CI/CD

[![Sync Status](https://github.com/greener-hayden/greenerCICD/actions/workflows/sync-app-secrets.yml/badge.svg)](https://github.com/greener-hayden/greenerCICD/actions/workflows/sync-app-secrets.yml)
[![Worker Deploy](https://github.com/greener-hayden/greenerCICD/actions/workflows/deploy-worker.yml/badge.svg)](https://github.com/greener-hayden/greenerCICD/actions/workflows/deploy-worker.yml)

Automated GitHub App for zero-infrastructure secret management in CI/CD pipelines. Automatically discovers and configures all repositories that install the app with webhook-driven secret provisioning.

## What it does
- **Automatic Secret Provisioning**: When you install the GitHub App on a repo, it automatically gets `GREENER_*` prefixed secrets
- **Webhook-Driven**: Real-time webhook processing via Cloudflare Worker for instant setup
- **Weekly Sync**: Automatic secret rotation and sync to keep credentials fresh
- **Zero Infrastructure**: No servers to maintain, uses GitHub Actions + Cloudflare Workers

## Setup

### 1. Repository Secrets
Add these secrets to the greenerCICD repository:
- `APP_ID` - Your GitHub App ID
- `APP_PRIVATE_KEY` - Contents of your GitHub App private key (.pem file)
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Worker:Edit permissions
- `GITHUB_WEBHOOK_SECRET` (optional) - GitHub App webhook secret for verification

### 2. Deploy Cloudflare Worker
The worker deploys automatically when you push changes to `proxy/` folder. You can also trigger it manually:
```bash
gh workflow run deploy-worker.yml
```

### 3. Configure GitHub App Webhook
- Set your GitHub App webhook URL to your deployed Cloudflare Worker endpoint
- Set webhook events: `installation`, `installation_repositories`

### 4. Install the App
Install your GitHub App on repositories that need automatic CI/CD secret provisioning.

## How it Works

1. **GitHub App Installation** → Webhook to Cloudflare Worker
2. **Cloudflare Worker** → `repository_dispatch` to greenerCICD repo
3. **webhook-receiver.yml** → Triggers sync-app-secrets.yml
4. **sync-app-secrets.yml** → Provisions secrets to all installed repos

## Generated Secrets

Each repository gets these secrets automatically:
- `GREENER_CI_KEY` - Unique CI key
- `GREENER_CI_SECRET` - Unique CI secret
- `GREENER_API_TOKEN` - API access token
- `GREENER_APP_ID` - GitHub App ID
- `GREENER_INSTALLATION_ID` - Installation ID

## Monitoring

Check sync status: `gh run list --workflow=sync-app-secrets.yml`

MIT License