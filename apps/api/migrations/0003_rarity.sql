-- Rarity scoring: name-one answers, per-pick points, and a frozen daily total.

CREATE TABLE questions_v2 (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('estimate', 'compare', 'rank', 'name_one')),
  unit TEXT,
  polarity TEXT NOT NULL CHECK (polarity IN ('higher', 'lower')),
  scale TEXT,
  fact_ids TEXT NOT NULL,
  display_ids TEXT NOT NULL,
  context TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  license TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty INTEGER NOT NULL,
  verified INTEGER NOT NULL,
  accepted_json TEXT,
  entity_set TEXT
);

INSERT INTO questions_v2 (
  id, prompt, type, unit, polarity, scale, fact_ids, display_ids, context,
  source_url, source_name, retrieved_at, license, topic, difficulty, verified,
  accepted_json, entity_set
)
SELECT
  id, prompt, type, unit, polarity, scale, fact_ids, display_ids, context,
  source_url, source_name, retrieved_at, license, topic, difficulty, verified,
  NULL, NULL
FROM questions;

DROP TABLE questions;
ALTER TABLE questions_v2 RENAME TO questions;

ALTER TABLE daily_results ADD COLUMN points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE daily_results ADD COLUMN finalized INTEGER NOT NULL DEFAULT 0;

ALTER TABLE h2h_runs ADD COLUMN points INTEGER NOT NULL DEFAULT 0;

CREATE TABLE h2h_picks (
  device_id TEXT NOT NULL,
  puzzle_date TEXT NOT NULL,
  kind TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  step_index INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  PRIMARY KEY (device_id, puzzle_date, kind, attempt, step_index)
);

CREATE INDEX idx_h2h_picks_step ON h2h_picks (puzzle_date, kind, step_index);
