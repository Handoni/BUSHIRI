import { useEffect, useMemo, useState } from 'react'
import { AppShell } from './components/AppShell'
import {
  authenticateAdmin,
  persistAuthSession,
  useAuthSession,
  type LoginCredentials,
} from './lib/auth'
import {
  ROUTE_LABELS,
  type AppRoute,
  getAllowedRoute,
  getVisibleNavItems,
  navigateTo,
  useCurrentRoute,
} from './lib/router'
import { RawPostsPage } from './pages/RawPostsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TodayPage } from './pages/TodayPage'
import { TrendsPage } from './pages/TrendsPage'

function renderRoute(route: AppRoute) {
  switch (route) {
    case '/today':
      return <TodayPage />
    case '/trends':
      return <TrendsPage />
    case '/raw-posts':
      return <RawPostsPage />
    case '/settings':
      return <SettingsPage />
    default:
      return <TodayPage />
  }
}

export function App() {
  const route = useCurrentRoute()
  const session = useAuthSession()
  const [loginError, setLoginError] = useState<string | null>(null)
  const currentRoute = getAllowedRoute(route, session)
  const navItems = useMemo(() => getVisibleNavItems(session), [session])

  useEffect(() => {
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/today'

    if (currentPath !== currentRoute) {
      window.history.replaceState({}, '', currentRoute)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }

    document.title = `BUSHIRI · ${ROUTE_LABELS[currentRoute]}`
  }, [currentRoute])

  function handleLogin(credentials: LoginCredentials) {
    const nextSession = authenticateAdmin(credentials.username, credentials.password)

    if (!nextSession) {
      setLoginError('관리자 계정 정보를 확인해 주세요.')
      return false
    }

    setLoginError(null)
    persistAuthSession(nextSession)
    return true
  }

  function handleLogout() {
    setLoginError(null)
    persistAuthSession(null)
  }

  return (
    <AppShell
      currentRoute={currentRoute}
      currentLabel={ROUTE_LABELS[currentRoute]}
      loginError={loginError}
      navItems={navItems}
      onLogin={handleLogin}
      onLogout={handleLogout}
      onNavigate={navigateTo}
      session={session}
    >
      {renderRoute(currentRoute)}
    </AppShell>
  )
}
