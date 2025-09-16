# Greener CI/CD

[![Worker Deploy](https://github.com/greener-hayden/greenerCICD/actions/workflows/deploy-worker.yml/badge.svg)](https://github.com/greener-hayden/greenerCICD/actions/workflows/deploy-worker.yml)

**Ultra-minimal GitHub App for instant secret provisioning.** Pure Cloudflare Worker + GitHub API - no GitHub Actions compute needed.

## What it does
- **Install & Setup**: Install GitHub App → redirected to setup page → select repos → instant secret provisioning
- **Pure Web Interface**: Clean setup page with repo selection and real-time provisioning
- **Zero Infrastructure**: Single Cloudflare Worker handles everything
- **Instant Provisioning**: Direct GitHub API calls, no workflow delays

## Architecture

```
GitHub App Install → Setup Page → Select Repos → Provision Secrets
                     ↓
                 Cloudflare Worker
                     ↓
                 GitHub API (direct)
```

**Total files: 3**
- `proxy/worker.js` - The entire application (~400 lines)
- `wrangler.toml` - Cloudflare configuration
- `README.md` - This file

## Setup

### 1. Repository Secrets
Add to greenerCICD repository:
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Worker:Edit permissions
- `GITHUB_TOKEN` - Personal access token with repo access
- `APP_ID` - GitHub App ID (optional, for advanced features)
- `WEBHOOK_SECRET` - GitHub App webhook secret (optional)

### 2. Deploy Worker
```bash
gh workflow run deploy-worker.yml
```

### 3. Configure GitHub App
- **Webhook URL**: `https://your-worker.workers.dev/`
- **Setup URL**: `https://your-worker.workers.dev/setup`
- **Request user authorization**: ✅ Enabled
- **Webhook events**: `installation`, `installation_repositories`

### 4. User Experience
1. User installs GitHub App
2. Redirected to setup page
3. Selects repositories from clean interface
4. Clicks "Provision CI/CD Secrets"
5. Instant provisioning with real-time feedback

## Generated Secrets

Each repository gets:
- `GREENER_CI_KEY` - Unique CI key
- `GREENER_CI_SECRET` - Unique CI secret
- `GREENER_API_TOKEN` - API access token
- `GREENER_APP_ID` - GitHub App ID
- `GREENER_INSTALLATION_ID` - Installation ID

## Benefits

- **90% less code** than traditional GitHub Actions approach
- **Instant provisioning** (no workflow delays)
- **Real-time UI feedback**
- **Zero GitHub Actions compute** for secret management
- **Clean user experience** leveraging GitHub's native flows

MIT License