import nacl from 'tweetnacl'
import { createDiscordClient, type DiscordClient, type DiscordMessagePayload } from '../clients/discordClient'
import type { D1DatabaseBinding, Env } from '../env'
import {
  buildDailyDiscordMessage,
  type DailyDiscordHighlight,
  type DailyDiscordSelectCandidate,
  type DailyDiscordWatchedSummary
} from '../jobs/sendDiscord'

type DailyMessageRow = {
  marketDate: string
  channelId: string
  messageId: string
  candidateJson: string
}

type AlertChannelRow = {
  guildId: string | null
  channelId: string
  configuredByDiscordUserId: string | null
}

type WatchItemRow = {
  canonicalName: string
  addedByDiscordUserId: string | null
}

type MarketRow = {
  canonicalName: string
  vendorName: string
  displayName: string
  pricePerKg: number | null
  priceText: string | null
  soldOut: boolean
  bestCondition: boolean
  lowestPrice: boolean
  aiRecommendation: boolean
}

type DiscordInteraction = {
  type: number
  data?: DiscordInteractionData
  guild_id?: string
  channel_id?: string
  member?: { user?: { id?: string } }
  user?: { id?: string }
}

type DiscordInteractionData = {
  name?: string
  custom_id?: string
  component_type?: number
  values?: string[]
  options?: DiscordCommandOption[]
}

type DiscordCommandOption = {
  name: string
  type: number
  value?: string | number | boolean
  focused?: boolean
  options?: DiscordCommandOption[]
}

const DISCORD_EPHEMERAL_FLAG = 64
const DASHBOARD_URL = 'https://bushiri-46o.pages.dev'
const HIGHLIGHT_TYPES = new Set(['new_item', 'price_drop', 'lowest_price'])

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function parseBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization')

  if (!authorization?.startsWith('Bearer ')) {
    return null
  }

  return authorization.slice('Bearer '.length).trim()
}

function requireAdmin(request: Request, env?: Env): Response | null {
  const token = parseBearerToken(request)
  const adminToken = env?.ADMIN_TOKEN

  if (!token || !adminToken || token !== adminToken) {
    return json({ ok: false, error: 'Unauthorized' }, 401)
  }

  return null
}

function mapDailyMessageRow(row: Record<string, unknown>): DailyMessageRow {
  return {
    marketDate: String(row.market_date),
    channelId: String(row.channel_id),
    messageId: String(row.message_id),
    candidateJson: String(row.candidate_json)
  }
}

function mapAlertChannelRow(row: Record<string, unknown>): AlertChannelRow {
  return {
    guildId: row.guild_id === null ? null : String(row.guild_id),
    channelId: String(row.channel_id),
    configuredByDiscordUserId:
      row.configured_by_discord_user_id === null ? null : String(row.configured_by_discord_user_id)
  }
}

function mapWatchItemRow(row: Record<string, unknown>): WatchItemRow {
  return {
    canonicalName: String(row.canonical_name),
    addedByDiscordUserId: row.added_by_discord_user_id === null ? null : String(row.added_by_discord_user_id)
  }
}

function mapMarketRow(row: Record<string, unknown>): MarketRow {
  return {
    canonicalName: String(row.canonical_name),
    vendorName: String(row.vendor_name),
    displayName: String(row.display_name),
    pricePerKg: row.price_per_kg === null ? null : Number(row.price_per_kg),
    priceText: row.price_text === null ? null : String(row.price_text),
    soldOut: Number(row.sold_out) === 1,
    bestCondition: Number(row.best_condition_flag) === 1,
    lowestPrice: Number(row.lowest_price_flag) === 1,
    aiRecommendation: Number(row.ai_recommendation_flag) === 1
  }
}

function todayInTimezone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date())

  const year = parts.find((part) => part.type === 'year')?.value ?? '1970'
  const month = parts.find((part) => part.type === 'month')?.value ?? '01'
  const day = parts.find((part) => part.type === 'day')?.value ?? '01'

  return `${year}-${month}-${day}`
}

async function readMarketDate(request: Request, env: Env): Promise<string | Response> {
  const payload = await request.json().catch(() => ({})) as { marketDate?: unknown }

  if (payload.marketDate === undefined || payload.marketDate === null || payload.marketDate === '') {
    return todayInTimezone(env.APP_TIMEZONE)
  }

  if (typeof payload.marketDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(payload.marketDate)) {
    return json({ ok: false, error: 'Invalid field: marketDate' }, 400)
  }

  return payload.marketDate
}

async function getDailyMessage(db: D1DatabaseBinding, marketDate: string): Promise<DailyMessageRow | null> {
  const row = await db
    .prepare(
      `SELECT market_date, channel_id, message_id, candidate_json
       FROM discord_daily_messages
       WHERE market_date = ?1`
    )
    .bind(marketDate)
    .first()

  return row ? mapDailyMessageRow(row) : null
}

async function saveDailyMessage(
  db: D1DatabaseBinding,
  input: { marketDate: string; channelId: string; messageId: string; candidateJson: string; exists: boolean }
): Promise<void> {
  if (input.exists) {
    await db
      .prepare(
        `UPDATE discord_daily_messages
         SET channel_id = ?1, message_id = ?2, candidate_json = ?3, updated_at = CURRENT_TIMESTAMP
         WHERE market_date = ?4`
      )
      .bind(input.channelId, input.messageId, input.candidateJson, input.marketDate)
      .run()
    return
  }

  await db
    .prepare(
      `INSERT INTO discord_daily_messages (
         market_date,
         channel_id,
         message_id,
         candidate_json
       ) VALUES (?1, ?2, ?3, ?4)`
    )
    .bind(input.marketDate, input.channelId, input.messageId, input.candidateJson)
    .run()
}

async function getAlertChannel(db: D1DatabaseBinding): Promise<AlertChannelRow | null> {
  const row = await db
    .prepare(
      `SELECT guild_id, channel_id, configured_by_discord_user_id
       FROM discord_alert_channels
       WHERE id = 1`
    )
    .first()

  return row ? mapAlertChannelRow(row) : null
}

async function saveAlertChannel(
  db: D1DatabaseBinding,
  input: { guildId: string | null; channelId: string; userId: string | null }
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO discord_alert_channels (
         id,
         guild_id,
         channel_id,
         configured_by_discord_user_id
       ) VALUES (1, ?1, ?2, ?3)
       ON CONFLICT(id) DO UPDATE SET
         guild_id = excluded.guild_id,
         channel_id = excluded.channel_id,
         configured_by_discord_user_id = excluded.configured_by_discord_user_id,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(input.guildId, input.channelId, input.userId)
    .run()
}

async function listHighlightInsights(db: D1DatabaseBinding, marketDate: string): Promise<DailyDiscordHighlight[]> {
  const result = await db
    .prepare(
      `SELECT insight_type, severity, canonical_name, title, body
       FROM insights
       WHERE market_date = ?1
         AND insight_type IN ('new_item', 'price_drop', 'lowest_price')
       ORDER BY
         CASE severity
           WHEN 'critical' THEN 0
           WHEN 'warning' THEN 1
           WHEN 'notice' THEN 2
           ELSE 3
         END,
         created_at ASC,
         id ASC`
    )
    .bind(marketDate)
    .all()

  return result.results
    .filter((row) => HIGHLIGHT_TYPES.has(String(row.insight_type)) && row.canonical_name !== null)
    .map((row) => ({
      canonicalName: String(row.canonical_name),
      signal: String(row.insight_type) as DailyDiscordHighlight['signal'],
      title: String(row.title),
      body: String(row.body)
    }))
}

async function listWatchItems(db: D1DatabaseBinding): Promise<WatchItemRow[]> {
  const result = await db
    .prepare(
      `SELECT canonical_name, added_by_discord_user_id
       FROM discord_watch_items
       ORDER BY canonical_name ASC`
    )
    .all()

  return result.results.map(mapWatchItemRow)
}

async function upsertWatchItem(db: D1DatabaseBinding, canonicalName: string, userId: string | null): Promise<void> {
  await db
    .prepare(
      `INSERT INTO discord_watch_items (canonical_name, added_by_discord_user_id)
       VALUES (?1, ?2)
       ON CONFLICT(canonical_name) DO UPDATE SET
         added_by_discord_user_id = excluded.added_by_discord_user_id,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(canonicalName, userId)
    .run()
}

async function deleteWatchItem(db: D1DatabaseBinding, canonicalName: string): Promise<void> {
  await db.prepare('DELETE FROM discord_watch_items WHERE canonical_name = ?1').bind(canonicalName).run()
}

async function listMarketRows(db: D1DatabaseBinding, marketDate: string): Promise<MarketRow[]> {
  const result = await db
    .prepare(
      `SELECT i.canonical_name, s.vendor_name, i.display_name, i.price_per_kg, i.price_text, i.sold_out,
              i.best_condition_flag, i.lowest_price_flag, i.ai_recommendation_flag
       FROM item_snapshots i
       JOIN sources s ON s.id = i.source_id
       WHERE i.market_date = ?1
       ORDER BY i.canonical_name ASC, i.price_per_kg ASC, i.id ASC`
    )
    .bind(marketDate)
    .all()

  return result.results.map(mapMarketRow)
}

async function listSpeciesNames(db: D1DatabaseBinding): Promise<string[]> {
  const configuredNames = await db
    .prepare(
      `SELECT canonical_name FROM species_profiles
       UNION
       SELECT canonical_name FROM species_aliases
       ORDER BY canonical_name ASC`
    )
    .all()
  const observedNames = await db
    .prepare(
      `SELECT DISTINCT canonical_name
       FROM item_snapshots
       ORDER BY canonical_name ASC`
    )
    .all()

  return [
    ...new Set(
      [...configuredNames.results, ...observedNames.results].map((row) => String(row.canonical_name)).filter(Boolean)
    )
  ].sort()
}

function signalReason(signal: DailyDiscordHighlight['signal']): string {
  switch (signal) {
    case 'new_item':
      return '신규 등장'
    case 'price_drop':
      return '가격 하락'
    case 'lowest_price':
      return '최근 최저'
  }
}

function buildSelectCandidates(highlights: DailyDiscordHighlight[], watchItems: WatchItemRow[]): DailyDiscordSelectCandidate[] {
  const watchedNames = new Set(watchItems.map((item) => item.canonicalName))
  const byName = new Map<string, { reasons: Set<string>; firstIndex: number }>()

  highlights.forEach((highlight, index) => {
    const entry = byName.get(highlight.canonicalName) ?? { reasons: new Set<string>(), firstIndex: index }
    entry.reasons.add(signalReason(highlight.signal))
    byName.set(highlight.canonicalName, entry)
  })

  return [...byName.entries()]
    .sort((left, right) => left[1].firstIndex - right[1].firstIndex)
    .slice(0, 25)
    .map(([canonicalName, entry]) => ({
      canonicalName,
      reason: [...entry.reasons].join(', '),
      watched: watchedNames.has(canonicalName)
    }))
}

function formatPrice(row: MarketRow): string {
  if (row.priceText) {
    return row.priceText
  }

  if (row.pricePerKg !== null) {
    return `${row.pricePerKg.toLocaleString('ko-KR')}원/kg`
  }

  return '가격 미표기'
}

function badgesForRow(row: MarketRow): string {
  const badges = [
    row.aiRecommendation ? 'AI추천' : null,
    row.lowestPrice ? '최저가' : null,
    row.bestCondition ? '최상품' : null
  ].filter((value): value is string => value !== null)

  return badges.join('/')
}

function chooseRepresentativeRow(rows: MarketRow[]): MarketRow | null {
  const eligible = rows.filter((row) => !row.soldOut)
  const candidates = eligible.length > 0 ? eligible : rows

  return candidates
    .slice()
    .sort((left, right) => {
      const leftAwardScore = (left.aiRecommendation ? 0 : 1) + (left.lowestPrice ? 0 : 1) + (left.bestCondition ? 0 : 1)
      const rightAwardScore = (right.aiRecommendation ? 0 : 1) + (right.lowestPrice ? 0 : 1) + (right.bestCondition ? 0 : 1)
      const leftPrice = left.pricePerKg ?? Number.MAX_SAFE_INTEGER
      const rightPrice = right.pricePerKg ?? Number.MAX_SAFE_INTEGER

      return leftPrice - rightPrice || leftAwardScore - rightAwardScore
    })[0] ?? null
}

function buildWatchedSummaries(watchItems: WatchItemRow[], marketRows: MarketRow[]): DailyDiscordWatchedSummary[] {
  return watchItems
    .map((watchItem) => {
      const rows = marketRows.filter((row) => row.canonicalName === watchItem.canonicalName)
      const representative = chooseRepresentativeRow(rows)

      if (!representative) {
        return null
      }

      const badges = badgesForRow(representative)
      return {
        canonicalName: watchItem.canonicalName,
        summary: `${representative.vendorName} ${formatPrice(representative)}${badges ? ` · ${badges}` : ''}`
      }
    })
    .filter((item): item is DailyDiscordWatchedSummary => item !== null)
}

function dashboardUrl(marketDate: string): string {
  return `${DASHBOARD_URL}/today?date=${encodeURIComponent(marketDate)}`
}

async function buildDailyPayload(db: D1DatabaseBinding, marketDate: string): Promise<{
  payload: DiscordMessagePayload
  candidates: DailyDiscordSelectCandidate[]
}> {
  const [highlights, watchItems, marketRows] = await Promise.all([
    listHighlightInsights(db, marketDate),
    listWatchItems(db),
    listMarketRows(db, marketDate)
  ])
  const candidates = buildSelectCandidates(highlights, watchItems)

  return {
    payload: buildDailyDiscordMessage({
      marketDate,
      dashboardUrl: dashboardUrl(marketDate),
      highlights,
      watchedSummaries: buildWatchedSummaries(watchItems, marketRows),
      selectCandidates: candidates
    }),
    candidates
  }
}

function requireDiscordBotConfig(env: Env | undefined): { botToken: string } | Response {
  if (!env?.DISCORD_BOT_TOKEN) {
    return json({ ok: false, error: 'Discord bot configuration missing' }, 500)
  }

  return {
    botToken: env.DISCORD_BOT_TOKEN
  }
}

export async function handleDiscordDailySummary(
  request: Request,
  env: Env | undefined,
  discordClient?: DiscordClient
): Promise<Response> {
  const unauthorized = requireAdmin(request, env)
  if (unauthorized) {
    return unauthorized
  }

  if (!env?.DB) {
    return json({ ok: false, error: 'Database binding missing' }, 500)
  }

  const config = requireDiscordBotConfig(env)
  if (config instanceof Response) {
    return config
  }

  const marketDate = await readMarketDate(request, env)
  if (marketDate instanceof Response) {
    return marketDate
  }

  const existingMessage = await getDailyMessage(env.DB, marketDate)
  const alertChannel = existingMessage ? null : await getAlertChannel(env.DB)
  const channelId = existingMessage?.channelId ?? alertChannel?.channelId

  if (!channelId) {
    return json({ ok: false, error: 'Discord alert channel not configured' }, 409)
  }

  const { payload, candidates } = await buildDailyPayload(env.DB, marketDate)
  const client = discordClient ?? createDiscordClient({ botToken: config.botToken })
  const message = existingMessage
    ? await client.editMessage(existingMessage.channelId, existingMessage.messageId, payload)
    : await client.createMessage(channelId, payload)
  const messageId = message.id || existingMessage?.messageId

  if (!messageId) {
    return json({ ok: false, error: 'Discord message id missing' }, 502)
  }

  await saveDailyMessage(env.DB, {
    marketDate,
    channelId,
    messageId,
    candidateJson: JSON.stringify(candidates),
    exists: existingMessage !== null
  })

  return json({
    ok: true,
    marketDate,
    channelId,
    messageId,
    updated: existingMessage !== null,
    candidates
  })
}

function hexToBytes(value: string): Uint8Array | null {
  if (!/^[0-9a-fA-F]+$/.test(value) || value.length % 2 !== 0) {
    return null
  }

  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }

  return bytes
}

async function readVerifiedInteractionBody(request: Request, publicKey: string): Promise<string | Response> {
  const signature = request.headers.get('x-signature-ed25519')
  const timestamp = request.headers.get('x-signature-timestamp')
  const body = await request.text()

  if (!signature || !timestamp) {
    return json({ ok: false, error: 'Invalid request signature' }, 401)
  }

  const signatureBytes = hexToBytes(signature)
  const publicKeyBytes = hexToBytes(publicKey)

  if (!signatureBytes || !publicKeyBytes) {
    return json({ ok: false, error: 'Invalid request signature' }, 401)
  }

  const message = new TextEncoder().encode(timestamp + body)
  const verified = nacl.sign.detached.verify(message, signatureBytes, publicKeyBytes)

  return verified ? body : json({ ok: false, error: 'Invalid request signature' }, 401)
}

function parseInteraction(body: string): DiscordInteraction | Response {
  const parsed = JSON.parse(body) as unknown

  if (typeof parsed !== 'object' || parsed === null || typeof (parsed as { type?: unknown }).type !== 'number') {
    return json({ ok: false, error: 'Invalid Discord interaction' }, 400)
  }

  return parsed as DiscordInteraction
}

function interactionMessage(content: string): Response {
  return json({
    type: 4,
    data: {
      content,
      flags: DISCORD_EPHEMERAL_FLAG,
      allowed_mentions: { parse: [] }
    }
  })
}

function userIdFromInteraction(interaction: DiscordInteraction): string | null {
  return interaction.member?.user?.id ?? interaction.user?.id ?? null
}

function parseCandidateJson(value: string): DailyDiscordSelectCandidate[] {
  const parsed = JSON.parse(value) as unknown
  if (!Array.isArray(parsed)) {
    return []
  }

  return parsed
    .map((item) => {
      if (typeof item === 'string') {
        return { canonicalName: item, reason: '', watched: false }
      }

      if (typeof item === 'object' && item !== null && typeof (item as { canonicalName?: unknown }).canonicalName === 'string') {
        const record = item as { canonicalName: string; reason?: unknown; watched?: unknown }
        return {
          canonicalName: record.canonicalName,
          reason: typeof record.reason === 'string' ? record.reason : '',
          watched: record.watched === true
        }
      }

      return null
    })
    .filter((item): item is DailyDiscordSelectCandidate => item !== null)
}

async function handleWatchSelect(interaction: DiscordInteraction, db: D1DatabaseBinding): Promise<Response> {
  const customId = interaction.data?.custom_id ?? ''
  const match = customId.match(/^bushiri:watch:(\d{4}-\d{2}-\d{2})$/)

  if (!match) {
    return interactionMessage('지원하지 않는 선택 메뉴입니다.')
  }

  const marketDate = match[1]
  const dailyMessage = await getDailyMessage(db, marketDate)

  if (!dailyMessage) {
    return interactionMessage('해당 날짜의 Discord 알림 메시지를 찾지 못했습니다.')
  }

  const selectedValues = new Set(interaction.data?.values ?? [])
  const candidates = parseCandidateJson(dailyMessage.candidateJson)
  const userId = userIdFromInteraction(interaction)

  for (const candidate of candidates) {
    if (selectedValues.has(candidate.canonicalName)) {
      await upsertWatchItem(db, candidate.canonicalName, userId)
    } else {
      await deleteWatchItem(db, candidate.canonicalName)
    }
  }

  const { payload } = await buildDailyPayload(db, marketDate)
  return json({
    type: 7,
    data: payload
  })
}

function flattenOptions(options: DiscordCommandOption[] = []): DiscordCommandOption[] {
  return options.flatMap((option) => [option, ...flattenOptions(option.options ?? [])])
}

function topLevelSubcommand(interaction: DiscordInteraction): DiscordCommandOption | null {
  return interaction.data?.options?.[0] ?? null
}

function speciesFromSubcommand(subcommand: DiscordCommandOption | null): string | null {
  const value = subcommand?.options?.find((option) => option.name === '품목')?.value
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

async function handleWatchCommand(interaction: DiscordInteraction, db: D1DatabaseBinding): Promise<Response> {
  const subcommand = topLevelSubcommand(interaction)
  const species = speciesFromSubcommand(subcommand)
  const userId = userIdFromInteraction(interaction)

  if (subcommand?.name === '추가' && species) {
    await upsertWatchItem(db, species, userId)
    return interactionMessage(`${species} 관심 목록에 추가했습니다.`)
  }

  if (subcommand?.name === '제거' && species) {
    await deleteWatchItem(db, species)
    return interactionMessage(`${species} 관심 목록에서 제거했습니다.`)
  }

  if (subcommand?.name === '목록') {
    const watchItems = await listWatchItems(db)
    const names = watchItems.map((item) => item.canonicalName)
    return interactionMessage(names.length > 0 ? `관심 품목: ${names.join(', ')}` : '관심 품목이 없습니다.')
  }

  return interactionMessage('지원하지 않는 관심 명령입니다.')
}

async function handleChannelCommand(interaction: DiscordInteraction, db: D1DatabaseBinding): Promise<Response> {
  const subcommand = topLevelSubcommand(interaction)

  if (subcommand?.name === '설정') {
    if (!interaction.channel_id) {
      return interactionMessage('현재 Discord 채널을 확인하지 못했습니다.')
    }

    await saveAlertChannel(db, {
      guildId: interaction.guild_id ?? null,
      channelId: interaction.channel_id,
      userId: userIdFromInteraction(interaction)
    })

    return interactionMessage(`<#${interaction.channel_id}> 채널을 BUSHIRI 알림방으로 설정했습니다.`)
  }

  if (subcommand?.name === '확인') {
    const alertChannel = await getAlertChannel(db)
    return interactionMessage(
      alertChannel
        ? `현재 BUSHIRI 알림방: <#${alertChannel.channelId}>`
        : '설정된 BUSHIRI 알림방이 없습니다. 알림방에서 `/채널 설정`을 실행하세요.'
    )
  }

  return interactionMessage('지원하지 않는 채널 명령입니다.')
}

async function handleAutocomplete(interaction: DiscordInteraction, db: D1DatabaseBinding): Promise<Response> {
  const focused = flattenOptions(interaction.data?.options ?? []).find((option) => option.focused)
  const query = typeof focused?.value === 'string' ? focused.value.trim().toLocaleLowerCase('ko-KR') : ''
  const speciesNames = await listSpeciesNames(db)
  const choices = speciesNames
    .filter((name) => !query || name.toLocaleLowerCase('ko-KR').includes(query))
    .slice(0, 25)
    .map((name) => ({
      name,
      value: name
    }))

  return json({
    type: 8,
    data: { choices }
  })
}

export async function handleDiscordInteraction(request: Request, env: Env | undefined): Promise<Response> {
  if (!env?.DB) {
    return json({ ok: false, error: 'Database binding missing' }, 500)
  }

  if (!env.DISCORD_PUBLIC_KEY) {
    return json({ ok: false, error: 'Discord public key missing' }, 500)
  }

  const body = await readVerifiedInteractionBody(request, env.DISCORD_PUBLIC_KEY)
  if (body instanceof Response) {
    return body
  }

  const interaction = parseInteraction(body)
  if (interaction instanceof Response) {
    return interaction
  }

  if (interaction.type === 1) {
    return json({ type: 1 })
  }

  if (interaction.type === 3) {
    return handleWatchSelect(interaction, env.DB)
  }

  if (interaction.type === 4) {
    return handleAutocomplete(interaction, env.DB)
  }

  if (interaction.type === 2 && interaction.data?.name === '관심') {
    return handleWatchCommand(interaction, env.DB)
  }

  if (interaction.type === 2 && interaction.data?.name === '채널') {
    return handleChannelCommand(interaction, env.DB)
  }

  return interactionMessage('지원하지 않는 Discord interaction입니다.')
}
