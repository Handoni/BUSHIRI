---
name: todays-seafood
description: Browser-based manual BUSHIRI seafood price collection and production upload workflow for text-only BAND price posts. Use when Codex needs to collect "오늘의 수산물", daily seafood market prices, BAND fishery price posts, or a user specifies a date and asks to open BAND posts with the Browser Use plugin, treat every active source as manual browser collection regardless of source_mode, expand every "더보기", upload the full raw post to the deployed BUSHIRI Cloudflare Worker/remote D1 first, then manually parse text/prose price lines, insert item snapshots, and set market award flags. Image-only price sheets are skipped, not transcribed. Julpo Sanghoe/줄포상회 only allows crustacean and shellfish rows, and all vendors must skip assorted sashimi, mixed sets, or any product that is not a single specific organism.
---

# Today's Seafood

## Core Rule

Use the Browser Use plugin to read BAND in the actual browser. Treat every active source as a manual browser source, even if its stored `source_mode` is `band_api`, `band_page`, or another non-manual value. Do not replace this workflow with BAND Open API calls, `web.run`, search snippets, rule-based extraction, or the LLM pipeline. Open each candidate post, expand every collapsed text section, read the full visible text yourself, save the full raw text first, then manually parse and save the structured rows.

Upload to the deployed BUSHIRI production target by default:

- Worker API: `https://bushiri-api.sang1234yun.workers.dev`
- Dashboard: `https://bushiri-46o.pages.dev`
- Remote D1: `bushiri`

Do not write to the local SQLite/D1 database unless the user explicitly asks for a local-only run. For production write details, read `references/bushiri-db.md` before source lookup or any upload.

Only handle prices written as text/prose/line-separated text in the post body. Do not OCR, visually transcribe, or parse prices that exist only inside images.

Only insert single-organism products. Skip assorted sashimi, mixed sets, pairings, or any product whose sale unit is not one specific species/organism, even if the line contains some species names.

For 줄포상회, only insert `crustacean` and `shellfish` categories. Do not insert fish, salmon, or other categories from 줄포상회 pages.

If Browser Use is not available, ask the user to enable it or log in through the in-app browser. If BAND requires login, pause and let the user log in.

## Workflow

1. Resolve the target date. If the user says "today", use the current date in the user's timezone; if they gives a date, use that exact date.
2. Open the deployed BUSHIRI dashboard or production API to identify active BAND sources and their `source_id`, vendor name, vendor type, URL/key/manual target, stored source mode, and price notation. For production API and remote D1 details, read `references/bushiri-db.md`.
3. For each active BAND source, ignore the stored source mode for collection and use Browser Use to open the manual BAND target. For `page:{pageId}` or `band.us/page/...`, open the Page post list. For `band:{bandId}`, a bare BAND key, or `band.us/band/...`, open the Band post list. For sources with `source_mode = manual`, missing `band_key`, or no obvious URL/key, use the dashboard/admin notes, prior manual collection context, or the user's logged-in BAND navigation to locate the vendor page. If the manual target still cannot be discovered, pause and ask the user for that vendor's BAND URL instead of using BAND Open API.
4. Find posts whose posted date matches the target date. When date labels are relative, open the post detail and confirm the actual date before collecting.
5. Select text price posts one by one. A text price post contains seafood/fish/crustacean prices written in the body as prose, line-separated text, or a visible text table. Image-only price sheets are not price posts for this workflow.
6. Open each selected post detail URL. Click every `더보기`, `See more`, and folded text block needed to see the complete text body. Do not collect from a truncated list preview.
7. Read and transcribe the complete text body. Preserve line breaks and meaningful section headers. Preserve rendered strikethrough meaning by annotating struck text lines in the saved plain text, for example `[취소선=품절] 홍가리비 ...`; do not rely on pasted plain text alone because copy/innerText can lose strikethrough styling. If the post has only photos/images and no text price lines, save/mark it as skipped only when needed for audit, and do not parse items.
8. Save the full raw post to deployed production `raw_posts` before parsing. Use the deployed manual upload API so masking, hashing, duplicate detection, and revision numbering stay consistent.
9. Parse manually. For every eligible price line, identify the species-only name, country origin, origin detail, production type, freshness/status, size range, unit, price, sold-out/event/half flags, packing notes, and any useful grade notes. Reject ineligible vendor/category or mixed-product lines before inserting rows.
10. Insert `item_snapshots` into remote D1 for all parsed rows, then update the raw post to `parsed`. If the post is not usable, keep the raw post and update it to `skipped` with a specific `parse_error`.
11. After all rows are inserted, review every item for each `market_date + canonical_name` and set awards explicitly. Sold-out rows are still eligible for `lowest_price_flag`, `best_condition_flag`, and `ai_recommendation_flag`; do not exclude an item from awards solely because `sold_out = true`. Do not use rule-based scoring or automatic award backfill for final flags. Awards are selected by AI review, and the three awards may point to the same item for an organism.
12. Review the target-date rows and recent history yourself, then store AI-selected Discord highlight insights for notable `new_item`, `price_drop`, and `lowest_price` species in `insights`. These highlights must be selected by explicit AI judgment after collection, not by an unreviewed rule-only backfill.
13. When the day's collection, parsing, awards, and Discord highlight insights are complete, confirm that a Discord alert channel is configured in D1. The channel is set from Discord with `/채널 설정`, not from a Worker channel-id environment variable.
14. Call the deployed admin endpoint `POST /api/admin/discord/daily-summary` with only the target `marketDate` so the Worker sends or updates the Discord alert message in the configured DB-backed channel.
15. Verify by checking the deployed raw-post review page, deployed market board, and Discord alert message for the target date.

## Reading Requirements

Always open the detail URL. Never rely on the list page excerpt.

Always expand all text before saving raw text. A post is not fully read until every visible `더보기` control for the text body has been opened.

Ignore image-only prices. Do not open image viewers for OCR or manual price transcription unless the user explicitly changes this rule in the prompt.

For Page posts such as `https://www.band.us/page/{pageId}/post/{postId}`, public HTML may contain only a truncated title or preview. Treat the browser's logged-in rendered page as the source of truth.

For 줄포상회, rendered strikethrough means sold out. Keep the current browser/manual workflow, but capture this style signal from the logged-in rendered detail page before upload. If using DOM extraction, inspect visible text nodes after every `더보기` is expanded and mark nodes whose own or ancestor computed `text-decoration-line` includes `line-through`, or whose ancestor tag is `s`, `del`, or `strike`. Save the raw post as annotated plain text, not raw HTML, so the existing manual upload, masking, duplicate detection, and review UI continue to work. If DOM extraction is not available, manually prefix each visibly struck price line with `[취소선=품절]`.

## Manual Parsing Rules

Keep species names clean. Move country origin, origin detail, production type, freshness, size, and condition words into fields.

Examples:

- `일본산 가리비` becomes `canonical_name/display_name = 가리비`, `origin = 일본산`, `origin_country = 일본산`, `origin_detail = null`.
- `자연산 감성돔` becomes `canonical_name/display_name = 감성돔`, `origin_country = 국내산` when stated or inferable, `origin_detail = 자연산`, `production_type = 자연산`.
- `제주산 양식 광어` becomes `canonical_name/display_name = 광어`, `origin = 국내산`, `origin_country = 국내산`, `origin_detail = 제주산`, `production_type = 양식`.
- `국내산 낚시바리 자연산 광어` becomes `canonical_name/display_name = 광어`, `origin = 국내산`, `origin_country = 국내산`, `origin_detail = 낚시바리`, `production_type = 자연산`.
- `활 광어 1.3~1.5kg` becomes species `광어`, `freshness_state = 활어`, `size_min_kg = 1.3`, `size_max_kg = 1.5`.

Use these field buckets:

- Compatibility origin: keep existing `origin` as the country-level value.
- Country origin: store `origin_country` as `국내산`, `일본산`, `중국산`, `노르웨이`, `러시아`, or the explicit country shown.
- Origin detail: store exactly one `origin_detail` using priority `낚시바리 > 자연산 > 지역산 > 양식`. Use values such as `낚시바리`, `자연산`, `제주산`, `통영산`, `완도산`, or `양식`. Leave it null when only a country is known.
- Production type: `자연산`, `양식`.
- Freshness/status: `활어`, `선어`, `찍어바리`, `꼬물이`.
- Grade/descriptor: `A급`, `상급`, `상태최강`, `땅크`, `예약판매`, similar seller terms. Treat `낚시바리` as `origin_detail` first; duplicate it in `grade` only when the seller clearly uses it as an additional grade/descriptor.
- Flags: `sold_out`, `event_flag`, `half_available`. For 줄포상회, `[취소선=품절]` or visible strikethrough on a price line always sets `sold_out = true`.

Award quality depends heavily on structured fields. Capture `국내산` in `origin` and `origin_country`, `활어` in `freshness_state`, and `자연산` in `production_type` and/or `origin_detail` whenever the post states them; these are primary `최상품` signals for the AI reviewer before weaker seller descriptor words such as `최상급` or `A급`.

When the same vendor has the same species under different sizes, origins, grades, or statuses, insert separate rows that share the same canonical species name and differ in those fields.

Reject non-single-organism products. Do not insert rows for `모둠회`, `모듬회`, `세꼬시모둠`, mixed sashimi boxes, bundle products, or lines such as `무늬오징어x광어` where the sold item is a mixed set rather than one organism.

Apply vendor category restrictions before inserting:

- 줄포상회: allow only `crustacean` and `shellfish` rows.
- 줄포상회: skip `fish`, `salmon`, and `other` rows even when the line has a clear species name.

## Skip Reasons

Do not silently drop any collected post. If it was opened and read but not parsed into items, mark it `skipped` and write a short reason.

Preferred reasons:

- `manual: not a price post`
- `manual: image-only price post ignored; text-only prices only`
- `manual: vendor category not allowed`
- `manual: mixed or non-specific product skipped`
- `manual: older than target date`
- `manual: duplicate post already captured`
- `manual: sold-out notice only`

## Final Verification

Before reporting completion, verify:

- The raw post exists in `raw_posts` with full masked content and the correct source.
- The raw post status is `parsed` or `skipped`; skipped posts include `parse_error`.
- Parsed rows exist in `item_snapshots` for the target date.
- For each `market_date + canonical_name` with eligible items, including sold-out items, exactly one `best_condition_flag`, one `lowest_price_flag` when a price exists, and one `ai_recommendation_flag` is set; overlapping awards are allowed.
- `best_condition_flag`, `lowest_price_flag`, and `ai_recommendation_flag` were set by explicit AI review, not by a rule-based scoring backfill.
- `best_condition_flag` favors `국내산`, `활어`, and `자연산` as the strongest quality signals during review.
- AI-selected Discord highlight rows exist in `insights` for meaningful `new_item`, `price_drop`, and `lowest_price` candidates after comparing the target date against recent data.
- A Discord alert channel exists in `discord_alert_channels`; if not, run `/채널 설정` in the intended Discord alert room before sending the summary.
- The deployed `POST /api/admin/discord/daily-summary` endpoint has been called with the target `marketDate`, and the Discord alert message exists or was updated for that date in the DB-configured channel.
- The Discord alert message includes the selected highlights, watched-species summary when watched species are present that day, and a watch select menu for the candidate species. Test the select menu only if Discord credentials and channel access are available.
- The review page shows the raw post and skip reason if applicable.
- The market board groups rows by `canonical_name + origin_country + origin_detail`. It shows `품목명` or `품목명` line break `(origin_detail)`; when only a country exists, it shows the species name only. The board offers section filtering for `회`/`갑각류`, a single-select country dropdown with flags, and sold-out filtering in the query conditions area.
- The market board shows weight to the right of the price and never as a tag. When `half_available` is true, it shows `(반반)` to the right of the weight and never as a tag. Award cards show right-top badges labeled `AI추천`, `최저가`, and `최상품`; multiple awards can appear side by side on one card. Card backgrounds use light gold, light blue, and light green treatments, blending the colors with gradients when multiple awards overlap.
