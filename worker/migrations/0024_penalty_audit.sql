-- Історія змін Штрафбату: шаблони штрафів (створення/зміна/видалення) і
-- відкладені штрафи (додано/прибрано/застосовано в рейді). Та сама форма,
-- що shard_queue_audit_log / buff_queue_audit_log.
CREATE TABLE penalty_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_penalty_audit_created ON penalty_audit_log(created_at);
