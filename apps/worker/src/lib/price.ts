import type { PriceNotation } from '../types/domain'

function normalizeThousands(input: string): string {
  return input.replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(/,/g, '')
}

function extractNumericToken(input: string): string | null {
  const match = input.match(/\d+(?:[.,]\d+)?/)
  return match ? normalizeThousands(match[0]) : null
}

export function parsePricePerKg(input: string, priceNotation: PriceNotation, vendorName: string | null = null): number | null {
  const token = extractNumericToken(input)

  if (!token) {
    return null
  }

  const numericValue = Number(token)
  if (Number.isNaN(numericValue)) {
    return null
  }

  if (priceNotation === 'won') {
    return Math.round(numericValue)
  }

  if (priceNotation === 'manwon') {
    return Math.round(numericValue * 10000)
  }

  if (input.includes('원') || input.includes(',')) {
    return Math.round(numericValue)
  }

  if (vendorName === '성전물산' || (token.includes('.') && numericValue < 20)) {
    return Math.round(numericValue * 10000)
  }

  return Math.round(numericValue)
}
