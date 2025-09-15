# Greener CI/CD

[![Sync Status](https://github.com/greener-hayden/greenerCICD/actions/workflows/sync-app-secrets.yml/badge.svg)](https://github.com/greener-hayden/greenerCICD/actions/workflows/sync-app-secrets.yml)

Automated GitHub App for zero-infrastructure secret management in CI/CD pipelines. Automatically discovers and configures all repositories that install the app.

## What it does
Automatically provisions and manages secrets for GitHub repositories without requiring external infrastructure.
Weekly synchronization ensures your secrets stay up-to-date.

## Quick Setup

1. **Add secrets to your repository:**
   - Go to Settings → Secrets → Actions
   - Add `APP_ID` - Your GitHub App ID  
   - Add `APP_PRIVATE_KEY` - Contents of your GitHub App private key (.pem file)

2. **Install the app:** Visit [github.com/settings/installations/85948928](https://github.com/settings/installations/85948928)

3. **Sync secrets:** Run `gh workflow run sync-app-secrets.yml`

4. **Monitor:** Check status with `gh run list --workflow=sync-app-secrets.yml`

MIT License