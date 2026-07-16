-- Офіцерський бонусний софт, призначений гравцю в рейді загалом (не
-- прив'язаний до конкретного предмета) - замінює старий механізм
-- officer_bonus_weight на soft_reserves. Гравець сам розподіляє +1 на
-- один зі своїх уже обраних предметів через існуючий self-service
-- bonus_weight (той самий, що й для отримувачів weight transfer).
CREATE TABLE raid_bonus_grants (
  raid_id     TEXT NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  granted_by  TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (raid_id, player_name)
);
