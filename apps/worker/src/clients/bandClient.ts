type BandApiResponseEnvelope = {
  result_code: number
  result_data?: Record<string, unknown>
}

type BandApiErrorBody = {
  result_data?: {
    message?: string
  }
}

export type BandSummary = {
  name: string
  bandKey: string
  cover: string | null
  memberCount: number | null
}

export type BandPost = {
  postKey: string
  bandKey: string
  content: string
  createdAt: number
}

export class BandApiError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly raw: unknown
  ) {
    super(message)
    this.name = 'BandApiError'
  }
}

export type BandClient = {
  getBands: (accessToken: string) => Promise<BandSummary[]>
  getPosts: (options: { accessToken: string; bandKey: string; locale: string }) => Promise<BandPost[]>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getErrorMessage(payload: unknown): string {
  if (isRecord(payload) && isRecord(payload.result_data) && typeof payload.result_data.message === 'string') {
    return payload.result_data.message
  }

  return 'BAND API request failed'
}

function parseEnvelope(payload: unknown): BandApiResponseEnvelope {
  if (!isRecord(payload) || typeof payload.result_code !== 'number') {
    throw new Error('Invalid BAND API response')
  }

  return payload as BandApiResponseEnvelope
}

function mapBandSummary(value: unknown): BandSummary {
  if (!isRecord(value)) {
    throw new Error('Invalid BAND band payload')
  }

  return {
    name: String(value.name),
    bandKey: String(value.band_key),
    cover: value.cover === undefined || value.cover === null ? null : String(value.cover),
    memberCount: typeof value.member_count === 'number' ? value.member_count : null
  }
}

function mapBandPost(value: unknown): BandPost {
  if (!isRecord(value)) {
    throw new Error('Invalid BAND post payload')
  }

  return {
    postKey: String(value.post_key),
    bandKey: String(value.band_key),
    content: String(value.content ?? ''),
    createdAt: Number(value.created_at ?? 0)
  }
}

async function requestJson(url: URL, apiFetch: typeof fetch): Promise<unknown> {
  const response = await apiFetch(url)
  const payload = (await response.json().catch(() => null)) as BandApiErrorBody | null

  if (!response.ok) {
    throw new BandApiError(response.status, getErrorMessage(payload), payload)
  }

  return payload
}

export function createBandClient(apiFetch: typeof fetch = fetch): BandClient {
  return {
    async getBands(accessToken: string) {
      const url = new URL('https://openapi.band.us/v2.1/bands')
      url.searchParams.set('access_token', accessToken)

      const payload = await requestJson(url, apiFetch)
      const envelope = parseEnvelope(payload)

      if (envelope.result_code !== 1) {
        throw new BandApiError(envelope.result_code, getErrorMessage(payload), payload)
      }

      const bands = Array.isArray(envelope.result_data?.bands) ? envelope.result_data.bands : []
      return bands.map(mapBandSummary)
    },

    async getPosts({ accessToken, bandKey, locale }: { accessToken: string; bandKey: string; locale: string }) {
      const url = new URL('https://openapi.band.us/v2/band/posts')
      url.searchParams.set('access_token', accessToken)
      url.searchParams.set('band_key', bandKey)
      url.searchParams.set('locale', locale)

      const payload = await requestJson(url, apiFetch)
      const envelope = parseEnvelope(payload)

      if (envelope.result_code !== 1) {
        throw new BandApiError(envelope.result_code, getErrorMessage(payload), payload)
      }

      const items = Array.isArray(envelope.result_data?.items) ? envelope.result_data.items : []
      return items.map(mapBandPost)
    }
  }
}
