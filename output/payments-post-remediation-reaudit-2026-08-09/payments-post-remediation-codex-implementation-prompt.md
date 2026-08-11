# Payments 개선 후 재감사 반영 Codex 구현 프롬프트

아래의 `START OF PROMPT`부터 `END OF PROMPT`까지를 새 Codex 작업에 그대로 전달한다.

---

## START OF PROMPT

`C:\dev\massage-on-demand-vn`의 HANDS Admin `Payments` 영역을 수정하라.

이번 작업의 목표는 새 화면을 임의로 다시 디자인하는 것이 아니다. **2026-08-09 개선 후 재감사에서 확인된 남은 운영·정책·데이터 정확성 문제를 실제 코드로 해결하고, 1440px 이상 관리자 환경에서 검증 가능한 상태로 완성하는 것**이다.

계획이나 제안서만 작성하지 말고, 짧은 작업 계획을 세운 뒤 코드·테스트·필요한 DB 마이그레이션을 직접 구현하고 검증하라. 완료 조건을 충족하지 못했다면 완료했다고 보고하지 말라.

## 1. 반드시 먼저 읽을 자료

작업을 시작하기 전에 다음 자료와 현재 구현을 읽어라.

1. 저장소 루트부터 수정 대상까지 적용되는 모든 `AGENTS.md`
2. 재감사 보고서
   - `C:\dev\massage-on-demand-vn\output\payments-post-remediation-reaudit-2026-08-09\payments-post-remediation-reaudit-report.md`
3. 동일 폴더의 `01-`부터 `16-`까지 1440px 화면 캡처
4. 현재 Payments 프론트엔드
   - `apps/admin_web/app/payments/page.tsx`
   - `apps/admin_web/app/payments/[id]/page.tsx`
   - `apps/admin_web/app/payments/actions.ts`
   - `apps/admin_web/app/payments/payment-page-model.ts`
   - `apps/admin_web/app/payments/payment-page-rules.ts`
   - `apps/admin_web/app/payments/payment-page-presenters.tsx`
   - `apps/admin_web/app/payments/payment-operations-table-section.tsx`
   - `apps/admin_web/app/payments/payment-filter-board-section.tsx`
   - `apps/admin_web/app/payments/payment-page-links.ts`
   - `apps/admin_web/app/payments/payment-action-confirmation.ts`
   - 위 파일과 같은 폴더의 관련 테스트
5. 현재 Payments API와 정책 코드
   - `apps/api/src/payments/payment-action-decision.ts`
   - `apps/api/src/payments/payment-admin-data.ts`
   - `apps/api/src/payments/payments.service.ts`
   - `apps/api/src/payments/payments.controller.ts`
   - `apps/api/src/admin/admin.service.ts`
   - `apps/api/src/admin/admin.controller.ts`
   - `apps/api/src/admin/admin-payment.routes.ts`
   - `apps/api/src/admin/admin-payment-selects.ts`
   - 위 파일과 같은 폴더의 관련 테스트
6. 현금 부채를 수정하기 전에 반드시 정식 운영 흐름을 확인한다.
   - `/cash-settlements`
   - `/finance-tax/partner-bank-deposits`
   - 해당 페이지의 프론트, API, 증거 등록, 승인, allocation 흐름
7. Prisma/schema/migration 및 기존 idempotency·operation claim 모델

보고서의 줄 번호는 당시 소스 기준이다. 현재 코드에서 심볼과 실제 동작을 다시 찾아 확인한 뒤 수정하라.

## 2. 작업 전 안전 수칙

- 먼저 `git status --short`로 기존 변경 사항을 확인한다.
- 현재 변경은 사용자 작업일 수 있으므로 되돌리거나 덮어쓰지 않는다.
- 관련 없는 파일의 포맷 변경, 대규모 이름 변경, 전역 리팩터링을 하지 않는다.
- `git reset --hard`, 광범위 삭제 등 파괴적 명령을 사용하지 않는다.
- 기존 디자인 시스템, 공용 컴포넌트, 토큰을 우선 재사용한다.
- 새 UI/state 라이브러리를 추가하지 않는다.
- 브라우저 검증 중 Capture, Release, Refund, Cash settlement 등 실제 금액 상태를 변경하는 요청은 제출하지 않는다. 확인 화면까지만 검증한다.

## 3. 고정 범위와 비범위

### 고정 범위

- 관리자 `Payments` 목록, 상세, 필터, 큐, KPI, 정책 결정, 확인 화면
- 이를 제공하는 Admin API, Payment policy/service, persistence, 테스트
- Payments에서 Cash settlements/Partner deposit으로 이어지는 안전한 문맥 링크
- 1440px 이상 데스크톱 화면

### 비범위

- 1024px 이하 화면, 태블릿, 모바일 반응형은 **검사·구현·보고에서 완전히 제외**한다.
- Payments 안에 Refund 승인 책임을 새로 만들지 않는다. Refund 승인은 기존 approval queue의 책임을 유지한다.
- 기존 dark theme를 제거하거나 브랜드 전체를 재설계하지 않는다.
- 증거 없이 회계·게이트웨이 비즈니스 규칙을 임의로 바꾸지 않는다.

## 4. 반드시 보존할 현재 장점

다음 동작은 회귀시키지 않는다.

- 서버가 실제 금액 액션 직전에 결제·예약·증거를 재조회하고 canonical policy를 재평가한다.
- `CANCELLED`, `EXPIRED`, `NO_SHOW` 등 Capture 불가 lifecycle을 서버에서 차단한다.
- 목록·상세 API 오류가 빈 상태로 위장되지 않고 명시적 오류와 재시도를 제공한다.
- 금액 액션에 reason, idempotency key, audit receipt가 남는다.
- 목록 문맥이 `returnTo`로 상세·확인 화면까지 유지된다.
- ID 축약, 복사, 전체값 확인 기능을 유지한다.
- callback payload의 민감 필드 redaction을 유지한다.
- 현재의 일관된 dark theme와 디자인 토큰을 유지한다.

## 5. 구현 우선순위 A — 운영 불능과 금액 안전성

### A-1. 성공할 수 없는 Cash debt 직접 정산 폼 제거

현재 Payment 상세의 `Settle cash fee debt` 폼은 `/admin/earnings/:id/mark-paid`로 요청하지만 서버 정책상 direct settlement가 항상 거부된다. 실패가 화면에 제대로 전달되지 않는 문제를 단순 오류 메시지 추가로 봉합하지 말라.

구현 요구:

1. Payment 상세에서 직접 `mark-paid`를 호출하는 폼과 `settleCashDebt` 서버 액션을 제거한다.
2. 정식 증거·승인 기반 흐름으로 이동하는 CTA를 제공한다.
   - 우선: 해당 earning/partner를 찾을 수 있는 `Cash settlements` 검토 화면
   - 또는: `/finance-tax/partner-bank-deposits`의 deposit evidence/approval 흐름
3. CTA 문구 예시:
   - `Open cash debt review`
   - `Record Partner deposit evidence`
4. payment ID, booking ID, partner ID, earning ID 중 실제 대상 페이지가 지원하는 검색 문맥을 URL에 안전하게 전달한다.
5. 대상 페이지가 아직 특정 ID query를 처리하지 못한다면, 무시되는 query만 붙이지 말고 최소한 해당 페이지에서 검색·강조되도록 필요한 읽기 전용 query 처리까지 구현한다.
6. Cash debt 자체를 Payments에서 직접 확정·변경하는 새 우회 API를 만들지 않는다.
7. 회귀 테스트에서 Payments 상세에 direct settlement POST 폼이 렌더링되지 않고 정식 workspace 링크가 렌더링되는지 검증한다.

### A-2. 결제당 하나의 `primaryAction`과 `primaryQueue`

현재 한 결제에 `SYNC.recommended=true`와 `RELEASE.recommended=true`가 동시에 성립할 수 있다. 이 때문에 `Release recommended` 큐의 행이 실제로는 `Sync gateway status`를 다음 액션으로 표시한다.

구현 요구:

1. canonical decision 결과를 다음처럼 명시적으로 구분한다.
   - `primaryAction`: 운영자가 지금 수행해야 할 단 하나의 액션 또는 `null`
   - `primaryQueue`: 그 결제가 속하는 단 하나의 1차 업무 큐
   - `availableActions`: 지금 실행 가능하지만 primary가 아닌 보조 액션
   - `blockedActions`: 차단 이유를 포함한 정책 정보
2. 어떤 결제에도 추천 액션이 두 개 이상 존재하지 않게 한다. 레거시 `recommended` 필드를 유지해야 한다면 `primaryAction` 하나에만 true가 되도록 한다.
3. 기본 정책은 evidence-first로 한다.
   - 외부 gateway 결제에 verified evidence가 없거나 conflict가 있으면 `SYNC` 또는 evidence repair를 primary로 둔다.
   - evidence가 policy-complete이고 terminal non-capture 상태가 확인된 뒤에만 `RELEASE`를 primary로 둔다.
4. 기존 도메인 규칙이 즉시 Release를 명백하게 요구한다면 그 근거를 코드/테스트에서 확인하고, 이 경우에도 `SYNC`는 auxiliary로 내려 두 개를 동시에 추천하지 않는다.
5. 목록 행, 상세 action map, KPI, 큐 포함 조건, confirmation 모두 같은 canonical `primaryAction/primaryQueue`를 사용한다. 프론트에서 별도 추론하지 않는다.
6. 다음 조합을 table-driven test로 고정한다.
   - external + missing evidence + authorized + cancelled
   - external + verified evidence + authorized + cancelled
   - completed + verified + capturable
   - captured + refund eligible
   - terminal history
   - cash active/debt

### A-3. 동시 요청에도 원자적인 idempotency

현재 audit receipt 선조회 후 gateway 실행 방식은 같은 idempotency key가 동시에 도착할 때 두 요청 모두 gateway에 진입할 수 있다.

구현 요구:

1. 기존에 durable operation/idempotency claim 테이블이 있다면 우선 재사용한다.
2. 적합한 모델이 없다면 `(paymentId, idempotencyKey)` 또는 동등한 business key에 DB unique constraint가 있는 action claim/receipt 모델과 migration을 추가한다.
3. 외부 gateway 호출 전에 claim을 원자적으로 획득한다. audit log 조회를 lock처럼 사용하지 않는다.
4. 최소 상태를 저장한다.
   - operation/action type
   - `IN_PROGRESS`, `SUCCEEDED`, `FAILED` 또는 프로젝트 기존 상태 체계
   - request identity/hash에 필요한 값
   - receipt/result 또는 안전한 error metadata
   - created/updated/completed timestamps
5. 동일 payment의 상충하는 금액 액션이 병렬 실행되지 않도록 기존 transaction/row lock/advisory lock 패턴을 조사해 최소 범위로 직렬화한다.
6. 동일 키의 순차 재시도는 기존 receipt를 반환하고, 다른 payload가 같은 키를 재사용하면 명시적으로 거부한다.
7. `Promise.all`로 동일 요청을 2~10회 동시에 호출하는 테스트를 추가해 gateway adapter가 정확히 한 번만 호출되고 모든 호출이 일관된 결과/receipt를 받는지 검증한다.

## 6. 구현 우선순위 B — 큐·KPI·페이지네이션 정확성

### B-1. 배타적인 업무 큐 분류기 도입

원칙은 **한 결제 = 하나의 primary work queue**다. 다른 속성은 secondary tag나 saved filter로 제공한다.

권장 1차 구조:

| 그룹 | 1차 큐 | 목적/대표 액션 |
|---|---|---|
| Evidence repair | Missing evidence | Sync 또는 증거 수집 |
| Evidence repair | Evidence conflict | callback/evidence 조사 |
| Money actions | Capture ready | Capture |
| Money actions | Release ready | Release |
| Money actions | Refund review | 기존 approval flow로 전달 |
| Cash operations | Active collection | 현금 수금 추적 |
| Cash operations | Cash debt | Cash settlement 검토 열기 |
| Lifecycle repair | Terminal cash cleanup | outcome/state 수리 |
| Lifecycle repair | Completed authorization blocked | evidence/state 수리 |
| History | Completed payments | 읽기 전용 이력 |

구현 요구:

1. `callback-review`와 `evidence-conflict`의 동일 predicate 중 하나를 canonical queue로 통합한다.
2. 기존 URL/bookmark를 깨지 않도록 제거된 review 값은 canonical queue로 redirect 또는 normalize하는 alias로만 유지한다. UI에는 중복 항목을 노출하지 않는다.
3. `All authorized`는 primary 업무 큐에서 제거하고 diagnostics/history의 saved filter로 이동한다.
4. `Missing gateway evidence`와 `Release ready`가 동시에 primary가 되지 않게 한다.
5. 각 큐의 이름, 설명, count, 포함 predicate가 동일한 classifier를 참조하게 한다.
6. primary queue는 배열 순서의 우연한 첫 match가 아니라 명시적 precedence와 exhaustiveness를 가진 순수 함수 또는 DB와 공유 가능한 단일 규칙으로 만든다.

### B-2. `Stale mismatch`를 조치 가능한 두 큐로 분리

다음 두 유형을 하나의 수동 검토 큐에 섞지 않는다.

1. `Terminal cash cleanup`
   - terminal booking + stale `CASH/PENDING`
2. `Completed authorization blocked`
   - `COMPLETED` booking + `AUTHORIZED`이지만 Capture 불가

각 행/상세에는 다음을 표시한다.

- booking state
- payment state
- 구체적인 exception reason
- 기준이 명시된 age
- owner가 실제 데이터 모델에 존재하면 owner, 없으면 허위 placeholder를 만들지 말고 next workspace/action을 우선 제공
- `Cash settlements`, booking outcome repair, Sync/evidence repair 등 실제 다음 workspace

액션이 없고 이미 끝난 오래된 terminal cash 레코드는 업무 큐에서 제외하고 History에서만 찾을 수 있게 한다.

### B-3. KPI scope 분리

현재 KPI는 전역 backlog처럼 보이지만 현재 큐 안에서 재계산된다.

API와 UI를 다음처럼 구분한다.

- `currentQueueTotal`: 현재 primary queue와 현재 적용 필터에 대한 정확한 총건수
- `globalActionMetrics`: review/queue, age, SLA 필터를 제외한 운영 전역 업무 지표
- `queueCounts`: canonical primary queue별 정확한 건수
- `generatedAt`: 지표 생성 시각
- 필요하면 `scope`: 적용된 기간/디렉터리 범위를 구조화해 반환

주의:

1. 기간·디렉터리 필터를 global metric에 반영할지 현재 제품 의미를 확인해 일관되게 결정하고, 화면에 `All queues · All dates` 또는 실제 scope를 표시한다.
2. 큐를 바꿨다는 이유만으로 관련 없는 전역 KPI가 0으로 바뀌면 안 된다.
3. UI에서 추측한 scope 문구를 하드코딩하지 말고 API 의미와 일치시킨다.

### B-4. 목록·총건수·페이지네이션에 같은 canonical predicate 사용

현재 `skip` 후 메모리 정책 필터 후 `slice`하는 방식은 페이지 사이 중복·누락과 부정확한 total을 만들 수 있다.

구현 요구:

1. DB 조회 전에 가능한 queue/classification predicate를 적용하여 list와 count가 동일한 조건을 사용하게 한다.
2. 가장 적합한 선택:
   - SQL/Prisma에서 계산 가능한 canonical predicate, 또는
   - 쓰기 시/상태 변경 시 갱신되는 persisted classification
3. persisted classification을 선택하면 stale 방지 전략과 모든 갱신 경로를 테스트한다.
4. 불가피하게 메모리 정책 필터를 유지한다면 안정된 cursor로 eligible row를 채우고 다음 cursor를 반환한다. 정확한 count가 없는데 숫자 total/page를 가장하지 않는다.
5. broad count와 post-filtered rows를 섞지 않는다.
6. eligible/ineligible 후보가 교차하는 최소 3페이지 fixture로 다음을 검증한다.
   - 페이지 간 payment ID 중복 0
   - 모든 eligible ID 누락 0
   - total과 실제 row count 일치
   - sort가 고정 tie-breaker를 포함해 안정적

### B-5. Summary 쿼리와 후보 로드의 확장성 개선

현재 화면 한 번에 여러 count 쿼리와 제한 없는 action candidate `findMany`가 실행된다.

구현 요구:

1. queue count를 가능한 한 한 번의 조건부 집계 SQL/CTE 또는 소수의 bounded query로 계산한다.
2. summary용 무제한 payment/action candidate 로드를 제거한다.
3. 목록과 summary가 같은 classifier 의미를 사용하게 한다.
4. 응답에 `queueCounts`, `globalActionMetrics`, `generatedAt`을 명시한다.
5. 테스트 또는 instrumentation으로 다음 budget을 고정한다.
   - summary의 DB query 수가 queue 수에 선형 증가하지 않음
   - 후보 전체 row를 애플리케이션 메모리로 읽지 않음
6. 먼저 query shape를 바로잡고, 근거 없는 캐시 계층은 추가하지 않는다.
7. 가능하면 변경 전후 로컬 응답 시간과 query 수를 같은 fixture에서 기록하되, 개발 데이터의 절대 시간만으로 성능을 단정하지 않는다.

## 7. 구현 우선순위 C — 1440px 이상 운영 화면

### C-1. 핵심 정보를 가로 스크롤 없이 보이는 6열 이하 테이블

1440px viewport에서 sidebar를 포함한 실제 content area 안에 핵심 업무 정보가 들어와야 한다.

권장 열:

1. `Payment / Booking`
   - 짧은 payment ID, booking ID, copy, 상세 링크
2. `Customer / Partner`
   - 운영 식별에 필요한 최소 정보
3. `Method / Amount`
   - 결제 방법과 공용 포맷 금액
4. `Current state`
   - payment state와 booking state를 함께 표시
5. `Decision / Evidence`
   - primary action 또는 no action
   - 핵심 reason
   - evidence 상태
   - booking update 기준 age
6. `Action`
   - primary action 또는 `Open detail`
   - 필요하면 우측 sticky

구현 요구:

- 1440px에서 Payment, booking state, next action, 실행/상세 CTA가 가로 스크롤 없이 보여야 한다.
- gateway ref와 긴 timestamp는 축약하고 전체값은 title/상세에서 제공한다.
- 긴 이유 문구가 행 높이를 무제한 늘리지 않게 하되, 의미 있는 이유를 색만으로 표현하지 않는다.
- CSS의 전역 테이블 규칙을 무작정 바꾸지 말고 Payments 범위 selector 또는 공용 컴포넌트의 안전한 variant를 사용한다.

### C-2. 잘리는 `More` 메뉴 제거 또는 안전하게 렌더링

가장 단순하고 권장하는 방식은 목록에서 다음만 노출하는 것이다.

- primary action 1개
- `Open detail`

Booking ID 자체가 booking 상세 링크라면 중복 메뉴 항목을 만들지 않는다. 차단된 여러 액션의 정책 지도는 Payment 상세에 둔다.

정말 목록의 `More`가 필요하다는 현재 요구가 확인될 때만:

- portal/fixed popover로 테이블 `overflow:auto` 밖에 렌더링한다.
- keyboard navigation, Escape, outside click, focus return을 구현한다.
- 우측/하단 viewport collision을 처리한다.
- Action 열을 sticky로 유지한다.

어떤 경우에도 메뉴가 스크롤 컨테이너에 잘리면 안 된다.

### C-3. Terminal history와 실제 review 상태를 구분

- canonical decision에 `REVIEW_REQUIRED`가 있을 때만 `Manual review`를 표시한다.
- terminal/settled 기록에는 `No action · History` 또는 동등한 중립 문구를 사용한다.
- 완결된 과거 레코드에 비필수 evidence가 없으면 경고성 `Missing` 대신 중립 `Not recorded`를 표시한다.
- History의 중립 누락은 active evidence backlog count에 포함하지 않는다.

### C-4. Queue navigator 단순화

현재 15개 항목을 Queue select와 `Quick queues` 양쪽에 중복 노출하지 않는다.

구현 요구:

1. 주 탐색 방식은 하나만 남긴다.
2. 실제 운영량·긴급도가 있는 3~5개 primary queue를 count와 함께 바로 노출한다.
3. secondary, empty, history/diagnostic 항목은 `More queues` 또는 별도 secondary selector에 둔다.
4. 빈 큐 11개를 기본 화면에서 긴 목록으로 펼치지 않는다.
5. 현재 선택 항목은 말줄임으로 의미가 사라지지 않게 한다.
6. `Quick queuesServer policy decisions`, `HistoryTerminal records`처럼 붙어 보이는 레이블을 수정한다.

### C-5. 시간 기준을 필드명 수준으로 명확하게 표시

현재 의미를 다음과 같이 명확히 한다.

- `Range` → `Booking created`
- `Last booking change` → `Booking updated`
- `Age` → `Idle since booking update`
- SLA는 authorized/hold workflow에서만 `Authorization hold SLA`
- API의 `evaluatedAt`, `bookingUpdatedAt`, `evidenceVerifiedAt`을 분리
- 화면에서 `Policy evaluated`, `Booking updated`, `Evidence verified`로 각각 표시

하나의 `verifiedAt`을 evidence와 policy evaluation에 동시에 사용하지 않는다.

### C-6. 상세 및 확인 화면 완성도

금액 액션 확인 화면에 가능한 경우 다음을 표시한다.

- payment ID와 booking ID
- amount와 method
- `Before` payment/booking state
- 예상 `After` payment state
- primary action과 정책 reason
- gateway/provider reference
- evidence 상태와 required evidence
- 실행 operator/actor
- policy version 또는 policy identifier
- `evaluatedAt`

추가 요구:

- 목록, 상세, confirmation에 같은 공용 VND formatter를 사용한다.
- 취소 버튼, Escape, 완료 후 원래 trigger로 focus가 복귀해야 한다.
- 라우트 기반 모달이면 `returnFocus`/hash/trigger ID를 이용해 명시적으로 복원한다.
- disabled action reason은 hover `title`에만 숨기지 말고 keyboard 사용자도 읽을 수 있게 보인다.
- 접근성 좋은 `alertdialog`, `aria-modal`, focus trap, inert 동작은 유지한다.
- 목록과 상세 metadata를 추가한다.
  - `Payments | HANDS Admin`
  - `Payment <short-id> | HANDS Admin`

### C-7. 문구와 세부 마감

- `Age and SLAOptional`, `All action decisions4 policy checks` 같은 붙은 레이블을 제거한다.
- 빈 상태는 선택된 큐의 의미와 다음 행동을 설명하는 완전한 문장으로 작성한다.
- `payment(s)`를 사용하지 말고 일관된 복수형 또는 실제 count 기반 문구를 사용한다.
- 색상만으로 상태를 구분하지 않는다.
- 밝은/어두운 테마에서 기존 token 대비를 유지한다.

## 8. 테스트 요구사항

기존 테스트를 삭제하거나 assertion을 약하게 만들어 통과시키지 않는다. 최소한 다음 회귀 테스트를 추가하거나 갱신한다.

### Admin web

- Payments 상세에 `Settle cash fee debt` direct POST form이 없음
- cash settlement/deposit workspace 링크와 검색 문맥이 정확함
- 한 행에 primary action 하나만 표시됨
- terminal history가 `Manual review`/active `Missing`으로 표시되지 않음
- payment state와 booking state가 함께 표시됨
- queue navigator에 visible duplicate callback queue가 없음
- KPI scope와 current queue total이 구분됨
- time label과 timestamp semantics가 명확함
- confirmation에 before/after, amount, evidence, actor, gateway ref, evaluatedAt이 표시됨
- Cancel/Escape 후 trigger focus 복귀
- metadata title 렌더링
- 새 empty/error state

### API/domain

- 모든 decision에 primary action 최대 1개
- 모든 active payment에 primary work queue 최대 1개
- missing evidence와 release-ready가 동시에 primary가 되지 않음
- callback alias가 canonical predicate로 normalize됨
- terminal cash cleanup과 completed authorization blocked가 분리됨
- list/count/queue counts가 같은 classifier를 사용함
- interleaved 3-page fixture에서 중복·누락 0, total 정확
- global metrics가 review/age/sla 전환에 의해 의미 없이 변하지 않음
- summary가 무제한 candidate 로드를 하지 않음
- 동시 idempotency 요청에서 gateway 호출 정확히 1회
- 같은 key의 다른 payload 거부 및 같은 payload receipt replay

## 9. 실행해야 할 검증

저장소 package script를 먼저 확인한 뒤 최소한 다음을 실행한다.

```powershell
npm run test --workspace @massage-vn/admin-web -- app/payments
npm run test --workspace @massage-vn/api -- src/payments/payment-action-decision.spec.ts src/payments/payments.service.spec.ts src/payments/payments.controller.spec.ts
npm run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "payment"
npm run typecheck --workspace @massage-vn/admin-web
npm run typecheck --workspace @massage-vn/api
```

- 관련 lint script가 있으면 수정 파일 범위 또는 해당 workspace lint를 실행한다.
- Prisma schema를 변경했다면 migration 검증과 client generation/typecheck를 실행한다.
- 더 넓은 테스트를 실행해 기존의 monthly tax closing 2개 실패가 계속 나타난다면 Payments 회귀인지 분리해 보고한다. 기존 실패라는 이유만으로 새 Payments 실패를 숨기지 않는다.

## 10. 브라우저 검증

관리자 로그인 세션이 있는 실제 브라우저에서 **1440×900 또는 그 이상**으로 검증한다. 1024px 이하 viewport는 열거나 보고하지 않는다.

다음 상태를 각각 확인하고 캡처한다.

1. 기본 Payments 화면
2. Missing evidence/Evidence repair
3. Capture ready
4. Release ready
5. Terminal cash cleanup
6. Completed authorization blocked
7. Active collection 또는 Cash debt
8. Completed/terminal history
9. Payment 상세 action map
10. 금액 액션 confirmation — 제출하지 말 것
11. queue navigator/More queues 펼침
12. dark theme

각 화면에서 확인할 것:

- 1440px에서 핵심 6열과 Action이 가로 스크롤 없이 보임
- 보이는 큐 이름, count, row의 primary action이 서로 모순되지 않음
- 중복 callback queue가 없음
- KPI scope가 명확하고 큐 전환 시 의미가 유지됨
- 메뉴/popover가 잘리지 않음
- 긴 ID/reason이 레이아웃을 깨지 않음
- terminal history가 업무 경고처럼 보이지 않음
- detail/confirmation의 상태와 근거가 일치함
- Escape/Cancel focus return이 동작함
- `document.title`이 비어 있지 않음

## 11. 완료 조건

다음 조건을 모두 충족해야 완료다.

- [ ] 성공할 수 없는 Cash debt direct settlement 폼과 액션이 제거되었다.
- [ ] Cash debt는 정식 증거·승인 workspace로 문맥을 유지해 연결된다.
- [ ] 한 결제에 primary action과 primary work queue가 각각 최대 하나다.
- [ ] Missing evidence와 Release ready의 의미가 충돌하지 않는다.
- [ ] visible `callback-review`/`evidence-conflict` 중복이 제거되었다.
- [ ] `Stale mismatch`가 조치 가능한 두 lifecycle queue로 분리되었다.
- [ ] current queue total, queue counts, global KPI scope가 정확하고 명시적이다.
- [ ] 목록, count, summary가 동일 canonical predicate를 사용한다.
- [ ] 3페이지 회귀 테스트에서 payment ID 중복·누락이 없다.
- [ ] summary가 무제한 후보 행을 읽지 않고 query 수가 queue 수에 선형 증가하지 않는다.
- [ ] 동일 idempotency key의 동시 요청에서 gateway adapter가 정확히 한 번 호출된다.
- [ ] 1440px에서 booking state, next action, Action을 가로 스크롤 없이 볼 수 있다.
- [ ] 드롭다운/popover가 overflow에 잘리지 않는다.
- [ ] terminal history가 `Manual review` 또는 active evidence warning으로 표시되지 않는다.
- [ ] 시간 필드와 KPI 범위가 운영자 문구로 명확하다.
- [ ] confirmation에 before/after와 필요한 정책·증거 context가 있다.
- [ ] Cancel/Escape 후 원래 trigger로 focus가 복귀한다.
- [ ] Payments 목록·상세 `document.title`이 설정되었다.
- [ ] 관련 Payments 테스트, typecheck, lint가 통과했다.
- [ ] 1440px 라이트·다크 브라우저 검증과 캡처를 완료했다.

## 12. 최종 보고 형식

작업이 끝나면 다음 순서로 간결하지만 검증 가능하게 보고하라.

1. `Outcome`
   - 완료/부분 완료/차단
2. `Implemented`
   - 요구사항 ID(A-1, B-4 등)별 실제 변경
3. `Architecture decisions`
   - primary queue classifier 위치와 precedence
   - pagination/count 정확성 방식
   - idempotency 원자화 방식
   - cash settlement 연결 방식
4. `Files changed`
   - 파일별 핵심 변경
5. `Database changes`
   - schema/migration/rollback 영향
6. `Verification`
   - 실행 명령과 pass/fail 수치
   - 기존 unrelated 실패 구분
7. `Browser evidence`
   - 1440px 캡처 경로와 확인 결과
8. `Performance evidence`
   - 변경 전후 query shape/count와 가능하면 로컬 응답 시간
9. `Remaining issues`
   - 미완료 항목, 이유, 필요한 결정

소스 보고서를 덮어쓰지 말고, 구현 결과 보고서는 새 파일로 작성한다.

완료 조건 중 하나라도 충족하지 못했다면 무엇이 남았는지 명시하고 `완료`라고 표현하지 않는다.

## END OF PROMPT

