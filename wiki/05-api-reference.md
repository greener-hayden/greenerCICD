# API Reference

Complete reference for Cloudflare Worker endpoints and CLI commands.

## Cloudflare Worker API

Base URL: `https://greener-cicd-webhook-proxy.workers.dev`

### Endpoints Overview

| Endpoint | Method | Purpose | Authentication |
|----------|--------|---------|----------------|
| `/` | GET | Home page | None |
| `/` | POST | GitHub webhook | Webhook secret |
| `/api/cli-provision` | POST | CLI secret provisioning | Bearer token |
| `/api/analytics` | GET | Usage analytics | None |
| `/health` | GET | Health check | None |

---

## Primary Endpoints

### CLI Provisioning

**Endpoint**: `POST /api/cli-provision`

**Purpose**: Provision CI/CD secrets to a repository via CLI

**Authentication**: Bearer token (GitHub user token)

#### Request
```http
POST /api/cli-provision HTTP/1.1
Host: greener-cicd-webhook-proxy.workers.dev
Content-Type: application/json
Authorization: Bearer ghp_xxxxxxxxxxxxxxxxxxxx

{
  "repository": "owner/repo-name"
}
```

#### Request Schema
```json
{
  "repository": {
    "type": "string",
    "pattern": "^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$",
    "maxLength": 100,
    "description": "Repository in owner/name format"
  }
}
```

#### Response (Success)
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "success": true,
  "repository": "owner/repo-name",
  "secrets": [
    "GREENER_CI_KEY",
    "GREENER_CI_SECRET",
    "GREENER_API_TOKEN",
    "GREENER_APP_ID",
    "GREENER_INSTALLATION_ID"
  ],
  "failed": [],
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### Response (Partial Success)
```http
HTTP/1.1 207 Multi-Status
Content-Type: application/json

{
  "success": false,
  "repository": "owner/repo-name",
  "secrets": [
    "GREENER_CI_KEY",
    "GREENER_CI_SECRET"
  ],
  "failed": [
    {
      "name": "GREENER_API_TOKEN",
      "status": "failed",
      "error": "Rate limited by GitHub API"
    }
  ],
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

#### Error Responses

**Authentication Required**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "success": false,
  "error": "Authorization header with Bearer token required"
}
```

**Invalid Token**
```http
HTTP/1.1 401 Unauthorized
Content-Type: application/json

{
  "success": false,
  "error": "Invalid GitHub token"
}
```

**Repository Not Found**
```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "success": false,
  "error": "Repository not found or no access: owner/repo-name"
}
```

**Invalid Repository Format**
```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "success": false,
  "error": "Repository must be in owner/name format"
}
```

**Rate Limited**
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "success": false,
  "error": "Rate limit exceeded. Try again later."
}
```

---

## Secondary Endpoints

### Health Check

**Endpoint**: `GET /health`

**Purpose**: Check worker health and version

**Authentication**: None

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "healthy",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "version": "1.0.0"
}
```

### Analytics

**Endpoint**: `GET /api/analytics`

**Purpose**: Get usage analytics

**Authentication**: None

#### Request
```http
GET /api/analytics?installation_id=12345 HTTP/1.1
Host: greener-cicd-webhook-proxy.workers.dev
```

#### Response
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "installations": 5,
  "repositories": 25,
  "lastProvisioned": "2025-01-15T09:15:00.000Z"
}
```

### GitHub Webhook

**Endpoint**: `POST /`

**Purpose**: Handle GitHub App installation events

**Authentication**: Webhook secret (optional)

#### Request
```http
POST / HTTP/1.1
Host: greener-cicd-webhook-proxy.workers.dev
Content-Type: application/json
X-GitHub-Event: installation
X-GitHub-Delivery: 72d3162e-cc78-11e3-81ab-4c9367dc0958
X-Hub-Signature-256: sha256=...

{
  "action": "created",
  "installation": {
    "id": 12345,
    "account": {
      "login": "octocat"
    }
  }
}
```

---

## Generated Secrets Reference

When provisioning succeeds, these secrets are created in the target repository:

| Secret Name | Length | Purpose |
|-------------|--------|---------|
| `GREENER_CI_KEY` | 32 chars | Unique repository CI key |
| `GREENER_CI_SECRET` | 64 chars | Unique repository CI secret |
| `GREENER_API_TOKEN` | 32 chars | API access token |
| `GREENER_APP_ID` | Variable | Application identifier |
| `GREENER_INSTALLATION_ID` | Variable | Installation identifier |

### Secret Characteristics
- **Character set**: `abcdefghijklmnopqrstuvwxyz0123456789`
- **Generation**: Cryptographically secure random
- **Uniqueness**: Per repository, per provisioning
- **Encryption**: GitHub's native secret encryption

### Using Secrets in GitHub Actions
```yaml
name: CI
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build with Greener CI/CD
        env:
          GREENER_CI_KEY: ${{ secrets.GREENER_CI_KEY }}
          GREENER_CI_SECRET: ${{ secrets.GREENER_CI_SECRET }}
          GREENER_API_TOKEN: ${{ secrets.GREENER_API_TOKEN }}
        run: |
          echo "Building with Greener CI/CD..."
          # Your build commands here
```

---

## CLI Tool Reference

### Command Syntax
```bash
greener-provision [OPTIONS]
```

### Options

| Option | Short | Required | Description |
|--------|-------|----------|-------------|
| `--repos REPOS` | `-r` | No | Comma-separated repository list |
| `--interactive` | `-i` | No | Interactive mode (default) |
| `--worker-url URL` | `-w` | No | Custom worker URL |
| `--help` | `-h` | No | Show help message |

### Examples

#### Interactive Mode (Default)
```bash
greener-provision
```

#### Specific Repositories
```bash
greener-provision --repos "myorg/repo1,myorg/repo2"
```

#### Custom Worker URL
```bash
greener-provision --worker-url "https://staging-worker.workers.dev" --repos "test/repo"
```

#### Get Help
```bash
greener-provision --help
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success - all repositories provisioned |
| 1 | Failure - one or more repositories failed |
| 2 | Configuration error - missing dependencies or auth |

### Output Format

#### Success Example
```
🌱 Greener CI/CD Secret Provisioning

✓ GitHub CLI found
✓ GitHub CLI authenticated
✓ jq found

📋 Fetching Your Repositories

Available repositories:
 1. myorg/frontend (private)
 2. myorg/backend (private)

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

#### Error Example
```
🌱 Greener CI/CD Secret Provisioning

✓ GitHub CLI found
✗ Not authenticated with GitHub CLI
ℹ Run: gh auth login
```

---

## Rate Limiting

### Worker Rate Limits
- **Per IP**: 60 requests per minute
- **Global**: No enforced limit (Cloudflare scaling)
- **GitHub API**: Subject to GitHub's rate limits

### Rate Limit Headers
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 1642291200
```

### Rate Limit Response
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "success": false,
  "error": "Rate limit exceeded. Try again later.",
  "retryAfter": 60
}
```

---

## Error Handling

### Error Response Format
All API errors follow this format:
```json
{
  "success": false,
  "error": "Human-readable error message",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

### Common Error Categories

#### Authentication Errors (401)
- Invalid or missing GitHub token
- Expired authentication
- Insufficient permissions

#### Authorization Errors (403)
- Repository access denied
- Rate limits exceeded
- GitHub API permissions insufficient

#### Client Errors (400)
- Invalid repository format
- Missing required fields
- Invalid request structure

#### Server Errors (500)
- Worker runtime errors
- GitHub API unavailable
- Internal processing failures

---

## SDK and Libraries

### Bash/Shell
```bash
# Direct curl usage
provision_secrets() {
    local repo="$1"
    local token="$2"

    curl -s -X POST \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $token" \
        -d "{\"repository\": \"$repo\"}" \
        "https://greener-cicd-webhook-proxy.workers.dev/api/cli-provision"
}
```

### Node.js
```javascript
async function provisionSecrets(repository, token) {
    const response = await fetch('https://greener-cicd-webhook-proxy.workers.dev/api/cli-provision', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ repository })
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    return response.json();
}
```

### Python
```python
import requests

def provision_secrets(repository: str, token: str) -> dict:
    url = "https://greener-cicd-webhook-proxy.workers.dev/api/cli-provision"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}"
    }
    data = {"repository": repository}

    response = requests.post(url, json=data, headers=headers)
    response.raise_for_status()
    return response.json()
```

---

## Testing and Development

### Test Endpoints
```bash
# Health check
curl https://greener-cicd-webhook-proxy.workers.dev/health

# Test with invalid data
curl -X POST https://greener-cicd-webhook-proxy.workers.dev/api/cli-provision \
    -H "Content-Type: application/json" \
    -d '{"repository": "invalid-format"}'

# Test authentication
curl -X POST https://greener-cicd-webhook-proxy.workers.dev/api/cli-provision \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer invalid-token" \
    -d '{"repository": "test/repo"}'
```

### Mock Testing
```bash
# Use httpbin for testing CLI without provisioning
WORKER_URL="https://httpbin.org/post" ./greener-provision --repos "test/repo"
```

For implementation examples, see [Development Guide](03-development-guide.md).
For troubleshooting API issues, see [Troubleshooting Guide](07-troubleshooting.md).