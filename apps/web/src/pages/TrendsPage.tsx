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
  filterSpeciesOptions,
  pickDefaultSpecies,
  type TrendReferenceBadge,
  type TrendSeries,
} from '../lib/trends'
import {
  formatCurrency,
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
  SelectControl,
  inputControlClass,
} from '../components/ui'
import { bushiriColors, trendChartColors } from '../lib/designSystem'

const DAY_OPTIONS = [14, 30, 60, 90]

function getSeriesColor(index: number) {
  return trendChartColors[index % trendChartColors.length]
}

function compactWon(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '—'
  }

  if (value >= 10000) {
    const manwon = value / 10000
    return `${manwon % 1 === 0 ? manwon.toFixed(0) : manwon.toFixed(1)}만`
  }

  return formatNumber(value)
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
                {formatCurrency(value)}
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
            tickFormatter={(value) => compactWon(Number(value))}
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
                  {formatCurrency(entry.latestValue)}
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
  const [speciesQuery, setSpeciesQuery] = useState('')
  const [days, setDays] = useState(30)
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
  const filteredSpeciesOptions = useMemo(
    () => filterSpeciesOptions(speciesOptions, speciesQuery),
    [speciesOptions, speciesQuery],
  )
  const shouldShowSelectedOption =
    canonicalName.trim() &&
    !filteredSpeciesOptions.some((option) => option.value === canonicalName)

  useEffect(() => {
    if (!canonicalName.trim()) {
      setCanonicalName(pickDefaultSpecies(speciesOptions))
    }
  }, [canonicalName, speciesOptions])

  useEffect(() => {
    setSeriesSelectionTouched(false)
    setVisibleSeriesKeys([])
    setHoveredSeriesKey(null)
  }, [canonicalName, days])

  const points = trend.data?.points ?? []
  const comparison = useMemo(() => buildTrendComparison(points), [points])
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
        <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.5fr)_minmax(0,0.9fr)] items-end gap-3 max-xl:grid-cols-2 max-md:grid-cols-1">
          <LabeledField label="어종 검색">
            <input
              className={inputControlClass}
              type="search"
              value={speciesQuery}
              onChange={(event) => setSpeciesQuery(event.target.value)}
              placeholder="예: 광어, 킹크랩, 연어"
            />
          </LabeledField>

          <LabeledField label="기준 어종" as="div">
            <SelectControl
              ariaLabel="기준 어종"
              value={canonicalName}
              onChange={setCanonicalName}
              options={[
                ...(shouldShowSelectedOption
                  ? [{ value: canonicalName, label: canonicalName }]
                  : []),
                ...filteredSpeciesOptions.map((option) => ({
                  value: option.value,
                  label: option.label,
                })),
              ]}
            />
            {filteredSpeciesOptions.length === 0 ? (
              <small className="text-[0.76rem] leading-snug text-bushiri-warning">
                검색 결과가 없으면 검색어를 지우고 다시 선택해 주세요.
              </small>
            ) : null}
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

          <div className="grid min-h-10 content-center rounded-lg border border-bushiri-line bg-bushiri-surface-muted px-3 py-2">
            <span className="text-[0.78rem] font-extrabold text-bushiri-muted">비교 기준</span>
            <strong className="text-sm font-extrabold text-bushiri-ink">
              판매처 → 원산지
            </strong>
          </div>
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
              : `${compactWon(latestLowest)}~${compactWon(latestHighest)}`
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
                render: (row) => formatCurrency(row.value, row.currency),
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
