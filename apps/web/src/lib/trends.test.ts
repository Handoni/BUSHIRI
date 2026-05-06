import { describe, expect, it } from 'vitest'
import {
  buildSpeciesOptions,
  buildTrendChartRows,
  buildTrendComparison,
  buildTrendReferenceBadges,
  filterSpeciesOptions,
  pickDefaultSpecies,
  resolveTrendCondition,
} from './trends'
import type { SpeciesTrendPoint } from './api'

function point(
  id: string,
  overrides: Partial<SpeciesTrendPoint> & {
    raw: Record<string, unknown>
  },
): SpeciesTrendPoint {
  return {
    id,
    label: overrides.date?.slice(5, 10) ?? id,
    date: overrides.date ?? '2026-05-04',
    value: overrides.value ?? 0,
    market: overrides.market ?? '성전물산',
    currency: 'KRW',
    raw: overrides.raw,
  }
}

describe('trend comparison grouping', () => {
  it('compares graph series by vendor and origin only', () => {
    const comparison = buildTrendComparison([
      point('1', {
        date: '2026-05-01',
        value: 30000,
        raw: {
          sourceName: '성전물산',
          origin: '국내산',
          productionType: '자연산',
          freshnessState: '활어',
          grade: 'A급',
          sizeMinKg: 2.1,
          sizeMaxKg: 2.4,
        },
      }),
      point('2', {
        date: '2026-05-01',
        value: 28000,
        raw: {
          sourceName: '성전물산',
          origin: '국내산',
          productionType: '양식',
          freshnessState: '활어',
          grade: 'B급',
          sizeMinKg: 2.2,
          sizeMaxKg: 2.6,
        },
      }),
      point('3', {
        date: '2026-05-02',
        value: 26000,
        raw: {
          sourceName: '성전물산',
          origin: '국내산',
          productionType: '양식',
          freshnessState: '활어',
          grade: 'B급',
          sizeMinKg: 2.2,
          sizeMaxKg: 2.6,
        },
      }),
      point('4', {
        date: '2026-05-02',
        value: 25500,
        market: '참조은수산',
        raw: {
          sourceName: '참조은수산',
          origin: '국내산',
          productionType: '양식',
          freshnessState: '활어',
          grade: 'B급',
          sizeMinKg: 2.2,
          sizeMaxKg: 2.6,
        },
      }),
      point('5', {
        date: '2026-05-02',
        value: 22000,
        raw: {
          sourceName: '성전물산',
          origin: '국내산',
          freshnessState: '활어',
          displayName: '광어 찍어바리',
          notes: '기스 많음 찍어바리',
          sizeMinKg: 2.2,
          sizeMaxKg: 2.6,
        },
      }),
      point('6', {
        date: '2026-05-02',
        value: 24000,
        raw: {
          sourceName: '성전물산',
          origin: '국내산',
          productionType: '양식',
          freshnessState: '활어',
          grade: 'B급',
          sizeMinKg: 3.1,
          sizeMaxKg: 3.8,
        },
      }),
    ])

    expect(comparison.series.map((series) => series.key)).toEqual([
      '성전물산|국내산',
      '참조은수산|국내산',
    ])
    expect(comparison.series[0].points).toEqual([
      { date: '2026-05-01', label: '05-01', value: 28000 },
      { date: '2026-05-02', label: '05-02', value: 22000 },
    ])
    expect(comparison.series[0].changePercent).toBeCloseTo(-21.428571, 5)
  })

  it('builds chart rows with only selected series keys', () => {
    const comparison = buildTrendComparison([
      point('1', {
        date: '2026-05-01',
        value: 30000,
        raw: {
          sourceName: '성전물산',
          origin: '국내산',
          freshnessState: '활어',
        },
      }),
      point('2', {
        date: '2026-05-01',
        value: 28000,
        raw: {
          sourceName: '성전물산',
          origin: '제주산',
          freshnessState: '활어',
        },
      }),
      point('3', {
        date: '2026-05-02',
        value: 26000,
        raw: {
          sourceName: '성전물산',
          origin: '국내산',
          freshnessState: '활어',
        },
      }),
    ])

    const rows = buildTrendChartRows(comparison.series, ['성전물산|국내산'])

    expect(rows).toEqual([
      {
        date: '2026-05-01',
        label: '05-01',
        '성전물산|국내산': 30000,
      },
      {
        date: '2026-05-02',
        label: '05-02',
        '성전물산|국내산': 26000,
      },
    ])
    expect(Object.keys(rows[0])).not.toContain('성전물산|제주산')
  })

  it('normalizes overlapping origin labels into the shortest keyword', () => {
    const comparison = buildTrendComparison([
      point('jeju-1', {
        date: '2026-05-01',
        value: 31000,
        raw: {
          sourceName: '성전물산',
          origin: '제주산',
          freshnessState: '활어',
        },
      }),
      point('jeju-2', {
        date: '2026-05-01',
        value: 29500,
        raw: {
          sourceName: '성전물산',
          origin: '제주/국내산',
          freshnessState: '활어',
        },
      }),
      point('jeju-3', {
        date: '2026-05-02',
        value: 28000,
        raw: {
          sourceName: '성전물산',
          origin: '제주',
          freshnessState: '활어',
        },
      }),
      point('jeju-4', {
        date: '2026-05-02',
        value: 27500,
        raw: {
          sourceName: '성전물산',
          origin: '제주산/국내산',
          freshnessState: '활어',
        },
      }),
      point('wando', {
        date: '2026-05-01',
        value: 26000,
        raw: {
          sourceName: '성전물산',
          origin: '완도산/국내산',
          freshnessState: '활어',
        },
      }),
    ])

    expect(comparison.series.map((series) => series.key)).toEqual([
      '성전물산|완도',
      '성전물산|제주',
    ])
    expect(comparison.series.find((series) => series.origin === '제주')?.points).toEqual([
      { date: '2026-05-01', label: '05-01', value: 29500 },
      { date: '2026-05-02', label: '05-02', value: 27500 },
    ])
    expect(comparison.rows.map((row) => row.origin)).toEqual([
      '제주',
      '제주',
      '완도',
      '제주',
      '제주',
    ])
  })

  it('keeps status in rows without using status or weight in comparison keys', () => {
    expect(
      resolveTrendCondition(
        point('small', {
          value: 12000,
          raw: {
            sourceName: '윤호수산',
            origin: '통영',
            freshnessState: '선',
            sizeMinKg: 0.8,
            sizeMaxKg: 1,
          },
        }),
      ),
    ).toMatchObject({
      status: '선어',
      key: '윤호수산|통영',
    })

    expect(
      resolveTrendCondition(
        point('unknown', {
          value: 12000,
          raw: {
            sourceName: '윤호수산',
            origin: null,
            freshnessState: null,
            sizeMinKg: null,
            sizeMaxKg: null,
          },
        }),
      ),
    ).toMatchObject({
      origin: '원산지 미상',
      status: '상태 미상',
      key: '윤호수산|원산지 미상',
    })

    expect(
      resolveTrendCondition(
        point('busan', {
          value: 12000,
          raw: {
            sourceName: '윤호수산',
            origin: '부산',
            freshnessState: '활어',
          },
        }),
      ),
    ).toMatchObject({
      origin: '부산',
      key: '윤호수산|부산',
    })
  })

  it('moves non-status and non-origin reference values into table badges', () => {
    expect(
      buildTrendReferenceBadges({
        displayName: '완도 광어',
        origin: '국내산',
        productionType: '양식',
        freshnessState: '활어',
        grade: 'A급',
        sizeMinKg: 2.1,
        sizeMaxKg: 2.8,
        priceText: 'kg 33,000원',
        notes: '아이스박스 포함',
      }),
    ).toEqual([
      { key: 'displayName', label: '완도 광어' },
      { key: 'productionType', label: '양식' },
      { key: 'grade', label: 'A급' },
      { key: 'weight', label: '2~3kg' },
      { key: 'priceText', label: 'kg 33,000원' },
      { key: 'notes', label: '아이스박스 포함' },
    ])
  })
})

describe('trend species options', () => {
  it('defaults to 광어 when it exists instead of the first alphabetical species', () => {
    const options = buildSpeciesOptions([
      {
        canonicalName: '가리비',
        species: '가리비',
      },
      {
        canonicalName: '광어',
        species: '완도 광어',
      },
      {
        canonicalName: '연어',
        species: '연어',
      },
    ])

    expect(pickDefaultSpecies(options)).toBe('광어')
    expect(options.find((option) => option.value === '광어')).toMatchObject({
      label: '광어',
    })
  })

  it('filters dropdown species by canonical name or display label', () => {
    const options = buildSpeciesOptions([
      {
        canonicalName: '광어',
        species: '완도 광어',
      },
      {
        canonicalName: '킹크랩',
        species: '레드 킹크랩',
      },
      {
        canonicalName: '연어',
        species: '노르웨이 연어',
      },
    ])

    expect(filterSpeciesOptions(options, '레드').map((option) => option.value)).toEqual([
      '킹크랩',
    ])
    expect(filterSpeciesOptions(options, '')).toHaveLength(3)
  })
})
