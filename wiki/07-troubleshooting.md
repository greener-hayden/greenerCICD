# Troubleshooting Guide

Comprehensive troubleshooting guide for common issues with the Greener CI/CD system.

## Quick Diagnosis

### System Health Check
```bash
# Run this script to check system health
check_system_health() {
    echo "🔍 Greener CI/CD System Health Check"
    echo

    # Check CLI dependencies
    echo "📋 Dependencies:"
    command -v gh >/dev/null && echo "✅ GitHub CLI found" || echo "❌ GitHub CLI missing"
    command -v jq >/dev/null && echo "✅ jq found" || echo "❌ jq missing"
    command -v curl >/dev/null && echo "✅ curl found" || echo "❌ curl missing"

    # Check authentication
    echo
    echo "🔐 Authentication:"
    if gh auth status >/dev/null 2>&1; then
        echo "✅ GitHub CLI authenticated"
    else
        echo "❌ GitHub CLI not authenticated"
    fi

    # Check worker connectivity
    echo
    echo "🌐 Worker Connectivity:"
    if curl -sf https://greener-cicd-webhook-proxy.workers.dev/health >/dev/null; then
        echo "✅ Worker responding"
    else
        echo "❌ Worker not responding"
    fi

    echo
    echo "📊 System Status Summary:"
    # Add overall assessment logic here
}

# Run the health check
check_system_health
```

## CLI Issues

### Prerequisites and Dependencies

#### GitHub CLI Not Found
```
❌ GitHub CLI (gh) is not installed
ℹ Install from: https://cli.github.com/
```

**Solutions**:
```bash
# macOS with Homebrew
brew install gh

# Ubuntu/Debian
curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
sudo apt update && sudo apt install gh

# Windows with Winget
winget install --id GitHub.cli

# Manual download
# Visit https://github.com/cli/cli/releases
```

#### jq Not Found
```
❌ jq is required for JSON parsing
ℹ Install jq: https://stedolan.github.io/jq/download/
```

**Solutions**:
```bash
# macOS with Homebrew
brew install jq

# Ubuntu/Debian
sudo apt update && sudo apt install jq

# CentOS/RHEL/Fedora
sudo yum install jq  # or dnf install jq

# Windows with Chocolatey
choco install jq

# Manual download
# Visit https://stedolan.github.io/jq/download/
```

#### curl Not Found
```
❌ curl is required for HTTP requests
```

**Solutions**:
```bash
# Usually pre-installed. If missing:

# Ubuntu/Debian
sudo apt update && sudo apt install curl

# CentOS/RHEL/Fedora
sudo yum install curl  # or dnf install curl

# macOS with Homebrew
brew install curl

# Windows - usually included, or download from https://curl.se/windows/
```

### Authentication Issues

#### GitHub CLI Not Authenticated
```
❌ Not authenticated with GitHub CLI
ℹ Run: gh auth login
```

**Solutions**:
```bash
# Interactive authentication
gh auth login

# Follow prompts to:
# 1. Choose GitHub.com
# 2. Choose authentication method (web browser recommended)
# 3. Complete OAuth flow in browser

# Verify authentication
gh auth status

# Check token scopes
gh auth token | head -c 10  # Shows first 10 characters
```

#### Invalid or Expired Token
```
✗ Invalid GitHub token
```

**Solutions**:
```bash
# Refresh authentication
gh auth refresh

# Re-authenticate completely
gh auth logout
gh auth login

# Check token permissions
gh api user  # Should return user information
```

#### Insufficient Permissions
```
✗ Access denied for myorg/repo (check permissions)
```

**Solutions**:
```bash
# Check repository permissions
gh api repos/myorg/repo --jq '.permissions'

# Required permissions:
# - admin: true (for managing secrets)
# - push: true
# - pull: true

# If missing permissions:
# 1. Contact repository owner
# 2. Request admin access
# 3. Check organization policies
```

### Repository Issues

#### Repository Not Found
```
✗ Repository not found: myorg/repo
```

**Diagnostics**:
```bash
# Check if repository exists
gh repo view myorg/repo

# List your accessible repositories
gh repo list myorg

# Check repository format
echo "myorg/repo" | grep -E '^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$'
```

**Solutions**:
- Verify repository name spelling
- Ensure repository exists
- Check access permissions
- Verify organization name

#### Invalid Repository Format
```
✗ Repository format must be owner/name
```

**Common Format Errors**:
```bash
# Wrong formats:
repo-name           # Missing owner
myorg/              # Missing repo name
myorg/repo/branch   # Extra path components
https://github.com/myorg/repo  # Full URL instead of owner/name

# Correct format:
myorg/repo-name
```

### Network and Connectivity Issues

#### Worker Not Responding
```
✗ Failed to provision myorg/repo (HTTP 000)
```

**Diagnostics**:
```bash
# Test worker directly
curl -v https://greener-cicd-webhook-proxy.workers.dev/health

# Check DNS resolution
nslookup greener-cicd-webhook-proxy.workers.dev

# Test with different endpoint
curl -v https://httpbin.org/post

# Check internet connectivity
ping google.com
```

**Solutions**:
```bash
# Try different worker URL (if available)
./greener-provision --worker-url "https://backup-worker.workers.dev" --repos "test/repo"

# Use proxy if behind firewall
export https_proxy=http://proxy.company.com:8080
./greener-provision --repos "test/repo"

# Check firewall rules
# Ensure outbound HTTPS (port 443) is allowed
```

#### Rate Limiting
```
⚠ Rate limited, waiting 60 seconds...
```

**Understanding Rate Limits**:
- **Worker**: 60 requests per minute per IP
- **GitHub API**: 5000 requests per hour for authenticated users
- **CLI Auto-retry**: Automatically waits and retries

**Solutions**:
```bash
# Wait for rate limit reset
# CLI handles this automatically

# Check GitHub rate limit status
gh api rate_limit

# Spread requests over time
for repo in repo1 repo2 repo3; do
  ./greener-provision --repos "myorg/$repo"
  sleep 30  # Wait between repositories
done
```

### CLI Script Issues

#### Permission Denied
```
bash: ./greener-provision: Permission denied
```

**Solution**:
```bash
# Make script executable
chmod +x greener-provision

# Verify permissions
ls -la greener-provision
# Should show: -rwxr-xr-x
```

#### Script Not Found
```
bash: greener-provision: command not found
```

**Solutions**:
```bash
# Use relative path
./greener-provision --help

# Or add to PATH
export PATH="$PATH:$(pwd)"
greener-provision --help

# Or move to system PATH
sudo cp greener-provision /usr/local/bin/
greener-provision --help
```

#### Bash Version Issues
```
./greener-provision: line 5: set: -euo: invalid option
```

**Solutions**:
```bash
# Check bash version
bash --version

# Minimum required: bash 4.0+
# Update bash if necessary

# macOS: Install newer bash
brew install bash

# Or run with explicit bash
bash greener-provision --help
```

## Worker Issues

### API Endpoint Problems

#### 404 Not Found
```
HTTP/1.1 404 Not Found
```

**Common Causes**:
- Incorrect endpoint URL
- Worker not deployed
- DNS propagation delay

**Diagnostics**:
```bash
# Test different endpoints
curl https://greener-cicd-webhook-proxy.workers.dev/
curl https://greener-cicd-webhook-proxy.workers.dev/health
curl https://greener-cicd-webhook-proxy.workers.dev/api/cli-provision
```

**Solutions**:
- Verify worker deployment status
- Check Cloudflare dashboard
- Wait for DNS propagation (up to 48 hours)

#### 500 Internal Server Error
```
HTTP/1.1 500 Internal Server Error
{
  "success": false,
  "error": "Internal server error"
}
```

**Diagnostics**:
```bash
# Check worker logs
wrangler tail

# Test with minimal payload
curl -X POST https://greener-cicd-webhook-proxy.workers.dev/api/cli-provision \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{"repository": "test/repo"}'
```

**Solutions**:
- Check worker deployment logs
- Verify environment variables
- Redeploy worker

### Authentication and Authorization

#### 401 Unauthorized
```
HTTP/1.1 401 Unauthorized
{
  "success": false,
  "error": "Authorization header with Bearer token required"
}
```

**Diagnostics**:
```bash
# Check if token is being sent
curl -X POST https://greener-cicd-webhook-proxy.workers.dev/api/cli-provision \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(gh auth token)" \
  -d '{"repository": "test/repo"}' \
  -v
```

**Solutions**:
- Verify GitHub CLI authentication
- Check token format in request
- Ensure Authorization header is present

#### 403 Forbidden
```
HTTP/1.1 403 Forbidden
{
  "success": false,
  "error": "Repository not found or no access"
}
```

**Solutions**:
- Verify repository admin access
- Check organization permissions
- Ensure repository exists and is accessible

### Rate Limiting Issues

#### Excessive Rate Limiting
```
HTTP/1.1 429 Too Many Requests
```

**Diagnostics**:
```bash
# Check rate limit headers
curl -I https://greener-cicd-webhook-proxy.workers.dev/api/cli-provision

# Test from different IP
# Use different network or VPN
```

**Solutions**:
- Wait for rate limit reset
- Use multiple IP addresses for distributed requests
- Contact support if rate limits seem incorrect

## GitHub API Issues

### API Errors

#### GitHub Rate Limiting
```
✗ Failed to provision myorg/repo (HTTP 403)
GitHub API rate limit exceeded
```

**Diagnostics**:
```bash
# Check GitHub rate limit
gh api rate_limit

# Check specific limits
gh api rate_limit --jq '.rate'
```

**Solutions**:
```bash
# Wait for rate limit reset
# Shown in rate_limit response

# Use GitHub App token instead of personal token
# (Requires GitHub App setup)

# Spread requests over time
sleep $((60 * 60 / 5000))  # Stay under 5000/hour limit
```

#### GitHub Service Issues
```
✗ Failed to get public key: 502
```

**Diagnostics**:
```bash
# Check GitHub status
curl https://www.githubstatus.com/api/v2/status.json

# Test GitHub API directly
gh api repos/myorg/repo
```

**Solutions**:
- Wait for GitHub service recovery
- Monitor GitHub Status page
- Retry operation later

### Secret Management Issues

#### Public Key Retrieval Failure
```
✗ Failed to get public key: 404
```

**Causes**:
- Repository doesn't exist
- Actions not enabled for repository
- Insufficient permissions

**Solutions**:
```bash
# Check if Actions are enabled
gh api repos/myorg/repo --jq '.has_issues'

# Verify repository settings
# Go to Settings > Actions > General
# Ensure Actions are enabled
```

#### Secret Creation Failure
```
✗ Failed to create secret GREENER_CI_KEY: 422
```

**Common Causes**:
- Secret name conflicts
- Invalid secret value
- Encryption issues

**Solutions**:
```bash
# Test secret creation manually
gh secret set TEST_SECRET --body "test-value" --repo myorg/repo

# Check existing secrets
gh secret list --repo myorg/repo

# Remove conflicting secrets if necessary
gh secret remove GREENER_CI_KEY --repo myorg/repo
```

## Environment and Configuration Issues

### Worker Configuration

#### Missing Environment Variables
```
✗ Environment variable GITHUB_TOKEN is required
```

**Diagnostics**:
```bash
# Check worker environment
wrangler secret list

# Check GitHub secrets
gh secret list --repo greener-hayden/greenerCICD
```

**Solutions**:
```bash
# Set missing secrets
gh secret set GITHUB_TOKEN --body "$GITHUB_TOKEN" --repo greener-hayden/greenerCICD

# Redeploy worker
gh workflow run deploy-worker.yml
```

#### Cloudflare Configuration Issues
```
✗ Worker deployment failed
```

**Diagnostics**:
```bash
# Check Cloudflare authentication
wrangler whoami

# Check worker status
wrangler list

# Check deployment logs
wrangler tail
```

**Solutions**:
```bash
# Re-authenticate with Cloudflare
wrangler login

# Check API token permissions
# Visit: https://dash.cloudflare.com/profile/api-tokens

# Redeploy manually
cd proxy && wrangler deploy --env production
```

## Performance Issues

### Slow Response Times

#### CLI Startup Slow
```
# CLI takes >10 seconds to start
```

**Diagnostics**:
```bash
# Time each component
time gh auth status
time jq --version
time curl --version
```

**Solutions**:
- Update GitHub CLI to latest version
- Check network connectivity
- Use faster DNS servers

#### Worker Response Slow
```
# API calls take >5 seconds
```

**Diagnostics**:
```bash
# Test worker performance
time curl https://greener-cicd-webhook-proxy.workers.dev/health

# Test from different locations
# Use tools like Pingdom or GTmetrix
```

**Solutions**:
- Check Cloudflare status
- Verify worker isn't hitting CPU limits
- Review worker code for bottlenecks

### Memory and Resource Issues

#### Worker Memory Limits
```
✗ Worker exceeded memory limit
```

**Solutions**:
- Review worker code for memory leaks
- Optimize data structures
- Consider splitting functionality

## Debugging Tools and Techniques

### Enhanced Logging

#### CLI Debug Mode
```bash
# Enable debug output
set -x
./greener-provision --repos "test/repo"
set +x

# Capture full output
./greener-provision --repos "test/repo" 2>&1 | tee debug.log
```

#### Worker Debug Mode
```bash
# View real-time logs
wrangler tail

# Local development with debugging
cd proxy
wrangler dev
```

### Testing and Validation

#### Isolated Testing
```bash
# Test CLI without provisioning
WORKER_URL="https://httpbin.org/post" ./greener-provision --repos "test/repo"

# Test worker endpoints individually
curl -X POST https://greener-cicd-webhook-proxy.workers.dev/api/cli-provision \
  -H "Content-Type: application/json" \
  -d '{"repository": "test/repo"}'
```

#### Validation Scripts
```bash
# Comprehensive validation script
validate_system() {
    echo "🔍 Running comprehensive validation..."

    # Test all CLI functions
    ./greener-provision --help

    # Test worker endpoints
    curl -f https://greener-cicd-webhook-proxy.workers.dev/health

    # Test authentication
    gh auth status

    # Test repository access
    gh api repos/myorg/repo

    echo "✅ Validation complete"
}
```

## Getting Help

### Self-Service Resources
1. **Check this troubleshooting guide** first
2. **Review error messages** carefully
3. **Test with minimal examples**
4. **Check system health** with diagnostic scripts

### Community Support
- **GitHub Issues**: https://github.com/greener-hayden/greenerCICD/issues
- **Discussions**: Check GitHub Discussions for Q&A
- **Documentation**: Review all wiki pages

### Reporting Issues

#### Information to Include
```bash
# System information
uname -a
gh --version
jq --version
curl --version

# Error reproduction
./greener-provision --repos "test/repo" 2>&1

# Worker logs (if accessible)
wrangler tail

# Network diagnostics
curl -v https://greener-cicd-webhook-proxy.workers.dev/health
```

#### Issue Template
```markdown
## Environment
- OS: [e.g., macOS 12.0, Ubuntu 20.04]
- CLI Version: [output of ./greener-provision --help | head -1]
- GitHub CLI: [output of gh --version]

## Issue Description
[Clear description of the problem]

## Steps to Reproduce
1. Run command: ./greener-provision --repos "myorg/repo"
2. See error: [paste error message]

## Expected Behavior
[What should have happened]

## Additional Context
[Any other relevant information]

## Diagnostics
[Paste output of diagnostic commands]
```

### Emergency Contacts
- **Security Issues**: security@your-domain.com
- **Service Outages**: Check GitHub and Cloudflare status pages
- **Critical Bugs**: Create urgent GitHub issue

## Prevention and Best Practices

### Regular Maintenance
```bash
# Weekly health check
./scripts/health-check.sh

# Monthly updates
gh extension upgrade --all
brew upgrade gh jq curl  # macOS
```

### Monitoring Setup
```bash
# Set up basic monitoring
monitor_system() {
    # Check worker health
    if ! curl -sf https://greener-cicd-webhook-proxy.workers.dev/health; then
        echo "❌ Worker health check failed" >&2
    fi

    # Check CLI functionality
    if ! ./greener-provision --help >/dev/null 2>&1; then
        echo "❌ CLI health check failed" >&2
    fi
}

# Run periodically
# 0 */6 * * * /path/to/monitor_system.sh
```

Remember: Most issues have simple solutions. Start with the basics (authentication, connectivity, permissions) before diving into complex debugging.