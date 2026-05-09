import type { Env } from './env'
import { runScheduledCollect } from './jobs/scheduledCollect'
import { getHealthResponse } from './routes/health'
import { handleAdminCollectTestBand } from './routes/adminCollect'
import { handleDiscordDailySummary, handleDiscordInteraction } from './routes/discord'
import { handleMarketReadRequest } from './routes/marketRead'
import { handleManualUpload } from './routes/manualUpload'
import { handleSourcesRequest } from './routes/sources'

type ScheduledEvent = {
  cron: string
  scheduledTime: number
  type: 'scheduled'
}

type WaitUntilContext = {
  waitUntil: (promise: Promise<unknown>) => void
}

const DEFAULT_CORS_ALLOWED_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'https://bushiri-46o.pages.dev'
]

function parseAllowedOrigins(env?: Env): Set<string> {
  const configuredOrigins =
    env?.CORS_ALLOWED_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? []

  return new Set([...DEFAULT_CORS_ALLOWED_ORIGINS, ...configuredOrigins])
}

function resolveCorsOrigin(request: Request, env?: Env): string | null {
  const origin = request.headers.get('origin')

  if (!origin) {
    return null
  }

  if (parseAllowedOrigins(env).has(origin)) {
    return origin
  }

  return null
}

function withCors(response: Response, request: Request, env?: Env): Response {
  const origin = resolveCorsOrigin(request, env)

  if (!origin) {
    return response
  }

  const headers = new Headers(response.headers)
  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Vary', 'Origin')
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

const worker = {
  async fetch(request: Request, env?: Env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }), request, env)
    }

    let response: Response

    if (request.method === 'GET' && url.pathname === '/api/health') {
      response = getHealthResponse()
      return withCors(response, request, env)
    }

    if (url.pathname === '/api/discord/interactions' && request.method === 'POST') {
      response = await handleDiscordInteraction(request, env)
      return withCors(response, request, env)
    }

    if (
      url.pathname === '/api/market/today' ||
      url.pathname === '/api/insights' ||
      /^\/api\/market\/species\/.+/.test(url.pathname) ||
      url.pathname === '/api/species-info' ||
      /^\/api\/species-info\/.+/.test(url.pathname) ||
      url.pathname === '/api/admin/raw-posts' ||
      /^\/api\/admin\/species-info\/.+/.test(url.pathname)
    ) {
      response = await handleMarketReadRequest(request, env, url)
      return withCors(response, request, env)
    }

    if (
      url.pathname === '/api/sources/status' ||
      url.pathname === '/api/admin/sources' ||
      /^\/api\/admin\/sources\/\d+$/.test(url.pathname)
    ) {
      response = await handleSourcesRequest(request, env, url)
      return withCors(response, request, env)
    }

    if (url.pathname === '/api/admin/collect/test-band' && request.method === 'POST') {
      response = await handleAdminCollectTestBand(request, env)
      return withCors(response, request, env)
    }

    if (url.pathname === '/api/admin/manual-post' && request.method === 'POST') {
      response = await handleManualUpload(request, env)
      return withCors(response, request, env)
    }

    if (url.pathname === '/api/admin/discord/daily-summary' && request.method === 'POST') {
      response = await handleDiscordDailySummary(request, env)
      return withCors(response, request, env)
    }

    response = Response.json({ ok: false, error: 'Not Found' }, { status: 404 })
    return withCors(response, request, env)
  },

  async scheduled(_controller: ScheduledEvent, env: Env, ctx: WaitUntilContext) {
    ctx.waitUntil(runScheduledCollect(env))
  }
}

export default worker
