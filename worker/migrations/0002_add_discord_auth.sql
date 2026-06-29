-- Одноразова міграція: Discord-авторизація + лідер/офіцери рейду замінюють
-- officer_token. claim_tokens перестворюється під discord_id замість
-- випадкового token (тестові дані feature-гілки, втрата прийнятна).

CREATE TABLE IF NOT EXISTS users (
  discord_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  character_name TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  discord_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_discord ON sessions(discord_id);

CREATE TABLE IF NOT EXISTS raid_officers (
  raid_id TEXT NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  added_at TEXT NOT NULL,
  PRIMARY KEY (raid_id, discord_id)
);

ALTER TABLE raids ADD COLUMN leader_discord_id TEXT;
ALTER TABLE soft_reserves ADD COLUMN discord_id TEXT;

DROP TABLE IF EXISTS claim_tokens;
CREATE TABLE claim_tokens (
  raid_id TEXT NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  discord_id TEXT NOT NULL REFERENCES users(discord_id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (raid_id, player_name)
);
