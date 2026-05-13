import { useState } from 'react'
import { BadgeCheck, Bot, CircleDollarSign } from 'lucide-react'

import {
  getLowestVendorListing,
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
  rows: VendorLaneRow[]
}

type VendorLaneRow = {
  row: TodayBoardRow
  listing: TodayBoardListing
  listingIndex: number
  isRowLowest: boolean
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

function listingToneClass(listing: TodayBoardListing, isRowLowest: boolean) {
  if (listing.statusTags.includes('품절')) {
    return 'border-bushiri-danger/20 bg-bushiri-danger/[0.06] text-bushiri-danger'
  }

  if (listing.isAiRecommended) {
    return 'border-bushiri-award-ai/50 bg-bushiri-award-ai/24 text-bushiri-award-ai-text'
  }

  if (listing.isLowestPrice || isRowLowest) {
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

function buildVendorLanes(section: TodayBoardSection): VendorLane[] {
  const lowestByRowKey = new Map(
    section.rows.map((row) => [row.key, getLowestVendorListing(row, section.vendorColumns)?.listing ?? null]),
  )

  return section.vendorColumns.map((vendor) => {
    const rows = section.rows.flatMap<VendorLaneRow>((row) => {
      const listings = row.cells[vendor] ?? []
      const rowLowest = lowestByRowKey.get(row.key) ?? null

      return listings.map((listing, listingIndex) => ({
        row,
        listing,
        listingIndex,
        isRowLowest: rowLowest === listing,
      }))
    })
    const speciesCount = new Set(rows.map((entry) => entry.row.key)).size

    return {
      vendor,
      speciesCount,
      listingCount: rows.length,
      rows,
    }
  })
}

function CompactListingRow({
  entry,
  onSelectRow,
  vendor,
}: {
  entry: VendorLaneRow
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
        listingToneClass(entry.listing, entry.isRowLowest),
      )}
      onClick={() => onSelectRow(entry.row)}
      title={listingTitle(entry.row, vendor, entry.listing)}
      type="button"
    >
      <span className="flex min-w-0 items-center justify-start gap-1 text-left">
        <strong className="max-w-[4.6rem] min-w-0 truncate font-black text-bushiri-ink">
          {entry.row.speciesLabel}
        </strong>
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

function VendorLaneColumn({
  lane,
  onSelectRow,
}: {
  lane: VendorLane
  onSelectRow: (row: TodayBoardRow) => void
}) {
  return (
    <section className="grid min-w-[300px] grid-rows-[auto_minmax(0,1fr)] border-r border-bushiri-ink/15 last:border-r-0">
      <header className="sticky top-0 z-[2] border-b border-bushiri-ink/15 bg-bushiri-surface-muted/95 px-3 py-2">
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

      {lane.rows.length > 0 ? (
        <div className="grid auto-rows-[22px] gap-1 bg-bushiri-surface/70 p-1">
          {lane.rows.map((entry) => (
            <CompactListingRow
              entry={entry}
              key={`${lane.vendor}-${entry.row.key}-${entry.listing.variantLabel}-${entry.listingIndex}`}
              onSelectRow={onSelectRow}
              vendor={lane.vendor}
            />
          ))}
        </div>
      ) : (
        <div className="grid min-h-32 place-items-center bg-bushiri-ink/[0.035] p-4 text-center">
          <p className="m-0 text-[0.72rem] font-bold text-bushiri-muted">시세 없음</p>
        </div>
      )}
    </section>
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
  const [selectedRow, setSelectedRow] = useState<TodayBoardRow | null>(null)

  return (
    <section className="grid w-full" aria-label={`${section.label} 판매처별 시세판`}>
      <div className="max-h-[min(72dvh,760px)] overflow-auto rounded-lg border border-bushiri-ink/15 bg-bushiri-surface/95">
        <div
          className="grid min-w-max"
          style={{ gridTemplateColumns: `repeat(${Math.max(lanes.length, 1)}, minmax(300px, 1fr))` }}
        >
          {lanes.length > 0 ? (
            lanes.map((lane) => (
              <VendorLaneColumn
                key={lane.vendor}
                lane={lane}
                onSelectRow={setSelectedRow}
              />
            ))
          ) : (
            <div className="grid min-h-32 min-w-[720px] place-items-center bg-bushiri-ink/[0.04] p-6 text-center">
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
