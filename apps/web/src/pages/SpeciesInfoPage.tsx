import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ExternalLink, Pencil, Save, Search, X } from 'lucide-react'
import {
  getSpeciesProfiles,
  updateSpeciesProfile,
  type SpeciesProfile,
  type SpeciesProfilePatch,
} from '../lib/api'
import { hasAdminPermission, useAuthSession } from '../lib/auth'
import { useResource } from '../hooks/useResource'
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LabeledField,
  LoadingBlock,
  Panel,
  cn,
  inputControlClass,
  mutedTextClass,
} from '../components/ui'

const SPECIES_QUERY_KEY = 'species'
const textareaControlClass = cn(inputControlClass, 'min-h-28 resize-y py-2 leading-relaxed')

type SpeciesEditorState = {
  koreanName: string
  englishName: string
  aliasesText: string
  seasonMonths: string
  seasonNote: string
  weightNote: string
  habitatNote: string
  tasteNote: string
  buyingNote: string
  photoUrl: string
  photoSourceUrl: string
  photoAttribution: string
  photoLicense: string
  infoSourcesText: string
}

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

function createEditorState(profile: SpeciesProfile): SpeciesEditorState {
  return {
    koreanName: profile.koreanName,
    englishName: profile.englishName ?? '',
    aliasesText: profile.aliases.join(', '),
    seasonMonths: profile.seasonMonths,
    seasonNote: profile.seasonNote,
    weightNote: profile.weightNote,
    habitatNote: profile.habitatNote,
    tasteNote: profile.tasteNote,
    buyingNote: profile.buyingNote,
    photoUrl: profile.photoUrl,
    photoSourceUrl: profile.photoSourceUrl,
    photoAttribution: profile.photoAttribution,
    photoLicense: profile.photoLicense,
    infoSourcesText: profile.infoSources.join('\n'),
  }
}

function splitAliasText(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function splitLineText(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildProfilePatch(draft: SpeciesEditorState): SpeciesProfilePatch {
  return {
    koreanName: draft.koreanName.trim(),
    englishName: draft.englishName.trim() || null,
    aliases: splitAliasText(draft.aliasesText),
    seasonMonths: draft.seasonMonths.trim(),
    seasonNote: draft.seasonNote.trim(),
    weightNote: draft.weightNote.trim(),
    habitatNote: draft.habitatNote.trim(),
    tasteNote: draft.tasteNote.trim(),
    buyingNote: draft.buyingNote.trim(),
    photoUrl: draft.photoUrl.trim(),
    photoSourceUrl: draft.photoSourceUrl.trim(),
    photoAttribution: draft.photoAttribution.trim(),
    photoLicense: draft.photoLicense.trim(),
    infoSources: splitLineText(draft.infoSourcesText),
  }
}

function getDraftValidationError(draft: SpeciesEditorState) {
  const requiredFields: Array<[keyof SpeciesEditorState, string]> = [
    ['koreanName', '어종 이름'],
    ['seasonMonths', '제철'],
    ['seasonNote', '제철 메모'],
    ['weightNote', '중량'],
    ['habitatNote', '서식'],
    ['tasteNote', '맛과 활용'],
    ['buyingNote', '구매 체크'],
  ]

  const missingField = requiredFields.find(([key]) => !draft[key].trim())

  return missingField ? `${missingField[1]}은 비워둘 수 없습니다.` : null
}

function createPreviewProfile(profile: SpeciesProfile, draft: SpeciesEditorState): SpeciesProfile {
  return {
    ...profile,
    koreanName: draft.koreanName.trim() || profile.koreanName,
    englishName: draft.englishName.trim() || null,
    aliases: splitAliasText(draft.aliasesText),
    seasonMonths: draft.seasonMonths.trim() || profile.seasonMonths,
    seasonNote: draft.seasonNote,
    weightNote: draft.weightNote,
    habitatNote: draft.habitatNote,
    tasteNote: draft.tasteNote,
    buyingNote: draft.buyingNote,
    photoUrl: draft.photoUrl.trim(),
    photoSourceUrl: draft.photoSourceUrl.trim(),
    photoAttribution: draft.photoAttribution.trim(),
    photoLicense: draft.photoLicense.trim(),
    infoSources: splitLineText(draft.infoSourcesText),
  }
}

function SpeciesPhoto({
  disabled = false,
  onPhotoUrlChange,
  photoUrlValue,
  profile,
}: {
  disabled?: boolean
  onPhotoUrlChange?: (value: string) => void
  photoUrlValue?: string
  profile: SpeciesProfile
}) {
  const [failed, setFailed] = useState(false)
  const photoUrl = photoUrlValue ?? profile.photoUrl

  useEffect(() => {
    setFailed(false)
  }, [photoUrl])

  const content = !photoUrl || failed ? (
      <div className="grid aspect-[4/3] min-h-64 self-start place-items-center rounded-lg border border-dashed border-bushiri-line bg-bushiri-surface-muted text-sm font-bold text-bushiri-muted">
        사진 준비 중
      </div>
    ) : (
    <figure className="self-start overflow-hidden rounded-lg border border-bushiri-line bg-bushiri-surface-muted">
      <img
        alt={`${profile.koreanName} 사진`}
        className="block w-full h-auto"
        loading="lazy"
        onError={() => setFailed(true)}
        src={photoUrl}
      />
      <figcaption className="flex h-7 items-center justify-between gap-2 overflow-hidden border-t border-bushiri-line px-3 text-[0.72rem] font-bold leading-none text-bushiri-muted">
        <span className="min-w-0 flex-1 truncate">{profile.photoAttribution}</span>
        {profile.photoSourceUrl ? (
          <a
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-bushiri-primary transition hover:text-bushiri-primary-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bushiri-primary"
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

  if (!onPhotoUrlChange) {
    return content
  }

  return (
    <div className="grid gap-3">
      {content}
      <LabeledField label="사진 URL">
        <input
          className={inputControlClass}
          disabled={disabled}
          onChange={(event) => onPhotoUrlChange(event.target.value)}
          placeholder="https://..."
          type="url"
          value={photoUrlValue ?? ''}
        />
      </LabeledField>
    </div>
  )
}

function DetailBlock({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const textContent = typeof children === 'string'

  return (
    <section className="border-t border-bushiri-line pt-4">
      <h3 className="m-0 text-[0.78rem] font-extrabold uppercase tracking-normal text-bushiri-muted">
        {label}
      </h3>
      {textContent ? (
        <p className="mt-2 text-[0.95rem] font-semibold leading-relaxed text-bushiri-ink">
          {children}
        </p>
      ) : (
        <div className="mt-2">{children}</div>
      )}
    </section>
  )
}

function ProfileFacts({
  disabled = false,
  draft,
  onDraftChange,
  profile,
}: {
  disabled?: boolean
  draft?: SpeciesEditorState
  onDraftChange?: (key: keyof SpeciesEditorState, value: string) => void
  profile: SpeciesProfile
}) {
  if (draft && onDraftChange) {
    return (
      <div className="grid content-start gap-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <LabeledField label="제철">
            <input
              className={inputControlClass}
              disabled={disabled}
              onChange={(event) => onDraftChange('seasonMonths', event.target.value)}
              value={draft.seasonMonths}
            />
          </LabeledField>
          {profile.category === 'salmon' ? <Badge label="연어류" tone="warning" /> : null}
        </div>

        <div className="grid gap-3 rounded-lg border border-bushiri-line bg-bushiri-surface-muted/55 p-4">
          <LabeledField label="영문명">
            <input
              className={inputControlClass}
              disabled={disabled}
              onChange={(event) => onDraftChange('englishName', event.target.value)}
              value={draft.englishName}
            />
          </LabeledField>
          <LabeledField label="다른 표기">
            <input
              className={inputControlClass}
              disabled={disabled}
              onChange={(event) => onDraftChange('aliasesText', event.target.value)}
              placeholder="쉼표로 구분"
              value={draft.aliasesText}
            />
          </LabeledField>
        </div>

        <DetailBlock label="제철 메모">
          <textarea
            className={textareaControlClass}
            disabled={disabled}
            onChange={(event) => onDraftChange('seasonNote', event.target.value)}
            value={draft.seasonNote}
          />
        </DetailBlock>
        <DetailBlock label="중량">
          <textarea
            className={textareaControlClass}
            disabled={disabled}
            onChange={(event) => onDraftChange('weightNote', event.target.value)}
            value={draft.weightNote}
          />
        </DetailBlock>
      </div>
    )
  }

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
      <DetailBlock label="중량">{profile.weightNote}</DetailBlock>
    </div>
  )
}

function ProfileSources({
  disabled = false,
  draft,
  onDraftChange,
  profile,
}: {
  disabled?: boolean
  draft?: SpeciesEditorState
  onDraftChange?: (key: keyof SpeciesEditorState, value: string) => void
  profile: SpeciesProfile
}) {
  return (
    <div className="mt-6 border-t border-bushiri-line pt-4">
      <h3 className="m-0 text-[0.78rem] font-extrabold uppercase tracking-normal text-bushiri-muted">
        자료 출처
      </h3>
      {draft && onDraftChange ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <LabeledField label="사진 원문 URL">
            <input
              className={inputControlClass}
              disabled={disabled}
              onChange={(event) => onDraftChange('photoSourceUrl', event.target.value)}
              placeholder="https://..."
              type="url"
              value={draft.photoSourceUrl}
            />
          </LabeledField>
          <LabeledField label="사진 출처 표기">
            <input
              className={inputControlClass}
              disabled={disabled}
              onChange={(event) => onDraftChange('photoAttribution', event.target.value)}
              value={draft.photoAttribution}
            />
          </LabeledField>
          <LabeledField label="사진 라이선스">
            <input
              className={inputControlClass}
              disabled={disabled}
              onChange={(event) => onDraftChange('photoLicense', event.target.value)}
              value={draft.photoLicense}
            />
          </LabeledField>
          <LabeledField label="자료 출처 URL">
            <textarea
              className={cn(textareaControlClass, 'min-h-24')}
              disabled={disabled}
              onChange={(event) => onDraftChange('infoSourcesText', event.target.value)}
              placeholder="한 줄에 하나씩 입력"
              value={draft.infoSourcesText}
            />
          </LabeledField>
        </div>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap gap-2">
            {[profile.photoSourceUrl, ...profile.infoSources]
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
          {profile.photoLicense ? (
            <p className={cn('mt-3 text-[0.76rem] font-bold leading-relaxed', mutedTextClass)}>
              사진 라이선스: {profile.photoLicense}
            </p>
          ) : null}
        </>
      )}
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
  const session = useAuthSession()
  const profilesResource = useResource(getSpeciesProfiles, [])
  const [selectedName, setSelectedName] = useState(readSelectedSpeciesFromUrl)
  const [query, setQuery] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [draft, setDraft] = useState<SpeciesEditorState | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const profiles = profilesResource.data ?? []
  const canEdit = hasAdminPermission(session)

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

  useEffect(() => {
    if (!activeProfile || isEditing) {
      return
    }

    setDraft(createEditorState(activeProfile))
  }, [activeProfile, isEditing])

  function selectProfile(canonicalName: string) {
    setIsEditing(false)
    setSaveError(null)
    setSelectedName(normalizeSpeciesName(canonicalName))
    navigateToSpeciesInfo(canonicalName)
  }

  function updateDraftField(key: keyof SpeciesEditorState, value: string) {
    setDraft((current) => (current ? { ...current, [key]: value } : current))
  }

  function startEditing() {
    if (!activeProfile) {
      return
    }

    setDraft(createEditorState(activeProfile))
    setSaveError(null)
    setIsEditing(true)
  }

  function cancelEditing() {
    if (activeProfile) {
      setDraft(createEditorState(activeProfile))
    }

    setSaveError(null)
    setIsEditing(false)
  }

  async function saveDraft() {
    if (!activeProfile || !draft) {
      return
    }

    const validationError = getDraftValidationError(draft)
    if (validationError) {
      setSaveError(validationError)
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const savedProfile = await updateSpeciesProfile(activeProfile.canonicalName, buildProfilePatch(draft))
      setDraft(createEditorState(savedProfile))
      setIsEditing(false)
      await profilesResource.refresh()
    } catch (issue) {
      setSaveError(issue instanceof Error ? issue.message : '어종 정보를 저장하지 못했습니다.')
    } finally {
      setIsSaving(false)
    }
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

  const activeDraft = isEditing ? draft : null
  const displayProfile = activeDraft ? createPreviewProfile(activeProfile, activeDraft) : activeProfile
  const panelTitle = activeDraft ? (
    <input
      aria-label="어종 이름"
      className={cn(inputControlClass, 'min-h-9 px-2 text-[1.02rem] font-extrabold')}
      disabled={isSaving}
      onChange={(event) => updateDraftField('koreanName', event.target.value)}
      value={activeDraft.koreanName}
    />
  ) : (
    activeProfile.koreanName
  )
  const panelActions = canEdit ? (
    activeDraft ? (
      <>
        <Button disabled={isSaving} onClick={() => void saveDraft()}>
          <Save aria-hidden="true" className="mr-2 h-4 w-4" strokeWidth={2.5} />
          {isSaving ? '저장 중' : '저장'}
        </Button>
        <Button disabled={isSaving} onClick={cancelEditing} tone="subtle">
          <X aria-hidden="true" className="mr-2 h-4 w-4" strokeWidth={2.5} />
          취소
        </Button>
      </>
    ) : (
      <Button onClick={startEditing} tone="subtle">
        <Pencil aria-hidden="true" className="mr-2 h-4 w-4" strokeWidth={2.5} />
        편집
      </Button>
    )
  ) : undefined

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
        actions={panelActions}
        title={panelTitle}
        subtitle={displayProfile.englishName ?? undefined}
      >
        {saveError ? (
          <div className="mb-4 rounded-lg border border-bushiri-danger/25 bg-bushiri-danger/10 px-4 py-3 text-sm font-bold text-bushiri-danger">
            {saveError}
          </div>
        ) : null}
        <div className="grid grid-cols-[minmax(240px,0.92fr)_minmax(0,1.08fr)] gap-5 max-xl:grid-cols-1">
          <SpeciesPhoto
            disabled={isSaving}
            onPhotoUrlChange={activeDraft ? (value) => updateDraftField('photoUrl', value) : undefined}
            photoUrlValue={activeDraft?.photoUrl}
            profile={displayProfile}
          />
          <ProfileFacts
            disabled={isSaving}
            draft={activeDraft ?? undefined}
            onDraftChange={activeDraft ? updateDraftField : undefined}
            profile={displayProfile}
          />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-5 max-xl:grid-cols-1">
          <DetailBlock label="서식">
            {activeDraft ? (
              <textarea
                className={textareaControlClass}
                disabled={isSaving}
                onChange={(event) => updateDraftField('habitatNote', event.target.value)}
                value={activeDraft.habitatNote}
              />
            ) : (
              activeProfile.habitatNote
            )}
          </DetailBlock>
          <DetailBlock label="맛과 활용">
            {activeDraft ? (
              <textarea
                className={textareaControlClass}
                disabled={isSaving}
                onChange={(event) => updateDraftField('tasteNote', event.target.value)}
                value={activeDraft.tasteNote}
              />
            ) : (
              activeProfile.tasteNote
            )}
          </DetailBlock>
          <DetailBlock label="구매 체크">
            {activeDraft ? (
              <textarea
                className={textareaControlClass}
                disabled={isSaving}
                onChange={(event) => updateDraftField('buyingNote', event.target.value)}
                value={activeDraft.buyingNote}
              />
            ) : (
              activeProfile.buyingNote
            )}
          </DetailBlock>
        </div>

        <ProfileSources
          disabled={isSaving}
          draft={activeDraft ?? undefined}
          onDraftChange={activeDraft ? updateDraftField : undefined}
          profile={displayProfile}
        />
      </Panel>
    </div>
  )
}
