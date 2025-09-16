# Deployment Guide

Complete guide for deploying changes to the Greener CI/CD system.

## Overview

The system has two deployment components:
1. **Cloudflare Worker** - Automatic deployment via GitHub Actions
2. **CLI Tool** - Manual distribution to users

## Cloudflare Worker Deployment

### Automatic Deployment (Recommended)

The worker automatically deploys when changes are pushed to specific paths:

```yaml
# Triggers in .github/workflows/deploy-worker.yml
on:
  push:
    paths:
      - 'proxy/**'           # Worker code changes
      - 'wrangler.toml'      # Configuration changes
      - '.github/workflows/deploy-worker.yml'  # Workflow changes
  workflow_dispatch:         # Manual trigger
```

#### Deployment Process
1. **Push changes** to main branch
2. **GitHub Actions** detects changes
3. **Wrangler** builds and deploys worker
4. **Secrets** are automatically injected
5. **Verification** confirms deployment success

### Manual Deployment

For development or emergency deployments:

```bash
# Install Wrangler CLI
npm install -g wrangler

# Authenticate with Cloudflare
wrangler login

# Deploy to production
cd proxy
wrangler deploy --env production

# Deploy to staging (if configured)
wrangler deploy --env staging
```

### Deployment Configuration

#### wrangler.toml
```toml
name = "greener-cicd-webhook-proxy"
main = "proxy/worker-bundled.js"  # Auto-generated during deployment
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[env.production]
name = "greener-cicd-webhook-proxy"

[env.production.vars]
GITHUB_OWNER = "greener-hayden"

# Secrets are set separately via GitHub Actions:
# - GITHUB_TOKEN
# - APP_ID (optional)
# - CLIENT_ID (optional)
# - CLIENT_SECRET (optional)
# - WEBHOOK_SECRET (optional)
```

#### Required Secrets

Set these in your GitHub repository secrets:

| Secret | Required | Description |
|--------|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token with Worker:Edit permissions |
| `GITHUB_TOKEN` | Yes | GitHub token with repo access (uses built-in token) |
| `WEBHOOK_SECRET` | No | GitHub App webhook secret |
| `APP_ID` | No | GitHub App ID |
| `CLIENT_ID` | No | GitHub App Client ID |
| `CLIENT_SECRET` | No | GitHub App Client Secret |

### Setting Up Secrets

#### 1. Cloudflare API Token
```bash
# Create token at https://dash.cloudflare.com/profile/api-tokens
# Permissions: Zone:Zone Settings:Read, Zone:Zone:Read, User:User Details:Read
# Zone Resources: Include - All zones
# Account Resources: Include - All accounts

# Add to GitHub repository secrets as CLOUDFLARE_API_TOKEN
```

#### 2. GitHub Token
The workflow uses the built-in `GITHUB_TOKEN` automatically.

#### 3. Optional GitHub App Secrets
If using GitHub App functionality:
```bash
# Get from GitHub App settings
# Add each as repository secret
gh secret set APP_ID --body "your-app-id"
gh secret set CLIENT_ID --body "your-client-id"
gh secret set CLIENT_SECRET --body "your-client-secret"
gh secret set WEBHOOK_SECRET --body "your-webhook-secret"
```

### Deployment Verification

#### Check Deployment Status
```bash
# GitHub Actions
gh workflow list
gh run list --workflow=deploy-worker.yml

# Cloudflare Dashboard
# Visit: https://dash.cloudflare.com -> Workers & Pages -> greener-cicd-webhook-proxy
```

#### Test Deployment
```bash
# Test worker endpoint
curl https://greener-cicd-webhook-proxy.workers.dev/

# Test CLI against deployed worker
./greener-provision --worker-url "https://greener-cicd-webhook-proxy.workers.dev" --repos "test/repo"
```

## CLI Tool Distribution

### Current Distribution Method

The CLI tool is currently distributed as a single bash script:

```bash
# Direct download
curl -o greener-provision https://raw.githubusercontent.com/greener-hayden/greenerCICD/main/greener-provision
chmod +x greener-provision
```

### Installation Methods

#### Method 1: Direct Download
```bash
# Download and install
curl -o greener-provision https://raw.githubusercontent.com/greener-hayden/greenerCICD/main/greener-provision
chmod +x greener-provision

# Optionally move to PATH
sudo mv greener-provision /usr/local/bin/
```

#### Method 2: Git Clone
```bash
git clone https://github.com/greener-hayden/greenerCICD.git
cd greenerCICD
./greener-provision
```

#### Method 3: Package Manager (Future)
Consider creating packages for:
- **Homebrew** (macOS/Linux)
- **npm** (Node.js ecosystem)
- **GitHub Releases** (with binaries)

### CLI Updates

#### Notifying Users of Updates
```bash
# In CLI script, add version check
CLI_VERSION="1.0.0"
check_for_updates() {
    local latest_version
    latest_version=$(curl -s https://api.github.com/repos/greener-hayden/greenerCICD/releases/latest | jq -r .tag_name)
    if [[ "$latest_version" != "$CLI_VERSION" ]]; then
        log_warning "Update available: $latest_version (current: $CLI_VERSION)"
        log_info "Update: curl -o greener-provision https://raw.githubusercontent.com/greener-hayden/greenerCICD/main/greener-provision"
    fi
}
```

## Environment Management

### Production Environment
- **Worker URL**: `https://greener-cicd-webhook-proxy.workers.dev`
- **GitHub App**: Production GitHub App configuration
- **Rate Limits**: Production rate limiting (60 req/min)
- **Monitoring**: Full logging and analytics

### Staging Environment (Optional)

To set up staging:

#### 1. Create Staging Worker
```toml
# Add to wrangler.toml
[env.staging]
name = "greener-cicd-webhook-proxy-staging"

[env.staging.vars]
GITHUB_OWNER = "greener-hayden"
```

#### 2. Deploy to Staging
```bash
wrangler deploy --env staging
```

#### 3. Test Against Staging
```bash
./greener-provision --worker-url "https://greener-cicd-webhook-proxy-staging.workers.dev" --repos "test/repo"
```

## Rollback Procedures

### Worker Rollback

#### Method 1: Redeploy Previous Version
```bash
# Find previous commit hash
git log --oneline proxy/

# Checkout previous version
git checkout <previous-commit> -- proxy/

# Deploy
wrangler deploy --env production

# Return to current version
git checkout main
```

#### Method 2: GitHub Actions Rollback
```bash
# Find previous successful workflow run
gh run list --workflow=deploy-worker.yml

# Re-run previous deployment
gh workflow run deploy-worker.yml --ref <previous-commit>
```

### CLI Rollback
```bash
# Download previous version
curl -o greener-provision https://raw.githubusercontent.com/greener-hayden/greenerCICD/<previous-commit>/greener-provision
chmod +x greener-provision
```

## Monitoring and Health Checks

### Worker Monitoring

#### Cloudflare Analytics
- Visit Cloudflare Dashboard → Workers & Pages
- Monitor request volume, error rates, response times
- Set up alerts for high error rates

#### Custom Health Check
```bash
# Add to worker.js
case '/health':
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
```

### CLI Monitoring
```bash
# Add usage analytics (optional)
send_analytics() {
    # Only if user consents
    if [[ "$ANALYTICS_ENABLED" == "true" ]]; then
        curl -s -X POST "$WORKER_URL/api/analytics" \
          -d '{"event": "cli_usage", "version": "'$CLI_VERSION'"}' \
          > /dev/null 2>&1 || true
    fi
}
```

## Performance Optimization

### Worker Performance
- **Bundle size**: Keep worker.js under 1MB
- **Cold starts**: Minimize dependencies
- **API calls**: Cache GitHub API responses where possible
- **Rate limiting**: Implement efficient rate limiting

### CLI Performance
- **Startup time**: Minimize prerequisite checks
- **Batch operations**: Process multiple repositories efficiently
- **Progress feedback**: Show progress for long operations

## Security Considerations

### Deployment Security
- **Secrets management**: Never commit secrets to repository
- **Token permissions**: Use least privilege principle
- **Access control**: Limit who can deploy

### Runtime Security
- **Input validation**: Validate all inputs
- **Rate limiting**: Prevent abuse
- **Error handling**: Don't leak sensitive information

## Troubleshooting Deployments

### Common Issues

#### 1. Cloudflare API Token Issues
```bash
# Test token
wrangler whoami

# Regenerate token if needed
# Visit: https://dash.cloudflare.com/profile/api-tokens
```

#### 2. GitHub Actions Failures
```bash
# Check workflow logs
gh run list --workflow=deploy-worker.yml
gh run view <run-id>

# Common fixes:
# - Check secret availability
# - Verify wrangler.toml syntax
# - Check Cloudflare quota limits
```

#### 3. Worker Runtime Errors
```bash
# View real-time logs
wrangler tail

# Check specific error
curl -X POST https://worker.dev/api/cli-provision \
  -d '{"repository": "test/repo"}' \
  -v
```

#### 4. CLI Connectivity Issues
```bash
# Test worker directly
curl https://greener-cicd-webhook-proxy.workers.dev/

# Test with different worker URL
./greener-provision --worker-url "https://httpbin.org/post" --repos "test/repo"

# Check DNS resolution
nslookup greener-cicd-webhook-proxy.workers.dev
```

### Emergency Procedures

#### Worker Down
1. **Check Cloudflare status**: status.cloudflare.com
2. **Redeploy worker**: `wrangler deploy --env production`
3. **Verify deployment**: Test health endpoint
4. **Notify users**: If extended outage

#### CLI Issues
1. **Test minimal case**: `./greener-provision --help`
2. **Check dependencies**: `gh auth status`, `jq --version`
3. **Use alternative worker**: Test with staging or backup URL
4. **Provide workaround**: Manual secret provisioning instructions

## Future Deployment Improvements

### Automated Testing
```yaml
# Add to GitHub Actions
- name: Test Worker
  run: |
    curl -f https://greener-cicd-webhook-proxy.workers.dev/health

- name: Test CLI
  run: |
    ./greener-provision --help
    WORKER_URL="https://httpbin.org/post" ./greener-provision --repos "test/repo"
```

### Blue-Green Deployment
```bash
# Deploy to staging first
wrangler deploy --env staging

# Run integration tests
./test-integration.sh staging

# Deploy to production
wrangler deploy --env production
```

### CLI Package Management
- **Homebrew formula**
- **npm package**
- **GitHub Releases** with automatic updates

For troubleshooting specific issues, see [Troubleshooting Guide](07-troubleshooting.md).