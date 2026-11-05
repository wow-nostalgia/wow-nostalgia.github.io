-- Дата й час початку рейду (календар рейдів, відкриття софтів у час
-- початку). Зберігаємо в UTC ISO, як created_at. Наявним рейдам ставимо
-- час створення - для минулих рейдів це і є фактичний день.
ALTER TABLE raids ADD COLUMN starts_at TEXT;
UPDATE raids SET starts_at = created_at WHERE starts_at IS NULL;
