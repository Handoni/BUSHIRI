import { useMemo } from 'react'
import {
  getAdminSources,
  getSourceStatuses,
  type SourceStatusItem,
} from '../lib/api'
import { formatDate, formatNumber } from '../lib/format'
import { useResource } from '../hooks/useResource'
import {
  Badge,
  Button,
  DataTable,
  ErrorState,
  JsonDetails,
  LoadingBlock,
  MetricCard,
  MetricGrid,
  PageHeader,
  Panel,
} from '../components/ui'

function getStatusSignalTone(status: string) {
  const normalized = status.toLowerCase()

  if (normalized.includes('ok') || normalized.includes('healthy') || normalized.includes('사용')) {
    return 'success' as const
  }

  if (normalized.includes('fail') || normalized.includes('error') || normalized.includes('중지')) {
    return 'danger' as const
  }

  return 'warning' as const
}

export function SettingsPage() {
  const configs = useResource(() => getAdminSources(), [])
  const statuses = useResource(() => getSourceStatuses(), [])

  const mergedRows = useMemo(() => {
    const statusByKey = new Map<string, SourceStatusItem>()

    ;(statuses.data ?? []).forEach((item) => {
      statusByKey.set(item.id, item)
      statusByKey.set(item.name, item)
    })

    return (configs.data ?? []).map((config) => {
      const status = statusByKey.get(config.id) ?? statusByKey.get(config.name)

      return {
        ...config,
        statusSignal: status?.status ?? '응답 없음',
        statusSeenAt: status?.lastSeen ?? null,
        statusDetail: status?.detail ?? '상태 응답 참고값 없음',
        hasStatusSignal: status != null,
      }
    })
  }, [configs.data, statuses.data])

  const matchedStatusCount = mergedRows.filter((row) => row.hasStatusSignal).length
  const configEnabledCount = (configs.data ?? []).filter((item) => item.enabled !== false).length
  const statusOnlyCount = Math.max((statuses.data?.length ?? 0) - matchedStatusCount, 0)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="소스 운영"
        title="소스 설정"
        actions={
          <Button
            onClick={() => {
              void configs.refresh()
              void statuses.refresh()
            }}
          >
            설정 다시 불러오기
          </Button>
        }
      />

      <MetricGrid>
        <MetricCard
          label="설정 소스"
          value={formatNumber(configs.data?.length ?? 0)}
        />
        <MetricCard
          label="설정 사용"
          value={formatNumber(configEnabledCount)}
        />
        <MetricCard
          label="상태 응답 연결"
          value={formatNumber(matchedStatusCount)}
        />
        <MetricCard
          label="상태만 있는 항목"
          value={formatNumber(statusOnlyCount)}
        />
      </MetricGrid>

      <Panel
        title="소스 인벤토리"
      >
        {configs.isLoading || statuses.isLoading ? <LoadingBlock rows={6} /> : null}
        {configs.error ? (
          <ErrorState title="소스 설정 목록을 불러오지 못했습니다" description={configs.error} />
        ) : null}
        {statuses.error ? (
          <ErrorState title="소스 상태 응답을 불러오지 못했습니다" description={statuses.error} />
        ) : null}
        {!configs.isLoading && !statuses.isLoading && !configs.error && !statuses.error ? (
          <DataTable
            columns={[
              {
                key: 'name',
                header: '소스명',
                render: (row) => <strong>{row.name}</strong>,
              },
              {
                key: 'market',
                header: '판매처 구분',
                render: (row) => row.market,
              },
              {
                key: 'cadence',
                header: '수집 방식',
                render: (row) => row.cadence,
              },
              {
                key: 'statusSignal',
                header: '상태 응답 참고',
                render: (row) => (
                  <div>
                    <Badge label={row.statusSignal} tone={getStatusSignalTone(row.statusSignal)} />
                    <small className="mt-2 block text-xs leading-snug text-bushiri-muted">{row.statusDetail}</small>
                  </div>
                ),
              },
              {
                key: 'statusSeenAt',
                header: '상태 응답 시각',
                render: (row) => formatDate(row.statusSeenAt),
              },
              {
                key: 'enabled',
                header: '설정 사용',
                render: (row) =>
                  row.enabled == null ? '표기 없음' : row.enabled ? '사용' : '중지',
              },
              {
                key: 'endpoint',
                header: '밴드키 / 가격 표기',
                render: (row) => (
                  <div className="flex flex-col gap-2">
                    <span className="break-words text-sm font-bold text-bushiri-primary">{row.endpoint}</span>
                    <small className="text-xs leading-snug text-bushiri-muted">{row.notes}</small>
                    <JsonDetails value={row.raw} />
                  </div>
                ),
              },
            ]}
            rows={mergedRows}
            emptyTitle="표시할 소스 설정이 없습니다"
            emptyDescription="소스 응답을 기다리는 중입니다."
          />
        ) : null}
      </Panel>
    </div>
  )
}
