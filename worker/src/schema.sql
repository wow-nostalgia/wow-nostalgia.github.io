-- Рейд-менеджер: мутабельний стан (каталог предметів лишається статичним
-- data/raid-items.json на GitHub Pages, сюди не потрапляє).

CREATE TABLE IF NOT EXISTS users (
  discord_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  character_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_characters (
  discord_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (discord_id, character_name)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_discord ON sessions(discord_id);

CREATE TABLE IF NOT EXISTS raids (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  instance TEXT NOT NULL,               -- 'ICC' | 'RS'
  difficulty TEXT NOT NULL,             -- '10N' | '10H' | '25N' | '25H'
  soft_limit_total INTEGER NOT NULL DEFAULT 3,
  soft_limit_items INTEGER NOT NULL DEFAULT 3,    -- застаріле, ліміт прибрано
  allow_duplicate_soft INTEGER NOT NULL DEFAULT 1, -- застаріле, дублі завжди дозволені
  is_locked INTEGER NOT NULL DEFAULT 0,
  hidden_reserves INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'completed'
  officer_token TEXT NOT NULL,           -- застаріле, не використовується для авторизації
  leader_discord_id TEXT REFERENCES users(discord_id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS raid_officers (
  raid_id TEXT NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  added_at TEXT NOT NULL,
  PRIMARY KEY (raid_id, discord_id)
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
  discord_id TEXT REFERENCES users(discord_id),
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
  discord_id TEXT NOT NULL REFERENCES users(discord_id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (raid_id, player_name)
);
