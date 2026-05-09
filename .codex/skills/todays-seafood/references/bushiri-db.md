# BUSHIRI DB Reference

Load this reference when the workflow reaches source lookup, raw post insertion, item snapshot insertion, or verification.

## Production Target

Default deployed targets:

```bash
export BUSHIRI_API_BASE_URL="${BUSHIRI_API_BASE_URL:-https://bushiri-api.sang1234yun.workers.dev}"
export BUSHIRI_WEB_URL="${BUSHIRI_WEB_URL:-https://bushiri-46o.pages.dev}"
```

Use production by default. Do not write to local SQLite/D1 unless the user explicitly asks for a local-only collection.

Production admin API writes require an admin bearer token configured on the deployed Worker and supplied locally as:

```bash
export BUSHIRI_ADMIN_TOKEN="..."
```

If `BUSHIRI_ADMIN_TOKEN` is not already exported, first try the local Codex secret loader:

```bash
test -f "$HOME/.codex/secrets/bushiri.env" && . "$HOME/.codex/secrets/bushiri.env"
```

The loader must not contain the token value directly; it should retrieve it from a local secret store such as macOS Keychain.

If `BUSHIRI_ADMIN_TOKEN` is absent and an admin API write is required, pause and ask the user for the token or for permission to use a remote D1-only write path where appropriate. Do not store the token in the skill or repository.

Remote D1 writes use the authenticated Wrangler session for the Cloudflare account:

```bash
cd /Users/handoni/Documents/handoni/BUSHIRI/apps/worker
pnpm exec wrangler d1 execute bushiri --remote --command "SELECT COUNT(*) AS count FROM sources;"
```

## Local Project

Default workspace:

```bash
/Users/handoni/Documents/handoni/BUSHIRI
```

Local worker:

```bash
http://127.0.0.1:8787
```

Local admin token:

```bash
dev-admin-token
```

Use these local values only for local-only runs or debugging.

Find the local D1 SQLite file:

```bash
find apps/worker/.wrangler/state/v3/d1 -name '*.sqlite' -not -name metadata.sqlite -print
```

## Source Lookup

Use source lookup only to identify active vendors, source IDs, vendor metadata, price notation, and any configured manual target. Source `source_mode` is inventory metadata, not a collection strategy. During today's seafood collection, every active source must be opened and read manually in Browser Use; do not switch to BAND Open API or automated post APIs because a source has `source_mode = 'band_api'`.

Prefer the deployed API:

```bash
curl -s "$BUSHIRI_API_BASE_URL/api/sources/status"
```

Use the admin source API when a token is available:

```bash
curl -s -H "Authorization: Bearer $BUSHIRI_ADMIN_TOKEN" \
  "$BUSHIRI_API_BASE_URL/api/admin/sources"
```

For local-only runs, use the local API when the worker is running:

```bash
curl -s -H 'Authorization: Bearer dev-admin-token' \
  http://127.0.0.1:8787/api/admin/sources
```

Or inspect remote D1 directly:

```bash
cd /Users/handoni/Documents/handoni/BUSHIRI/apps/worker
pnpm exec wrangler d1 execute bushiri --remote --command \
  "SELECT id, name, vendor_name, vendor_type, band_key, source_mode, price_notation, is_active FROM sources WHERE is_active = 1 ORDER BY id;"
```

For local-only runs, inspect SQLite directly:

```sql
SELECT id, name, vendor_name, vendor_type, band_key, source_mode, price_notation, is_active
FROM sources
WHERE is_active = 1
ORDER BY id;
```

`source_id` must match the vendor being collected. Do not reuse another vendor's source.

Manual target handling:

- `band_key` values like `page:96034341` map to `https://www.band.us/page/96034341`.
- `band_key` values like `band:{bandId}` or bare BAND keys map to a BAND post list in the logged-in browser.
- `source_mode = manual` or `band_key IS NULL` still means the source is active and must be checked manually if its BAND URL can be found from the dashboard, admin notes, previous collection context, or the user's logged-in BAND navigation.
- If a vendor's manual BAND target cannot be discovered, ask the user for that vendor's BAND URL. Do not fall back to the BAND Open API.

## Save Raw Post First

Use the deployed manual upload API. It masks sensitive text, hashes content, handles duplicates, and creates revisions.

```bash
curl -s -X POST \
  -H "Authorization: Bearer $BUSHIRI_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  "$BUSHIRI_API_BASE_URL/api/admin/manual-post" \
  --data @payload.json
```

Payload shape:

```json
{
  "sourceId": 2,
  "postKey": "page-96034341-1795",
  "postedAt": "2026-05-04T00:00:00.000+09:00",
  "title": "참조은수산 5월 4일 시세",
  "rawContent": "full post text exactly as read from the browser"
}
```

Use stable post keys:

- BAND Page post: `page-{pageId}-{postId}`
- BAND post: `band-{bandId}-{postId}`
- Unknown/manual: `manual-{vendor}-{YYYYMMDD}-{short-description}`

After upload, record `rawPost.id` from the response. Insert parsed rows against that raw post id.

## Insert Parsed Items

The deployed Worker currently has no parsed-item write API. Insert parsed items into remote D1 with reviewed SQL after the raw post has been uploaded:

```bash
cd /Users/handoni/Documents/handoni/BUSHIRI/apps/worker
pnpm exec wrangler d1 execute bushiri --remote --file /path/to/reviewed-inserts.sql
```

Use `--local` only for local-only runs.

Current schema:

```sql
INSERT INTO item_snapshots (
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
  best_condition_flag,
  lowest_price_flag,
  ai_recommendation_flag
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'kg', ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0
);
```

Rules:

- `market_date` is the requested collection date in `YYYY-MM-DD`.
- `category` is one of `fish`, `crustacean`, `shellfish`, `salmon`, `other`.
- `canonical_name` and `display_name` should be species-only names.
- Put `국내산` in `origin`, `활어` in `freshness_state`, and `자연산` in `production_type` when present; these are the strongest `best_condition_flag` signals.
- `price_per_kg` is an integer KRW value per kg when known.
- `price_text` preserves the seller's visible price text.
- `sold_out`, `event_flag`, `half_available` are `0` or `1`.
- `confidence` should usually be `0.9` for directly read text, lower for difficult image transcription.
- `llm_raw_json` should be JSON for the manually parsed item, even though no LLM was used.
- Award flags default to `0`; run award backfill after inserting every target-date batch.

If a post is parsed successfully:

```sql
UPDATE raw_posts
SET parse_status = 'parsed', parse_error = NULL
WHERE id = ?;
```

If a post is not usable:

```sql
UPDATE raw_posts
SET parse_status = 'skipped', parse_error = ?
WHERE id = ?;
```

## Apply Market Awards

After inserting or editing `item_snapshots`, review awards for the target date explicitly. Do not use a rule-based scoring backfill for final flags.

Rules:

- `best_condition_flag`, `lowest_price_flag`, and `ai_recommendation_flag` each select one eligible item per `market_date + canonical_name` when possible. Sold-out items are eligible for all three awards; do not exclude an item solely because `sold_out = 1`.
- Awards may overlap; the same item can receive multiple flags for the same organism.
- `best_condition_flag` should be chosen by AI review and should prioritize `국내산`, `활어`, and `자연산` before weaker quality descriptors.
- `lowest_price_flag` should still be verified against visible parsed prices, including null-price cases where no lowest-price flag is possible.
- `ai_recommendation_flag` should be chosen by AI review as the best practical pick, balancing quality, price, event status, sold-out status, and notes. Sold-out status may influence the judgment but is not disqualifying.
- Market board badges are labeled `AI추천`, `최저가`, and `최상품`. Multiple award badges can appear on one card side by side; card backgrounds use light gold, light blue, and light green, with blended gradients when awards overlap.
- Apply final decisions with explicit `UPDATE item_snapshots SET ... WHERE id = ...` statements or an equivalent reviewed SQL batch.
- Apply production award updates with `pnpm exec wrangler d1 execute bushiri --remote --file /path/to/reviewed-awards.sql`.

## Store Discord Highlights and Send Alert

After raw posts, parsed items, and awards are complete for the target date, explicitly review the target-date rows and recent history to choose the Discord highlights. Use only meaningful AI-reviewed `new_item`, `price_drop`, and `lowest_price` highlights. Do not send the Discord alert before these insight rows are saved.

Insert selected highlights into `insights` with reviewed SQL:

```sql
INSERT INTO insights (
  market_date,
  insight_type,
  severity,
  canonical_name,
  title,
  body,
  data_json
) VALUES (
  '2026-05-10',
  'price_drop',
  'warning',
  '광어',
  '광어 가격 하락',
  '광어: 전일 대비 의미 있게 하락, 오늘 매수 후보',
  '{"selected_by":"todays-seafood-ai","reason":"신규/하락/최저 후보 중 직접 검토"}'
);
```

Then call the deployed Discord daily summary endpoint. The endpoint accepts only the date and reads `insights`, watched species, awards, and market rows from D1:

Before sending, confirm that the Discord alert channel is configured in D1. The channel is set from Discord with `/채널 설정`, not with a Worker channel-id environment variable:

```sql
SELECT guild_id, channel_id, configured_by_discord_user_id, updated_at
FROM discord_alert_channels
WHERE id = 1;
```

```bash
curl -s -X POST \
  -H "Authorization: Bearer $BUSHIRI_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  "$BUSHIRI_API_BASE_URL/api/admin/discord/daily-summary" \
  --data "{\"marketDate\":\"$TARGET_DATE\"}"
```

The Worker uses the configured Discord bot credentials and the DB-backed alert channel to create or update the target date's message. A repeated call for the same `marketDate` edits the existing Discord message instead of posting a duplicate.

## Verification Queries

Raw post:

```sql
SELECT r.id, s.vendor_name, r.post_key, r.posted_at, r.parse_status, r.parse_error
FROM raw_posts r
JOIN sources s ON s.id = r.source_id
WHERE r.id = ?;
```

Items:

```sql
SELECT canonical_name, display_name, origin, production_type, freshness_state,
       grade, size_min_kg, size_max_kg, price_per_kg, price_text,
       sold_out, event_flag, half_available,
       best_condition_flag, lowest_price_flag, ai_recommendation_flag
FROM item_snapshots
WHERE raw_post_id = ?
ORDER BY canonical_name, price_per_kg;
```

Discord highlights:

```sql
SELECT insight_type, severity, canonical_name, title, body
FROM insights
WHERE market_date = ?
  AND insight_type IN ('new_item', 'price_drop', 'lowest_price')
ORDER BY created_at;
```

Discord message tracking:

```sql
SELECT market_date, channel_id, message_id, candidate_json, updated_at
FROM discord_daily_messages
WHERE market_date = ?;
```

Discord alert channel:

```sql
SELECT guild_id, channel_id, configured_by_discord_user_id, updated_at
FROM discord_alert_channels
WHERE id = 1;
```

Award counts:

```sql
SELECT
  canonical_name,
  SUM(best_condition_flag) AS best_condition_count,
  SUM(lowest_price_flag) AS lowest_price_count,
  SUM(ai_recommendation_flag) AS ai_recommendation_count
FROM item_snapshots
WHERE market_date = ?
  AND sold_out = 0
GROUP BY canonical_name
ORDER BY canonical_name;
```

Market board API:

```bash
curl -s "$BUSHIRI_API_BASE_URL/api/market/today?date=YYYY-MM-DD"
```

Deployed dashboard:

```bash
open "$BUSHIRI_WEB_URL"
```
