ALTER TABLE item_snapshots
ADD COLUMN best_condition_flag INTEGER NOT NULL DEFAULT 0;

ALTER TABLE item_snapshots
ADD COLUMN lowest_price_flag INTEGER NOT NULL DEFAULT 0;

ALTER TABLE item_snapshots
ADD COLUMN ai_recommendation_flag INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_item_snapshots_awards_market_date
ON item_snapshots(market_date, best_condition_flag, lowest_price_flag, ai_recommendation_flag);
