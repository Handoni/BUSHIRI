CREATE TABLE sources (
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

CREATE UNIQUE INDEX idx_sources_band_key ON sources(band_key);

CREATE TABLE collection_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL CHECK (run_type IN ('scheduled', 'manual', 'test')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial_failed', 'failed')),
  message TEXT
);

CREATE TABLE raw_posts (
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
  FOREIGN KEY (source_id) REFERENCES sources(id),
  FOREIGN KEY (run_id) REFERENCES collection_runs(id)
);

CREATE UNIQUE INDEX idx_raw_posts_source_post_revision
ON raw_posts(source_id, post_key, revision_no);

CREATE INDEX idx_raw_posts_collected_at ON raw_posts(collected_at);
CREATE INDEX idx_raw_posts_content_hash ON raw_posts(content_hash);

CREATE TABLE species_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK (category IN ('fish', 'crustacean', 'shellfish', 'salmon', 'other')),
  canonical_name TEXT NOT NULL,
  alias TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_species_aliases_alias ON species_aliases(alias);

CREATE TABLE item_snapshots (
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
  FOREIGN KEY (raw_post_id) REFERENCES raw_posts(id),
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE INDEX idx_item_snapshots_market_date ON item_snapshots(market_date);
CREATE INDEX idx_item_snapshots_name_date ON item_snapshots(canonical_name, market_date);
CREATE INDEX idx_item_snapshots_compare_key
ON item_snapshots(canonical_name, origin, production_type, freshness_state, grade, market_date);

CREATE TABLE insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_date TEXT NOT NULL,
  insight_type TEXT NOT NULL CHECK (
    insight_type IN (
      'price_drop',
      'price_spike',
      'new_item',
      'sold_out',
      'restocked',
      'lowest_price',
      'vendor_gap',
      'notable'
    )
  ),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'notice', 'warning', 'critical')),
  canonical_name TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_insights_market_date ON insights(market_date);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
