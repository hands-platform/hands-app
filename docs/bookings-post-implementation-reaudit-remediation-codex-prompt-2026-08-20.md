# HANDS Admin Live Bookings Post-Implementation Re-audit Remediation Prompt

감사 대상: `http://localhost:3101/bookings`

감사 기준 시각: `2026-08-20 ICT (Asia/Ho_Chi_Minh)`

이 문서는 이전 `Live Bookings` 개선 작업을 재감사한 결과, 아직 남아 있는 문제를 Codex가 현재 구조를 보존하면서 한 건씩 검증·수정·재감사하기 위한 실행 프롬프트다.

현재 재감사 판정:

```text
Overall score: 88/100
P0: 0
P1: 1 confirmed issue
P2: 1 confirmed issue
P3: 1 recommendation
```

핵심 원칙:

- 보고서를 그대로 믿고 수정하지 말고 현재 코드와 실제 화면에서 먼저 재현한다.
- P1 한 건을 먼저 수정하고 검증이 끝난 뒤에만 P2로 이동한다.
- P3는 P1/P2 완료 후 실제 운영 화면에서 여전히 이점이 확인되는 경우에만 수정한다.
- 기존 Booking/Matching lifecycle, API, DB, 권한, URL 계약은 변경하지 않는다.

---

## 0. Codex 역할과 필수 스킬

다음 지시를 하나의 순차 작업으로 수행한다.

필수 스킬:

- `receiving-code-review`
- 실제 화면 재현·검증 시 `browser:control-in-app-browser`
- Next.js App Router와 React 상태 동기화 판단 시 `vercel-react-best-practices`
- P3 시각 판단 시에만 `ui-ux-pro-max`

단일 에이전트로만 작업한다.

- subagent, worker agent, handoff agent를 만들지 않는다.
- `spawn_agent` 또는 동등한 multi-agent 도구를 사용하지 않는다.
- 저장소 루트 `C:\dev\massage-on-demand-vn`에서만 작업한다.
- `C:\dev\massage-vn-workspace`는 검사하거나 수정하지 않는다.

---

# 1. 절대 작업 원칙

이 프로젝트는 이미 상당 부분 구현된 production-oriented 프로젝트다.

다른 구조가 더 깔끔해 보인다는 이유로 재설계, 대규모 리팩터링, 공용 컴포넌트 전면 교체를 하지 않는다.

반드시 보존한다.

- 기존 Booking lifecycle과 Matching lifecycle
- 현재 Admin Web/API 연동
- 기존 인증, 세션, MFA, 권한 검사
- 기존 API 요청 및 응답 계약
- DB schema와 운영 데이터 호환성
- `/bookings`의 `view`, `q`, `age`, `sort`, `sla`, `page` URL 계약
- `/bookings` 기본 `Needs action` 진입점
- action queue의 `Oldest first` 기본값
- `Booking records` historical workspace
- 검색의 server-backed pagination
- Socket.IO event 이름과 realtime 인증 계약
- 현재 bounded REST fallback과 Pause/Resume 동작
- `Monitor stages` / `Intervention & repair` 큐 그룹
- active Stage queue의 disclosure 자동 열림
- production-data 제외 predicate
- 기존 공용 디자인 토큰과 컴포넌트
- 기존 사용자의 모든 변경 사항

금지 사항:

- 패키지 설치
- DB schema 또는 migration 변경
- API contract 변경
- Booking/Matching 상태 mutation
- 운영 데이터 생성, 수정, 삭제
- 새로운 상태 관리 라이브러리 도입
- `/bookings` 전체 재설계
- 공용 form system 광범위한 재작성
- `AdminDirectoryFilterForm`의 전역 navigation architecture 재설계
- Socket.IO, Redis, BullMQ 구조 변경
- 관련 없는 문제 수정
- 테스트 삭제, skip, assertion 완화
- 명시적 요청 없는 commit 생성

반응형 범위:

- `1024px 이하` 화면은 검사, 수정, 보고 범위에서 완전히 제외한다.
- 필수 검증: `1440x1000`
- 추가 검증: `1980x1100`

---

# 2. 작업 방식

`receiving-code-review` 절차를 그대로 따른다.

각 finding마다 다음 순서를 지킨다.

1. 요구사항을 자신의 말로 다시 정리한다.
2. 현재 코드, 테스트, 실제 화면에서 문제를 다시 재현한다.
3. `confirmed issue`, `probable issue`, `recommendation`, `not reproduced`를 구분한다.
4. 현재 구조에서 가능한 최소 수정안을 평가한다.
5. finding 한 건만 수정한다.
6. 가장 가까운 targeted test를 실행한다.
7. 실제 1440px 화면에서 같은 시나리오를 재검증한다.
8. 성공한 경우에만 다음 finding으로 이동한다.

중요:

- 현재 코드가 보고서와 다르면 현재 코드의 실제 동작을 기준으로 판단한다.
- 이미 해결된 사항은 다시 수정하지 않는다.
- 공용 컴포넌트 변경이 필요하다면 대표 소비 페이지 회귀를 함께 검증한다.
- P1이 실패하면 P2/P3를 구현하지 않는다.
- 수정 전에 발견한 문제와 수정 후 상태를 각각 기록한다.

---

# 3. 시작 전 기준선

먼저 읽기 전용으로 실행한다.

```powershell
git branch --show-current
git status --short
npm.cmd run local:status
```

확인 사항:

- branch가 `develop`인지
- 기존 dirty worktree 항목과 파일 목록
- API 3000과 Admin 3101이 실제 listening 상태인지
- API/Admin health가 HTTP 200인지
- Admin BUILD_ID가 실행 중 production server와 일치하는지
- API build가 현재 source보다 오래되지 않았는지

재감사 종료 당시 `git status --short`는 기존 변경과 산출물을 포함해 39개 항목이었다. 현재 항목 수가 다르더라도 자동으로 되돌리지 말고 현재 상태를 기준선으로 기록한다.

우선 읽을 파일:

```text
apps/admin_web/app/bookings/booking-monitor-page.tsx
apps/admin_web/app/bookings/booking-monitor.tsx
apps/admin_web/app/bookings/booking-monitor-filters-section.tsx
apps/admin_web/app/bookings/booking-monitor-filters-section.spec.tsx
apps/admin_web/app/bookings/booking-monitor-list-section.tsx
apps/admin_web/app/bookings/booking-monitor-list-section.spec.tsx
apps/admin_web/app/bookings/booking-monitor-options.ts
apps/admin_web/app/bookings/booking-monitor-realtime.ts
apps/admin_web/app/bookings/booking-monitor-realtime.spec.ts
apps/admin_web/components/admin-form-controls.tsx
apps/admin_web/components/admin-directory-filter-form.tsx
apps/admin_web/components/admin-directory-filter-form.spec.tsx
apps/admin_web/app/globals.css
```

기준 테스트 결과:

```text
Booking/Admin targeted: 10 files, 120 passed
API Booking predicates: 2 files, 24 passed
Admin full suite: 850 files passed, 1 skipped
Admin full tests: 4,723 passed, 1 skipped
Admin typecheck: passed
Admin lint: passed
Admin build: passed
Admin query guards: passed
Admin visible-copy guard: passed
```

새 실패를 기존 실패라고 가정하지 않는다. 수정 전후 기준선을 비교한다.

---

# Phase 1 — P1: Reset 이후 URL·서버 결과와 검색 input 표시가 불일치

## BOOKINGS-POST-REAUDIT-01

- severity: `P1`
- 분류: `confirmed issue`
- 신뢰도: `High`
- 가장 먼저 수정

관련 위치:

```text
apps/admin_web/app/bookings/booking-monitor-filters-section.tsx
  BookingMonitorFiltersSection
  AdminFormSearch defaultValue={searchQuery}

apps/admin_web/components/admin-form-controls.tsx
  AdminFormSearch

apps/admin_web/components/admin-directory-filter-form.tsx
  AdminDirectoryFilterForm
  restoreCanonicalGetForm

apps/admin_web/app/bookings/booking-monitor-page.tsx
  renderBookingMonitorRoute
  initialSearchQuery
```

## 1.1 재현된 현재 동작

실제 브라우저에서 다음 순서로 재현됐다.

```text
1. /bookings 진입
2. audit-no-match-20260820 검색
3. URL: /bookings?q=audit-no-match-20260820
4. 검색 결과 0건과 검색 전용 empty state 표시
5. Reset filters 클릭
6. URL과 서버 결과는 /bookings 기본 상태로 복원
7. 검색 input에는 audit-no-match-20260820이 계속 표시됨
8. Under 1h 또는 Open matching으로 이동해도 이전 검색어가 남을 수 있음
```

확인된 DOM 상태:

```text
attribute: ""
defaultValue: ""
value: "audit-no-match-20260820"
URL: /bookings 또는 /bookings?age=under-1h
```

## 1.2 원인 가설

`AdminFormSearch`는 다음과 같은 uncontrolled input으로 렌더링된다.

```tsx
<AdminFormSearch defaultValue={searchQuery} />
```

Client Navigation으로 Server Component의 `searchQuery` prop이 변경되어도 이미 마운트된 input의 실제 `value`는 자동으로 갱신되지 않는다.

`AdminDirectoryFilterForm`의 `pageshow`/`popstate` 복원은 일반적인 Next.js Link Navigation에서 항상 실행되지 않으므로 이 불변식을 보장하지 못한다.

원인 가설을 그대로 믿지 말고 React element 재사용, App Router navigation, 현재 DOM property를 다시 확인해 확정한다.

## 1.3 필요한 불변식

다음 값은 항상 동일한 검색 상태를 가리켜야 한다.

```text
Browser URL q
Server Component searchParams.q
Admin API /admin/bookings/page q
검색 input.value
결과 목록
empty-state 문구
Clear / Reset action
```

URL에 `q`가 없으면 적용된 검색 input도 비어 있어야 한다.

## 1.4 현실적인 실패 시나리오

운영자가 특정 고객이나 Booking ID를 검색한 뒤 Reset을 누른다. 서버는 전체 open booking을 표시하지만 검색창에는 이전 고객 ID가 남는다. 운영자는 현재 표시된 예약이 해당 고객의 검색 결과라고 오해하거나, Search를 다시 눌러 의도하지 않게 이전 필터를 재적용할 수 있다.

## 1.5 최소 수정 요구사항

먼저 다음 후보를 현재 구조에서 평가한다.

1. `/bookings` 검색 control에 `searchQuery` 기반 `key`를 부여해 적용된 query가 바뀔 때 input을 재마운트한다.
2. 또는 좁은 `ref`/effect로 URL에서 전달된 `searchQuery`와 실제 input value만 동기화한다.

선택 기준:

- `/bookings`의 문제를 가장 작은 범위에서 해결해야 한다.
- 입력 중인 문자를 매 render마다 지우면 안 된다.
- `value={searchQuery}`만 추가해 input을 편집 불가능하게 만들면 안 된다.
- 새로운 client state가 필요 없다면 추가하지 않는다.
- 공용 form 전역 listener를 더 복잡하게 만들지 않는다.
- 검색 submit의 native GET navigation과 server-backed pagination은 유지한다.
- 기존 `view`, `age`, `sort`, `sla` 보존 및 `page` reset 계약을 유지한다.

공용 `AdminFormSearch` 또는 `AdminDirectoryFilterForm`을 변경해야만 해결되는 경우:

- `/partners`
- `/payments`
- `/customers`

중 최소 두 대표 GET filter 화면을 회귀 검증한다.

## 1.6 필수 테스트

정적 markup 또는 source-string assertion만으로 완료하지 않는다.

필수 브라우저 수준 시나리오:

```text
검색 제출
→ URL q 반영
→ 서버 결과 갱신
→ Reset filters 클릭
→ URL q 제거
→ input.value 빈 문자열
→ 전체 결과 복원
```

추가 케이스:

- 존재하지 않는 query 검색
- 공백 query 제출
- `Clear` 후 input 초기화
- `Reset filters` 후 input 초기화
- q가 유지되는 age 변경에서는 input도 같은 q 유지
- q가 제거되는 queue/filter reset에서는 input도 제거
- Back/Forward에서 URL, input, 결과 일치
- 검색 제출 1회당 navigation/API 조회 1회
- 사용자가 새 검색어를 정상 입력 가능

테스트 환경에 기존 브라우저 통합 테스트가 없다면 새 프레임워크나 패키지를 설치하지 않는다. 현재 테스트 인프라와 실제 in-app browser 검증을 조합하고, 자동화하지 못한 항목을 완료로 가장하지 말고 명시한다.

권장 targeted test:

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- components/admin-directory-filter-form.spec.tsx components/admin-form-controls.spec.tsx app/bookings/booking-monitor-filters-section.spec.tsx app/bookings/booking-monitor-route-load-plan.spec.ts
```

## 1.7 Phase 1 완료 기준

```text
[ ] 검색 URL, input, 서버 결과가 동일한 q를 사용한다.
[ ] Reset 이후 URL과 input에서 q가 모두 사라진다.
[ ] Clear 이후 URL과 input에서 q가 모두 사라진다.
[ ] q를 보존하는 navigation에서는 input도 보존된다.
[ ] 기존 hidden filter와 pagination reset 계약이 유지된다.
[ ] 공용 filter 소비 화면에 회귀가 없다.
[ ] 1440px 실제 화면에서 재현되지 않는다.
```

모든 조건이 충족된 뒤에만 Phase 2로 이동한다.

---

# Phase 2 — P2: Stage queue 결과 설명이 실제 queue 범위보다 넓음

## BOOKINGS-POST-REAUDIT-02

- severity: `P2`
- 분류: `confirmed issue`
- 신뢰도: `High`

관련 위치:

```text
apps/admin_web/app/bookings/booking-monitor.tsx
  bookingOperationsWorkspace

apps/admin_web/app/bookings/booking-monitor-options.ts
  realtimeBookingViewOptions
```

## 2.1 재현된 현재 동작

`/bookings?view=marketplace`의 결과 패널은 다음 설명을 표시한다.

```text
Bookings currently moving through matching, dispatch, arrival, or service.
```

그러나 `Open matching`은 marketplace 참여가 열려 있고 최종 매칭을 기다리는 예약 범위다. Dispatch, arrival, service를 포함하는 설명은 실제 queue보다 넓다.

같은 화면의 empty-state 문구는 다음처럼 정확하다.

```text
No booking is open for marketplace Partner participation right now.
```

## 2.2 원인

`bookingOperationsWorkspace()`에서 `marketplace` 등 Stage view가 generic default 분기로 들어간다.

`booking-monitor-options.ts`에는 이미 정확한 설명이 존재한다.

```text
Open matching bookings inside the original customer wait window.
```

## 2.3 최소 수정 요구사항

- 새 copy registry를 만들지 않는다.
- 동일 문구를 여러 파일에 복사하지 않는다.
- 가능하면 기존 `activeView.description`을 operations result panel에 전달해 재사용한다.
- `activeView.label`, count, tone, URL, API statusGroup은 변경하지 않는다.
- `first-pick`, `marketplace`, `customer-choice`, `matched`가 모두 generic fallback을 사용하는지 함께 확인한다.
- exception queue의 설명도 label만 반복하는 상태가 있는지 확인하되 관련 범위 안에서만 수정한다.

권장 의미:

```text
Preferred pending
Open bookings waiting for the preferred Partner inside the 10-minute deadline.

Open matching
Open matching bookings inside the original customer wait window.

Customer choice
Open bookings with participating Partners waiting for customer final selection.

Matched / handoff
현재 booking-monitor-options.ts의 기존 정확한 description 재사용
```

## 2.4 필수 테스트

- Stage queue별 result panel title과 description
- `Open matching`에 dispatch/arrival/service 범위가 표시되지 않음
- `activeView.description`과 result panel description 일치
- 기존 empty-state 문구 유지
- URL과 API load plan 불변
- 사용자 화면에서 `Partner` 용어 유지

권장 targeted test:

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- app/bookings/booking-monitor-filters-section.spec.tsx app/bookings/booking-monitor-list-section.spec.tsx app/bookings/booking-monitor-options.spec.ts app/bookings/booking-monitor-route-load-plan.spec.ts
```

회귀 위험: `Low`

---

# Phase 3 — P3 선택 개선: Reset filters 중복 노출

## BOOKINGS-POST-REAUDIT-03

- severity: `P3`
- 분류: `recommendation`
- P1/P2 완료 후에만 검토

관련 위치:

```text
apps/admin_web/app/bookings/booking-monitor-filters-section.tsx
  상단 Clear / Reset filters

apps/admin_web/app/bookings/booking-monitor.tsx
  emptyResetHref 결정

apps/admin_web/app/bookings/booking-monitor-list-section.tsx
  BookingMonitorOperationsTable empty-state action
```

## 3.1 현재 동작

검색 또는 age filter 결과가 0건이면 동일한 `Reset filters`가 두 번 표시된다.

```text
검색창 옆 Reset filters
empty-state 아래 전체 너비 Reset filters
```

기능 오류는 아니지만 하단 full-width action이 실제 중요도보다 강하게 보이고 빈 상태 카드 높이를 늘린다.

## 3.2 판단 기준

실제 `1440x1000` 화면에서 다음을 확인한다.

- 두 action이 같은 href와 동작인지
- 상단 Reset이 empty state와 같은 viewport에서 충분히 발견되는지
- 하단 action을 제거하면 recovery path가 약해지는지
- historical records나 다른 workspace는 별도 요구가 있는지

## 3.3 최소 권장안

실제 중복 부담이 확인되는 경우에만:

- Live `/bookings`에서는 상단 Reset만 유지한다.
- empty-state 안내 문구의 `Reset filters or change the queue`는 유지한다.
- historical/records workspace의 action은 별도로 판단한다.
- 공용 `AdminEmptyState`는 변경하지 않는다.

근거가 약하면 코드 수정 없이 recommendation으로 남긴다.

회귀 위험: `Low`

---

# 4. 변경하지 말아야 할 해결된 영역

다음 항목은 재감사에서 올바르게 구현된 것으로 확인됐다. 관련 없는 수정이나 되돌리기를 하지 않는다.

- 검색 submit 후 실제 server-backed list 재조회
- 검색 결과 전용 empty-state 문구
- age filter 전용 empty-state 문구
- 검색어 React escaping
- `Needs action` 기본 진입과 첫 번째 배치
- action queue의 `Oldest first`
- `Work now` / `Monitor` 역할 설명
- `Scope: All open bookings`
- `Production data · Test data excluded`
- Realtime 20초 bounded fallback
- Realtime event 750ms debounce
- reconnect 후 fallback 중지
- Pause/Resume 시 socket/timer 정리
- `Pause live updates` / `Resume live updates` 문구
- disconnected 상태의 `Refresh now`
- active Stage queue disclosure 자동 open
- `aria-current="page"`와 `CURRENT` 표시
- `Monitor stages` / `Intervention & repair` 그룹
- zero-count queue discoverability
- 1440px/1980px document-level horizontal overflow 없음

특히 Phase 1 문제를 해결한다는 이유로 native GET search를 이전 `window.history.pushState()` 방식으로 되돌리면 안 된다.

---

# 5. 최종 검증

## 5.1 Targeted tests

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- app/bookings/booking-monitor-filters-section.spec.tsx app/bookings/booking-monitor-live-status-section.spec.tsx app/bookings/booking-monitor-toolbar-section.spec.tsx app/bookings/booking-monitor-realtime.spec.ts app/bookings/booking-monitor-route-load-plan.spec.ts app/bookings/booking-empty-message.spec.ts app/bookings/booking-monitor-list-section.spec.tsx components/admin-directory-filter-form.spec.tsx components/admin-queue-age-sort-controls.spec.tsx app/api/admin/realtime-token/route.spec.ts
```

## 5.2 API predicate regression

API production predicate를 변경하지 않는다. 재실행만 한다.

```powershell
npm.cmd test --workspace @massage-vn/api -- src/admin/admin-booking-list-query.spec.ts src/admin/admin-booking-list-metadata.spec.ts
```

## 5.3 Admin scope

```powershell
npm.cmd run verify:scope -- -Scope admin
```

마지막으로:

```powershell
git diff --check
git status --short
npm.cmd run local:status
```

## 5.4 실제 브라우저 검증

로그인된 `http://localhost:3101/bookings`에서 수행한다.

주의:

- production `next start`가 현재 BUILD_ID와 일치하는지 먼저 확인한다.
- 서버가 중간에 재시작되면 이전 screenshot을 완료 증거로 사용하지 않는다.
- Booking 상태 변경, Partner 배정, 결제, 승인 등 mutation은 실행하지 않는다.
- 테스트 데이터 생성을 위해 DB를 수정하지 않는다.

필수 viewport:

```text
1440x1000
1980x1100
```

1024px 이하 화면은 검사하지 않는다.

필수 시나리오:

### A. 검색과 Reset

```text
/bookings
→ audit-no-match-20260820 검색
→ URL q 확인
→ 검색 전용 empty state 확인
→ Reset filters
→ URL /bookings 확인
→ input.value 빈 문자열 확인
→ 전체 결과 복원 확인
```

### B. 검색과 age/view

```text
q가 적용된 상태에서 Under 1h 이동
→ URL q/age와 input 일치

q가 제거된 상태에서 Open matching 이동
→ URL에 q 없음
→ input에도 이전 q 없음
```

### C. Back/Forward

```text
검색 → Reset → Back → Forward
각 단계에서 URL, input, 결과, empty state가 동일한 query를 사용
```

### D. Queue description

```text
/bookings?view=first-pick
/bookings?view=marketplace
/bookings?view=customer-choice
/bookings?view=matched
```

각 result panel의 설명이 선택 Stage 범위와 일치하는지 확인한다.

### E. Regression

- queue directory 그룹과 active state 유지
- Pause/Resume 유지
- 정상 live 상태에 불필요한 status noise 없음
- console error/warning 없음
- 1440px/1980px horizontal overflow 없음

필수 캡처:

1. 검색 결과 0건 상태
2. Reset 직후 비어 있는 검색 input과 복원된 URL/결과
3. `Under 1h` 적용 상태
4. `Open matching` active와 정확한 result description
5. 1980px 기본 상단 구조

각 screenshot은 이번 실행에서 새로 캡처하고 로컬 절대 경로를 완료 보고서에 기록한다.

---

# 6. 완료 조건

다음 조건을 모두 만족해야 완료다.

```text
[ ] P1을 현재 코드와 화면에서 먼저 재현했다.
[ ] 검색 URL, input, API request, 결과가 동일한 q를 사용한다.
[ ] Reset/Clear 후 검색 input이 실제로 비워진다.
[ ] q 보존 navigation에서는 input도 같은 q를 보존한다.
[ ] Back/Forward 상태가 일치한다.
[ ] 공용 GET filter 소비 페이지 회귀가 없다.
[ ] Stage queue 결과 설명이 실제 선택 범위와 일치한다.
[ ] 기존 정확한 view description을 재사용한다.
[ ] P3는 근거가 있을 때만 최소 수정했다.
[ ] Realtime fallback과 queue directory 개선을 되돌리지 않았다.
[ ] URL/API/DB/Socket 계약이 유지됐다.
[ ] 1440px와 1980px에서 overflow가 없다.
[ ] targeted tests가 통과했다.
[ ] Admin scope 검증이 통과했다.
[ ] 기존 사용자 변경이 보존됐다.
```

브라우저 수준 상태 동기화를 검증하지 못했다면 완료라고 쓰지 않는다.

---

# 7. 완료 보고 형식

## A. 시작 상태

- branch
- 시작 dirty worktree 항목 수와 관련 파일
- API/Admin process 및 health
- Admin BUILD_ID freshness
- 검사 URL과 viewport

## B. Finding별 결과

각 finding마다 다음을 작성한다.

```text
ID:
severity:
판정: confirmed / probable / recommendation / not reproduced
관련 파일:
관련 함수·컴포넌트:
수정 전 재현:
확정 원인:
최소 수정:
수정 후 동작:
API contract 영향:
DB schema 영향:
Realtime 영향:
회귀 위험:
targeted tests:
브라우저 검증:
```

## C. 테스트

- 실제 실행 명령
- test file 수
- pass/fail/skip 수
- 실패 원인
- 실행하지 못한 검증

## D. 브라우저 증거

- 1440x1000 결과
- 1980x1100 결과
- URL/input/API/result 일치 여부
- Reset/Clear 결과
- Back/Forward 결과
- Stage description 결과
- horizontal overflow
- console error/warning
- screenshot 절대 경로

## E. 보호 영역

- DB schema 변경 여부
- API contract 변경 여부
- Socket event 변경 여부
- 패키지 설치 여부
- 운영 데이터 mutation 여부
- 기존 사용자 변경 보존 여부
- commit 생성 여부

## F. 남은 위험

- 자동화하지 못한 browser integration 항목
- 실제 non-zero booking 데이터가 없어 확인하지 못한 상태
- 의도적으로 수정하지 않은 P3
- 다음 한 건으로 처리할 권장 작업

---

# Codex 실행 요청

위 지시를 기준으로 먼저 현재 코드를 분석하고 P1을 실제 화면에서 재현하라.

재현이 확인되면 현재 구조에서 가장 작은 수정만 적용하고 targeted test와 실제 브라우저 재감사를 완료하라. P1이 완전히 통과한 뒤에만 P2로 이동하고, P3는 실제 운영상 이점이 확인될 때만 수정하라.

관련 없는 코드는 수정하지 말고, 기존 변경을 되돌리지 말며, 완료 조건을 충족하지 못한 항목은 완료로 보고하지 마라.
