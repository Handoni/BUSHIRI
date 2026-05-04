import { useSyncExternalStore } from 'react'

export type AuthPermission = 'admin' | 'market-read'
export type AuthRole = 'admin' | 'viewer'

export type AuthSession = {
  permissions: AuthPermission[]
  role: AuthRole
  username: string
}

export type LoginCredentials = {
  username: string
  password: string
}

export const AUTH_STORAGE_KEY = 'bushiri.auth.session'

const ADMIN_USERNAME = 'simgip'
const ADMIN_PASSWORD = 'gogamo'
const authChangeEvent = 'bushiri-auth-change'

const ACCOUNTS: Record<string, { password: string; role: AuthRole; permissions: AuthPermission[] }> = {
  [ADMIN_USERNAME]: {
    password: ADMIN_PASSWORD,
    permissions: ['admin'],
    role: 'admin',
  },
}

export function authenticateAdmin(username: string, password: string): AuthSession | null {
  const normalizedUsername = username.trim()
  const account = ACCOUNTS[normalizedUsername]

  if (!account || account.password !== password) {
    return null
  }

  return {
    permissions: [...account.permissions],
    role: account.role,
    username: normalizedUsername,
  }
}

export function hasAdminPermission(session: AuthSession | null): session is AuthSession {
  return session?.permissions.includes('admin') === true
}

export function serializeAuthSession(session: AuthSession | null): string {
  return JSON.stringify(session)
}

export function deserializeAuthSession(value: string | null): AuthSession | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as Partial<AuthSession>
    const account = parsed.username ? ACCOUNTS[parsed.username] : null

    if (account && parsed.role === account.role && Array.isArray(parsed.permissions)) {
      return {
        permissions: [...account.permissions],
        role: account.role,
        username: parsed.username!,
      }
    }
  } catch {
    return null
  }

  return null
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  return window.localStorage
}

function emitAuthChange() {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new Event(authChangeEvent))
}

function getSnapshot(): AuthSession | null {
  return deserializeAuthSession(getStorage()?.getItem(AUTH_STORAGE_KEY) ?? null)
}

function subscribe(callback: () => void) {
  window.addEventListener(authChangeEvent, callback)
  window.addEventListener('storage', callback)

  return () => {
    window.removeEventListener(authChangeEvent, callback)
    window.removeEventListener('storage', callback)
  }
}

export function persistAuthSession(session: AuthSession | null) {
  const storage = getStorage()

  if (!storage) {
    return
  }

  if (session) {
    storage.setItem(AUTH_STORAGE_KEY, serializeAuthSession(session))
  } else {
    storage.removeItem(AUTH_STORAGE_KEY)
  }

  emitAuthChange()
}

export function useAuthSession(): AuthSession | null {
  return useSyncExternalStore<AuthSession | null>(subscribe, getSnapshot, () => null)
}
