-- Профіль -> "Мої персонажі": гравець сам відмічає, чи має персонаж цього
-- ігрового тижня КД на героїчні ЦЛК/РС (10 і 25), і вписує свій GearScore.
-- КД скидає щотижнева cron-задача (п'ятниця 04:00 за Києвом, див.
-- resetWeeklyCooldowns у worker/src/index.js).
--   cd_*        - 0/1
--   gear_score  - у десятих: 65 = "6.5"; NULL - не вказано
ALTER TABLE user_characters ADD COLUMN cd_icc10 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_characters ADD COLUMN cd_icc25 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_characters ADD COLUMN cd_rs10 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_characters ADD COLUMN cd_rs25 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_characters ADD COLUMN gear_score INTEGER CHECK (gear_score BETWEEN 0 AND 99);
