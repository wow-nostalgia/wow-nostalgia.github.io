-- Шаблони штрафів і накопичувальні штрафи в рейдах.
--
-- Офіцери гільдії налаштовують шаблони (типові помилки на босах або загальні),
-- а штрафи в рейдах і Штрафбаті лише обираються з них. Застосований штраф —
-- окремий запис зі знімком причини/значення: зміна чи видалення шаблону історію
-- не переписує. Підсумок гравця в рейді — сума його записів.

CREATE TABLE penalty_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  boss TEXT,                        -- NULL — загальний штраф (не прив'язаний до боса)
  reason TEXT NOT NULL,
  penalty_type TEXT NOT NULL CHECK (penalty_type IN ('roll', 'soft')),
  value INTEGER NOT NULL,           -- roll: 5..100 кратне 5; soft: 1..3
  created_by TEXT NOT NULL,         -- discord_id офіцера
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE raid_penalty_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raid_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  template_id INTEGER,              -- NULL — без шаблону (перенесений старий штраф)
  boss TEXT,
  reason TEXT NOT NULL DEFAULT '',
  roll_penalty INTEGER NOT NULL DEFAULT 0,
  soft_penalty INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,                  -- ім'я офіцера (як actor в audit_log); NULL — перенесений
  created_at TEXT NOT NULL
);
CREATE INDEX idx_raid_penalty_entries_raid ON raid_penalty_entries(raid_id, player_name);

-- Старі штрафи (один рядок на гравця) — як записи без шаблону з наявною причиною.
INSERT INTO raid_penalty_entries (raid_id, player_name, template_id, boss, reason, roll_penalty, soft_penalty, created_by, created_at)
SELECT p.raid_id, p.player_name, NULL, NULL, COALESCE(p.reason, ''), p.roll_penalty, p.soft_penalty, NULL,
       COALESCE((SELECT r.created_at FROM raids r WHERE r.id = p.raid_id), datetime('now'))
FROM raid_penalties p
WHERE p.roll_penalty > 0 OR p.soft_penalty > 0;

-- Штрафбат теж будується з шаблонів (знімок значень — у наявних колонках).
ALTER TABLE penalty_battalion ADD COLUMN template_id INTEGER;
ALTER TABLE penalty_battalion ADD COLUMN boss TEXT;
