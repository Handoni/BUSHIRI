import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, Search } from 'lucide-react'
import { getSpeciesProfiles, type SpeciesProfile } from '../lib/api'
import { useResource } from '../hooks/useResource'
import {
  Badge,
  EmptyState,
  ErrorState,
  LoadingBlock,
  Panel,
  cn,
  inputControlClass,
  mutedTextClass,
} from '../components/ui'

const SPECIES_QUERY_KEY = 'species'

function normalizeSpeciesName(value: string | null | undefined) {
  const trimmed = value?.trim() ?? ''

  return trimmed === '황금광어' ? '광어' : trimmed
}

function readSelectedSpeciesFromUrl() {
  if (typeof window === 'undefined') {
    return ''
  }

  return normalizeSpeciesName(new URLSearchParams(window.location.search).get(SPECIES_QUERY_KEY))
}

export function navigateToSpeciesInfo(canonicalName: string) {
  if (typeof window === 'undefined') {
    return
  }

  const nextName = normalizeSpeciesName(canonicalName)
  const url = new URL(window.location.href)
  url.pathname = '/species-info'
  url.search = ''
  url.searchParams.set(SPECIES_QUERY_KEY, nextName)

  window.history.pushState({}, '', `${url.pathname}${url.search}`)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function sourceLabel(url: string, index: number) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')

    return host || `출처 ${index + 1}`
  } catch {
    return `출처 ${index + 1}`
  }
}

function SpeciesPhoto({ profile }: { profile: SpeciesProfile }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [profile.photoUrl])

  if (!profile.photoUrl || failed) {
    return (
      <div className="grid aspect-[4/3] min-h-64 place-items-center rounded-lg border border-dashed border-bushiri-line bg-bushiri-surface-muted text-sm font-bold text-bushiri-muted">
        사진 준비 중
      </div>
    )
  }

  return (
    <figure className="overflow-hidden rounded-lg border border-bushiri-line bg-bushiri-surface-muted">
      <img
        alt={`${profile.koreanName} 사진`}
        className="aspect-[4/3] w-full object-cover"
        loading="lazy"
        onError={() => setFailed(true)}
        src={profile.photoUrl}
      />
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-t border-bushiri-line px-3 py-2 text-[0.72rem] font-bold text-bushiri-muted">
        <span className="min-w-0 truncate">{profile.photoAttribution}</span>
        {profile.photoSourceUrl ? (
          <a
            className="inline-flex items-center gap-1 text-bushiri-primary transition hover:text-bushiri-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary"
            href={profile.photoSourceUrl}
            rel="noreferrer"
            target="_blank"
          >
            사진 원문
            <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />
          </a>
        ) : null}
      </figcaption>
    </figure>
  )
}

function DetailBlock({
  label,
  children,
}: {
  label: string
  children: string
}) {
  return (
    <section className="border-t border-bushiri-line pt-4">
      <h3 className="m-0 text-[0.78rem] font-extrabold uppercase tracking-normal text-bushiri-muted">
        {label}
      </h3>
      <p className="mt-2 text-[0.95rem] font-semibold leading-relaxed text-bushiri-ink">
        {children}
      </p>
    </section>
  )
}

function ProfileFacts({ profile }: { profile: SpeciesProfile }) {
  return (
    <div className="grid content-start gap-4">
      <div className="flex flex-wrap gap-2">
        <Badge label={`제철 ${profile.seasonMonths}`} tone="success" />
        {profile.category === 'salmon' ? <Badge label="연어류" tone="warning" /> : null}
      </div>

      <div className="grid gap-3 rounded-lg border border-bushiri-line bg-bushiri-surface-muted/55 p-4">
        {profile.englishName ? (
          <div>
            <span className="text-[0.72rem] font-extrabold text-bushiri-muted">영문명</span>
            <p className="mt-1 text-sm font-bold text-bushiri-ink">
              {profile.englishName}
            </p>
          </div>
        ) : null}
        {profile.aliases.length > 0 ? (
          <div>
          <span className="text-[0.72rem] font-extrabold text-bushiri-muted">다른 표기</span>
          <p className="mt-1 text-sm font-bold text-bushiri-ink">
            {profile.aliases.join(' · ')}
          </p>
          </div>
        ) : null}
      </div>

      <DetailBlock label="제철 메모">{profile.seasonNote}</DetailBlock>
      <DetailBlock label="시세판 중량">{profile.marketWeightNote}</DetailBlock>
    </div>
  )
}

function SpeciesList({
  profiles,
  activeName,
  query,
  onQueryChange,
  onSelect,
}: {
  profiles: SpeciesProfile[]
  activeName: string
  query: string
  onQueryChange: (query: string) => void
  onSelect: (canonicalName: string) => void
}) {
  const normalizedQuery = query.trim().toLowerCase()
  const visibleProfiles = normalizedQuery
    ? profiles.filter((profile) =>
        [
          profile.canonicalName,
          profile.koreanName,
          profile.englishName,
          ...profile.aliases,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : profiles

  return (
    <Panel title="어종 목록" subtitle={`${profiles.length}종 등록`} className="h-fit lg:sticky lg:top-5">
      <div className="relative">
        <input
          aria-label="어종 정보 검색"
          className={cn(inputControlClass, 'pr-10')}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="어종 검색"
          type="search"
          value={query}
        />
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-bushiri-muted"
          strokeWidth={2.4}
        />
      </div>

      <div className="mt-4 grid max-h-[min(68dvh,720px)] gap-1 overflow-auto pr-1">
        {visibleProfiles.length > 0 ? (
          visibleProfiles.map((profile) => {
            const active = profile.canonicalName === activeName

            return (
              <button
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'grid w-full gap-1 rounded-lg border px-3 py-3 text-left transition duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px',
                  active
                    ? 'border-bushiri-primary bg-bushiri-primary-soft text-bushiri-ink'
                    : 'border-transparent bg-transparent text-bushiri-ink hover:border-bushiri-line hover:bg-bushiri-surface-muted',
                )}
                key={profile.canonicalName}
                onClick={() => onSelect(profile.canonicalName)}
                type="button"
              >
                <span className="flex min-w-0 items-baseline justify-between gap-3">
                  <strong className="truncate text-[0.95rem] font-extrabold">
                    {profile.koreanName}
                  </strong>
                  <span className="shrink-0 text-[0.72rem] font-extrabold text-bushiri-primary">
                    {profile.seasonMonths}
                  </span>
                </span>
                {profile.englishName ? (
                  <span className="truncate text-[0.76rem] font-bold text-bushiri-muted">
                    {profile.englishName}
                  </span>
                ) : null}
              </button>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed border-bushiri-line bg-bushiri-surface-muted p-4 text-sm font-bold text-bushiri-muted">
            검색 결과가 없습니다
          </div>
        )}
      </div>
    </Panel>
  )
}

export function SpeciesInfoPage() {
  const profilesResource = useResource(getSpeciesProfiles, [])
  const [selectedName, setSelectedName] = useState(readSelectedSpeciesFromUrl)
  const [query, setQuery] = useState('')
  const profiles = profilesResource.data ?? []

  useEffect(() => {
    const syncSelection = () => setSelectedName(readSelectedSpeciesFromUrl())

    window.addEventListener('popstate', syncSelection)
    return () => window.removeEventListener('popstate', syncSelection)
  }, [])

  const activeProfile = useMemo(() => {
    const normalizedSelectedName = normalizeSpeciesName(selectedName)

    return (
      profiles.find((profile) => profile.canonicalName === normalizedSelectedName) ??
      profiles[0] ??
      null
    )
  }, [profiles, selectedName])

  function selectProfile(canonicalName: string) {
    setSelectedName(normalizeSpeciesName(canonicalName))
    navigateToSpeciesInfo(canonicalName)
  }

  if (profilesResource.isLoading) {
    return (
      <Panel title="어종 정보">
        <LoadingBlock rows={8} />
      </Panel>
    )
  }

  if (profilesResource.error) {
    return (
      <ErrorState
        title="어종 정보를 불러오지 못했습니다"
        description={profilesResource.error}
      />
    )
  }

  if (!activeProfile) {
    return (
      <EmptyState
        title="등록된 어종 정보가 없습니다"
        description="species_profiles 마이그레이션이 적용되면 어종 도감이 표시됩니다."
      />
    )
  }

  return (
    <div className="grid grid-cols-[300px_minmax(0,1fr)] gap-5 max-lg:grid-cols-1">
      <SpeciesList
        activeName={activeProfile.canonicalName}
        onQueryChange={setQuery}
        onSelect={selectProfile}
        profiles={profiles}
        query={query}
      />

      <Panel
        title={activeProfile.koreanName}
        subtitle={activeProfile.englishName ?? undefined}
      >
        <div className="grid grid-cols-[minmax(240px,0.92fr)_minmax(0,1.08fr)] gap-5 max-xl:grid-cols-1">
          <SpeciesPhoto profile={activeProfile} />
          <ProfileFacts profile={activeProfile} />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-5 max-xl:grid-cols-1">
          <DetailBlock label="서식">{activeProfile.habitatNote}</DetailBlock>
          <DetailBlock label="맛과 활용">{activeProfile.tasteNote}</DetailBlock>
          <DetailBlock label="구매 체크">{activeProfile.buyingNote}</DetailBlock>
        </div>

        <div className="mt-6 border-t border-bushiri-line pt-4">
          <h3 className="m-0 text-[0.78rem] font-extrabold uppercase tracking-normal text-bushiri-muted">
            자료 출처
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {[activeProfile.photoSourceUrl, ...activeProfile.infoSources]
              .filter((url, index, urls) => url && urls.indexOf(url) === index)
              .map((url, index) => (
                <a
                  className="inline-flex min-h-8 items-center gap-1 rounded-full border border-bushiri-line bg-bushiri-surface-muted px-3 text-xs font-extrabold text-bushiri-primary transition hover:-translate-y-px hover:bg-bushiri-primary-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary active:translate-y-px"
                  href={url}
                  key={url}
                  rel="noreferrer"
                  target="_blank"
                >
                  {sourceLabel(url, index)}
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={2.4} />
                </a>
              ))}
          </div>
          {activeProfile.photoLicense ? (
            <p className={cn('mt-3 text-[0.76rem] font-bold leading-relaxed', mutedTextClass)}>
              사진 라이선스: {activeProfile.photoLicense}
            </p>
          ) : null}
        </div>
      </Panel>
    </div>
  )
}
