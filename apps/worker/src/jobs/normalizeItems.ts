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

  if (/(국내산|국산|통영|완도|제주)/.test(input)) {
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

  return input
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
  const origin = normalizeOrigin(item.origin)
  const pricePerKg = item.pricePerKg ?? parsePricePerKg(item.priceText, options.priceNotation, options.vendorName)
  const soldOut = item.soldOut || detectSoldOut(combinedText)
  const eventFlag = item.eventFlag || detectEventFlag(combinedText)
  const sizeMinKg = item.sizeMinKg ?? parsedWeight.sizeMinKg
  const sizeMaxKg = item.sizeMaxKg ?? parsedWeight.sizeMaxKg

  return {
    ...item,
    canonicalName,
    origin,
    pricePerKg,
    soldOut,
    eventFlag,
    sizeMinKg,
    sizeMaxKg,
    compareKey: buildCompareKey({
      canonicalName,
      origin,
      productionType: item.productionType,
      freshnessState: item.freshnessState,
      grade: item.grade,
      eventFlag,
      sizeMinKg,
      sizeMaxKg
    })
  }
}
