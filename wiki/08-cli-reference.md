# Greener CI/CD CLI Tool

A command-line tool for provisioning CI/CD secrets to GitHub repositories using the Greener CI/CD infrastructure.

## Features

- 🔐 **Secure Authentication** - Uses GitHub CLI authentication
- 🎯 **Interactive Selection** - Choose repositories from a clean terminal interface
- ⚡ **Instant Provisioning** - Direct API calls to Cloudflare Worker
- 📊 **Real-time Feedback** - Progress indicators and detailed error messages
- 🔄 **Retry Logic** - Automatic retry for rate limiting
- 🎨 **Clean Output** - Color-coded status messages

## Prerequisites

1. **GitHub CLI** - Install from [cli.github.com](https://cli.github.com/)
2. **jq** - JSON processor for parsing responses ([stedolan.github.io/jq](https://stedolan.github.io/jq/download/))
3. **curl** - HTTP client (usually pre-installed)

## Installation

1. **Download the script**:
   ```bash
   curl -o greener-provision https://raw.githubusercontent.com/your-org/greenerCICD/main/greener-provision
   chmod +x greener-provision
   ```

2. **Move to PATH** (optional):
   ```bash
   sudo mv greener-provision /usr/local/bin/
   ```

3. **Authenticate with GitHub**:
   ```bash
   gh auth login
   ```

## Usage

### Interactive Mode (Default)
```bash
./greener-provision
```

The script will:
1. Fetch your repositories from GitHub
2. Display a numbered list for selection
3. Prompt for repository selection
4. Provision secrets to selected repositories

### Direct Repository Specification
```bash
./greener-provision --repos "myorg/repo1,myorg/repo2,myorg/repo3"
```

### Custom Worker URL
```bash
./greener-provision --worker-url "https://my-custom-worker.workers.dev"
```

### Help
```bash
./greener-provision --help
```

## Provisioned Secrets

Each repository receives these secrets:

| Secret Name | Description |
|-------------|-------------|
| `GREENER_CI_KEY` | Unique 32-character CI key |
| `GREENER_CI_SECRET` | Unique 64-character CI secret |
| `GREENER_API_TOKEN` | 32-character API access token |
| `GREENER_APP_ID` | Application identifier |
| `GREENER_INSTALLATION_ID` | Installation identifier |

## Examples

### Basic Usage
```bash
$ ./greener-provision

🌱 Greener CI/CD Secret Provisioning

✓ GitHub CLI found
✓ GitHub CLI authenticated
✓ jq found

📋 Fetching Your Repositories

Available repositories:
 1. myorg/frontend (private)
 2. myorg/backend (private)
 3. myorg/docs (public)

Enter repository numbers (comma-separated, or 'all'): 1,2

🔧 Provisioning CI/CD Secrets
Worker URL: https://greener-cicd-webhook-proxy.workers.dev
Repositories: 2

ℹ Provisioning secrets for myorg/frontend...
✓ Successfully provisioned secrets for myorg/frontend
ℹ Provisioned secrets: GREENER_CI_KEY GREENER_CI_SECRET GREENER_API_TOKEN GREENER_APP_ID GREENER_INSTALLATION_ID

ℹ Provisioning secrets for myorg/backend...
✓ Successfully provisioned secrets for myorg/backend
ℹ Provisioned secrets: GREENER_CI_KEY GREENER_CI_SECRET GREENER_API_TOKEN GREENER_APP_ID GREENER_INSTALLATION_ID

✅ Provisioning Complete
ℹ Successfully provisioned: 2/2 repositories
✓ All repositories provisioned successfully!
```

### Direct Repository Specification
```bash
$ ./greener-provision --repos "myorg/api,myorg/web"

🌱 Greener CI/CD Secret Provisioning

✓ GitHub CLI found
✓ GitHub CLI authenticated
✓ jq found

🔧 Provisioning CI/CD Secrets
Worker URL: https://greener-cicd-webhook-proxy.workers.dev
Repositories: 2

ℹ Provisioning secrets for myorg/api...
✓ Successfully provisioned secrets for myorg/api

ℹ Provisioning secrets for myorg/web...
✓ Successfully provisioned secrets for myorg/web

✅ Provisioning Complete
ℹ Successfully provisioned: 2/2 repositories
✓ All repositories provisioned successfully!
```

## Error Handling

The tool provides detailed error messages for common issues:

- **Authentication Errors**: Invalid or expired GitHub token
- **Permission Errors**: Insufficient repository access
- **Repository Errors**: Repository not found or access denied
- **Rate Limiting**: Automatic retry with backoff
- **Network Errors**: Connection or API failures

## Configuration

### Environment Variables

- `WORKER_URL` - Override default worker URL
- `GH_TOKEN` - GitHub token (automatically detected from `gh` CLI)

### Custom Worker URL

You can specify a custom worker URL:

```bash
./greener-provision --worker-url "https://staging-worker.workers.dev"
```

## Troubleshooting

### GitHub CLI Not Authenticated
```bash
✗ Not authenticated with GitHub CLI
ℹ Run: gh auth login
```

**Solution**: Run `gh auth login` and follow the prompts.

### jq Not Found
```bash
✗ jq is required for JSON parsing
ℹ Install jq: https://stedolan.github.io/jq/download/
```

**Solution**: Install jq using your system's package manager.

### Permission Denied
```bash
✗ Access denied for myorg/repo (check permissions)
```

**Solution**: Ensure you have admin access to the repository.

### Rate Limited
```bash
⚠ Rate limited, waiting 60 seconds...
```

**Solution**: The tool automatically waits and retries.

## Security

- Uses GitHub CLI authentication (no tokens stored)
- Secrets transmitted over HTTPS
- Repository access validated before provisioning
- Rate limiting to prevent abuse

## Integration with CI/CD

After provisioning, use the secrets in your GitHub Actions workflows:

```yaml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build
        env:
          GREENER_CI_KEY: ${{ secrets.GREENER_CI_KEY }}
          GREENER_CI_SECRET: ${{ secrets.GREENER_CI_SECRET }}
          GREENER_API_TOKEN: ${{ secrets.GREENER_API_TOKEN }}
        run: |
          echo "Building with Greener CI/CD..."
          # Your build commands here
```

## Support

For issues or questions:

1. Check the [troubleshooting section](#troubleshooting)
2. Review [GitHub Issues](https://github.com/your-org/greenerCICD/issues)
3. Create a new issue with:
   - Operating system
   - CLI tool version
   - Error message (with sensitive info redacted)
   - Steps to reproduce