# HANDS Admin Booking Settlement Audit 개선 구현용 Codex 마스터 프롬프트

아래 내용을 `C:\dev\massage-on-demand-vn` 프로젝트가 열린 Codex 작업에 그대로 전달한다.

---

## 역할

너는 HANDS Admin의 재무 운영 화면을 개선하는 senior full-stack engineer다. UI를 보기 좋게 만드는 것만이 아니라, 운영자가 화면의 `Needs action`, `Resolved`, `Evidence retained`, `Balanced`, `Reversed` 판정을 실제 재무 판단에 사용할 수 있도록 **서버 권위의 정산 감사 계약, 목록, 상세, 오류 상태, CSV, 테스트를 하나의 정의로 연결**해야 한다.

작업 대상:

- Admin Web: `http://localhost:3101/finance-tax/booking-settlement-audit`
- Detail: `/finance-tax/booking-settlement-audit/[id]`
- 관련 API, settlement journal, payment clearing, reversal, coupon, tax closeout, export
- 저장소: `C:\dev\massage-on-demand-vn`

계획이나 추가 감사 보고서만 작성하고 끝내지 말라. 범위 안의 코드 변경, 테스트, 1440×900 실제 화면 검증, 완료 보고까지 수행하라.

## 최종 목표

다음 결과를 만들어야 한다.

1. 원 settlement journal/clearing과 reversal journal/clearing을 정확히 구분한다.
2. open-period legacy reversal과 closed-period reversal entry를 모두 지원한다.
3. 환불된 기록에서 `Evidence retained`, `0 reversal`, `No reversal`, `Ready for tax review`가 서로 모순되게 표시되지 않게 한다.
4. list, summary, detail, reversal, closeout, CSV가 동일한 서버 권위 `settlementAuditHealth`를 사용한다.
5. 회사 부담 coupon을 포함한 allocation formula를 정확히 계산한다.
6. action queue가 tax/payment fee뿐 아니라 journal, clearing, bank, coupon, reversal, period, allocation 문제를 포괄한다.
7. 오래된 unresolved backlog가 Today 범위 때문에 숨지 않게 한다.
8. `All records`, 이름 검색, accounting period, detail return context, API 오류 상태, CSV scope·PII 문제를 해결한다.
9. 1440×900 첫 viewport에서 실제 table header와 첫 결과를 볼 수 있는 운영 밀도를 만든다.
10. 기존 회계 원본과 사용자의 dirty worktree를 훼손하지 않는다.

## 반드시 먼저 읽을 자료

코드를 수정하기 전에 아래 자료를 모두 읽고 현재 구현과 대조하라.

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. 감사 보고서:
   - `C:\dev\massage-on-demand-vn\output\booking-settlement-audit-2026-08-09\booking-settlement-audit-deep-audit-report.md`
3. 같은 폴더의 핵심 스크린샷:
   - `01-default-needs-action-1440x900.png`
   - `02-all-records-backlog-1440x900.png`
   - `05-all-records-click-selected-needs-action-1440x900.png`
   - `06-needs-action-table-1440x900.png`
   - `07-detail-overview-evidence-1440x900.png`
   - `09-detail-evidence-hub-1440x900.png`
   - `10-detail-accounting-amounts-1440x900.png`
   - `11-detail-policy-records-1440x900.png`
   - `12-reversed-record-top-1440x900.png`
   - `13-reversed-record-evidence-mislabel-1440x900.png`
   - `14-export-menu-open-1440x900.png`
   - `15-customer-name-search-no-results-1440x900.png`
   - `16-all-records-first-viewport-data-hidden-1440x900.png`
4. 주요 Admin Web 파일:
   - `apps/admin_web/app/finance-tax/booking-settlement-audit/page.tsx`
   - `apps/admin_web/app/finance-tax/booking-settlement-audit/[id]/page.tsx`
   - `apps/admin_web/app/finance-tax/booking-settlement-audit/page.spec.tsx`
   - `apps/admin_web/app/finance-tax/booking-settlement-audit/[id]/page.spec.tsx`
   - `apps/admin_web/app/finance-tax/tax-settlement-page-model.ts`
   - `apps/admin_web/app/finance-tax/tax-settlement-page-model.spec.ts`
   - `apps/admin_web/app/finance-tax/finance-list-pages.spec.tsx`
   - `apps/admin_web/app/finance-tax/finance-detail-pages.spec.tsx`
   - `apps/admin_web/app/finance-tax/tax-finance-workflow-actions.tsx`
   - `apps/admin_web/app/finance-tax/tax-finance-workflow-actions.spec.tsx`
   - `apps/admin_web/app/api/admin/finance-tax/booking-settlement-audit/export/route.ts`
   - `apps/admin_web/app/api/admin/finance-tax/booking-settlement-audit/export/route.spec.ts`
   - `apps/admin_web/lib/admin-api.ts`
5. 주요 API·회계 파일:
   - `apps/api/src/admin/admin-settlement.routes.ts`
   - `apps/api/src/admin/admin.service.ts`
   - `apps/api/src/admin/admin.service.spec.ts`
   - `apps/api/src/settlements/settlements.service.ts`
   - `apps/api/src/settlements/settlements.service.spec.ts`
   - `apps/api/src/settlements/settlement-journal.ts`
   - `apps/api/src/settlements/settlement-journal.spec.ts`
   - `apps/api/src/settlements/coupon-settlement.ts`
   - `apps/api/src/settlements/coupon-settlement.spec.ts`
   - `apps/api/prisma/schema.prisma`

`rg`로 다음 기존 패턴도 조사하라.

- payment clearing와 bank reconciliation의 safe `returnTo`
- finance export의 permission, audit log, pagination/cursor, error response
- 공용 ActionMenu와 keyboard-complete dropdown
- 공용 filter toolbar, advanced filter, error/empty/loading 상태
- finance closeout가 settlement 상태를 소비하는 위치
- Shift Command에서 settlement blocker로 연결하는 위치
- journal entry aggregate와 bank match aggregate 구현

새 추상화를 먼저 만들지 말고 현재 저장소의 검증된 local pattern을 우선 재사용하라.

## 감사에서 확인된 기준 데이터

현재 local dataset에서 확인한 수치다. 구현 전후 regression 기준으로 사용하되 production 전체 상태라고 단정하지 말라.

```text
전체 settlement snapshots: 240
Needs action: 200
Tax open: 199
Payment fee issues: 107
Resolved: 0
Reversed: 40
Clearing 없는 snapshots: 133
Journal 2개 이상 snapshots: 41
Clearing 2개 이상 snapshots: 41
Reversed인데 BookingSettlementReversalEntry 없음: 40/40
Reversed이며 BOOKING_SETTLEMENT_REVERSAL journal 존재: 40/40
가장 오래된 Needs action: 2026-06-10
현재 coupon metadata 보유 snapshot: 0
```

반드시 재현하고 고쳐야 하는 reversal 사례:

```text
snapshot: cmr3a1evw0nw8vyjg3le5j4cx
settlementStatus: REVERSED
taxStatus: REVERSED
booking status: REFUNDED
latest journal sourceType: BOOKING_SETTLEMENT_REVERSAL
latest clearing type/status: REFUND_REVERSAL / REVERSED

현재 잘못된 UI:
Evidence retained
2 journal · 2 clearing · 0 reversal
Ready for tax review
Settlement journal = 실제 reversal journal
Payment clearing = 실제 refund reversal clearing
No reversal
```

이 상태가 수정 후에도 남으면 작업 실패다.

## 작업 원칙과 금지사항

- `C:\dev\massage-on-demand-vn`에서만 작업한다.
- `AGENTS.md`를 따른다. 저장소 지침상 단일 에이전트로 작업하고 subagent/multi-agent를 사용하지 않는다.
- 작업 시작 시 `git status --short`와 관련 diff를 확인한다.
- worktree가 매우 dirty할 수 있다. 사용자 변경을 보존하고 관련 없는 파일을 되돌리거나 정리하지 않는다.
- `git reset --hard`, `git checkout --`, 광범위한 delete, 자동 formatting 전체 적용을 하지 않는다.
- 실제 settlement, journal posting, clearing, refund/reversal, tax declaration/payment/closeout 등 금전 상태를 변경하는 동작을 실행하지 않는다.
- 기존 settlement/journal/clearing record를 자동 보정하거나 덮어쓰지 않는다.
- 기존 reversed 40건을 무리하게 새 reversal row로 변환하지 않는다. 먼저 기존 증거를 정확히 읽는 호환 classifier를 구현한다.
- UI에서만 audit health를 계산하지 않는다. API가 권위 값이어야 한다.
- list row마다 relation을 별도 조회하는 N+1을 금지한다.
- 여러 화면이 서로 다른 `Needs action`, `Resolved`, `Balanced` 정의를 갖게 하지 않는다.
- 근거가 없는 상태를 success로 처리하지 않는다. `UNKNOWN` 또는 `NOT_APPLICABLE`을 사용한다.
- payment method별 clearing 필수 여부를 추측하지 않는다. settlement 생성 서비스와 테스트를 근거로 결정한다. 예를 들어 customer wallet은 외부 clearing이 없을 수 있다.
- payment processing fee를 allocation split에서 임의로 차감하지 않는다. 현재 journal에서 fee expense와 clearing이 대칭인지 확인한다.
- 새로운 dependency는 꼭 필요한 경우가 아니면 추가하지 않는다.
- 기존 Admin design token과 finance component를 사용하고 별도 디자인 시스템을 만들지 않는다.
- **1024px 이하 화면은 검사·수정·보고 범위에서 완전히 제외한다.** 반응형 개선에 시간을 사용하지 않는다.
- 실제 검증 viewport는 1440×900 이상만 사용한다.
- 요청하지 않은 commit을 만들지 않는다.
- P0/P1이 끝나기 전에 spacing·색상만 만지는 P2 작업으로 넘어가지 않는다.

## 작업 순서

### 0단계 — Baseline과 보호 범위 확보

1. 관련 파일의 현재 diff와 사용자 변경을 파악한다.
2. 감사 보고서와 screenshot을 현재 UI와 비교한다.
3. 로그인된 in-app browser를 우선 사용해 1440×900에서 다음 상태를 재현한다.
   - 기본 Today / Needs action 0건
   - All dates / All records 240건
   - All records 클릭 후 Needs action으로 돌아가는 버그
   - `Demo Customer` 이름 검색 0건
   - 정상 seed detail
   - `cmr3a1evw0nw8vyjg3le5j4cx` reversed detail 모순
   - Export menu Escape 미동작
4. 기존 targeted tests를 먼저 실행해 baseline을 기록한다.
5. 애플리케이션 소스와 실제 finance data는 baseline 단계에서 수정하지 않는다.

### 1단계 — P0 canonical/reversal evidence classifier

#### 1.1 Evidence를 배열 순서가 아닌 의미로 분류

현재 detail은 다음 배열의 첫 요소만 사용하지 않게 수정하라.

```ts
snapshot.accountingJournalBatches?.[0]
snapshot.paymentClearingEntries?.[0]
snapshot.reversalEntries?.[0]
```

최소 분류 규칙:

- canonical settlement journal:
  - `sourceType === 'BOOKING_SETTLEMENT'`
- reversal journal:
  - `sourceType === 'BOOKING_SETTLEMENT_REVERSAL'`
- canonical settlement clearing:
  - `type === 'CUSTOMER_PAYMENT_CAPTURED'` 또는 `type === 'SETTLEMENT_POSTED'`
  - 정확한 paymentMethod별 의미는 settlement service와 tests를 근거로 좁혀라.
- reversal clearing:
  - `type === 'REFUND_REVERSAL'`
- 보조 evidence:
  - `PAYMENT_FEE_ACCRUAL`, `COUPON_OFFSET`, `MANUAL_ADJUSTMENT`는 canonical/reversal과 혼합하지 않고 별도 type으로 표시한다.

API가 최신 3건만 내려 주는 현재 제한이 전체 증거 판단에 충분한지 확인하라. health를 계산할 때 필요한 evidence가 3건 밖에 있을 수 있다면 raw UI list와 health aggregate를 분리한다. UI preview는 bounded여도 되지만 health는 전체 관련 evidence를 검사해야 한다.

#### 1.2 두 종류의 reversal lifecycle 지원

다음을 모두 지원한다.

1. open-period/legacy reversal
   - 원 `BookingSettlementSnapshot`의 settlement/tax status가 REVERSED
   - `reversalReason`, `reversedById`, `closedAt` 등 원 snapshot에 reversal 정보 존재
   - 같은 settlementSnapshotId에 `BOOKING_SETTLEMENT_REVERSAL` journal 존재
   - 같은 settlementSnapshotId에 `REFUND_REVERSAL` clearing 존재
   - 별도 `BookingSettlementReversalEntry`는 없을 수 있음
2. closed-period reversal
   - `BookingSettlementReversalEntry` 존재
   - original period와 reversal period가 다를 수 있음
   - reversal 전용 journal/clearing relation 존재

한 방식만 정상으로 간주하지 말라. 화면에서는 `Open-period reversal`과 `Closed-period reversal`을 운영자가 이해할 수 있는 human label로 구분한다.

#### 1.3 Reversal 판정과 다음 행동

- settlement 또는 tax가 REVERSED면 일반 tax review branch보다 reversal branch를 먼저 평가한다.
- reversal 신호가 하나라도 있는데 `No reversal`을 표시하지 않는다.
- reversal journal을 `Settlement journal`로 표시하지 않는다.
- refund reversal clearing을 일반 `Payment clearing`으로 표시하지 않는다.
- reversal evidence가 완전하면 `Reversal evidenced` 또는 동등한 clear state를 사용한다.
- 불완전하면 `Reversal incomplete`와 missing evidence를 표시한다.
- `Ready for tax review`는 REVERSED record에 절대 표시하지 않는다.
- reversal reason, actor, time, original/reversal period, amount를 노출한다.

#### 1.4 API select와 type 보강

필요한 경우 detail/list API type에 다음을 추가한다.

- `reversalReason`
- `reversedById`와 안전한 operator identity
- canonical/reversal evidence aggregate
- journal sourceType과 integrity summary
- clearing type/status/amount/bank match aggregate
- original/reversal monthly period
- evidence checkedAt

민감한 operator/customer/partner 데이터는 필요 최소값만 내려라.

### 2단계 — 공통 서버 권위 `settlementAuditHealth`

정확한 타입명과 파일 위치는 현재 architecture에 맞춰 조정해도 되지만 의미를 축소하지 않는다.

```ts
type SettlementAuditState =
  | 'CLEAR'
  | 'ACTION_REQUIRED'
  | 'REVERSED_CLEAR'
  | 'UNKNOWN';

type SettlementAuditCheckState =
  | 'PASS'
  | 'FAIL'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

type SettlementAuditBlockerCode =
  | 'ALLOCATION_DELTA'
  | 'CANONICAL_JOURNAL_MISSING'
  | 'CANONICAL_JOURNAL_NOT_POSTED'
  | 'JOURNAL_HEADER_UNBALANCED'
  | 'JOURNAL_ENTRY_UNBALANCED'
  | 'JOURNAL_HEADER_ENTRY_MISMATCH'
  | 'RECONCILIATION_DELTA_ENTRY'
  | 'CANONICAL_CLEARING_MISSING'
  | 'CLEARING_AMOUNT_MISMATCH'
  | 'CLEARING_STILL_OPEN'
  | 'BANK_MATCH_INCOMPLETE'
  | 'PAYMENT_FEE_POLICY_MISSING'
  | 'COUPON_EVIDENCE_MISSING'
  | 'TAX_PERIOD_MISMATCH'
  | 'REVERSAL_JOURNAL_MISSING'
  | 'REVERSAL_CLEARING_MISSING'
  | 'REVERSAL_AMOUNT_MISMATCH'
  | 'REVERSAL_EVIDENCE_INCONSISTENT';

type SettlementAuditHealth = {
  state: SettlementAuditState;
  checkedAt: string;
  formulaVersion: string;
  blockers: Array<{
    code: SettlementAuditBlockerCode;
    severity: 'BLOCKER' | 'WARNING';
    amount?: number;
    ownerTeam: string;
    nextAction: string;
  }>;
  allocation: {
    customerPaymentAmount: number;
    companyCouponExpense: number;
    partnerPayoutAmount: number;
    partnerWithholdingTotal: number;
    platformFeeGross: number;
    delta: number;
  };
  checks: {
    allocation: SettlementAuditCheckState;
    canonicalJournal: SettlementAuditCheckState;
    canonicalClearing: SettlementAuditCheckState;
    bankMatch: SettlementAuditCheckState;
    taxPeriod: SettlementAuditCheckState;
    paymentFeePolicy: SettlementAuditCheckState;
    couponPolicy: SettlementAuditCheckState;
    reversal: SettlementAuditCheckState;
  };
  evidence: {
    canonicalJournal: EvidenceSummary;
    canonicalClearing: EvidenceSummary;
    reversal: EvidenceSummary;
  };
};
```

#### 2.1 판정 원칙

- 하나 이상의 required FAIL이 있으면 `ACTION_REQUIRED`.
- reversed record의 모든 reversal required check가 pass이면 `REVERSED_CLEAR`.
- 검사를 완료할 근거가 부족하면 `UNKNOWN`이며 green success를 금지한다.
- `CLEAR`는 모든 required check가 PASS이고 나머지가 명확히 NOT_APPLICABLE일 때만 허용한다.
- evidence record가 “존재”한다는 사실과 evidence “무결성이 clear”라는 판단을 구분한다.
- count가 1 이상이라는 이유만으로 `Evidence retained` success를 반환하지 않는다.
- warning과 blocker를 안정적인 code로 반환해 UI/CSV/test가 문자열 parsing에 의존하지 않게 한다.

#### 2.2 Journal integrity

canonical과 reversal journal 각각 최소 다음을 검사한다.

- required journal 존재
- expected sourceType
- status POSTED 여부
- header debit == header credit
- entry debit == entry credit
- header debit/credit == entry debit/credit aggregate
- posted batch entry 0건 여부
- `settlement_reconciliation_delta` account 존재 여부와 금액

`settlement_reconciliation_delta`는 journal을 기계적으로 balance시키는 explicit review account다. 이 entry가 있으면 header가 balanced여도 audit clear로 처리하지 않는다.

raw entries 전체를 list에 hydrate하지 말고 grouped aggregate 또는 SQL CTE/projection을 사용한다. N+1을 만들지 않는다.

#### 2.3 Clearing·bank integrity

- paymentMethod별 canonical clearing 필수 여부는 settlement service와 tests로 정의한다.
- customer wallet처럼 external clearing이 정책상 없으면 NOT_APPLICABLE로 표시하고 다른 ledger evidence를 확인한다.
- required clearing의 type, status, amount를 검사한다.
- OPEN/PARTIALLY_CLEARED를 무조건 clear로 처리하지 않는다.
- bank match가 필요한 method에서는 matched/unmatched amount와 match status를 검사한다.
- reversal clearing은 amount sign과 original payment/reversal amount를 검사한다.
- 화면에는 status뿐 아니라 matched amount, unmatched amount, age, latest match를 보여 줄 수 있는 aggregate를 제공한다.

#### 2.4 Tax·period integrity

- settlement monthlyPeriod와 tax/monthly closing relation을 검증한다.
- reversed record를 일반 tax open/declared queue로 되돌리지 않는다.
- tax workflow의 실제 소유권은 `Tax & Period Close`에 두고 이 화면은 evidence state와 deep link를 제공한다.
- policy가 불확실한 상태를 임의로 blocker 또는 clear로 만들지 않는다.

### 3단계 — Coupon-aware allocation formula

현재 UI 공식은 company coupon expense를 누락한다. 다음 서버 권위 공식을 사용하라.

```text
allocationDelta =
  customerPaymentAmount
  + companyCouponExpense
  - partnerPayoutAmount
  - partnerWithholdingTotal
  - platformFeeGross
```

필수 정상 fixture:

```text
customerPaymentAmount = 540,000
companyCouponExpense = 60,000
partnerPayoutAmount = 430,000
partnerWithholdingTotal = 42,000
platformFeeGross = 128,000
expected delta = 0
```

요구사항:

- coupon metadata parsing을 공용 서버 helper로 만든다.
- list/detail/export/closeout가 같은 formulaVersion과 inputs/delta를 사용한다.
- payment processing fee는 settlement journal에서 expense와 clearing에 대칭이므로 이 allocation 식에서 차감하지 않는다.
- General Ledger detail 등 다른 화면의 유사 formula와도 정의를 대조하고 모순이 있으면 동일 server helper로 통일한다.
- company-funded coupon만 현재 지원된다면 그 사실을 policy evidence로 명시한다.
- partner/platform-funded coupon이 서비스에서 아직 거부된다면 UI가 지원하는 것처럼 추측하지 않는다.
- coupon가 없으면 `No coupon applied` neutral이다.
- coupon가 있는데 code/funding/accounting/base/version evidence가 없으면 `Coupon evidence missing`이다.
- `reviewFlag`가 없다는 이유만으로 `Policy record OK` success를 표시하지 않는다.
- original coupon expense와 reversed coupon expense를 추적한다.

### 4단계 — Needs action / Resolved queue 재정의

현재 tax OPEN/DECLARED 또는 payment fee issue만 보는 정의를 폐기하거나 backward-compatible alias로 제한한다.

#### 4.1 권장 queue

```text
Integrity exceptions
├─ Allocation mismatch
├─ Journal evidence
├─ Clearing / bank evidence
├─ Reversal incomplete
├─ Tax / period evidence
├─ Payment fee policy
└─ Coupon evidence
```

최소 filter:

- `needs-action` 또는 기존 `open`: 모든 ACTION_REQUIRED와 운영자가 검토해야 하는 UNKNOWN
- `allocation-mismatch`
- `journal-evidence`
- `clearing-evidence`
- `reversal-incomplete`
- `tax-evidence`
- `payment-fee-evidence`
- `coupon-evidence`
- `resolved`: CLEAR + REVERSED_CLEAR
- `reversed`
- `all`

review query naming은 기존 URL 호환성을 고려하되 UI label은 운영자 용어로 바꾼다.

#### 4.2 Summary

최소 집계:

- actionRequiredCount
- unknownCount
- allocationMismatchCount
- journalEvidenceIssueCount
- clearingEvidenceIssueCount
- reversalIncompleteCount
- taxEvidenceIssueCount
- paymentFeeEvidenceIssueCount
- couponEvidenceIssueCount
- clearCount
- reversedClearCount
- oldestActionRequiredAt
- amountAtRisk 또는 명확하게 정의된 discrepancy amount

list, summary, card의 counts가 동일 health projection을 사용해야 한다.

#### 4.3 기본 범위

재무 unresolved queue는 posted date Today에 갇히면 안 된다.

권장 기본 URL:

```text
/finance-tax/booking-settlement-audit?range=all&review=open&sort=oldest&take=25
```

Today는 다음처럼 activity로 분리한다.

- Posted today
- Reversed today
- Cleared today

default Today를 꼭 유지해야 할 제품 정책이 있다면 다음을 반드시 제공한다.

- `200 older records still need action`
- oldest age
- `View all backlog` CTA

### 5단계 — All records, search, period, sort, filter

#### 5.1 All records

현재 문제:

- `bookingSettlementAuditHref()`는 review=all을 생략한다.
- parser는 누락 review를 open으로 해석한다.

수정:

- explicit All은 URL에 `review=all`을 유지한다.
- direct route 기본값과 explicit All을 구분한다.
- reload, pagination, payment method, period, range, rows, search 변경 후에도 All이 유지된다.
- 다른 settlement/coupon/reversal page의 all serialization 회귀를 검사한다.
- href → parser → active chip → list API → summary API 통합 테스트를 추가한다.

#### 5.2 Search

현재 placeholder는 customer/partner 이름을 약속하지만 API는 profile ID만 검색한다.

다음 중 하나를 완료한다.

1. 권장: customer fullName과 partner displayName/fullName을 검색한다.
2. 안전한 최소 수정: placeholder를 실제 범위인 `Booking, payment, settlement, customer ID or partner ID`로 바꾼다.

추가 요구:

- exact snapshot/booking/payment/customer/provider ID를 contains보다 우선한다.
- exact settlement ID는 직접 detail 또는 최상단 exact result를 제공한다.
- 이름 검색을 구현할 때 phone 원문까지 일반 검색하지 않는다.
- query를 모든 relation에 N+1로 적용하지 않는다.
- active chip `Search: {query} ×`를 표시한다.
- `Clear search`와 `Reset all`을 분리한다.

#### 5.3 Accounting period

현재 period query가 외부에서 들어온 경우만 period UI가 보인다.

- 항상 보이는 `Accounting period` picker를 제공한다.
- `All periods`를 선택할 수 있다.
- `Posted date` range와 `Accounting period`를 다른 label로 명확히 구분한다.
- Tax overview에서 들어온 period를 보존하면서 이 화면에서 변경할 수 있게 한다.
- period는 exact equality query를 사용한다.

#### 5.4 Sort

최소 제공:

- Oldest blocker
- Largest discrepancy/risk amount
- Newest posted
- Oldest posted

action queue 기본은 oldest blocker다. sort는 URL, pagination, detail returnTo, export에 보존한다.

#### 5.5 1440px filter toolbar

현재 payment method, range, queue, rows가 각각 큰 full-width box라 첫 row가 y≈1612에 있다.

1440px에서 다음 2행 이내로 줄인다.

1. Search · Queue · Accounting period/Posted date · Sort · Reset
2. Payment method · Advanced filters · Rows · active chips

- rows는 select 또는 compact segmented control을 사용한다.
- 기본값 active chips는 반복하지 않고 변경된 조건만 보여 준다.
- table header와 첫 결과 행이 1440×900 초기 viewport 안에 보여야 한다.
- 모바일 대응은 하지 않는다.

### 6단계 — 목록 화면 재구성

#### 6.1 Command board

권장 card/metric:

1. Integrity blockers
2. Amount at risk
3. Oldest blocker / SLA
4. Unassigned

Today activity가 필요하면 별도 compact strip으로 둔다.

규칙:

- scope를 `Backlog · All dates`처럼 명시한다.
- 0/0은 green 0%가 아니라 `No records in scope` neutral이다.
- 검색과 독립인 overview라면 `All records in scope`라고 명시한다.
- count, amount, oldest age, owner를 우선한다.
- payment fee만 별도 대형 card로 두기보다 blocker breakdown으로 보여 준다.

#### 6.2 Table

권장 열:

1. Record: settlement ID, booking, period, posted time
2. Parties: customer/partner profile links
3. Allocation: customer paid + coupon, payout, withholding, platform fee gross
4. Evidence: canonical journal, canonical clearing/bank, reversal
5. Highest blocker: code, amount, age, additional blocker count
6. Owner / next action
7. Review

수정 기준:

- settlement record title을 primary link 하나로 만든다.
- booking link와 `Open detail` 중복 interaction을 정리한다.
- Customer와 Partner 모두 profile link를 제공한다.
- `Processing`은 `Processor fee · HANDS expense`로 명확히 한다.
- 금액은 우측 정렬하고 VND 숫자 비교가 쉽도록 한다.
- `Tax Open`, `Policy missing`뿐 아니라 실제 highest audit blocker를 표시한다.
- row에서 전체 blocker를 다 펼치지 않고 `Primary blocker + N more`를 사용한다.
- age와 owner/assignment를 표시한다. assignment 인프라가 없다면 owner team과 unassigned를 먼저 제공하고 임의 workflow mutation을 만들지 않는다.
- raw enum은 human-readable label로 바꾼다.
- 긴 source key를 기본 행에 그대로 노출하지 않는다.

#### 6.3 Empty/error state

다음을 구분한다.

- Today 0건: `No settlements posted today` + backlog CTA
- true empty: `No settlement records in this scope`
- search 0건: query + Clear search + Reset filters
- API failure: Retry + reference/status
- permission denied
- audit health unknown

### 7단계 — 상세 화면 재구성

#### 7.1 첫 viewport: Audit decision strip

큰 중복 metric card보다 다음을 먼저 보여 준다.

- Overall state: Clear / Action required / Reversed clear / Unknown
- Highest blocker
- blocker count
- checkedAt
- owner team/assignee
- age
- next action/deep link

green success는 overall health가 CLEAR 또는 REVERSED_CLEAR일 때만 사용한다.

#### 7.2 Record identity

- snapshot ID
- booking/payment/customer/partner links
- settlement/tax status human label
- payment method
- monthly period
- posted/closed/reversed time
- reversal reason/actor
- full ID copy action

Customer도 profile link를 제공한다.

#### 7.3 Allocation equation

화면에 다음 식을 운영자 문장으로 보여 준다.

```text
Customer paid + HANDS coupon expense
= Partner payout + withheld tax + platform fee gross
```

표시 값:

- each input
- expected left/right total
- delta
- formulaVersion
- check state

payment processing fee는 `HANDS processor cost` 별도 evidence로 둔다.

#### 7.4 Canonical settlement evidence

- canonical journal
- journal header/entry integrity
- reconciliation delta entry
- canonical clearing
- bank match/matched/unmatched amount
- type/status/occurredAt
- `View journal`, `View clearing`, `View bank evidence`

#### 7.5 Reversal evidence

- reversal lifecycle type
- reason/actor/time
- reversal journal
- refund clearing
- amount sign/check
- original/reversal periods
- completeness result

reversal이 없으면 이 section을 `No reversal recorded` neutral로 축약하되 reversal signal이 있을 때 절대 숨기지 않는다.

#### 7.6 Tax/payment fee/coupon evidence

- Tax state와 linked monthly close
- Payment fee policy name/version/method/payer/treatment/result
- Coupon no-applied / complete / missing / reversed 상태
- raw enum은 technical disclosure에 보존

`HANDS / OPERATING_EXPENSE` 대신 `Paid by HANDS · Operating expense`를 기본 문구로 사용한다.

#### 7.7 문구 붙음·긴 ID

현재 다음처럼 붙어 보이는 문제를 수정한다.

```text
Journal POSTEDDebit 500.000 VND
Clearing OPENCUSTOMER_PAYMENT_CAPTURED
BalancedDelta 0 VND
```

- label/value/detail/source를 block 또는 명확한 inline separator로 나눈다.
- `min-width:0`과 의미 단위 wrapping을 사용한다.
- account/source key를 문자 단위로 무작정 자르지 않는다.
- short ID + copy full ID를 사용한다.

### 8단계 — Detail return context

- list detail link에 현재 상대 URL을 `returnTo`로 전달한다.
- `/finance-tax/booking-settlement-audit` 내부 URL만 허용하는 `safeBookingSettlementAuditReturnTo()`를 구현한다.
- 외부 URL, `//`, backslash, 유사 prefix를 거절한다.
- q, range, review, paymentMethod, period, page, take, sort, advanced filters를 보존한다.
- action 문구는 `Back to results`로 바꾼다.
- 가능하면 이전 row/heading focus와 scroll을 복원한다.
- payment clearing/bank reconciliation의 검증된 safe returnTo pattern을 재사용한다.

### 9단계 — API 실패와 데이터 freshness

목록, summary, detail, export에서 `adminGet()`의 fallback만 사용하지 않는다.

- `adminGetResult` 또는 동등한 result contract를 사용한다.
- 404만 실제 not found로 처리한다.
- 401/403은 permission state다.
- 5xx/network/timeout은 `Settlement data could not be loaded` + Retry다.
- summary 하나만 실패하면 성공한 table까지 숨기지 않는다.
- true zero와 unavailable을 구분한다.
- 성공 데이터에 `checkedAt` 또는 `retrievedAt`을 표시한다.
- stale data를 current green으로 표시하지 않는다.
- detail upstream failure를 `notFound()`로 바꾸지 않는다.
- export failure를 200 empty CSV로 바꾸지 않는다.

### 10단계 — Export scope, PII, auditability

현재 export는 `page/take`를 그대로 적용해 240건 중 현재 25건만 내보내며 label은 이를 말하지 않는다. 또한 customer/partner phone 원문을 포함한다.

#### 10.1 UI

- label: `Export filtered results`
- 예상 row count 표시: `240 rows`
- current page export가 별도로 필요하면 `Export current page · 25 rows`라고 명시한다.
- 대량 export 상태/progress/error를 보여 준다.

#### 10.2 Server

- 전체 filtered result를 export한다.
- small bounded result는 cursor/page loop, large result는 existing async export/job pattern을 사용한다.
- 최대 rows, timeout, expiration을 명시한다.
- API failure는 non-2xx로 반환한다.
- partial/truncated export를 성공 전체 파일처럼 제공하지 않는다.

#### 10.3 CSV fields

최소 포함:

- generatedAt, timezone, generatedBy
- active filters, sort, total rows
- snapshot/booking/payment/customer/provider IDs
- participant display names
- monthlyPeriod, postedAt, closed/reversedAt
- paymentMethod, currency
- allocation inputs, expected totals, delta, formulaVersion
- canonical journal/clearing IDs와 states
- reversal type/journal/clearing와 state
- tax/payment fee/coupon evidence states
- audit state, blocker codes, checkedAt

#### 10.4 PII

- 기본 export에서 customer_phone과 partner_phone 원문을 제거하거나 mask한다.
- 원문 phone export가 정말 필요하면 export-specific permission, purpose/reason, audit log를 요구한다.
- generic admin access만으로 원문 PII를 내려 주지 않는다.
- PII 정책 결정이 필요한 경우 임의로 확대하지 말고 안전한 기본값과 명시적 blocker를 보고한다.

### 11단계 — Action menu 접근성

현재 native `details/summary + role=menu`는 Escape로 닫히지 않는다.

- 기존 공용 ActionMenu 또는 keyboard-complete dropdown을 재사용한다.
- Escape로 닫힌다.
- ArrowUp/ArrowDown/Home/End로 탐색된다.
- outside click으로 닫힌다.
- trigger에 `aria-expanded`, menu 관계가 있다.
- 닫힌 후 focus가 trigger로 돌아간다.
- Export와 Related finance workflows를 분리한다.
- sidebar와 중복되는 관련 finance 링크는 현재 업무의 다음 단계 4~6개로 줄인다.
- 공용 component를 수정하면 사용하는 다른 finance 페이지의 regression test를 실행한다.

### 12단계 — 1440px Operate UI 품질

이 화면은 marketing page가 아니라 재무 운영 도구다. 브랜드 장식보다 scanability와 판단 속도를 우선한다.

- 기존 색상, typography, radius, spacing token을 유지한다.
- 새로운 gradient, 과도한 shadow, 장식용 hero를 추가하지 않는다.
- 첫 viewport에 decision, compact filters, table header, 첫 row를 배치한다.
- status color 수를 제한하고 동일 의미에 동일 tone을 사용한다.
- Clear/Action required/Reversed/Unknown을 색상+icon+text로 표현한다.
- 카드 내부의 긴 helper copy를 줄이고 tooltip/disclosure로 이동한다.
- table row 높이를 불필요하게 키우지 않는다.
- amount와 status를 빠르게 비교할 수 있는 column alignment를 유지한다.
- no coupon, not applicable, not checked를 성공 green과 구분한다.
- 기존 incumbent admin design system을 세련되게 정리하되 새 visual world를 만들지 않는다.

### 13단계 — Runtime asset 안정성

감사 시작 시 stale CSS chunk 404가 있었고 server restart 후 두 chunk 모두 200으로 복구됐다. page 코드와 무관한 broad deployment refactor를 이번 작업에 억지로 포함하지 말라.

다만 범위 안에서 가능한 최소 검증은 추가한다.

- admin smoke/readiness가 HTML의 필수 CSS/JS chunk 200을 확인하는 기존 pattern이 있는지 조사한다.
- 이미 적합한 infra smoke 위치가 있다면 최소 check를 추가한다.
- 없고 별도 배포 설계가 필요하면 이번 page 구현을 지연시키지 말고 명시적 follow-up으로 보고한다.
- 애플리케이션 UI P0와 섞어 처리하지 않는다.

## 필수 테스트

기존 테스트를 보존하고 아래 회귀 테스트를 추가하라.

### API / audit health

- canonical settlement journal을 sourceType으로 선택
- reversal journal을 canonical로 오인하지 않음
- canonical clearing과 REFUND_REVERSAL clearing 분리
- open-period reversed snapshot without reversalEntries 지원
- closed-period BookingSettlementReversalEntry 지원
- reversed snapshot + reversal journal + refund clearing → REVERSED_CLEAR
- reversed snapshot missing reversal journal/clearing → ACTION_REQUIRED
- reversed record next action이 tax review가 아님
- journal header unbalanced
- journal entries unbalanced
- header-entry mismatch
- posted journal without entries
- reconciliation delta account 존재
- paymentMethod별 clearing required/not applicable
- clearing amount/status mismatch
- bank match incomplete
- company coupon allocation 540k + 60k - 430k - 42k - 128k = 0
- payment processing fee가 allocation delta에 포함되지 않음
- coupon 없음 → neutral/not applicable
- coupon 적용 + policy snapshot 없음 → blocker
- Needs action summary가 health blocker를 포함
- Resolved가 모든 required checks clear일 때만 포함
- list/summary/detail/export가 같은 health helper 사용
- list aggregate가 N+1을 만들지 않음

### Admin Web / routing / UI

- direct route default queue
- explicit All records URL에 `review=all`
- All records reload 유지
- payment method/period/range/rows/search/pagination 후 All 유지
- customer/partner name search 또는 정확한 placeholder contract
- period picker URL round-trip
- sort URL round-trip
- default backlog 또는 Today empty의 backlog CTA
- 0/0 resolved neutral state
- highest blocker + N more row rendering
- reversed detail에서 `No reversal` 금지
- reversed detail에서 `Ready for tax review` 금지
- canonical/reversal evidence section 분리
- company coupon allocation formula rendering
- no coupon `No coupon applied`
- API failure vs true empty
- detail 404 vs upstream failure
- safe returnTo allowlist와 full context 복원
- export filtered total vs current page
- export failure non-2xx
- default export phone 원문 제외 또는 permission gate
- export audit log
- Escape/Arrow menu keyboard behavior
- unique table aria-label
- 1440px first-row visual regression 또는 layout assertion

### Existing targeted commands

현재 package scripts와 변경 범위를 확인해 정확한 명령을 사용하되 최소 다음을 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- `
  "app/finance-tax/booking-settlement-audit/page.spec.tsx" `
  "app/finance-tax/booking-settlement-audit/[id]/page.spec.tsx" `
  "app/finance-tax/finance-list-pages.spec.tsx" `
  "app/finance-tax/finance-detail-pages.spec.tsx" `
  "app/finance-tax/tax-settlement-page-model.spec.ts" `
  "app/api/admin/finance-tax/booking-settlement-audit/export/route.spec.ts" `
  "app/finance-tax/tax-finance-workflow-actions.spec.tsx"
```

```powershell
npm.cmd run test --workspace @massage-vn/api -- `
  src/admin/admin.service.spec.ts -t "booking settlement"
```

변경한 settlement/journal/coupon helper spec도 포함한다.

```powershell
npm.cmd run test --workspace @massage-vn/api -- `
  src/settlements/settlement-journal.spec.ts `
  src/settlements/settlements.service.spec.ts `
  src/settlements/coupon-settlement.spec.ts
```

최소 quality checks:

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

Prisma schema/migration이나 보호 영역을 변경했다면 `AGENTS.md`의 full local verification 요구를 따른다. unrelated 기존 실패는 숨기지 말고 이번 변경과 관계를 구분해 보고한다.

## 1440px 실제 화면 검증

로그인된 in-app browser를 우선 사용한다. 1440×900 이상에서 다음 상태를 실제로 확인하고 before/after screenshot을 저장한다.

1. 기본 Integrity exceptions/backlog
2. All records 선택과 reload 유지
3. command board scope, oldest age, risk count
4. compact filter toolbar와 first row initial viewport
5. customer/partner name 또는 정확한 ID search
6. search 0건 recovery
7. accounting period와 sort
8. 정상 settlement detail decision strip
9. `cmr3a1evw0nw8vyjg3le5j4cx` reversed detail
10. canonical settlement evidence
11. reversal evidence
12. coupon 없는 neutral state
13. company coupon fixture는 unit/integration fixture 또는 안전한 read-only test harness로 검증
14. detail → Back to results full context 복원
15. API error UI는 safe mock/test harness로 검증
16. Export filtered result row count와 error state
17. Export/Related finance menu keyboard behavior

실제 금전 mutation은 실행하지 않는다. screenshot만 보고 끝내지 말고 DOM, URL, accessible state, link target, result count, text, keyboard behavior를 함께 검증한다.

검증 목표:

- 1440×900 초기 viewport에 table header와 첫 결과 row가 보인다.
- document horizontal overflow가 없다.
- source key와 label/value가 붙지 않는다.
- raw ID가 문자 단위로 깨지지 않는다.
- status를 색상 없이도 이해할 수 있다.
- 1024px 이하 screenshot이나 보고는 만들지 않는다.

## 완료 수용 기준

아래 항목을 모두 충족해야 완료다.

- [ ] canonical settlement journal과 reversal journal이 sourceType으로 구분된다.
- [ ] canonical clearing과 REFUND_REVERSAL clearing이 type으로 구분된다.
- [ ] open-period legacy reversal과 closed-period reversal entry를 모두 지원한다.
- [ ] `cmr3a1evw0nw8vyjg3le5j4cx`에서 `Evidence retained / 0 reversal / No reversal / Ready for tax review` 모순이 없다.
- [ ] 현재 reversed 40건이 구체적인 Reversal clear/incomplete 상태로 분류된다.
- [ ] list, summary, detail, reversal, closeout, CSV가 같은 audit health를 사용한다.
- [ ] required evidence가 unknown/missing이면 green clear가 없다.
- [ ] journal missing/unbalanced/header-entry/reconciliation delta가 Needs action에 포함된다.
- [ ] clearing/bank/coupon/reversal/period evidence 문제가 Needs action에 포함된다.
- [ ] company coupon fixture의 allocation delta가 0이다.
- [ ] payment processing fee는 allocation 식에서 차감되지 않는다.
- [ ] no coupon은 neutral `No coupon applied`다.
- [ ] default action 화면에서 all-date backlog와 oldest age를 확인할 수 있다.
- [ ] All records가 explicit `review=all`이고 reload 후 유지된다.
- [ ] 검색 안내와 실제 검색 범위가 일치한다.
- [ ] accounting period를 이 화면에서 직접 설정할 수 있다.
- [ ] detail Back to results가 모든 목록 문맥을 복원한다.
- [ ] API failure가 0건, 404, green success, empty CSV로 보이지 않는다.
- [ ] export가 전체 filtered result를 정확히 내보내며 row count를 사전에 표시한다.
- [ ] 기본 export에서 phone 원문을 제외하거나 export-specific permission/audit log를 요구한다.
- [ ] Export menu가 Escape/Arrow key와 focus return을 지원한다.
- [ ] 1440×900 첫 viewport에 table header와 첫 row가 보인다.
- [ ] 1024px 이하 작업을 하지 않았다.
- [ ] targeted tests, typecheck, scope verification 결과를 기록했다.
- [ ] 사용자 기존 변경과 회계 원본을 손실시키지 않았다.

## 구현 범위를 관리하는 방법

이번 작업이 커질 수 있으므로 다음 순서로 안전하게 완결한다.

1. **Release 1 — 필수:** reversal classifier, audit health, coupon-aware formula, success 제한, 관련 API/UI/tests.
2. **Release 2 — 필수:** backlog 기본 범위, All records, period/search/sort, API error, returnTo.
3. **Release 3 — 필수:** export scope/PII/audit, compact 1440 layout, keyboard menu.

각 release는 테스트 가능한 상태로 유지하라. 그러나 P0만 구현하고 P1/P2를 임의로 남긴 뒤 전체 완료라고 말하지 말라. 같은 Codex 작업에서 안전하게 수행 가능한 범위는 계속 진행한다. 정책 승인이나 권한 결정이 실제 blocker라면 해당 항목만 정확히 blocked로 보고하고 나머지는 완료한다.

## 완료 보고 형식

최종 답변은 결과부터 간결하게 보고한다.

1. 전체 구현 결과와 운영자 관점 변화
2. P0/P1/P2별 완료 항목
3. 변경 파일 목록과 각 파일 역할
4. `settlementAuditHealth` 계약과 판정 규칙
5. reversal 호환 방식과 기존 40건 검증 결과
6. coupon-aware allocation formula와 테스트 결과
7. queue/필터/search/period/returnTo/export 변경
8. 1440px before/after screenshot 링크
9. 실행한 명령과 pass/fail/skipped 수
10. API/schema/migration/permission 변경 여부
11. 기존 회계 데이터를 자동 수정하지 않았음을 명시
12. 보호한 사용자 변경
13. 남은 정책 결정 또는 위험
14. 다음 권장 작업

완료하지 못한 항목을 완료했다고 표현하지 말라. blocker, 확인한 증거, 안전한 다음 조치를 정확히 적는다.

---

## 가장 중요한 성공 조건

이번 작업은 카드가 더 예쁘거나 문구가 조금 정리된 것으로 성공하지 않는다.

**환불된 정산의 실제 reversal journal과 refund clearing이 canonical settlement evidence로 잘못 표시되지 않고, `No reversal` 또는 `Ready for tax review`라는 모순이 사라지며, list·summary·detail·closeout·CSV가 동일한 서버 권위 audit health로 운영자에게 정확한 다음 행동을 제공해야 성공이다.**
