import type { D1DatabaseBinding, Env } from '../env'
import { BandApiError, createBandClient, type BandClient } from '../clients/bandClient'
import { BandPageError, createBandPageClient, type BandPageClient } from '../clients/bandPageClient'

type CollectableSource = {
  id: number
  vendorName: string
  bandKey: string | null
  sourceMode: 'band_api' | 'band_page'
}

type TestBandResult = {
  sourceId: number
  sourceName: string
  bandKey: string | null
  sourceMode: 'band_api' | 'band_page'
  visibleInGetBands: boolean
  canReadPosts: boolean
  latestPostCollectedAt: string | null
  latestPosts: Array<{
    postKey: string
    createdAt: string
    contentPreview: string
  }>
  failureReason?: string
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

function mapBandError(code: number): string {
  switch (code) {
    case 211:
    case 212:
    case 3000:
    case 60000:
      return 'invalid_request'
    case 401:
    case 10401:
      return 'unauthorized'
    case 403:
    case 10403:
      return 'forbidden'
    case 1001:
    case 1002:
      return 'quota_exceeded'
    case 1003:
      return 'cooldown'
    case 60102:
      return 'band_not_member'
    case 60103:
      return 'user_not_connected'
    case 60200:
      return 'invalid_band'
    case 60203:
      return 'unsupported_band_type'
    case 60204:
      return 'band_not_accessible'
    default:
      return 'band_api_error'
  }
}

function mapBandPageError(error: BandPageError): string {
  switch (error.reason) {
    case 'invalid_page_identifier':
    case 'page_cookie_missing':
    case 'page_unauthorized':
    case 'page_endpoint_failed':
      return error.reason
    default:
      return 'band_page_error'
  }
}

async function listCollectableSources(db: D1DatabaseBinding): Promise<CollectableSource[]> {
  const result = await db
    .prepare(
      `SELECT id, vendor_name, band_key, source_mode
       FROM sources
       WHERE source_mode IN ('band_api', 'band_page') AND is_active = 1
       ORDER BY id ASC`
    )
    .all()

  return result.results.map((row) => ({
    id: Number(row.id),
    vendorName: String(row.vendor_name),
    bandKey: row.band_key === null ? null : String(row.band_key),
    sourceMode: String(row.source_mode) as 'band_api' | 'band_page'
  }))
}

async function testBandApiSource(
  source: CollectableSource,
  remoteBandKeys: Set<string>,
  bandAccessToken: string,
  client: BandClient
): Promise<TestBandResult> {
  if (!source.bandKey) {
    return {
      sourceId: source.id,
      sourceName: source.vendorName,
      bandKey: null,
      sourceMode: source.sourceMode,
      visibleInGetBands: false,
      canReadPosts: false,
      latestPostCollectedAt: null,
      latestPosts: [],
      failureReason: 'missing_band_key'
    }
  }

  if (!remoteBandKeys.has(source.bandKey)) {
    return {
      sourceId: source.id,
      sourceName: source.vendorName,
      bandKey: source.bandKey,
      sourceMode: source.sourceMode,
      visibleInGetBands: false,
      canReadPosts: false,
      latestPostCollectedAt: null,
      latestPosts: [],
      failureReason: 'band_not_found_in_get_bands'
    }
  }

  try {
    const posts = await client.getPosts({
      accessToken: bandAccessToken,
      bandKey: source.bandKey,
      locale: 'ko_KR'
    })

    const latestPosts = posts.slice(0, 3).map((post) => ({
      postKey: post.postKey,
      createdAt: new Date(post.createdAt).toISOString(),
      contentPreview: post.content.slice(0, 120)
    }))

    return {
      sourceId: source.id,
      sourceName: source.vendorName,
      bandKey: source.bandKey,
      sourceMode: source.sourceMode,
      visibleInGetBands: true,
      canReadPosts: true,
      latestPostCollectedAt: latestPosts[0]?.createdAt ?? null,
      latestPosts
    }
  } catch (error) {
    if (error instanceof BandApiError) {
      return {
        sourceId: source.id,
        sourceName: source.vendorName,
        bandKey: source.bandKey,
        sourceMode: source.sourceMode,
        visibleInGetBands: true,
        canReadPosts: false,
        latestPostCollectedAt: null,
        latestPosts: [],
        failureReason: mapBandError(error.code)
      }
    }

    throw error
  }
}

async function testBandPageSource(
  source: CollectableSource,
  env: Env,
  pageClient: BandPageClient
): Promise<TestBandResult> {
  if (!source.bandKey) {
    return {
      sourceId: source.id,
      sourceName: source.vendorName,
      bandKey: null,
      sourceMode: source.sourceMode,
      visibleInGetBands: false,
      canReadPosts: false,
      latestPostCollectedAt: null,
      latestPosts: [],
      failureReason: 'missing_page_identifier'
    }
  }

  try {
    const posts = await pageClient.getPosts({
      pageIdOrUrl: source.bandKey,
      cookie: env.BAND_WEB_COOKIE,
      limit: 3
    })

    const latestPosts = posts.slice(0, 3).map((post) => ({
      postKey: post.postKey,
      createdAt: post.createdAt > 0 ? new Date(post.createdAt).toISOString() : '',
      contentPreview: post.content.slice(0, 120)
    }))
    const partialReason = posts.some((post) => post.isPartial) ? 'public_page_html_truncated' : undefined

    return {
      sourceId: source.id,
      sourceName: source.vendorName,
      bandKey: source.bandKey,
      sourceMode: source.sourceMode,
      visibleInGetBands: false,
      canReadPosts: latestPosts.length > 0,
      latestPostCollectedAt: latestPosts[0]?.createdAt || null,
      latestPosts,
      ...(partialReason ? { failureReason: partialReason } : {})
    }
  } catch (error) {
    if (error instanceof BandPageError) {
      return {
        sourceId: source.id,
        sourceName: source.vendorName,
        bandKey: source.bandKey,
        sourceMode: source.sourceMode,
        visibleInGetBands: false,
        canReadPosts: false,
        latestPostCollectedAt: null,
        latestPosts: [],
        failureReason: mapBandPageError(error)
      }
    }

    throw error
  }
}

export async function handleAdminCollectTestBand(
  request: Request,
  env: Env | undefined,
  client: BandClient = createBandClient(),
  pageClient: BandPageClient = createBandPageClient()
): Promise<Response> {
  const unauthorized = requireAdmin(request, env)
  if (unauthorized) {
    return unauthorized
  }

  if (!env?.DB) {
    return json({ ok: false, error: 'Database binding missing' }, 500)
  }

  const sources = await listCollectableSources(env.DB)
  const bandApiSourcesWithKeys = sources.filter((source) => source.sourceMode === 'band_api' && source.bandKey)
  const bandAccessToken = env.BAND_ACCESS_TOKEN

  const remoteBandKeys = new Set<string>()

  if (bandApiSourcesWithKeys.length > 0) {
    if (!bandAccessToken) {
      return json({ ok: false, error: 'BAND_ACCESS_TOKEN is missing' }, 500)
    }

    try {
      const bands = await client.getBands(bandAccessToken)
      bands.forEach((band) => remoteBandKeys.add(band.bandKey))
    } catch (error) {
      if (error instanceof BandApiError) {
        return json(
          {
            ok: false,
            error: 'BAND API request failed',
            failureReason: mapBandError(error.code),
            resultCode: error.code,
            message: error.message
          },
          502
        )
      }

      throw error
    }
  }

  const results = await Promise.all(
    sources.map(async (source): Promise<TestBandResult> => {
      if (source.sourceMode === 'band_page') {
        return testBandPageSource(source, env, pageClient)
      }

      return testBandApiSource(source, remoteBandKeys, bandAccessToken ?? '', client)
    })
  )

  return json({ ok: true, bands: results })
}
