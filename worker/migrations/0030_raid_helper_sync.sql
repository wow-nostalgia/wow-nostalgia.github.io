-- Синхронізація попереднього запису з Raid-Helper (Discord).
--   raids.rh_event_id   - ID рейду в Raid-Helper (= ID повідомлення в Discord);
--                         якщо задано, джерело правди для записів - Raid-Helper
--   raids.rh_synced_at  - час останнього вдалого підтягування записів
--   raids.rh_sync_error - текст останньої помилки (NULL - усе гаразд)
ALTER TABLE raids ADD COLUMN rh_event_id TEXT;
ALTER TABLE raids ADD COLUMN rh_synced_at TEXT;
ALTER TABLE raids ADD COLUMN rh_sync_error TEXT;

-- raid_signups перебудовується (SQLite не вміє міняти обмеження колонок):
--   - discord_id без FK на users: записи з Discord бувають від гравців, яких
--     немає на сайті;
--   - discord_name - нік у Discord з Raid-Helper (показується, поки гравець
--     не обрав персонажа на сайті);
--   - character_name / class / spec можуть бути NULL: запис з Discord без
--     персонажа; "Відсутній" у Raid-Helper не має класу й спеку.
-- Спеки ДК розділені на танк/ДД, як у шаблоні wowwotlk Raid-Helper:
-- наявні записи Blood -> танк, Frost/Unholy -> ДД.
CREATE TABLE raid_signups_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raid_id TEXT NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL,
  discord_name TEXT,
  character_name TEXT,
  class TEXT,
  spec TEXT,
  status TEXT NOT NULL CHECK (status IN ('signed', 'late', 'tentative', 'bench', 'absent')),
  position INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'site' CHECK (source IN ('site', 'discord')),
  external_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (raid_id, discord_id)
);

INSERT INTO raid_signups_new (id, raid_id, discord_id, discord_name, character_name, class, spec, status, position, source, external_id, created_at, updated_at)
SELECT id, raid_id, discord_id, NULL, character_name, class,
       CASE WHEN class = 'Death Knight' AND spec = 'Blood' THEN 'Blood (Tank)'
            WHEN class = 'Death Knight' AND spec IN ('Frost', 'Unholy') THEN spec || ' (DPS)'
            ELSE spec END,
       status, position, source, external_id, created_at, updated_at
FROM raid_signups;

DROP TABLE raid_signups;
ALTER TABLE raid_signups_new RENAME TO raid_signups;
CREATE INDEX IF NOT EXISTS idx_raid_signups_raid ON raid_signups(raid_id, position);
