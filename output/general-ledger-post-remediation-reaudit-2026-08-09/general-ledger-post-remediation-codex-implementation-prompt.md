# HANDS Admin General Ledger 재개선용 Codex 마스터 프롬프트

아래 전체 내용을 C:\dev\massage-on-demand-vn 저장소를 연 Codex 작업에 그대로 전달하라.

---

## 역할과 최종 목표

너는 HANDS Admin의 재무·회계 운영 화면을 수정하는 시니어 풀스택 엔지니어다.

C:\dev\massage-on-demand-vn의 General Ledger 목록·상세·API·테스트를 실제로 수정하라.

이번 작업의 최종 결과는 “보기 좋은 분개 목록”이 아니다. 재무 운영자가 다음 질문에 화면만 보고 안전하게 답할 수 있어야 한다.

1. 이 journal batch가 실제 분개행까지 회계적으로 일치하는가?
2. 문제가 있다면 어떤 검사에서 얼마가 차이나는가?
3. 오늘 또는 월마감 전에 어떤 blocker부터 처리해야 하는가?
4. 원천 예약·결제·정산·반전·은행 증거는 무엇인가?
5. 조사 후 원래 검색·필터·페이지로 정확히 돌아갈 수 있는가?
6. 현재 조회 결과를 감사 가능한 형태로 내보낼 수 있는가?

핵심 성공 조건은 다음 한 문장이다.

> Header 500,000/500,000 VND, Entry 390,000/390,000 VND, Formula delta 12,000 VND인 배치는 절대로 Balanced 또는 Clear로 표시되면 안 되며 Needs action에 포함되어야 한다.

## 반드시 먼저 읽을 자료

작업 시작 전에 다음 파일을 순서대로 읽어라.

1. 재감사 보고서  
   C:\dev\massage-on-demand-vn\output\general-ledger-post-remediation-reaudit-2026-08-09\general-ledger-post-remediation-reaudit-report.md

2. 최초 심층 감사 보고서  
   C:\dev\massage-on-demand-vn\output\general-ledger-audit-2026-08-09\general-ledger-deep-audit-report.md

3. 이전 구현 프롬프트  
   C:\dev\massage-on-demand-vn\output\general-ledger-audit-2026-08-09\general-ledger-codex-implementation-prompt.md

4. 현재 핵심 코드

   - apps/admin_web/app/finance-tax/general-ledger/page.tsx
   - apps/admin_web/app/finance-tax/general-ledger/[id]/page.tsx
   - apps/admin_web/app/finance-tax/general-ledger/page.spec.tsx
   - apps/admin_web/app/finance-tax/general-ledger/[id]/page.spec.tsx
   - apps/admin_web/app/finance-tax/tax-settlement-page-model.ts
   - apps/admin_web/app/finance-tax/tax-settlement-page-model.spec.ts
   - apps/admin_web/app/finance-tax/tax-finance-workflow-actions.tsx
   - apps/admin_web/lib/admin-api.ts
   - apps/admin_web/lib/admin-navigation.ts
   - apps/admin_web/lib/admin-operator-access-model.ts
   - apps/admin_web/lib/admin-operator-permissions.ts
   - apps/api/src/admin/admin-ledger.routes.ts
   - apps/api/src/admin/admin.service.ts
   - apps/api/src/admin/admin.service.spec.ts
   - apps/api/src/admin/admin.controller.spec.ts
   - apps/admin_web/app/globals.css

5. 관련 회계 데이터 모델과 마감 검증

   - AccountingJournalBatch
   - AccountingJournalEntry
   - BookingSettlementSnapshot
   - BookingSettlementReversalEntry
   - monthly close / closeout preflight가 journal reconciliation을 판단하는 코드
   - 기존 finance export route와 audit log 패턴
   - Payment Clearing와 Bank Reconciliation의 safe returnTo 및 오류 상태 패턴

보고서의 결론만 읽고 바로 수정하지 마라. 현재 소스, 타입, DB schema, route, 기존 테스트, 실제 화면을 다시 확인하라.

## 현재 재현된 결함

작업 전 아래 결함을 직접 재현하고 증거를 남겨라.

### 결함 A — false-positive Balanced

대상:

http://localhost:3101/finance-tax/general-ledger/seed-finance-smoke-reversal-journal-batch

현재 데이터:

~~~text
Header debit   500,000 VND
Header credit  500,000 VND
Entry debit    390,000 VND
Entry credit   390,000 VND
Formula delta   12,000 VND
~~~

현재 잘못된 표시:

- Double-entry check: Balanced
- Journal evidence hub: green Balanced
- All dates command board: Unbalanced journals = Balanced
- Needs action: 0
- Unbalanced: 0

### 결함 B — All records

1. /finance-tax/general-ledger 진입
2. All records 클릭
3. URL에서 review가 제거됨
4. parser가 누락값을 needs-action으로 다시 해석
5. All records가 아니라 Needs action이 active

### 결함 C — Clear search

1. /finance-tax/general-ledger?range=all&review=posted 진입
2. seed-fin 검색
3. Clear 클릭
4. q=seed-fin과 input 값이 그대로 남음

### 결함 D — Overview scope mismatch

검색 중 command card는 검색을 무시한 전체 472건을 표시하지만 카드 링크는 q를 유지한다. 표시된 472건과 클릭 후 2건이 일치하지 않는다.

### 결함 E — 상세 복귀

All dates / Posted / q=seed-fin / 10 rows에서 상세로 들어가도 Back to ledger는 30d / posted / 25 rows로 이동한다.

### 결함 F — reversal evidence

settlementReversalEntry가 존재하는 reversal batch에서도 새 Reversal reference/reason/posted/approval UI가 나타나지 않는다. metadata.operation 추정에 의존한 조건을 조사하라.

## 작업 원칙과 금지사항

### 반드시 지킬 것

- 현재 작업 트리는 매우 많은 사용자 변경을 포함한다.
- 먼저 git status --short와 관련 파일 git diff를 확인한다.
- 이번 작업과 무관한 변경은 수정·정리·포맷·삭제하지 않는다.
- git reset --hard, git checkout --, 강제 clean, 광범위한 자동 포맷을 사용하지 않는다.
- source code 수정은 필요한 범위로 제한한다.
- 기존 finance 공용 컴포넌트를 우선 재사용한다.
- 회계 정책을 추측하지 않는다.
- 현재 데이터가 부족하면 UNKNOWN 또는 명시적 blocker로 처리한다.
- migration이 필요하지 않으면 만들지 않는다.
- 기존 batch header total을 entry total로 자동 덮어쓰지 않는다.
- 재무 데이터를 변경하는 버튼이나 mutation을 브라우저 검증 중 실행하지 않는다.
- 테스트 통과만으로 완료 처리하지 않는다. 실제 화면 수용기준까지 확인한다.

### 절대 하지 말 것

- batch.totalDebit === batch.totalCredit만으로 overall Balanced/Clear를 만들지 마라.
- formula delta가 있는데 green success를 사용하지 마라.
- 검사할 수 없는 상태를 0 또는 Clear로 만들지 마라.
- API 5xx/network 실패를 empty array 또는 404로 위장하지 마라.
- Account activity와 Trial balance를 구현하지 않고 General Ledger라는 이름만 유지하지 마라.
- 월마감·원장 잔액 계산 규칙을 임의로 만들어 내지 마라.
- 모든 검색 필드에 무조건 %term% ILIKE를 확대하지 마라.
- 1024px 이하 화면을 이번 작업의 설계·검수 범위에 넣지 마라.

## 완료 순서

아래 순서를 지켜라. Phase 0이 통과하기 전에 시각적 polish에 시간을 쓰지 마라.

## Phase 0 — 기준선과 실패 테스트

### 0.1 현재 상태 기록

다음을 기록한다.

- git status --short
- 관련 파일 diff
- 현재 focused test 결과
- 현재 API contract
- 현재 seed-fin 상세 응답
- 1440×900 before screenshots

검증 산출물 디렉터리:

C:\dev\massage-on-demand-vn\output\general-ledger-remediation-verification-2026-08-09

### 0.2 회귀 테스트를 먼저 실패시키기

구현 전에 최소 다음 테스트를 추가해 현재 코드에서 실패함을 확인한다.

1. Header 500k/500k + Entry 390k/390k = BLOCKED
2. Entry debit과 credit가 다름 = BLOCKED
3. Header debit과 entry debit가 다름 = BLOCKED
4. Header credit과 entry credit가 다름 = BLOCKED
5. Posted batch with zero entries = BLOCKED
6. Formula delta + header balanced = BLOCKED
7. 필수 검사를 완료할 수 없음 = UNKNOWN
8. Needs action이 BLOCKED와 required UNKNOWN을 포함
9. All records href가 explicit review=all
10. review=all reload 후 active 유지
11. Clear search href가 q를 제거
12. command card 수치와 destination scope 일치
13. detail safe returnTo allow/deny
14. 404/401/403/5xx/network 상태 분리
15. canonical reversal evidence 렌더

단순 source contains 테스트로 끝내지 말고 API 결과, URL, 렌더 markup, 사용자 동작을 검증한다.

## Phase 1 — 서버 권위 회계 무결성 계약

### 1.1 공용 타입

프로젝트 naming에 맞춰 동등한 타입을 구현하되 의미를 축소하지 마라.

~~~ts
type AccountingJournalIntegrityState = 'CLEAR' | 'BLOCKED' | 'UNKNOWN';

type AccountingJournalCheckState =
  | 'PASS'
  | 'FAIL'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

type AccountingJournalIntegrityBlockerCode =
  | 'HEADER_DEBIT_CREDIT_MISMATCH'
  | 'ENTRY_DEBIT_CREDIT_MISMATCH'
  | 'HEADER_ENTRY_DEBIT_MISMATCH'
  | 'HEADER_ENTRY_CREDIT_MISMATCH'
  | 'POSTED_BATCH_HAS_NO_ENTRIES'
  | 'FORMULA_DELTA'
  | 'MISSING_ACCOUNTING_PERIOD'
  | 'INTEGRITY_NOT_EVALUATED';

type AccountingJournalIntegrity = {
  state: AccountingJournalIntegrityState;
  checkedAt: string;
  blockerCodes: AccountingJournalIntegrityBlockerCode[];
  entryCount: number;
  headerDebitTotal: number;
  headerCreditTotal: number;
  entryDebitTotal: number;
  entryCreditTotal: number;
  headerBalanceDelta: number;
  entryBalanceDelta: number;
  headerToEntryDebitDelta: number;
  headerToEntryCreditDelta: number;
  formulaDelta: number | null;
  checks: {
    headerBalance: AccountingJournalCheckState;
    entryBalance: AccountingJournalCheckState;
    headerToEntry: AccountingJournalCheckState;
    formula: AccountingJournalCheckState;
    period: AccountingJournalCheckState;
  };
};
~~~

### 1.2 판정 규칙

- Header balance: header debit과 credit가 같은지 검사
- Entry balance: 모든 entry의 DEBIT 합과 CREDIT 합이 같은지 검사
- Header-to-entry: header debit/credit가 각각 entry 합계와 같은지 검사
- Posted batch의 entryCount가 0이면 BLOCKED
- settlement/reversal처럼 공식 근거가 있는 source는 canonical formula delta를 검사
- formula 근거가 없는 source는 NOT_APPLICABLE
- 근거가 있어야 하지만 데이터를 읽지 못하면 UNKNOWN
- 하나 이상의 FAIL이면 BLOCKED
- required UNKNOWN이 있으면 UNKNOWN
- 모든 필수 check가 PASS이거나 명시적 NOT_APPLICABLE일 때만 CLEAR
- CLEAR가 아니면 green success를 금지

### 1.3 서버 query

- AccountingJournalEntry를 batchId로 grouped aggregate한다.
- 목록에서 entries 전체를 hydrate하지 않는다.
- 한 CTE/subquery/projection으로 entryCount, entryDebitTotal, entryCreditTotal을 만든다.
- Header/entry/formula 판정을 list, summary, detail에 복제하지 않는다.
- 하나의 공용 SQL fragment/helper 또는 동등한 서버 권위 계약을 사용한다.
- per-row N+1 query를 만들지 않는다.
- 숫자 변환과 currency scope를 명확히 한다.
- checkedAt 또는 generatedAt을 반환한다.

### 1.4 Queue와 summary

Needs action은 최소 다음을 포함한다.

- DRAFT
- integrity BLOCKED
- 운영 검토가 필요한 integrity UNKNOWN

기존 review=unbalanced는 backward compatibility가 필요하면 유지하되 의미를 Header D/C mismatch로 명확히 한다.

summary에는 최소 다음을 제공한다.

- total batch count
- clear count
- blocked count
- unknown count
- header mismatch count
- entry mismatch count
- header-entry mismatch count
- formula mismatch count
- posted-without-entry count
- oldest blocker time
- 명확히 정의된 discrepancy amount

### 1.5 기존 데이터 보호

- 먼저 전체 472 batch를 read-only로 검사한다.
- mismatch 수, blocker code별 수, 가장 큰 차이, oldest blocker를 보고한다.
- seed-fin 500k ↔ 390k 사례의 source 생성 경로를 추적한다.
- 자동 수정 SQL을 실행하지 않는다.
- 원인 수정과 기존 데이터 보정은 분리한다.
- data repair가 필요하면 별도 계획과 승인 가능한 dry-run 산출물을 만든다.

## Phase 2 — 목록·상세에 integrity 연결

### 2.1 목록

Journal batch row에 다음을 표시한다.

- Journal/source
- Source & participants
- Period / posted time
- Header debit / credit
- Entry debit / credit
- Header ↔ entry delta
- Overall integrity
- 가장 중요한 blocker
- Review evidence

규칙:

- Header balanced와 Integrity clear를 다른 용어로 사용한다.
- overall state가 BLOCKED면 danger, UNKNOWN이면 warning/neutral, CLEAR만 success다.
- Debit와 Credit 라벨을 둘 다 표시한다.
- 금액 열을 우측 정렬한다.
- Source title link와 Open detail 중복 interaction을 하나로 정리한다.

### 2.2 상세 첫 viewport

1440×900 첫 화면에서 다음을 판단할 수 있어야 한다.

1. overall state: Clear / Blocked / Unknown
2. blocker count
3. 가장 중요한 blocker와 차이 금액
4. checkedAt
5. next action

권장 순서:

1. Integrity decision strip
2. Journal identity
3. Source trace
4. Journal entries
5. Technical evidence

Integrity decision strip에는 다음 check를 분리한다.

- Header debit vs credit
- Entry debit vs credit
- Header vs entry
- Formula
- Accounting period
- Evidence availability

현재처럼 같은 패널에 green Balanced와 Formula delta 12,000 VND가 동시에 보이면 실패다.

### 2.3 Entries summary

Journal entries section 상단에 다음 합계를 표시한다.

- Entry debit total
- Entry credit total
- Entry balance delta
- Header debit difference
- Header credit difference

### 2.4 Reversal evidence

metadata.operation 문자열에만 의존하지 마라.

우선순위:

1. canonical settlementReversalEntry relation
2. 명시적으로 정의된 reversal audit/approval relation
3. validated metadata fallback

표시:

- reversal reference
- reason
- occurred/posted time
- approval actor
- approval time
- original journal/settlement link

canonical evidence가 있는데 UI가 숨기면 실패다.

### 2.5 Technical evidence

raw enum, immutable ID, metadata, policy snapshot은 기본 판단보다 낮은 disclosure에 둔다.

human label 예:

- BOOKING_SETTLEMENT_REVERSAL → Booking settlement reversal
- OPERATING_EXPENSE → Operating expense
- partner_receivable_negative_wallet → Partner receivable / negative wallet

원문은 copy 가능한 technical value로 보존한다.

## Phase 3 — URL·검색·오류 상태

### 3.1 All records

General Ledger 전용 URL 계약:

- direct /finance-tax/general-ledger 기본은 Needs action
- 사용자가 All records를 선택하면 review=all을 explicit하게 직렬화
- reload 후 All records active
- pagination, range, q 변경 후에도 review=all 유지
- list/summary API에는 unintended review=needs-action이 붙지 않음

공용 financeAccountingHref의 다른 소비자를 무심코 변경하지 마라. GL wrapper 또는 명시적 serialization 옵션을 사용한다.

### 3.2 Clear search

현재 filters 객체에 q가 남아 있기 때문에 두 번째 query 인자만 비워서는 안 된다.

Clear search:

- q를 실제 filters에서 제거
- page=1
- review/range/take/sort/advanced filters 유지

Reset all:

- q 제거
- page=1
- 기본 Needs action / Today / 10 rows로 복귀

두 action을 구분한다.

### 3.3 Overview scope

다음 중 하나를 선택하고 수치와 destination을 일치시킨다.

권장안:

- command cards는 All journals · selected range overview
- 검색은 overview 수치에 적용하지 않음
- Search does not change overview totals를 짧게 표시
- card 클릭 시 q를 제거

검색 결과용 summary를 별도로 만들 경우 카드 수치와 링크 모두 q를 적용한다.

혼합하지 마라.

### 3.4 Safe returnTo

list detail href에 현재 상대 URL을 returnTo로 전달한다.

safeGeneralLedgerReturnTo 요구:

- /finance-tax/general-ledger로 시작하는 내부 상대 경로만 허용
- //evil 거절
- backslash 거절
- 외부 URL 거절
- 유사 prefix /finance-tax/general-ledger-evil 거절
- q, view/review, range/period, page, take, sort, advanced filters 보존

action 문구는 Back to results로 바꾼다.

가능하면 이전 row 또는 results heading으로 focus를 복원한다.

### 3.5 API 상태

adminGet fallback만 사용하지 말고 adminGetResult 또는 동등 계약을 사용한다.

상태:

- 200 + empty: 진짜 0건
- 200 + q empty: 검색 결과 0건
- 401/403: 권한 안내
- 404 detail: 실제 record missing
- 5xx/network: Ledger data unavailable + Retry
- summary만 실패: list 유지, 해당 card만 unavailable
- 성공: retrievedAt/checkedAt

장애를 0, Balanced, No records, notFound로 위장하면 실패다.

## Phase 4 — 정보 구조 결정

현재 화면은 journal batch audit이며 실제 General Ledger가 아니다.

반드시 다음 두 경로 중 하나를 evidence 기반으로 선택한다.

### 경로 A — 실제 General Ledger 구현

저장소의 chart of accounts, balance direction, opening/closing 정책이 신뢰 가능하면 같은 route 안에 다음 view를 구현한다.

~~~text
General Ledger
├─ Account activity
├─ Journal batches
├─ Trial balance
└─ Integrity exceptions
~~~

권장 URL:

- ?view=accounts&period=YYYY-MM
- ?view=journals&review=posted
- ?view=trial-balance&period=YYYY-MM
- ?view=exceptions&sort=oldest

Account activity 최소 기능:

- account code/name
- posting date와 accounting period
- opening balance
- debit movement
- credit movement
- net movement
- closing balance
- chronological entries
- running balance
- source batch drill-down

Trial balance 최소 기능:

- period별 account code/name
- opening 또는 명시적 period movement scope
- debit
- credit
- closing
- 전체 debit=credit check
- account drill-down
- CSV

정책 근거 없이 debit-positive/credit-positive 또는 opening/closing 계산을 만들지 마라.

### 경로 B — 정직한 Journal Batches로 변경

정확한 account balance 정책이나 데이터가 부족하면 이 경로를 선택한다.

- page title: Journal Batches
- sidebar: Journal Batches
- breadcrumb: Journal Batches
- command search entry: Journal Batches
- permission label/scope 문구 정합성
- description: Review journal batches, entry totals, integrity blockers, and source evidence.

기능이 없는 상태에서 General Ledger 이름을 유지하는 제3의 선택은 허용하지 않는다.

권장 기본값은 경로 B다. 경로 A는 현재 저장소에서 회계 정책 근거를 확인할 수 있을 때만 선택한다.

## Phase 5 — 회계 필터와 export

### 5.1 Quick filters

항상 표시:

- view
- period 또는 date preset
- search
- status/integrity queue
- sort
- Reset all

### 5.2 Advanced filters

기존 disclosure/drawer 패턴을 재사용한다.

- custom posted date from/to
- accounting period exact
- account code/name
- source type
- batch ID
- entry ID
- source ID
- booking/payment/customer/partner
- debit/credit amount range
- currency
- integrity blocker
- bank evidence
- created/posted by

필터를 모두 한 줄에 펼치지 않는다.

### 5.3 검색

- exact batch/entry/source/booking/payment ID를 먼저 처리
- accounting period는 equality 우선
- account code/name은 account/journal view에서 지원
- 일반 text contains 검색은 필요한 필드로 제한
- active filter를 removable chip으로 표시
- page가 아닌 조건 변경은 page=1

### 5.4 정렬

- oldest blocker
- largest discrepancy
- newest

정렬은 URL에 보존한다.

### 5.5 CSV

기존 finance export route, permission, audit log, bounded result 패턴을 재사용한다.

최소 export:

1. Current filtered journal entries/batches
2. Trial balance/current period — 경로 A를 선택한 경우

포함:

- generatedAt
- timezone
- operator
- filter summary
- batch ID
- entry ID
- source type/ID
- booking/payment/customer/partner reference
- account code/name
- side
- amount
- currency
- postedAt
- accounting period
- header totals
- entry totals
- deltas
- integrity state
- blocker codes
- checkedAt

화면과 export가 다른 integrity 계산을 사용하면 실패다.

대량 export는 bounded async job 또는 현재 프로젝트의 안전한 대량 export 패턴을 사용한다.

## Phase 6 — 1440px 화면 마감

이번 작업의 화면 범위는 1440px 이상이다.

1024px 이하, 모바일, 태블릿, 반응형 검수는 하지 않는다. 해당 범위 때문에 구조를 타협하거나 보고서를 늘리지 마라.

### 6.1 첫 viewport

1440×900에서 최소한 다음이 보여야 한다.

- page title과 핵심 action
- integrity decision/command strip
- compact quick filters
- table heading
- 첫 journal row 또는 empty/error state

네 개의 큰 카드와 반복 helper 때문에 결과가 첫 viewport 아래로 밀리지 않게 한다.

### 6.2 Command cards

- 값은 숫자 유지
- Unbalanced journals 값에 Balanced를 넣지 않음
- 0이면 helper에서 No header mismatch found
- scope: All journals · selected range
- 우선순위: Integrity blockers → Draft → Posted → Reversed

### 6.3 Table 가독성

- account code와 source enum에 overflow-wrap:anywhere 금지
- 문자 중간 줄바꿈 금지
- 필요한 열에 min-width
- amount right alignment
- short ID + copy/full technical value
- fee evidence를 block stack으로 분리
- 0 match(es) 같은 개발자 문구 제거

### 6.4 Related finance menu

현재 다음 동작은 통과하므로 보존한다.

- aria-expanded
- ArrowDown
- Escape
- trigger focus return

항목은 4~6개로 축소한다.

권장:

- Payment clearing
- Bank reconciliation
- Monthly tax closing
- Finance approval queue
- Tax overview

Export current result는 탐색 메뉴 밖의 별도 action이다.

### 6.5 접근성

- Search 버튼 일반 텍스트 대비 4.5:1 이상
- list table aria-label: General ledger journal batches 또는 Journal batch results
- detail table aria-label: Journal entries
- status를 색상에만 의존하지 않음
- 검색/필터 후 results heading 또는 empty/error 상태로 focus 이동
- API 오류는 적절한 status/alert
- menu keyboard 동작 회귀 테스트

### 6.6 다크 테마

현재 다크 테마는 통과 상태다. 회귀만 확인하고 불필요하게 재설계하지 마라.

## 성능 요구

현재 목록은 매 렌더마다 queue summary, overview summary, list 세 요청을 no-store로 실행한다.

개선 방향:

- list response에 rows, total, current queue integrity summary 결합 검토
- 검색과 독립인 overview는 30초 aggregate cache 검토
- current queue가 overview와 같을 때 중복 summary 제거
- grouped entry aggregate는 N+1 없이 실행
- ID exact/prefix와 period equality 우선
- 현재 데이터 규모와 EXPLAIN을 확인한 뒤에만 trigram index 도입

성능 개선 때문에 freshness나 회계 정확성을 희생하지 마라.

## 필수 테스트

### API/integrity

- Header 500k/500k, Entry 390k/390k → BLOCKED
- entry D/C mismatch
- header-entry debit mismatch
- header-entry credit mismatch
- posted zero entries
- formula delta
- required unknown
- needs-action includes blocked/unknown
- summary blocker counts
- list/detail/export parity
- query bounded, no entries hydration on list
- canonical reversal evidence

### Admin Web

- direct route defaults Needs action
- All records explicit review=all
- All records reload/pagination/range/search 유지
- Clear removes q
- Reset all defaults
- overview scope/destination parity
- BLOCKED/UNKNOWN/CLEAR tone
- formula delta prevents green
- safe returnTo allow/deny
- API 401/403/404/5xx/network
- search empty vs true empty
- reversal evidence render
- unique aria-label
- menu keyboard
- name/IA chosen path
- export link and filter parity

### 1440px browser

브라우저에서 실제로 다음을 조작한다.

1. 기본 Needs action
2. All records
3. All dates / Posted
4. seed-fin search
5. Clear search
6. empty search
7. seed-fin reversal detail
8. integrity decision strip
9. journal entry totals
10. Back to results
11. Related finance menu keyboard
12. dark mode
13. export initiation이 권한·필터를 보존하는지 확인하되 실제 민감 데이터 배포는 하지 않음

각 상태를 1440×900으로 새로 캡처한다. 이전 보고서 이미지를 after 증거로 재사용하지 않는다.

## 실행할 최소 명령

저장소의 실제 package script를 확인한 후 동등한 명령을 실행한다.

~~~powershell
npm.cmd test --workspace @massage-vn/admin-web -- --run "app/finance-tax/general-ledger/page.spec.tsx" "app/finance-tax/general-ledger/[id]/page.spec.tsx" "app/finance-tax/tax-settlement-page-model.spec.ts" "app/finance-tax/tax-finance-workflow-actions.spec.tsx"

npm.cmd test --workspace @massage-vn/api -- --run "src/admin/admin.controller.spec.ts" -t "accounting journal"

npm.cmd test --workspace @massage-vn/api -- --run "src/admin/admin.service.spec.ts" -t "journal"

npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
~~~

필요하면 관련 finance list/detail contract와 export tests를 추가로 실행한다.

테스트가 실패하면 이번 변경 때문인지 기존 unrelated failure인지 구분하고 근거를 기록한다. 실패를 숨기거나 통과로 표현하지 마라.

## 완료 수용 기준

아래 항목을 모두 실제로 확인하기 전에는 완료라고 말하지 마라.

- [ ] Header와 entry 합계가 다르면 overall BLOCKED다.
- [ ] seed-fin reversal batch가 더 이상 Balanced/Clear로 보이지 않는다.
- [ ] Formula delta 또는 required UNKNOWN이 있으면 green success가 없다.
- [ ] Posted batch 0 entries가 blocker다.
- [ ] Needs action이 draft, blocked, required unknown을 포함한다.
- [ ] list, summary, detail, closeout, export가 같은 integrity 값을 사용한다.
- [ ] All records URL에 review=all이 명시되고 reload 후 유지된다.
- [ ] Clear search가 q를 제거한다.
- [ ] Reset all이 기본 queue로 복귀한다.
- [ ] Overview 카드 수치와 클릭 목적지 범위가 같다.
- [ ] API 장애가 0건 또는 404로 위장되지 않는다.
- [ ] detail return이 q/range/review/page/take/sort를 복원한다.
- [ ] canonical reversal reason/time/approval이 렌더된다.
- [ ] Account activity/Trial balance를 구현했거나 모든 UI 이름을 Journal Batches로 변경했다.
- [ ] 회계 필터와 정렬이 URL에 보존된다.
- [ ] 현재 필터와 같은 audit CSV가 생성된다.
- [ ] 1440×900 첫 viewport에서 첫 row 또는 empty/error state가 보인다.
- [ ] account code와 enum이 문자 중간에서 끊기지 않는다.
- [ ] Search 일반 텍스트 대비가 4.5:1 이상이다.
- [ ] 검색 0건, 진짜 0건, 권한 없음, API 실패, true 404가 구분된다.
- [ ] Related finance menu keyboard 동작이 유지된다.
- [ ] 관련 focused tests와 typecheck가 통과한다.
- [ ] 사용자 기존 변경을 손실시키지 않았다.
- [ ] before/after 캡처와 검증 결과가 산출물 디렉터리에 있다.

## 완료 보고 형식

최종 응답은 다음 순서로 작성한다.

1. 한 문단 결론
2. 수정한 파일 목록
3. P0 integrity 계약 설명
4. 실제 seed-fin before/after 값
5. All/Clear/return/error 수정 결과
6. IA 선택: 실제 General Ledger 또는 Journal Batches
7. 필터·export 결과
8. 1440px 화면 검증 표
9. 실행한 테스트와 결과
10. 성능 변화
11. 남은 제한 또는 blocker
12. 검증 산출물 링크

각 수용기준을 Passed / Failed / Blocked로 표시한다.

테스트가 통과했더라도 실제 1440px 화면에서 seed-fin이 Balanced로 보이면 전체 작업은 Failed다.

## 최종 자체 검수 질문

완료 직전에 스스로 답하라.

1. 운영자가 첫 화면에서 최종 무결성 상태를 하나로 이해할 수 있는가?
2. Header, Entry, Header↔Entry, Formula가 각각 보이는가?
3. 500k header와 390k entry가 같은 상태로 통과할 가능성이 남아 있는가?
4. 장애와 진짜 0건을 구분하는가?
5. All과 Clear가 reload 가능한 URL 상태인가?
6. 상세에서 원래 결과로 돌아오는가?
7. 페이지 이름이 실제 제공 기능과 일치하는가?
8. 화면과 CSV와 월마감이 같은 integrity 정의를 사용하는가?
9. 1440×900에서 첫 데이터 또는 상태가 보이는가?
10. 테스트가 구현 세부가 아니라 사용자 결과를 검증하는가?

하나라도 아니오라면 수정 또는 명시적 blocker 보고 없이 완료 처리하지 마라.

---

이 프롬프트의 우선순위는 시각적 polish보다 회계 신뢰성이다. P0 integrity, All/Clear/return/error를 먼저 끝내고, 그 다음 정보 구조·필터·export·1440px 마감을 진행하라.
