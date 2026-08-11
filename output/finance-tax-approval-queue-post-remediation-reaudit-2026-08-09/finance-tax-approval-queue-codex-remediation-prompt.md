# Codex 실행 프롬프트 — Finance Approval Queue 최종 개선

아래 작업을 `C:\dev\massage-on-demand-vn`에서 직접 수행하라. 조사나 계획만 제출하지 말고, 현재 코드를 읽고 원인을 재현한 뒤 필요한 코드와 테스트를 수정하고 실제 브라우저 검증까지 완료하라.

## 목표

`http://localhost:3101/finance-tax/approval-queue`를 실제 Finance 운영자가 다음 순서로 빠르게 사용할 수 있는 승인 작업공간으로 완성한다.

1. 지금 실행 가능한 결정을 바로 찾는다.
2. 대상·금액·은행·지갑·회계 영향을 확인한다.
3. Ready 작업과 수리/Blocked 작업을 혼동하지 않는다.
4. 특정 요청의 근거 화면으로 정확히 이동한다.
5. 1440px 데스크톱에서 표와 버튼을 가로 스크롤이나 글자 단위 줄바꿈 없이 읽는다.

현재 구현은 많이 개선됐지만 아직 운영 배포 기준을 충족하지 못한다. 특히 화면에 `3 ready`라고 표시되는 환불 3건이 최대 25행 목록에서도 한 건도 노출되지 않는 P0 결함을 반드시 해결해야 한다.

## 작업 전에 반드시 읽을 자료

1. 저장소 지침
   - `C:\dev\massage-on-demand-vn\AGENTS.md`
2. 최종 재감사 보고서
   - `C:\dev\massage-on-demand-vn\output\finance-tax-approval-queue-post-remediation-reaudit-2026-08-09\finance-tax-approval-queue-post-remediation-reaudit.md`
3. 같은 폴더의 `01`~`13` 증거 이미지
4. 주요 코드 시작점
   - `apps/admin_web/app/finance-tax/approval-queue/page.tsx`
   - `apps/admin_web/app/finance-tax/approval-queue/actions.ts`
   - `apps/admin_web/app/finance-tax/approval-queue/page.spec.tsx`
   - `apps/admin_web/app/finance-tax/approval-queue/finance-approval-snapshot-control.tsx`
   - `apps/admin_web/components/confirm-dialog-focus-boundary.tsx`
   - `apps/admin_web/components/use-admin-modal-focus.ts`
   - `apps/admin_web/components/admin-segmented-control.tsx`
   - `apps/admin_web/app/finance-tax/finance-data-table.tsx`
   - `apps/admin_web/app/globals.css`
   - `apps/admin_web/lib/admin-api.ts`
   - `apps/admin_web/lib/admin-operator-access.ts`
   - `apps/admin_web/lib/admin-operator-access-model.ts`
   - `apps/api/src/admin/admin.service.ts`
   - `apps/api/src/admin/admin.service.spec.ts`
   - Approval Queue API route/DTO와 Payout·Withdrawal 상세 화면의 필터 및 anchor 구현

보고서의 줄 번호는 참고용이다. 현재 파일에서 `rg`로 실제 호출자와 타입 사용처를 다시 찾아라.

## 절대 조건

- **1440px 이상 데스크톱만 지원 범위다. 1024px 이하 UI는 검사하거나 수정하지 마라.** 기존 모바일 CSS를 불필요하게 건드리지 마라.
- 현재 디자인 시스템, 색상 토큰, 공통 Admin 컴포넌트를 유지하라. 전면 리디자인이나 새 UI 라이브러리를 도입하지 마라.
- 새 dependency를 추가하지 마라. 기존 React/Next.js/TypeScript/CSS/Prisma 패턴으로 해결하라.
- dirty worktree의 사용자 변경을 보존하라. 관련 없는 수정, 포맷 전체 재작성, 파일 되돌리기, destructive Git 명령을 하지 마라.
- mock 수치나 하드코딩으로 현재 `3 ready`, `109 state mismatch`를 맞추지 마라. DB 상태에서 계산되는 일반화된 계약이어야 한다.
- Finance 안전장치를 약화하지 마라. maker-checker, actor-aware preflight, 상태 재검증, idempotency, 원자적 wallet/GL 처리, 서버 입력 검증을 그대로 보존하라.
- `STATE_MISMATCH` 환불에는 Approve/Reject를 절대 노출하지 마라.
- 브라우저 검증 중 확인 모달은 열어도 실제 Approve/Reject/Execute 최종 제출은 하지 마라. 금융 상태를 변경하는 검증은 테스트 더블과 자동화 테스트로 수행하라.
- 성능 문제는 계측 근거 없이 캐시, Redis, materialized view를 새로 만들지 마라.
- 페이지 분리는 필요한 작업 경계에만 적용하라. 한 번만 쓰는 factory, 범용 queue framework, 불필요한 hook/context를 만들지 마라.
- 결과 보고서만 작성하고 구현을 생략하지 마라. 이 프롬프트의 목적은 코드 수정과 검증 완료다.

## 작업 순서

### 1. 현재 상태를 재현하고 기준값을 기록하라

코드 수정 전에 로그인된 브라우저에서 1440 × 900으로 다음을 확인하라.

- Priority
- Refunds `take=10`, `take=25`
- Payouts
- Withdrawals
- Wallet 및 walletReview 필터
- Other approvals 세 하위 큐와 빈 상태
- Payout/Withdrawal/Refund/Wallet 확인 모달
- 레거시 reconciliation redirect
- Refresh
- 다크 테마

반드시 기록할 값:

- 각 summary의 Ready/Blocked/Stale/State mismatch/total
- Refunds `take=25`의 실제 Ready 행 수와 Approve refund 링크 수
- Priority/Refund/Payout/Wallet 표의 `clientWidth`, `scrollWidth`
- `document.documentElement.scrollWidth - clientWidth`
- Payout/Withdrawal 모달의 증거 필드 목록
- Cancel/ESC 후 `document.activeElement`
- 콘솔 오류

현재 보고서에서 확인된 기준은 다음과 같다.

- Refund: 112 open = 3 ready + 0 blocked + 109 state mismatch
- Payout: 4 pending = 2 ready + 2 blocked
- Withdrawal: 1 open
- Wallet: 10 pending = 0 ready + 1 blocked + 9 stale
- Refund `take=25`: Ready 행 0, Approve refund 0 — 이것이 P0 재현 기준이다.

데이터가 변경됐다면 새 실제 수치를 사용하되, Ready가 다른 상태 때문에 LIMIT 밖으로 밀리지 않는 일반화된 테스트를 만들어라.

### 2. P0 — 상태 분류 전에 LIMIT하는 서버 결함을 먼저 고쳐라

현재 환불 API는 `status = REQUESTED`를 `createdAt ASC`로 정렬하고 `take`를 적용한 뒤 UI 계층에서 `READY/BLOCKED/STATE_MISMATCH`를 분류한다. 이 때문에 오래된 109개 mismatch가 최대 25행을 모두 차지하고 Ready 3개가 사라진다.

필수 동작 계약:

1. `reviewState`를 서버 쿼리 단계에서 먼저 계산한다.
2. 그 다음 상태 필터와 운영 우선순위를 적용한다.
3. 마지막에 LIMIT/페이지네이션을 적용한다.
4. Ready 작업이 많은 Repair/Blocked 항목에 밀려 도달 불가능해지는 일이 없어야 한다.
5. summary 수와 실제 도달 가능한 상태별 목록 수가 논리적으로 일치해야 한다.

최소한 다음 상태 URL/API 계약을 제공하라.

- Refunds: `review=ready|state-mismatch|blocked|all`
- Payouts: `review=ready|blocked|all`
- Wallet의 기존 `walletReview=all|ready|blocked|stale`는 호환성을 유지한다.

URL은 새로고침·뒤로가기·딥링크에서 상태를 보존해야 한다.

Focused Refund 기본 화면은 다음처럼 구성하라.

- 첫 번째: `Ready for decision (n)` — 실행 가능 건, oldest-first
- 두 번째 또는 명시적 전환: `State repair (n)` — mismatch, oldest-first
- Blocked가 있으면 별도 상태로 구분
- 각 상태는 서버 페이지네이션 또는 cursor/next control을 가져 전체 항목에 도달할 수 있어야 한다.

Focused Payout은 다음처럼 구성하라.

- `Ready to close (n)`를 첫 번째로 표시
- `Blocked — evidence repair (n)`를 그 다음 표시
- 각 상태 안에서는 oldest-first
- 데이터가 25건을 넘어도 Ready가 Blocked 뒤로 사라지면 안 된다.

Priority도 한 배열의 상위 `take`에 모든 상태를 섞어 starvation을 만들지 마라. `Ready decisions`와 `Repair exceptions`를 독립된 bounded 결과로 받거나, 동일한 안전성을 보장하는 더 단순한 서버 계약을 사용하라. 핵심은 한 상태의 큰 건수가 다른 상태를 숨기지 않는 것이다.

구현 방식은 현재 Prisma/Nest 구조를 먼저 확인한 뒤 가장 작은 root-cause 수정으로 결정하라. UI에서 가져온 25개를 다시 정렬하는 방식은 금지한다. 그 방식은 26번째 이후 Ready를 살리지 못한다.

필수 회귀 테스트:

- 109 mismatch + 3 Ready 환불에서 Ready 3건이 첫 Ready 목록에 노출
- `take=10`에서도 Ready가 mismatch에 밀리지 않음
- Ready 목록의 actionable 행 수가 `refundReadyCount`와 일치
- mismatch 행에는 Approve/Reject 없음
- 30 Blocked + 2 Ready Payout에서 Ready 두 건이 우선 노출
- 상태별 다음 페이지 또는 cursor가 전체 항목에 도달
- query parsing의 잘못된 `review` 값은 안전한 기본값으로 정규화

### 3. Priority의 숫자와 문구를 실행 가능 상태 중심으로 고쳐라

현재 `112 / Needs approval`은 109개 상태 수리 항목까지 승인 대상으로 오해하게 한다.

다음 계약을 사용하라.

- Refund 카드
  - primary value: Ready count
  - scope: `Ready now`
  - detail: `n state repairs · n blocked`
- Payout 카드
  - primary value: Ready count
  - scope: `Ready now`
  - detail: `n blocked`
- Wallet 카드
  - primary value: Ready count
  - detail: `n blocked · n stale`
- 전체 Priority 요약
  - 실행 가능한 결정 수와 repair/review 수를 분리

`Needs approval`, `Missing`, `Recorded`, `Open payout queue`처럼 상태나 대상을 추측하게 만드는 문구를 구체화하라.

예:

- `Missing` → `Transfer reference missing`
- `Recorded` → `Bank account linked` 또는 `VCB · •••• 1234`
- `Open payout queue` → `Open payout <short-id>` 또는 컨텍스트가 포함된 접근 가능한 이름

### 4. 1440px 운영 가독성을 수정하라

작업 대상은 **1440 × 900 이상**이다. 작은 화면을 위한 별도 카드 변환이나 모바일 최적화를 추가하지 마라.

#### 작업공간 navigation

- `Priority / Refunds / Payouts / Withdrawals / Wallet / Other approvals`를 제목 우측의 제한된 actions 영역에서 제거한다.
- 제목 아래 전체 폭에 한 줄로 배치한다.
- 1440px에서 여섯 항목이 줄바꿈되지 않아야 한다.
- `AdminSegmentedControl`의 `semantics="navigation"` 또는 동등한 실제 `<nav aria-label="Finance approval workspaces">`를 사용한다.
- active 항목은 `aria-current="page"`를 유지한다.

#### Priority 표

현재 8열을 그대로 압축하지 마라. 운영 판단 단위로 5열 안팎으로 통합한다.

권장 구조:

- `Risk / Type`
- `Work` — 대상명과 축약 ID
- `Amount`
- `Age / Owner`
- `Control / Action`

필수 조건:

- 내부 ID가 글자 단위로 끊기지 않음
- `Unassigned`가 두 줄로 깨지지 않음
- Action이 첫 화면에서 잘리지 않음
- 표 내부 horizontal scrollbar가 없어야 함
- 읽기 어려울 정도로 폰트를 줄이지 말 것

ID는 기존 공통 컴포넌트가 있으면 재사용하고, 없으면 해당 페이지에 가장 작은 표현만 추가한다.

- 한 줄 유지
- 앞/뒤가 식별 가능한 축약 표시
- 전체 ID를 확인할 title 또는 상세
- 필요할 때만 Copy affordance

#### Refund 표

- Booking/Payment ID를 각각 한 줄 축약 표시
- Method/Payment state를 한 셀에서 명확히 구분
- Decision 열의 3~4개 세로 버튼을 단일 primary `Review`와 최소 보조 링크 구조로 정리
- 상태 불일치 행의 primary action은 `Open payment timeline`
- Ready 행의 primary action은 `Review refund`
- exact refund case와 payment timeline 링크는 유지

#### Wallet 표

현재 가로 폭은 유지하되 행 높이를 줄인다.

- 기본 행: Owner, adjustment type, amount, before→after, age, primary blocker, action
- 내부 owner ID, maker, reason, monthly period, attachment, preflight 세부는 `Evidence details`에 이동
- 기본 Owner/Request 셀은 두 줄 이내를 목표로 한다.
- 한 행의 정보가 어느 요청에 속하는지 관계를 잃지 않도록 row-level disclosure를 사용한다.

CSS는 Approval Queue 전용 class에 한정하고 전역 표 전체의 동작을 바꾸지 마라.

### 5. Payout/Withdrawal 확인 모달을 결재 가능한 증거 스냅샷으로 완성하라

현재 확인 모달의 안전한 구조는 유지한다.

- Cancel 첫 포커스
- maker/current approver/independent control
- primary blocker
- wallet/GL/tax impact
- generated snapshot time
- 서버 재검증

다음 필드를 실제 데이터 계약으로 추가하라.

#### Payout

- Request/batch ID
- Partner subject
- Amount/currency
- Lifecycle
- Maker
- Requested at
- Current approver
- Independent control
- Transfer reference
- Bank name
- Account last4 또는 기존 마스킹 값
- 연결 earning count
- withholding count 또는 closeout evidence summary
- Wallet before→after 또는 정확한 debit impact
- GL/settlement/tax impact
- Snapshot time
- 특정 payout batch로 이동하는 evidence 딥링크

#### Withdrawal

- Request ID
- Partner subject
- Amount/currency
- Lifecycle
- Maker/requested by
- Requested at
- Current approver
- Transfer reference
- Bank name
- Account last4 또는 기존 마스킹 값
- Wallet before→after
- GL/settlement/tax impact
- Primary blocker
- Snapshot time
- 특정 withdrawal request로 이동하는 evidence 딥링크

은행 전체 계좌번호나 민감정보를 노출하지 마라. 기존 마스킹 정책을 재사용하라.

현재 API가 `hasBankAccount`만 제공한다면 필요한 최소 select/type/response 필드를 additive하게 확장하라. API에서 얻을 수 없는 값을 UI 문구로 추측하지 마라.

딥링크 요구:

- `/payouts?workspace=operations&review=in-progress` 같은 일반 목록 링크만 사용하지 마라.
- Payout 화면이 `payoutBatchId` 또는 동등한 정확한 검색 파라미터를 소비하고 해당 행/상세로 포커스해야 한다.
- Withdrawal 화면이 `withdrawalId`를 소비하고 해당 요청으로 이동해야 한다.
- URL 파라미터와 anchor 생성/소비 양쪽을 모두 구현하고 테스트하라.

### 6. Focused view의 상태 계약을 일관되게 만들어라

- Payout 헤더: `n ready · n blocked`, total은 보조
- Withdrawal 헤더: paid closeout ready/blocked/review required를 분해
- Refund 헤더: ready/blocked/state mismatch를 유지하되 현재 선택한 상태와 `shown / total`을 구분
- Wallet 헤더와 필터의 현재 좋은 summary 계약을 유지
- Other approvals 빈 상태는 현재처럼 표와 비활성 결정 버튼을 숨긴다.
- 레거시 reconciliation redirect와 필터 보존은 깨뜨리지 마라.

### 7. 모달 포커스 복귀를 실제 브라우저에서 고쳐라

현재 소스에는 `returnFocus?.focus()`가 있지만 URL 기반 모달 전환 때문에 ESC/Cancel 후 실제 포커스가 BODY가 된다. 문자열 존재 테스트가 아니라 브라우저 동작을 고쳐라.

가장 작은 안정적인 방식을 선택하라.

권장 최소 방식:

1. Review 링크에 안정적인 DOM id를 부여한다.
2. confirm URL/cancel URL에 `returnFocus=<id>`를 안전하게 보존한다.
3. cancel/ESC 복귀 후 해당 요소가 존재하면 focus한다.
4. 없는 경우 적절한 queue heading 또는 table region으로 fallback한다.

기존 URL 기반 서버 재검증 구조를 유지할 수 있다면 client modal 전면 전환은 하지 마라.

필수 E2E:

- Review 클릭
- Cancel이 첫 포커스인지 확인
- Tab/Shift+Tab trap 확인
- ESC
- 원래 Review 링크가 `document.activeElement`
- 다시 열고 Cancel 링크 클릭
- 원래 Review 링크가 `document.activeElement`

### 8. 로딩·권한·문서 메타데이터를 단단하게 만들어라

#### Refresh

- `Refresh now` 중 루트 `Shift Command / Loading records`가 보이지 않게 한다.
- Approval Queue 문맥을 유지하는 route-level loading 또는 작은 refresh pending 상태를 사용한다.
- 기존 데이터는 가능하면 유지하고 `Refreshing approval snapshot…`을 알린다.
- 완료 후 generatedAt이 바뀌어야 한다.

#### Permission state

감사 중 Wallet 이동에서 한 번 `Access restricted`가 나타났으나 이후 재현되지 않았다. 이를 Wallet 권한 매핑 버그라고 가정하지 마라.

- operator access 조회 실패와 실제 category 403을 구분할 수 있는지 조사한다.
- 조회 실패는 `Permissions unavailable` + retry 가능한 상태로 표시한다.
- 실제 권한 없음만 `Access restricted`로 표시한다.
- 기존 fail-closed 보안은 유지한다.
- 오류를 권한 허용으로 폴백하지 마라.
- 이 구분이 현재 API 계약상 불가능하면 최소 additive 상태 계약을 추가하고 테스트한다.

#### Metadata와 approver coverage

- 문서 title을 `Finance Approval Queue | HANDS Admin`으로 설정한다.
- current approver가 없거나 독립 승인자가 부족한 경우에만 조건부 경고와 `/finance-tax/finance-approvers` 링크를 표시한다.
- 정상 상태에서 상시 경고를 추가하지 마라.

### 9. 코드 구조는 필요한 만큼만 정리하라

`page.tsx`는 약 1,937행이다. 이번 변경으로 더 큰 단일 파일이 되지 않도록 명확한 작업 경계만 분리할 수 있다.

권장 경계:

- query/view/review/take 파싱과 href builder
- queue presentation model과 상태별 정렬
- confirmation evidence model
- 각 workspace section

하지만 이 분리를 별도 대형 리팩터링으로 만들지 마라. 현재 수정에 직접 필요한 부분만 추출하고, 한 구현만 가진 범용 abstraction을 만들지 마라. 보호 영역이나 관련 없는 Admin 페이지는 건드리지 마라.

## 검증 요구사항

### 자동화 테스트

최소 다음 명령을 실행하라. 실제 package script가 달라졌다면 같은 범위의 현재 명령을 사용하고 보고하라.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/finance-tax/approval-queue/page.spec.tsx app/finance-tax/approval-queue/actions.spec.ts app/finance-tax/approval-queue/finance-approval-snapshot-control.spec.ts app/finance-tax/finance-data-table.spec.tsx components/confirm-dialog.spec.tsx components/admin-segmented-control.spec.tsx

npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "finance approval queue"

npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

Protected area를 실제로 변경했다면 `AGENTS.md`가 요구하는 추가 검증을 수행한다. 실행하지 못한 검증은 이유와 위험을 명시하라.

테스트는 단순 source string 검사만 추가하지 마라. 상태 분류·LIMIT·정렬·딥링크·focus처럼 실제 동작 계약을 검증하라.

### 실제 브라우저 QA

로그인된 브라우저에서 1440 × 900으로 한 번의 종합 수정 후 검사하고, 필요한 결함을 한 번에 수정한 뒤 최종 확인은 한 차례만 수행하라.

필수 캡처:

1. Priority 상단과 한 줄 workspace navigation
2. Priority 표
3. Refund Ready
4. Refund State repair
5. Payout Ready/Blocked
6. Payout confirmation
7. Withdrawal confirmation
8. Wallet 기본 표
9. Other approvals 빈 상태
10. 다크 테마 Priority

DOM/동작 완료 기준:

- 1440 × 900에서 page-level horizontal overflow = 0
- Priority/Refund/Payout/Wallet table 내부 horizontal overflow = 0
- Action 열과 primary action이 스크롤 없이 보임
- ID, `Unassigned`, 상태, 버튼 문구가 글자 단위로 끊기지 않음
- workspace navigation 6개가 한 줄
- Ready 환불 수와 실제 Ready 행/Review action 수가 일치
- Payout Ready가 Blocked보다 먼저 노출
- Payout/Withdrawal 모달에 요구 증거 존재
- evidence 링크가 정확한 request를 엶
- Cancel/ESC 후 trigger focus 복귀
- Refresh 후 generatedAt 갱신, Approval Queue 문맥 유지
- light/dark 모두 판독 가능
- 콘솔 오류 0

완료 기준 중 하나라도 실패하면 완료라고 보고하지 말고 원인을 수정하거나 정확한 blocker를 남겨라.

## 반드시 보존할 현재 장점

- `REQUESTED refund + non-CAPTURED payment`의 `STATE_MISMATCH` 분류
- mismatch 행의 Approve/Reject 비노출
- server-side payment state revalidation
- maker-checker와 actor-aware preflight
- 정확한 cross-queue summary
- generatedAt snapshot과 Refresh
- exact refund case/payment timeline 딥링크
- canonical Bank Reconciliation redirect 및 필터 보존
- Other approvals의 compact empty state
- Wallet before→after와 stale/blocked/ready 계약
- light/dark 디자인 토큰
- 선택한 focused view만 상세 rows를 불러오는 projection
- 페이지 책임: Approval Queue는 결정, Bank Reconciliation은 post-approval matching

## 금지되는 임시 해결

- UI에서 받은 10/25행만 재정렬
- Ready count를 하드코딩하거나 summary 숫자만 수정
- `take=1000`으로 문제를 숨김
- 페이지네이션 없이 “Showing 25 of 112”만 표시
- 작은 폰트로 열을 억지로 맞춤
- 긴 ID를 `overflow-wrap:anywhere`로 글자 단위 분해
- 모든 행에 여러 개의 동일한 일반 링크 유지
- 은행 증거를 `Recorded`, `Linked`, `Available` 같은 불충분한 문구로 대체
- 실제 권한 조회 실패를 허용 상태로 폴백
- 확인 모달에서 금융 안전 재검증 제거
- 새 디자인 시스템이나 새로운 범용 queue framework 도입
- 관련 없는 글로벌 CSS/페이지/API 리팩터링
- 실제 Finance 승인 버튼을 눌러 QA

## 최종 산출물

1. 실제 소스와 테스트 수정
2. 1440 × 900 최종 증거 캡처
3. 다음 파일에 구현 보고서 작성
   - `C:\dev\massage-on-demand-vn\output\finance-tax-approval-queue-post-remediation-reaudit-2026-08-09\finance-tax-approval-queue-remediation-implementation-report.md`

구현 보고서에는 다음을 포함하라.

- 최종 판정: 완료 / 부분 완료 / blocked
- 변경 파일과 각 변경 목적
- P0 원인과 수정된 서버 query/order/filter 계약
- 실제 데이터에서 Ready가 도달 가능해진 증거
- 1440px 측정값 before/after
- confirmation evidence 필드와 request-specific 링크
- 접근성·포커스 검증 결과
- 실행한 명령과 pass/fail/skipped
- protected area 변경 여부
- 미해결 위험
- 스크린샷 경로

최종 응답은 다음 순서로 간결하게 작성하라.

1. 운영 결과
2. 핵심 수정
3. 검증 결과
4. 변경 파일
5. 남은 위험
6. 구현 보고서 링크

