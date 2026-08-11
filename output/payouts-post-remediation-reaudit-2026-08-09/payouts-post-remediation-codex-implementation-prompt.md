# HANDS Admin Partner Payouts 최종 개선 구현 프롬프트

아래 `BEGIN PROMPT`부터 `END PROMPT`까지를 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## BEGIN PROMPT

당신은 `C:\dev\massage-on-demand-vn` 저장소에서 HANDS Admin의 Partner Payouts 운영 화면을 실제로 수정하고 검증하는 선임 풀스택 엔지니어이자 재무 운영 UX 설계자다.

이번 작업은 단순한 시각적 polish가 아니다. 운영자가 다음 세 업무를 빠르고 안전하게 완료할 수 있도록 정보구조, 서버 상태 계약, 작업표, 편집기, 확인창, 접근성, 성능을 함께 개선해야 한다.

1. 송금 전 payout batch 검토와 처리
2. Partner wallet withdrawal 상태 처리
3. 지급 후 bank/wallet/GL 증빙 reconciliation과 repair

코드 일부만 수정하고 나머지를 제안으로 남기지 말고, 범위 안에서 안전하게 구현 가능한 항목은 코드·테스트·실화면 검증까지 완료하라.

## 1. 반드시 먼저 읽을 자료

작업을 시작하기 전에 다음 파일을 순서대로 읽고 현재 코드와 대조하라.

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\output\payouts-post-remediation-reaudit-2026-08-09\payouts-post-remediation-reaudit-report.md`
3. `C:\dev\massage-on-demand-vn\output\payouts-audit-2026-08-09\payouts-deep-audit-report.md`
4. `C:\dev\massage-on-demand-vn\output\payouts-audit-2026-08-09\payouts-improvement-codex-prompt.md`

재감사 증거 스크린샷은 다음 폴더에 있다.

`C:\dev\massage-on-demand-vn\output\payouts-post-remediation-reaudit-2026-08-09`

현재 구현을 먼저 검사하고 이미 올바르게 구현된 기능은 유지하라. 기존 수정사항을 되돌리거나 처음부터 전면 재작성하지 마라.

## 2. 작업 환경과 검사 범위

- 저장소: `C:\dev\massage-on-demand-vn`
- 대상 URL: `http://localhost:3101/payouts`
- 검사 기준: **1440 × 900 데스크톱만**
- 운영 환경: 실제 운영자는 1440px 이상 화면만 사용한다.
- **1024px 이하 반응형·모바일·태블릿은 구현·테스트·보고 범위에서 완전히 제외하라.**
- 로그인된 인앱 브라우저가 있으면 기존 세션을 사용하라.
- 관련 없는 Admin 페이지, 전역 navigation, 모바일 앱을 수정하지 마라.
- 작업 시작 시 `git status --short`로 사용자 변경을 확인하고 관련 없는 변경을 보존하라.
- 이번 작업과 관련 없는 파일을 포맷하거나 정리하지 마라.

## 3. 현재 재감사 판정

현재 상태는 **조건부 통과 3.0/5.0**이다.

이미 확인된 개선 사항:

- `Payout batches / Withdrawals / Reconciliation` 상위 view 분리
- payout/withdrawal summary 실패를 0 또는 empty로 숨기지 않는 fail-closed UI
- 선택 범위가 일치하는 payout money-flow 집계
- 선택 필터 0건과 global bank-match backlog 분리
- 반복 reversal row form 제거
- 단일 reversal `alertdialog`
- 검색, 정렬, 서버 페이지네이션
- dark theme
- payout 프론트 테스트 109개 통과
- 관련 API 테스트 655개 통과
- Admin Web/API typecheck 통과

이 기능과 안전장치는 회귀시키지 마라.

## 4. 핵심 문제 정의

### 문제 A. Reconciliation이 다시 두 작업목록을 한 화면에 합친다

현재 `view=reconciliation`은 다음을 모두 동시에 렌더링한다.

- money-flow
- paid withdrawal / bank match pending 20행
- payout closeout repair 20행

재감사 실측:

- document height: 19,928px
- DOM node: 2,404개
- links: 168개
- tables: 47개
- forms: 2개

뷰를 분리했지만 Reconciliation에서 복잡도를 다시 합친 상태다.

### 문제 B. Review transfer 편집기가 보이지 않는 곳에 열린다

Reconciliation payout repair row에서 `Review transfer`를 누르면:

- URL에는 `editPayoutBatchId`가 추가된다.
- 브라우저 scrollY는 0으로 돌아간다.
- editor heading은 page top에서 약 8,005px 아래에 있다.
- `withdrawalReconciliation=unmatched` 같은 무관한 query도 남는다.

운영자는 클릭이 실패한 것으로 인식한다.

### 문제 C. 1440px에서도 주요 Actions가 가려진다

- Admin content/table viewport는 약 1,050px다.
- payout batch table에는 `min-width: 1380px` 규칙이 존재한다.
- withdrawal table은 `min-width: 1280px`다.
- Batch ID, phone, status detail이 단어 또는 문자 단위로 줄바꿈된다.
- primary action은 오른쪽 가로 스크롤 뒤에 있다.

### 문제 D. PAID reversal에 지급 전 blocker가 노출된다

현재 server preflight는 PAID에도 release blocker 배열을 계산할 수 있다.

예:

- `PAYOUT_STATUS_NOT_PAYABLE`: `PAID cannot advance to paid`
- `WALLET_BALANCE_INSUFFICIENT`: `wallet balance cannot cover this payout batch`

`riskModel.reconciliationFindings`는 이를 분리하지만, 프론트 `payoutActionDisabledReason(..., 'reverse')`는 `preflight.blockers` 전체를 재사용한다. 따라서 reversal 불가 이유로 지급 전 문구가 노출된다.

### 문제 E. 서로 다른 증빙 계층을 모두 Evidence라고 부른다

- Money flow의 `Evidence complete`는 linked earning roll-up completeness다.
- `Post-payment repair 154`는 transfer reference, withholding, wallet ledger, posted GL journal closeout evidence다.

두 수치는 동시에 참일 수 있지만 같은 `evidence` 용어를 사용해 모순처럼 보인다.

### 문제 F. 확인창과 focus lifecycle이 부족하다

- Processing confirmation은 short batch ID와 일반 설명 중심이다.
- Partner, amount, bank, ref, risk, maker/approver 정보가 부족하다.
- reversal/processing dialog를 닫은 뒤 focus가 trigger가 아니라 `BODY`로 이동한다.

## 5. 구현 원칙

### 운영자 관점

- 한 화면에는 한 가지 운영 질문만 둔다.
- 숫자는 반드시 범위, 데이터 원천, 작업 가능 여부를 함께 설명한다.
- 지급 전 release 판단과 지급 후 reconciliation 판단을 섞지 않는다.
- 기본 화면은 history가 아니라 지금 처리할 open work를 우선한다.
- 주요 action은 1440px 첫 viewport와 표의 초기 가로 위치에서 보여야 한다.
- 상세 증빙은 필요할 때 drawer/dialog에서 연다.

### 코드 관점

- 기존 디자인 토큰과 공용 Admin component를 재사용한다.
- 새 table/UI/state management library를 추가하지 않는다.
- URL query를 재현 가능한 view/filter 상태의 source of truth로 유지한다.
- 서버가 action 가능 여부를 최종 판정한다.
- UI 계산값을 API가 신뢰하게 만들지 않는다.
- API failure를 empty array, null summary, 0 또는 Clear로 숨기지 않는다.
- N+1 query를 추가하지 않는다.
- 먼저 단순한 view/data 분리로 DOM을 줄이고, 필요성이 입증되지 않은 virtualization/cache abstraction은 추가하지 않는다.

## 6. P1 구현 요구사항

다음 P1 항목은 모두 완료해야 한다.

### P1-1. Reconciliation 하위 작업공간 분리

`/payouts?view=reconciliation` 내부에 두 번째 수준 segmented control을 추가하라.

권장 canonical URL:

```text
/payouts?view=reconciliation&recon=overview
/payouts?view=reconciliation&recon=bank-unmatched
/payouts?view=reconciliation&recon=payout-closeout-repair
```

기존 query와 충돌하지 않는 다른 이름을 선택할 수 있지만, 하나의 canonical query로 정규화하고 테스트하라.

#### Overview

표시:

- selected-range earning linkage summary
- bank unmatched global backlog count
- payout wallet/GL closeout repair count
- 각 backlog의 total amount exposure
- oldest age
- owner/SLA는 실제 모델과 정책이 있을 때만
- 각 작업 queue로 이동하는 명확한 CTA

제외:

- withdrawal row list
- payout repair row list
- row별 accounting preview

#### Bank unmatched

- paid withdrawal / bank match pending rows만 fetch/render한다.
- payout batch repair rows를 fetch하지 않는다.
- money-flow 전체 panel은 반복하지 말고 compact context만 제공한다.

#### Payout closeout repair

- post-payment payout repair rows만 fetch/render한다.
- withdrawal rows를 fetch하지 않는다.
- `Review transfer` 대신 PAID에서는 `Repair transfer evidence`를 사용한다.

#### 데이터 로딩 완료 기준

- 선택하지 않은 하위 queue의 row API는 호출하지 않는다.
- 선택하지 않은 dataset은 DOM에 렌더링하지 않는다.
- Overview에서는 aggregate endpoint만 사용한다.
- legacy `queue=repair`, `view=audit`, `workspace=audit` bookmark는 안전하게 새 canonical URL로 normalize 또는 redirect한다.
- Batches/Withdrawals 기존 bookmark도 깨뜨리지 않는다.

### P1-2. Action-specific server availability 계약

generic preflight blocker 배열을 모든 action에 재사용하지 마라.

API 응답에 다음과 유사한 action-specific contract를 추가하라. 실제 기존 type 구조에 맞게 이름은 조정할 수 있다.

```ts
type FinanceActionAvailability = {
  allowed: boolean;
  blockers: Array<{
    code: string;
    message: string;
  }>;
};

type PayoutActionAvailability = {
  startProcessing: FinanceActionAvailability;
  markPaid: FinanceActionAvailability;
  markFailed: FinanceActionAvailability;
  reversePaid: FinanceActionAvailability;
};
```

`reversePaid.blockers`에는 reversal과 직접 관련된 사유만 허용한다.

- paid wallet ledger/journal missing 또는 mismatch
- 이미 reversed
- separate Finance approver 없음
- posting period closed/finalized
- 필요한 bank return/reversal evidence 없음
- 대상 상태가 PAID가 아님

다음 지급 전 코드는 PAID reversal blocker 문구에 포함되면 안 된다.

- `PAYOUT_STATUS_NOT_PAYABLE`
- `WALLET_BALANCE_INSUFFICIENT`
- 지급 전 transfer reference requirement
- 지급 전 payable earning total check

요구사항:

- 프론트는 action-specific availability만 사용한다.
- API action 실행 시 live record로 같은 조건을 다시 계산한다.
- direct query로 confirmation을 열어도 서버가 차단한 action은 submit 불가다.
- maker-checker, Finance approver role, journal/evidence requirement를 완화하지 않는다.
- 테스트에서 PAID reversal message에 pre-release blocker가 없음을 검증한다.

### P1-3. 증빙 도메인 명칭과 상태 분리

화면과 타입에서 다음 두 계층을 명확히 구분하라.

#### Earning linkage

- payout batch와 linked earnings roll-up의 completeness/net match
- money-flow는 이 계층만 평가한다.

권장 문구:

- `Evidence net` → `Linked earnings net`
- `Evidence completeness` → `Earning linkage coverage`
- `COMPLETE` → `159/159 earnings linked`처럼 실제 count 기반 문구
- money-flow 설명: `This check does not validate wallet-ledger or GL posting.`

#### Wallet / GL closeout

- transfer reference
- withholding evidence
- provider wallet ledger posting
- posted GL journal

권장 문구:

- `Post-payment repair` → `Wallet / GL closeout repair`
- helper: `Paid batches missing transfer, withholding, wallet-ledger, or posted GL evidence.`
- `Blocking reasons` → PAID에서는 `Reconciliation findings`

요구사항:

- `Clear`, `Matched`, `Complete`를 두 계층 사이에서 공유하지 않는다.
- earning linkage가 complete여도 wallet/GL repair가 존재할 수 있음을 Overview에서 한 문장으로 설명한다.
- API/type 이름도 가능하면 `evidence` 단독 이름보다 구체적 domain 이름을 사용한다.
- `2 check(s)`는 `2 controls evaluated` 또는 실제 issue 결과로 변경한다.

### P1-4. Legacy backfill과 신규 anomaly 구분

현재 154 repair는 서버의 실제 predicate 결과다. 이를 단순 오집계로 제거하지 마라.

현재 predicate는 PAID batch에서 다음을 검사한다.

- transfer reference
- withholding evidence
- wallet ledger amount = `-totalNetAmount`
- posted GL journal debit/credit = payout amount

다만 오래된 PAID record가 신규 wallet/GL closeout 계약 도입 이전 데이터일 수 있다.

요구사항:

- 저장소에 실제 migration cutoff, schema version, journal rollout 근거가 있는지 조사한다.
- 근거가 있을 때만 `Legacy backfill required`와 `Current transaction anomaly`를 분류한다.
- 근거가 없으면 날짜를 임의로 만들지 마라.
- 근거가 없는 경우 UI에는 `Origin not classified` 또는 구체적인 missing evidence kind를 표시하고, 최종 보고서에 필요한 migration decision을 남긴다.
- 실제 payout, ledger, journal 데이터를 자동 수정하거나 backfill하지 마라.
- data repair가 필요하면 별도 migration/ops plan으로 보고한다.

### P1-5. 1440px compact payout batch table

Admin content 폭 약 1,050px에서 주요 정보를 가로 스크롤 없이 비교할 수 있도록 table을 재구성하라.

권장 열:

| 열 | 내용 |
|---|---|
| Partner / Batch | Partner name·phone, short batch ID, copy/open |
| Amount | net amount, withholding 보조 |
| Stage | Review / Processing / Paid / Repair |
| Primary issue | 가장 중요한 release blocker 또는 reconciliation finding 한 개 |
| Transfer evidence | ref, bank, evidence state |
| Action | primary action 한 개 + More |

요구사항:

- 1440 × 900에서 primary action이 초기 가로 위치에 보여야 한다.
- Actions를 숨기는 1,280~1,380px 강제 min-width 사용을 제거하거나 구조를 바꾼다.
- Batch ID와 phone을 문자 단위로 줄바꿈하지 않는다.
- ID/ref는 한 줄 ellipsis + accessible full value + copy control을 제공한다.
- 기본 row height 80~112px, 최대 128px를 목표로 한다.
- 긴 finding 원문은 badge/한 줄 요약 + `View details` drawer로 이동한다.
- open batch는 `Review transfer`, PAID repair는 `Repair transfer evidence`로 구분한다.
- aria-label은 `Release checks for …`와 `Reconciliation findings for …`로 phase에 따라 분기한다.
- Action 열은 필요하면 sticky right 또는 앞쪽 열로 이동한다.
- 모든 세부 earning/tax/operator/preflight evidence를 기본 행에 펼치지 않는다.

### P1-6. Compact withdrawal table

Withdrawal 목록도 1440px 초기 시야에서 주요 action이 보여야 한다.

권장 열:

| 열 | 내용 |
|---|---|
| Partner / Bank | Partner, phone, bank, masked account |
| Amount | amount, request short ID |
| Status / Age | workflow status, paid/reviewed time, queue age |
| Evidence | bank match, transfer ref, journal 상태 |
| Action | Match evidence / Review / More |

요구사항:

- 각 row의 `Accounting preview` nested table을 제거한다.
- 목록에는 한 줄 accounting 결과 또는 evidence badge만 표시한다.
- journal 상세는 row drawer 또는 canonical General Ledger deep link에서 확인한다.
- primary action이 x-scroll 뒤에 있으면 안 된다.
- 빈 결과에서는 horizontal scrollbar를 제거한다.
- empty state에 현재 filter label과 range를 포함한다.

### P1-7. Route-controlled transfer editor drawer

`editPayoutBatchId`를 유지할 수 있지만 editor는 page 중간 inline section이 아니라 top-level route-controlled drawer/dialog로 렌더링하라.

필수 동작:

- `Review transfer` 또는 `Repair transfer evidence` 클릭 즉시 drawer가 viewport에 보인다.
- 초기 focus는 drawer heading 또는 첫 편집 필드에 위치한다.
- Tab/Shift+Tab focus trap을 지원한다.
- Escape, Cancel, Close를 지원한다.
- 닫은 뒤 원래 row trigger로 focus가 돌아간다.
- 기존 view/filter/page/sort를 안전하게 보존한다.
- payout editor를 열 때 `withdrawalReconciliation`, withdrawal-only hash/query를 제거한다.
- return path를 사용할 경우 내부 `/payouts` URL만 허용해 open redirect를 막는다.
- selected ID가 현재 page 20행에 없으면 ID 전용 API로 조회한다.
- 찾을 수 없거나 접근할 수 없으면 명확한 error/permission state를 표시한다.

Drawer 요약:

- Partner name/phone
- amount/currency
- approved bank name/masked account
- current stage
- transfer reference
- relevant release check 또는 closeout finding
- payout batch short ID와 copy 가능한 full ID

기존 안전장치 유지:

- `expectedStatus`
- `expectedTransferRef`
- `expectedNotes`
- full batch ID reconfirm
- 10자 이상 change reason
- optimistic concurrency conflict
- audit log before/after/reason

full ID를 긴 form label 안에 넣지 말고 readonly/copy block으로 표시하라. 확인 input label은 `Type the full batch ID to confirm`처럼 짧게 한다.

### P1-8. Confirmation dialog 정보와 focus lifecycle 강화

Processing, Paid, Failed, payout reversal, withdrawal reversal confirmation에 대상별로 필요한 정보를 표시하라.

공통 summary:

- Partner name/phone
- amount/currency
- bank name/account last4
- short ID + copy 가능한 full ID
- current stage
- current transfer reference/evidence state
- relevant server action blockers/warnings
- maker와 separate approver 요구
- 예상 accounting boundary/journal

권장 action label:

- `Processing` → `Start transfer preparation`
- `Paid` → `Approve paid closeout`
- `Failed` → `Record transfer failure`
- reversal → `Post reversal`

Processing 예시 의미:

> Start transfer preparation for Nguyen A · ₫1,250,000 to Vietcombank ****1234? No bank or wallet posting occurs yet. A different Finance approver must close the batch as PAID after transfer evidence is saved.

Payout/withdrawal reversal에는 추가로 표시:

- paid at/by
- current bank match state
- original transfer ref
- reversal journal preview
- separate approver
- reason/reference/evidence URL

접근성 완료 기준:

- dialog에 적절한 `dialog` 또는 `alertdialog` role과 accessible name
- 초기 focus
- focus trap
- Escape/Cancel
- 닫은 뒤 정확한 trigger focus return
- 서버 오류 시 입력값 보존
- 제출 중 중복 클릭 방지
- dynamic error/success live announcement

### P1-9. Batches 기본값을 Open work로 변경

현재 `All queues` 기본값은 1개 review와 4개 processing 다음에 154개 PAID history를 이어 붙인다.

권장 queue:

```text
Open work (default)
Needs review
In transfer
Release blocked
Paid / archived history
```

요구사항:

- `Open work`는 DRAFT/FAILED/PROCESSING 중 실제 action 대상만 포함한다.
- PAID/CANCELLED는 기본 목록에서 제외한다.
- post-payment repair는 Reconciliation으로 이동한다.
- history가 필요하면 명확한 records queue에서 조회한다.
- KPI `Needs review`, `Transfers in progress`, `Bank matches pending`, `Wallet / GL closeout repair`는 클릭 가능한 정확한 queue link가 되어야 한다.
- 다른 범위의 global backlog는 `GLOBAL` 또는 `All open evidence`를 숫자보다 먼저 인지할 수 있게 표시한다.

## 7. P2 운영 효율 개선

P1을 완료한 뒤 안전하게 구현 가능한 P2를 진행하라.

### P2-1. View별 검색·필터

#### Batches

- Search: batch ID, Partner name, phone, transfer reference
- Queue/status
- finding: release check, transfer ref, withholding, wallet ledger, GL journal
- amount range
- age
- owner가 실제 모델에 있을 때만 owner
- sort: severity, oldest, highest amount, newest

#### Withdrawals

- Search: withdrawal request ID, Partner name, phone, bank last4, transfer reference
- status/queue
- reconciliation matched/unmatched
- evidence missing type
- amount range
- age
- approver/owner가 실제 모델에 있을 때만

요구사항:

- 검색 label과 placeholder를 view별로 변경한다.
- URL query로 재현 가능해야 한다.
- 적용 filter chip과 `Clear filters`를 제공한다.
- 검색어를 길이 제한·정규화한다.
- SQL/query injection 또는 N+1을 만들지 않는다.

### P2-2. Queue age, SLA, owner

- 실제 queue entered timestamp 또는 가장 정확한 status transition time으로 age를 계산한다.
- SLA는 실제 policy/config가 있을 때만 표시한다.
- owner는 실제 assignment model이 있을 때만 표시한다.
- 데이터가 없으면 가짜 값을 만들지 말고 `Not assigned`, `SLA not configured` 또는 최종 gap으로 보고한다.
- Overview에는 backlog total count, amount, oldest age를 우선 표시한다.

### P2-3. 운영 문구 정리

다음 형태를 제거한다.

- `row(s)`
- `batch(es)`
- `earning(s)`
- `payout deduction record(s)`
- `check(s)`

정상 plural formatter를 사용하거나 항상 자연스러운 복수형 명사를 사용한다.

권장 교체:

| 현재 | 권장 |
|---|---|
| Post-payment repair | Wallet / GL closeout repair |
| Evidence net | Linked earnings net |
| Evidence completeness | Earning linkage coverage |
| 2 check(s) | 2 controls evaluated |
| 154 row(s) | 154 payout batches |
| Blocking reasons for PAID | Reconciliation findings |
| Review transfer on PAID | Repair transfer evidence |
| No blocking reason is preventing the next finance action. | Ready for the next finance action. |
| No records in current payout window | No records match {filter} in {range}. |

상태 의미를 엄격히 유지하라.

- `Clear`: 필요한 모든 source가 성공했고 실제 issue가 0
- `No records`: 선택 filter 결과만 0
- `Not evaluated`: 증빙 또는 범위가 부족해 판정 불가
- `Data unavailable`: API 실패
- `Partial`: 일부 source만 성공
- `Matched`: 같은 scope의 완전한 비교 결과가 일치

### P2-4. 시각 일관성

- reversal과 confirmation backdrop token을 통일한다.
- dark theme의 현재 대비와 상태 의미를 보존한다.
- 새로운 색상 체계나 카드 스타일을 발명하지 않는다.
- 불필요한 decorative card, gradient, emoji를 추가하지 않는다.
- Admin의 기존 radius, spacing, typography, badge, segmented control을 재사용한다.

## 8. 예상 주요 수정 파일

현재 구조를 다시 확인한 뒤 최소 범위로 수정하되, 최소한 다음 파일과 관련 type/test를 검사하라.

### Admin Web

- `apps/admin_web/app/payouts/page.tsx`
- `apps/admin_web/app/payouts/payouts-page-model.ts`
- `apps/admin_web/app/payouts/payout-batch-table.tsx`
- `apps/admin_web/app/payouts/payout-batch-list-section.tsx`
- `apps/admin_web/app/payouts/payout-wallet-withdrawal-request-section.tsx`
- `apps/admin_web/app/payouts/payout-money-flow-section.tsx`
- `apps/admin_web/app/payouts/payout-action-confirmation.ts`
- payout 관련 server actions와 API types
- `apps/admin_web/app/globals.css`의 payout 관련 selector만
- `apps/admin_web/app/payouts/*.spec.ts(x)`

### API

- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin-payout.routes.ts`
- `apps/api/src/earnings/earnings.service.ts`
- payout/withdrawal query DTO와 shared/admin API type
- `apps/api/src/admin/admin.service.spec.ts`
- `apps/api/src/earnings/earnings.service.spec.ts`

실제 코드 구조가 다르면 가장 가까운 기존 모듈을 사용하라. 새 추상화나 디렉터리를 필요 이상으로 만들지 마라.

## 9. 성능 목표

동일한 1440 × 900, 20행 조건에서 측정하라.

### Reconciliation Overview

- row table 0개
- DOM < 900 목표
- document height < 4,500px 목표
- forms 0

### Reconciliation active queue

- initial primary table 1개
- nested table 0개
- DOM < 1,200 목표
- document height < 7,500px 목표
- row 화면 forms 0
- drawer/dialog가 열릴 때 form 최대 1개
- primary action은 x-scroll 0에서 보임

### Batches / Withdrawals

- 기본 row height 80~112px, 최대 128px 목표
- 20행을 7,500px 이하에서 비교 가능
- nested accounting table 0개
- 불필요한 approver directory fetch 없음

성능 목표를 맞추기 위해 먼저 dataset 분리와 row 축약을 사용하라. 이 조건으로 충분하면 virtualization을 도입하지 마라.

## 10. 접근성·키보드 검증

다음을 실제 브라우저에서 키보드로 검증하라.

1. Batches primary action 진입
2. Transfer editor drawer 열기
3. Tab/Shift+Tab 순환
4. Escape로 닫기
5. 원 trigger로 focus return
6. Processing confirmation 열기/취소
7. Paid reversal 열기/취소
8. Withdrawal reversal 열기/취소
9. 서버 차단 이유를 키보드와 screen reader name으로 확인
10. 성공/오류 메시지 live announcement

다음을 유지하라.

- 논리적인 heading hierarchy
- table header association
- 상태를 색상만으로 전달하지 않기
- accessible full ID/ref
- action accessible name에 Partner 또는 short ID 포함

## 11. 필수 회귀 테스트

기존 테스트를 유지하고 다음 테스트를 추가 또는 강화하라.

### Admin Web

1. `view=batches`는 withdrawal row API/data를 사용하지 않음
2. `view=withdrawals`는 payout batch row list를 렌더링하지 않음
3. `recon=overview`는 row table/API 없이 aggregate만 표시
4. `recon=bank-unmatched`는 withdrawal rows만 표시
5. `recon=payout-closeout-repair`는 payout repair rows만 표시
6. legacy audit/repair URL이 canonical reconciliation URL로 정규화됨
7. Batches 기본 queue가 open work이고 PAID/CANCELLED를 포함하지 않음
8. earning linkage complete와 wallet/GL repair가 별도 label로 표시됨
9. payout summary 실패 시 0/Clear가 표시되지 않음
10. selected filter 0이어도 global bank pending warning 유지
11. empty filter와 API failure state가 다름
12. PAID row aria-label이 `Reconciliation findings` 사용
13. PAID action label이 `Repair transfer evidence`
14. transfer editor가 top-level drawer로 렌더링됨
15. off-page selected batch의 ID lookup/not-found 처리
16. editor open 시 withdrawal-only query/hash 제거
17. close/cancel/complete 후 view/filter/page/sort 보존
18. Processing confirmation에 Partner, amount, bank, ref, risk 표시
19. reversal confirmation에 paid time, bank match, journal preview 표시
20. focus lifecycle open→trap→Escape/Cancel→trigger return
21. 20행에 반복 reversal/editor form이 생기지 않음
22. nested accounting table이 row마다 생기지 않음

### API

1. post-payment repair predicate의 transfer/withholding/wallet/GL 네 조건
2. action-specific availability 계약
3. PAID reversal blocker에 pre-release blocker가 포함되지 않음
4. reversal already-posted, separate approver, closed period 차단
5. live preflight 재검증
6. maker-checker 유지
7. transfer evidence optimistic concurrency 유지
8. full batch ID reconfirm 불일치 차단
9. reconciliation 하위 queue별 summary/list scope
10. selected range earning linkage와 global outstanding backlog 구분
11. partial/failure/empty 상태 계약
12. list pagination과 aggregate 독립성
13. legacy/current anomaly 분류는 authoritative cutoff가 있을 때만

## 12. 권장 검증 명령

실제 `package.json`과 `AGENTS.md`를 우선하되 최소한 다음을 실행하라.

```powershell
# Admin Web payout tests
cd C:\dev\massage-on-demand-vn\apps\admin_web
npm.cmd test -- --run app/payouts
npm.cmd run typecheck

# API payout/admin tests
cd C:\dev\massage-on-demand-vn\apps\api
npm.cmd test -- --run src/earnings/earnings.service.spec.ts src/admin/admin.service.spec.ts
npm.cmd run typecheck
```

수정한 파일에 대해 lint를 실행하라. 전체 저장소 lint가 기존 사용자 변경으로 실패하면 현재 작업 범위 실패와 기존 실패를 분리해 보고하라.

Impeccable detector를 사용할 수 있고 자동 hook이 활성화되지 않았다면 모든 UI 수정을 마친 뒤 payout 관련 변경 파일에 한 번만 실행하라.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <changed-payout-ui-files>
```

global CSS의 payout과 무관한 false positive는 최종 보고에서 구분하라.

## 13. 1440px 브라우저 검수

로그인된 인앱 브라우저를 사용해 1440 × 900에서 다음 상태를 캡처하고 직접 열어 검사하라.

1. Batches 기본 Open work
2. Needs review
3. In transfer
4. Paid/history
5. Withdrawals 기본 화면
6. Withdrawal empty filter + global bank warning
7. Reconciliation Overview
8. Bank unmatched queue
9. Payout closeout repair queue
10. Transfer editor drawer
11. Processing confirmation
12. blocked Paid confirmation
13. payout reversal dialog
14. withdrawal reversal dialog
15. dark theme Batches
16. dark theme Reconciliation queue

각 스크린샷에서 다음을 확인하라.

- 숫자의 scope와 label
- false Clear 여부
- primary action 가시성
- text clipping/문자 단위 줄바꿈
- horizontal scrollbar 필요 여부
- nested scroll
- row density
- selected state
- dialog/drawer 대상 정보
- light/dark 대비

스크린샷 저장만 하고 완료하지 마라. 각 이미지를 직접 열어 판정하고 최종 보고서에 상태별 결과를 적어라.

검수 산출물은 다음과 같은 새 폴더에 저장하라.

`C:\dev\massage-on-demand-vn\output\payouts-final-remediation-verification-YYYY-MM-DD`

## 14. 변경 금지·안전 보호

- 실제 payout, withdrawal, wallet ledger, journal 데이터를 삭제·수정·backfill하지 마라.
- migration이 필요하면 계획만 작성하고 자동 실행하지 마라.
- maker-checker를 완화하지 마라.
- Finance approver role requirement를 완화하지 마라.
- full ID reconfirm과 change reason을 제거하지 마라.
- optimistic concurrency check를 제거하지 마라.
- reversal reason/reference/evidence requirement를 제거하지 마라.
- closed accounting period 보호를 제거하지 마라.
- API failure를 fallback 데이터로 숨기지 마라.
- General Ledger, Bank Reconciliation, Operations Policy의 canonical 책임을 `/payouts`에 복제하지 마라.
- 관련 없는 navigation IA, Finance 페이지, Partner 페이지를 재설계하지 마라.
- 새로운 UI/table/state library를 추가하지 마라.
- 존재하지 않는 owner, SLA, migration cutoff를 꾸며내지 마라.
- 사용자 변경을 reset, checkout, overwrite하지 마라.
- 1024px 이하 대응을 작업 범위에 추가하지 마라.

## 15. 완료 조건

아래 항목이 모두 충족될 때만 완료라고 보고하라.

- [ ] Batches 기본값이 Open work이며 PAID history가 섞이지 않음
- [ ] Reconciliation이 Overview / Bank unmatched / Payout closeout repair로 분리됨
- [ ] 선택하지 않은 reconciliation dataset을 fetch/render하지 않음
- [ ] Reconciliation active queue의 primary table이 1개이고 nested table이 없음
- [ ] Reconciliation queue document height가 7,500px 이내 목표를 충족하거나 정확한 blocker를 보고함
- [ ] 1440px x-scroll 0에서 primary action이 보임
- [ ] Batch ID, phone, status가 문자 단위로 줄바꿈되지 않음
- [ ] Transfer editor가 즉시 보이는 drawer/dialog로 열림
- [ ] editor initial focus, trap, Escape/Cancel, trigger focus return이 작동함
- [ ] editor URL에서 withdrawal-only context가 제거됨
- [ ] off-page selected batch도 정확히 조회됨
- [ ] action-specific server availability가 구현됨
- [ ] PAID reversal 이유에 pre-release blocker가 없음
- [ ] earning linkage와 wallet/GL closeout 용어가 명확히 분리됨
- [ ] 154 repair를 오집계로 제거하지 않고 실제 evidence kind를 표시함
- [ ] legacy/current 분류는 authoritative 근거가 있을 때만 수행함
- [ ] confirmation에 Partner, amount, bank, ref, risk, maker/approver, accounting boundary가 표시됨
- [ ] 모든 dialog/drawer가 닫힌 뒤 원 trigger로 focus 복귀
- [ ] global backlog와 selected-range metric의 범위가 명확함
- [ ] KPI가 정확한 queue로 이동함
- [ ] 빈 filter, Clear, Not evaluated, Data unavailable, Partial, Matched가 구분됨
- [ ] 반복 row form과 nested accounting table이 제거됨
- [ ] plural copy가 정리됨
- [ ] dark theme가 회귀하지 않음
- [ ] 기존 금융 안전장치가 유지됨
- [ ] 신규·기존 테스트와 typecheck가 통과함
- [ ] 1440 × 900 screenshots를 직접 비교 검수함
- [ ] 수정 전후 DOM, document height, forms, tables, API loading 수치를 보고함

어떤 항목이 기술적으로 불가능하거나 authoritative 데이터가 없어 구현할 수 없다면 가짜로 완료하지 마라. 정확한 파일/데이터 모델/정책 blocker와 운영 영향을 적고 `미완료`로 표시하라.

## 16. 최종 보고 형식

작업 완료 후 다음 순서로 새 Markdown 보고서를 작성하라.

1. 최종 판정과 운영자 관점 결과
2. P1/P2 항목별 `완료 / 부분 완료 / 미완료` 표
3. 최종 Payouts IA와 canonical URL 표
4. earning linkage와 wallet/GL closeout 최종 계약
5. action-specific availability와 reversal blocker 계약
6. 변경 파일과 파일별 역할
7. 기존 금융 안전장치 보존 확인
8. API/query 성능과 non-selected dataset 미호출 증거
9. 1440px 화면별 캡처 경로와 판정
10. 접근성·focus lifecycle 결과
11. 실행한 tests/typecheck/lint/detector 결과
12. 수정 전후 성능 표
13. legacy data migration 또는 정책 결정이 필요한 잔여 항목
14. 관련 없는 사용자 변경 중 보존한 영역

보고서와 캡처를 `output/payouts-final-remediation-verification-YYYY-MM-DD`에 저장하고 Codex에서 보고서를 열어라.

완료 문구는 모든 완료 조건을 실제로 검증한 뒤에만 사용하라. 코드 수정만 끝났거나 테스트만 통과한 상태를 완료로 표현하지 마라.

## END PROMPT

