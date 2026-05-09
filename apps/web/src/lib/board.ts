export type TodayBoardListing = {
  price: number | null
  variantLabel: string
  weightLabel: string
  halfAvailable: boolean
  statusTags: string[]
  isBestCondition: boolean
  isLowestPrice: boolean
  isAiRecommended: boolean
  raw: unknown
}

export type TodayBoardRow = {
  key: string
  canonicalName: string
  speciesLabel: string
  speciesCountryLabel: string | null
  speciesOriginLabel: string | null
  cells: Record<string, TodayBoardListing[]>
}

export type TodayBoardSectionKey = 'fish' | 'crustacean'

export type TodayBoardSection = {
  key: TodayBoardSectionKey
  label: string
  vendorColumns: string[]
  rows: TodayBoardRow[]
}

export type TodayBoard = {
  vendorColumns: string[]
  rows: TodayBoardRow[]
  sections: TodayBoardSection[]
}

export type TodayBoardLowestVendor = {
  vendor: string
  listing: TodayBoardListing
}

function formatWeight(raw: Record<string, unknown>): string {
  const min = typeof raw.sizeMinKg === 'number' ? raw.sizeMinKg : null
  const max = typeof raw.sizeMaxKg === 'number' ? raw.sizeMaxKg : null

  if (min !== null && max !== null) {
    return min === max ? `${min}kg` : `${min}~${max}kg`
  }

  if (min !== null) {
    return `${min}kg+`
  }

  return '중량 미상'
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function pushUnique(tags: string[], value: string | null | undefined) {
  if (!value || tags.includes(value)) {
    return
  }

  tags.push(value)
}

function normalizeFreshness(value: unknown): string | null {
  const text = stringValue(value)

  if (!text) {
    return null
  }

  if (text === '활') {
    return '활어'
  }

  return text
}

function splitGrade(value: unknown): string[] {
  const text = stringValue(value)

  if (!text) {
    return []
  }

  return text
    .split(/[,/·\s]+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function isOriginClassificationTag(value: string): boolean {
  return (
    /산$/.test(value) ||
    /^(노르웨이|러시아|양식|낚시바리)$/.test(value)
  )
}

function pushDisplayTag(tags: string[], value: string | null | undefined) {
  if (!value || isOriginClassificationTag(value)) {
    return
  }

  pushUnique(tags, value)
}

function descriptorTags(row: BoardInputRow, raw: Record<string, unknown>): string[] {
  const haystack = [
    row.species,
    stringValue(raw.displayName),
    stringValue(raw.notes),
    stringValue(raw.grade),
  ]
    .filter(Boolean)
    .join(' ')
  const compactText = haystack.replace(/\s+/g, '')
  const tags: string[] = []

  const descriptors = [
    '찍어바리',
    '꼬물이급',
    '꼬물급',
    '꼬물이',
    '비실이',
    '황금',
    '홍가리비',
    '노절지',
    '1절지포함',
    '1,2,3절지',
    '2,3절지',
    '1,2절지',
    '1절지',
    '2절지',
    '3절지',
    'A급',
    '상급',
    '최상급',
    '상태최강',
    '정품',
    '땅크',
    '예약판매',
    '갓성비',
  ]

  descriptors.forEach((descriptor) => {
    if (compactText.includes(descriptor.replace(/\s+/g, ''))) {
      pushDisplayTag(tags, descriptor)
    }
  })

  const numbered = compactText.match(/[1-9]번/g) ?? []
  numbered.forEach((numberTag) => pushDisplayTag(tags, numberTag))

  return tags
}

function structuredTags(
  row: BoardInputRow,
  raw: Record<string, unknown>,
  {
    includeFlags,
  }: {
    includeFlags: boolean
  },
): string[] {
  const tags: string[] = []

  if (includeFlags && raw.soldOut === true) {
    tags.push('품절')
  }

  if (includeFlags && raw.eventFlag === true) {
    tags.push('이벤트')
  }

  pushDisplayTag(tags, normalizeFreshness(raw.freshnessState))
  splitGrade(raw.grade).forEach((grade) => pushDisplayTag(tags, grade))
  descriptorTags(row, raw).forEach((tag) => pushDisplayTag(tags, tag))

  return tags
}

function statusTags(row: BoardInputRow, raw: Record<string, unknown>): string[] {
  return structuredTags(row, raw, { includeFlags: true })
}

function variantTags(row: BoardInputRow, raw: Record<string, unknown>): string[] {
  return structuredTags(row, raw, { includeFlags: false })
}

function formatVariantLabel(raw: Record<string, unknown>, tags: string[]): string {
  const parts = [...tags]

  return parts.length > 0 ? parts.join(' · ') : '기본'
}

type BoardInputRow = {
  id?: string
  canonicalName: string
  species: string
  source: string
  price: number | null
  raw: unknown
  [key: string]: unknown
}

const SECTION_CONFIGS: Array<{
  key: TodayBoardSectionKey
  label: string
  vendorOrder: string[]
}> = [
  {
    key: 'fish',
    label: '회',
    vendorOrder: ['참조은수산', '성전물산', '윤호수산'],
  },
  {
    key: 'crustacean',
    label: '갑각류',
    vendorOrder: ['줄포상회'],
  },
]

const sectionConfigByKey = new Map(
  SECTION_CONFIGS.map((section) => [section.key, section]),
)
const sourceSectionByVendor = new Map<string, TodayBoardSectionKey>(
  SECTION_CONFIGS.flatMap((section) =>
    section.vendorOrder.map((vendor) => [vendor, section.key] as const),
  ),
)

function sectionKeyForSource(source: string): TodayBoardSectionKey {
  return sourceSectionByVendor.get(source) ?? 'fish'
}

function compareNullablePrice(left: number | null, right: number | null): number {
  if (left === right) {
    return 0
  }

  if (left === null) {
    return 1
  }

  if (right === null) {
    return -1
  }

  return left - right
}

export function getLowestVendorListing(
  row: TodayBoardRow,
  vendorColumns: string[],
): TodayBoardLowestVendor | null {
  return vendorColumns.reduce<TodayBoardLowestVendor | null>((currentLowest, vendor) => {
    const listing = row.cells[vendor]?.[0]

    if (!listing) {
      return currentLowest
    }

    if (!currentLowest) {
      return { vendor, listing }
    }

    return compareNullablePrice(listing.price, currentLowest.listing.price) < 0
      ? { vendor, listing }
      : currentLowest
  }, null)
}

type WorkingSection = {
  key: TodayBoardSectionKey
  rowsBySpecies: Map<string, TodayBoardRow>
  speciesByVendor: Map<string, string[]>
  firstSeenOrder: Map<string, number>
  vendorsInData: string[]
}

function createWorkingSection(key: TodayBoardSectionKey): WorkingSection {
  return {
    key,
    rowsBySpecies: new Map(),
    speciesByVendor: new Map(),
    firstSeenOrder: new Map(),
    vendorsInData: [],
  }
}

function pushUniqueValue(values: string[], value: string) {
  if (!values.includes(value)) {
    values.push(value)
  }
}

function speciesRowKey(row: BoardInputRow, raw: Record<string, unknown>): string {
  const originCountry = stringValue(raw.originCountry) ?? stringValue(raw.origin) ?? 'origin-unknown'
  const originDetail = stringValue(raw.originDetail) ?? 'detail-none'

  return `${row.canonicalName}|${originCountry}|${originDetail}`
}

function vendorColumnsForSection(section: WorkingSection): string[] {
  const config = sectionConfigByKey.get(section.key)
  const preferred = config?.vendorOrder ?? []
  const extras = section.vendorsInData.filter((vendor) => !preferred.includes(vendor))

  return [...preferred, ...extras]
}

function orderedRowsForSection(
  section: WorkingSection,
  vendorColumns: string[],
): TodayBoardRow[] {
  const unseen = new Set(section.rowsBySpecies.keys())
  const orderedKeys: string[] = []

  while (unseen.size > 0) {
    let madeProgress = false

    vendorColumns.forEach((vendor) => {
      const vendorSpecies = section.speciesByVendor.get(vendor) ?? []
      const nextSpecies = vendorSpecies.find((species) => unseen.has(species))

      if (!nextSpecies) {
        return
      }

      orderedKeys.push(nextSpecies)
      unseen.delete(nextSpecies)
      madeProgress = true
    })

    if (!madeProgress) {
      Array.from(unseen)
        .sort((left, right) => {
          const leftOrder = section.firstSeenOrder.get(left) ?? Number.MAX_SAFE_INTEGER
          const rightOrder = section.firstSeenOrder.get(right) ?? Number.MAX_SAFE_INTEGER

          if (leftOrder !== rightOrder) {
            return leftOrder - rightOrder
          }

          return left.localeCompare(right, 'ko')
        })
        .forEach((species) => {
          orderedKeys.push(species)
          unseen.delete(species)
        })
    }
  }

  return orderedKeys
    .reduce<string[]>((groupedKeys, species) => {
      const row = section.rowsBySpecies.get(species)

      if (!row || groupedKeys.includes(species)) {
        return groupedKeys
      }

      orderedKeys
        .filter((candidate) => section.rowsBySpecies.get(candidate)?.canonicalName === row.canonicalName)
        .forEach((candidate) => pushUniqueValue(groupedKeys, candidate))

      return groupedKeys
    }, [])
    .map((species) => section.rowsBySpecies.get(species))
    .filter((row): row is TodayBoardRow => row !== undefined)
}

export function buildTodayBoard(rows: BoardInputRow[]): TodayBoard {
  const vendorColumns = Array.from(new Set(rows.map((row) => row.source)))
  const workingSections = new Map<TodayBoardSectionKey, WorkingSection>()

  rows.forEach((row, rowIndex) => {
    const raw = typeof row.raw === 'object' && row.raw !== null ? (row.raw as Record<string, unknown>) : {}
    const tags = variantTags(row, raw)
    const sectionKey = sectionKeyForSource(row.source)
    const section = workingSections.get(sectionKey) ?? createWorkingSection(sectionKey)
    const rowKey = speciesRowKey(row, raw)

    workingSections.set(sectionKey, section)
    pushUniqueValue(section.vendorsInData, row.source)

    const vendorSpecies = section.speciesByVendor.get(row.source) ?? []
    pushUniqueValue(vendorSpecies, rowKey)
    section.speciesByVendor.set(row.source, vendorSpecies)

    if (!section.firstSeenOrder.has(rowKey)) {
      section.firstSeenOrder.set(rowKey, rowIndex)
    }

    if (!section.rowsBySpecies.has(rowKey)) {
      section.rowsBySpecies.set(rowKey, {
        key: `${sectionKey}-${rowKey}`,
        canonicalName: row.canonicalName,
        speciesLabel: row.canonicalName,
        speciesCountryLabel: stringValue(raw.originCountry) ?? stringValue(raw.origin),
        speciesOriginLabel: stringValue(raw.originDetail),
        cells: {},
      })
    }

    const target = section.rowsBySpecies.get(rowKey)

    if (!target) {
      return
    }

    const listings = target.cells[row.source] ?? []

    listings.push({
      price: row.price,
      variantLabel: formatVariantLabel(raw, tags),
      weightLabel: formatWeight(raw),
      halfAvailable: raw.halfAvailable === true,
      statusTags: statusTags(row, raw),
      isBestCondition: raw.bestCondition === true,
      isLowestPrice: raw.lowestPrice === true,
      isAiRecommended: raw.aiRecommended === true,
      raw: row.raw,
    })
    target.cells[row.source] = listings
  })

  const sections = SECTION_CONFIGS.flatMap<TodayBoardSection>((config) => {
    const section = workingSections.get(config.key) ?? createWorkingSection(config.key)

    const sectionVendorColumns = vendorColumnsForSection(section)
    const sectionRows = orderedRowsForSection(section, sectionVendorColumns)

    return [
      {
        key: config.key,
        label: config.label,
        vendorColumns: sectionVendorColumns,
        rows: sectionRows,
      },
    ]
  })

  sections.forEach((section) => {
    section.rows.forEach((row) => {
      Object.values(row.cells).forEach((listings) => {
        listings.sort((left, right) => {
          const priceOrder = compareNullablePrice(left.price, right.price)

          if (priceOrder !== 0) {
            return priceOrder
          }

          return left.variantLabel.localeCompare(right.variantLabel, 'ko')
        })
      })
    })
  })

  const boardRows = sections.flatMap((section) => section.rows)

  return {
    vendorColumns,
    rows: boardRows,
    sections,
  }
}
