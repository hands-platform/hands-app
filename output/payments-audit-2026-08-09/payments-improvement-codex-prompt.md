# `/payments` 개선 구현용 Codex 프롬프트

아래 `START OF PROMPT`부터 `END OF PROMPT`까지 복사하여 `C:\dev\massage-on-demand-vn`을 작업공간으로 연 Codex에 전달한다.

---

## START OF PROMPT

`C:\dev\massage-on-demand-vn` 프로젝트의 HANDS Admin `/payments` 화면과 결제 액션 흐름을 운영자가 안전하고 빠르게 사용할 수 있는 결제 command center로 개선해라. 단순 디자인 제안이나 보고서 작성에서 끝내지 말고, 관련 Admin Web·API 코드와 테스트를 실제로 수정하고 1440px 로그인 화면에서 검증해라.

### 1. 반드시 먼저 확인할 자료

작업 전 다음 자료와 프로젝트 규칙을 직접 읽어라.

1. 저장소의 모든 적용 가능한 `AGENTS.md`
2. `C:\dev\massage-on-demand-vn\output\payments-audit-2026-08-09\payments-deep-audit-report.md`
3. 같은 폴더의 `01`~`17` PNG 증빙 화면
4. 현재 `/payments`, `/payments/[id]`의 Admin Web 구현
5. 결제 목록/summary/action/callback/refund를 담당하는 API 구현과 테스트
6. 공용 Admin 디자인 토큰, table, filter, dialog, action-menu 패턴

현재 worktree가 이미 수정돼 있을 수 있다. 먼저 `git status`를 확인하고 기존 사용자 변경을 보존해라. 관련 없는 변경을 되돌리거나 덮어쓰지 마라.

계획을 짧게 세운 뒤 곧바로 구현을 진행해라. 자료에 없는 중요한 금융 정책을 임의로 만들지 말고, 코드·테스트·현재 동작으로 확인할 수 없는 정책만 명확한 blocker로 보고해라. 단순한 구현 선택은 합리적으로 판단하고 계속 진행해라.

### 2. 작업 목표

최종 결과는 다음을 모두 만족해야 한다.

1. 1440px 이상 데스크톱에서 결제 10건을 빠르게 비교할 수 있다.
2. 목록, 상세, 확인 창, API가 동일한 결제 액션 가능 여부와 이유를 사용한다.
3. 취소·만료·노쇼 부킹의 결제를 잘못 Capture할 수 없다.
4. 활성 Cash collection과 종료 부킹에 남은 레거시 Cash 결제를 분리한다.
5. API 오류나 액션 실패를 0건·정상·성공으로 오인하지 않는다.
6. 검색, 큐, 필터, 정렬, 페이지 위치가 액션 확인과 상세 왕복 후에도 유지된다.
7. 콜백 없음, 콜백 검증 실패, 검증 완료를 서로 다른 상태로 표현한다.
8. 모든 금액 변경 액션은 실행 전 근거와 실행 후 receipt를 제공한다.

1024px 이하 반응형/모바일 화면은 이번 작업 범위에서 완전히 제외한다. 모바일용 재설계나 모바일 QA에 시간을 사용하지 마라. 기존 반응형 코드를 의도적으로 망가뜨리지는 말되, 완료 판정은 1440px 이상만 기준으로 한다.

### 3. P0 — 반드시 구현할 항목

#### P0-A. 붕괴한 결제 목록을 compact operations table로 교체

현재 각 행의 `Ops hint` 셀에 5개의 `Payment action execution map`을 반복 렌더링하여 한 글자씩 세로로 쌓이고, 10행 문서 높이가 약 135,000~155,000px가 된다.

다음 구조로 수정해라.

| 열 | 내용 |
|---|---|
| Payment / Booking | 짧은 결제 ID와 부킹 ID, 상세 링크, 복사 기능 |
| Customer / Partner | 고객 식별값과 배정 파트너 |
| Method / Amount | 결제수단과 현지화된 금액 |
| Payment state | 결제 상태와 필요한 gateway ref 요약 |
| Booking state | 부킹 lifecycle과 서비스 결과 |
| Evidence | `Verified`, `Missing`, `Conflict`, `Not applicable` 중 하나 |
| Age / SLA | 실제 조치 대기 기준 시각과 SLA |
| Next safe action | 추천 액션 하나와 한 줄 이유 |
| More | 나머지 액션 메뉴 |

요구사항:

- 행마다 전체 실행 맵을 렌더링하지 마라.
- 전체 실행 맵은 결제 상세 또는 review drawer에서만 보여라.
- 행 기본 높이는 72~88px, 최대 120px를 목표로 한다.
- ID와 긴 gateway ref는 줄임표 처리하고 전체값 확인/복사가 가능해야 한다.
- 핵심 열은 1440px에서 한 글자 폭으로 축소되거나 서로 겹치면 안 된다.
- 테이블 footer와 pagination까지 정상적인 스크롤 거리 안에서 도달 가능해야 한다.
- 기존 디자인 시스템의 색상, typography, radius, spacing, table 컴포넌트를 재사용해라.

#### P0-B. 단일 Payment Action Decision 정책 도입

현재 다음 로직이 서로 다르다.

- `payment-action-execution-map.ts`
- 목록 `ActionMenu`의 disabled 조건
- `payment-action-confirmation.ts`
- 상세 페이지 ActionMenu
- API `capture/release/refund/sync` 전이 조건

이 중복을 제거하고 서버가 계산하는 하나의 정책을 source of truth로 만들어라. 최소한 다음 계약을 제공해야 한다.

```ts
type PaymentActionDecision = {
  action: 'SYNC' | 'CAPTURE' | 'RELEASE' | 'REQUEST_REFUND';
  state: 'AVAILABLE' | 'REVIEW_REQUIRED' | 'BLOCKED';
  recommended: boolean;
  reasonCode: string;
  reason: string;
  requiredEvidence: string[];
  verifiedAt: string;
  policyVersion: string;
};
```

구현 세부사항:

- 목록과 상세 API 응답에 action decisions를 포함하거나, 동일한 도메인 함수를 서버와 응답 presenter가 공유해라.
- UI는 자체 조건을 다시 만들지 말고 decision을 그대로 표시하고 disabled 상태에 사용해라.
- 실제 액션 API는 요청 시 동일 정책을 다시 계산해야 한다. UI가 전달한 decision을 신뢰하지 마라.
- 기존 실행 맵이 필요하면 이 decision으로부터 파생해라. 별도 조건문을 유지하지 마라.
- `AVAILABLE`, `REVIEW_REQUIRED`, `BLOCKED`의 색상뿐 아니라 텍스트와 이유가 모두 보여야 한다.

최소 정책은 다음과 같다.

| 액션 | 허용/권장 조건 | 반드시 차단할 조건 |
|---|---|---|
| Online Capture | 결제 `AUTHORIZED`, 부킹 `COMPLETED`, 필요한 서비스/결제 증거 충족 | 부킹 `CANCELLED`, `EXPIRED`, `NO_SHOW`, `REFUNDED`, 미완료 서비스 |
| Cash Capture | 결제 `CASH/PENDING`, 부킹 `COMPLETED`, 수금 증거 충족 | 종료/취소/만료/노쇼 부킹, 수금 증거 없음 |
| Release | 온라인 `AUTHORIZED`이며 부킹이 미캡처 종료 상태일 때 권장 | 이미 terminal payment, 정책상 활성 서비스 중 임의 release |
| Refund request | 결제 `CAPTURED`이며 사유/증거를 승인 큐에 전달 | `PENDING`, `AUTHORIZED`, `RELEASED`, `REFUNDED` |
| Sync | 외부 gateway 결제이며 provider ref가 존재 | CASH, CUSTOMER_WALLET, provider ref 없음 |

기존 정책이 이 표와 다르다는 명확한 근거를 코드에서 찾으면 테스트와 최종 보고에 근거를 남기고 더 안전한 기존 정책을 유지해라.

#### P0-C. API에서도 부킹 lifecycle을 검증

`PaymentsService.capture()`가 결제 상태만 확인하는 현재 구조를 수정해라.

- Capture 전에 결제와 연결된 부킹 상태 및 필수 evidence를 같은 트랜잭션 경계에서 확인해라.
- `AUTHORIZED + CANCELLED/EXPIRED/NO_SHOW` 온라인 결제 Capture는 409로 거부해라.
- `CASH/PENDING + CANCELLED/EXPIRED/NO_SHOW` Capture도 409로 거부해라.
- 동시 요청으로 상태가 바뀌는 경우 원자적 전이와 idempotent 결과를 유지해라.
- Release와 refund request도 동일 decision 정책으로 재검증해라.
- 금액 전이 전후 상태와 정책 결과가 audit log에 남아야 한다.

#### P0-D. 액션 실패를 삼키지 말고 명확한 결과 제공

현재 `syncPayment`, `capturePayment`, `releasePayment`, `settleCashDebt`가 `adminPost(..., null)` fallback을 사용하여 4xx/5xx/권한 오류를 성공처럼 숨길 수 있다.

- 금액/상태 변경은 `adminPostOrThrow` 또는 동등한 구조화 오류 방식을 사용해라.
- 실패 시 페이지에 이해 가능한 error state와 재시도 방법을 표시해라.
- 성공 시 다음 receipt를 표시하거나 반환해라.

```ts
type PaymentActionReceipt = {
  auditId: string;
  paymentId: string;
  action: string;
  before: { paymentStatus: string; bookingStatus: string };
  after: { paymentStatus: string; bookingStatus: string };
  actorId: string;
  completedAt: string;
  idempotencyKey: string;
};
```

- 처리 중에는 submit을 비활성화해 중복 요청을 방지해라.
- receipt가 오기 전 성공으로 표시하지 마라.
- 재시도 가능한 오류와 정책상 차단을 다른 문구로 보여라.
- paymentId 등 URL path parameter는 모두 안전하게 encode해라.

#### P0-E. 액션 URL과 목록 컨텍스트 보존

현재 `paymentActionConfirmHref()`가 `confirm`과 `paymentId`만 남겨 `range`, `review`, `age`, `sla`, `sort`, `page`, `pageSize`, 검색/필터를 잃는다. 확인 대상도 현재 페이지의 10개 행에서만 찾아 오래된 행은 확인 창이 열리지 않을 수 있다.

- 모든 액션 링크에 현재 목록 컨텍스트 또는 안전한 `returnTo`를 보존해라.
- confirm 대상은 현재 10개 행에 없더라도 paymentId로 서버에서 별도 조회해라.
- Cancel, Escape, backdrop, 상세 `Back to payments`, 액션 완료 후 이동이 원래 위치로 돌아가야 한다.
- `returnTo`는 open redirect가 되지 않도록 내부 `/payments` 경로만 허용해라.
- 잘못된 paymentId는 무시하지 말고 명확한 not-found/error 상태를 보여라.

#### P0-F. 조회 오류를 0건 또는 `Clear`로 대체하지 않기

현재 `/payments`는 `adminGet(..., [])`, summary는 `adminGet(..., null)`, 상세는 fallback `null`을 사용한다.

- `adminGetResult` 또는 동등한 result 타입으로 성공/실패를 구분해라.
- 목록 또는 summary 조회 실패를 빈 큐와 0개 지표로 표시하지 마라.
- 상세 API 장애와 실제 404를 구분해라.
- 오류 상태에는 `Data unavailable`, 마지막 시도 시각, Retry를 제공해라.
- 오래된 성공 데이터를 표시할 경우 `Stale`과 마지막 성공 시각을 표시하고 금액 액션은 서버 재검증 전 차단해라.

### 4. P1 — 운영 구조 개선

#### P1-A. 큐 IA 재구성

현재 11개 큐를 다음 3개 그룹으로 바꿔라.

```text
Live decisions
- Capture ready
- Release recommended
- Active cash collection

Exceptions
- Stale or lifecycle mismatch
- Missing gateway evidence
- Failed active payment
- Unverified callback attempts
- Missing expected callback
- Gateway state mismatch
- Cash debt

History
- Captured
- Released
- Refunded
- Verified callback history
```

- Live와 Exceptions를 우선 노출하고 History는 낮은 우선순위 또는 접힌 영역으로 둔다.
- `Needs action`이라는 포괄 큐는 `Open payment decisions`로 이름을 바꾸고 위 live/exception 큐의 합계와 의미가 일치하게 해라.
- 종료 부킹에 남은 CASH/PENDING과 AUTHORIZED hold는 `Stale or lifecycle mismatch`로 격리해라.
- 레거시 데이터가 실시간 큐를 오염시키지 않게 조건을 서버에서 적용해라.

#### P1-B. 검색과 필터

다음을 서버 필터와 URL query로 구현해라.

- Search: payment ID, booking ID, customer phone, provider/gateway ref
- Payment method
- Payment status
- Booking status
- Evidence state
- Age/SLA
- Review owner 또는 assignee가 현재 모델에 존재하면 owner

요구사항:

- 적용된 필터를 테이블 위 제거 가능한 chip으로 보여라.
- `Clear filters`를 제공해라.
- 검색/필터/페이지는 URL로 재현 가능해야 한다.
- 검색어는 서버에서 안전하게 정규화하고 최대 길이를 제한해라.
- 검색 추가로 N+1 query를 만들지 마라.

#### P1-C. 상단 지표를 운영 결정 중심으로 단순화

상단 9개 동일 크기 카드를 다음 4개 operational health 항목으로 줄여라.

- Capture ready
- Release recommended / stale holds
- Evidence conflicts
- Active cash collection

- History 수치는 별도 보조 영역으로 낮춰라.
- 현재 큐에 의해 지표가 필터된다면 `Within this queue`를 명시해라.
- 가능하면 상단 health strip은 전역 open 상태로 유지해라.
- 모두 0이면 9개 빈 카드 대신 명확한 empty success state 하나를 보여라.

#### P1-D. 날짜·Age·SLA 의미 수정

현재 Range는 booking `createdAt`, Age와 Authorized SLA는 booking `updatedAt`을 사용한다.

- 결제 모델에 실제 `createdAt`, `authorizedAt`, `capturedAt`, `releasedAt`, `refundedAt`, `actionableAt`이 존재하는지 먼저 확인해라.
- 존재하면 결제/액션 기준 시각을 사용해라.
- 존재하지 않으면 booking 시각을 `Record date`라고 속이지 말고 `Booking created at` 또는 `Booking updated at`으로 정확히 표시해라.
- 안전한 additive migration과 null-safe backfill이 가능한 경우 실제 payment timestamps를 추가해라.
- 근거 없는 과거 timestamp를 booking 시각에서 복제해 만들지 마라.
- Range, Age, SLA가 각각 어떤 timestamp를 쓰는지 UI 도움말과 테스트에 명시해라.

#### P1-E. 수단별 Evidence 정책

- `Missing refs`를 `Missing gateway evidence`로 변경해라.
- MOMO/VNPAY/CARD는 수단별 provider ref, callback, status-query 증거를 검사해라.
- CUSTOMER_WALLET은 providerRef가 아니라 wallet reservation/release ledger를 검사해라.
- CASH는 gateway ref가 아니라 수금 증거를 검사해라.
- 콜백 시도 0건을 `Trace ready`나 검증 완료로 표시하지 마라.
- 상태를 `No attempts recorded`, `Unverified`, `Verified`, `Mismatch`, `Not applicable`로 구분해라.

### 5. 상세·확인 화면 요구사항

상세 상단의 `No urgent block`을 제거하고 action decision 기반 `Decision strip`으로 교체해라.

Decision strip에는 다음을 표시한다.

- Recommended action
- 가장 중요한 risk 또는 blocked reason
- Payment/Booking 현재 상태
- Evidence 상태
- 마지막 검증 시각
- 정책 버전

확인 창 또는 review drawer에는 다음이 반드시 있어야 한다.

- 고객/부킹/결제 식별값
- 현지화 금액
- 결제수단과 gateway ref
- 현재 payment status와 booking status
- 실행 전 상태와 예상 실행 후 상태
- callback/status-query/서비스 완료/수금 증거
- required evidence checklist
- 금액 변경 사유 입력
- 실행 actor 또는 로그인 운영자
- 추천 액션 한 개만 primary button
- 차단 액션의 구체적 이유

`300000 VND`처럼 표시하지 말고 기존 money formatter를 사용해 `300,000 VND`처럼 통일해라.

문구는 다음 기준을 반영해라.

| 현재 | 변경 |
|---|---|
| Needs action | Open payment decisions |
| Cash collection | Active cash collection |
| Missing refs | Missing gateway evidence |
| Callback review | Unverified callback attempts |
| No callback | No callback attempts recorded |
| Trace ready | Callback evidence verified 또는 No attempts recorded |
| No urgent block | Recommended action / Blocked reason |
| Cash fee gate Clear | Not applicable / Not evaluated / No open cash debt |
| Record date | 실제 사용 시각 이름 |

Unknown, Not applicable, Not evaluated, Verified를 서로 바꿔 쓰지 마라. 데이터가 없는 상태를 `Clear`로 표현하지 마라.

### 6. 접근성 요구사항

- heading hierarchy와 table header association을 유지해라.
- 상태를 색상만으로 전달하지 마라.
- Action menu와 dialog의 accessible name이 결제 대상을 포함해야 한다.
- Confirm dialog에서 초기 focus, Cancel→Confirm Tab, Confirm→Cancel 순환, Shift+Tab, Escape, backdrop close, 원래 trigger로 focus return을 검증해라.
- disabled action은 단순 숨김보다 차단 이유를 읽을 수 있게 제공해라.
- drawer/dialog가 열린 동안 배경 `inert`와 `aria-hidden` 처리를 유지해라.
- 고위험 버튼은 충분한 명칭과 focus-visible 상태를 가져야 한다.

### 7. 성능 요구사항

- 행마다 실행 맵, callback card, settlement form 전체를 반복 렌더링하지 마라.
- 10행 목록의 전체 문서 높이는 정상적인 페이지 범위, 목표 2,500px 안팎이어야 한다.
- 1440×900에서 첫 5~8행과 핵심 열을 현실적인 스크롤로 확인할 수 있어야 한다.
- 10행 목록의 DOM 노드는 목표 900 이하로 줄이되 접근성 구조를 희생하지 마라.
- 서버 페이지네이션을 유지하고 N+1 query를 추가하지 마라.
- summary의 다중 count query가 병목인지 실제 호출 구조를 확인하고, 필요한 경우 조건부 aggregate 또는 캐시 전략으로 줄여라. 추측으로 복잡한 캐시 계층을 추가하지 마라.
- 로컬 warm navigation과 안정화 시간을 수정 전후로 측정해 최종 보고에 포함해라.

### 8. 테스트 — 기존 테스트 통과만으로 완료 처리 금지

현재 확인된 기존 테스트는 모두 통과하지만 P0 결함을 잡지 못했다.

- Admin Web payment: 12 files / 62 tests passed
- API payment 핵심: 5 files / 62 tests passed
- API admin service payment: 49 payment tests passed

반드시 다음 회귀 테스트를 추가해라.

#### API/도메인 테스트

1. `AUTHORIZED + COMPLETED` 온라인 결제 Capture 가능
2. `AUTHORIZED + CANCELLED/EXPIRED/NO_SHOW` Capture 409
3. `CASH/PENDING + COMPLETED + collection evidence` Capture 가능
4. `CASH/PENDING + CANCELLED/EXPIRED/NO_SHOW` Capture 409
5. Refund request는 `CAPTURED`만 가능
6. CUSTOMER_WALLET은 providerRef 부재만으로 missing gateway evidence가 되지 않음
7. 동일 idempotency key 재요청이 중복 전이를 만들지 않음
8. 목록, 상세, 실행 API가 동일 action decision을 반환/사용
9. audit receipt에 before/after, actor, policy version이 남음

#### Admin Web 테스트

1. API 실패가 0건/empty success로 렌더링되지 않음
2. action decision이 `BLOCKED`이면 메뉴·상세·확인 모두 비활성화되고 같은 이유 표시
3. Refund action은 CAPTURED 외 상태에서 비활성화
4. action/cancel/detail/back 후 range/review/filter/sort/page 유지
5. 현재 페이지에 없는 paymentId도 확인 대상 별도 조회
6. callback 0건은 `No attempts recorded`
7. CUSTOMER_WALLET은 gateway ref 경고 대상이 아님
8. Cash terminal mismatch가 Active cash가 아닌 Exception 큐에 포함
9. keyboard modal focus lifecycle

#### 1440px 브라우저 검증

로그인 세션이 있는 in-app browser가 사용 가능하면 그것을 사용해라. 다음 상태를 1440×900에서 직접 캡처하고 시각적으로 확인해라.

- 기본 Open payment decisions
- Capture ready
- Release recommended 또는 stale hold
- Active cash collection
- Stale/lifecycle mismatch
- Missing gateway evidence
- Callback empty/unverified/verified 상태
- Payment detail Decision strip
- Capture/Release/Refund 확인 창
- API 오류 상태
- 빈 큐 상태

스크린샷을 찍는 것만으로 완료하지 말고, 각 이미지를 직접 열어 글자 겹침, 잘림, 과도한 높이, 열 폭, 버튼 우선순위, 문구 모순을 확인해라.

### 9. 권장 검증 명령

프로젝트의 실제 package script와 AGENTS.md 지침을 우선하되 최소한 다음을 실행해라.

```powershell
# Admin Web payment tests
cd C:\dev\massage-on-demand-vn\apps\admin_web
npm.cmd test -- app/payments

# API payment tests
cd C:\dev\massage-on-demand-vn\apps\api
npm.cmd test -- src/payments/payments.service.spec.ts src/payments/payments.controller.spec.ts src/payments/payment-admin-audit.spec.ts src/payments/payment-admin-data.spec.ts src/payments/payment-refund-audit.spec.ts

# Admin payment filter/summary tests
npm.cmd test -- src/admin/admin.service.spec.ts -t payment
```

수정한 범위의 typecheck와 lint도 실행해라. 전체 저장소 검사가 기존 사용자 변경 때문에 실패하면, 관련 범위 검사 결과와 기존 실패를 구분해서 보고해라.

### 10. 변경 금지 및 보호 범위

- 관련 없는 관리자 페이지, 전역 navigation IA, 인증/권한 모델, 브랜드 디자인을 재설계하지 마라.
- `/refunds`와 Finance Approval Queue의 canonical 승인 책임을 `/payments`로 복제하지 마라.
- `/payments`의 Refund는 승인 요청 시작까지만 담당하게 유지해라.
- 테스트를 통과시키기 위해 안전 검사를 완화하거나 mock으로 핵심 정책을 우회하지 마라.
- API 오류를 fallback 데이터로 숨기지 마라.
- 새로운 UI library나 상태관리 library를 추가하지 마라. 기존 React/Next/Admin 컴포넌트로 해결해라.
- 기존 사용자 변경을 되돌리거나 관련 없는 파일을 포맷하지 마라.
- 실제 데이터를 삭제하거나 대량 보정하지 마라. 레거시 667 cash 건 등의 정리는 migration/ops 계획으로만 분리해라.
- 1024px 이하 대응을 완료 조건에 넣지 마라.

### 11. 완료 조건

다음 항목이 모두 충족될 때만 완료로 보고해라.

- [ ] 1440px에서 10행 table이 정상 행 높이와 열 폭으로 표시됨
- [ ] 행마다 반복되던 5단계 실행 맵 제거
- [ ] 목록/상세/확인/API가 동일 action decision 사용
- [ ] 취소·만료·노쇼 부킹 Capture가 API에서 차단됨
- [ ] Cash 활성 큐와 lifecycle mismatch 큐 분리
- [ ] Capture/Release/Sync 실패가 성공처럼 보이지 않음
- [ ] 필터·정렬·페이지·검색이 확인/취소/상세 왕복 후 유지됨
- [ ] 조회 장애가 0건, Clear, not-found로 오인되지 않음
- [ ] Search와 핵심 결제/부킹/evidence 필터 구현
- [ ] Range/Age/SLA timestamp 의미가 정확히 표시됨
- [ ] 콜백 없음/미검증/검증 완료 구분
- [ ] 금액 액션에 사유, 증거, actor, audit receipt 존재
- [ ] 신규 회귀 테스트와 기존 결제 테스트 통과
- [ ] 1440×900 before/after 캡처를 직접 비교 검수함

### 12. 최종 보고 형식

작업을 끝낸 뒤 다음 순서로 보고해라.

1. 구현 결과 한 문단
2. 해결한 P0/P1 항목 표
3. 변경 파일과 각 파일의 역할
4. action decision 최종 정책표
5. 1440px before/after 스크린샷 경로
6. 실행한 명령과 테스트 결과
7. 성능 수정 전후 수치
8. 남은 위험, migration 또는 운영 데이터 정리 항목
9. 기존 사용자 변경 중 건드리지 않은 보호 영역

코드 일부만 수정하고 나머지를 제안으로 남기지 마라. 안전하게 구현 가능한 항목은 끝까지 구현하고 검증해라. 완료하지 못한 항목이 있으면 `완료`라고 표현하지 말고 정확한 blocker, 영향, 다음 작업을 적어라.

## END OF PROMPT

