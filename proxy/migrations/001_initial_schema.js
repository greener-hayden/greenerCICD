/**
 * Initial schema migration
 */

export const version = 1;
export const name = 'initial_schema';

export const up = `
-- Admin table (single admin user)
CREATE TABLE IF NOT EXISTS admin (
  id TEXT PRIMARY KEY DEFAULT '1',
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  iterations INTEGER DEFAULT 100000,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Access links table
CREATE TABLE IF NOT EXISTS access_links (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  token TEXT UNIQUE NOT NULL,
  name TEXT,
  repositories TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  max_uses INTEGER DEFAULT NULL,
  uses INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_by TEXT DEFAULT 'admin'
);

-- User sessions
CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  access_link_id TEXT NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  FOREIGN KEY (access_link_id) REFERENCES access_links(id) ON DELETE CASCADE
);

-- Admin sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  token TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  ip_address TEXT,
  user_agent TEXT
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_type TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  details TEXT,
  ip_address TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_access_links_token ON access_links(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_access_links_active ON access_links(active);
`;

export const checksum = null; // Will be auto-generated