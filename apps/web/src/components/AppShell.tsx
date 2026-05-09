import { useState, type FormEvent, type PropsWithChildren } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import * as NavigationMenu from '@radix-ui/react-navigation-menu'
import { LogOut, Menu, X } from 'lucide-react'
import type { AuthSession, LoginCredentials } from '../lib/auth'
import type { AppRoute, NavItem } from '../lib/router'
import { cn, inputControlClass, surfaceClass } from './ui'

type AppShellProps = PropsWithChildren<{
  currentRoute: AppRoute
  currentLabel: string
  loginError: string | null
  navItems: NavItem[]
  onLogin: (credentials: LoginCredentials) => boolean
  onLogout: () => void
  onNavigate: (route: AppRoute) => void
  session: AuthSession | null
}>

type TopNavigationProps = {
  currentRoute: AppRoute
  navItems: NavItem[]
  onLogout: () => void
  onOpenLogin: () => void
  onNavigate: (route: AppRoute) => void
  session: AuthSession | null
}

const bushiriIconSrc = '/bushiri-icon.png'

function TopNavigation({
  currentRoute,
  navItems,
  onLogout,
  onOpenLogin,
  onNavigate,
  session,
}: TopNavigationProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  function handleMenuNavigate(route: AppRoute) {
    onNavigate(route)
    setIsMenuOpen(false)
  }

  function handleMenuLogin() {
    setIsMenuOpen(false)
    onOpenLogin()
  }

  function handleMenuLogout() {
    setIsMenuOpen(false)
    onLogout()
  }

  return (
    <header
      className={cn(
        surfaceClass,
        'flex min-h-16 items-center gap-6 rounded-xl px-4 py-3 max-lg:flex-wrap max-md:min-h-14 max-md:gap-3 max-md:rounded-none max-md:border-x-0 max-md:border-t-0 max-md:px-3',
      )}
    >
      <div className="flex min-w-[132px] shrink-0 items-center gap-3 max-md:min-w-0">
        <img
          src={bushiriIconSrc}
          className="h-10 w-10 shrink-0 rounded-lg object-contain"
          alt=""
          aria-hidden="true"
        />
        <span className="block truncate text-lg font-extrabold leading-tight tracking-normal text-bushiri-primary max-md:hidden">
          BUSHIRI
        </span>
      </div>

      <NavigationMenu.Root className="min-w-0 flex-1 max-lg:order-3 max-lg:w-full max-md:hidden">
        <NavigationMenu.List className="flex min-w-0 items-center gap-2 overflow-x-auto">
          {navItems.map((item) => {
            const active = item.route === currentRoute

            return (
              <NavigationMenu.Item key={item.route} className="shrink-0">
                <NavigationMenu.Link asChild active={active}>
                  <a
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative flex h-10 items-center rounded-lg px-3 text-sm font-extrabold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px',
                      active
                        ? 'text-bushiri-ink'
                        : 'text-bushiri-muted hover:bg-bushiri-shell hover:text-bushiri-ink',
                    )}
                    href={item.route}
                    onClick={(event) => {
                      event.preventDefault()
                      onNavigate(item.route)
                    }}
                  >
                    <span>{item.label}</span>
                    {active ? (
                      <span
                        aria-hidden="true"
                        className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-bushiri-primary"
                      />
                    ) : null}
                  </a>
                </NavigationMenu.Link>
              </NavigationMenu.Item>
            )
          })}
        </NavigationMenu.List>
      </NavigationMenu.Root>

      <Dialog.Root open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Dialog.Trigger asChild>
          <button
            aria-label="메뉴 열기"
            className="ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-bushiri-line/80 bg-bushiri-surface-raised text-bushiri-ink transition duration-200 hover:-translate-y-px hover:bg-bushiri-shell focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px max-lg:ml-0"
            type="button"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-bushiri-ink/35 backdrop-blur-[2px]" />
          <Dialog.Content
            aria-describedby={undefined}
            className={cn(
              surfaceClass,
              'fixed bottom-0 right-0 top-0 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-5 rounded-l-xl border-y-0 border-r-0 p-4 shadow-bushiri-popover outline-none',
            )}
          >
            <div className="flex items-center justify-between gap-3 border-b border-bushiri-line pb-4">
              <Dialog.Title className="m-0 text-base font-extrabold text-bushiri-ink">메뉴</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  aria-label="메뉴 닫기"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-bushiri-line bg-bushiri-surface text-bushiri-ink transition duration-200 hover:-translate-y-px hover:bg-bushiri-shell focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px"
                  type="button"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>

            <nav aria-label="사이드바 메뉴" className="flex flex-col gap-2">
              {navItems.map((item) => {
                const active = item.route === currentRoute

                return (
                  <a
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-11 items-center justify-between rounded-lg px-3 text-sm font-extrabold transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px',
                      active
                        ? 'bg-bushiri-primary-soft text-bushiri-primary'
                        : 'text-bushiri-ink hover:bg-bushiri-shell',
                    )}
                    href={item.route}
                    key={item.route}
                    onClick={(event) => {
                      event.preventDefault()
                      handleMenuNavigate(item.route)
                    }}
                  >
                    <span>{item.label}</span>
                    {active ? <span className="h-2 w-2 rounded-full bg-bushiri-primary" aria-hidden="true" /> : null}
                  </a>
                )
              })}
            </nav>

            <div className="mt-auto border-t border-bushiri-line pt-4">
              {session ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3 rounded-lg border border-bushiri-line/70 bg-bushiri-surface px-3 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bushiri-primary-soft text-xs font-extrabold text-bushiri-primary shadow-inner">
                      {session.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[0.66rem] font-bold uppercase text-bushiri-muted">Admin</span>
                      <span className="block truncate text-sm font-semibold text-bushiri-ink">{session.username}</span>
                    </div>
                  </div>
                  <button
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-bushiri-line/70 bg-bushiri-surface-raised px-4 text-sm font-bold text-bushiri-ink transition duration-200 hover:-translate-y-px hover:bg-bushiri-shell focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px"
                    onClick={handleMenuLogout}
                    type="button"
                  >
                    <LogOut className="h-4 w-4 text-bushiri-muted" aria-hidden="true" />
                    로그아웃
                  </button>
                </div>
              ) : (
                <button
                  className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-bushiri-primary bg-bushiri-primary px-4 text-sm font-extrabold text-white transition duration-200 hover:-translate-y-px hover:bg-bushiri-primary-deep focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px"
                  onClick={handleMenuLogin}
                  type="button"
                >
                  로그인
                </button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </header>
  )
}

export function AppShell({
  currentRoute,
  loginError,
  navItems,
  onLogin,
  onLogout,
  onNavigate,
  session,
  children,
}: AppShellProps) {
  const [isLoginOpen, setIsLoginOpen] = useState(false)

  return (
    <Dialog.Root open={isLoginOpen && !session} onOpenChange={setIsLoginOpen}>
      <div
        className="min-h-dvh bg-bushiri-app p-5 font-sans text-bushiri-ink max-md:p-0"
      >
        <div className="mx-auto flex min-h-[calc(100dvh-2.5rem)] w-full max-w-[1440px] flex-col gap-5 max-md:min-h-dvh max-md:gap-4">
          <TopNavigation
            currentRoute={currentRoute}
            navItems={navItems}
            onLogout={onLogout}
            onOpenLogin={() => setIsLoginOpen(true)}
            onNavigate={onNavigate}
            session={session}
          />
          <main className="flex flex-col gap-6">{children}</main>
        </div>

        {!session ? (
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-20 bg-bushiri-ink/35 backdrop-blur-[2px]" />
            <Dialog.Content
              aria-describedby={undefined}
              aria-labelledby="login-dialog-title"
              className={cn(
                surfaceClass,
                'fixed left-1/2 top-1/2 z-30 w-[calc(100vw-2rem)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-xl p-5',
              )}
            >
              <LoginDialog
                loginError={loginError}
                onClose={() => setIsLoginOpen(false)}
                onLogin={(credentials) => {
                  const didLogin = onLogin(credentials)

                  if (didLogin) {
                    setIsLoginOpen(false)
                  }

                  return didLogin
                }}
              />
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </div>
    </Dialog.Root>
  )
}

export function LoginDialog({
  loginError,
  onClose,
  onLogin,
}: {
  loginError: string | null
  onClose: () => void
  onLogin: (credentials: LoginCredentials) => boolean
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const didLogin = onLogin({ username, password })

    if (didLogin) {
      setPassword('')
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-bushiri-line pb-4">
        <div>
          <p className="mb-1 text-[0.72rem] font-bold uppercase text-bushiri-primary">BUSHIRI access</p>
          <h2 id="login-dialog-title" className="m-0 text-lg font-extrabold leading-tight text-bushiri-ink">
            관리자 로그인
          </h2>
        </div>
        <button
          aria-label="로그인 창 닫기"
          className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-bushiri-line bg-bushiri-surface px-3 text-sm font-bold text-bushiri-ink transition duration-200 hover:-translate-y-px focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-[0.78rem] font-extrabold text-bushiri-muted">계정</span>
          <input
            autoComplete="username"
            className={inputControlClass}
            onChange={(event) => setUsername(event.target.value)}
            value={username}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[0.78rem] font-extrabold text-bushiri-muted">비밀번호</span>
          <input
            autoComplete="current-password"
            className={inputControlClass}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        {loginError ? (
          <p className="m-0 text-xs font-bold leading-snug text-bushiri-danger">{loginError}</p>
        ) : null}
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-bushiri-primary bg-bushiri-primary px-4 text-sm font-bold text-white transition duration-200 hover:-translate-y-px focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px"
          type="submit"
        >
          로그인
        </button>
      </div>
    </form>
  )
}
