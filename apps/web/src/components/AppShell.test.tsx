import { readFileSync } from 'node:fs'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AppShell, LoginDialog } from './AppShell'
import { getVisibleNavItems } from '../lib/router'

const appShellSource = readFileSync(new URL('./AppShell.tsx', import.meta.url), 'utf8')

describe('AppShell authentication controls', () => {
  it('renders public navigation and a menu trigger before authentication', () => {
    const markup = renderToStaticMarkup(
      <AppShell
        currentLabel="비교 페이지"
        currentRoute="/today"
        loginError={null}
        navItems={getVisibleNavItems(null)}
        onLogin={() => false}
        onLogout={() => {}}
        onNavigate={() => {}}
        session={null}
      >
        <div>content</div>
      </AppShell>,
    )

    expect(markup).toContain('메뉴 열기')
    expect(markup).not.toContain('로그인')
    expect(markup).not.toContain('관리자 로그인')
    expect(markup).not.toContain('비밀번호')
    expect(markup).not.toContain('비교 페이지')
    expect(markup).not.toContain('운영 보드')
    expect(markup).toContain('오늘 시세판')
    expect(markup).toContain('시세 추이')
    expect(markup).not.toContain('원문 검수')
    expect(markup).not.toContain('소스 설정')
  })

  it('renders admin navigation with account controls kept out of the top bar', () => {
    const markup = renderToStaticMarkup(
      <AppShell
        currentLabel="원문 검수"
        currentRoute="/raw-posts"
        loginError={null}
        navItems={getVisibleNavItems({
          permissions: ['admin'],
          role: 'admin',
          username: 'simgip',
        })}
        onLogin={() => true}
        onLogout={() => {}}
        onNavigate={() => {}}
        session={{
          permissions: ['admin'],
          role: 'admin',
          username: 'simgip',
        }}
      >
        <div>content</div>
      </AppShell>,
    )

    expect(markup).toContain('메뉴 열기')
    expect(markup).not.toContain('Admin')
    expect(markup).not.toContain('simgip')
    expect(markup).not.toContain('로그아웃')
    expect(markup).toContain('원문 검수')
    expect(markup).toContain('소스 설정')
  })

  it('renders login fields inside the login dialog', () => {
    const markup = renderToStaticMarkup(
      <LoginDialog
        loginError="관리자 계정 정보를 확인해 주세요."
        onClose={() => {}}
        onLogin={() => false}
      />,
    )

    expect(markup).toContain('관리자 로그인')
    expect(markup).toContain('계정')
    expect(markup).toContain('비밀번호')
    expect(markup).toContain('관리자 계정 정보를 확인해 주세요.')
  })

  it('uses Radix top navigation primitives with a sidebar menu trigger', () => {
    expect(appShellSource).toContain("@radix-ui/react-navigation-menu")
    expect(appShellSource).not.toContain("@radix-ui/react-collapsible")
    expect(appShellSource).toContain('<NavigationMenu.Root')
    expect(appShellSource).toContain('function TopNavigation')
    expect(appShellSource).toContain('메뉴 열기')
    expect(appShellSource).toContain('사이드바 메뉴')
  })
})
