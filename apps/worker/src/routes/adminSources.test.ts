import { describe, expect, it } from 'vitest'
import type { D1DatabaseBinding, D1PreparedStatement, Env } from '../env'
import worker from '../index'

type SourceRow = {
  id: number
  name: string
  vendor_name: string
  vendor_type: string
  band_key: string | null
  source_mode: string
  price_notation: string
  is_active: number
  created_at: string
  updated_at: string
}

function createFakeEnv(seed: SourceRow[] = []): Env {
  const rows = [...seed]
  let nextId = rows.reduce((maxId, row) => Math.max(maxId, row.id), 0) + 1

  const db: D1DatabaseBinding = {
    prepare(query: string): D1PreparedStatement {
      let boundValues: Array<string | number | null> = []

      return {
        bind(...values) {
          boundValues = values
          return this
        },
        async first() {
          const id = Number(boundValues[0])
          return rows.find((row) => row.id === id) ?? null
        },
        async all() {
          return {
            results: [...rows].sort((left, right) => {
              if (left.is_active !== right.is_active) {
                return right.is_active - left.is_active
              }

              return left.id - right.id
            })
          }
        },
        async run() {
          if (query.startsWith('INSERT INTO sources')) {
            const row: SourceRow = {
              id: nextId,
              name: String(boundValues[0]),
              vendor_name: String(boundValues[1]),
              vendor_type: String(boundValues[2]),
              band_key: boundValues[3] === null ? null : String(boundValues[3]),
              source_mode: String(boundValues[4]),
              price_notation: String(boundValues[5]),
              is_active: Number(boundValues[6]),
              created_at: '2026-04-24 12:10:00',
              updated_at: '2026-04-24 12:10:00'
            }

            rows.push(row)
            nextId += 1

            return { meta: { last_row_id: row.id } }
          }

          if (query.startsWith('UPDATE sources SET')) {
            const id = Number(boundValues[boundValues.length - 1])
            const row = rows.find((entry) => entry.id === id)

            if (!row) {
              return { meta: {} }
            }

            let valueIndex = 0

            if (query.includes('name = ?')) {
              row.name = String(boundValues[valueIndex])
              valueIndex += 1
            }

            if (query.includes('vendor_name = ?')) {
              row.vendor_name = String(boundValues[valueIndex])
              valueIndex += 1
            }

            if (query.includes('vendor_type = ?')) {
              row.vendor_type = String(boundValues[valueIndex])
              valueIndex += 1
            }

            if (query.includes('band_key = ?')) {
              row.band_key = boundValues[valueIndex] === null ? null : String(boundValues[valueIndex])
              valueIndex += 1
            }

            if (query.includes('source_mode = ?')) {
              row.source_mode = String(boundValues[valueIndex])
              valueIndex += 1
            }

            if (query.includes('price_notation = ?')) {
              row.price_notation = String(boundValues[valueIndex])
              valueIndex += 1
            }

            if (query.includes('is_active = ?')) {
              row.is_active = Number(boundValues[valueIndex])
              valueIndex += 1
            }

            row.updated_at = '2026-04-24 12:15:00'
          }

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

const SEEDED_SOURCES: SourceRow[] = [
  {
    id: 1,
    name: '성전물산 밴드',
    vendor_name: '성전물산',
    vendor_type: 'fish',
    band_key: null,
    source_mode: 'band_api',
    price_notation: 'manwon',
    is_active: 1,
    created_at: '2026-04-24 12:03:55',
    updated_at: '2026-04-24 12:03:55'
  },
  {
    id: 2,
    name: '줄포상회 밴드',
    vendor_name: '줄포상회',
    vendor_type: 'crustacean',
    band_key: null,
    source_mode: 'manual',
    price_notation: 'won',
    is_active: 1,
    created_at: '2026-04-24 12:03:55',
    updated_at: '2026-04-24 12:03:55'
  }
]

describe('POST /api/admin/sources', () => {
  it('rejects requests without a bearer token', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/admin/sources', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          name: '성전물산 밴드',
          vendorName: '성전물산',
          vendorType: 'fish',
          sourceMode: 'band_api',
          priceNotation: 'manwon'
        })
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Unauthorized'
    })
  })

  it('creates a source when the bearer token is valid', async () => {
    const env = createFakeEnv(SEEDED_SOURCES)

    const response = await worker.fetch(
      new Request('https://example.com/api/admin/sources', {
        method: 'POST',
        headers: {
          authorization: 'Bearer dev-admin-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          name: '테스트 수동 소스',
          vendorName: '테스트상회',
          vendorType: 'mixed',
          bandKey: 'test-band-key',
          sourceMode: 'manual',
          priceNotation: 'auto',
          isActive: true
        })
      }),
      env
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      source: {
        id: 3,
        name: '테스트 수동 소스',
        vendorName: '테스트상회',
        vendorType: 'mixed',
        bandKey: 'test-band-key',
        sourceMode: 'manual',
        priceNotation: 'auto',
        isActive: true
      }
    })
  })

  it('creates a BAND Page source when the bearer token is valid', async () => {
    const env = createFakeEnv(SEEDED_SOURCES)

    const response = await worker.fetch(
      new Request('https://example.com/api/admin/sources', {
        method: 'POST',
        headers: {
          authorization: 'Bearer dev-admin-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          name: '참조은수산 Page',
          vendorName: '참조은수산',
          vendorType: 'fish',
          bandKey: 'page:96034341',
          sourceMode: 'band_page',
          priceNotation: 'won',
          isActive: true
        })
      }),
      env
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      source: {
        id: 3,
        name: '참조은수산 Page',
        bandKey: 'page:96034341',
        sourceMode: 'band_page',
        priceNotation: 'won',
        isActive: true
      }
    })
  })
})

describe('GET /api/admin/sources', () => {
  it('returns configured sources for admins', async () => {
    const env = createFakeEnv(SEEDED_SOURCES)

    const response = await worker.fetch(
      new Request('https://example.com/api/admin/sources', {
        headers: {
          authorization: 'Bearer dev-admin-token'
        }
      }),
      env
    )

    expect(response.status).toBe(200)
    const payload = await response.json()

    expect(payload.ok).toBe(true)
    expect(Array.isArray(payload.sources)).toBe(true)
    expect(
      payload.sources.some(
        (source: Record<string, unknown>) =>
          source.id === 1 &&
          source.name === '성전물산 밴드' &&
          source.vendorName === '성전물산' &&
          source.sourceMode === 'band_api' &&
          source.priceNotation === 'manwon'
      )
    ).toBe(true)
  })
})

describe('GET /api/sources/status', () => {
  it('returns the current source statuses', async () => {
    const env = createFakeEnv(SEEDED_SOURCES)

    const response = await worker.fetch(new Request('https://example.com/api/sources/status'), env)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      sources: [
        {
          id: 1,
          name: '성전물산 밴드',
          vendorName: '성전물산',
          vendorType: 'fish',
          sourceMode: 'band_api',
          priceNotation: 'manwon',
          isActive: true
        },
        {
          id: 2,
          name: '줄포상회 밴드',
          vendorName: '줄포상회',
          vendorType: 'crustacean',
          sourceMode: 'manual',
          priceNotation: 'won',
          isActive: true
        }
      ]
    })
  })
})

describe('PATCH /api/admin/sources/:id', () => {
  it('updates editable source fields', async () => {
    const env = createFakeEnv(SEEDED_SOURCES)

    const response = await worker.fetch(
      new Request('https://example.com/api/admin/sources/2', {
        method: 'PATCH',
        headers: {
          authorization: 'Bearer dev-admin-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          priceNotation: 'auto',
          isActive: false
        })
      }),
      env
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      source: {
        id: 2,
        name: '줄포상회 밴드',
        priceNotation: 'auto',
        isActive: false
      }
    })
  })
})
