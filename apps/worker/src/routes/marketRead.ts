import type { D1DatabaseBinding, Env } from '../env'

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function parseBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim()
}

function requireAdmin(request: Request, env?: Env): Response | null {
  const token = parseBearerToken(request)
  const adminToken = env?.ADMIN_TOKEN

  if (!token || !adminToken || token !== adminToken) {
    return json({ ok: false, error: 'Unauthorized' }, 401)
  }

  return null
}

function mapTodayRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    sourceId: Number(row.source_id),
    sourceName: String(row.vendor_name),
    marketDate: String(row.market_date),
    category: String(row.category),
    canonicalName: String(row.canonical_name),
    displayName: String(row.display_name),
    origin: row.origin === null ? null : String(row.origin),
    originCountry: row.origin_country == null ? null : String(row.origin_country),
    originDetail: row.origin_detail == null ? null : String(row.origin_detail),
    productionType: row.production_type === null ? null : String(row.production_type),
    freshnessState: row.freshness_state === null ? null : String(row.freshness_state),
    grade: row.grade === null ? null : String(row.grade),
    sizeMinKg: row.size_min_kg === null ? null : Number(row.size_min_kg),
    sizeMaxKg: row.size_max_kg === null ? null : Number(row.size_max_kg),
    unit: row.unit === null ? null : String(row.unit),
    pricePerKg: row.price_per_kg === null ? null : Number(row.price_per_kg),
    priceText: row.price_text === null ? null : String(row.price_text),
    soldOut: Boolean(row.sold_out),
    eventFlag: Boolean(row.event_flag),
    halfAvailable: Boolean(row.half_available),
    packingNote: row.packing_note === null ? null : String(row.packing_note),
    notes: row.notes === null ? null : String(row.notes),
    bestCondition: Boolean(row.best_condition_flag),
    lowestPrice: Boolean(row.lowest_price_flag),
    aiRecommended: Boolean(row.ai_recommendation_flag)
  }
}

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function trendCompareKey(row: Record<string, unknown>): string {
  const vendor = textValue(row.vendor_name) ?? '판매처 미상'
  const origin = textValue(row.origin) ?? '원산지 미상'

  return `${vendor}|${origin}`
}

function mapSpeciesRow(row: Record<string, unknown>) {
  return {
    marketDate: String(row.market_date),
    sourceId: Number(row.source_id),
    sourceName: String(row.vendor_name),
    canonicalName: String(row.canonical_name),
    displayName: String(row.display_name),
    compareKey: trendCompareKey(row),
    pricePerKg: row.price_per_kg === null ? null : Number(row.price_per_kg),
    priceText: row.price_text === null ? null : String(row.price_text),
    origin: row.origin === null ? null : String(row.origin),
    originCountry: row.origin_country == null ? null : String(row.origin_country),
    originDetail: row.origin_detail == null ? null : String(row.origin_detail),
    productionType: row.production_type === null ? null : String(row.production_type),
    freshnessState: row.freshness_state === null ? null : String(row.freshness_state),
    grade: row.grade === null ? null : String(row.grade),
    sizeMinKg: row.size_min_kg === null ? null : Number(row.size_min_kg),
    sizeMaxKg: row.size_max_kg === null ? null : Number(row.size_max_kg),
    notes: row.notes === null ? null : String(row.notes)
  }
}

function mapInsightRow(row: Record<string, unknown>) {
  return {
    insightType: String(row.insight_type),
    severity: String(row.severity),
    canonicalName: row.canonical_name === null ? null : String(row.canonical_name),
    title: String(row.title),
    body: String(row.body)
  }
}

function mapRawPostRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    sourceId: Number(row.source_id),
    sourceName: String(row.vendor_name),
    postKey: row.post_key === null ? null : String(row.post_key),
    postedAt: row.posted_at === null ? null : String(row.posted_at),
    revisionNo: Number(row.revision_no),
    title: row.title === null ? null : String(row.title),
    rawContentMasked: String(row.raw_content_masked),
    parseStatus: String(row.parse_status),
    parseError: row.parse_error === null ? null : String(row.parse_error)
  }
}

async function getMarketToday(db: D1DatabaseBinding, date: string) {
  const result = await db
    .prepare(
      `SELECT i.id, i.source_id, s.vendor_name, i.market_date, i.category, i.canonical_name, i.display_name, i.origin,
              i.origin_country, i.origin_detail, i.production_type, i.freshness_state, i.grade, i.size_min_kg, i.size_max_kg, i.unit, i.price_per_kg,
              i.price_text, i.sold_out, i.event_flag, i.half_available, i.packing_note, i.notes,
              i.best_condition_flag, i.lowest_price_flag, i.ai_recommendation_flag
       FROM item_snapshots i
       JOIN sources s ON s.id = i.source_id
       WHERE i.market_date = ?1
       ORDER BY i.id ASC`
    )
    .bind(date)
    .all()

  return result.results.map(mapTodayRow)
}

async function getSpeciesHistory(db: D1DatabaseBinding, canonicalName: string, days: number) {
  const safeDays = Number.isFinite(days) ? Math.min(Math.max(Math.trunc(days), 1), 180) : 30
  const dateWindow = `-${safeDays - 1} days`
  const result = await db
    .prepare(
      `SELECT i.market_date, i.source_id, s.vendor_name, i.canonical_name,
              i.display_name, i.price_per_kg, i.price_text, i.origin, i.origin_country, i.origin_detail, i.production_type,
              i.freshness_state, i.grade, i.size_min_kg, i.size_max_kg, i.notes
       FROM item_snapshots i
       JOIN sources s ON s.id = i.source_id
       WHERE i.canonical_name = ?1
         AND i.market_date >= date(
           (SELECT MAX(recent.market_date) FROM item_snapshots recent WHERE recent.canonical_name = ?1),
           ?2
         )
       ORDER BY i.market_date ASC, s.vendor_name ASC, i.price_per_kg ASC
       LIMIT 1000`
    )
    .bind(canonicalName, dateWindow)
    .all()

  return result.results.map(mapSpeciesRow)
}

async function getInsights(db: D1DatabaseBinding, date: string) {
  const result = await db
    .prepare(
      `SELECT insight_type, severity, canonical_name, title, body
       FROM insights
       WHERE market_date = ?1
       ORDER BY created_at DESC`
    )
    .bind(date)
    .all()

  return result.results.map(mapInsightRow)
}

async function getRawPosts(db: D1DatabaseBinding) {
  const result = await db
    .prepare(
      `SELECT r.id, r.source_id, s.vendor_name, r.post_key, r.posted_at, r.revision_no, r.title, r.raw_content_masked, r.parse_status, r.parse_error
       FROM raw_posts r
       JOIN sources s ON s.id = r.source_id
       ORDER BY r.id DESC`
    )
    .all()

  return result.results.map(mapRawPostRow)
}

export async function handleMarketReadRequest(request: Request, env: Env | undefined, url: URL): Promise<Response> {
  if (!env?.DB) {
    return json({ ok: false, error: 'Database binding missing' }, 500)
  }

  if (url.pathname === '/api/market/today' && request.method === 'GET') {
    const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
    return json({ ok: true, items: await getMarketToday(env.DB, date) })
  }

  const speciesMatch = url.pathname.match(/^\/api\/market\/species\/(.+)$/)
  if (speciesMatch && request.method === 'GET') {
    const canonicalName = decodeURIComponent(speciesMatch[1])
    const days = Number(url.searchParams.get('days') ?? '30')
    return json({ ok: true, items: await getSpeciesHistory(env.DB, canonicalName, days) })
  }

  if (url.pathname === '/api/insights' && request.method === 'GET') {
    const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10)
    return json({ ok: true, insights: await getInsights(env.DB, date) })
  }

  if (url.pathname === '/api/admin/raw-posts' && request.method === 'GET') {
    const unauthorized = requireAdmin(request, env)
    if (unauthorized) {
      return unauthorized
    }

    return json({ ok: true, rawPosts: await getRawPosts(env.DB) })
  }

  return json({ ok: false, error: 'Not Found' }, 404)
}
