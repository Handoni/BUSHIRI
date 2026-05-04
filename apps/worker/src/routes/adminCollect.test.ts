import { describe, expect, it } from 'vitest'
import type { D1DatabaseBinding, D1PreparedStatement, Env } from '../env'
import worker from '../index'
import { handleAdminCollectTestBand } from './adminCollect'
import type { BandClient } from '../clients/bandClient'
import { BandPageError, type BandPageClient } from '../clients/bandPageClient'

type BandApiSourceRow = {
  id: number
  vendor_name: string
  band_key: string | null
  source_mode: 'band_api' | 'band_page'
}

function createFakeEnv(rows: BandApiSourceRow[]): Env {
  const db: D1DatabaseBinding = {
    prepare(): D1PreparedStatement {
      return {
        bind() {
          return this
        },
        async first() {
          return null
        },
        async all() {
          return { results: rows }
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
    BAND_ACCESS_TOKEN: 'band-token',
    LLM_PROVIDER: 'pydantic_ai',
    LLM_MODEL: 'gemma-3-27b-it',
    APP_TIMEZONE: 'Asia/Seoul',
    RAW_POST_RETENTION_DAYS: '30',
    COLLECT_LOOKBACK_HOURS: '30'
  }
}

describe('POST /api/admin/collect/test-band', () => {
  it('rejects requests without a bearer token', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/admin/collect/test-band', {
        method: 'POST'
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Unauthorized'
    })
  })

  it('returns latest posts for visible BAND sources', async () => {
    const env = createFakeEnv([
      {
        id: 1,
        vendor_name: '성전물산',
        band_key: 'band-1',
        source_mode: 'band_api'
      }
    ])

    const client: BandClient = {
      async getBands() {
        return [
          {
            name: '성전물산 밴드',
            bandKey: 'band-1',
            cover: null,
            memberCount: 10
          }
        ]
      },
      async getPosts() {
        return [
          {
            postKey: 'post-1',
            bandKey: 'band-1',
            content: '오늘 시세표 1',
            createdAt: Date.UTC(2026, 3, 24, 1, 0, 0)
          },
          {
            postKey: 'post-2',
            bandKey: 'band-1',
            content: '오늘 시세표 2',
            createdAt: Date.UTC(2026, 3, 24, 0, 0, 0)
          }
        ]
      }
    }

    const response = await handleAdminCollectTestBand(
      new Request('https://example.com/api/admin/collect/test-band', {
        method: 'POST',
        headers: {
          authorization: 'Bearer dev-admin-token'
        }
      }),
      env,
      client
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      bands: [
        {
          sourceId: 1,
          sourceName: '성전물산',
          bandKey: 'band-1',
          sourceMode: 'band_api',
          visibleInGetBands: true,
          canReadPosts: true,
          latestPosts: [
            {
              postKey: 'post-1',
              contentPreview: '오늘 시세표 1'
            },
            {
              postKey: 'post-2',
              contentPreview: '오늘 시세표 2'
            }
          ]
        }
      ]
    })
  })

  it('returns a clear reason when a configured source is not in Get Bands', async () => {
    const env = createFakeEnv([
      {
        id: 1,
        vendor_name: '성전물산',
        band_key: 'band-1',
        source_mode: 'band_api'
      }
    ])

    const client: BandClient = {
      async getBands() {
        return []
      },
      async getPosts() {
        return []
      }
    }

    const response = await handleAdminCollectTestBand(
      new Request('https://example.com/api/admin/collect/test-band', {
        method: 'POST',
        headers: {
          authorization: 'Bearer dev-admin-token'
        }
      }),
      env,
      client
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      bands: [
        {
          sourceId: 1,
          sourceMode: 'band_api',
          visibleInGetBands: false,
          canReadPosts: false,
          failureReason: 'band_not_found_in_get_bands'
        }
      ]
    })
  })

  it('returns latest posts for BAND Page sources without calling Get Bands', async () => {
    const env = createFakeEnv([
      {
        id: 2,
        vendor_name: '참조은수산',
        band_key: 'page:96034341',
        source_mode: 'band_page'
      }
    ])

    const client: BandClient = {
      async getBands() {
        throw new Error('Get Bands should not be called for band_page sources')
      },
      async getPosts() {
        throw new Error('Open API posts should not be called for band_page sources')
      }
    }
    const pageClient: BandPageClient = {
      async getPosts() {
        return [
          {
            postKey: '1795',
            pageId: '96034341',
            content: '참조은수산 오늘 시세표',
            createdAt: Date.UTC(2026, 4, 4, 1, 0, 0),
            url: 'https://www.band.us/page/96034341/post/1795',
            title: '오늘 시세표',
            isPartial: false
          }
        ]
      }
    }

    const response = await handleAdminCollectTestBand(
      new Request('https://example.com/api/admin/collect/test-band', {
        method: 'POST',
        headers: {
          authorization: 'Bearer dev-admin-token'
        }
      }),
      env,
      client,
      pageClient
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      bands: [
        {
          sourceId: 2,
          sourceName: '참조은수산',
          bandKey: 'page:96034341',
          sourceMode: 'band_page',
          visibleInGetBands: false,
          canReadPosts: true,
          latestPostCollectedAt: '2026-05-04T01:00:00.000Z',
          latestPosts: [
            {
              postKey: '1795',
              contentPreview: '참조은수산 오늘 시세표'
            }
          ]
        }
      ]
    })
  })

  it('returns a clear reason when a BAND Page source needs a web cookie', async () => {
    const env = createFakeEnv([
      {
        id: 2,
        vendor_name: '참조은수산',
        band_key: 'page:96034341',
        source_mode: 'band_page'
      }
    ])
    const client: BandClient = {
      async getBands() {
        return []
      },
      async getPosts() {
        return []
      }
    }
    const pageClient: BandPageClient = {
      async getPosts() {
        throw new BandPageError('page_cookie_missing', 'BAND_WEB_COOKIE is required')
      }
    }

    const response = await handleAdminCollectTestBand(
      new Request('https://example.com/api/admin/collect/test-band', {
        method: 'POST',
        headers: {
          authorization: 'Bearer dev-admin-token'
        }
      }),
      env,
      client,
      pageClient
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      bands: [
        {
          sourceId: 2,
          sourceMode: 'band_page',
          canReadPosts: false,
          failureReason: 'page_cookie_missing'
        }
      ]
    })
  })
})
