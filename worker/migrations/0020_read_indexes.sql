-- Індекси, що зменшують rows_read у D1 (ліміт безкоштовного тарифу —
-- 5 млн прочитаних рядків на добу), передусім для snapshot сторінки рейду.
-- Те саме є в src/schema.sql, який деплой застосовує автоматично.

-- Софти рейду в порядку створення без окремого сортування.
CREATE INDEX IF NOT EXISTS idx_soft_reserves_raid_created ON soft_reserves(raid_id, created_at);

-- Основний персонаж (display_name) — підзапит у списках офіцерів/власників.
CREATE INDEX IF NOT EXISTS idx_user_characters_primary ON user_characters(discord_id, is_primary);
