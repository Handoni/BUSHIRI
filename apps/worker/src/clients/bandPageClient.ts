export type BandPagePost = {
  postKey: string
  pageId: string
  content: string
  createdAt: number
  url: string
  title: string | null
  isPartial: boolean
}

export type BandPageGetPostsOptions = {
  pageIdOrUrl: string
  cookie?: string
  limit?: number
}

export type BandPageClient = {
  getPosts: (options: BandPageGetPostsOptions) => Promise<BandPagePost[]>
}

export class BandPageError extends Error {
  constructor(
    public readonly reason: string,
    message: string,
    public readonly raw?: unknown
  ) {
    super(message)
    this.name = 'BandPageError'
  }
}

type PageIdentifier = {
  pageId: string
  postId: string | null
  publicUrl: string
}

const SEARCH_ENDPOINTS = ['https://api.band.us/v2.0.0/search_for_posts_with_page']

const DETAIL_ENDPOINTS = [
  'https://api.band.us/v2.0.1/find_posts_item',
  'https://api.band.us/v2.0.0/find_post'
]

const POST_ID_FIELDS = ['post_no', 'postNo', 'post_key', 'postKey', 'post_id', 'postId']
const CONTENT_FIELDS = ['content', 'body', 'text', 'post_content', 'postContent', 'description', 'summary']
const TITLE_FIELDS = ['title', 'subject', 'post_title', 'postTitle']
const CREATED_AT_FIELDS = [
  'created_at',
  'createdAt',
  'created_time',
  'createdTime',
  'write_at',
  'writeAt',
  'timestamp',
  'ts'
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'string' && value.trim()) {
      return value
    }

    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value)
    }
  }

  return null
}

function decodeHtmlEntities(value: string): string {
  const namedEntities: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    '#39': "'"
  }

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity in namedEntities) {
      return namedEntities[entity]
    }

    if (entity.startsWith('#x')) {
      const codePoint = Number.parseInt(entity.slice(2), 16)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
    }

    if (entity.startsWith('#')) {
      const codePoint = Number.parseInt(entity.slice(1), 10)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
    }

    return match
  })
}

function normalizeText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 && value < 1_000_000_000_000 ? value * 1000 : value
  }

  if (typeof value !== 'string' || !value.trim()) {
    return 0
  }

  const numeric = Number(value)
  if (Number.isFinite(numeric)) {
    return numeric > 0 && numeric < 1_000_000_000_000 ? numeric * 1000 : numeric
  }

  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function parseBandPageIdentifier(value: string): PageIdentifier {
  const trimmed = value.trim()

  if (!trimmed) {
    throw new BandPageError('invalid_page_identifier', 'Band Page identifier is empty')
  }

  const prefixed = trimmed.match(/^page:(\d+)$/)
  if (prefixed) {
    return {
      pageId: prefixed[1],
      postId: null,
      publicUrl: `https://www.band.us/page/${prefixed[1]}/post`
    }
  }

  const numeric = trimmed.match(/^\d+$/)
  if (numeric) {
    return {
      pageId: numeric[0],
      postId: null,
      publicUrl: `https://www.band.us/page/${numeric[0]}/post`
    }
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new BandPageError('invalid_page_identifier', 'Band Page identifier must be page:<id>, an id, or a URL')
  }

  const match = url.pathname.match(/^\/page\/(\d+)\/post(?:\/(\d+))?/)
  if (!match) {
    throw new BandPageError('invalid_page_identifier', 'URL is not a BAND Page post URL')
  }

  return {
    pageId: match[1],
    postId: match[2] ?? null,
    publicUrl: `https://www.band.us/page/${match[1]}/post${match[2] ? `/${match[2]}` : ''}`
  }
}

function getMessage(value: unknown, seen = new WeakSet<object>()): string | null {
  if (!isRecord(value)) {
    return null
  }

  if (seen.has(value)) {
    return null
  }
  seen.add(value)

  if (typeof value.message === 'string') {
    return value.message
  }

  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const message = getMessage(item, seen)
        if (message) {
          return message
        }
      }
    } else {
      const message = getMessage(child, seen)
      if (message) {
        return message
      }
    }
  }

  return null
}

function throwIfUnauthorized(payload: unknown): void {
  const message = getMessage(payload)

  if (!message) {
    return
  }

  const normalized = message.toLowerCase()
  if (
    normalized.includes('not authorized') ||
    normalized.includes('unauthorized') ||
    normalized.includes('login') ||
    normalized.includes('로그인')
  ) {
    throw new BandPageError('page_unauthorized', message, payload)
  }
}

async function requestJson(url: URL, cookie: string, apiFetch: typeof fetch): Promise<unknown> {
  const response = await apiFetch(url, {
    headers: {
      accept: 'application/json, text/plain, */*',
      cookie,
      origin: 'https://www.band.us',
      referer: `https://www.band.us/page/${url.searchParams.get('page_no') ?? url.searchParams.get('band_no') ?? ''}/post`,
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
      'x-requested-with': 'XMLHttpRequest'
    }
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new BandPageError('page_endpoint_failed', `BAND Page API returned HTTP ${response.status}`, payload)
  }

  throwIfUnauthorized(payload)
  return payload
}

function buildSearchUrls(pageId: string, limit: number): URL[] {
  const candidates: Array<Record<string, string>> = [
    { page_no: pageId, query: '', limit: String(limit) },
    { page_no: pageId, keyword: '', limit: String(limit) },
    { page_no: pageId, count: String(limit) },
    { band_no: pageId, query: '', limit: String(limit) }
  ]

  return SEARCH_ENDPOINTS.flatMap((endpoint) =>
    candidates.map((params) => {
      const url = new URL(endpoint)
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
      return url
    })
  )
}

function buildDetailUrls(pageId: string, postKey: string): URL[] {
  const candidates: Array<Record<string, string>> = [
    { page_no: pageId, post_no: postKey },
    { band_no: pageId, post_no: postKey },
    { page_no: pageId, post_key: postKey },
    { band_no: pageId, post_key: postKey }
  ]

  return DETAIL_ENDPOINTS.flatMap((endpoint) =>
    candidates.map((params) => {
      const url = new URL(endpoint)
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
      return url
    })
  )
}

function mapPostRecord(record: Record<string, unknown>, pageId: string, partial: boolean): BandPagePost | null {
  const postKey = readString(record, POST_ID_FIELDS)

  if (!postKey) {
    return null
  }

  const title = readString(record, TITLE_FIELDS)
  const content = readString(record, CONTENT_FIELDS)
  const createdAtValue = CREATED_AT_FIELDS.map((field) => record[field]).find((value) => value !== undefined)
  const normalizedTitle = title ? normalizeText(title) : null
  const normalizedContent = content ? normalizeText(content) : ''
  const mergedContent = normalizedContent || normalizedTitle || ''

  return {
    postKey,
    pageId,
    content: mergedContent,
    createdAt: parseTimestamp(createdAtValue),
    url: `https://www.band.us/page/${pageId}/post/${postKey}`,
    title: normalizedTitle,
    isPartial: partial
  }
}

function collectPosts(value: unknown, pageId: string, partial: boolean, seen = new WeakSet<object>()): BandPagePost[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectPosts(item, pageId, partial, seen))
  }

  if (!isRecord(value)) {
    return []
  }

  if (seen.has(value)) {
    return []
  }
  seen.add(value)

  const directPost = mapPostRecord(value, pageId, partial)
  const nestedPosts = Object.values(value).flatMap((child) => collectPosts(child, pageId, partial, seen))

  return directPost ? [directPost, ...nestedPosts] : nestedPosts
}

function dedupePosts(posts: BandPagePost[]): BandPagePost[] {
  const byKey = new Map<string, BandPagePost>()

  for (const post of posts) {
    const existing = byKey.get(post.postKey)

    if (!existing || post.content.length > existing.content.length || (existing.isPartial && !post.isPartial)) {
      byKey.set(post.postKey, post)
    }
  }

  return Array.from(byKey.values()).sort((left, right) => right.createdAt - left.createdAt)
}

function mergePost(summary: BandPagePost, detail: BandPagePost | null): BandPagePost {
  if (!detail) {
    return summary
  }

  return {
    ...summary,
    title: detail.title ?? summary.title,
    content: detail.content.length >= summary.content.length ? detail.content : summary.content,
    createdAt: detail.createdAt || summary.createdAt,
    isPartial: detail.isPartial && summary.isPartial
  }
}

async function hydratePost(
  post: BandPagePost,
  pageId: string,
  cookie: string,
  apiFetch: typeof fetch
): Promise<BandPagePost> {
  for (const url of buildDetailUrls(pageId, post.postKey)) {
    try {
      const payload = await requestJson(url, cookie, apiFetch)
      const detail = dedupePosts(collectPosts(payload, pageId, false)).find((candidate) => candidate.postKey === post.postKey)

      if (detail) {
        return mergePost(post, detail)
      }
    } catch (error) {
      if (error instanceof BandPageError && error.reason === 'page_unauthorized') {
        throw error
      }
    }
  }

  return post
}

function extractMeta(html: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const propertyPattern = new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i')
  const namePattern = new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i')

  return html.match(propertyPattern)?.[1] ?? html.match(namePattern)?.[1] ?? null
}

async function fetchPublicPostFallback(identifier: PageIdentifier, apiFetch: typeof fetch): Promise<BandPagePost[]> {
  if (!identifier.postId) {
    throw new BandPageError('page_cookie_missing', 'BAND_WEB_COOKIE is required to read a BAND Page post list')
  }

  const response = await apiFetch(identifier.publicUrl, {
    headers: {
      accept: 'text/html,*/*',
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
    }
  })
  const html = await response.text()

  if (!response.ok) {
    throw new BandPageError('page_endpoint_failed', `BAND public page returned HTTP ${response.status}`)
  }

  const title = normalizeText(extractMeta(html, 'og:title') ?? html.match(/<title>([^<]+)<\/title>/i)?.[1] ?? '')
  const description = normalizeText(extractMeta(html, 'og:description') ?? '')
  const content = [title, description].filter(Boolean).join('\n')

  return [
    {
      postKey: identifier.postId,
      pageId: identifier.pageId,
      content,
      createdAt: 0,
      url: identifier.publicUrl,
      title: title || null,
      isPartial: true
    }
  ]
}

async function fetchWithCookie(
  identifier: PageIdentifier,
  cookie: string,
  limit: number,
  apiFetch: typeof fetch
): Promise<BandPagePost[]> {
  const errors: BandPageError[] = []

  for (const url of buildSearchUrls(identifier.pageId, limit)) {
    try {
      const payload = await requestJson(url, cookie, apiFetch)
      const posts = dedupePosts(collectPosts(payload, identifier.pageId, true)).slice(0, limit)

      if (posts.length === 0) {
        continue
      }

      const hydratedPosts = await Promise.all(
        posts.map((post) => hydratePost(post, identifier.pageId, cookie, apiFetch))
      )

      return dedupePosts(hydratedPosts).slice(0, limit)
    } catch (error) {
      if (error instanceof BandPageError) {
        errors.push(error)
        if (error.reason === 'page_unauthorized') {
          throw error
        }
        continue
      }

      throw error
    }
  }

  if (errors.length > 0) {
    throw errors[0]
  }

  return []
}

export function createBandPageClient(apiFetch: typeof fetch = fetch): BandPageClient {
  return {
    async getPosts({ pageIdOrUrl, cookie, limit = 10 }: BandPageGetPostsOptions) {
      const identifier = parseBandPageIdentifier(pageIdOrUrl)
      const normalizedLimit = Math.max(1, Math.min(Math.trunc(limit), 30))
      const trimmedCookie = cookie?.trim()

      if (!trimmedCookie) {
        return fetchPublicPostFallback(identifier, apiFetch)
      }

      return fetchWithCookie(identifier, trimmedCookie, normalizedLimit, apiFetch)
    }
  }
}
