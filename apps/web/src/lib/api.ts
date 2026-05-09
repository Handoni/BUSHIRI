type UnknownRecord = Record<string, unknown>

export type MarketRow = {
  id: string
  canonicalName: string
  species: string
  market: string
  price: number | null
  lowPrice: number | null
  highPrice: number | null
  unit: string
  currency: string
  speciesSortOrder: number
  observedAt: string | null
  source: string
  raw: unknown
}

export type TodayMarketResponse = {
  rows: MarketRow[]
  lastUpdated: string | null
}

export type InsightItem = {
  id: string
  title: string
  summary: string
  tone: string
  market: string
  species: string
  raw: unknown
}

export type SourceStatusItem = {
  id: string
  name: string
  status: string
  enabled: boolean | null
  lastSeen: string | null
  detail: string
  raw: unknown
}

export type RawPostItem = {
  id: string
  source: string
  market: string
  species: string
  excerpt: string
  fullText: string
  status: string
  parseError: string | null
  publishedAt: string | null
  url: string | null
  raw: unknown
}

export type SourceConfigItem = {
  id: string
  name: string
  market: string
  endpoint: string
  cadence: string
  enabled: boolean | null
  notes: string
  raw: unknown
}

export type SpeciesTrendPoint = {
  id: string
  label: string
  date: string | null
  value: number | null
  market: string
  currency: string
  raw: unknown
}

export type SpeciesTrendResponse = {
  canonicalName: string
  species: string
  points: SpeciesTrendPoint[]
  currency: string
}

export type SpeciesProfile = {
  canonicalName: string
  category: string
  koreanName: string
  scientificName: string | null
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
  sortOrder: number
  raw: unknown
}

export type SpeciesProfilePatch = Partial<{
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

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const LOCAL_ADMIN_BASE = '/__bushiri_admin'

function buildUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  return API_BASE ? `${API_BASE}${path}` : path
}

function buildAdminUrl(path: string) {
  if (!API_BASE && import.meta.env.DEV) {
    return `${LOCAL_ADMIN_BASE}${path}`
  }

  return buildUrl(`/api/admin${path}`)
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function unwrapPayload(value: unknown): unknown {
  if (!isRecord(value)) {
    return value
  }

  if ('data' in value) {
    return value.data
  }

  if ('result' in value) {
    return value.result
  }

  return value
}

function getCandidate(
  source: UnknownRecord,
  keys: string[],
): unknown {
  for (const key of keys) {
    if (key in source && source[key] != null) {
      return source[key]
    }
  }

  return null
}

function toStringValue(value: unknown, fallback = '—') {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}`
  }

  return fallback
}

function toBooleanValue(value: unknown) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    if (value === 'true') {
      return true
    }

    if (value === 'false') {
      return false
    }
  }

  if (typeof value === 'number') {
    return value === 1 ? true : value === 0 ? false : null
  }

  return null
}

function toNumberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const normalized = Number(value.replace(/[^0-9.-]/g, ''))

    if (Number.isFinite(normalized)) {
      return normalized
    }
  }

  return null
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => toStringValue(item, '').trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    const text = value.trim()

    if (!text) {
      return []
    }

    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text) as unknown

        if (Array.isArray(parsed)) {
          return parsed
            .map((item) => toStringValue(item, '').trim())
            .filter(Boolean)
        }
      } catch {
        return []
      }
    }

    return text
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  return []
}

function translateVendorType(value: string) {
  switch (value) {
    case 'fish':
      return '생선'
    case 'crustacean':
      return '갑각류'
    case 'mixed':
      return '혼합'
    default:
      return value
  }
}

function translateSourceMode(value: string) {
  switch (value) {
    case 'band_api':
      return '밴드 API'
    case 'band_page':
      return '밴드 Page'
    case 'manual':
      return '수동'
    default:
      return value
  }
}

function translatePriceNotation(value: string) {
  switch (value) {
    case 'won':
      return '원 단위'
    case 'manwon':
      return '만원 단위'
    case 'auto':
      return '자동 판별'
    default:
      return value
  }
}

function translateParseStatus(value: string) {
  switch (value) {
    case 'received':
      return '수신'
    case 'pending':
      return '대기'
    case 'parsed':
      return '파싱 완료'
    case 'failed':
      return '실패'
    case 'skipped':
      return '건너뜀'
    default:
      return value
  }
}

function extractArray(value: unknown, keys: string[] = []): unknown[] {
  if (Array.isArray(value)) {
    return value
  }

  const root = unwrapPayload(value)
  if (Array.isArray(root)) {
    return root
  }

  if (!isRecord(root)) {
    return []
  }

  for (const key of keys) {
    const candidate = root[key]

    if (Array.isArray(candidate)) {
      return candidate
    }
  }

  for (const candidate of Object.values(root)) {
    if (Array.isArray(candidate)) {
      return candidate
    }
  }

  return []
}

async function requestJson(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  }

  if (init.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers,
  })

  if (!response.ok) {
    throw new Error(`${response.status} 응답으로 요청에 실패했습니다: ${path}`)
  }

  return (await response.json()) as unknown
}

function normalizeMarketRow(value: unknown, index: number): MarketRow {
  const record = isRecord(value) ? value : {}
  const canonicalName = toStringValue(
    getCandidate(record, ['canonicalName', 'species', 'slug', 'name']),
    `어종-${index + 1}`,
  )

  return {
    id: toStringValue(getCandidate(record, ['id', 'uuid']), `${canonicalName}-${index}`),
    canonicalName,
    species: toStringValue(
      getCandidate(record, ['displayName', 'speciesName', 'commonName', 'name']),
      canonicalName,
    ),
    market: toStringValue(
      getCandidate(record, ['market', 'marketName', 'location', 'landingSite', 'origin']),
    ),
    price: toNumberValue(
      getCandidate(record, ['price', 'unitPrice', 'latestPrice', 'medianPrice', 'value', 'pricePerKg']),
    ),
    lowPrice: toNumberValue(getCandidate(record, ['lowPrice', 'minPrice', 'min'])),
    highPrice: toNumberValue(getCandidate(record, ['highPrice', 'maxPrice', 'max'])),
    unit: toStringValue(getCandidate(record, ['unit', 'priceUnit', 'unitLabel']), '단위 미상'),
    currency: toStringValue(
      getCandidate(record, ['currency', 'currencyCode', 'quoteCurrency']),
      'KRW',
    ),
    speciesSortOrder: toNumberValue(
      getCandidate(record, ['speciesSortOrder', 'species_sort_order', 'sortOrder', 'sort_order']),
    ) ?? 999,
    observedAt: (getCandidate(record, [
      'observedAt',
      'publishedAt',
      'capturedAt',
      'date',
      'marketDate',
    ]) as string | null) ?? null,
    source: toStringValue(getCandidate(record, ['source', 'sourceName', 'publisher']), '수집 피드'),
    raw: {
      ...record,
      displayName: getCandidate(record, ['displayName', 'display_name', 'speciesName', 'commonName', 'name']),
      origin: getCandidate(record, ['origin']),
      originCountry: getCandidate(record, ['originCountry', 'origin_country']),
      originDetail: getCandidate(record, ['originDetail', 'origin_detail']),
      productionType: getCandidate(record, ['productionType', 'production_type']),
      grade: getCandidate(record, ['grade']),
      sizeMinKg: getCandidate(record, ['sizeMinKg', 'size_min_kg']),
      sizeMaxKg: getCandidate(record, ['sizeMaxKg', 'size_max_kg']),
      unit: getCandidate(record, ['unit', 'priceUnit', 'unitLabel']),
      priceText: getCandidate(record, ['priceText', 'price_text']),
      speciesSortOrder: getCandidate(record, ['speciesSortOrder', 'species_sort_order', 'sortOrder', 'sort_order']),
      soldOut: getCandidate(record, ['soldOut', 'sold_out']),
      eventFlag: getCandidate(record, ['eventFlag', 'event_flag']),
      halfAvailable: getCandidate(record, ['halfAvailable', 'half_available']),
      packingNote: getCandidate(record, ['packingNote', 'packing_note']),
      freshnessState: getCandidate(record, ['freshnessState', 'freshness_state']),
      notes: getCandidate(record, ['notes', 'description', 'detail']),
      bestCondition: toBooleanValue(getCandidate(record, ['bestCondition', 'best_condition_flag'])),
      lowestPrice: toBooleanValue(getCandidate(record, ['lowestPrice', 'lowest_price_flag'])),
      aiRecommended: toBooleanValue(getCandidate(record, ['aiRecommended', 'ai_recommendation_flag'])),
    },
  }
}

function normalizeInsightItem(value: unknown, index: number): InsightItem {
  if (typeof value === 'string') {
    return {
      id: `insight-${index}`,
      title: `시장 메모 ${index + 1}`,
      summary: value,
      tone: 'neutral',
      market: '전체 시장',
      species: '혼합 품목',
      raw: value,
    }
  }

  const record = isRecord(value) ? value : {}

  return {
    id: toStringValue(getCandidate(record, ['id', 'slug', 'title']), `insight-${index}`),
    title: toStringValue(getCandidate(record, ['title', 'headline', 'summary']), `인사이트 ${index + 1}`),
    summary: toStringValue(getCandidate(record, ['summary', 'body', 'text', 'insight']), '설명 없음'),
    tone: toStringValue(getCandidate(record, ['tone', 'severity', 'signal']), 'neutral'),
    market: toStringValue(getCandidate(record, ['market', 'marketName']), '전체 시장'),
    species: toStringValue(getCandidate(record, ['species', 'canonicalName', 'topic']), '혼합 품목'),
    raw: value,
  }
}

function normalizeSourceStatus(value: unknown, index: number): SourceStatusItem {
  const record = isRecord(value) ? value : {}

  return {
    id: toStringValue(getCandidate(record, ['id', 'sourceId', 'name']), `source-${index}`),
    name: toStringValue(getCandidate(record, ['name', 'source', 'label']), `소스 ${index + 1}`),
    status:
      toBooleanValue(getCandidate(record, ['enabled', 'active', 'isEnabled', 'isActive'])) === false
        ? '중지'
        : '사용 중',
    enabled: toBooleanValue(getCandidate(record, ['enabled', 'active', 'isEnabled', 'isActive'])),
    lastSeen: (getCandidate(record, ['lastSeen', 'lastSuccess', 'lastRunAt', 'updatedAt']) as string | null) ?? null,
    detail: `${translateSourceMode(toStringValue(getCandidate(record, ['sourceMode']), '수집 방식 미상'))} · ${translatePriceNotation(toStringValue(getCandidate(record, ['priceNotation']), '표기 미상'))}`,
    raw: value,
  }
}

function normalizeRawPost(value: unknown, index: number): RawPostItem {
  const record = isRecord(value) ? value : {}
  const fullText = toStringValue(
    getCandidate(record, [
      'rawContentMasked',
      'raw_content_masked',
      'fullText',
      'rawText',
      'content',
      'text',
      'body',
      'excerpt',
    ]),
    '원문 내용 없음',
  )

  return {
    id: toStringValue(getCandidate(record, ['id', 'uuid']), `raw-post-${index}`),
    source: toStringValue(getCandidate(record, ['source', 'sourceName', 'platform']), '미상 소스'),
    market: toStringValue(getCandidate(record, ['market', 'marketName', 'location']), '미상 시장'),
    species: toStringValue(getCandidate(record, ['species', 'canonicalName', 'topic', 'postKey']), '혼합 품목'),
    excerpt: toStringValue(getCandidate(record, ['excerpt', 'content', 'text', 'body', 'rawContentMasked']), fullText),
    fullText,
    status: translateParseStatus(toStringValue(getCandidate(record, ['status', 'processingStatus', 'state', 'parseStatus']), '수신')),
    parseError: (getCandidate(record, ['parseError', 'parse_error', 'error']) as string | null) ?? null,
    publishedAt: (getCandidate(record, ['publishedAt', 'createdAt', 'capturedAt', 'date', 'postedAt']) as string | null) ?? null,
    url: (getCandidate(record, ['url', 'link', 'permalink']) as string | null) ?? null,
    raw: value,
  }
}

function normalizeSourceConfig(value: unknown, index: number): SourceConfigItem {
  const record = isRecord(value) ? value : {}

  return {
    id: toStringValue(getCandidate(record, ['id', 'sourceId', 'name']), `config-${index}`),
    name: toStringValue(getCandidate(record, ['name', 'label', 'source']), `소스 ${index + 1}`),
    market: translateVendorType(toStringValue(getCandidate(record, ['market', 'marketName', 'scope', 'vendorType']), '전체 판매처')),
    endpoint: toStringValue(getCandidate(record, ['endpoint', 'url', 'feedUrl', 'bandKey']), '미등록'),
    cadence: translateSourceMode(toStringValue(getCandidate(record, ['cadence', 'schedule', 'interval', 'sourceMode']), '미지정')),
    enabled: toBooleanValue(getCandidate(record, ['enabled', 'active', 'isEnabled', 'isActive'])),
    notes: translatePriceNotation(toStringValue(getCandidate(record, ['notes', 'description', 'detail', 'priceNotation']), '메모 없음')),
    raw: value,
  }
}

function normalizeTrendPoint(value: unknown, index: number): SpeciesTrendPoint {
  const record = isRecord(value) ? value : {}
  const date = (getCandidate(record, ['date', 'marketDate', 'observedAt', 'publishedAt']) as string | null) ?? null
  const sourceName = toStringValue(
    getCandidate(record, ['sourceName', 'source_name', 'vendorName', 'vendor_name', 'publisher']),
    '복수 시장',
  )
  const raw = {
    ...record,
    sourceName,
    displayName: getCandidate(record, ['displayName', 'display_name', 'speciesName', 'commonName', 'name']),
    origin: getCandidate(record, ['origin']),
    originCountry: getCandidate(record, ['originCountry', 'origin_country']),
    originDetail: getCandidate(record, ['originDetail', 'origin_detail']),
    productionType: getCandidate(record, ['productionType', 'production_type']),
    freshnessState: getCandidate(record, ['freshnessState', 'freshness_state']),
    grade: getCandidate(record, ['grade']),
    sizeMinKg: getCandidate(record, ['sizeMinKg', 'size_min_kg']),
    sizeMaxKg: getCandidate(record, ['sizeMaxKg', 'size_max_kg']),
    priceText: getCandidate(record, ['priceText', 'price_text']),
    notes: getCandidate(record, ['notes', 'description', 'detail']),
    compareKey: getCandidate(record, ['compareKey', 'compare_key']),
  }

  return {
    id: toStringValue(getCandidate(record, ['id', 'uuid']), `point-${index}`),
    label: date ? date.slice(5, 10) : `지점 ${index + 1}`,
    date,
    value: toNumberValue(getCandidate(record, ['price', 'unitPrice', 'value', 'medianPrice', 'pricePerKg'])),
    market: toStringValue(getCandidate(record, ['market', 'sourceName', 'source_name', 'marketName', 'location', 'origin']), sourceName),
    currency: toStringValue(getCandidate(record, ['currency', 'currencyCode']), 'KRW'),
    raw,
  }
}

function normalizeSpeciesProfile(value: unknown, index: number): SpeciesProfile {
  const record = isRecord(value) ? value : {}
  const canonicalName = toStringValue(
    getCandidate(record, ['canonicalName', 'canonical_name', 'koreanName', 'korean_name', 'name']),
    `어종-${index + 1}`,
  )

  return {
    canonicalName,
    category: toStringValue(getCandidate(record, ['category']), 'fish'),
    koreanName: toStringValue(getCandidate(record, ['koreanName', 'korean_name', 'name']), canonicalName),
    scientificName: (getCandidate(record, ['scientificName', 'scientific_name']) as string | null) ?? null,
    englishName: (getCandidate(record, ['englishName', 'english_name']) as string | null) ?? null,
    aliases: toStringArray(getCandidate(record, ['aliases', 'aliasNames', 'alias_names'])),
    seasonMonths: toStringValue(getCandidate(record, ['seasonMonths', 'season_months']), '연중'),
    seasonNote: toStringValue(getCandidate(record, ['seasonNote', 'season_note']), '제철 정보가 아직 없습니다.'),
    weightNote: toStringValue(
      getCandidate(record, ['weightNote', 'weight_note', 'market_weight_note']),
      '중량 정보가 아직 없습니다.',
    ),
    habitatNote: toStringValue(getCandidate(record, ['habitatNote', 'habitat_note']), '서식 정보가 아직 없습니다.'),
    tasteNote: toStringValue(getCandidate(record, ['tasteNote', 'taste_note']), '맛 정보가 아직 없습니다.'),
    buyingNote: toStringValue(getCandidate(record, ['buyingNote', 'buying_note']), '구매 메모가 아직 없습니다.'),
    photoUrl: toStringValue(getCandidate(record, ['photoUrl', 'photo_url']), ''),
    photoSourceUrl: toStringValue(getCandidate(record, ['photoSourceUrl', 'photo_source_url']), ''),
    photoAttribution: toStringValue(getCandidate(record, ['photoAttribution', 'photo_attribution']), '사진 출처 미상'),
    photoLicense: toStringValue(getCandidate(record, ['photoLicense', 'photo_license']), ''),
    infoSources: toStringArray(getCandidate(record, ['infoSources', 'info_sources'])),
    sortOrder: toNumberValue(getCandidate(record, ['sortOrder', 'sort_order'])) ?? index,
    raw: value,
  }
}

export async function getTodayMarket(date?: string): Promise<TodayMarketResponse> {
  const query = date?.trim() ? `?date=${encodeURIComponent(date.trim())}` : ''
  const payload = await requestJson(`/api/market/today${query}`)
  const rows = extractArray(payload, ['rows', 'items', 'markets', 'entries']).map(normalizeMarketRow)
  const root = unwrapPayload(payload)
  const record = isRecord(root) ? root : {}

  return {
    rows,
    lastUpdated: (getCandidate(record, ['lastUpdated', 'generatedAt', 'date']) as string | null) ?? rows[0]?.observedAt ?? null,
  }
}

export async function getInsights(date: string): Promise<InsightItem[]> {
  const payload = await requestJson(`/api/insights?date=${encodeURIComponent(date)}`)
  return extractArray(payload, ['insights', 'items', 'rows']).map(normalizeInsightItem)
}

export async function getSourceStatuses(): Promise<SourceStatusItem[]> {
  const payload = await requestJson('/api/sources/status')
  return extractArray(payload, ['sources', 'items', 'rows', 'statuses']).map(normalizeSourceStatus)
}

export async function getRawPosts(): Promise<RawPostItem[]> {
  const payload = await requestJson(buildAdminUrl('/raw-posts'))
  return extractArray(payload, ['rawPosts', 'posts', 'items', 'rows']).map(normalizeRawPost)
}

export async function getAdminSources(): Promise<SourceConfigItem[]> {
  const payload = await requestJson(buildAdminUrl('/sources'))
  return extractArray(payload, ['sources', 'items', 'rows']).map(normalizeSourceConfig)
}

export async function getSpeciesProfiles(): Promise<SpeciesProfile[]> {
  const payload = await requestJson('/api/species-info')
  return extractArray(payload, ['items', 'profiles', 'rows']).map(normalizeSpeciesProfile)
}

export async function updateSpeciesProfile(
  canonicalName: string,
  patch: SpeciesProfilePatch,
): Promise<SpeciesProfile> {
  const payload = await requestJson(
    buildAdminUrl(`/species-info/${encodeURIComponent(canonicalName)}`),
    {
      body: JSON.stringify(patch),
      method: 'PATCH',
    },
  )
  const root = unwrapPayload(payload)
  const item = isRecord(root)
    ? getCandidate(root, ['item', 'profile', 'speciesProfile']) ?? root
    : root

  return normalizeSpeciesProfile(item, 0)
}

export async function getSpeciesTrend(
  canonicalName: string,
  days: number,
): Promise<SpeciesTrendResponse> {
  const payload = await requestJson(
    `/api/market/species/${encodeURIComponent(canonicalName)}?days=${days}`,
  )
  const root = unwrapPayload(payload)
  const record = isRecord(root) ? root : {}
  const points = extractArray(root, ['points', 'series', 'items', 'rows']).map(normalizeTrendPoint)

  return {
    canonicalName,
    species: toStringValue(getCandidate(record, ['species', 'displayName', 'name']), canonicalName),
    points,
    currency: points[0]?.currency ?? 'KRW',
  }
}
