CREATE TABLE sources_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  vendor_type TEXT NOT NULL CHECK (vendor_type IN ('fish', 'crustacean', 'mixed')),
  band_key TEXT,
  source_mode TEXT NOT NULL CHECK (source_mode IN ('band_api', 'band_page', 'manual')),
  price_notation TEXT NOT NULL DEFAULT 'auto' CHECK (price_notation IN ('auto', 'won', 'manwon')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO sources_new (
  id,
  name,
  vendor_name,
  vendor_type,
  band_key,
  source_mode,
  price_notation,
  is_active,
  created_at,
  updated_at
)
SELECT
  id,
  name,
  vendor_name,
  vendor_type,
  band_key,
  source_mode,
  price_notation,
  is_active,
  created_at,
  updated_at
FROM sources;

CREATE TABLE raw_posts_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  run_id INTEGER,
  post_key TEXT,
  posted_at TEXT,
  collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revision_no INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  raw_content_masked TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  parse_status TEXT NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending', 'parsed', 'failed', 'skipped')),
  parse_error TEXT,
  FOREIGN KEY (source_id) REFERENCES sources_new(id),
  FOREIGN KEY (run_id) REFERENCES collection_runs(id)
);

INSERT INTO raw_posts_new (
  id,
  source_id,
  run_id,
  post_key,
  posted_at,
  collected_at,
  revision_no,
  title,
  raw_content_masked,
  content_hash,
  parse_status,
  parse_error
)
SELECT
  id,
  source_id,
  run_id,
  post_key,
  posted_at,
  collected_at,
  revision_no,
  title,
  raw_content_masked,
  content_hash,
  parse_status,
  parse_error
FROM raw_posts;

CREATE TABLE item_snapshots_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raw_post_id INTEGER NOT NULL,
  source_id INTEGER NOT NULL,
  market_date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('fish', 'crustacean', 'shellfish', 'salmon', 'other')),
  canonical_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  origin TEXT,
  production_type TEXT,
  freshness_state TEXT,
  grade TEXT,
  size_min_kg REAL,
  size_max_kg REAL,
  unit TEXT NOT NULL DEFAULT 'kg',
  price_per_kg INTEGER,
  price_text TEXT,
  sold_out INTEGER NOT NULL DEFAULT 0,
  event_flag INTEGER NOT NULL DEFAULT 0,
  half_available INTEGER NOT NULL DEFAULT 0,
  packing_note TEXT,
  notes TEXT,
  confidence REAL NOT NULL DEFAULT 0.0,
  llm_raw_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (raw_post_id) REFERENCES raw_posts_new(id),
  FOREIGN KEY (source_id) REFERENCES sources_new(id)
);

INSERT INTO item_snapshots_new (
  id,
  raw_post_id,
  source_id,
  market_date,
  category,
  canonical_name,
  display_name,
  origin,
  production_type,
  freshness_state,
  grade,
  size_min_kg,
  size_max_kg,
  unit,
  price_per_kg,
  price_text,
  sold_out,
  event_flag,
  half_available,
  packing_note,
  notes,
  confidence,
  llm_raw_json,
  created_at
)
SELECT
  id,
  raw_post_id,
  source_id,
  market_date,
  category,
  canonical_name,
  display_name,
  origin,
  production_type,
  freshness_state,
  grade,
  size_min_kg,
  size_max_kg,
  unit,
  price_per_kg,
  price_text,
  sold_out,
  event_flag,
  half_available,
  packing_note,
  notes,
  confidence,
  llm_raw_json,
  created_at
FROM item_snapshots;

DROP TABLE item_snapshots;
DROP TABLE raw_posts;
DROP TABLE sources;

ALTER TABLE sources_new RENAME TO sources;
ALTER TABLE raw_posts_new RENAME TO raw_posts;
ALTER TABLE item_snapshots_new RENAME TO item_snapshots;

CREATE UNIQUE INDEX idx_sources_band_key ON sources(band_key);

CREATE UNIQUE INDEX idx_raw_posts_source_post_revision
ON raw_posts(source_id, post_key, revision_no);

CREATE INDEX idx_raw_posts_collected_at ON raw_posts(collected_at);
CREATE INDEX idx_raw_posts_content_hash ON raw_posts(content_hash);

CREATE INDEX idx_item_snapshots_market_date ON item_snapshots(market_date);
CREATE INDEX idx_item_snapshots_name_date ON item_snapshots(canonical_name, market_date);
CREATE INDEX idx_item_snapshots_compare_key
ON item_snapshots(canonical_name, origin, production_type, freshness_state, grade, market_date);

UPDATE sources
SET
  band_key = 'page:96034341',
  source_mode = 'band_page',
  updated_at = CURRENT_TIMESTAMP
WHERE vendor_name = '참조은수산';
