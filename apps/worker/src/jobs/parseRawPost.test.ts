import { describe, expect, it } from 'vitest'
import type { D1DatabaseBinding, D1PreparedStatement } from '../env'
import { rawPostFixtures } from '../fixtures/rawPosts'
import { parseRawPostAndSave } from './parseRawPost'
import type { MarketLlmClient } from '../clients/llmClient'

type RawPostState = {
  id: number
  parse_status: string
  parse_error: string | null
}

function createFakeDb(rawPostId: number) {
  const snapshots: Array<Record<string, unknown>> = []
  const rawPostState: RawPostState = {
    id: rawPostId,
    parse_status: 'pending',
    parse_error: null
  }

  const db: D1DatabaseBinding = {
    prepare(query: string): D1PreparedStatement {
      let boundValues: Array<string | number | null> = []

      return {
        bind(...values) {
          boundValues = values
          return this
        },
        async first() {
          return null
        },
        async all() {
          return { results: [] }
        },
        async run() {
          if (query.startsWith('INSERT INTO item_snapshots')) {
            snapshots.push({ boundValues })
          }

          if (query.startsWith('UPDATE raw_posts SET parse_status')) {
            rawPostState.parse_status = String(boundValues[0])
            rawPostState.parse_error = boundValues[1] === null ? null : String(boundValues[1])
          }

          return { meta: {} }
        }
      }
    }
  }

  return { db, snapshots, rawPostState }
}

describe('parseRawPostAndSave', () => {
  it('parses and stores snapshots for the four raw post fixtures', async () => {
    const llmClient: MarketLlmClient = {
      async parseMarketPost({ vendorName }) {
        return {
          vendorName,
          marketDate: '2026-04-24',
          categoryHint: vendorName === '줄포상회' ? 'crustacean' : 'fish',
          warnings: [],
          items: [
            {
              category: vendorName === '줄포상회' ? 'crustacean' : 'fish',
              canonicalName: vendorName === '줄포상회' ? '킹크랩' : '광어',
              displayName: vendorName === '줄포상회' ? '블루 킹크랩' : '광어',
              origin: vendorName === '줄포상회' ? '러시아' : '국내산',
              productionType: null,
              freshnessState: null,
              grade: null,
              sizeMinKg: 2,
              sizeMaxKg: 3,
              unit: 'kg',
              pricePerKg: vendorName === '성전물산' ? 48000 : 32000,
              priceText: vendorName === '성전물산' ? 'kg 4.8' : '32,000원',
              soldOut: false,
              eventFlag: false,
              halfAvailable: false,
              notes: null,
              confidence: 0.92
            }
          ]
        }
      }
    }

    for (const [index, fixture] of rawPostFixtures.entries()) {
      const { db, snapshots, rawPostState } = createFakeDb(index + 1)

      const result = await parseRawPostAndSave(
        db,
        {
          id: index + 1,
          sourceId: index + 1,
          vendorName: fixture.vendorName,
          rawContentMasked: fixture.rawContent,
          postedAt: '2026-04-24T00:00:00.000Z'
        },
        llmClient
      )

      expect(result).toEqual({ status: 'parsed', itemsSaved: 1 })
      expect(snapshots).toHaveLength(1)
      expect(rawPostState.parse_status).toBe('parsed')
      expect(rawPostState.parse_error).toBeNull()
    }
  })
})
