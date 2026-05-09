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
    speciesSortOrder: Number(row.species_sort_order ?? 999),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

function parseInfoSources(value: unknown): string[] {
  if (typeof value !== 'string') {
    return []
  }

  try {
    const parsed = JSON.parse(value) as unknown

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : []
  } catch {
    return []
  }
}

type SpeciesProfilePatch = Partial<{
  koreanName: string
  englishName: string | null
  aliases: string[]
  seasonMonths: string
  seasonNote: string
  weightNote: string
  habitatNote: string
  tasteNote: string
  buyingNote: string
  photoUrl: string
  photoSourceUrl: string
  photoAttribution: string
  photoLicense: string
  infoSources: string[]
}>

function readPatchString(
  payload: Record<string, unknown>,
  key: string,
  allowEmpty = false
): string | Response | undefined {
  if (!(key in payload)) {
    return undefined
  }

  const value = payload[key]

  if (typeof value !== 'string') {
    return json({ ok: false, error: `Invalid field: ${key}` }, 400)
  }

  const trimmed = value.trim()

  if (!allowEmpty && trimmed.length === 0) {
    return json({ ok: false, error: `Missing field: ${key}` }, 400)
  }

  return trimmed
}

function readNullablePatchString(
  payload: Record<string, unknown>,
  key: string
): string | null | Response | undefined {
  if (!(key in payload)) {
    return undefined
  }

  if (payload[key] === null) {
    return null
  }

  const value = readPatchString(payload, key, true)
  if (value instanceof Response || value === undefined) {
    return value
  }

  return value.length > 0 ? value : null
}

function readPatchStringArray(
  payload: Record<string, unknown>,
  key: string
): string[] | Response | undefined {
  if (!(key in payload)) {
    return undefined
  }

  const value = payload[key]

  if (!Array.isArray(value)) {
    return json({ ok: false, error: `Invalid field: ${key}` }, 400)
  }

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

async function parseSpeciesProfilePatch(request: Request): Promise<SpeciesProfilePatch | Response> {
  const payload = await request.json().catch(() => null)

  if (!isRecord(payload)) {
    return json({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const patch: SpeciesProfilePatch = {}
  const requiredTextFields = [
    'koreanName',
    'seasonMonths',
    'seasonNote',
    'weightNote',
    'habitatNote',
    'tasteNote',
    'buyingNote'
  ] as const

  for (const key of requiredTextFields) {
    const value = readPatchString(payload, key)
    if (value instanceof Response) {
      return value
    }
    if (value !== undefined) {
      patch[key] = value
    }
  }

  const englishName = readNullablePatchString(payload, 'englishName')
  if (englishName instanceof Response) {
    return englishName
  }
  if (englishName !== undefined) {
    patch.englishName = englishName
  }

  const emptyAllowedTextFields = [
    'photoUrl',
    'photoSourceUrl',
    'photoAttribution',
    'photoLicense'
  ] as const

  for (const key of emptyAllowedTextFields) {
    const value = readPatchString(payload, key, true)
    if (value instanceof Response) {
      return value
    }
    if (value !== undefined) {
      patch[key] = value
    }
  }

  const aliases = readPatchStringArray(payload, 'aliases')
  if (aliases instanceof Response) {
    return aliases
  }
  if (aliases !== undefined) {
    patch.aliases = aliases
  }

  const infoSources = readPatchStringArray(payload, 'infoSources')
  if (infoSources instanceof Response) {
    return infoSources
  }
  if (infoSources !== undefined) {
    patch.infoSources = infoSources
  }

  if (Object.keys(patch).length === 0) {
    return json({ ok: false, error: 'No fields to update' }, 400)
  }

  return patch
}

function mapSpeciesProfileRow(row: Record<string, unknown>) {
  return {
    canonicalName: String(row.canonical_name),
    category: String(row.category),
    koreanName: String(row.korean_name),
    scientificName: row.scientific_name === null ? null : String(row.scientific_name),
    englishName: row.english_name === null ? null : String(row.english_name),
    aliases: String(row.aliases)
      .split(',')
      .map((alias) => alias.trim())
      .filter(Boolean),
    seasonMonths: String(row.season_months),
    seasonNote: String(row.season_note),
    weightNote: String(row.market_weight_note),
    habitatNote: String(row.habitat_note),
    tasteNote: String(row.taste_note),
    buyingNote: String(row.buying_note),
    photoUrl: String(row.photo_url),
    photoSourceUrl: String(row.photo_source_url),
    photoAttribution: String(row.photo_attribution),
    photoLicense: String(row.photo_license),
    infoSources: parseInfoSources(row.info_sources),
    sortOrder: Number(row.sort_order)
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
              i.best_condition_flag, i.lowest_price_flag, i.ai_recommendation_flag,
              COALESCE(o.sort_order, 999) AS species_sort_order
       FROM item_snapshots i
       JOIN sources s ON s.id = i.source_id
       LEFT JOIN species_sort_orders o ON o.canonical_name = i.canonical_name
       WHERE i.market_date = ?1
       ORDER BY species_sort_order ASC, i.canonical_name ASC, i.id ASC`
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

async function getSpeciesProfiles(db: D1DatabaseBinding) {
  const result = await db
    .prepare(
      `SELECT p.canonical_name, p.category, p.korean_name, p.scientific_name, p.english_name, p.aliases,
              season_months, season_note, market_weight_note, habitat_note, taste_note, buying_note,
              photo_url, photo_source_url, photo_attribution, photo_license, info_sources,
              COALESCE(o.sort_order, p.sort_order, 999) AS sort_order
       FROM species_profiles p
       LEFT JOIN species_sort_orders o ON o.canonical_name = p.canonical_name
       WHERE p.category IN ('fish', 'salmon')
       ORDER BY COALESCE(o.sort_order, p.sort_order, 999) ASC, p.canonical_name ASC`
    )
    .all()

  return result.results.map(mapSpeciesProfileRow)
}

async function getSpeciesProfile(db: D1DatabaseBinding, canonicalName: string) {
  const normalizedName = canonicalName === '황금광어' ? '광어' : canonicalName
  const result = await db
    .prepare(
      `SELECT p.canonical_name, p.category, p.korean_name, p.scientific_name, p.english_name, p.aliases,
              season_months, season_note, market_weight_note, habitat_note, taste_note, buying_note,
              photo_url, photo_source_url, photo_attribution, photo_license, info_sources,
              COALESCE(o.sort_order, p.sort_order, 999) AS sort_order
       FROM species_profiles p
       LEFT JOIN species_sort_orders o ON o.canonical_name = ?2
       WHERE p.canonical_name = ?1
       LIMIT 1`
    )
    .bind(normalizedName, canonicalName)
    .first()

  return result ? mapSpeciesProfileRow(result) : null
}

async function updateSpeciesProfile(
  db: D1DatabaseBinding,
  canonicalName: string,
  patch: SpeciesProfilePatch
) {
  const normalizedName = canonicalName === '황금광어' ? '광어' : canonicalName
  const existingProfile = await getSpeciesProfile(db, normalizedName)

  if (!existingProfile) {
    return null
  }

  const assignments: string[] = []
  const values: Array<string | number | null> = []

  function assign(column: string, value: string | number | null | undefined) {
    if (value === undefined) {
      return
    }

    assignments.push(`${column} = ?`)
    values.push(value)
  }

  assign('korean_name', patch.koreanName)
  assign('english_name', patch.englishName)
  assign('aliases', patch.aliases?.join(', '))
  assign('season_months', patch.seasonMonths)
  assign('season_note', patch.seasonNote)
  assign('market_weight_note', patch.weightNote)
  assign('habitat_note', patch.habitatNote)
  assign('taste_note', patch.tasteNote)
  assign('buying_note', patch.buyingNote)
  assign('photo_url', patch.photoUrl)
  assign('photo_source_url', patch.photoSourceUrl)
  assign('photo_attribution', patch.photoAttribution)
  assign('photo_license', patch.photoLicense)
  assign('info_sources', patch.infoSources ? JSON.stringify(patch.infoSources) : undefined)

  assignments.push('updated_at = CURRENT_TIMESTAMP')
  values.push(normalizedName)

  await db
    .prepare(`UPDATE species_profiles SET ${assignments.join(', ')} WHERE canonical_name = ?`)
    .bind(...values)
    .run()

  return getSpeciesProfile(db, normalizedName)
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

  if (url.pathname === '/api/species-info' && request.method === 'GET') {
    return json({ ok: true, items: await getSpeciesProfiles(env.DB) })
  }

  const speciesInfoMatch = url.pathname.match(/^\/api\/species-info\/(.+)$/)
  if (speciesInfoMatch && request.method === 'GET') {
    const canonicalName = decodeURIComponent(speciesInfoMatch[1])
    const profile = await getSpeciesProfile(env.DB, canonicalName)

    return profile
      ? json({ ok: true, item: profile })
      : json({ ok: false, error: 'Species profile not found' }, 404)
  }

  const adminSpeciesInfoMatch = url.pathname.match(/^\/api\/admin\/species-info\/(.+)$/)
  if (adminSpeciesInfoMatch && request.method === 'PATCH') {
    const unauthorized = requireAdmin(request, env)
    if (unauthorized) {
      return unauthorized
    }

    const patch = await parseSpeciesProfilePatch(request)
    if (patch instanceof Response) {
      return patch
    }

    const canonicalName = decodeURIComponent(adminSpeciesInfoMatch[1])
    const profile = await updateSpeciesProfile(env.DB, canonicalName, patch)

    return profile
      ? json({ ok: true, item: profile })
      : json({ ok: false, error: 'Species profile not found' }, 404)
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
