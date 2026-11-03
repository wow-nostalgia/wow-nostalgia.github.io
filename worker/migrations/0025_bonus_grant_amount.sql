-- Офіцерський бонусний софт тепер має кількість (1-5) замість фіксованого +1.
-- Наявні гранти лишаються по 1 - поведінка для них не змінюється.
ALTER TABLE raid_bonus_grants ADD COLUMN amount INTEGER NOT NULL DEFAULT 1 CHECK (amount BETWEEN 1 AND 5);
