import type { InsightRecord, InsightSeverity, InsightType } from '../types/domain'

type InsightItem = {
  sourceId: number
  sourceName: string
  marketDate: string
  category: 'fish' | 'crustacean' | 'shellfish' | 'salmon' | 'other'
  canonicalName: string
  displayName: string
  compareKey: string
  origin: string | null
  productionType: string | null
  freshnessState: string | null
  grade: string | null
  sizeMinKg: number | null
  sizeMaxKg: number | null
  pricePerKg: number | null
  soldOut: boolean
  eventFlag: boolean
}

function createInsight(
  insightType: InsightType,
  severity: InsightSeverity,
  canonicalName: string | null,
  title: string,
  body: string
): InsightRecord {
  return { insightType, severity, canonicalName, title, body }
}

function averagePrice(items: InsightItem[]): number | null {
  const prices = items.map((item) => item.pricePerKg).filter((value): value is number => value !== null)
  if (prices.length === 0) {
    return null
  }

  return prices.reduce((sum, value) => sum + value, 0) / prices.length
}

export function generateInsights(input: {
  marketDate: string
  todayItems: InsightItem[]
  historicalItems: InsightItem[]
}): InsightRecord[] {
  const insights: InsightRecord[] = []
  const todayByCompareKey = new Map<string, InsightItem[]>()

  for (const item of input.todayItems) {
    const bucket = todayByCompareKey.get(item.compareKey) ?? []
    bucket.push(item)
    todayByCompareKey.set(item.compareKey, bucket)
  }

  const previousDay = [...new Set(input.historicalItems.map((item) => item.marketDate))]
    .filter((date) => date < input.marketDate)
    .sort()
    .at(-1)

  const previousDayItems = input.historicalItems.filter((item) => item.marketDate === previousDay)
  const previousByCompareKey = new Map<string, InsightItem[]>()
  for (const item of previousDayItems) {
    const bucket = previousByCompareKey.get(item.compareKey) ?? []
    bucket.push(item)
    previousByCompareKey.set(item.compareKey, bucket)
  }

  for (const [compareKey, items] of todayByCompareKey) {
    const todayAverage = averagePrice(items)
    const previousAverage = averagePrice(previousByCompareKey.get(compareKey) ?? [])
    const canonicalName = items[0]?.canonicalName ?? null

    if (todayAverage !== null && previousAverage !== null && previousAverage > 0) {
      const deltaRatio = (todayAverage - previousAverage) / previousAverage
      if (deltaRatio <= -0.15) {
        insights.push(
          createInsight('price_drop', 'warning', canonicalName, `${canonicalName} 가격 하락`, `${canonicalName}: 전일 대비 하락`)
        )
      }

      if (deltaRatio >= 0.15) {
        insights.push(
          createInsight('price_spike', 'warning', canonicalName, `${canonicalName} 가격 상승`, `${canonicalName}: 전일 대비 상승`)
        )
      }
    }

    const last14Days = input.historicalItems.filter((item) => item.compareKey === compareKey).map((item) => item.pricePerKg).filter((value): value is number => value !== null)
    if (todayAverage !== null && (last14Days.length === 0 || todayAverage <= Math.min(...last14Days))) {
      insights.push(
        createInsight('lowest_price', 'notice', canonicalName, `${canonicalName} 최근 최저가`, `${canonicalName}: 최근 14일 최저가`)
      )
    }

    const priceValues = items.map((item) => item.pricePerKg).filter((value): value is number => value !== null)
    if (priceValues.length >= 2) {
      const min = Math.min(...priceValues)
      const max = Math.max(...priceValues)
      if (min > 0 && max / min >= 1.2) {
        insights.push(
          createInsight('vendor_gap', 'notice', canonicalName, `${canonicalName} 판매처 간 가격차`, `${canonicalName}: 판매처 가격 차이 감지`)
        )
      }
    }
  }

  for (const item of input.todayItems) {
    const seenRecently = input.historicalItems.some(
      (historical) =>
        historical.canonicalName === item.canonicalName &&
        historical.origin === item.origin &&
        historical.productionType === item.productionType
    )

    if (!seenRecently) {
      insights.push(
        createInsight('new_item', 'notice', item.canonicalName, `${item.displayName} 신규 등장`, `${item.sourceName}: ${item.displayName} 등장`)
      )
    }

    const previousItem = previousDayItems.find(
      (historical) => historical.sourceId === item.sourceId && historical.compareKey === item.compareKey
    )

    if (previousItem && !previousItem.soldOut && item.soldOut) {
      insights.push(
        createInsight('sold_out', 'notice', item.canonicalName, `${item.displayName} 품절`, `${item.sourceName}: ${item.displayName} 마감`)
      )
    }

    if (previousItem && previousItem.soldOut && !item.soldOut) {
      insights.push(
        createInsight('restocked', 'notice', item.canonicalName, `${item.displayName} 재입고`, `${item.sourceName}: ${item.displayName} 재입고`)
      )
    }
  }

  return insights
}
