-- Phase 3: more to play.

-- Cruise: the daily Classic with no clock. It keeps the streak, but it is left out of the rank, the board,
-- the curve and the league. Every answer of a day carries the same flag.
ALTER TABLE submissions ADD COLUMN cruise INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_results ADD COLUMN cruise INTEGER NOT NULL DEFAULT 0;

-- Packs as journeys: each pack is a route of chapters, played in order. Chapter 1 is the pack's first five
-- questions, so answers stored before chapters existed still count. `route` names where the journey goes.
ALTER TABLE packs ADD COLUMN route TEXT NOT NULL DEFAULT '';
CREATE TABLE pack_chapters (
  pack_id TEXT NOT NULL,
  chapter INTEGER NOT NULL,
  title TEXT NOT NULL,
  blurb TEXT NOT NULL,
  question_ids TEXT NOT NULL,
  PRIMARY KEY (pack_id, chapter)
);

-- Unlimited: Ballpark+ rounds of seven questions drawn from this pool, whenever a member likes.
CREATE TABLE unlimited_pool (
  question_id TEXT PRIMARY KEY
);
CREATE TABLE unlimited_rounds (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  question_ids TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_unlimited_device ON unlimited_rounds (device_id, created_at);

-- Restore: a code that moves a Ballpark+ pass to another device. One code per pass.
CREATE TABLE restore_codes (
  code TEXT PRIMARY KEY,
  device_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  used_at TEXT
);

-- Rarity across every day a question was asked, for Unlimited.
CREATE INDEX idx_submissions_question ON submissions (question_id, mode);
