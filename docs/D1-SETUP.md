# D1 Database Setup and Migration Guide (v1.0)

## Overview

This guide explains how to set up and manage the Cloudflare D1 database for Greener CI/CD with enhanced security features, comprehensive admin functionality, and automatic migrations.

## Prerequisites

1. **Cloudflare Account**: You need a Cloudflare account with Workers enabled
2. **Wrangler CLI**: Install globally: `npm install -g wrangler`
3. **Node.js**: Version 18 or higher
4. **Cloudflare API Token**: With Workers and D1 permissions

## Security Features

### Enhanced Password Security
- **PBKDF2 Hashing**: Passwords are hashed using PBKDF2 with 100,000 iterations
- **Random Salts**: Each password uses a unique cryptographic salt
- **Secure Sessions**: Session tokens expire after 24 hours
- **CSRF Protection**: All state-changing operations require CSRF tokens

### Migration Security
- **SHA-256 Checksums**: All migrations use cryptographic checksums
- **Token Authentication**: Migration endpoints require authentication (no default tokens)
- **Audit Logging**: All admin actions are logged with IP addresses and timestamps

## Initial Setup

### 1. Automated Setup (Recommended)

Run the setup script to automatically create and configure the D1 database:

```bash
# Install dependencies
npm install

# Run setup for development
npm run setup

# Or for production
npm run setup:prod

# Set required environment variables
export MIGRATION_TOKEN="$(openssl rand -hex 32)"  # Generate secure token
```

This script will:
- Create the D1 database `greener-cicd-db`
- Update `wrangler.toml` with the database ID
- Run initial migrations with secure checksums
- Set up all required tables and indexes

### 2. Manual Setup

If you prefer manual setup:

```bash
# Create D1 database
wrangler d1 create greener-cicd-db

# Copy the database_id from output and add to wrangler.toml:
# [[d1_databases]]
# binding = "DB"
# database_name = "greener-cicd-db"
# database_id = "YOUR_DATABASE_ID_HERE"

# Run migrations
wrangler d1 execute greener-cicd-db --file=proxy/database/schema.sql
```

## Admin Interface

### Accessing the Admin Panel

1. **Initial Setup:**
   Navigate to `https://your-worker.workers.dev/admin/setup`
   - Create your admin username and password
   - Minimum password length: 8 characters
   - Password is securely hashed using PBKDF2 with 100,000 iterations

2. **Login:**
   Navigate to `https://your-worker.workers.dev/admin/login`
   - Beautiful gradient-based UI with animations
   - Session expires after 24 hours
   - Secure HttpOnly cookies for session management

3. **Dashboard Features:**
   - **Statistics Overview**: View total links, active sessions, migration status
   - **Recent Activity**: Monitor audit logs and user actions
   - **Migration Status**: Check pending/applied migrations with visual badges
   - **Session Management**: Secure logout functionality
   - **Real-time Updates**: See live statistics with beautiful cards

### Admin API Endpoints

```javascript
// Login via API
POST /api/admin/login
Content-Type: application/json
{
  "username": "admin",
  "password": "your-password"
}

// Response
{
  "success": true,
  "token": "session-token",
  "expiresAt": "2024-01-02T00:00:00.000Z"
}

// Check migration status
GET /api/migration/status
Authorization: Bearer <session-token>

// Response
{
  "applied": 1,
  "pending": 0,
  "latest": 1,
  "migrations": {
    "applied": [...],
    "pending": []
  }
}
```

## Migration System

### Performance Optimizations

- **5-minute caching**: Migrations are cached to reduce database checks
- **Background execution**: Migration runs don't block request processing
- **Automatic retry**: Comprehensive error handling with detailed error messages
- **Batch operations**: D1 batch API for transactional migrations

### How Migrations Work

1. **Migration Files**: Located in `proxy/migrations/`
2. **Version Tracking**: Each migration has a version number
3. **Automatic Detection**: System detects and runs pending migrations
4. **SHA-256 Checksums**: Ensures migration integrity with cryptographic hashes

### Creating New Migrations

1. Create a new file in `proxy/migrations/`:

```javascript
// proxy/migrations/002_add_feature.js
export const version = 2;
export const name = 'add_feature';
export const up = `
  CREATE TABLE new_feature (
    id TEXT PRIMARY KEY,
    -- your schema here
  );
`;
export const checksum = null; // Will be auto-generated using SHA-256
```

2. Register in `proxy/migrations/index.js`:

```javascript
import * as migration002 from './002_add_feature.js';

// Add to migrations array
const migrations = [
  migration001,
  migration002  // Add new migration
];
```

3. Run migrations:

```bash
npm run migrate        # Development
npm run migrate:prod   # Production
```

### Migration Worker (Optional)

Deploy a separate worker to handle migrations automatically:

```bash
# Bundle and deploy migration worker
npm run deploy:migration

# The migration worker exposes:
# GET /status - Check migration status
# POST /migrate - Run pending migrations (requires Bearer token auth)
```

## Database Schema

### Tables Created

1. **admin**: Stores admin credentials with PBKDF2 hashed passwords
2. **access_links**: Manages access tokens for repositories
3. **user_sessions**: Tracks user sessions with expiry
4. **admin_sessions**: Admin authentication sessions
5. **audit_log**: Comprehensive audit trail of all actions

### Optimized Indexes

- `idx_access_links_token`: Fast token lookups
- `idx_user_sessions_token`: Session validation
- `idx_admin_sessions_token`: Admin authentication
- `idx_audit_log_timestamp`: Audit log queries
- `idx_access_links_active`: Active link filtering

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm test migration-manager
npm test auth

# Run with coverage
npm run test:coverage
```

### Test Coverage Areas

- **Migration system**: Rollback, checksums, error handling
- **Authentication**: PBKDF2 password hashing, session management
- **CSRF protection**: Token generation and validation
- **Error handling**: Comprehensive error recovery

## Local Development

### Setting Up Local D1

```bash
# Create local D1 database
wrangler d1 execute greener-cicd-db --local --file=proxy/database/schema.sql

# Run worker locally with D1
wrangler dev --local --persist
```

### Testing Migrations Locally

```bash
# Test migrations locally
wrangler d1 execute greener-cicd-db --local --command "SELECT * FROM schema_migrations"

# Run specific migration
wrangler d1 execute greener-cicd-db --local --file=proxy/migrations/001_initial_schema.sql
```

## Monitoring and Debugging

### Check Database Status

```bash
# List all D1 databases
wrangler d1 list

# Query migration status
wrangler d1 execute greener-cicd-db --command "SELECT * FROM schema_migrations"

# Check table structure
wrangler d1 execute greener-cicd-db --command ".tables"
```

### View Worker Logs

```bash
# Tail production logs
npm run tail:prod

# View specific worker logs
wrangler tail --env production --format pretty
```

## GitHub Actions Integration

### Automatic Deployment with Migrations

The workflow `.github/workflows/deploy-with-migrations.yml` handles:

1. **Database Creation**: Automatically creates D1 if not exists
2. **Migration Execution**: Runs all pending migrations
3. **Worker Deployment**: Deploys the updated worker
4. **Secret Management**: Sets required secrets

### Required GitHub Secrets

Set these in your repository settings:

- `CLOUDFLARE_API_TOKEN` - API token with Workers and D1 permissions
- `GITHUB_TOKEN` - Personal access token with repo access
- `APP_ID` - GitHub App ID
- `CLIENT_ID` - GitHub OAuth Client ID
- `CLIENT_SECRET` - GitHub OAuth Client Secret
- `WEBHOOK_SECRET` - Webhook secret for GitHub App
- `MIGRATION_TOKEN` - Authentication token for migration worker (generate with `openssl rand -hex 32`)

## Cost Optimization

### Why Cloudflare Workers for Migrations?

1. **Cost**: Workers are cheaper than GitHub Actions minutes
2. **Speed**: Migrations run at edge locations
3. **Integration**: Direct access to D1 without external connections
4. **Automation**: Can schedule periodic migration checks

### Pricing Comparison

- **GitHub Actions**: $0.008 per minute
- **Cloudflare Workers**: 100,000 requests/day free, then $0.15/million
- **D1 Database**: 5GB free, 100k writes/day free

## Troubleshooting

### Common Issues

1. **Database Not Found**
   ```bash
   # Verify database exists
   wrangler d1 list
   ```

2. **Migration Failures**
   ```bash
   # Check migration status
   wrangler d1 execute greener-cicd-db --command "SELECT * FROM schema_migrations"
   # Review error logs
   wrangler tail
   ```

3. **Permission Errors**
   - Ensure API token has D1 and Workers permissions
   - Check wrangler is authenticated: `wrangler whoami`

4. **Worker Not Updating**
   ```bash
   # Force redeploy
   npm run bundle && wrangler deploy --env production --force
   ```

5. **Migration Token Not Set**
   - Always set MIGRATION_TOKEN environment variable
   - No default tokens are provided for security

## Best Practices

1. **Security First**: Never use default tokens or weak passwords
2. **Version Control**: Always increment migration versions
3. **Testing**: Test migrations locally before production
4. **Backups**: Export data before major migrations
5. **Monitoring**: Use migration worker `/status` endpoint
6. **Rollback Plan**: Keep rollback SQL ready for critical changes
7. **Audit Trail**: Review audit logs regularly for suspicious activity

## Support

For issues or questions:
- Check worker logs: `wrangler tail`
- Review migration status in D1
- Monitor audit logs in admin dashboard
- Open issue in repository