import type { InsightRecord } from '../types/domain'
import type { DiscordMessagePayload } from '../clients/discordClient'

export type DailyDiscordHighlight = {
  canonicalName: string
  signal: 'new_item' | 'price_drop' | 'lowest_price'
  title: string
  body: string
}

export type DailyDiscordWatchedSummary = {
  canonicalName: string
  summary: string
}

export type DailyDiscordSelectCandidate = {
  canonicalName: string
  reason: string
  watched: boolean
}

type DiscordStringSelect = {
  type: 3
  custom_id: string
  options: Array<{
    label: string
    value: string
    description?: string
    default?: boolean
  }>
  placeholder: string
  min_values: number
  max_values: number
}

type DiscordActionRow = {
  type: 1
  components: [DiscordStringSelect]
}

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

function signalLabel(signal: DailyDiscordHighlight['signal']): string {
  switch (signal) {
    case 'new_item':
      return '신규'
    case 'price_drop':
      return '가격 하락'
    case 'lowest_price':
      return '최근 최저'
  }
}

function truncateText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 1))}…`
}

function buildHighlightLines(highlights: DailyDiscordHighlight[]): string[] {
  if (highlights.length === 0) {
    return ['- 신규/하락/최저 신호가 없습니다.']
  }

  return highlights.map((highlight) => `- [${signalLabel(highlight.signal)}] ${highlight.body}`)
}

function buildWatchedLines(watchedSummaries: DailyDiscordWatchedSummary[]): string[] {
  if (watchedSummaries.length === 0) {
    return ['- 오늘 시세에 잡힌 관심 품목이 없습니다.']
  }

  return watchedSummaries.map((item) => `- ${item.canonicalName}: ${item.summary}`)
}

function buildSelectComponent(marketDate: string, candidates: DailyDiscordSelectCandidate[]): DiscordActionRow[] | undefined {
  const options = candidates.slice(0, 25).map((candidate) => ({
    label: truncateText(candidate.canonicalName, 100),
    value: truncateText(candidate.canonicalName, 100),
    description: truncateText(candidate.reason, 100),
    default: candidate.watched
  }))

  if (options.length === 0) {
    return undefined
  }

  return [
    {
      type: 1,
      components: [
        {
          type: 3,
          custom_id: `bushiri:watch:${marketDate}`,
          options,
          placeholder: '관심 품목을 선택하세요',
          min_values: 0,
          max_values: options.length
        }
      ]
    }
  ]
}

export function buildDailyDiscordMessage(input: {
  marketDate: string
  dashboardUrl: string
  highlights: DailyDiscordHighlight[]
  watchedSummaries: DailyDiscordWatchedSummary[]
  selectCandidates: DailyDiscordSelectCandidate[]
}): DiscordMessagePayload {
  const lines = [
    `🐟 ${input.marketDate} 노량진 수산 시세 알림`,
    '',
    '주목할 품목',
    ...buildHighlightLines(input.highlights),
    '',
    '관심 품목',
    ...buildWatchedLines(input.watchedSummaries),
    '',
    `대시보드: ${input.dashboardUrl}`
  ]

  return {
    content: truncateText(lines.join('\n'), 1900),
    allowed_mentions: { parse: [] },
    components: buildSelectComponent(input.marketDate, input.selectCandidates)
  }
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
