-- Розіграш призів у рейді: офіцер запускає, гравці, що пройшли умови,
-- кидають рол 1-100 (кидає сервер), кожен приз - окремий раунд.
--
-- Раунди переходять "ліниво": окремого таймера немає - раунд закривається
-- першим запитом після ends_at (воркер визначає переможця й стартує
-- наступний). Тому всі зміни стану - умовні UPDATE ... WHERE status = ?.

CREATE TABLE IF NOT EXISTS raid_giveaways (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raid_id TEXT NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'finished', 'cancelled')),
  -- Умови участі: JSON { signup, gearScore, softs, noPenalties } (boolean).
  criteria TEXT NOT NULL,
  round_seconds INTEGER NOT NULL,
  created_by TEXT NOT NULL,          -- ім'я офіцера (як actor в audit_log)
  created_at TEXT NOT NULL,
  finished_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_raid_giveaways_raid ON raid_giveaways(raid_id, id);

CREATE TABLE IF NOT EXISTS raid_giveaway_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  giveaway_id INTEGER NOT NULL REFERENCES raid_giveaways(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,         -- порядок раундів
  item_id INTEGER,                   -- приз-предмет (каталог giveaway-prizes.js)
  gold INTEGER,                      -- приз-золото (сума); рівно одне з двох
  -- Розіграш наосліп: гравці бачать приз лише коли раунд зіграно.
  hidden INTEGER NOT NULL DEFAULT 0,
  -- pending - чекає; active - йде рол; done - є переможець; void - ніхто не
  -- кинув; rerolled - офіцер перекинув (новий раунд з тим самим призом).
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'done', 'void', 'rerolled')),
  starts_at TEXT,
  ends_at TEXT,
  winner_discord_id TEXT,
  winner_name TEXT,
  winner_roll INTEGER,
  delivered INTEGER NOT NULL DEFAULT 0,
  -- Для перекинутого раунду: попередній переможець не бере участі.
  excluded_discord_id TEXT,
  CHECK ((item_id IS NULL) <> (gold IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_raid_giveaway_rounds_giveaway ON raid_giveaway_rounds(giveaway_id, position);

CREATE TABLE IF NOT EXISTS raid_giveaway_rolls (
  round_id INTEGER NOT NULL REFERENCES raid_giveaway_rounds(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL,
  player_name TEXT NOT NULL,         -- як показувати (основний персонаж / нік)
  roll INTEGER NOT NULL CHECK (roll BETWEEN 1 AND 100),
  -- Перекидання при нічиї на першому місці (як прихований рол у WoW).
  tie_roll INTEGER,
  created_at TEXT NOT NULL,
  PRIMARY KEY (round_id, discord_id)
);
