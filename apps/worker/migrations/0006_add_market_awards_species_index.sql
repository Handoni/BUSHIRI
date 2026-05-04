CREATE INDEX IF NOT EXISTS idx_item_snapshots_awards_species_date
ON item_snapshots(market_date, canonical_name, best_condition_flag, lowest_price_flag, ai_recommendation_flag);
