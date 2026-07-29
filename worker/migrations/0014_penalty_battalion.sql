-- Штрафбат: відкладені штрафи. Список гравців, яким наступного разу, коли
-- вони додадуть софт у рейді відповідного інстансу, штраф проставиться
-- автоматично (worker/src/routes/reserves.js -> applyPenaltyBattalionIfMatched).

CREATE TABLE penalty_battalion (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_name TEXT NOT NULL,
  instance TEXT NOT NULL,          -- 'ICC' | 'RS'
  roll_penalty INTEGER NOT NULL DEFAULT 0,
  soft_penalty INTEGER NOT NULL DEFAULT 0,
  reason TEXT NOT NULL DEFAULT '',
  added_by TEXT NOT NULL,          -- discord_id офіцера, що додав
  created_at TEXT NOT NULL
);
CREATE INDEX idx_penalty_battalion_lookup ON penalty_battalion(player_name, instance);
