import nacl from 'tweetnacl'
import { describe, expect, it, vi } from 'vitest'
import type { D1DatabaseBinding, D1PreparedStatement, Env } from '../env'
import { handleDiscordDailySummary, handleDiscordInteraction } from './discord'

type InsightRow = {
  insight_type: string
  severity: string
  canonical_name: string | null
  title: string
  body: string
  created_at?: string
}

type MarketRow = {
  canonical_name: string
  vendor_name: string
  display_name: string
  price_per_kg: number | null
  price_text: string | null
  sold_out: number
  best_condition_flag: number
  lowest_price_flag: number
  ai_recommendation_flag: number
}

type FakeDiscordState = {
  insights: InsightRow[]
  marketRows: MarketRow[]
  speciesNames: string[]
  watchItems: Array<{ canonical_name: string; added_by_discord_user_id: string | null }>
  alertChannel: {
    guild_id: string | null
    channel_id: string
    configured_by_discord_user_id: string | null
  } | null
  dailyMessages: Array<{ market_date: string; channel_id: string; message_id: string; candidate_json: string }>
}

const keyPair = nacl.sign.keyPair()
const publicKeyHex = Buffer.from(keyPair.publicKey).toString('hex')

function createSignedRequest(url: string, payload: unknown): Request {
  const body = JSON.stringify(payload)
  const timestamp = '1700000000'
  const signature = Buffer.from(nacl.sign.detached(new TextEncoder().encode(timestamp + body), keyPair.secretKey)).toString('hex')

  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-signature-ed25519': signature,
      'x-signature-timestamp': timestamp
    },
    body
  })
}

function createFakeDb(state: FakeDiscordState): D1DatabaseBinding {
  return {
    prepare(query: string): D1PreparedStatement {
      let boundValues: Array<string | number | null> = []

      return {
        bind(...values) {
          boundValues = values
          return this
        },
        async first() {
          if (query.includes('FROM discord_daily_messages') && query.includes('WHERE market_date = ?1')) {
            const marketDate = String(boundValues[0])
            return state.dailyMessages.find((message) => message.market_date === marketDate) ?? null
          }

          if (query.includes('FROM discord_alert_channels')) {
            return state.alertChannel
          }

          return null
        },
        async all() {
          if (query.includes('FROM insights')) {
            const marketDate = String(boundValues[0])
            return {
              results: state.insights.filter((insight) => insight.created_at || marketDate)
            }
          }

          if (query.includes('FROM discord_watch_items')) {
            return { results: state.watchItems }
          }

          if (query.includes('FROM item_snapshots')) {
            return { results: state.marketRows }
          }

          if (query.includes('species_profiles') || query.includes('species_aliases')) {
            return { results: state.speciesNames.map((canonical_name) => ({ canonical_name })) }
          }

          return { results: [] }
        },
        async run() {
          if (query.startsWith('INSERT INTO discord_daily_messages')) {
            const existing = state.dailyMessages.find((message) => message.market_date === String(boundValues[0]))
            if (existing) {
              existing.channel_id = String(boundValues[1])
              existing.message_id = String(boundValues[2])
              existing.candidate_json = String(boundValues[3])
            } else {
              state.dailyMessages.push({
                market_date: String(boundValues[0]),
                channel_id: String(boundValues[1]),
                message_id: String(boundValues[2]),
                candidate_json: String(boundValues[3])
              })
            }
          }

          if (query.startsWith('UPDATE discord_daily_messages')) {
            const message = state.dailyMessages.find((row) => row.market_date === String(boundValues[3]))
            if (message) {
              message.channel_id = String(boundValues[0])
              message.message_id = String(boundValues[1])
              message.candidate_json = String(boundValues[2])
            }
          }

          if (query.startsWith('INSERT INTO discord_watch_items')) {
            const canonicalName = String(boundValues[0])
            const existing = state.watchItems.find((item) => item.canonical_name === canonicalName)
            if (existing) {
              existing.added_by_discord_user_id = boundValues[1] === null ? null : String(boundValues[1])
            } else {
              state.watchItems.push({
                canonical_name: canonicalName,
                added_by_discord_user_id: boundValues[1] === null ? null : String(boundValues[1])
              })
            }
          }

          if (query.startsWith('DELETE FROM discord_watch_items')) {
            const canonicalName = String(boundValues[0])
            state.watchItems = state.watchItems.filter((item) => item.canonical_name !== canonicalName)
          }

          if (query.startsWith('INSERT INTO discord_alert_channels')) {
            state.alertChannel = {
              guild_id: boundValues[0] === null ? null : String(boundValues[0]),
              channel_id: String(boundValues[1]),
              configured_by_discord_user_id: boundValues[2] === null ? null : String(boundValues[2])
            }
          }

          return { meta: {} }
        }
      }
    }
  }
}

function createEnv(state: FakeDiscordState): Env {
  return {
    DB: createFakeDb(state),
    ADMIN_TOKEN: 'dev-admin-token',
    DISCORD_BOT_TOKEN: 'discord-bot-token',
    DISCORD_APPLICATION_ID: 'app-1',
    DISCORD_PUBLIC_KEY: publicKeyHex,
    LLM_PROVIDER: 'pydantic_ai',
    LLM_MODEL: 'gemma-3-27b-it',
    APP_TIMEZONE: 'Asia/Seoul',
    RAW_POST_RETENTION_DAYS: '30',
    COLLECT_LOOKBACK_HOURS: '30'
  }
}

function createState(): FakeDiscordState {
  return {
    insights: [
      {
        insight_type: 'price_drop',
        severity: 'warning',
        canonical_name: '광어',
        title: '광어 가격 하락',
        body: '광어가 전일 대비 하락했습니다.'
      },
      {
        insight_type: 'new_item',
        severity: 'notice',
        canonical_name: '킹크랩',
        title: '킹크랩 신규 등장',
        body: '킹크랩이 새로 등장했습니다.'
      }
    ],
    marketRows: [
      {
        canonical_name: '광어',
        vendor_name: '성전물산',
        display_name: '광어',
        price_per_kg: 18000,
        price_text: '18,000원/kg',
        sold_out: 0,
        best_condition_flag: 0,
        lowest_price_flag: 1,
        ai_recommendation_flag: 1
      },
      {
        canonical_name: '킹크랩',
        vendor_name: '줄포상회',
        display_name: '킹크랩',
        price_per_kg: 46000,
        price_text: '46,000원/kg',
        sold_out: 0,
        best_condition_flag: 1,
        lowest_price_flag: 1,
        ai_recommendation_flag: 0
      }
    ],
    speciesNames: Array.from({ length: 30 }, (_, index) => `품목${String(index + 1).padStart(2, '0')}`),
    watchItems: [{ canonical_name: '킹크랩', added_by_discord_user_id: 'user-0' }],
    alertChannel: {
      guild_id: 'guild-1',
      channel_id: 'channel-1',
      configured_by_discord_user_id: 'user-0'
    },
    dailyMessages: []
  }
}

describe('Discord daily summary route', () => {
  it('creates the first daily message and edits it on repeated calls for the same date', async () => {
    const state = createState()
    const env = createEnv(state)
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ id: 'message-1' }))
      .mockResolvedValueOnce(Response.json({ id: 'message-1' }))
    vi.stubGlobal('fetch', fetchMock)

    const request = new Request('https://example.com/api/admin/discord/daily-summary', {
      method: 'POST',
      headers: {
        authorization: 'Bearer dev-admin-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ marketDate: '2026-05-10' })
    })

    await expect(handleDiscordDailySummary(request.clone(), env)).resolves.toMatchObject({ status: 200 })
    await expect(handleDiscordDailySummary(request, env)).resolves.toMatchObject({ status: 200 })

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://discord.com/api/v10/channels/channel-1/messages')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('https://discord.com/api/v10/channels/channel-1/messages/message-1')
    expect(state.dailyMessages).toHaveLength(1)
    expect(state.dailyMessages[0]?.candidate_json).toContain('광어')
  })

  it('requires a Discord alert channel configured in D1', async () => {
    const state = createState()
    state.alertChannel = null

    const response = await handleDiscordDailySummary(
      new Request('https://example.com/api/admin/discord/daily-summary', {
        method: 'POST',
        headers: {
          authorization: 'Bearer dev-admin-token',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ marketDate: '2026-05-10' })
      }),
      createEnv(state)
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Discord alert channel not configured'
    })
  })
})

describe('Discord interactions route', () => {
  it('rejects unsigned interaction requests', async () => {
    const response = await handleDiscordInteraction(
      new Request('https://example.com/api/discord/interactions', {
        method: 'POST',
        body: JSON.stringify({ type: 1 })
      }),
      createEnv(createState())
    )

    expect(response.status).toBe(401)
  })

  it('rejects interaction requests with invalid signatures', async () => {
    const response = await handleDiscordInteraction(
      new Request('https://example.com/api/discord/interactions', {
        method: 'POST',
        headers: {
          'x-signature-ed25519': '00'.repeat(64),
          'x-signature-timestamp': '1700000000'
        },
        body: JSON.stringify({ type: 1 })
      }),
      createEnv(createState())
    )

    expect(response.status).toBe(401)
  })

  it('responds to signed ping interactions', async () => {
    const response = await handleDiscordInteraction(
      createSignedRequest('https://example.com/api/discord/interactions', { type: 1 }),
      createEnv(createState())
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ type: 1 })
  })

  it('syncs only the selected daily candidates from a String Select interaction', async () => {
    const state = createState()
    state.dailyMessages.push({
      market_date: '2026-05-10',
      channel_id: 'channel-1',
      message_id: 'message-1',
      candidate_json: JSON.stringify([
        { canonicalName: '광어', reason: '가격 하락', watched: false },
        { canonicalName: '킹크랩', reason: '신규 등장', watched: true }
      ])
    })

    const response = await handleDiscordInteraction(
      createSignedRequest('https://example.com/api/discord/interactions', {
        type: 3,
        member: { user: { id: 'user-1' } },
        data: {
          custom_id: 'bushiri:watch:2026-05-10',
          component_type: 3,
          values: ['광어']
        }
      }),
      createEnv(state)
    )

    expect(response.status).toBe(200)
    expect(state.watchItems.map((item) => item.canonical_name)).toEqual(['광어'])
    await expect(response.json()).resolves.toMatchObject({ type: 7 })
  })

  it('handles Korean slash watch add, list, and remove commands', async () => {
    const state = createState()
    const env = createEnv(state)

    const addResponse = await handleDiscordInteraction(
      createSignedRequest('https://example.com/api/discord/interactions', {
        type: 2,
        member: { user: { id: 'user-1' } },
        data: {
          name: '관심',
          options: [
            {
              name: '추가',
              type: 1,
              options: [{ name: '품목', type: 3, value: '광어' }]
            }
          ]
        }
      }),
      env
    )

    expect(addResponse.status).toBe(200)
    expect(state.watchItems.some((item) => item.canonical_name === '광어')).toBe(true)

    const listResponse = await handleDiscordInteraction(
      createSignedRequest('https://example.com/api/discord/interactions', {
        type: 2,
        data: {
          name: '관심',
          options: [{ name: '목록', type: 1 }]
        }
      }),
      env
    )
    await expect(listResponse.json()).resolves.toMatchObject({
      type: 4,
      data: expect.objectContaining({
        content: expect.stringContaining('광어')
      })
    })

    const removeResponse = await handleDiscordInteraction(
      createSignedRequest('https://example.com/api/discord/interactions', {
        type: 2,
        data: {
          name: '관심',
          options: [
            {
              name: '제거',
              type: 1,
              options: [{ name: '품목', type: 3, value: '광어' }]
            }
          ]
        }
      }),
      env
    )

    expect(removeResponse.status).toBe(200)
    expect(state.watchItems.some((item) => item.canonical_name === '광어')).toBe(false)
  })

  it('handles Korean slash channel set and current commands', async () => {
    const state = createState()
    state.alertChannel = null
    const env = createEnv(state)

    const setResponse = await handleDiscordInteraction(
      createSignedRequest('https://example.com/api/discord/interactions', {
        type: 2,
        guild_id: 'guild-2',
        channel_id: 'channel-2',
        member: { user: { id: 'user-2' } },
        data: {
          name: '채널',
          options: [{ name: '설정', type: 1 }]
        }
      }),
      env
    )

    expect(setResponse.status).toBe(200)
    expect(state.alertChannel).toEqual({
      guild_id: 'guild-2',
      channel_id: 'channel-2',
      configured_by_discord_user_id: 'user-2'
    })

    const currentResponse = await handleDiscordInteraction(
      createSignedRequest('https://example.com/api/discord/interactions', {
        type: 2,
        data: {
          name: '채널',
          options: [{ name: '확인', type: 1 }]
        }
      }),
      env
    )

    await expect(currentResponse.json()).resolves.toMatchObject({
      type: 4,
      data: expect.objectContaining({
        content: expect.stringContaining('<#channel-2>')
      })
    })
  })

  it('returns at most 25 autocomplete choices for species search', async () => {
    const response = await handleDiscordInteraction(
      createSignedRequest('https://example.com/api/discord/interactions', {
        type: 4,
        data: {
          name: '관심',
          options: [
            {
              name: '추가',
              type: 1,
              options: [{ name: '품목', type: 3, value: '품목', focused: true }]
            }
          ]
        }
      }),
      createEnv(createState())
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { data: { choices: unknown[] } }
    expect(payload.data.choices).toHaveLength(25)
  })
})
