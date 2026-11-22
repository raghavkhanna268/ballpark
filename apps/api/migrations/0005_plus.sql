-- Ballpark+: themed packs, and a pass tied to a device.
-- Pack answers are ordinary submissions with mode 'pack' and puzzle_date 'pack:<id>'.
-- They never reach daily_results, so a pass cannot buy league points.

CREATE TABLE packs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL,
  blurb TEXT NOT NULL,
  question_ids TEXT NOT NULL,
  sort INTEGER NOT NULL
);

-- One row per device with a pass. A lapsed pass is a past expires_at, not a deleted row.
CREATE TABLE entitlements (
  device_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL CHECK (plan IN ('month', 'year')),
  source TEXT NOT NULL CHECK (source IN ('razorpay', 'test')),
  payment_id TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Orders this server created with Razorpay. A payment counts only for an order here, from the device that made it.
CREATE TABLE plus_orders (
  order_id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('month', 'year')),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('created', 'paid')),
  payment_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  paid_at TEXT
);

CREATE INDEX idx_plus_orders_device ON plus_orders (device_id);
CREATE INDEX idx_submissions_device ON submissions (device_id, puzzle_date, mode);
