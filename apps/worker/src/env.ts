export type D1RunMeta = {
  last_row_id?: number
}

export type D1RunResult = {
  meta: D1RunMeta
}

export type D1QueryResult = {
  results: Record<string, unknown>[]
}

export type D1PreparedStatement = {
  bind: (...values: Array<string | number | null>) => D1PreparedStatement
  first: () => Promise<Record<string, unknown> | null>
  all: () => Promise<D1QueryResult>
  run: () => Promise<D1RunResult>
}

export type D1DatabaseBinding = {
  prepare: (query: string) => D1PreparedStatement
}

export type Env = {
  DB: D1DatabaseBinding
  ADMIN_TOKEN: string
  BAND_ACCESS_TOKEN?: string
  BAND_WEB_COOKIE?: string
  LLM_PIPELINE_URL?: string
  LLM_PIPELINE_TOKEN?: string
  DISCORD_WEBHOOK_URL?: string
  LLM_PROVIDER: string
  LLM_MODEL: string
  APP_TIMEZONE: string
  RAW_POST_RETENTION_DAYS: string
  COLLECT_LOOKBACK_HOURS: string
}
