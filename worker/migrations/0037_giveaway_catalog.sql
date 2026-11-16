-- Каталог призів розіграшу, що його редагують офіцери гільдії з сайту
-- (вкладка "Призи"), поверх вбудованого (worker/src/giveaway-prizes.js).
-- removed = 0 - доданий предмет (або вбудований з іншою категорією),
-- removed = 1 - прибраний з каталогу (дані лишаються для старих раундів).
-- Назва/іконка/якість/опис - з Wowhead на момент додавання.
CREATE TABLE IF NOT EXISTS giveaway_catalog (
  item_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  quality INTEGER NOT NULL,
  category TEXT NOT NULL,
  tooltip TEXT,
  removed INTEGER NOT NULL DEFAULT 0 CHECK (removed IN (0, 1)),
  updated_by TEXT,
  updated_at TEXT NOT NULL
);
