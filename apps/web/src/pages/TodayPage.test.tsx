import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./TodayPage.tsx', import.meta.url), 'utf8')

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

  it('keeps the selected board section in the URL with fish as the default', () => {
    expect(source).toContain("DEFAULT_BOARD_SECTION: TodayBoardSectionKey = 'fish'")
    expect(source).toContain("searchParams.get('section')")
    expect(source).toContain("searchParams.set('section', sectionKey)")
    expect(source).toContain("searchParams.get('date')")
    expect(source).toContain("searchParams.set('date', selectedDate)")
    expect(source).toContain("searchParams.get('q')")
    expect(source).toContain("searchParams.set('q', query)")
    expect(source).toContain('activeSection')
  })

  it('renders a top section selector instead of showing every section at once', () => {
    expect(source).toContain('<SegmentedControl')
    expect(source).toContain('ariaLabel="시세판 섹션 선택"')
    expect(source).toContain('visibleSections')
    expect(source).toContain('onChange={(sectionKey) => setSelectedSection')
  })

  it('renders award treatments for best condition, lowest price, and AI recommendation', () => {
    expect(source).toContain('isBestCondition')
    expect(source).toContain('isLowestPrice')
    expect(source).toContain('isAiRecommended')
    expect(source).toContain('awardCardToneClass')
    expect(source).toContain('awardBadges')
    expect(source).toContain('bg-[#fff5c8]')
    expect(source).toContain('bg-[#eaf5ff]')
    expect(source).toContain('bg-[#edf9ed]')
    expect(source).toContain('radial-gradient(circle_at_12%_18%,rgba(255,225,138,0.92)')
    expect(source).toContain('linear-gradient(135deg,#fff9df_0%,#eefaf0_48%,#edf7ff_100%)')
    expect(source).toContain('absolute right-1 top-1')
    expect(source).toContain('flex-wrap')
    expect(source).toContain('AI추천')
    expect(source).toContain('최저가')
    expect(source).toContain('최상품')
  })

  it('limits search to species names and offers species autocomplete', () => {
    expect(source).toContain('const speciesOptions = useMemo')
    expect(source).toContain('row.canonicalName.toLowerCase().includes(normalizedQuery)')
    expect(source).not.toContain('${row.species} ${row.canonicalName} ${row.source} ${row.market}')
    expect(source).toContain('<SearchCombobox')
    expect(source).toContain('options={speciesOptions.map')
    expect(source).not.toContain('list="species-search-options"')
    expect(source).not.toContain('<datalist id="species-search-options">')
  })

  it('renders empty vendor cells as a neutral fill without placeholder text', () => {
    expect(source).not.toContain('등록 없음')
    expect(source).not.toContain('>—</')
    expect(source).toContain('empty-market-cell')
  })

  it('keeps the condition panel limited to date, species search, and sold-out filtering', () => {
    expect(source).toContain('label="품절 제외"')
    expect(source).not.toContain('label="이벤트만 보기"')
    expect(source).not.toContain('label="판매처 표시"')
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
