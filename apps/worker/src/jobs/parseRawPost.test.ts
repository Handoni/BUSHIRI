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
  const snapshots: Array<{ boundValues: Array<string | number | null> }> = []
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
              originCountry: vendorName === '줄포상회' ? '러시아' : '국내산',
              originDetail: null,
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

  it('stores origin compatibility, country, and detail as separate snapshot fields', async () => {
    const { db, snapshots, rawPostState } = createFakeDb(1)
    const llmClient: MarketLlmClient = {
      async parseMarketPost() {
        return {
          vendorName: '참조은수산',
          marketDate: '2026-05-09',
          categoryHint: 'fish',
          warnings: [],
          items: [
            {
              category: 'fish',
              canonicalName: '광어',
              displayName: '광어',
              origin: '국내산',
              originCountry: '국내산',
              originDetail: '낚시바리',
              productionType: '자연산',
              freshnessState: null,
              grade: null,
              sizeMinKg: 2,
              sizeMaxKg: 3,
              unit: 'kg',
              pricePerKg: 32000,
              priceText: '32,000원',
              soldOut: false,
              eventFlag: false,
              halfAvailable: false,
              notes: null,
              confidence: 0.95
            }
          ]
        }
      }
    }

    const result = await parseRawPostAndSave(
      db,
      {
        id: 1,
        sourceId: 10,
        vendorName: '참조은수산',
        rawContentMasked: '국내산 낚시바리 자연산 광어 2~3kg 32,000원',
        postedAt: '2026-05-09T00:00:00.000Z'
      },
      llmClient
    )

    expect(result).toEqual({ status: 'parsed', itemsSaved: 1 })
    expect(rawPostState.parse_status).toBe('parsed')
    expect(snapshots).toHaveLength(1)
    expect(snapshots[0].boundValues.slice(6, 9)).toEqual(['국내산', '국내산', '낚시바리'])
  })
})
