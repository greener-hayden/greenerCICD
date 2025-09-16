# Security Guide

Comprehensive security documentation for the Greener CI/CD system.

## Security Model Overview

Greener CI/CD implements a **defense-in-depth security model** with multiple layers of protection:

1. **CLI Security** - Local authentication and validation
2. **Transport Security** - HTTPS and secure communication
3. **Worker Security** - Input validation and rate limiting
4. **GitHub Security** - OAuth tokens and repository permissions
5. **Secret Security** - Encrypted storage and secure generation

## Threat Model

### Assets to Protect
- **GitHub Repository Access** - Unauthorized secret modification
- **User Authentication** - GitHub token compromise
- **Worker Infrastructure** - Service availability and integrity
- **Generated Secrets** - Cryptographic quality and uniqueness

### Threat Actors
- **External Attackers** - Internet-based attacks on public endpoints
- **Malicious Users** - Authenticated users attempting privilege escalation
- **Compromised Tokens** - Stolen or leaked GitHub tokens
- **Service Abuse** - Rate limiting and resource exhaustion

### Attack Vectors
- **API Endpoint Attacks** - Direct worker API exploitation
- **Token Theft** - GitHub CLI token compromise
- **Input Injection** - Malicious repository names or parameters
- **Rate Limiting Bypass** - Distributed attack attempts
- **Social Engineering** - Tricking users into malicious actions

## CLI Security

### Authentication
```bash
# CLI uses GitHub CLI authentication
gh auth login
gh auth status
```

**Security Features**:
- ✅ **GitHub OAuth** - Industry standard authentication
- ✅ **Local Token Storage** - Tokens stored securely by GitHub CLI
- ✅ **Token Validation** - Real-time validation against GitHub API
- ✅ **Scope Verification** - Ensures appropriate permissions

### Input Validation
```bash
# Repository format validation
if [[ ! "$repo" =~ ^[a-zA-Z0-9._-]+/[a-zA-Z0-9._-]+$ ]]; then
    log_error "Invalid repository format: $repo"
    exit 1
fi
```

**Validation Rules**:
- Repository names must match `owner/name` pattern
- Length limits on all string inputs
- Character restrictions (alphanumeric, dots, dashes, underscores)
- No path traversal characters

### Secure Defaults
- **HTTPS Only** - All communication encrypted
- **No Token Logging** - Tokens never written to logs
- **Fail Secure** - Errors result in operation denial
- **Minimal Permissions** - Only required GitHub scopes

## Transport Security

### HTTPS Enforcement
All communication uses HTTPS with modern TLS:
```bash
# CLI enforces HTTPS
WORKER_URL="https://greener-cicd-webhook-proxy.workers.dev"

# Cloudflare provides TLS termination
# - TLS 1.3 support
# - Perfect Forward Secrecy
# - Strong cipher suites
```

### Certificate Validation
- **Certificate Pinning** - Cloudflare's trusted certificates
- **HSTS Headers** - Prevent downgrade attacks
- **Secure Cookies** - HttpOnly and Secure flags

## Worker Security

### Input Validation and Sanitization

#### String Validation
```javascript
import { parseRequiredString, parseOptionalString } from './utils/validation.js';

// Validate repository parameter
const repository = parseRequiredString(payload.repository, 'repository', 100);

// Validate repository format
if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repository)) {
  throw new Response('Repository must be in owner/name format', { status: 400 });
}
```

#### XSS Prevention
```javascript
import { escapeHtml, safeHtml } from './utils/sanitize.js';

// Safe HTML generation
const content = safeHtml`
  <div>Repository: ${escapeHtml(repository)}</div>
`;
```

### Authentication and Authorization

#### Token Validation
```javascript
// Extract and validate GitHub token
const authHeader = request.headers.get('Authorization');
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return unauthorized('Authorization header with Bearer token required');
}

const userToken = authHeader.slice(7);

// Validate token against GitHub API
const repoResponse = await fetch(`https://api.github.com/repos/${repository}`, {
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Greener-CI-CD-CLI'
  }
});

if (!repoResponse.ok) {
  return unauthorized('Invalid GitHub token or insufficient permissions');
}
```

#### Repository Access Verification
```javascript
// Verify user has admin access to repository
const repoData = await repoResponse.json();
if (!repoData.permissions?.admin) {
  return forbidden('Admin access required for repository');
}
```

### Rate Limiting

#### Implementation
```javascript
import { enforceRateLimit, getClientKey } from './utils/rateLimit.js';

// Rate limiting by IP address
const clientKey = getClientKey(request);
await enforceRateLimit(env, clientKey, 60, 60); // 60 requests per 60 seconds
```

#### Rate Limiting Strategy
- **Per-IP Limits** - 60 requests per minute per IP
- **Sliding Window** - Distributed rate limiting
- **Graceful Degradation** - Clear error messages
- **Bypass Prevention** - IP-based tracking

### Content Security Policy

#### CSP Headers
```javascript
import { withSecurityHeaders } from './utils/csp.js';

// Apply comprehensive security headers
const response = new Response(content, { status: 200 });
return withSecurityHeaders(response, nonce);
```

#### Security Headers Applied
```http
Content-Security-Policy: default-src 'none'; script-src 'nonce-xxx'; style-src 'nonce-xxx'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
```

## GitHub API Security

### Token Management
```javascript
// Use user tokens for repository access
const userToken = extractBearerToken(request);

// Never store or log tokens
// Tokens are used only for immediate API calls
```

### API Best Practices
- **Least Privilege** - Request minimal required permissions
- **Token Validation** - Verify tokens before use
- **Error Handling** - Don't leak sensitive information
- **Rate Limiting** - Respect GitHub's rate limits

### Repository Permissions
Required permissions for secret provisioning:
- **Repository Access** - Read repository metadata
- **Admin Access** - Manage repository secrets
- **Actions Secrets** - Create and update secrets

## Secret Security

### Secret Generation

#### Cryptographic Quality
```javascript
function generateSecret(length) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array); // Cryptographically secure

  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}
```

**Security Properties**:
- ✅ **Cryptographically Secure** - Uses `crypto.getRandomValues()`
- ✅ **Sufficient Entropy** - 32-64 character length
- ✅ **Character Set** - Lowercase letters and numbers only
- ✅ **Uniqueness** - Generated per repository, per provisioning

#### Secret Types and Lengths
| Secret | Length | Entropy | Purpose |
|--------|--------|---------|---------|
| `GREENER_CI_KEY` | 32 chars | ~165 bits | Repository CI key |
| `GREENER_CI_SECRET` | 64 chars | ~330 bits | Repository CI secret |
| `GREENER_API_TOKEN` | 32 chars | ~165 bits | API access token |

### Secret Storage

#### GitHub's Secret Encryption
```javascript
// Secrets are encrypted using GitHub's public key system
const keyResponse = await fetch(`https://api.github.com/repos/${repository}/actions/secrets/public-key`);
const keyData = await keyResponse.json();

// TODO: Implement proper libsodium encryption
const encryptedValue = btoa(secretValue); // Temporary base64 encoding

const secretResponse = await fetch(`https://api.github.com/repos/${repository}/actions/secrets/${secretName}`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    encrypted_value: encryptedValue,
    key_id: keyData.key_id
  })
});
```

**Future Enhancement**: Implement proper libsodium encryption instead of base64 encoding.

### Secret Lifecycle
1. **Generation** - Cryptographically secure random generation
2. **Encryption** - GitHub's public key encryption
3. **Transmission** - HTTPS-encrypted API calls
4. **Storage** - GitHub's encrypted secret store
5. **Access** - Only available to repository Actions

## Incident Response

### Security Incident Types

#### Token Compromise
1. **Detection** - Unusual API activity, failed authentication
2. **Response** - Revoke compromised token immediately
3. **Recovery** - Re-authenticate with `gh auth login`
4. **Prevention** - Regular token rotation, secure storage

#### Worker Compromise
1. **Detection** - Unusual worker behavior, error patterns
2. **Response** - Emergency worker redeployment
3. **Recovery** - Investigate logs, patch vulnerabilities
4. **Prevention** - Regular security updates, monitoring

#### Repository Access Breach
1. **Detection** - Unauthorized secret modifications
2. **Response** - Revoke repository access, audit changes
3. **Recovery** - Re-provision secrets with new values
4. **Prevention** - Access reviews, permission audits

### Emergency Procedures

#### Disable CLI Tool
```bash
# Update worker to reject CLI requests
case '/api/cli-provision':
  return new Response('Service temporarily unavailable', { status: 503 });
```

#### Rotate All Secrets
```bash
# Re-provision all secrets (emergency script)
for repo in $(gh repo list --json name --jq '.[].name'); do
  ./greener-provision --repos "$(gh api user --jq .login)/$repo"
done
```

#### Worker Rollback
```bash
# Emergency rollback to previous version
git checkout HEAD~1 -- proxy/
wrangler deploy --env production
```

## Security Monitoring

### Logging Strategy
```javascript
// Security-relevant events to log
console.log(JSON.stringify({
  event: 'authentication_failure',
  timestamp: new Date().toISOString(),
  clientIP: request.headers.get('CF-Connecting-IP'),
  userAgent: request.headers.get('User-Agent'),
  error: 'Invalid token'
}));
```

### Metrics to Monitor
- **Authentication Failures** - Failed token validations
- **Rate Limit Violations** - Excessive request patterns
- **Repository Access Denials** - Permission errors
- **API Error Rates** - GitHub API failures

### Alerting Thresholds
- **High Error Rate** - >5% error rate over 5 minutes
- **Rate Limit Abuse** - >100 rate limit violations per hour
- **Authentication Failures** - >50 failures per hour

## Security Auditing

### Regular Security Tasks

#### Monthly
- Review GitHub token permissions
- Audit repository access patterns
- Check for dependency vulnerabilities
- Review Cloudflare security settings

#### Quarterly
- Security code review
- Penetration testing
- Incident response drill
- Documentation updates

#### Annually
- Comprehensive security assessment
- Threat model review
- Security training updates
- Compliance verification

### Security Checklist

#### CLI Security
- [ ] GitHub CLI authentication working
- [ ] Input validation functioning
- [ ] No token leakage in logs
- [ ] HTTPS-only communication

#### Worker Security
- [ ] Input validation comprehensive
- [ ] Rate limiting active
- [ ] Security headers applied
- [ ] Error handling secure

#### Secret Security
- [ ] Cryptographic generation quality
- [ ] Proper encryption (TODO: libsodium)
- [ ] Secure transmission
- [ ] Access controls working

## Compliance and Standards

### Security Standards
- **OWASP Top 10** - Protection against common vulnerabilities
- **NIST Cybersecurity Framework** - Structured security approach
- **GitHub Security Best Practices** - Platform-specific guidelines

### Privacy Considerations
- **Minimal Data Collection** - Only necessary information
- **Data Retention** - No persistent user data storage
- **Transparency** - Clear data usage policies

## Security Contact

### Reporting Security Issues
- **Email**: security@your-domain.com
- **GitHub Issues**: For non-sensitive security improvements
- **Responsible Disclosure**: 90-day disclosure timeline

### Security Resources
- [GitHub Security Documentation](https://docs.github.com/en/code-security)
- [Cloudflare Security Center](https://www.cloudflare.com/security-center/)
- [OWASP Guidelines](https://owasp.org/www-project-top-ten/)

For security-related troubleshooting, see [Troubleshooting Guide](07-troubleshooting.md).