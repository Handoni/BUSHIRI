import { useMemo, useState } from 'react'
import { getRawPosts, type RawPostItem } from '../lib/api'
import { formatDate, formatNumber, truncate } from '../lib/format'
import { useResource } from '../hooks/useResource'
import {
  Badge,
  Button,
  DataTable,
  ErrorState,
  JsonDetails,
  LabeledField,
  LoadingBlock,
  MetricCard,
  MetricGrid,
  PageHeader,
  Panel,
  SelectControl,
  inputControlClass,
} from '../components/ui'

function getStatusTone(status: string) {
  const normalized = status.toLowerCase()

  if (
    normalized.includes('ok') ||
    normalized.includes('success') ||
    normalized.includes('done') ||
    normalized.includes('complete') ||
    normalized.includes('완료')
  ) {
    return 'success' as const
  }

  if (normalized.includes('fail') || normalized.includes('error') || normalized.includes('실패')) {
    return 'danger' as const
  }

  if (
    normalized.includes('wait') ||
    normalized.includes('pending') ||
    normalized.includes('queue') ||
    normalized.includes('대기')
  ) {
    return 'warning' as const
  }

  return 'neutral' as const
}

export function MaskedRawPostPreview({
  row,
  isExpanded,
  onToggle,
}: {
  row: RawPostItem
  isExpanded: boolean
  onToggle: () => void
}) {
  const visibleText = isExpanded ? row.fullText : truncate(row.fullText, 180)
  const toggleLabel = isExpanded ? '전문 접기' : '전문 보기'

  return (
    <button
      aria-expanded={isExpanded}
      aria-label={`${row.source} 마스킹 원문 ${toggleLabel}`}
      className="flex w-full flex-col gap-2 rounded-md border border-bushiri-line bg-bushiri-surface p-3 text-left transition hover:outline-2 hover:outline-offset-2 hover:outline-bushiri-primary/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary/20"
      onClick={onToggle}
      type="button"
    >
      <p className={`m-0 whitespace-pre-wrap break-words leading-relaxed ${isExpanded ? 'text-bushiri-ink' : 'text-bushiri-muted'}`}>
        {visibleText}
      </p>
      <small className="text-xs font-extrabold text-bushiri-primary">{toggleLabel}</small>
    </button>
  )
}

export function RawPostsPage() {
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('전체')
  const [expandedPostIds, setExpandedPostIds] = useState<Set<string>>(() => new Set())
  const posts = useResource(() => getRawPosts(), [])

  const sourceOptions = useMemo(() => {
    const options = new Set((posts.data ?? []).map((item) => item.source))
    return ['전체', ...Array.from(options)]
  }, [posts.data])

  const filteredPosts = useMemo(() => {
    return (posts.data ?? []).filter((item) => {
      const matchesSource = source === '전체' || item.source === source
      const combined = `${item.source} ${item.status} ${item.parseError ?? ''} ${item.excerpt}`.toLowerCase()
      const matchesQuery = combined.includes(query.trim().toLowerCase())

      return matchesSource && matchesQuery
    })
  }, [posts.data, query, source])

  function toggleExpandedPost(postId: string) {
    setExpandedPostIds((current) => {
      const next = new Set(current)

      if (next.has(postId)) {
        next.delete(postId)
      } else {
        next.add(postId)
      }

      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="원문 운영"
        title="원문 검수"
        actions={<Button onClick={() => void posts.refresh()}>원문 새로고침</Button>}
      />

      <MetricGrid>
        <MetricCard
          label="원문 건수"
          value={formatNumber(posts.data?.length ?? 0)}
        />
        <MetricCard
          label="필터 반영"
          value={formatNumber(filteredPosts.length)}
        />
        <MetricCard
          label="판매처 수"
          value={formatNumber(new Set((posts.data ?? []).map((item) => item.source)).size)}
        />
        <MetricCard
          label="파싱 상태 수"
          value={formatNumber(new Set((posts.data ?? []).map((item) => item.status)).size)}
        />
      </MetricGrid>

      <Panel
        title="검수 목록"
        actions={
          <div className="grid grid-cols-2 gap-3 max-md:w-full max-md:grid-cols-1">
            <LabeledField label="검색">
              <input
                className={inputControlClass}
                placeholder="원문 또는 상태 검색"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </LabeledField>
            <LabeledField label="판매처" as="div">
              <SelectControl
                ariaLabel="판매처"
                value={source}
                onChange={setSource}
                options={sourceOptions.map((option) => ({
                  value: option,
                  label: option,
                }))}
              />
            </LabeledField>
          </div>
        }
      >
        {posts.isLoading ? <LoadingBlock rows={7} /> : null}
        {posts.error ? (
          <ErrorState title="원문 목록을 불러오지 못했습니다" description={posts.error} />
        ) : null}
        {!posts.isLoading && !posts.error ? (
          <DataTable
            columns={[
              {
                key: 'source',
                header: '판매처',
                render: (row) => <strong>{row.source}</strong>,
              },
              {
                key: 'excerpt',
                header: '마스킹 원문',
                render: (row) => (
                  <div className="min-w-[24rem]">
                    <MaskedRawPostPreview
                      isExpanded={expandedPostIds.has(row.id)}
                      onToggle={() => toggleExpandedPost(row.id)}
                      row={row}
                    />
                  </div>
                ),
              },
              {
                key: 'status',
                header: '파싱 상태',
                render: (row) => (
                  <div className="flex flex-col gap-2">
                    <Badge label={row.status} tone={getStatusTone(row.status)} />
                    {row.parseError ? (
                      <small className="text-xs leading-snug text-bushiri-muted">{row.parseError}</small>
                    ) : null}
                  </div>
                ),
              },
              {
                key: 'publishedAt',
                header: '게시 시각',
                render: (row) => formatDate(row.publishedAt),
              },
              {
                key: 'detail',
                header: '상세',
                render: (row) => (
                  <div className="flex flex-col gap-2">
                    {row.url ? (
                      <a className="font-bold text-bushiri-primary transition hover:-translate-y-px focus-visible:-translate-y-px" href={row.url} target="_blank" rel="noreferrer">
                        원문 열기
                      </a>
                    ) : null}
                    <JsonDetails value={row.raw} />
                  </div>
                ),
              },
            ]}
            rows={filteredPosts}
            emptyTitle="조건에 맞는 원문이 없습니다"
            emptyDescription="검색어나 판매처를 조정해 주세요."
          />
        ) : null}
      </Panel>
    </div>
  )
}
