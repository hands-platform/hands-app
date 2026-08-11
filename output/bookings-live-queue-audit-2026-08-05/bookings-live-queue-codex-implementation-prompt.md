# Bookings Live Queue 개선용 Codex 실행 프롬프트

## 사용 방법

1. Codex에서 `C:\dev\massage-on-demand-vn` 프로젝트를 연다.
2. 관리자 웹에 로그인된 in-app browser를 유지한다.
3. 아래 프롬프트 전체를 새 Codex 작업에 붙여 넣는다.
4. 가능하면 reasoning을 High 이상으로 설정한다.
5. 이 작업은 분석만 하는 작업이 아니라 코드 수정, 테스트, 실제 화면 재검증까지 완료하는 작업이다.

## 복사해서 사용할 프롬프트

```text
당신은 `C:\dev\massage-on-demand-vn` 저장소의 관리자 웹을 수정하는 선임 프론트엔드/풀스택 엔지니어다.

목표는 `http://localhost:3101/bookings`의 Bookings Live Queue를 실제 운영자가 신뢰하고 빠르게 사용할 수 있도록 고치는 것이다. 디자인 장식보다 상태 정합성, 처리 우선순위, 시간 정보의 정확성, 스캔 속도, 접근성을 우선한다.

이번 작업은 제안서 작성으로 끝내지 말고 코드를 직접 수정하고, 관련 테스트를 추가/수정하고, 로그인된 실제 관리자 화면에서 결과를 검증한 뒤 완료하라.

## 먼저 읽을 자료

1. 저장소의 모든 적용 가능한 `AGENTS.md`
2. 감사 보고서:
   `C:\dev\massage-on-demand-vn\output\bookings-live-queue-audit-2026-08-05\bookings-live-queue-operator-audit.md`
3. 보고서가 참조하는 현재 화면 캡처:
   `C:\dev\massage-on-demand-vn\output\bookings-live-queue-audit-2026-08-05\`

보고서를 요구사항의 기준으로 사용하되, 코드를 다시 추적해 현재 상태가 달라졌다면 현재 코드와 실제 화면을 우선하고 차이를 기록하라.

## 작업 원칙

- 작업 시작 전에 `git status`를 확인한다.
- 현재 worktree에는 사용자의 미완성 변경이 있을 수 있다. 관련 없는 변경을 되돌리거나 덮어쓰지 않는다.
- `git reset --hard`, 광범위한 checkout, 임의 삭제를 사용하지 않는다.
- 기존 라우트, API 계약, 디자인 토큰, 공용 Admin 컴포넌트를 최대한 재사용한다.
- 새 UI 라이브러리, 새 상태 관리 라이브러리, 새 디자인 시스템을 추가하지 않는다.
- 이미 있는 count map, empty message helper, table/panel/status 컴포넌트를 먼저 재사용한다.
- 문제를 화면별 임시 조건으로 가리지 말고 URL → 파라미터 파싱 → 서버 로드 계획 → 클라이언트 상태 → 최종 렌더 흐름의 근본 원인을 수정한다.
- production 데이터 안전장치, 전화번호 마스킹, 지역 일반화, 관리자 권한 경계를 유지한다.
- audit fixture는 이름 패턴으로 삭제하거나 몰래 숨기지 않는다.
- 불필요한 추상화나 대규모 리팩터링을 하지 않는다. 가장 작은 근본 수정으로 처리한다.
- 현재 기능과 무관한 페이지를 재설계하지 않는다.
- 브라우저 검증이 필요한 작업이므로 가능하면 `product-design:audit`, `impeccable`, `browser:control-in-app-browser` 스킬을 사용한다.
- 로그인된 세션이 있는 in-app browser를 사용한다. 별도 인증 우회나 새 계정 생성을 하지 않는다.

## 필수 구현 범위

아래 BQ-001부터 BQ-016까지 처리하라. P0와 P1은 필수이며, P2도 같은 작업에서 구현하되 기존 API/컴포넌트로 안전하게 해결할 수 있는 범위에서 최소 변경으로 완료한다.

### BQ-001 · P0 · Live now 상태 정합성

현재 `/bookings?view=active`에서 API 데이터는 realtime이지만 선택 탭, Current workspace, 필터 요약, 목록 제목은 Needs action으로 표시된다.

확인할 코드:

- `apps/admin_web/app/bookings/booking-page-params.ts`
- `apps/admin_web/app/bookings/booking-monitor-route-load-plan.ts`
- `apps/admin_web/app/bookings/booking-monitor-page.tsx`
- `apps/admin_web/app/bookings/booking-monitor.tsx`
- 관련 spec 파일

필수 수정:

- `BOOKING_VIEWS`가 `active`를 정상적인 `BookingPageView`로 인식하게 한다.
- route load plan에서 `active -> realtime` 의도를 명시한다.
- 가능하면 파라미터 해석과 로드 계획이 같은 정규화 결과를 사용하게 하되, 이를 위해 불필요한 새 계층을 만들지 않는다.
- 직접 URL 진입, 새로고침, 탭 클릭 모두 동일하게 동작하게 한다.

완료 조건:

- URL: `view=active`
- 선택 탭: `Live now`
- Current workspace: `Live now`
- 필터 요약: `View: Live now`
- 목록 제목: `Live now`
- API statusGroup: `realtime`

위 여섯 항목이 동시에 일치해야 한다.

### BQ-002 · P0 · Oldest/Newest 최종 렌더 정렬

현재 서버에는 `sort=oldest`가 전달되지만 `booking-monitor.tsx`가 결과를 다시 최신순으로 정렬한다.

필수 수정:

- 서버 페이지네이션 결과는 서버가 반환한 순서를 보존한다.
- 비페이지네이션 로컬 목록에 정렬이 필요하다면 현재 `queueSort` 값을 반영한다.
- 화면 표시용 row 생성 과정에서 무조건 descending sort하지 않는다.
- 큐별 기본 정렬 의미를 유지한다.
  - Needs action, Matching delays: Oldest first 또는 SLA 위험 우선
  - Live now: 현재 명시된 기본 정렬
  - Records: Newest first

완료 조건:

- `?view=active&sort=oldest`에서 더 오래된 요청이 먼저 표시된다.
- `?view=active` 또는 `sort=newest`에서 반대 순서가 표시된다.
- URL, 선택된 Order, API 요청, 최종 DOM 행 순서가 일치한다.

### BQ-003 · P1 · 시간 의미 통일

현재 같은 Age 셀에서 createdAt 기반 `Updated 2h ago`와 상태 변경 기반 정확 시각 `18:53`이 함께 표시된다.

확인할 코드:

- `apps/admin_web/app/bookings/booking-list-time.ts`
- `apps/admin_web/lib/admin-booking-time.ts`
- `apps/admin_web/app/bookings/booking-monitor-list-row-model.ts`
- `apps/admin_web/app/bookings/booking-monitor-list-section.tsx`
- `apps/api/src/admin/admin-booking-list-query.ts`

필수 수정:

- 한 상대 시간과 그 아래 정확 시간은 동일한 timestamp에서 파생한다.
- createdAt/openedAt이면 `Requested`, `Opened`, `Waiting`을 사용한다.
- updatedAt이면 `Last update` 또는 `Updated`를 사용한다.
- 상태별 event timestamp면 `Service started`, `Matched`, `Arrived`처럼 사건을 명시한다.
- `Age`라는 포괄적 열 이름은 실제 의미에 따라 `Waiting` 또는 `Last activity`로 바꾼다.
- Age 필터가 createdAt 기준이라면 그 사실을 짧은 도움말 또는 접근 가능한 설명으로 명확히 한다.

절대로 서로 다른 timestamp를 같은 사건처럼 한 셀에 표시하지 않는다.

### BQ-004 · P1 · 불완전한 상태 문구

현재 `showDate={false}`인데 상태 문구가 `Matching opened at`, `Service started at`처럼 `at`으로 끝난다.

필수 수정:

- 시간이 없으면 `Matching opened`, `Service started`라고 표시한다.
- 운영상 가능하면 `Service started · 18:53`처럼 상태와 해당 event time을 함께 표시한다.
- 모든 BookingStatus에 같은 규칙을 적용한다.

### BQ-005 · P1 · Records 문맥 분리

현재 `view=all` Records에서 목록은 기록이지만 페이지 상단은 `Live bookings`, `All open`, `24h live window`, `Live updated`, realtime 연결을 유지한다.

필수 수정:

- Records의 페이지 제목을 `Booking records`로 표시한다.
- 데이터 범위를 `Historical`, `Today records` 또는 현재 date range에 맞게 표시한다.
- Records에서는 Live status와 Needs action 요약을 표시하지 않는다.
- Records 진입 시 realtime token/socket 연결을 시작하지 않는다.
- 기간, 총 결과 수, 현재 정렬을 명확히 표시한다.
- 새 라우트를 만들 필요가 없다. 현재 view 기반 문맥 분기를 우선한다.

완료 조건:

- Records 화면에 `24h live window`, `All open`, `Realtime connecting`이 나오지 않는다.
- Records 진입 시 `/api/admin/realtime-token` 요청이 발생하지 않는다.

### BQ-006 · P1 · 핵심 요약/큐 건수 노출

현재 summary에는 여러 값이 있지만 첫 항목만 표시된다. `bookingViewCounts`도 계산되지만 탭 label에 전달되지 않는다.

필수 수정:

- 상단에 다음 핵심 값을 compact하고 클릭 가능한 형태로 표시한다.
  - Needs action
  - Live now
  - Matching
  - In service
- Data anomaly와 Blocked today는 0보다 클 때 경고형 보조 항목으로 표시한다.
- 각 숫자는 해당 큐로 이동할 수 있어야 한다.
- Primary queue에도 count를 표시한다.
- 큰 KPI 카드 그리드를 새로 만들지 말고 기존 compact summary/segmented control 패턴을 재사용한다.

### BQ-007 · P1 · 1024px 운영 표 가독성

현재 Operations 표는 8열, min-width 1040px, fixed layout이며 1024px 브라우저에서 약 404px의 내부 수평 이동이 필요하다. Service, Area, Booking, Next action 같은 핵심 정보가 동시에 보이지 않는다.

필수 수정:

- 운영 판단 기준으로 6개 열 이하로 통합한다.
  1. 상태 · 상태 변경 시각
  2. 예약 · 고객
  3. 파트너 · 매칭 진행
  4. 서비스 · 지역
  5. 대기/최근 활동
  6. 다음 조치
- 고객명, 마스킹 전화번호, 짧은 예약 ID는 같은 식별 셀 안에서 읽을 수 있게 배치한다.
- 서비스와 지역은 하나의 셀에서 2행으로 표시할 수 있다.
- 1024px 이하에서는 수평 스크롤 없이 핵심 정보를 읽을 수 있는 행 카드 또는 compact table 구성을 제공한다.
- 수평 스크롤이 남는다면 첫 식별 열과 마지막 Next action을 sticky 처리하고 스크롤 가능함을 명확히 표시한다.
- 1440×900, 1024×768에서 직접 확인한다.
- 768px 높이의 첫 화면에서 최소 한 예약 행 전체가 보여야 한다.

### BQ-008 · P1 · Audit fixture 환경 표시

비운영 환경에서 `HANDS Audit Customer`, `audit_booking_list...` 데이터가 보이는데도 `Test data excluded`가 표시된다.

필수 수정:

- production: `Production data · Test data excluded`
- 비운영 환경: `Audit fixtures may be visible`
- 데이터에 audit fixture 존재 여부를 안전하게 알 수 있다면 `Audit fixtures visible`이라고 표시한다.
- audit fixture의 production 실행 차단은 유지한다.
- audit fixture를 삭제하거나 이름 패턴으로 숨기지 않는다.

### BQ-009 · P1 · 큐별 빈 상태

현재 이미 `booking-empty-message.ts`에 큐별 문구가 있으나 호출부는 일반 문구를 하드코딩한다.

필수 수정:

- 기존 `emptyBookingMessage(view)`를 연결한다.
- 결과가 0건이면 8열 헤더와 불필요한 페이지네이션 대신 compact empty state를 표시한다.
- empty, loading, load failed 상태를 서로 다르게 표시한다.
- load failed의 Retry 동작은 유지한다.

Needs action 권장 문구:
`No bookings need action right now. Matching delays, expired requests, and missing chat handoffs are clear.`

### BQ-010 · P2 · 큐별 count 표시

- 이미 계산된 `bookingViewCounts`를 Primary와 Additional queue label에 연결한다.
- 추가 API 호출을 만들지 않는다.
- `Live now 2`, `Needs action 1`, `Matching now 1`처럼 읽을 수 있게 한다.

### BQ-011 · P2 · 추가 큐 그룹화

추가 큐를 다음과 같이 구분한다.

- Live flow: Preferred pending, Marketplace open, Customer choice, Matched now
- Exceptions: Matching delays, No supply, Handoff repair, Data anomaly, Blocked today
- History: Pre-match cancelled, Preferred rejected, Preferred no response, Records

요구사항:

- 각 항목에 count를 표시한다.
- 0건 큐는 기본적으로 `Show empty queues` 뒤에 접는다.
- Records는 0건이어도 항상 접근할 수 있어야 한다.
- 의미 있는 HTML heading/group 구조와 접근 가능한 이름을 사용한다.

### BQ-012 · P2 · Next action 문구를 운영자 행동으로 변경

상황 설명과 실제 운영자 행동을 분리한다.

권장 기준:

- OPEN_MATCHING 정상
  - action: `Monitor matching`
  - helper: `Customer may keep waiting or switch to Marketplace.`
- OPEN_MATCHING 30분 이상
  - action: `Review stalled matching`
  - helper: `Check Partner participation and contact the customer if needed.`
- IN_SERVICE 정상
  - action: `Monitor service completion`
  - helper: `No action unless the expected end time is exceeded.`
- IN_SERVICE 지연
  - action: `Contact Partner`
  - helper: `Confirm completion, then verify payment capture.`
- MATCHED chat 없음
  - action: `Repair chat handoff`
  - helper: `Confirm the selected Partner and create or restore the chat room.`

각 행을 `Action`, `Watch`, `Clear` 중 하나로 구분하되 기존 badge/status 컴포넌트를 재사용한다.

### BQ-013 · P2 · 상태 색조 의미 수정

현재 필터 패널 tone이 `view === all ? success : warning`으로 결정된다.

다음 의미로 수정한다.

- Live now 정상: neutral/info
- Needs action 또는 exception 1건 이상: warning/danger
- action queue 0건: success
- Records: neutral

색상은 view 문자열이 아니라 조치 필요 여부와 count를 반영해야 한다.

### BQ-014 · P2 · 상단 중복과 세로 공간 축소

현재 Page title, data status, summary, workspace panel, Current workspace, result count, primary queue, filter summary가 반복된다.

권장 구성:

1. 한 줄: 페이지 제목 + 마지막 갱신 + 자동 갱신 제어
2. 한 줄: 클릭 가능한 핵심 큐와 count
3. 한 줄: Search + Age + Order
4. 바로 목록

`Current workspace`, `View`, `Scope`, `Total`은 같은 정보를 여러 곳에서 반복하지 않는다. 1024×768 첫 화면에서 최소 한 행이 보이도록 한다.

### BQ-015 · P2 · Table scroll 접근성

`AdminTableScroll`에 다음을 추가한다.

- `ariaLabel` prop
- `role="region"`
- 화면별 명확한 aria-label
- `.admin-table-scroll:focus-visible` 스타일
- 실제 수평 overflow가 있을 때만 스크롤 안내

키보드로 큐 선택, 필터, 표 영역, 행 상세 링크에 접근할 수 있어야 한다.

### BQ-016 · P2 · 가격 문구

현재 `Customer 500.000 VND / min 500.000 VND`에서 `min`은 minimum인데 분당 가격으로 오해할 수 있다.

필수 수정:

- `Customer price 500,000 VND`
- `Minimum 500,000 VND`
- 두 금액이 같으면 중복 금액을 생략한다.
- 프로젝트의 기존 locale/currency formatter를 그대로 사용한다.

## 목표 화면 정보 구조

다음 구조를 참고하되 현재 Admin 디자인 토큰과 컴포넌트를 유지한다.

Live bookings                         Live · updated 19:04   [Pause updates]
Resolve bookings that need action, then monitor matching and services in progress.

[Needs action 1] [Live now 2] [Matching 1] [In service 1]   [More queues]

[Search booking / customer / phone / Partner________________] [Search]
Age: [All 2] [<1h 1] [1–4h 1]      Order: [Newest] [Oldest]

Live now · 2 bookings
Status/time | Booking/customer | Partner | Service/area | Last activity | Next action

이것을 문자 그대로 새 디자인으로 복제하지 말고, 현재 코드의 기존 Admin 패턴으로 구현하라.

## 필수 문구 기준

- `Booking workspace filters` → `Booking queues`
- `Age` → 실제 의미에 따라 `Waiting` 또는 `Last activity`
- `Updated 2h ago` → timestamp에 맞게 `Requested 2h ago` 또는 `Updated 7m ago`
- `Service started at` → `Service started · 18:53` 또는 `Service started`
- `Customer ... / min ...` → `Customer price ... · Minimum ...`
- Records의 페이지 title → `Booking records`
- 비운영 환경의 `Test data excluded` → `Audit fixtures may be visible`

기존 앱의 기본 언어가 영어이므로 UI 문구는 영어를 유지한다. 내부 코드 명칭과 데이터 상태 이름도 기존 용어를 존중한다.

## 구현 절차

1. 관련 `AGENTS.md`와 감사 보고서를 읽는다.
2. `git status`로 기존 변경을 확인한다.
3. 코드 수정 전 실제 화면에서 다음 상태를 재현하고 필요한 baseline screenshot을 저장한다.
   - `/bookings`
   - `/bookings?view=active`
   - `/bookings?view=active&sort=oldest`
   - `/bookings?view=matching`
   - `/bookings?view=all`
   - Advanced filters open
   - 1024×768
4. URL → 파라미터 → API statusGroup → client view → 렌더 결과 흐름을 추적한다.
5. P0를 먼저 수정하고 focused test를 실행한다.
6. P1을 수정하고 다시 focused test를 실행한다.
7. P2를 최소 변경으로 적용한다.
8. touched files를 포맷하고 관련 lint/typecheck/test를 실행한다.
9. 로그인된 실제 브라우저에서 모든 acceptance check를 수행한다.
10. 변경 전/후 screenshot을 같은 viewport와 상태로 비교한다.
11. 최종 diff를 검토해 관련 없는 변경, 중복 코드, 죽은 코드, 새 dependency가 없는지 확인한다.

## 테스트 요구사항

최소 다음 회귀 테스트를 남긴다.

1. `readBookingView('active') === 'active'`
2. `view=active`가 `initialView=active`와 `statusGroup=realtime`을 동시에 만든다.
3. Live now 렌더에서 selected tab, workspace label, list title이 모두 Live now다.
4. Oldest/Newest에 따라 최종 렌더 row ID 순서가 바뀐다.
5. 상대 시간과 정확 시간이 같은 timestamp를 사용한다.
6. 상태 라벨이 시간 없이 `at`으로 끝나지 않는다.
7. Records에서 historical scope가 표시된다.
8. Records에서 realtime token fetch/socket이 시작되지 않는다.
9. empty view가 `emptyBookingMessage(view)`를 사용한다.
10. `AdminTableScroll`이 role, aria-label, visible focus를 가진다.

저장소의 package scripts를 먼저 확인한 뒤 가장 좁은 관련 test부터 실행하고, 마지막에 영향 범위에 맞는 typecheck/lint를 실행한다. 무관한 전체 e2e를 무조건 돌리지 않는다.

## 브라우저 검증 체크리스트

### 상태 정합성

- `/bookings?view=active`의 URL, 선택 탭, workspace, filter summary, list title이 Live now로 일치
- Needs action, Matching now, Records에서도 동일 원칙 유지
- 새로고침과 직접 URL 진입에서 상태 유지

### 정렬과 시간

- Oldest first와 Newest first의 최종 행 순서가 실제로 반대
- 상대 시간과 정확 시간이 서로 모순되지 않음
- Requested/Open/Updated/Status changed 용어가 timestamp와 일치

### Records

- `Booking records` 제목
- 현재 기간과 결과 수 표시
- Live 범위와 realtime 문구 없음
- realtime token/socket 요청 없음

### 레이아웃

- 1440×900에서 과도한 빈 공간이나 잘림 없음
- 1024×768에서 핵심 정보와 Next action 확인 가능
- 768px 높이 첫 화면에서 최소 한 예약 행 확인 가능
- body 전체 수평 overflow 없음
- 긴 이름, 참가자 수, 서비스명이 읽을 수 없을 정도로 잘리지 않음

### 접근성

- 의미 있는 heading/region/table 구조
- table scroll 영역의 접근 가능한 이름
- visible keyboard focus
- 키보드만으로 queue, filter, row detail 접근 가능

### 안정성

- 브라우저 console error/warning 없음
- 기존 전화번호 마스킹 유지
- production fixture 차단 유지
- 다른 booking route와 completed/cancellation workspace 회귀 없음

## 완료 정의

다음 조건을 모두 만족할 때만 완료로 보고한다.

- BQ-001부터 BQ-016까지 처리 결과가 있다.
- P0/P1은 모두 코드와 테스트로 해결됐다.
- 실제 브라우저에서 acceptance checklist를 통과했다.
- 관련 테스트, typecheck/lint 결과를 기록했다.
- source code와 함께 필요한 테스트가 수정됐다.
- 관련 없는 사용자 변경을 건드리지 않았다.
- 새 dependency를 추가하지 않았다.
- 미해결 항목이 있다면 숨기지 말고 ID, 원인, 실제 blocker, 다음 조치를 명시했다.

## 최종 보고 형식

최종 응답은 다음 순서로 간결하게 작성하라.

1. 완료된 운영자 경험 변화
2. P0/P1/P2별 수정 요약
3. 핵심 변경 파일
4. 실행한 테스트와 결과
5. 브라우저 검증 viewport/상태와 결과
6. 저장한 before/after screenshot 및 보고서 경로
7. 남은 제한 또는 미해결 항목

코드를 수정하지 않고 새 분석 보고서만 만드는 것으로 작업을 끝내지 마라. 구현, 테스트, 실제 화면 재검증까지 완료하라.
```

## 권장 실행 방식

이 작업은 여러 상태와 서버/클라이언트 흐름을 함께 수정하므로 한 번에 전부 맡기되, Codex가 내부적으로 P0 → P1 → P2 순서로 진행하게 하는 것이 좋다. 중간에 별도 승인을 요구하도록 프롬프트를 나누면 상태 흐름을 반복해서 다시 읽는 비용이 커질 수 있다.

다만 첫 실행에서 범위가 너무 넓다고 판단되면 아래 경계로 두 번 나눌 수 있다.

- 1차: BQ-001~009 — 기능 정합성, 시간, Records, summary, table, fixture, empty state
- 2차: BQ-010~016 — count, 큐 구조, 문구, tone, 세로 밀도, 접근성, 가격

P0인 BQ-001과 BQ-002는 절대로 서로 다른 작업으로 분리하지 않는다. URL 상태와 최종 정렬을 같은 브라우저 검증 흐름에서 확인해야 한다.
