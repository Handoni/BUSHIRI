import { useState, type FormEvent, type PropsWithChildren } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import * as Dialog from '@radix-ui/react-dialog'
import * as NavigationMenu from '@radix-ui/react-navigation-menu'
import type { AuthSession, LoginCredentials } from '../lib/auth'
import type { AppRoute, NavItem } from '../lib/router'
import { cn } from './ui'

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

type SidebarNavigationProps = {
  currentRoute: AppRoute
  isCollapsed: boolean
  navItems: NavItem[]
  onCollapsedChange: (isCollapsed: boolean) => void
  onLogout: () => void
  onNavigate: (route: AppRoute) => void
  session: AuthSession | null
}

const surfaceClass =
  'border border-[#d8dbd2] bg-[#fffefa]/95 shadow-[0_1px_2px_rgba(20,21,18,0.04),0_18px_40px_-36px_rgba(20,21,18,0.22)] backdrop-blur-[10px]'

function shortNavLabel(label: string) {
  const compactLabel = label.replace(/\s/g, '')
  return compactLabel.length <= 2 ? compactLabel : compactLabel.slice(0, 2)
}

function SidebarNavigation({
  currentRoute,
  isCollapsed,
  navItems,
  onCollapsedChange,
  onLogout,
  onNavigate,
  session,
}: SidebarNavigationProps) {
  const toggleLabel = isCollapsed ? '메뉴 펼치기' : '메뉴 접기'

  return (
    <Collapsible.Root
      asChild
      open={!isCollapsed}
      onOpenChange={(isOpen) => onCollapsedChange(!isOpen)}
    >
      <aside
        className={cn(
          surfaceClass,
          'sticky top-5 flex h-[calc(100dvh-40px)] flex-col rounded-xl transition-[width,padding] duration-200 max-lg:static max-lg:h-auto max-lg:w-full',
          isCollapsed ? 'gap-4 p-3' : 'gap-6 p-6',
        )}
      >
        <div
          className={cn(
            'border-b border-[#d8dbd2]',
            isCollapsed ? 'flex flex-col items-center gap-3 pb-4' : 'pb-5',
          )}
        >
          <div
            className={cn(
              'flex items-start gap-3',
              isCollapsed ? 'flex-col items-center' : 'justify-between',
            )}
          >
            {isCollapsed ? (
              <span
                className="grid h-10 w-10 place-items-center rounded-lg border border-[#174f49]/20 bg-[#e5eeeb] text-sm font-extrabold text-[#174f49]"
                title="BUSHIRI Market Ops"
              >
                BU
              </span>
            ) : (
              <Collapsible.Content forceMount>
                <p className="mb-2 text-[0.72rem] font-bold uppercase text-[#174f49]">BUSHIRI</p>
                <h1 className="m-0 text-[1.6rem] font-extrabold leading-none tracking-normal text-[#141512]">
                  Market Ops
                </h1>
              </Collapsible.Content>
            )}

            <Collapsible.Trigger asChild>
              <button
                aria-label={toggleLabel}
                className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-[#d8dbd2] bg-[#fffefa] px-3 text-sm font-extrabold text-[#141512] transition duration-200 hover:-translate-y-px focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174f49] active:translate-y-px"
                title={toggleLabel}
                type="button"
              >
                {isCollapsed ? '>' : '<'}
              </button>
            </Collapsible.Trigger>
          </div>
        </div>

        <NavigationMenu.Root className="w-full" orientation="vertical">
          <NavigationMenu.List className="flex w-full flex-col gap-2">
            {navItems.map((item) => {
              const active = item.route === currentRoute

              return (
                <NavigationMenu.Item key={item.route}>
                  <NavigationMenu.Link asChild active={active}>
                    <a
                      aria-current={active ? 'page' : undefined}
                      aria-label={item.label}
                      className={cn(
                        'flex rounded-lg border border-transparent text-[#676b63] transition duration-200 hover:-translate-y-px hover:bg-[#f7f7f2] focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174f49]',
                        active ? 'border-[#174f49]/20 bg-[#e5eeeb]' : '',
                        isCollapsed
                          ? 'min-h-11 items-center justify-center px-2 text-center'
                          : 'flex-col gap-1 p-3',
                      )}
                      href={item.route}
                      onClick={(event) => {
                        event.preventDefault()
                        onNavigate(item.route)
                      }}
                      title={isCollapsed ? item.label : undefined}
                    >
                      <span className="font-bold text-[#141512]">
                        {isCollapsed ? shortNavLabel(item.label) : item.label}
                      </span>
                    </a>
                  </NavigationMenu.Link>
                </NavigationMenu.Item>
              )
            })}
          </NavigationMenu.List>
        </NavigationMenu.Root>

        <div
          className={cn(
            'mt-auto border-t border-[#d8dbd2]',
            isCollapsed ? 'pt-3' : 'pt-5',
          )}
        >
          {session ? (
            <div className="flex flex-col gap-3">
              {isCollapsed ? (
                <span
                  className="grid h-10 place-items-center rounded-lg border border-[#d8dbd2] bg-[#f7f7f2] text-sm font-extrabold text-[#174f49]"
                  title={`관리자: ${session.username}`}
                >
                  {session.username.slice(0, 2)}
                </span>
              ) : (
                <Collapsible.Content forceMount>
                  <div>
                    <p className="mb-1 text-[0.72rem] font-bold uppercase text-[#174f49]">Admin session</p>
                    <p className="m-0 text-sm font-bold text-[#141512]">관리자: {session.username}</p>
                  </div>
                </Collapsible.Content>
              )}
              <button
                aria-label="로그아웃"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#d8dbd2] bg-[#fffefa] px-4 text-sm font-bold text-[#141512] transition duration-200 hover:-translate-y-px focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174f49] active:translate-y-px"
                onClick={onLogout}
                type="button"
              >
                {isCollapsed ? '나감' : '로그아웃'}
              </button>
            </div>
          ) : (
            <Dialog.Trigger asChild>
              <button
                className="inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-[#174f49] bg-[#174f49] px-4 text-sm font-bold text-white transition duration-200 hover:-translate-y-px focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174f49] active:translate-y-px"
                type="button"
              >
                로그인
              </button>
            </Dialog.Trigger>
          )}
        </div>
      </aside>
    </Collapsible.Root>
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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  return (
    <Dialog.Root open={isLoginOpen && !session} onOpenChange={setIsLoginOpen}>
      <div
        className={cn(
          'grid min-h-dvh gap-5 bg-[#f4f5f1] bg-[radial-gradient(circle_at_16%_0%,rgba(23,79,73,0.08),transparent_28rem),linear-gradient(180deg,#f8f8f4_0%,#f4f5f1_44%)] p-5 font-sans text-[#141512] transition-[grid-template-columns] duration-200 max-lg:grid-cols-1 max-md:p-4',
          isSidebarCollapsed
            ? 'grid-cols-[88px_minmax(0,1fr)]'
            : 'grid-cols-[minmax(220px,260px)_minmax(0,1fr)]',
        )}
      >
        <SidebarNavigation
          currentRoute={currentRoute}
          isCollapsed={isSidebarCollapsed}
          navItems={navItems}
          onCollapsedChange={setIsSidebarCollapsed}
          onLogout={onLogout}
          onNavigate={onNavigate}
          session={session}
        />

        <div className="flex min-w-0 flex-col gap-5">
          <main className="flex flex-col gap-6">{children}</main>
        </div>

        {!session ? (
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-20 bg-[#141512]/35 backdrop-blur-[2px]" />
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
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#d8dbd2] pb-4">
        <div>
          <p className="mb-1 text-[0.72rem] font-bold uppercase text-[#174f49]">BUSHIRI access</p>
          <h2 id="login-dialog-title" className="m-0 text-lg font-extrabold leading-tight text-[#141512]">
            관리자 로그인
          </h2>
        </div>
        <button
          aria-label="로그인 창 닫기"
          className="inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-[#d8dbd2] bg-[#fffefa] px-3 text-sm font-bold text-[#141512] transition duration-200 hover:-translate-y-px focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174f49] active:translate-y-px"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-2">
          <span className="text-[0.78rem] font-extrabold text-[#676b63]">계정</span>
          <input
            autoComplete="username"
            className="min-h-10 rounded-lg border border-[#d8dbd2] bg-[#fffefa] px-3 text-sm text-[#141512] outline-none transition focus:border-[#174f49] focus:ring-2 focus:ring-[#174f49]/15"
            onChange={(event) => setUsername(event.target.value)}
            value={username}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-[0.78rem] font-extrabold text-[#676b63]">비밀번호</span>
          <input
            autoComplete="current-password"
            className="min-h-10 rounded-lg border border-[#d8dbd2] bg-[#fffefa] px-3 text-sm text-[#141512] outline-none transition focus:border-[#174f49] focus:ring-2 focus:ring-[#174f49]/15"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
        {loginError ? (
          <p className="m-0 text-xs font-bold leading-snug text-[#8c3f3d]">{loginError}</p>
        ) : null}
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-[#174f49] bg-[#174f49] px-4 text-sm font-bold text-white transition duration-200 hover:-translate-y-px focus-visible:-translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#174f49] active:translate-y-px"
          type="submit"
        >
          로그인
        </button>
      </div>
    </form>
  )
}
