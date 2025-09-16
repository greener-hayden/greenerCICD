# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Greener CI/CD** is a CLI-first secret provisioning system combining a terminal tool with a Cloudflare Worker backend. It provides instant CI/CD secret provisioning for GitHub repositories without requiring GitHub Actions compute overhead.

## Architecture

### Core Components
- **`greener-provision`** - CLI tool (bash script) with GitHub CLI integration
- **`proxy/worker.js`** - Main Cloudflare Worker API backend with comprehensive security
- **`proxy/utils/`** - Modular security and utility functions:
  - `sanitize.js` - HTML sanitization and XSS prevention
  - `env.js` - Environment variable validation
  - `validation.js` - Input validation utilities
  - `csp.js` - Content Security Policy and nonce generation
  - `rateLimit.js` - Rate limiting implementation
  - `http.js` - HTTP helpers and CSRF protection
  - `styles.js` - Shared CSS styles
- **`wiki/`** - Complete documentation (8 comprehensive guides)

### System Flow
1. Developer runs CLI tool → Authenticates with GitHub CLI → Selects repositories
2. CLI calls worker API endpoint → Worker validates and provisions secrets
3. Direct GitHub API calls for instant secret provisioning

## Development Commands

### CLI Testing
```bash
# Test CLI without actual provisioning
WORKER_URL="https://httpbin.org/post" ./greener-provision --repos "test/repo"

# Interactive mode
./greener-provision

# Direct repository specification
./greener-provision --repos "org/repo1,org/repo2"
```

### Worker Deployment
```bash
# Automatic deployment (triggers on PR and main branch)
gh workflow run deploy-worker.yml

# Manual deployment
wrangler deploy --env production
```

### Local Development
```bash
# Worker local development
cd proxy && wrangler dev

# CLI development
chmod +x greener-provision && ./greener-provision --help
```

## GitHub Actions Workflow

### Improved Workflow Features
- **PR Validation**: Automatic syntax checking and validation for PRs
- **Manual Approval**: PR deployments require manual approval via GitHub Environments
- **Auto Deploy**: Main branch deployments proceed automatically
- **Comprehensive Logging**: Detailed deployment information and summaries

### Deployment Environments
- **`production`**: Auto-deploy for main branch
- **`pr-deployment`**: Manual approval required for PR deployments

## Key Environment Variables

### Required Secrets (GitHub Repository)
- `CLOUDFLARE_API_TOKEN` - Cloudflare API token with Worker:Edit permissions
- GitHub token automatically provided via `github.token`

### Optional Secrets
- `WEBHOOK_SECRET` - GitHub App webhook secret
- `APP_ID` - GitHub App ID
- `CLIENT_ID` - GitHub App Client ID
- `CLIENT_SECRET` - GitHub App Client Secret

### Runtime Variables (Cloudflare Worker)
- `GITHUB_OWNER` - Repository owner (set in wrangler.toml)

## API Endpoints

### CLI Endpoint
- **`POST /api/cli-provision`** - Main CLI provisioning endpoint
- **Authentication**: Bearer token (GitHub user token)
- **Input**: `{"repository": "owner/name"}`
- **Output**: Success/failure status with provisioned secret names

### Support Endpoints
- **`GET /health`** - Health check endpoint
- **`GET /api/analytics`** - Usage analytics
- **`POST /`** - GitHub webhook handler

## Security Architecture

### Defense-in-Depth Model
1. **CLI Security**: GitHub CLI authentication, input validation
2. **Transport Security**: HTTPS-only, secure headers
3. **Worker Security**: Rate limiting, input sanitization, CSRF protection
4. **GitHub Security**: Token validation, repository access verification

### Key Security Features
- **Rate Limiting**: 60 requests per minute per IP
- **Input Validation**: Comprehensive validation via utility modules
- **Token Security**: GitHub token validation and secure handling
- **Error Handling**: Security-conscious error messages

## Code Patterns

### CLI Patterns (Bash)
```bash
# Logging functions with colors
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1" >&2; }

# Error handling
set -euo pipefail

# Repository validation
if [[ ! "$repo" =~ ^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$ ]]; then
    log_error "Invalid repository format"
    exit 1
fi
```

### Worker Patterns (JavaScript)
```javascript
// ES modules throughout
import { parseRequiredString } from './utils/validation.js';

// Async error handling
try {
    const result = await processRequest(data);
    return ok(JSON.stringify(result));
} catch (error) {
    return handleError(error);
}

// Security-first validation
const repo = parseRequiredString(payload.repository, 'repository', 100);
```

## Generated Secrets

Each provisioned repository receives:
- `GREENER_CI_KEY` - Unique 32-character CI key
- `GREENER_CI_SECRET` - Unique 64-character CI secret
- `GREENER_API_TOKEN` - 32-character API access token
- `GREENER_APP_ID` - Application identifier
- `GREENER_INSTALLATION_ID` - Installation identifier

## Documentation Structure

### Wiki Organization
All comprehensive documentation is in `wiki/`:
1. **Getting Started** - New developer onboarding
2. **Architecture** - System design and data flow
3. **Development Guide** - Local development workflow
4. **Deployment** - Deployment procedures and environments
5. **API Reference** - Complete API documentation
6. **Security** - Security model and best practices
7. **Troubleshooting** - Common issues and solutions
8. **CLI Reference** - Complete CLI tool documentation

### File Structure
```
greenerCICD/
├── greener-provision           # CLI tool (executable bash script)
├── proxy/
│   ├── worker.js              # Main Cloudflare Worker
│   └── utils/                 # Security utility modules (7 files)
├── wiki/                      # Complete documentation (8 guides)
├── .github/workflows/         # Improved CI/CD workflows
├── README.md                  # CLI-focused project overview
├── CLAUDE.md                  # This file
└── wrangler.toml             # Cloudflare configuration
```

## Development Workflow

### Pre-Push Validation
A comprehensive pre-push hook automatically validates code before allowing pushes:

**Validations Performed:**
- **Whitespace/Formatting**: `git diff --check` for trailing whitespace and formatting issues
- **Secret Scanning**: Basic detection of API keys, tokens, and credentials in commits
- **Bash Validation**: `shellcheck` on `greener-provision` script (if available)
- **Worker Validation**: `wrangler dev --dry-run` for Cloudflare Worker syntax (if wrangler installed)
- **Workflow Validation**: `actionlint` on GitHub Actions files (if available)
- **Claude Code Review**: `act pull_request` simulation with CLAUDE_CODE_OAUTH_TOKEN

**Setup Requirements:**
```bash
# Required for Claude Code Review simulation
export CLAUDE_CODE_OAUTH_TOKEN="your_token_here"

# Optional tools for enhanced validation (install as needed):
# - shellcheck (bash script linting)
# - wrangler (Cloudflare Worker validation)
# - actionlint (GitHub Actions validation)
# - act (local GitHub Actions simulation)
```

**Bypassing Validations:**
```bash
# Skip pre-push validations when needed
git push --no-verify
```

### For New Features
1. **Read Documentation**: Start with [wiki/03-development-guide.md](wiki/03-development-guide.md)
2. **Understand Security**: Review [wiki/06-security.md](wiki/06-security.md)
3. **Test Thoroughly**: Use both CLI and worker testing approaches
4. **Update Documentation**: Keep wiki documentation current

### For Debugging
1. **Check Health**: Use health check scripts in [wiki/07-troubleshooting.md](wiki/07-troubleshooting.md)
2. **Review Logs**: `wrangler tail` for worker logs
3. **Test Isolation**: Use httpbin.org for CLI testing without provisioning
4. **Validate Inputs**: Ensure proper repository format and authentication

## Important Notes

- **CLI-First Architecture**: The system is designed around terminal usage
- **No Build Process**: Direct JavaScript deployment, no bundling required
- **Security Focus**: Every component implements defense-in-depth security
- **Documentation-First**: Comprehensive wiki guides for all aspects
- **Manual PR Approval**: Worker deployments from PRs require manual approval
- **Bash Script**: CLI tool is a single, portable bash script with minimal dependencies