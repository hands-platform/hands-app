# Customer Usage 개선 구현용 Codex 프롬프트

아래 지시를 계획서 작성으로 끝내지 말고, 실제 코드 수정·테스트·브라우저 검증까지 완료하라.

## 1. 역할과 최종 목표

당신은 `C:\dev\massage-on-demand-vn` 저장소의 선임 제품 엔지니어다. 관리자 페이지 `http://localhost:3101/usage-overview`를 실제 운영자가 30초 안에 다음 질문에 답할 수 있는 화면으로 개선하라.

1. 선택 기간에 고객 활동이 늘었는가, 줄었는가?
2. 고객 또는 예약 흐름의 어느 단계에서 가장 크게 이탈했는가?
3. 지금 확인해야 할 고객·예약·Partner는 누구인가?
4. 이 수치를 믿을 수 있는가? 실제 적용 기간, 데이터 반영 시각, synthetic 제외 여부가 분명한가?

핵심은 시각 장식이 아니라 **운영 의미의 정확성, 올바른 후속 화면 연결, 개인정보 보호, 읽기 쉬운 정보 구조**다. 먼저 짧은 실행 계획을 세운 뒤 즉시 구현을 계속하라. 계획이나 추가 감사 보고서만 제출하고 멈추지 마라.

## 2. 작업 시작 전 반드시 읽을 근거

다음 순서로 읽고 서로 대조하라.

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\docs\agent\HANDS_CODEX_WORKFLOW_GUARD.md`
3. 감사 보고서 전체:
   `C:\dev\massage-on-demand-vn\output\usage-overview-audit-2026-08-06\usage-overview-operator-ux-data-audit.md`
4. 같은 폴더의 승인된 감사 캡처 15장:
   - `02-today-top.png`
   - `03-today-journey-retention.png`
   - `04-today-lifecycle-tables.png`
   - `05-today-bottom.png`
   - `06-7d-top.png`
   - `07-7d-actions-journey.png`
   - `08-7d-metrics.png`
   - `09-7d-customer-table.png`
   - `10-7d-partners-services-regions.png`
   - `11-custom-range.png`
   - `12-custom-range-clamped.png`
   - `13-1024-top.png`
   - `14-1024-metrics.png`
   - `15-200pct-equivalent-top.png`
   - `16-200pct-equivalent-metrics.png`

`01` 캡처는 sticky/full-page 중복이 있는 폐기본이므로 근거로 사용하지 마라.

그다음 최소한 아래 코드를 실제로 읽고 호출 관계를 `rg`로 추적하라.

- `apps/admin_web/app/usage-overview/page.tsx`
- `apps/admin_web/app/usage-overview/usage-overview-model.ts`
- `apps/admin_web/app/usage-overview/usage-overview-trend-chart.tsx`
- `apps/admin_web/app/usage-overview/page.spec.tsx`
- `apps/admin_web/app/usage-overview/usage-overview-model.spec.ts`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/components/admin-overview-card.tsx`
- `apps/admin_web/components/admin-segmented-control.tsx`
- `apps/admin_web/app/customers/customer-filters.ts`
- `apps/admin_web/app/partners/partner-filters.ts`
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/lib/admin-operator-access-model.ts`
- `apps/api/src/admin/admin-usage-overview.ts`
- `apps/api/src/admin/admin-usage-overview-query.ts`
- `apps/api/src/admin/admin-usage-overview.spec.ts`
- `apps/api/src/admin/admin-usage-overview-query.spec.ts`
- `apps/api/src/admin/admin-analytics.routes.ts`
- `apps/api/src/admin/admin-operator-category.guard.ts`
- `apps/api/src/admin/admin.service.ts`

## 3. 작업 트리 보호와 구현 원칙

시작할 때 `git status --short`와 관련 파일의 `git diff`를 확인하라. 현재 작업 트리는 매우 많이 수정된 상태이며 기존 변경은 사용자 소유다.

- 다른 작업을 되돌리거나 정리하지 마라.
- `git reset --hard`, `git checkout --`, 광범위 삭제를 사용하지 마라.
- 충돌하는 기존 수정은 보존하고 그 위에 최소 변경을 적용하라.
- 새 UI/차트 라이브러리나 새 런타임 의존성을 추가하지 마라.
- 기존 query/href builder, 공용 컴포넌트, Recharts, CSS, 네이티브 date input을 우선 재사용하라.
- 새 분석 플랫폼, 범용 analytics framework, action별 새 상세 페이지를 만들지 마라.
- 권한 범위를 넓히지 마라. 현재 Web/API의 `CUSTOMERS_DIRECTORY` 분류를 임의 변경하지 마라.
- 보안, 접근성, 입력 검증, 개인정보 보호는 단순화를 이유로 생략하지 마라.
- 성능을 측정하기 전에 cache, materialized view, 새 집계 파이프라인을 추가하지 마라.
- 단일 에이전트로 작업하라.

한 번에 거대한 수정으로 섞지 말고 아래 Phase 순서로 진행하라. 각 Phase마다 관련 테스트를 먼저 통과시키고 다음으로 가되, 실제 외부 차단이 없다면 첫 Phase 후 멈추지 말고 전체 요청을 완료하라.

## 4. 절대 바꾸면 안 되는 데이터 의미

하나의 `conversionRate`로 고객 단위와 예약 단위를 합치지 마라. 화면, API 타입, 테스트에서 다음 계약을 명시적으로 구분하라.

| 개념 | 단위 | 시간 기준 | 표시 원칙 |
|---|---|---|---|
| Unique-customer journey | 고유 고객 수 | 각 이벤트가 적용 기간 안에 발생 | 각 단계에 `unique customers` 명시 |
| Booking records created | 예약 레코드 수 | `booking.createdAt` | 고객 수처럼 표현하지 않음 |
| Completed outcomes | 종료된 예약 레코드 수 | canonical `closedAt` 또는 실제 상태 전환 시각 | 사용 가능한 기존 timestamp를 확인하고 테스트로 고정 |
| Cancelled/no-show/expired outcomes | 종료된 예약 레코드 수 | 위와 동일한 종료 기준 | completed와 같은 outcome 모집단을 사용 |
| Still open/unresolved | 예약 레코드 수 | 명시한 creation cohort 또는 as-of 기준 | 분모와 기준을 도움말에 표시 |
| Current customer base | 현재 고객 스냅샷 | 현재 시점 | 선택 기간 badge/delta를 붙이지 않음 |

완료율이 terminal outcomes 기준이면 식을 `completed / all terminal outcomes`로 이름과 도움말에 명시하라. 생성 cohort 기준을 선택한다면 created cohort와 관찰 종료 시점을 명시하라. 서로 다른 timestamp 모집단을 한 분수처럼 보이게 하지 마라. 스키마에 없는 전환 시각을 추측해 만들지 말고 실제 canonical field를 확인하라.

분모가 0이면 `0%`가 아니라 `N/A` 또는 `— · No eligible activity`로 표시한다. 이는 실패가 아니라 계산 불가다.

## 5. Phase A — 링크 계약, 화면 구조, 레이아웃

### A1. Action 링크를 대상 화면의 실제 필터 계약과 일치시킨다

현재 확인된 잘못된 링크를 문자열 치환으로만 고치지 말고 대상 페이지 builder와 parsing contract를 재사용하라.

- `/customers?segment=issue`는 지원되지 않는다. 고객 segment는 `cancellation-risk`를 사용해야 한다.
- period와 무관한 default `needs-action`이 섞이지 않도록 customer segment 링크에는 명시적으로 `view=all`을 넣는다.
- `inactive-30d`, `never-booked`도 `view=all`과 결합한다. 이 둘을 Current customer base로 옮긴 뒤에는 선택 기간 지표인 것처럼 보이게 하지 않는다.
- `/partners?sort=profile-views`는 지원되지 않는다. 현재 Partner sort parser는 이를 `ops-priority`로 떨어뜨린다. 대상 화면이 같은 cohort를 표현할 수 있는지 먼저 확인하고, 필요할 때만 기존 filter contract를 최소 확장한다.
- `/bookings?view=all`만 보내지 말고 source 카드의 실제 기간과 미완료/실패 조건을 target이 표현하게 한다. target이 지원하지 않으면 기존 bookings filter contract를 최소한으로 확장한다.
- period 기반 action은 Today/7d/30d/Custom의 실제 canonical 날짜를 target이 지원하는 날짜 query로 전달한다.
- snapshot action은 기간을 가장하지 말고 `As of now`로 구분한다.
- 도착 화면의 active filter summary가 source 카드의 문구·범위·조건과 같아야 한다.
- source count와 target total이 동일한 계약으로 계산되는 회귀 테스트를 남긴다.

링크 카드의 CTA는 `Open`보다 `View 4 customers →`, `View 304 booking cases →`처럼 목적과 단위를 드러낸다.

### A2. 정보 구조를 다음 순서로 재배치한다

한 페이지를 유지하고 다음 순서를 사용하라.

1. Compact header
   - `Customer Usage`
   - 실제 적용 날짜 범위
   - `Data through ... ICT`
   - `Refresh`
   - `Vietnam time`
2. Reporting period
   - Today / Yesterday / 7 days / 30 days / Month / Custom
   - Custom 입력 검증 및 실제 비교 기간
3. Needs attention
   - 실제 trigger가 있는 항목만 표시
   - 0건이면 큰 카드 여러 장 대신 단일 `No usage alerts in this period` 상태
4. Period health
   - Active customers · unique customers
   - Partner views · events
   - Booking records created
   - Booking completion rate · 명시한 booking outcome 분모
5. Two funnels
   - Unique-customer journey
   - Booking outcomes
6. Trends
   - Customer activity
   - Booking activity
7. Current customer base · As of now
   - Never booked
   - Churn risk
8. Return on milestone day
9. Customer activity drill-down · full width · top 5
10. Partner discovery drill-down · full width · top 5
11. Demand patterns
   - Popular services
   - Regions with outcomes

`Coupon bookings`와 단순 `Payment methods` 개수는 이 페이지 핵심에서 제거하거나 더 적절한 기존 화면 링크로 내린다. `Failed payments`와 `Refund amount`는 실제 조치 대상이 있을 때만 Needs attention에 포함한다.

### A3. 레이아웃 결함의 원인을 수정한다

감사에서 확인된 DOM/CSS 연결 오류를 직접 해결하라.

- 실제 공용 content variant는 `usage-overview-grid`를 출력하지만 CSS는 존재하지 않는 `.usage-overview-content-grid`를 대상으로 한다.
- legacy `.usage-overview-ranking-card:last-child`가 Partner만 full width로 만든다.
- `usage-overview-mini-metric-list`가 AdminSection body와 내부 AdminMiniMetricStrip에 중복 적용되어 nested grid가 된다.

요구 결과:

- 존재하지 않는 selector는 제거하거나 실제 wrapper와 정확히 연결한다.
- Customer/Partner 표는 둘 다 full-width 순차 section이다.
- metric grid class는 한 레벨에만 적용한다.
- 1280px 이하 insight section은 한 열로 쌓는다.
- 기존 안전한 strip 규칙을 재사용하거나 CSS `repeat(auto-fit, minmax(140px, 1fr))` 수준의 최소 규칙으로 해결한다.
- 1440/1280/1024/720 CSS px와 실제 200% 확대에서 글자 단위 줄바꿈, 겹침, 잘린 빈 상태, 페이지+카드 이중 가로 스크롤이 없어야 한다.

### A4. 0/N/A/empty 상태를 구분한다

- trend row가 존재해도 모든 series의 합이 0이면 빈 좌표계 대신 `No activity in this period`를 표시한다.
- source unavailable, no activity, no eligible cohort를 서로 다른 상태로 유지한다.
- retention eligible 0은 `N/A · No eligible customers`다.
- Needs attention는 count 0 또는 denominator 0인 항목을 카드로 만들지 않는다.
- chart에는 접근 가능한 제목뿐 아니라 현재 값/핵심 변화의 텍스트 요약을 제공한다.

## 6. Phase B — API 의미, Custom 기간, freshness, 개인정보

### B1. 고객 funnel과 booking outcomes를 API부터 분리한다

- 기존 unique-customer funnel은 유지하고 타입/필드/문구에 고객 단위를 드러낸다.
- booking record 기준 `created`, `completed`, `closed cancelled/no-show/expired`, `refunded`, `still open/unresolved`를 별도 계약으로 반환한다.
- `Watch booking completion`은 customer funnel rate를 재사용하지 않는다.
- 문제 카드에 `affectedCustomers`와 `bookingCases`를 함께 제공한다. 예: `4 affected customers · 304 booking cases`.
- 7일 감사 데이터처럼 customer journey 2→2→2→2가 100%여도 Created 350 / Completed 1 / Cancelled·Expired 304를 숨기거나 100% booking completion으로 표현하면 안 된다.
- `paymentFailureCount`의 기간 기준이 연결 booking의 `createdAt`인지 실제 payment failure 시각인지 확인하고, 화면 문구와 같은 기준으로 고친다. 사용할 수 있는 실제 필드가 없으면 그 한계를 명확히 표시하고 추측값을 만들지 않는다.

### B2. period 지표와 current snapshot을 분리한다

- `neverBookedCustomerCount`, `churnRiskCustomerCount`처럼 period filter를 받지 않는 값은 `Current customer base · As of now` 모델로 옮긴다.
- snapshot에는 period badge와 comparison delta를 반환하거나 표시하지 않는다.
- period comparison에는 실제 period 모집단만 사용한다.

### B3. Custom 기간을 canonical하게 만든다

신뢰 경계인 서버 검증은 유지한다.

- `From ≤ To`
- 미래 날짜 불가
- 최대 90일

UI 단계에서 오류를 알려 조용한 보정을 피한다. 기존 보정을 유지해야 한다면 서버가 반환한 실제 `fromDate`/`toDate`를 사용해 URL과 input을 canonical 값으로 맞춘다. 화면에는 실제 적용 날짜와 즉시 이전 comparison 날짜를 표시한다.

- 예: `8 May–6 Aug 2026 · 90 days`
- 하루 단위 Custom이 시간별 row라면 `Hourly activity`
- 실제 daily row면 `Daily activity`

사용자가 입력한 기간과 API가 집계한 기간이 다르게 남아 있어서는 안 된다.

### B4. source freshness를 정직하게 표시한다

- 현재의 `generatedAt = new Date()`를 source freshness로 사용하지 않는다.
- query 생성 시각이 필요하면 `Report generated`로만 이름 붙이거나 숨긴다.
- 실제 contributing source의 timestamp에서 파생된 nullable `dataThroughAt`을 정의하고 테스트한다. AppUsage aggregate의 `lastOccurredAt`과 booking/review/refund의 실제 source timestamp를 확인하라.
- 단일 시각이 전체 ingestion completeness를 보장하지 않는다면 그보다 강한 의미를 주장하지 말고 계약/문구를 정확히 제한한다.
- 데이터가 없으면 현재 시각을 가짜 freshness로 반환하지 않는다.
- 화면에는 `Data through 6 Aug 2026, 13:20 ICT` 형식으로 표시한다.
- 최소 구현은 기존 링크/버튼 패턴을 이용한 수동 `Refresh`다. 자동 갱신을 구현하지 않으면 사용되지 않는 `refreshSeconds`는 제거한다.

### B5. 전화번호를 API에서 마스킹한다

- customer ranking `secondary`의 raw phone을 반환하지 않는다.
- Partner도 city fallback으로 raw phone을 반환하지 않는다.
- client-only masking은 금지한다.
- 저장소에 이미 있는 `maskedAdminOwnerPhone` 또는 같은 목적의 helper를 찾아 재사용하거나 가장 가까운 admin 공용 위치로 최소 이동한다.
- 출력 예시는 `+84••••••0001` 수준이며 기존 포맷 규칙을 우선한다.
- API 테스트에서 원문 전화번호가 payload에 없음을 확인한다.

## 7. Phase C — synthetic provenance와 운영 통계 격리

이 Phase는 Prisma protected area를 건드릴 수 있으므로 `AGENTS.md`와 workflow guard의 보호 절차를 따른다. 이름/전화/ID prefix 휴리스틱은 절대 사용하지 않는다.

1. 먼저 기존 schema와 writer에 이미 신뢰할 수 있는 data-origin/provenance marker가 있는지 검색한다.
2. 있으면 재사용한다.
3. 없다면 가장 작은 명시적 marker를 추가한다. 예: `User.isSynthetic Boolean @default(false)`와 새 migration. 실제 저장소 naming 관례가 있으면 그 관례를 따른다.
4. smoke/seed/audit writer가 synthetic User/Partner/customer를 만들 때 marker를 설정한다. `rg`로 실제 생성 경로를 찾고 필요한 writer만 수정한다.
5. booking/payment/refund/review/AppUsage 집계와 ranking에서 연결된 synthetic 사용자를 server-side로 제외한다.
6. AppUsageEvent/AppUsageDailyAggregate도 synthetic user 관계를 통해 제외한다. 관계가 없어 정확히 제외할 수 없다면 가짜 보장을 넣지 말고 최소 schema/data path를 설계한 뒤 테스트한다.
7. 현재 DB fixture를 자동 삭제하지 않는다.
8. legacy fixture는 안전한 dry-run 목록화와 명시적 backfill 경로를 제공한다. 기존 maintenance 패턴이 있으면 재사용하고 새 framework를 만들지 않는다.
9. marker가 query 전 구간에서 실제 적용될 때만 화면에 `Synthetic data excluded`를 표시한다.

다음 회귀를 fixture 기반 API 테스트로 증명하라.

- synthetic customer/Partner가 ranking에 나오지 않는다.
- synthetic booking/payment/refund/review가 KPI와 outcomes에 포함되지 않는다.
- synthetic usage가 activity/trend에 포함되지 않는다.
- 일반 운영 데이터는 그대로 포함된다.
- 이름이 `Demo`여도 marker가 false인 실제 사용자를 이름만으로 제외하지 않는다.

## 8. 문구와 표시 기준

다음 운영자 문구를 기본으로 사용하되, 기존 번역/visible-copy 규칙과 충돌하면 같은 의미의 더 짧은 문구로 맞춘다.

| 현재 | 변경 |
|---|---|
| Customer Usage Overview | Customer Usage |
| Customer activity, Partner discovery, booking conversion, and retention from stored Vietnam-time usage aggregates. | See how customers use the app, where booking attempts drop, and who needs follow-up. |
| Usage range | Reporting period |
| Choose a bounded Vietnam-time period... | All dates use Vietnam time. Compare with the immediately preceding period. |
| Action priorities | Needs attention |
| Review problem customers | Review affected customers |
| Recover churn risk | Follow up with inactive customers |
| Convert new unbooked | Help new customers book |
| Improve Partner discovery | Review view-to-request drop-off |
| Watch booking completion | Review unresolved booking attempts |
| Lifecycle and segments | Period customers |
| Booking quality | Booking outcomes |
| Payment and coupon | Payment issues |

추가 표시 기준:

- 같은 period badge를 모든 카드에 반복하지 말고 section header에 한 번만 표시한다.
- 색만으로 상태를 전달하지 않고 `Review now`, `N/A`, `No issue` 같은 텍스트를 함께 사용한다.
- Retention 제목은 `Return on milestone day`로 하고 `Customers whose D1/D7/D30 milestone fell inside the selected period.`를 설명한다.
- 각 retention 카드는 퍼센트보다 `12 returned / 20 eligible`을 먼저 표시한다.
- 임의의 `Low sample` threshold는 제품 기준 없이 추가하지 않는다.
- Customer 표 기본 열: Customer / Engagement / Booking outcome / Risk / Last active.
- Partner 표 기본 열: Partner / Views / Preferred requests / Completed / Last activity.
- 두 표는 full width, 기본 top 5, 기존 목록으로 가는 `View all`을 제공한다.
- Popular services의 숫자가 booking records인지 requests인지 명시한다.
- Top regions에는 requests/completed뿐 아니라 cancelled·expired 또는 completion signal을 표시한다.

## 9. 단순화와 dead code 정리

새 추상화보다 기존 코드 삭제·재사용을 우선한다.

- `apps/api/src/admin/admin.service.ts`의 `getLegacyUsageOverview`는 감사 당시 약 761줄이며 호출이 발견되지 않았다. 전체 저장소에서 caller가 정말 0인지 `rg`로 다시 확인하고, 새 query의 회귀 테스트가 통과한 뒤에만 삭제한다.
- `platformUsage`가 실제 모든 caller에서 항상 빈 배열이고 사용되지 않는지 확인한 뒤, dead API/type/UI fallback이면 함께 제거한다.
- 숨겨진 `all` range 등 현재 요청과 무관하거나 의도가 불명확한 기능은 정리 욕심으로 건드리지 않는다.
- 10개 raw query 병렬 실행과 comparison 재실행은 실제 latency와 DB plan을 측정하지 않은 상태에서 최적화하지 않는다.

## 10. 테스트 요구사항

현재 테스트가 통과한다는 사실만으로 완료 처리하지 마라. 다음 의미 회귀를 새 테스트 또는 기존 테스트 확장으로 잡아라.

- unsupported `segment=issue`, `sort=profile-views`가 생성되지 않는다.
- customer action 링크는 필요한 `view=all`을 포함한다.
- period action 링크는 canonical 적용 날짜를 보존한다.
- source count와 target filter total이 같은 계약이다.
- unique-customer 100%를 booking completion 100%로 사용하지 않는다.
- current snapshot에 period badge/delta가 없다.
- Custom 미래/역전/90일 초과가 오류 또는 canonical 값으로 일치한다.
- all-zero rows는 empty chart다.
- denominator/eligible 0은 N/A다.
- raw phone이 API payload에 없다.
- synthetic data 제외가 KPI/ranking/trend/outcome 전체에 적용된다.
- API 실패와 실제 0 activity는 구분된다.
- 권한 분류가 의도치 않게 넓어지지 않는다.

최소 focused 검증은 아래 명령으로 시작한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/usage-overview/page.spec.tsx app/usage-overview/usage-overview-model.spec.ts app/customers/customer-filters.spec.ts app/partners/partner-filters.spec.ts
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-usage-overview.spec.ts src/admin/admin-usage-overview-query.spec.ts src/admin/admin-operator-category.guard.spec.ts src/admin/admin-operator-category-manifest.spec.ts
npm.cmd run admin:visible-copy
npm.cmd run security:admin-sensitive
npm.cmd run admin:query-guards
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

Prisma schema/migration을 변경했다면 저장소의 기존 Prisma 검증·generate·migration 절차를 확인해 실행한다. protected behavior를 변경했으므로 가능한 환경에서는 마지막에 `npm.cmd run verify:local`도 실행한다. 서비스나 환경 의존성 때문에 실행할 수 없는 검증은 성공처럼 쓰지 말고 정확한 원인과 미검증 위험을 보고한다.

테스트 명령이 기존 dirty worktree의 unrelated 실패를 발견하면, 관련 실패와 기존 실패를 구분해 증거를 남기고 사용자 변경을 고치거나 되돌리지 마라.

## 11. 로그인 브라우저 검증

코드 테스트 후 로그인된 관리자 브라우저에서 실제 화면을 확인하라. 조회만 수행하고 메시지 발송, 상태 변경, 환불, 삭제 등 운영 write action은 실행하지 마라.

검증 URL:

- `http://localhost:3101/usage-overview`
- 각 Needs attention 카드가 가리키는 실제 customer/partner/booking destination

다음을 캡처하고 결과를 `C:\dev\massage-on-demand-vn\output\usage-overview-implementation-2026-08-06`에 저장하라.

1. Today · 전부 0 또는 low activity 상태
2. Last 7 days · Needs attention + period health
3. Unique-customer journey와 Booking outcomes가 동시에 보이는 상태
4. all-zero trend empty state
5. retention eligible 0의 N/A
6. 유효한 Custom range
7. From > To validation
8. future date validation
9. 90일 초과 validation 또는 canonical 결과
10. Customer/Partner full-width top 5 표와 masked phone
11. 각 action destination의 active filter summary
12. 1440px
13. 1280px
14. 1024px
15. 720 CSS px
16. 가능하면 실제 브라우저 200% zoom

각 viewport에서 horizontal overflow, character-by-character wrapping, 겹침, 잘림, keyboard focus visibility를 확인한다. Custom date input을 키보드로 조작하고 focus order를 확인한다. 차트의 screen-reader용 텍스트 요약이 DOM에 있는지 확인한다. 콘솔 error와 failed network request도 확인한다.

action destination마다 다음 세 값이 맞는지 기록한다.

- source 카드의 label/count/unit
- target URL query
- target active filter summary와 total

현재 데이터에 synthetic marker backfill이 아직 적용되지 않았다면 이름을 보고 임의 제외한 척하지 말고, migration/backfill 상태와 검증 한계를 명확히 보고한다.

## 12. 완료 수용 기준

아래 항목을 모두 충족해야 완료다.

- Today가 전부 0이면 Needs attention 카드 5개 대신 단일 정상 상태가 보인다.
- 7일 예시에서 350 created / 1 completed / 304 cancelled·expired가 booking-record 경보에 정확히 반영된다.
- customer-unit 100%는 Unique-customer journey 안에서만 보인다.
- 모든 action destination의 active filter summary가 source와 같은 범위·조건을 보여준다.
- `segment=issue`, `sort=profile-views`가 남지 않는다.
- Custom 90일 초과/미래/역전 입력 결과가 화면 input, URL, API 적용 기간과 일치한다.
- 실제 적용 날짜와 comparison 날짜가 표시된다.
- period metric과 current snapshot이 시각·타입·copy에서 분리된다.
- synthetic marker 데이터가 운영 KPI/ranking/trend/outcomes에서 제외된다.
- 이름/전화/ID prefix 기반 필터가 없다.
- raw phone이 API 응답과 화면에 없다.
- query 생성 시각을 source freshness처럼 표시하지 않고 `Data through` 계약이 적용된다.
- all-zero trend는 빈 좌표계 대신 empty state다.
- denominator/retention eligible 0은 0%가 아니라 N/A다.
- Customer/Partner 표는 각각 full width, top 5이며 핵심 열을 기본 화면에서 읽을 수 있다.
- 1440/1280/1024/720과 실제 200% 확대에서 글자 단위 줄바꿈, 겹침, 잘린 문구, 불필요한 이중 가로 스크롤이 없다.
- keyboard focus, date input keyboard operation, chart text summary를 검증했다.
- 관련 focused 테스트와 scope 검증이 통과했다. 미실행 검증은 사유와 위험이 명시됐다.

## 13. 최종 보고 형식

완료 후 한국어로 다음만 명확히 보고하라.

1. 운영자가 체감하는 핵심 변화
2. 변경 파일 목록과 각 파일의 역할
3. metric/link/privacy/synthetic 계약이 어떻게 고정됐는지
4. 실행한 테스트와 정확한 결과
5. 브라우저 검증 상태별 결과와 캡처 경로
6. Prisma 등 protected area 변경 여부
7. 보존한 기존 사용자 변경
8. 남은 위험 또는 환경 때문에 검증하지 못한 항목
9. 다음으로 권장할 단 하나의 작업

완료했다고 말하기 전에 `git diff --check`와 최종 `git status --short`를 확인하라. unrelated 변경을 자신의 결과로 주장하지 마라.

