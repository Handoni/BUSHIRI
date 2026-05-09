const API_PROXY_TARGET_KEYS = [
  'BUSHIRI_API_ORIGIN',
  'VITE_API_PROXY_TARGET',
  'VITE_API_BASE_URL',
]

const ADMIN_TOKEN_KEYS = [
  'BUSHIRI_ADMIN_TOKEN',
  'ADMIN_TOKEN',
  'VITE_ADMIN_TOKEN',
]

function resolveProxyTarget(env) {
  for (const key of API_PROXY_TARGET_KEYS) {
    const value = env[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim().replace(/\/$/, '')
    }
  }

  return null
}

function resolveAdminToken(env) {
  for (const key of ADMIN_TOKEN_KEYS) {
    const value = env[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return null
}

function buildUpstreamRequest(request, proxyTarget, adminToken) {
  const incomingUrl = new URL(request.url)
  const upstreamUrl = new URL(incomingUrl.pathname + incomingUrl.search, proxyTarget)
  const headers = new Headers(request.headers)

  if (incomingUrl.pathname.startsWith('/api/admin/') && adminToken) {
    headers.set('Authorization', `Bearer ${adminToken}`)
  }

  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = request.body
  }

  return new Request(upstreamUrl, init)
}

export async function onRequest(context) {
  const proxyTarget = resolveProxyTarget(context.env)
  const adminToken = resolveAdminToken(context.env)

  if (!proxyTarget) {
    return Response.json(
      {
        ok: false,
        error: 'API proxy target missing',
        detail: `Set one of ${API_PROXY_TARGET_KEYS.join(', ')} in Cloudflare Pages variables.`,
      },
      { status: 500 },
    )
  }

  if (new URL(proxyTarget).origin === new URL(context.request.url).origin) {
    return Response.json(
      {
        ok: false,
        error: 'API proxy target points to this Pages origin',
        detail: 'Set BUSHIRI_API_ORIGIN to the deployed Worker API origin instead.',
      },
      { status: 500 },
    )
  }

  return fetch(buildUpstreamRequest(context.request, proxyTarget, adminToken))
}
