# Greener CI/CD

[![Worker Deploy](https://github.com/greener-hayden/greenerCICD/actions/workflows/deploy-worker.yml/badge.svg)](https://github.com/greener-hayden/greenerCICD/actions/workflows/deploy-worker.yml)

**CLI-first secret provisioning for GitHub repositories.** Terminal tool + Cloudflare Worker - instant CI/CD secrets without GitHub Actions compute overhead.

## Quick Start

### Install Prerequisites
```bash
# Install GitHub CLI
# Visit: https://cli.github.com/

# Install jq for JSON processing
brew install jq  # macOS
sudo apt install jq  # Ubuntu/Debian

# Authenticate with GitHub
gh auth login
```

### Use the CLI Tool
```bash
# Download and run
curl -o greener-provision https://raw.githubusercontent.com/greener-hayden/greenerCICD/main/greener-provision
chmod +x greener-provision

# Interactive mode (recommended)
./greener-provision

# Or specify repositories directly
./greener-provision --repos "myorg/repo1,myorg/repo2"
```

### What You Get
Each repository receives these secrets:
- `GREENER_CI_KEY` - Unique 32-character CI key
- `GREENER_CI_SECRET` - Unique 64-character CI secret
- `GREENER_API_TOKEN` - 32-character API access token
- `GREENER_APP_ID` - Application identifier
- `GREENER_INSTALLATION_ID` - Installation identifier

## Architecture

```
Developer Terminal → CLI Tool → Cloudflare Worker → GitHub API → Repository Secrets
     ↓                 ↓             ↓                ↓              ↓
GitHub CLI Auth    HTTP Request   Validation      Secret API    Encrypted Storage
```

**Key Components:**
- **CLI Tool** (`greener-provision`) - Terminal interface with GitHub CLI integration
- **Cloudflare Worker** (`proxy/worker.js`) - Serverless API backend with security
- **GitHub Integration** - Direct API calls for instant secret provisioning

## Benefits

- ✅ **CLI-First** - Fits developer terminal workflows
- ✅ **Instant Provisioning** - Direct API calls, no workflow delays
- ✅ **Zero Infrastructure** - Single Cloudflare Worker handles everything
- ✅ **Secure by Default** - Defense-in-depth security model
- ✅ **No GitHub Actions Compute** - Save on CI/CD costs

## Usage Example

```bash
$ ./greener-provision

🌱 Greener CI/CD Secret Provisioning

✓ GitHub CLI authenticated
✓ Dependencies verified

📋 Available repositories:
 1. myorg/frontend (private)
 2. myorg/backend (private)
 3. myorg/docs (public)

Enter repository numbers: 1,2

🔧 Provisioning secrets...
✓ myorg/frontend - 5 secrets provisioned
✓ myorg/backend - 5 secrets provisioned

✅ Complete! 2/2 repositories provisioned successfully
```

## Documentation

📚 **[Complete Documentation](wiki/README.md)** - Comprehensive guides in the wiki:

- **[Getting Started](wiki/01-getting-started.md)** - New developer setup
- **[Architecture](wiki/02-architecture.md)** - System design and components
- **[Development Guide](wiki/03-development-guide.md)** - Local development workflow
- **[Deployment](wiki/04-deployment.md)** - How to deploy changes
- **[API Reference](wiki/05-api-reference.md)** - Complete API documentation
- **[Security Guide](wiki/06-security.md)** - Security model and best practices
- **[Troubleshooting](wiki/07-troubleshooting.md)** - Common issues and solutions
- **[CLI Reference](wiki/08-cli-reference.md)** - Complete CLI documentation

## For Developers

### Repository Structure
```
greenerCICD/
├── greener-provision           # CLI tool (executable)
├── proxy/
│   ├── worker.js              # Main Cloudflare Worker
│   └── utils/                 # Security and utility modules
├── wiki/                      # Complete documentation
├── README.md                  # This file
├── CLAUDE.md                  # AI assistant guidance
└── wrangler.toml             # Cloudflare configuration
```

### Development Workflow
1. **Read** [Getting Started Guide](wiki/01-getting-started.md)
2. **Understand** [Architecture](wiki/02-architecture.md)
3. **Follow** [Development Guide](wiki/03-development-guide.md)
4. **Deploy** using [Deployment Guide](wiki/04-deployment.md)

### Contributing
- Check [Development Guide](wiki/03-development-guide.md) for workflow
- Review [Security Guide](wiki/06-security.md) for best practices
- Test using [CLI Reference](wiki/08-cli-reference.md) examples
- Report issues via GitHub Issues

## Support

- 📖 **Documentation**: Check the [wiki](wiki/README.md) first
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/greener-hayden/greenerCICD/issues)
- 💬 **Questions**: [GitHub Discussions](https://github.com/greener-hayden/greenerCICD/discussions)
- 🔒 **Security**: See [Security Guide](wiki/06-security.md)

MIT License