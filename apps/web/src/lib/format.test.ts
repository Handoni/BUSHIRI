import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDate } from './format'

describe('Korean formatting', () => {
  it('formats KRW and dates for the dashboard', () => {
    expect(formatCurrency(18000, 'KRW')).toContain('18,000')
    expect(formatDate('2026-04-24T00:00:00.000Z')).toContain('2026')
    expect(formatDate('2026-04-24T00:00:00.000Z')).toContain('오전')
  })
})
