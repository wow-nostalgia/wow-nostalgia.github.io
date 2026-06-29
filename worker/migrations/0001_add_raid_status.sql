-- Одноразова миграція для вже існуючої БД (schema.sql перезапускається при
-- кожному деплої через CREATE TABLE IF NOT EXISTS і не підхопить нову колонку
-- в уже створеній таблиці). Застосувати вручну один раз:
--   npx wrangler d1 execute raid-manager --remote --file=./migrations/0001_add_raid_status.sql
--   npx wrangler d1 execute raid-manager --local  --file=./migrations/0001_add_raid_status.sql

ALTER TABLE raids ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
