import type { D1DatabaseBinding } from '../env'
import { extractMarketText } from '../lib/textSection'
import type { MarketLlmClient } from '../clients/llmClient'
import type { ParsedMarketItem, ParsedMarketPost } from '../types/llm'
import { normalizeOriginFields } from './normalizeItems'

type RawPostForParsing = {
  id: number
  sourceId: number
  vendorName: string | null
  rawContentMasked: string
  postedAt: string | null
}

const ITEM_CATEGORIES = ['fish', 'crustacean', 'shellfish', 'salmon', 'other'] as const
const POST_CATEGORIES = ['fish', 'crustacean', 'mixed'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isCategory(value: unknown): value is ParsedMarketItem['category'] {
  return typeof value === 'string' && ITEM_CATEGORIES.includes(value as ParsedMarketItem['category'])
}

function isPostCategory(value: unknown): value is ParsedMarketPost['categoryHint'] {
  return value === null || (typeof value === 'string' && POST_CATEGORIES.includes(value as 'fish' | 'crustacean' | 'mixed'))
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value)
}

function nullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value)
}

function validateParsedItem(value: unknown): ParsedMarketItem {
  if (!isRecord(value) || !isCategory(value.category) || typeof value.displayName !== 'string' || value.unit !== 'kg' || typeof value.priceText !== 'string' || typeof value.soldOut !== 'boolean' || typeof value.eventFlag !== 'boolean' || typeof value.halfAvailable !== 'boolean' || typeof value.confidence !== 'number') {
    throw new Error('Invalid parsed market item')
  }

  return {
    category: value.category,
    canonicalName: nullableString(value.canonicalName),
    displayName: value.displayName,
    origin: nullableString(value.origin),
    originCountry: nullableString(value.originCountry),
    originDetail: nullableString(value.originDetail),
    productionType: nullableString(value.productionType),
    freshnessState: nullableString(value.freshnessState),
    grade: nullableString(value.grade),
    sizeMinKg: nullableNumber(value.sizeMinKg),
    sizeMaxKg: nullableNumber(value.sizeMaxKg),
    unit: 'kg',
    pricePerKg: nullableNumber(value.pricePerKg),
    priceText: value.priceText,
    soldOut: value.soldOut,
    eventFlag: value.eventFlag,
    halfAvailable: value.halfAvailable,
    notes: nullableString(value.notes),
    confidence: value.confidence
  }
}

export function validateParsedMarketPost(value: unknown): ParsedMarketPost {
  if (!isRecord(value) || !isPostCategory(value.categoryHint) || !Array.isArray(value.items) || !Array.isArray(value.warnings)) {
    throw new Error('Invalid parsed market post')
  }

  return {
    vendorName: nullableString(value.vendorName),
    marketDate: nullableString(value.marketDate),
    categoryHint: value.categoryHint,
    items: value.items.map(validateParsedItem),
    warnings: value.warnings.map((warning) => String(warning))
  }
}

async function markRawPost(db: D1DatabaseBinding, rawPostId: number, status: 'parsed' | 'failed', parseError: string | null): Promise<void> {
  await db
    .prepare('UPDATE raw_posts SET parse_status = ?1, parse_error = ?2 WHERE id = ?3')
    .bind(status, parseError, rawPostId)
    .run()
}

async function saveSnapshot(db: D1DatabaseBinding, rawPost: RawPostForParsing, marketDate: string, item: ParsedMarketItem): Promise<void> {
  const originFields = normalizeOriginFields(item)

  await db
    .prepare(
      `INSERT INTO item_snapshots (
         raw_post_id,
         source_id,
         market_date,
         category,
         canonical_name,
         display_name,
         origin,
         origin_country,
         origin_detail,
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
         notes,
         confidence,
         llm_raw_json
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23)`
    )
    .bind(
      rawPost.id,
      rawPost.sourceId,
      marketDate,
      item.category,
      item.canonicalName,
      item.displayName,
      originFields.origin,
      originFields.originCountry,
      originFields.originDetail,
      item.productionType,
      item.freshnessState,
      item.grade,
      item.sizeMinKg,
      item.sizeMaxKg,
      item.unit,
      item.pricePerKg,
      item.priceText,
      item.soldOut ? 1 : 0,
      item.eventFlag ? 1 : 0,
      item.halfAvailable ? 1 : 0,
      item.notes,
      item.confidence,
      JSON.stringify({
        ...item,
        origin: originFields.origin,
        originCountry: originFields.originCountry,
        originDetail: originFields.originDetail
      })
    )
    .run()
}

export async function parseRawPostAndSave(
  db: D1DatabaseBinding,
  rawPost: RawPostForParsing,
  llmClient: MarketLlmClient
): Promise<{ status: 'parsed' | 'failed'; itemsSaved: number }> {
  try {
    const marketText = extractMarketText(rawPost.rawContentMasked)
    const parsed = validateParsedMarketPost(
      await llmClient.parseMarketPost({
        vendorName: rawPost.vendorName,
        rawText: marketText
      })
    )

    const marketDate = parsed.marketDate ?? rawPost.postedAt?.slice(0, 10) ?? '1970-01-01'

    for (const item of parsed.items) {
      await saveSnapshot(db, rawPost, marketDate, item)
    }

    await markRawPost(db, rawPost.id, 'parsed', null)
    return { status: 'parsed', itemsSaved: parsed.items.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error'
    await markRawPost(db, rawPost.id, 'failed', message)
    return { status: 'failed', itemsSaved: 0 }
  }
}
