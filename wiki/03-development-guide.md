# Development Guide

Comprehensive guide for developing and contributing to the Greener CI/CD project.

## Development Environment Setup

### Prerequisites
- Git, GitHub CLI, Node.js, jq, curl
- Cloudflare account (for worker development)
- Text editor or IDE

### Local Setup
```bash
# Clone and setup
git clone https://github.com/greener-hayden/greenerCICD.git
cd greenerCICD

# Make CLI executable
chmod +x greener-provision

# Install Wrangler (Cloudflare CLI)
npm install -g wrangler

# Authenticate with Cloudflare
wrangler login
```

## Project Structure

```
greenerCICD/
├── greener-provision           # CLI tool (bash script)
├── proxy/
│   ├── worker.js              # Main Cloudflare Worker
│   └── utils/                 # Security utilities
│       ├── http.js           # HTTP helpers and CSRF
│       ├── validation.js     # Input validation
│       ├── sanitize.js       # XSS prevention
│       ├── csp.js           # Content Security Policy
│       ├── rateLimit.js     # Rate limiting
│       ├── env.js           # Environment validation
│       └── styles.js        # Shared CSS styles
├── wiki/                      # Documentation (this folder)
├── .github/workflows/         # CI/CD workflows
├── CLI.md                     # CLI documentation
├── README.md                  # Project overview
├── CLAUDE.md                  # AI assistant guidance
└── wrangler.toml             # Cloudflare configuration
```

## Development Workflow

### 1. Create Feature Branch
```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes
Follow the coding patterns and security practices outlined below.

### 3. Test Locally
```bash
# Test CLI without actual provisioning
WORKER_URL="https://httpbin.org/post" ./greener-provision --repos "test/repo"

# Test worker locally
cd proxy
wrangler dev
```

### 4. Test Integration
```bash
# Test against staging worker
WORKER_URL="https://your-dev-worker.workers.dev" ./greener-provision --repos "test/repo"
```

### 5. Create Pull Request
- Include description of changes
- Reference any related issues
- Ensure tests pass

## CLI Development

### Code Organization
The CLI script follows this structure:
```bash
#!/bin/bash
set -euo pipefail

# Configuration and global variables
# Utility functions (logging, validation)
# Core business logic functions
# Command-line argument parsing
# Main execution flow
```

### Adding New CLI Features

#### 1. Add Command-Line Options
```bash
# In argument parsing section
case $1 in
    --new-option)
        NEW_OPTION="$2"
        shift 2
        ;;
    # ... existing options
esac
```

#### 2. Implement Functionality
```bash
# Add new function following existing patterns
handle_new_feature() {
    local param="$1"

    log_info "Processing new feature..."

    # Implementation here

    if [[ $? -eq 0 ]]; then
        log_success "Feature completed successfully"
    else
        log_error "Feature failed"
        return 1
    fi
}
```

#### 3. Update Help Text
```bash
# In show_usage() function
cat << EOF
OPTIONS:
    --new-option VALUE    Description of new option
    # ... existing options
EOF
```

### CLI Testing
```bash
# Test all help scenarios
./greener-provision --help
./greener-provision -h

# Test error conditions
./greener-provision --invalid-option
./greener-provision --repos ""

# Test with mock endpoints
WORKER_URL="https://httpbin.org/post" ./greener-provision --repos "test/repo"
```

## Worker Development

### Code Organization
```javascript
// Imports (security utilities)
// Main fetch handler
// Route handlers
// Business logic functions
// Utility functions
// Export statement
```

### Adding New Endpoints

#### 1. Add Route
```javascript
// In main switch statement
case '/api/new-endpoint':
  return request.method === 'POST'
    ? handleNewEndpoint(request, validatedEnv)
    : methodNotAllowed();
```

#### 2. Implement Handler
```javascript
async function handleNewEndpoint(request, env) {
  try {
    // Input validation
    const payload = await readJson(request);
    const param = parseRequiredString(payload.param, 'param', 100);

    // Business logic
    const result = await processRequest(param);

    // Return response
    return new Response(JSON.stringify({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: error instanceof Response ? error.status : 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

### Security Utilities

#### Input Validation
```javascript
import { parseRequiredString, parseOptionalString, parsePositiveInt } from './utils/validation.js';

// Validate required string
const repo = parseRequiredString(payload.repository, 'repository', 100);

// Validate optional string
const branch = parseOptionalString(payload.branch, 'branch', 50);

// Validate positive integer
const count = parsePositiveInt(payload.count, 'count');
```

#### Rate Limiting
```javascript
import { enforceRateLimit, getClientKey } from './utils/rateLimit.js';

// Apply rate limiting (60 requests per 60 seconds)
const clientKey = getClientKey(request);
await enforceRateLimit(env, clientKey, 60, 60);
```

#### CSRF Protection
```javascript
import { requireCsrf } from './utils/http.js';

// For state-changing operations
requireCsrf(request);
```

### Worker Testing
```bash
# Local development
cd proxy
wrangler dev

# Test endpoint
curl -X POST http://localhost:8787/api/cli-provision \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{"repository": "test/repo"}'

# Deploy to staging
wrangler deploy --env staging
```

## Security Guidelines

### Input Validation
- **Always validate inputs** using validation utilities
- **Sanitize HTML output** using sanitize utilities
- **Check string lengths** to prevent DoS attacks
- **Validate formats** (e.g., repository names, tokens)

### Authentication
- **Verify GitHub tokens** before processing requests
- **Check repository access** before making changes
- **Use least privilege** principle

### Error Handling
- **Don't leak sensitive information** in error messages
- **Log security events** for monitoring
- **Fail securely** - deny by default

### Code Examples

#### Secure Input Handling
```javascript
// Good
const repo = parseRequiredString(payload.repository, 'repository', 100);
if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(repo)) {
  throw new Response('Invalid repository format', { status: 400 });
}

// Bad - no validation
const repo = payload.repository;
```

#### Secure API Calls
```javascript
// Good
const response = await fetch(`https://api.github.com/repos/${repo}`, {
  headers: {
    'Authorization': `Bearer ${userToken}`,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Greener-CI-CD-CLI'
  }
});

// Bad - missing headers or validation
const response = await fetch(`https://api.github.com/repos/${repo}`);
```

## Testing Strategy

### Unit Testing
Currently minimal - consider adding:
```bash
# CLI unit tests
bats test/cli-tests.bats

# Worker unit tests (if added)
npm test
```

### Integration Testing
```bash
# End-to-end test with real repositories
./greener-provision --repos "your-org/test-repo"

# Verify secrets were created
gh secret list --repo "your-org/test-repo"
```

### Security Testing
```bash
# Test rate limiting
for i in {1..100}; do
  curl -X POST "https://worker.dev/api/cli-provision" &
done

# Test input validation
curl -X POST "https://worker.dev/api/cli-provision" \
  -d '{"repository": "../../../etc/passwd"}'
```

## Performance Guidelines

### CLI Performance
- **Minimize API calls** - batch operations where possible
- **Cache GitHub CLI results** when appropriate
- **Provide progress feedback** for long operations

### Worker Performance
- **Use efficient algorithms** for secret generation
- **Minimize external API calls**
- **Cache responses** where appropriate

## Debugging

### CLI Debugging
```bash
# Enable verbose output
set -x
./greener-provision --repos "test/repo"
set +x

# Check individual components
gh auth status
curl --version
jq --version
```

### Worker Debugging
```bash
# View logs
wrangler tail

# Local development with logging
cd proxy
wrangler dev

# Test specific functions
node -e "
const { generateSecret } = require('./worker.js');
console.log(generateSecret(32));
"
```

## Code Style

### Bash Style
- Use `set -euo pipefail`
- Quote all variables: `"$variable"`
- Use functions for reusable code
- Include descriptive comments
- Use consistent indentation (2 spaces)

### JavaScript Style
- Use ES modules (import/export)
- Use async/await for promises
- Include JSDoc comments for functions
- Use consistent error handling
- Follow security-first patterns

## Documentation

### When to Update Documentation
- **New features** - Update relevant wiki pages
- **API changes** - Update API reference
- **Security changes** - Update security guide
- **Deployment changes** - Update deployment guide

### Documentation Style
- **Clear headings** with proper hierarchy
- **Code examples** for all procedures
- **Cross-references** between related topics
- **Step-by-step instructions** for complex tasks

## Release Process

### Version Numbering
Currently informal - consider semantic versioning:
- **Major**: Breaking changes
- **Minor**: New features
- **Patch**: Bug fixes

### Release Steps
1. **Test thoroughly** in staging environment
2. **Update documentation** for any changes
3. **Create release notes** describing changes
4. **Deploy worker** via GitHub Actions
5. **Tag release** in Git
6. **Notify users** of CLI updates if needed

## Contributing Guidelines

### Code Review
- **Security focus** - Review for security implications
- **Test coverage** - Ensure adequate testing
- **Documentation** - Check for documentation updates
- **Performance** - Consider performance impact

### Pull Request Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Security enhancement

## Testing
- [ ] Tested locally
- [ ] Integration tests pass
- [ ] Security implications reviewed

## Documentation
- [ ] Updated relevant wiki pages
- [ ] Updated CLI help text
- [ ] Updated API documentation
```

For deployment specifics, see [Deployment Guide](04-deployment.md).