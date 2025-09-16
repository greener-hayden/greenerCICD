# Getting Started

Quick setup guide for new developers joining the Greener CI/CD project.

## Prerequisites

### Required Tools
- **Git** - Version control
- **GitHub CLI** (`gh`) - [Install here](https://cli.github.com/)
- **Node.js** (optional) - For local testing
- **jq** - JSON processing ([Download](https://stedolan.github.io/jq/download/))
- **curl** - HTTP client (usually pre-installed)

### Accounts & Access
- **GitHub Account** with repository access
- **Cloudflare Account** (for deployments)

## Initial Setup

### 1. Clone Repository
```bash
git clone https://github.com/greener-hayden/greenerCICD.git
cd greenerCICD
```

### 2. Authenticate with GitHub
```bash
gh auth login
# Follow prompts to authenticate
```

### 3. Test CLI Tool
```bash
./greener-provision --help
```

### 4. Verify Dependencies
```bash
# Check GitHub CLI
gh auth status

# Check jq
jq --version

# Check curl
curl --version
```

## First Use

### Try the CLI Tool
```bash
# Interactive mode (recommended for first use)
./greener-provision

# Or specify repositories directly
./greener-provision --repos "your-org/test-repo"
```

### Understand the Output
The CLI will:
1. ✅ Verify prerequisites
2. 📋 List your repositories
3. 🔧 Provision secrets to selected repos
4. ✅ Report success/failure

## Development Environment

### Local Testing
```bash
# Test CLI without making actual API calls
WORKER_URL="https://httpbin.org/post" ./greener-provision --repos "test/repo"
```

### Worker Development
```bash
# Install Wrangler CLI
npm install -g wrangler

# Test worker locally (requires Cloudflare setup)
cd proxy
wrangler dev
```

## Understanding the System

### Key Components
1. **CLI Tool** (`greener-provision`) - User interface
2. **Cloudflare Worker** (`proxy/worker.js`) - API backend
3. **GitHub Integration** - Authentication and API access

### Data Flow
```
User runs CLI → Authenticates with GitHub → Calls Worker API → Worker provisions secrets
```

### Generated Secrets
Each repository receives:
- `GREENER_CI_KEY` - Unique CI key (32 chars)
- `GREENER_CI_SECRET` - Unique CI secret (64 chars)
- `GREENER_API_TOKEN` - API access token (32 chars)
- `GREENER_APP_ID` - Application identifier
- `GREENER_INSTALLATION_ID` - Installation identifier

## Common First Tasks

### 1. Test Secret Provisioning
```bash
# Create a test repository
gh repo create test-greener-cicd --private

# Provision secrets
./greener-provision --repos "$(gh api user --jq .login)/test-greener-cicd"

# Verify secrets were created
gh secret list --repo "$(gh api user --jq .login)/test-greener-cicd"
```

### 2. Explore the Code
```bash
# Main CLI logic
less greener-provision

# Worker code
less proxy/worker.js

# Security utilities
ls proxy/utils/
```

### 3. Read Documentation
- [Architecture Overview](02-architecture.md)
- [Development Guide](03-development-guide.md)
- [API Reference](05-api-reference.md)

## Quick Reference

### CLI Commands
```bash
./greener-provision                    # Interactive mode
./greener-provision --repos "a/b,c/d"  # Specific repos
./greener-provision --help             # Show help
```

### Useful GitHub CLI Commands
```bash
gh repo list                           # List your repos
gh secret list --repo owner/name       # List repo secrets
gh auth status                         # Check auth status
```

## Next Steps

1. **Understand Architecture** → [02-architecture.md](02-architecture.md)
2. **Set up Development** → [03-development-guide.md](03-development-guide.md)
3. **Learn Deployment** → [04-deployment.md](04-deployment.md)

## Troubleshooting

### CLI Won't Run
```bash
# Make executable
chmod +x greener-provision

# Check dependencies
./greener-provision
```

### Authentication Issues
```bash
# Re-authenticate
gh auth login

# Check token
gh auth status
```

### Can't Access Repositories
- Ensure you have admin access to target repositories
- Check if organization requires specific permissions

For more issues, see [Troubleshooting Guide](07-troubleshooting.md).