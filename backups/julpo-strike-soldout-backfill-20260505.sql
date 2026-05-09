-- Backfill 줄포상회 sold_out flags from BAND rendered <del> strikethroughs.
-- Source checked in the in-app browser on 2026-05-05.
-- Scope: existing production D1 rows for BAND 89710000 posts 6194, 6203, 6206, 6209, 6212.

-- Mark all rows whose corresponding BAND price lines are struck through.
UPDATE item_snapshots
SET
  sold_out = 1,
  best_condition_flag = 0,
  lowest_price_flag = 0,
  ai_recommendation_flag = 0
WHERE id IN (
  -- 2026-05-04 / post 6212
  188, 189, 190, 192,
  -- 2026-05-03 / post 6209
  206, 207, 208, 209, 210,
  -- 2026-05-02 / post 6206
  221, 222,
  -- 2026-05-01 / post 6203
  237, 238, 241, 243, 244, 245,
  -- 2026-04-29 / post 6194
  259, 260, 261, 262, 263, 264, 265, 266, 267
);

-- Reassign awards away from sold-out rows, by explicit review.
-- 2026-05-04 대게: only the A급 노절지 row remains available.
UPDATE item_snapshots
SET lowest_price_flag = 1
WHERE id = 191;

-- 2026-05-04 킹크랩: lowest available price after the struck 59,000 row is 64,000.
UPDATE item_snapshots
SET lowest_price_flag = 1
WHERE id = 194;

-- 2026-05-02 킹크랩: lowest available price after struck rows is the A급 브라운 57,000 row.
UPDATE item_snapshots
SET lowest_price_flag = 1
WHERE id = 225;

-- 2026-05-01 킹크랩: lowest available price after struck rows is 52,000.
UPDATE item_snapshots
SET lowest_price_flag = 1
WHERE id = 242;

-- 2026-04-29 대게: only one non-sold-out 대게 row remains, so it takes all awards.
UPDATE item_snapshots
SET best_condition_flag = 1, ai_recommendation_flag = 1
WHERE id = 258;

-- 2026-04-29 킹크랩: lowest available price after struck rows is 58,000.
UPDATE item_snapshots
SET lowest_price_flag = 1
WHERE id = 256;
