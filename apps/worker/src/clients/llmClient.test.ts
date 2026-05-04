import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Env } from '../env'
import { createLlmClient } from './llmClient'

const parsedMarketPost = {
  vendorName: '성전물산',
  marketDate: '2026-04-24',
  categoryHint: 'fish',
  warnings: [],
  items: [
    {
      category: 'fish',
      canonicalName: '광어',
      displayName: '자연산 광어',
      origin: '국내산',
      productionType: '자연산',
      freshnessState: null,
      grade: null,
      sizeMinKg: 2,
      sizeMaxKg: 3,
      unit: 'kg',
      pricePerKg: 48000,
      priceText: 'kg 4.8',
      soldOut: false,
      eventFlag: false,
      halfAvailable: false,
      notes: null,
      confidence: 0.92
    }
  ]
} as const

function createEnv(): Env & { LLM_PIPELINE_URL: string; LLM_PIPELINE_TOKEN: string } {
  return {
    DB: {} as Env['DB'],
    ADMIN_TOKEN: 'admin-token',
    LLM_PROVIDER: 'pydantic_ai',
    LLM_MODEL: 'gemma-3-27b-it',
    LLM_PIPELINE_URL: 'https://llm.example.com/parse-market-post',
    LLM_PIPELINE_TOKEN: 'pipeline-token',
    APP_TIMEZONE: 'Asia/Seoul',
    RAW_POST_RETENTION_DAYS: '30',
    COLLECT_LOOKBACK_HOURS: '30'
  }
}

describe('createLlmClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sends market text to the configured PydanticAI pipeline using Gemma 3 27B', async () => {
    const fetchMock = vi.fn(async () => Response.json(parsedMarketPost))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createLlmClient(createEnv()).parseMarketPost({
      vendorName: '성전물산',
      rawText: '광어 kg 4.8'
    })

    expect(result).toEqual(parsedMarketPost)
    expect(fetchMock).toHaveBeenCalledWith('https://llm.example.com/parse-market-post', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer pipeline-token',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gemma-3-27b-it',
        vendorName: '성전물산',
        rawText: '광어 kg 4.8'
      })
    })
  })
})
