import { describe, expect, it } from 'vitest'
import type { D1DatabaseBinding, D1PreparedStatement, Env } from '../env'
import worker from '../index'

function createFakeEnv(): Env {
  const db: D1DatabaseBinding = {
    prepare(query: string): D1PreparedStatement {
      let boundValues: Array<string | number | null> = []

      return {
        bind(...values) {
          boundValues = values
          return this
        },
        async first() {
          return null
        },
        async all() {
          if (query.includes('FROM item_snapshots') && query.includes('market_date = ?1')) {
            return {
              results: [
                {
                  id: 1,
                  source_id: 1,
                  vendor_name: '성전물산',
                  market_date: String(boundValues[0]),
                  category: 'fish',
                  canonical_name: '광어',
                  display_name: '자연산 광어',
                  origin: '국내산',
                  production_type: '자연산',
                  freshness_state: null,
                  grade: null,
                  size_min_kg: 2,
                  size_max_kg: 3,
                  unit: 'kg',
                  price_per_kg: 18000,
                  price_text: 'kg 1.8만원',
                  sold_out: 0,
                  event_flag: 0,
                  half_available: 1,
                  packing_note: null,
                  notes: '찍어바리',
                  best_condition_flag: 1,
                  lowest_price_flag: 0,
                  ai_recommendation_flag: 1
                }
              ]
            }
          }

          if (query.includes('FROM item_snapshots') && query.includes('canonical_name = ?1')) {
            return {
              results: [
                {
                  market_date: '2026-04-24',
                  source_id: 1,
                  vendor_name: '성전물산',
                  canonical_name: '광어',
                  display_name: '자연산 광어',
                  price_per_kg: 18000,
                  origin: '국내산',
                  production_type: '자연산',
                  freshness_state: '활',
                  grade: 'A급',
                  size_min_kg: 2,
                  size_max_kg: 3,
                  notes: '등급은 비교키에 반영하지 않음'
                }
              ]
            }
          }

          if (query.includes('FROM insights')) {
            return {
              results: [
                {
                  insight_type: 'price_drop',
                  severity: 'warning',
                  canonical_name: '광어',
                  title: '광어 가격 하락',
                  body: '광어: 전일 대비 하락'
                }
              ]
            }
          }

          if (query.includes('FROM raw_posts')) {
            return {
              results: [
                {
                  id: 1,
                  source_id: 1,
                  vendor_name: '성전물산',
                  post_key: 'manual-1',
                  posted_at: '2026-04-24T00:00:00.000Z',
                  revision_no: 1,
                  title: '오늘 시세표',
                  raw_content_masked: '010-****-7311',
                  parse_status: 'parsed',
                  parse_error: null
                }
              ]
            }
          }

          return { results: [] }
        },
        async run() {
          return { meta: {} }
        }
      }
    }
  }

  return {
    DB: db,
    ADMIN_TOKEN: 'dev-admin-token',
    LLM_PROVIDER: 'pydantic_ai',
    LLM_MODEL: 'gemma-3-27b-it',
    APP_TIMEZONE: 'Asia/Seoul',
    RAW_POST_RETENTION_DAYS: '30',
    COLLECT_LOOKBACK_HOURS: '30'
  }
}

describe('market and admin read routes', () => {
  it('requests market today rows in snapshot insertion order', async () => {
    const preparedQueries: string[] = []
    const db: D1DatabaseBinding = {
      prepare(query: string): D1PreparedStatement {
        preparedQueries.push(query)

        return {
          bind() {
            return this
          },
          async first() {
            return null
          },
          async all() {
            return { results: [] }
          },
          async run() {
            return { meta: {} }
          }
        }
      }
    }

    await worker.fetch(new Request('https://example.com/api/market/today?date=2026-04-24'), {
      ...createFakeEnv(),
      DB: db
    })

    expect(preparedQueries[0]).toContain('ORDER BY i.id ASC')
  })

  it('returns market today snapshots', async () => {
    const response = await worker.fetch(new Request('https://example.com/api/market/today?date=2026-04-24'), createFakeEnv())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      items: [
        {
          canonicalName: '광어',
          sourceName: '성전물산',
          marketDate: '2026-04-24',
          displayName: '자연산 광어',
          origin: '국내산',
          productionType: '자연산',
          unit: 'kg',
          priceText: 'kg 1.8만원',
          halfAvailable: true,
          notes: '찍어바리',
          bestCondition: true,
          lowestPrice: false,
          aiRecommended: true
        }
      ]
    })
  })

  it('returns species trend history', async () => {
    const response = await worker.fetch(new Request('https://example.com/api/market/species/%EA%B4%91%EC%96%B4?days=30'), createFakeEnv())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      items: [
        {
          canonicalName: '광어',
          sourceName: '성전물산',
          compareKey: '성전물산|국내산',
          displayName: '자연산 광어',
          productionType: '자연산',
          grade: 'A급',
          notes: '등급은 비교키에 반영하지 않음'
        }
      ]
    })
  })

  it('returns daily insights', async () => {
    const response = await worker.fetch(new Request('https://example.com/api/insights?date=2026-04-24'), createFakeEnv())

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      insights: [
        {
          insightType: 'price_drop',
          canonicalName: '광어'
        }
      ]
    })
  })

  it('returns masked raw posts for admins', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/admin/raw-posts', {
        headers: {
          authorization: 'Bearer dev-admin-token'
        }
      }),
      createFakeEnv()
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      rawPosts: [
        {
          id: 1,
          sourceName: '성전물산',
          rawContentMasked: '010-****-7311'
        }
      ]
    })
  })
})
