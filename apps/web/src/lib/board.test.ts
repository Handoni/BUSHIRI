import { describe, expect, it } from 'vitest'
import { buildTodayBoard, getLowestVendorListing } from './board'

describe('buildTodayBoard', () => {
  it('builds an all section plus fish and crustacean sections with fixed vendor columns', () => {
    const board = buildTodayBoard([
      {
        id: '1',
        canonicalName: '광어',
        species: '광어',
        market: '국내산',
        price: 23000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '성전물산',
        raw: {},
      },
      {
        id: '2',
        canonicalName: '대게',
        species: '대게',
        market: '러시아',
        price: 33000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '줄포상회',
        raw: {},
      },
      {
        id: '3',
        canonicalName: '광어',
        species: '광어',
        market: '국내산',
        price: 22000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '윤호수산',
        raw: {},
      },
      {
        id: '4',
        canonicalName: '도다리',
        species: '도다리',
        market: '국내산',
        price: 18000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '참조은수산',
        raw: {},
      },
      {
        id: '5',
        canonicalName: '참돔',
        species: '참돔',
        market: '일본산',
        price: 27000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '성전물산',
        raw: {},
      },
      {
        id: '6',
        canonicalName: '농어',
        species: '농어',
        market: '중국산',
        price: 23000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '윤호수산',
        raw: {},
      },
      {
        id: '7',
        canonicalName: '광어',
        species: '광어',
        market: '국내산',
        price: 21000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '참조은수산',
        raw: {},
      },
      {
        id: '8',
        canonicalName: '킹크랩',
        species: '킹크랩',
        market: '러시아',
        price: 69000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '줄포상회',
        raw: {},
      },
    ])

    expect(board.sections).toHaveLength(3)
    expect(board.sections[0]).toMatchObject({
      key: 'all',
      label: '전체',
      vendorColumns: ['참조은수산', '성전물산', '윤호수산', '줄포상회'],
    })
    expect(board.sections[0].rows.map((row) => row.canonicalName)).toEqual(
      expect.arrayContaining(['도다리', '광어', '농어', '참돔', '대게', '킹크랩']),
    )
    expect(board.sections[1]).toMatchObject({
      key: 'fish',
      label: '회',
      vendorColumns: ['참조은수산', '성전물산', '윤호수산'],
    })
    expect(board.sections[1].rows.map((row) => row.canonicalName)).toEqual([
      '도다리',
      '광어',
      '농어',
      '참돔',
    ])
    expect(board.sections[2]).toMatchObject({
      key: 'crustacean',
      label: '갑각류',
      vendorColumns: ['줄포상회'],
    })
    expect(board.sections[2].rows.map((row) => row.canonicalName)).toEqual([
      '대게',
      '킹크랩',
    ])
  })

  it('uses canonical species labels and moves status fields into cell badges', () => {
    const board = buildTodayBoard([
      {
        id: '1',
        canonicalName: '감성돔',
        species: '자연산 감성돔',
        market: '국내산',
        price: 33000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-04-24',
        source: '성전물산',
        raw: {
          origin: '국내산',
          productionType: '자연산',
          freshnessState: '활',
          grade: null,
          displayName: '자연산 감성돔',
          sizeMinKg: 1.7,
          sizeMaxKg: 2,
          soldOut: false,
          eventFlag: false,
        },
      },
    ])

    expect(board.vendorColumns).toEqual(['성전물산'])
    expect(board.rows).toHaveLength(1)
    expect(board.rows[0].speciesLabel).toBe('감성돔')
    expect(board.rows[0].cells['성전물산']).toHaveLength(1)
    expect(board.rows[0].cells['성전물산'][0]).toMatchObject({
      price: 33000,
      variantLabel: '활어',
      weightLabel: '1.7~2kg',
      statusTags: ['활어'],
    })
  })

  it('separates same species rows by country and origin detail', () => {
    const board = buildTodayBoard([
      {
        id: '1',
        canonicalName: '가리비',
        species: '일본산 가리비',
        market: '일본산',
        price: 27000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '줄포상회',
        raw: {
          origin: '일본산',
          displayName: '일본산 가리비',
          sizeMinKg: null,
          sizeMaxKg: null,
          soldOut: false,
          eventFlag: false,
        },
      },
      {
        id: '2',
        canonicalName: '전복',
        species: '전복',
        market: '국내산',
        price: 18000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '줄포상회',
        raw: {
          origin: '국내산',
          displayName: '전복',
          sizeMinKg: null,
          sizeMaxKg: null,
          soldOut: false,
          eventFlag: false,
        },
      },
      {
        id: '3',
        canonicalName: '가리비',
        species: '홍가리비',
        market: '국내산',
        price: 9000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '줄포상회',
        raw: {
          origin: '국내산',
          displayName: '홍가리비',
          sizeMinKg: null,
          sizeMaxKg: null,
          soldOut: true,
          eventFlag: false,
        },
      },
    ])

    expect(board.rows).toHaveLength(3)
    expect(board.rows.map((row) => row.speciesLabel)).toEqual(['가리비', '가리비', '전복'])

    const japanScallop = board.rows.find((row) => row.cells['줄포상회'][0]?.price === 27000)?.cells['줄포상회'][0]
    const domesticScallop = board.rows.find((row) => row.cells['줄포상회'][0]?.price === 9000)?.cells['줄포상회'][0]

    expect(japanScallop).toMatchObject({
      price: 27000,
      variantLabel: '기본',
      statusTags: [],
    })
    expect(domesticScallop).toMatchObject({
      price: 9000,
      variantLabel: '홍가리비',
      weightLabel: '중량 미상',
      statusTags: ['품절', '홍가리비'],
    })
  })

  it('derives condition badges such as 찍어바리 and 꼬물이 from item text', () => {
    const board = buildTodayBoard([
      {
        id: '1',
        canonicalName: '시마아지',
        species: '시마아지 찍어바리',
        market: '일본산',
        price: 33000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '성전물산',
        raw: {
          origin: '일본산',
          displayName: '시마아지 찍어바리',
          notes: '기스 많음, 찍어바리',
          sizeMinKg: 2.5,
          sizeMaxKg: 2.9,
          soldOut: false,
          eventFlag: true,
        },
      },
      {
        id: '2',
        canonicalName: '킹크랩',
        species: '꼬물이급 레드 킹크랩',
        market: '러시아',
        price: 59000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '줄포상회',
        raw: {
          origin: '러시아',
          grade: '꼬물이급',
          displayName: '꼬물이급 레드 킹크랩',
          sizeMinKg: 5,
          sizeMaxKg: 6,
          soldOut: false,
          eventFlag: false,
        },
      },
    ])

    expect(board.rows[0].cells['성전물산'][0].statusTags).toContain('찍어바리')
    expect(board.rows[1].cells['줄포상회'][0].statusTags).toContain('꼬물이급')
  })

  it('finds the lowest priced vendor listing for a species row', () => {
    const board = buildTodayBoard([
      {
        id: '1',
        canonicalName: '광어',
        species: '광어',
        market: '국내산',
        price: 31000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '성전물산',
        raw: {
          origin: '국내산',
          sizeMinKg: 1,
          sizeMaxKg: 1.5,
        },
      },
      {
        id: '2',
        canonicalName: '광어',
        species: '광어',
        market: '국내산',
        price: 25000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '참조은수산',
        raw: {
          origin: '국내산',
          sizeMinKg: 0.8,
          sizeMaxKg: 1,
        },
      },
      {
        id: '3',
        canonicalName: '광어',
        species: '광어',
        market: '국내산',
        price: null,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '윤호수산',
        raw: {
          origin: '국내산',
        },
      },
    ])

    expect(getLowestVendorListing(board.sections[0].rows[0], board.sections[0].vendorColumns)).toMatchObject({
      vendor: '참조은수산',
      listing: {
        price: 25000,
        statusTags: [],
        weightLabel: '0.8~1kg',
      },
    })
  })

  it('maps award flags onto individual listing cards', () => {
    const board = buildTodayBoard([
      {
        id: '1',
        canonicalName: '도다리',
        species: '도다리',
        market: '국내산',
        price: 16000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-05-04',
        source: '참조은수산',
        raw: {
          bestCondition: true,
          lowestPrice: true,
          aiRecommended: true,
        },
      },
    ])

    expect(board.rows[0].cells['참조은수산'][0]).toMatchObject({
      isBestCondition: true,
      isLowestPrice: true,
      isAiRecommended: true,
    })
  })
})
