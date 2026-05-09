import { describe, expect, it } from 'vitest'
import { buildDailyDiscordMessage, formatDiscordSummary } from './sendDiscord'

describe('formatDiscordSummary', () => {
  it('formats plain text sections for Discord alerts', () => {
    const message = formatDiscordSummary({
      marketDate: '2026-04-24',
      dashboardUrl: 'https://example.com/today',
      insights: [
        {
          insightType: 'price_drop',
          title: '자연산 광어 가격 하락',
          body: '자연산 광어: 18,000~20,000원/kg',
          canonicalName: '광어',
          severity: 'warning'
        },
        {
          insightType: 'new_item',
          title: '블루 킹크랩 신규 등장',
          body: '줄포상회: 블루 킹크랩 등장',
          canonicalName: '킹크랩',
          severity: 'notice'
        },
        {
          insightType: 'sold_out',
          title: '일부 품절',
          body: '일부 자연산 감성돔 마감',
          canonicalName: '감성돔',
          severity: 'notice'
        }
      ]
    })

    expect(message).toContain('🐟 2026-04-24 노량진 수산 시세 요약')
    expect(message).toContain('📉 가격 하락')
    expect(message).toContain('🆕 신규/특이')
    expect(message).toContain('⚠️ 마감/품절')
    expect(message).toContain('대시보드: https://example.com/today')
  })
})

describe('buildDailyDiscordMessage', () => {
  it('builds a Discord message with highlight sections and a watch select menu', () => {
    const payload = buildDailyDiscordMessage({
      marketDate: '2026-05-10',
      dashboardUrl: 'https://example.com/today?date=2026-05-10',
      highlights: [
        {
          canonicalName: '광어',
          signal: 'price_drop',
          title: '광어 가격 하락',
          body: '광어가 전일 대비 하락했습니다.'
        },
        {
          canonicalName: '킹크랩',
          signal: 'new_item',
          title: '킹크랩 신규 등장',
          body: '킹크랩이 새로 등장했습니다.'
        }
      ],
      watchedSummaries: [
        {
          canonicalName: '광어',
          summary: '성전물산 18,000원/kg · AI추천/최저가'
        }
      ],
      selectCandidates: [
        {
          canonicalName: '광어',
          reason: '가격 하락',
          watched: true
        },
        {
          canonicalName: '킹크랩',
          reason: '신규 등장',
          watched: false
        }
      ]
    })

    expect(payload.content).toContain('2026-05-10')
    expect(payload.content).toContain('가격 하락')
    expect(payload.content).toContain('예의주시')
    expect(payload.allowed_mentions).toEqual({ parse: [] })
    expect(payload.components?.[0]?.components?.[0]).toMatchObject({
      type: 3,
      custom_id: 'bushiri:watch:2026-05-10',
      min_values: 0,
      max_values: 2
    })
    expect(payload.components?.[0]?.components?.[0]?.options?.[0]).toMatchObject({
      label: '광어',
      value: '광어',
      default: true
    })
  })
})
