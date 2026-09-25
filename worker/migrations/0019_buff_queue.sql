-- Черга на посилення (Істерія, Придання Сил, ...): гільдійна, наскрізна,
-- не прив'язана до raid_id — як і черга на уламки (0013), але черга тут
-- окрема на кожну трійку "день + бос ЦЛК + тип посилення".

CREATE TABLE buff_queue_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- За замовчуванням лише субота, решту дні офіцери додають у налаштуваннях.
INSERT INTO buff_queue_days (label, sort_order, is_active, created_at, updated_at) VALUES
  ('Субота', 1, 1, datetime('now'), datetime('now'));

-- Типи посилень налаштовують офіцери: гравці записуються на конкретний тип.
CREATE TABLE buff_queue_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO buff_queue_types (label, sort_order, is_active, created_at, updated_at) VALUES
  ('Істерія', 1, 1, datetime('now'), datetime('now')),
  ('Придання Сил', 2, 1, datetime('now'), datetime('now'));

-- Які боси ЦЛК показуються у вкладках днів. Ключ — англійська назва, та
-- сама, що в ICC_BOSSES (scripts/raid-manager-shared.js) і raid-items.json:
-- на фронті її перекладає translateBoss(). Боса не видаляють, лише
-- ховають (is_active = 0), щоб не губилась історія "Виконано".
CREATE TABLE buff_queue_bosses (
  boss TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

INSERT INTO buff_queue_bosses (boss, sort_order, is_active, updated_at) VALUES
  ('Lord Marrowgar', 1, 1, datetime('now')),
  ('Lady Deathwhisper', 2, 1, datetime('now')),
  ('Gunship Battle', 3, 1, datetime('now')),
  ('Deathbringer Saurfang', 4, 1, datetime('now')),
  ('Festergut', 5, 1, datetime('now')),
  ('Rotface', 6, 1, datetime('now')),
  ('Professor Putricide', 7, 1, datetime('now')),
  ('Blood Prince Council', 8, 1, datetime('now')),
  ('Blood-Queen Lana''thel', 9, 1, datetime('now')),
  ('Valithria Dreamwalker', 10, 1, datetime('now')),
  ('Sindragosa', 11, 1, datetime('now')),
  ('The Lich King', 12, 1, datetime('now'));

-- status:
--   waiting - "Очікує", стоїть у черзі
--   buffed  - "Посилений", прямо зараз у рейді має бути посиленим
--   done    - "Посилення виконано", переїжджає на вкладку "Виконано"
-- Переходи (контролює Worker): waiting -> buffed, buffed -> waiting (вайп
-- або помилка), buffed -> done. done остаточний.
CREATE TABLE buff_queue_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_id INTEGER NOT NULL REFERENCES buff_queue_days(id),
  boss TEXT NOT NULL REFERENCES buff_queue_bosses(boss),
  buff_type_id INTEGER NOT NULL REFERENCES buff_queue_types(id),
  player_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'buffed', 'done')),
  priority_rank INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  done_at TEXT
);

-- Гравець може бути в черзі на "бос + посилення" лише раз одночасно (на
-- будь-який день), але після виконання може записатись знову — тому
-- унікальність лише серед невиконаних записів. Частковий індекс, а не
-- UNIQUE-обмеження: історія виконаних лишається в тій самій таблиці.
CREATE UNIQUE INDEX idx_buff_queue_active_unique
  ON buff_queue_entries(player_name, boss, buff_type_id)
  WHERE status <> 'done';

CREATE INDEX idx_buff_queue_queue ON buff_queue_entries(day_id, boss, buff_type_id, status, priority_rank);

CREATE TABLE buff_queue_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
