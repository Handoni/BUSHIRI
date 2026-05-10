import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const todayPage = readFileSync(new URL('./TodayPage.tsx', import.meta.url), 'utf8')
const trendsPage = readFileSync(new URL('./TrendsPage.tsx', import.meta.url), 'utf8')
const rawPostsPage = readFileSync(new URL('./RawPostsPage.tsx', import.meta.url), 'utf8')

describe('page-level form controls', () => {
  it('uses shared library-backed select controls instead of native select elements', () => {
    expect(trendsPage).toContain('<SelectControl')
    expect(rawPostsPage).toContain('<SelectControl')
    expect(trendsPage).not.toContain('<select')
    expect(rawPostsPage).not.toContain('<select')
  })

  it('uses shared library-backed checkbox controls for trend line toggles', () => {
    expect(trendsPage).toContain('<CheckboxControl')
    expect(trendsPage).not.toContain('type="checkbox"')
  })

  it('keeps today vendor filtering in a positioned multiselect popover', () => {
    expect(todayPage).toContain('<VendorMultiSelect')
    expect(todayPage).toContain('<details className="group relative z-40 min-w-0">')
    expect(todayPage).not.toContain('<datalist')
  })
})
