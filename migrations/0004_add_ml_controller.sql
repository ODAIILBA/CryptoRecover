-- ML Controller Storage
-- Migration: 0004_add_ml_controller.sql

-- ML configuration table
CREATE TABLE IF NOT EXISTS ml_config (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Only one row allowed
  config_data TEXT NOT NULL, -- JSON serialized ML config
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- ML performance metrics table
CREATE TABLE IF NOT EXISTS ml_metrics (
  id INTEGER PRIMARY KEY CHECK (id = 1), -- Only one row allowed
  metrics_data TEXT NOT NULL, -- JSON serialized performance metrics
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Create initial default config
INSERT OR IGNORE INTO ml_config (id, config_data)
VALUES (1, '{"learningRate":0.1,"decayFactor":0.95,"minConfidence":0.1,"maxPatternAge":30,"enableFrequencyLearning":true,"enablePositionalLearning":true,"enableCorrelationLearning":true,"hybridWeights":{"frequency":0.3,"positional":0.4,"correlation":0.3},"autoSwitchThresholds":{"minSuccessesForFrequency":10,"minSuccessesForPositional":50,"minSuccessesForHybrid":100},"trackPerformance":true,"performanceWindow":100}');

-- Create initial empty metrics
INSERT OR IGNORE INTO ml_metrics (id, metrics_data)
VALUES (1, '{"strategyPerformance":[],"recentAttempts":[],"bestStrategy":"random","worstStrategy":"random","improvementRate":0,"confidence":0}');
