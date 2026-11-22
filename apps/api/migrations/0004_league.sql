-- Weekly leagues: one row per device per league week (Monday, UTC), in a group of up to 30 of the same rank.
-- `moved` records what last week did: 1 up a league, -1 down, 0 the same.

CREATE TABLE league_members (
  week TEXT NOT NULL,
  device_id TEXT NOT NULL,
  tier INTEGER NOT NULL,
  grp INTEGER NOT NULL,
  moved INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (week, device_id)
);

CREATE INDEX idx_league_group ON league_members (week, tier, grp);
CREATE INDEX idx_results_device_day ON daily_results (device_id, puzzle_date);
