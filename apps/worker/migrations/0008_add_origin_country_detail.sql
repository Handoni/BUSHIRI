ALTER TABLE item_snapshots
ADD COLUMN origin_country TEXT;

ALTER TABLE item_snapshots
ADD COLUMN origin_detail TEXT;

UPDATE item_snapshots
SET origin_country = origin
WHERE origin_country IS NULL
  AND origin IS NOT NULL;
