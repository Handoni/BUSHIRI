import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./ui.tsx', import.meta.url), 'utf8')

describe('shared UI controls', () => {
  it('uses Radix Switch primitives for stable switch geometry and accessibility', () => {
    expect(source).toContain("@radix-ui/react-switch")
    expect(source).toContain('<Switch.Root')
    expect(source).toContain('<Switch.Thumb')
  })

  it('centralizes dropdowns, autocomplete, checkboxes, and disclosures on Radix primitives', () => {
    expect(source).toContain("@radix-ui/react-select")
    expect(source).toContain("@radix-ui/react-popover")
    expect(source).toContain("@radix-ui/react-checkbox")
    expect(source).toContain("@radix-ui/react-collapsible")
    expect(source).toContain("@radix-ui/react-toggle-group")
    expect(source).toContain('export function SelectControl')
    expect(source).toContain('export function SearchCombobox')
    expect(source).toContain('export function CheckboxControl')
    expect(source).toContain('export function SegmentedControl')
    expect(source).toContain('<Collapsible.Root')
  })

  it('prevents the autocomplete popover from stealing focus from its search input', () => {
    expect(source).toContain('onOpenAutoFocus={(event) => event.preventDefault()}')
  })

  it('does not treat IME composition enter as an autocomplete selection command', () => {
    expect(source).toContain('event.nativeEvent.isComposing')
  })

  it('lets labeled form controls shrink inside responsive condition grids', () => {
    expect(source).toContain('min-w-0')
    expect(source).not.toContain('min-w-[180px]')
  })
})
