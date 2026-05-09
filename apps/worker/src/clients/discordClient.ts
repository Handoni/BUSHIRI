export type DiscordComponent = {
  type: number
  components?: DiscordComponent[]
  options?: Array<{
    label: string
    value: string
    description?: string
    default?: boolean
  }>
  custom_id?: string
  placeholder?: string
  min_values?: number
  max_values?: number
}

export type DiscordMessagePayload = {
  content?: string | null
  embeds?: unknown[]
  components?: DiscordComponent[]
  allowed_mentions?: {
    parse: string[]
  }
  flags?: number
}

export type DiscordMessageResponse = {
  id: string
}

export type DiscordClient = {
  createMessage: (channelId: string, payload: DiscordMessagePayload) => Promise<DiscordMessageResponse>
  editMessage: (channelId: string, messageId: string, payload: DiscordMessagePayload) => Promise<DiscordMessageResponse>
  upsertGlobalApplicationCommand: (applicationId: string, payload: unknown) => Promise<unknown>
}

type DiscordClientOptions = {
  botToken: string
  apiBaseUrl?: string
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

const DEFAULT_API_BASE_URL = 'https://discord.com/api/v10'

async function defaultSleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text()

  if (!text) {
    return {}
  }

  return JSON.parse(text) as unknown
}

async function readRetryAfterMs(response: Response): Promise<number> {
  const retryAfterHeader = response.headers.get('retry-after')
  const headerValue = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader)

  if (Number.isFinite(headerValue) && headerValue >= 0) {
    return headerValue * 1000
  }

  const payload = await response
    .clone()
    .json()
    .catch(() => null) as { retry_after?: unknown } | null
  const retryAfter = Number(payload?.retry_after)

  return Number.isFinite(retryAfter) && retryAfter >= 0 ? retryAfter * 1000 : 1000
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '')
}

export function createDiscordClient(options: DiscordClientOptions): DiscordClient {
  const fetchImpl = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? defaultSleep
  const apiBaseUrl = trimTrailingSlash(options.apiBaseUrl ?? DEFAULT_API_BASE_URL)

  async function request(path: string, init: RequestInit): Promise<unknown> {
    let attempt = 0
    let delayMs = 250

    while (attempt < 4) {
      attempt += 1

      const response = await fetchImpl(`${apiBaseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bot ${options.botToken}`,
          'Content-Type': 'application/json',
          ...(init.headers ?? {})
        }
      })

      if (response.ok) {
        return parseJson(response)
      }

      if (response.status === 429 && attempt < 4) {
        await sleep(await readRetryAfterMs(response))
        continue
      }

      if (response.status >= 500 && response.status < 600 && attempt < 4) {
        await sleep(delayMs)
        delayMs *= 2
        continue
      }

      const body = await response.text().catch(() => '')
      throw new Error(`Discord API request failed with status ${response.status}${body ? `: ${body}` : ''}`)
    }

    throw new Error('Discord API request exhausted retries')
  }

  return {
    async createMessage(channelId, payload) {
      const result = await request(`/channels/${encodeURIComponent(channelId)}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      return { id: String((result as { id?: unknown }).id) }
    },

    async editMessage(channelId, messageId, payload) {
      const result = await request(`/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(messageId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload)
      })

      return { id: String((result as { id?: unknown }).id) }
    },

    async upsertGlobalApplicationCommand(applicationId, payload) {
      return request(`/applications/${encodeURIComponent(applicationId)}/commands`, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
    }
  }
}
