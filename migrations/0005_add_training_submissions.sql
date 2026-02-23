-- Manual Training Submissions Storage
-- Migration: 0005_add_training_submissions.sql

-- Training submissions table
CREATE TABLE IF NOT EXISTS training_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seed_phrase TEXT NOT NULL, -- encrypted
  word_count INTEGER NOT NULL CHECK(word_count IN (12, 24)),
  wallet_type TEXT CHECK(wallet_type IN ('ETH', 'BTC', 'SOL', 'unknown')),
  has_balance INTEGER DEFAULT 0 CHECK(has_balance IN (0, 1)) NOT NULL,
  balance_usd REAL DEFAULT 0,
  notes TEXT,
  validation_data TEXT, -- JSON with validation results
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_training_submissions_created_at ON training_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_training_submissions_has_balance ON training_submissions(has_balance);
CREATE INDEX IF NOT EXISTS idx_training_submissions_word_count ON training_submissions(word_count);
