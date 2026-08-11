# Codex 실행 프롬프트 — Post-match Cancellations 2차 정밀 개선

아래 `MASTER PROMPT` 전체를 새 Codex 작업에 붙여 넣는다. 작업 폴더는 반드시 `C:\dev\massage-on-demand-vn`으로 연다.

이 프롬프트는 분석 보고서를 다시 요약하는 용도가 아니다. **현재 코드를 재검증한 뒤 실제 수정, 회귀 테스트, 로그인된 화면 검증까지 완료**하게 하는 실행 지시서다. 다만 결제·Partner fee 정책을 현재 코드와 테스트만으로 확정할 수 없거나 안전한 경합 처리가 DB 변경 없이 불가능하면 금전 동작을 추측하지 말고, 안전한 UI 차단과 정확한 blocker 보고까지만 수행한다.

---

# MASTER PROMPT

## 1. 역할과 최종 목표

너는 HANDS 관리자 웹의 운영 UX와 금전 처리 계약을 함께 다루는 시니어 엔지니어다.

저장소 `C:\dev\massage-on-demand-vn`에서 다음 페이지와 연결된 booking detail 흐름을 수정하라.

- 목록: `http://localhost:3101/bookings/post-match-cancellations`
- 미결 큐: `?view=manual-decision`
- 해결 기록: `?view=post-match-cancellations`
- No-show 큐: `?view=no-show`
- 목록에서 진입하는 `/bookings/[id]` 상세의 post-match decision 영역

목표는 장식적인 재디자인이 아니다. 운영자가 다음 질문에 즉시, 정확하게 답하고 안전하게 처리할 수 있는 화면을 만드는 것이다.

1. 왜 이 예약이 이 큐에 들어왔는가?
2. 고객 돈은 지금 어떤 상태이며, 버튼을 누르면 정확히 어떻게 바뀌는가?
3. 실제 Partner fee 또는 earning이 존재하는가?
4. 운영자가 선택할 수 있는 유효한 결과는 무엇인가?
5. 결정을 저장했는지, 실패했는지, 다른 운영자가 먼저 처리했는지 알 수 있는가?
6. 상세 검토 후 원래 작업 큐와 원래 행으로 돌아갈 수 있는가?

핵심 원칙:

> Visible facts → explicit before/after money outcome → one valid operator action → auditable result

계획이나 제안만 제출하지 말고, blocker가 없는 범위는 같은 작업에서 구현·테스트·브라우저 검증까지 완료하라.

## 2. 작업 시작 규칙

1. `C:\dev\massage-on-demand-vn\AGENTS.md`를 먼저 읽고 그대로 따른다.
2. 단일 에이전트로 작업한다. subagent나 multi-agent 도구를 사용하지 않는다.
3. `git status --short`와 `git diff --stat`으로 현재 dirty worktree를 확인하고, 사용자의 기존 변경을 되돌리거나 덮어쓰지 않는다.
4. 아래 감사 보고서와 증거 이미지를 읽고 현재 코드와 대조한다.
5. 보고서의 파일명과 라인 번호는 출발점일 뿐이다. `rg`로 함수의 모든 caller와 관련 spec을 찾고 실제 요청 흐름을 끝까지 추적한다.
6. 가장 작은 공통 원인을 수정한다. 한 화면 전용 service/factory/state 계층, 새 디자인 시스템, 새 대시보드 구조는 만들지 않는다.
7. 기존 helper, 컴포넌트, notice redirect, query builder, 테스트 패턴을 먼저 재사용한다.
8. 새 dependency를 설치하지 않는다.
9. 요청받지 않은 commit을 만들지 않는다.

`impeccable` 스킬을 사용할 수 있으면 narrow refinement의 **Operate + harden** 기준으로 정보 위계, 문구, 오류, 경합, empty state, 키보드 접근성을 점검한다. 이 작업을 위해 `PRODUCT.md`, `DESIGN.md`, 새 surface brief를 만들지 않는다.

## 3. 반드시 먼저 읽을 자료

### 감사 보고서

- `C:\dev\massage-on-demand-vn\output\post-match-cancellations-improvement-verification-2026-08-07\post-match-cancellations-post-implementation-deep-audit.md`

### 같은 폴더의 핵심 화면 증거

- `01-needs-decision-1440.png`
- `02-needs-decision-table-1440.png`
- `03-all-records-top-1440.png`
- `04-all-records-table-1440.png`
- `05-no-show-empty-1440.png`
- `06-reason-filter-empty-1440.png`
- `08-search-empty-result-1440.png`
- `09-detail-decision-panel-1440.png`
- `10-detail-decision-actions-1440.png`
- `11-needs-decision-table-1600.png`
- `13-needs-decision-table-dark-1440.png`
- `15-empty-queue-duplicate-dark-1440.png`
- `16-wallet-held-decision-1440.png`

### 우선 추적할 코드

- `apps/admin_web/app/bookings/booking-monitor-route-load-plan.ts`
- `apps/admin_web/app/bookings/booking-monitor.tsx`
- `apps/admin_web/app/bookings/booking-monitor-filters-section.tsx`
- `apps/admin_web/app/bookings/booking-monitor-list-section.tsx`
- `apps/admin_web/app/bookings/booking-post-match-cancellations-model.ts`
- `apps/admin_web/app/bookings/[id]/booking-outcome-review-panel.ts`
- `apps/admin_web/app/bookings/[id]/booking-detail-post-match-decision-section.tsx`
- `apps/admin_web/app/bookings/[id]/actions.ts`
- `apps/admin_web/lib/admin-nav-match.ts`
- `apps/admin_web/components/admin-workspace-header.tsx`
- `apps/admin_web/app/globals.css`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/payments/payments.service.ts`
- `apps/api/src/bookings/post-match-cancellation.ts`
- `apps/api/src/admin/admin-booking-list-query.ts`
- 관련 shared contract와 기존 spec

위 파일을 모두 수정하라는 뜻이 아니다. 실제 root cause와 caller를 확인한 뒤 필요한 최소 파일만 수정한다.

## 4. 화면 범위와 금지 범위

### 검증할 화면

- 1440×900
- 1600×900
- light theme
- dark theme

### 절대 범위에 넣지 말 것

- 1024px 이하 화면
- mobile/tablet responsive redesign
- 1024px 이하 breakpoint 문제의 분석, 수정, 테스트, 보고

기존 1024px 이하 CSS를 일부러 삭제하거나 망가뜨리지는 말되, 이번 작업의 완료 조건으로 검사하지 않는다. 기계적 detector가 1024px 이하 문제만 지적하면 이번 범위 밖으로 분류하고 최종 보고에도 개선 항목으로 올리지 않는다.

## 5. 현재 확인된 출시 차단 결함

현재 UI는 “Partner fee 결과만 선택한다”고 설명하지만 API의 두 결정은 모두 고객 payment closeout을 먼저 수행한다.

현재 확인된 호출 흐름:

```text
booking-detail-post-match-decision-section.tsx
→ apps/admin_web/app/bookings/[id]/actions.ts
→ admin API resolvePostMatchCancellation()
→ closeUnmatchedBookingPayment()
→ payment release 또는 refund request
→ cancellation decision/earning 처리
```

현재 화면에는 다음 모순이 동시에 존재할 수 있다.

```text
Customer money: Wallet amount still held · 400,000 VND · AUTHORIZED
Partner fee: No Partner payable · no earning/payout created
Actions: Waive Partner fee deduction / Keep Partner fee deduction
```

운영자는 fee 선택만 한다고 생각하지만 실제로는 wallet hold release 또는 refund request까지 발생할 수 있다. fee/earning이 없는데도 fee 유지/면제를 선택하게 한다. 결정 사유 입력이 없고, 실패 응답은 조용히 삼키며, payment 처리와 decision claim 순서도 경합 위험이 있다.

이 결함은 copy-only 수정으로 해결하지 않는다. UI의 action model, server action 피드백, API 계약과 테스트가 같은 결과를 말하게 한다.

## 6. Phase 0 — 수정 전 계약 확인

코드를 수정하기 전에 다음 truth table을 현재 코드·DTO·테스트로 작성하고 작업 메모에 남긴다.

| 입력 facts | 고객 돈 현재 상태 | 실제 customer closeout 결과 | 실제 fee/earning 존재 여부 | 허용할 운영자 결정 | 최종 review 상태 |
|---|---|---|---|---|---|
| Wallet `AUTHORIZED` | hold 금액 | release | 없음/있음 | 코드와 정책으로 확인 | 확인 |
| Payment `CAPTURED` | captured 금액 | refund request 또는 기존 상태 | 없음/있음 | 코드와 정책으로 확인 | 확인 |
| CASH | 외부 자금 이동 없음 | no movement | 없음/있음 | 코드와 정책으로 확인 | 확인 |
| payment 없음 | 없음 | no movement | 없음/있음 | 코드와 정책으로 확인 | 확인 |

반드시 확인할 내용:

- APPROVED와 HELD가 customer payment에 주는 실제 차이가 있는가?
- fee/earning record가 없을 때 HELD가 유효한 비즈니스 결과인가?
- `closeUnmatchedBookingPayment()`가 RELEASED/REFUNDED/CAPTURED/AUTHORIZED 각각에서 무엇을 하는가?
- 동일 booking을 두 운영자가 동시에 처리할 때 어느 지점에서 한 명만 claim하는가?
- payment mutation이 실패하면 review decision은 어떤 상태로 남는가?
- reason/note를 저장할 기존 필드 또는 audit 경로가 있는가?

### 금전 정책 blocker 규칙

- 코드와 기존 테스트만으로 fee가 없는 건의 HELD 의미를 확정할 수 없으면 의미를 발명하지 않는다.
- 안전한 임시 상태는 **모순되는 버튼을 숨기거나 비활성화하고, 이유를 화면에 설명하는 것**이다.
- API 원자성/경합을 DB migration 없이 안전하게 보장할 기존 패턴이 없으면 새 상태 머신을 임의로 만들지 않는다.
- 이 경우에도 P1/P2의 비금전 UI 개선과 테스트 가능한 안전 조치는 계속 수행하고, P0 blocker를 파일·호출 순서·필요한 제품 결정과 함께 보고한다.
- 결제·수수료 정책을 확인하지 못한 상태에서 현재 버튼 이름만 더 강하게 바꾸는 것은 금지한다.

## 7. Phase 1 — P0 금전 결정 안전성

### P0-1. 실제 상태 기반 action model

결정 패널 바로 위에 `This action will change` 결과 요약을 둔다. 선택 전과 선택 후를 다음 세 축으로 표시한다.

1. Customer money
2. Partner fee/earning
3. Review status

최소 표시 규칙:

| 현재 facts | 반드시 표시할 결과 |
|---|---|
| Wallet `AUTHORIZED` | `400,000 VND wallet hold → released`처럼 실제 금액 포함 |
| Payment `CAPTURED` | `Refund request will be created · Finance approval still required` |
| CASH 또는 payment 없음 | `No customer funds movement` |
| 실제 fee/earning 없음 | `No Partner fee record · no fee amount to decide` |
| 실제 fee/earning 있음 | 현재 금액과 waive/keep 후 결과 |

버튼은 실제 전체 결과를 말해야 한다. 예:

| 현재 facts | 권장 action copy |
|---|---|
| Wallet AUTHORIZED + fee 없음 | `Approve cancellation & release 400,000 VND` |
| Wallet AUTHORIZED + fee 있음, waive | `Approve, release wallet hold & waive Partner fee` |
| Wallet AUTHORIZED + fee 있음, keep | `Release wallet hold & keep Partner fee` |
| CAPTURED | `Approve & request customer refund`에 Partner 결과까지 명시 |
| CASH + fee 없음 | `Close review — no money movement` |

규칙:

- 실제 fee/earning이 없으면 `Waive fee` / `Keep fee` 두 버튼을 렌더링하지 않는다.
- 정책상 유효한 결과가 하나뿐이면 primary action 하나만 보여준다.
- customer payment와 Partner fee가 반드시 한 mutation으로 묶인 계약이면 버튼과 confirmation이 **둘 다** 말하게 한다.
- 예상 payout rule을 실제 earning처럼 decision 근거로 사용하지 않는다.
- 실제 상태가 불완전하면 행동 버튼보다 `Cannot resolve safely` 상태와 필요한 후속 조치를 보여준다.
- 서버가 신뢰할 수 없는 client preview를 그대로 받아 금액을 결정하게 하지 않는다. 서버는 현재 booking facts를 다시 검증한다.

한 화면만을 위한 거대한 polymorphic action framework를 만들지 않는다. 기존 post-match model을 확장하거나, UI와 테스트에서 공유할 가치가 있을 때만 작은 pure helper를 같은 feature 폴더에 둔다.

### P0-2. 결정 사유와 감사 기록

- 결정 reason을 필수로 받는다.
- 3~5개의 기존 정책에 근거한 preset을 사용한다. 임의의 새 정책 사유를 발명하지 않는다.
- `Other`를 선택하면 구체 note를 필수로 한다.
- 기존 audit/note 필드를 재사용한다. 이 요구 때문에 DB schema나 migration을 추가하지 않는다.
- confirmation에는 reason, customer money before/after, Partner fee before/after, 최종 review status를 모두 표시한다.
- 유효성 검사는 client와 server 양쪽에서 한다.
- 사용자 입력은 실패 후에도 보존한다.

### P0-3. 성공·실패·경합 피드백

`apps/admin_web/app/bookings/[id]/actions.ts`의 기존 `adminPostOrThrow()`와 notice redirect 패턴을 재사용한다.

- 성공: 실제 처리 결과를 포함한 success notice
- 400/422: 구체 validation notice
- 401/403: 기존 인증/권한 처리 유지
- 409/already resolved: `Another operator already resolved this review. Refresh to see the result.`
- 500/네트워크 실패: 성공처럼 revalidate하지 말고 failure notice와 retry 경로 제공
- 제출 중 두 action을 모두 disable
- `Saving decision…` 상태 표시
- 빠른 연속 클릭과 Enter 중복 제출 방지
- 완료/실패 후 상태 메시지를 screen reader가 알 수 있게 하고 적절한 위치로 focus 이동

native `window.confirm`만으로 금전 결과를 전달하지 않는다. 기존 modal/dialog가 있으면 재사용하고, 없으면 가장 작은 semantic dialog 패턴을 사용한다. 새 modal library는 설치하지 않는다.

### P0-4. API 중복 처리와 순서

현재 payment closeout이 decision claim보다 먼저 실행되는 흐름을 그대로 두고 UI만 고치지 않는다.

- 동일 booking에 대한 두 동시 요청 중 한 요청만 성공해야 한다.
- loser는 명확한 conflict를 받아야 한다.
- customer payment release/refund request와 earning 처리가 중복 실행되지 않아야 한다.
- payment 실패 후 review가 성공으로 기록되거나, review claim 실패 후 payment만 먼저 이동하는 상태를 방지한다.
- payments/bookings 영역에 이미 있는 idempotency, conditional update, transaction 패턴을 먼저 찾고 재사용한다.
- 새 분산 트랜잭션 계층이나 새 state machine을 만들지 않는다.
- 안전한 순서를 현재 schema와 기존 패턴으로 만들 수 없으면 금전 mutation을 추측 수정하지 말고 blocker를 보고한다.

`apps/api/src/payments/**`, `apps/api/src/bookings/**`, shared contract는 보호 영역이다. 변경 시 `AGENTS.md`의 추가 검증을 반드시 수행한다.

## 8. Phase 2 — P1 작업공간·큐·필터 구조

### P1-1. 상세의 원래 작업공간 보존

현재 상단 Back 링크는 `returnTo`와 행 anchor를 보존하지만 breadcrumb, 좌측 active menu, 내부 `Open review queue`는 Live Bookings 또는 resolved view를 가리킬 수 있다.

요구사항:

- 기존 route parsing/helper를 먼저 찾는다.
- 필요하면 허용된 내부 booking 경로만 받는 작은 shared helper 하나로 effective workspace를 계산한다.
- 외부 URL, protocol-relative URL, 잘못된 경로는 거부하고 안전한 post-match 기본 경로로 fallback한다.
- `manual-decision`에서 진입: breadcrumb, active nav, Back, queue link 모두 `Needs decision`
- `no-show`에서 진입: 모두 `No-show review`
- resolved에서 진입: 모두 `Resolved records`
- Back은 가능한 경우 원래 행 anchor까지 보존한다.
- 내부 링크 문구도 `Back to Needs decision`, `Back to No-show review`, `Back to Resolved records`처럼 실제 목적지를 말한다.

### P1-2. dedicated post-match IA

이 페이지의 정상 작업 경로는 상단 세 탭으로 충분하다.

```text
[Needs decision] [Resolved records] [No-show review]
```

- visible label `All cancellation records`를 `Resolved records`로 변경한다.
- 내부 query id `post-match-cancellations`는 호환을 위해 유지한다.
- `Resolved records`는 현재 계약대로 `decisionSource <> open`만 보여야 한다.
- dedicated post-match page에서는 `Additional queues` disclosure를 렌더링하지 않는다.
- 중복 `No-show review 0`와 `Live flow, exceptions, and history` 문구를 제거한다.
- 다른 bookings workspace의 Additional queues 동작은 변경하지 않는다.

가장 작은 수정은 post-match caller에서 기존 `showAdditionalQueues={false}` 또는 동등한 기존 분기를 사용하는 것이다. generic queue 시스템을 재설계하지 않는다.

### P1-3. summary scope 분리

서로 다른 기간의 수치를 한 묶음 KPI처럼 보여주지 않는다.

```text
Open workload · All dates
Needs decision N · Overdue N · No-show N

Resolved · Last 30 days
Total N · Auto-approved N · Admin approved N · Fee kept N · Legacy N
```

- 선택한 resolved 기간이 달라지면 `Last 30 days`도 실제 기간 문구로 바뀐다.
- 검색과 cancellation reason이 summary를 필터링하지 않는 기존 정책을 유지한다면 `Overall`을 명시한다.
- 표 제목 옆에는 `Current result: N`을 별도로 표시한다.
- 같은 숫자를 summary, tab, age, SLA에 반복해서 화면 높이를 늘리지 않는다.

### P1-4. filter와 empty state

- Search, Cancellation reason, Apply, Reset을 한 행 안에서 끝낸다.
- Reset은 화면에 한 번만 노출한다. 필터 form과 empty card에 중복 렌더링하지 않는다.
- 기본값은 URL에 `q=&cancellationReason=all`로 남기지 않는다. 기존 query helper로 canonical URL을 만든다.
- 필터 결과가 0이면 `Current result: 0`을 표시하고 SLA `On time`을 성공처럼 표시하지 않는다.
- active filter chip 또는 간단한 summary로 어떤 조건 때문에 0건인지 알 수 있게 한다.

No-show 규칙:

- 0건이면 탭과 compact empty state만 보인다.
- 0건에서 Cancellation reason, Decision age, Order, SLA `On time`, Target 2h를 숨긴다.
- No-show에는 postMatchCancellation `reasonCode` 필터를 재사용하지 않는다.
- 실제 저장된 No-show 필드가 없으면 새 필터를 발명하지 말고 검색만 유지하거나 필터를 숨긴다.
- 활성 No-show fixture를 테스트로 만들 수 있으면 payment state, evidence completeness 등 실제 facts만 사용한다.

## 9. Phase 3 — P1 1440 운영 밀도와 테이블

### P1-5. 첫 viewport에 실제 작업 행 표시

현재 1440×900에서 table top은 약 1,214.5px다. 제목, status, summary, queue, tab, filter, age/order/SLA가 반복돼 첫 작업 행이 보이지 않는다.

최소 수정 방향:

1. 제목과 historical/data-class status를 compact header로 정리한다.
2. summary를 `Open workload`와 `Resolved · period` 두 compact group으로 합친다.
3. Decision age, Order, SLA를 세 개의 큰 영역이 아니라 한 줄 toolbar로 합친다.
4. Additional queues를 제거한다.
5. 검색/사유/Apply/Reset을 한 행에서 끝낸다.

기존 `AdminSegmentedControl`, `StatusBadge`, `AdminForm*`, toolbar/disclosure 패턴을 재사용한다. 새 dashboard component 계층은 만들지 않는다.

합격 기준:

- 1440×900에서 table header와 첫 row의 핵심 상태 및 Next action이 초기 viewport 안에 보인다.
- 목표 측정값: table header/first row가 760~820px 부근 이내에서 시작하고, 첫 row action이 viewport 아래로 완전히 밀리지 않는다.
- 1600×900에서도 지나치게 넓게 퍼지거나 정렬이 깨지지 않는다.

### P1-6. 1440 가로 overflow 제거

현재 1440에서 wrapper `clientWidth ≈ 1052`, table `scrollWidth ≈ 1120`, overflow `≈ 68px`다.

- post-match table에만 scope class를 추가하거나 기존 scope selector를 재사용한다.
- `min-width: 0; width: 100%; table-layout: fixed` 방향으로 수정한다.
- 권장 열 비율: Decision 13%, Booking 17%, Reason/Evidence 24%, Payment 14%, Partner impact 14%, Next action 18%.
- 비율은 실제 DOM 측정과 긴 데이터에서 조정할 수 있으나 6개 정보 그룹은 유지한다.
- 반복 helper는 한 줄로 줄인다.
- 긴 reason detail은 2줄 clamp와 접근 가능한 전체 텍스트 또는 상세 링크를 사용한다.
- Next action을 ellipsis로 숨기지 않는다.
- shared `.admin-table` 전체를 바꾸지 않는다.

합격 기준:

```text
1440 table scrollWidth <= clientWidth
1600 table scrollWidth <= clientWidth
Next action bounding box가 scroll container 안에 완전히 보임
```

## 10. Phase 4 — P2 운영 문구와 데이터 신뢰

### P2-1. 문구 교체

| 현재 | 변경 |
|---|---|
| `All cancellation records` | `Resolved records` |
| `Decision age is measured from decisionAt: closed time, then updated time, then created time.` | `Decision age starts at cancellation time. If unavailable, the latest recorded update is used.` |
| `No earning / Fee amount unavailable / Needs decision` | `No Partner fee record · No fee amount to decide` |
| earning이 없는데 `View restored fee record` | `View cancellation outcome` |
| `Auto-resolved` | `Auto-approved · fee waived` |
| `Admin approved` | `Admin approved · fee waived` |
| `Admin kept fee` | `Admin decision · fee kept` |
| generic `Open review queue` | 실제 원래 queue 이름 |
| fee가 없는데 `Keep existing deduction` | 버튼 렌더링 금지 |

화면의 사용자 문구는 영어를 유지한다. user-facing copy에는 `Provider`가 아니라 `Partner`를 사용한다. 내부 field name인 `decisionAt`을 운영자 문구에 노출하지 않는다.

### P2-2. projected payout과 실제 earning 분리

현재 evidence bundle의 payout rule 계산값을 실제 원장 금액처럼 보이게 하지 않는다.

- 실제 earning이 없으면 `Projected payout rule: 320,000 VND · no earning created`처럼 표시한다.
- 실제 earning/fee와 catalog projection을 같은 `Partner` 금액으로 합치지 않는다.
- decision panel과 confirm은 실제 ledger/earning facts만 사용한다.
- 이미 존재하는 `booking-finance-trace` 또는 동등 helper를 재사용하되 label만 정확히 한다.

### P2-3. local/test data 신뢰 표시

현재 visible row에 `Local E2E`, `smoke`, demo note가 있는데 `No audit fixtures on this page`가 표시될 수 있다.

- 이름, note, free text의 `E2E`, `smoke`, `demo` 문자열로 fixture를 추측하지 않는다.
- 기존 metadata/dataClass 필드를 확인하고 fixture 생성 시 명시적 classification을 저장한다.
- list와 summary는 같은 classification predicate를 사용한다.
- 모든 row가 명시적으로 production이라고 확인되지 않으면 `No audit fixtures`라고 단정하지 않는다.
- local 환경에서는 기존 environment fact로 `Local data`를 표시하는 가장 작은 대안을 우선한다.
- 이를 위해 DB schema/migration을 추가하지 않는다.
- 명시적 metadata 경로가 없다면 거짓 신뢰 문구를 제거하고 blocker를 보고한다.

## 11. 반드시 보존할 정상 동작

- manual-decision/no-show 미결 큐가 선택 기간 때문에 숨지 않는 동작
- Needs decision의 oldest-first, resolved의 newest-first 정렬
- 2시간 SLA 계산과 목록/상세 일치
- cancellation reason 6개와 Legacy/unknown 처리
- 검색 및 명확한 empty result 문구
- actor, reason, chat, location, payment, Partner 상태를 한 행에서 확인하는 6개 정보 그룹
- row link의 `returnTo`와 booking anchor
- 자동/관리자/Legacy result source 구분
- historical 화면에 realtime 상태를 표시하지 않는 동작
- light/dark theme의 현재 상태 의미와 읽기 가능성
- customer/Partner 연락처 masking과 기존 권한 처리
- 다른 `/bookings` workspace의 queue 구조

## 12. 구현 제약

- 사용자 dirty worktree를 정리하거나 되돌리지 않는다.
- `git reset --hard`, `git checkout --`, 광범위한 formatting을 사용하지 않는다.
- 새 npm dependency, UI library, modal library, table library, state library를 설치하지 않는다.
- DB schema와 migration을 추가하지 않는다.
- customer app과 Partner app을 수정하지 않는다.
- route와 기존 query id를 바꾸지 않는다.
- 기존 payment/refund 정책을 추측으로 바꾸지 않는다.
- 서버 validation, permission, audit, accessibility, error handling을 생략하지 않는다.
- 테스트 assertion을 삭제·완화하거나 snapshot을 무분별하게 갱신해 통과시키지 않는다.
- 감사 PNG를 앱 asset으로 복사하지 않는다.
- 1024px 이하 UI를 수정 목표로 삼지 않는다.
- 요청받지 않은 commit을 만들지 않는다.

## 13. 필수 회귀 테스트

기존 spec을 먼저 찾아 가장 가까운 파일에 추가한다. 테스트를 위해 production abstraction을 만들지 않는다.

### Admin Web

#### 결정 action model

- fee/earning 없음 → waive/keep 두 버튼 없음
- Wallet AUTHORIZED → confirm/preview에 release 금액 표시
- CAPTURED → refund request 생성과 finance approval 필요 표시
- CASH/no payment → no customer funds movement 표시
- 실제 fee 있음 → waive/keep 각각의 Partner 금액 결과 표시
- decision reason 미선택 → 제출 불가
- Other + 빈 note → 제출 불가
- valid reason/note → action payload와 audit 저장 경로에 포함
- 4xx/422/500 → 실패 notice
- 409/already resolved → 별도 conflict notice
- pending 중 두 버튼 disable 및 중복 제출 방지
- 성공과 실패 후 screen-reader status/focus 처리

#### workspace/queue/filter

- `manual-decision`, `no-show`, resolved 각각 상세 진입 후 breadcrumb, active nav, Back, queue link가 같은 workspace 유지
- 외부/잘못된 `returnTo` 거부
- post-match page에 `Additional queues` 없음
- 중복 `No-show review 0` 없음
- visible label은 `Resolved records`, 내부 query id는 유지
- `Resolved records`만 `decisionSource <> open` 사용
- No-show 0건에서 Cancellation reason, Decision age, SLA `On time` 없음
- Reset은 화면당 한 번
- default filter URL에 빈 `q`와 `cancellationReason=all` 없음
- overall summary와 current result scope가 구분됨

#### copy/data/layout

- earning 없음 → `View cancellation outcome`
- projected payout과 actual earning label 분리
- source label 세 가지의 fee 의미 표시
- explicit dataClass가 없을 때 `No audit fixtures` 단정 금지
- 1440 post-match table에 강제 1120px minimum 없음
- 기존 `booking-detail-post-match-decision-section.spec.tsx`의 false-positive를 수정한다. `1. Why cancelled` 또는 최종 확정 copy가 **실제로 존재함을 먼저 assert**한 뒤 순서를 비교한다.

### API

- APPROVED/HELD 각각 Wallet AUTHORIZED, CAPTURED, CASH, no payment 조합
- payment closeout, decision claim, earning 처리의 실행 순서
- fee 없음에서 HELD의 명시적 허용/거부 계약
- 같은 booking에 동시 요청 두 개 → 한 건만 성공, loser conflict
- customer payment 이동/환불 요청 중복 없음
- payment 실패 시 false resolved 상태 없음
- reason/note server validation과 audit 저장
- fixture classification이 list와 summary에서 동일한 predicate 사용

### 현재 감사 baseline

- Admin Web 집중 테스트: 11 files, 127 tests passed
- API post-match 집중 테스트: 3 files, 10 tests passed, 595 skipped
- API no-show 집중 테스트: 1 file, 3 tests passed, 554 skipped

baseline은 면죄부가 아니다. 같은 실패가 나면 이번 변경과의 관련성을 확인하고, 관련 없는 기존 실패는 정확한 command와 error를 별도 보고한다.

## 14. 검증 명령

먼저 `rg --files`와 `rg -l`로 관련 spec을 확인한 뒤 focused tests를 실행한다.

```powershell
npm.cmd exec --workspace @massage-vn/admin-web -- vitest run --config vitest.config.mts <관련 admin spec 파일들>
npm.cmd exec --workspace @massage-vn/api -- vitest run --config vitest.config.mts src/admin/admin.service.spec.ts src/admin/admin-booking-list-query.spec.ts src/admin/admin-booking-list-metadata.spec.ts -t "post-match|no-show"
```

그다음 scope 검증을 실행한다.

```powershell
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

결제, booking, shared contract 등 보호 영역의 behavior를 변경했다면 full local 검증도 실행한다.

```powershell
npm.cmd run verify:local
```

로컬 service가 준비돼 있고 보호 영역 behavior가 변경됐다면 다음도 시도한다.

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

환경 문제로 실행할 수 없는 검증은 생략하지 말고 `skipped`와 정확한 이유를 기록한다. 마지막으로 다음을 실행한다.

```powershell
git diff --check
git status --short
```

`impeccable`을 사용했고 UI 파일을 변경했다면 전체 수정이 끝난 뒤 detector를 한 번만 실행한다. `<changed targets>`에는 실제 변경한 Admin Web UI/CSS 파일만 넣는다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <changed targets>
```

1024px 이하만 해당하는 finding은 범위 밖으로 분류한다.

## 15. 로그인된 실제 브라우저 검증

테스트만으로 완료하지 않는다. 로그인된 in-app browser 세션에서 실제 화면을 조작하고 새 증거 폴더에 캡처한다.

```text
output/post-match-cancellations-remediation-verification-YYYY-MM-DD/
```

기존 감사 이미지를 덮어쓰지 않는다.

### 필수 상태

1. 1440×900 light — Needs decision 상단과 첫 row
2. 1440×900 light — Resolved records 상단과 첫 row
3. 1440×900 light — No-show 0건
4. 1440×900 light — 검색/사유 필터 0건과 단일 Reset
5. 1440×900 light — Wallet AUTHORIZED 상세의 before/after와 action
6. 1440×900 light — fee/earning 없는 상세의 단일 유효 action 또는 safe blocked state
7. 1440×900 light — validation failure, 409, 500 feedback를 자동화 fixture/mock으로 확인
8. 1600×900 light — Needs decision table
9. 1440×900 dark — Needs decision table과 detail decision

### 필수 상호작용

- 세 primary tab 전환
- 검색, reason filter, Apply, Reset
- No-show empty state 확인
- 목록 행 → 상세 → 원래 queue/anchor 복귀
- `manual-decision`, `no-show`, resolved 각각의 breadcrumb/active nav/queue link 확인
- reason preset/Other validation
- submit pending과 빠른 중복 클릭 방지
- 성공/실패/이미 처리됨 notice

실제 금전 상태를 바꾸는 mutation을 기존 local row에 무작정 실행하지 않는다. 명시적으로 test로 분류된 fixture, 자동화 mock, rollback 가능한 전용 test data를 사용한다. 안전한 fixture가 없으면 destructive interaction은 실행하지 말고 unit/integration test와 non-mutating preview까지만 검증했다고 보고한다.

### DOM 측정값

최종 보고에 다음 값을 포함한다.

```text
viewport width/height
table clientWidth
table scrollWidth
horizontal overflow = scrollWidth - clientWidth
table header top
first row top/bottom
Next action left/right와 scroll container left/right
```

합격 기준:

- 1440과 1600에서 horizontal overflow가 0
- Next action이 가로 이동 없이 완전히 보임
- 1440×900 초기 viewport에서 table header와 첫 row의 핵심 상태/action 확인 가능
- copy, amount, action이 겹치거나 잘리지 않음
- light/dark에서 동일한 상태 의미 유지
- keyboard focus와 semantic control 유지

## 16. 완료 승인 체크리스트

다음이 모두 충족되기 전에는 완료라고 보고하지 않는다.

- [ ] Customer money와 Partner fee/earning의 before/after가 결정 전에 실제 금액과 함께 보인다.
- [ ] Wallet AUTHORIZED, CAPTURED, CASH/no payment가 서로 다른 실제 결과로 표시된다.
- [ ] fee/earning이 없으면 존재하지 않는 deduction을 waive/keep하도록 요구하지 않는다.
- [ ] 운영자 decision reason/note가 필수이며 audit에 저장된다.
- [ ] 성공, validation failure, server failure, already resolved가 서로 다른 메시지로 보인다.
- [ ] 중복 제출이 차단된다.
- [ ] 동시 처리에서 한 요청만 성공하고 customer payment가 중복 이동하지 않는다.
- [ ] payment 실패/claim 실패가 partial false success를 만들지 않는다.
- [ ] breadcrumb, active nav, Back, queue link가 원래 workspace와 일치한다.
- [ ] `Resolved records` 이름과 `decisionSource <> open` 계약이 일치한다.
- [ ] Additional queues와 중복 No-show 링크가 없다.
- [ ] No-show 0건에 무의미한 cancellation filter/age/SLA 성공 표시가 없다.
- [ ] Overall summary와 Current result의 범위가 분명하다.
- [ ] 1440×900에서 첫 작업 행과 Next action이 초기 viewport에 보인다.
- [ ] 1440과 1600에서 table horizontal overflow가 0이다.
- [ ] projected payout과 actual earning/fee가 구분된다.
- [ ] test/local data 표시가 명시적 fact와 일치하고 이름 문자열로 추측하지 않는다.
- [ ] 관련 focused tests와 admin/api scope 검증이 통과한다.
- [ ] 보호 영역 behavior 변경 시 full local 검증을 수행했거나 정확한 skipped 이유가 있다.
- [ ] 새 dependency, migration, 불필요한 추상화가 없다.
- [ ] 사용자의 기존 변경과 다른 booking workspace가 보존됐다.
- [ ] 1024px 이하 분석·수정·보고가 포함되지 않았다.

P0 금전 정책이 blocker이면 해당 체크를 억지로 통과시키지 않는다. 안전하게 숨김/비활성화한 범위, 구현한 비금전 개선, 필요한 제품 결정, 남은 테스트를 구분해 `blocked`로 보고한다.

## 17. 최종 보고 형식

다음 순서로 짧고 증거 중심으로 보고한다.

1. 운영자 관점의 결과와 완료/부분 완료/blocked 판정
2. 변경 파일
3. 확정한 money decision truth table
4. 결정 UI/API/경합 수정 결과
5. queue IA, filter, copy, 1440 table 결과
6. 브라우저 캡처 경로와 DOM 측정값
7. 실행한 명령과 pass/fail/skipped
8. 보호 영역 변경 여부와 full verification 결과
9. 남은 위험 또는 확인하지 못한 상태
10. commit을 만들지 않았으면 `Not committed`
11. 다음 권장 작업 1개

최종 diff를 직접 검토해 증상별 임시 분기, 중복 helper, 불필요한 파일 추가가 없는지 확인한다. 계획이나 수정 제안만 제출하지 말고 구현·검증 결과를 제출하라.
