# D1 Database Setup and Migration Guide

## Overview

This guide explains how to set up and manage the Cloudflare D1 database for Greener CI/CD, including automatic migrations.

## Prerequisites

1. **Cloudflare Account**: You need a Cloudflare account with Workers enabled
2. **Wrangler CLI**: Install globally: `npm install -g wrangler`
3. **Node.js**: Version 18 or higher
4. **Cloudflare API Token**: With Workers and D1 permissions

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
```

This script will:
- Create the D1 database `greener-cicd-db`
- Update `wrangler.toml` with the database ID
- Run initial migrations
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

## Migration System

### How Migrations Work

1. **Migration Files**: Located in `proxy/migrations/`
2. **Version Tracking**: Each migration has a version number
3. **Automatic Detection**: System detects and runs pending migrations
4. **Checksum Validation**: Ensures migration integrity

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
export const checksum = 'auto'; // Will be generated
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
# POST /migrate - Run pending migrations (requires auth)
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
- `MIGRATION_TOKEN` - Authentication token for migration worker

### Triggering Deployments

Deployments run automatically when:
- Pushing to `main` branch
- Modifying files in `proxy/` directory
- Updating `wrangler.toml`
- Manual trigger via GitHub Actions UI

## Cloudflare Worker Integration

### Using D1 in Worker Code

```javascript
// Access database in worker
export default {
  async fetch(request, env, ctx) {
    // Database is available as env.DB
    const result = await env.DB.prepare(
      'SELECT * FROM admin WHERE username = ?'
    ).bind('admin').first();
    
    return new Response(JSON.stringify(result));
  }
}
```

### Running Migrations on Deploy

Add to your worker to run migrations on startup:

```javascript
import { runMigrations } from './migrations/index.js';

export default {
  async fetch(request, env, ctx) {
    // Run migrations in background (non-blocking)
    ctx.waitUntil(runMigrations(env.DB));
    
    // Handle request
    return handleRequest(request, env);
  }
}
```

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
   ```

3. **Permission Errors**
   - Ensure API token has D1 and Workers permissions
   - Check wrangler is authenticated: `wrangler whoami`

4. **Worker Not Updating**
   ```bash
   # Force redeploy
   npm run bundle && wrangler deploy --env production --force
   ```

## Best Practices

1. **Version Control**: Always increment migration versions
2. **Testing**: Test migrations locally before production
3. **Backups**: Export data before major migrations
4. **Monitoring**: Use migration worker `/status` endpoint
5. **Rollback Plan**: Keep rollback SQL ready for critical changes

## Support

For issues or questions:
- Check worker logs: `wrangler tail`
- Review migration status in D1
- Open issue in repository