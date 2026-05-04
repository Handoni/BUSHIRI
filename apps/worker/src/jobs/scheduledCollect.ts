import type { D1DatabaseBinding, Env } from '../env'

async function createCollectionRun(db: D1DatabaseBinding, runType: 'scheduled' | 'manual' | 'test'): Promise<number> {
  const result = await db
    .prepare('INSERT INTO collection_runs (run_type, status) VALUES (?1, ?2)')
    .bind(runType, 'running')
    .run()

  return Number(result.meta.last_row_id)
}

async function finalizeCollectionRun(
  db: D1DatabaseBinding,
  runId: number,
  status: 'success' | 'partial_failed' | 'failed',
  message: string | null
): Promise<void> {
  await db
    .prepare('UPDATE collection_runs SET status = ?1, message = ?2, finished_at = CURRENT_TIMESTAMP WHERE id = ?3')
    .bind(status, message, runId)
    .run()
}

async function purgeRawPosts(_db: D1DatabaseBinding, _retentionDays: number): Promise<void> {
  return
}

export async function runScheduledCollect(env: Env): Promise<void> {
  const runId = await createCollectionRun(env.DB, 'scheduled')

  try {
    await purgeRawPosts(env.DB, Number(env.RAW_POST_RETENTION_DAYS))
    await finalizeCollectionRun(env.DB, runId, 'success', 'Scheduled collection completed')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scheduled collection failed'
    await finalizeCollectionRun(env.DB, runId, 'partial_failed', message)
    throw error
  }
}
