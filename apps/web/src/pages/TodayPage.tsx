import { useEffect, useMemo, useState } from 'react'
import { getTodayMarket } from '../lib/api'
import {
  buildTodayBoard,
  getLowestVendorListing,
  type TodayBoardListing,
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
} from '../components/ui'

const inputClass =
  'min-h-10 w-full rounded-lg border border-[#d8dbd2] bg-[#fffefa] px-3 text-sm text-[#141512] outline-none transition focus:border-[#174f49] focus:ring-2 focus:ring-[#174f49]/15'

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
    return 'border-[#d8a318]/45 bg-[radial-gradient(circle_at_12%_18%,rgba(255,225,138,0.92)_0%,rgba(255,225,138,0)_46%),radial-gradient(circle_at_88%_16%,rgba(216,237,255,0.96)_0%,rgba(216,237,255,0)_48%),radial-gradient(circle_at_48%_100%,rgba(223,245,223,0.98)_0%,rgba(223,245,223,0)_52%),linear-gradient(135deg,#fff9df_0%,#eefaf0_48%,#edf7ff_100%)] hover:bg-[radial-gradient(circle_at_12%_18%,rgba(255,225,138,1)_0%,rgba(255,225,138,0)_48%),radial-gradient(circle_at_88%_16%,rgba(216,237,255,1)_0%,rgba(216,237,255,0)_50%),radial-gradient(circle_at_48%_100%,rgba(223,245,223,1)_0%,rgba(223,245,223,0)_54%),linear-gradient(135deg,#fff4bd_0%,#f5fff4_48%,#f2f9ff_100%)]'
  }

  if (listing.isAiRecommended && listing.isLowestPrice) {
    return 'border-[#d8a318]/45 bg-[radial-gradient(circle_at_18%_18%,rgba(255,225,138,0.94)_0%,rgba(255,225,138,0)_54%),radial-gradient(circle_at_90%_16%,rgba(216,237,255,0.98)_0%,rgba(216,237,255,0)_56%),linear-gradient(135deg,#fff8d8_0%,#edf7ff_100%)] hover:bg-[radial-gradient(circle_at_18%_18%,rgba(255,225,138,1)_0%,rgba(255,225,138,0)_56%),radial-gradient(circle_at_90%_16%,rgba(216,237,255,1)_0%,rgba(216,237,255,0)_58%),linear-gradient(135deg,#fff2b8_0%,#f2f9ff_100%)]'
  }

  if (listing.isAiRecommended && listing.isBestCondition) {
    return 'border-[#d8a318]/45 bg-[radial-gradient(circle_at_18%_18%,rgba(255,225,138,0.94)_0%,rgba(255,225,138,0)_54%),radial-gradient(circle_at_84%_92%,rgba(223,245,223,0.98)_0%,rgba(223,245,223,0)_58%),linear-gradient(135deg,#fff8d8_0%,#f3fbef_100%)] hover:bg-[radial-gradient(circle_at_18%_18%,rgba(255,225,138,1)_0%,rgba(255,225,138,0)_56%),radial-gradient(circle_at_84%_92%,rgba(223,245,223,1)_0%,rgba(223,245,223,0)_60%),linear-gradient(135deg,#fff2b8_0%,#f5fff4_100%)]'
  }

  if (listing.isLowestPrice && listing.isBestCondition) {
    return 'border-[#7da7c8]/50 bg-[radial-gradient(circle_at_88%_18%,rgba(216,237,255,0.98)_0%,rgba(216,237,255,0)_56%),radial-gradient(circle_at_18%_88%,rgba(223,245,223,0.98)_0%,rgba(223,245,223,0)_58%),linear-gradient(135deg,#edf7ff_0%,#f3fbef_100%)] hover:bg-[radial-gradient(circle_at_88%_18%,rgba(216,237,255,1)_0%,rgba(216,237,255,0)_58%),radial-gradient(circle_at_18%_88%,rgba(223,245,223,1)_0%,rgba(223,245,223,0)_60%),linear-gradient(135deg,#f2f9ff_0%,#f5fff4_100%)]'
  }

  if (listing.isAiRecommended) {
    return 'border-[#d8a318]/45 bg-[#fff5c8] hover:bg-[#fff1ae]'
  }

  if (listing.isLowestPrice) {
    return 'border-[#7da7c8]/50 bg-[#eaf5ff] hover:bg-[#f2f9ff]'
  }

  if (listing.isBestCondition) {
    return 'border-[#8ebd8a]/50 bg-[#edf9ed] hover:bg-[#f5fff4]'
  }

  return ''
}

function awardBadges(listing: TodayBoardListing) {
  return [
    listing.isAiRecommended
      ? {
          label: 'AI추천',
          className: 'border-[#b8870f]/35 bg-[#ffe18a] text-[#6f4d00]',
        }
      : null,
    listing.isLowestPrice
      ? {
          label: '최저가',
          className: 'border-[#6f9dbc]/35 bg-[#d8edff] text-[#24516e]',
        }
      : null,
    listing.isBestCondition
      ? {
          label: '최상품',
          className: 'border-[#78ad72]/35 bg-[#dff5df] text-[#2e6534]',
        }
      : null,
  ].filter((badge): badge is { label: string; className: string } => badge !== null)
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
        'relative flex min-h-24 min-w-0 flex-col gap-2 overflow-hidden rounded-md border border-[rgba(20,21,18,0.08)] p-2 transition duration-150 hover:border-[#174f49]/20 lg:p-3',
        badges.length > 0 ? 'pt-7' : '',
        !hasAwardTone && listing.statusTags.includes('품절') ? 'bg-[#8c3f3d]/10 hover:bg-[#8c3f3d]/15' : '',
        !hasAwardTone && listing.statusTags.includes('이벤트') ? 'bg-[#174f49]/10 hover:bg-[#174f49]/15' : '',
        !hasAwardTone && !listing.statusTags.includes('품절') && !listing.statusTags.includes('이벤트')
          ? 'bg-[#fffefa]/90 hover:bg-white'
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
        <strong className="font-mono text-[1.02rem] font-extrabold leading-none tracking-normal text-[#141512] tabular-nums [overflow-wrap:anywhere] lg:text-[1.18rem] xl:text-[1.34rem]">
          {formatCurrency(listing.price)}
        </strong>
        {hasWeightLabel ? (
          <span className="text-[0.72rem] font-extrabold leading-none text-[#676b63]">
            {listing.weightLabel}
          </span>
        ) : null}
        {listing.halfAvailable ? (
          <span className="text-[0.72rem] font-extrabold leading-none text-[#174f49]">
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
              className={inputClass}
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
                  <header className="flex items-end justify-between gap-3 border-b border-[rgba(20,21,18,0.12)] pb-2">
                    <h3 className="m-0 text-base font-extrabold leading-tight text-[#141512]">
                      {section.label}
                    </h3>
                    <span className="text-xs font-bold text-[#676b63]">
                      {formatNumber(section.rows.length)}종
                    </span>
                  </header>

                  <div className="hidden min-w-0 max-h-[min(72dvh,760px)] overflow-y-auto overflow-x-hidden rounded-lg border border-[rgba(20,21,18,0.12)] bg-[#fffefa]/95 md:block">
                    <table className="w-full table-fixed border-separate border-spacing-0 text-left">
                      <colgroup>
                        <col className="w-[72px] lg:w-[92px]" />
                        {section.vendorColumns.map((vendor) => (
                          <col key={vendor} />
                        ))}
                      </colgroup>
                      <thead>
                        <tr>
                          <th className="sticky top-0 z-[3] border-r border-b border-[rgba(20,21,18,0.12)] bg-[#f7f7f2] px-2 py-3 text-[0.72rem] font-bold uppercase tracking-normal text-[#676b63] lg:px-4 lg:text-[0.76rem]">
                            어종
                          </th>
                          {section.vendorColumns.map((vendor) => (
                            <th
                              key={vendor}
                              className="sticky top-0 z-[3] border-r border-b border-[rgba(20,21,18,0.12)] bg-[#f7f7f2] p-2 text-[0.76rem] font-bold tracking-normal text-[#1a1d18] [overflow-wrap:anywhere] last:border-r-0 lg:p-3 lg:text-[0.84rem]"
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
                            <th scope="row" className="border-r border-b border-[rgba(20,21,18,0.12)] bg-[#f7f7f2]/90 p-2 align-middle last:border-b-0 lg:p-3">
                              <strong className="block text-[0.84rem] font-bold leading-tight text-[#141512] [overflow-wrap:anywhere] lg:text-[0.98rem]">
                                <span className="block">{row.speciesLabel}</span>
                                {row.speciesOriginLabel ? (
                                  <span className="mt-1 block text-[0.72rem] font-extrabold text-[#676b63] lg:text-[0.8rem]">
                                    ({row.speciesOriginLabel})
                                  </span>
                                ) : null}
                              </strong>
                            </th>
                            {section.vendorColumns.map((vendor) => {
                              const listings = row.cells[vendor] ?? []

                              return (
                                <td
                                  key={`${row.key}-${vendor}`}
                                  className={cn(
                                    'border-r border-b border-[rgba(20,21,18,0.12)] p-0 last:border-r-0',
                                    listings.length === 0
                                      ? 'empty-market-cell bg-[rgba(20,21,18,0.07)]'
                                      : '',
                                  )}
                                >
                                  {listings.length > 0 ? (
                                    <div className="flex min-h-28 min-w-0 flex-col gap-2 bg-[#fffefa]/60 p-1.5 lg:p-2">
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

                  <div className="max-h-[min(72dvh,760px)] overflow-auto rounded-lg border border-[rgba(20,21,18,0.12)] bg-[#fffefa]/95 md:hidden" aria-label={`${section.label} 어종별 최저가 시세판`}>
                    <div className="sticky top-0 z-[2] grid grid-cols-[76px_minmax(0,1fr)] items-center gap-3 border-b border-[rgba(20,21,18,0.12)] bg-[#f7f7f2] p-3 text-[0.76rem] font-extrabold text-[#676b63]" aria-hidden="true">
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
                        <article key={`summary-${row.key}`} className="border-b border-[rgba(20,21,18,0.12)] last:border-b-0">
                          <button
                            aria-expanded={isExpanded}
                            className={cn(
                              'grid w-full grid-cols-[76px_minmax(0,1fr)] items-center gap-3 bg-[#fffefa]/90 p-3 text-left text-[#141512] transition hover:bg-white focus-visible:bg-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#174f49] active:translate-y-px',
                              isExpanded ? 'bg-white' : '',
                            )}
                            onClick={() => toggleSpecies(row.key)}
                            type="button"
                          >
                            <span className="font-extrabold leading-tight [word-break:keep-all]">
                              <span className="block">{row.speciesLabel}</span>
                              {row.speciesOriginLabel ? (
                                <span className="mt-1 block text-[0.72rem] text-[#676b63]">
                                  ({row.speciesOriginLabel})
                                </span>
                              ) : null}
                            </span>
                            <span className="flex min-w-0 flex-wrap items-baseline gap-2">
                              {lowest ? (
                                <>
                                  <span className="max-w-[12ch] overflow-hidden text-ellipsis whitespace-nowrap text-[0.86rem] font-extrabold text-[#676b63]">
                                    {lowest.vendor}
                                  </span>
                                  <strong className="font-mono text-lg font-extrabold leading-none text-[#141512] tabular-nums">
                                    {formatCurrency(lowest.listing.price)}
                                  </strong>
                                  {lowest.listing.weightLabel !== '중량 미상' ? (
                                    <span className="text-[0.72rem] font-extrabold text-[#676b63]">
                                      {lowest.listing.weightLabel}
                                    </span>
                                  ) : null}
                                  {lowest.listing.halfAvailable ? (
                                    <span className="text-[0.72rem] font-extrabold text-[#174f49]">
                                      (반반)
                                    </span>
                                  ) : null}
                                </>
                              ) : (
                                <span className="block min-h-6 min-w-24 rounded bg-[rgba(20,21,18,0.07)]" aria-hidden="true" />
                              )}
                            </span>
                          </button>
                          {isExpanded ? (
                            <div className="grid gap-3 border-t border-[rgba(20,21,18,0.08)] bg-[#f7f7f2]/50 px-3 pb-3">
                              {vendorEntries.map(({ vendor, listings }) => (
                                <section key={`${row.key}-${vendor}`} className="grid gap-2 pt-3">
                                  <h3 className="m-0 text-[0.82rem] font-bold leading-tight text-[#676b63]">
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
