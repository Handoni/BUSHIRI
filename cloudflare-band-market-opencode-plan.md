# 노량진 수산/갑각류 밴드 시세 수집·분석 서비스 구현 계획서

> 대상 실행자: OpenCode  
> 기준 아키텍처: Cloudflare Pages + Cloudflare Workers + Cron Triggers + D1 + Discord Webhook  
> 작성일: 2026-04-24  
> 목표: 네이버 밴드 시세글을 정기 수집하고, LLM으로 구조화한 뒤, 생선/갑각류별 가격 비교·추세·이상징후를 대시보드와 Discord 알림으로 제공한다.

---

## 0. 핵심 결론

이 프로젝트는 **공식 BAND Open API로 게시글 접근이 가능한 밴드**에 한해 Cloudflare 무료급에서 MVP 구현이 가능하다.

단, 다음 조건을 먼저 검증해야 한다.

1. 대상 밴드가 BAND API `Get Bands` 결과에 노출되는지 확인한다.
2. 각 `band_key`로 `Get Posts`를 호출했을 때 오늘 시세글을 가져올 수 있는지 확인한다.
3. 구독형 밴드는 API상 “가입한 밴드”로 잡히지 않을 가능성이 있으므로, API 수집 실패 시 `수동 붙여넣기 업로드` 기능으로 우회한다.
4. 네이버 밴드 원문 전체의 장기 저장/재배포는 약관 리스크가 있으므로, 원문은 마스킹 후 단기 보관하고, 서비스의 핵심 저장 단위는 구조화된 가격 데이터로 둔다.
5. OpenClaw/브라우저 자동화는 로컬 브라우저 상시 실행·세션 유지·탐지·약관 리스크가 있으므로 MVP 기본 수집 방식에서 제외한다.

---

## 1. 공식 근거 요약

### 1.1 Cloudflare

- Workers Free: 일 100,000 requests 제공.
- Workers Free: invocation당 CPU time 10ms 기준. 무거운 작업은 피해야 한다.
- Cron Triggers: Workers의 `scheduled()` handler를 cron 표현식으로 실행 가능.
- Cron Triggers는 UTC 기준으로 동작한다.
- D1 Free: DB당 500MB, 계정당 5GB, 계정당 DB 10개.
- Pages Free: 사이트당 20,000 files 제한.

참고 문서:

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/workers/configuration/cron-triggers/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/pages/platform/limits/

### 1.2 BAND Open API

- `Get Bands`: 사용자가 가입한 밴드 목록 조회.
- `Get Posts`: 특정 밴드의 게시글 목록 조회.
- `Get Specific Post`: 특정 게시글 상세 조회.
- API 사용에는 access token이 필요하다.

참고 문서:

- https://developers.band.us/develop/guide/api/get_bands
- https://developers.band.us/develop/guide/api/get_posts
- https://developers.band.us/develop/guide/api/get_post
- https://developers.band.us/develop/guide/api/get_authorization_code_from_user
- https://developers.band.us/develop/policy/terms

### 1.3 Discord

- Incoming Webhook은 특정 Discord 채널에 연결된 HTTP endpoint다.
- payload를 POST하면 해당 채널에 메시지가 올라간다.
- 봇 유저나 persistent connection이 필요 없다.

참고 문서:

- https://docs.discord.com/developers/platform/webhooks
- https://docs.discord.com/developers/resources/webhook

---

## 2. MVP 범위

### 2.1 포함

- Cloudflare Workers 기반 API 서버
- Cloudflare Cron Trigger 기반 매일 08:00 KST 자동 수집
- BAND API 접근성 검증용 엔드포인트
- 대상 밴드 3~4개 등록 관리
- 최신 게시글 수집
- 원문 마스킹 저장
- LLM 기반 JSON 파싱
- 생선/갑각류 canonical name 정규화
- 가격/중량/원산지/상태/등급 추출
- 전일 대비, 최근 7일 대비 추세 계산
- 급등락, 신규 등장, 품절/재입고, 판매처 간 가격차 감지
- Discord Webhook 요약 알림
- Cloudflare Pages 기반 대시보드
- 수동 원문 붙여넣기 업로드 기능

### 2.2 제외

- 브라우저 자동화 기반 로그인 크롤링
- OpenClaw 상시 실행 의존
- 원문 전체 공개 페이지 재배포
- 결제/유료 구독
- 다중 사용자 권한 관리
- 판매자 주문 자동화
- 밴드 댓글/채팅 수집

---

## 3. 권장 기술 스택

```text
Monorepo: pnpm workspace
Frontend: Vite + React + TypeScript
Backend: Cloudflare Workers + TypeScript
Router: Hono 또는 순수 Worker fetch router
Database: Cloudflare D1
Scheduler: Cloudflare Workers Cron Triggers
LLM: provider adapter 방식으로 추상화
Alert: Discord Incoming Webhook
Deploy: Wrangler + Cloudflare Pages
```

처음부터 Next.js를 쓸 필요는 없다.  
대시보드는 정적 SPA + Worker API 호출 구조가 가장 단순하다.

---

## 4. 전체 아키텍처

```text
[Cloudflare Cron Trigger]
        |
        v
[Worker scheduled()]
        |
        v
[Band Collector]
        |
        v
[Raw Post Masking + D1 저장]
        |
        v
[LLM Parser]
        |
        v
[Normalizer]
        |
        v
[D1: item_snapshots]
        |
        v
[Insight Engine]
        |
        +------------------> [Discord Webhook]
        |
        v
[Pages Dashboard]
```

---

## 5. Cron 시간

목표 실행 시간은 매일 오전 8시 KST다.

Cloudflare Cron Triggers는 UTC 기준이므로, KST 08:00은 UTC 23:00이다.

```toml
[triggers]
crons = ["0 23 * * *"]
```

주의:

- 한국은 DST가 없으므로 `0 23 * * *`로 고정해도 된다.
- 실행 후 게시글이 아직 안 올라온 밴드가 있을 수 있으므로 08:10, 08:30 재수집 옵션을 나중에 추가한다.
- Free 플랜 CPU time을 고려해 한 번의 cron에서 모든 작업을 길게 하지 말고, MVP에서는 대상 밴드 수를 4개 이하로 제한한다.

---

## 6. 저장 정책

### 6.1 원문 저장 정책

원문 전체를 장기 보관하지 않는다.

권장 방식:

```text
수집 직후:
- 전화번호 마스킹
- 계좌번호 마스킹
- URL 필요 시 band/post URL 정도만 유지
- raw_content_masked 저장

보관 기간:
- raw_posts는 30일 후 삭제
- item_snapshots, insights는 계속 보관
```

마스킹 예시:

```text
010-9659-7311 -> 010-****-7311
국민은행 54270201236744 -> 국민은행 ****6744
https://open.kakao.com/... -> [URL]
```

### 6.2 중복 제거

다음 기준으로 중복 저장을 막는다.

```text
source_id + post_key unique
content_hash unique 보조
```

게시글이 수정될 수 있으므로, `post_key`가 같아도 `content_hash`가 바뀌면 `revision_no`를 증가시키는 방식이 좋다.

---

## 7. D1 스키마

`migrations/0001_init.sql`

```sql
CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  vendor_type TEXT NOT NULL CHECK (vendor_type IN ('fish', 'crustacean', 'mixed')),
  band_key TEXT,
  source_mode TEXT NOT NULL CHECK (source_mode IN ('band_api', 'manual')),
  price_notation TEXT NOT NULL DEFAULT 'auto' CHECK (price_notation IN ('auto', 'won', 'manwon')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_sources_band_key ON sources(band_key);

CREATE TABLE collection_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_type TEXT NOT NULL CHECK (run_type IN ('scheduled', 'manual', 'test')),
  started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running', 'success', 'partial_failed', 'failed')),
  message TEXT
);

CREATE TABLE raw_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER NOT NULL,
  run_id INTEGER,
  post_key TEXT,
  posted_at TEXT,
  collected_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revision_no INTEGER NOT NULL DEFAULT 1,
  title TEXT,
  raw_content_masked TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  parse_status TEXT NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending', 'parsed', 'failed', 'skipped')),
  parse_error TEXT,
  FOREIGN KEY (source_id) REFERENCES sources(id),
  FOREIGN KEY (run_id) REFERENCES collection_runs(id)
);

CREATE UNIQUE INDEX idx_raw_posts_source_post_revision
ON raw_posts(source_id, post_key, revision_no);

CREATE INDEX idx_raw_posts_collected_at ON raw_posts(collected_at);
CREATE INDEX idx_raw_posts_content_hash ON raw_posts(content_hash);

CREATE TABLE species_aliases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL CHECK (category IN ('fish', 'crustacean', 'shellfish', 'salmon', 'other')),
  canonical_name TEXT NOT NULL,
  alias TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX idx_species_aliases_alias ON species_aliases(alias);

CREATE TABLE item_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raw_post_id INTEGER NOT NULL,
  source_id INTEGER NOT NULL,
  market_date TEXT NOT NULL,

  category TEXT NOT NULL CHECK (category IN ('fish', 'crustacean', 'shellfish', 'salmon', 'other')),
  canonical_name TEXT NOT NULL,
  display_name TEXT NOT NULL,

  origin TEXT,
  production_type TEXT,
  freshness_state TEXT,
  grade TEXT,
  size_min_kg REAL,
  size_max_kg REAL,
  unit TEXT NOT NULL DEFAULT 'kg',
  price_per_kg INTEGER,
  price_text TEXT,

  sold_out INTEGER NOT NULL DEFAULT 0,
  event_flag INTEGER NOT NULL DEFAULT 0,
  half_available INTEGER NOT NULL DEFAULT 0,
  packing_note TEXT,
  notes TEXT,

  confidence REAL NOT NULL DEFAULT 0.0,
  llm_raw_json TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (raw_post_id) REFERENCES raw_posts(id),
  FOREIGN KEY (source_id) REFERENCES sources(id)
);

CREATE INDEX idx_item_snapshots_market_date ON item_snapshots(market_date);
CREATE INDEX idx_item_snapshots_name_date ON item_snapshots(canonical_name, market_date);
CREATE INDEX idx_item_snapshots_compare_key
ON item_snapshots(canonical_name, origin, production_type, freshness_state, grade, market_date);

CREATE TABLE insights (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  market_date TEXT NOT NULL,
  insight_type TEXT NOT NULL CHECK (
    insight_type IN (
      'price_drop',
      'price_spike',
      'new_item',
      'sold_out',
      'restocked',
      'lowest_price',
      'vendor_gap',
      'notable'
    )
  ),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'notice', 'warning', 'critical')),
  canonical_name TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_insights_market_date ON insights(market_date);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

---

## 8. 초기 alias seed

`migrations/0002_seed_aliases.sql`

```sql
INSERT INTO species_aliases (category, canonical_name, alias) VALUES
('fish', '광어', '광어'),
('fish', '광어', '황금광어'),
('fish', '광어', '제주광어'),
('fish', '참돔', '참돔'),
('fish', '참돔', '자연산참돔'),
('fish', '참돔', '도미'),
('fish', '감성돔', '감성돔'),
('fish', '돌도다리', '돌도다리'),
('fish', '돌도다리', '도다리'),
('fish', '돌도다리', '가자미'),
('fish', '능성어', '능성어'),
('fish', '농어', '농어'),
('fish', '자바리', '자바리'),
('fish', '점성어', '점성어'),
('fish', '시마아지', '시마아지'),
('fish', '시마아지', '흑점줄전갱이'),
('fish', '줄돔', '줄돔'),
('fish', '돌돔', '돌돔'),
('fish', '잿방어', '잿방어'),
('fish', '부시리', '부시리'),
('salmon', '연어', '연어'),
('shellfish', '전복', '전복'),
('shellfish', '가리비', '가리비'),
('shellfish', '가리비', '홍가리비'),
('shellfish', '가리비', '일산가리비'),
('shellfish', '참소라', '참소라'),
('shellfish', '새조개', '새조개'),
('shellfish', '쭈꾸미', '쭈꾸미'),
('crustacean', '킹크랩', '킹크랩'),
('crustacean', '킹크랩', '블루 킹크랩'),
('crustacean', '킹크랩', '레드 킹크랩'),
('crustacean', '대게', '대게'),
('crustacean', '대게', '마가단 대게');
```

---

## 9. 프로젝트 구조

```text
band-market-watch/
  package.json
  pnpm-workspace.yaml
  README.md

  apps/
    web/
      index.html
      src/
        main.tsx
        App.tsx
        api/client.ts
        pages/
          TodayPage.tsx
          TrendsPage.tsx
          RawPostsPage.tsx
          SettingsPage.tsx
        components/
          PriceTable.tsx
          InsightList.tsx
          SourceStatusCard.tsx

    worker/
      wrangler.toml
      migrations/
        0001_init.sql
        0002_seed_aliases.sql
      src/
        index.ts
        env.ts
        routes/
          health.ts
          sources.ts
          collect.ts
          rawPosts.ts
          market.ts
          insights.ts
          manualUpload.ts
        jobs/
          scheduledCollect.ts
          collectBandPosts.ts
          parseRawPost.ts
          normalizeItems.ts
          generateInsights.ts
          sendDiscord.ts
          purgeRawPosts.ts
        clients/
          bandClient.ts
          llmClient.ts
          discordClient.ts
        lib/
          maskSensitive.ts
          hash.ts
          date.ts
          price.ts
          textSection.ts
          errors.ts
        types/
          domain.ts
          llm.ts
```

---

## 10. 환경변수와 바인딩

### 10.1 Worker secrets

```text
BAND_ACCESS_TOKEN
LLM_PIPELINE_TOKEN
DISCORD_WEBHOOK_URL
ADMIN_TOKEN
```

### 10.2 Worker vars

```text
LLM_PROVIDER=pydantic_ai
LLM_MODEL=gemma-3-27b-it
LLM_PIPELINE_URL=https://YOUR_LLM_PIPELINE_HOST/parse-market-post
APP_TIMEZONE=Asia/Seoul
RAW_POST_RETENTION_DAYS=30
COLLECT_LOOKBACK_HOURS=30
```

### 10.3 wrangler.toml 예시

```toml
name = "band-market-watch-api"
main = "src/index.ts"
compatibility_date = "2026-04-24"

[vars]
LLM_PROVIDER = "pydantic_ai"
LLM_MODEL = "gemma-3-27b-it"
LLM_PIPELINE_URL = "https://YOUR_LLM_PIPELINE_HOST/parse-market-post"
APP_TIMEZONE = "Asia/Seoul"
RAW_POST_RETENTION_DAYS = "30"
COLLECT_LOOKBACK_HOURS = "30"

[[d1_databases]]
binding = "DB"
database_name = "band-market-watch"
database_id = "CHANGE_ME"

[triggers]
crons = ["0 23 * * *"]
```

---

## 11. API 엔드포인트

### 11.1 공개 조회 API

```text
GET /api/health
GET /api/market/today?date=YYYY-MM-DD
GET /api/market/species/:canonicalName?days=30
GET /api/insights?date=YYYY-MM-DD
GET /api/sources/status
```

### 11.2 관리자 API

관리자 API는 `Authorization: Bearer ${ADMIN_TOKEN}` 필요.

```text
POST /api/admin/collect/run
POST /api/admin/collect/test-band
POST /api/admin/manual-post
GET  /api/admin/raw-posts
GET  /api/admin/raw-posts/:id
POST /api/admin/raw-posts/:id/reparse
POST /api/admin/sources
PATCH /api/admin/sources/:id
```

---

## 12. BAND API 수집 로직

### 12.1 우선 검증 작업

OpenCode는 먼저 다음 기능을 구현한다.

```text
POST /api/admin/collect/test-band
```

동작:

1. `Get Bands` 호출
2. D1 `sources.band_key`와 매칭
3. 대상 밴드가 목록에 있는지 확인
4. 있으면 `Get Posts` 호출
5. 최신 게시글 3개를 표시
6. 실패 사유를 명확히 반환

응답 예시:

```json
{
  "ok": true,
  "bands": [
    {
      "sourceId": 1,
      "sourceName": "성전물산",
      "bandKey": "abc",
      "visibleInGetBands": true,
      "canReadPosts": true,
      "latestPostCollectedAt": "2026-04-24T23:00:00.000Z"
    }
  ]
}
```

### 12.2 수집 대상 게시글 필터

오늘 시세표만 수집한다.

조건:

```text
- posted_at 또는 content 안의 날짜가 오늘 KST
- 키워드 포함: 시세, 시세표, 가격알림, 판매 목록, 단가
- 너무 짧은 글 제외
- 댓글/공지성 링크글 제외
```

구독형 밴드가 API에서 안 보이면 해당 source는 `source_mode='manual'`로 둔다.

---

## 13. LLM 파싱 설계

### 13.1 입력 전처리

LLM에 원문 전체를 그대로 넣지 말고, 먼저 코드로 섹션을 줄인다.

제거 후보:

```text
- 주문 방법
- 배송 안내
- 계좌 안내
- 영업시간
- 손질 비용
- 위치
- 카카오톡 링크
- 전화번호
```

남길 후보:

```text
- 국내산/일본산/중국산/노르웨이/러시아 섹션
- 시세표 본문
- kg 단가가 포함된 라인
- 원산지/중량/등급/품절/마감/이벤트 정보
```

### 13.2 JSON Schema

LLM은 반드시 아래 형태만 반환해야 한다.

```ts
export type ParsedMarketPost = {
  vendorName: string | null
  marketDate: string | null // YYYY-MM-DD
  categoryHint: 'fish' | 'crustacean' | 'mixed' | null
  items: ParsedMarketItem[]
  warnings: string[]
}

export type ParsedMarketItem = {
  category: 'fish' | 'crustacean' | 'shellfish' | 'salmon' | 'other'
  canonicalName: string | null
  displayName: string
  origin: string | null
  productionType: string | null // 자연산, 양식 등
  freshnessState: string | null // 활, 선어 등
  grade: string | null // S, SS, SSS, A급, 정품 등
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
```

### 13.3 vendor별 가격 표기

예시 원문별 가격 표기가 다르다.

```text
성전물산: "kg 4.8" -> 48,000원/kg 으로 해석해야 할 가능성이 높음
참조은수산: "18.000원" -> 18,000원/kg
윤호수산: "20000" -> 20,000원/kg
줄포상회: "kg 46,000원" -> 46,000원/kg
```

따라서 `sources.price_notation`을 둔다.

```text
auto:
- "원" 또는 "," 포함 숫자면 won
- "18.000원"은 18000
- "kg 4.8"처럼 소수 1자리이고 20 미만이면 manwon 추정
- vendor가 성전물산이면 manwon 우선

won:
- 숫자 그대로 원 단위

manwon:
- 4.8 -> 48000
- 2.0 -> 20000
```

---

## 14. 정규화 규칙

### 14.1 원산지

```text
국내산, 국산, 통영, 완도, 제주 -> 국내산
일본, 일본산 -> 일본산
중국, 중국산 -> 중국산
노르웨이 -> 노르웨이
러시아 -> 러시아
```

통영/완도/제주는 별도 `region` 필드가 필요할 수 있으나 MVP에서는 `origin=국내산`, `notes`에 지역 유지.

### 14.2 품절/마감

다음 표현은 `sold_out=true`.

```text
마감
품절
완
완료
🚫
❌
```

단, “완도광어”의 “완”은 품절이 아니다.  
정규식에서 단독 토큰 또는 라인 끝의 `완`만 품절로 처리한다.

### 14.3 이벤트

다음 표현은 `event_flag=true`.

```text
이벤트
행사
특가
❤️
‼️
```

### 14.4 중량

```text
2.2-2.5kg -> sizeMinKg=2.2, sizeMaxKg=2.5
3~4k -> sizeMinKg=3, sizeMaxKg=4
3k업 -> sizeMinKg=3, sizeMaxKg=null
700g~1.5k -> sizeMinKg=0.7, sizeMaxKg=1.5
800g -> sizeMinKg=0.8, sizeMaxKg=0.8
```

### 14.5 비교 그룹 키

같은 생선이라도 아래 키가 다르면 다른 셀로 나눈다.

```text
canonical_name
origin
production_type
freshness_state
grade_bucket
size_bucket
```

예:

```text
광어 / 국내산 / 자연산 / null / 일반 / 2~3kg
광어 / 국내산 / 제주 / null / 일반 / 3kg+
광어 / 국내산 / 황금광어 / null / 이벤트 / 2~2.5kg
```

---

## 15. 인사이트 로직

LLM이 직접 판단하지 말고, 먼저 코드로 계산한다.  
LLM은 마지막 설명 문장 다듬기에만 사용한다.

### 15.1 급등락

```text
전일 동일 compare_key 평균가 대비
-15% 이하: price_drop
+15% 이상: price_spike
```

### 15.2 신규 등장

```text
최근 7일 동안 canonical_name + origin + production_type 조합이 없었는데 오늘 등장하면 new_item
```

### 15.3 최저가

```text
최근 14일 동일 compare_key 중 오늘 가격이 최저면 lowest_price
```

### 15.4 판매처 간 가격차

```text
오늘 동일 compare_key 기준
max(price) / min(price) >= 1.2 이면 vendor_gap
```

### 15.5 품절/재입고

```text
어제 sold_out=false, 오늘 sold_out=true -> sold_out
어제 sold_out=true, 오늘 sold_out=false -> restocked
```

---

## 16. Discord 알림 포맷

처음에는 embed 없이 plain text로 충분하다.

예시:

```text
🐟 2026-04-24 노량진 수산 시세 요약

📉 가격 하락
- 자연산 광어: 18,000~20,000원/kg
- 제주 광어: 25,000~31,000원/kg

🦀 갑각류
- 선어 블루 킹크랩: 46,000원/kg
- 활 대게: 28,000~65,000원/kg

🆕 신규/특이
- 성전물산: 제주산 광어 이벤트 표기
- 줄포상회: 꼬물급 선어 레드 킹크랩 등장

⚠️ 마감/품절
- 일부 자연산 감성돔, 시마아지 대형 사이즈 마감

대시보드: ${PUBLIC_DASHBOARD_URL}
```

Webhook 전송 실패 시:

```text
- 429면 retry-after 존중
- 5xx면 3회 exponential backoff
- 실패 내용은 collection_runs.message에 기록
```

---

## 17. 프론트 화면

### 17.1 `/today`

기능:

- 날짜 선택
- 판매처 필터
- 카테고리 필터: 생선/갑각류/조개/연어
- 생선명 검색
- 품절 제외 토글
- 이벤트만 보기 토글

표 구조:

```text
행: canonical_name
열:
- 국내산 자연산
- 국내산 양식/제주/완도/통영
- 일본산
- 중국산
- 노르웨이/러시아
- 최저가
- 판매처 수
- 비고
```

셀 내부에는 여러 조건을 나눠 표시한다.

예:

```text
광어
국내산 자연산:
- 참조은: 18,000원 / 2~3.2kg
- 윤호: 19,000~20,000원 / 2~4kg

국내산 제주:
- 참조은: 25,000~29,000원
- 윤호: 26,000~29,000원
```

### 17.2 `/trends`

기능:

- canonical_name 선택
- 최근 7일/30일 가격 추이
- 판매처별 라인
- 원산지/상태별 필터

차트는 MVP에서는 간단한 테이블로 시작해도 된다.

### 17.3 `/raw-posts`

관리자용.

기능:

- 원문 마스킹 내용 확인
- 파싱 상태 확인
- 파싱 실패 원문 재파싱
- LLM 결과 JSON 확인
- 수동 보정

### 17.4 `/settings`

관리자용.

기능:

- source 등록/수정
- band_key 입력
- price_notation 설정
- active 여부 토글
- Discord 테스트 전송
- BAND API 테스트

---

## 18. 구현 단계

### Phase 1. Cloudflare 뼈대

작업:

1. pnpm monorepo 생성
2. `apps/worker` 생성
3. `apps/web` 생성
4. D1 migration 작성
5. `/api/health` 구현
6. Cloudflare Pages/Workers 로컬 실행 환경 구성

완료 조건:

```text
pnpm dev 로 web/worker 로컬 실행 가능
GET /api/health 응답
D1 local migration 성공
```

### Phase 2. source 관리

작업:

1. `sources` CRUD API 구현
2. 관리자 토큰 인증 구현
3. `/settings` 화면 구현
4. 초기 source seed 작성

초기 source 예시:

```json
[
  {
    "name": "성전물산 밴드",
    "vendorName": "성전물산",
    "vendorType": "fish",
    "sourceMode": "band_api",
    "priceNotation": "manwon"
  },
  {
    "name": "참조은수산 밴드",
    "vendorName": "참조은수산",
    "vendorType": "fish",
    "sourceMode": "band_api",
    "priceNotation": "won"
  },
  {
    "name": "윤호수산 밴드",
    "vendorName": "윤호수산",
    "vendorType": "fish",
    "sourceMode": "band_api",
    "priceNotation": "won"
  },
  {
    "name": "줄포상회 밴드",
    "vendorName": "줄포상회",
    "vendorType": "crustacean",
    "sourceMode": "manual",
    "priceNotation": "won"
  }
]
```

### Phase 3. BAND API 수집 검증

작업:

1. `bandClient.ts` 구현
2. `GET /api/admin/collect/test-band` 구현
3. `Get Bands` 결과와 source 매칭
4. `Get Posts` 최신 3개 가져오기
5. 실패 사유 UI 표시

완료 조건:

```text
대상 밴드별로 API 접근 가능/불가를 화면에서 확인 가능
구독형 밴드는 API 실패 시 manual로 전환 가능
```

### Phase 4. 원문 저장과 마스킹

작업:

1. `maskSensitive.ts` 구현
2. `hash.ts` 구현
3. `raw_posts` 저장 구현
4. 중복/수정 게시글 처리
5. 수동 원문 업로드 API 구현

완료 조건:

```text
BAND API 또는 수동 붙여넣기로 raw_posts 저장 가능
전화번호/계좌번호 마스킹 확인
중복 게시글 재저장 방지
```

### Phase 5. LLM 파싱

작업:

1. `textSection.ts`로 시세표 후보 섹션 추출
2. Worker `llmClient.ts`는 `pydantic_ai` provider adapter로 PydanticAI 파이프라인 HTTP 엔드포인트를 호출
3. `apps/llm-pipeline`에서 PydanticAI Agent와 Google AI Studio `gemma-3-27b-it` 모델로 JSON schema 기반 파싱 프롬프트 작성
4. LLM 응답 validation 구현
5. `item_snapshots` 저장 구현

완료 조건:

```text
샘플 4개 원문이 item_snapshots로 변환됨
가격/원산지/중량/품절 여부가 80% 이상 정확
파싱 실패 시 raw_posts.parse_status='failed'
```

### Phase 6. 정규화

작업:

1. alias 매핑
2. price notation 보정
3. 중량 parser
4. 원산지 표준화
5. sold_out/event_flag parser
6. compare key 유틸 구현

완료 조건:

```text
광어/참돔/능성어/줄돔/킹크랩/대게가 canonical_name 기준으로 묶임
같은 생선이어도 원산지/상태/등급/중량에 따라 셀이 나뉨
```

### Phase 7. 인사이트

작업:

1. 전일 대비 계산
2. 최근 7일 신규 등장 계산
3. 최근 14일 최저가 계산
4. 판매처 간 가격차 계산
5. insights 저장
6. Discord 메시지 생성

완료 조건:

```text
오늘 날짜 기준 insights 생성
Discord 테스트 메시지 전송 가능
```

### Phase 8. Cron 자동화

작업:

1. `scheduled()` handler 구현
2. `scheduledCollect.ts` 구현
3. `wrangler.toml` cron 등록
4. run log 저장
5. 실패 시 partial_failed 처리

완료 조건:

```text
wrangler dev --test-scheduled 로 로컬 테스트 가능
Cloudflare 배포 후 매일 KST 08:00 실행
```

### Phase 9. 대시보드

작업:

1. `/today` 구현
2. `/trends` 구현
3. `/raw-posts` 구현
4. `/settings` 구현
5. 기본 반응형 UI 적용

완료 조건:

```text
오늘 시세표를 생선명 기준으로 볼 수 있음
원산지/상태별로 셀이 분리됨
인사이트와 Discord 결과를 대시보드에서 확인 가능
```

---

## 19. 테스트 케이스

### 19.1 가격 파싱

```text
"kg 4.8" + priceNotation=manwon -> 48000
"18.000원" -> 18000
"20.000원" -> 20000
"20000" + priceNotation=won -> 20000
"kg 46,000원" -> 46000
"‼️‼️‼️ 20.000원‼️‼️‼️" -> 20000
```

### 19.2 중량 파싱

```text
"2.2-2.5kg" -> 2.2, 2.5
"3~4k" -> 3, 4
"3k업" -> 3, null
"700g~1.5k" -> 0.7, 1.5
"800g" -> 0.8, 0.8
```

### 19.3 품절 파싱

```text
"자연산참돔3kㅡ16000완" -> sold_out=true
"완도광어3kㅡ31000" -> sold_out=false
"❌마감" -> sold_out=true
"🚫 표시 품절" -> sold_out=true
```

### 19.4 alias

```text
"제주광어" -> canonical_name="광어"
"황금광어" -> canonical_name="광어"
"흑점줄전갱이" -> canonical_name="시마아지"
"블루 킹크랩" -> canonical_name="킹크랩"
"마가단 대게" -> canonical_name="대게"
```

---

## 20. 보안

필수:

```text
- BAND_ACCESS_TOKEN은 secret으로만 저장
- Discord Webhook URL은 secret으로만 저장
- ADMIN_TOKEN 없는 관리자 API 차단
- CORS는 Pages 도메인만 허용
- raw_content 원문에는 전화번호/계좌 마스킹
- 오류 응답에 secret 노출 금지
```

---

## 21. 운영 리스크와 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| BAND API에서 구독형 밴드 미노출 | 자동 수집 불가 | manual source로 전환 |
| BAND API 토큰 만료/철회 | 수집 중단 | 관리자 화면에서 토큰 상태 점검 |
| 시세글 포맷 변경 | 파싱 실패 | raw-posts 재파싱/수동 보정 |
| LLM 비용 증가 | 운영비 증가 | 시세표 후보 섹션만 LLM에 전달 |
| Cloudflare CPU time 초과 | cron 실패 | 밴드별 순차 처리, 파싱 최소화 |
| Discord rate limit | 알림 실패 | retry-after 처리 |
| 약관 리스크 | 서비스 중단 가능성 | 원문 재배포 금지, 구조화 데이터 중심, 판매자 허락 검토 |

---

## 22. OpenCode 작업 지시

아래 순서대로 구현하라.

1. `band-market-watch` pnpm monorepo를 생성한다.
2. `apps/worker`에 Cloudflare Workers TypeScript 프로젝트를 만든다.
3. `apps/web`에 Vite React TypeScript 프로젝트를 만든다.
4. D1 migration `0001_init.sql`, `0002_seed_aliases.sql`을 작성한다.
5. Worker에 `/api/health`를 구현한다.
6. 관리자 인증 middleware를 구현한다.
7. `sources` CRUD API와 `/settings` 화면을 구현한다.
8. `bandClient.ts`를 구현하고 `Get Bands`, `Get Posts` 호출 함수를 만든다.
9. `/api/admin/collect/test-band`를 구현한다.
10. `maskSensitive.ts`, `hash.ts`를 구현한다.
11. raw post 저장 로직과 manual upload API를 구현한다.
12. LLM adapter를 구현한다.
13. LLM JSON schema validation을 구현한다.
14. 샘플 원문 4개를 fixture로 추가한다.
15. fixture 기반 parser 테스트를 작성한다.
16. `normalizeItems.ts`를 구현한다.
17. `generateInsights.ts`를 구현한다.
18. `sendDiscord.ts`를 구현한다.
19. `scheduledCollect.ts`와 Worker `scheduled()` handler를 구현한다.
20. `/today`, `/trends`, `/raw-posts`, `/settings` 프론트를 구현한다.
21. README에 로컬 실행, D1 migration, secrets 설정, deploy 절차를 작성한다.

---

## 23. 최종 완료 기준

MVP 완료 조건:

```text
- 관리자 화면에서 source 4개 등록 가능
- BAND API 접근 가능한 source는 최신 게시글 수집 가능
- API 접근 불가 source는 수동 붙여넣기로 원문 등록 가능
- 원문은 마스킹되어 raw_posts에 저장됨
- 샘플 4개 원문에서 item_snapshots가 생성됨
- 광어/참돔/능성어/킹크랩/대게 기준 정규화 표시 가능
- 오늘 시세 대시보드 표시 가능
- 급등락/신규/품절/최저가 인사이트 생성 가능
- Discord Webhook으로 요약 메시지 전송 가능
- Cloudflare Cron Trigger로 KST 08:00 자동 실행 가능
```

---

## 24. 나중에 확장할 것

- Cloudflare Queues 또는 Workflows로 긴 파싱 작업 분리
- R2에 원문 archive 저장
- 판매자별 신뢰도/파싱 정확도 점수
- 가격 예측
- “오늘 사기 좋은 생선” 추천
- 텔레그램/카카오톡 알림
- 판매자 직접 입력 폼
- 이미지 첨부 시 OCR 파싱
- 품목명 alias 관리자 편집 UI
