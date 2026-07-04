-- Постійний список учасників рейду (зберігається навіть після видалення всіх резервів).
-- Заповнюється при першому додаванні резерву гравцем.
CREATE TABLE IF NOT EXISTS raid_participants (
  raid_id     TEXT NOT NULL,
  player_name TEXT NOT NULL,
  joined_at   TEXT NOT NULL,
  PRIMARY KEY (raid_id, player_name)
);

-- Штрафи гравців: мінус до ролу (крок 5) та мінус до ваги софтів (крок 1).
-- Рядок з'являється лише коли офіцер вперше виставляє штраф.
CREATE TABLE IF NOT EXISTS raid_penalties (
  raid_id      TEXT    NOT NULL,
  player_name  TEXT    NOT NULL,
  roll_penalty INTEGER NOT NULL DEFAULT 0,
  soft_penalty INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (raid_id, player_name)
);
