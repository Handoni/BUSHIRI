import { CN, JP, KR, NO, RU } from 'country-flag-icons/react/3x2'

import { cn } from './ui'

type FlagCode = 'CN' | 'JP' | 'KR' | 'NO' | 'RU'

const FLAG_BY_CODE = {
  CN,
  JP,
  KR,
  NO,
  RU,
} satisfies Record<FlagCode, typeof CN>

const COUNTRY_ALIASES: Array<{
  code: FlagCode
  aliases: string[]
}> = [
  {
    code: 'KR',
    aliases: ['국내산', '국내', '한국', '제주산', '제주', '거제도', '거제', '완도', '통영'],
  },
  {
    code: 'JP',
    aliases: ['일본산', '일본'],
  },
  {
    code: 'CN',
    aliases: ['중국산', '중국'],
  },
  {
    code: 'NO',
    aliases: ['노르웨이산', '노르웨이'],
  },
  {
    code: 'RU',
    aliases: ['러시아산', '러시아'],
  },
]

const COUNTRY_ONLY_LABELS = new Set([
  '국내',
  '국내산',
  '한국',
  '일본',
  '일본산',
  '중국',
  '중국산',
  '노르웨이',
  '노르웨이산',
  '러시아',
  '러시아산',
  '원산지 미상',
])

export function countryFlagCodes(country: string): FlagCode[] {
  const matches = COUNTRY_ALIASES.flatMap(({ code, aliases }) => {
    const index = aliases.reduce<number | null>((firstIndex, alias) => {
      const aliasIndex = country.indexOf(alias)

      if (aliasIndex === -1) {
        return firstIndex
      }

      return firstIndex === null ? aliasIndex : Math.min(firstIndex, aliasIndex)
    }, null)

    return index === null ? [] : [{ code, index }]
  })

  return Array.from(new Map(
    matches
      .sort((left, right) => left.index - right.index)
      .map((match) => [match.code, match.code]),
  ).values())
}

export function compactOriginLabel(country: string, detail?: string | null): string | null {
  if (detail) {
    return detail
  }

  return COUNTRY_ONLY_LABELS.has(country.trim()) ? null : country
}

function UnknownCountryFlag({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn('h-3.5 w-5 shrink-0 rounded-[2px] border border-bushiri-line bg-bushiri-surface-muted', className)}
      viewBox="0 0 30 20"
    >
      <path d="M0 0h30v20H0z" fill="currentColor" opacity="0.08" />
      <path d="M7 10h16" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
    </svg>
  )
}

export function CountryFlag({
  country,
  className,
  flagClassName,
}: {
  country: string
  className?: string
  flagClassName?: string
}) {
  const codes = countryFlagCodes(country)

  return (
    <span
      aria-label={country}
      className={cn('inline-flex shrink-0 items-center gap-0.5', className)}
      title={country}
    >
      {codes.length > 0 ? (
        codes.slice(0, 3).map((code) => {
          const Flag = FLAG_BY_CODE[code]

          return (
            <Flag
              aria-hidden="true"
              className={cn('h-3.5 w-5 shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(16,33,42,0.16)]', flagClassName)}
              key={code}
            />
          )
        })
      ) : (
        <UnknownCountryFlag className={flagClassName} />
      )}
    </span>
  )
}

export function CountryFlagLabel({
  country,
  className,
  flagClassName,
}: {
  country: string
  className?: string
  flagClassName?: string
}) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <CountryFlag country={country} flagClassName={flagClassName} />
      <span className="min-w-0 truncate">{country}</span>
    </span>
  )
}
