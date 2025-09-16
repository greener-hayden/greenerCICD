# Greener CI/CD Wiki

Welcome to the Greener CI/CD knowledge base. This wiki contains comprehensive documentation for developers working on the CLI + Cloudflare Worker system.

## 📚 Documentation Index

### Getting Started
- **[01 - Getting Started](01-getting-started.md)** - Quick setup guide for new developers
- **[02 - Architecture](02-architecture.md)** - System architecture and component overview

### Development
- **[03 - Development Guide](03-development-guide.md)** - Local development and testing workflow
- **[04 - Deployment](04-deployment.md)** - How to deploy changes and updates

### Reference
- **[05 - API Reference](05-api-reference.md)** - Worker endpoints and CLI command documentation
- **[06 - Security](06-security.md)** - Security model and best practices
- **[07 - Troubleshooting](07-troubleshooting.md)** - Common issues and debugging
- **[08 - CLI Reference](08-cli-reference.md)** - Complete CLI tool documentation

## 🎯 Quick Navigation

**New Developer?** Start with [Getting Started](01-getting-started.md)

**Need to Deploy?** Check [Deployment Guide](04-deployment.md)

**API Questions?** See [API Reference](05-api-reference.md)

**Having Issues?** Try [Troubleshooting](07-troubleshooting.md)

## 📖 What is Greener CI/CD?

Greener CI/CD is an ultra-minimal secret provisioning system that combines:

- **CLI Tool** (`greener-provision`) - Terminal interface for secret provisioning
- **Cloudflare Worker** - Serverless backend handling GitHub API operations
- **GitHub App Integration** - Secure authentication and permissions

**Goal**: Instant CI/CD secret provisioning without GitHub Actions compute overhead.

## 🏗️ Repository Structure

```
greenerCICD/
├── greener-provision           # CLI tool (executable)
├── proxy/
│   ├── worker.js              # Main Cloudflare Worker
│   └── utils/                 # Security and utility modules
├── wiki/                      # This documentation
├── CLI.md                     # CLI tool documentation
├── README.md                  # Project overview
├── CLAUDE.md                  # AI assistant guidance
└── wrangler.toml             # Cloudflare configuration
```

## 🤝 Contributing

1. Read [Development Guide](03-development-guide.md)
2. Understand [Architecture](02-architecture.md)
3. Follow [Security Guidelines](06-security.md)
4. Test using [Deployment Process](04-deployment.md)

## 📞 Support

- **Documentation Issues**: Update this wiki
- **Bug Reports**: Create GitHub issues
- **Security Concerns**: See [Security Guide](06-security.md)