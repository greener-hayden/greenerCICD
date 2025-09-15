# Greener CI/CD App Setup Guide

This guide will help you set up the Greener CI/CD GitHub App for automatic secret provisioning and CI/CD integration.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Creating the GitHub App](#creating-the-github-app)
- [Configuring the Webhook Handler](#configuring-the-webhook-handler)
- [Installation](#installation)
- [Verifying the Setup](#verifying-the-setup)
- [Troubleshooting](#troubleshooting)

## Prerequisites

- Node.js 18+ installed
- A server or cloud function to host the webhook handler
- GitHub account with admin access to target repositories

## Creating the GitHub App

### Step 1: Navigate to GitHub App Settings

1. Go to GitHub Settings → Developer settings → GitHub Apps
2. Click "New GitHub App"

### Step 2: Configure Basic Information

Fill in the following fields:

- **GitHub App name**: `Greener CI/CD App`
- **Homepage URL**: `https://github.com/greener-hayden/dotfiles`
- **Webhook URL**: Your webhook handler URL (e.g., `https://your-domain.com/webhooks/github`)
- **Webhook secret**: Generate a strong secret and save it securely

### Step 3: Set Permissions

Configure the following repository permissions:

| Permission | Access Level | Purpose |
|------------|--------------|---------|
| Actions | Write | Manage workflows and runs |
| Administration | Read | Read repository settings |
| Checks | Write | Create check runs |
| Contents | Read | Read repository files |
| Deployments | Write | Manage deployments |
| Environments | Write | Manage deployment environments |
| Issues | Write | Create issue comments |
| Metadata | Read | Basic repository info |
| Pull requests | Write | Create/update PRs |
| Secrets | Write | **Critical: Set repository secrets** |

### Step 4: Subscribe to Events

Select these webhook events:

- ✅ Installation
- ✅ Installation repositories
- ✅ Push
- ✅ Pull request
- ✅ Workflow job
- ✅ Workflow run
- ✅ Repository
- ✅ Release
- ✅ Deployment
- ✅ Deployment status

### Step 5: Create the App

1. Click "Create GitHub App"
2. You'll be redirected to the app settings page
3. Generate a private key and download it
4. Note down your App ID

## Configuring the Webhook Handler

### Step 1: Clone the Repository

```bash
git clone https://github.com/greener-hayden/dotfiles.git
cd dotfiles/github-app
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment

1. Copy the example files:
```bash
cp .env.example .env
cp config.json.example config.json
```

2. Edit `.env` with your values:
```env
GITHUB_APP_ID=your-app-id
GITHUB_APP_PRIVATE_KEY_PATH=./private-key.pem
GITHUB_WEBHOOK_SECRET=your-webhook-secret
PORT=3000
```

3. Place your private key file as `private-key.pem` in the github-app directory

### Step 4: Deploy the Webhook Handler

#### Option A: Deploy to Vercel

```bash
npx vercel --prod
```

#### Option B: Deploy to AWS Lambda

```bash
# Install serverless framework
npm install -g serverless

# Deploy
serverless deploy
```

#### Option C: Deploy to a VPS

```bash
# On your server
npm install pm2 -g
pm2 start webhook-handler.js --name greener-cicd
pm2 save
pm2 startup
```

### Step 5: Update Webhook URL

Go back to your GitHub App settings and update the webhook URL with your deployed handler URL.

## Installation

### Installing on Your Repositories

1. Go to your GitHub App's public page: `https://github.com/apps/greener-cicd-app`
2. Click "Install"
3. Select repositories or "All repositories"
4. Click "Install"

### What Happens During Installation

When you install the app, it automatically:

1. **Generates unique credentials** for your installation
2. **Creates repository secrets**:
   - `GREENER_CI_KEY` - Unique authentication key
   - `GREENER_CI_SECRET` - Encrypted secret
   - `GREENER_API_TOKEN` - API access token
   - `GREENER_APP_ID` - GitHub App ID
   - `GREENER_INSTALLATION_ID` - Installation identifier

3. **Sets up environment-specific secrets** (if environments exist):
   - Development, staging, and production variants

4. **Creates initial workflow** (optional):
   - Adds `.github/workflows/greener-ci.yml` if it doesn't exist

## Verifying the Setup

### Check Repository Secrets

1. Go to your repository → Settings → Secrets and variables → Actions
2. You should see the GREENER_* secrets listed
3. These are encrypted and cannot be viewed

### Test the Workflow

Create a test workflow to verify secret access:

```yaml
name: Test Greener CI/CD
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Verify Secrets
        run: |
          if [ -n "${{ secrets.GREENER_CI_KEY }}" ]; then
            echo "✅ GREENER_CI_KEY is set"
          fi
          if [ -n "${{ secrets.GREENER_INSTALLATION_ID }}" ]; then
            echo "✅ GREENER_INSTALLATION_ID is set"
          fi
```

### Check Webhook Logs

Monitor your webhook handler logs:

```bash
# If using PM2
pm2 logs greener-cicd

# If using Docker
docker logs greener-cicd

# If using systemd
journalctl -u greener-cicd -f
```

## Using the Secrets in Your Workflows

### Basic Usage

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    env:
      GREENER_CI_KEY: ${{ secrets.GREENER_CI_KEY }}
      GREENER_CI_SECRET: ${{ secrets.GREENER_CI_SECRET }}
    steps:
      - uses: actions/checkout@v3

      - name: Authenticate with Greener CI/CD
        run: |
          # Your authentication logic here
          echo "Authenticated with installation ${{ secrets.GREENER_INSTALLATION_ID }}"
```

### Environment-Specific Deployment

```yaml
deploy:
  runs-on: ubuntu-latest
  environment: production
  steps:
    - name: Deploy to Production
      env:
        GREENER_CI_KEY: ${{ secrets.GREENER_CI_KEY_PRODUCTION }}
        GREENER_CI_SECRET: ${{ secrets.GREENER_CI_SECRET_PRODUCTION }}
      run: |
        # Production deployment logic
```

## Troubleshooting

### Secrets Not Appearing

1. **Check permissions**: Ensure the app has `secrets: write` permission
2. **Verify installation**: Check if the repository is included in the installation
3. **Review logs**: Check webhook handler logs for errors

### Webhook Not Receiving Events

1. **Verify webhook URL**: Ensure it's publicly accessible
2. **Check webhook secret**: Must match between GitHub and handler
3. **Test connectivity**: Use GitHub's webhook delivery logs

### Permission Errors

If you see "Resource not accessible by integration":

1. Review app permissions in GitHub settings
2. Reinstall the app on affected repositories
3. Ensure the app has the required permissions for the operation

### Debugging Tips

Enable debug logging in the webhook handler:

```bash
DEBUG=* node webhook-handler.js
```

Test webhook locally using ngrok:

```bash
npx ngrok http 3000
# Use the ngrok URL as your webhook URL during development
```

## Security Best Practices

1. **Rotate secrets regularly**: Update webhook secret and API tokens periodically
2. **Limit permissions**: Only grant permissions your app actually needs
3. **Secure storage**: Use proper secret management for production
4. **Monitor access**: Review app installation logs regularly
5. **Use environments**: Separate secrets for different deployment stages

## Support

For issues or questions:

1. Check the [GitHub App documentation](https://docs.github.com/en/developers/apps)
2. Review [webhook handler logs](#check-webhook-logs)
3. Open an issue at [greener-hayden/dotfiles](https://github.com/greener-hayden/dotfiles/issues)

## License

MIT - See [LICENSE](../LICENSE) for details