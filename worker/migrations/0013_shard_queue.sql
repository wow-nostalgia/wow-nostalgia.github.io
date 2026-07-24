-- Черга на уламки і кров: гільдійна, наскрізна (не прив'язана до raid_id).

CREATE TABLE shard_queue_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_shard_queue_days_active ON shard_queue_days(is_active, sort_order);

-- сід: три поточні дні гільдії, щоб фіча не стартувала з порожнього списку
INSERT INTO shard_queue_days (label, sort_order, is_active, created_at, updated_at) VALUES
  ('Середа', 1, 1, datetime('now'), datetime('now')),
  ('Субота', 2, 1, datetime('now'), datetime('now')),
  ('Неділя', 3, 1, datetime('now'), datetime('now'));

CREATE TABLE shard_queue_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id INTEGER NOT NULL REFERENCES shard_queue_days(id) ON DELETE CASCADE,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('blood','shard')),
  player_name TEXT NOT NULL,
  priority_rank INTEGER NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (
    (resource_type = 'shard' AND progress BETWEEN 0 AND 50) OR
    (resource_type = 'blood' AND progress BETWEEN 0 AND 2)
  ),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (resource_type, player_name)
);
CREATE INDEX idx_shard_queue_day ON shard_queue_entries(day_id, resource_type, priority_rank);

CREATE TABLE shard_queue_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
