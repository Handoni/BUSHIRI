import type { PriceNotation } from '../types/domain'
import type { ParsedMarketItem } from '../types/llm'
import { parsePricePerKg } from '../lib/price'

export type AliasEntry = {
  alias: string
  canonicalName: string
}

export type NormalizedMarketItem = ParsedMarketItem & {
  canonicalName: string | null
  origin: string | null
  originCountry: string | null
  originDetail: string | null
  pricePerKg: number | null
  soldOut: boolean
  eventFlag: boolean
  sizeMinKg: number | null
  sizeMaxKg: number | null
  compareKey: string
}

function compact(value: string): string {
  return value.replace(/\s+/g, '')
}

function formatBucketNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value)
}

function roundKg(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function resolveCanonicalName(displayName: string, aliases: AliasEntry[]): string | null {
  const normalized = compact(displayName)
  const match = aliases.find((entry) => compact(entry.alias) === normalized)
  return match ? match.canonicalName : null
}

export function normalizeOrigin(input: string | null): string | null {
  if (!input) {
    return null
  }

  const countryHits = [
    /(국내산|국산)/.test(input) ? '국내산' : null,
    /일본/.test(input) ? '일본산' : null,
    /중국/.test(input) ? '중국산' : null,
    /노르웨이/.test(input) ? '노르웨이' : null,
    /러시아/.test(input) ? '러시아' : null
  ].filter((value): value is string => value !== null)

  if (new Set(countryHits).size > 1) {
    return null
  }

  if (/(국내산|국산|통영|완도|제주|거제도?|목포|부산|여수|부안)/.test(input)) {
    return '국내산'
  }

  if (/(일본|일본산)/.test(input)) {
    return '일본산'
  }

  if (/(중국|중국산)/.test(input)) {
    return '중국산'
  }

  if (/노르웨이/.test(input)) {
    return '노르웨이'
  }

  if (/러시아/.test(input)) {
    return '러시아'
  }

  if (/(마가단|연해주)/.test(input)) {
    return '러시아'
  }

  return input
}

function normalizeDetailText(input: string | null): string | null {
  if (!input) {
    return null
  }

  const text = input.trim()

  if (!text) {
    return null
  }

  if (/낚시바리/.test(text)) {
    return '낚시바리'
  }

  if (/자연산/.test(text)) {
    return '자연산'
  }

  if (/양식/.test(text)) {
    return '양식'
  }

  return text
}

function normalizeRegionalOrigin(input: string | null): string | null {
  if (!input) {
    return null
  }

  const text = input.trim()

  if (!text || /^(국내산|국산|일본|일본산|중국|중국산|노르웨이|러시아)$/.test(text)) {
    return null
  }

  const knownRegion = text.match(/(거제도|제주|통영|완도|거제|목포|부산|여수|부안)/)?.[1]
  if (knownRegion) {
    return `${knownRegion}산`
  }

  const explicitRegion = text.match(/([가-힣A-Za-z]+산)/)?.[1] ?? null
  if (!explicitRegion || /^(국내산|일본산|중국산|자연산)$/.test(explicitRegion)) {
    return null
  }

  return explicitRegion
}

export function normalizeOriginFields(item: {
  displayName: string
  origin: string | null
  originCountry?: string | null
  originDetail?: string | null
  productionType: string | null
  grade: string | null
  notes: string | null
}): { origin: string | null; originCountry: string | null; originDetail: string | null } {
  const regionFromDetail = normalizeRegionalOrigin(item.originDetail ?? null)
  const country =
    normalizeOrigin(item.originCountry ?? item.origin) ??
    (regionFromDetail
      ? normalizeOrigin(regionFromDetail) === '러시아'
        ? '러시아'
        : '국내산'
      : null)
  const haystack = [
    item.originDetail,
    item.origin,
    item.displayName,
    item.productionType,
    item.grade,
    item.notes
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')

  let detail: string | null = null

  if (/낚시바리/.test(haystack)) {
    detail = '낚시바리'
  } else if (/자연산/.test(haystack)) {
    detail = '자연산'
  } else {
    detail =
      normalizeRegionalOrigin(item.originDetail ?? null) ??
      normalizeRegionalOrigin(item.origin) ??
      (normalizeDetailText(item.originDetail ?? null) === '양식' || item.productionType === '양식' || /양식/.test(haystack)
        ? '양식'
        : null)
  }

  return {
    origin: country,
    originCountry: country,
    originDetail: detail
  }
}

export function detectSoldOut(input: string): boolean {
  return /(마감|품절|완료|🚫|❌|완$|[\s\-_/]완$)/.test(input)
}

export function detectEventFlag(input: string): boolean {
  return /(이벤트|행사|특가|❤️|‼️)/.test(input)
}

export function parseWeightRange(input: string): { sizeMinKg: number | null; sizeMaxKg: number | null } {
  const rangeMatch = input.match(/(\d+(?:\.\d+)?)(kg|k|g)?\s*[-~]\s*(\d+(?:\.\d+)?)(kg|k|g)/i)
  if (rangeMatch) {
    const min = Number(rangeMatch[1])
    const max = Number(rangeMatch[3])
    const minUnit = (rangeMatch[2] ?? rangeMatch[4]).toLowerCase()
    const maxUnit = rangeMatch[4].toLowerCase()
    return {
      sizeMinKg: roundKg(minUnit === 'g' ? min * 0.001 : min),
      sizeMaxKg: roundKg(maxUnit === 'g' ? max * 0.001 : max)
    }
  }

  const upMatch = input.match(/(\d+(?:\.\d+)?)\s*k업/i)
  if (upMatch) {
    return { sizeMinKg: Number(upMatch[1]), sizeMaxKg: null }
  }

  const singleKgMatch = input.match(/(\d+(?:\.\d+)?)\s*(kg|k)/i)
  if (singleKgMatch) {
    const value = Number(singleKgMatch[1])
    return { sizeMinKg: roundKg(value), sizeMaxKg: roundKg(value) }
  }

  const singleGramMatch = input.match(/(\d+(?:\.\d+)?)\s*g/i)
  if (singleGramMatch) {
    const value = roundKg(Number(singleGramMatch[1]) * 0.001)
    return { sizeMinKg: value, sizeMaxKg: value }
  }

  return { sizeMinKg: null, sizeMaxKg: null }
}

function buildSizeBucket(sizeMinKg: number | null, sizeMaxKg: number | null): string {
  if (sizeMinKg === null && sizeMaxKg === null) {
    return 'unknown'
  }

  if (sizeMinKg !== null && sizeMaxKg === null) {
    return `${formatBucketNumber(sizeMinKg)}kg+`
  }

  if (sizeMinKg !== null && sizeMaxKg !== null && sizeMinKg === sizeMaxKg) {
    return `${formatBucketNumber(sizeMinKg)}kg`
  }

  return `${formatBucketNumber(sizeMinKg ?? 0)}~${formatBucketNumber(sizeMaxKg ?? 0)}kg`
}

export function buildCompareKey(item: {
  canonicalName: string | null
  origin: string | null
  productionType: string | null
  freshnessState: string | null
  grade: string | null
  eventFlag: boolean
  sizeMinKg: number | null
  sizeMaxKg: number | null
}): string {
  const gradeBucket = item.eventFlag ? 'event' : item.grade ?? 'general'
  const sizeBucket = buildSizeBucket(item.sizeMinKg, item.sizeMaxKg)

  return [
    item.canonicalName ?? 'unknown',
    item.origin ?? 'unknown',
    item.productionType ?? 'unknown',
    item.freshnessState ?? 'unknown',
    gradeBucket,
    sizeBucket
  ].join('|')
}

export function normalizeParsedItem(
  item: ParsedMarketItem,
  options: { priceNotation: PriceNotation; vendorName: string | null; aliases: AliasEntry[] }
): NormalizedMarketItem {
  const combinedText = [item.displayName, item.priceText, item.notes ?? ''].join(' ')
  const parsedWeight = parseWeightRange(combinedText)
  const canonicalName = item.canonicalName ?? resolveCanonicalName(item.displayName, options.aliases)
  const originFields = normalizeOriginFields(item)
  const pricePerKg = item.pricePerKg ?? parsePricePerKg(item.priceText, options.priceNotation, options.vendorName)
  const soldOut = item.soldOut || detectSoldOut(combinedText)
  const eventFlag = item.eventFlag || detectEventFlag(combinedText)
  const sizeMinKg = item.sizeMinKg ?? parsedWeight.sizeMinKg
  const sizeMaxKg = item.sizeMaxKg ?? parsedWeight.sizeMaxKg

  return {
    ...item,
    canonicalName,
    origin: originFields.origin,
    originCountry: originFields.originCountry,
    originDetail: originFields.originDetail,
    pricePerKg,
    soldOut,
    eventFlag,
    sizeMinKg,
    sizeMaxKg,
    compareKey: buildCompareKey({
      canonicalName,
      origin: originFields.origin,
      productionType: item.productionType,
      freshnessState: item.freshnessState,
      grade: item.grade,
      eventFlag,
      sizeMinKg,
      sizeMaxKg
    })
  }
}
