-- Add total_successes and total_attempts columns to ml_state for advanced ML tracking

ALTER TABLE ml_state ADD COLUMN total_successes INTEGER DEFAULT 0;
ALTER TABLE ml_state ADD COLUMN total_attempts INTEGER DEFAULT 0;
ALTER TABLE ml_state ADD COLUMN last_updated TEXT;

-- Update existing row with current timestamp
UPDATE ml_state 
SET 
  total_successes = 0,
  total_attempts = 0,
  last_updated = datetime('now')
WHERE id = 1;
