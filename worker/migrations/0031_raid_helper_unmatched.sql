-- Рейди Raid-Helper з гілок рейдів (worker/src/raid-helper.js:
-- RH_WEEKDAY_CHANNELS), які не вдалося автоматично створити на сайті: з назви
-- (рейду чи гілки) не зрозуміло інстанс/розмір. Показуються офіцерам у
-- календарі з кнопкою "Створити на сайті". Список перезаповнюється cron'ом.
CREATE TABLE IF NOT EXISTS rh_unmatched_events (
  event_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  channel_name TEXT,
  starts_at TEXT NOT NULL,
  seen_at TEXT NOT NULL
);

-- Рейди Raid-Helper, які офіцер відв'язав від рейду на сайті: імпорт їх
-- пропускає (інакше cron одразу створив би на сайті дубль).
CREATE TABLE IF NOT EXISTS rh_ignored_events (
  event_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
