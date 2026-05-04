import { describe, expect, it } from 'vitest'
import { hashText } from './hash'

describe('hashText', () => {
  it('returns the same hash for the same text and a different hash for changed text', async () => {
    const first = await hashText('same text')
    const second = await hashText('same text')
    const different = await hashText('different text')

    expect(first).toBe(second)
    expect(first).not.toBe(different)
    expect(first).toHaveLength(64)
  })
})
