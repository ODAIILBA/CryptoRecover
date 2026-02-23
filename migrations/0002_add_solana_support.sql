-- Add Solana support to existing tables
-- Migration: 0002_add_solana_support.sql

-- Update scans table to support SOL and 'all' wallet types
-- Note: SQLite doesn't support ALTER CHECK constraints directly
-- So we'll create a new table, copy data, drop old, and rename

-- Create new scans table with updated constraints
CREATE TABLE IF NOT EXISTS scans_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mode TEXT CHECK(mode IN ('system_api', 'custom_api', 'batch_scan')) NOT NULL,
  input_type TEXT CHECK(input_type IN ('wallet_address', 'seed_phrase', 'random_generation')) NOT NULL,
  input_value TEXT NOT NULL, -- encrypted
  wallet_type TEXT CHECK(wallet_type IN ('ETH', 'BTC', 'SOL', 'both', 'all')) NOT NULL,
  word_count INTEGER DEFAULT 12 CHECK(word_count IN (12, 24)),
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')) NOT NULL,
  custom_api_key TEXT, -- encrypted, only for mode=custom_api
  custom_api_url TEXT, -- only for mode=custom_api
  total_attempts INTEGER DEFAULT 0 NOT NULL,
  success_count INTEGER DEFAULT 0 NOT NULL,
  scan_speed REAL DEFAULT 0 NOT NULL, -- attempts per second
  estimated_time_remaining INTEGER DEFAULT 0 NOT NULL, -- seconds
  use_real_api INTEGER DEFAULT 0 CHECK(use_real_api IN (0, 1)) NOT NULL,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  started_at DATETIME,
  completed_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Copy existing data
INSERT INTO scans_new SELECT 
  id, user_id, mode, input_type, input_value, wallet_type,
  12 as word_count, -- default value for existing records
  status, custom_api_key, custom_api_url,
  total_attempts, success_count, scan_speed, estimated_time_remaining,
  0 as use_real_api, -- default to simulation for existing records
  error_message, created_at, started_at, completed_at, updated_at
FROM scans;

-- Drop old table
DROP TABLE scans;

-- Rename new table
ALTER TABLE scans_new RENAME TO scans;

-- Recreate index
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at DESC);

-- Update scan_results table to support SOL
CREATE TABLE IF NOT EXISTS scan_results_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id INTEGER NOT NULL,
  wallet_address TEXT NOT NULL, -- encrypted
  wallet_type TEXT CHECK(wallet_type IN ('ETH', 'BTC', 'SOL')) NOT NULL,
  balance TEXT, -- encrypted, stored as string for precision
  balance_usd TEXT, -- encrypted
  transaction_count INTEGER,
  last_activity DATETIME,
  encryption_iv TEXT NOT NULL, -- IV for decryption
  metadata TEXT, -- JSON with additional details
  discovered_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (scan_id) REFERENCES scans(id)
);

-- Copy existing data
INSERT INTO scan_results_new SELECT * FROM scan_results;

-- Drop old table
DROP TABLE scan_results;

-- Rename new table
ALTER TABLE scan_results_new RENAME TO scan_results;

-- Recreate index
CREATE INDEX IF NOT EXISTS idx_scan_results_scan_id ON scan_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_discovered_at ON scan_results(discovered_at DESC);

-- Add seed_phrases table to track generated seed phrases
CREATE TABLE IF NOT EXISTS seed_phrases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id INTEGER NOT NULL,
  seed_phrase TEXT NOT NULL, -- encrypted
  word_count INTEGER NOT NULL CHECK(word_count IN (12, 24)),
  has_balance INTEGER DEFAULT 0 CHECK(has_balance IN (0, 1)) NOT NULL,
  total_balance_usd TEXT DEFAULT '0',
  encryption_iv TEXT NOT NULL, -- IV for decryption
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (scan_id) REFERENCES scans(id)
);

CREATE INDEX IF NOT EXISTS idx_seed_phrases_scan_id ON seed_phrases(scan_id);
CREATE INDEX IF NOT EXISTS idx_seed_phrases_has_balance ON seed_phrases(has_balance);
