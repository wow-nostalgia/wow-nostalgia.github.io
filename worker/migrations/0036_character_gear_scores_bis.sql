-- BiS (Best in Slot) спеку персонажа - альтернатива числовому GS: персонаж
-- одягнутий найкраще з можливого. Для BiS число не зберігається, тож
-- gear_score стає необов'язковим. SQLite не знімає NOT NULL з колонки -
-- таблицю перестворюємо з копіюванням даних.
CREATE TABLE character_gear_scores_new (
  discord_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  spec TEXT NOT NULL,
  gear_score INTEGER CHECK (gear_score IS NULL OR gear_score BETWEEN 0 AND 99),
  bis INTEGER NOT NULL DEFAULT 0 CHECK (bis IN (0, 1)),
  -- У спека або число, або BiS.
  CHECK ((bis = 1 AND gear_score IS NULL) OR (bis = 0 AND gear_score IS NOT NULL)),
  PRIMARY KEY (discord_id, character_name, spec),
  FOREIGN KEY (discord_id, character_name)
    REFERENCES user_characters(discord_id, character_name) ON DELETE CASCADE
);

INSERT INTO character_gear_scores_new (discord_id, character_name, spec, gear_score, bis)
SELECT discord_id, character_name, spec, gear_score, 0 FROM character_gear_scores;

DROP TABLE character_gear_scores;
ALTER TABLE character_gear_scores_new RENAME TO character_gear_scores;
