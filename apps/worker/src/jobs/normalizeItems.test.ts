import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { ParsedMarketItem } from '../types/llm'
import { buildCompareKey, detectEventFlag, detectSoldOut, normalizeParsedItem, normalizeOrigin, parseWeightRange, resolveCanonicalName } from './normalizeItems'
import { parsePricePerKg } from '../lib/price'

const aliases = [
  { alias: '제주광어', canonicalName: '광어' },
  { alias: '황금광어', canonicalName: '황금광어' },
  { alias: '흑점줄전갱이', canonicalName: '시마아지' },
  { alias: '블루 킹크랩', canonicalName: '킹크랩' },
  { alias: '마가단 대게', canonicalName: '대게' }
]

describe('parsePricePerKg', () => {
  it('parses the documented price notation cases', () => {
    expect(parsePricePerKg('kg 4.8', 'manwon')).toBe(48000)
    expect(parsePricePerKg('18.000원', 'auto')).toBe(18000)
    expect(parsePricePerKg('20.000원', 'auto')).toBe(20000)
    expect(parsePricePerKg('20000', 'won')).toBe(20000)
    expect(parsePricePerKg('kg 46,000원', 'auto')).toBe(46000)
    expect(parsePricePerKg('‼️‼️‼️ 20.000원‼️‼️‼️', 'auto')).toBe(20000)
  })
})

describe('parseWeightRange', () => {
  it('parses the documented weight range cases', () => {
    expect(parseWeightRange('2.2-2.5kg')).toEqual({ sizeMinKg: 2.2, sizeMaxKg: 2.5 })
    expect(parseWeightRange('3~4k')).toEqual({ sizeMinKg: 3, sizeMaxKg: 4 })
    expect(parseWeightRange('3k업')).toEqual({ sizeMinKg: 3, sizeMaxKg: null })
    expect(parseWeightRange('700g~1.5k')).toEqual({ sizeMinKg: 0.7, sizeMaxKg: 1.5 })
    expect(parseWeightRange('800g')).toEqual({ sizeMinKg: 0.8, sizeMaxKg: 0.8 })
  })
})

describe('status and alias normalization', () => {
  it('detects sold out lines and avoids false positives for 완도광어', () => {
    expect(detectSoldOut('자연산참돔3kㅡ16000완')).toBe(true)
    expect(detectSoldOut('완도광어3kㅡ31000')).toBe(false)
    expect(detectSoldOut('❌마감')).toBe(true)
    expect(detectSoldOut('🚫 표시 품절')).toBe(true)
  })

  it('resolves documented aliases', () => {
    expect(resolveCanonicalName('제주광어', aliases)).toBe('광어')
    expect(resolveCanonicalName('황금광어', aliases)).toBe('황금광어')
    expect(resolveCanonicalName('흑점줄전갱이', aliases)).toBe('시마아지')
    expect(resolveCanonicalName('블루 킹크랩', aliases)).toBe('킹크랩')
    expect(resolveCanonicalName('마가단 대게', aliases)).toBe('대게')
  })

  it('seeds 황금광어 as its own canonical species', () => {
    const seedSql = readFileSync(new URL('../../migrations/0002_seed_aliases.sql', import.meta.url), 'utf8')

    expect(seedSql).toContain("('fish', '황금광어', '황금광어')")
    expect(seedSql).not.toContain("('fish', '광어', '황금광어')")
  })

  it('normalizes origins and compare keys', () => {
    expect(normalizeOrigin('제주')).toBe('국내산')
    expect(normalizeOrigin('거제')).toBe('국내산')
    expect(normalizeOrigin('마가단산')).toBe('러시아')
    expect(normalizeOrigin('러시아/노르웨이/일본')).toBeNull()
    expect(normalizeOrigin('일본산')).toBe('일본산')
    expect(detectEventFlag('황금광어 이벤트 특가')).toBe(true)
    expect(
      buildCompareKey({
        canonicalName: '광어',
        origin: '국내산',
        productionType: '자연산',
        freshnessState: null,
        grade: null,
        eventFlag: false,
        sizeMinKg: 2,
        sizeMaxKg: 3
      })
    ).toBe('광어|국내산|자연산|unknown|general|2~3kg')
  })
})

describe('normalizeParsedItem', () => {
  it('normalizes a parsed market item into a compare-ready item', () => {
    const item: ParsedMarketItem = {
      category: 'fish',
      canonicalName: null,
      displayName: '제주광어',
      origin: '제주',
      originCountry: null,
      originDetail: null,
      productionType: '자연산',
      freshnessState: null,
      grade: null,
      sizeMinKg: 2,
      sizeMaxKg: 3,
      unit: 'kg',
      pricePerKg: null,
      priceText: 'kg 4.8',
      soldOut: false,
      eventFlag: true,
      halfAvailable: false,
      notes: null,
      confidence: 0.9
    }

    expect(normalizeParsedItem(item, { priceNotation: 'manwon', vendorName: '성전물산', aliases })).toMatchObject({
      canonicalName: '광어',
      origin: '국내산',
      originCountry: '국내산',
      originDetail: '자연산',
      pricePerKg: 48000,
      eventFlag: true,
      compareKey: '광어|국내산|자연산|unknown|event|2~3kg'
    })
  })

  it('keeps country and origin detail separate using priority rules', () => {
    const farmedJeju: ParsedMarketItem = {
      category: 'fish',
      canonicalName: '광어',
      displayName: '광어',
      origin: '제주산',
      originCountry: null,
      originDetail: null,
      productionType: '양식',
      freshnessState: null,
      grade: null,
      sizeMinKg: null,
      sizeMaxKg: null,
      unit: 'kg',
      pricePerKg: 28000,
      priceText: '28,000원',
      soldOut: false,
      eventFlag: false,
      halfAvailable: false,
      notes: null,
      confidence: 0.9
    }
    const lineCaughtWild: ParsedMarketItem = {
      ...farmedJeju,
      displayName: '국내산 낚시바리 광어',
      origin: '국내산',
      originCountry: '국내산',
      originDetail: null,
      productionType: '자연산',
      grade: '낚시바리'
    }
    const countryOnly: ParsedMarketItem = {
      ...farmedJeju,
      displayName: '일본산 참돔',
      canonicalName: '참돔',
      origin: '일본산',
      originCountry: null,
      originDetail: null,
      productionType: null
    }
    const regionalDomestic: ParsedMarketItem = {
      ...farmedJeju,
      displayName: '보리숭어',
      canonicalName: '보리숭어',
      origin: '거제',
      originCountry: null,
      originDetail: null,
      productionType: null
    }
    const detailOnlyRegion: ParsedMarketItem = {
      ...farmedJeju,
      origin: null,
      originCountry: null,
      originDetail: '완도산',
      productionType: null
    }

    expect(normalizeParsedItem(farmedJeju, { priceNotation: 'won', vendorName: '참조은수산', aliases })).toMatchObject({
      origin: '국내산',
      originCountry: '국내산',
      originDetail: '제주산'
    })
    expect(normalizeParsedItem(lineCaughtWild, { priceNotation: 'won', vendorName: '참조은수산', aliases })).toMatchObject({
      origin: '국내산',
      originCountry: '국내산',
      originDetail: '낚시바리'
    })
    expect(normalizeParsedItem(countryOnly, { priceNotation: 'won', vendorName: '참조은수산', aliases })).toMatchObject({
      origin: '일본산',
      originCountry: '일본산',
      originDetail: null
    })
    expect(normalizeParsedItem(regionalDomestic, { priceNotation: 'won', vendorName: '윤호수산', aliases })).toMatchObject({
      origin: '국내산',
      originCountry: '국내산',
      originDetail: '거제산'
    })
    expect(normalizeParsedItem(detailOnlyRegion, { priceNotation: 'won', vendorName: '윤호수산', aliases })).toMatchObject({
      origin: '국내산',
      originCountry: '국내산',
      originDetail: '완도산'
    })
  })
})
