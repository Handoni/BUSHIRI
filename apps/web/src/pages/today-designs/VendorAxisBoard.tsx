import { useState } from 'react'
import { BadgeCheck, Bot, CircleDollarSign } from 'lucide-react'

import {
  type TodayBoardListing,
  type TodayBoardRow,
  type TodayBoardSection,
} from '../../lib/board'
import { formatKgManwonPrice, formatNumber } from '../../lib/format'
import { cn } from '../../components/ui'
import { compactOriginLabel, CountryFlag } from '../../components/CountryFlag'
import { SpeciesCompareDialog } from './SpeciesCompareDialog'

type VendorLane = {
  vendor: string
  speciesCount: number
  listingCount: number
}

type VendorAxisEntry = {
  row: TodayBoardRow
  listing: TodayBoardListing
  listingIndex: number
  isSpeciesLowest: boolean
}

type VendorAxisSpeciesRow = {
  key: string
  label: string
  sortOrder: number
  rows: TodayBoardRow[]
  cells: Record<string, VendorAxisEntry[]>
}

function awardCodes(listing: TodayBoardListing) {
  return [
    listing.isAiRecommended ? { label: 'AI', Icon: Bot } : null,
    listing.isLowestPrice ? { label: '저', Icon: CircleDollarSign } : null,
    listing.isBestCondition ? { label: '상', Icon: BadgeCheck } : null,
  ].filter((award): award is { label: string; Icon: typeof Bot } => award !== null)
}

function rowOrigin(row: TodayBoardRow) {
  return [row.speciesCountryLabel, row.speciesOriginLabel].filter(Boolean).join(' / ')
}

function listingTitle(row: TodayBoardRow, vendor: string, listing: TodayBoardListing) {
  return [
    row.speciesLabel,
    rowOrigin(row),
    vendor,
    formatKgManwonPrice(listing.price),
    listing.weightLabel,
    listing.variantLabel,
    listing.halfAvailable ? '반반 가능' : null,
    ...listing.statusTags,
    listing.isAiRecommended ? 'AI추천' : null,
    listing.isLowestPrice ? '최저가' : null,
    listing.isBestCondition ? '최상품' : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function listingToneClass(listing: TodayBoardListing, isSpeciesLowest: boolean) {
  if (listing.statusTags.includes('품절')) {
    return 'border-bushiri-danger/20 bg-bushiri-danger/[0.06] text-bushiri-danger'
  }

  if (listing.isAiRecommended) {
    return 'border-bushiri-award-ai/50 bg-bushiri-award-ai/24 text-bushiri-award-ai-text'
  }

  if (listing.isLowestPrice || isSpeciesLowest) {
    return 'border-bushiri-current/30 bg-bushiri-award-low/50 text-bushiri-award-low-text'
  }

  if (listing.isBestCondition) {
    return 'border-bushiri-kelp/30 bg-bushiri-award-best/55 text-bushiri-award-best-text'
  }

  if (listing.statusTags.includes('이벤트')) {
    return 'border-bushiri-warning/25 bg-bushiri-warning/[0.07] text-bushiri-warning'
  }

  return 'border-bushiri-line/75 bg-bushiri-surface/90 text-bushiri-ink'
}

function compareNullablePrice(left: number | null, right: number | null) {
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

function uniqueValues(values: Array<string | null | undefined>) {
  return values.filter((value, index): value is string => Boolean(value) && values.indexOf(value) === index)
}

function buildVendorLanes(section: TodayBoardSection): VendorLane[] {
  return section.vendorColumns.map((vendor) => {
    const rowsWithVendor = section.rows.filter((row) => (row.cells[vendor] ?? []).length > 0)
    const listingCount = rowsWithVendor.reduce((total, row) => total + (row.cells[vendor]?.length ?? 0), 0)

    return {
      vendor,
      speciesCount: new Set(rowsWithVendor.map((row) => row.canonicalName)).size,
      listingCount,
    }
  })
}

function buildSpeciesRows(section: TodayBoardSection): VendorAxisSpeciesRow[] {
  const rowsBySpecies = new Map<string, TodayBoardRow[]>()

  section.rows.forEach((row) => {
    const rows = rowsBySpecies.get(row.canonicalName) ?? []

    rows.push(row)
    rowsBySpecies.set(row.canonicalName, rows)
  })

  return Array.from(rowsBySpecies.entries())
    .map(([canonicalName, rows]) => {
      const entries = rows.flatMap((row) =>
        section.vendorColumns.flatMap((vendor) =>
          (row.cells[vendor] ?? []).map((listing, listingIndex) => ({
            row,
            vendor,
            listing,
            listingIndex,
          })),
        ),
      )
      const lowest = entries.reduce<(typeof entries)[number] | null>((currentLowest, entry) => {
        if (!currentLowest) {
          return entry
        }

        return compareNullablePrice(entry.listing.price, currentLowest.listing.price) < 0
          ? entry
          : currentLowest
      }, null)
      const cells = section.vendorColumns.reduce<Record<string, VendorAxisEntry[]>>((groupedCells, vendor) => {
        groupedCells[vendor] = entries
          .filter((entry) => entry.vendor === vendor)
          .map((entry) => ({
            row: entry.row,
            listing: entry.listing,
            listingIndex: entry.listingIndex,
            isSpeciesLowest: lowest?.listing === entry.listing,
          }))

        return groupedCells
      }, {})

      return {
        key: canonicalName,
        label: rows[0]?.speciesLabel ?? canonicalName,
        sortOrder: Math.min(...rows.map((row) => row.speciesSortOrder)),
        rows,
        cells,
      }
    })
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder
      }

      return left.label.localeCompare(right.label, 'ko')
    })
}

function CompactListingRow({
  entry,
  onSelectRow,
  vendor,
}: {
  entry: VendorAxisEntry
  onSelectRow: (row: TodayBoardRow) => void
  vendor: string
}) {
  const awards = awardCodes(entry.listing)
  const leadingTag =
    entry.listing.statusTags.find((tag) => tag === '품절' || tag === '이벤트') ??
    (entry.listing.halfAvailable ? '반' : null)
  const originText = compactOriginLabel(entry.row.speciesCountryLabel, entry.row.speciesOriginLabel)

  return (
    <button
      className={cn(
        'grid h-[22px] w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-[4px] border px-1.5 text-[0.52rem] leading-none transition hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-bushiri-primary active:translate-y-px',
        listingToneClass(entry.listing, entry.isSpeciesLowest),
      )}
      onClick={() => onSelectRow(entry.row)}
      title={listingTitle(entry.row, vendor, entry.listing)}
      type="button"
    >
      <span className="flex min-w-0 items-center justify-start gap-1 text-left">
        <CountryFlag
          country={entry.row.speciesCountryLabel}
          flagClassName="h-2.5 w-4"
        />
        {originText ? (
          <span className="min-w-0 truncate font-bold text-bushiri-muted">
            {originText}
          </span>
        ) : null}
        <strong className="shrink-0 truncate font-mono text-[0.58rem] font-black text-bushiri-ink tabular-nums">
          {formatKgManwonPrice(entry.listing.price)}
        </strong>
      </span>
      <span className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1 text-right">
        {leadingTag ? (
          <span className="shrink-0 rounded-[3px] border border-bushiri-ink/10 bg-white/65 px-0.5 py-0 text-[0.46rem] font-black text-bushiri-muted">
            {leadingTag}
          </span>
        ) : null}
        {awards.map(({ label, Icon }) => (
          <span
            className="inline-flex h-3 min-w-3 shrink-0 items-center justify-center rounded-[3px] border border-bushiri-current/25 bg-white/65 px-0.5 text-[0.46rem] font-black text-bushiri-current"
            key={`${entry.row.key}-${vendor}-${entry.listingIndex}-${label}`}
          >
            <Icon className="h-2 w-2" strokeWidth={2.5} />
            <span className="sr-only">{label}</span>
          </span>
        ))}
        <span className="max-w-[5.8rem] min-w-0 truncate text-[0.48rem] font-bold text-bushiri-muted">
          {entry.listing.weightLabel}
        </span>
      </span>
    </button>
  )
}

function SpeciesHeaderCell({ speciesRow }: { speciesRow: VendorAxisSpeciesRow }) {
  const countries = uniqueValues(speciesRow.rows.map((row) => row.speciesCountryLabel))
  const originVariants = uniqueValues(
    speciesRow.rows.map((row) => compactOriginLabel(row.speciesCountryLabel, row.speciesOriginLabel)),
  )

  return (
    <div className="sticky left-0 z-[1] grid min-h-full min-w-0 content-start gap-1 border-r border-bushiri-ink/15 bg-bushiri-surface-muted/95 px-2 py-1.5 shadow-[4px_0_8px_rgba(16,64,71,0.04)]">
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="flex shrink-0 items-center -space-x-1">
          {countries.slice(0, 3).map((country) => (
            <CountryFlag
              country={country}
              flagClassName="h-3 w-[1.125rem] ring-1 ring-bushiri-surface"
              key={country}
            />
          ))}
        </span>
        <strong className="min-w-0 truncate text-[0.78rem] font-black leading-tight text-bushiri-ink">
          {speciesRow.label}
        </strong>
      </div>
      {originVariants.length > 0 ? (
        <span className="min-w-0 truncate text-[0.56rem] font-extrabold leading-none text-bushiri-muted">
          {originVariants.join(' / ')}
        </span>
      ) : null}
    </div>
  )
}

function SpeciesVendorCell({
  entries,
  onSelectRow,
  vendor,
}: {
  entries: VendorAxisEntry[]
  onSelectRow: (row: TodayBoardRow) => void
  vendor: string
}) {
  if (entries.length === 0) {
    return (
      <div
        aria-hidden="true"
        className="min-h-[22px] rounded-[4px] border border-dashed border-bushiri-line bg-bushiri-ink/[0.025]"
      />
    )
  }

  return (
    <div className="grid min-w-0 auto-rows-[22px] gap-1">
      {entries.map((entry) => (
        <CompactListingRow
          entry={entry}
          key={`${vendor}-${entry.row.key}-${entry.listing.variantLabel}-${entry.listingIndex}`}
          onSelectRow={onSelectRow}
          vendor={vendor}
        />
      ))}
    </div>
  )
}

export function VendorAxisBoard({
  comparisonSection,
  section,
}: {
  comparisonSection?: TodayBoardSection
  section: TodayBoardSection
}) {
  const lanes = buildVendorLanes(section)
  const speciesRows = buildSpeciesRows(section)
  const [selectedRow, setSelectedRow] = useState<TodayBoardRow | null>(null)
  const gridTemplateColumns = `minmax(112px,0.42fr) repeat(${Math.max(lanes.length, 1)}, minmax(260px,1fr))`

  return (
    <section className="grid w-full" aria-label={`${section.label} 판매처별 시세판`}>
      <div className="max-h-[min(72dvh,760px)] overflow-auto rounded-lg border border-bushiri-ink/15 bg-bushiri-surface/95">
        <div className="grid min-w-max" style={{ gridTemplateColumns }}>
          <div className="sticky left-0 top-0 z-[3] border-b border-r border-bushiri-ink/15 bg-bushiri-surface-muted/95 px-2 py-2 text-[0.62rem] font-black text-bushiri-muted">
            어종
          </div>
          {lanes.map((lane) => (
            <header
              className="sticky top-0 z-[2] border-b border-r border-bushiri-ink/15 bg-bushiri-surface-muted/95 px-3 py-2 last:border-r-0"
              key={lane.vendor}
            >
              <div className="flex min-w-0 items-center justify-between gap-3">
                <h3 className="m-0 truncate text-[0.86rem] font-extrabold leading-tight text-bushiri-ink">
                  {lane.vendor}
                </h3>
                <span className="shrink-0 rounded-[4px] border border-bushiri-line bg-bushiri-surface px-1.5 py-0.5 font-mono text-[0.62rem] font-black text-bushiri-muted">
                  {formatNumber(lane.listingCount)}
                </span>
              </div>
              <p className="mt-1 text-[0.62rem] font-bold leading-none text-bushiri-muted">
                {formatNumber(lane.speciesCount)}종
              </p>
            </header>
          ))}

          {speciesRows.length > 0 ? (
            speciesRows.map((speciesRow) => (
              <div
                className="contents"
                key={speciesRow.key}
              >
                <SpeciesHeaderCell speciesRow={speciesRow} />
                {lanes.map((lane) => (
                  <div
                    className="min-w-0 border-b border-r border-bushiri-ink/10 bg-bushiri-surface/82 p-1 last:border-r-0"
                    key={`${speciesRow.key}-${lane.vendor}`}
                  >
                    <SpeciesVendorCell
                      entries={speciesRow.cells[lane.vendor] ?? []}
                      onSelectRow={setSelectedRow}
                      vendor={lane.vendor}
                    />
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="col-span-full grid min-h-32 min-w-[720px] place-items-center bg-bushiri-ink/[0.04] p-6 text-center">
              <p className="m-0 text-sm font-bold text-bushiri-muted">표시할 판매처가 없습니다.</p>
            </div>
          )}
        </div>
      </div>
      <SpeciesCompareDialog
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRow(null)
          }
        }}
        row={selectedRow}
        section={comparisonSection ?? section}
      />
    </section>
  )
}
