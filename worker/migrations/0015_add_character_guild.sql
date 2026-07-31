-- Self-declared гільдія персонажа в профілі. guild_updated_at IS NULL =
-- гравець ще не чіпав поле (немає жодного впливу на ростери). guild=''
-- (з проставленим guild_updated_at) = явно обране "Без гільдії". Заявка на
-- "Nostalgia" вимагає підтвердження офіцера — guild_approved_at скидається
-- в NULL при кожному (пере)встановленні цього значення й проставляється
-- лише після officer-схвалення (див. worker/src/routes/guild.js).

ALTER TABLE user_characters ADD COLUMN guild TEXT;
ALTER TABLE user_characters ADD COLUMN guild_updated_at TEXT;
ALTER TABLE user_characters ADD COLUMN guild_approved_at TEXT;
