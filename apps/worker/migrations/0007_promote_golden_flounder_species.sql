UPDATE species_aliases
SET canonical_name = '황금광어'
WHERE category = 'fish'
  AND alias = '황금광어';

UPDATE item_snapshots
SET canonical_name = '황금광어'
WHERE canonical_name = '광어'
  AND (
    display_name LIKE '%황금광어%'
    OR grade = '황금'
    OR notes LIKE '%황금광어%'
  );
