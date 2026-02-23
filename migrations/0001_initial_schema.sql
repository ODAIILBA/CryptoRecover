-- Crypto Wallet Recovery - Database Schema
-- SQLite version for Cloudflare D1

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  open_id TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  last_signed_in DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Scans table - tracks wallet recovery scanning sessions
CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mode TEXT CHECK(mode IN ('system_api', 'custom_api')) NOT NULL,
  input_type TEXT CHECK(input_type IN ('wallet_address', 'seed_phrase')) NOT NULL,
  input_value TEXT NOT NULL, -- encrypted
  wallet_type TEXT CHECK(wallet_type IN ('ETH', 'BTC', 'both')) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled')) NOT NULL,
  custom_api_key TEXT, -- encrypted, only for mode=custom_api
  custom_api_url TEXT, -- only for mode=custom_api
  total_attempts INTEGER DEFAULT 0 NOT NULL,
  success_count INTEGER DEFAULT 0 NOT NULL,
  scan_speed INTEGER DEFAULT 0 NOT NULL, -- attempts per second
  estimated_time_remaining INTEGER DEFAULT 0 NOT NULL, -- seconds
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  started_at DATETIME,
  completed_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Scan results - individual wallet discoveries
CREATE TABLE IF NOT EXISTS scan_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id INTEGER NOT NULL,
  wallet_address TEXT NOT NULL, -- encrypted
  wallet_type TEXT CHECK(wallet_type IN ('ETH', 'BTC')) NOT NULL,
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

-- Seed phrase analyses - LLM-powered analysis results
CREATE TABLE IF NOT EXISTS seed_phrase_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  input_phrase TEXT NOT NULL, -- encrypted
  word_count INTEGER NOT NULL,
  missing_words INTEGER NOT NULL,
  suggestions TEXT NOT NULL, -- JSON array of suggestions
  confidence_scores TEXT NOT NULL, -- JSON object with scores
  common_mistakes TEXT, -- JSON array of detected mistakes
  user_feedback TEXT DEFAULT 'none' CHECK(user_feedback IN ('helpful', 'not_helpful', 'none')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Notifications - audit log of owner alerts
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id INTEGER,
  scan_result_id INTEGER,
  type TEXT CHECK(type IN ('wallet_found', 'scan_completed', 'scan_failed', 'high_balance')) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')) NOT NULL,
  delivery_method TEXT DEFAULT 'both' CHECK(delivery_method IN ('email', 'in_app', 'both')) NOT NULL,
  sent_at DATETIME,
  error_message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (scan_id) REFERENCES scans(id),
  FOREIGN KEY (scan_result_id) REFERENCES scan_results(id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_status ON scans(status);
CREATE INDEX IF NOT EXISTS idx_scan_results_scan_id ON scan_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_seed_phrase_analyses_user_id ON seed_phrase_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_scan_id ON notifications(scan_id);
CREATE INDEX IF NOT EXISTS idx_users_open_id ON users(open_id);
