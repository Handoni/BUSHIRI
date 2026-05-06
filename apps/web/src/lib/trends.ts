import type { SpeciesTrendPoint } from './api'

type RawRecord = Record<string, unknown>

export const DEFAULT_TREND_SPECIES = '광어'

export type SpeciesOption = {
  value: string
  label: string
  searchText: string
}

export type SpeciesOptionInput = {
  canonicalName: string
  species: string
}

export type TrendReferenceBadge = {
  key: string
  label: string
}

export type TrendCondition = {
  key: string
  label: string
  vendor: string
  status: string
  origin: string
  referenceBadges: TrendReferenceBadge[]
}

export type TrendSeriesPoint = {
  date: string
  label: string
  value: number
}

export type TrendSeries = TrendCondition & {
  points: TrendSeriesPoint[]
  pointCount: number
  latestValue: number | null
  firstValue: number | null
  changePercent: number | null
  lastDate: string | null
}

export type TrendTableRow = TrendCondition & {
  id: string
  date: string | null
  value: number | null
  currency: string
}

export type TrendComparison = {
  currency: string
  dateLabels: string[]
  minValue: number | null
  maxValue: number | null
  rows: TrendTableRow[]
  series: TrendSeries[]
}

export type TrendChartRow = {
  date: string
  label: string
} & Record<string, string | number>

const UNKNOWN_ORIGIN_LABEL = '원산지 미상'
const ORIGIN_SEGMENT_SEPARATOR = /[\/,·ㆍ+&|]+/u
const GENERIC_ORIGIN_KEYWORDS = new Set([
  '국내산',
  '국내',
  '수입산',
  '수입',
  '원산지미상',
])

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `${value}`
  }

  return null
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''))

    return Number.isFinite(parsed) ? parsed : null
  }

  return null
}

function getRawCandidate(raw: RawRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (key in raw && raw[key] != null) {
      return raw[key]
    }
  }

  return null
}

function pushUnique(values: string[], value: string | null) {
  if (!value || values.includes(value)) {
    return
  }

  values.push(value)
}

function compactOriginText(value: string): string {
  return value.trim().replace(/\s+/g, '')
}

function isGenericOriginKeyword(value: string): boolean {
  return GENERIC_ORIGIN_KEYWORDS.has(compactOriginText(value))
}

function normalizeOriginToken(value: string): string | null {
  const trimmed = value.trim()
  const compacted = compactOriginText(trimmed)

  if (!compacted) {
    return null
  }

  if (compacted === compactOriginText(UNKNOWN_ORIGIN_LABEL)) {
    return UNKNOWN_ORIGIN_LABEL
  }

  if (isGenericOriginKeyword(compacted) || !compacted.endsWith('산') || compacted.length <= 2) {
    return isGenericOriginKeyword(compacted) ? compacted : trimmed
  }

  const withoutSuffix = compacted.slice(0, -1)

  return withoutSuffix || compacted
}

function splitOriginSegments(origin: string): string[] {
  return origin.split(ORIGIN_SEGMENT_SEPARATOR).flatMap((segment) => {
    const words = segment.trim().split(/\s+/u).filter(Boolean)

    if (words.length > 1 && words.some((word) => isGenericOriginKeyword(word))) {
      return words
    }

    return [segment]
  })
}

function normalizeOriginLabel(origin: string | null): string {
  if (!origin) {
    return UNKNOWN_ORIGIN_LABEL
  }

  const compacted = compactOriginText(origin)

  if (!compacted) {
    return UNKNOWN_ORIGIN_LABEL
  }

  if (compacted === compactOriginText(UNKNOWN_ORIGIN_LABEL)) {
    return UNKNOWN_ORIGIN_LABEL
  }

  const tokens = splitOriginSegments(origin)
    .map(normalizeOriginToken)
    .filter((value): value is string => value !== null)
  const uniqueTokens = Array.from(new Set(tokens))
  const specificTokens = uniqueTokens.filter((token) => !isGenericOriginKeyword(token))

  if (specificTokens.length === 1) {
    return specificTokens[0]
  }

  if (specificTokens.length > 1) {
    return specificTokens.sort(compareKorean).join('/')
  }

  return uniqueTokens[0] ?? UNKNOWN_ORIGIN_LABEL
}

function compareOriginCanonical(left: string, right: string): number {
  const lengthOrder = left.length - right.length

  return lengthOrder === 0 ? compareKorean(left, right) : lengthOrder
}

function shouldMergeOriginLabels(left: string, right: string): boolean {
  if (
    left === right ||
    left.includes('/') ||
    right.includes('/') ||
    isGenericOriginKeyword(left) ||
    isGenericOriginKeyword(right)
  ) {
    return false
  }

  return left.includes(right) || right.includes(left)
}

function buildOriginAliasMap(origins: string[]): Map<string, string> {
  const normalizedEntries = origins.map((origin) => [origin, normalizeOriginLabel(origin)] as const)
  const normalizedLabels = Array.from(new Set(normalizedEntries.map((entry) => entry[1])))
  const canonicalByLabel = new Map<string, string>()

  normalizedLabels.forEach((label) => {
    const candidates = normalizedLabels.filter((candidate) =>
      shouldMergeOriginLabels(label, candidate),
    )
    const canonical = [label, ...candidates].sort(compareOriginCanonical)[0] ?? label

    canonicalByLabel.set(label, canonical)
  })

  return new Map(
    normalizedEntries.map(([origin, label]) => [origin, canonicalByLabel.get(label) ?? label]),
  )
}

function normalizeFreshness(value: unknown): string | null {
  const text = stringValue(value)

  if (!text) {
    return null
  }

  if (text === '활') {
    return '활어'
  }

  if (text === '선') {
    return '선어'
  }

  return text
}

function descriptorStatus(raw: RawRecord): string[] {
  const haystack = [
    getRawCandidate(raw, ['displayName', 'display_name']),
    getRawCandidate(raw, ['freshnessState', 'freshness_state']),
    getRawCandidate(raw, ['grade']),
    getRawCandidate(raw, ['notes', 'description', 'detail']),
  ]
    .map(stringValue)
    .filter((value): value is string => value !== null)
    .join(' ')
    .replace(/\s+/g, '')

  const tags: string[] = []
  const descriptors = [
    '찍어바리',
    '꼬물이급',
    '꼬물급',
    '꼬물이',
    '비실이',
    '낚시바리',
    '상태최강',
  ]

  descriptors.forEach((descriptor) => {
    if (haystack.includes(descriptor.replace(/\s+/g, ''))) {
      pushUnique(tags, descriptor)
    }
  })

  return tags
}

export function resolveTrendStatus(raw: unknown): string {
  const record = isRecord(raw) ? raw : {}
  const tags: string[] = []

  pushUnique(
    tags,
    normalizeFreshness(getRawCandidate(record, ['freshnessState', 'freshness_state'])),
  )
  descriptorStatus(record).forEach((tag) => pushUnique(tags, tag))

  return tags.length > 0 ? tags.join('·') : '상태 미상'
}

export function resolveWeightBucket(raw: unknown): string {
  const record = isRecord(raw) ? raw : {}
  const min = numberValue(getRawCandidate(record, ['sizeMinKg', 'size_min_kg']))
  const max = numberValue(getRawCandidate(record, ['sizeMaxKg', 'size_max_kg']))

  if (min === null && max === null) {
    return '중량 미상'
  }

  const weight = min !== null && max !== null ? (min + max) / 2 : min ?? max

  if (weight === null) {
    return '중량 미상'
  }

  if (weight < 1) {
    return '1kg 미만'
  }

  if (weight < 2) {
    return '1~2kg'
  }

  if (weight < 3) {
    return '2~3kg'
  }

  if (weight < 5) {
    return '3~5kg'
  }

  if (weight < 8) {
    return '5~8kg'
  }

  return '8kg 이상'
}

function pushReferenceBadge(
  badges: TrendReferenceBadge[],
  key: string,
  label: string | null,
  excludedLabels: Set<string>,
) {
  if (!label || excludedLabels.has(label) || badges.some((badge) => badge.label === label)) {
    return
  }

  badges.push({ key, label })
}

export function buildTrendReferenceBadges(raw: unknown): TrendReferenceBadge[] {
  const record = isRecord(raw) ? raw : {}
  const rawOrigin = stringValue(getRawCandidate(record, ['origin']))
  const origin = normalizeOriginLabel(rawOrigin)
  const status = resolveTrendStatus(record)
  const excludedLabels = new Set(
    [origin, rawOrigin, status, '활어', '선어'].filter(
      (label): label is string => label !== null,
    ),
  )
  const badges: TrendReferenceBadge[] = []
  const weightBucket = resolveWeightBucket(record)

  pushReferenceBadge(
    badges,
    'displayName',
    stringValue(
      getRawCandidate(record, [
        'displayName',
        'display_name',
        'speciesName',
        'commonName',
        'name',
      ]),
    ),
    excludedLabels,
  )
  pushReferenceBadge(
    badges,
    'productionType',
    stringValue(getRawCandidate(record, ['productionType', 'production_type'])),
    excludedLabels,
  )
  pushReferenceBadge(
    badges,
    'grade',
    stringValue(getRawCandidate(record, ['grade'])),
    excludedLabels,
  )
  pushReferenceBadge(
    badges,
    'weight',
    weightBucket === '중량 미상' ? null : weightBucket,
    excludedLabels,
  )
  pushReferenceBadge(
    badges,
    'priceText',
    stringValue(getRawCandidate(record, ['priceText', 'price_text'])),
    excludedLabels,
  )
  pushReferenceBadge(
    badges,
    'packingNote',
    stringValue(getRawCandidate(record, ['packingNote', 'packing_note'])),
    excludedLabels,
  )
  pushReferenceBadge(
    badges,
    'notes',
    stringValue(getRawCandidate(record, ['notes', 'description', 'detail'])),
    excludedLabels,
  )

  if (getRawCandidate(record, ['soldOut', 'sold_out']) === true) {
    pushReferenceBadge(badges, 'soldOut', '품절', excludedLabels)
  }

  if (getRawCandidate(record, ['eventFlag', 'event_flag']) === true) {
    pushReferenceBadge(badges, 'eventFlag', '행사', excludedLabels)
  }

  if (getRawCandidate(record, ['halfAvailable', 'half_available']) === true) {
    pushReferenceBadge(badges, 'halfAvailable', '반마리 가능', excludedLabels)
  }

  return badges
}

export function resolveTrendCondition(
  point: SpeciesTrendPoint,
  originAliases: Map<string, string> = new Map(),
): TrendCondition {
  const raw = isRecord(point.raw) ? point.raw : {}
  const vendor =
    stringValue(getRawCandidate(raw, ['sourceName', 'source_name', 'vendorName', 'vendor_name'])) ??
    point.market ??
    '판매처 미상'
  const status = resolveTrendStatus(raw)
  const rawOrigin = stringValue(getRawCandidate(raw, ['origin']))
  const origin = (rawOrigin && originAliases.get(rawOrigin)) ?? normalizeOriginLabel(rawOrigin)
  const key = `${vendor}|${origin}`

  return {
    key,
    label: `${vendor} · ${origin}`,
    vendor,
    status,
    origin,
    referenceBadges: buildTrendReferenceBadges(raw),
  }
}

function pointLabel(date: string): string {
  return date.length >= 10 ? date.slice(5, 10) : date
}

function compareKorean(left: string, right: string) {
  return left.localeCompare(right, 'ko')
}

export function buildSpeciesOptions(rows: SpeciesOptionInput[]): SpeciesOption[] {
  const deduped = new Map<string, Set<string>>()

  rows.forEach((row) => {
    const value = stringValue(row.canonicalName)
    const displayName = stringValue(row.species)

    if (!value) {
      return
    }

    const searchTerms = deduped.get(value) ?? new Set<string>()
    searchTerms.add(value)

    if (displayName) {
      searchTerms.add(displayName)
    }

    deduped.set(value, searchTerms)
  })

  return Array.from(deduped.entries()).map(([value, searchTerms]) => ({
    value,
    label: value,
    searchText: Array.from(searchTerms).join(' '),
  }))
}

export function filterSpeciesOptions(options: SpeciesOption[], query: string): SpeciesOption[] {
  const normalizedQuery = query.trim().toLowerCase()

  if (!normalizedQuery) {
    return options
  }

  return options.filter((option) => {
    return `${option.value} ${option.label} ${option.searchText}`
      .toLowerCase()
      .includes(normalizedQuery)
  })
}

export function pickDefaultSpecies(options: SpeciesOption[]): string {
  return (
    options.find((option) => option.value === DEFAULT_TREND_SPECIES)?.value ??
    options[0]?.value ??
    DEFAULT_TREND_SPECIES
  )
}

export function buildTrendComparison(points: SpeciesTrendPoint[]): TrendComparison {
  const currency = points[0]?.currency ?? 'KRW'
  const originAliases = buildOriginAliasMap(
    points
      .map((point) =>
        isRecord(point.raw) ? stringValue(getRawCandidate(point.raw, ['origin'])) : null,
      )
      .filter((origin): origin is string => origin !== null),
  )
  const seriesMap = new Map<
    string,
    TrendCondition & {
      pointCount: number
      valuesByDate: Map<string, TrendSeriesPoint>
    }
  >()
  const rows = points.map((point, index) => {
    const condition = resolveTrendCondition(point, originAliases)

    return {
      ...condition,
      id: point.id || `trend-row-${index}`,
      date: point.date,
      value: point.value,
      currency: point.currency || currency,
    }
  })

  points.forEach((point) => {
    if (!point.date || point.value === null) {
      return
    }

    const condition = resolveTrendCondition(point, originAliases)
    const target =
      seriesMap.get(condition.key) ??
      {
        ...condition,
        pointCount: 0,
        valuesByDate: new Map<string, TrendSeriesPoint>(),
      }
    const existing = target.valuesByDate.get(point.date)

    if (!existing || point.value < existing.value) {
      target.valuesByDate.set(point.date, {
        date: point.date,
        label: pointLabel(point.date),
        value: point.value,
      })
    }

    target.pointCount += 1
    seriesMap.set(condition.key, target)
  })

  const series = Array.from(seriesMap.values())
    .map((entry) => {
      const seriesPoints = Array.from(entry.valuesByDate.values()).sort((left, right) =>
        left.date.localeCompare(right.date),
      )
      const firstValue = seriesPoints[0]?.value ?? null
      const latestValue = seriesPoints[seriesPoints.length - 1]?.value ?? null
      const changePercent =
        firstValue !== null && latestValue !== null && firstValue !== 0
          ? ((latestValue - firstValue) / firstValue) * 100
          : null

      return {
        key: entry.key,
        label: entry.label,
        vendor: entry.vendor,
        status: entry.status,
        origin: entry.origin,
        referenceBadges: entry.referenceBadges,
        points: seriesPoints,
        pointCount: entry.pointCount,
        latestValue,
        firstValue,
        changePercent,
        lastDate: seriesPoints[seriesPoints.length - 1]?.date ?? null,
      }
    })
    .sort((left, right) => {
      const vendorOrder = compareKorean(left.vendor, right.vendor)

      if (vendorOrder !== 0) {
        return vendorOrder
      }

      const originOrder = compareKorean(left.origin, right.origin)

      if (originOrder !== 0) {
        return originOrder
      }

      return compareKorean(left.key, right.key)
    })

  const values = series.flatMap((entry) => entry.points.map((point) => point.value))
  const dateLabels = Array.from(
    new Set(series.flatMap((entry) => entry.points.map((point) => point.date))),
  )
    .sort((left, right) => left.localeCompare(right))
    .map(pointLabel)

  return {
    currency,
    dateLabels,
    minValue: values.length > 0 ? Math.min(...values) : null,
    maxValue: values.length > 0 ? Math.max(...values) : null,
    rows: rows.sort((left, right) => {
      const dateOrder = (right.date ?? '').localeCompare(left.date ?? '')

      if (dateOrder !== 0) {
        return dateOrder
      }

      return compareKorean(left.key, right.key)
    }),
    series,
  }
}

export function buildTrendChartRows(
  series: TrendSeries[],
  visibleSeriesKeys: string[],
): TrendChartRow[] {
  const visibleKeys = new Set(visibleSeriesKeys)
  const rowsByDate = new Map<string, TrendChartRow>()

  series.forEach((entry) => {
    if (!visibleKeys.has(entry.key)) {
      return
    }

    entry.points.forEach((point) => {
      const row =
        rowsByDate.get(point.date) ??
        {
          date: point.date,
          label: point.label,
        }

      row[entry.key] = point.value
      rowsByDate.set(point.date, row)
    })
  })

  return Array.from(rowsByDate.values()).sort((left, right) => left.date.localeCompare(right.date))
}
