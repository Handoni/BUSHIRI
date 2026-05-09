# BUSHIRI Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the BUSHIRI dashboard into a Korean-first, sea-inspired, table-dominant market board where `/today` shows all species at a glance in a species-by-vendor data board.

**Architecture:** Keep the existing React/Vite frontend and Worker API, but refactor the frontend’s data normalization, copy, layout, and page composition to match the approved practical fish-market board design. The `/today` page becomes the primary operational board, while `/trends`, `/raw-posts`, and `/settings` inherit the same Korean visual language and remain secondary supporting views.

**Tech Stack:** React 19, TypeScript, Vite 6, vanilla CSS tokens in `apps/web/src/styles.css`, existing Worker API routes under `apps/worker/src/routes/*`

---

## File Structure

### Files to modify

- `apps/web/src/App.tsx` — Korean route titles and top-level route behavior
- `apps/web/src/components/AppShell.tsx` — Korean navigation copy and denser operational shell
- `apps/web/src/components/ui.tsx` — table-oriented shared UI primitives, Korean labels, compact metric style
- `apps/web/src/hooks/useResource.ts` — keep loading/error flow stable while redesigning screen states
- `apps/web/src/lib/api.ts` — normalize worker payloads into the data-board model expected by the redesigned pages
- `apps/web/src/lib/format.ts` — Korean number/date/currency formatting
- `apps/web/src/lib/router.ts` — Korean route labels remain aligned to route structure
- `apps/web/src/main.tsx` — keep stylesheet/app wiring stable
- `apps/web/src/pages/TodayPage.tsx` — primary redesign target; species-by-vendor board
- `apps/web/src/pages/TrendsPage.tsx` — Korean operational trends view
- `apps/web/src/pages/RawPostsPage.tsx` — Korean admin/raw-material review table
- `apps/web/src/pages/SettingsPage.tsx` — Korean source inventory/status table
- `apps/web/src/styles.css` — redesign tokens, board layout, table styling, sea-material treatment
- `apps/web/src/vite-env.d.ts` — preserve Vite env typing after frontend updates

### Files to create

- `apps/web/src/lib/board.ts` — `/today`-specific transformation from normalized market rows into species-row/vendor-column board cells
- `apps/web/src/lib/board.test.ts` — deterministic board-shaping tests for the new table model

### Files to check during implementation

- `docs/superpowers/specs/2026-04-24-bushiri-dashboard-redesign-design.md` — approved redesign spec
- `apps/worker/src/routes/marketRead.ts` — current backend shapes used by the frontend

---

### Task 1: Create the `/today` board data model

**Files:**
- Create: `apps/web/src/lib/board.ts`
- Create: `apps/web/src/lib/board.test.ts`
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { buildTodayBoard } from './board'

describe('buildTodayBoard', () => {
  it('groups rows by species and spreads vendors into columns', () => {
    const board = buildTodayBoard([
      {
        id: '1',
        canonicalName: '광어',
        species: '광어',
        market: '국내산',
        price: 18000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-04-24',
        source: '성전물산',
        raw: {
          sizeMinKg: 2,
          sizeMaxKg: 3,
          soldOut: false,
          eventFlag: false,
        },
      },
      {
        id: '2',
        canonicalName: '광어',
        species: '광어',
        market: '국내산',
        price: 19000,
        lowPrice: null,
        highPrice: null,
        unit: 'kg',
        currency: 'KRW',
        observedAt: '2026-04-24',
        source: '참조은수산',
        raw: {
          sizeMinKg: 2,
          sizeMaxKg: 3,
          soldOut: true,
          eventFlag: false,
        },
      },
    ])

    expect(board.vendorColumns).toEqual(['성전물산', '참조은수산'])
    expect(board.rows).toHaveLength(1)
    expect(board.rows[0].speciesLabel).toBe('광어')
    expect(board.rows[0].cells['성전물산']).toMatchObject({
      price: 18000,
      weightLabel: '2~3kg',
      statusTags: [],
    })
    expect(board.rows[0].cells['참조은수산']).toMatchObject({
      price: 19000,
      weightLabel: '2~3kg',
      statusTags: ['품절'],
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @bushiri/web test apps/web/src/lib/board.test.ts`

Expected: FAIL because `apps/web/src/lib/board.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```ts
export type TodayBoardCell = {
  price: number | null
  weightLabel: string
  statusTags: string[]
  raw: unknown
}

export type TodayBoardRow = {
  canonicalName: string
  speciesLabel: string
  cells: Record<string, TodayBoardCell>
}

export type TodayBoard = {
  vendorColumns: string[]
  rows: TodayBoardRow[]
}

function formatWeight(raw: Record<string, unknown>): string {
  const min = typeof raw.sizeMinKg === 'number' ? raw.sizeMinKg : null
  const max = typeof raw.sizeMaxKg === 'number' ? raw.sizeMaxKg : null

  if (min !== null && max !== null) {
    return min === max ? `${min}kg` : `${min}~${max}kg`
  }

  if (min !== null) {
    return `${min}kg+`
  }

  return '중량 미상'
}

function statusTags(raw: Record<string, unknown>): string[] {
  const tags: string[] = []
  if (raw.soldOut === true) tags.push('품절')
  if (raw.eventFlag === true) tags.push('이벤트')
  if (typeof raw.freshnessState === 'string' && raw.freshnessState.trim()) tags.push(raw.freshnessState)
  return tags
}

export function buildTodayBoard(rows: Array<any>): TodayBoard {
  const vendorColumns = Array.from(new Set(rows.map((row) => row.source)))
  const grouped = new Map<string, TodayBoardRow>()

  rows.forEach((row) => {
    if (!grouped.has(row.canonicalName)) {
      grouped.set(row.canonicalName, {
        canonicalName: row.canonicalName,
        speciesLabel: row.species,
        cells: {},
      })
    }

    const target = grouped.get(row.canonicalName)!
    const raw = typeof row.raw === 'object' && row.raw ? row.raw : {}

    target.cells[row.source] = {
      price: row.price,
      weightLabel: formatWeight(raw as Record<string, unknown>),
      statusTags: statusTags(raw as Record<string, unknown>),
      raw: row.raw,
    }
  })

  return {
    vendorColumns,
    rows: Array.from(grouped.values()),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @bushiri/web test apps/web/src/lib/board.test.ts`

Expected: PASS

- [ ] **Step 5: Verify the API normalizer exposes the raw fields the board needs**

Update `apps/web/src/lib/api.ts` so the normalized market rows preserve backend properties such as:

```ts
raw: {
  ...record,
  sizeMinKg: getCandidate(record, ['sizeMinKg', 'size_min_kg']),
  sizeMaxKg: getCandidate(record, ['sizeMaxKg', 'size_max_kg']),
  soldOut: getCandidate(record, ['soldOut', 'sold_out']),
  eventFlag: getCandidate(record, ['eventFlag', 'event_flag']),
  freshnessState: getCandidate(record, ['freshnessState', 'freshness_state']),
}
```

Run: `pnpm --filter @bushiri/web typecheck`

Expected: PASS

---

### Task 2: Redesign the `/today` page as the main Korean species-by-vendor board

**Files:**
- Modify: `apps/web/src/pages/TodayPage.tsx`
- Modify: `apps/web/src/components/ui.tsx`
- Modify: `apps/web/src/lib/format.ts`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/lib/board.test.ts`

- [ ] **Step 1: Write the failing test for Korean formatting helpers**

```ts
import { describe, expect, it } from 'vitest'
import { formatCurrency, formatDate } from './format'

describe('Korean formatting', () => {
  it('formats KRW and dates for the dashboard', () => {
    expect(formatCurrency(18000, 'KRW')).toContain('18,000')
    expect(formatDate('2026-04-24T00:00:00.000Z')).toContain('2026')
  })
})
```

- [ ] **Step 2: Run test to verify current behavior is not yet correct enough**

Run: `pnpm --filter @bushiri/web test apps/web/src/lib/format.test.ts`

Expected: FAIL or missing-file failure, because the helper test file does not exist yet.

- [ ] **Step 3: Add the formatting test file and switch to Korean locale output**

Implement `apps/web/src/lib/format.test.ts` and update `apps/web/src/lib/format.ts` to use `ko-KR` defaults:

```ts
return new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency,
  maximumFractionDigits: 0,
}).format(value)
```

```ts
return new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(parsed)
```

- [ ] **Step 4: Replace TodayPage metrics and table with the approved board layout**

The updated `TodayPage.tsx` should:

- render Korean page title and descriptions
- render a narrow operational filter bar
- render 3-4 compact summary counters
- render one species-by-vendor matrix
- use price as the largest text in each cell
- show weight below price
- show status tags below weight
- preserve loading / empty / error states in Korean

Core render shape:

```tsx
const board = buildTodayBoard(filteredRows)

return (
  <div className="page-stack">
    <PageHeader
      title="오늘 시세판"
      description="모든 어종을 판매처 기준으로 한눈에 비교하는 실무형 데이터보드입니다."
      actions={<Button onClick={() => { void market.refresh(); void insights.refresh(); void sources.refresh() }}>새로고침</Button>}
    />

    <Panel title="조건" subtitle="날짜, 검색, 상태 기준으로 표를 빠르게 좁힙니다.">
      {/* date, search, sold-out toggle, event toggle, vendor toggle */}
    </Panel>

    <MetricGrid>{/* 오늘 등록 어종 수 / 판매처 수 / 품절 건수 / 이벤트 건수 */}</MetricGrid>

    <Panel title="종합 시세판" subtitle="어종 행, 판매처 열 기준의 메인 데이터보드입니다.">
      {/* custom board table, not generic card list */}
    </Panel>
  </div>
)
```

- [ ] **Step 5: Add the board-specific CSS**

Add styles in `apps/web/src/styles.css` for:

- `.market-board`
- `.market-board__table`
- `.market-board__species`
- `.market-board__cell`
- `.market-board__price`
- `.market-board__weight`
- `.market-board__tags`
- `.filter-strip`

The style rules should deliver:

- deep teal + ink + salt palette
- thin structural borders
- compact practical counters
- restrained sea-material texture
- large price typography

- [ ] **Step 6: Run frontend verification**

Run:

```bash
pnpm --filter @bushiri/web test
pnpm --filter @bushiri/web typecheck
pnpm --filter @bushiri/web build
```

Expected: all PASS

---

### Task 3: Align `/trends`, `/raw-posts`, and `/settings` to the Korean market-board system

**Files:**
- Modify: `apps/web/src/pages/TrendsPage.tsx`
- Modify: `apps/web/src/pages/RawPostsPage.tsx`
- Modify: `apps/web/src/pages/SettingsPage.tsx`
- Modify: `apps/web/src/components/AppShell.tsx`
- Modify: `apps/web/src/lib/router.ts`
- Modify: `apps/web/src/components/ui.tsx`

- [ ] **Step 1: Convert route labels and shell copy to Korean**

Update route labels and shell strings:

```ts
export const NAV_ITEMS = [
  { route: '/today', label: '오늘 시세판', description: '어종별·판매처별 시세 비교' },
  { route: '/trends', label: '시세 추이', description: '어종별 최근 흐름 확인' },
  { route: '/raw-posts', label: '원문 검수', description: '수집 원문과 파싱 상태 점검' },
  { route: '/settings', label: '소스 설정', description: '판매처와 수집 상태 확인' },
] as const
```

Update `AppShell.tsx` Korean brand copy accordingly.

- [ ] **Step 2: Redesign TrendsPage as a secondary operational page**

Update `TrendsPage.tsx` so it:

- uses Korean labels
- reads as a practical secondary analysis page
- keeps the compact bar visualization
- treats the trend table as the primary detailed view

- [ ] **Step 3: Redesign RawPostsPage as a utilitarian Korean admin page**

Update `RawPostsPage.tsx` so it:

- uses Korean copy for filters, columns, and states
- treats `rawContentMasked` as the main excerpt field
- uses `sourceName` and `parseStatus` semantics directly
- removes guessed market/species emphasis if the backend does not provide it meaningfully

- [ ] **Step 4: Redesign SettingsPage as a practical source inventory**

Update `SettingsPage.tsx` so it:

- uses Korean labels
- treats `vendorType`, `sourceMode`, `priceNotation`, `bandKey`, and `isActive` as the actual operational fields
- displays runtime state from `/api/sources/status` beside admin config rows

- [ ] **Step 5: Run frontend verification again**

Run:

```bash
pnpm --filter @bushiri/web typecheck
pnpm --filter @bushiri/web build
```

Expected: PASS

---

### Task 4: Final local integration verification for the redesign

**Files:**
- Modify if needed: `apps/web/vite.config.ts`
- Check only: `apps/worker/src/index.ts`, `apps/worker/src/routes/marketRead.ts`, `apps/worker/src/routes/sources.ts`

- [ ] **Step 1: Verify local proxy-based frontend dev setup**

Confirm `apps/web/vite.config.ts` keeps the dev proxy approach:

```ts
server: proxyTarget
  ? {
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    }
  : undefined
```

- [ ] **Step 2: Start worker and web together for manual QA**

Run:

```bash
(pnpm --filter @bushiri/worker exec wrangler dev --local --port 8789 --test-scheduled --var ADMIN_TOKEN:dev-admin-token > /tmp/bushiri-worker-redesign.log 2>&1 &) ; \
(VITE_API_PROXY_TARGET="http://127.0.0.1:8789" VITE_ADMIN_TOKEN="dev-admin-token" pnpm --filter @bushiri/web dev -- --host 127.0.0.1 --port 5175 > /tmp/bushiri-web-redesign.log 2>&1 &) ; \
sleep 12
```

Expected: both dev servers start.

- [ ] **Step 3: Verify the proxied API responds through Vite**

Run:

```bash
curl -s "http://127.0.0.1:5175/api/sources/status"
curl -s "http://127.0.0.1:5175/api/admin/raw-posts" -H "Authorization: Bearer dev-admin-token"
```

Expected: JSON payloads returned through the web dev server.

- [ ] **Step 4: Browser-check the redesigned routes**

Open `http://127.0.0.1:5175` and verify:

- `/today` lands on the redesigned Korean board
- `/trends` opens and renders Korean controls
- `/raw-posts` shows live masked raw-post data
- `/settings` shows live source inventory/status rows
- browser console has no errors

- [ ] **Step 5: Record what is intentionally empty**

If local DB still lacks `item_snapshots` or `insights`, document that:

- `/today` may show an intentional empty market board state
- `/trends` may show no trend data yet

That is acceptable only if the layout still reads as intentional and operational.

---

## Self-Review Notes

### Spec coverage

- Korean-first UI: covered in Tasks 2 and 3
- Sea-inspired practical tone: covered in Task 2 CSS and shell updates
- Species-by-vendor main board: covered in Tasks 1 and 2
- Price-first cell hierarchy: covered in Task 2 board render/CSS
- Filters + summary metrics above the board: covered in Task 2
- Supporting pages aligned visually: covered in Task 3
- Local integration with current Worker routes: covered in Task 4

No gaps found relative to the approved spec.

### Placeholder scan

No TBD/TODO placeholders remain. Commands, files, test targets, and implementation shapes are concrete.

### Type consistency

- `TodayBoard`, `TodayBoardRow`, and `TodayBoardCell` are named consistently
- worker-facing route names match current codebase usage
- Korean route labels preserve existing route paths without renaming URLs

---

Plan complete and saved to `docs/superpowers/plans/2026-04-24-bushiri-dashboard-redesign.md`.

Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
