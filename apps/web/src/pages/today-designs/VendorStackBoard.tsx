import { useState } from 'react'
import { BadgeCheck, Bot, CircleDollarSign } from 'lucide-react'

import type {
  TodayBoardListing,
  TodayBoardRow,
  TodayBoardSection,
} from '../../lib/board'
import { formatKgManwonPrice, formatNumber } from '../../lib/format'
import { cn } from '../../components/ui'
import { compactOriginLabel, CountryFlag } from '../../components/CountryFlag'
import { SpeciesCompareDialog } from './SpeciesCompareDialog'

type VendorStackRow = {
  vendor: string
  speciesCount: number
  listingCount: number
  listings: VendorStackListing[]
}

type VendorStackListing = {
  row: TodayBoardRow
  listing: TodayBoardListing
  listingIndex: number
}

function buildVendorRows(section: TodayBoardSection): VendorStackRow[] {
  return section.vendorColumns.map((vendor) => {
    const listings = section.rows.flatMap<VendorStackListing>((row) =>
      (row.cells[vendor] ?? []).map((listing, listingIndex) => ({
        row,
        listing,
        listingIndex,
      })),
    )
    const speciesCount = new Set(listings.map((entry) => entry.row.key)).size

    return {
      vendor,
      speciesCount,
      listingCount: listings.length,
      listings,
    }
  })
}

function rowOrigin(row: TodayBoardRow) {
  return [row.speciesCountryLabel, row.speciesOriginLabel].filter(Boolean).join(' / ')
}

function awardIcons(listing: TodayBoardListing) {
  return [
    listing.isAiRecommended ? { label: 'AI추천', Icon: Bot } : null,
    listing.isLowestPrice ? { label: '최저가', Icon: CircleDollarSign } : null,
    listing.isBestCondition ? { label: '최상품', Icon: BadgeCheck } : null,
  ].filter((award): award is { label: string; Icon: typeof Bot } => award !== null)
}

function listingTitle(vendor: string, entry: VendorStackListing) {
  return [
    vendor,
    entry.row.speciesLabel,
    rowOrigin(entry.row),
    formatKgManwonPrice(entry.listing.price),
    entry.listing.weightLabel,
    entry.listing.variantLabel,
    entry.listing.halfAvailable ? '반반 가능' : null,
    ...entry.listing.statusTags,
    entry.listing.isAiRecommended ? 'AI추천' : null,
    entry.listing.isLowestPrice ? '최저가' : null,
    entry.listing.isBestCondition ? '최상품' : null,
  ]
    .filter(Boolean)
    .join('\n')
}

function listingToneClass(listing: TodayBoardListing) {
  if (listing.statusTags.includes('품절')) {
    return 'border-bushiri-danger/20 bg-bushiri-danger/[0.06]'
  }

  if (listing.isAiRecommended) {
    return 'border-bushiri-award-ai/60 bg-bushiri-award-ai/28'
  }

  if (listing.isLowestPrice) {
    return 'border-bushiri-current/30 bg-bushiri-award-low/55'
  }

  if (listing.isBestCondition) {
    return 'border-bushiri-kelp/30 bg-bushiri-award-best/55'
  }

  if (listing.statusTags.includes('이벤트')) {
    return 'border-bushiri-warning/24 bg-bushiri-warning/[0.07]'
  }

  return 'border-bushiri-line/75 bg-bushiri-surface'
}

function shortStatus(listing: TodayBoardListing) {
  if (listing.statusTags.includes('품절')) {
    return '품'
  }

  if (listing.statusTags.includes('이벤트')) {
    return '행'
  }

  if (listing.halfAvailable) {
    return '반'
  }

  return null
}

function PriceChip({
  entry,
  onSelectRow,
  vendor,
}: {
  entry: VendorStackListing
  onSelectRow: (row: TodayBoardRow) => void
  vendor: string
}) {
  const awards = awardIcons(entry.listing)
  const status = shortStatus(entry.listing)
  const originText = compactOriginLabel(entry.row.speciesCountryLabel, entry.row.speciesOriginLabel)

  return (
    <button
      className={cn(
        'grid h-11 w-full min-w-0 grid-rows-[auto_auto] gap-1 rounded-[5px] border px-2 py-1.5 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.62)] transition hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-bushiri-primary active:translate-y-px',
        listingToneClass(entry.listing),
      )}
      onClick={() => onSelectRow(entry.row)}
      title={listingTitle(vendor, entry)}
      type="button"
    >
      <span className="flex min-w-0 items-baseline gap-1.5 text-left">
        <span className="min-w-0 truncate text-[0.66rem] font-black leading-none text-bushiri-ink">
          {entry.row.speciesLabel}
        </span>
        <strong className="shrink-0 font-mono text-[0.72rem] font-black leading-none text-bushiri-ink tabular-nums">
          {formatKgManwonPrice(entry.listing.price)}
        </strong>
      </span>

      <span className="flex min-w-0 items-center gap-1">
        <CountryFlag
          country={entry.row.speciesCountryLabel}
          flagClassName="h-2.5 w-4"
        />
        {originText ? (
          <span className="min-w-0 truncate text-[0.48rem] font-bold leading-none text-bushiri-muted">
            {originText}
          </span>
        ) : null}
        <span className="min-w-0 truncate text-[0.54rem] font-black leading-none text-bushiri-muted">
          {entry.listing.weightLabel}
        </span>
        {status ? (
          <span className="grid h-3 min-w-3 shrink-0 place-items-center rounded-[3px] border border-bushiri-line bg-white/65 px-0.5 text-[0.44rem] font-black leading-none text-bushiri-muted">
            {status}
          </span>
        ) : null}
        {awards.slice(0, 2).map(({ label, Icon }) => (
          <Icon
            aria-label={label}
            className="h-2.5 w-2.5 shrink-0 text-bushiri-current"
            key={`${entry.row.key}-${entry.listingIndex}-${label}`}
            strokeWidth={2.5}
          />
        ))}
      </span>
    </button>
  )
}

function VendorBand({
  onSelectRow,
  row,
}: {
  onSelectRow: (row: TodayBoardRow) => void
  row: VendorStackRow
}) {
  return (
    <section className="grid min-h-[112px] grid-cols-[8rem_minmax(0,1fr)] border-t border-bushiri-ink/15 first:border-t-0">
      <header className="grid content-between border-r border-bushiri-ink/15 bg-bushiri-surface-muted/80 p-3">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-[0.92rem] font-extrabold leading-tight text-bushiri-ink">
            {row.vendor}
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-1 text-[0.58rem] font-black text-bushiri-muted">
          <span className="rounded-[4px] border border-bushiri-line bg-bushiri-surface px-1.5 py-1">
            {formatNumber(row.speciesCount)}종
          </span>
          <span className="rounded-[4px] border border-bushiri-line bg-bushiri-surface px-1.5 py-1 text-right">
            {formatNumber(row.listingCount)}건
          </span>
        </div>
      </header>

      <div className="grid auto-rows-[44px] grid-cols-[repeat(auto-fill,minmax(136px,1fr))] content-start gap-2 bg-bushiri-surface/70 p-2">
        {row.listings.length > 0 ? (
          row.listings.map((entry) => (
            <PriceChip
              entry={entry}
              key={`${row.vendor}-${entry.row.key}-${entry.listing.variantLabel}-${entry.listingIndex}`}
              onSelectRow={onSelectRow}
              vendor={row.vendor}
            />
          ))
        ) : (
          <div className="col-span-full grid min-h-20 place-items-center rounded-md border border-dashed border-bushiri-line bg-bushiri-ink/[0.025] text-[0.72rem] font-bold text-bushiri-muted">
            시세 없음
          </div>
        )}
      </div>
    </section>
  )
}

export function VendorStackBoard({
  comparisonSection,
  section,
}: {
  comparisonSection?: TodayBoardSection
  section: TodayBoardSection
}) {
  const vendorRows = buildVendorRows(section)
  const [selectedRow, setSelectedRow] = useState<TodayBoardRow | null>(null)

  return (
    <section className="grid w-full" aria-label={`${section.label} 판매처별 압축 시세판`}>
      <div className="max-h-[min(72dvh,760px)] overflow-auto rounded-lg border border-bushiri-ink/15 bg-bushiri-surface/95">
        {vendorRows.length > 0 ? (
          vendorRows.map((vendorRow) => (
            <VendorBand
              key={vendorRow.vendor}
              onSelectRow={setSelectedRow}
              row={vendorRow}
            />
          ))
        ) : (
          <div className="grid min-h-32 place-items-center bg-bushiri-ink/[0.04] p-6 text-center">
            <p className="m-0 text-sm font-bold text-bushiri-muted">표시할 판매처가 없습니다.</p>
          </div>
        )}
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
