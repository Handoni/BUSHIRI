import { describe, expect, it } from 'vitest'
import worker from '../index'
import type { Env } from '../env'

function createCorsEnv(origin: string): Env {
  return {
    DB: {
      prepare() {
        throw new Error('DB should not be used')
      }
    },
    ADMIN_TOKEN: 'dev-admin-token',
    CORS_ALLOWED_ORIGINS: origin,
    LLM_PROVIDER: 'pydantic_ai',
    LLM_MODEL: 'gemma-3-27b-it',
    APP_TIMEZONE: 'Asia/Seoul',
    RAW_POST_RETENTION_DAYS: '30',
    COLLECT_LOOKBACK_HOURS: '30'
  }
}

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

  it('allows the deployed Pages origin in CORS responses', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/health', {
        headers: {
          origin: 'https://bushiri-46o.pages.dev'
        }
      })
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://bushiri-46o.pages.dev'
    )
    expect(response.headers.get('Vary')).toBe('Origin')
  })

  it('allows configured CORS origins', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/health', {
        headers: {
          origin: 'https://preview.example.com'
        }
      }),
      createCorsEnv('https://preview.example.com')
    )

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://preview.example.com'
    )
  })
})
