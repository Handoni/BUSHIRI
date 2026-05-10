import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./TodayPage.tsx', import.meta.url), 'utf8')
const desktopDesignSources = [
  './today-designs/VendorAxisBoard.tsx',
  './today-designs/VendorStackBoard.tsx',
]
  .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))
  .join('\n')

describe('TodayPage market listing cards', () => {
  it('does not render duplicated plaintext variant labels inside listing cards', () => {
    expect(source).not.toContain('>{listing.variantLabel}</')
  })

  it('renders a mobile summary board that expands each species into every vendor', () => {
    expect(source).toContain('어종별 최저가 시세판')
    expect(source).toContain('getLowestVendorListing')
    expect(source).toContain('aria-expanded={isExpanded}')
    expect(source).toContain('md:hidden')
  })

  it('keeps the board on all by default and stores vendor and country filters in the URL', () => {
    expect(source).toContain("const DEFAULT_BOARD_SECTION = 'all'")
    expect(source).toContain("searchParams.delete('section')")
    expect(source).toContain("searchParams.get('date')")
    expect(source).toContain("searchParams.set('date', selectedDate)")
    expect(source).toContain(".getAll('vendor')")
    expect(source).toContain("searchParams.append('vendor', vendor)")
    expect(source).toContain(".getAll('country')")
    expect(source).toContain("searchParams.append('country', country)")
    expect(source).not.toContain("searchParams.set('section'")
  })

  it('renders date, vendor, country, and sold-out controls in the top condition panel', () => {
    expect(source).toContain('label="기준일"')
    expect(source).toContain('label="판매처"')
    expect(source).toContain('<VendorMultiSelect')
    expect(source).toContain('label="국가"')
    expect(source).toContain('<CountryMultiSelect')
    expect(source).toContain('label="품절 제외"')
    expect(source).not.toContain('<SegmentedControl')
    expect(source).not.toContain('<SearchCombobox')
    expect(source).toContain('visibleSections')
  })

  it('renders award treatments for best condition, lowest price, and AI recommendation', () => {
    expect(source).toContain('isBestCondition')
    expect(source).toContain('isLowestPrice')
    expect(source).toContain('isAiRecommended')
    expect(source).toContain('awardCardToneClass')
    expect(source).toContain('awardBadges')
    expect(source).toContain('bg-bushiri-award-ai/45')
    expect(source).toContain('bg-bushiri-award-low/70')
    expect(source).toContain('bg-bushiri-award-best/70')
    expect(source).toContain('award-tone-ai-low-best')
    expect(source).toContain('award-tone-low-best')
    expect(source).toContain('absolute right-1 top-1')
    expect(source).toContain('flex-wrap')
    expect(source).toContain('AI추천')
    expect(source).toContain('최저가')
    expect(source).toContain('최상품')
  })

  it('filters by selected vendors, countries, and sold-out state', () => {
    expect(source).toContain('const vendorOptions = useMemo')
    expect(source).toContain('const countryOptions = useMemo')
    expect(source).toContain('row.source')
    expect(source).toContain('selectedVendors.includes(row.source)')
    expect(source).toContain('selectedCountries.includes(originCountry)')
    expect(source).toContain('NO_VENDOR_SELECTION')
    expect(source).toContain('NO_COUNTRY_SELECTION')
    expect(source).not.toContain('${row.species} ${row.canonicalName} ${row.source} ${row.market}')
    expect(source).not.toContain('list="species-search-options"')
    expect(source).not.toContain('<datalist id="species-search-options">')
  })

  it('renders empty vendor cells as a neutral fill without placeholder text', () => {
    expect(source).not.toContain('등록 없음')
    expect(desktopDesignSources).not.toContain('등록 없음')
    expect(source).not.toContain('>—</')
    expect(desktopDesignSources).not.toContain('>—</')
    expect(desktopDesignSources).toContain('border-dashed border-bushiri-line')
  })

  it('keeps the desktop vendor board fixed to the vendor axis layout and fitted within the viewport', () => {
    expect(source).not.toContain('DesktopDesignSwitcher')
    expect(source).toContain("searchParams.delete('design')")
    expect(source).not.toContain("searchParams.set('design'")
    expect(source).toContain('md:w-[calc(100vw-2.5rem)]')
    expect(source).toContain('<VendorAxisBoard')
    expect(source).not.toContain('<VendorStackBoard')
    expect(source).not.toContain('<PriceBandBoard section={section} />')
    expect(source).not.toContain('<OriginMapBoard section={section} />')
    expect(desktopDesignSources).toContain('overflow-auto')
    expect(source).not.toContain('min-w-[940px]')
    expect(desktopDesignSources).not.toContain('min-w-[940px]')
  })

  it('keeps the condition panel limited to date, vendor, country, and sold-out filtering', () => {
    expect(source).toContain('label="기준일"')
    expect(source).toContain('label="판매처"')
    expect(source).toContain('label="국가"')
    expect(source).toContain('label="품절 제외"')
    expect(source).not.toContain('label="어종 검색"')
    expect(source).not.toContain('label="분류"')
    expect(source).not.toContain('label="이벤트만 보기"')
    expect(source).not.toContain('eventOnly')
    expect(source).not.toContain('showVendorNames')
  })

  it('does not render the top market metric summary cards', () => {
    expect(source).not.toContain('표시 어종')
    expect(source).not.toContain('판매처 열')
    expect(source).not.toContain('품절 셀')
    expect(source).not.toContain('이벤트 셀')
  })
})
