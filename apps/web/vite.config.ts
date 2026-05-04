import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const ADMIN_BRIDGE_PREFIX = '/__bushiri_admin'

function createAdminProxyPlugin(proxyTarget: string | undefined, adminToken: string | undefined): Plugin {
  return {
    name: 'bushiri-admin-proxy',
    configureServer(server) {
      if (!proxyTarget || !adminToken) {
        return
      }

      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' || !req.url || !req.url.startsWith(`${ADMIN_BRIDGE_PREFIX}/`)) {
          next()
          return
        }

        const upstreamPath = req.url.replace(ADMIN_BRIDGE_PREFIX, '/api/admin')
        const upstreamUrl = new URL(upstreamPath, proxyTarget)
        const upstream = await fetch(upstreamUrl, {
          headers: {
            Accept: Array.isArray(req.headers.accept)
              ? req.headers.accept[0] ?? 'application/json'
              : req.headers.accept ?? 'application/json',
            Authorization: `Bearer ${adminToken}`,
          },
        })

        res.statusCode = upstream.status
        const contentType = upstream.headers.get('content-type')
        if (contentType) {
          res.setHeader('Content-Type', contentType)
        }

        res.end(await upstream.text())
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_API_PROXY_TARGET || process.env.VITE_API_PROXY_TARGET
  const adminToken = env.VITE_ADMIN_TOKEN || process.env.VITE_ADMIN_TOKEN

  return {
    plugins: [tailwindcss(), react(), createAdminProxyPlugin(proxyTarget, adminToken)],
    server: proxyTarget
      ? {
          proxy: {
            '/api/health': {
              target: proxyTarget,
              changeOrigin: true,
            },
            '/api/market': {
              target: proxyTarget,
              changeOrigin: true,
            },
            '/api/insights': {
              target: proxyTarget,
              changeOrigin: true,
            },
            '/api/sources/status': {
              target: proxyTarget,
              changeOrigin: true,
            },
          },
        }
      : undefined,
  }
})
