#!/bin/bash

# Deployment script for Greener CI/CD with D1 migrations
# Use this instead of GitHub Actions for deployment

set -e

echo "🚀 Greener CI/CD Deployment with Migrations"
echo "==========================================="

# Check for required environment variables
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ Error: CLOUDFLARE_API_TOKEN environment variable is required"
    exit 1
fi

# Parse arguments
ENVIRONMENT=""
SKIP_MIGRATIONS=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --skip-migrations)
            SKIP_MIGRATIONS=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

ENV_FLAG=""
if [ -n "$ENVIRONMENT" ]; then
    ENV_FLAG="--env $ENVIRONMENT"
fi

echo "📦 Checking for D1 database..."

# Check if database exists
if wrangler d1 list | grep -q "greener-cicd-db"; then
    echo "✅ Database exists"
    DB_EXISTS=true
else
    echo "📝 Creating D1 database..."
    OUTPUT=$(wrangler d1 create greener-cicd-db)
    DB_ID=$(echo "$OUTPUT" | grep -oE 'database_id = "[^"]+"' | cut -d'"' -f2)
    
    if [ -z "$DB_ID" ]; then
        echo "❌ Failed to create database or extract ID"
        exit 1
    fi
    
    echo "✅ Database created with ID: $DB_ID"
    
    # Update wrangler.toml
    echo "📝 Updating wrangler.toml..."
    
    # Add D1 binding to wrangler.toml
    cat >> wrangler.toml << EOF

[[d1_databases]]
binding = "DB"
database_name = "greener-cicd-db"
database_id = "$DB_ID"

[env.production.d1_databases]
[[env.production.d1_databases]]
binding = "DB"
database_name = "greener-cicd-db"
database_id = "$DB_ID"
EOF
    
    echo "✅ Updated wrangler.toml"
    DB_EXISTS=false
fi

# Run migrations unless skipped
if [ "$SKIP_MIGRATIONS" = false ]; then
    echo "🔄 Running database migrations..."
    
    if [ -f "proxy/database/schema.sql" ]; then
        wrangler d1 execute greener-cicd-db $ENV_FLAG --file=proxy/database/schema.sql
        echo "✅ Migrations completed"
    else
        echo "⚠️  No migration file found at proxy/database/schema.sql"
    fi
fi

# Bundle the worker
echo "📦 Bundling worker..."

if command -v npx &> /dev/null; then
    npx esbuild proxy/worker.js \
        --bundle \
        --format=esm \
        --platform=neutral \
        --outfile=proxy/worker-bundled.js \
        --external:cloudflare:* \
        --minify
    echo "✅ Worker bundled"
else
    echo "⚠️  esbuild not available, skipping bundling"
fi

# Deploy the worker
echo "🚢 Deploying worker..."

wrangler deploy $ENV_FLAG

echo "✅ Worker deployed"

# Set secrets if provided
echo "🔐 Configuring secrets..."

set_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    
    if [ -n "$SECRET_VALUE" ]; then
        echo "$SECRET_VALUE" | wrangler secret put $SECRET_NAME $ENV_FLAG
        echo "✅ Set secret: $SECRET_NAME"
    fi
}

# Set secrets from environment variables
set_secret "GITHUB_TOKEN" "$GITHUB_TOKEN"
set_secret "APP_ID" "$APP_ID"
set_secret "CLIENT_ID" "$CLIENT_ID"
set_secret "CLIENT_SECRET" "$CLIENT_SECRET"
set_secret "WEBHOOK_SECRET" "$WEBHOOK_SECRET"
set_secret "MIGRATION_TOKEN" "$MIGRATION_TOKEN"

echo ""
echo "✨ Deployment complete!"
echo ""
echo "Next steps:"

if [ "$DB_EXISTS" = false ]; then
    echo "1. Visit your worker URL at /admin/setup to create admin account"
fi

echo "2. Check migration status at: /api/migration/status"
echo "3. View worker logs: wrangler tail $ENV_FLAG"