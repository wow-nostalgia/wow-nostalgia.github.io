-- Дозволити софтити маунти на цьому рейді (вимкнено за замовчуванням)
ALTER TABLE raids ADD COLUMN allow_mount_softs INTEGER NOT NULL DEFAULT 0;
