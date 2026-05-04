import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8')
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')

describe('Tailwind stylesheet setup', () => {
  it('keeps app styling in Tailwind utilities instead of custom CSS selectors', () => {
    expect(styles.trim()).toBe('@import "tailwindcss";')
  })

  it('uses the Tailwind Vite plugin', () => {
    expect(viteConfig).toContain("import tailwindcss from '@tailwindcss/vite'")
    expect(viteConfig).toContain('tailwindcss()')
  })
})
