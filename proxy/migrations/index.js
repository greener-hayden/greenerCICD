/**
 * Migration loader - registers all migrations
 */

import { MigrationManager, generateChecksum } from '../database/migration-manager.js';
import * as migration001 from './001_initial_schema.js';

/**
 * Load all migrations into the manager
 */
export function loadMigrations(db) {
  const manager = new MigrationManager(db);
  
  // Register migrations in order
  const migrations = [
    migration001
  ];
  
  for (const migration of migrations) {
    const checksum = migration.checksum || generateChecksum(migration.up);
    manager.register(
      migration.version,
      migration.name,
      migration.up,
      checksum
    );
  }
  
  return manager;
}

/**
 * Run migrations on database
 */
export async function runMigrations(db) {
  const manager = loadMigrations(db);
  const result = await manager.migrate();
  
  console.log(`Migrations complete. Applied ${result.new} new migrations.`);
  return result;
}

/**
 * Get migration status
 */
export async function getMigrationStatus(db) {
  const manager = loadMigrations(db);
  return await manager.getStatus();
}