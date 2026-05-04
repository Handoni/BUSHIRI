export type VendorType = 'fish' | 'crustacean' | 'mixed'
export type SourceMode = 'band_api' | 'band_page' | 'manual'
export type PriceNotation = 'auto' | 'won' | 'manwon'

export type SourceRecord = {
  id: number
  name: string
  vendorName: string
  vendorType: VendorType
  bandKey: string | null
  sourceMode: SourceMode
  priceNotation: PriceNotation
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export type SourceInput = {
  name: string
  vendorName: string
  vendorType: VendorType
  bandKey: string | null
  sourceMode: SourceMode
  priceNotation: PriceNotation
  isActive: boolean
}

export type SourcePatch = Partial<SourceInput>

export type InsightType =
  | 'price_drop'
  | 'price_spike'
  | 'new_item'
  | 'sold_out'
  | 'restocked'
  | 'lowest_price'
  | 'vendor_gap'
  | 'notable'

export type InsightSeverity = 'info' | 'notice' | 'warning' | 'critical'

export type InsightRecord = {
  insightType: InsightType
  severity: InsightSeverity
  canonicalName: string | null
  title: string
  body: string
}
