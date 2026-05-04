import type { D1DatabaseBinding, Env } from '../env'
import type {
  PriceNotation,
  SourceInput,
  SourcePatch,
  SourceRecord,
  SourceMode,
  VendorType
} from '../types/domain'

const VENDOR_TYPES: VendorType[] = ['fish', 'crustacean', 'mixed']
const SOURCE_MODES: SourceMode[] = ['band_api', 'band_page', 'manual']
const PRICE_NOTATIONS: PriceNotation[] = ['auto', 'won', 'manwon']

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

  if (value === undefined) {
    return json({ ok: false, error: `Missing field: ${key}` }, 400)
  }

  if (typeof value !== 'string') {
    return json({ ok: false, error: `Invalid field: ${key}` }, 400)
  }

  const trimmed = value.trim()

  if (trimmed.length === 0) {
    return json({ ok: false, error: `Missing field: ${key}` }, 400)
  }

  return trimmed
}

function readOptionalString(payload: Record<string, unknown>, key: string): string | null | Response {
  const value = payload[key]

  if (value === undefined) {
    return null
  }

  if (value === null) {
    return null
  }

  if (typeof value !== 'string') {
    return json({ ok: false, error: `Invalid field: ${key}` }, 400)
  }

  const trimmed = value.trim()
  return trimmed.length === 0 ? null : trimmed
}

function readBoolean(
  payload: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean | Response {
  const value = payload[key]

  if (value === undefined) {
    return fallback
  }

  if (typeof value !== 'boolean') {
    return json({ ok: false, error: `Invalid field: ${key}` }, 400)
  }

  return value
}

function isOneOf<T extends string>(value: string, options: readonly T[]): value is T {
  return options.includes(value as T)
}

function mapSourceRow(row: Record<string, unknown>): SourceRecord {
  return {
    id: Number(row.id),
    name: String(row.name),
    vendorName: String(row.vendor_name),
    vendorType: String(row.vendor_type) as VendorType,
    bandKey: row.band_key === null ? null : String(row.band_key),
    sourceMode: String(row.source_mode) as SourceMode,
    priceNotation: String(row.price_notation) as PriceNotation,
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }
}

async function parseSourceInput(request: Request): Promise<SourceInput | Response> {
  const payload = await request.json().catch(() => null)

  if (!isRecord(payload)) {
    return json({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const name = readRequiredString(payload, 'name')
  if (name instanceof Response) {
    return name
  }

  const vendorName = readRequiredString(payload, 'vendorName')
  if (vendorName instanceof Response) {
    return vendorName
  }

  const vendorType = readRequiredString(payload, 'vendorType')
  if (vendorType instanceof Response) {
    return vendorType
  }

  if (!isOneOf(vendorType, VENDOR_TYPES)) {
    return json({ ok: false, error: 'Invalid field: vendorType' }, 400)
  }

  const sourceMode = readRequiredString(payload, 'sourceMode')
  if (sourceMode instanceof Response) {
    return sourceMode
  }

  if (!isOneOf(sourceMode, SOURCE_MODES)) {
    return json({ ok: false, error: 'Invalid field: sourceMode' }, 400)
  }

  const priceNotation = readRequiredString(payload, 'priceNotation')
  if (priceNotation instanceof Response) {
    return priceNotation
  }

  if (!isOneOf(priceNotation, PRICE_NOTATIONS)) {
    return json({ ok: false, error: 'Invalid field: priceNotation' }, 400)
  }

  const bandKey = readOptionalString(payload, 'bandKey')
  if (bandKey instanceof Response) {
    return bandKey
  }

  const isActive = readBoolean(payload, 'isActive', true)
  if (isActive instanceof Response) {
    return isActive
  }

  return {
    name,
    vendorName,
    vendorType,
    bandKey,
    sourceMode,
    priceNotation,
    isActive
  }
}

async function parseSourcePatch(request: Request): Promise<SourcePatch | Response> {
  const payload = await request.json().catch(() => null)

  if (!isRecord(payload)) {
    return json({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const patch: SourcePatch = {}

  if ('name' in payload) {
    const name = readRequiredString(payload, 'name')
    if (name instanceof Response) {
      return name
    }
    patch.name = name
  }

  if ('vendorName' in payload) {
    const vendorName = readRequiredString(payload, 'vendorName')
    if (vendorName instanceof Response) {
      return vendorName
    }
    patch.vendorName = vendorName
  }

  if ('vendorType' in payload) {
    const vendorType = readRequiredString(payload, 'vendorType')
    if (vendorType instanceof Response) {
      return vendorType
    }
    if (!isOneOf(vendorType, VENDOR_TYPES)) {
      return json({ ok: false, error: 'Invalid field: vendorType' }, 400)
    }
    patch.vendorType = vendorType
  }

  if ('bandKey' in payload) {
    const bandKey = readOptionalString(payload, 'bandKey')
    if (bandKey instanceof Response) {
      return bandKey
    }
    patch.bandKey = bandKey
  }

  if ('sourceMode' in payload) {
    const sourceMode = readRequiredString(payload, 'sourceMode')
    if (sourceMode instanceof Response) {
      return sourceMode
    }
    if (!isOneOf(sourceMode, SOURCE_MODES)) {
      return json({ ok: false, error: 'Invalid field: sourceMode' }, 400)
    }
    patch.sourceMode = sourceMode
  }

  if ('priceNotation' in payload) {
    const priceNotation = readRequiredString(payload, 'priceNotation')
    if (priceNotation instanceof Response) {
      return priceNotation
    }
    if (!isOneOf(priceNotation, PRICE_NOTATIONS)) {
      return json({ ok: false, error: 'Invalid field: priceNotation' }, 400)
    }
    patch.priceNotation = priceNotation
  }

  if ('isActive' in payload) {
    const isActive = readBoolean(payload, 'isActive', true)
    if (isActive instanceof Response) {
      return isActive
    }
    patch.isActive = isActive
  }

  if (Object.keys(patch).length === 0) {
    return json({ ok: false, error: 'No fields to update' }, 400)
  }

  return patch
}

async function getSourceById(db: D1DatabaseBinding, id: number): Promise<SourceRecord | null> {
  const row = await db
    .prepare(
      `SELECT id, name, vendor_name, vendor_type, band_key, source_mode, price_notation, is_active, created_at, updated_at
       FROM sources
       WHERE id = ?1`
    )
    .bind(id)
    .first()

  return row ? mapSourceRow(row) : null
}

async function listSourceStatuses(db: D1DatabaseBinding): Promise<SourceRecord[]> {
  const result = await db
    .prepare(
      `SELECT id, name, vendor_name, vendor_type, band_key, source_mode, price_notation, is_active, created_at, updated_at
       FROM sources
       ORDER BY is_active DESC, updated_at DESC, id ASC`
    )
    .all()

  return result.results.map(mapSourceRow)
}

async function createSource(db: D1DatabaseBinding, input: SourceInput): Promise<SourceRecord> {
  const insertResult = await db
    .prepare(
      `INSERT INTO sources (
         name,
         vendor_name,
         vendor_type,
         band_key,
         source_mode,
         price_notation,
         is_active
       ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    )
    .bind(
      input.name,
      input.vendorName,
      input.vendorType,
      input.bandKey,
      input.sourceMode,
      input.priceNotation,
      input.isActive ? 1 : 0
    )
    .run()

  const source = await getSourceById(db, Number(insertResult.meta.last_row_id))

  if (!source) {
    throw new Error('Created source could not be reloaded')
  }

  return source
}

async function updateSource(db: D1DatabaseBinding, id: number, patch: SourcePatch): Promise<SourceRecord | null> {
  const assignments: string[] = []
  const values: Array<string | number | null> = []

  if (patch.name !== undefined) {
    assignments.push('name = ?')
    values.push(patch.name)
  }

  if (patch.vendorName !== undefined) {
    assignments.push('vendor_name = ?')
    values.push(patch.vendorName)
  }

  if (patch.vendorType !== undefined) {
    assignments.push('vendor_type = ?')
    values.push(patch.vendorType)
  }

  if (patch.bandKey !== undefined) {
    assignments.push('band_key = ?')
    values.push(patch.bandKey)
  }

  if (patch.sourceMode !== undefined) {
    assignments.push('source_mode = ?')
    values.push(patch.sourceMode)
  }

  if (patch.priceNotation !== undefined) {
    assignments.push('price_notation = ?')
    values.push(patch.priceNotation)
  }

  if (patch.isActive !== undefined) {
    assignments.push('is_active = ?')
    values.push(patch.isActive ? 1 : 0)
  }

  assignments.push("updated_at = CURRENT_TIMESTAMP")
  values.push(id)

  await db
    .prepare(`UPDATE sources SET ${assignments.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run()

  return getSourceById(db, id)
}

export async function handleSourcesRequest(request: Request, env: Env | undefined, url: URL): Promise<Response> {
  if (url.pathname === '/api/admin/sources' && request.method === 'GET') {
    const unauthorized = requireAdmin(request, env)
    if (unauthorized) {
      return unauthorized
    }

    const db = env?.DB
    if (!db) {
      return json({ ok: false, error: 'Database binding missing' }, 500)
    }

    const sources = await listSourceStatuses(db)
    return json({ ok: true, sources })
  }

  if (url.pathname === '/api/sources/status' && request.method === 'GET') {
    const db = env?.DB

    if (!db) {
      return json({ ok: false, error: 'Database binding missing' }, 500)
    }

    const sources = await listSourceStatuses(db)
    return json({ ok: true, sources })
  }

  if (url.pathname === '/api/admin/sources' && request.method === 'POST') {
    const unauthorized = requireAdmin(request, env)
    if (unauthorized) {
      return unauthorized
    }

    const db = env?.DB

    if (!db) {
      return json({ ok: false, error: 'Database binding missing' }, 500)
    }

    const input = await parseSourceInput(request)
    if (input instanceof Response) {
      return input
    }

    try {
      const source = await createSource(db, input)
      return json({ ok: true, source }, 201)
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        return json({ ok: false, error: 'band_key must be unique' }, 409)
      }

      throw error
    }
  }

  const adminSourceMatch = url.pathname.match(/^\/api\/admin\/sources\/(\d+)$/)

  if (adminSourceMatch && request.method === 'PATCH') {
    const unauthorized = requireAdmin(request, env)
    if (unauthorized) {
      return unauthorized
    }

    const db = env?.DB

    if (!db) {
      return json({ ok: false, error: 'Database binding missing' }, 500)
    }

    const patch = await parseSourcePatch(request)
    if (patch instanceof Response) {
      return patch
    }

    const sourceId = Number(adminSourceMatch[1])
    const source = await updateSource(db, sourceId, patch)

    if (!source) {
      return json({ ok: false, error: 'Source not found' }, 404)
    }

    return json({ ok: true, source })
  }

  return json({ ok: false, error: 'Not Found' }, 404)
}
