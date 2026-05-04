import { describe, expect, it } from 'vitest'
import {
  authenticateAdmin,
  deserializeAuthSession,
  hasAdminPermission,
  serializeAuthSession,
} from './auth'

describe('admin authentication', () => {
  it('creates an admin session for the configured credentials', () => {
    const session = authenticateAdmin('simgip', 'gogamo')

    expect(session).toEqual({
      permissions: ['admin'],
      role: 'admin',
      username: 'simgip',
    })
    expect(hasAdminPermission(session)).toBe(true)
  })

  it('rejects non-admin credentials', () => {
    expect(authenticateAdmin('simgip', 'wrong-password')).toBeNull()
    expect(authenticateAdmin('viewer', 'gogamo')).toBeNull()
  })

  it('only restores serialized admin sessions', () => {
    const session = authenticateAdmin('simgip', 'gogamo')

    expect(deserializeAuthSession(serializeAuthSession(session))).toEqual(session)
    expect(deserializeAuthSession('{"permissions":["viewer"],"role":"viewer","username":"simgip"}')).toBeNull()
    expect(deserializeAuthSession('not-json')).toBeNull()
  })

  it('treats admin access as an explicit account permission', () => {
    expect(hasAdminPermission({
      permissions: ['admin'],
      role: 'admin',
      username: 'simgip',
    })).toBe(true)
    expect(hasAdminPermission({
      permissions: ['market-read'],
      role: 'viewer',
      username: 'viewer',
    })).toBe(false)
    expect(hasAdminPermission(null)).toBe(false)
  })
})
