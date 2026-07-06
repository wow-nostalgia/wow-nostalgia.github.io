-- Ліміт переданої ваги (NULL = не обмежено = soft_limit_total, 0 = вимкнено)
ALTER TABLE raids ADD COLUMN transfer_weight_limit INTEGER DEFAULT NULL;

-- Передача ваги між гравцями: A→B (A більше не може софтити, B отримує бонусний ліміт)
CREATE TABLE raid_weight_transfers (
  raid_id     TEXT NOT NULL REFERENCES raids(id) ON DELETE CASCADE,
  from_player TEXT NOT NULL,
  to_player   TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (raid_id, from_player)
);

-- Кожен гравець може отримати вагу лише від одного донора
CREATE UNIQUE INDEX idx_weight_transfers_to ON raid_weight_transfers (raid_id, to_player);
