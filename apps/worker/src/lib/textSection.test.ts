import { describe, expect, it } from 'vitest'
import { extractMarketText } from './textSection'

describe('extractMarketText', () => {
  it('removes operational sections and keeps market lines', () => {
    const input = [
      '오늘 시세표',
      '국내산 광어 2~3kg kg 4.8',
      '배송 안내',
      '전화번호 010-9659-7311',
      '일본산 참돔 1.5~2kg 32,000원'
    ].join('\n')

    expect(extractMarketText(input)).toBe(['오늘 시세표', '국내산 광어 2~3kg kg 4.8', '일본산 참돔 1.5~2kg 32,000원'].join('\n'))
  })
})
