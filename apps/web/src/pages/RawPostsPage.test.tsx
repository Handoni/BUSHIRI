import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { RawPostItem } from '../lib/api'
import { MaskedRawPostPreview } from './RawPostsPage'

function createRawPost(fullText: string): RawPostItem {
  return {
    id: 'raw-post-1',
    source: '성전물산',
    market: '미상 시장',
    species: '혼합 품목',
    excerpt: fullText,
    fullText,
    status: '대기',
    parseError: null,
    publishedAt: null,
    url: null,
    raw: {
      rawContentMasked: fullText,
    },
  }
}

describe('MaskedRawPostPreview', () => {
  it('renders a truncated preview until the masked raw text is expanded', () => {
    const fullText = `${'광어 4.8kg 38,000원 '.repeat(18)}\n010-****-7311\n마지막 줄: 전문 끝`
    const row = createRawPost(fullText)

    const collapsed = renderToStaticMarkup(
      <MaskedRawPostPreview isExpanded={false} onToggle={() => {}} row={row} />,
    )
    const expanded = renderToStaticMarkup(
      <MaskedRawPostPreview isExpanded={true} onToggle={() => {}} row={row} />,
    )

    expect(collapsed).toContain('aria-expanded="false"')
    expect(collapsed).toContain('전문 보기')
    expect(collapsed).not.toContain('마지막 줄: 전문 끝')
    expect(expanded).toContain('aria-expanded="true"')
    expect(expanded).toContain('전문 접기')
    expect(expanded).toContain('마지막 줄: 전문 끝')
  })
})
