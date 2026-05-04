import { describe, expect, it } from 'vitest'
import { maskSensitive } from './maskSensitive'

describe('maskSensitive', () => {
  it('masks phone numbers, bank accounts, and URLs', () => {
    const input = [
      '연락처 010-9659-7311',
      '국민은행 54270201236744',
      'https://open.kakao.com/s/example'
    ].join('\n')

    expect(maskSensitive(input)).toContain('010-****-7311')
    expect(maskSensitive(input)).toContain('국민은행 ****6744')
    expect(maskSensitive(input)).toContain('[URL]')
  })
})
