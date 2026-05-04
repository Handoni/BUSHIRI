import type { D1DatabaseBinding, Env } from '../env'
import { hashText } from '../lib/hash'
import { maskSensitive } from '../lib/maskSensitive'

type ManualUploadInput = {
  sourceId: number
  rawContent: string
  title: string | null
  postKey: string | null
  postedAt: string | null
}

type ExistingRawPost = {
  id: number
  postKey: string | null
  revisionNo: number
  contentHash: string
}

type RawPostRecord = {
  id: number
  sourceId: number
  postKey: string | null
  revisionNo: number
  title: string | null
  postedAt: string | null
  rawContentMasked: string
  contentHash: string
  parseStatus: string
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function parseBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim()
}

function requireAdmin(request: Request, env?: Env): Response | null {
  const token = parseBearerToken(request)
  const adminToken = env?.ADMIN_TOKEN

  if (!token || !adminToken || token !== adminToken) {
    return json({ ok: false, error: 'Unauthorized' }, 401)
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readRequiredString(payload: Record<string, unknown>, key: string): string | Response {
  const value = payload[key]

  if (typeof value !== 'string' || value.trim().length === 0) {
    return json({ ok: false, error: `Missing field: ${key}` }, 400)
  }

  return value.trim()
}

function readOptionalString(payload: Record<string, unknown>, key: string): string | null | Response {
  const value = payload[key]

  if (value === undefined || value === null) {
    return null
  }

  if (typeof value !== 'string') {
    return json({ ok: false, error: `Invalid field: ${key}` }, 400)
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

async function parseManualUploadInput(request: Request): Promise<ManualUploadInput | Response> {
  const payload = await request.json().catch(() => null)

  if (!isRecord(payload)) {
    return json({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const sourceIdValue = payload.sourceId
  if (typeof sourceIdValue !== 'number' || !Number.isInteger(sourceIdValue) || sourceIdValue <= 0) {
    return json({ ok: false, error: 'Invalid field: sourceId' }, 400)
  }

  const rawContent = readRequiredString(payload, 'rawContent')
  if (rawContent instanceof Response) {
    return rawContent
  }

  const title = readOptionalString(payload, 'title')
  if (title instanceof Response) {
    return title
  }

  const postKey = readOptionalString(payload, 'postKey')
  if (postKey instanceof Response) {
    return postKey
  }

  const postedAt = readOptionalString(payload, 'postedAt')
  if (postedAt instanceof Response) {
    return postedAt
  }

  return {
    sourceId: sourceIdValue,
    rawContent,
    title,
    postKey,
    postedAt
  }
}

async function sourceExists(db: D1DatabaseBinding, sourceId: number): Promise<boolean> {
  const row = await db.prepare('SELECT id FROM sources WHERE id = ?1').bind(sourceId).first()
  return row !== null
}

function mapExistingRawPost(row: Record<string, unknown>): ExistingRawPost {
  return {
    id: Number(row.id),
    postKey: row.post_key === null ? null : String(row.post_key),
    revisionNo: Number(row.revision_no),
    contentHash: String(row.content_hash)
  }
}

function mapRawPost(row: Record<string, unknown>): RawPostRecord {
  return {
    id: Number(row.id),
    sourceId: Number(row.source_id),
    postKey: row.post_key === null ? null : String(row.post_key),
    revisionNo: Number(row.revision_no),
    title: row.title === null ? null : String(row.title),
    postedAt: row.posted_at === null ? null : String(row.posted_at),
    rawContentMasked: String(row.raw_content_masked),
    contentHash: String(row.content_hash),
    parseStatus: String(row.parse_status)
  }
}

async function findExistingByHash(db: D1DatabaseBinding, sourceId: number, contentHash: string): Promise<ExistingRawPost | null> {
  const row = await db
    .prepare(
      `SELECT id, post_key, revision_no, content_hash
       FROM raw_posts
       WHERE source_id = ?1 AND content_hash = ?2
       ORDER BY id DESC
       LIMIT 1`
    )
    .bind(sourceId, contentHash)
    .first()

  return row ? mapExistingRawPost(row) : null
}

async function findLatestByPostKey(db: D1DatabaseBinding, sourceId: number, postKey: string): Promise<ExistingRawPost | null> {
  const row = await db
    .prepare(
      `SELECT id, post_key, revision_no, content_hash
       FROM raw_posts
       WHERE source_id = ?1 AND post_key = ?2
       ORDER BY revision_no DESC
       LIMIT 1`
    )
    .bind(sourceId, postKey)
    .first()

  return row ? mapExistingRawPost(row) : null
}

async function getRawPostById(db: D1DatabaseBinding, rawPostId: number): Promise<RawPostRecord | null> {
  const row = await db
    .prepare(
      `SELECT id, source_id, post_key, revision_no, title, posted_at, raw_content_masked, content_hash, parse_status
       FROM raw_posts
       WHERE id = ?1`
    )
    .bind(rawPostId)
    .first()

  return row ? mapRawPost(row) : null
}

async function saveRawPost(db: D1DatabaseBinding, input: ManualUploadInput): Promise<{ rawPost: RawPostRecord; duplicate: boolean }> {
  const rawContentMasked = maskSensitive(input.rawContent)
  const contentHash = await hashText(rawContentMasked)

  const duplicateByHash = await findExistingByHash(db, input.sourceId, contentHash)
  if (duplicateByHash && (!input.postKey || duplicateByHash.postKey === input.postKey)) {
    const existingRawPost = await getRawPostById(db, duplicateByHash.id)

    if (!existingRawPost) {
      throw new Error('Existing raw post could not be reloaded')
    }

    return { rawPost: existingRawPost, duplicate: true }
  }

  let revisionNo = 1

  if (input.postKey) {
    const latestRevision = await findLatestByPostKey(db, input.sourceId, input.postKey)

    if (latestRevision) {
      revisionNo = latestRevision.revisionNo + 1
    }
  }

  const insertResult = await db
    .prepare(
      `INSERT INTO raw_posts (
         source_id,
         post_key,
         posted_at,
         revision_no,
         title,
         raw_content_masked,
         content_hash,
         parse_status
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'pending')`
    )
    .bind(input.sourceId, input.postKey, input.postedAt, revisionNo, input.title, rawContentMasked, contentHash)
    .run()

  const rawPost = await getRawPostById(db, Number(insertResult.meta.last_row_id))

  if (!rawPost) {
    throw new Error('Saved raw post could not be reloaded')
  }

  return { rawPost, duplicate: false }
}

export async function handleManualUpload(request: Request, env: Env | undefined): Promise<Response> {
  const unauthorized = requireAdmin(request, env)
  if (unauthorized) {
    return unauthorized
  }

  if (!env?.DB) {
    return json({ ok: false, error: 'Database binding missing' }, 500)
  }

  const input = await parseManualUploadInput(request)
  if (input instanceof Response) {
    return input
  }

  if (!(await sourceExists(env.DB, input.sourceId))) {
    return json({ ok: false, error: 'Source not found' }, 404)
  }

  const result = await saveRawPost(env.DB, input)
  return json({ ok: true, duplicate: result.duplicate, rawPost: result.rawPost }, result.duplicate ? 200 : 201)
}
