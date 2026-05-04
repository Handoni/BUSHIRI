import { describe, expect, it } from 'vitest'
import type { D1DatabaseBinding, D1PreparedStatement, Env } from '../env'
import worker from '../index'

function createFakeEnv() {
  const collectionRuns: Array<{ status: string; message: string | null; runType: string }> = []

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
          return { results: [] }
        },
        async run() {
          if (query.startsWith('INSERT INTO collection_runs')) {
            collectionRuns.push({ runType: String(boundValues[0]), status: 'running', message: null })
            return { meta: { last_row_id: collectionRuns.length } }
          }

          if (query.startsWith('UPDATE collection_runs')) {
            const run = collectionRuns[collectionRuns.length - 1]
            run.status = String(boundValues[0])
            run.message = boundValues[1] === null ? null : String(boundValues[1])
          }

          return { meta: {} }
        }
      }
    }
  }

  const env: Env = {
    DB: db,
    ADMIN_TOKEN: 'dev-admin-token',
    LLM_PROVIDER: 'pydantic_ai',
    LLM_MODEL: 'gemma-3-27b-it',
    APP_TIMEZONE: 'Asia/Seoul',
    RAW_POST_RETENTION_DAYS: '30',
    COLLECT_LOOKBACK_HOURS: '30'
  }

  return { env, collectionRuns }
}

describe('worker scheduled()', () => {
  it('creates and completes a scheduled collection run log', async () => {
    const { env, collectionRuns } = createFakeEnv()
    let scheduledWork: Promise<unknown> | null = null

    await worker.scheduled(
      { cron: '0 23 * * *', scheduledTime: Date.now(), type: 'scheduled' },
      env,
      {
        waitUntil(promise) {
          scheduledWork = promise
        }
      }
    )

    if (!scheduledWork) {
      throw new Error('scheduled work was not registered')
    }

    await Promise.resolve(scheduledWork)

    expect(collectionRuns).toEqual([
      {
        runType: 'scheduled',
        status: 'success',
        message: 'Scheduled collection completed'
      }
    ])
  })
})
