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
    
    try {
      // Start transaction (D1 auto-handles transactions for batch operations)
      const statements = [];
      
      // Parse and prepare SQL statements
      const sqlStatements = migration.upSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      if (sqlStatements.length === 0) {
        throw new Error(`Migration ${migration.version} contains no SQL statements`);
      }
      
      for (const sql of sqlStatements) {
        try {
          statements.push(this.db.prepare(sql));
        } catch (err) {
          throw new Error(`Failed to prepare SQL in migration ${migration.version}: ${err.message}\nSQL: ${sql}`);
        }
      }
      
      // Record migration
      statements.push(
        this.db.prepare(
          'INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)'
        ).bind(migration.version, migration.name, migration.checksum)
      );
      
      // Execute all statements
      const results = await this.db.batch(statements);
      
      // Check for errors in results
      for (let i = 0; i < results.length; i++) {
        if (results[i].error) {
          throw new Error(`Statement ${i + 1} failed in migration ${migration.version}: ${results[i].error}`);
        }
      }
      
      console.log(`Migration ${migration.version} applied successfully`);
    } catch (error) {
      console.error(`Failed to apply migration ${migration.version}:`, error);
      throw new Error(`Migration ${migration.version} failed: ${error.message}`);
    }
  }

  /**
   * Run all pending migrations
   */
  async migrate() {
    try {
      await this.initialize();
    } catch (error) {
      throw new Error(`Failed to initialize migration table: ${error.message}`);
    }
    
    let applied;
    try {
      applied = await this.getAppliedMigrations();
    } catch (error) {
      throw new Error(`Failed to get applied migrations: ${error.message}`);
    }
    
    const appliedVersions = new Set(applied.map(m => m.version));
    
    let migrationsRun = 0;
    const errors = [];
    
    for (const migration of this.migrations) {
      if (!appliedVersions.has(migration.version)) {
        try {
          await this.applyMigration(migration);
          migrationsRun++;
        } catch (error) {
          errors.push(error.message);
          // Stop on first error to maintain migration order integrity
          break;
        }
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
    
    if (errors.length > 0) {
      throw new Error(`Migration failed: ${errors.join('; ')}`);
    }
    
    return {
      total: this.migrations.length,
      applied: applied.length + migrationsRun,
      new: migrationsRun
    };
  }

  /**
   * Get migration status
   */
  async getStatus() {
    try {
      await this.initialize();
    } catch (error) {
      throw new Error(`Failed to initialize migration table: ${error.message}`);
    }
    
    let applied;
    try {
      applied = await this.getAppliedMigrations();
    } catch (error) {
      throw new Error(`Failed to get migration status: ${error.message}`);
    }
    
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
 * Generate a secure checksum for SQL content using SHA-256
 */
export async function generateChecksum(content) {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}