import { describe, expect, it } from 'vitest'
import { generateInsights } from './generateInsights'

const todayItems = [
  {
    sourceId: 1,
    sourceName: '성전물산',
    marketDate: '2026-04-24',
    category: 'fish' as const,
    canonicalName: '광어',
    displayName: '자연산 광어',
    compareKey: '광어|국내산|자연산|unknown|general|2~3kg',
    origin: '국내산',
    productionType: '자연산',
    freshnessState: null,
    grade: null,
    sizeMinKg: 2,
    sizeMaxKg: 3,
    pricePerKg: 60,
    soldOut: true,
    eventFlag: false
  },
  {
    sourceId: 2,
    sourceName: '참조은수산',
    marketDate: '2026-04-24',
    category: 'fish' as const,
    canonicalName: '광어',
    displayName: '자연산 광어',
    compareKey: '광어|국내산|자연산|unknown|general|2~3kg',
    origin: '국내산',
    productionType: '자연산',
    freshnessState: null,
    grade: null,
    sizeMinKg: 2,
    sizeMaxKg: 3,
    pricePerKg: 100,
    soldOut: false,
    eventFlag: false
  },
  {
    sourceId: 3,
    sourceName: '줄포상회',
    marketDate: '2026-04-24',
    category: 'crustacean' as const,
    canonicalName: '킹크랩',
    displayName: '블루 킹크랩',
    compareKey: '킹크랩|러시아|unknown|unknown|general|unknown',
    origin: '러시아',
    productionType: null,
    freshnessState: null,
    grade: null,
    sizeMinKg: null,
    sizeMaxKg: null,
    pricePerKg: 46000,
    soldOut: false,
    eventFlag: true
  }
]

const historicalItems = [
  {
    sourceId: 1,
    sourceName: '성전물산',
    marketDate: '2026-04-23',
    category: 'fish' as const,
    canonicalName: '광어',
    displayName: '자연산 광어',
    compareKey: '광어|국내산|자연산|unknown|general|2~3kg',
    origin: '국내산',
    productionType: '자연산',
    freshnessState: null,
    grade: null,
    sizeMinKg: 2,
    sizeMaxKg: 3,
    pricePerKg: 100,
    soldOut: false,
    eventFlag: false
  },
  {
    sourceId: 2,
    sourceName: '참조은수산',
    marketDate: '2026-04-23',
    category: 'fish' as const,
    canonicalName: '광어',
    displayName: '자연산 광어',
    compareKey: '광어|국내산|자연산|unknown|general|2~3kg',
    origin: '국내산',
    productionType: '자연산',
    freshnessState: null,
    grade: null,
    sizeMinKg: 2,
    sizeMaxKg: 3,
    pricePerKg: 100,
    soldOut: true,
    eventFlag: false
  }
]

describe('generateInsights', () => {
  it('emits price, gap, novelty, sold-out, and restocked insights from normalized items', () => {
    const insights = generateInsights({
      marketDate: '2026-04-24',
      todayItems,
      historicalItems
    })

    expect(insights.map((insight) => insight.insightType)).toEqual(
      expect.arrayContaining(['price_drop', 'lowest_price', 'vendor_gap', 'new_item', 'sold_out', 'restocked'])
    )
  })
})
