-- Звукові сповіщення на сторінці рейду (передача ваги, бонусний грант).
-- Увімкнено за замовчуванням; вимикається чекбоксом у профілі.
ALTER TABLE users ADD COLUMN sound_notifications INTEGER NOT NULL DEFAULT 1;
