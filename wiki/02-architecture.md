# Architecture Overview

Comprehensive guide to the Greener CI/CD system architecture and design decisions.

## System Overview

Greener CI/CD is a **CLI-first secret provisioning system** that eliminates GitHub Actions compute overhead while providing instant secret deployment.

### Core Philosophy
- **Zero Infrastructure** - Single Cloudflare Worker handles everything
- **CLI-First** - Terminal interface for developers
- **Instant Provisioning** - Direct GitHub API calls, no workflow delays
- **Security-First** - Defense-in-depth security model

## Architecture Diagram

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Developer     │    │  Cloudflare      │    │   GitHub API    │
│                 │    │  Worker          │    │                 │
│ greener-        │────│ /api/cli-        │────│ Repository      │
│ provision       │    │ provision        │    │ Secrets API     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ GitHub CLI      │    │ Security Layer   │    │ Secret Store    │
│ Authentication  │    │ - Rate limiting  │    │ - Encrypted     │
│                 │    │ - Input validation│   │ - Per-repo      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Component Details

### CLI Tool (`greener-provision`)

**Purpose**: User-facing interface for secret provisioning

**Key Features**:
- Interactive repository selection
- GitHub CLI authentication integration
- Real-time progress feedback
- Error handling and retry logic
- Batch repository processing

**Technology**: Bash script with dependency checks

**Location**: `./greener-provision`

### Cloudflare Worker (`proxy/worker.js`)

**Purpose**: Serverless API backend handling GitHub operations

**Key Responsibilities**:
- User authentication validation
- Repository access verification
- Secret generation and encryption
- GitHub API interaction
- Security enforcement

**Technology**: JavaScript ES modules with Cloudflare Workers runtime

**Location**: `proxy/worker.js`

### Security Layer (`proxy/utils/`)

**Purpose**: Modular security utilities providing defense-in-depth

**Components**:
- `http.js` - HTTP helpers and CSRF protection
- `validation.js` - Input validation and sanitization
- `sanitize.js` - XSS prevention and HTML sanitization
- `csp.js` - Content Security Policy and nonce generation
- `rateLimit.js` - Rate limiting implementation
- `env.js` - Environment variable validation

## Data Flow

### Secret Provisioning Flow

```
1. User runs CLI
   ├── Check prerequisites (gh, jq, curl)
   ├── Authenticate with GitHub CLI
   └── Select target repositories

2. CLI calls Worker API
   ├── POST /api/cli-provision
   ├── Include Authorization: Bearer <github-token>
   └── Send repository information

3. Worker processes request
   ├── Validate GitHub token
   ├── Verify repository access
   ├── Generate unique secrets
   └── Provision via GitHub API

4. Response to CLI
   ├── Success/failure status
   ├── Provisioned secret names
   └── Error details if failed
```

### Authentication Flow

```
1. GitHub CLI Authentication
   ├── User: gh auth login
   ├── GitHub: OAuth flow
   └── CLI: Store token locally

2. Worker Token Validation
   ├── Extract Bearer token from request
   ├── Validate against GitHub API
   └── Verify repository access

3. Repository Access Check
   ├── GET /repos/{owner}/{repo}
   ├── Confirm user has admin access
   └── Proceed with secret provisioning
```

## Security Architecture

### Defense-in-Depth Model

**Layer 1: CLI Validation**
- Dependency checks (gh, jq, curl)
- GitHub CLI authentication verification
- Repository format validation

**Layer 2: Network Security**
- HTTPS-only communication
- Bearer token authentication
- Rate limiting at worker level

**Layer 3: Worker Validation**
- Input sanitization and validation
- GitHub token verification
- Repository access validation

**Layer 4: GitHub API Security**
- OAuth token authentication
- Repository permission checks
- Encrypted secret storage

### Secret Generation

```javascript
// Cryptographically secure random generation
function generateSecret(length) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}
```

### Secret Encryption

Secrets are encrypted using GitHub's public key system:
1. Fetch repository public key
2. Encrypt secret value (base64 for now, TODO: proper sodium encryption)
3. Store with key ID reference

## API Design

### CLI Endpoint (`/api/cli-provision`)

**Method**: POST
**Authentication**: Bearer token (GitHub user token)
**Content-Type**: application/json

**Request**:
```json
{
  "repository": "owner/repo-name"
}
```

**Response** (Success):
```json
{
  "success": true,
  "repository": "owner/repo-name",
  "secrets": ["GREENER_CI_KEY", "GREENER_CI_SECRET", "GREENER_API_TOKEN"],
  "failed": [],
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

**Response** (Partial failure):
```json
{
  "success": false,
  "repository": "owner/repo-name",
  "secrets": ["GREENER_CI_KEY"],
  "failed": [
    {
      "name": "GREENER_CI_SECRET",
      "status": "failed",
      "error": "Rate limited"
    }
  ],
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## Deployment Architecture

### Cloudflare Workers
- **Runtime**: Cloudflare Workers (V8 isolates)
- **Scaling**: Automatic edge scaling
- **Cold starts**: ~1ms
- **Geographic distribution**: Global edge network

### GitHub Actions CI/CD
- **Trigger**: Changes to `proxy/` directory
- **Process**: Deploy to Cloudflare using Wrangler
- **Environment**: Production environment
- **Secrets**: CLOUDFLARE_API_TOKEN

## Performance Characteristics

### CLI Tool
- **Startup time**: ~100ms (dependency checks)
- **Repository fetch**: ~500ms (GitHub API)
- **Provisioning**: ~2s per repository (GitHub API calls)

### Cloudflare Worker
- **Cold start**: ~1ms
- **Response time**: ~200ms (including GitHub API)
- **Rate limits**: 60 requests/minute per IP
- **Concurrent requests**: Unlimited (Cloudflare scaling)

## Error Handling

### CLI Error Categories
1. **Prerequisite errors** - Missing dependencies
2. **Authentication errors** - GitHub CLI issues
3. **Repository errors** - Access or existence issues
4. **Network errors** - API connectivity problems
5. **Rate limiting** - Automatic retry with backoff

### Worker Error Categories
1. **Authentication failures** - Invalid tokens
2. **Authorization failures** - Repository access denied
3. **GitHub API errors** - Upstream service issues
4. **Rate limiting** - Client or GitHub API limits
5. **Internal errors** - Worker runtime issues

## Extension Points

### Adding New Secret Types
1. Update `generateSecretsForRepo()` in worker.js
2. Modify CLI output parsing if needed
3. Update documentation

### Adding New CLI Commands
1. Extend argument parsing in CLI script
2. Add corresponding worker endpoints
3. Update help text and documentation

### Adding Authentication Methods
1. Create new validation in worker
2. Update CLI to provide credentials
3. Maintain backward compatibility

## Design Decisions

### Why CLI-First?
- **Developer Experience**: Fits existing terminal workflows
- **Infrastructure**: No web UI maintenance overhead
- **Security**: Leverages existing GitHub CLI authentication
- **Portability**: Works in any environment with basic tools

### Why Cloudflare Workers?
- **Zero Infrastructure**: No server management
- **Global Scale**: Edge network performance
- **Cost Efficiency**: Pay-per-request model
- **Security**: Isolated execution environment

### Why Bash Script?
- **Portability**: Works on all Unix-like systems
- **Dependencies**: Minimal external requirements
- **Transparency**: Easy to read and audit
- **Integration**: Natural fit with existing toolchains

## Monitoring and Observability

### CLI Monitoring
- Exit codes for automation
- Colored output for human readability
- Progress indicators for long operations
- Detailed error messages with context

### Worker Monitoring
- Cloudflare Analytics dashboard
- Error rate tracking
- Performance metrics
- Rate limiting statistics

For troubleshooting specifics, see [Troubleshooting Guide](07-troubleshooting.md).