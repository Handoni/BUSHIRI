CREATE TABLE IF NOT EXISTS species_sort_orders (
  canonical_name TEXT PRIMARY KEY,
  sort_order INTEGER NOT NULL CHECK (sort_order BETWEEN 0 AND 999),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO species_sort_orders (canonical_name, sort_order) VALUES
('광어', 100),
('황금광어', 105),
('우럭', 200),
('연어', 300),
('참돔', 400),
('도미', 405),
('감성돔', 410),
('방어', 500),
('부시리', 505),
('잿방어', 510),
('농어', 600),
('숭어', 700),
('개숭어', 705),
('보리숭어', 710),
('도다리', 800),
('돌도다리', 805),
('돌돔', 850),
('줄돔', 855),
('뱅에돔', 860),
('시마아지', 880),
('점성어', 890),
('능성어', 900),
('자바리', 905),
('붉바리', 910),
('복어', 950),
('참복', 955)
ON CONFLICT(canonical_name) DO UPDATE SET
  sort_order = excluded.sort_order,
  updated_at = CURRENT_TIMESTAMP;

UPDATE species_profiles
SET sort_order = (
    SELECT species_sort_orders.sort_order
    FROM species_sort_orders
    WHERE species_sort_orders.canonical_name = species_profiles.canonical_name
  ),
  updated_at = CURRENT_TIMESTAMP
WHERE canonical_name IN (
  SELECT canonical_name
  FROM species_sort_orders
);
