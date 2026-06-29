-- Рейд-менеджер: мутабельний стан (каталог предметів лишається статичним
-- data/raid-items.json на GitHub Pages, сюди не потрапляє).

CREATE TABLE IF NOT EXISTS raids (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  instance TEXT NOT NULL,               -- 'ICC' | 'RS'
  difficulty TEXT NOT NULL,             -- '10N' | '10H' | '25N' | '25H'
  soft_limit_total INTEGER NOT NULL DEFAULT 3,
  soft_limit_items INTEGER NOT NULL DEFAULT 3,
  allow_duplicate_soft INTEGER NOT NULL DEFAULT 1,
  is_locked INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'completed'
  officer_token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS soft_reserves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raid_id TEXT NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  item_id INTEGER NOT NULL,
  boss TEXT NOT NULL,
  weight INTEGER NOT NULL CHECK (weight IN (1, 2, 3)),
  is_received INTEGER NOT NULL DEFAULT 0,
  assigned_by_officer INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (raid_id, player_name, item_id)
);
CREATE INDEX IF NOT EXISTS idx_soft_reserves_raid ON soft_reserves(raid_id);
CREATE INDEX IF NOT EXISTS idx_soft_reserves_player ON soft_reserves(raid_id, player_name);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raid_id TEXT NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_log_raid ON audit_log(raid_id, created_at DESC);

CREATE TABLE IF NOT EXISTS claim_tokens (
  raid_id TEXT NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  token TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (raid_id, player_name)
);
