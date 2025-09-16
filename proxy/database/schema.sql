-- Greener CI/CD Database Schema
-- For Cloudflare D1 Database

-- Admin table (single admin user)
CREATE TABLE IF NOT EXISTS admin (
  id TEXT PRIMARY KEY DEFAULT '1',
  username TEXT UNIQUE NOT NULL DEFAULT 'admin',
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Access links table for user access
CREATE TABLE IF NOT EXISTS access_links (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  token TEXT UNIQUE NOT NULL,
  name TEXT,
  repositories TEXT, -- JSON array of allowed repos
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  max_uses INTEGER DEFAULT NULL,
  uses INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_by TEXT DEFAULT 'admin'
);

-- User access sessions from links
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

-- Audit log for security tracking
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_type TEXT NOT NULL, -- 'admin' or 'user'
  user_id TEXT,
  action TEXT NOT NULL,
  resource TEXT,
  details TEXT,
  ip_address TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Migration tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  checksum TEXT
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_access_links_token ON access_links(token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_access_links_active ON access_links(active);

-- Initial migration record
INSERT INTO schema_migrations (version, name, checksum) 
VALUES (1, 'initial_schema', 'INIT')
ON CONFLICT(version) DO NOTHING;