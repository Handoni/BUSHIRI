import type { Env } from '../env'
import type { ParsedMarketPost } from '../types/llm'

export type MarketLlmClient = {
  parseMarketPost: (input: { vendorName: string | null; rawText: string }) => Promise<ParsedMarketPost>
}

export function createLlmClient(env: Env): MarketLlmClient {
  return {
    async parseMarketPost({ vendorName, rawText }) {
      if (env.LLM_PROVIDER !== 'pydantic_ai') {
        throw new Error(`Unsupported LLM provider: ${env.LLM_PROVIDER}`)
      }

      if (!env.LLM_PIPELINE_URL) {
        throw new Error('LLM_PIPELINE_URL is missing')
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (env.LLM_PIPELINE_TOKEN) {
        headers.Authorization = `Bearer ${env.LLM_PIPELINE_TOKEN}`
      }

      const response = await fetch(env.LLM_PIPELINE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: env.LLM_MODEL,
          vendorName,
          rawText
        })
      })

      if (!response.ok) {
        throw new Error(`LLM request failed with status ${response.status}`)
      }

      return (await response.json()) as ParsedMarketPost
    }
  }
}
