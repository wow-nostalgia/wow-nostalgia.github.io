-- Гучність звукових сповіщень у відсотках (0-100). Цілим числом, а не
-- дробом 0..1, щоб не тягнути REAL заради трьох знаків.
ALTER TABLE users ADD COLUMN sound_volume INTEGER NOT NULL DEFAULT 70;
