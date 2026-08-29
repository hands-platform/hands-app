# HANDS Admin Live Bookings Final Re-audit Remediation Prompt

감사 기준 화면: `http://localhost:3101/bookings`

감사 기준 시각: `2026-08-18 ICT (Asia/Ho_Chi_Minh)`

문서 작성일: `2026-08-19`

이 문서는 HANDS Admin의 `Live Bookings` 최종 재감사에서 확인된 문제를 Codex가 현재 구조를 보존하면서 한 건씩 수정하고 검증하기 위한 실행 프롬프트다.

---

## 0. Codex에게 전달할 역할과 필수 스킬

다음 지시를 하나의 작업으로 수행한다.

필수 스킬:

- `receiving-code-review`
- 실제 화면 검증 시 `browser:control-in-app-browser`
- Next.js App Router 구현 판단 시 `vercel-react-best-practices`
- P2/P3 UI 판단 시에만 `ui-ux-pro-max`

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
- `/bookings`와 `view`, `q`, `age`, `sort`, `sla`, `page` URL 계약
- `Needs action` 기본 진입점
- action queue의 oldest-first 기본값
- `Booking records`의 별도 historical workspace
- 기존 공용 form, segmented control, disclosure, table panel 디자인 토큰
- 기존 사용자의 모든 변경 사항

금지 사항:

- 패키지 설치
- DB schema 또는 migration 변경
- API contract 변경
- 운영 DB 데이터 생성, 수정, 삭제
- Booking 또는 Matching 상태 mutation
- 새로운 상태 관리 라이브러리 도입
- 새로운 디자인 시스템 도입
- 전체 `/bookings` 페이지 재설계
- `AdminDirectoryFilterForm` 또는 `AdminFormShell`의 광범위한 재작성
- Socket.IO event name 변경
- Redis/BullMQ 구조 변경
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

1. 보고서 요구사항을 자신의 말로 다시 정리한다.
2. 현재 코드, 테스트, 실제 화면에서 문제를 다시 재현한다.
3. `confirmed issue`, `probable issue`, `recommendation`, `not reproduced`를 구분한다.
4. 현재 구조에서 가능한 최소 수정안을 선택한다.
5. 한 finding만 수정한다.
6. 해당 finding의 targeted test를 실행한다.
7. 실제 `1440px` 화면에서 결과를 확인한다.
8. 성공한 경우에만 다음 finding으로 이동한다.

중요:

- 보고서와 현재 코드가 다르면 보고서를 맹목적으로 구현하지 않는다.
- 이미 수정된 finding은 `not reproduced` 또는 `already resolved`로 기록하고 다시 수정하지 않는다.
- 공용 컴포넌트 변경은 `/bookings`만 통과했다고 완료하지 않는다. 대표 소비 페이지 회귀 테스트를 실행한다.
- 각 Phase가 실패하면 다음 Phase로 이동하지 않는다.

---

# 3. 시작 전 기준선 기록

먼저 읽기 전용으로 다음을 실행한다.

```powershell
git branch --show-current
git status --short
npm.cmd run local:status
```

확인할 사항:

- branch가 예상 작업 branch인지
- 기존 dirty worktree 항목 수와 파일 목록
- API 3000, Admin 3101의 실제 listening 상태
- 실행 중인 Admin build가 현재 소스와 일치하는지
- API source와 `dist/main.js`가 일치하는지
- production `next start`가 이전 build를 유지하고 있지 않은지

기존 변경은 절대 덮어쓰거나 되돌리지 않는다.

우선 확인할 파일:

```text
apps/admin_web/components/admin-directory-filter-form.tsx
apps/admin_web/components/admin-directory-filter-form.spec.tsx
apps/admin_web/components/admin-form-controls.tsx
apps/admin_web/components/admin-form-controls.spec.tsx
apps/admin_web/app/bookings/booking-monitor.tsx
apps/admin_web/app/bookings/booking-monitor-filters-section.tsx
apps/admin_web/app/bookings/booking-monitor-filters-section.spec.tsx
apps/admin_web/app/bookings/booking-monitor-live-status-section.tsx
apps/admin_web/app/bookings/booking-monitor-live-status-section.spec.tsx
apps/admin_web/app/bookings/booking-monitor-toolbar-section.tsx
apps/admin_web/app/bookings/booking-monitor-toolbar-section.spec.tsx
apps/admin_web/app/bookings/booking-monitor-realtime.ts
apps/admin_web/app/bookings/booking-monitor-realtime.spec.ts
apps/admin_web/app/bookings/booking-empty-message.ts
apps/admin_web/app/bookings/booking-empty-message.spec.ts
apps/admin_web/app/bookings/booking-monitor-route-load-plan.ts
apps/admin_web/app/bookings/booking-monitor-route-load-plan.spec.ts
apps/admin_web/app/bookings/booking-monitor-options.ts
apps/admin_web/app/bookings/booking-monitor-page.tsx
apps/admin_web/app/bookings/page.tsx
apps/admin_web/app/globals.css
apps/api/src/admin/admin-booking-list-query.ts
apps/api/src/admin/admin-booking-list-query.spec.ts
```

현재 재감사 기준선:

```text
P0: 0
P1: 2
P2: 2
P3 recommendations: 3
Overall score: 78/100
```

재감사 당시 통과한 targeted test 기준선:

```text
Admin booking tests: 5 files, 60 tests passed
Shared GET form tests: 2 files, 30 tests passed
API production filter tests: 1 file, 18 tests passed
Total: 8 files, 108 tests passed
```

---

# Phase 1 — P1: 검색이 URL만 변경하고 서버 목록을 다시 조회하지 않는 문제

## BOOKINGS-REAUDIT-01

- severity: `P1`
- 분류: `confirmed issue`
- 우선순위: 가장 먼저 수정
- 관련 위치:
  - `apps/admin_web/components/admin-directory-filter-form.tsx`
  - `apps/admin_web/components/admin-form-controls.tsx`
  - `apps/admin_web/app/bookings/booking-monitor-filters-section.tsx`
  - `apps/admin_web/app/bookings/booking-monitor.tsx`

### 재감사에서 확인된 동작

`/bookings`의 검색창에 `audit-no-match`를 입력하고 `Search`를 실행하면:

```text
URL: /bookings?q=audit-no-match
```

까지는 변경된다.

그러나 다음 문제가 발생했다.

- 새로운 `/api/admin/bookings/page` 요청이 발생하지 않음
- 기존 `Needs action` 결과가 그대로 남음
- `Clear` 또는 `Reset filters`가 나타나지 않음
- 주소창만 보면 검색이 적용된 것처럼 보임

현재 원인은 `AdminDirectoryFilterForm.handleSubmit`이 다음만 실행하기 때문이다.

```ts
window.history.pushState(null, '', href)
```

이 페이지는 Server Component의 `searchParams`로 API 조회 경로를 생성하므로 URL 동기화만으로 충분하지 않다. 실제 App Router navigation과 Server Component 재평가가 필요하다.

### 필요한 불변식

검색 제출 후 다음이 모두 같은 query를 가리켜야 한다.

```text
Browser URL
Page searchParams
Admin API bookings/page request
검색 input value
선택 queue
검색 결과 목록
empty-state 문구
Clear / Reset action
```

### 최소 수정 요구사항

1. `canonicalGetFormHref()`의 query canonicalization은 유지한다.
2. `AdminDirectoryFilterForm`의 제출 결과를 실제 Next App Router navigation으로 전달한다.
3. 우선 검토할 최소 방식:
   - `useRouter().push(href)`
   - 또는 기존 구조에 더 적합한 정상 GET navigation
4. 단순 `window.location.assign()`으로 전체 문서를 강제 reload하는 방식은 최소 수정 근거가 없는 한 사용하지 않는다.
5. `startTransition`을 유지할 필요가 있는지 현재 Next.js 동작으로 검증한다. 필요 없다면 중복 transition을 만들지 않는다.
6. 기존 `canonicalDefaults`, hidden input, back/forward URL 계약을 보존한다.
7. 검색 버튼 중복 제출과 pending 상태에서 요청 폭주가 발생하지 않게 한다.
8. 공용 form 변경이므로 `/partners`, `/payments` 등 대표 소비 페이지의 server-backed filter도 함께 회귀 검증한다.

### 금지 사항

- `/bookings` 전용 검색 API 새로 생성
- Client-side 전체 booking dataset 로딩
- 새로운 전역 store 도입
- query string 계약 변경
- 검색 결과를 클라이언트의 기존 20개 row만으로 필터링

### 필수 테스트

먼저 기존 source-string test만 통과시키는 방식이 아닌 실제 navigation behavior test를 추가한다.

필수 검증:

```text
검색 제출
→ canonical href 생성
→ router navigation 실행
→ Page searchParams 갱신
→ 서버 데이터 재조회
```

테스트 케이스:

- `q=booking-id` 검색
- 공백 검색어 제거
- 기존 `view`, `age`, `sort` 보존
- page 파라미터는 검색 시 1페이지로 reset
- Back/Forward 복원
- 검색 후 `Clear` 또는 `Reset filters` 노출
- Clear 실행 후 canonical `/bookings` 복귀
- 검색 제출 1회당 navigation 1회
- 대표 공용 form 소비 페이지 회귀

실제 브라우저 승인 기준:

1. `/bookings`에서 존재하지 않는 검색어 입력
2. URL에 `q` 반영
3. 화면이 pending 또는 새 결과로 갱신
4. API log에 새로운 `/api/admin/bookings/page` 요청 확인
5. `Clear` 또는 `Reset filters` 표시
6. Clear 후 검색어와 결과 모두 초기화

Phase 1 targeted test와 실제 화면 검증이 모두 성공한 뒤에만 Phase 2로 이동한다.

---

# Phase 2 — P1: 검색 중 빈 상태가 전체 queue 정상 상태처럼 표시되는 문제

## BOOKINGS-REAUDIT-02

- severity: `P1`
- 분류: `confirmed issue`
- 관련 위치:
  - `apps/admin_web/app/bookings/booking-monitor.tsx`
  - `apps/admin_web/app/bookings/booking-empty-message.ts`
  - `apps/admin_web/app/bookings/booking-empty-message.spec.ts`

### 확인된 현재 동작

검색어가 URL에 존재해도 live queue의 `emptyBookingMessage()`에는 검색 context가 전달되지 않는다.

따라서 검색 결과 0건 상태에서도 다음처럼 전체 queue가 정상이라는 문구가 표시될 수 있다.

```text
No bookings need action right now.
Matching delays, expired requests, and missing chat handoffs are clear.
```

이는 `검색 결과가 없음`과 `전체 운영 queue가 비어 있음`을 혼동한다.

### 필요한 불변식

- 검색 중 empty state는 검색 결과 범위만 설명해야 한다.
- age/SLA filter 중 empty state는 현재 필터 범위만 설명해야 한다.
- filter가 없을 때만 queue 전체가 clear라는 문구를 사용할 수 있다.
- live open queue에 임의로 `Today` 기간을 붙이지 않는다.

### 최소 수정 요구사항

1. live `/bookings`에서도 `searchQuery`, `age`, 필요한 filter context를 `emptyBookingMessage()`에 전달한다.
2. 기존 historical/closed-period 문구와 live open queue 문구를 구분한다.
3. 다음과 같은 의미를 사용한다.

```text
No bookings match “audit-no-match” in Needs action.
Clear the search or change the queue.
```

4. selected queue label은 이미 존재하는 `activeView.label`을 재사용한다.
5. 검색어를 HTML로 직접 삽입하지 말고 React text rendering을 유지한다.
6. API/DB 계약은 변경하지 않는다.

### 필수 테스트

- Needs action + 검색 결과 0건
- Live now + 검색 결과 0건
- Matching now + age filter 결과 0건
- 검색과 age filter 동시 적용
- filter 없음 + 실제 queue 0건
- historical records 검색 문구 유지
- 검색어 escaping
- Clear action 안내와 실제 링크 일치

Phase 2 완료 후 검색이 적용된 상태에서 `전체 queue가 clear`라는 문구가 남지 않았는지 실제 화면으로 확인한다.

---

# Phase 3 — P1: Realtime 장애 시 live booking 목록을 갱신할 fallback 부재

## BOOKINGS-REAUDIT-03

- severity: `P1`
- 분류: `confirmed resilience issue`
- 관련 위치:
  - `apps/admin_web/app/bookings/booking-monitor.tsx`
  - `apps/admin_web/app/bookings/booking-monitor-realtime.ts`
  - `apps/admin_web/app/bookings/booking-monitor-live-status-section.tsx`
  - `apps/admin_web/app/bookings/booking-monitor-toolbar-section.tsx`

### 확인된 현재 동작

정상 상태에서 Socket.IO는 연결된다. 정상 연결 자체를 결함으로 취급하지 않는다.

그러나 현재 `router.refresh()`는 Socket event를 받았을 때만 실행된다.

```text
Socket disconnected
Socket authentication rejected
Redis adapter unavailable
Event lost
```

상태에서는 정기적인 REST fallback refresh가 없다.

재감사 중 서비스 전환 시 다음 상태가 12초 이상 유지됐고 last refresh가 바뀌지 않았다.

```text
Realtime connecting
Opening realtime socket
Last refresh 15:53:11
```

또한 버튼 문구는 `Stop auto-refresh`이지만 실제로는 Socket live updates를 pause한다.

### 필요한 불변식

- Socket이 정상일 때는 event-driven refresh가 주 경로다.
- Socket이 비정상일 때는 제한된 REST polling fallback이 있어야 한다.
- Socket이 복구되면 fallback polling은 즉시 중지돼야 한다.
- 사용자 pause 상태에서는 Socket과 fallback polling 모두 중지돼야 한다.
- 동시에 여러 refresh가 실행되면 안 된다.
- component unmount 후 timer나 socket이 남으면 안 된다.

### 최소 수정 요구사항

1. 새로운 realtime architecture를 만들지 않는다.
2. 현재 effect와 state를 유지하면서 `realtimeState !== 'live'`인 동안만 bounded fallback refresh를 추가한다.
3. 권장 주기는 운영 부하를 고려해 `15~30초` 범위에서 기존 정책과 테스트를 확인한 뒤 결정한다.
4. `isPending` 또는 동등한 상태로 중복 `router.refresh()`를 막는다.
5. Socket이 `live`가 되면 fallback timer를 정리한다.
6. connect error 또는 장시간 connecting 상태에 `Refresh now`를 제공한다.
7. 버튼 문구를 실제 동작과 일치시킨다.

```text
Stop auto-refresh → Pause live updates
Start auto-refresh → Resume live updates
```

8. 정상 live 상태에서 불필요한 status noise를 다시 추가하지 않는다.
9. Socket token, room authorization, event name, API contract는 변경하지 않는다.

### 필수 테스트

- Socket 정상 연결 시 fallback polling 미실행
- connecting이 임계 시간을 넘으면 fallback 실행
- connect_error 시 fallback 실행
- Socket reconnect 후 fallback 중지
- event 수신 시 기존 750ms debounce 유지
- fallback과 event refresh 동시 발생 시 중복 호출 방지
- pause 시 Socket/fallback 모두 중지
- resume 시 정상 연결 재시도
- unmount 시 socket과 모든 timer cleanup
- manual `Refresh now` 1회 실행
- fake timers 사용 후 open handle 없음

### 실제 화면 승인 기준

- 정상 연결: 기존처럼 조용한 live 상태
- 연결 중: 현재 상태와 마지막 갱신 시각 표시
- 장시간 연결 실패: fallback 동작과 명시적 warning 표시
- pause: `Realtime paused`, `Socket push updates paused`
- resume: 다시 연결 또는 fallback 수행
- console error/warning 없음

Phase 3을 완료하고 정상 연결·실패·재연결 세 경로를 검증한 뒤에만 Phase 4로 이동한다.

---

# Phase 4 — P2: 선택된 숨겨진 Stage queue가 접힌 디렉터리 안에 남는 문제

## BOOKINGS-REAUDIT-04

- severity: `P2`
- 분류: `confirmed issue`
- 관련 위치:
  - `apps/admin_web/app/bookings/booking-monitor-filters-section.tsx`
  - `BookingMonitorAdditionalQueuesSection`

### 확인된 현재 동작

다음 Stage queue는 `Browse queue directory` 내부에 있다.

```text
Preferred pending
Open matching
Customer choice
Matched / handoff
```

해당 URL로 진입해도 disclosure가 자동으로 열리지 않는다.

예:

```text
/bookings?view=marketplace
```

이때 Primary queue 네 개 중 선택된 항목이 없고, 실제 선택된 `Open matching`은 닫힌 disclosure 안에 숨는다.

### 최소 수정

현재 view가 directory option에 포함될 때만 기존 disclosure를 open 상태로 만든다.

개념적 승인 기준:

```tsx
open={directoryOptions.some((option) => option.view === view)}
```

정확한 구현은 기존 `AdminDisclosure` 계약을 먼저 확인하고 맞춘다.

예외 queue는 non-zero 또는 active일 때 `Additional exceptions`로 승격되는 현재 동작을 유지한다.

### 필수 테스트

- `view=first-pick` → directory open, active link 표시
- `view=marketplace` → directory open, active link 표시
- `view=customer-choice` → directory open, active link 표시
- `view=matched` → directory open, active link 표시
- 기본 `view=attention` → directory closed
- non-zero exception active → Additional exceptions에서 확인 가능
- `aria-current="page"` 유지
- native disclosure keyboard behavior 유지

---

# Phase 5 — P2: Stage와 예외·복구 queue가 평면 목록에 섞인 문제

## BOOKINGS-REAUDIT-05

- severity: `P2`
- 분류: `confirmed usability issue`
- 관련 위치:
  - `apps/admin_web/app/bookings/booking-monitor-filters-section.tsx`
  - `bookingAdditionalQueueGroups()` 또는 기존 동등 그룹 helper

### 확인된 현재 동작

`Browse queue directory`에 다음 항목이 하나의 평면 목록으로 표시된다.

```text
Data anomaly
Matching delays
Preferred pending
Open matching
Customer choice
Matched / handoff
Handoff repair
Supply intervention
```

운영 의미는 서로 다르다.

### 목표 분류

```text
Monitor stages
- Preferred pending
- Open matching
- Customer choice
- Matched / handoff

Intervention & repair
- Matching delays
- Supply intervention
- Handoff repair
- Data anomaly
```

### 최소 수정 요구사항

1. 새 queue system이나 별도 페이지를 만들지 않는다.
2. 기존 `bookingAdditionalQueueGroups()` 또는 동등한 기존 그룹 UI를 재사용한다.
3. 기존 URL, count, title tooltip, active state를 유지한다.
4. zero-count queue는 disclosure 안에서 계속 접근 가능하게 한다.
5. `Additional exceptions`의 non-zero promotion과 중복된 상단 버튼을 만들지 않는다.
6. 1440px에서 그룹이 과도하게 긴 한 줄로 늘어나지 않게 한다.

### 필수 테스트

- Stage 네 항목이 Monitor stages에만 존재
- Exception 네 항목이 Intervention & repair에만 존재
- 항목 중복 없음
- 기존 href 동일
- count 동일
- active queue disclosure 자동 open과 함께 동작
- zero count discoverability 유지
- keyboard focus order가 시각 순서와 일치

---

# Phase 6 — P3 선택 개선

다음 항목은 결함이 아니라 recommendation이다.

P1/P2를 완료한 뒤 실제 1440px 화면에서 여전히 문제가 재현되는 경우에만 최소 수정한다.

## BOOKINGS-REAUDIT-06A — 전체 0건에서 filter density 축소

현재 모든 queue와 age count가 0이어도 `Requested`와 `Order`가 큰 세로 공간을 사용한다.

검토 기준:

- 선택 queue count 0
- 검색어 없음
- age/SLA filter 없음

위 조건에서만 age/order 영역을 한 줄로 압축하거나 기존 disclosure 패턴을 사용할 수 있다.

금지:

- 검색창 숨김
- active filter가 있는데 control 숨김
- 결과가 있는데 sort 숨김
- 새로운 filter drawer 도입

## BOOKINGS-REAUDIT-06B — `All open` 범위 명확화

`All open`은 선택 queue가 아니라 데이터 모집단이다.

실제 오해가 재현되면 다음처럼 최소 문구만 조정한다.

```text
Scope: All open bookings
```

Dashboard 공용 scope label을 변경하면 다른 페이지 회귀가 발생할 수 있으므로 `/bookings` 전용 label override가 더 작은 변경인지 먼저 확인한다.

## BOOKINGS-REAUDIT-06C — Primary queue 운영 우선순위

현재 설명은 `Resolve Needs action first`이지만 첫 번째 control은 `Live now`다.

실제 운영 흐름에서 혼동이 재현되면 다음 순서를 검토한다.

```text
Needs action
Live now
Matching now
In service
```

단, URL, 기본 selected view, counts, API statusGroup mapping은 변경하지 않는다.

### P3 승인 조건

- 1440px에서 실제 정보 탐색 시간이 줄어듦
- active filter가 숨지 않음
- queue 의미가 바뀌지 않음
- CSS-only 취향 변경으로 끝나지 않음
- 테스트와 screenshot으로 차이를 설명할 수 있음

근거가 약하면 P3는 수정하지 않고 recommendation으로 남긴다.

---

# 4. 보존해야 할 현재 개선 사항

다음은 재감사에서 올바르게 구현된 것으로 확인됐다. 되돌리지 않는다.

- `/bookings` 기본 view가 `Needs action`
- action queue의 `Oldest first`
- `Work now`와 `Monitor` 역할 설명
- Primary queue 네 개의 count와 active state
- `Additional exceptions`에는 non-zero 또는 현재 active exception만 승격
- 빈 queue는 `Browse queue directory` 안에서만 표시
- `Booking records`가 별도 historical workspace로 이동
- `Production data · Test data excluded`에 대응하는 production-data predicate 강화
- audit/smoke/seed/fixture owner 제외
- native disclosure 사용
- segmented control의 `aria-current="page"`
- 1440px와 1980px에서 document-level horizontal overflow 없음

---

# 5. Targeted test 명령

Phase별로 가장 가까운 테스트만 먼저 실행한다.

## Phase 1 — 공용 GET navigation

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- components/admin-directory-filter-form.spec.tsx components/admin-form-controls.spec.tsx
```

필요하면 실제 navigation behavior를 검증하는 새 targeted spec을 같은 범위에 추가한다.

## Phase 2 — 검색 empty state

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- app/bookings/booking-empty-message.spec.ts app/bookings/booking-monitor-list-section.spec.tsx app/bookings/booking-monitor-filters-section.spec.tsx
```

## Phase 3 — Realtime fallback

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- app/bookings/booking-monitor-realtime.spec.ts app/bookings/booking-monitor-live-status-section.spec.tsx app/bookings/booking-monitor-toolbar-section.spec.tsx
```

`booking-monitor.tsx` effect의 fake-timer 또는 runtime behavior test가 기존에 없다면 가장 가까운 새 targeted test를 추가한다. source-string assertion만으로 완료하지 않는다.

## Phase 4/5 — Queue directory

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- app/bookings/booking-monitor-filters-section.spec.tsx app/bookings/booking-monitor-options.spec.ts app/bookings/booking-monitor-route-load-plan.spec.ts
```

## Admin 최종 묶음

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- app/bookings/booking-monitor-filters-section.spec.tsx app/bookings/booking-monitor-live-status-section.spec.tsx app/bookings/booking-monitor-toolbar-section.spec.tsx app/bookings/booking-monitor-realtime.spec.ts app/bookings/booking-monitor-route-load-plan.spec.ts app/bookings/booking-empty-message.spec.ts components/admin-directory-filter-form.spec.tsx components/admin-form-controls.spec.tsx app/api/admin/realtime-token/route.spec.ts
```

## API production filter

API production predicate를 변경하지 않았다면 재실행만 하고 수정하지 않는다.

```powershell
npm.cmd test --workspace @massage-vn/api -- src/admin/admin-booking-list-query.spec.ts
```

## Scope 검증

```powershell
npm.cmd run verify:scope -- -Scope admin
```

API 코드를 실제로 변경한 경우에만:

```powershell
npm.cmd run verify:scope -- -Scope api
```

마지막으로:

```powershell
git diff --check
git status --short
```

테스트 실패를 기존 문제라고 추정하지 않는다. 변경 전 기준선과 비교해 원인을 추적한다.

---

# 6. 실제 브라우저 검증 절차

로그인된 `http://localhost:3101/bookings`에서 확인한다.

주의:

- production `next start`는 이전 build를 계속 제공할 수 있다.
- `npm.cmd run local:status`로 현재 build freshness와 process 시작 시각을 먼저 확인한다.
- 화면 검증 도중 다른 process가 서버를 재시작하면 현재 screenshot을 완료 증거로 사용하지 않는다.
- 데이터 변경 버튼, 예약 상태 변경, 배정, 승인, 재무 mutation은 실행하지 않는다.

필수 viewport:

```text
1440x1000
1980x1100
```

1024px 이하 검증은 수행하지 않는다.

## 필수 시나리오 A — 검색

1. `/bookings` 기본 진입
2. `Needs action` active 확인
3. 존재하지 않는 검색어 입력
4. URL, API request, input, result가 같은 query인지 확인
5. 검색 결과 전용 empty-state 확인
6. Clear/Reset 표시 확인
7. Clear 후 기본 view 복원
8. Back/Forward 상태 복원

## 필수 시나리오 B — Queue filter

1. `Under 1h` 선택
2. URL에 `age=under-1h` 반영
3. age count와 목록 재조회 확인
4. `Oldest first`와 `Newest first` 전환
5. active state 및 `aria-current` 확인
6. filter reset 확인

## 필수 시나리오 C — Queue directory

1. 기본 view에서 directory가 접혀 있는지 확인
2. directory 펼침
3. Monitor stages와 Intervention & repair 그룹 확인
4. `Open matching`으로 이동
5. 새 페이지에서 directory가 자동으로 열리고 active link가 보이는지 확인
6. exception queue가 non-zero일 때 Additional exceptions로 승격되는지 테스트 fixture 없이 가능한 기존 상태에서 확인

## 필수 시나리오 D — Realtime

1. 정상 연결 상태 확인
2. live 상태에서 불필요한 polling이 없는지 확인
3. 기존 테스트 또는 안전한 로컬 환경에서 connection failure 재현
4. fallback refresh 확인
5. reconnect 후 fallback 중단 확인
6. Pause/Resume 문구와 동작 확인
7. timer 또는 request storm 없음 확인

## 시각 승인 기준

1440px와 1980px 모두에서:

- 검색 결과와 URL이 일치
- filtered empty state가 전체 queue clear로 오인되지 않음
- active Stage queue가 숨지 않음
- Stage와 exception 그룹 구분이 명확함
- Needs action 우선순위가 한눈에 보임
- 모든 count가 읽기 쉬움
- 버튼과 입력 요소가 겹치지 않음
- document-level horizontal overflow 없음
- console error/warning 없음

필수 캡처:

1. 기본 Needs action 상단
2. 검색 결과 0건 + Clear action
3. queue directory 펼침
4. Open matching active + directory 자동 펼침
5. Realtime disconnected fallback 상태
6. 1980px 전체 상단 구조

---

# 7. 완료 기준

다음 조건을 모두 만족해야 완료다.

```text
[ ] 검색이 URL만 변경하지 않고 server-backed list를 다시 조회한다.
[ ] 검색, API request, 결과, empty state, Clear가 같은 query를 사용한다.
[ ] filtered empty state가 전체 queue clear라고 말하지 않는다.
[ ] Realtime 장애 시 bounded REST fallback이 동작한다.
[ ] Realtime 복구 시 fallback이 중지된다.
[ ] Pause/Resume가 실제 동작과 일치한다.
[ ] active Stage queue가 자동으로 펼쳐져 보인다.
[ ] queue directory가 Monitor stages / Intervention & repair로 구분된다.
[ ] 기존 URL/API/DB 계약이 유지된다.
[ ] production-data 필터가 약화되지 않는다.
[ ] 1440px와 1980px에서 overflow가 없다.
[ ] targeted tests와 admin scope 검증이 통과한다.
[ ] 기존 사용자 변경 사항이 보존된다.
```

P3는 근거가 부족하면 미구현 recommendation으로 남겨도 된다. P1/P2는 실패한 테스트나 미검증 화면이 있으면 완료로 표시하지 않는다.

---

# 8. 완료 보고 형식

## A. 시작 상태

- branch
- 시작 `git status --short`
- 기존 변경 파일 수
- API/Admin process 및 build freshness
- 실제 검사한 URL과 viewport

## B. Finding별 결과

각 ID에 대해 다음을 작성한다.

```text
ID:
severity:
판정: confirmed / probable / recommendation / not reproduced
변경 파일:
관련 함수·컴포넌트:
재현한 이전 동작:
변경 동작:
최소 수정인 이유:
API contract 영향:
DB schema 영향:
인증·권한 영향:
회귀 위험:
실행 테스트:
브라우저 검증:
```

## C. 테스트

- 실제 실행 명령
- test file 수
- pass/fail/skip 수
- 실패 원인
- 실행하지 못한 검증

## D. 브라우저 검증

- 1440x1000 결과
- 1980x1100 결과
- 검색 query와 API request 일치 여부
- Clear/Reset 동작
- realtime 정상/실패/복구
- queue directory active state
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

## F. 남은 문제

- 의도적으로 수정하지 않은 P3 recommendation
- 실제 데이터가 없어 검증하지 못한 상태
- 다음 한 건으로 처리할 권장 작업

한 항목이라도 검증하지 못했다면 `완료`라고 쓰지 않는다.
