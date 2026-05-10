import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { getTodayMarket } from '../lib/api'
import {
  buildTodayBoard,
  getLowestVendorListing,
  type TodayBoardListing,
  type TodayBoardRow,
  UNKNOWN_ORIGIN_LABEL,
} from '../lib/board'
import {
  formatKgManwonPrice,
  formatNumber,
  formatRelativeDateInput,
} from '../lib/format'
import { useResource } from '../hooks/useResource'
import {
  Badge,
  EmptyState,
  ErrorState,
  LabeledField,
  LoadingBlock,
  Panel,
  ToggleSwitch,
  cn,
  inputControlClass,
} from '../components/ui'
import { CountryFlag } from '../components/CountryFlag'
import { VendorAxisBoard } from './today-designs/VendorAxisBoard'

const DEFAULT_BOARD_SECTION = 'all'
const NO_VENDOR_SELECTION = '__vendor-none__'
const NO_COUNTRY_SELECTION = '__country-none__'
const COUNTRY_ORDER = ['국내산', '일본산', '중국산', '노르웨이', '러시아', UNKNOWN_ORIGIN_LABEL]

type TodayBoardUrlState = {
  selectedDate: string
  vendors: string[]
  countries: string[]
}

function readTodayBoardUrlState(): TodayBoardUrlState {
  if (typeof window === 'undefined') {
    return {
      selectedDate: formatRelativeDateInput(),
      vendors: [],
      countries: [],
    }
  }

  const searchParams = new URLSearchParams(window.location.search)
  const selectedDate = searchParams.get('date')?.trim() || formatRelativeDateInput()
  const vendors = searchParams
    .getAll('vendor')
    .map((vendor) => vendor.trim())
    .filter((vendor) => vendor && vendor !== 'all')
  const countries = searchParams
    .getAll('country')
    .map((country) => country.trim())
    .filter((country) => country && country !== 'all')

  return {
    selectedDate,
    vendors,
    countries,
  }
}

function replaceTodayBoardUrlState({
  selectedDate,
  vendors,
  countries,
}: TodayBoardUrlState) {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)
  const searchParams = url.searchParams
  searchParams.delete('section')
  searchParams.delete('q')
  searchParams.delete('country')
  searchParams.delete('design')

  if (selectedDate.trim()) {
    searchParams.set('date', selectedDate)
  } else {
    searchParams.delete('date')
  }

  searchParams.delete('vendor')
  vendors.forEach((vendor) => searchParams.append('vendor', vendor))
  searchParams.delete('country')
  countries.forEach((country) => searchParams.append('country', country))

  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function originCountryLabelFromRaw(raw: unknown): string {
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}

  return stringValue(record.originCountry) ?? stringValue(record.origin) ?? UNKNOWN_ORIGIN_LABEL
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
      <span className="grid min-w-0 grid-rows-[auto_auto_auto] justify-items-start gap-1 leading-tight">
        <span
          aria-label={row.speciesCountryLabel}
          className="inline-flex h-5 items-center text-base leading-none lg:h-6 lg:text-lg"
          title={row.speciesCountryLabel}
        >
          <CountryFlag country={row.speciesCountryLabel} />
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

function VendorMultiSelect({
  compact = false,
  dropdownAlign = 'right',
  options,
  selectedValues,
  onChange,
}: {
  compact?: boolean
  dropdownAlign?: 'left' | 'right'
  options: Array<{ value: string; label: string }>
  selectedValues: string[]
  onChange: (values: string[]) => void
}) {
  const orderedValues = options.map((option) => option.value)
  const selectedVendorValues = selectedValues.filter((value) => orderedValues.includes(value))
  const noneSelected = selectedValues.includes(NO_VENDOR_SELECTION)
  const allSelected =
    !noneSelected &&
    (selectedVendorValues.length === 0 || selectedVendorValues.length === orderedValues.length)
  const selectedSet = new Set(selectedVendorValues)
  const selectedOption = options.find((option) => option.value === selectedVendorValues[0])
  const selectedLabel = allSelected
    ? '전체'
    : noneSelected || selectedVendorValues.length === 0
      ? '선택 없음'
      : selectedVendorValues.length === 1
        ? selectedOption?.label ?? selectedVendorValues[0]
        : `${selectedVendorValues.length}개 판매처`
  const compactSelectedLabel = allSelected
    ? '전체'
    : noneSelected || selectedVendorValues.length === 0
      ? '없음'
      : selectedVendorValues.length === 1
        ? selectedOption?.label ?? selectedVendorValues[0]
        : `${selectedVendorValues.length}곳`

  const updateSelected = (nextValues: string[]) => {
    const orderedNextValues = orderedValues.filter((value) => nextValues.includes(value))

    if (orderedNextValues.length === orderedValues.length) {
      onChange([])
      return
    }

    onChange(orderedNextValues.length === 0 ? [NO_VENDOR_SELECTION] : orderedNextValues)
  }

  const toggleVendor = (vendor: string) => {
    if (allSelected) {
      updateSelected(orderedValues.filter((value) => value !== vendor))
      return
    }

    if (selectedSet.has(vendor)) {
      updateSelected(selectedVendorValues.filter((value) => value !== vendor))
      return
    }

    updateSelected([...selectedVendorValues, vendor])
  }

  return (
    <details className="group relative z-40 min-w-0">
      <summary
        className={cn(
          inputControlClass,
          'flex cursor-pointer list-none items-center justify-between gap-3 font-bold [&::-webkit-details-marker]:hidden',
          compact ? 'min-h-9 gap-1.5 rounded-lg px-1.5 text-[0.78rem]' : '',
        )}
      >
        <span className="min-w-0 truncate">{compact ? compactSelectedLabel : selectedLabel}</span>
        <span
          aria-hidden="true"
          className="shrink-0 text-bushiri-muted transition-transform group-open:rotate-180"
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2.4} />
        </span>
      </summary>
      <div
        className={cn(
          'absolute top-[calc(100%+0.35rem)] z-50 grid max-h-72 overflow-auto rounded-lg border border-bushiri-line bg-bushiri-surface p-1.5 shadow-bushiri-popover',
          compact
            ? cn(
                'w-[min(16rem,calc(100vw-1.5rem))]',
                dropdownAlign === 'left' ? 'left-0' : 'right-0',
              )
            : 'left-0 w-full min-w-52',
        )}
      >
        <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 text-sm font-extrabold text-bushiri-ink hover:bg-bushiri-primary/10">
          <input
            checked={allSelected}
            className="h-4 w-4 accent-bushiri-primary"
            onChange={() => onChange(allSelected ? [NO_VENDOR_SELECTION] : [])}
            type="checkbox"
          />
          <span>{allSelected ? '전체 해제' : '전체 선택'}</span>
        </label>
        <div className="my-1 h-px bg-bushiri-line" />
        {options.map((option) => (
          <label
            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 text-sm font-bold text-bushiri-ink hover:bg-bushiri-primary/10"
            key={option.value}
          >
            <input
              checked={allSelected || selectedSet.has(option.value)}
              className="h-4 w-4 accent-bushiri-primary"
              onChange={() => toggleVendor(option.value)}
              type="checkbox"
            />
            <span className="min-w-0 truncate">{option.label}</span>
          </label>
        ))}
      </div>
    </details>
  )
}

function CountryOptionLabel({
  country,
  className,
}: {
  country: string
  className?: string
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <CountryFlag country={country} flagClassName="h-3 w-[1.125rem]" />
      {country !== UNKNOWN_ORIGIN_LABEL ? (
        <span className="min-w-0 truncate">{country}</span>
      ) : null}
    </span>
  )
}

function CountryMultiSelect({
  compact = false,
  options,
  selectedValues,
  onChange,
}: {
  compact?: boolean
  options: Array<{ value: string; label: string }>
  selectedValues: string[]
  onChange: (values: string[]) => void
}) {
  const orderedValues = options.map((option) => option.value)
  const selectedCountryValues = selectedValues.filter((value) => orderedValues.includes(value))
  const noneSelected = selectedValues.includes(NO_COUNTRY_SELECTION)
  const allSelected =
    !noneSelected &&
    (selectedCountryValues.length === 0 || selectedCountryValues.length === orderedValues.length)
  const selectedSet = new Set(selectedCountryValues)
  const selectedOption = options.find((option) => option.value === selectedCountryValues[0])
  const selectedLabel = allSelected
    ? compact
      ? '국가'
      : '국가 전체'
    : noneSelected || selectedCountryValues.length === 0
      ? '선택 없음'
      : selectedCountryValues.length === 1
        ? selectedOption?.label ?? selectedCountryValues[0]
        : `${selectedCountryValues.length}개 국가`

  const updateSelected = (nextValues: string[]) => {
    const orderedNextValues = orderedValues.filter((value) => nextValues.includes(value))

    if (orderedNextValues.length === orderedValues.length) {
      onChange([])
      return
    }

    onChange(orderedNextValues.length === 0 ? [NO_COUNTRY_SELECTION] : orderedNextValues)
  }

  const toggleCountry = (country: string) => {
    if (allSelected) {
      updateSelected(orderedValues.filter((value) => value !== country))
      return
    }

    if (selectedSet.has(country)) {
      updateSelected(selectedCountryValues.filter((value) => value !== country))
      return
    }

    updateSelected([...selectedCountryValues, country])
  }

  return (
    <details className="group relative z-40 min-w-0">
      <summary
        className={cn(
          inputControlClass,
          'flex cursor-pointer list-none items-center justify-between gap-3 font-bold [&::-webkit-details-marker]:hidden',
          compact ? 'min-h-9 gap-1.5 rounded-lg px-1.5 text-[0.78rem]' : '',
        )}
      >
        <span className="min-w-0 truncate">
          {compact && allSelected ? (
            '전체'
          ) : compact && !noneSelected && selectedCountryValues.length === 1 && selectedOption ? (
            <CountryFlag country={selectedOption.value} flagClassName="h-3 w-[1.125rem]" />
          ) : compact && !noneSelected && selectedCountryValues.length > 1 ? (
            <span className="inline-flex min-w-0 items-center gap-0.5">
              <CountryFlag country={selectedCountryValues[0]} flagClassName="h-3 w-[1.125rem]" />
              <span className="font-black">+{selectedCountryValues.length - 1}</span>
            </span>
          ) : !allSelected && !noneSelected && selectedCountryValues.length === 1 && selectedOption ? (
            <CountryOptionLabel country={selectedOption.value} />
          ) : (
            selectedLabel
          )}
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-bushiri-muted transition-transform group-open:rotate-180"
        >
          <ChevronDown className="h-4 w-4" strokeWidth={2.4} />
        </span>
      </summary>
      <div
        className={cn(
          'absolute top-[calc(100%+0.35rem)] z-50 grid max-h-72 overflow-auto rounded-lg border border-bushiri-line bg-bushiri-surface p-1.5 shadow-bushiri-popover',
          compact ? 'right-0 w-[min(14rem,calc(100vw-1.5rem))]' : 'left-0 w-full min-w-44',
        )}
      >
        <label className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 text-sm font-extrabold text-bushiri-ink hover:bg-bushiri-primary/10">
          <input
            checked={allSelected}
            className="h-4 w-4 accent-bushiri-primary"
            onChange={() => onChange(allSelected ? [NO_COUNTRY_SELECTION] : [])}
            type="checkbox"
          />
          <span>{allSelected ? '전체 해제' : '전체 선택'}</span>
        </label>
        <div className="my-1 h-px bg-bushiri-line" />
        {options.map((option) => (
          <label
            className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2.5 text-sm font-bold text-bushiri-ink hover:bg-bushiri-primary/10"
            key={option.value}
          >
            <input
              checked={allSelected || selectedSet.has(option.value)}
              className="h-4 w-4 accent-bushiri-primary"
              onChange={() => toggleCountry(option.value)}
              type="checkbox"
            />
            <CountryOptionLabel country={option.value} />
          </label>
        ))}
      </div>
    </details>
  )
}

function formatCompactDateLabel(value: string) {
  const [yearText, monthText, dayText] = value.split('-')
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return value
  }

  const selected = new Date(year, month - 1, day)
  const today = new Date()
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const yesterday = new Date(todayOnly)
  yesterday.setDate(todayOnly.getDate() - 1)

  if (selected.getTime() === todayOnly.getTime()) {
    return '오늘'
  }

  if (selected.getTime() === yesterday.getTime()) {
    return '어제'
  }

  return `${`${month}`.padStart(2, '0')}.${`${day}`.padStart(2, '0')}`
}

function CompactDateInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const openDatePicker = (input: HTMLInputElement) => {
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void }

    if (typeof pickerInput.showPicker === 'function') {
      try {
        pickerInput.showPicker()
        return
      } catch {
        // Fall through to focus/click for browsers that restrict showPicker.
      }
    }
  }

  return (
    <label className="relative block min-w-0 cursor-pointer">
      <span
        aria-hidden="true"
        className="pointer-events-none grid h-9 min-h-9 w-full min-w-0 place-items-center rounded-lg border border-bushiri-line bg-bushiri-surface px-1.5 text-[0.76rem] font-black text-bushiri-ink"
      >
        {formatCompactDateLabel(value)}
      </span>
      <input
        aria-label="기준일"
        className="absolute inset-0 z-10 h-full w-full cursor-pointer appearance-none rounded-lg border-0 bg-transparent text-transparent caret-transparent [font-size:16px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-datetime-edit]:opacity-0"
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onPointerDown={(event) => openDatePicker(event.currentTarget)}
      />
    </label>
  )
}

function CompactFilterField({
  children,
  label,
}: {
  children: ReactNode
  label: string
}) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <span className="min-w-0 truncate pl-0.5 text-[0.54rem] font-black leading-none text-bushiri-muted">
        {label}
      </span>
      {children}
    </div>
  )
}

function CompactSoldOutToggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      aria-label={checked ? '품절 제외 중' : '품절 포함 중'}
      aria-pressed={checked}
      className={cn(
        'inline-flex h-9 w-full shrink-0 items-center justify-center rounded-lg border px-1.5 text-[0.68rem] font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px',
        checked
          ? 'border-bushiri-primary bg-bushiri-primary text-white'
          : 'border-bushiri-line bg-bushiri-surface text-bushiri-muted',
      )}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span className="sr-only">품절 제외</span>
      <span
        aria-hidden="true"
        className={cn(
          'relative h-4 w-7 rounded-full transition',
          checked ? 'bg-white/28' : 'bg-bushiri-line-strong/40',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-bushiri-thumb transition-transform',
            checked ? 'translate-x-3' : 'translate-x-0',
          )}
        />
      </span>
    </button>
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
          {formatKgManwonPrice(listing.price)}
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
          {listing.statusTags.map((tag, tagIndex) => (
            <Badge
              key={`${rowKey}-${vendor}-${listingIndex}-${tag}-${tagIndex}`}
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
  const [isMobileFilterVisible, setIsMobileFilterVisible] = useState(true)
  const [expandedSpeciesKeys, setExpandedSpeciesKeys] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const mobileFilterRef = useRef<HTMLElement | null>(null)
  const lastScrollYRef = useRef(0)
  const lastTouchYRef = useRef<number | null>(null)
  const {
    selectedDate,
    vendors,
    countries,
  } = urlState
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

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const mobileQuery = window.matchMedia('(max-width: 767px)')
    const isMobileViewport = () => mobileQuery.matches || window.innerWidth < 768
    const getPageScrollY = () =>
      Math.max(
        window.scrollY,
        window.visualViewport?.pageTop ?? 0,
        document.documentElement.scrollTop,
        document.body.scrollTop,
        0,
      )

    const handleScroll = () => {
      if (!isMobileViewport()) {
        setIsMobileFilterVisible(true)
        lastScrollYRef.current = getPageScrollY()
        return
      }

      const currentScrollY = getPageScrollY()
      const previousScrollY = lastScrollYRef.current
      const delta = currentScrollY - previousScrollY

      if (currentScrollY <= 8) {
        setIsMobileFilterVisible(true)
      } else if (delta > 8) {
        setIsMobileFilterVisible(false)
      } else if (delta < -8) {
        setIsMobileFilterVisible(true)
      }

      lastScrollYRef.current = currentScrollY
    }

    const handleWheel = (event: WheelEvent) => {
      if (!isMobileViewport()) {
        setIsMobileFilterVisible(true)
        return
      }

      if (event.deltaY > 8) {
        setIsMobileFilterVisible(false)
      } else if (event.deltaY < -8) {
        setIsMobileFilterVisible(true)
      }
    }

    const handleTouchStart = (event: TouchEvent) => {
      lastTouchYRef.current = event.touches[0]?.clientY ?? null
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!isMobileViewport()) {
        setIsMobileFilterVisible(true)
        return
      }

      const currentTouchY = event.touches[0]?.clientY

      if (currentTouchY === undefined || lastTouchYRef.current === null) {
        lastTouchYRef.current = currentTouchY ?? null
        return
      }

      const delta = lastTouchYRef.current - currentTouchY

      if (delta > 8) {
        setIsMobileFilterVisible(false)
      } else if (delta < -8) {
        setIsMobileFilterVisible(true)
      }

      lastTouchYRef.current = currentTouchY
    }

    const handleTouchEnd = () => {
      lastTouchYRef.current = null
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!isMobileViewport()) {
        return
      }

      const target = event.target instanceof Element ? event.target : null

      if (!target || mobileFilterRef.current?.contains(target)) {
        return
      }

      if (target.closest('button, input, textarea, select, summary, label, a, [role="button"], [role="switch"], [role="checkbox"]')) {
        return
      }

      setIsMobileFilterVisible(true)
    }

    const scrollTargets: EventTarget[] = [
      window,
      document,
      document.documentElement,
      document.body,
    ]

    lastScrollYRef.current = getPageScrollY()
    window.addEventListener('scroll', handleScroll, { passive: true })
    document.addEventListener('scroll', handleScroll, { capture: true, passive: true })
    document.documentElement.addEventListener('scroll', handleScroll, { passive: true })
    document.body.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('wheel', handleWheel, { passive: true })
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true })
    window.addEventListener('pointerdown', handlePointerDown, { passive: true })
    const scrollPollId = window.setInterval(handleScroll, 120)

    return () => {
      scrollTargets.forEach((target) => {
        target.removeEventListener('scroll', handleScroll, true)
        target.removeEventListener('scroll', handleScroll)
      })
      window.removeEventListener('wheel', handleWheel)
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.clearInterval(scrollPollId)
    }
  }, [])

  const marketRows = market.data?.rows ?? []
  const unfilteredBoard = useMemo(() => buildTodayBoard(marketRows), [marketRows])
  const vendorOptions = useMemo(() => {
    const allSection = unfilteredBoard.sections.find((section) => section.key === DEFAULT_BOARD_SECTION)
    const vendorsInData = new Set(marketRows.map((row) => row.source))
    const orderedVendors = [
      ...(allSection?.vendorColumns ?? []).filter((vendor) => vendorsInData.has(vendor)),
      ...Array.from(vendorsInData)
        .filter((vendor) => !(allSection?.vendorColumns ?? []).includes(vendor))
        .sort((left, right) => left.localeCompare(right, 'ko')),
    ]

    return orderedVendors.map((vendor) => ({
      value: vendor,
      label: vendor,
    }))
  }, [marketRows, unfilteredBoard.sections])
  const countryOptions = useMemo(() => {
    const countriesInData = Array.from(new Set(marketRows.map((row) => originCountryLabelFromRaw(row.raw))))
    const orderedCountries = [
      ...COUNTRY_ORDER.filter((country) => countriesInData.includes(country)),
      ...countriesInData
        .filter((country) => !COUNTRY_ORDER.includes(country))
        .sort((left, right) => left.localeCompare(right, 'ko')),
    ]

    return orderedCountries.map((country) => ({
      value: country,
      label: country,
    }))
  }, [marketRows])

  const filteredRows = useMemo(() => {
    const orderedVendors = vendorOptions.map((option) => option.value)
    const selectedVendors = vendors.filter((vendor) => orderedVendors.includes(vendor))
    const vendorSelectionEmpty = vendors.includes(NO_VENDOR_SELECTION)
    const allVendorsSelected = selectedVendors.length === 0 || selectedVendors.length === orderedVendors.length
    const orderedCountries = countryOptions.map((option) => option.value)
    const selectedCountries = countries.filter((country) => orderedCountries.includes(country))
    const countrySelectionEmpty = countries.includes(NO_COUNTRY_SELECTION)
    const allCountriesSelected = selectedCountries.length === 0 || selectedCountries.length === orderedCountries.length

    return marketRows.filter((row) => {
      const raw =
        typeof row.raw === 'object' && row.raw !== null
          ? (row.raw as Record<string, unknown>)
          : null
      const soldOut = raw?.soldOut === true
      const matchesVendor =
        !vendorSelectionEmpty &&
        (allVendorsSelected || selectedVendors.includes(row.source))
      const originCountry = originCountryLabelFromRaw(row.raw)
      const matchesCountry =
        !countrySelectionEmpty &&
        (allCountriesSelected || selectedCountries.includes(originCountry))

      return (
        matchesVendor &&
        matchesCountry &&
        (!excludeSoldOut || !soldOut)
      )
    })
  }, [countries, countryOptions, excludeSoldOut, marketRows, vendorOptions, vendors])

  const board = useMemo(() => buildTodayBoard(filteredRows), [filteredRows])
  const visibleSections = useMemo(
    () => board.sections.filter((section) => section.key === DEFAULT_BOARD_SECTION),
    [board.sections],
  )
  const visibleRows = visibleSections.flatMap((section) => section.rows)
  const showSpeciesCountryFlag =
    new Set(visibleRows.map((row) => row.speciesCountryLabel)).size > 1 ||
    visibleRows.some((row) => row.speciesCountryLabel === UNKNOWN_ORIGIN_LABEL)

  const emptyState =
    marketRows.length === 0
      ? {
          title: requestedDate ? `${requestedDate} 시세가 아직 도착하지 않았습니다` : '오늘 시세가 아직 도착하지 않았습니다',
          description: '응답 수신 후 시세판이 표시됩니다.',
        }
      : visibleRows.length === 0
      ? {
          title: '표시할 시세가 없습니다',
          description: '판매처, 국가 선택이나 품절 제외 조건을 조정해 주세요.',
        }
      : {
          title: '현재 조건에 맞는 시세가 없습니다',
          description: '판매처, 국가 선택이나 품절 제외 조건을 조정해 주세요.',
        }

  const updateUrlState = (nextState: Partial<TodayBoardUrlState>) => {
    setUrlState((currentState) => {
      const resolvedState = { ...currentState, ...nextState }

      replaceTodayBoardUrlState(resolvedState)
      return resolvedState
    })
  }

  const updateSelectedDate = (selectedDate: string) => {
    updateUrlState({ selectedDate })
  }

  const updateVendors = (vendors: string[]) => {
    setExpandedSpeciesKeys(new Set())
    updateUrlState({ vendors })
  }

  const updateCountries = (countries: string[]) => {
    setExpandedSpeciesKeys(new Set())
    updateUrlState({ countries })
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
    <div className="flex flex-col gap-4 md:relative md:left-1/2 md:w-[calc(100vw-2.5rem)] md:max-w-[1760px] md:-translate-x-1/2 md:gap-3">
      <section
        aria-label="모바일 시세 필터"
        className={cn(
          'sticky top-0 z-30 rounded-xl border border-bushiri-line bg-bushiri-surface/95 p-2 shadow-bushiri-panel backdrop-blur-[10px] transition duration-200 will-change-transform md:hidden',
          isMobileFilterVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-[calc(100%+0.75rem)] opacity-0',
        )}
        ref={mobileFilterRef}
      >
        <div className="grid min-w-0 grid-cols-[minmax(3.8rem,0.52fr)_minmax(4.4rem,0.56fr)_minmax(3.8rem,0.46fr)_minmax(2.6rem,auto)] items-end gap-1.5">
          <CompactFilterField label="날짜">
            <CompactDateInput
              value={selectedDate}
              onChange={updateSelectedDate}
            />
          </CompactFilterField>
          <CompactFilterField label="판매처">
            <VendorMultiSelect
              compact
              dropdownAlign="left"
              options={vendorOptions}
              selectedValues={vendors}
              onChange={updateVendors}
            />
          </CompactFilterField>
          <CompactFilterField label="국가">
            <CountryMultiSelect
              compact
              options={countryOptions}
              selectedValues={countries}
              onChange={updateCountries}
            />
          </CompactFilterField>
          <CompactFilterField label="품절">
            <CompactSoldOutToggle
              checked={excludeSoldOut}
              onChange={setExcludeSoldOut}
            />
          </CompactFilterField>
        </div>
      </section>

      <Panel
        title="조회 조건"
        className="relative z-20 hidden py-4 md:block md:p-3 md:[&>header]:hidden"
      >
        <div className="grid items-end gap-2.5 md:grid-cols-[minmax(132px,0.72fr)_minmax(190px,1fr)_minmax(170px,0.82fr)_minmax(142px,0.62fr)] md:[&>div>span:first-child]:hidden md:[&>label>span:first-child]:hidden max-md:grid-cols-1 max-md:[&>div>span:first-child]:inline max-md:[&>label>span:first-child]:inline">
          <LabeledField label="기준일">
            <input
              className={inputControlClass}
              type="date"
              value={selectedDate}
              onChange={(event) => updateSelectedDate(event.target.value)}
            />
          </LabeledField>

          <LabeledField label="판매처" as="div">
            <VendorMultiSelect
              options={vendorOptions}
              selectedValues={vendors}
              onChange={updateVendors}
            />
          </LabeledField>

          <LabeledField label="국가" as="div">
            <CountryMultiSelect
              options={countryOptions}
              selectedValues={countries}
              onChange={updateCountries}
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

      <Panel
        title="종합 시세판"
        className="relative z-0 overflow-hidden md:p-3 md:[&>header]:mb-2 md:[&>header]:pb-2"
      >
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
                  <header className="flex items-end justify-between gap-3 border-b border-bushiri-ink/15 pb-2 md:hidden">
                    <h3 className="m-0 text-base font-extrabold leading-tight text-bushiri-ink">
                      {section.label}
                    </h3>
                    <span className="text-xs font-bold text-bushiri-muted">
                      {formatNumber(section.rows.length)}종
                    </span>
                  </header>

                  <div className="hidden min-w-0 md:block">
                    <VendorAxisBoard
                      section={section}
                    />
                  </div>

                  <div className="rounded-lg border border-bushiri-ink/15 bg-bushiri-surface/95 md:hidden" aria-label={`${section.label} 어종별 최저가 시세판`}>
                    <div
                      className={cn(
                        'sticky top-0 z-[2] grid items-center gap-3 border-b border-bushiri-ink/15 bg-bushiri-surface-muted p-3 text-[0.76rem] font-extrabold text-bushiri-muted',
                        showSpeciesCountryFlag
                          ? 'grid-cols-[88px_minmax(0,1fr)]'
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
                          <div
                            className={cn(
                              'grid w-full items-center gap-3 bg-bushiri-surface/90 p-3 text-left text-bushiri-ink transition hover:bg-white focus-visible:bg-white focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-bushiri-primary active:translate-y-px',
                              showSpeciesCountryFlag
                                ? 'grid-cols-[88px_minmax(0,1fr)]'
                                : 'grid-cols-[76px_minmax(0,1fr)]',
                              isExpanded ? 'bg-white' : '',
                            )}
                          >
                            <div className="min-w-0 text-left">
                              <SpeciesLabel row={row} showCountryFlag={showSpeciesCountryFlag} />
                            </div>
                            <button
                              aria-expanded={isExpanded}
                              aria-label={`${row.canonicalName} 판매처별 시세 ${isExpanded ? '접기' : '펼치기'}`}
                              className="flex min-w-0 flex-wrap items-baseline gap-2 rounded-md text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px"
                              onClick={() => toggleSpecies(row.key)}
                              type="button"
                            >
                              {lowest ? (
                                <>
                                  <span className="max-w-[12ch] overflow-hidden text-ellipsis whitespace-nowrap text-[0.86rem] font-extrabold text-bushiri-muted">
                                    {lowest.vendor}
                                  </span>
                                  <strong className="font-mono text-lg font-extrabold leading-none text-bushiri-ink tabular-nums">
                                    {formatKgManwonPrice(lowest.listing.price)}
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
                            </button>
                          </div>
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
