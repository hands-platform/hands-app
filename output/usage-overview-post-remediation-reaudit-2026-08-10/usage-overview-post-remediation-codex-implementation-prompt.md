# Codex 실행 프롬프트 — Customer Usage 최종 운영 신뢰성·화면 완성도 개선

아래 `프롬프트 시작`부터 `프롬프트 끝`까지 전체를 `C:\dev\massage-on-demand-vn` 프로젝트를 연 Codex 작업에 그대로 전달한다.

---

## 프롬프트 시작

`C:\dev\massage-on-demand-vn` 프로젝트의 관리자 `Customer Usage` 페이지를 최종 수정하라.

대상 URL:

- `http://localhost:3101/usage-overview`
- 주요 검증 상태: `?range=today`, `?range=30d`, 정상 Custom, 잘못된 Custom

이 작업은 추가 감사 보고서 작성이 아니라 **현재 코드 수정, 테스트, 로그인된 브라우저 검증까지 완료하는 구현 작업**이다. 계획만 제시하고 멈추지 말고, 안전한 범위에서 직접 구현하고 검증하라.

## 1. 최종 목표

운영자가 이 페이지를 열었을 때 다음을 정확히 판단할 수 있어야 한다.

1. 선택 기간에 실제 production 고객과 booking이 얼마나 활동했는가?
2. 어떤 고객과 booking을 지금 검토해야 하는가?
3. Action 카드의 수와 도착 목록의 total이 정확히 일치하는가?
4. booking outcome이 같은 created cohort 안에서 reconcile되는가?
5. 각 데이터 source는 어느 시각까지 반영됐으며 지연 상태인가?
6. fixture/synthetic 데이터가 실제로 제외됐는가, 아니면 아직 보장되지 않았는가?
7. 1440px 운영 화면에서 잘리거나 세로로 찢어지는 문구 없이 빠르게 읽을 수 있는가?

현재 구현의 좋은 구조를 유지하면서 아래 남은 결함을 해결하라. 새 디자인 세계를 만들거나 페이지를 전면 재작성하지 말고, 기존 HANDS Admin 디자인 시스템 안에서 production hardening을 수행하라.

## 2. 반드시 먼저 읽고 확인할 자료

작업 전에 다음을 순서대로 읽고 현재 코드와 대조하라.

1. 저장소에 적용되는 모든 `AGENTS.md`
2. `output/usage-overview-post-remediation-reaudit-2026-08-10/usage-overview-post-remediation-deep-reaudit-report.md`
3. 감사 캡처
   - `output/usage-overview-post-remediation-reaudit-2026-08-10/01-today-top-1440.png`
   - `output/usage-overview-post-remediation-reaudit-2026-08-10/03-30d-actions-kpis-reach-1440.png`
   - `output/usage-overview-post-remediation-reaudit-2026-08-10/04-30d-outcomes-trends-1440.png`
   - `output/usage-overview-post-remediation-reaudit-2026-08-10/05-30d-customer-base-ranking-1440.png`
   - `output/usage-overview-post-remediation-reaudit-2026-08-10/07-30d-services-regions-detail-1440.png`
   - `output/usage-overview-post-remediation-reaudit-2026-08-10/08-action-new-unbooked-destination-1440.png`
   - `output/usage-overview-post-remediation-reaudit-2026-08-10/09-action-unresolved-booking-destination-1440.png`
   - `output/usage-overview-post-remediation-reaudit-2026-08-10/10-custom-valid-top-1440.png`
   - `output/usage-overview-post-remediation-reaudit-2026-08-10/11-custom-invalid-top-1440.png`
   - `output/usage-overview-post-remediation-reaudit-2026-08-10/12-30d-dark-top-1440.png`
4. 주요 구현 파일과 관련 caller/spec
   - `apps/admin_web/app/usage-overview/page.tsx`
   - `apps/admin_web/app/usage-overview/usage-overview-model.ts`
   - `apps/admin_web/app/usage-overview/usage-overview-trend-chart.tsx`
   - `apps/admin_web/app/usage-overview/page.spec.tsx`
   - `apps/admin_web/app/usage-overview/usage-overview-model.spec.ts`
   - `apps/admin_web/app/globals.css`
   - `apps/admin_web/lib/admin-api.ts`
   - `apps/admin_web/components/admin-filter-summary.tsx`
   - `apps/admin_web/components/admin-filter-panel.tsx`
   - `apps/admin_web/components/admin-overview-card.tsx`
   - `apps/api/src/admin/admin-usage-overview.ts`
   - `apps/api/src/admin/admin-usage-overview-query.ts`
   - `apps/api/src/admin/admin-usage-overview.spec.ts`
   - `apps/api/src/admin/admin-usage-overview-query.spec.ts`
   - `apps/api/src/app-usage/app-usage-daily-aggregate.ts`
   - `apps/api/src/app-usage/app-usage-daily-aggregate.spec.ts`
   - `apps/api/src/users/users.service.ts`
   - `apps/api/src/customers/customers.service.ts`
   - `apps/api/prisma/schema.prisma`
   - AppUsageEvent/aggregate를 생성하는 seed, smoke, audit writer
   - Customers/Bookings action 대상 목록의 href builder, parser, API query, 관련 spec
   - Vietnam Overview의 period parser와 href contract

보고서의 line number는 이후 변경으로 달라질 수 있다. line number만 믿지 말고 symbol과 실제 DOM을 다시 찾는다. 보고서와 현재 코드가 다르면 현재 코드·실행 증거를 우선하되, 아래 운영 수용 기준은 유지한다.

## 3. 작업 원칙과 변경 경계

### 반드시 지킬 것

- 시작 시 `git status --short`와 관련 diff를 확인하고 사용자의 기존 변경을 보존한다.
- dirty worktree를 초기화하거나 unrelated 변경을 되돌리지 않는다.
- 변경은 Usage Overview, provenance writer/aggregate, 직접 연결된 target contract와 테스트로 제한한다.
- 기존 Admin component, token, Recharts, date control, href/query builder를 재사용한다.
- 새로운 UI/chart/date/analytics dependency를 추가하지 않는다.
- 새 BI 도구, materialized view, 별도 analytics service를 성급히 도입하지 않는다.
- 1440×900 데스크톱을 화면 수용 기준으로 사용한다.
- 1024px 이하 화면은 분석·수정·완료 보고 범위에 넣지 않는다.
- 이름, 전화번호, 화면 label, ID prefix로 fixture를 판별하지 않는다.
- 고객 전화번호 원문을 API로 보낸 뒤 UI에서만 가리는 방식을 사용하지 않는다.
- production 데이터나 fixture row를 자동 삭제하지 않는다.
- migration 또는 derived aggregate 재구성이 필요하면 비파괴적이고 되돌릴 수 있게 설계한다.
- 운영 데이터 backfill/rebuild는 dry-run과 명시적 실행 단계를 제공하고 자동 실행하지 않는다.
- 실제 provenance가 보장되지 않았는데 `Synthetic usage excluded`라고 표시하지 않는다.
- source freshness가 아닌 최신 business row timestamp를 ingestion freshness처럼 포장하지 않는다.
- Action source count와 target total의 기존 일치 계약을 깨지 않는다.
- 고객 단위 reach를 booking record conversion으로 다시 사용하지 않는다.
- booking outcome 1건이 둘 이상의 terminal bucket에 포함되지 않게 한다.
- API failure를 0건으로 바꾸지 않는다.
- 성능 측정 없이 cache/index/materialized view부터 추가하지 않는다.
- unrelated Finance TypeScript 오류를 이 작업의 일부로 임의 수정하지 않는다.

### 작업 진행 방식

1. 현재 화면과 코드 흐름을 재현한다.
2. 짧은 구현 계획을 내부적으로 세운다.
3. P0 → P1 → P2 순서로 구현한다.
4. 각 단계에서 가장 작은 관련 테스트를 실행한다.
5. 마지막에 1440×900 로그인 브라우저에서 동일 상태를 다시 캡처한다.
6. 수용 기준을 하나씩 대조한 뒤 완료 여부를 판단한다.

## 4. 보존해야 하는 현재 개선 사항

아래는 이미 잘 구현됐으므로 회귀시키지 않는다.

- Needs attention에는 값이 1 이상인 실제 trigger만 표시한다.
- `New customers without a booking` action은 source 기간을 가진 `usage-new-unbooked` 대상 목록으로 이동한다.
- `Unresolved booking records` action은 source 기간을 가진 `usage-unresolved` 대상 목록으로 이동한다.
- 현재 로컬 기준 action parity는 고객 `9 → 9`, booking `1 → 1`이다. 데이터가 바뀌더라도 source와 target total은 항상 같아야 한다.
- unique-customer reach와 booking record outcomes가 분리돼 있다.
- booking outcomes는 created cohort의 mutually exclusive current status이며 합계가 created count와 일치한다.
- customer activity와 booking activity chart가 다른 Y축을 사용한다.
- period customer와 current customer snapshot이 분리돼 있다.
- Customer/Partner ranking table은 각각 full-width다.
- 전화번호는 API mapping 단계에서 마스킹된다.
- invalid Custom은 조용히 보정되지 않고 명시적으로 거부된다.
- 0건 chart, denominator 0, retention eligible 0이 empty/N/A로 구분된다.
- UI에서 `range=all`을 다시 도입하지 않는다.

## 5. P0 — Production provenance를 실제로 보장한다

현재 가장 중요한 미완료 항목이다. 단순히 warning 문구를 지우거나 `usageFixtures` 값을 강제로 바꾸지 마라.

### 현재 문제

- `AppUsageEvent`에는 metadata가 있지만 `AppUsageDailyAggregate`에는 provenance가 없다.
- aggregate unique key가 `[userId, role, day]`라 production과 synthetic signal이 같은 row에 섞일 수 있다.
- event writer가 aggregate input으로 eventType/occurredAt/role/userId만 전달해 metadata 또는 trusted origin이 사라진다.
- Usage Overview의 여러 query가 `AppUsageDailyAggregate`를 조건 없이 합산한다.
- 일부 raw event query만 metadata 기반 synthetic 제외를 수행한다.
- booking은 명시적인 metadata marker가 있는 경우만 제외하므로 legacy unmarked fixture 상태가 남을 수 있다.
- 현재 API가 `usageFixtures: 'not-guaranteed'`를 반환하고 실제 ranking이 Demo/Smoke 형태의 데이터에 의해 지배된다.

### 구현 요구

1. 먼저 모든 AppUsageEvent writer를 조사한다.
   - client 요청으로 생성되는 정상 production event
   - seed/smoke/audit/test writer
   - 내부 admin 또는 batch writer
2. provenance는 server-owned 값이어야 한다.
   - client가 임의 metadata로 `PRODUCTION`을 주장할 수 없게 한다.
   - smoke/audit/test writer는 명시적으로 `SYNTHETIC`을 설정한다.
   - origin이 확인되지 않는 기존 데이터는 `UNKNOWN`으로 취급한다.
3. `AppUsageDailyAggregate`가 production과 synthetic을 구분할 수 있는 최소 schema/aggregate 계약을 구현한다.
   - 가능한 설계: 명시적 origin column을 추가하고 unique/index를 origin까지 포함한다.
   - 다른 더 작은 설계가 실제 writer와 조회 계약을 안전하게 만족한다면 사용할 수 있지만, production/synthetic이 같은 aggregate row에 섞이면 안 된다.
4. Usage Overview production query는 명시적으로 production aggregate만 읽는다.
5. current customer base, funnel, trend, customer ranking 등 aggregate를 사용하는 모든 영역에 같은 조건을 적용한다.
6. raw AppUsageEvent query와 aggregate query가 같은 trusted origin 규칙을 사용한다.
7. booking/payment/refund/review 관련 fixture 제외도 기존 explicit metadata helper를 재사용한다.
8. 이름/ID prefix 기반 legacy fixture helper를 Usage Overview에 새로 사용하지 않는다.
9. 기존 aggregate를 안전하게 다룰 재구성 절차를 추가한다.
   - max report range가 90일인 현재 계약을 고려한다.
   - raw event에서 production-only aggregate를 다시 계산할 수 있는 idempotent script 또는 service를 제공한다.
   - dry-run에서 대상 기간, event 수, 영향 aggregate row 수를 출력한다.
   - 명시적 apply flag 없이는 DB를 변경하지 않는다.
   - 기존 데이터를 삭제하는 방식보다 transaction 안에서 derived row를 재구성하거나 교체하는 회복 가능한 방식을 우선한다.
10. schema migration이 필요하면 Prisma migration, writer, query, spec을 함께 수정한다.
11. provenance가 실제 보장된 환경에서만 API가 `guaranteed` 상태를 반환한다.
12. UNKNOWN/미완료 상태에서는 화면 상단에 별도 data-trust notice를 표시한다.
   - 예: `Usage provenance is incomplete. Do not use these totals for production decisions.`
   - 이 경고를 scope 문자열 맨 끝에 숨기지 않는다.

### P0 테스트

- production event만 production aggregate에 반영된다.
- synthetic event는 production aggregate에 반영되지 않는다.
- 같은 user/day에 production과 synthetic event가 있어도 production count가 오염되지 않는다.
- UNKNOWN aggregate가 production dashboard에 조용히 포함되지 않는다.
- production/synthetic mixed fixture에서 KPI, funnel, trend, customer/Partner/service/region ranking이 모두 같은 provenance 계약을 따른다.
- client-supplied metadata만으로 production origin을 위조할 수 없다.
- rebuild dry-run은 DB를 변경하지 않는다.
- API가 보장되지 않은 상태에서 `Synthetic usage excluded`를 반환하지 않는다.

## 6. P1 — Scope summary overflow를 수정한다

### 현재 재현

- 1440px에서 `AdminFilterSummary` width가 약 1,138px이고 부모 body는 약 1,079px다.
- period, granularity, comparison, data through, provenance를 한 문자열로 join해 오른쪽 경고가 잘린다.
- Today, 30 days, valid Custom, dark theme에서 모두 재현된다.

### 구현 요구

1. 모든 metadata를 한 문자열로 join하지 않는다.
2. 다음처럼 정보 계층을 분리한다.
   - primary scope: `12 Jul–10 Aug 2026 · 30 days · Vietnam time`
   - secondary metadata: `Daily`, `Compared with 12 Jun–11 Jul`, `Data through …`
   - 독립 trust notice: provenance status
3. `AdminFilterSummary`가 여러 label을 지원한다면 그 기능을 재사용한다. 공용 component를 바꿀 경우 모든 caller를 검색하고 회귀 테스트를 추가한다.
4. Usage 전용 wrapper로 해결할 수 있다면 공용 API를 불필요하게 확장하지 않는다.
5. 실제 shrink item에 `min-width: 0`, `max-width: 100%`, wrapping을 적용한다.
6. 긴 날짜·번역·warning에서도 부모 card를 넘지 않게 한다.
7. ellipsis로 핵심 provenance/freshness 경고를 숨기지 않는다.

### 수용 기준

- 1440×900에서 document 및 filter card 내부 horizontal overflow가 없다.
- summary의 모든 문구가 보이거나 정상적인 행 단위로 wrapping된다.
- provenance warning은 독립된 notice로 즉시 보인다.
- light/dark theme 모두 동일하게 안정적이다.

## 7. P1 — Popular services / Top regions 레이아웃을 수정한다

### 현재 재현

- 두 card는 약 688px / 413px 폭으로 배치된다.
- 공통 `.usage-overview-compact-row`가 `44px minmax(0,1fr) auto auto`를 사용한다.
- 지역 card에서 두 긴 auto metric이 공간을 차지해 지역명 column이 0px가 된다.
- `Ho Chi Minh City`가 한 글자씩 세로로 표시된다.
- 오른쪽 row가 276px로 늘어나 왼쪽 service card도 431px 높이로 stretch되며 큰 빈 공간이 생긴다.

### 구현 요구

1. `PopularServices`와 `RegionTopFive`가 동일한 row layout class를 공유하지 않게 한다.
2. section card 자체는 1440px에서 현재의 넓은 service / 좁은 region 2열 구성을 유지해도 되지만 `align-items: start`로 불필요한 equal-height stretch를 제거한다.
3. Service row 권장 구조:
   - rank
   - service name + duration
   - booking count
   - amount
4. Region row 권장 구조:
   - 첫 줄: short code + full region name
   - 둘째 줄: created / completed
   - 셋째 줄: non-completed / unresolved
   - 긴 metric은 2열 또는 wrapping 가능한 block으로 배치
5. 지역명은 한 줄 또는 정상적인 단어 단위 최대 2줄로 표시한다.
6. 어떤 text column도 0px가 되지 않게 한다.
7. service/region row가 비어 있을 때 compact empty state가 card 높이를 과도하게 늘리지 않게 한다.
8. 5개 row, 긴 지역명, 큰 금액, 큰 숫자에서도 검증한다.

### 수용 기준

- `Ho Chi Minh City`가 문자 단위로 찢어지지 않는다.
- service card에 내용과 무관한 큰 빈 공간이 없다.
- 두 card의 금액과 outcome text가 card 밖으로 넘치지 않는다.
- 1440×900 light/dark 화면에서 동일하게 통과한다.

## 8. P1 — Freshness 계약을 source별로 정확하게 만든다

### 현재 문제

- `dataThroughAt`은 usage aggregate, booking, review, refund에서 얻은 timestamp의 단일 `MAX`다.
- 하나의 source만 최신이어도 전체 report가 최신처럼 보일 수 있다.
- booking의 최신 business row timestamp는 ingestion pipeline watermark와 같은 개념이 아니다.
- 화면에는 `Data through 7 Aug`가 보이는데 current base는 `As of now`, `Seen today`라고 표시한다.
- `generatedAt`은 API에 있지만 화면에 표시되지 않는다.
- Refresh는 같은 URL 링크이며 fetch는 60초 revalidation을 사용해 실제 갱신 여부가 보이지 않는다.

### 구현 요구

1. 먼저 각 source에서 실제로 의미 있는 freshness timestamp가 무엇인지 확인한다.
   - usage aggregate: latest aggregate `lastOccurredAt` 또는 명시적 aggregation watermark
   - booking/review/refund: 이것이 별도 ingestion source가 아니라 같은 transactional DB라면 `latest record activity`라고 명명하고 pipeline freshness라고 부르지 않는다.
2. API에 source별 freshness 구조를 추가한다. 기존 caller 호환성이 필요하면 `generatedAt`/`dataThroughAt`을 즉시 제거하지 말고 새 구조로 점진적으로 이동한다.
3. 권장 shape:

```ts
freshness: {
  reportGeneratedAt: string;
  usageAggregatedThroughAt: string | null;
  bookingActivityThroughAt: string | null;
  reviewActivityThroughAt: string | null;
  refundActivityThroughAt: string | null;
  usageStatus: 'fresh' | 'delayed' | 'unknown';
}
```

4. 저장소에 기존 SLA/freshness 정책이 있으면 재사용한다.
5. 기존 정책이 없다면 daily aggregate에만 이름 있는 threshold constant를 사용하고 코드/테스트에 근거를 기록한다. 임시 기준을 숨기지 않는다.
6. transaction table의 latest row가 오래됐다는 이유만으로 pipeline delayed라고 단정하지 않는다. “최근 qualifying activity 없음”과 “source 지연”을 구분한다.
7. 화면에 최소 다음을 표시한다.
   - `Report generated … ICT`
   - `Usage aggregated through … ICT`
   - delayed/unknown이면 독립 warning
8. current base title과 label을 freshness에 맞춘다.
   - `Current customer base · As of usage data through …`
   - source가 최신임이 보장될 때만 `As of now`
9. Refresh를 실제 route refresh 동작으로 만든다.
   - 현재 router/cache 구조를 조사하고 `router.refresh()` 또는 기존 Admin refresh pattern을 재사용한다.
   - double click을 방지하고 갱신 중 상태를 표시한다.
   - 완료 후 report-generated time 변화로 갱신을 확인할 수 있게 한다.
10. API unavailable, freshness unknown, stale source를 각각 다른 상태로 유지한다.

### 수용 기준

- 한 source의 최신 timestamp가 다른 source의 지연을 숨기지 않는다.
- 3일 전 usage aggregate가 현재 시각처럼 보이지 않는다.
- `As of now`와 `Data through`가 모순되지 않는다.
- Refresh 후 operator가 보고서가 다시 생성됐는지 확인할 수 있다.
- unavailable/unknown/delayed/fresh 상태가 테스트된다.

## 9. P1 — Customer ranking의 `Issues` 의미를 명확히 한다

현재 `issueCount`는 selected period에 `closedAt`이 들어온 cancelled/no-show/expired/refunded booking 수다. 상단의 “selected period에 created된 cohort의 current outcomes”와 다른 집합이다.

이 작업에서는 query 의미를 임의로 바꾸기보다 현재 값의 의미를 정확히 노출하는 최소 수정을 우선한다.

1. table header `Issues`를 `Closed issue outcomes`처럼 구체적으로 변경한다.
2. section description에 다음을 명시한다.
   - selected period의 `closedAt` 기준
   - 포함 status: cancelled, no-show, expired, refunded
   - 상단 created cohort와 직접 합계 비교할 수 없는 별도 signal
3. 필요하면 header에 짧은 accessible explanation 또는 tooltip을 제공한다.
4. API/type 명칭은 caller 영향이 크면 호환성을 유지하되 UI model에서 명확히 매핑한다.
5. 1,088 같은 큰 값이 834 created cohort보다 커도 source mismatch처럼 보이지 않게 설명한다.

테스트는 status 포함 범위와 `closedAt` 기간 조건을 고정한다.

## 10. P1 — Invalid Custom 상태의 잘못된 provenance 문구를 수정한다

현재 validation error이면 `overview === null`인데 조건문의 else branch 때문에 `Synthetic usage excluded`가 표시된다.

수정 요구:

- validation error 또는 overview 미로드 상태에서는 provenance를 주장하지 않는다.
- summary에는 `Report not loaded` 또는 period validation 상태만 표시한다.
- `Synthetic usage excluded`는 실제 API 응답이 guaranteed 상태일 때만 표시한다.
- inline field error는 유지한다.
- 큰 error state가 같은 문장을 단순 반복하지 않도록 다음 행동을 알려준다.
  - 예: `Correct the dates, then apply the period again.`
- invalid 입력값은 그대로 보존한다.
- invalid request가 Admin usage API를 호출하지 않는 기존 동작을 유지한다.

## 11. P2 — 접근성·문구·연결 완성도

### 차트 접근성

- 각 chart summary에 고유 id를 부여한다.
- chart `role="img"`를 해당 summary와 `aria-describedby`로 연결한다.
- exact daily/hourly 값이 운영 판단에 필요하므로 `View chart data` disclosure 안에 semantic table을 제공한다.
- disclosure는 기본적으로 접혀 있어 페이지 길이를 늘리지 않게 한다.
- line/legend는 색상 외에 text label로도 구분된다.

### 문구

- `Review 1 bookings` → `Review 1 booking`
- plural helper를 customer/booking/queue에 재사용한다.
- range tab `Month` → `This month`
- `Use Last 7 days` → `Use last 7 days`
- `Current customer base · As of now`를 실제 freshness 계약에 맞게 수정한다.
- `Cohort reconciled` 근처에서 “합계 검증”과 “production provenance”가 다른 개념임을 혼동하지 않게 한다.

### Vietnam Overview 연결

- Today/Yesterday/7d/30d의 기존 period deep link를 유지한다.
- Month/Custom도 같은 applied from/to를 전달할 수 있는지 Vietnam Overview parser를 확인한다.
- 지원하지 않는 query를 만들지 않는다.
- 필요한 경우 target parser/href builder를 최소 확장하고 source/target 날짜 일치 테스트를 추가한다.

## 12. 성능 범위

감사에서 로컬 navigation은 약 116–184ms였고 즉시 병목은 재현되지 않았다. 따라서 provenance/레이아웃보다 먼저 새로운 cache, index, materialized view를 추가하지 않는다.

다만 변경 후 다음을 기록한다.

- Usage API 전체 duration
- 실행되는 query 수
- 가장 느린 query가 확인 가능하면 그 duration
- cache/revalidation 동작
- 30 days 화면 DOM element 및 document height가 비정상적으로 증가하지 않았는지

DB 최적화가 필요하다고 판단하면 실제 `EXPLAIN (ANALYZE, BUFFERS)` 또는 slow query evidence를 먼저 제시한다. 증거 없이 schema/index를 추가하지 않는다.

## 13. 필수 테스트

기존 테스트를 수정하고 필요한 spec을 추가한다.

### Admin Web

1. scope metadata가 하나의 긴 문자열로 합쳐지지 않음
2. invalid Custom에서 provenance 미표시 및 API 미호출
3. guaranteed일 때만 `Synthetic usage excluded`
4. unknown/delayed provenance notice
5. source별 freshness와 current-base copy
6. Refresh 동작과 loading/완료 상태
7. 단수/복수 문구
8. chart summary `aria-describedby`
9. chart data disclosure/table
10. service/region 전용 class와 구조
11. Customer `Closed issue outcomes` 설명
12. Action href/count contract 회귀 없음

### API

1. trusted production/synthetic/unknown event origin
2. aggregate가 origin별로 분리되거나 production-only로 안전하게 유지됨
3. mixed-origin user/day에서 production count 오염 없음
4. all aggregate-backed usage queries가 production contract를 사용함
5. source별 freshness mapping
6. booking outcome reconcile 유지
7. phone masking 유지
8. action source query와 target query의 DB-level parity
9. aggregate rebuild dry-run/apply guard
10. client origin spoof 방지

### 최소 실행 명령

실제 package script를 확인한 뒤 다음 focused test를 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/usage-overview/usage-overview-model.spec.ts app/usage-overview/page.spec.tsx app/customers/customer-filters.spec.ts app/bookings/booking-page-params.spec.ts
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-usage-overview.spec.ts src/admin/admin-usage-overview-query.spec.ts src/admin/admin-booking-list-query.spec.ts src/app-usage/app-usage-daily-aggregate.spec.ts
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run typecheck --workspace @massage-vn/admin-web
```

AppUsageEvent writer를 수정했다면 users/customers 및 해당 writer의 focused spec도 실행한다. Prisma schema를 수정했다면 generate/migration validation을 실행한다.

현재 Admin Web typecheck에는 Finance Tax 관련 baseline 오류가 있을 수 있다. 작업 시작 시 baseline을 확인하고 다음을 지킨다.

- unrelated Finance 파일을 이 작업에서 수정하지 않는다.
- 변경 전후 오류 목록을 비교한다.
- Usage 관련 신규 TypeScript 오류가 0개임을 확인한다.
- 전체 typecheck가 실패하면 기존 오류와 신규 오류를 구분해 최종 보고한다.

## 14. 로그인 브라우저 최종 검증

코드와 unit test만 보고 완료하지 말고 로그인된 관리자 브라우저에서 직접 검증한다.

viewport는 1440×900으로 고정한다.

### 필수 상태

1. Today empty state
2. 30 days top/scope/trust notice
3. 30 days Needs attention 및 KPI
4. Booking outcomes와 두 trend chart
5. Period customers / retention / current base
6. Customer/Partner full-width ranking
7. Popular services / Top regions
8. valid Custom
9. From > To Custom
10. future Custom
11. 90일 초과 Custom
12. dark theme 30 days
13. Usage API unavailable 상태
14. provenance guaranteed / unknown 상태를 가능한 fixture로 검증

### Action parity

- `New customers without a booking` 클릭
  - target active filter가 source 기간과 segment를 표시하는지
  - source count = target total인지
- `Unresolved booking records` 클릭
  - target active filter가 source 기간과 unresolved 조건을 표시하는지
  - source count = target total인지

### DOM/시각 수용 검사

- filter scope summary와 부모 card의 `scrollWidth <= clientWidth`
- document horizontal overflow 없음
- region name text column width > 0
- `Ho Chi Minh City` 문자 단위 줄바꿈 없음
- service/region card의 비정상 equal-height 빈 공간 없음
- phone 원문 노출 없음
- invalid Custom에서 `Synthetic usage excluded` 없음
- current base의 as-of 문구가 usage freshness와 일치
- chart summary가 accessibility tree에서 연결됨
- 브라우저 runtime error 없음

검증 캡처는 다음 폴더에 저장한다.

`output/usage-overview-final-hardening-validation-YYYY-MM-DD/`

## 15. 완료 조건

다음 조건을 모두 충족하기 전에는 “완료”라고 말하지 않는다.

- production usage aggregate provenance가 코드와 테스트로 보장된다.
- unknown/legacy aggregate가 production 통계에 조용히 포함되지 않는다.
- synthetic writer가 server-owned origin을 기록한다.
- rebuild/backfill 절차는 dry-run과 explicit apply를 지원하며 자동 실행되지 않는다.
- guaranteed가 아닌 상태에서 `Synthetic usage excluded`가 표시되지 않는다.
- scope summary가 1440px에서 잘리지 않는다.
- provenance warning이 독립적으로 보인다.
- Top regions 지역명이 정상적으로 읽힌다.
- Popular services에 큰 빈 공간이 없다.
- source별 freshness가 서로의 지연을 숨기지 않는다.
- `Report generated`와 usage data-through가 구분된다.
- current base의 as-of 문구가 freshness와 모순되지 않는다.
- Customer `Issues`의 timestamp/cohort/status 정의가 명확하다.
- invalid Custom은 API를 호출하지 않고 provenance를 주장하지 않는다.
- chart summary와 exact data에 비시각적으로 접근할 수 있다.
- 기존 action count parity와 booking outcome reconcile이 유지된다.
- API 및 관련 Admin focused tests가 통과한다.
- Usage 관련 신규 type error가 없다.
- 1440×900 light/dark 브라우저 캡처로 시각 수용 기준을 확인했다.

P0 provenance가 migration/backfill 권한 때문에 실제로 끝나지 않았다면 UI/CSS만 완료한 뒤 전체 작업이 끝났다고 보고하지 않는다. 구현 가능한 code/migration/dry-run/test까지 마치고, 실행되지 않은 외부 데이터 적용 단계와 정확한 명령·영향 범위를 blocker로 보고한다.

## 16. 최종 응답 형식

최종 응답은 다음 순서로 작성한다.

1. 운영자 관점에서 달라진 결과
2. provenance 설계와 production/synthetic/unknown 처리
3. migration 및 aggregate rebuild/backfill 파일과 실제 실행 여부
4. freshness API와 화면 문구 변경
5. 1440px scope 및 service/region 레이아웃 결과
6. Customer issue column과 chart 접근성 변경
7. Action source/target parity 결과
8. 변경 파일 목록
9. 실행한 테스트/typecheck와 결과
10. 브라우저 검증 상태와 스크린샷 경로
11. 남은 blocker 또는 미적용 external step

“개선했습니다”라는 요약만 쓰지 말고 다음 증거를 포함한다.

- provenance 상태
- 적용 range와 freshness timestamp
- action source count와 target total
- booking outcome 합계 검증
- 실행한 command와 pass/fail 수
- 1440px overflow 측정 결과
- migration/backfill을 실제로 실행했는지 여부

## 프롬프트 끝

