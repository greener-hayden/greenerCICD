#!/usr/bin/env node

/**
 * Automated D1 Database Setup Script
 * Creates and configures D1 database for Greener CI/CD
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const WRANGLER_CONFIG = join(rootDir, 'wrangler.toml');
const SCHEMA_FILE = join(rootDir, 'proxy', 'database', 'schema.sql');
const DB_NAME = 'greener-cicd-db';

/**
 * Execute command and return output
 */
function exec(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: 'utf8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options
    });
    return result ? result.trim() : '';
  } catch (error) {
    if (!options.ignoreError) {
      throw error;
    }
    return null;
  }
}

/**
 * Check if wrangler is installed
 */
function checkWrangler() {
  console.log('🔍 Checking Wrangler installation...');
  const version = exec('wrangler --version', { silent: true });
  if (!version) {
    console.error('❌ Wrangler is not installed. Please run: npm install -g wrangler');
    process.exit(1);
  }
  console.log(`✅ Wrangler found: ${version}`);
}

/**
 * Create D1 database
 */
async function createDatabase() {
  console.log(`\n📦 Creating D1 database: ${DB_NAME}...`);
  
  // Check if database already exists
  const databases = exec('wrangler d1 list', { silent: true });
  if (databases && databases.includes(DB_NAME)) {
    console.log('ℹ️  Database already exists');
    
    // Extract database ID
    const lines = databases.split('\n');
    const dbLine = lines.find(line => line.includes(DB_NAME));
    if (dbLine) {
      const match = dbLine.match(/([a-f0-9-]{36})/);
      if (match) {
        return match[1];
      }
    }
    
    console.error('❌ Could not extract database ID');
    process.exit(1);
  }
  
  // Create new database
  const output = exec(`wrangler d1 create ${DB_NAME}`, { silent: true });
  
  // Extract database ID from output
  const match = output.match(/database_id\s*=\s*"([^"]+)"/);
  if (!match) {
    console.error('❌ Failed to create database or extract ID');
    console.error(output);
    process.exit(1);
  }
  
  const databaseId = match[1];
  console.log(`✅ Database created with ID: ${databaseId}`);
  return databaseId;
}

/**
 * Update wrangler.toml with database binding
 */
function updateWranglerConfig(databaseId) {
  console.log('\n📝 Updating wrangler.toml...');
  
  if (!existsSync(WRANGLER_CONFIG)) {
    console.error(`❌ wrangler.toml not found at ${WRANGLER_CONFIG}`);
    process.exit(1);
  }
  
  let config = readFileSync(WRANGLER_CONFIG, 'utf8');
  
  // Check if D1 binding already exists
  if (config.includes('[[d1_databases]]')) {
    console.log('ℹ️  D1 database binding already exists in wrangler.toml');
    
    // Update the database ID if different
    const currentIdMatch = config.match(/database_id\s*=\s*"([^"]+)"/);
    if (currentIdMatch && currentIdMatch[1] !== databaseId) {
      config = config.replace(
        /database_id\s*=\s*"[^"]+"/,
        `database_id = "${databaseId}"`
      );
      writeFileSync(WRANGLER_CONFIG, config);
      console.log('✅ Updated database ID in wrangler.toml');
    }
    return;
  }
  
  // Add D1 database binding
  const d1Binding = `
# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "${DB_NAME}"
database_id = "${databaseId}"

# Production environment D1 binding
[env.production.d1_databases]
[[env.production.d1_databases]]
binding = "DB"
database_name = "${DB_NAME}"
database_id = "${databaseId}"
`;
  
  // Add binding after the main configuration
  config += d1Binding;
  
  writeFileSync(WRANGLER_CONFIG, config);
  console.log('✅ Added D1 database binding to wrangler.toml');
}

/**
 * Run database migrations
 */
async function runMigrations(environment = '') {
  console.log('\n🔄 Running database migrations...');
  
  if (!existsSync(SCHEMA_FILE)) {
    console.error(`❌ Schema file not found at ${SCHEMA_FILE}`);
    process.exit(1);
  }
  
  const envFlag = environment ? `--env ${environment}` : '';
  
  // Execute schema
  exec(`wrangler d1 execute ${DB_NAME} ${envFlag} --file="${SCHEMA_FILE}"`, {
    cwd: rootDir
  });
  
  console.log('✅ Database migrations completed');
}

/**
 * Main setup function
 */
async function main() {
  console.log('🚀 Greener CI/CD D1 Database Setup\n');
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const environment = args.find(arg => arg.startsWith('--env='))?.split('=')[1] || '';
  const migrateOnly = args.includes('--migrate-only');
  
  try {
    checkWrangler();
    
    if (migrateOnly) {
      // Only run migrations
      await runMigrations(environment);
    } else {
      // Full setup
      const databaseId = await createDatabase();
      updateWranglerConfig(databaseId);
      await runMigrations(environment);
    }
    
    console.log('\n✨ Setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Deploy the worker: wrangler deploy');
    console.log('2. Set up admin account by visiting: /admin/setup');
    console.log('3. Configure secrets using: wrangler secret put <SECRET_NAME>');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { createDatabase, updateWranglerConfig, runMigrations };