import { useEffect, useMemo, useState } from 'react'
import { getTodayMarket } from '../lib/api'
import {
  buildTodayBoard,
  getLowestVendorListing,
  type TodayBoardListing,
  type TodayBoardRow,
  type TodayBoardSectionKey,
} from '../lib/board'
import {
  formatCurrency,
  formatNumber,
  formatRelativeDateInput,
} from '../lib/format'
import { useResource } from '../hooks/useResource'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LabeledField,
  LoadingBlock,
  Panel,
  SearchCombobox,
  SegmentedControl,
  SelectControl,
  ToggleSwitch,
  cn,
  inputControlClass,
} from '../components/ui'

const DEFAULT_BOARD_SECTION: TodayBoardSectionKey = 'fish'
const BOARD_SECTION_KEYS: TodayBoardSectionKey[] = ['fish', 'crustacean']

type TodayBoardUrlState = {
  sectionKey: TodayBoardSectionKey
  selectedDate: string
  query: string
  country: string
}

function parseBoardSection(value: string | null): TodayBoardSectionKey {
  return BOARD_SECTION_KEYS.includes(value as TodayBoardSectionKey)
    ? (value as TodayBoardSectionKey)
    : DEFAULT_BOARD_SECTION
}

function readTodayBoardUrlState(): TodayBoardUrlState {
  if (typeof window === 'undefined') {
    return {
      sectionKey: DEFAULT_BOARD_SECTION,
      selectedDate: formatRelativeDateInput(),
      query: '',
      country: 'all',
    }
  }

  const searchParams = new URLSearchParams(window.location.search)
  const selectedDate = searchParams.get('date')?.trim() || formatRelativeDateInput()

  return {
    sectionKey: parseBoardSection(searchParams.get('section')),
    selectedDate,
    query: searchParams.get('q') ?? '',
    country: searchParams.get('country')?.trim() || 'all',
  }
}

function replaceTodayBoardUrlState({
  sectionKey,
  selectedDate,
  query,
  country,
}: TodayBoardUrlState) {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)
  const searchParams = url.searchParams
  searchParams.set('section', sectionKey)

  if (selectedDate.trim()) {
    searchParams.set('date', selectedDate)
  } else {
    searchParams.delete('date')
  }

  if (query.trim()) {
    searchParams.set('q', query)
  } else {
    searchParams.delete('q')
  }

  if (country && country !== 'all') {
    searchParams.set('country', country)
  } else {
    searchParams.delete('country')
  }

  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

const COUNTRY_FLAG_BY_NAME: Record<string, string> = {
  국내산: '🇰🇷',
  일본산: '🇯🇵',
  중국산: '🇨🇳',
  노르웨이: '🇳🇴',
  러시아: '🇷🇺',
}

const COUNTRY_ORDER = ['국내산', '일본산', '중국산', '노르웨이', '러시아']

function countryLabel(country: string) {
  return `${COUNTRY_FLAG_BY_NAME[country] ?? '•'} ${country}`
}

function countryFlag(country: string | null) {
  return country ? COUNTRY_FLAG_BY_NAME[country] ?? '•' : '•'
}

function badgeTone(tag: string) {
  if (tag === '품절') {
    return 'danger'
  }

  if (tag === '이벤트') {
    return 'warning'
  }

  if (tag === '활어' || tag === '자연산') {
    return 'success'
  }

  return 'neutral'
}

function awardCardToneClass(listing: TodayBoardListing) {
  if (listing.isAiRecommended && listing.isLowestPrice && listing.isBestCondition) {
    return 'award-tone-ai-low-best'
  }

  if (listing.isAiRecommended && listing.isLowestPrice) {
    return 'award-tone-ai-low'
  }

  if (listing.isAiRecommended && listing.isBestCondition) {
    return 'award-tone-ai-best'
  }

  if (listing.isLowestPrice && listing.isBestCondition) {
    return 'award-tone-low-best'
  }

  if (listing.isAiRecommended) {
    return 'border-bushiri-award-ai/60 bg-bushiri-award-ai/45 hover:bg-bushiri-award-ai/60'
  }

  if (listing.isLowestPrice) {
    return 'border-bushiri-current/35 bg-bushiri-award-low/70 hover:bg-bushiri-award-low'
  }

  if (listing.isBestCondition) {
    return 'border-bushiri-kelp/35 bg-bushiri-award-best/70 hover:bg-bushiri-award-best'
  }

  return ''
}

function awardBadges(listing: TodayBoardListing) {
  return [
    listing.isAiRecommended
      ? {
          label: 'AI추천',
          className: 'border-bushiri-award-ai-text/35 bg-bushiri-award-ai text-bushiri-award-ai-text',
        }
      : null,
    listing.isLowestPrice
      ? {
          label: '최저가',
          className: 'border-bushiri-current/35 bg-bushiri-award-low text-bushiri-award-low-text',
        }
      : null,
    listing.isBestCondition
      ? {
          label: '최상품',
          className: 'border-bushiri-kelp/35 bg-bushiri-award-best text-bushiri-award-best-text',
        }
      : null,
  ].filter((badge): badge is { label: string; className: string } => badge !== null)
}

function SpeciesLabel({
  row,
  showCountryFlag,
}: {
  row: TodayBoardRow
  showCountryFlag: boolean
}) {
  if (showCountryFlag) {
    return (
      <span className="grid min-w-0 grid-cols-[1.3rem_minmax(0,1fr)_auto] items-center gap-1.5 leading-tight lg:grid-cols-[1.45rem_minmax(0,1fr)_auto] lg:gap-2">
        <span
          aria-label={row.speciesCountryLabel ?? '국가 미상'}
          className="text-base leading-none lg:text-lg"
          title={row.speciesCountryLabel ?? '국가 미상'}
        >
          {countryFlag(row.speciesCountryLabel)}
        </span>
        <span className="min-w-0 text-[0.84rem] font-bold text-bushiri-ink [overflow-wrap:anywhere] lg:text-[0.98rem]">
          {row.speciesLabel}
        </span>
        <span className="min-w-0 text-[0.7rem] font-extrabold text-bushiri-muted [overflow-wrap:anywhere] lg:text-[0.78rem]">
          {row.speciesOriginLabel ? `(${row.speciesOriginLabel})` : ''}
        </span>
      </span>
    )
  }

  return (
    <strong className="block text-[0.84rem] font-bold leading-tight text-bushiri-ink [overflow-wrap:anywhere] lg:text-[0.98rem]">
      <span className="block">{row.speciesLabel}</span>
      {row.speciesOriginLabel ? (
        <span className="mt-1 block text-[0.72rem] font-extrabold text-bushiri-muted lg:text-[0.8rem]">
          ({row.speciesOriginLabel})
        </span>
      ) : null}
    </strong>
  )
}

function MarketListingCard({
  rowKey,
  vendor,
  listing,
  listingIndex,
}: {
  rowKey: string
  vendor: string
  listing: TodayBoardListing
  listingIndex: number
}) {
  const hasAwardTone = listing.isAiRecommended || listing.isLowestPrice || listing.isBestCondition
  const badges = awardBadges(listing)
  const hasWeightLabel = listing.weightLabel !== '중량 미상'

  return (
    <article
      className={cn(
        'relative flex min-h-24 min-w-0 flex-col gap-2 overflow-hidden rounded-md border border-bushiri-ink/10 p-2 transition duration-150 hover:border-bushiri-primary/20 lg:p-3',
        badges.length > 0 ? 'pt-7' : '',
        !hasAwardTone && listing.statusTags.includes('품절') ? 'bg-bushiri-danger/10 hover:bg-bushiri-danger/15' : '',
        !hasAwardTone && listing.statusTags.includes('이벤트') ? 'bg-bushiri-primary/10 hover:bg-bushiri-primary/15' : '',
        !hasAwardTone && !listing.statusTags.includes('품절') && !listing.statusTags.includes('이벤트')
          ? 'bg-bushiri-surface/90 hover:bg-white'
          : '',
        awardCardToneClass(listing),
      )}
    >
      {badges.length > 0 ? (
        <div className="pointer-events-none absolute right-1 top-1 z-10 flex max-w-[calc(100%-0.5rem)] flex-wrap items-start justify-end gap-0.5">
          {badges.map((badge) => (
            <span
              className={cn(
                'min-w-0 rounded-full border px-1.5 py-0.5 text-[0.62rem] font-extrabold leading-none shadow-[0_1px_0_rgba(255,255,255,0.6)]',
                badge.className,
              )}
              key={`${rowKey}-${vendor}-${listingIndex}-${badge.label}`}
            >
              {badge.label}
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <strong className="font-mono text-[1.02rem] font-extrabold leading-none tracking-normal text-bushiri-ink tabular-nums [overflow-wrap:anywhere] lg:text-[1.18rem] xl:text-[1.34rem]">
          {formatCurrency(listing.price)}
        </strong>
        {hasWeightLabel ? (
          <span className="text-[0.72rem] font-extrabold leading-none text-bushiri-muted">
            {listing.weightLabel}
          </span>
        ) : null}
        {listing.halfAvailable ? (
          <span className="text-[0.72rem] font-extrabold leading-none text-bushiri-primary">
            (반반)
          </span>
        ) : null}
      </div>
      {listing.statusTags.length > 0 ? (
        <div className="mt-auto flex flex-wrap gap-1">
          {listing.statusTags.map((tag) => (
            <Badge
              key={`${rowKey}-${vendor}-${listingIndex}-${tag}`}
              label={tag}
              tone={badgeTone(tag)}
            />
          ))}
        </div>
      ) : null}
    </article>
  )
}

export function TodayPage() {
  const [urlState, setUrlState] = useState(readTodayBoardUrlState)
  const [excludeSoldOut, setExcludeSoldOut] = useState(false)
  const [expandedSpeciesKeys, setExpandedSpeciesKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const { sectionKey: activeSection, selectedDate, query, country } = urlState
  const requestedDate = selectedDate.trim() || undefined
  const market = useResource(() => getTodayMarket(requestedDate), [requestedDate])

  useEffect(() => {
    replaceTodayBoardUrlState(urlState)

    const syncUrlState = () => {
      setUrlState(readTodayBoardUrlState())
    }

    window.addEventListener('popstate', syncUrlState)
    return () => window.removeEventListener('popstate', syncUrlState)
  }, [])

  const marketRows = market.data?.rows ?? []
  const speciesOptions = useMemo(() => {
    return Array.from(new Set(marketRows.map((row) => row.canonicalName)))
      .filter(Boolean)
      .sort((left, right) => left.localeCompare(right, 'ko'))
  }, [marketRows])
  const countryOptions = useMemo(() => {
    const countries = Array.from(
      new Set(
        marketRows
          .map((row) => {
            const raw =
              typeof row.raw === 'object' && row.raw !== null
                ? (row.raw as Record<string, unknown>)
                : null
            const originCountry = raw?.originCountry

            if (typeof originCountry === 'string' && originCountry.trim()) {
              return originCountry.trim()
            }

            return typeof row.market === 'string' && row.market.trim() ? row.market.trim() : null
          })
          .filter((value): value is string => value !== null),
      ),
    )
    const orderedCountries = [
      ...COUNTRY_ORDER.filter((knownCountry) => countries.includes(knownCountry)),
      ...countries
        .filter((countryName) => !COUNTRY_ORDER.includes(countryName))
        .sort((left, right) => left.localeCompare(right, 'ko')),
    ]

    return [
      { value: 'all', label: '전체' },
      ...orderedCountries.map((countryName) => ({
        value: countryName,
        label: countryLabel(countryName),
      })),
    ]
  }, [marketRows])

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return marketRows.filter((row) => {
      const matchesQuery =
        !normalizedQuery ||
        row.canonicalName.toLowerCase().includes(normalizedQuery)
      const raw =
        typeof row.raw === 'object' && row.raw !== null
          ? (row.raw as Record<string, unknown>)
          : null
      const soldOut = raw?.soldOut === true
      const originCountry =
        typeof raw?.originCountry === 'string' && raw.originCountry.trim()
          ? raw.originCountry.trim()
          : row.market
      const matchesCountry = country === 'all' || originCountry === country

      return (
        matchesQuery &&
        matchesCountry &&
        (!excludeSoldOut || !soldOut)
      )
    })
  }, [country, excludeSoldOut, marketRows, query])

  const board = useMemo(() => buildTodayBoard(filteredRows), [filteredRows])
  const visibleSections = useMemo(
    () => board.sections.filter((section) => section.key === activeSection),
    [activeSection, board.sections],
  )
  const visibleRows = visibleSections.flatMap((section) => section.rows)
  const showSpeciesCountryFlag =
    new Set(
      visibleRows
        .map((row) => row.speciesCountryLabel)
        .filter((countryName): countryName is string => countryName !== null),
    ).size > 1

  const activeSectionLabel = visibleSections[0]?.label ?? '회'
  const emptyState =
    marketRows.length === 0
      ? {
          title: requestedDate ? `${requestedDate} 시세가 아직 도착하지 않았습니다` : '오늘 시세가 아직 도착하지 않았습니다',
          description: '응답 수신 후 시세판이 표시됩니다.',
        }
      : visibleRows.length === 0
      ? {
          title: `${activeSectionLabel} 섹션에 표시할 시세가 없습니다`,
          description: '다른 섹션을 선택하거나 검색 조건을 조정해 주세요.',
        }
      : {
          title: '현재 조건에 맞는 시세가 없습니다',
          description: '검색어나 품절 제외 조건을 조정해 주세요.',
        }

  const updateUrlState = (nextState: Partial<TodayBoardUrlState>) => {
    setUrlState((currentState) => {
      const resolvedState = { ...currentState, ...nextState }

      replaceTodayBoardUrlState(resolvedState)
      return resolvedState
    })
  }

  const setSelectedSection = (sectionKey: TodayBoardSectionKey) => {
    setExpandedSpeciesKeys(new Set())
    updateUrlState({ sectionKey })
  }

  const updateSelectedDate = (selectedDate: string) => {
    updateUrlState({ selectedDate })
  }

  const updateQuery = (query: string) => {
    updateUrlState({ query })
  }

  const updateCountry = (country: string) => {
    setExpandedSpeciesKeys(new Set())
    updateUrlState({ country })
  }

  const toggleSpecies = (key: string) => {
    setExpandedSpeciesKeys((currentKeys) => {
      const nextKeys = new Set(currentKeys)

      if (nextKeys.has(key)) {
        nextKeys.delete(key)
      } else {
        nextKeys.add(key)
      }

      return nextKeys
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="조회 조건"
        actions={<Button onClick={() => void market.refresh()}>시세 다시 불러오기</Button>}
        className="py-4"
      >
        <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.8fr)] items-end gap-2.5 max-xl:grid-cols-3 max-md:grid-cols-1">
          <LabeledField label="기준일">
            <input
              className={inputControlClass}
              type="date"
              value={selectedDate}
              onChange={(event) => updateSelectedDate(event.target.value)}
            />
          </LabeledField>

          <LabeledField label="어종 검색" as="div">
            <SearchCombobox
              ariaLabel="어종 검색"
              options={speciesOptions.map((species) => ({
                value: species,
                label: species,
              }))}
              placeholder="예: 광어, 대게"
              value={query}
              onChange={updateQuery}
            />
          </LabeledField>

          <LabeledField label="분류" as="div">
            <SegmentedControl
              ariaLabel="시세판 섹션 선택"
              items={board.sections.map((section) => ({
                value: section.key,
                label: section.label,
                detail: formatNumber(section.rows.length),
              }))}
              value={activeSection}
              onChange={(sectionKey) => setSelectedSection(sectionKey as TodayBoardSectionKey)}
            />
          </LabeledField>

          <LabeledField label="국가" as="div">
            <SelectControl
              ariaLabel="국가 선택"
              options={countryOptions}
              value={country}
              onChange={updateCountry}
            />
          </LabeledField>

          <LabeledField label="품절 제외" as="div">
            <ToggleSwitch
              checked={excludeSoldOut}
              label="품절 제외"
              offLabel="전체"
              onChange={setExcludeSoldOut}
              onLabel="제외"
            />
          </LabeledField>

        </div>
      </Panel>

      <Panel title="종합 시세판" className="overflow-hidden">
        {market.isLoading ? <LoadingBlock rows={8} className="board" /> : null}
        {market.error ? (
          <ErrorState
            title="오늘 시세를 불러오지 못했습니다"
            description={market.error}
          />
        ) : null}
        {!market.isLoading && !market.error ? (
          <>
            {visibleRows.length === 0 ? (
              <EmptyState
                title={emptyState.title}
                description={emptyState.description}
              />
            ) : (
              <div className="grid gap-5">
                {visibleSections.map((section) => (
                  <section key={section.key} className="grid gap-2">
                  <header className="flex items-end justify-between gap-3 border-b border-bushiri-ink/15 pb-2">
                    <h3 className="m-0 text-base font-extrabold leading-tight text-bushiri-ink">
                      {section.label}
                    </h3>
                    <span className="text-xs font-bold text-bushiri-muted">
                      {formatNumber(section.rows.length)}종
                    </span>
                  </header>

                  <div className="hidden min-w-0 max-h-[min(72dvh,760px)] overflow-y-auto overflow-x-hidden rounded-lg border border-bushiri-ink/15 bg-bushiri-surface/95 md:block">
                    <table className="w-full table-fixed border-separate border-spacing-0 text-left">
                      <colgroup>
                        <col className={showSpeciesCountryFlag ? 'w-[150px] lg:w-[180px]' : 'w-[72px] lg:w-[92px]'} />
                        {section.vendorColumns.map((vendor) => (
                          <col key={vendor} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="sticky top-0 z-[3] border-r border-b border-bushiri-ink/15 bg-bushiri-surface-muted px-2 py-3 text-[0.72rem] font-bold uppercase tracking-normal text-bushiri-muted lg:px-4 lg:text-[0.76rem]">
                            어종
                          </th>
                          {section.vendorColumns.map((vendor) => (
                            <th
                              key={vendor}
                              className="sticky top-0 z-[3] border-r border-b border-bushiri-ink/15 bg-bushiri-surface-muted p-2 text-[0.76rem] font-bold tracking-normal text-bushiri-ink-soft [overflow-wrap:anywhere] last:border-r-0 lg:p-3 lg:text-[0.84rem]"
                              title={vendor}
                              aria-label={vendor}
                            >
                              {vendor}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row) => (
                          <tr key={row.key} className="align-top">
                            <th scope="row" className="border-r border-b border-bushiri-ink/15 bg-bushiri-surface-muted/90 p-2 align-middle last:border-b-0 lg:p-3">
                              <SpeciesLabel row={row} showCountryFlag={showSpeciesCountryFlag} />
                            </th>
                            {section.vendorColumns.map((vendor) => {
                              const listings = row.cells[vendor] ?? []

                              return (
                                <td
                                  key={`${row.key}-${vendor}`}
                                  className={cn(
                                    'border-r border-b border-bushiri-ink/15 p-0 last:border-r-0',
                                    listings.length === 0
                                      ? 'empty-market-cell bg-bushiri-ink/[0.07]'
                                      : '',
                                  )}
                                >
                                  {listings.length > 0 ? (
                                    <div className="flex min-h-28 min-w-0 flex-col gap-2 bg-bushiri-surface/60 p-1.5 lg:p-2">
                                      {listings.map((listing, listingIndex) => (
                                        <MarketListingCard
                                          key={`${row.key}-${vendor}-${listing.variantLabel}-${listingIndex}`}
                                          listing={listing}
                                          listingIndex={listingIndex}
                                          rowKey={row.key}
                                          vendor={vendor}
                                        />
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="min-h-28" aria-hidden="true" />
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="max-h-[min(72dvh,760px)] overflow-auto rounded-lg border border-bushiri-ink/15 bg-bushiri-surface/95 md:hidden" aria-label={`${section.label} 어종별 최저가 시세판`}>
                    <div
                      className={cn(
                        'sticky top-0 z-[2] grid items-center gap-3 border-b border-bushiri-ink/15 bg-bushiri-surface-muted p-3 text-[0.76rem] font-extrabold text-bushiri-muted',
                        showSpeciesCountryFlag
                          ? 'grid-cols-[minmax(132px,0.48fr)_minmax(0,1fr)]'
                          : 'grid-cols-[76px_minmax(0,1fr)]',
                      )}
                      aria-hidden="true"
                    >
                      <span>어종</span>
                      <span>최저가 판매처</span>
                    </div>
                    {section.rows.map((row) => {
                      const isExpanded = expandedSpeciesKeys.has(row.key)
                      const lowest = getLowestVendorListing(row, section.vendorColumns)
                      const vendorEntries = section.vendorColumns
                        .map((vendor) => ({
                          vendor,
                          listings: row.cells[vendor] ?? [],
                        }))
                        .filter(({ listings }) => listings.length > 0)

                      return (
                        <article key={`summary-${row.key}`} className="border-b border-bushiri-ink/15 last:border-b-0">
                          <button
                            aria-expanded={isExpanded}
                            className={cn(
                              'grid w-full items-center gap-3 bg-bushiri-surface/90 p-3 text-left text-bushiri-ink transition hover:bg-white focus-visible:bg-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-bushiri-primary active:translate-y-px',
                              showSpeciesCountryFlag
                                ? 'grid-cols-[minmax(132px,0.48fr)_minmax(0,1fr)]'
                                : 'grid-cols-[76px_minmax(0,1fr)]',
                              isExpanded ? 'bg-white' : '',
                            )}
                            onClick={() => toggleSpecies(row.key)}
                            type="button"
                          >
                            <SpeciesLabel row={row} showCountryFlag={showSpeciesCountryFlag} />
                            <span className="flex min-w-0 flex-wrap items-baseline gap-2">
                              {lowest ? (
                                <>
                                  <span className="max-w-[12ch] overflow-hidden text-ellipsis whitespace-nowrap text-[0.86rem] font-extrabold text-bushiri-muted">
                                    {lowest.vendor}
                                  </span>
                                  <strong className="font-mono text-lg font-extrabold leading-none text-bushiri-ink tabular-nums">
                                    {formatCurrency(lowest.listing.price)}
                                  </strong>
                                  {lowest.listing.weightLabel !== '중량 미상' ? (
                                    <span className="text-[0.72rem] font-extrabold text-bushiri-muted">
                                      {lowest.listing.weightLabel}
                                    </span>
                                  ) : null}
                                  {lowest.listing.halfAvailable ? (
                                    <span className="text-[0.72rem] font-extrabold text-bushiri-primary">
                                      (반반)
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <span className="block min-h-6 min-w-24 rounded bg-bushiri-ink/[0.07]" aria-hidden="true" />
                              )}
                            </span>
                          </button>
                          {isExpanded ? (
                            <div className="grid gap-3 border-t border-bushiri-ink/10 bg-bushiri-surface-muted/50 px-3 pb-3">
                              {vendorEntries.map(({ vendor, listings }) => (
                                <section key={`${row.key}-${vendor}`} className="grid gap-2 pt-3">
                                  <h3 className="m-0 text-[0.82rem] font-bold leading-tight text-bushiri-muted">
                                    {vendor}
                                  </h3>
                                  <div className="flex flex-col gap-2">
                                    {listings.map((listing, listingIndex) => (
                                      <MarketListingCard
                                        key={`${row.key}-${vendor}-${listing.variantLabel}-${listingIndex}`}
                                        listing={listing}
                                        listingIndex={listingIndex}
                                        rowKey={row.key}
                                        vendor={vendor}
                                      />
                                    ))}
                                  </div>
                                </section>
                              ))}
                            </div>
                          ) : null}
                        </article>
                      )
                    })}
                  </div>
                  </section>
                ))}
              </div>
            )}
          </>
        ) : null}
      </Panel>
    </div>
  )
}
