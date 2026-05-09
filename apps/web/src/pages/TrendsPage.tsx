import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import { getSpeciesTrend, getTodayMarket } from '../lib/api'
import {
  buildSpeciesOptions,
  buildTrendChartRows,
  buildTrendComparison,
  pickDefaultSpecies,
  type TrendReferenceBadge,
  type TrendSeries,
} from '../lib/trends'
import {
  formatKgManwonPrice,
  formatKgManwonPriceRange,
  formatNumber,
  formatPercent,
} from '../lib/format'
import { useResource } from '../hooks/useResource'
import {
  Badge,
  Button,
  CheckboxControl,
  cn,
  DataTable,
  EmptyState,
  ErrorState,
  LabeledField,
  LoadingBlock,
  MetricCard,
  MetricGrid,
  Panel,
  SearchCombobox,
  SelectControl,
} from '../components/ui'
import { bushiriColors, trendChartColors } from '../lib/designSystem'

const DAY_OPTIONS = [14, 30, 60, 90]
const EMPTY_ORIGIN_VALUE = '__origin-empty__'
const EMPTY_CLASSIFICATION_VALUE = '__classification-empty__'
const UNKNOWN_ORIGIN_LABEL = '원산지 미상'
const UNKNOWN_CLASSIFICATION_LABEL = '분류 미상'
const COUNTRY_ORDER = ['국내산', '일본산', '중국산', '노르웨이', '러시아']
const COUNTRY_FLAG_BY_NAME: Record<string, string> = {
  국내산: '🇰🇷',
  일본산: '🇯🇵',
  중국산: '🇨🇳',
  노르웨이: '🇳🇴',
  러시아: '🇷🇺',
}

function getSeriesColor(index: number) {
  return trendChartColors[index % trendChartColors.length]
}

function formatTrendDate(value: string | null | undefined) {
  if (!value) {
    return '—'
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : value.slice(0, 10)
}

function trendTone(value: number | null) {
  if (value == null) {
    return 'neutral' as const
  }

  if (value < 0) {
    return 'success' as const
  }

  if (value > 0) {
    return 'danger' as const
  }

  return 'neutral' as const
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function getRawCandidate(raw: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in raw && raw[key] != null) {
      return raw[key]
    }
  }

  return null
}

function countryLabel(country: string) {
  return `${COUNTRY_FLAG_BY_NAME[country] ?? '•'} ${country}`
}

function originCountryForPoint(point: { raw: unknown }): string {
  const raw = isRecord(point.raw) ? point.raw : {}

  return (
    stringValue(getRawCandidate(raw, ['originCountry', 'origin_country'])) ??
    stringValue(getRawCandidate(raw, ['origin'])) ??
    UNKNOWN_ORIGIN_LABEL
  )
}

function classificationForPoint(point: { raw: unknown }): string {
  const raw = isRecord(point.raw) ? point.raw : {}
  const originDetail = stringValue(getRawCandidate(raw, ['originDetail', 'origin_detail']))

  if (originDetail) {
    return originDetail
  }

  const haystack = [
    getRawCandidate(raw, ['displayName', 'display_name']),
    getRawCandidate(raw, ['grade']),
    getRawCandidate(raw, ['notes', 'description', 'detail']),
  ]
    .map(stringValue)
    .filter((value): value is string => value !== null)
    .join(' ')

  if (haystack.includes('낚시바리')) {
    return '낚시바리'
  }

  const productionType = stringValue(getRawCandidate(raw, ['productionType', 'production_type']))

  if (productionType) {
    return productionType
  }

  return UNKNOWN_CLASSIFICATION_LABEL
}

function originSortValue(origin: string) {
  const knownIndex = COUNTRY_ORDER.indexOf(origin)

  return knownIndex === -1 ? COUNTRY_ORDER.length : knownIndex
}

function classificationPriority(value: string) {
  if (value === '낚시바리') {
    return 0
  }

  if (value === '자연산') {
    return 1
  }

  if (value.endsWith('산') && !COUNTRY_ORDER.includes(value)) {
    return 2
  }

  if (value === '양식') {
    return 3
  }

  if (value === UNKNOWN_CLASSIFICATION_LABEL) {
    return 5
  }

  return 4
}

function buildOriginOptions(points: Array<{ raw: unknown }>) {
  return Array.from(new Set(points.map(originCountryForPoint)))
    .sort((left, right) => {
      const leftOrder = originSortValue(left)
      const rightOrder = originSortValue(right)

      return leftOrder === rightOrder ? left.localeCompare(right, 'ko') : leftOrder - rightOrder
    })
    .map((origin) => ({
      value: origin,
      label: countryLabel(origin),
    }))
}

function buildClassificationOptions(points: Array<{ raw: unknown }>) {
  return Array.from(new Set(points.map(classificationForPoint)))
    .sort((left, right) => {
      const leftOrder = classificationPriority(left)
      const rightOrder = classificationPriority(right)

      return leftOrder === rightOrder ? left.localeCompare(right, 'ko') : leftOrder - rightOrder
    })
    .map((classification) => ({
      value: classification,
      label: classification,
    }))
}

function resolveSelectedValue(
  selectedValue: string,
  options: Array<{ value: string }>,
  emptyValue: string,
) {
  if (options.length === 0) {
    return emptyValue
  }

  if (options.some((option) => option.value === selectedValue)) {
    return selectedValue
  }

  return options[0]?.value ?? emptyValue
}

function TrendChartTooltip({
  active,
  payload,
  seriesByKey,
}: TooltipContentProps & {
  seriesByKey: Map<string, TrendSeries>
}) {
  if (!active || !payload?.length) {
    return null
  }

  const date = String(payload[0]?.payload?.date ?? payload[0]?.payload?.label ?? '—')
  const entries = payload.flatMap((item) => {
    const dataKey = item.dataKey == null ? null : String(item.dataKey)
    const value = typeof item.value === 'number' ? item.value : Number(item.value)
    const entry = dataKey ? seriesByKey.get(dataKey) : null

    if (!entry || !Number.isFinite(value)) {
      return []
    }

    return [
      {
        color: item.color ?? bushiriColors.primary,
        entry,
        value,
      },
    ]
  })

  if (entries.length === 0) {
    return null
  }

  return (
    <div className="min-w-64 rounded-lg border border-bushiri-line bg-bushiri-surface p-3 shadow-bushiri-popover">
      <div className="mb-2 flex items-baseline justify-between gap-4 border-b border-bushiri-line pb-2">
        <strong className="text-sm font-extrabold text-bushiri-ink">{formatTrendDate(date)}</strong>
        <span className="text-[0.74rem] font-bold text-bushiri-muted">KG당 가격</span>
      </div>
      <div className="grid gap-2">
        {entries.map(({ color, entry, value }) => (
          <div className="grid gap-1" key={entry.key}>
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: color } as CSSProperties}
                />
                <strong className="truncate text-sm font-extrabold text-bushiri-ink">
                  {entry.vendor}
                </strong>
              </span>
              <strong className="font-mono text-sm font-extrabold tabular-nums text-bushiri-ink">
                {formatKgManwonPrice(value)}
              </strong>
            </div>
            <p className="m-0 text-[0.78rem] leading-snug text-bushiri-muted">
              {entry.origin} · {formatPercent(entry.changePercent)}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function TrendLineChart({
  series,
  visibleSeriesKeys,
  hoveredSeriesKey,
  onHoverSeries,
}: {
  series: TrendSeries[]
  visibleSeriesKeys: string[]
  hoveredSeriesKey: string | null
  onHoverSeries: (key: string | null) => void
}) {
  const visibleKeySet = useMemo(() => new Set(visibleSeriesKeys), [visibleSeriesKeys])
  const visibleSeries = useMemo(
    () => series.filter((entry) => visibleKeySet.has(entry.key)),
    [series, visibleKeySet],
  )
  const chartRows = useMemo(
    () => buildTrendChartRows(series, visibleSeriesKeys),
    [series, visibleSeriesKeys],
  )
  const seriesByKey = useMemo(
    () => new Map(series.map((entry) => [entry.key, entry])),
    [series],
  )
  const values = visibleSeries.flatMap((entry) => entry.points.map((point) => point.value))

  if (series.length === 0) {
    return (
      <EmptyState
        title="표시할 가격선이 없습니다"
        description="가격이 있는 관측값이 들어오면 조건별 라인이 표시됩니다."
      />
    )
  }

  if (visibleSeries.length === 0 || chartRows.length === 0 || values.length === 0) {
    return (
      <EmptyState
        title="선택된 가격선이 없습니다"
        description="오른쪽 비교 라인에서 표시할 조건을 체크해 주세요."
      />
    )
  }

  const minValue = Math.min(...values)
  const maxValue = Math.max(...values)
  const spread = Math.max(maxValue - minValue, 1)
  const lower = Math.max(0, minValue - spread * 0.1)
  const upper = maxValue + spread * 0.1

  return (
    <div
      aria-label="조건별 시세 라인 차트"
      className="h-[390px] overflow-hidden rounded-lg border border-bushiri-line bg-bushiri-surface px-2 py-3"
      role="img"
    >
      <ResponsiveContainer height="100%" width="100%">
        <LineChart
          data={chartRows}
          margin={{ top: 20, right: 28, bottom: 8, left: 4 }}
          onMouseLeave={() => onHoverSeries(null)}
        >
          <CartesianGrid stroke={bushiriColors.line} strokeDasharray="3 5" vertical={false} />
          <XAxis
            axisLine={false}
            dataKey="label"
            minTickGap={18}
            tick={{ fill: bushiriColors.muted, fontSize: 12, fontWeight: 700 }}
            tickLine={false}
          />
          <YAxis
            axisLine={false}
            domain={[lower, upper]}
            tick={{ fill: bushiriColors.muted, fontSize: 12, fontWeight: 700 }}
            tickFormatter={(value) => formatKgManwonPrice(Number(value))}
            tickLine={false}
            width={70}
          />
          <Tooltip
            content={(props) => (
              <TrendChartTooltip {...props} seriesByKey={seriesByKey} />
            )}
            cursor={{ stroke: bushiriColors.primary, strokeOpacity: 0.18, strokeWidth: 2 }}
          />
          {visibleSeries.map((entry) => {
            const index = series.findIndex((candidate) => candidate.key === entry.key)
            const color = getSeriesColor(index < 0 ? 0 : index)
            const dimmed = hoveredSeriesKey !== null && hoveredSeriesKey !== entry.key

            return (
              <Line
                activeDot={{ r: 6, strokeWidth: 2 }}
                connectNulls
                dataKey={entry.key}
                dot={{ r: 3.5, strokeWidth: 2 }}
                isAnimationActive={false}
                key={entry.key}
                name={entry.label}
                onMouseEnter={() => onHoverSeries(entry.key)}
                onMouseLeave={() => onHoverSeries(null)}
                stroke={color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={dimmed ? 0.18 : 1}
                strokeWidth={hoveredSeriesKey === entry.key ? 4 : 2.6}
                type="monotone"
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function SeriesList({
  series,
  visibleSeriesKeys,
  hoveredSeriesKey,
  onToggleSeries,
  onHoverSeries,
  onSelectAll,
  onClearAll,
}: {
  series: TrendSeries[]
  visibleSeriesKeys: string[]
  hoveredSeriesKey: string | null
  onToggleSeries: (key: string, checked: boolean) => void
  onHoverSeries: (key: string | null) => void
  onSelectAll: () => void
  onClearAll: () => void
}) {
  if (series.length === 0) {
    return (
      <EmptyState
        title="비교 라인이 없습니다"
        description="판매처와 원산지가 있는 관측값을 기다리는 중입니다."
      />
    )
  }

  const visibleKeySet = new Set(visibleSeriesKeys)

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-bushiri-line bg-bushiri-surface-muted px-3 py-2">
        <span className="text-[0.78rem] font-extrabold text-bushiri-muted">
          {visibleSeriesKeys.length}/{series.length}개 표시
        </span>
        <div className="flex gap-1.5">
          <button
            className="rounded-md border border-bushiri-line bg-bushiri-surface px-2.5 py-1 text-xs font-extrabold text-bushiri-ink transition hover:border-bushiri-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary"
            onClick={onSelectAll}
            type="button"
          >
            전체
          </button>
          <button
            className="rounded-md border border-bushiri-line bg-bushiri-surface px-2.5 py-1 text-xs font-extrabold text-bushiri-ink transition hover:border-bushiri-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary"
            onClick={onClearAll}
            type="button"
          >
            숨김
          </button>
        </div>
      </div>

      <div className="max-h-[432px] overflow-auto rounded-lg border border-bushiri-line bg-bushiri-surface">
        {series.map((entry, index) => {
          const color = getSeriesColor(index)
          const checked = visibleKeySet.has(entry.key)
          const highlighted = hoveredSeriesKey === entry.key

          return (
            <label
              className={cn(
                'grid cursor-pointer gap-2 border-b border-bushiri-line p-3 transition last:border-b-0 hover:bg-bushiri-surface-muted',
                checked ? 'opacity-100' : 'opacity-55',
                highlighted ? 'bg-bushiri-primary/8 ring-1 ring-inset ring-bushiri-primary/25' : '',
              )}
              key={entry.key}
              onMouseEnter={() => onHoverSeries(entry.key)}
              onMouseLeave={() => onHoverSeries(null)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <CheckboxControl
                    checked={checked}
                    label={`${entry.label} 표시`}
                    onChange={(nextChecked) => onToggleSeries(entry.key, nextChecked)}
                  />
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-sm"
                    style={{ backgroundColor: color } as CSSProperties}
                  />
                  <strong className="truncate text-sm font-extrabold text-bushiri-ink">
                    {entry.vendor}
                  </strong>
                </div>
                <strong className="font-mono text-sm font-extrabold tabular-nums text-bushiri-ink">
                  {formatKgManwonPrice(entry.latestValue)}
                </strong>
              </div>
              <p className="m-0 text-[0.82rem] leading-snug text-bushiri-muted">
                {entry.origin}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge label={formatPercent(entry.changePercent)} tone={trendTone(entry.changePercent)} />
                <Badge label={`${entry.pointCount}건`} />
                <Badge label={formatTrendDate(entry.lastDate)} />
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

function ReferenceBadgeList({ badges }: { badges: TrendReferenceBadge[] }) {
  if (badges.length === 0) {
    return <span className="text-bushiri-muted">—</span>
  }

  return (
    <div className="flex max-w-[28rem] flex-wrap gap-1.5">
      {badges.map((badge) => (
        <span
          className="inline-flex max-w-[14rem] items-center rounded-full border border-bushiri-line bg-bushiri-surface-muted px-2 py-1 text-xs font-bold leading-tight text-bushiri-muted"
          key={`${badge.key}-${badge.label}`}
          title={badge.label}
        >
          <span className="truncate">{badge.label}</span>
        </span>
      ))}
    </div>
  )
}

export function TrendsPage() {
  const [canonicalName, setCanonicalName] = useState(() => pickDefaultSpecies([]))
  const [speciesInput, setSpeciesInput] = useState(() => pickDefaultSpecies([]))
  const [days, setDays] = useState(30)
  const [selectedOrigin, setSelectedOrigin] = useState('')
  const [selectedClassification, setSelectedClassification] = useState('')
  const [visibleSeriesKeys, setVisibleSeriesKeys] = useState<string[]>([])
  const [seriesSelectionTouched, setSeriesSelectionTouched] = useState(false)
  const [hoveredSeriesKey, setHoveredSeriesKey] = useState<string | null>(null)
  const market = useResource(() => getTodayMarket(), [])
  const trend = useResource(
    () =>
      canonicalName.trim()
        ? getSpeciesTrend(canonicalName.trim(), days)
        : Promise.resolve({
            canonicalName: '',
            species: '',
            points: [],
            currency: 'KRW',
          }),
    [canonicalName, days],
  )

  const speciesOptions = useMemo(
    () => buildSpeciesOptions(market.data?.rows ?? []),
    [market.data?.rows],
  )
  const shouldShowSelectedOption =
    canonicalName.trim() &&
    !speciesOptions.some((option) => option.value === canonicalName)
  const speciesComboboxOptions = useMemo(
    () => [
      ...(shouldShowSelectedOption
        ? [{ value: canonicalName, label: canonicalName, searchText: canonicalName }]
        : []),
      ...speciesOptions,
    ],
    [canonicalName, shouldShowSelectedOption, speciesOptions],
  )

  useEffect(() => {
    if (!canonicalName.trim()) {
      const nextSpecies = pickDefaultSpecies(speciesOptions)

      setCanonicalName(nextSpecies)
      setSpeciesInput(nextSpecies)
    }
  }, [canonicalName, speciesOptions])

  useEffect(() => {
    setSeriesSelectionTouched(false)
    setVisibleSeriesKeys([])
    setHoveredSeriesKey(null)
    setSelectedOrigin('')
    setSelectedClassification('')
  }, [canonicalName, days])

  const points = trend.data?.points ?? []
  const originOptions = useMemo(() => buildOriginOptions(points), [points])
  const effectiveOrigin = useMemo(
    () => resolveSelectedValue(selectedOrigin, originOptions, EMPTY_ORIGIN_VALUE),
    [originOptions, selectedOrigin],
  )
  const originFilteredPoints = useMemo(
    () =>
      effectiveOrigin === EMPTY_ORIGIN_VALUE
        ? []
        : points.filter((point) => originCountryForPoint(point) === effectiveOrigin),
    [effectiveOrigin, points],
  )
  const classificationOptions = useMemo(
    () => buildClassificationOptions(originFilteredPoints),
    [originFilteredPoints],
  )
  const effectiveClassification = useMemo(
    () =>
      resolveSelectedValue(
        selectedClassification,
        classificationOptions,
        EMPTY_CLASSIFICATION_VALUE,
      ),
    [classificationOptions, selectedClassification],
  )
  const filteredPoints = useMemo(
    () =>
      effectiveClassification === EMPTY_CLASSIFICATION_VALUE
        ? []
        : originFilteredPoints.filter(
            (point) => classificationForPoint(point) === effectiveClassification,
          ),
    [effectiveClassification, originFilteredPoints],
  )
  const comparison = useMemo(() => buildTrendComparison(filteredPoints), [filteredPoints])
  const allSeriesKeys = useMemo(
    () => comparison.series.map((entry) => entry.key),
    [comparison.series],
  )
  const effectiveVisibleSeriesKeys = useMemo(() => {
    if (!seriesSelectionTouched) {
      return allSeriesKeys
    }

    const availableKeys = new Set(allSeriesKeys)

    return visibleSeriesKeys.filter((key) => availableKeys.has(key))
  }, [allSeriesKeys, seriesSelectionTouched, visibleSeriesKeys])
  const latestValues = comparison.series
    .map((entry) => entry.latestValue)
    .filter((value): value is number => value !== null)
  const latestLowest = latestValues.length > 0 ? Math.min(...latestValues) : null
  const latestHighest = latestValues.length > 0 ? Math.max(...latestValues) : null
  const observedDateCount = new Set(
    comparison.series.flatMap((entry) => entry.points.map((point) => point.date)),
  ).size
  const vendorCount = new Set(comparison.series.map((entry) => entry.vendor)).size
  const handleSpeciesInputChange = (nextValue: string) => {
    setSpeciesInput(nextValue)

    if (speciesOptions.some((option) => option.value === nextValue)) {
      setCanonicalName(nextValue)
    }
  }
  const handleOriginChange = (nextOrigin: string) => {
    setSelectedOrigin(nextOrigin)
    setSelectedClassification('')
    setSeriesSelectionTouched(false)
    setVisibleSeriesKeys([])
    setHoveredSeriesKey(null)
  }
  const handleClassificationChange = (nextClassification: string) => {
    setSelectedClassification(nextClassification)
    setSeriesSelectionTouched(false)
    setVisibleSeriesKeys([])
    setHoveredSeriesKey(null)
  }
  const handleToggleSeries = (key: string, checked: boolean) => {
    setSeriesSelectionTouched(true)
    setVisibleSeriesKeys((current) => {
      const base = seriesSelectionTouched ? current : allSeriesKeys

      if (checked) {
        return Array.from(new Set([...base, key]))
      }

      return base.filter((entry) => entry !== key)
    })
  }
  const handleSelectAllSeries = () => {
    setSeriesSelectionTouched(true)
    setVisibleSeriesKeys(allSeriesKeys)
  }
  const handleClearAllSeries = () => {
    setSeriesSelectionTouched(true)
    setVisibleSeriesKeys([])
    setHoveredSeriesKey(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="조회 조건"
        className="py-4"
        actions={
          <Button
            onClick={() => {
              void market.refresh()
              void trend.refresh()
            }}
          >
            추이 새로고침
          </Button>
        }
      >
        <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_minmax(0,0.6fr)] items-end gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
          <LabeledField label="기준 어종" as="div">
            <SearchCombobox
              ariaLabel="기준 어종"
              emptyMessage="어종이 없습니다"
              options={speciesComboboxOptions.map((option) => ({
                value: option.value,
                label: option.label,
                searchText: option.searchText,
              }))}
              placeholder="예: 광어, 킹크랩, 연어"
              value={speciesInput}
              onChange={handleSpeciesInputChange}
            />
          </LabeledField>

          <LabeledField label="원산지" as="div">
            <SelectControl
              ariaLabel="원산지"
              value={effectiveOrigin}
              onChange={handleOriginChange}
              options={
                originOptions.length > 0
                  ? originOptions
                  : [{ value: EMPTY_ORIGIN_VALUE, label: '관측값 없음', disabled: true }]
              }
            />
          </LabeledField>

          <LabeledField label="분류" as="div">
            <SelectControl
              ariaLabel="분류"
              value={effectiveClassification}
              onChange={handleClassificationChange}
              options={
                classificationOptions.length > 0
                  ? classificationOptions
                  : [{ value: EMPTY_CLASSIFICATION_VALUE, label: '관측값 없음', disabled: true }]
              }
            />
          </LabeledField>

          <LabeledField label="조회 기간" as="div">
            <SelectControl
              ariaLabel="조회 기간"
              value={String(days)}
              onChange={(nextDays) => setDays(Number(nextDays))}
              options={DAY_OPTIONS.map((option) => ({
                value: String(option),
                label: `최근 ${option}일`,
              }))}
            />
          </LabeledField>
        </div>
      </Panel>

      <MetricGrid>
        <MetricCard label="비교 라인" value={formatNumber(comparison.series.length)} />
        <MetricCard label="판매처" value={formatNumber(vendorCount)} />
        <MetricCard label="관측 일자" value={formatNumber(observedDateCount)} />
        <MetricCard
          label="최근 가격대"
          value={
            latestLowest === null || latestHighest === null
              ? '—'
              : formatKgManwonPriceRange(latestLowest, latestHighest)
          }
        />
      </MetricGrid>

      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)] gap-4 max-xl:grid-cols-1">
        <Panel
          title="가격선"
          subtitle={comparison.dateLabels.length > 0 ? `${comparison.dateLabels[0]}부터 ${comparison.dateLabels[comparison.dateLabels.length - 1]}까지` : '관측값 대기'}
        >
          {trend.isLoading ? <LoadingBlock rows={6} /> : null}
          {trend.error ? (
            <ErrorState title="시세 추이를 불러오지 못했습니다" description={trend.error} />
          ) : null}
          {!trend.isLoading && !trend.error ? (
            <TrendLineChart
              hoveredSeriesKey={hoveredSeriesKey}
              onHoverSeries={setHoveredSeriesKey}
              series={comparison.series}
              visibleSeriesKeys={effectiveVisibleSeriesKeys}
            />
          ) : null}
        </Panel>

        <Panel
          title="비교 라인"
          subtitle="라인은 같은 판매처와 원산지의 일자별 최저 관측값으로 그립니다."
        >
          {trend.isLoading ? <LoadingBlock rows={5} /> : null}
          {trend.error ? (
            <ErrorState title="비교 라인을 만들지 못했습니다" description={trend.error} />
          ) : null}
          {!trend.isLoading && !trend.error ? (
            <SeriesList
              hoveredSeriesKey={hoveredSeriesKey}
              onClearAll={handleClearAllSeries}
              onHoverSeries={setHoveredSeriesKey}
              onSelectAll={handleSelectAllSeries}
              onToggleSeries={handleToggleSeries}
              series={comparison.series}
              visibleSeriesKeys={effectiveVisibleSeriesKeys}
            />
          ) : null}
        </Panel>
      </div>

      <Panel title="관측값">
        {trend.isLoading ? <LoadingBlock rows={6} /> : null}
        {trend.error ? (
          <ErrorState title="관측값을 불러오지 못했습니다" description={trend.error} />
        ) : null}
        {!trend.isLoading && !trend.error ? (
          <DataTable
            columns={[
              {
                key: 'date',
                header: '일자',
                render: (row) => formatTrendDate(row.date),
              },
              {
                key: 'vendor',
                header: '판매처',
                render: (row) => <strong>{row.vendor}</strong>,
              },
              {
                key: 'status',
                header: '상태',
                render: (row) => row.status,
              },
              {
                key: 'origin',
                header: '원산지',
                render: (row) => row.origin,
              },
              {
                key: 'value',
                header: 'kg당 가격',
                render: (row) => formatKgManwonPrice(row.value),
              },
              {
                key: 'referenceBadges',
                header: '참고값',
                render: (row) => <ReferenceBadgeList badges={row.referenceBadges} />,
              },
            ]}
            rows={comparison.rows}
            emptyTitle="선택한 어종의 추이 데이터가 없습니다"
            emptyDescription="어종을 바꾸거나 수집 데이터가 들어온 뒤 다시 확인해 주세요."
          />
        ) : null}
      </Panel>
    </div>
  )
}
