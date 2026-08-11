# Finance Approval Queue 개선 구현용 Codex 마스터 프롬프트

아래 프롬프트 전체를 `C:\dev\massage-on-demand-vn`을 workspace로 연 새로운 Codex task에 붙여 넣는다.

---

## Codex에게 전달할 프롬프트

`C:\dev\massage-on-demand-vn`의 HANDS 관리자 웹 `Finance Approval Queue`를 감사 보고서에 따라 실제로 개선하라. 분석이나 제안서 작성만 하고 끝내지 말고, 현재 코드를 확인한 뒤 안전한 범위에서 구현·테스트·브라우저 검증·결과 보고까지 완료하라.

### 1. 목표

대상 페이지:

- `http://localhost:3101/finance-tax/approval-queue`
- 이 페이지의 Priority, Fee policies, Bank accounts, Deposits, Withdrawals, Payout batches, Refunds, Wallet, Bank evidence, confirmation dialog, filters, related finance links

최종 목표는 이 화면을 단순한 금융 메뉴 모음이 아니라 다음 질문에 즉시 답하는 운영 통제 화면으로 만드는 것이다.

1. 지금 실제로 승인·거절할 수 있는 건은 몇 개인가?
2. 막힌 건은 무엇 때문에 막혔고 누가 다음 행동을 해야 하는가?
3. SLA를 넘긴 가장 위험하고 오래된 건은 무엇인가?
4. 결정 전에 확인해야 할 증빙과 현재 상태는 무엇인가?
5. 실행 시 wallet, payment, payout, settlement, tax, GL, audit에 어떤 변화가 생기는가?
6. 현재 데이터가 언제 생성된 스냅샷이며 지금 결정해도 안전한가?

### 2. 반드시 먼저 읽을 자료

다음 순서로 읽고 현재 구현과 보고서가 일치하는지 직접 확인하라.

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\output\finance-tax-approval-queue-audit-2026-08-08\finance-tax-approval-queue-audit-report.md`
3. 같은 폴더의 감사 스크린샷
4. 현재 관련 코드와 최근 diff

중요 파일 후보:

- `apps/admin_web/app/finance-tax/approval-queue/page.tsx`
- `apps/admin_web/app/finance-tax/approval-queue/actions.ts`
- `apps/admin_web/app/finance-tax/approval-queue/page.spec.tsx`
- `apps/admin_web/app/finance-tax/approval-queue/actions.spec.ts`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/app/finance-tax/tax-finance-workflow-actions.tsx`
- `apps/admin_web/app/finance-tax/tax-settlement-page-model.ts`
- `apps/api/src/admin/admin-finance.routes.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/admin/admin.service.spec.ts`
- `apps/api/src/payments/payments.service.ts`

위 목록은 시작점일 뿐이다. `rg`로 실제 type, DTO, controller, call site와 테스트를 찾아라. 보고서의 line number는 코드 변경으로 달라질 수 있으므로 문자열과 함수 이름으로 다시 확인하라.

### 3. 작업 전 보호 규칙

현재 worktree에는 사용자가 진행 중인 수정이 매우 많다. 다음 규칙을 반드시 지켜라.

- `git reset --hard`, `git checkout --`, 광범위한 revert, clean, 강제 삭제를 하지 마라.
- 사용자 변경을 덮어쓰거나 무관한 파일을 정리하지 마라.
- 대상 파일에도 기존 변경이 있으면 먼저 diff를 읽고 그 위에 최소 범위로 통합하라.
- 사용자가 요청하지 않았으므로 commit, push, PR 생성은 하지 마라.
- 새로운 UI 라이브러리나 불필요한 dependency를 추가하지 마라.
- 기존 디자인 시스템, token, table, badge, form, dialog component를 우선 재사용하라.
- DB schema와 migration은 이번 문제에 필요하지 않다. 새 migration으로 해결하지 마라.
- 기존 refund/payment idempotency, maker/checker, audit trail, wallet/GL atomicity를 약화시키지 마라.
- 실제 승인·거절·환불·지급·지갑 조정 등 금전 변경 mutation은 브라우저에서 제출하지 마라. mock/test fixture로 검증하라.
- 1024px 이하 반응형·모바일 디자인은 작업 및 보고 범위에서 제외한다.
- 대상 해상도는 1440px 이상이며, 브라우저 QA는 1440px과 1692×1272에서 수행하라.
- AGENTS.md의 single-agent 규칙을 지키고 subagent를 만들지 마라.

### 4. 작업 방식

먼저 짧은 구현 계획을 세운 후 바로 작업하라. 불명확한 점은 현재 코드·테스트·실제 화면에서 조사하고 합리적으로 결정하라. 단, 금융 mutation 의미를 바꿔야만 진행할 수 있다면 임의로 바꾸지 말고 정확한 blocker로 보고하라.

작업 순서:

1. 현재 브라우저와 코드로 baseline 재현
2. 데이터 계약과 action eligibility 수정
3. 상태 집계·우선순위 모델 수정
4. UI 정보 구조와 focused queue 수정
5. confirmation evidence와 stale/error recovery 수정
6. Bank evidence IA 통합
7. 조회 성능과 파일 책임 개선
8. 테스트
9. 1440+/다크·라이트 브라우저 QA 및 스크린샷
10. 구현 보고서 작성

P1을 모두 완료한 뒤 P2로 진행하라. 시각 polish를 먼저 하거나 P1 상태 오류를 남긴 채 완료 처리하지 마라.

## 5. P1 필수 구현 요구사항

### P1-1. Refund 상태 계약을 단일화하라

현재 확인된 모순:

- refund request는 `REQUESTED`
- 연결된 payment는 이미 `REFUNDED`
- API가 해당 항목을 `READY`로 분류
- UI가 `Approve refund`를 제공
- 실제 payment service는 `CAPTURED`가 아니면 conflict로 차단
- server action은 상세 원인을 일반 `failed`로 숨김

반드시 다음 계약을 구현하라.

```text
READY =
  refund.status === REQUESTED
  AND payment.status === CAPTURED
  AND actor has FINANCE_APPROVER
  AND actor is not the maker
  AND any other existing refund preflight passes
```

추가 상태를 명시적으로 모델링하라.

- `READY`: 지금 실행 가능
- `BLOCKED`: 권한, maker/checker, 필수 증빙 등으로 차단
- `STATE_MISMATCH`: refund request와 payment/provider/settlement 상태가 서로 불일치

요구사항:

- `payment.status !== CAPTURED`인 요청은 절대 READY가 아니어야 한다.
- `REFUNDED + REQUESTED`를 단순히 숨기지 말고 `STATE_MISMATCH`로 분류해 원인과 복구 진입점을 보여라.
- `STATE_MISMATCH` 행에는 `Approve refund`를 렌더링하지 마라.
- 임의로 기존 Reject를 데이터 복구 기능으로 재해석하지 마라. 현재 reject semantics를 검증하고, 안전한 복구 mutation이 없으면 `Open payment timeline`과 명확한 상태 설명만 제공하라.
- confirmation에서도 current payment status, refund status, provider state, settlement/reversal 상태를 보여라.
- action 실행 직전에 서버가 최신 상태를 다시 검사해야 한다. 기존 payment service의 `CAPTURED` guard는 유지하라.
- action failure를 모두 같은 `failed`로 축약하지 말고, 민감정보를 노출하지 않는 안전한 운영자 메시지와 다음 행동을 제공하라.
- 예: `Payment is already refunded. This request cannot be approved. Open payment timeline.`
- 화면 문구 `Captured customer payments`와 `Only captured payments...`는 실제 eligibility 모델과 동일한 데이터에서 파생되게 하라.

필수 회귀 fixture:

| Refund status | Payment status | Expected review state | Approve visible |
|---|---|---|---|
| REQUESTED | CAPTURED | READY 또는 maker/권한에 따른 BLOCKED | READY일 때만 Yes |
| REQUESTED | REFUNDED | STATE_MISMATCH | No |
| REQUESTED | RELEASED | STATE_MISMATCH | No |
| REQUESTED | FAILED/other invalid | STATE_MISMATCH | No |

### P1-2. 모든 대표 수치를 실행 가능 상태 기준으로 바꿔라

단순 pending 총계를 `Needs approval`이라고 부르지 마라. API 또는 server-side view model에서 다음 count를 계산하라.

- readyCount
- blockedCount
- staleCount, 해당 유형에 적용되는 경우
- stateMismatchCount, 해당 유형에 적용되는 경우
- totalOpenCount

특히:

- Refund는 현재 관찰 데이터 기준 `0 ready · 112 state mismatch`처럼 표현되어야 하며 숫자를 hard-code하면 안 된다.
- Payout은 `2 ready · 2 blocked · 4 total`처럼 실제 preflight 결과를 집계하라.
- Withdrawal의 현재 1건이 `BANK_TRANSFER_PENDING`이면 `1 paid closeout pending`으로 설명하라. `1 total` 아래 `0 new · 0 flagged`처럼 합이 맞지 않는 문구를 제거하라.
- Wallet의 ready/blocked/stale 분류는 유지하되 다른 큐와 동일한 naming과 badge 체계를 사용하라.
- Priority는 approval decisions와 post-approval matching을 한 합계로 섞지 마라.

호환성이 필요한 기존 summary field는 즉시 삭제하지 말고 call site를 조사해 유지하거나 단계적으로 대체하라.

### P1-3. Priority를 실제 운영 우선순위 표로 바꿔라

Priority 표에 최소 다음 정보를 제공하라.

- Risk 또는 priority
- Work type
- Subject
- Amount/exposure
- Age와 SLA 상태
- Control state: Ready/Blocked/Stale/State mismatch
- Owner/assignee 또는 Unassigned
- 대상별 action

기본 정렬 함수를 명시적으로 만들고 unit test하라. 단순 `createdAt asc`만 사용하지 마라.

권장 기본 원칙:

1. severe state mismatch 또는 SLA breach
2. 실행 가능한 Ready 업무
3. 미배정
4. age
5. amount/impact
6. 마지막 tie-breaker로 안정적인 ID

정렬 의도를 `Sorted by operational risk` 등으로 화면에 표시하라. 사용자가 선택할 정렬은 처음부터 복잡하게 만들지 말고 `Risk / Oldest` 정도면 충분하다.

모든 Priority action은 특정 request를 보존해야 한다.

- `Review refund`가 일반 Refund 탭만 열어서는 안 된다.
- request ID를 포함한 drawer, anchor, focused row 또는 confirmation entry로 이동하라.
- 접근 가능한 이름은 `Review refund for booking X, 300,000 VND, waiting 82 days`처럼 행을 구분할 수 있어야 한다.

### P1-4. Focused queue에서 반복 Command board를 제거하라

- 전체 8개 Command card는 Priority에서만 렌더링하라.
- Refund/Payout/Withdrawal/Wallet 등 집중 뷰에서는 선택한 큐의 title, ready/blocked/mismatch count, 필요한 filter, 첫 작업 행이 1692×1272 첫 화면 안에 나타나야 한다.
- 0건인 큐는 controls와 빈 table header를 반복하지 말고 상단에서 즉시 compact success empty state를 보여라.
- 0건 상태에는 `Back to Priority`와 관련 활성 큐로 가는 최소 링크만 제공하라.

### P1-5. 작업공간 IA를 1440+에서 1행으로 정리하라

현재 9개 segmented option이 3줄로 줄바꿈된다. 다음 수준으로 primary navigation을 축약하라.

```text
Priority | Refunds | Payouts | Withdrawals | Wallet | Other approvals
```

- Fee policies, Bank accounts, Deposits는 `Other approvals` 안의 명확한 secondary 선택지로 제공하라.
- 한 페이지 안에서 처리하고 불필요하게 새 route를 늘리지 마라.
- 현재 query URL의 backward compatibility를 보존하라.
- 기본 Priority는 canonical URL 하나만 사용하라. form 제출로 `?view=priority`와 기본 URL이 동시에 생기지 않게 하라.
- filter와 `take`는 공통 URL builder를 통해 보존하라. hard-coded Bank matching URL을 사용하지 마라.

### P1-6. 고위험 confirmation에 decision evidence snapshot을 넣어라

Withdrawal, Payout, Refund confirmation에서 별도 페이지를 열지 않아도 다음 핵심 사실을 읽을 수 있어야 한다.

- request/batch/payment ID
- subject/Partner/booking
- amount와 currency
- current lifecycle/review state
- maker/requested by와 requested at
- current approver와 independent approval 여부
- bank name/last4/transfer reference, 해당되는 경우
- evidence 존재/누락과 핵심 blocker
- wallet before→after 또는 debit impact
- GL/settlement/tax/withholding effect
- snapshot generated/validated time

기존 접근성 장점은 유지하라.

- `role=alertdialog`
- `aria-modal=true`
- background inert/aria-hidden
- body scroll lock
- 안전한 첫 focus(Cancel)
- Escape/Cancel 복귀

확인 화면을 더 화려하게 만들기보다, 읽기 쉬운 key-value evidence summary와 명확한 effect 문장으로 구성하라.

### P1-7. Snapshot freshness와 Refresh를 구현하라

API가 제공하는 `generatedAt`을 화면에 사용하라.

- 자동 갱신이 없다면 `Snapshot updated HH:mm:ss`와 명시적인 Refresh 버튼을 제공하라.
- 실제 동작하지 않는 `Live`라는 표현을 사용하지 마라.
- 2~5분 등 프로젝트 정책에 맞는 stale 기준을 기존 패턴에서 찾아 적용하라.
- stale 상태에서 승인하려 하면 최신 preflight를 실행하고, 상태가 달라졌으면 mutation 없이 중단하여 새 상태와 다음 행동을 설명하라.
- refresh는 현재 view/filter/take를 보존해야 한다.

### P1-8. Wallet 표를 1440+ 운영 환경에 맞게 압축하라

- 현재 `min-width:1320px` 8열 구조와 내부 가로 스크롤을 제거하거나 실질적으로 불필요하게 만들어라.
- 기본 행은 최대 다음 수준으로 단순화하라.

```text
State | Owner/request | Amount | Balance delta | Age | Primary blocker | Action
```

- evidence 전문, 모든 blocker, raw ID, 원장 영향은 expandable row 또는 detail drawer에 둬라.
- `Optional` evidence와 실제 blocker 관계를 명확히 분리하라.
- 1692px에서 중요한 값이 과도하게 줄바꿈되거나 한 행이 화면 대부분을 차지하지 않아야 한다.
- Stale가 대부분인 경우 stale cleanup에 맞는 `Oldest first` 또는 명시적 기본 정렬을 제공하라.

### P1-9. Bank evidence를 Bank Reconciliation의 canonical 업무로 통합하라

Bank evidence는 이미 실행된 거래의 post-approval matching이다. Approval과 같은 primary queue로 소유하지 마라.

안전한 통합 순서:

1. `/finance-tax/bank-reconciliation`에 현재 Bank evidence의 owner, SLA, assignment, evidence action이 모두 있는지 비교한다.
2. 부족한 기능이 있으면 Bank Reconciliation 쪽에 최소 범위로 통합한다.
3. Approval Queue의 `Bank evidence` primary tab을 제거한다.
4. Priority에는 `28 post-approval matches · unassigned · oldest SLA`와 같은 compact alert/link만 남긴다. 숫자는 실제 데이터에서 계산한다.
5. 기존 `/finance-tax/approval-queue?view=reconciliation` bookmark는 filter를 보존해 canonical Bank Reconciliation로 redirect한다.
6. 호출자가 남아 있는 API/action 코드를 성급하게 삭제하지 마라. 사용 여부와 테스트를 확인한 뒤 안전하게 정리한다.

기능 동등성을 한 번에 보장할 수 없다면 중복 owner를 만들지 말고, 이번 작업에서 가능한 단계와 남은 blocker를 구현 보고서에 정확히 적어라.

## 6. P2 구현 요구사항

P1 완료 후 다음을 수행하라.

### P2-1. 선택 뷰별 API 조회 최적화

현재 approval endpoint는 선택한 화면과 무관하게 다수 큐 조회와 preflight를 실행한다.

- API query에 backward-compatible한 optional scope/view를 추가하는 방안을 우선 검토하라.
- focused queue는 해당 queue payload와 공통 exact summary에 필요한 조회만 실행하라.
- Priority는 통합 모델에 필요한 큐를 조회하되 불필요한 history/reconciliation data를 포함하지 마라.
- 기존 caller가 scope를 전달하지 않을 때의 동작은 깨뜨리지 마라.
- query count 또는 호출 mock을 검증하는 테스트를 추가하라.
- premature caching으로 stale finance decisions를 만들지 마라. mutation 후 revalidation과 fresh preflight가 우선이다.

### P2-2. 1,945줄 page 책임 분리

route를 여러 페이지로 쪼개지 말고 코드 책임만 분리하라.

권장 경계:

- query/view parsing과 canonical URL
- approval queue types/model
- priority sorting/model
- command summary
- focused queue sections
- confirmation model/evidence summary
- empty state와 filters

추상화를 위한 추상화를 만들지 말고, 테스트 가능한 순수 모델과 화면 section 수준으로만 분리하라.

### P2-3. Queue controls 단순화

- Priority에서 `Rows per queue`를 `Rows shown`으로 바꿔라.
- select 하나만 있는 경우 큰 Apply 버튼 대신 자동 적용 또는 compact inline Apply를 사용하라.
- Wallet/Reconciliation 등 실제 필터가 여러 개인 경우에만 명확한 Apply/Reset을 유지하라.
- empty queue에서는 row count control을 숨겨라.

### P2-4. More finance pages 정리

공유 component를 바꾸면 다른 finance 페이지에 영향을 줄 수 있으므로 call site와 테스트를 먼저 확인하라.

권장 그룹:

- Records & audit: Booking settlement audit, Settlement reversals, General ledger
- Reconciliation: Payment clearing, Bank reconciliation
- Tax close: Monthly tax closing, Platform VAT, Partner withholding tax
- Configuration: Payment fees, Coupon finance, Finance approvers

사이드바에 이미 있는 Payment clearing/Bank reconciliation을 불필요하게 반복하지 마라. Approval Queue에 필요한 `Approver coverage`는 header의 직접 링크로 노출하라. 공유 메뉴 전체 변경이 과도하다면 approval page 전용 related links만 정리하고 이유를 보고하라.

## 7. UX 문구 원칙

프로그래머 용어보다 운영자가 다음 행동을 알 수 있는 문구를 사용하라.

교체 예시:

- `Needs approval 4` → `2 ready · 2 blocked`
- `0 new · 0 flagged` → `1 paid closeout pending`
- `System request` → `Requested by automated closeout` 등 실제 source 설명
- `Missing` → `Transfer reference missing`
- `Recorded` → `Bank account on file · •••• 1234`
- `Failed` → `Payment is already refunded. Open payment timeline.`
- `Apply` → 필요한 경우에만 `Apply filters`

주의:

- DB enum을 그대로 사용자에게 노출하지 마라.
- `Live`, `Ready`, `Needs approval`은 실제 데이터 계약이 보장할 때만 사용하라.
- `Partner`라는 사용자 용어를 사용하고 내부 `provider` naming을 화면에 노출하지 마라.
- 금액, 시간, timezone, ID 표시는 기존 formatter를 사용하라.

## 8. 접근성 기준

- 각 링크·버튼의 accessible name만으로 대상 request를 구분할 수 있어야 한다.
- segmented workspace는 `<nav aria-label>` 또는 프로젝트의 적합한 navigation semantics를 사용하라.
- 단순 filter group을 모두 `aria-current=page`로 취급하지 마라.
- table header와 cell 관계를 유지하라.
- status를 색상만으로 표현하지 마라.
- dialog focus trap, Cancel 첫 focus, Escape, 복귀 focus를 검증하라.
- keyboard만으로 focused queue, row detail, confirmation을 사용할 수 있어야 한다.
- 다크·라이트 테마에서 muted text와 danger/warning badge를 육안 및 가능한 기존 도구로 검수하라.

## 9. 테스트 요구사항

기존 테스트를 수정하는 데 그치지 말고 발견한 상태 계약을 잡는 회귀 테스트를 추가하라.

필수 테스트:

1. `REQUESTED + CAPTURED` refund eligibility
2. `REQUESTED + REFUNDED` → STATE_MISMATCH, Approve 없음
3. `REQUESTED + RELEASED` → STATE_MISMATCH, Approve 없음
4. maker/checker blocked
5. Payout ready/blocked count 분리
6. Withdrawal paid closeout count 문구
7. Priority risk/oldest stable sorting
8. Priority action이 request ID를 보존
9. focused view에서 full Command board가 렌더링되지 않음
10. empty focused queue의 compact empty state
11. canonical Priority URL과 filter/take 보존
12. Bank evidence compatibility redirect/filter 보존
13. stale snapshot에서 mutation 없이 중단
14. confirmation evidence summary와 accessible dialog semantics
15. Wallet compact layout의 핵심 content contract
16. 선택 view가 불필요한 queue query를 실행하지 않음

최소 실행 명령 후보:

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- --run app/finance-tax/approval-queue/page.spec.tsx app/finance-tax/approval-queue/actions.spec.ts
npm.cmd run test --workspace @massage-vn/api -- --run src/admin/admin.service.spec.ts -t "finance approval queue"
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

실제 package script와 test name은 현재 저장소에서 확인해 올바른 명령으로 실행하라. protected `apps/api/src/payments/**`를 변경하면 AGENTS.md가 요구하는 추가 integration/full verification을 수행하라. 기존 payment guard 변경이 필요하지 않다면 해당 protected mutation 로직은 건드리지 않는 쪽을 우선하라.

테스트를 통과시키려고 기존 중요 assertion을 삭제하거나 의미를 약화시키지 마라.

## 10. 브라우저 검증

로그인 세션이 있는 브라우저를 재사용하라. 로그인되어 있지 않으면 관리자 화면을 열고 사용자 로그인만 기다린 뒤 같은 task에서 계속하라.

검수 해상도:

- 1440px 이상
- 주 검수: 1692×1272
- 1024px 이하는 캡처·검사·보고하지 마라.

검수 상태:

1. Priority top과 unified table
2. 0건인 Other approval queue
3. Withdrawal row와 confirmation
4. Payout Ready/Blocked
5. Refund CAPTURED Ready fixture 또는 안전한 mock
6. Refund REFUNDED State mismatch
7. Wallet All/Blocked/Stale
8. Bank Reconciliation canonical 이동
9. More finance links
10. Dark theme
11. Light theme
12. Keyboard focus와 confirmation cancel
13. console warning/error

실데이터에서 final Approve/Reject를 제출하지 마라. confirmation 진입과 Cancel까지만 검증하라.

변경 전·후 스크린샷을 다음과 같은 새 폴더에 저장하라.

```text
output/finance-tax-approval-queue-improvement-verification-2026-08-08/
```

스크린샷은 의미 있는 상태만 남기고 loading transition, 중복 full-page capture, 잘못된 테마 캡처는 최종 증거에서 제외하라.

## 11. 완료 수용 기준

다음이 모두 충족되어야 완료다.

### 데이터·행동

- [ ] non-CAPTURED refund는 READY가 아니다.
- [ ] `REFUNDED + REQUESTED`에 Approve가 없다.
- [ ] Refund mismatch에 원인과 안전한 recovery link가 있다.
- [ ] Payout 대표 수치가 ready와 blocked를 분리한다.
- [ ] Priority와 focused queue의 count가 같은 상태 모델에서 파생된다.
- [ ] 승인 직전 최신 preflight가 실행된다.
- [ ] 실제 payment/wallet/GL idempotency와 audit 보호가 유지된다.

### 운영 화면

- [ ] 1440px 이상에서 primary workspace가 1행이다.
- [ ] focused queue의 실제 표가 첫 viewport 안에서 시작된다.
- [ ] 0건 큐가 전체 Command board와 빈 table을 반복하지 않는다.
- [ ] Priority 행은 특정 request로 바로 이동한다.
- [ ] Wallet에 내부 가로 스크롤이 없거나 운영상 불필요할 정도로 제거됐다.
- [ ] confirmation에서 핵심 증빙과 effect를 한 화면에서 확인한다.
- [ ] snapshot 시각과 Refresh가 있다.
- [ ] Bank evidence의 canonical owner가 Bank Reconciliation 하나다.

### 품질

- [ ] 기존 관련 테스트와 새 회귀 테스트가 통과한다.
- [ ] admin/api scope verification이 통과한다.
- [ ] application console warning/error가 없다.
- [ ] 다크·라이트 테마가 모두 안정적이다.
- [ ] 사용자 기존 변경이 보존됐다.
- [ ] 1024px 이하 작업은 범위에 포함되지 않았다.

## 12. 최종 산출물

완료 후 다음을 제공하라.

1. 실제 코드 변경
2. 회귀 테스트
3. before/after 및 핵심 상태 스크린샷
4. `output/finance-tax-approval-queue-improvement-verification-2026-08-08/implementation-report.md`
5. 최종 메시지에 다음 항목을 정리
   - 최종 결과와 운영 영향
   - 변경 파일
   - 구현한 P1/P2 항목
   - 실행한 명령과 pass/fail/skipped
   - protected area 변경 여부
   - 브라우저 검증 URL·해상도·상태
   - 남은 위험 또는 의도적으로 보류한 항목
   - 다음 권장 작업 1개

구현 보고서에는 스크린샷을 각 검증 단계 바로 아래에 배치하라. 테스트가 통과했더라도 `REFUNDED + REQUESTED` 상태 계약, focused queue 첫 화면, Wallet 폭, Bank Reconciliation 통합을 직접 화면과 코드에서 확인하지 않았다면 완료라고 하지 마라.

---

## 프롬프트 사용 메모

- 이 프롬프트는 한 번의 구현 task에 사용한다.
- 변경 전 계획만 먼저 검토하고 싶으면 프롬프트 맨 앞에 `/plan`을 추가한다.
- 계획 승인 후에는 `계획대로 P1부터 구현하고, 테스트와 브라우저 검증까지 완료해`라고 후속 지시한다.
- 반복 사용이 필요하다면 deprecated custom prompt보다 repository skill 또는 `AGENTS.md`의 durable verification 규칙으로 승격하는 편이 적절하다.
