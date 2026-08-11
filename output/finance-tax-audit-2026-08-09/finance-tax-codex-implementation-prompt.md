# HANDS Admin `/finance-tax` 개선 구현용 Codex 프롬프트

아래 `Codex에 전달할 프롬프트` 전체를 새 Codex 작업에 그대로 붙여 넣는다. 이 프롬프트는 감사 보고서의 지적사항을 단순히 다시 설명하는 것이 아니라, 현재 소스를 재검증하고 회계 정확성·상세 큐 범위·운영 UI·테스트까지 실제로 수정하도록 설계되었다.

---

## Codex에 전달할 프롬프트

```text
HANDS 관리자 웹의 Tax & Period Close overview를 실제 Finance 운영자가 월 결산 통제 화면으로 신뢰하고 사용할 수 있도록 완성해줘.

작업 저장소:
C:\dev\massage-on-demand-vn

대상 화면:
http://localhost:3101/finance-tax

반드시 먼저 읽을 자료:
1. C:\dev\massage-on-demand-vn\AGENTS.md
2. C:\dev\massage-on-demand-vn\output\finance-tax-audit-2026-08-09\finance-tax-deep-audit-report.md
3. 보고서에 언급된 현재 화면, view model, API summary, monthly closeout preflight, 관련 테스트 파일

핵심 목표:
- 화면이 말하는 hard blocker와 서버가 실제 status transition에서 사용하는 blocker를 완전히 일치시킨다.
- 화면의 count·amount를 클릭했을 때 같은 회계월, 같은 source, 같은 direction, 같은 review 상태의 데이터 집합이 열린다는 것을 보장한다.
- 회사 부담 coupon을 포함한 settlement allocation 공식을 서버의 단일 권위 계산으로 통합한다.
- 1440×900 첫 화면에서 운영자가 선택 월, 데이터 신선도, 현재 단계, 다음 단계, hard blocker, owner, oldest age, 첫 행동을 바로 확인하게 한다.
- 테스트 통과만을 목표로 하지 말고 실제 화면과 데이터 계약까지 검증한다.

이 요청은 분석 보고서 작성이 아니라 실제 코드 수정과 검증까지 포함한다. 계획만 제시하고 멈추지 말고, 현재 코드에서 사실을 확인한 뒤 안전하게 구현하고 테스트해줘.

────────────────────────────────────────
1. 작업 원칙과 제한
────────────────────────────────────────

- AGENTS.md의 single-agent 규칙을 준수하고 subagent를 만들지 않는다.
- 작업 시작 시 `git status --short`를 확인한다. 사용자의 기존 변경을 보존하고 관련 없는 수정은 되돌리거나 덮어쓰지 않는다.
- 보고서의 line number와 현재 코드는 달라질 수 있으므로 심볼명과 실제 동작을 기준으로 다시 찾는다.
- 보고서의 결론을 맹목적으로 적용하지 말고, 현재 API·UI·테스트에서 문제를 재현한 뒤 수정한다. 보고서와 현재 코드가 다르면 현재 코드 증거를 우선하고 차이를 최종 보고한다.
- 실제 운영 데이터의 상태를 변경하지 않는다. 브라우저 검수에서는 close transition, 승인, 송금, 정산 확정 같은 mutation을 실행하지 않는다.
- Prisma migration이나 schema 변경은 꼭 필요한 경우가 아니면 피한다. 필요하다면 먼저 이유와 호환성 영향을 명확히 정리한다.
- 기존 API shape는 가능한 한 호환되게 확장한다. 이미 사용하는 consumer를 깨뜨리지 않는다.
- 새로운 UI 라이브러리나 대형 dependency를 추가하지 않는다. 기존 design system, tokens, components, `MoneyText`를 재사용한다.
- 관리자 웹은 운영 도구다. 장식보다 스캔 속도, 정확성, 상태 구분, 다음 행동의 명확성을 우선한다.
- 검수 대상은 1440px 이상이다. 1024px 이하 반응형이나 모바일 화면을 별도 설계·수정·보고하지 않는다.
- 전체 Finance IA를 다시 설계하지 않는다. 이번 변경은 `/finance-tax`와 직접 연결되는 closeout/preflight/filter contract에 한정한다.
- 자동 commit은 하지 않는다. 코드와 테스트를 완료한 뒤 변경 내용을 보고한다.

────────────────────────────────────────
2. 시작 전 베이스라인 조사
────────────────────────────────────────

다음 사항을 코드에서 추적하고 짧은 구현 계획을 세운 뒤 바로 작업을 시작한다.

- `/finance-tax` page가 summary를 가져오고 화면 row와 href를 생성하는 흐름
- `summary.preflight`, status transition validation, monthly tax closing page가 blocker를 해석하는 흐름
- settlement allocation/reconciliation delta가 계산되는 서버 함수와 모든 consumer
- coupon finance, booking settlement audit, partner bank deposit, bank reconciliation의 URL parser와 API filter
- `period`, `range`, `review`, `type`, `source`, `sort`, `returnTo`가 page → API → query까지 보존되는지
- `id: null`인 synthetic DRAFT와 저장된 DRAFT의 차이
- 현재 테스트가 어떤 중요한 계약을 검증하지 않는지

최소 베이스라인 테스트:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/finance-tax/page.spec.tsx
npm.cmd run test --workspace @massage-vn/admin-web -- app/finance-tax/tax-settlement-page-model.spec.ts
```

테스트 명령이나 파일명이 현재 저장소에서 바뀌었다면 가장 가까운 실제 테스트를 찾아 실행하고 그 차이를 기록한다.

────────────────────────────────────────
3. P0 — 회계 및 마감 통제 정확성
────────────────────────────────────────

### 3.1 `Closeout gates`의 임의 합산 제거

현재 page component에서 open tax, fee, coupon, bank, formula count를 더해 `Closeout gates`처럼 표시하는 별도 계산을 제거한다.

요구사항:

- hard blocker의 권위 source는 서버가 실제 다음 status transition 검증에 사용하는 `summary.preflight.blockers`여야 한다.
- `/finance-tax`와 `/finance-tax/monthly-tax-closing`이 동일한 resolver/view model을 사용하게 한다.
- 이미 존재하는 `resolveMonthlyTaxClosingPreflight()`와 `buildMonthlyTaxClosingPreflightLinks()`가 현재 요구를 충족하면 재사용하고, 부족하면 두 페이지가 함께 사용하는 shared contract로 확장한다.
- 동일 blocker code를 카드 숫자에서 중복 집계하지 않는다.
- hard blocker, review flag, affected record 수, 일반 workload를 하나의 숫자로 합치지 않는다.
- `journalReconciliationIssueCount`와 현재 stage에서 실제 적용되는 remittance blocker가 overview에도 나타나는지 검증한다.
- DRAFT→REVIEWED, REVIEWED→DECLARED, DECLARED→PAID, PAID→CLOSED처럼 단계별 blocker가 실제 transition 규칙과 일치해야 한다.

권장 표시:

- `Hard blockers`: 현재 transition을 막는 control 수
- `Affected records`: 해당 blocker와 연결된 실제 레코드 수. 계산할 수 없으면 `—`로 표시하고 임의 추정하지 않는다.
- `Review flags`: 현재 transition은 막지 않지만 월 마감 전에 확인할 control 수
- `Stage`: `DRAFT → REVIEWED`처럼 현재 단계와 다음 단계를 함께 표시

`Hard blockers 2`와 `Affected records 17`을 분리하고, 서로 다른 의미를 `63 gates` 같은 단일 숫자로 표현하지 않는다.

### 3.2 canonical coupon-aware allocation 공식

서버에 settlement allocation identity를 계산하는 단일 권위 함수를 둔다. 같은 공식을 overview, monthly closing, settlement audit, export/CSV 등 관련 consumer가 사용하도록 정리한다.

검증할 공식:

```text
customerPaymentAmountTotal
+ companyCouponExpenseTotal
- partnerPayoutTotal
- partnerWithholdingTotal
- platformFeeGrossTotal
= reconciliationDelta
```

정상 조건은 `reconciliationDelta === 0`이다.

중요:

- Payment processing fee는 위 allocation identity에 포함하지 않는다. 별도 회사 비용/fee control로 유지한다.
- 기존 UI helper의 설명, API 계산, 테스트 fixture가 동일한 공식을 설명하고 검증해야 한다.
- 회사 부담 coupon이 0인 경우와 양수인 경우를 모두 테스트한다.
- 반올림·통화 단위는 기존 서버 규칙을 따르고 floating-point 임의 계산을 추가하지 않는다.
- 기존에 별도로 존재하는 net revenue 계산과 allocation reconciliation을 혼동하지 않는다.
- operand breakdown을 summary contract에 제공해 운영자가 차이의 근거를 볼 수 있게 한다.

필수 fixture 예시:

```text
Customer paid          540,000
+ Company coupon        60,000
- Partner payout       430,000
- Withholding           42,000
- Platform fee gross   128,000
= Difference                 0
```

### 3.3 저장되지 않은 월을 `DRAFT`로 위장하지 않기

`summary.id === null`이면 운영 상태를 `NOT_STARTED`로 표현한다. 실제 closing record가 저장된 `DRAFT`와 구분한다.

요구사항:

- `NOT_STARTED`: 아직 월 마감 레코드 없음
- `DRAFT`: 마감 레코드가 생성되어 작업 중
- 기존의 REVIEWED/DECLARED/PAID/CLOSED/REVERSED 상태는 서버의 실제 enum/flow에 맞춘다.
- `NOT_STARTED`일 때 0 VND를 확정 금액처럼 강조하지 않는다.
- 데이터가 존재하면 `Start monthly close` 또는 현재 제품의 정확한 시작 행동으로 안내하되, overview 검수 중 실제로 실행하지 않는다.
- settlement count가 0이고 close record도 없으면 `No activity · close not started` empty state를 표시한다.
- 미래 회계월은 차단하거나 명시적인 `Future planning` 상태로 표시한다. 미래 월을 정상 DRAFT처럼 보이게 하지 않는다.

────────────────────────────────────────
4. P0 — drill-down 범위 무결성
────────────────────────────────────────

모든 summary row의 숫자와 클릭 후 열린 목록이 같은 query scope를 가져야 한다. URL에 parameter만 표시하고 API가 무시하는 가짜 필터를 만들지 않는다. page parser, API DTO/route, service query, pagination, export까지 end-to-end로 보존한다.

### 4.1 Open tax rows

반드시 같은 선택 월의 tax-open 집합을 연다.

```text
/finance-tax/booking-settlement-audit
  ?range=all
  &review=tax-open
  &period=<selected period>
  &sort=oldest
  &returnTo=<safe encoded overview URL>
```

`review=open`으로 보내지 않는다.

### 4.2 Coupon review

- coupon finance UI와 API가 `period=YYYY-MM`을 정식으로 지원하게 한다.
- overview count가 월별이면 상세 목록도 같은 월별 집합이어야 한다.
- `range`와 `period`가 동시에 존재할 때 우선순위를 명확히 정의한다. 권장은 period 우선이다.
- card, pagination, export, filter reset, return link에서 period를 잃지 않는다.

권장 URL:

```text
/finance-tax/coupon-finance
  ?period=<selected period>
  &review=coupon-review
  &sort=oldest
  &returnTo=<safe encoded overview URL>
```

현재 실제 route 이름이 다르면 기존 canonical route를 사용하되 위 filter contract를 유지한다.

### 4.3 Partner deposit / payout bank reconciliation

다음 세 queue를 서로 다른 데이터 집합으로 연다.

```text
Partner deposit:
/finance-tax/partner-bank-deposits
  ?period=<selected period>
  &review=needs-reconciliation
  &sort=oldest

Payout outflow:
/finance-tax/bank-reconciliation
  ?workspace=operations
  &period=<selected period>
  &review=unmatched
  &type=OUTFLOW
  &source=PAYOUT
  &sort=oldest

Payout return inflow:
/finance-tax/bank-reconciliation
  ?workspace=operations
  &period=<selected period>
  &review=unmatched
  &type=INFLOW
  &source=PAYOUT
  &sort=oldest
```

각 URL에 safe encoded `returnTo`를 추가한다.

- legacy `/approval-queue?view=reconciliation` redirect에 의존하지 않는다.
- bank API/query가 `period`, `type`, `source`를 실제로 적용하게 한다.
- selected period는 베트남 회계월 기준으로 계산하고 서버/클라이언트 timezone 차이를 테스트한다.
- outflow와 inflow가 동일한 generic unmatched 결과를 반환하지 않는지 테스트한다.

### 4.4 Settlement records

`Booking settlement records`는 action queue가 아니라 선택 월의 전체 기록을 열어야 한다.

```text
review=all&period=<selected period>&range=all
```

### 4.5 Drill-down continuity

각 상세 페이지 상단에 가능하면 다음 정보를 표시한다.

```text
Source: Tax & Close Overview · 2026-08 · 36 tax-open rows
```

overview의 displayed count와 상세 API 결과의 total count가 동일한 조건에서 일치하는 테스트를 추가한다.

────────────────────────────────────────
5. P1 — 운영자 중심 정보 구조
────────────────────────────────────────

`/finance-tax`는 읽기 중심의 compact monthly close command cockpit으로 유지하고, 실제 status mutation, evidence, history, export는 `/finance-tax/monthly-tax-closing`에 둔다.

두 페이지를 합치는 대규모 route 변경은 이번 범위에서 하지 않는다. 대신 두 페이지가 동일한 preflight/view model을 사용하고 같은 개념을 각각 계산하지 않게 한다.

1440×900 첫 화면의 권장 구조:

```text
Tax & Period Close     [Month picker] [Current month]  Updated <time>
Vietnam monthly close command cockpit

[Stage → Next stage] [Hard blockers] [Review flags] [Tax payable]

Work requiring attention
Priority | Control | Open work | Exposure | Oldest | Owner | Action

Cleared controls (N) ▸

Related registers: VAT · Withholding · Fees · Settlements · GL · Reversals
```

구체적인 요구사항:

- 상단의 기존 3 metrics와 4 command cards를 하나의 compact decision strip으로 통합한다.
- VAT와 Partner withholding을 중복해서 표시하지 않는다.
- month picker는 header 영역 한 곳에만 둔다.
- status는 decision strip에서 한 번만 표시한다.
- `generatedAt` 또는 신뢰할 수 있는 마지막 계산 시각을 표시한다.
- `current stage → next stage`, `Ready` 또는 `Blocked`를 함께 표시한다.
- blocker가 있으면 `Resolve first blocker`, 없으면 `Open close step`처럼 다음 행동을 제공한다.
- 첫 actionable row가 1440×900 initial viewport 안에 나타나야 한다.
- active hard blocker와 review item을 먼저 표시한다.
- 0건 control은 기본 표에서 제거하고 `Cleared controls (N)` disclosure 안에 넣는다.
- cleared row에는 primary action을 사용하지 않고 `View evidence` 정도의 낮은 강조를 사용한다.
- 모든 control이 clear면 성공 상태와 다음 close action을 표시한다.
- 기존 `Accounting records` 큰 표는 `Related registers` compact link group으로 축소한다.
- sidebar, breadcrumb, local subnav, header action, related links에서 같은 navigation을 과도하게 반복하지 않는다.
- local workspace subnav는 유지하고, header에는 현재 페이지 고유 action만 남긴다.

가능한 범위에서 row에 다음 데이터를 제공한다.

- `affectedCount`
- `amount/exposure`
- `oldestOpenAt` 또는 oldest age
- assigned/unassigned count
- queue owner 또는 담당자
- due date / overdue count

서버에 실제 값이 없으면 화면에서 추정하거나 가짜 owner를 만들지 않는다. 이번 범위에서 안전하게 제공할 수 없는 필드는 `—`와 명확한 empty label로 처리하고, 남은 API gap을 최종 보고한다.

────────────────────────────────────────
6. 상태·금액·문구 규칙
────────────────────────────────────────

금액이 0보다 크다는 이유만으로 warning tone을 사용하지 않는다.

색상/톤 기준:

- 금액 크기 자체: neutral 또는 info
- 아직 미검토·불완전·provisional: warning
- formula mismatch, hard blocker, overdue: danger
- close complete와 evidence confirmed: success

금액 카드 또는 summary에 coverage를 표시한다.

예:

```text
Partner withholding
265,000 VND
36 posted settlements · 0 reversals
Provisional until tax rows are reviewed
```

문구 개선:

- `63 open check(s)` → `2 hard blockers · 17 affected records`
- `36 row(s)` → `36 tax rows`
- `11 flag(s)` → `11 fee evidence issues`
- `Review` → `Review tax rows` / `Review fee evidence`
- `Reconcile` → `Match deposits` / `Match payout outflows` / `Match return inflows`
- `Open` → `Open settlement records`
- `DRAFT`, `TAX`, `FEE`, `BANK` 같은 코드는 보조 chip으로 두고 사람이 이해하는 label을 먼저 표시한다.

베트남 운영자에게 보여 주는 기존 언어 정책을 유지한다. 프로젝트의 현재 관리자 UI가 영어라면 사용자 노출 문구를 갑자기 한국어로 바꾸지 않는다.

────────────────────────────────────────
7. 1440px UI 및 접근성
────────────────────────────────────────

- 1440×900에서 action label이 줄바꿈되지 않게 action column 폭과 `white-space`를 조정한다.
- `Reconcile`이 `Reconcil / e`로 끊기지 않아야 한다.
- table column은 `Current`처럼 서로 다른 값을 섞는 모호한 이름을 사용하지 않는다.
- 권장 column: `Open work`, `Exposure`, `Oldest`, `Owner`, `Action`.
- 같은 `Review`, `Open`, `Reconcile` 링크를 반복하지 않는다. visible label 자체를 구체화하고 필요한 경우 contextual `aria-label`을 추가한다.
- 상태를 색상만으로 전달하지 않는다. label/icon/text를 함께 사용한다.
- month 적용 후 결과가 갱신됐음을 screen reader가 인지할 수 있게 live region 또는 기존 접근 가능한 feedback pattern을 사용한다.
- keyboard focus order와 시각적 작업 우선순위를 일치시킨다.
- disclosure는 button semantics, `aria-expanded`, 명확한 accessible name을 가진다.
- 기존 heading/table/nav semantic 구조는 유지한다.

1024px 이하 레이아웃은 검사·수정 범위에 포함하지 않는다. 단, 기존 모바일 코드를 고의로 망가뜨리지는 않는다.

────────────────────────────────────────
8. 필수 테스트
────────────────────────────────────────

기존 테스트를 단순 snapshot/string 확인으로만 늘리지 말고 핵심 business contract를 검증한다.

### 서버 및 model 테스트

- coupon 0일 때 allocation delta
- company coupon이 양수일 때 allocation delta가 정확히 0인 fixture
- payment processing fee가 allocation identity에 포함되지 않음
- formula operand breakdown과 delta 일치
- `id: null` → `NOT_STARTED`
- stored close row → 실제 DRAFT
- 단계별 preflight matrix
  - DRAFT → REVIEWED
  - REVIEWED → DECLARED
  - DECLARED → PAID
  - PAID → CLOSED
- journal blocker가 overview hard blocker에 포함됨
- remittance evidence/journal/amount blocker가 적용 단계에서만 포함됨
- review flag가 hard blocker 수에 섞이지 않음

### URL/filter 테스트

- tax row: `review=tax-open`, selected period, oldest sort, returnTo
- coupon: selected period가 page/API/export/pagination에 유지됨
- partner deposit: period와 전용 review 유지
- payout outflow: `type=OUTFLOW&source=PAYOUT`
- payout return: `type=INFLOW&source=PAYOUT`
- settlement records: `review=all`
- 악성 또는 외부 `returnTo`를 거부하고 내부 safe return만 허용
- URL의 period/type/source가 실제 service query에 적용됨

### UI 테스트

- summary API 오류 시 0 VND/0건으로 위장하지 않음
- duplicated VAT/withholding summary가 없음
- active control만 기본 표에 나타남
- cleared controls가 disclosure에 있음
- contextual action label과 accessible name 존재
- current/next stage와 readiness가 표시됨
- 첫 actionable row가 decision strip 다음에 위치함

기존 두 테스트 외에 변경한 API/service/model의 가장 작은 관련 테스트 suite를 실행한다. 이후 AGENTS.md 기준 admin scope verification을 실행한다.

```powershell
npm.cmd run verify:scope -- -Scope admin
```

API 동작을 변경했다면 API 관련 최소 테스트와 다음도 실행한다.

```powershell
npm.cmd run verify:scope -- -Scope api
```

시간이나 환경 문제로 full verification을 실행하지 못하면 실행한 척하지 말고 정확한 실패 원인과 미검증 범위를 남긴다.

────────────────────────────────────────
9. 실제 브라우저 검증
────────────────────────────────────────

코드 수정 후 로그인된 관리자 화면 또는 안전한 local fixture로 다음을 확인한다.

Viewport:
- 1440×900
- 필요하면 1600×900 추가
- 1024px 이하 검사 금지

검증 항목:

1. 첫 화면 안에 month, freshness, stage, next stage, blocker, 첫 actionable row가 보이는가
2. action label이 한 줄인가
3. active row와 cleared row의 시각적 우선순위가 구분되는가
4. 0 VND가 확정/정상으로 오해되지 않는가
5. 각 drill-down URL이 period/review/type/source를 보존하는가
6. 상세 total과 overview count가 같은 filter 조건에서 일치하는가
7. browser console error와 failed request가 없는가
8. API error state에서 가짜 0을 표시하지 않는가
9. keyboard로 month picker, first blocker, cleared disclosure, related links에 접근할 수 있는가

검수 중 실제 재무 상태를 바꾸는 버튼은 누르지 않는다. 필요한 상태 검증은 unit/integration fixture로 수행한다.

변경 전후 1440×900 스크린샷을 저장하고 최종 보고서에서 경로를 제공한다.

────────────────────────────────────────
10. 완료 조건
────────────────────────────────────────

다음 조건을 모두 만족해야 완료로 판단한다.

- page component의 임의 gate 합산이 제거됨
- overview와 monthly close가 동일한 preflight source 사용
- hard blocker, review flag, workload, affected record를 분리함
- journal 및 단계별 remittance blocker가 정확히 표시됨
- coupon-aware canonical allocation 공식과 fixture가 존재함
- payment processing fee가 allocation identity에서 제외됨
- synthetic DRAFT와 stored DRAFT가 구분됨
- tax/coupon/deposit/outflow/inflow/records drill-down이 정확한 범위를 보존함
- query parameter가 URL뿐 아니라 API/service query에도 실제 적용됨
- 1440×900 첫 viewport에 첫 actionable row가 표시됨
- 중복 metric/card와 과도한 Accounting records 표가 정리됨
- owner/oldest/freshness는 실제 데이터만 표시하고 가짜 값 없음
- contextual action copy와 기본 접근성 보완 완료
- 관련 테스트, admin scope, 필요한 API scope 검증 결과가 보고됨
- 실제 운영 데이터 mutation 없음

────────────────────────────────────────
11. 최종 보고 형식
────────────────────────────────────────

완료 후 다음 순서로 보고한다.

1. 최종 결과와 운영상 달라진 점
2. 변경 파일 목록과 각 파일의 역할
3. 회계 공식 및 preflight 계약 변경 내용
4. 각 drill-down의 최종 URL/filter contract
5. 1440×900 전후 화면 비교와 스크린샷 경로
6. 실행한 명령과 pass/fail/skipped 결과
7. protected area 변경 여부
8. 아직 남은 위험 또는 API 데이터 gap
9. 다음 권장 작업 1개

중요한 미해결 blocker가 있으면 화면을 완성했다고 표현하지 않는다. 부분 완료라면 어떤 acceptance criterion이 남았는지 체크리스트로 정확히 표시한다.
```

---

## 사용 시 참고

- Codex 앱에서 저장소 `C:\dev\massage-on-demand-vn`을 연 상태로 위 프롬프트를 사용한다.
- 변경 전에 설계와 영향 범위를 먼저 검토하고 싶다면 프롬프트 맨 앞에 `/plan`을 추가한다. 계획 승인 후 동일 작업에서 구현까지 계속하도록 지시한다.
- 구현 범위가 크므로 중간에 UI만 고치고 끝내지 않게 `P0 회계 정확성 → drill-down → 운영 UI → 검증` 순서를 유지한다.
- 원본 감사 근거는 [finance-tax-deep-audit-report.md](./finance-tax-deep-audit-report.md)에 있다.
