import { describe, expect, it } from 'vitest'
import { BUSHIRI_COMMAND_PAYLOADS } from './commands'

describe('Discord command payloads', () => {
  it('registers Korean top-level commands only', () => {
    expect(BUSHIRI_COMMAND_PAYLOADS.map((command) => command.name)).toEqual(['관심', '채널'])
    expect(BUSHIRI_COMMAND_PAYLOADS).not.toContainEqual(expect.objectContaining({ name: 'bushiri' }))
  })
})
