-- Ballpark local schema.
-- Facts are the shared record for Classic and a future Head-to-head mode.
-- Head-to-head can pair any two facts on `value` without a new table.
-- Questions are Classic prompts over those facts. Submissions are mode-scoped
-- so a second mode can store its own runs beside Classic.

CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT NOT NULL,
  context TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  retrieved_at TEXT NOT NULL,
  license TEXT NOT NULL,
  topic TEXT NOT NULL,
  difficulty INTEGER NOT NULL,
  verified INTEGER NOT NULL,
  vintage TEXT
);

CREATE TABLE questions (
  id TEXT PRIMARY KEY,
  prompt TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('estimate', 'compare', 'rank')),
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
  verified INTEGER NOT NULL
);

CREATE TABLE puzzles (
  slot INTEGER PRIMARY KEY,
  theme TEXT NOT NULL,
  blurb TEXT NOT NULL,
  question_ids TEXT NOT NULL
);

CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  puzzle_date TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'classic',
  question_id TEXT NOT NULL,
  guess_json TEXT NOT NULL,
  band TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (device_id, puzzle_date, mode, question_id)
);

CREATE TABLE daily_results (
  device_id TEXT NOT NULL,
  puzzle_date TEXT NOT NULL,
  mode TEXT NOT NULL,
  score INTEGER NOT NULL,
  bands TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (device_id, puzzle_date, mode)
);

CREATE TABLE rate_limits (
  bucket TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (bucket, window_start)
);

CREATE INDEX idx_submissions_crowd ON submissions (puzzle_date, mode, question_id);
CREATE INDEX idx_results_board ON daily_results (puzzle_date, mode);
