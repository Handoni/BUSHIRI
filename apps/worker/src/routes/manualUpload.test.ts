import { describe, expect, it } from 'vitest'
import type { D1DatabaseBinding, D1PreparedStatement, Env } from '../env'
import worker from '../index'
import { handleManualUpload } from './manualUpload'

type SourceRow = {
  id: number
}

type RawPostRow = {
  id: number
  source_id: number
  post_key: string | null
  posted_at: string | null
  revision_no: number
  title: string | null
  raw_content_masked: string
  content_hash: string
  parse_status: string
}

function createFakeEnv(initialRawPosts: RawPostRow[] = []): Env {
  const sources: SourceRow[] = [{ id: 1 }]
  const rawPosts = [...initialRawPosts]
  let nextId = rawPosts.reduce((maxId, row) => Math.max(maxId, row.id), 0) + 1

  const db: D1DatabaseBinding = {
    prepare(query: string): D1PreparedStatement {
      let boundValues: Array<string | number | null> = []

      return {
        bind(...values) {
          boundValues = values
          return this
        },
        async first() {
          if (query.startsWith('SELECT id FROM sources')) {
            const sourceId = Number(boundValues[0])
            return sources.find((source) => source.id === sourceId) ?? null
          }

          if (query.includes('WHERE source_id = ?1 AND content_hash = ?2')) {
            const sourceId = Number(boundValues[0])
            const contentHash = String(boundValues[1])
            return [...rawPosts]
              .reverse()
              .find((row) => row.source_id === sourceId && row.content_hash === contentHash) ?? null
          }

          if (query.includes('WHERE source_id = ?1 AND post_key = ?2')) {
            const sourceId = Number(boundValues[0])
            const postKey = String(boundValues[1])
            return [...rawPosts]
              .sort((left, right) => right.revision_no - left.revision_no)
              .find((row) => row.source_id === sourceId && row.post_key === postKey) ?? null
          }

          if (query.includes('WHERE id = ?1')) {
            const rawPostId = Number(boundValues[0])
            return rawPosts.find((row) => row.id === rawPostId) ?? null
          }

          return null
        },
        async all() {
          return { results: [] }
        },
        async run() {
          const row: RawPostRow = {
            id: nextId,
            source_id: Number(boundValues[0]),
            post_key: boundValues[1] === null ? null : String(boundValues[1]),
            posted_at: boundValues[2] === null ? null : String(boundValues[2]),
            revision_no: Number(boundValues[3]),
            title: boundValues[4] === null ? null : String(boundValues[4]),
            raw_content_masked: String(boundValues[5]),
            content_hash: String(boundValues[6]),
            parse_status: 'pending'
          }

          rawPosts.push(row)
          nextId += 1

          return { meta: { last_row_id: row.id } }
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

describe('POST /api/admin/manual-post', () => {
  it('rejects requests without a bearer token', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/api/admin/manual-post', {
        method: 'POST'
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'Unauthorized'
    })
  })

  it('stores masked raw content for an authorized manual upload', async () => {
    const env = createFakeEnv()

    const response = await handleManualUpload(
      new Request('https://example.com/api/admin/manual-post', {
        method: 'POST',
        headers: {
          authorization: 'Bearer dev-admin-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sourceId: 1,
          postKey: 'manual-1',
          rawContent: '010-9659-7311\n국민은행 54270201236744\nhttps://open.kakao.com/s/example'
        })
      }),
      env
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      duplicate: false,
      rawPost: {
        id: 1,
        sourceId: 1,
        postKey: 'manual-1',
        revisionNo: 1,
        rawContentMasked: '010-****-7311\n국민은행 ****6744\n[URL]',
        parseStatus: 'pending'
      }
    })
  })

  it('skips duplicate manual uploads with the same masked content', async () => {
    const env = createFakeEnv()
    const request = new Request('https://example.com/api/admin/manual-post', {
      method: 'POST',
      headers: {
        authorization: 'Bearer dev-admin-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sourceId: 1,
        postKey: 'manual-1',
        rawContent: '010-9659-7311\n국민은행 54270201236744'
      })
    })

    await handleManualUpload(request.clone(), env)
    const duplicateResponse = await handleManualUpload(request, env)

    expect(duplicateResponse.status).toBe(200)
    await expect(duplicateResponse.json()).resolves.toMatchObject({
      ok: true,
      duplicate: true,
      rawPost: {
        id: 1,
        revisionNo: 1
      }
    })
  })

  it('creates a new revision when the same post key changes content', async () => {
    const env = createFakeEnv()

    await handleManualUpload(
      new Request('https://example.com/api/admin/manual-post', {
        method: 'POST',
        headers: {
          authorization: 'Bearer dev-admin-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sourceId: 1,
          postKey: 'manual-1',
          rawContent: '첫 번째 내용'
        })
      }),
      env
    )

    const response = await handleManualUpload(
      new Request('https://example.com/api/admin/manual-post', {
        method: 'POST',
        headers: {
          authorization: 'Bearer dev-admin-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sourceId: 1,
          postKey: 'manual-1',
          rawContent: '수정된 두 번째 내용'
        })
      }),
      env
    )

    expect(response.status).toBe(201)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      duplicate: false,
      rawPost: {
        id: 2,
        revisionNo: 2,
        postKey: 'manual-1'
      }
    })
  })
})
