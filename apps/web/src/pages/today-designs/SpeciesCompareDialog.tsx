import { useEffect, useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { BadgeCheck, Bot, ChevronDown, CircleDollarSign, X } from 'lucide-react'

import {
  type TodayBoardListing,
  type TodayBoardRow,
  type TodayBoardSection,
} from '../../lib/board'
import { formatKgManwonPrice, formatNumber } from '../../lib/format'
import { compactOriginLabel, CountryFlag } from '../../components/CountryFlag'
import { cn } from '../../components/ui'

type CompareEntry = {
  row: TodayBoardRow
  listing: TodayBoardListing
  listingIndex: number
}

type VendorFilterOption = {
  value: string
  label: string
}

function awardLabels(listing: TodayBoardListing) {
  return [
    listing.isAiRecommended ? { label: 'AI추천', className: 'border-bushiri-award-ai/60 bg-bushiri-award-ai/25 text-bushiri-award-ai-text', Icon: Bot } : null,
    listing.isLowestPrice ? { label: '최저가', className: 'border-bushiri-current/35 bg-bushiri-award-low/65 text-bushiri-award-low-text', Icon: CircleDollarSign } : null,
    listing.isBestCondition ? { label: '최상품', className: 'border-bushiri-kelp/35 bg-bushiri-award-best/65 text-bushiri-award-best-text', Icon: BadgeCheck } : null,
  ].filter((award): award is { label: string; className: string; Icon: typeof Bot } => award !== null)
}

function listingToneClass(listing: TodayBoardListing, isLowestForSpecies: boolean) {
  if (listing.statusTags.includes('품절')) {
    return 'border-bushiri-danger/25 bg-bushiri-danger/[0.06]'
  }

  if (listing.isAiRecommended) {
    return 'border-bushiri-award-ai/55 bg-bushiri-award-ai/24'
  }

  if (listing.isLowestPrice || isLowestForSpecies) {
    return 'border-bushiri-current/35 bg-bushiri-award-low/55'
  }

  if (listing.isBestCondition) {
    return 'border-bushiri-kelp/35 bg-bushiri-award-best/55'
  }

  if (listing.statusTags.includes('이벤트')) {
    return 'border-bushiri-warning/25 bg-bushiri-warning/[0.07]'
  }

  return 'border-bushiri-line/80 bg-bushiri-surface/90'
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

function fullOriginLabel(row: TodayBoardRow) {
  return [row.speciesCountryLabel, row.speciesOriginLabel].filter(Boolean).join(' / ')
}

function originOptionLabel(row: TodayBoardRow) {
  return compactOriginLabel(row.speciesCountryLabel, row.speciesOriginLabel)
}

function VendorFilterDropdown({
  options,
  value,
  onChange,
}: {
  options: VendorFilterOption[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selectedOption = options.find((option) => option.value === value) ?? options[0]

  return (
    <div className="relative z-[3] min-w-0">
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="비교할 판매처 선택"
        className="inline-flex min-h-10 w-full min-w-0 items-center justify-between gap-3 rounded-lg border border-bushiri-line bg-bushiri-surface px-3 text-sm font-bold text-bushiri-ink transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="min-w-0 truncate">{selectedOption?.label ?? '판매처 선택'}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn('h-4 w-4 shrink-0 text-bushiri-muted transition-transform', open ? 'rotate-180' : '')}
          strokeWidth={2.4}
        />
      </button>

      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+0.3rem)] z-[4] grid max-h-56 w-full min-w-52 overflow-auto rounded-lg border border-bushiri-line bg-bushiri-surface p-1 shadow-bushiri-popover"
          role="listbox"
        >
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className={cn(
                'flex min-h-9 w-full items-center rounded-md px-2.5 text-left text-sm font-bold transition hover:bg-bushiri-primary-soft focus-visible:bg-bushiri-primary-soft focus-visible:outline-none',
                option.value === value ? 'bg-bushiri-surface-muted text-bushiri-primary' : 'text-bushiri-ink',
              )}
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
              role="option"
              type="button"
            >
              <span className="min-w-0 truncate">{option.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ListingCard({
  entry,
  vendor,
  isLowestForSpecies,
}: {
  entry: CompareEntry
  vendor: string
  isLowestForSpecies: boolean
}) {
  const { listing, listingIndex, row } = entry
  const awards = awardLabels(listing)
  const hasWeightLabel = listing.weightLabel !== '중량 미상'
  const originText = compactOriginLabel(row.speciesCountryLabel, row.speciesOriginLabel)

  return (
    <article
      className={cn(
        'relative grid h-[104px] min-w-0 content-between overflow-hidden rounded-md border p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.62)]',
        awards.length > 0 ? 'pt-6' : '',
        listingToneClass(listing, isLowestForSpecies),
      )}
    >
      {awards.length > 0 ? (
        <div className="absolute right-1.5 top-1.5 flex max-w-[calc(100%-0.75rem)] flex-wrap justify-end gap-0.5">
          {awards.map(({ label, className, Icon }) => (
            <span
              className={cn(
                'inline-flex min-w-0 items-center gap-0.5 rounded-[4px] border px-1 py-0.5 text-[0.52rem] font-black leading-none',
                className,
              )}
              key={`${row.key}-${vendor}-${listingIndex}-${label}`}
            >
              <Icon className="h-2.5 w-2.5 shrink-0" strokeWidth={2.5} />
              <span className="truncate">{label}</span>
            </span>
          ))}
        </div>
      ) : null}

      <div className="min-w-0">
        <div className="mb-1 flex min-w-0 items-center gap-1">
          <CountryFlag country={row.speciesCountryLabel} flagClassName="h-2.5 w-4" />
          {originText ? (
            <span className="min-w-0 truncate text-[0.52rem] font-black leading-none text-bushiri-muted">
              {originText}
            </span>
          ) : null}
        </div>
        <strong className="block truncate font-mono text-[0.88rem] font-black leading-none text-bushiri-ink tabular-nums">
          {formatKgManwonPrice(listing.price)}
        </strong>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.56rem] font-extrabold leading-none text-bushiri-muted">
          {hasWeightLabel ? <span className="truncate">{listing.weightLabel}</span> : null}
          {listing.halfAvailable ? <span className="text-bushiri-primary">반반</span> : null}
          {listing.variantLabel !== '기본' ? <span className="min-w-0 truncate">{listing.variantLabel}</span> : null}
        </div>
      </div>

      {listing.statusTags.length > 0 ? (
        <div className="mt-2 flex min-w-0 flex-wrap gap-1">
          {listing.statusTags.slice(0, 3).map((tag, tagIndex) => (
            <span
              className="rounded-[4px] border border-bushiri-ink/10 bg-white/65 px-1.5 py-0.5 text-[0.55rem] font-black leading-none text-bushiri-muted"
              key={`${row.key}-${vendor}-${listingIndex}-${tag}-${tagIndex}`}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  )
}

export function SpeciesCompareDialog({
  section,
  row,
  onOpenChange,
}: {
  section: TodayBoardSection
  row: TodayBoardRow | null
  onOpenChange: (open: boolean) => void
}) {
  const [originFilter, setOriginFilter] = useState('all')
  const [vendorFilter, setVendorFilter] = useState('all')
  const relatedRows = useMemo(
    () => (row ? section.rows.filter((candidate) => candidate.canonicalName === row.canonicalName) : []),
    [row, section.rows],
  )
  const originOptions = useMemo(
    () => relatedRows.map((candidate) => ({
      key: candidate.key,
      label: originOptionLabel(candidate),
      row: candidate,
    })),
    [relatedRows],
  )
  const activeRows = originFilter === 'all'
    ? relatedRows
    : relatedRows.filter((candidate) => candidate.key === originFilter)
  const visibleRows = activeRows.length > 0 ? activeRows : relatedRows
  const titleRow = relatedRows[0] ?? row

  useEffect(() => {
    setOriginFilter('all')
    setVendorFilter('all')
  }, [row?.canonicalName])

  const availableVendorCells = titleRow
    ? section.vendorColumns.map((vendor) => ({
      vendor,
      entries: visibleRows.flatMap<CompareEntry>((candidate) =>
        (candidate.cells[vendor] ?? []).map((listing, listingIndex) => ({
          row: candidate,
          listing,
          listingIndex,
        })),
      ),
    })).filter((cell) => cell.entries.length > 0)
    : []
  const effectiveVendorFilter =
    vendorFilter === 'all' || availableVendorCells.some((cell) => cell.vendor === vendorFilter)
      ? vendorFilter
      : 'all'
  const vendorCells = effectiveVendorFilter === 'all'
    ? availableVendorCells
    : availableVendorCells.filter((cell) => cell.vendor === effectiveVendorFilter)
  const listingCount = availableVendorCells.reduce((total, cell) => total + cell.entries.length, 0)
  const pricedListings = availableVendorCells.flatMap((cell) =>
    cell.entries.flatMap(({ listing }) => (listing.price === null ? [] : [listing.price])),
  )
  const lowestEntry = availableVendorCells
    .flatMap((cell) => cell.entries)
    .reduce<CompareEntry | null>((lowest, entry) => {
      if (!lowest) {
        return entry
      }

      return compareNullablePrice(entry.listing.price, lowest.listing.price) < 0 ? entry : lowest
    }, null)
  const minPrice = pricedListings.length > 0 ? Math.min(...pricedListings) : null
  const maxPrice = pricedListings.length > 0 ? Math.max(...pricedListings) : null
  const activeOriginLabel = originFilter === 'all'
    ? null
    : originOptions.find((option) => option.key === originFilter)?.label ?? null
  const titleFlagCountry = relatedRows.map((candidate) => candidate.speciesCountryLabel).join(' ') || titleRow?.speciesCountryLabel || ''
  const vendorOptions = [
    {
      value: 'all',
      label: `전체 판매처 (${formatNumber(availableVendorCells.length)})`,
    },
    ...availableVendorCells.map((cell) => ({
      value: cell.vendor,
      label: `${cell.vendor} (${formatNumber(cell.entries.length)}건)`,
    })),
  ]

  return (
    <Dialog.Root open={row !== null} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-bushiri-ink/35 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 grid h-[min(86dvh,720px)] w-[min(96vw,1120px)] -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-bushiri-ink/15 bg-bushiri-surface shadow-bushiri-popover focus-visible:outline-none">
          {titleRow ? (
            <>
              <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-bushiri-ink/15 bg-bushiri-surface-muted/82 px-4 py-3">
                <div className="min-w-0">
                  <Dialog.Title className="m-0 flex min-w-0 items-center gap-2 text-[1.05rem] font-black leading-tight text-bushiri-ink">
                    <span className="truncate">{titleRow.speciesLabel}</span>
                    <CountryFlag country={titleFlagCountry} flagClassName="h-3.5 w-5" />
                    {activeOriginLabel ? (
                      <span className="truncate text-[0.68rem] font-extrabold text-bushiri-muted">
                        {activeOriginLabel}
                      </span>
                    ) : null}
                  </Dialog.Title>
                  <Dialog.Description className="mt-1 flex min-w-0 flex-wrap gap-x-2 gap-y-1 text-[0.64rem] font-extrabold leading-none text-bushiri-muted">
                    <span>원산지 {formatNumber(originOptions.length)}개</span>
                    <span>{formatNumber(availableVendorCells.length)}개 판매처</span>
                    <span>{formatNumber(listingCount)}건</span>
                    {minPrice !== null && maxPrice !== null ? (
                      <span>
                        {formatKgManwonPrice(minPrice)} - {formatKgManwonPrice(maxPrice)}
                      </span>
                    ) : null}
                  </Dialog.Description>
                </div>

                <Dialog.Close asChild>
                  <button
                    aria-label="비교 팝업 닫기"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-bushiri-line bg-bushiri-surface text-bushiri-muted transition hover:border-bushiri-primary/30 hover:text-bushiri-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px"
                    type="button"
                  >
                    <X className="h-4 w-4" strokeWidth={2.4} />
                  </button>
                </Dialog.Close>

                <div className="col-span-2 grid min-w-0 gap-2 md:grid-cols-[minmax(12rem,0.42fr)_minmax(0,1fr)] md:items-center">
                  <label className="grid min-w-0 gap-1">
                    <span className="text-[0.62rem] font-black leading-none text-bushiri-muted">
                      판매처
                    </span>
                    <VendorFilterDropdown
                      options={vendorOptions}
                      value={effectiveVendorFilter}
                      onChange={setVendorFilter}
                    />
                  </label>

                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <button
                      aria-pressed={originFilter === 'all'}
                      className={cn(
                        'inline-flex h-7 items-center rounded-md border px-2 text-[0.62rem] font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px',
                        originFilter === 'all'
                          ? 'border-bushiri-primary bg-bushiri-primary text-white'
                          : 'border-bushiri-line bg-bushiri-surface text-bushiri-muted hover:border-bushiri-primary/30 hover:text-bushiri-primary',
                      )}
                      onClick={() => setOriginFilter('all')}
                      type="button"
                    >
                      전체
                    </button>
                    {originOptions.map((option) => (
                      <button
                        aria-pressed={originFilter === option.key}
                        className={cn(
                          'inline-flex h-7 min-w-0 items-center gap-1 rounded-md border px-2 text-[0.62rem] font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px',
                          originFilter === option.key
                            ? 'border-bushiri-primary bg-bushiri-primary text-white'
                            : 'border-bushiri-line bg-bushiri-surface text-bushiri-muted hover:border-bushiri-primary/30 hover:text-bushiri-primary',
                        )}
                        key={option.key}
                        onClick={() => setOriginFilter(option.key)}
                        title={fullOriginLabel(option.row)}
                        type="button"
                      >
                        <CountryFlag country={option.row.speciesCountryLabel} flagClassName="h-2.5 w-4" />
                        {option.label ? (
                          <span className="max-w-24 truncate">{option.label}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              </header>

              <div
                className="min-h-0 overflow-auto bg-bushiri-ink/10"
              >
                {vendorCells.length > 0 ? (
                  <div
                    className="grid min-w-[min(44rem,100%)] gap-px"
                    style={{ gridTemplateColumns: `repeat(${vendorCells.length}, minmax(220px, 1fr))` }}
                  >
                    {vendorCells.map(({ vendor, entries }) => (
                      <section className="grid min-w-0 content-start bg-bushiri-surface" key={vendor}>
                        <header className="sticky top-0 z-[1] grid min-h-14 content-center gap-1 border-b border-bushiri-ink/10 bg-bushiri-surface-muted/95 px-2.5 py-2 backdrop-blur-[8px]">
                          <h3 className="m-0 truncate text-[0.72rem] font-black leading-none text-bushiri-ink">
                            {vendor}
                          </h3>
                          <span className="font-mono text-[0.56rem] font-black leading-none text-bushiri-muted tabular-nums">
                            {formatNumber(entries.length)}건
                          </span>
                        </header>

                        <div className="grid content-start gap-1.5 p-1.5">
                          {entries.map((entry) => (
                            <ListingCard
                              entry={entry}
                              isLowestForSpecies={lowestEntry?.listing === entry.listing}
                              key={`${entry.row.key}-${vendor}-${entry.listing.variantLabel}-${entry.listingIndex}`}
                              vendor={vendor}
                            />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="grid min-h-56 place-items-center bg-bushiri-surface p-6 text-center">
                    <p className="m-0 text-sm font-extrabold text-bushiri-muted">
                      표시할 판매처가 없습니다.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
