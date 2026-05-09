export type ParsedMarketPost = {
  vendorName: string | null
  marketDate: string | null
  categoryHint: 'fish' | 'crustacean' | 'mixed' | null
  items: ParsedMarketItem[]
  warnings: string[]
}

export type ParsedMarketItem = {
  category: 'fish' | 'crustacean' | 'shellfish' | 'salmon' | 'other'
  canonicalName: string | null
  displayName: string
  origin: string | null
  originCountry: string | null
  originDetail: string | null
  productionType: string | null
  freshnessState: string | null
  grade: string | null
  sizeMinKg: number | null
  sizeMaxKg: number | null
  unit: 'kg'
  pricePerKg: number | null
  priceText: string
  soldOut: boolean
  eventFlag: boolean
  halfAvailable: boolean
  notes: string | null
  confidence: number
}
