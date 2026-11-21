-- Metric groups facts Head-to-head is allowed to compare.
ALTER TABLE facts ADD COLUMN metric TEXT NOT NULL DEFAULT '';

-- One scored run per device per UTC day, plus optional practice attempts.
CREATE TABLE h2h_runs (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  puzzle_date TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('scored', 'practice')),
  attempt INTEGER NOT NULL,
  next_index INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  finished INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (device_id, puzzle_date, kind, attempt)
);

CREATE INDEX idx_h2h_device_day ON h2h_runs (device_id, puzzle_date, kind);
