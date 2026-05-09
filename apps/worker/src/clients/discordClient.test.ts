import { describe, expect, it, vi } from 'vitest'
import { createDiscordClient } from './discordClient'

describe('createDiscordClient', () => {
  it('retries Discord 429 responses using retry_after before succeeding', async () => {
    const sleep = vi.fn(async () => undefined)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ retry_after: 0.25 }, { status: 429 }))
      .mockResolvedValueOnce(Response.json({ id: 'message-1' }))

    const client = createDiscordClient({
      botToken: 'bot-token',
      fetchImpl: fetchMock,
      sleep
    })

    const result = await client.createMessage('channel-1', {
      content: 'hello'
    })

    expect(result).toEqual({ id: 'message-1' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(250)
  })

  it('retries transient 5xx responses with exponential backoff', async () => {
    const sleep = vi.fn(async () => undefined)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ error: 'temporary' }, { status: 502 }))
      .mockResolvedValueOnce(Response.json({ id: 'message-2' }))

    const client = createDiscordClient({
      botToken: 'bot-token',
      fetchImpl: fetchMock,
      sleep
    })

    await expect(
      client.editMessage('channel-1', 'message-1', {
        content: 'updated'
      })
    ).resolves.toEqual({ id: 'message-2' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledWith(250)
  })
})
