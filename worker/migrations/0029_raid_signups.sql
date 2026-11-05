-- Попередній запис на рейд (вкладка "Попередній запис" + календар), за
-- зразком Raid-Helper: клас + спек + персонаж + порядковий номер + статус.
--   status   - signed (основа) | late | tentative | bench | absent
--   position - порядковий номер запису (Raid-Helper position), не змінюється
--              при зміні спеку/статусу (preserve_order: true)
--   source / external_id - під майбутню синхронізацію з Raid-Helper
--              (site | discord; id запису в Raid-Helper)
-- Один запис на гравця (Discord-акаунт) у рейді.
CREATE TABLE IF NOT EXISTS raid_signups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raid_id TEXT NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  discord_id TEXT NOT NULL REFERENCES users(discord_id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  class TEXT NOT NULL,
  spec TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('signed', 'late', 'tentative', 'bench', 'absent')),
  position INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'site' CHECK (source IN ('site', 'discord')),
  external_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (raid_id, discord_id)
);

CREATE INDEX IF NOT EXISTS idx_raid_signups_raid ON raid_signups(raid_id, position);
