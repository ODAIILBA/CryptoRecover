-- Machine Learning State Storage
-- Migration: 0003_add_ml_state.sql

-- ML state table to store learning data
CREATE TABLE IF NOT EXISTS ml_state (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Only one row allowed
  state_data TEXT NOT NULL, -- JSON serialized ML state
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create initial empty state
INSERT OR IGNORE INTO ml_state (id, state_data)
VALUES (1, '{"wordFrequency":[],"positionPreferences":[],"wordPairs":[],"successPatterns":[],"totalSuccesses":0,"totalAttempts":0,"lastUpdated":"2026-02-23T00:00:00.000Z"}');
