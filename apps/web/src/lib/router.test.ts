import { describe, expect, it } from 'vitest'
import { getAllowedRoute, getVisibleNavItems } from './router'
import type { AuthSession } from './auth'

const adminSession: AuthSession = {
  permissions: ['admin'],
  role: 'admin',
  username: 'simgip',
}

const viewerSession: AuthSession = {
  permissions: ['market-read'],
  role: 'viewer',
  username: 'viewer',
}

describe('admin route visibility', () => {
  it('hides raw review and source settings for non-admin users', () => {
    expect(getVisibleNavItems(viewerSession).map((item) => item.route)).toEqual([
      '/today',
      '/species-info',
      '/trends',
    ])
  })

  it('includes raw review and source settings for admin users', () => {
    expect(getVisibleNavItems(adminSession).map((item) => item.route)).toEqual([
      '/today',
      '/species-info',
      '/trends',
      '/raw-posts',
      '/settings',
    ])
  })

  it('moves restricted direct URLs back to the public dashboard', () => {
    expect(getAllowedRoute('/raw-posts', viewerSession)).toBe('/today')
    expect(getAllowedRoute('/settings', null)).toBe('/today')
    expect(getAllowedRoute('/settings', adminSession)).toBe('/settings')
  })
})
