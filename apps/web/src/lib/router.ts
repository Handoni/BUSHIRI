import { useSyncExternalStore } from 'react'
import { hasAdminPermission, type AuthSession } from './auth'

export const NAV_ITEMS = [
  {
    route: '/today',
    label: '오늘 시세판',
    description: '어종·판매처 비교',
  },
  {
    route: '/trends',
    label: '시세 추이',
    description: '최근 가격 흐름',
  },
  {
    route: '/raw-posts',
    label: '원문 검수',
    description: '원문·파싱 상태',
  },
  {
    route: '/settings',
    label: '소스 설정',
    description: '판매처·수집 상태',
  },
] as const

export type AppRoute = (typeof NAV_ITEMS)[number]['route']
export type NavItem = (typeof NAV_ITEMS)[number]

const ADMIN_ROUTES = new Set<AppRoute>(['/raw-posts', '/settings'])

export const ROUTE_LABELS: Record<AppRoute, string> = {
  '/today': '오늘 시세판',
  '/trends': '시세 추이',
  '/raw-posts': '원문 검수',
  '/settings': '소스 설정',
}

export function isAdminRoute(route: AppRoute) {
  return ADMIN_ROUTES.has(route)
}

export function getVisibleNavItems(session: AuthSession | null): NavItem[] {
  return NAV_ITEMS.filter((item) => hasAdminPermission(session) || !isAdminRoute(item.route))
}

export function getAllowedRoute(route: AppRoute, session: AuthSession | null): AppRoute {
  if (!hasAdminPermission(session) && isAdminRoute(route)) {
    return '/today'
  }

  return route
}

export function normalizeRoute(pathname: string): AppRoute {
  const clean = pathname.replace(/\/$/, '') || '/today'

  const match = NAV_ITEMS.find((item) => item.route === clean)
  return match?.route ?? '/today'
}

function getSnapshot(): AppRoute {
  if (typeof window === 'undefined') {
    return '/today' as AppRoute
  }

  return normalizeRoute(window.location.pathname)
}

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

export function useCurrentRoute(): AppRoute {
  return useSyncExternalStore<AppRoute>(subscribe, getSnapshot, () => '/today')
}

export function navigateTo(route: AppRoute) {
  if (normalizeRoute(window.location.pathname) === route) {
    return
  }

  window.history.pushState({}, '', route)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
