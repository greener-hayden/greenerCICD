/**
 * Tests for Migration Manager
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MigrationManager, generateChecksum } from '../proxy/database/migration-manager.js';

// Mock D1 database
class MockD1Database {
  constructor() {
    this.data = {};
    this.tables = {};
  }

  prepare(sql) {
    const self = this;
    return {
      sql,
      params: [],
      bind(...args) {
        this.params = args;
        return this;
      },
      async run() {
        // Simulate CREATE TABLE
        if (sql.includes('CREATE TABLE')) {
          const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1];
          if (tableName) {
            self.tables[tableName] = self.tables[tableName] || [];
          }
          return { success: true };
        }
        
        // Simulate INSERT
        if (sql.includes('INSERT INTO schema_migrations')) {
          self.tables.schema_migrations = self.tables.schema_migrations || [];
          self.tables.schema_migrations.push({
            version: this.params[0],
            name: this.params[1],
            checksum: this.params[2],
            applied_at: new Date().toISOString()
          });
          return { success: true };
        }
        
        return { success: true };
      },
      async all() {
        // Simulate SELECT from schema_migrations
        if (sql.includes('SELECT') && sql.includes('schema_migrations')) {
          return {
            results: self.tables.schema_migrations || []
          };
        }
        return { results: [] };
      },
      async first() {
        // Simulate SELECT 1 check
        if (sql.includes('SELECT 1') && this.params[0]) {
          const exists = self.tables.schema_migrations?.some(
            m => m.version === this.params[0]
          );
          return exists ? { 1: 1 } : null;
        }
        return null;
      }
    };
  }

  async batch(statements) {
    const results = [];
    for (const stmt of statements) {
      try {
        const result = await stmt.run();
        results.push(result);
      } catch (error) {
        results.push({ error: error.message });
      }
    }
    return results;
  }
}

describe('MigrationManager', () => {
  let db;
  let manager;

  beforeEach(() => {
    db = new MockD1Database();
    manager = new MigrationManager(db);
  });

  describe('initialize', () => {
    it('should create schema_migrations table', async () => {
      await manager.initialize();
      expect(db.tables).toHaveProperty('schema_migrations');
    });
  });

  describe('register', () => {
    it('should register migrations in order', () => {
      manager.register(2, 'second', 'SQL2', 'checksum2');
      manager.register(1, 'first', 'SQL1', 'checksum1');
      
      expect(manager.migrations).toHaveLength(2);
      expect(manager.migrations[0].version).toBe(1);
      expect(manager.migrations[1].version).toBe(2);
    });
  });

  describe('isApplied', () => {
    it('should return false for unapplied migration', async () => {
      await manager.initialize();
      const applied = await manager.isApplied(1);
      expect(applied).toBe(false);
    });

    it('should return true for applied migration', async () => {
      await manager.initialize();
      db.tables.schema_migrations = [{ version: 1, name: 'test', checksum: 'abc' }];
      const applied = await manager.isApplied(1);
      expect(applied).toBe(true);
    });
  });

  describe('applyMigration', () => {
    it('should apply a valid migration', async () => {
      await manager.initialize();
      const migration = {
        version: 1,
        name: 'test_migration',
        upSql: 'CREATE TABLE test (id INT)',
        checksum: 'test123'
      };
      
      await manager.applyMigration(migration);
      
      expect(db.tables.schema_migrations).toHaveLength(1);
      expect(db.tables.schema_migrations[0].version).toBe(1);
      expect(db.tables.schema_migrations[0].name).toBe('test_migration');
    });

    it('should throw error for empty migration', async () => {
      const migration = {
        version: 1,
        name: 'empty',
        upSql: '',
        checksum: 'test'
      };
      
      await expect(manager.applyMigration(migration)).rejects.toThrow(
        'Migration 1 contains no SQL statements'
      );
    });
  });

  describe('migrate', () => {
    it('should run pending migrations', async () => {
      manager.register(1, 'first', 'CREATE TABLE t1', 'check1');
      manager.register(2, 'second', 'CREATE TABLE t2', 'check2');
      
      const result = await manager.migrate();
      
      expect(result.total).toBe(2);
      expect(result.new).toBe(2);
      expect(result.applied).toBe(2);
    });

    it('should skip already applied migrations', async () => {
      await manager.initialize();
      db.tables.schema_migrations = [
        { version: 1, name: 'first', checksum: 'check1' }
      ];
      
      manager.register(1, 'first', 'CREATE TABLE t1', 'check1');
      manager.register(2, 'second', 'CREATE TABLE t2', 'check2');
      
      const result = await manager.migrate();
      
      expect(result.total).toBe(2);
      expect(result.new).toBe(1);
      expect(result.applied).toBe(2);
    });

    it('should warn on checksum mismatch', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await manager.initialize();
      db.tables.schema_migrations = [
        { version: 1, name: 'first', checksum: 'old_checksum' }
      ];
      
      manager.register(1, 'first', 'CREATE TABLE t1', 'new_checksum');
      
      await manager.migrate();
      
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('checksum mismatch')
      );
      
      warnSpy.mockRestore();
    });
  });

  describe('getStatus', () => {
    it('should return correct status', async () => {
      await manager.initialize();
      db.tables.schema_migrations = [
        { version: 1, name: 'first', checksum: 'check1' }
      ];
      
      manager.register(1, 'first', 'CREATE TABLE t1', 'check1');
      manager.register(2, 'second', 'CREATE TABLE t2', 'check2');
      
      const status = await manager.getStatus();
      
      expect(status.applied).toBe(1);
      expect(status.pending).toBe(1);
      expect(status.latest).toBe(1);
      expect(status.migrations.pending).toHaveLength(1);
      expect(status.migrations.pending[0].version).toBe(2);
    });
  });
});

describe('generateChecksum', () => {
  it('should generate consistent checksums', async () => {
    const content = 'CREATE TABLE test (id INT)';
    const checksum1 = await generateChecksum(content);
    const checksum2 = await generateChecksum(content);
    
    expect(checksum1).toBe(checksum2);
    expect(checksum1).toHaveLength(64); // SHA-256 produces 64 hex chars
  });

  it('should generate different checksums for different content', async () => {
    const checksum1 = await generateChecksum('content1');
    const checksum2 = await generateChecksum('content2');
    
    expect(checksum1).not.toBe(checksum2);
  });
});