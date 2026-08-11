# HANDS Admin General Ledger 개선 구현용 Codex 마스터 프롬프트

아래 내용을 HANDS 프로젝트가 열린 Codex 작업에 그대로 전달한다.

---

## 목표

`C:\dev\massage-on-demand-vn`의 HANDS Admin `General Ledger` 화면과 관련 API를 실제로 수정하라.

이번 작업의 목적은 단순한 UI 미화가 아니다. 재무 운영자가 월마감과 감사 판단에 사용할 수 있도록 다음을 달성해야 한다.

1. 저장된 배치 헤더 합계뿐 아니라 실제 분개 행을 재합산해 회계 무결성을 판정한다.
2. `All records` 필터, 오류 상태, 상세 복귀 문맥처럼 현재 확인된 기능 오류를 해결한다.
3. 현재의 journal batch lookup을 운영자가 이해하기 쉬운 원장 작업 공간으로 개선한다.
4. 1440px 이상 화면에서 필터·표·상세·문구·키보드 접근성을 다듬는다.
5. 기존 회계 데이터와 감사 증거를 훼손하지 않고, API·목록·상세·월마감·내보내기가 같은 무결성 정의를 사용하게 한다.

계획이나 추가 보고서만 작성하고 끝내지 말고, 범위 안의 코드 변경·테스트·1440px 실제 화면 검증까지 완료하라.

## 반드시 먼저 읽을 자료

작업 시작 전에 다음 파일을 모두 읽고 현재 코드와 대조하라.

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\output\general-ledger-audit-2026-08-09\general-ledger-deep-audit-report.md`
3. 같은 폴더의 `01`~`10` 감사 스크린샷
4. 아래 주요 구현 파일과 관련 테스트
   - `apps/admin_web/app/finance-tax/general-ledger/page.tsx`
   - `apps/admin_web/app/finance-tax/general-ledger/[id]/page.tsx`
   - `apps/admin_web/app/finance-tax/general-ledger/page.spec.tsx`
   - `apps/admin_web/app/finance-tax/finance-list-pages.spec.tsx`
   - `apps/admin_web/app/finance-tax/finance-detail-pages.spec.tsx`
   - `apps/admin_web/app/finance-tax/tax-settlement-page-model.ts`
   - `apps/admin_web/app/finance-tax/tax-settlement-page-model.spec.ts`
   - `apps/admin_web/app/finance-tax/tax-finance-workflow-actions.tsx`
   - `apps/admin_web/app/finance-tax/tax-finance-workflow-actions.spec.tsx`
   - `apps/admin_web/lib/admin-api.ts`
   - `apps/api/src/admin/admin-ledger.routes.ts`
   - `apps/api/src/admin/admin.service.ts`
   - `apps/api/src/admin/admin.service.spec.ts`
   - `apps/api/prisma/schema.prisma`

`rg`로 관련 타입, API route, closeout consumer, export pattern, safe `returnTo` 패턴, 공용 dropdown/table/filter 컴포넌트를 추가 조사하라. 비슷한 기능은 새로 발명하지 말고 기존 payment clearing, bank reconciliation, finance export 구현을 우선 재사용하라.

## 작업 원칙과 금지사항

- `C:\dev\massage-on-demand-vn`에서만 작업한다. `C:\dev\massage-vn-workspace`는 사용하지 않는다.
- 저장소의 `AGENTS.md`에 따라 단일 에이전트로 작업한다. subagent나 multi-agent 도구를 사용하지 않는다.
- 현재 worktree는 매우 dirty할 수 있다. 사용자 변경을 보존하고 관련 없는 파일을 되돌리거나 정리하지 않는다.
- `git reset --hard`, `git checkout --`, 광범위한 삭제, 기존 데이터 덮어쓰기를 하지 않는다.
- 실제 전표 게시, 승인, 반전, 월마감, settlement 변경 등 금전 상태를 바꾸는 UI/API 동작을 실행하지 않는다.
- 관찰된 기존 batch total을 자동 수정하거나 backfill로 덮어쓰지 않는다. 먼저 read-only 진단과 blocker 표시를 구현한다.
- UI에서만 무결성을 계산하거나 차단하지 않는다. 서버 API가 최종 권위여야 한다.
- 분개 합계를 각 row마다 별도 query로 계산하는 N+1 구현을 금지한다.
- 새로운 의존성은 꼭 필요한 경우가 아니면 추가하지 않는다.
- 기존 design token, Admin component, finance page pattern을 사용한다. 별도 디자인 시스템을 만들지 않는다.
- 모바일·태블릿 대응에 시간을 쓰지 않는다. **1024px 이하 화면은 검사·수정·보고 범위에서 제외한다.** 검증 viewport는 1440×900 이상만 사용한다.
- seeded local dataset의 500,000 VND ↔ 390,000 VND 불일치를 production 전체 손상으로 단정하지 않는다.
- 확정되지 않은 회계 정책을 추측하지 않는다. 검사할 근거가 없으면 성공으로 처리하지 말고 `UNKNOWN` 또는 `NOT_APPLICABLE`을 사용한다.
- 앱 소스 변경을 끝낸 뒤 요청하지 않은 commit은 만들지 않는다.

## 작업 순서

아래 순서를 지킨다. P0가 완성되기 전에 색상·spacing 위주의 P2 작업으로 넘어가지 않는다.

### 0단계 — 현재 상태와 회귀 기준 확보

1. `git status --short`와 관련 파일 diff를 확인한다.
2. 현재 General Ledger 화면을 1440×900으로 캡처한다.
3. 다음 상태를 실제 브라우저에서 재현한다.
   - 기본 Needs action
   - All records 선택 후 Needs action으로 돌아가는 버그
   - Posted records / All dates
   - `q=seed-fin` 검색 결과
   - `seed-finance-smoke-reversal-journal-batch` 상세
   - 상세에서 목록 복귀 시 검색 문맥 상실
   - More finance pages 메뉴의 Escape 동작
4. 기존 targeted tests를 먼저 실행해 baseline을 기록한다.
5. 이미 존재하는 사용자 변경과 이번 작업 변경이 겹치면 현재 의도를 보존하며 최소 patch로 수정한다.

### 1단계 — P0 회계 무결성 계약

#### 1.1 서버 권위의 integrity model

배치별로 최소 다음 값을 서버에서 계산해 list와 detail에 제공하라.

```ts
type AccountingJournalIntegrityState = 'CLEAR' | 'BLOCKED' | 'UNKNOWN';
type AccountingJournalCheckState = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE';

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
```

정확한 타입 위치와 naming은 현재 프로젝트 패턴에 맞춰 조정해도 되지만 의미를 축소하지 않는다.

안정적인 blocker code를 정의하라.

- `HEADER_DEBIT_CREDIT_MISMATCH`
- `ENTRY_DEBIT_CREDIT_MISMATCH`
- `HEADER_ENTRY_DEBIT_MISMATCH`
- `HEADER_ENTRY_CREDIT_MISMATCH`
- `POSTED_BATCH_HAS_NO_ENTRIES`
- `FORMULA_DELTA`
- `MISSING_ACCOUNTING_PERIOD`
- `INTEGRITY_NOT_EVALUATED`

회계 정책이 확정되지 않은 fee policy/bank evidence는 이번 작업에서 임의로 hard blocker로 만들지 않는다. 대신 별도 evidence state로 노출하거나 `UNKNOWN`으로 유지하고, 성공으로 위장하지 않는다.

#### 1.2 판정 규칙

- Header balance: `batch.totalDebit === batch.totalCredit`
- Entry balance: entry의 DEBIT 합과 CREDIT 합이 같은지 검사
- Header-to-entry: header debit/credit이 각각 entry debit/credit 합과 같은지 검사
- 게시된 batch에 entry가 0건이면 `BLOCKED`
- settlement/reversal처럼 공식 계산 근거가 있는 source는 formula delta를 검사
- 공식이 정의되지 않은 source type은 formula `NOT_APPLICABLE` 또는 근거가 부족하면 `UNKNOWN`
- `CLEAR`는 모든 필수 검사가 PASS이고 required UNKNOWN이 없을 때만 허용
- 하나 이상의 FAIL은 `BLOCKED`
- 검사 자체를 완료할 수 없으면 green 상태가 아니라 `UNKNOWN`

다음 관찰 사례는 반드시 `BLOCKED`가 되어야 한다.

```text
header debit  = 500,000 VND
header credit = 500,000 VND
entry debit   = 390,000 VND
entry credit  = 390,000 VND
```

현재처럼 `Balanced`로 표시되면 실패다.

#### 1.3 query 설계

- `AccountingJournalEntry`를 batchId로 grouped aggregate하는 CTE/subquery/projection을 사용한다.
- 목록 10/25/50행에 대해 raw entries 전체를 hydrate하지 않는다.
- list, summary, detail이 서로 다른 계산 정의를 복제하지 않도록 공용 SQL/helper/contract를 사용한다.
- `needs-action` queue는 draft뿐 아니라 `BLOCKED`와 운영자가 검토해야 하는 `UNKNOWN`을 포함한다.
- 기존 `unbalanced` 필터는 backward compatibility가 필요하면 유지하되 의미를 `Header D/C mismatch`로 명확히 한다.
- summary에 최소 다음 집계를 추가한다.
  - integrity blocked count
  - integrity unknown count
  - header unbalanced count
  - header-entry mismatch count
  - entry unbalanced count
  - formula mismatch count
  - oldest blocked time
  - discrepancy amount 또는 명확하게 정의된 risk amount
- overview, list row, detail, closeout preflight, export가 동일 계산값을 사용하게 한다.

#### 1.4 기존 데이터 보호

- batch header total을 entry total로 자동 덮어쓰지 않는다.
- schema 변경 없이 계산 가능한 경우 migration을 만들지 않는다.
- 새 저장 필드나 materialized projection이 정말 필요하다면 먼저 현재 데이터 생성 경로와 일관성 보장 방법을 검토한다.
- schema/migration을 변경한다면 기존 데이터 보존, backfill 전략, rollback, full verification을 별도로 보고한다.
- 기존 불일치 조사 도구가 필요하면 read-only report/smoke script로 만들고 수정 SQL을 포함하지 않는다.

### 2단계 — P1 기능 정확성

#### 2.1 All records 버그

현재 `financeAccountingHref()`는 `review=all`을 생략하고 General Ledger parser는 누락값을 `needs-action`으로 해석한다.

수정 요구:

- General Ledger의 All records URL은 reload 가능한 explicit `review=all`을 포함한다.
- direct `/finance-tax/general-ledger` 기본 진입은 계속 Needs action이어도 된다.
- All records 클릭, reload, pagination, 날짜 변경, 검색 적용 후에도 `review=all`이 유지돼야 한다.
- 다른 finance 페이지의 `review=all` 생략 규칙을 무심코 깨지 않는다.
- href → parser → API request → active control을 하나의 회귀 테스트로 검증한다.

#### 2.2 API 장애와 0건·404 분리

- General Ledger list/summary/detail은 `adminGet` fallback만 사용하지 말고 `adminGetResult` 또는 동등한 결과 계약을 사용한다.
- 404만 실제 `notFound()`로 처리한다.
- 401/403은 권한 부족 상태로 표시한다.
- 5xx/network는 `Ledger data could not be loaded`와 Retry를 표시한다.
- summary만 실패하면 성공한 list까지 숨기지 않는다.
- 성공 데이터에는 `checkedAt`/`retrievedAt`을 표시한다.
- 실패 상태를 `0`, `Balanced`, `No records`로 위장하지 않는다.

#### 2.3 상세 return context

- list의 detail href에 현재 상대 URL을 `returnTo`로 전달한다.
- `safeGeneralLedgerReturnTo()`를 구현해 `/finance-tax/general-ledger` 내부 경로만 허용한다.
- `//evil`, 외부 URL, backslash, 유사 prefix를 거절한다.
- q, view/review, range/period, page, take, sort 및 advanced filter를 모두 보존한다.
- detail의 action 문구는 `Back to results`로 바꾼다.
- 목록으로 돌아왔을 때 가능하면 이전 table/row 위치와 focus를 복구한다.
- 기존 payment clearing/bank reconciliation 패턴을 재사용한다.

#### 2.4 빈 상태

다음 상태를 서로 다르게 렌더한다.

- 현재 조건의 진짜 0건
- 검색 결과 0건: 검색어, `Clear search`, `Reset filters`
- API 조회 실패: Retry
- 권한 없음
- 상세 true 404
- 상세 temporary failure
- 게시 batch entry 0건: integrity blocker
- 검사를 완료하지 못한 unknown integrity

### 3단계 — General Ledger 정보 구조

현재 기능을 단순히 `General Ledger`라고 유지하지 말고 다음 view 구조를 구현하라. 기존 route 안에서 query 기반 view를 사용하고 불필요하게 물리 페이지를 늘리지 않는다.

```text
General Ledger
├─ Account activity
├─ Journal batches
├─ Trial balance
└─ Integrity exceptions
```

권장 URL:

- `?view=accounts&period=YYYY-MM`
- `?view=journals&review=posted`
- `?view=trial-balance&period=YYYY-MM`
- `?view=exceptions&sort=oldest`

#### 3.1 Account activity

최소 기능:

- account code/name 검색 또는 선택
- posting date 및 accounting period
- opening balance
- period debit
- period credit
- net movement
- closing balance
- 날짜순 entries와 running balance
- source batch/detail drill-down

잔액 방향과 계산 방식은 현재 chart-of-accounts/회계 정책을 조사해 결정한다. 정책 근거 없이 debit-positive/credit-positive 규칙을 임의로 만들지 않는다. 기반 데이터만으로 안전하게 opening/closing을 정의할 수 없다면 그 사실을 코드와 UI에서 명확히 하고, 우선 period movements로 제한한다.

#### 3.2 Journal batches

현재 목록 기능을 이 view로 이동·보존한다.

- status: Draft / Posted / Reversed
- integrity 상태
- source/participants
- period/posted time
- header debit/credit
- entry debit/credit
- header-entry delta
- detail drill-down

#### 3.3 Trial balance

최소 기능:

- period별 account code/name
- opening balance 또는 근거가 부족하면 명확한 period movement scope
- debit movement
- credit movement
- closing balance
- 전체 debit/credit check
- account activity drill-down
- CSV export

#### 3.4 Integrity exceptions

최소 queue:

- Header D/C mismatch
- Entry D/C mismatch
- Header ↔ entry mismatch
- Formula delta
- Posted batch without entries
- Missing accounting period
- Integrity unknown

정렬:

- Oldest blocker
- Largest discrepancy
- Newest

Shift Command와 Monthly Close에서 이 view로 직접 연결할 수 있는 URL을 제공한다.

만약 Account activity와 Trial balance를 신뢰성 있게 구현할 수 있는 정책·데이터가 현재 저장소에 없으면 다음을 지킨다.

1. 추측으로 구현하지 않는다.
2. 현재 화면 제목을 `Journal Batches`로 바꾼다.
3. sidebar의 `General Ledger`도 `Journal Batches`로 정직하게 맞춘다.
4. 부족한 데이터 계약과 정책을 최종 보고서의 명시적 blocker로 기록한다.
5. 그래도 P0 integrity와 2단계 기능 수정은 반드시 완료한다.

### 4단계 — 필터·검색·내보내기

#### 4.1 항상 보이는 quick filters

- View
- period 또는 posting date preset
- search
- status/exception queue
- sort
- reset all

#### 4.2 Advanced filters

기존 공용 filter/drawer 패턴을 재사용해 다음을 제공한다.

- custom date from/to
- accounting period
- account code/name
- source type
- batch ID / entry ID / source ID
- booking / payment / customer / partner
- debit/credit amount range
- currency
- integrity blocker
- bank evidence state
- created/posted by

필터를 한 줄에 모두 노출하지 않는다. 자주 쓰는 조건만 항상 보이고 나머지는 advanced filter에 둔다.

#### 4.3 검색 계약

- placeholder와 실제 검색 필드를 일치시킨다.
- exact batch/entry/source/booking/payment ID를 우선 처리한다.
- period는 contains가 아니라 exact 조건을 우선한다.
- account code/name 검색을 account/journal view에 제공한다.
- `%query% ILIKE`를 무조건 모든 필드에 확대하지 않는다.
- 현재 데이터 규모와 query plan을 확인한 뒤 필요한 경우에만 trigram 등 새 index를 검토한다.
- active search와 advanced filter를 removable chip으로 보여 준다.
- `Clear search`와 `Reset all`을 분리한다.

#### 4.4 CSV export

현재 finance export route와 권한/audit 패턴을 재사용한다.

최소 export:

- Journal entries/current filtered result
- Trial balance/current period

포함 필드:

- export generatedAt, timezone, operator, filter summary
- batch ID, entry ID, source type/ID
- booking/payment/customer/partner reference
- account code/name, side, amount, currency
- postedAt, accounting period
- header totals, entry totals, deltas
- integrity state, blocker codes, checkedAt

대량 결과는 bounded 처리한다. 화면과 export가 서로 다른 integrity 계산을 사용하면 실패다.

### 5단계 — 상세 화면 재구성

상세 페이지의 시각적 우선순위를 다음 순서로 바꾼다.

1. **Integrity decision strip**
   - Clear / Blocked / Unknown
   - blocker 수와 가장 중요한 blocker
   - checked time
   - Header balance
   - Entry balance
   - Header ↔ entry
   - Formula
   - Period/evidence
2. **Journal identity**
   - batch ID, source, status, period
   - created/posted/reversed time
   - created/posted by
3. **Source trace**
   - booking, payment, settlement, reversal, clearing, bank evidence
4. **Journal entries**
   - entry debit total
   - entry credit total
   - entry delta
   - header difference
   - account rows
5. **Technical evidence**
   - raw enums, immutable IDs, policy snapshot, metadata

Green success는 overall integrity가 `CLEAR`일 때만 사용한다. `Header balanced`와 `Integrity clear`를 같은 의미로 사용하지 않는다.

### 6단계 — 목록·문구·가독성

#### 6.1 Journal batch table

권장 열:

- Journal/source
- Related context
- Period/posted
- Header debit/credit
- Entry debit/credit
- Integrity/blocker
- Review evidence

수정 기준:

- 첫 금액에도 `Debit` 라벨을 표시한다.
- source title 링크와 `Open detail` 중복 interaction을 정리한다.
- amount는 우측 정렬한다.
- account code와 enum에 `overflow-wrap:anywhere`를 적용하지 않는다.
- 1440px에서 계정 코드가 문자 단위로 쪼개지지 않게 최소 너비를 설정한다.
- 긴 ID는 short ID + copy/tooltip 또는 technical details에서 전체값을 제공한다.
- raw enum은 human-readable label을 기본으로 하고 원문은 technical value로 보존한다.

#### 6.2 권장 문구

| 기존 | 변경 |
|---|---|
| Needs action | Integrity exceptions |
| Unbalanced | Header D/C mismatch |
| Balanced | Header balanced |
| Double-entry check | Header debit vs credit |
| Monthly close blocker | Closeout integrity |
| Resolve formula delta | Blocked — resolve {amount} formula difference |
| Posted records | Posted batches |
| Open detail | Review evidence |
| Related context | Source & participants |
| More finance pages | Related finance workflows |
| Policy record missing | Missing fee policy evidence |

앱의 기본 언어는 기존 화면에 맞춰 영어를 유지하되 개발자용 문구가 아니라 재무 운영자용 문구로 쓴다.

#### 6.3 Command cards

- `Unbalanced journals = Balanced` 같은 label/value 충돌을 없앤다.
- 값은 숫자로 유지하고 status/helper에서 `No imbalance found`를 설명한다.
- 카드 scope를 `All journals · {range}`로 명시한다.
- 검색 결과와 독립인 overview라면 `Search does not change overview totals`를 간결하게 알린다.
- 카드 우선순위는 Integrity blockers → Draft to post → Posted → Reversed 순으로 둔다.

### 7단계 — Related finance workflows 메뉴

현재 `details/summary + role=menu` 구현을 그대로 두지 않는다.

- 기존 공용 `ActionMenu` 또는 keyboard-complete dropdown을 재사용한다.
- Escape로 닫힌다.
- ArrowUp/ArrowDown/Home/End로 탐색된다.
- `aria-expanded`, trigger-menu 관계, 외부 클릭 닫기를 제공한다.
- sidebar와 중복되는 11개 링크를 그대로 나열하지 않는다.
- General Ledger에서 직접 필요한 4~6개만 제공한다.
  - Payment clearing
  - Bank reconciliation
  - Monthly tax closing
  - Finance approval queue
  - 필요하다면 Tax overview
- `Export current result`는 탐색 메뉴와 분리한다.

공용 `TaxFinanceWorkflowActions`를 수정할 경우 사용하는 다른 finance 페이지에 회귀가 없는지 테스트한다.

### 8단계 — 접근성

- 1440px 화면만 검증하되 WCAG 기본 의미 구조는 지킨다.
- Search primary button 텍스트 대비를 4.5:1 이상으로 맞춘다.
- list와 detail entry table에 고유 aria-label을 제공한다.
- status는 색상만으로 표현하지 않는다.
- API 오류와 검색 결과 변경은 적절한 status/live region으로 알린다.
- filter 변경 후 결과 heading 또는 empty/error state로 focus를 이동한다.
- detail 복귀 후 결과 문맥을 복구한다.
- 긴 account code/enum의 문자 단위 줄바꿈을 제거한다.
- menu keyboard test를 추가한다.

## 필수 테스트

기존 테스트를 보존하고 최소 다음 테스트를 추가한다.

### API/integrity

- header balanced + entries balanced + totals match → CLEAR
- header 500k/500k + entries 390k/390k → BLOCKED
- entry debit/credit mismatch → BLOCKED
- header debit/credit mismatch → BLOCKED
- posted batch with zero entries → BLOCKED
- formula delta → BLOCKED
- unsupported formula with insufficient evidence → UNKNOWN/NOT_APPLICABLE, green false-positive 금지
- needs-action queue가 entry/header mismatch를 포함
- summary와 detail이 같은 integrity 정의 사용
- list aggregate가 N+1을 만들지 않음

### Admin Web

- direct route 기본 Needs action
- All records link에 explicit review=all
- reload/pagination/date/search 후 All 유지
- API 500/network와 empty 결과 분리
- detail 404와 upstream failure 분리
- returnTo allowlist와 q/range/review/view/page/take/sort 복원
- row/detail에서 integrity blocker 표시
- overall UNKNOWN/BLOCKED일 때 green `Integrity clear` 금지
- search zero-state recovery
- unique table aria-label
- More finance pages Escape/Arrow keyboard behavior
- human-readable enum과 account code wrapping 회귀
- export filter와 integrity 값 일치

### 실제 실행할 최소 명령

현재 package script와 변경 파일을 확인해 정확한 명령을 사용하되, 최소 다음 범위를 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- `
  app/finance-tax/general-ledger/page.spec.tsx `
  app/finance-tax/finance-list-pages.spec.tsx `
  app/finance-tax/finance-detail-pages.spec.tsx `
  app/finance-tax/tax-finance-workflow-actions.spec.tsx `
  app/finance-tax/tax-settlement-page-model.spec.ts
```

```powershell
npm.cmd run test --workspace @massage-vn/api -- `
  src/admin/admin.service.spec.ts -t "accounting journal"
```

변경한 새 spec, export route spec, integrity helper spec도 명령에 포함한다.

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

Prisma schema/migration 등 보호 영역을 변경했다면 `AGENTS.md`의 full local verification 요구도 따른다. 기존 저장소의 unrelated failure가 있으면 숨기지 말고 이번 변경과 관계를 구분해 보고한다.

## 1440px 실제 화면 검증

로그인된 in-app browser를 우선 사용한다. 다음 상태를 1440×900 이상에서 직접 확인하고 before/after screenshot을 저장한다.

1. 기본 Integrity exceptions
2. All records 정상 유지
3. Posted journal batches 25 rows
4. 검색 결과와 active filter chip
5. 검색 0건 recovery
6. 500k header / 390k entry mismatch가 Blocked로 보이는 list row
7. 같은 batch detail integrity strip
8. journal entries summary와 account code wrapping
9. detail → Back to results 문맥 복원
10. API error UI는 안전한 mock/test harness로 검증
11. Related finance workflows keyboard menu
12. Account activity / Trial balance / export가 구현된 경우 각 view

실제 finance data mutation은 실행하지 않는다. 스크린샷만 보고 끝내지 말고 DOM, URL, accessible state, 실제 문구와 연결 동작을 함께 검증한다.

## 완료 수용 기준

아래 항목을 모두 확인하라.

- [ ] All records가 실제 전체 기록을 보여 주고 reload 후 유지된다.
- [ ] header와 entry 합계가 다르면 저장된 header끼리 같아도 BLOCKED다.
- [ ] formula delta나 required UNKNOWN이 있을 때 green Integrity clear가 없다.
- [ ] posted batch with zero entries가 blocker다.
- [ ] list, summary, detail, closeout, export가 같은 integrity 정의를 사용한다.
- [ ] API 실패가 0건·Balanced·404로 위장되지 않는다.
- [ ] detail return이 모든 목록 문맥을 복원한다.
- [ ] 현재 제목을 General Ledger로 유지했다면 account activity와 trial balance가 실제 동작한다.
- [ ] 구현 근거가 부족하면 페이지와 navigation을 Journal Batches로 정직하게 바꿨다.
- [ ] 계정/기간/날짜/source/ID/amount/integrity 필터가 제공된다.
- [ ] 현재 필터와 같은 값을 가진 감사 CSV가 생성된다.
- [ ] 1440px에서 account code와 enum이 문자 단위로 깨지지 않는다.
- [ ] Related finance workflows menu가 Escape와 arrow key로 동작한다.
- [ ] 일반 크기 primary text contrast가 4.5:1 이상이다.
- [ ] 검색 0건, API 실패, 권한 없음, 상세 404/temporary failure가 구분된다.
- [ ] 관련 targeted tests, typecheck, scope verification 결과가 기록된다.
- [ ] 사용자 기존 변경을 손실시키지 않았다.

## 완료 보고 형식

최종 답변은 결과부터 간결하게 보고하라.

1. 구현 결과 요약
2. P0/P1/P2별 완료 항목
3. 변경 파일 목록과 각 파일의 역할
4. API·무결성 계약 변경 내용
5. 1440px before/after screenshot 링크
6. 실행한 명령과 pass/fail/skipped 결과
7. 보호 영역 변경 여부
8. 기존 데이터에 적용한 작업 여부 — 자동 수정이 없었음을 명시
9. 남은 위험·정책 결정이 필요한 항목
10. 다음 권장 작업

완료하지 못한 항목이 있으면 `완료`로 표현하지 말고 정확한 blocker, 확인한 증거, 안전한 다음 조치를 적는다.

---

## 가장 중요한 성공 조건

이번 작업은 화면이 더 예뻐 보이는 것으로 성공하지 않는다.

**배치 헤더가 500,000/500,000이고 실제 분개 합계가 390,000/390,000인 기록이 더 이상 `Balanced` 또는 `Integrity clear`로 보이지 않으며, 운영자가 그 차이와 다음 조사 경로를 첫 화면에서 이해할 수 있어야 성공이다.**
