/**
 * Migration Manager for Cloudflare D1 Database
 * Handles automatic migration detection and execution
 */

export class MigrationManager {
  constructor(db) {
    this.db = db;
    this.migrations = [];
  }

  /**
   * Register a migration
   */
  register(version, name, upSql, checksum) {
    this.migrations.push({ version, name, upSql, checksum });
    this.migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Initialize migration tracking table
   */
  async initialize() {
    const sql = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT
      )
    `;
    
    await this.db.prepare(sql).run();
  }

  /**
   * Get list of applied migrations
   */
  async getAppliedMigrations() {
    const result = await this.db
      .prepare('SELECT version, checksum FROM schema_migrations ORDER BY version')
      .all();
    
    return result.results || [];
  }

  /**
   * Check if a migration is already applied
   */
  async isApplied(version) {
    const result = await this.db
      .prepare('SELECT 1 FROM schema_migrations WHERE version = ?')
      .bind(version)
      .first();
    
    return !!result;
  }

  /**
   * Apply a single migration
   */
  async applyMigration(migration) {
    console.log(`Applying migration ${migration.version}: ${migration.name}`);
    
    // Start transaction (D1 auto-handles transactions for batch operations)
    const statements = [];
    
    // Parse and prepare SQL statements
    const sqlStatements = migration.upSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    for (const sql of sqlStatements) {
      statements.push(this.db.prepare(sql));
    }
    
    // Record migration
    statements.push(
      this.db.prepare(
        'INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)'
      ).bind(migration.version, migration.name, migration.checksum)
    );
    
    // Execute all statements
    await this.db.batch(statements);
    
    console.log(`Migration ${migration.version} applied successfully`);
  }

  /**
   * Run all pending migrations
   */
  async migrate() {
    await this.initialize();
    
    const applied = await this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map(m => m.version));
    
    let migrationsRun = 0;
    
    for (const migration of this.migrations) {
      if (!appliedVersions.has(migration.version)) {
        await this.applyMigration(migration);
        migrationsRun++;
      } else {
        // Verify checksum
        const existing = applied.find(m => m.version === migration.version);
        if (existing && existing.checksum !== migration.checksum) {
          console.warn(
            `Warning: Migration ${migration.version} checksum mismatch. ` +
            `Expected: ${migration.checksum}, Got: ${existing.checksum}`
          );
        }
      }
    }
    
    return {
      total: this.migrations.length,
      applied: applied.length,
      new: migrationsRun
    };
  }

  /**
   * Get migration status
   */
  async getStatus() {
    await this.initialize();
    
    const applied = await this.getAppliedMigrations();
    const appliedVersions = new Set(applied.map(m => m.version));
    
    const pending = this.migrations.filter(m => !appliedVersions.has(m.version));
    
    return {
      applied: applied.length,
      pending: pending.length,
      latest: applied.length > 0 ? Math.max(...applied.map(m => m.version)) : 0,
      migrations: {
        applied: applied,
        pending: pending.map(m => ({ version: m.version, name: m.name }))
      }
    };
  }
}

/**
 * Generate a simple checksum for SQL content
 */
export function generateChecksum(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}