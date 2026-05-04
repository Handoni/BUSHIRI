import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRawPosts, getSpeciesTrend, getTodayMarket } from './api'

describe('getTodayMarket', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('requests the date-filtered market endpoint when a date is provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [], lastUpdated: null }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await getTodayMarket('2026-04-24')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/market/today?date=2026-04-24', {
      headers: {
        Accept: 'application/json',
      },
    })
  })

  it('normalizes structured market status fields into raw metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 1,
            canonicalName: '가리비',
            display_name: '일본산 가리비',
            origin: '일본산',
            production_type: '자연산',
            freshness_state: '활',
            half_available: true,
            price_text: 'kg 27,000원',
            size_min_kg: 1,
            size_max_kg: 2,
            sourceName: '줄포상회',
            pricePerKg: 27000,
          },
        ],
        lastUpdated: null,
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await getTodayMarket('2026-05-04')

    expect(result.rows[0].raw).toMatchObject({
      displayName: '일본산 가리비',
      origin: '일본산',
      productionType: '자연산',
      freshnessState: '활',
      halfAvailable: true,
      priceText: 'kg 27,000원',
      sizeMinKg: 1,
      sizeMaxKg: 2,
    })
  })

  it('keeps raw post skip reasons from parse errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rawPosts: [
          {
            id: 33,
            sourceName: '참조은수산',
            parseStatus: 'skipped',
            parse_error: 'manual: image-only price post; no OCR/manual-readable text captured',
            rawContentMasked: 'BAND_URL: [URL]\\n[이미지 게시글]',
          },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await getRawPosts()

    expect(result[0]).toMatchObject({
      source: '참조은수산',
      status: '건너뜀',
      parseError: 'manual: image-only price post; no OCR/manual-readable text captured',
    })
  })

  it('normalizes species trend rows with DB condition fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            marketDate: '2026-05-04',
            sourceName: '윤호수산',
            canonicalName: '광어',
            displayName: '완도 광어',
            origin: '완도',
            productionType: '양식',
            freshnessState: '활어',
            grade: null,
            sizeMinKg: 3,
            sizeMaxKg: 3,
            pricePerKg: 31000,
            notes: '업다운',
          },
        ],
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    const result = await getSpeciesTrend('광어', 30)

    expect(fetchMock).toHaveBeenCalledWith('/api/market/species/%EA%B4%91%EC%96%B4?days=30', {
      headers: {
        Accept: 'application/json',
      },
    })
    expect(result.points[0]).toMatchObject({
      date: '2026-05-04',
      market: '윤호수산',
      value: 31000,
    })
    expect(result.points[0].raw).toMatchObject({
      displayName: '완도 광어',
      origin: '완도',
      productionType: '양식',
      freshnessState: '활어',
      sizeMinKg: 3,
      sizeMaxKg: 3,
      notes: '업다운',
    })
  })
})
