import type { Env } from './env'
import { runScheduledCollect } from './jobs/scheduledCollect'
import { getHealthResponse } from './routes/health'
import { handleAdminCollectTestBand } from './routes/adminCollect'
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

function resolveCorsOrigin(request: Request): string | null {
  const origin = request.headers.get('origin')

  if (!origin) {
    return null
  }

  if (origin === 'http://127.0.0.1:5173' || origin === 'http://localhost:5173') {
    return origin
  }

  return null
}

function withCors(response: Response, request: Request): Response {
  const origin = resolveCorsOrigin(request)

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
      return withCors(new Response(null, { status: 204 }), request)
    }

    let response: Response

    if (request.method === 'GET' && url.pathname === '/api/health') {
      response = getHealthResponse()
      return withCors(response, request)
    }

    if (
      url.pathname === '/api/market/today' ||
      url.pathname === '/api/insights' ||
      /^\/api\/market\/species\/.+/.test(url.pathname) ||
      url.pathname === '/api/admin/raw-posts'
    ) {
      response = await handleMarketReadRequest(request, env, url)
      return withCors(response, request)
    }

    if (
      url.pathname === '/api/sources/status' ||
      url.pathname === '/api/admin/sources' ||
      /^\/api\/admin\/sources\/\d+$/.test(url.pathname)
    ) {
      response = await handleSourcesRequest(request, env, url)
      return withCors(response, request)
    }

    if (url.pathname === '/api/admin/collect/test-band' && request.method === 'POST') {
      response = await handleAdminCollectTestBand(request, env)
      return withCors(response, request)
    }

    if (url.pathname === '/api/admin/manual-post' && request.method === 'POST') {
      response = await handleManualUpload(request, env)
      return withCors(response, request)
    }

    response = Response.json({ ok: false, error: 'Not Found' }, { status: 404 })
    return withCors(response, request)
  },

  async scheduled(_controller: ScheduledEvent, env: Env, ctx: WaitUntilContext) {
    ctx.waitUntil(runScheduledCollect(env))
  }
}

export default worker
