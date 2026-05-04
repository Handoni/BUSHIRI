import type { InsightRecord } from '../types/domain'

function linesForTypes(insights: InsightRecord[], types: string[]): string[] {
  return insights.filter((insight) => types.includes(insight.insightType)).map((insight) => `- ${insight.body}`)
}

export function formatDiscordSummary(input: {
  marketDate: string
  dashboardUrl: string
  insights: InsightRecord[]
}): string {
  const sections = [
    `🐟 ${input.marketDate} 노량진 수산 시세 요약`,
    '',
    '📉 가격 하락',
    ...linesForTypes(input.insights, ['price_drop', 'price_spike', 'lowest_price', 'vendor_gap']),
    '',
    '🆕 신규/특이',
    ...linesForTypes(input.insights, ['new_item', 'notable']),
    '',
    '⚠️ 마감/품절',
    ...linesForTypes(input.insights, ['sold_out', 'restocked']),
    '',
    `대시보드: ${input.dashboardUrl}`
  ]

  return sections.join('\n')
}

export async function sendDiscordSummary(input: {
  webhookUrl: string
  message: string
  fetchImpl?: typeof fetch
}): Promise<void> {
  const fetchImpl = input.fetchImpl ?? fetch
  let attempt = 0
  let delayMs = 250

  while (attempt < 4) {
    attempt += 1
    const response = await fetchImpl(input.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: input.message })
    })

    if (response.ok) {
      return
    }

    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after') ?? '1')
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))
      continue
    }

    if (response.status >= 500 && response.status < 600 && attempt < 4) {
      await new Promise((resolve) => setTimeout(resolve, delayMs))
      delayMs *= 2
      continue
    }

    throw new Error(`Discord webhook failed with status ${response.status}`)
  }
}
