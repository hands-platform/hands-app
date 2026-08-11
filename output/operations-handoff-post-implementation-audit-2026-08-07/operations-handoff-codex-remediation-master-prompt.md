# Shift Handoff 재감사 후 Codex 개선 구현 프롬프트

- 작성일: 2026-08-07
- 작업 저장소: `C:\dev\massage-on-demand-vn`
- 근거 보고서: `output/operations-handoff-post-implementation-audit-2026-08-07/operations-handoff-post-implementation-deep-audit.md`
- 목적: 재감사 결과를 Codex가 다시 해석만 하지 않고 실제 코드 수정, 회귀 테스트, 로그인된 화면 검증까지 완료하도록 하는 실행 명세
- 검증 화면: **1440×900, 1600×900만 대상**
- 제외 화면: 1024px 이하 및 모바일 레이아웃은 작업·검사·보고에서 완전히 제외

## 사용 방법

아래 `MASTER PROMPT` 전체를 새 Codex 작업에 그대로 붙여 넣는다. 저장소 루트 `C:\dev\massage-on-demand-vn`에서 실행한다.

## MASTER PROMPT

```text
작업 위치는 C:\dev\massage-on-demand-vn 이다.

관리자 웹의 Shift Handoff를 재감사 보고서 기준으로 실제 수정하라. 이번 작업은 추가 감사, 디자인 제안, 구현 계획만 작성하는 작업이 아니다. 관련 코드를 끝까지 추적하고, 필요한 코드를 수정하고, 회귀 테스트와 로그인된 로컬 화면 검증을 완료하라.

근거 보고서:

output/operations-handoff-post-implementation-audit-2026-08-07/operations-handoff-post-implementation-deep-audit.md

핵심 결과:

1. Shift Handoff는 사이드바 항목 하나와 하나의 canonical workspace로 통일한다.
2. `/operations-handoff`는 일상 업무인 `Current shift`를 기본으로 연다.
3. `/operations-handoff?view=history`는 보조 조회 mode인 `History`를 연다.
4. 기존 `/operations-handoff?view=handoff`는 filter query를 보존하면서 canonical Current URL로 정리한다.
5. Current와 History를 같은 페이지에 동시에 길게 렌더링하지 않는다. 활성 mode의 데이터만 요청한다.
6. 현재 `owner`는 원본 booking/payment/refund/Partner/notification record의 실제 assignment가 아니라 handoff 후속 조치 책임을 나타내는 ledger metadata다. UI와 contract가 이 사실을 정확히 말하게 한다.
7. API 실패를 0건으로 보이지 않게 하고, 100건 이후 누락, 전체 audit log 메모리 scan, acknowledgement 동시 중복 가능성을 해결한다.
8. 0건일 때 불필요한 대형 빈 section을 줄이고, 운영자의 주요 action을 첫 viewport에서 찾을 수 있게 한다.
9. 1440×900과 1600×900에서만 검증한다. 1024px 이하와 모바일 대응은 구현·검사·최종 보고에 포함하지 않는다.

계획만 제시하고 멈추지 말고 아래 순서와 완료 기준에 따라 구현하라.

## 1. 작업 전 필수 확인

다음을 먼저 수행한다.

1. 저장소 루트와 하위 경로에 적용되는 `AGENTS.md`를 모두 읽는다.
2. 근거 보고서를 처음부터 끝까지 읽는다.
3. 보고서에 포함된 다음 캡처를 직접 확인한다.
   - `01-current-history-1440.jpg`
   - `02-current-workspace-top-1440.jpg`
   - `03-current-workspace-queues-1440.jpg`
   - `04-create-handoff-form-1440.jpg`
   - `05-history-1600.jpg`
   - `06-workspace-top-1600.jpg`
   - `07-workspace-dark-1440.jpg`
   - `08-clear-handoff-preview-1440.jpg`
4. `git status --short`로 기존 사용자 변경을 확인하고 보존한다.
5. 수정 전 `rg`로 route, href, component, API method, audit action의 모든 caller와 test를 찾는다.
6. 현재 구현을 실제로 실행해 두 URL의 차이, sidebar active, breadcrumb, empty state를 재현한다.

우선 확인할 파일:

Admin Web:

- `apps/admin_web/app/operations-handoff/page.tsx`
- `apps/admin_web/app/operations-handoff/page.spec.tsx`
- `apps/admin_web/app/operations-handoff/actions.ts`
- `apps/admin_web/app/operations-handoff/actions.spec.ts`
- `apps/admin_web/app/operations-handoff/operations-shift-handoff-section.tsx`
- `apps/admin_web/app/operations-handoff/operations-shift-handoff-section.spec.tsx`
- `apps/admin_web/app/operations-handoff/operations-shift-handoff-form.tsx`
- `apps/admin_web/lib/admin-navigation.ts`
- `apps/admin_web/lib/admin-nav-match.ts`
- `apps/admin_web/app/page.tsx`
- `apps/admin_web/app/finance-closeout/finance-closeout-evidence-checklist-section.tsx`
- `apps/admin_web/app/finance-closeout/finance-closeout-shift-action-map-section.tsx`
- `apps/admin_web/app/finance-closeout/finance-closeout-task-board-section.tsx`
- `apps/admin_web/components/admin-desktop-only-gate.tsx`
- 관련 공통 component, CSS, spec

API:

- `apps/api/src/admin/admin.service.ts`
- operations-handoff route/controller가 실제 위치한 파일
- Prisma schema와 AdminAuditLog 관련 migration/index
- `apps/api/src/admin/admin.service.spec.ts`의 `AdminService shift handoff ledger` suite

파일 이름만 보고 모두 수정하지 말고 실제 import/caller를 추적한다. 이미 있는 Admin component, navigation helper, filter form, pagination, status badge, error state, action notice, date formatter를 재사용한다.

## 2. 고정 제품 결정

아래 결정은 구현 중 임의로 바꾸지 않는다.

### 2.1 정보 구조와 URL

- sidebar에는 `Shift Handoff` 하나만 둔다.
- canonical Current URL: `/operations-handoff`
- History URL: `/operations-handoff?view=history`
- legacy Current URL: `/operations-handoff?view=handoff`
  - 가능하면 `view`만 제거하고 `q`, `queue`, `age`, `page` 등 Current filter query는 보존해 redirect한다.
  - redirect가 기존 서버 흐름과 충돌하면 Current alias로 계속 렌더링하되 새 링크는 절대 legacy URL을 만들지 않는다.
- 두 mode 모두 sidebar의 동일 `Shift Handoff` 항목이 active여야 한다.
- breadcrumb는 두 mode 모두 `HANDS > Live Operations > Shift Handoff`를 유지한다.
- 상단 mode navigation label은 `Current shift`와 `History`다.
- URL 이동이므로 link와 `aria-current="page"`를 사용한다. 가짜 ARIA tab widget을 만들지 않는다.
- Current에서 History API를 요청하지 않는다.
- History에서 open cases/operators/current handoff API를 요청하지 않는다.
- Current와 History를 한 긴 화면에 동시에 쌓지 않는다.

### 2.2 Owner 의미

이번 작업에서는 여러 source domain record의 실제 owner를 새로 변경하지 않는다. 현재 handoff 기능은 append-only shift responsibility ledger다.

- `Default case owner`를 `Follow-up owner`로 바꾼다.
- 의미: handoff 이후 follow-up 책임을 기록하는 operator다.
- 원본 booking/payment/refund/Partner/notification record를 재배정하지 않는다는 사실을 form 또는 preview에 한 번 명확히 표시한다.
- incoming operator와 follow-up owner가 같을 때 동일 정보를 상단에 두 번 보여주지 않는다.
- 별도 owner가 필요한 예외에만 `Follow-up owner override`를 Advanced 영역에서 제공한다.
- API field를 바로 삭제해 legacy audit metadata를 깨지 않는다. 기존 `ownerId`, `owner`는 읽기 호환성을 유지하되 화면·type 설명과 새 테스트가 follow-up responsibility 의미를 사용하게 한다.
- 실제 source assignment가 필요하다는 다른 명시적 제품 contract를 코드에서 발견하면 임의로 cross-domain write를 추가하지 말고, 현재 ledger 개선을 완료한 뒤 최종 보고에 별도 blocker로 기록한다.

### 2.3 Clear shift

0건 handoff 기록은 교대 확인을 위한 유효한 ledger event로 유지한다.

- `Clear handoff` → `Clear-shift confirmation`
- 설명: open work가 없다는 사실도 다음 operator가 확인하는 교대 기록이다.
- 서버는 send 시 같은 open-case predicate로 실제 0건을 다시 확인한다.
- open case가 생긴 stale 상태에서는 send를 거부하고 다시 검토하게 한다.
- History가 불필요한 0건 noise가 되지 않도록 status와 문구를 명확히 하되 기능을 제거하지 않는다.

### 2.4 범위 제한

- 1024px 이하, tablet, mobile CSS를 수정하거나 검사하지 않는다.
- 새 UI library, state library, date library, table library를 추가하지 않는다.
- 이 작업을 이유로 Customer/Partner 앱 또는 무관한 booking/payment 비즈니스 규칙을 수정하지 않는다.
- 기존 사용자 변경을 되돌리거나 formatting으로 광범위하게 덮어쓰지 않는다.
- disconnected legacy 파일 4,607줄 삭제를 핵심 기능 수정과 섞지 않는다. 마지막 별도 단계에서 안전성이 증명될 때만 정리한다.

## 3. P0 — 운영 의미와 데이터 신뢰

### 3.1 Follow-up owner contract를 화면과 API에서 일치

현재 확인된 사실:

- open case response의 `owner`는 항상 `null`이다.
- create API는 `operations.shift_handoff.create` audit metadata만 기록한다.
- 원본 source record ownership을 변경하지 않는다.
- 그러나 UI는 `Default case owner`, `OWNER`, `Default owner`라고 표현한다.

수정 요구:

1. form의 상단 duplicate owner 표시를 제거한다.
2. incoming operator 선택 시 follow-up owner 기본값은 incoming operator다.
3. Advanced 영역에서만 follow-up owner override를 허용한다.
4. preview에는 `Follow-up owner: {operator}`를 한 번만 표시한다.
5. 보조 문구를 추가한다.
   - `Responsible for follow-up after this handoff. Source records are not reassigned.`
6. History의 `Owner` 열도 `Follow-up owner`로 바꾼다.
7. API metadata parser는 기존 owner field를 계속 읽는다.
8. 새 기록과 기존 기록을 모두 표시하는 regression test를 추가한다.

완료 기준:

- 운영자가 Send를 실제 source owner 변경으로 오해할 문구가 없다.
- incoming operator와 follow-up owner가 같을 때 같은 operator 정보가 불필요하게 반복되지 않는다.
- legacy audit record가 깨지지 않는다.

## 4. P1 — Canonical route와 navigation

### 4.1 기본 mode 변경

현재 `page.tsx`의 `view=handoff ? handoff : history` 구조를 다음 의미로 바꾼다.

- `view=history`만 History
- bare URL과 그 외 안전한 값은 Current
- legacy `view=handoff`는 canonical Current로 정리

Current filter href는 더 이상 `view=handoff`를 생성하지 않는다. History filter/pagination href는 항상 `view=history`를 보존한다.

### 4.2 모든 inbound link 통일

최소 확인 대상:

- sidebar navigation
- Home의 `Open handoff`
- finance closeout evidence checklist
- finance closeout shift action map
- finance closeout task board
- operations-handoff 내부 mode/pagination/reset/retry 링크

`Open handoff`는 모두 `/operations-handoff`의 Current로 들어가야 한다. History를 열려면 문구도 `View handoff history`처럼 분명해야 한다.

### 4.3 navigation matching

- `admin-navigation.ts`의 Shift Handoff href는 bare canonical URL을 사용한다.
- 기존 `hrefMatchesPath`의 전체 동작을 이 화면 때문에 특수하게 복잡하게 만들지 않는다.
- bare href가 History query에서도 같은 sidebar item을 active로 만드는 기존 pathname matching을 재사용한다.
- partners/bookings 등 기존 query-specific navigation test를 깨지 않는다.

필수 테스트:

- bare URL renders Current shift
- `view=history` renders History
- legacy `view=handoff` behavior
- Current/History mode link의 정확한 href와 `aria-current`
- sidebar best match가 두 mode에서 Shift Handoff
- Home/finance inbound link가 Current canonical URL

## 5. P1 — 오류와 session을 0건처럼 보이지 않게 처리

### 5.1 Current handoff API 오류

현재 `handoffResult`가 실패해도 fallback empty data를 section에 전달해 error와 `Assigned 0 / Waiting 0`이 같이 보인다. 이를 제거한다.

필수 상태:

- API success + 0건: 실제 empty state
- API failure: queue를 렌더링하지 않고 `Current handoffs unavailable` + Retry
- filter result 0건: 필요하면 filtered-empty 문구
- loading: 기존 Admin loading pattern

error copy가 “No empty assignment state is shown”이라고 말하면서 실제 빈 queue를 보여주는 모순이 없어야 한다.

### 5.2 Current operator session 오류

`getCurrentAdminOperatorAccess()`가 null이면 Assigned/Waiting이 0건처럼 보이면 안 된다.

- Current workspace의 identity-dependent 영역을 fail closed한다.
- `Your Admin operator session could not be resolved.`와 Retry 또는 다시 로그인 안내를 표시한다.
- create/acknowledge를 차단한다.
- 실제 empty queue count를 표시하지 않는다.

### 5.3 source별 실패 범위

- current handoff fetch 실패는 Assigned/Waiting만 막는다.
- open case fetch 실패는 create case selection과 send만 막는다.
- operator directory 실패는 incoming selection과 send만 막는다.
- 한 source 실패 때문에 정상적인 다른 read-only 영역까지 가짜 empty로 바꾸지 않는다.
- component를 과도하게 추상화하지 말고 현재 section 안에서 가장 작은 조건부 render로 해결한다.

필수 test:

- handoff error에 Assigned/Waiting empty text가 없음
- open-case error에 send/form이 disabled 또는 미렌더되고 이유가 보임
- operator error에 eligible operator empty로 위장하지 않음
- session null에 identity-dependent queue가 없음

## 6. P1 — Current queue 100건 절단 제거

현재 Current는 `status=open&scope=current&pageSize=100` 한 번만 요청하고 Assigned/Waiting에서 client filter한다. 101건 이후는 조용히 사라질 수 있다.

수정 요구:

- current operator 기준 `assigned`와 `waiting`의 exact total을 서버에서 구한다.
- 각 queue가 100건을 넘어도 누락되지 않게 server pagination 또는 명시적인 다음 page를 제공한다.
- UI count는 현재 page length가 아니라 exact total이다.
- pagination query 이름이 서로 충돌하지 않게 한다. 예: `assignedPage`, `waitingPage`.
- 한 queue의 pagination이 다른 queue와 open-case filter를 초기화하지 않게 한다.
- 전체 결과를 임의로 pageSize 500/1000으로 늘려 문제를 숨기지 않는다.
- 기존 `AdminTablePaginationFooter`와 URL query pattern을 재사용한다.

가장 작은 구현을 선택한다.

- 기존 endpoint에 current relationship/bucket과 page를 추가하거나,
- current 전용 response에 assigned/waiting page와 total을 함께 반환한다.

새 service layer나 generic queue framework는 만들지 않는다.

필수 test:

- assigned 101건에서 101 total과 두 번째 page 접근 가능
- waiting 101건에서 동일
- assigned/waiting 분류 predicate가 현재 UI 정의와 동일
- acknowledgement 후 정확한 queue/count 갱신

## 7. P1 — Handoff ledger의 DB pagination

현재 `listOperationsShiftHandoffs()`는 모든 create audit log를 가져오고, 관련 acknowledgement도 모두 가져온 뒤 application memory에서 scope, range, operator, q, status, pagination을 처리한다. 데이터가 커질수록 Current와 History 모두 느려진다.

수정 원칙:

1. 기존 `AdminAuditLog`와 현재 action/target contract를 우선 재사용한다.
2. DB에서 range/status/operator/search/page predicate와 exact count를 처리한다.
3. page에 필요한 create row와 그 acknowledgement만 hydrate한다.
4. stable ordering은 `createdAt desc` 후 unique ID tie-breaker를 사용한다.
5. legacy metadata를 계속 읽는다.
6. 전체 create log를 가져온 뒤 `.filter().slice()`하는 구조를 제거한다.
7. 단순히 pageSize를 늘리는 방식은 허용하지 않는다.
8. 전용 table은 기존 audit log로 정확한 query를 만들 수 없다는 근거가 있을 때만 고려한다. 우선 raw SQL/Prisma query와 기존 index를 검토한다.
9. schema/index 변경이 필요하면 handoff 조회에 필요한 최소 migration만 추가한다.

status 정의:

- waiting: matching acknowledgement target이 없음
- acknowledged: matching acknowledgement target이 있음
- all: 둘 다

scope=current 정의:

- current actor가 outgoing 또는 incoming인 open handoff

필수 test:

- DB query가 requested page만 hydrate
- created range 기준 정확성
- acknowledgement status filter 정확성
- outgoing/incoming/follow-up owner 검색 호환
- q가 shift label/case ID를 찾음
- exact total과 page row predicate 일치
- out-of-range page의 기존 안전한 정규화 유지

테스트에서는 mock의 `findMany` 호출 수만 맞추지 말고, 전체 log를 메모리로 읽지 않는 query boundary를 검증한다.

## 8. P1 — Acknowledgement 무결성과 운영 문구

### 8.1 동시 중복 write 방지

현재는 existing acknowledgement를 조회한 뒤 write하므로 두 동시 요청이 모두 통과할 수 있다.

- handoff acknowledgement는 DB 수준에서 handoff당 하나만 존재하게 한다.
- 가장 작은 안전한 방법을 사용한다.
  - 기존 schema가 지원하면 action/target에 맞는 partial unique index
  - 그렇지 않으면 repository의 기존 transaction/locking/idempotency pattern
- duplicate 요청은 audit event를 두 개 만들지 않는다.
- 동일 handoff 재시도는 사용자에게 `This handoff was already acknowledged.`를 안정적으로 반환한다.
- unrelated AdminAuditLog action에는 uniqueness를 강제하지 않는다.

### 8.2 버튼 의미

- `Acknowledge` → `Acknowledge & take over`
- 설명: `Confirms you reviewed this handoff and accept follow-up responsibility.`
- case가 여러 건이거나 follow-up owner override가 있을 때 기존 confirm pattern을 재사용해 짧은 확인을 제공한다.
- confirm modal을 새로 만들지 말고 저장소의 공통 confirm/focus component를 찾는다.
- clear-shift acknowledgement에도 책임 의미를 유지한다.

필수 test:

- assigned incoming operator만 실행 가능
- 동시 두 요청에서 event 하나
- duplicate conflict 문구
- pending 중 button 중복 클릭 차단
- success 후 queue/history revalidation

## 9. P1 — Case pagination과 selection 정책

현재 open-case page는 25건이며 selection state는 client component 내부에 있다. page link로 이동하면 선택이 사라진다.

이번 작업의 기본 정책:

- 한 handoff는 현재 page에 표시된 최대 25건을 선택해 보낸다.
- page를 넘어 모든 결과를 한 번에 선택하는 global selection store는 만들지 않는다.
- pagination을 누르면 현재 선택이 사라진다는 사실을 selection이 있을 때 명확히 확인시킨다.
- 기존 confirm pattern이 있으면 `Changing page will clear 3 selected cases. Continue?`를 사용한다.
- 선택이 없으면 바로 page 이동한다.
- `Select visible`은 현재 page만 선택한다는 문구를 유지한다.
- 25건 이상 묶음 인계가 실제 운영에서 요구된다는 근거가 생기기 전에는 `Select all matching N`, session store, 새 state library를 추가하지 않는다.

완료 기준:

- selection 손실이 조용히 발생하지 않는다.
- 현재 page의 선택/해제/preview/count가 정확하다.
- server는 선택 case가 여전히 open인지 검증한다.

## 10. P2 — 0건 화면과 정보 위계

Current에서 Assigned와 Waiting이 모두 0일 때 두 개의 대형 empty card를 연속 표시하지 않는다.

권장 구조:

1. 상단 compact summary strip
   - `Assigned {N}`
   - `Waiting {N}`
   - `Open cases {N}`
2. 두 handoff queue가 모두 0이면 하나의 compact empty state
   - `No handoffs need your attention.`
3. 둘 중 하나라도 1건 이상이면 해당 queue만 현재 card/table 형태로 표시
4. `Create handoff` 또는 `Clear-shift confirmation`은 1440×900 첫 viewport에서 찾을 수 있게 summary 다음에 배치

운영 우선순위:

- incoming handoff가 있으면 acknowledgement queue가 가장 먼저 보인다.
- waiting handoff가 있으면 acknowledgement 지연을 두 번째로 보인다.
- 둘 다 없으면 create/clear-shift action을 먼저 보인다.

새 dashboard widget이나 chart를 추가하지 않는다. 기존 Admin section, badge, grid token만 사용한다.

## 11. P2 — History empty state

History 0건 상태를 단순화한다.

- filter result count와 table status에서 중복되는 `0 records`는 한 번만 표시한다.
- 0건일 때 9열 table header를 그대로 보여주지 않는다.
- empty copy: `No handoffs match these filters.`
- action: `Reset filters`
- API failure에는 empty copy를 사용하지 않는다.
- History filter와 empty state는 첫 viewport에서 함께 이해할 수 있어야 한다.

History copy:

- filter 설명: `Date range uses sent time. Acknowledged time is shown separately.`
- section 설명: `Sent handoffs and their acknowledgement status.`

## 12. P2 — 운영자 문구 정리

다음 문구를 일관되게 적용한다.

| 현재 문구 | 변경 문구 |
|---|---|
| Current | Current shift |
| Handoff history | History |
| Filter the server-backed open-case queue... | Find open work by queue, age, or case ID. |
| Default case owner | Follow-up owner |
| Advanced owner override | Follow-up owner override |
| Acknowledge | Acknowledge & take over |
| Clear handoff | Clear-shift confirmation |
| Created date is the range basis... | Date range uses sent time. Acknowledged time is shown separately. |

Handoff note는 새 editor를 만들지 않는다. 기존 textarea에 다음 lightweight template 또는 helper를 제공한다.

Current state:
Evidence checked:
Next action / due time:

선택 case가 있을 때 note required를 유지하고 clear-shift confirmation에서는 optional로 유지한다.

기술 구현 용어를 사용자 문구에 노출하지 않는다.

- server-backed
- payload
- predicate
- metadata
- API fallback

## 13. P2 — Operator selector

현재 local fixture에는 audit/smoke operator가 많이 보인다. local fixture 자체를 production 결함으로 단정하지 말고 API 조건을 확인한다.

- inactive/revoked operator를 제외한다.
- current operator와 같은 identity를 제외한다.
- 이름 + role + email 또는 phone을 일관된 순서로 표시한다.
- production에서 operator 수가 길다면 저장소에 이미 있는 searchable combobox를 재사용한다.
- 공통 searchable component가 없고 native select로 충분하면 새 dependency를 추가하지 않는다.
- local test fixture를 삭제해 문제를 숨기지 않는다.

## 14. P2 — Page semantics와 접근성

1440px 데스크톱 accessibility tree에서 확인한다.

- `document.title`은 `Shift Handoff · HANDS Admin`처럼 비어 있지 않아야 한다.
- page H1은 `Shift Handoff` 하나만 존재해야 한다.
- 비활성 `Desktop required` H1이 desktop accessibility tree에 남지 않게 한다.
- Current/History link에 정확한 accessible name과 `aria-current="page"`가 있다.
- filter, select, textarea, checkbox는 label이 있다.
- preview status와 server action 결과는 screen reader가 인지할 수 있다.
- keyboard만으로 filter → case selection → preview → edit까지 이동 가능하다.
- 새 ARIA role을 추가하기 전에 native HTML/link/button 의미를 우선 사용한다.

`AdminDesktopOnlyGate`를 수정할 때 1024px 이하 시각 디자인을 재설계하지 않는다. 데스크톱에서 숨은 heading의 접근성 tree 문제만 가장 작게 해결한다.

## 15. Disconnected legacy code 처리

재감사 기준 현재 route runtime에서 사용하는 operations-handoff production module은 주로 다음 네 개다.

- `page.tsx`
- `actions.ts`
- `operations-shift-handoff-section.tsx`
- `operations-shift-handoff-form.tsx`

이전 혼합 Operations History 구현으로 보이는 26개 production-named file, 약 4,607줄이 folder에 남아 있다.

핵심 기능과 모든 test가 통과한 뒤 별도 단계에서만 처리한다.

1. 각 파일의 외부 import와 dynamic reference를 `rg`로 확인한다.
2. 현재 route, shared export, script, test 외에 runtime caller가 없는지 확인한다.
3. 안전성이 증명된 파일은 전용 spec과 함께 삭제할 수 있다.
4. 하나라도 불명확하면 삭제하지 말고 최종 보고에 candidate 목록만 남긴다.
5. 단순 line-count 감소를 위해 현재 동작 테스트를 삭제하지 않는다.
6. cleanup 때문에 P0/P1 구현 diff를 어렵게 검토하도록 만들지 않는다.

## 16. 구현 품질 규칙

- 증상이 아니라 공통 원인을 고친다.
- 새 abstraction은 두 곳 이상의 실제 중복이 있을 때만 만든다.
- 기존 helper/component가 있으면 재사용한다.
- native link, form, select, details, button을 우선 사용한다.
- 새 dependency를 추가하지 않는다.
- loading, error, true empty, filtered empty를 구분한다.
- permission, input validation, stale-state 검사를 약화하지 않는다.
- API contract 변경 시 Admin Web caller와 test를 같은 작업에서 갱신한다.
- legacy handoff metadata를 파괴하거나 overwrite하지 않는다.
- query와 pagination은 stable ordering과 exact total을 사용한다.
- unrelated formatting, rename, generated file 수정은 하지 않는다.
- 실제 Send/Acknowledge를 production-like data에서 실행하기 전에는 side effect와 test fixture를 확인한다.

## 17. 필수 자동 검증

최소 다음 명령을 실행한다. 저장소 script와 환경이 다르면 동등한 실제 명령을 사용하고 최종 보고에 정확히 기록한다.

Admin Web focused suite:

npm.cmd exec --workspace @massage-vn/admin-web -- vitest run --config vitest.config.mts app/operations-handoff

API focused suite:

npm.cmd exec --workspace @massage-vn/api -- vitest run --config vitest.config.mts src/admin/admin.service.spec.ts -t "AdminService shift handoff ledger"

Typecheck:

npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api

추가 필수 regression 범위:

- admin navigation matching
- Home/finance closeout inbound links
- action error mapping
- legacy metadata parsing
- acknowledgement concurrency/idempotency
- current assigned/waiting pagination 101건
- history DB pagination/query boundary
- error/session fail-closed
- desktop accessibility heading/title

전체 suite가 지나치게 크면 먼저 focused suite를 실행하고, 통과 후 수정된 shared helper의 관련 suite를 추가한다. 실패를 기존 문제라고 추측하지 말고 현재 diff와의 연관성을 확인한다.

## 18. 실제 브라우저 검증

로그인된 관리자 세션이 있는 in-app browser를 사용한다. 새 로그인이 필요하면 사용자에게 로그인만 요청하고 작업을 중단하지 말고 준비 가능한 코드 검증을 계속한다.

검증 viewport:

- 1440×900 light
- 1440×900 dark
- 1600×900 light

1024px 이하와 mobile viewport는 열거나 캡처하거나 최종 보고에 포함하지 않는다.

반드시 확인할 URL/state:

1. `/operations-handoff`
   - Current shift가 기본
   - sidebar active
   - breadcrumb 일치
2. `/operations-handoff?view=history`
   - History active
   - 동일 sidebar/breadcrumb
3. legacy `/operations-handoff?view=handoff`
   - canonical Current 동작
4. Current true empty
5. History true empty와 filtered empty
6. clear-shift preview
7. selected-case preview
8. Assigned handoff와 `Acknowledge & take over`
9. Waiting handoff
10. handoff/open-case/operator/session API error 상태
11. current handoff 101건 fixture 또는 service-level 증거

실제 데이터가 0건이면 임의 production write로 데이터를 만들지 않는다. 안전한 local/staging fixture 또는 mock route가 이미 있으면 사용하고, 없으면 빈 상태는 화면으로 검증하고 populated/race 상태는 component/service test 증거로 검증했다고 명시한다.

각 viewport에서 확인:

- body 가로 overflow 없음
- Current/History active와 URL 일치
- 주요 action이 명확함
- error와 empty가 구분됨
- 긴 operator/note/case ID가 layout을 깨지 않음
- keyboard focus와 confirm 후 focus 복귀
- `document.title`과 H1 하나

검증 캡처는 다음 폴더처럼 작업일 기준 새 output folder에 저장한다.

output/operations-handoff-remediation-verification-YYYY-MM-DD/

## 19. 완료 수용 기준

다음이 모두 충족되어야 완료다.

Routing / IA:

- [ ] bare URL은 Current shift
- [ ] `view=history`는 History
- [ ] legacy `view=handoff`는 안전한 canonical 동작
- [ ] 두 mode의 sidebar와 breadcrumb 일치
- [ ] 모든 Open handoff inbound link가 Current로 진입
- [ ] 활성 mode 데이터만 fetch

Data trust:

- [ ] Follow-up owner가 ledger 책임임이 명확
- [ ] source record 실제 assignment를 암시하지 않음
- [ ] legacy owner metadata 표시 유지
- [ ] error/session 실패가 0건으로 보이지 않음
- [ ] assigned/waiting 101건 이상 누락 없음
- [ ] history가 전체 audit log를 application memory에 적재하지 않음
- [ ] acknowledgement 동시 요청에서도 event 하나

Operator workflow:

- [ ] 0건이면 불필요한 대형 empty card 반복 없음
- [ ] create/clear-shift action을 첫 viewport에서 찾을 수 있음
- [ ] selection pagination 손실이 조용히 일어나지 않음
- [ ] preview가 incoming, follow-up owner, selected, remaining open을 정확히 표시
- [ ] acknowledgement 책임 문구가 명확

History:

- [ ] empty/filter/error 상태 구분
- [ ] 중복 0 records 제거
- [ ] sent-time range 문구 명확
- [ ] DB-level exact pagination

Accessibility / desktop:

- [ ] document title 존재
- [ ] desktop accessibility tree의 H1 하나
- [ ] keyboard main flow 사용 가능
- [ ] 1440×900/1600×900 light/dark 가로 overflow 없음
- [ ] 1024px 이하 관련 변경·검사 보고 없음

Verification:

- [ ] focused Admin Web test 통과
- [ ] focused API handoff test 통과
- [ ] shared navigation/action 관련 test 통과
- [ ] Admin Web/API typecheck 통과
- [ ] 실제 브라우저 캡처 저장

## 20. 최종 보고 형식

작업을 실제로 완료한 뒤 다음 순서로 짧고 구체적으로 보고한다.

1. 구현 결과 요약
2. Current/History canonical URL 최종 표
3. owner 의미를 어떻게 정리했는지
4. error/100건/history query/acknowledgement 무결성 수정 내용
5. 변경 파일 목록
6. 자동 테스트 명령과 pass/fail 수
7. 브라우저 검증 viewport와 캡처 경로
8. 삭제한 legacy 파일 또는 삭제하지 않은 이유
9. 남은 blocker와 실제 영향

`완료`라고 쓰기 전에 수용 기준을 다시 대조한다. 확인하지 못한 populated state나 성능 조건을 통과했다고 추측하지 않는다. 앱 소스 수정 없이 새 제안 보고서만 만드는 것으로 작업을 끝내지 않는다.
```

## 이 프롬프트가 고정하는 핵심 판단

1. 한 sidebar page, 두 URL mode를 사용한다.
2. Current가 canonical 기본 업무다.
3. History는 보조 query mode다.
4. Current와 History payload는 동시에 로드하지 않는다.
5. owner는 실제 cross-domain assignment가 아니라 follow-up responsibility다.
6. 25건 초과 global selection은 이번에 만들지 않는다.
7. 1024px 이하와 모바일은 작업 범위에서 제외한다.
8. 라우팅·데이터 무결성·오류 상태를 시각 polish보다 먼저 해결한다.

