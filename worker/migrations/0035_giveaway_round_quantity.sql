-- Приз із кількістю (напр. 5 Fish Feast) розігрується одним раундом:
-- переможець отримує всю пачку.
ALTER TABLE raid_giveaway_rounds ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1;

-- Керує розіграшем лише офіцер, що його почав (created_by - лише нік).
ALTER TABLE raid_giveaways ADD COLUMN created_by_discord_id TEXT;
