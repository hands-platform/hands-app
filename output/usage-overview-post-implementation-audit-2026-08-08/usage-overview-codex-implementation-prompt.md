# Codex 실행 프롬프트 — Customer Usage Overview 운영 신뢰성 개선

아래 프롬프트 전체를 `C:\dev\massage-on-demand-vn`을 연 Codex 작업에 그대로 전달한다.

---

## 프롬프트 시작

`C:\dev\massage-on-demand-vn` 프로젝트의 관리자 `Customer Usage Overview`를 실제 운영자가 신뢰하고 행동할 수 있는 화면으로 수정하라. 단순 시각 개선이나 추가 보고서 작성으로 끝내지 말고, 프런트·API·대상 목록 필터·테스트를 함께 수정하고 로그인된 브라우저에서 최종 동작을 검증하라.

### 목표

`http://localhost:3101/usage-overview`에서 운영자가 30초 안에 다음 질문에 정확히 답할 수 있어야 한다.

1. 선택 기간에 고객 활동과 booking 흐름이 어떻게 변했는가?
2. unique customer reach와 booking record outcomes 중 어디에서 문제가 발생했는가?
3. 지금 확인할 실제 고객·booking·Partner는 누구인가?
4. Action 카드의 수치와 이동한 목록의 total이 일치하는가?
5. 데이터는 어느 시각까지 반영됐고 fixture가 제외됐는가?

### 반드시 먼저 읽을 자료

1. 저장소의 모든 적용 가능한 `AGENTS.md`
2. `output/usage-overview-post-implementation-audit-2026-08-08/usage-overview-post-implementation-deep-audit.md`
3. 다음 구현 파일과 모든 호출자/관련 테스트
   - `apps/admin_web/app/usage-overview/page.tsx`
   - `apps/admin_web/app/usage-overview/usage-overview-model.ts`
   - `apps/admin_web/app/usage-overview/usage-overview-trend-chart.tsx`
   - `apps/admin_web/components/admin-overview-card.tsx`
   - `apps/admin_web/components/admin-form-controls.tsx`
   - `apps/admin_web/components/admin-form-date-picker-field.tsx`
   - `apps/admin_web/app/globals.css`
   - `apps/api/src/admin/admin-usage-overview.ts`
   - `apps/api/src/admin/admin-usage-overview-query.ts`
   - Customers, Partners, Bookings 대상 페이지의 filter/query/href builder
   - usage overview 관련 Web/API spec

감사 문서의 결론을 맹목적으로 복사하지 말고 현재 코드·브라우저 동작과 다시 대조하라. 코드가 달라졌다면 현재 증거를 우선하되 아래 운영 의도와 수용 기준은 유지하라.

### 작업 방식

1. 먼저 현재 dirty worktree와 관련 diff를 확인하고 사용자 변경을 보존하라.
2. 현재 화면을 1440×900과 1600×900에서 캡처하고 Today, 30 days, Custom 상태를 재현하라.
3. 프런트 → Admin API → SQL/query → target filter parser까지 실제 데이터 흐름을 추적한 뒤 짧은 구현 계획을 작성하라.
4. 계획만 전달하고 멈추지 말고, 파괴적 작업이나 외부 권한이 필요한 경우가 아니라면 계속 구현하라.
5. 각 단계에서 가장 작은 관련 테스트를 실행하고 마지막에 전체 focused verification을 실행하라.
6. UI 수정 후 동일 viewport와 동일 상태를 다시 캡처해 전후 차이를 검증하라.

### 변경 금지 및 안전 기준

- 새 UI, chart, date-picker, analytics/BI dependency를 추가하지 않는다.
- 기존 Admin design system, Recharts, react-datepicker, filter/query builder를 재사용한다.
- 새 action 전용 상세 페이지를 만들지 않는다.
- 이름, 전화번호, ID prefix로 Demo/Smoke/Audit 데이터를 판별하지 않는다.
- fixture row나 운영 데이터를 자동 삭제하지 않는다.
- 전체 전화번호를 API로 보낸 뒤 UI에서만 가리지 않는다.
- From/To 오류를 조용히 다른 기간으로 바꾸지 않는다.
- customer rate와 booking rate를 하나의 `conversionRate`로 합치지 않는다.
- request가 view보다 크다는 이유로 `Math.max()` 분모를 사용해 100%로 잘라내지 않는다.
- 성능 측정 전에 cache, materialized view, 새 aggregation system을 추가하지 않는다.
- unrelated route나 공용 컴포넌트 동작을 광범위하게 바꾸지 않는다.
- 기존 API 필드를 제거하기 전 모든 caller를 검색하고 필요한 호환성을 유지한다.
- 1440×900과 1600×900 데스크톱 운영 화면을 검증 대상으로 삼는다.

## 1단계 — 데이터 단위를 먼저 바로잡는다

### A. Unique-customer reach

현재 Customer journey를 unique customer 단위 영역으로 명확히 분리하라.

- Active unique customers
- Viewed a Partner unique customers
- Created a booking unique customers
- Customers with completed work

쿼리가 event 순서를 검증하지 않고 같은 기간의 집합 포함 관계만 계산한다면 `move through` 또는 시간 순서 funnel처럼 표현하지 말고 `reached` 또는 `unique-customer reach`라고 표현하라. 각 단계에 `unique customers` 단위를 노출하라.

### B. Booking outcomes

별도의 booking record 단위 계약을 추가하라. 권장 방식은 선택 기간에 생성된 동일 booking cohort의 현재 outcome을 mutually exclusive하게 계산하는 것이다.

- Created booking records
- Completed
- Cancelled
- No-show
- Expired
- Refunded
- Still open / unresolved

각 outcome의 합과 created cohort 관계가 검증 가능해야 한다. `completed / resolved` 같은 비율을 사용한다면 분모, 포함 status, selected period, as-of 시각을 코드와 문구에 명시하라.

기간 중 `closedAt` event 성과도 필요하다면 created cohort와 섞지 말고 `Closed during period`라는 별도 flow metric으로 제공하라.

### C. 잘못된 Action conversion 제거

다음 오류를 수정하라.

- `Improve Partner discovery`가 customer funnel의 booking step rate를 `view-to-request`라고 표시한다.
- `Watch booking completion`이 customer funnel의 completed step rate를 `request-to-complete`라고 표시한다.
- Partner view와 preferred request가 동일 lineage로 연결되지 않으며 실제 데이터에는 Views 0 / Requests > 0이 존재한다.

event lineage가 없으면 conversion을 만들지 말고 Views와 Preferred requests를 독립 신호로 보여라. lineage를 신뢰성 있게 연결할 수 있을 때만 conversion을 계산한다. Booking completion action은 반드시 booking record outcome으로 계산한다.

### D. 기간 metric과 current snapshot 분리

다음을 선택 기간 영역에서 제거해 `Current customer base · As of now`로 옮겨라.

- Never booked
- Churn risk / inactive 30d
- 필요하면 Active today / 7d / 30d

snapshot에는 선택 기간 badge나 previous-period delta를 적용하지 않는다. `Repeat customers`가 lifetime repeat인지 선택 기간 내 2회 완료인지 정확히 정의하고 문구를 그 정의에 맞춘다.

## 2단계 — Action 카드와 target 목록을 같은 계약으로 만든다

현재 잘못된 링크를 문자열 교체만으로 땜질하지 말고 대상 페이지의 href/query builder를 재사용하라.

현재 문제:

- `/customers?segment=issue`: 지원되지 않는 segment
- `/customers?segment=inactive-30d`: 기본 `needs-action` view와 결합되고 source churn 정의와 다름
- `/customers?segment=never-booked`: 전체 never-booked + 기본 view이며 “기간 중 신규 미예약”과 다름
- `/partners?sort=profile-views`: 지원되지 않는 sort
- `/bookings?view=all`: source 기간과 unresolved 조건을 잃음

수정 요건:

1. Customers 링크는 의도한 경우 `view=all`을 명시한다.
2. Today/7d/30d/Custom을 target의 `dateRange/dateFrom/dateTo`로 전달한다.
3. source와 동일한 cohort를 target이 표현하지 못하면 target filter를 최소 확장한다.
4. 카드 수치와 target total을 같은 query/service contract로 계산한다.
5. target 상단 active filter summary가 source 카드의 기간·조건과 동일해야 한다.
6. source card count = target result total인 통합 테스트를 작성한다.
7. Action에는 실제 trigger가 1 이상인 항목만 표시한다.
8. 조치할 항목이 없으면 카드 5개 대신 `No usage alerts in this period` 단일 정상 상태를 표시한다.
9. `Open` 대신 `View 4 affected customers →`, `Review 12 unresolved bookings →`처럼 대상과 건수를 표시한다.

단순히 `segment=issue`를 `segment=cancellation-risk`로 바꾸지 마라. 두 filter는 기간, refund 포함 여부, 정의가 다르므로 count parity가 보장되지 않는다.

## 3단계 — Custom 기간을 canonical하게 만든다

입력, URL, API applied window, 화면 summary가 항상 같은 날짜를 가리키게 하라.

- From ≤ To
- 미래 날짜 불가
- 최대 90일
- invalid date format 불가

서버 trust-boundary validation은 유지한다. 권장 방식은 잘못된 요청을 명확한 validation error로 반환하고 From/To field에 오류를 표시하는 것이다. 자동 보정을 유지해야 한다면 API가 최소 다음 값을 반환하고 프런트가 실제 적용 값으로 canonical redirect해야 한다.

- `fromDate`
- `toDate`
- `dayCount`
- `granularity: hourly | daily`
- comparison from/to

화면에는 `1 Jul–30 Jul 2026 · 30 days · Vietnam time`처럼 실제 적용 범위를 표시한다. 하루 Custom은 Hourly, 여러 날은 API granularity에 따라 Daily라고 설명한다.

UI에는 없는 `range=all`이 Web/API에 남아 있다. 실제 caller를 검색하고 운영 요구가 없다면 지원을 제거하라. 현재처럼 1970년부터 일별 `generate_series`가 만들어질 수 있는 숨은 경로를 남기지 않는다.

## 4단계 — freshness, privacy, provenance를 수정한다

### A. Freshness

- `generatedAt`은 필요하면 `Report generated`로 표시한다.
- source가 실제로 어느 시각까지 반영됐는지 나타내는 `dataThroughAt`을 별도로 정의한다.
- aggregate `lastOccurredAt` 및 booking/review/refund source의 반영 정책을 코드에서 명확히 하라.
- 화면에는 `Data through … ICT`를 우선 표시한다.
- 최소한 명시적인 Refresh control을 제공한다.
- `refreshSeconds`를 구현하지 않는다면 제거한다.

### B. 전화번호

- Customer ranking의 `secondary: row.phone`
- Partner ranking의 `secondary: row.city ?? row.phone`

API mapping 단계에서 전화번호를 마스킹하라. 예: `+84••••••0001`. network response에도 원문이 없어야 한다. 상세 페이지 링크는 유지한다.

### C. Synthetic provenance

현재 schema와 writer를 먼저 확인하라. 명시적 marker가 이미 있으면 재사용한다. 없다면 최소한의 non-destructive provenance 계약을 설계하라.

- seed/smoke/audit writer가 생성할 때 marker 설정
- User/booking/payment/refund/review/AppUsageEvent/AppUsageDailyAggregate 집계에 일관된 제외 조건
- 기존 fixture는 삭제하지 않음
- 기존 row는 별도 check/backfill 절차로 목록화·마킹
- 운영 통계 제외가 실제 보장될 때만 `Synthetic data excluded` 표시

schema migration이 필요하면 migration과 writer/test 변경을 함께 만들되 기존 DB 데이터를 추측으로 대량 수정하거나 삭제하지 않는다. 적용에 별도 승인이 필요한 destructive/external 단계만 명확히 보고하라.

## 5단계 — 운영자 중심 화면 구조로 재배치한다

다음 순서를 기본으로 한다.

1. Compact header
   - `Customer Usage`
   - 실제 적용 기간
   - `Data through`
   - Refresh
2. Needs attention
   - 실제 trigger만 표시
   - 영향 고객 수와 booking case 수
   - target count와 일치하는 링크
3. Period health
   - Active customers · unique customers
   - Partner views · events
   - Booking records created
   - Booking outcomes / unresolved
4. Unique-customer reach
5. Booking outcomes
6. Customer activity trend / Booking activity trend
7. Current customer base · As of now
8. Customer full-width top 5 + View all
9. Partner full-width top 5 + View all
10. Popular services / Top regions

Payment methods 종류 개수와 coupon booking은 Customer Usage의 핵심 운영 판단에 필요하지 않으면 Finance/Growth 링크로 이동하거나 제거하라. Failed payment와 refund amount는 실제 trigger가 있을 때 Needs attention으로 연결한다.

Top regions에는 created demand만 보여주지 말고 completed와 cancelled/expired 또는 명확한 resolution signal을 추가한다. Vietnam Overview 링크에는 동일 기간을 전달한다.

## 6단계 — 확인된 CSS wiring 결함을 근본 수정한다

다음 원인을 직접 수정하라.

1. `AdminOverviewGrid variant="content"`는 `usage-overview-grid`를 출력하지만 v2 CSS는 `usage-overview-content-grid`를 대상으로 한다.
2. `.usage-overview-ranking-card:last-child` legacy 규칙 때문에 Partner만 full width다.
3. `usage-overview-mini-metric-list`가 AdminSection body와 AdminMiniMetricStrip에 동시에 붙어 outer 3-column 안에 inner 3-column이 생긴다.

최소 수정 원칙:

- mini metric layout class는 한 grid layer에만 적용한다.
- 실제 DOM wrapper와 CSS selector를 일치시킨다.
- Customer와 Partner 표를 각각 full-width 순차 section으로 만든다.
- legacy `:last-child` 예외를 v2에서 제거한다.
- 공용 component를 바꿀 경우 모든 caller를 검색하고 회귀를 막는다.
- 1440×900과 1600×900에서 label이 글자 단위로 찢어지지 않아야 한다.
- Customer 핵심 열은 기본 화면에서 내부 가로 스크롤 없이 읽혀야 한다.

## 7단계 — Trend와 empty/N/A 상태를 정확히 표현한다

- 기존 Recharts로 Customer activity와 Booking activity를 두 chart로 분리하는 방식을 우선한다.
- 더 단순하다면 series toggle 하나를 사용한다.
- booking spike가 customer activity를 바닥에 눌러버리는 단일 Y축 구성을 유지하지 않는다.
- 모든 row의 합이 0이면 chart 대신 `No activity in this period`를 표시한다.
- denominator 0 conversion은 `0%`가 아니라 `N/A`다.
- retention eligible 0은 `N/A · no eligible cohort`다.
- chart 아래에 series total과 peak period를 텍스트로 제공해 screen reader와 비시각적 검토가 가능하게 한다.
- `No activity`, `No eligible cohort`, `Source unavailable`을 서로 다른 상태로 유지한다.

## 8단계 — 문구를 데이터 계약과 맞춘다

권장 문구를 기본으로 하되 실제 구현 정의와 다르면 정의에 맞춰 더 정확하게 작성하라.

| 기존 | 권장 |
|---|---|
| Customer Usage Overview | Customer Usage |
| Usage range | Reporting period |
| Updated | Report generated |
| Action priorities | Needs attention |
| Customer journey | Unique-customer reach |
| Watch booking completion | Review unresolved booking records |
| Lifecycle and segments | Period customers / Current customer base |
| Booking quality | Booking outcomes |
| Created | Created in period |
| Completed | Closed as completed in period 또는 Created cohort completed |
| Closed cancelled / expired | Closed cancelled / no-show / expired in period |
| 0% with zero denominator | N/A · no eligible records |

색만으로 정상/위험을 구분하지 말고 `Review now`, `No issue`, `N/A` 텍스트를 함께 사용한다. 같은 기간 badge를 모든 카드에 반복하지 않는다.

## 9단계 — 테스트와 브라우저 검증

기존 테스트가 잘못된 href 문자열을 정상으로 고정하고 있으므로 다음 방향으로 수정하라.

필수 회귀 테스트:

1. source Action count와 target list total 일치
2. unsupported `segment=issue`, `sort=profile-views`가 생성되지 않음
3. unique-customer rate가 booking action rate에 사용되지 않음
4. Views 0 / Requests > 0에서 100% conversion을 표시하지 않음
5. booking cohort outcomes가 mutually exclusive하고 합계가 created cohort와 일치
6. From > To, future, >90d 처리
7. applied range와 URL/input/summary 일치
8. all-zero rows → empty state
9. eligible 0 → N/A
10. API response에 raw phone 없음
11. synthetic marker row가 aggregate/ranking에서 제외됨
12. period metric과 snapshot scope 분리
13. 동일 기간이 Vietnam Overview 및 대상 목록 링크에 전달됨

최소 focused commands:

```powershell
npm run test --workspace @massage-vn/admin-web -- app/usage-overview/usage-overview-model.spec.ts app/usage-overview/page.spec.tsx
npm run test --workspace @massage-vn/api -- src/admin/admin-usage-overview.spec.ts src/admin/admin-usage-overview-query.spec.ts
npm run typecheck --workspace @massage-vn/admin-web
npm run typecheck --workspace @massage-vn/api
```

수정한 target filter/builder의 focused spec도 함께 실행한다. 가능하면 각 workspace lint를 실행하되 unrelated 기존 실패와 새 실패를 구분해 보고한다.

브라우저 최종 검증:

- 1440×900 Today 0건
- 1440×900 Last 30 days 실데이터
- 1440×900 valid Custom
- 1440×900 reversed Custom
- 1600×900 Last 30 days lifecycle/tables
- Action 카드별 target 이동 후 active filter summary와 total
- console error
- Customer/Partner phone masking
- all-zero chart, N/A retention, no-action 상태

검증 스크린샷은 `output/usage-overview-implementation-validation-YYYY-MM-DD/`에 저장한다.

## 완료 조건

다음 조건을 모두 만족하기 전에는 작업을 완료했다고 말하지 마라.

- Last 30 days booking action이 booking record 단위이며 분모/시간 기준이 보인다.
- unique-customer 100%는 unique-customer 영역 안에서만 사용된다.
- 모든 Action 카드 count와 target total이 일치한다.
- target filter summary가 source 기간·조건과 일치한다.
- invalid/unsupported action query가 없다.
- Custom invalid 입력이 오류 또는 명시적인 canonical applied range로 처리된다.
- 실제 적용 기간과 comparison 기간이 보인다.
- Never booked/Churn risk가 `As of now`로 분리된다.
- `Data through`와 `Report generated`가 구분된다.
- fixture provenance 제외가 보장된다.
- API와 화면에 raw phone이 없다.
- all-zero chart와 denominator/eligible 0이 올바른 empty/N/A 상태다.
- 1440×900과 1600×900에서 mini metric 문구가 글자 단위로 찢어지지 않는다.
- Customer와 Partner table이 모두 full width이며 핵심 열을 가로 스크롤 없이 읽는다.
- 관련 tests/typecheck가 통과한다.
- 최종 브라우저 캡처와 console 확인이 완료된다.

## 최종 응답 형식

다음 순서로 간결하게 보고하라.

1. 운영자 관점에서 무엇이 달라졌는지
2. 데이터/API 계약 변경
3. Action target/count parity 결과
4. 변경 파일 목록
5. migration/backfill이 있다면 적용 여부와 안전 주의사항
6. 실행한 테스트·typecheck·lint와 결과
7. 브라우저 검증 viewport/state와 스크린샷 경로
8. 남은 제한 또는 실제 blocker

단순히 “개선했다”라고 말하지 말고 수치 단위, 적용 기간, target total, 테스트 결과로 증명하라.

## 프롬프트 끝
