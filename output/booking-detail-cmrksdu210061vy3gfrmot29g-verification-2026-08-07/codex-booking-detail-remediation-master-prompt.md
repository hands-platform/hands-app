# Codex 실행용 Master Prompt

아래 프롬프트 전체를 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## Prompt

당신은 HANDS 관리자 웹의 예약 운영 흐름을 수정하는 시니어 풀스택 엔지니어다. 이번 작업은 단순한 시각 리디자인이 아니라 **운영자가 post-match cancellation을 안전하고 빠르게 판단하고, 금액·감사 기록을 틀리지 않게 종료할 수 있도록 Booking Detail의 UI, 문구, 데이터 의미, API 원자성, 테스트를 함께 바로잡는 구현 작업**이다.

설명이나 추가 감사 보고서만 작성하고 끝내지 말고, 현재 코드를 확인한 뒤 필요한 변경을 직접 구현하고 검증하라.

### 1. 작업 위치와 필수 문서

작업 루트:

```text
C:\dev\massage-on-demand-vn
```

먼저 다음 문서를 순서대로 전부 읽어라.

```text
C:\dev\massage-on-demand-vn\AGENTS.md
C:\dev\massage-on-demand-vn\output\booking-detail-cmrksdu210061vy3gfrmot29g-verification-2026-08-07\booking-detail-post-implementation-deep-audit.md
```

감사 스크린샷도 직접 열어 확인하라.

```text
C:\dev\massage-on-demand-vn\output\booking-detail-cmrksdu210061vy3gfrmot29g-verification-2026-08-07\01-top-decision-1440.png
C:\dev\massage-on-demand-vn\output\booking-detail-cmrksdu210061vy3gfrmot29g-verification-2026-08-07\02-post-match-decision-1440.png
C:\dev\massage-on-demand-vn\output\booking-detail-cmrksdu210061vy3gfrmot29g-verification-2026-08-07\03-decision-actions-closeout-1440.png
C:\dev\massage-on-demand-vn\output\booking-detail-cmrksdu210061vy3gfrmot29g-verification-2026-08-07\04-after-approve-result-1440.png
C:\dev\massage-on-demand-vn\output\booking-detail-cmrksdu210061vy3gfrmot29g-verification-2026-08-07\05-resolved-decision-closeout-1440.png
C:\dev\massage-on-demand-vn\output\booking-detail-cmrksdu210061vy3gfrmot29g-verification-2026-08-07\06-decision-evidence-guardrails-1440.png
C:\dev\massage-on-demand-vn\output\booking-detail-cmrksdu210061vy3gfrmot29g-verification-2026-08-07\07-evidence-packet-1440.png
C:\dev\massage-on-demand-vn\output\booking-detail-cmrksdu210061vy3gfrmot29g-verification-2026-08-07\08-manual-outcome-board-1440.png
C:\dev\massage-on-demand-vn\output\booking-detail-cmrksdu210061vy3gfrmot29g-verification-2026-08-07\09-full-evidence-bundle-1440.png
C:\dev\massage-on-demand-vn\output\booking-detail-cmrksdu210061vy3gfrmot29g-verification-2026-08-07\10-operator-action-availability-1440.png
C:\dev\massage-on-demand-vn\output\booking-detail-cmrksdu210061vy3gfrmot29g-verification-2026-08-07\11-top-resolved-1600.png
C:\dev\massage-on-demand-vn\output\booking-detail-cmrksdu210061vy3gfrmot29g-verification-2026-08-07\12-top-resolved-dark-1440.png
```

대상 화면:

```text
http://localhost:3101/bookings/cmrksdu210061vy3gfrmot29g
```

중요: 감사 중 대상 로컬 E2E 예약은 이미 resolved 상태로 바뀌었다. 이 레코드를 다시 임의 변경하거나 DB에서 수동 복구하지 마라. 변경 액션 검증에는 별도의 안전한 미결정 테스트 fixture를 사용하라.

### 2. 저장소 작업 규칙

- `AGENTS.md` 지침을 최우선으로 지켜라.
- single-agent로만 작업하고 subagent를 만들지 마라.
- 현재 worktree가 dirty일 수 있다. 사용자의 기존 변경을 보존하고 관련 없는 파일을 되돌리거나 정리하지 마라.
- `C:\dev\massage-vn-workspace`는 사용하지 마라.
- 새 라이브러리, 새 상태 관리 체계, 범용 abstraction을 추가하지 마라.
- 기존 helper, UI component, status badge, form control, model builder를 먼저 재사용하라.
- 사용자 문구에는 `Provider` 대신 `Partner`를 사용하라. DB enum과 내부 타입은 필요한 경우 기존 이름을 유지한다.
- 결제, booking, matching, shared contract는 보호영역이다. 관련 호출자를 모두 추적하고 범위 검증과 전체 로컬 검증을 수행하라.
- Prisma schema/migration은 기존 audit metadata 또는 상세 DTO projection으로 해결할 수 없는 경우에만 최소 변경으로 사용하라.
- 관련 없는 대규모 리팩터링을 하지 마라.
- 커밋은 요청받지 않았으므로 만들지 마라.

### 3. 화면 검수 범위

검수 viewport는 다음 두 개뿐이다.

```text
1440×900
1600×900
```

- 1024px 이하, 태블릿, 모바일 반응형은 검사·수정·보고 범위에서 완전히 제외한다.
- 다크 모드는 기존 토큰과 디자인을 유지하면서 깨짐만 확인한다.
- 현재 화면의 색상이나 카드 스타일을 전면 교체하지 마라.
- 운영 정보 우선순위, 중복 제거, 문구 의미, 안전한 액션 흐름에 집중하라.

### 4. 작업 시작 전 기준선 확인

보고서는 2026-08-07 14:51 ICT 시점의 코드와 실행 화면을 기준으로 한다. 이후 코드가 이미 달라졌을 수 있으므로 보고서 문구를 맹목적으로 적용하지 마라.

1. `git status --short`로 dirty worktree를 확인한다.
2. 관련 파일의 현재 diff와 최근 수정 상태를 확인한다.
3. 아래 집중 테스트를 먼저 실행해 현재 실패 기준선을 기록한다.
4. 실행 중 API가 `src` 최신 build인지 확인한다.
5. 현재 코드가 보고서보다 개선되어 있다면 유지하고, 남은 문제만 수정한다.

감사 당시 기준선:

```text
Admin: 64 tests 중 11 failed
API: 591 tests 중 4 failed, 586 skipped
```

감사 당시 API는 오전에 시작한 `node dist/main.js`였고 최신 `src/admin` 변경을 반영하지 않았다. 브라우저의 성공 상태를 최신 API 검증으로 간주하지 마라.

### 5. 구현 목표

운영자가 첫 두 뷰포트 안에서 다음 질문에 답할 수 있어야 한다.

1. 누가 언제 예약을 취소했는가?
2. 이 검토는 아직 열려 있는가, 이미 종료됐는가?
3. 현재 빠진 증거는 무엇인가?
4. 고객 금액은 액션 전후 어떻게 바뀌는가?
5. Partner fee는 실제 레코드가 있는가, 없으면 아무 변화도 없는가?
6. 지금 누를 수 있는 유일한 안전한 액션은 무엇인가?
7. 처리 후 누가, 언제, 어떤 이유로 결정했는가?

기본 렌더 길이는 현재 약 13,746px/15.3 viewport에서 **6 viewport 이하**를 목표로 한다. 고급 기록을 삭제하지 말고 기본 화면에서 접어라.

### 6. P0 — 데이터·금액 무결성부터 수정

UI 정리보다 아래 항목을 먼저 해결하라.

#### 6.1 최신 UI/API 계약 정합성

현재 의도된 계약은 다음과 같다.

- `reason`은 필수다.
- `OTHER`는 `note`도 필수다.
- 성공, 검증 오류, 409 중복 결정, 일반 실패를 운영자에게 구분해서 표시한다.
- 미결정 폼은 `useActionState` 계약에 맞게 동작한다.

관련 파일을 확인하라.

```text
apps/admin_web/app/bookings/[id]/actions.ts
apps/admin_web/app/bookings/[id]/booking-detail-post-match-decision-section.tsx
apps/admin_web/app/bookings/[id]/booking-outcome-review-panel.ts
apps/api/src/admin/admin.dto.ts
apps/api/src/admin/admin-booking.routes.ts
apps/api/src/admin/admin.service.ts
```

요구사항:

- 구 action export를 참조하는 테스트를 최신 shared action으로 갱신한다.
- `useActionState(previousState, formData)` 시그니처를 테스트가 정확히 호출하게 한다.
- `decision.actions`를 모든 필요한 fixture에 명시한다.
- API service 테스트에는 구조화된 `reason`을 전달한다.
- reason이 없을 때 TypeError가 아니라 의도된 validation error가 발생해야 한다.
- UI payload와 DTO가 완전히 일치해야 한다.

#### 6.2 결제와 Booking 결정의 원자성

다음 호출 흐름을 끝까지 추적하라.

```text
Admin post-match decision
→ AdminService.resolvePostMatchCancellation
→ PaymentsService.closeUnmatchedBookingPayment
→ payment release 또는 refund request
→ booking update
→ ops task
→ admin audit log
```

`closeUnmatchedBookingPayment`는 다음 경로에서도 사용된다.

```text
apps/api/src/bookings/bookings.service.ts
apps/api/src/matching/matching.processor.ts
apps/api/src/admin/admin.service.ts
```

요구사항:

- Admin 결정에서 payment/refund, earning, booking, ops task, audit log 중 DB 변경이 부분 성공하면 안 된다.
- transaction callback 안에서 `this.prisma`를 호출하는 것만으로 원자성이 확보됐다고 간주하지 마라.
- 기존 helper가 선택적으로 Prisma transaction client를 사용할 수 있도록 하는 가장 작은 변경을 우선 검토한다.
- shared function의 모든 호출자를 확인하고 기존 matching/bookings 동작을 깨지 마라.
- 알림처럼 commit 이후에 수행해야 하는 외부 부수효과는 DB transaction과 분리하되 실패 복구 가능성을 유지한다.
- 중간 단계 실패를 주입하여 payment만 바뀌거나 booking만 바뀌지 않는 것을 테스트한다.
- 동시 관리자 결정은 한 건만 성공하고 나머지는 409여야 한다.

#### 6.3 원 취소자와 관리자 결정자를 분리

현재 `closedByRole`을 `ADMIN`으로 덮어쓰면 원래 Partner/Customer가 취소했다는 핵심 사실을 기본 UI에서 잃는다.

화면과 DTO에서 다음 의미를 분리하라.

```text
original cancellation actor
original cancellation reason
cancellation timestamp
decision status
decision reason code/label
decision admin
decision timestamp
```

구현 원칙:

- 기존 `adminAuditLog.metadata.previousClosedByRole`, previous reason/note, post-match metadata를 먼저 조사한다.
- 기존 데이터에서 투영 가능하면 상세 DTO에 최소 projection을 추가한다.
- 새 DB column/table은 기존 사실로 복구할 수 없을 때만 검토한다.
- 기본 UI의 `Cancellation actor`에는 최초 취소자를 표시한다.
- `Decision by`에는 관리자 결정자를 표시한다.
- `Recorded closure role: ADMIN` 같은 내부 enum 문구를 사용자에게 노출하지 마라.

#### 6.4 실제 결정 시각 사용

현재 `postMatchCancellationDecisionAt()`이 `closedAt ?? updatedAt ?? createdAt`을 사용한다. `closedAt`은 원 취소 시각이지 관리자 결정 시각이 아니다.

- audit log 또는 구조화된 metadata의 관리자 결정 시각을 사용한다.
- `Cancellation at`과 `Decision at`을 별도로 표시한다.
- 해결 후 `Decision recorded`는 실제 관리자 결정 이벤트와 일치해야 한다.
- `updatedAt`을 의미 있는 business timestamp의 대용으로 사용하지 마라.

#### 6.5 사실과 다른 자동 메모 제거

- 채팅 메시지가 0개인데 `Approved after admin chat evidence review.`를 자동 생성하면 안 된다.
- 저장되는 문구는 선택한 reason label과 실제 operator note로만 구성한다.
- note가 선택 사항인 reason에서는 거짓 증거 문구를 채우지 마라.
- 구 `dist`의 default note 경로가 최신 build에 남지 않는지 확인한다.

### 7. P0 — 안전한 결정 UI 완성

최신 소스에 이미 있는 다음 개선은 유지하라.

- visible decision reason select
- `OTHER` note requirement
- customer money before/after
- Partner fee before/after
- review status before/after
- `<dialog>` confirmation
- pending/disabled state
- error/success live region과 focus 이동
- fee record가 없을 때 단일 action

추가 요구사항:

- earning/negative fee record가 없으면 `Keep Partner fee` 또는 `Waive Partner fee` 두 선택지를 만들지 마라.
- 이 경우 유일한 CTA는 `Close review — no money movement`처럼 실제 결과를 설명해야 한다.
- fee가 있는 경우에만 Keep/Waive 두 결과를 제공한다.
- 고객 결제 부수효과와 Partner fee 부수효과를 버튼, preview, dialog 모두에서 동일하게 표시한다.
- 액션을 아직 선택하지 않았으면 Partner fee preview에 approve 결과를 미리 단정하지 말고 `Choose an outcome`을 표시한다.
- `dialog`를 거치지 않고 form submit이 실행되지 않아야 한다.
- Enter, keyboard focus, dialog cancel/back, double click, pending 중 재제출을 테스트한다.
- 저장 성공 후 다음을 구체적으로 알려라.
  - customer authorization released
  - refund requested and finance approval remains
  - no customer movement
  - fee waived/restored
  - fee held
  - no Partner fee movement
- 새 테스트 fixture에서 확인창이 실제로 보이기 전에는 금액 변경 버튼을 클릭하지 마라.

### 8. P1 — 운영 정보 구조 수정

새 페이지나 새 디자인 시스템을 만들지 말고 현재 구성요소를 재배치·필터링·접기 처리하라.

#### 8.1 첫 화면

첫 뷰포트에는 다음만 우선 표시한다.

1. `Post-match cancellation · Pending/Resolved`
2. 최초 취소자와 취소 시각
3. 현재 유일한 primary action 또는 `Review closed · no booking action`
4. 증거 completeness
5. 고객 금액과 Partner fee 핵심 결과
6. 실제 남아 있는 customer contact task

제거 또는 낮출 항목:

- 종료 예약의 `Continue normal monitoring`
- 종료 예약의 24일 overdue matching을 primary 경고로 표시하는 것
- 상세 화면의 `Current filters`, `All records`, `Live`
- 해결 상태와 충돌하는 `No immediate issue`

#### 8.2 내비게이션 문맥

- post-match cancellation 상세에서는 기본 back link가 `/bookings/post-match-cancellations?view=manual-decision`의 적절한 queue/anchor로 돌아가게 한다.
- `returnTo`가 있으면 안전하게 보존한다.
- breadcrumb와 sidebar active category가 `Live Bookings`가 아니라 `Post-match Cancellations` 문맥을 반영하게 한다.
- locked action이 일반 Live Bookings manual queue로 잘못 이동하지 않게 한다.

#### 8.3 중복 섹션 축소

현재 다음 영역이 같은 사실을 반복한다.

```text
Decision evidence guardrails
Evidence packet
Chat evidence board
Manual outcome board
Full evidence bundle
Operator action availability
```

기본 화면:

- 하나의 `Evidence summary`에 필수 증거 상태와 직접 링크만 제공한다.
- 실제 사용 가능한 action만 제공한다.

접힌 `Advanced records`:

- 전체 guardrail ledger
- full evidence bundle
- unavailable manual lanes
- unavailable actions
- 내부 진단 정보

중복 내용을 새 summary와 기존 full section 양쪽에 다시 만들지 마라.

#### 8.4 관련 없는 lane/action 숨김

- 현재 booking 상태와 관련 있는 manual lane만 기본 표시한다.
- 나머지는 `Unavailable actions (N)` 접기 안에 이유만 보여준다.
- locked action에는 실행 폼 링크를 제공하지 마라.
- 8개 중 1개만 가능하면 가능한 1개를 먼저 보여라.
- 반복 `Open` 링크는 `Open chat`, `Open payment`, `Open location`, `Open audit trail`처럼 목적형 문구로 바꾼다.

### 9. P1 — 증거 readiness 수정

다음 boolean 패턴을 그대로 유지하지 마라.

```text
message OR location OR alert OR note 중 하나만 있으면 Evidence ready
chat room만 있으면 Chat record ready
```

결정에 필요한 사실별 상태를 계산한다.

예시:

```text
Partial evidence
Chat: missing · 0 messages
Operator note: missing
Location: available
Notification: 1 failed delivery
```

요구사항:

- chat room이 있어도 0 message면 `Retained room · no messages`, `Partial` 또는 `Missing`으로 표시한다.
- 위치만 있거나 실패 알림만 있다고 전체 Evidence ready가 되면 안 된다.
- `Evidence ready`는 현재 결정에 필요한 모든 필수 항목이 충족될 때만 사용한다.
- 환불이 예상되지 않는 CASH/no-capture 건의 `0 refund rows`는 `Needs action`이 아니라 `Not expected`다.
- `Too old`에는 실제 age와 기준을 함께 표시하거나 애매한 라벨을 제거한다.

관련 파일:

```text
apps/admin_web/lib/booking-evidence-packet.ts
apps/admin_web/lib/booking-chat-evidence-decision-board.ts
apps/admin_web/lib/booking-decision-evidence-guardrails.ts
apps/admin_web/lib/booking-manual-decision-readiness.ts
apps/admin_web/lib/booking-operator-action-matrix.ts
apps/admin_web/app/bookings/[id]/booking-evidence-sections.tsx
```

### 10. P1 — 금액 문구를 운영 사실에 맞게 수정

- `CASH / RELEASED`를 주 문구로 쓰지 마라. 운영자에게는 `Cash · no platform collection · review closed`가 우선이며 raw enum은 보조 정보다.
- earning이 없는데 payout rule을 근거로 `Partner 320,000 VND`를 실제 지급액처럼 표시하지 마라.
- 다음을 구분한다.

```text
Actual earning: none
Actual Partner payable: none
Projected payout rule: 320,000 VND
```

- payment, refund, earning, payout rule, wallet entry를 하나의 “money” 숫자로 합치지 마라.
- customer money와 Partner fee를 항상 별도 행으로 유지한다.

### 11. P1/P2 — 문구와 접근성

- 해결 전 안내와 해결 후 읽기 전용 안내를 분리한다.
- 해결 후 “choose final outcome” 문구를 제거한다.
- `Admin approved / Approved / No earning`처럼 의미가 겹치는 배지를 줄인다.
- `Decision SLA`, `Decision source`, `Decision result`, `Decision at`을 서로 바꾸어 쓰지 마라.
- `message(s)`, `row(s)`, `item(s)`를 자연스러운 단수/복수 문구로 처리한다.
- 보조문구는 중복 제거 후 12~14px 범위로 정리한다.
- 기존 heading/region semantic 구조는 유지하거나 개선한다.
- 링크 텍스트만으로 목적을 알 수 있어야 한다.
- full phone number가 필요한 운영 정책을 코드에서 확인한다. 정책이 없으면 기본 마스킹을 우선 검토하되, 이 작업 때문에 새 권한 시스템을 만들지 마라.
- 다크 모드의 기존 색상 토큰과 상태색을 유지한다.

### 12. 테스트 요구사항

최소한 다음 테스트를 추가하거나 수정하라.

#### Admin Web

- no earning/no fee → 단일 `Close review — no money movement`
- retainable negative fee 존재 → waive/keep 두 액션
- reason 누락 → submit 차단
- `OTHER` + note 누락 → submit 차단
- 올바른 payload `{reason, note}`
- before/after preview와 dialog 문구 일치
- action 미선택 상태에서 결과를 단정하지 않음
- 성공, 400/422, 409, 일반 오류 문구
- 원 취소자와 admin decision actor를 동시에 표시
- 실제 decision timestamp 표시
- chat 0 → Partial/Missing
- refund not expected
- projected payout와 actual earning 구분
- 관련 없는 lane/action 기본 숨김
- resolved command strip에서 normal monitoring/overdue matching 제거
- queue return URL과 active navigation context
- 기존 false-positive 문자열 순서 테스트는 각 문자열 존재를 먼저 assert한 후 순서를 확인

#### API

- valid reason approve
- valid reason hold
- missing/legacy/invalid reason 거부
- `OTHER` without note 거부
- hold without active negative pending fee 거부
- concurrent decision은 한 번만 성공
- pre-match cancellation 거부
- payment transition 이후 booking/audit 실패 시 부분 성공 없음
- booking update 이후 audit 실패 시 transaction rollback
- audit metadata에 original actor/reason, decision reason, payment result 보존
- old generic chat-review default note가 생성되지 않음

### 13. 검증 순서

먼저 집중 테스트를 통과시켜라.

```powershell
npm.cmd exec --workspace @massage-vn/admin-web -- vitest run --config vitest.config.mts "app/bookings/[id]/booking-detail-post-match-decision-section.spec.tsx" "app/bookings/[id]/booking-outcome-review-panel.spec.ts" "app/bookings/[id]/booking-detail-section-visibility.spec.ts" "app/bookings/[id]/booking-evidence-sections.spec.tsx" "app/bookings/[id]/booking-operator-sections.spec.tsx" "app/bookings/[id]/booking-command-briefing-sections.spec.tsx" "app/bookings/[id]/actions.spec.ts" "app/bookings/booking-post-match-cancellations-model.spec.ts" "app/bookings/booking-post-match-cancellation-display.spec.ts" "lib/booking-command-decision-strip.spec.ts"

npm.cmd exec --workspace @massage-vn/api -- vitest run --config vitest.config.mts src/admin/admin.dto.spec.ts src/admin/admin.service.spec.ts -t "post-match cancellation"
```

그다음 scope 검증을 실행하라.

```powershell
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

결제/booking/matching 보호영역의 동작을 변경했다면 전체 로컬 검증을 수행하라.

```powershell
npm.cmd run verify:local
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

API build:

```powershell
npm.cmd run build --workspace @massage-vn/api
```

실행본 검증 시 주의:

- 관련 없는 Node 프로세스를 종료하지 마라.
- 프로젝트 API 프로세스의 command line과 시작 시각을 확인한다.
- 최신 build만 프로젝트 API에 반영한다.
- 재시작 후 old generic note와 old payload가 더 이상 허용되지 않는지 확인한다.

### 14. 브라우저 검증

코드와 테스트가 끝난 뒤 관리자 로그인 세션이 있는 브라우저에서 확인한다.

반드시 검증할 상태:

1. pending + no fee + cash/no funds movement
2. pending + retainable Partner fee
3. payment authorization release
4. captured payment → refund request, Finance approval remains
5. missing evidence
6. validation error
7. concurrent/409 result
8. resolved read-only
9. light mode 1440×900
10. light mode 1600×900
11. dark mode 1440×900

안전 규칙:

- 전용 테스트 fixture만 사용한다.
- dialog와 before/after가 실제로 확인되기 전에는 money-changing confirm을 누르지 마라.
- 테스트 데이터 변경 전후를 기록한다.
- 브라우저 검증 종료 후 viewport와 theme를 원래 상태로 복원한다.
- 1024px 이하 화면은 열거나 보고하지 마라.

### 15. 완료 승인 기준

다음을 모두 만족하기 전에는 완료라고 말하지 마라.

- [ ] Admin 집중 테스트 100% 통과
- [ ] API post-match cancellation 집중 테스트 100% 통과
- [ ] Admin scope verification 통과
- [ ] API scope verification 통과
- [ ] 보호영역 변경 시 full local verification 통과 또는 환경상 실행 불가 사유를 정확히 기록
- [ ] 최신 API build가 실제 실행본에 반영됨
- [ ] 원 취소자와 관리자 결정자가 동시에 보존·표시됨
- [ ] 취소 시각과 결정 시각이 분리됨
- [ ] reason 없이 저장 불가
- [ ] `OTHER` note 없이 저장 불가
- [ ] fee가 없을 때 Keep/Waive 두 액션이 보이지 않음
- [ ] dialog가 고객 금액, Partner fee, review 상태 before/after를 표시
- [ ] payment/refund와 booking/audit의 부분 성공 없음
- [ ] chat 0건을 Evidence ready로 표시하지 않음
- [ ] cash/no-refund 건은 Refund not expected
- [ ] projected payout와 actual earning 구분
- [ ] resolved 화면에서 normal monitoring과 오래된 matching deadline이 primary가 아님
- [ ] 기본 상세 길이 6 viewport 이하 또는 같은 운영 효율을 객관적으로 증명
- [ ] 1440×900, 1600×900에서 수평 overflow·겹침 없음
- [ ] 관련 없는 action/lane은 기본 접힘
- [ ] locked action에 실행 링크 없음
- [ ] 해결 후 읽기 전용 문구가 입력 안내와 혼재하지 않음
- [ ] 새 브라우저 캡처로 변경 전/후를 비교

### 16. 결과물

작업 완료 후 다음을 남겨라.

1. 수정된 코드와 테스트
2. 다음 폴더에 after 스크린샷

```text
C:\dev\massage-on-demand-vn\output\booking-detail-remediation-after\
```

3. 다음 구현 보고서

```text
C:\dev\massage-on-demand-vn\output\booking-detail-remediation-after\booking-detail-remediation-implementation-report.md
```

구현 보고서에는 다음을 포함한다.

- 최종 운영 흐름 요약
- 변경 파일 목록
- 각 P0/P1/P2 요구사항의 구현 여부
- API/UI 계약 변경
- transaction 처리 방법
- original actor와 decision actor 저장·표시 방법
- 테스트 명령과 pass/fail/skipped 수
- 브라우저 검증 viewport와 상태
- before/after 스크린샷 링크
- 보호영역 변경 목록
- 남은 위험과 의도적으로 제외한 항목
- 커밋 여부: 만들지 않았음

최종 답변은 설명을 길게 늘이지 말고 다음 순서로 보고하라.

1. 완료/부분 완료/차단 판정
2. 핵심 변경
3. 테스트 결과
4. 보호영역과 남은 위험
5. 구현 보고서 링크

작업 도중 현재 코드가 보고서보다 이미 개선돼 있으면 동일 코드를 다시 만들지 말고 테스트로 확인한 뒤 남은 차이만 수정하라. 반대로 보고서에 없는 새로운 회귀를 발견하면 요청 범위 안에서 함께 수정하고 보고하라.

---

## 이 프롬프트가 의도하는 작업 순서

```text
현재 소스·실행본 기준선 확인
→ 실패 테스트와 UI/API 계약 정리
→ 금액 transaction과 audit truth 수정
→ 안전한 decision form 완성
→ 기본 화면 정보 구조 축소
→ evidence/action relevance 수정
→ 집중 테스트
→ scope/full verification
→ 최신 API 재실행
→ 1440/1600 브라우저 검증
→ 구현 보고서
```

