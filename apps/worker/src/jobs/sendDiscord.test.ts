import { describe, expect, it } from 'vitest'
import { formatDiscordSummary } from './sendDiscord'

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
