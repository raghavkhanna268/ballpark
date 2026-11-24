-- Phase 2: the daily habit.

-- Afterburner: once a day, one Classic stage scores double. Nudged: the player asked for a nudge first,
-- so that stage scores at most a Moonshot. Both are kept on the answer so the nightly recount applies them again.
ALTER TABLE submissions ADD COLUMN boost INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN nudged INTEGER NOT NULL DEFAULT 0;

-- The rocket paint job a player flew today, for the Today board.
ALTER TABLE daily_results ADD COLUMN skin TEXT;

-- One line per question that points at a corner of the answers without naming one.
ALTER TABLE questions ADD COLUMN nudge TEXT;

-- Nudges a player has opened, so an answer after one is capped.
CREATE TABLE nudges (
  device_id TEXT NOT NULL,
  puzzle_date TEXT NOT NULL,
  question_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (device_id, puzzle_date, question_id)
);

-- "Should this count?": names that were not on the list, sent in for the owner to review.
CREATE TABLE answer_reports (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  puzzle_date TEXT NOT NULL,
  question_id TEXT NOT NULL,
  text TEXT NOT NULL,
  normalized TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (device_id, puzzle_date, question_id, normalized)
);

CREATE INDEX idx_reports_day ON answer_reports (puzzle_date, question_id);

-- Streak reminders: one browser push subscription per device. Only the endpoint is stored: the reminder
-- carries no message body, so no encryption keys are needed.
CREATE TABLE push_subs (
  device_id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_sent TEXT
);
