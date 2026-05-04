import { describe, expect, it } from 'vitest'
import worker from '../index'

describe('GET /api/health', () => {
  it('returns ok status payload', async () => {
    const response = await worker.fetch(new Request('https://example.com/api/health'))
    const bodyText = await response.text()

    expect(response.status).toBe(200)
    expect(JSON.parse(bodyText)).toEqual({
      ok: true,
      service: 'BUSHIRI'
    })
  })
})
