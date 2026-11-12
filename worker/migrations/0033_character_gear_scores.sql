-- GearScore персонажа окремо для кожного спеку (спеки - як у попередньому
-- записі, SIGNUP_CLASS_SPECS у worker/src/signup-specs.js: ДК танк/ДД,
-- друїд ведмідь/кіт, жрець Smite). У БД - десяті (65 = 6.5), як і
-- user_characters.gear_score.
--
-- user_characters.gear_score лишається тимчасовим запасним значенням для
-- персонажів без відомого класу: коли гравець обере клас, воркер заповнить
-- ним усі спеки класу й очистить колонку. Перенесення наявних значень для
-- персонажів з відомим класом - окремим одноразовим SQL (клас із логів є
-- лише в data/guild-data.json, не в БД).
CREATE TABLE IF NOT EXISTS character_gear_scores (
  discord_id TEXT NOT NULL,
  character_name TEXT NOT NULL,
  spec TEXT NOT NULL,
  gear_score INTEGER NOT NULL CHECK (gear_score BETWEEN 0 AND 99),
  PRIMARY KEY (discord_id, character_name, spec),
  FOREIGN KEY (discord_id, character_name)
    REFERENCES user_characters(discord_id, character_name) ON DELETE CASCADE
);
