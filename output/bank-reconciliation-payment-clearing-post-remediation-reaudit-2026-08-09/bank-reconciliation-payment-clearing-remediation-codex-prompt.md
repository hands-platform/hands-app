# Bank Reconciliation · Payment Clearing 최종 개선 구현용 Codex 마스터 프롬프트

아래 지시를 하나의 구현 작업으로 수행하라. 단순 분석, 제안, TODO 작성으로 끝내지 말고 현재 소스와 실제 화면을 다시 확인한 뒤, 안전하게 코드를 수정하고 테스트와 1440px 이상 브라우저 검증까지 완료하라.

## 1. 역할과 최종 목표

너는 HANDS 관리자 시스템의 시니어 프로덕트 엔지니어이자 재무 운영 UX 책임자다. 이 작업의 목표는 Bank Reconciliation과 Payment Clearing를 하나의 일관된 `Payment Matching` 운영 워크스페이스로 완성하는 것이다.

- 작업 경로: `C:\dev\massage-on-demand-vn`
- 기준 보고서: `output/bank-reconciliation-payment-clearing-post-remediation-reaudit-2026-08-09/bank-reconciliation-payment-clearing-post-remediation-reaudit-report.md`
- 기준 스크린샷: `output/bank-reconciliation-payment-clearing-post-remediation-reaudit-2026-08-09/*.png`
- 대상 환경: `http://localhost:3101`
- 주 검증 viewport: **1440 × 900**
- 지원 판단 범위: **1440px 이상 데스크톱 관리자 화면만**
- 명시적 제외 범위: **1024px 이하, 모바일, 태블릿, 좁은 화면 반응형 개선 및 감사**

주요 대상 URL은 다음과 같다.

1. `/finance-tax/bank-reconciliation?workspace=operations&range=all&review=unmatched`
2. `/finance-tax/bank-reconciliation?workspace=imports`
3. `/finance-tax/bank-reconciliation?workspace=manual`
4. `/finance-tax/bank-reconciliation/[id]`
5. `/finance-tax/bank-reconciliation/import-batches/[batchImportId]`
6. `/finance-tax/payment-clearing?range=all&review=unresolved&sort=oldest`
7. `/finance-tax/payment-clearing?range=all&review=partial&sort=oldest`
8. `/finance-tax/payment-clearing?range=all&review=terminal&sort=recent`
9. `/finance-tax/payment-clearing?range=all&review=cleared&sort=recent`
10. `/finance-tax/payment-clearing?range=all&review=reversed&sort=recent`
11. `/finance-tax/payment-clearing/[id]`

완료 여부는 화면이 단순히 더 예뻐졌는지가 아니라 다음으로 판단한다.

1. 종결 상태가 다시 실행 가능한 업무처럼 보이지 않는다.
2. 동일 큐의 금액이 화면 위치에 따라 달라지지 않는다.
3. 모든 하위 상태에서 운영자가 현재 위치와 다음 행동을 즉시 이해한다.
4. 담당자 배정과 알림 실패가 안전하고 정확하게 처리된다.
5. 운영자는 1440×900에서 불필요한 두 번 이상의 스크롤 없이 실제 업무를 시작한다.
6. 상태·금액·권한의 최종 권위는 API이며, UI는 같은 규칙을 정확히 반영한다.

## 2. 시작 전 필수 절차

1. 루트의 `AGENTS.md`를 먼저 끝까지 읽고 따른다.
2. 단일 에이전트로 작업한다. 서브에이전트나 병렬 에이전트를 만들지 않는다.
3. 기준 보고서를 끝까지 읽고, 보고서 폴더의 23개 스크린샷을 직접 확인한다. 특히 다음 증거를 놓치지 않는다.
   - `03-bank-work-table.png`
   - `09-bank-owner-dialog.png`
   - `13-payment-clearing-unresolved-table.png`
   - `20-payment-clearing-terminal-table.png`
   - `21-payment-clearing-terminal-detail.png`
   - `23-payment-clearing-partial-empty.png`
4. `git status --short`와 대상 파일의 기존 diff를 확인한다. 현재 작업 트리는 사용자의 다른 변경이 많은 상태이므로 reset, checkout, clean, stash, 광범위한 formatting을 하지 않는다.
5. 보고서의 과거 line number를 그대로 믿지 말고 현재 소스에서 심볼, 상태 계산, API 계약, 테스트를 다시 찾는다.
6. 관련 테스트를 먼저 실행해 baseline을 기록한다. 기존 실패가 있으면 이번 변경과의 관련성을 구분한다.
7. 현재 Admin shell, Vuexy 기반 스타일, 공통 컴포넌트, 색상·간격·타이포그래피·폼·표 패턴을 재사용한다.
8. 새 UI 라이브러리, 새 상태 관리 라이브러리, 새 테이블 라이브러리, 불필요한 패키지를 추가하지 않는다.
9. 광범위한 API 분리, DB migration, Prisma schema 변경, 무관한 페이지 리팩터링을 하지 않는다.
10. 기존에 정상 구현된 안전장치와 좋은 UX를 먼저 목록화한 뒤 보존하면서 수정한다.

## 3. 반드시 보존할 현재의 좋은 동작

다음은 제거하거나 약화하지 않는다.

- 기본 진입이 `All dates + Needs action`이며 오래된 미해결 건을 숨기지 않는 동작
- `Bank transactions / Unmatched payment evidence / Partial matches / Cleared & reversed history`의 공통 워크스페이스 구조
- Bank 상세 후보의 서버 검색, 검색 초기화, 페이지 이동, eligible/ineligible 사유
- 후보 자동 선택 금지
- `OPEN`과 `PARTIALLY_CLEARED` 후보 지원
- 통화, 방향, 상태, 남은 금액, 초과 매칭을 API에서 검증하는 정책
- `IGNORED`, `CLEARED`, `REVERSED` 등에 실제 match를 만들 수 없게 하는 API 차단
- 결제 상세에서 은행 후보로 이동하고 은행 상세에서 최종 적격성을 다시 검증하는 흐름
- 검색, 정렬, owner, age, take, page를 보존하는 안전한 `returnTo`
- Payment Clearing의 명시적 owner 선택
- Payment Clearing의 배정 저장 성공과 알림 실패 분리
- 수동 은행 행 생성과 CSV import를 일상 검토 큐에서 분리한 구조
- import preview, idempotency, 잠재 중복의 명시적 검토
- 수수료 정책 증빙 누락을 숨기지 않고 경고하는 동작
- 선택 최대 50건 제한과 고유한 checkbox accessible name
- light/dark mode의 기존 기능

## 4. 구현 우선순위

다음 순서를 지킨다.

1. P1 상태 안전성
2. P1 금액 정확성
3. P1 탐색·브레드크럼 일관성
4. P1 담당자 배정·알림 실패 안전성
5. P2 1440px 운영 밀도와 표 가독성
6. P2 후보 판단 품질과 상세 업무 완결성
7. P2 성능과 읽기 호출 정리
8. P3 문구·접근성·시각 마감
9. 회귀 테스트와 실제 브라우저 검수

P1이 실패한 상태에서 P2/P3만 완료됐다고 보고하지 않는다.

## 5. P1-01 — 상태 모델을 단일화하고 REVERSED 상세 모순 제거

### 현재 문제

`REVERSED` Payment Clearing 상세가 동시에 다음을 표시한다.

- `Status: REVERSED`
- `Remaining amount 300,000 VND`
- `still available to match`
- `Find matching bank transaction`
- `Needs match`
- `Cleared at: Waiting`

목록은 같은 레코드를 `Cleared & reversed history`에 넣고 미해결 업무가 없다고 설명하며, API도 실제 매칭을 거부한다. UI가 `remainingAmount > 0`만 보고 행동 가능 여부를 판단하는 것이 원인이다.

### 상태 계약

상태 판단을 중복 문자열 조건으로 흩어 두지 말고 이름 있는 공통 모델 또는 함수로 만든다.

```ts
const isOpenState = ['OPEN', 'PARTIALLY_CLEARED'].includes(entry.status);
const isTerminal = ['CLEARED', 'REVERSED'].includes(entry.status);
const isMatchable = isOpenState && remainingAmount > 0;
```

상태별 계약은 다음과 같아야 한다.

| 상태 | 남은 금액 | match CTA/후보 | 운영 표현 |
|---|---:|---|---|
| OPEN | `> 0` | 허용 | Needs match |
| PARTIALLY_CLEARED | `> 0` | 허용 | Partial · remaining amount |
| CLEARED | `0` | 금지 | Closed · fully cleared |
| REVERSED | 계산값과 무관 | 금지 | Closed · reversed evidence |

### 구현 요구

1. 모든 match CTA, 후보 섹션, `Needs match`, Bank transactions 이동 액션은 `isMatchable`일 때만 표시한다.
2. `REVERSED`와 `CLEARED` 상세에는 실행 가능한 매칭 CTA가 0개여야 한다.
3. `REVERSED`의 양수 절댓값은 `Remaining amount` 또는 `still available to match`로 표현하지 않는다.
4. 상태에 맞는 표현을 사용한다.
   - `Reversed evidence amount`
   - `No active matching`
   - `Closed at`
   - `View reversal audit`
   - `Back to history`
5. `Cleared at: Waiting`을 제거한다. terminal 상태는 reversal/cleared/audit timestamp 중 도메인상 올바른 값으로 `Closed at`을 표시한다.
6. OPEN/PARTIAL의 기존 match 기능과 API 검증은 유지한다.
7. UI gate만 믿지 말고 API의 terminal 차단 테스트도 유지·보강한다.
8. 단순 source string 존재 테스트가 아니라 상태 fixture를 실제 렌더해 다음을 검증한다.
   - REVERSED: match CTA, 후보, `Needs match` 없음
   - CLEARED: match CTA, 후보, `Needs match` 없음
   - OPEN: match CTA 있음
   - PARTIALLY_CLEARED + remaining > 0: match CTA 있음

## 6. P1-02 — Payment Clearing 금액 집계를 하나의 remaining 정의로 통일

### 현재 문제

같은 미해결 108건이 다음처럼 다르게 보인다.

- Queue/Open exposure: `37,800,000 VND`
- Owner workload/Open amount: `36,800,000 VND`

Queue summary는 active match를 차감한 `ABS(amount)` 기반 remaining을 사용하지만 owner workload CTE는 signed 원금 `SUM(workload."amount")`를 사용한다.

### 단일 금액 정의

운영 노출액은 다음 의미로 통일한다.

```text
remainingAmount = max(abs(originalAmount) - activeMatchedAmount, 0)
```

회계상의 부호가 필요한 값은 `ledgerEffect` 또는 `netEffect`라는 별도 필드·라벨로 제공하고 운영 노출액과 섞지 않는다.

### 구현 요구

1. `apps/api/src/admin/admin.service.ts`의 queue summary와 owner workload가 동일한 remaining 정의를 사용하게 한다.
2. owner workload CTE에도 active match 집계를 조인한다.
3. `openAmount`, `over48hAmount`, partial amount 모두 signed 원금이 아니라 remaining amount를 합산한다.
4. 가능하면 한 개의 공통 SQL fragment/read-model helper로 계산 정의를 재사용한다. 단, 추상화가 오히려 불명확하면 같은 이름과 테스트로 정의를 고정하되 서로 다른 수식을 만들지 않는다.
5. reversed/inactive match를 active matched amount에 포함하지 않는다.
6. 같은 필터에서 다음 불변식이 항상 성립하도록 API 테스트를 추가한다.

```text
sum(owner workload openAmount)
=== queue summary openAmount + queue summary partiallyClearedAmount
```

7. 양수/음수 원금, active match, reversed match, 부분 매칭, 완전 매칭 fixture를 모두 테스트한다.
8. 화면에서 같은 큐의 요약과 owner workload를 나란히 확인해 금액이 일치하는지 검증한다.

## 7. P1-03 — 모든 하위 query에서 Payment Matching 위치 유지

### 현재 문제

query 전체 문자열을 정확히 비교해 active nav를 찾기 때문에 다음 상태에서 좌측 Finance Operations가 접히거나 `Payment Matching` 활성 표시가 사라지고 breadcrumb가 짧아진다.

- Bank imports/manual
- Payment partial/terminal/cleared/reversed
- 필터, 검색, sort, page, take가 canonical 링크와 다른 상태
- 상세 route와 import batch 상세

### 목표 정보 구조

```text
Finance Operations
└─ Payment Matching
   ├─ Bank transactions
   ├─ Unmatched payment evidence
   ├─ Partial matches
   └─ Cleared & reversed history
```

물리적으로 모든 내용을 한 페이지에 합치지 않는다. **하나의 공통 워크스페이스 셸 + 서로 다른 논리 route/query state**를 유지한다.

### 구현 요구

1. `apps/admin_web/lib/admin-nav-match.ts`에 path-family 기반 `primaryPaymentMatchingWorkspace(...)` 또는 현행 명명 규칙에 맞는 동일 역할 함수를 만든다.
2. 다음 모든 URL family를 같은 `Payment Matching` nav item에 연결한다.
   - `/finance-tax/bank-reconciliation`의 operations/imports/manual, filter, sort, page 상태
   - `/finance-tax/bank-reconciliation/[id]`
   - `/finance-tax/bank-reconciliation/import-batches/[batchImportId]`
   - `/finance-tax/payment-clearing`의 unresolved/open/partial/terminal/cleared/reversed 상태
   - `/finance-tax/payment-clearing/[id]`
3. `range`, `review`, `sort`, `workspace`, `q`, `owner`, `age`, `take`, `page` 같은 보조 query는 좌측 대분류 활성 상태를 깨지 않게 한다.
4. breadcrumb의 전체 계층을 항상 유지한다.
   - `HANDS › Finance Operations › Payment Matching › Bank Transactions`
   - `... › Bank Statement Imports`
   - `... › Manual Bank Entry`
   - `... › Unmatched Payment Evidence`
   - `... › Partial Matches`
   - `... › Payment Matching History`
   - 상세에서는 마지막에 transfer/reference/short ID 추가
5. unknown query는 안전한 기본 상태로 정규화하되 사용자의 유효한 필터를 지우지 않는다.
6. `admin-nav-match.spec.ts`에 위 대표 URL을 모두 table-driven test로 추가한다.
7. 상단 네 workspace tab에는 전체 큐 수 배지를 표시한다.
   - 예: `Bank transactions 44`, `Unmatched 108`, `Partial 0`, `History 40`
8. count를 위해 각 탭이 별도 중복 API를 호출하게 만들지 말고 현재 all-date overview 응답 또는 한 번의 summary 계약을 재사용한다.

## 8. P1-04 — History의 링크·행동·금액 문구를 terminal 의미와 일치

### 구현 요구

1. `Terminal outcomes` 카드의 주 링크를 `review=terminal&sort=recent`로 바꾼다.
2. 현재처럼 `0 cleared · 40 reversed`라고 표시한 카드가 `review=cleared`의 빈 화면으로 이동하면 안 된다.
3. 필요하면 카드 안에 `Cleared 0`, `Reversed 40`의 보조 링크를 따로 제공한다.
4. terminal/cleared/reversed row action의 `Review and match`를 `View evidence` 또는 `Open record`로 바꾼다.
5. 실행 업무를 암시하는 `Needs match`, `Match`, `Waiting for match` 문구를 terminal list에서 제거한다.
6. signed 값의 의미를 명시한다.
   - `Ledger effect -300,000 VND`
   - `Evidence amount 300,000 VND`
   - 또는 `Original -300,000 · Matched 0`
7. 단순 `Amount 300,000`과 `Original -300,000`을 설명 없이 동시에 보여 주지 않는다.
8. History view에서는 오픈 큐 KPI 카드가 화면을 지배하지 않게 한 줄 compact alert 또는 축약 summary로 만들고 terminal 통계와 history rows를 먼저 보이게 한다.
9. row action text, card href, terminal copy를 테스트한다.

## 9. P1-05 — Bank 담당자 선택을 명시적으로 만들고 제출 상태를 정확히 연결

### 현재 문제

Bank의 단건·일괄 배정은 첫 번째 eligible operator를 자동 선택한다. 사용자가 실제 담당자를 선택하지 않아도 이유만 입력하면 제출될 수 있다. 버튼은 시각적으로 disabled처럼 보여도 실제 `disabled=false`인 상태가 존재한다.

### 구현 요구

1. 단건 detail dialog와 일괄 배정 모두 기본 owner 값을 빈 문자열로 둔다.
2. 첫 옵션은 `Select an eligible Finance operator`로 표시한다.
3. owner가 선택되지 않았거나 reason이 현재 계약의 최소 길이보다 짧으면 제출 버튼을 실제 `disabled` 처리한다.
4. 시각 상태, `disabled` 속성, server validation이 같은 조건을 사용한다.
5. 현재 사용자라고 자동 선택하지 않는다.
6. 변경된 owner와 이유를 제출 직전 명확히 볼 수 있게 한다.
7. eligible operator가 0명인 경우 빈 select가 아니라 `No eligible Finance operator is available`과 해결 행동을 표시한다.
8. Payment Clearing의 이미 올바른 explicit selection 동작은 유지한다.
9. 단건·일괄 양쪽에서 기본값이 비어 있고 직접 선택 전 제출할 수 없다는 렌더/validation 테스트를 추가한다.

## 10. P1-06 — Bank 배정 성공과 알림 실패를 분리

### 현재 문제

Bank는 assignment audit 저장 뒤 notification을 직접 `await`하고, 일괄은 DB transaction 뒤 `Promise.all`을 사용한다. 알림 하나가 실패하면 이미 저장된 배정까지 실패한 것처럼 UI가 보일 수 있다.

### 구현 요구

1. Payment Clearing의 현재 결과 계약과 실패 처리 패턴을 재사용한다.
2. Bank 단건과 일괄 배정의 결과에서 최소 다음을 구분한다.
   - `assignedCount`
   - `unchangedCount`
   - `notification.deliveredCount`
   - `notification.failedCount`
   - 안전한 `warning` code/message
3. 배정 persistence와 audit 저장이 성공한 뒤의 notification 실패는 전체 배정 실패로 rollback하거나 표시하지 않는다.
4. 일괄 알림은 `Promise.allSettled` 또는 동일한 부분 실패 수집 방식으로 처리한다.
5. 알림 실패 사실과 retry 필요를 감사 가능하게 남기되 raw exception/PII를 화면에 노출하지 않는다.
6. UI notice를 분리한다.
   - 배정 저장 실패
   - 배정 저장 성공 + 일부 알림 실패
   - 배정과 알림 모두 성공
7. 단건과 일괄 각각 notification failure 회귀 테스트를 추가한다.
8. 이미 저장된 assignment를 UI가 다시 제출하도록 오도하지 않게 한다.

## 11. P2-01 — Bank 화면을 1440px 운영 밀도에 맞게 압축

### 상단 구조

1. 공통 `Payment Matching` 4개 탭은 유지한다.
2. Bank 내부 `Review unmatched` 탭은 상단 `Bank transactions`와 중복되므로 제거한다.
3. `Statement imports`, `Manual exception`은 페이지 헤더의 보조 액션 또는 작은 `Bank intake` action group으로 이동한다.
4. 기존 `workspace=imports|manual` URL은 유지한다. 내용을 operations 화면에 한꺼번에 렌더하지 않는다.
5. 실제 업무 표 제목이 1440×900 기준 페이지 상단에서 **1,200px 이내**에 시작하게 한다.

### 필터 구조

항상 표시할 고빈도 필터:

- Search
- Queue
- Review owner
- Age
- Direction

`More filters`에 둘 저빈도 필터:

- Evidence source
- Range
- Rows
- Withdrawal candidate

추가 기준:

1. 한 filter group이 전체 가로폭을 독점하지 않게 2~4개 compact control을 한 행에 배치한다.
2. 기본값 chip은 숨기고 실제 변경된 필터만 active chip으로 표시한다.
3. `More filters · 2 active`처럼 활성 개수를 표시한다.
4. reset은 실제 변경된 필터만 초기화하고 canonical default로 돌아간다.
5. query state와 pagination 보존을 깨지 않는다.

### Bank 표와 선택

1. `Select all visible`과 `Clear visible selection`을 제공한다.
2. 현재 페이지의 visible rows만 선택하며 최대 50건 제한을 바로 옆에서 설명한다.
3. `912h waiting` 같은 raw hour를 공통 age formatter로 `38d`, `38d 0h` 등으로 바꾼다.
4. `2 match(es)`처럼 active/reversed를 섞지 않는다.
   - `0 active · 2 reversed`
5. `Source manual-b` 같은 원시 키는 `Manual entry`, `CSV import`, `Payment clearing` 같은 운영 라벨로 humanize한다.
6. raw source key는 필요하면 detail disclosure에서 제공한다.

## 12. P2-02 — Payment Clearing 필터·표·bulk UI를 재구성

### 필터

1. Queue는 항상 표시한다.
2. Owner와 Age를 같은 행에 둔다.
3. Range와 Rows는 `More filters`로 이동한다.
4. Search와 Sort는 빈도와 폭을 고려해 한 행에서 자연스럽게 스캔되게 한다.
5. 실제 업무 표 제목이 페이지 상단에서 **1,200px 이내**에 시작해야 한다.

### 6열 운영 표

현재 8열을 다음 6개 운영 열로 통합한다.

1. Select
2. Booking / Payment
3. Event / Evidence
4. Remaining / Original
5. Owner / SLA
6. Next action

세부 기준:

- Clearing ID, Payment ID, booking reference는 primary/secondary hierarchy로 묶는다.
- 긴 raw ID는 축약 표시하며 전체 값은 accessible label, copy action, detail에서 확인 가능하게 한다.
- `Unassigned`, action label이 문자 단위로 깨지지 않게 한다.
- row action은 두 줄을 넘지 않는다.
- 전역 `overflow-wrap:anywhere`로 문제를 숨기지 않는다.
- Remaining과 Original의 의미를 같은 cell 안에서 명확히 구분한다.
- 1440px에서 body 전체 horizontal overflow를 만들지 않는다.

### 선택 후에만 bulk bar

1. 선택 전에는 `Select all visible · 0 selected` 정도만 보여 준다.
2. 1건 이상 선택됐을 때만 owner, reason, submit이 있는 sticky bulk bar를 표시한다.
3. 선택 요약은 건수, remaining total, 48h+ 건수를 보여 준다.
4. 선택 해제 시 bulk 입력과 오류 상태를 안전하게 초기화한다.
5. owner explicit selection과 최대 50건 제한을 유지한다.

## 13. P2-03 — Partial 0건 빈 상태를 하나로 축약

1. 상단 탭에서 진입 전에 `Partial matches 0`을 알 수 있게 한다.
2. queue count가 0이면 큰 owner workload table과 큰 result table을 모두 렌더하지 않는다.
3. filter 바로 아래에 하나의 compact empty state만 표시한다.
4. 권장 문구:

```text
No partial matches
Open exposure remains in Unmatched payment evidence.
```

5. `Unmatched payment evidence`로 이동하는 명확한 링크를 제공한다.
6. 필터 때문에 0건인 경우와 전체 큐 자체가 0건인 경우를 구분한다.
   - 필터 결과 0건: active filters와 `Clear filters`
   - 전체 큐 0건: 업무 완료형 빈 상태와 관련 queue 링크
7. 빈 table header shell을 장식처럼 남기지 않는다.

## 14. P2-04 — 후보 판단 정보와 “best” 표현을 정확하게 만들기

### 현재 문제

Payment detail의 `Review best bank candidate`는 실제 점수 근거가 없고 API는 최신 `occurredAt` 순으로만 후보를 반환한다. 400,000 VND 증빙에 300,000 VND 후보만 보여도 “best”라고 단정한다.

### 구현 요구

다음 두 방법 중 실제 코드와 성능을 확인해 더 안전한 것을 선택한다. 선택 이유를 최종 보고서에 기록한다.

**A. 신뢰할 수 있는 랭킹을 구현할 수 있는 경우**

1. exact remaining amount
2. amount delta
3. date gap
4. transfer/provider/booking reference similarity
5. stable tie-breaker

후보 응답과 표에 최소 다음을 제공한다.

- remaining amount
- amount delta
- date gap hours/days
- eligibility/why shown
- status/direction/currency

**B. 안전한 랭킹을 이번 범위에서 구현하기 어려운 경우**

- `Review best bank candidate`를 `Review newest eligible candidate`로 정확히 바꾸거나 상단 단일 후보 CTA를 제거한다.
- 근거 없는 score, confidence, best badge를 만들지 않는다.

공통 요구:

1. Bank 상세 후보와 Payment 상세 역방향 후보의 판단 정보가 가능한 한 대칭이어야 한다.
2. 400,000 evidence에 300,000 candidate가 보이면 `100,000 short`를 즉시 표시한다.
3. `21d gap`처럼 날짜 차이를 humanize한다.
4. `SETTLEMENT_POSTED / booking-` 대신 event label + 실제 booking short ID 또는 human reference를 표시한다.
5. Payment detail에서도 owner 지정이 필요하면 목록으로 돌아가지 않고 상세에서 수행할 수 있게 한다. Bank와 동일한 권한·명시적 선택·이유 계약을 재사용한다.

## 15. P2-05 — 성능 개선은 정확성을 해치지 않는 범위에서 수행

### 현재 읽기 구조

Bank operations는 한 렌더에서 최대 6개 읽기, Payment unresolved는 최대 5개 읽기를 수행한다. warm local 측정은 각각 177ms와 477ms였지만 production p95는 검증되지 않았다.

### 구현 요구

1. eligible admin directory는 화면 초기 진입에서 항상 로드하지 않는다.
2. owner dialog 또는 bulk assignment가 실제로 열리거나 선택됐을 때만 로드한다.
3. terminal/empty 화면에서는 owner directory를 호출하지 않는다.
4. summary, source, owner workload, rows를 합칠 때는 쿼리 수만 줄이기 위한 거대 계약을 만들지 말고 기존 API 경계 안의 좁은 workbench read model을 우선 검토한다.
5. all-date overview에 15~30초 cache/revalidation을 적용하려면 금전 데이터 신선도, mutation invalidation, 현재 cache 계약을 먼저 확인한다.
6. stale financial status를 만들 위험이 있으면 캐시를 추가하지 말고 lazy load와 중복 제거까지만 수행하고 이유를 기록한다.
7. 동일 렌더에서 같은 summary를 중복 호출하지 않는다.
8. 변경 전후 다음을 계측해 최종 보고서에 기록한다.
   - 화면별 API read count
   - warm local work-table-ready time
   - 첫 업무 H2의 문서상 y 위치
9. 목표:
   - warm local ≤ 500ms 유지
   - 1440×900에서 first work heading ≤ 1,200px

## 16. P3 — 문구·접근성·마감

### 문구

다음 방향으로 교체한다.

| 현재 또는 잘못된 표현 | 권장 표현 |
|---|---|
| `expects a outflow` | `Expected direction: OUTFLOW` |
| `Review and match` on terminal | `View evidence` |
| `Cleared at: Waiting` | 상태별 `Closed at` |
| `Source manual-b` | `Manual entry` |
| `912h waiting` | `38d` 또는 공통 age formatter |
| `SETTLEMENT_POSTED / booking-` | event label + 실제 booking reference |
| `2 match(es)` | `0 active · 2 reversed` |
| `still available to match` on REVERSED | `No active matching` |

raw enum과 내부 source key는 운영자의 기본 스캔 경로에서 humanize하고, 감사상 필요하면 secondary/disclosure에서 원문을 보존한다.

### 문서 제목과 키보드

1. root metadata template을 `%s · HANDS Admin` 형태로 추가하거나 현행 metadata 구조에 맞게 구현한다.
2. 최소 페이지 title:
   - Bank Reconciliation
   - Bank Statement Imports
   - Manual Bank Entry
   - Unmatched Payment Evidence
   - Partial Matches
   - Payment Matching History
   - 상세: transfer/reference + short ID
3. 상단 첫 focusable element로 `Skip to main content`를 제공한다.
4. visible main landmark는 하나만 두고 고정 id를 skip target으로 사용한다.
5. 모달·dialog의 focus, escape, return focus 기존 동작을 깨지 않는다.
6. 색상만으로 status를 전달하지 않는다.
7. 모든 표는 서로 구분되는 accessible name을 유지한다.
8. checkbox 이름은 행 식별 정보와 금액을 포함하는 현재 좋은 동작을 유지한다.

## 17. 주요 코드 범위

현재 구조를 다시 확인한 뒤 최소 범위로 수정한다. 주요 후보는 다음과 같다.

### Admin Web

- `apps/admin_web/app/finance-tax/bank-reconciliation/page.tsx`
- `apps/admin_web/app/finance-tax/bank-reconciliation/page.spec.tsx`
- `apps/admin_web/app/finance-tax/bank-reconciliation/[id]/page.tsx`
- `apps/admin_web/app/finance-tax/bank-reconciliation/[id]/page.spec.tsx`
- `apps/admin_web/app/finance-tax/bank-reconciliation/bank-reconciliation-workspace-model.ts`
- `apps/admin_web/app/finance-tax/bank-reconciliation/bank-reconciliation-workspace-model.spec.ts`
- `apps/admin_web/app/finance-tax/bank-reconciliation/bank-reconciliation-selection-summary.tsx`
- `apps/admin_web/app/finance-tax/bank-reconciliation/bank-reconciliation-selection-summary.spec.ts`
- `apps/admin_web/app/finance-tax/bank-reconciliation/bank-reconciliation-review-owner-model.ts`
- `apps/admin_web/app/finance-tax/bank-reconciliation/bank-reconciliation-review-owner-model.spec.ts`
- `apps/admin_web/app/finance-tax/bank-reconciliation/import-batches/[batchImportId]/page.tsx`
- `apps/admin_web/app/finance-tax/payment-clearing/page.tsx`
- `apps/admin_web/app/finance-tax/payment-clearing/page.spec.tsx`
- `apps/admin_web/app/finance-tax/payment-clearing/[id]/page.tsx`
- `apps/admin_web/app/finance-tax/payment-clearing/[id]/page.spec.tsx`
- `apps/admin_web/app/finance-tax/payment-clearing/payment-clearing-selection-controls.tsx`
- `apps/admin_web/lib/admin-nav-match.ts`
- `apps/admin_web/lib/admin-nav-match.spec.ts`
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/app/layout.tsx` 또는 현재 metadata/skip-link 소유 파일

### API

- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin.service.spec.ts`
- `apps/api/src/admin/admin.controller.ts`
- `apps/api/src/admin/admin.controller.spec.ts`
- `apps/api/src/admin/admin.dto.ts`
- `apps/api/src/admin/admin.dto.spec.ts`

파일을 추가하기 전에 기존 모델·formatter·notice·dialog 패턴으로 해결 가능한지 확인한다. 새 helper를 만들더라도 이 두 업무에서 실제로 재사용되는 작은 도메인 helper로 제한한다.

## 18. 테스트 요구

### Admin Web 필수 테스트

1. REVERSED/CLEARED fixture에 match CTA와 후보가 없다.
2. OPEN/PARTIAL fixture에만 match CTA가 있다.
3. terminal row action이 `View evidence`다.
4. Terminal outcomes card href가 terminal queue를 연다.
5. Bank 단건·일괄 owner 기본값이 비어 있다.
6. owner + valid reason 전에는 실제 submit이 disabled다.
7. Payment bulk form은 0 selected에서 숨고 선택 후 나타난다.
8. Partial 0건은 compact empty state 하나만 표시한다.
9. 6열 table 구조와 핵심 nowrap/secondary hierarchy가 유지된다.
10. 모든 대표 query에서 Payment Matching nav가 active다.
11. 모든 대표 query에서 Finance Operations › Payment Matching breadcrumb가 유지된다.
12. returnTo가 `q`, `sort`, `owner`, `age`, `take`, `page`를 보존한다.
13. terminal/empty state에서 admin directory를 eager load하지 않는다.
14. 페이지 title과 skip link가 존재한다.

### API 필수 테스트

1. queue summary와 owner workload의 remaining amount 불변식
2. 양수/음수 원금과 active/reversed match의 구분
3. OPEN/PARTIAL만 active match 후보가 될 수 있음
4. CLEARED/REVERSED는 후보와 match mutation이 모두 거절됨
5. Bank 단건 notification failure 뒤 assignment success + warning 반환
6. Bank bulk notification partial failure의 delivered/failed count
7. candidate ranking을 구현했다면 delta/date/reference ordering과 stable tie-breaker
8. 기존 direction/currency/status/remaining limit/idempotency 회귀

### 실행 명령

실제 package script를 다시 확인한 뒤 정확한 명령으로 실행한다. 최소 범위는 다음과 같다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- `
  app/finance-tax/bank-reconciliation/page.spec.tsx `
  "app/finance-tax/bank-reconciliation/[id]/page.spec.tsx" `
  app/finance-tax/bank-reconciliation/bank-reconciliation-workspace-model.spec.ts `
  app/finance-tax/bank-reconciliation/bank-reconciliation-selection-summary.spec.ts `
  "app/finance-tax/bank-reconciliation/import-batches/[batchImportId]/page.spec.tsx" `
  app/finance-tax/payment-clearing/page.spec.tsx `
  "app/finance-tax/payment-clearing/[id]/page.spec.tsx" `
  lib/admin-nav-match.spec.ts

npm.cmd run test --workspace @massage-vn/api -- `
  src/admin/admin.service.spec.ts `
  src/admin/admin.controller.spec.ts `
  src/admin/admin.dto.spec.ts

npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

금액 집계와 assignment API 동작을 변경하므로 환경이 허용하면 다음도 실행한다.

```powershell
npm.cmd run verify:local
```

명령이 현재 test runner의 경로 처리 때문에 달라지면 동일 범위가 실행되도록 조정한다. 실패나 skipped 검증을 숨기지 말고 명령, 원인, 이번 변경과의 관련성을 최종 보고서에 기록한다.

## 19. 실제 브라우저 검수

로그인된 기존 브라우저 세션을 사용한다. **1440×900에서만** 다음 상태를 확인하고 캡처한다. 1024px 이하 화면은 열거나 보고서에 포함하지 않는다.

1. Bank operations 상단과 첫 work table
2. Bank More filters open/closed
3. Bank 0 selected / 1 selected bulk state
4. Bank owner dialog의 빈 기본값과 disabled submit
5. Bank detail의 active/reversed match count
6. Bank imports와 manual에서 좌측 nav/breadcrumb 유지
7. Payment unresolved 상단, compact filters, 6열 table
8. Payment 0 selected / selected sticky bulk bar
9. Partial 0건 compact empty state
10. Terminal top, terminal rows, card navigation
11. REVERSED detail에서 match CTA 0개
12. OPEN/PARTIAL detail에서 match CTA와 후보 정보
13. 모든 4개 상단 탭 count badge
14. 상세에서 목록 복귀 후 검색·정렬·owner·age·take·page 보존
15. light mode와 대표 화면 1개의 dark mode
16. 브라우저 tab title과 keyboard skip link

브라우저 QA 중 실제 Assign, Match, Ignore, Reverse, Import commit, Manual bank row create 같은 운영·금전 변경 액션은 제출하지 않는다. 제출 전 상태, 테스트 fixture, API 테스트, non-mutating read/preview로 검증한다.

각 화면에서 다음 값을 기록한다.

- body horizontal overflow 유무
- 이름 없는 form control 수
- duplicate DOM id 수
- visible main landmark 수
- 첫 업무 H2의 y 위치
- row action 최대 줄 수
- warm local work-table-ready time

UI 수정이 끝난 뒤 Impeccable detector가 현재 프로젝트에 구성되어 있다면 변경된 UI 파일만 대상으로 **정확히 한 번** 실행하고 결과를 검토한다. detector 통과가 상태·금액 정확성을 증명한다고 간주하지 않는다.

## 20. 최종 Acceptance Criteria

### 상태와 금액

- [ ] REVERSED/CLEARED 상세에는 match CTA, candidate section, `Needs match`가 없다.
- [ ] OPEN/PARTIAL + remaining > 0에서만 active match UI가 보인다.
- [ ] 같은 필터의 queue exposure와 owner workload 합계가 정확히 일치한다.
- [ ] active match와 reversed match count가 분리된다.
- [ ] terminal 목록은 ledger effect와 evidence absolute amount를 구분한다.
- [ ] Terminal outcomes card를 클릭하면 40 reversed를 포함한 history가 열린다.

### 탐색과 구조

- [ ] Bank operations/imports/manual/detail/import detail에서 Payment Matching nav가 활성이다.
- [ ] Payment unresolved/partial/terminal/cleared/reversed/detail에서 같은 전체 breadcrumb가 유지된다.
- [ ] 공통 4개 탭에 정확한 전체 count가 보인다.
- [ ] Bank 내부 중복 `Review unmatched` 탭이 제거됐다.
- [ ] imports/manual은 별도 논리 route로 유지된다.
- [ ] 상세 복귀가 `q`, `sort`, `owner`, `age`, `take`, `page`를 보존한다.

### 운영 UI

- [ ] 1440×900에서 첫 업무 table heading이 y=1,200px 이내에 시작한다.
- [ ] Payment table은 6개 운영 열이며 핵심 문구가 문자 단위로 깨지지 않는다.
- [ ] row action은 두 줄을 넘지 않는다.
- [ ] Payment와 Bank bulk 입력은 선택 후에만 나타난다.
- [ ] Bank owner는 빈 기본값이며 직접 선택하기 전 제출할 수 없다.
- [ ] Partial 0건은 하나의 compact empty state로 보인다.
- [ ] terminal row는 `View evidence`를 사용한다.
- [ ] 근거 없는 `best candidate` 표현이 없다.

### 성능·접근성·테스트

- [ ] admin directory는 assignment가 실제 시작되기 전에는 로드하지 않는다.
- [ ] terminal/empty state에서 불필요한 owner/assignment API 호출이 없다.
- [ ] warm local work-table-ready time이 500ms 이하이거나, 초과 시 원인과 측정 근거가 있다.
- [ ] 페이지별 document title과 skip link가 있다.
- [ ] visible main landmark가 하나다.
- [ ] REVERSED fixture 렌더 테스트가 있다.
- [ ] owner workload amount invariant 테스트가 있다.
- [ ] 모든 대표 URL의 nav matcher 테스트가 있다.
- [ ] Bank notification partial failure 테스트가 있다.
- [ ] 대상 Admin Web/API 테스트와 `verify:scope admin/api`가 통과한다.

## 21. 금지 사항

- UI에서 버튼만 숨기고 API 상태 정책이 안전하다고 가정하지 않는다.
- `remainingAmount > 0`만으로 match 가능 여부를 판단하지 않는다.
- signed ledger effect와 absolute operating exposure를 같은 의미로 사용하지 않는다.
- `REVERSED`, `CLEARED`를 미해결 큐나 active match 후보에 포함하지 않는다.
- 알림 실패 때문에 이미 저장된 assignment를 전체 실패로 표시하지 않는다.
- 첫 번째 operator를 자동 선택하지 않는다.
- 모든 내용을 한 개의 거대한 세로 페이지에 동시에 렌더하지 않는다.
- 공통 4개 workspace route를 의미 없는 시각 tab으로만 만들지 않는다.
- query 문자열 전체 exact match로 nav 활성 상태를 판단하지 않는다.
- 1024px 이하 responsive issue를 만들거나 검사 범위에 넣지 않는다.
- 거대한 hero, 장식용 KPI 카드, gradient, 과도한 animation, 새 색상 체계를 추가하지 않는다.
- raw enum, raw source key, 내부 구현 용어를 기본 운영 문구로 노출하지 않는다.
- 근거 없는 score, confidence, best badge를 만들지 않는다.
- 재무 상태를 오래된 cache로 보여 주는 성능 개선을 하지 않는다.
- 실제 운영 데이터에 Assign, Match, Ignore, Reverse, Import, Manual create를 실행해 QA하지 않는다.
- 기존 사용자 변경을 reset, checkout, clean, stash, overwrite하지 않는다.
- 무관한 파일을 포맷하거나 광범위하게 리팩터링하지 않는다.
- 사용자가 요청하지 않은 commit이나 push를 하지 않는다.

## 22. 최종 산출물

작업 완료 후 다음을 제공한다.

1. 수정된 코드와 회귀 테스트
2. `output/bank-reconciliation-payment-clearing-remediation-2026-08-09/` 아래의 1440×900 검증 스크린샷
3. 같은 폴더의 `bank-reconciliation-payment-clearing-remediation-report.md`
4. 보고서에는 다음을 포함한다.
   - 이전 감사 P1/P2/P3별 완료·부분 완료·미완료 matrix
   - 변경 파일과 변경 이유
   - 상태 truth table과 금액 remaining 정의
   - queue summary와 owner workload의 검증 수치
   - nav/breadcrumb 대표 URL 결과
   - Bank assignment/notification 실패 처리 결과
   - 변경 전후 API read count, H2 y 위치, warm local timing
   - 실행한 명령과 pass/fail/skipped 결과
   - protected area 접촉 여부
   - 실제 운영·금전 변경 없이 검증한 범위
   - 남은 위험과 다음 권장 작업
5. 최종 응답은 `AGENTS.md`의 handoff 형식에 따라 다음을 명확히 정리한다.
   - changed files
   - commands run and pass/fail/skipped
   - protected areas touched
   - remaining risks
   - next recommended task

완료 선언 전 기준 보고서의 20개 Acceptance Criteria와 이 프롬프트의 체크리스트를 하나씩 대조하라. 구현하지 못한 항목은 숨기지 말고 이유, 영향, 다음 안전한 조치를 기록하라.
