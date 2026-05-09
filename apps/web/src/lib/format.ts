export function formatNumber(value: number | null | undefined, digits = 0) {
  if (value == null || Number.isNaN(value)) {
    return '—'
  }

  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits > 0 ? Math.min(1, digits) : 0,
  }).format(value)
}

export function formatCurrency(
  value: number | null | undefined,
  currency = 'KRW',
) {
  if (value == null || Number.isNaN(value)) {
    return '—'
  }

  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

function parseNumericPriceText(value: string): number | null {
  const parsed = Number(value.replace(/,/g, '').replace(/[^0-9.-]/g, ''))

  return Number.isFinite(parsed) ? parsed : null
}

function formatManwonValue(value: number | string | null | undefined) {
  if (value == null) {
    return null
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? (value / 10000).toFixed(1) : null
  }

  const normalized = value.trim()

  if (!normalized) {
    return null
  }

  const compacted = normalized.replace(/,/g, '')
  const dottedWonMatch = compacted.match(/(\d+)\.(\d{3})(?=\s*원|[^0-9]|$)/)

  if (dottedWonMatch) {
    const parsed = Number(`${dottedWonMatch[1]}${dottedWonMatch[2]}`)

    return Number.isFinite(parsed) ? (parsed / 10000).toFixed(1) : null
  }

  const parsed = parseNumericPriceText(normalized)

  if (parsed === null) {
    return null
  }

  const isWonText = /[₩원,]/.test(normalized) || Math.abs(parsed) >= 1000
  const manwon = isWonText ? parsed / 10000 : parsed

  return manwon.toFixed(1)
}

export function formatKgManwonPrice(value: number | string | null | undefined) {
  const manwonValue = formatManwonValue(value)

  return manwonValue === null ? '—' : `kg ${manwonValue}`
}

export function formatKgManwonPriceRange(
  lowValue: number | string | null | undefined,
  highValue: number | string | null | undefined,
) {
  const low = formatManwonValue(lowValue)
  const high = formatManwonValue(highValue)

  if (low === null || high === null) {
    return '—'
  }

  if (low === high) {
    return `kg ${low}`
  }

  return `kg ${low}~${high}`
}

export function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—'
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
    .format(parsed)
    .replace(/\bAM\b/g, '오전')
    .replace(/\bPM\b/g, '오후')
}

export function formatRelativeDateInput(date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

export function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return '—'
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function truncate(value: string, limit = 120) {
  if (value.length <= limit) {
    return value
  }

  return `${value.slice(0, limit - 1)}…`
}
