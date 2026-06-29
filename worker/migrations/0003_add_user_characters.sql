-- Список альтів користувача замість одного users.character_name (колонка
-- лишається в таблиці, але більше не використовується — vestigial).

CREATE TABLE IF NOT EXISTS user_characters (
  discord_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (discord_id, character_name)
);
