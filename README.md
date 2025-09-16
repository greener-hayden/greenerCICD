# Greener CI/CD

[![Worker Deploy](https://github.com/greener-hayden/greenerCICD/actions/workflows/deploy-worker.yml/badge.svg)](https://github.com/greener-hayden/greenerCICD/actions/workflows/deploy-worker.yml)

**Instant GitHub secret provisioning via CLI.** One command to provision CI/CD secrets to any GitHub repository.

## Quick Start

```bash
# Prerequisites: GitHub CLI (https://cli.github.com) and jq
gh auth login

# Download and run
curl -o greener-provision https://raw.githubusercontent.com/greener-hayden/greenerCICD/main/greener-provision
chmod +x greener-provision

# Use it
./greener-provision                               # Interactive mode
./greener-provision --repos "org/repo1,org/repo2" # Direct mode
```

## What You Get
Five secrets automatically provisioned per repository:
- `GREENER_CI_KEY` - 32-character CI key
- `GREENER_CI_SECRET` - 64-character CI secret  
- `GREENER_API_TOKEN` - 32-character API token
- `GREENER_APP_ID` - Application identifier
- `GREENER_INSTALLATION_ID` - Installation ID

## How It Works

```
CLI Tool → Cloudflare Worker → GitHub API → Repository Secrets
```

1. CLI authenticates via GitHub CLI (`gh auth`)
2. Worker validates request and generates unique secrets
3. Secrets provisioned directly to GitHub repository
4. Available immediately in GitHub Actions

## Development

```bash
# Local worker development
cd proxy && wrangler dev

# Deploy worker
wrangler deploy --env production

# Test CLI without provisioning
WORKER_URL="https://httpbin.org/post" ./greener-provision --repos "test/repo"
```

### Project Structure
```
greener-provision      # CLI tool (bash script)
proxy/worker.js        # Cloudflare Worker API
proxy/utils/           # Security utilities
wiki/                  # Documentation
```

## Documentation

- [Getting Started](wiki/01-getting-started.md)
- [Architecture](wiki/02-architecture.md) 
- [Development Guide](wiki/03-development-guide.md)
- [API Reference](wiki/05-api-reference.md)
- [Security](wiki/06-security.md)
- [Troubleshooting](wiki/07-troubleshooting.md)

MIT License