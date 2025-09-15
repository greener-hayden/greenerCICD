# GitHub Actions-Based Webhook Handler Setup

This guide explains how to set up the Greener CI/CD App using GitHub Actions as the webhook processor, eliminating the need for external infrastructure.

## Architecture Overview

```
GitHub App Webhook
    ↓
Cloudflare Worker (Proxy)
    ↓
GitHub Actions (workflow_dispatch)
    ↓
Process Webhook & Set Secrets
```

## Prerequisites

1. GitHub repository (private recommended)
2. GitHub App created
3. Cloudflare account (free tier works) OR Vercel account

## Step 1: Create GitHub App

1. Go to [GitHub Settings → Developer settings → GitHub Apps](https://github.com/settings/apps)
2. Click "New GitHub App"
3. Configure with these settings:

   - **Name**: Greener CI/CD App
   - **Homepage URL**: https://github.com/greener-hayden/dotfiles
   - **Webhook URL**: `https://greener-cicd-webhook.workers.dev` (will update after deployment)
   - **Webhook secret**: Generate a strong secret
   - **Permissions**:
     - Actions: Write
     - Secrets: Write
     - Contents: Read
     - Metadata: Read
   - **Events**:
     - Installation
     - Installation repositories

4. Create the app and save:
   - App ID
   - Private key (download .pem file)
   - Webhook secret

## Step 2: Configure Repository Secrets

In your repository settings, add these secrets:

```bash
# Required for GitHub App
GREENER_APP_ID=<your-app-id>
GREENER_APP_PRIVATE_KEY=<contents-of-private-key.pem>
GREENER_WEBHOOK_SECRET=<your-webhook-secret>

# Required for webhook proxy
WEBHOOK_PROXY_TOKEN=<github-personal-access-token-with-workflow-scope>

# For Cloudflare deployment (if using)
CLOUDFLARE_API_TOKEN=<your-cloudflare-api-token>
CLOUDFLARE_ACCOUNT_ID=<your-cloudflare-account-id>
CLOUDFLARE_KV_ID=<optional-kv-namespace-id>

# For Vercel deployment (if using)
VERCEL_TOKEN=<your-vercel-token>
VERCEL_ORG_ID=<your-vercel-org-id>
VERCEL_PROJECT_ID=<your-vercel-project-id>
```

## Step 3: Deploy Webhook Proxy

The webhook proxy receives webhooks from GitHub and triggers the GitHub Actions workflow.

### Option A: Cloudflare Workers (Recommended)

1. Create a Cloudflare account (free)
2. Get API token from Cloudflare dashboard
3. Run the deployment workflow:

```bash
# Trigger the deployment
gh workflow run deploy-webhook-proxy.yml

# Or push changes to trigger automatically
git add .
git commit -m "Deploy webhook proxy"
git push
```

### Option B: Vercel Edge Functions

1. Create a Vercel account
2. Install Vercel CLI: `npm i -g vercel`
3. Update `deploy-webhook-proxy.yml` to enable Vercel deployment
4. Run deployment

### Option C: Manual Cloudflare Setup

```bash
cd github-app/proxy

# Install Wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Create wrangler.toml
cat > wrangler.toml << EOF
name = "greener-cicd-webhook"
main = "worker.js"
compatibility_date = "2024-01-01"

[vars]
GITHUB_OWNER = "greener-hayden"
GITHUB_REPO = "dotfiles"
WORKFLOW_FILE = "webhook-handler.yml"
EOF

# Set secrets
wrangler secret put GITHUB_TOKEN  # Enter your PAT with workflow scope
wrangler secret put WEBHOOK_SECRET # Enter your webhook secret

# Deploy
wrangler deploy

# Get the worker URL (e.g., https://greener-cicd-webhook.workers.dev)
```

## Step 4: Update GitHub App Webhook URL

1. Go to your GitHub App settings
2. Update the Webhook URL to your Cloudflare Worker URL
3. Save changes

## Step 5: Test the Installation

1. Install the app on a test repository:
   ```bash
   # Go to app installation page
   open https://github.com/apps/greener-cicd-app/installations/new
   ```

2. Select a repository and install

3. Check GitHub Actions logs:
   ```bash
   # View workflow runs
   gh run list --workflow=webhook-handler.yml

   # View specific run
   gh run view <run-id>
   ```

4. Verify secrets were created:
   ```bash
   # List repository secrets
   gh secret list
   ```

## How It Works

1. **Installation Event**: When someone installs your GitHub App
2. **Webhook Sent**: GitHub sends webhook to Cloudflare Worker
3. **Proxy Triggers Action**: Worker triggers `workflow_dispatch` event
4. **Action Processes**: GitHub Actions workflow processes the webhook
5. **Secrets Created**: Workflow creates repository secrets via GitHub API

## Monitoring & Debugging

### View Webhook Deliveries

1. Go to GitHub App settings → Advanced → Recent Deliveries
2. Check response codes and payloads

### View Cloudflare Logs

```bash
# Tail worker logs
wrangler tail
```

### View GitHub Actions Logs

```bash
# List recent runs
gh run list --workflow=webhook-handler.yml

# View run details
gh run view <run-id> --log
```

### Check Repository Secrets

```bash
# List secrets
gh secret list

# Verify secret exists (can't view value)
gh secret list | grep GREENER_
```

## Troubleshooting

### Webhook Not Triggering

1. Check webhook URL in GitHub App settings
2. Verify Cloudflare Worker is deployed
3. Check worker logs: `wrangler tail`

### Workflow Not Running

1. Verify `WEBHOOK_PROXY_TOKEN` has `workflow` scope
2. Check GitHub Actions is enabled for repository
3. Verify workflow file exists in main branch

### Secrets Not Created

1. Check GitHub App has `secrets: write` permission
2. Verify installation has access to repository
3. Check Actions logs for errors

### Permission Errors

1. Reinstall the GitHub App with updated permissions
2. Verify PAT token has required scopes
3. Check repository allows Actions to create secrets

## Cost Analysis

- **GitHub Actions**: Free for public repos, 2000 minutes/month for private
- **Cloudflare Workers**: 100,000 requests/day free
- **Storage**: Minimal (only stores installation metadata)
- **Estimated monthly cost**: $0 (within free tiers)

## Security Considerations

1. **Private Repository**: Keep webhook handler in private repo
2. **Secrets Management**: Use GitHub secrets, never commit
3. **Token Scopes**: Use minimum required permissions
4. **Webhook Verification**: Always verify signatures
5. **Audit Logs**: Review GitHub App activity regularly

## Advantages of This Approach

✅ **No Infrastructure**: Uses GitHub's own infrastructure
✅ **Cost-Effective**: Stays within free tiers
✅ **Secure**: Secrets never leave GitHub
✅ **Scalable**: Handles bursts automatically
✅ **Maintainable**: All configuration in one repo
✅ **Efficient**: Only runs when needed

## Next Steps

1. Monitor usage in GitHub Actions settings
2. Set up alerts for failed workflows
3. Implement rotation for secrets
4. Add custom logic for your CI/CD needs

## Support

- Check [GitHub Actions logs](https://github.com/greener-hayden/dotfiles/actions)
- Review [Cloudflare Worker logs](https://dash.cloudflare.com)
- Open issues at [greener-hayden/dotfiles](https://github.com/greener-hayden/dotfiles/issues)