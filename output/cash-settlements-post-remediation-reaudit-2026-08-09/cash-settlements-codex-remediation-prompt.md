# Codex 실행 프롬프트 — Cash Settlements 최종 개선

아래 내용을 `C:\dev\massage-on-demand-vn`을 workspace로 연 새 Codex 작업의 첫 프롬프트로 그대로 사용한다.

---

## 역할과 최종 목표

당신은 HANDS Admin의 재무 운영 화면을 수정하는 시니어 full-stack engineer다.

`C:\dev\massage-on-demand-vn` 프로젝트의 `/cash-settlements`를 실제 재무 운영자가 안전하고 빠르게 사용할 수 있는 최종 운영 workbench로 개선하라. 단순한 CSS 정리나 문구 변경으로 끝내지 말고, 재감사 보고서에서 확인된 금융 데이터 정확성, 권한, API read model, 표 구조, queue 의미, empty state, audit 추적, 성능과 회귀 테스트를 끝까지 구현하고 검증하라.

작업 기준 보고서:

`C:\dev\massage-on-demand-vn\output\cash-settlements-post-remediation-reaudit-2026-08-09\cash-settlements-post-remediation-reaudit-report.md`

먼저 다음 파일을 읽고 현재 구현과 보고서가 일치하는지 확인한 후 수정하라.

- `C:\dev\massage-on-demand-vn\AGENTS.md`
- 위 재감사 보고서 전체
- `apps/admin_web/app/cash-settlements/**`
- `apps/admin_web/app/globals.css`의 cash settlement 관련 selector
- `apps/api/src/earnings/earnings.service.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin-finance.routes.ts`
- `apps/api/src/admin/admin-wallet.routes.ts`
- `apps/api/src/admin/admin-operator-category.guard.ts`
- 관련 Prisma schema와 migrations
- cash settlement, Partner deposit, admin permission 관련 테스트

계획만 제출하고 멈추지 말고 구현, 테스트, 1440px 브라우저 QA, 결과 보고서까지 완료하라.

## 현재 평가와 반드시 보존할 개선점

현재 운영 준비도는 7.6/10, 조건부 통과 상태다. 다음 구현은 이미 잘 되었으므로 회귀시키지 마라.

- 기본 진입은 `All dates + All open + Oldest first`다.
- 핵심 KPI는 Open exposure, Overdue, Missing settlement evidence, Partners affected 네 개다.
- 검색·queue·age·SLA·sort·page·pageSize는 Review, Close, pagination, success, error 후에도 보존된다.
- review 대상은 현재 page rows에서 찾지 않고 earning ID로 별도 조회한다.
- 임의 외부 `returnTo`와 지원하지 않는 query 값은 차단·정규화된다.
- settlement evidence는 ledger entry와 journal batch가 존재하는 `EXECUTED` Partner deposit만 허용한다.
- synthetic `HANDS-CASH-*`, free-text reference, 승인 모델이 없는 Admin offset은 금융 증빙으로 허용하지 않는다.
- allocation은 Partner, currency, earning 상태, deposit 상태, 남은 deposit recovery, 남은 debt를 서버에서 검증한다.
- allocation transaction의 SERIALIZABLE 처리, duplicate/concurrency 방어와 완전 배분 시에만 PAID 전환하는 정책을 보존한다.
- 실패는 조용히 삼키지 않고 사용자에게 stable error notice를 보여준다.
- 성공 결과는 earning, amount, method, status, audit ID를 보여준다.
- `view=full`은 별도 거대 페이지가 아니라 동일 workbench/guide로 정규화된다.
- drawer focus trap, Escape close, opener focus 복귀, dark mode를 보존한다.

## 절대 제약

- 1440px 이상 데스크톱 운영 화면만 대상으로 한다.
- 1024px 이하, 모바일, 태블릿 반응형을 검사하거나 새로 설계하지 마라.
- 실제 운영 데이터에 금융 mutation을 실행하지 마라. 브라우저 QA에서는 allocation submit을 누르지 마라.
- 임의로 production data를 seed하거나 기존 금융 레코드를 수정하지 마라.
- unrelated dirty worktree 변경을 reset, checkout, clean, stash, overwrite하지 마라.
- `git reset --hard`, `git checkout --`, 광범위 삭제를 사용하지 마라.
- 기존 accounting journal이나 wallet ledger를 allocation 과정에서 한 번 더 생성하지 마라.
- direct `markPaid`, 자유 입력 reference, 임의 Admin offset 같은 우회 경로를 새로 만들지 마라.
- pagination 후 client-side에서 금액을 계산해 다시 정렬하지 마라.
- 현재 page 10/25/50행의 합계를 global total처럼 사용하지 마라.
- 권한 문제를 해결한다는 이유로 모든 finance 권한을 무조건 넓히지 마라.
- 새로운 UI framework나 불필요한 dependency를 추가하지 마라. 기존 Admin component와 token을 재사용하라.
- 전체 Admin navigation이나 다른 finance 페이지를 재설계하지 마라. 연결에 필요한 최소 수정만 허용한다.
- hardcoded owner, 임의 mock 값, 합성 증빙을 실제 운영 데이터처럼 표시하지 마라.

## Phase 0 — 구현 전 기준선 확인

1. `git status --short`로 dirty worktree를 확인하고 Cash Settlements와 무관한 변경은 건드리지 마라.
2. 현재 관련 테스트를 먼저 실행해 baseline을 기록하라.
3. 로그인된 in-app browser에서 다음 상태를 1440×900으로 확인하고 baseline screenshot을 저장하라.
   - `/cash-settlements`
   - `?queue=missing-evidence`
   - `?queue=payment-check`
   - 복합 filter + page 2 상태
   - 정상 Review drawer
   - 존재하지 않는 review ID 오류 drawer
   - `?view=full`
   - dark mode 1개 상태
4. 로그인 화면으로 이동하면 사용자에게 로그인을 요청하고, 로그인 후 이어서 진행하라. 인증 정보를 추측하거나 코드에서 찾지 마라.
5. 실제 allocation submit은 수행하지 마라.

## Phase 1 — P1 금융 정확성: remaining debt를 단일 기준으로 통일

가장 먼저 해결할 필수 문제다.

현재 의미:

```text
originalDebtAmount = abs(providerEarning.netAmount)
allocatedAmount = sum(partnerBankDepositCashDebtAllocations.amount)
remainingDebtAmount = max(0, originalDebtAmount - allocatedAmount)
```

현재 drawer는 remaining을 계산하지만 list, KPI, provider aggregation, high-exposure filter와 highest-exposure sort는 original debt를 사용한다. 이를 서버 read model부터 수정하라.

### 필수 구현 범위

1. list API가 각 row에 다음 값을 authoritative field로 반환하게 하라.
   - `originalDebtAmount`
   - `allocatedAmount`
   - `remainingDebtAmount`
2. 다음 항목은 모두 `remainingDebtAmount` 기준이어야 한다.
   - Open exposure KPI
   - row Exposure
   - Partner별 exposure 합계
   - 전체 exposure 합계
   - High exposure queue 포함 여부
   - Highest exposure 정렬
   - queue count
   - pagination 경계
3. 완전히 배분된 earning은 open cash settlement queue와 summary에 남지 않아야 한다. 상태가 PAID로 바뀌는 기존 로직을 보존하면서 read predicate도 방어적으로 검증하라.
4. 부분 배분된 earning은 open 상태로 남되, original/allocated/remaining이 모든 화면에서 일치해야 한다.
5. VND 값은 정수로 처리하고 floating point 계산을 도입하지 마라.
6. client에서 relation 합계를 계산한 뒤 현재 page만 재정렬하는 방식은 금지한다.

### 서버 구현 선택 기준

- 현재 Prisma/schema와 트래픽 규모를 먼저 조사하라.
- database에서 filter/sort/pagination 가능한 read model을 구현하라.
- 기존 모델에 원자적으로 유지되는 allocated/remaining column을 추가하는 방법, 안전한 SQL subquery/view, 기존 정규 집계 모델 재사용 중 가장 작은 변경으로 정확성을 보장하는 방법을 선택하라.
- materialized field를 추가하면 allocation transaction 안에서 원자적으로 갱신하고 다음 invariant를 검증하라.

```text
0 <= allocatedAmount <= originalDebtAmount
remainingDebtAmount = originalDebtAmount - allocatedAmount
```

- migration이 필요하면 기존 migration을 수정하지 말고 새 migration을 추가하라.
- backfill이 필요하면 재실행 가능한 안전한 방법과 검증 query를 함께 제공하라.
- 기존 allocation unique constraint, SERIALIZABLE transaction, P2002/P2034 처리와 audit log를 유지하라.

### UI 표현

표의 금액은 다음 의미로 표시하라.

- 1차 강조: `Remaining`
- 2차 정보: `Original`과 `Allocated`
- allocation이 0이면 보조 정보가 불필요하게 장황하지 않게 표현한다.
- drawer의 Open exposure 명칭도 `Remaining exposure`로 통일한다.

### 필수 테스트

- original 170,000 / allocated 70,000이면 list, summary, provider total, drawer가 모두 remaining 100,000을 반환한다.
- remaining 499,999는 500,000 VND High exposure queue에서 제외된다.
- original이 더 크더라도 remaining이 작은 row는 highest exposure 우선순위가 낮아진다.
- highest exposure 정렬은 `take/skip` 전에 서버에서 수행된다.
- 완전 배분 후 open row count와 total exposure에서 제거된다.
- 동시 allocation이 remaining보다 많이 배분하지 못한다.
- 같은 allocation 재요청이 증빙, paidAt, settlementRef를 덮어쓰지 않는다.

## Phase 2 — P1 권한 정합성

현재 list/detail은 `FINANCE_SETTLEMENTS`, allocation POST는 `FINANCE_WALLET_ADJUSTMENTS` 경로에 매핑된다. 세분 권한 운영자는 화면과 submit form을 본 뒤에야 403을 받을 수 있다.

### 권장 정책

Approved Partner deposit을 기존 cash fee debt에 배분하는 작업은 새 wallet/journal entry를 생성하지 않는 settlement 작업이므로, 기본 방향은 `FINANCE_SETTLEMENTS` 권한의 governed action으로 취급한다.

### 구현 방법

1. 현재 조직의 permission naming과 비슷한 finance action을 조사하라.
2. 권장 방향과 충돌하는 명확한 기존 정책이 없다면 cash settlement 전용 allocation route를 만든다.
   - 예: cash settlement earning을 authority root로 하는 dedicated route
   - 기존 서비스의 동일 validation/transaction 함수를 호출한다.
   - 별도의 느슨한 mutation 구현을 복제하지 마라.
3. 기존 Partner deposit nested route가 다른 화면에서 사용되면 즉시 삭제하지 말고 compatibility/deprecation 여부를 명확히 하라.
4. permission guard와 route-domain test를 업데이트하라.
5. UI가 현재 운영자의 capability를 알 수 있다면 submit 가능 여부를 선제 표시한다.
6. 조직 정책상 두 카테고리가 모두 필요하다는 코드·문서 근거가 확인되면 권한을 임의로 완화하지 말고 다음을 구현하라.
   - drawer에 `Review only` 상태
   - allocation form disabled/hidden
   - 필요한 permission의 사용자 친화적 설명
   - submit 후 403으로 처음 알게 되는 흐름 제거
7. master admin, parent FINANCE, FINANCE_SETTLEMENTS only, FINANCE_WALLET_ADJUSTMENTS only의 route/UI 동작을 테스트하라.

## Phase 3 — 실제 Owner와 Follow-up

현재 표는 모든 행에 `No owner recorded / Finance follow-up`을 하드코딩한다. 이것은 기능 구현이 아니다.

1. bank reconciliation, refunds, handoff 등 기존 admin queue의 assignment/owner 모델을 먼저 검색하라.
2. 재사용 가능한 공통 assignment 모델이 있으면 새 모델을 만들지 말고 재사용하라.
3. 재사용할 수 없다면 cash settlement case의 최소 persistent 운영 모델을 설계하라.

최소 필요 필드:

- owner admin ID와 display name
- assignedAt
- lastContactAt
- lastContactResult 또는 짧은 구조화 상태
- nextFollowUpAt
- promiseToPayAt
- promisedAmount가 필요하면 currency와 함께 저장
- escalationLevel과 escalationReason
- updatedAt 및 audit actor

구현 원칙:

- assignment/update는 audit log를 남긴다.
- 존재하지 않는 admin을 owner로 저장하지 못한다.
- next follow-up overdue 상태를 서버에서 filter/sort할 수 있어야 한다.
- owner가 없는 행은 실제 null 상태일 때만 `Unassigned`로 표시한다.
- 아직 persistent model까지 구현할 수 없는 명확한 blocker가 있다면 가짜 컬럼을 유지하지 말고 컬럼을 제거한 뒤 blocker와 필요한 migration을 결과 보고서에 기록하라.

UI:

- 표에는 owner와 next follow-up만 짧게 표시한다.
- 연락 기록, promise, escalation 편집과 이력은 drawer에 둔다.
- row마다 반복되는 장문 안내를 추가하지 마라.

## Phase 4 — 1440px 운영 표 재구성

현재 1440px에서 table container 약 1050px, table `min-width: 1180px`로 내부 horizontal scroll이 생긴다. 이를 제거하라.

목표 열 구성은 최대 5개다.

1. `Partner / Booking`
   - Partner name, phone, booking short ID, service
   - Partner와 Booking 링크
2. `Remaining exposure`
   - Remaining 강조
   - Original / Allocated 보조
3. `Age / Evidence`
   - SLA, overdue, deposit evidence 상태
4. `Owner / Follow-up`
   - 실제 owner, next due, escalation
5. `Action`
   - 짧은 next action label
   - Review 단일 primary action

완료 기준:

- 1440px에서 table 내부 horizontal scrollbar가 없다.
- booking ID, 전화번호, 금액, Review가 읽을 수 있다.
- 임의의 `word-break: break-all`로 식별자를 세로 조각내지 않는다.
- 긴 next action 설명과 정책 문구는 drawer 또는 guide로 이동한다.
- sticky column은 실제로 필요한 경우에만 유지한다.
- 첫 work row가 대략 1,100~1,200px document y 이내에서 시작한다.
- 10행의 불필요한 vertical padding을 줄이되 클릭 대상과 가독성은 유지한다.
- light/dark theme을 모두 검증한다.

## Phase 5 — Global backlog와 Filtered queue 분리

현재 `Payment check 0`을 선택하면 전체 backlog 89건/7,120,000 VND도 모두 0처럼 보인다. 기술적으로 동일 filter를 적용했더라도 운영 의미가 잘못 전달된다.

1. 상단 command KPI는 global `All dates + All open` backlog를 유지한다.
2. 선택 조건 결과는 별도의 `Filtered queue` summary로 표시한다.
3. global과 filtered 수치에 범위 label을 명시한다.
4. 다음을 동시에 볼 수 있어야 한다.

```text
Global open backlog: 89 · 7,120,000 VND
Selected queue: Payment check · 0
```

5. global summary와 filtered summary를 위해 같은 고비용 query를 두 번 단순 호출하지 마라. 한 번의 workbench read model 또는 효율적인 병렬/조건부 집계를 설계하라.
6. 현재 page rows 합계로 global summary를 대체하지 마라.

## Phase 6 — Queue IA, count badge와 empty state

현재 실제 분포는 All open 89, Overdue 89, Missing evidence 89, High exposure 0, Payment check 0이다.

### Queue 구조

- 1차: All open, Overdue, Missing evidence
- 2차: High exposure, Payment check
- 모든 항목에 authoritative count badge를 표시한다.
- 2차 queue를 `Additional queues`로 묶는다면 항목 수와 각 count가 바로 보여야 하고, 현재 선택된 2차 queue가 접힌 상태에서도 toolbar에 표시돼야 한다.
- 숨은 menu 안에서만 현재 queue를 알 수 있는 구조는 금지한다.
- 500,000 VND High exposure threshold를 tooltip/help text로 설명한다.
- count는 현재 queue predicate를 제외한 공통 검색/날짜/age/SLA 범위와 어떤 관계인지 UI 문구와 API 테스트에서 명확히 정의하라.

### Active filters

- 기본값 `All dates`, `All ages`, `Oldest first`, `All SLA`는 active chip으로 표시하지 않는다.
- 사용자가 변경한 값과 search만 표시한다.
- `Clear`는 canonical root로 돌아가고 모든 상태를 초기화한다.

### Empty state

0건일 때 7열 빈 table shell과 내부 scrollbar를 렌더하지 마라.

filter panel 바로 아래에 compact empty state를 표시한다.

- queue별 구체적 제목과 설명
- `Return to All open (count)`
- `Clear filters`
- 필요할 때만 authoritative 연결 화면 CTA

예시:

```text
No booking-payment anomalies need review.
The global cash settlement backlog still contains 89 open receivables.
[Return to All open (89)] [Clear filters]
```

## Phase 7 — Review drawer의 운영 정보 완성

1. `Original debt / Allocated / Remaining`을 동시에 표시한다.
2. API가 이미 가져오는 `auditLogs`를 버리지 말고 최근 audit timeline을 렌더한다.
3. timeline에 actor, action, timestamp, amount/result, target evidence link를 표시한다.
4. linked deposit에는 deposit request, bank transaction, ledger entry, journal batch를 추적할 수 있는 링크 또는 ID를 제공한다.
5. 성공 notice에도 allocation ID, audit ID, deposit evidence 링크를 제공한다.
6. audit reason 기본값을 raw deposit/earning ID를 이어 붙인 boilerplate로 두지 마라.
7. 기존 reason taxonomy가 있으면 재사용하고, 없으면 작은 enum을 도입한다.
   - 예: `BANK_DEPOSIT_CONFIRMED`, `PARTIAL_RECOVERY`, `FINAL_RECOVERY`, `OTHER_REVIEWED`
8. reason code와 상세 사유를 함께 저장하고 audit log에도 기록한다.
9. `OTHER`를 선택하면 구체적인 상세 사유를 필수로 한다.
10. submit pending, success, stale/duplicate, evidence invalid, permission denied 상태를 명확히 유지한다.

## Phase 8 — 운영 가이드와 legacy 정리

1. Operating guide 진입점을 header 또는 filter toolbar 우측에 둔다.
2. guide는 drawer/dialog 또는 짧은 disclosure를 사용하되 work table 뒤까지 스크롤해야만 발견되는 구조를 없앤다.
3. `view=full`은 canonical `view=guide` 또는 root로 server redirect한다.
4. 다음 파일·함수는 `rg`로 실제 import를 확인한 후 cash settlement production path에서 완전히 사용되지 않으면 삭제하라.
   - legacy cash settlement confirmation helper/spec
   - 과거 full-view board/priority/rule/workflow/provider group component와 테스트
   - 사용되지 않는 `recordPartnerBankDeposit` Admin Web action
   - row/type의 actionRows, accounting preview, settlement defaults 등 dead field
5. 다른 화면에서 사용하는 코드는 삭제하지 마라.
6. `ADMIN_OFFSET` 문자열이 cash settlement production UI/helper에 남아 있으면 governed approval model이 없는 한 제거하라. 정책 설명 문구로만 존재하는 것은 허용한다.

## Phase 9 — Summary API 성능 개선

현재 `cashSettlementSummaryForAdmin`은 대략 SLA policy 1회, aggregate/count/groupBy/evidence/payment/coupon 8회, age bucket 5회, SLA count 1회, provider profile hydration 1회 등 약 15개 DB operation을 수행한다. 현재 workbench는 `topProviderGroups`를 사용하지 않는다.

1. 기본 summary에서 사용하지 않는 `topProviderGroups` 계산과 top 20 provider profile hydration을 제거하거나 opt-in endpoint로 분리한다.
2. age bucket, SLA, queue count를 가능한 범위에서 conditional aggregation/read query로 통합한다.
3. unbounded metadata hydration을 피한다.
4. global과 filtered summary를 추가하면서 DB operation을 단순 두 배로 늘리지 마라.
5. 응답 payload에서 사용되지 않는 필드를 제거하되 다른 consumer가 있으면 compatibility를 확인한다.
6. query count와 응답 시간을 계측 가능한 구조로 만들고, 구현 전후 호출 수를 테스트 또는 보고서에 기록한다.
7. 실제 staging profiling이 없으면 성능 향상을 추측 숫자로 주장하지 마라.

목표:

- 기본 workbench summary에서 provider profile hydration 0회
- 현재보다 명확히 적은 DB operation
- list와 summary는 계속 병렬 요청 가능
- review detail은 선택된 경우에만 요청
- 오류 시 page-only total을 정상 global total처럼 표시하지 않음

## Phase 10 — 접근성·문서 제목

1. route metadata에 `Cash Settlement Workbench | HANDS Admin`처럼 의미 있는 document title을 추가한다.
2. 공통 Admin shell에 skip link가 없다면 기존 구조를 조사해 `Skip to main content`를 추가한다.
3. skip link 추가가 전체 Admin에 영향을 주므로 공통 shell 테스트를 추가하고 unrelated layout을 깨지 마라.
4. queue count와 selected state를 screen reader가 이해할 수 있게 accessible name/current state를 제공한다.
5. drawer의 기존 focus trap, Escape, opener focus return을 회귀 테스트한다.
6. 색상만으로 overdue/evidence/selection을 구분하지 마라.
7. WCAG 준수를 근거 없이 선언하지 마라.

## 문구 기준

운영자가 데이터 범위를 오해하지 않도록 다음 용어를 일관되게 사용하라.

- `Open exposure` → global open backlog일 때만 사용
- `Remaining exposure` → row/drawer의 아직 회수되지 않은 금액
- `Original debt` → earning 원채권
- `Allocated` → approved deposit으로 이미 배분된 금액
- `Missing settlement evidence` → approved deposit allocation이 없음
- `Payment review` → booking payment record가 없거나 CASH가 아닌 예외
- `Unassigned` → 실제 owner가 null일 때만 사용
- `Next follow-up` → persistent timestamp가 있을 때만 표시
- `Review only` → 현재 operator가 읽을 수 있으나 배분 권한이 없을 때

피해야 할 문구:

- 실제 owner가 없는데 `Finance follow-up`이라고 단정
- 선택 queue 0을 전체 backlog 0처럼 표현
- booking payment와 settlement evidence를 모두 `Payment evidence`라고 표현
- synthetic ID를 reference/evidence로 표현
- 성공하지 않은 mutation을 완료처럼 표현

## 테스트 요구사항

기존 테스트를 단순 수정해 통과시키는 데 그치지 말고 실제 운영 invariant를 검증하라.

### Admin Web

- remaining/original/allocated 표시
- changed-only active filter chip
- queue count와 selected additional queue 표시
- global backlog와 filtered result 분리
- 0건 compact empty state와 All open CTA
- Review/Close/Success/Error query preservation
- capability에 따른 action 표시
- audit timeline과 evidence link
- unique accessible labels, drawer focus/Escape/return
- legacy `view=full` canonicalization
- owner가 null일 때와 실제 assignment가 있을 때

### API

- partial allocation remaining summary/list/group/filter/sort
- fully allocated exclusion
- pagination 이전 remaining sort
- high exposure remaining threshold
- global/filtered/queue count 정의
- allocation concurrency/idempotency/invariant
- cross-partner/currency/deposit-status/evidence rejection
- permission category별 read/write behavior
- owner/follow-up validation과 audit log
- lightweight summary가 top provider hydration을 수행하지 않음

### 최소 실행 명령

현재 package script를 확인한 뒤 최소한 다음 관련 suite를 실행하라.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/cash-settlements
npm.cmd run test --workspace @massage-vn/api -- src/earnings/earnings.service.spec.ts src/admin/admin.controller.spec.ts src/admin/admin.service.spec.ts src/admin/admin.dto.spec.ts src/admin/admin-operator-category.guard.spec.ts src/admin/admin-route-domain.spec.ts
```

변경 범위에 따라 Prisma, typecheck, lint, admin shell, migration 검증도 실행하라. 실패가 unrelated 기존 변경 때문이면 근거를 기록하되, 이번 변경이 만든 실패는 모두 해결하라.

## 1440px 브라우저 QA 시나리오

코드와 테스트가 통과한 뒤 실제 화면을 다시 검사하라.

1. `/cash-settlements`
   - global backlog와 기본 queue가 정확함
   - 표 첫 행까지 과도한 scroll이 없음
   - horizontal table scroll 없음
2. `?queue=missing-evidence`
   - count, selected state, filtered summary 일치
3. `?queue=payment-check`
   - global backlog는 유지
   - filtered queue는 0
   - compact empty state와 All open CTA
4. 복합 상태
   - `queue`, `q`, `age`, `sla`, `sort`, `page`, `pageSize`
   - Review/Close/pagination 후 모두 보존
5. 부분 배분 fixture 또는 read-only test data 상태
   - original/allocated/remaining 일치
   - 실제 운영 mutation 없이 확인
6. invalid/stale review ID
   - alert와 action 차단
7. permission-limited state
   - submit 후 403이 아니라 사전에 Review only로 표시
8. `?view=full`
   - canonical redirect
9. light/dark
   - 표, badge, drawer, empty state 대비와 hierarchy 확인
10. keyboard
   - queue, search, Review, drawer, Escape, focus return

각 accepted screenshot을 저장하고 직접 열어 crop, overflow, unreadable ID, 잘못된 count가 없는지 확인하라.

## 완료 조건

다음 조건이 모두 충족되기 전에는 완료로 보고하지 마라.

- 모든 open amount가 remaining debt 기준으로 일치한다.
- remaining 기준 filter/sort/pagination이 서버에서 수행된다.
- partial/full allocation 회귀 테스트가 있다.
- 권한이 submit 전에 명확하고 privilege가 무분별하게 확대되지 않는다.
- hardcoded owner/follow-up이 제거된다.
- 1440px table horizontal scroll이 없다.
- global backlog와 filtered queue 0을 동시에 이해할 수 있다.
- queue count badge와 compact empty state가 동작한다.
- audit timeline과 evidence 추적 링크가 있다.
- 사용하지 않는 top provider summary 비용과 dead legacy 경로가 제거된다.
- document title과 keyboard flow가 정상이다.
- light/dark 1440px screenshot QA가 완료된다.
- 관련 Admin Web/API/migration/type tests가 통과한다.
- 실제 금융 mutation 없이 검증했다.

## 최종 결과 보고 형식

작업 완료 후 다음 내용을 포함한 Markdown 보고서를 생성하라.

권장 경로:

`C:\dev\massage-on-demand-vn\output\cash-settlements-final-remediation-YYYY-MM-DD\cash-settlements-final-remediation-report.md`

보고서 내용:

1. 최종 결론과 운영 준비도
2. 변경한 파일 목록과 각 파일의 역할
3. P1 금융 정확성 구현 방식과 invariant
4. permission 결정과 근거
5. owner/follow-up 모델
6. global/filtered queue 정의
7. summary DB operation 전후 비교
8. 삭제한 legacy/dead code
9. migration/backfill/rollback 방법
10. 실행한 테스트 명령과 정확한 통과 결과
11. 1440px light/dark/empty/drawer screenshot
12. 완료 조건 체크리스트
13. 남은 위험 또는 blocker

최종 답변은 다음 순서로 작성하라.

1. 구현 완료 여부와 배포 판정
2. 가장 중요한 변경 5개 이내
3. 테스트 결과
4. 보고서 링크
5. 실제 금융 mutation을 수행하지 않았다는 확인

추측으로 완료를 선언하지 말고 코드, 테스트, 브라우저 증거가 있는 항목만 완료로 표시하라.

