# Codex 실행 프롬프트 — Admin `/bookings` 운영자 UX 개선

아래 프롬프트 전체를 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

## 프롬프트 시작

`C:\dev\massage-on-demand-vn` 프로젝트의 관리자 웹 `/bookings` 페이지를 실제 운영자가 빠르고 안전하게 사용할 수 있도록 수정해줘.

이번 작업은 단순한 시각 리디자인이 아니다. 운영자가 긴급하거나 멈춘 예약을 먼저 찾고, 현재 매칭·서비스 진행 상태를 감시하고, 과거 기록을 혼동 없이 조회할 수 있도록 **기능 결함, 정보 구조, 문구, 표 밀도, 반응형, 접근성, 테스트를 함께 개선하는 작업**이다.

### 먼저 읽을 자료

작업을 시작하기 전에 다음 자료와 저장소 지침을 읽어라.

1. 저장소의 모든 적용 가능한 `AGENTS.md`
2. 상세 감사 보고서:  
   `C:\dev\massage-on-demand-vn\output\bookings-audit-2026-08-05\bookings-operator-audit.md`
3. 화면 증거:
   - `C:\dev\massage-on-demand-vn\output\bookings-audit-2026-08-05\01-bookings-needs-action-full.png`
   - `C:\dev\massage-on-demand-vn\output\bookings-audit-2026-08-05\02-bookings-advanced-filters.png`
   - `C:\dev\massage-on-demand-vn\output\bookings-audit-2026-08-05\03-bookings-matching-now.png`

보고서의 줄 번호는 감사 당시 기준이다. 현재 코드가 달라졌을 수 있으므로 파일명과 심볼을 기준으로 다시 검색하고, 기존 사용자 변경사항을 덮어쓰지 마라.

## 최종 목표

다음 세 업무 모드가 한 페이지 안에서 명확히 구분되어야 한다.

1. `Needs action`: 멈췄거나 운영자 조치가 필요한 예약 처리
2. `Live now` / `Matching now`: 현재 운영 상태 감시
3. `Records`: 과거 예약 검색과 결과·후속 작업 확인

운영자는 첫 화면에서 다음을 즉시 알 수 있어야 한다.

- 지금 조치가 필요한 예약 수
- 현재 매칭 중인 예약 수
- 서비스 진행 중인 예약 수
- 어떤 큐를 보고 있는지
- 결과가 0건인 이유
- 각 예약에서 다음으로 해야 할 행동

## 반드시 지킬 작업 방식

1. 먼저 현재 구현과 호출 흐름을 끝까지 추적하고 브라우저에서 문제를 재현해라.
2. 증상별 임시 패치가 아니라 공통 원인을 한 곳에서 수정해라.
3. 기존 컴포넌트, 토큰, CSS 패턴, 라우트와 API를 우선 재사용해라.
4. 새 UI 라이브러리, 새 상태관리 도구, 새 `/bookings` 대체 라우트를 추가하지 마라.
5. 기존 API 응답만으로 해결할 수 있는 화면 문제 때문에 새 API 필드를 만들지 마라.
6. 작업 범위와 관계없는 리팩터링, 파일명 변경, 대규모 포맷 변경을 하지 마라.
7. 현재 워크트리가 깨끗하다고 가정하지 말고 사용자 변경사항을 보존해라.
8. 데이터 삭제, 기존 예약 수정, fixture backfill, DB migration은 자동 실행하지 마라. 필요하면 안전한 코드 변경과 별도 실행 계획만 제시하고 승인을 받아라.
9. 디자인을 임의로 새로 만들지 말고 현재 관리자 웹의 디자인 시스템 안에서 정보 위계와 운영 밀도를 개선해라.
10. 각 단계가 끝날 때 가장 작은 관련 테스트와 실제 브라우저 동작을 검증해라.

## Phase A — 기능과 데이터 신뢰 문제

### A1. `Live now` 라우팅 결함 수정 — P0

현재 `Live now`를 누르면 URL은 `/bookings?view=active`가 되지만 화면은 `Needs action`으로 돌아간다.

확인할 코드:

- `apps/admin_web/app/bookings/booking-page-params.ts`
- `apps/admin_web/app/bookings/booking-page-params.spec.ts`
- `BookingPageView`
- `BOOKING_VIEWS`
- `readBookingView`

요구사항:

- `active`를 유효한 booking view로 처리한다.
- `readBookingView('active') === 'active'` 회귀 테스트를 추가한다.
- 클릭, 직접 URL 입력, 새로고침 후에도 `Live now` 선택 상태가 유지되어야 한다.
- 활성 목록 요청이 기존 `realtime` status group을 사용해야 한다.

### A2. Live 화면과 Records 화면의 맥락 분리 — P1

현재 `view=all&dateRange=30d`에서 과거 기록을 조회해도 `Live bookings`, `All open`, `24h live window`, `Needs action: 0`이 남아 있다.

확인할 코드:

- `booking-monitor-page.tsx`
- `booking-monitor-route-load-plan.ts`
- view별 route config와 summary/dataScope 생성 부분

요구사항:

- live view와 historical view의 표시 모델을 분리한다.
- `Records`에서는 제목을 `Booking records`로 표시한다.
- Records 상단에는 기간, 검색 조건, 결과 건수, 갱신 시각만 표시한다.
- Records에서 `Live bookings`, `24h live window`, `Needs action: 0`을 숨긴다.
- live-only summary는 live view에서만 표시한다.
- 새 페이지나 중복 route를 만들지 말고 현재 view 설정을 확장한다.

### A3. 시간 의미 수정 — P1

현재 age filter와 목록 시각은 `createdAt`을 기준으로 하면서 UI에는 `Updated`라고 표시하고, Needs action의 정체 판단은 `updatedAt`을 사용한다.

확인할 코드:

- `apps/api/src/admin/admin-booking-list-query.ts`
- `apps/admin_web/lib/admin-booking-time.ts`
- `apps/admin_web/app/bookings/booking-list-time.ts`

요구사항:

- 생성 후 경과 시간과 마지막 변경 후 경과 시간을 혼동하지 않게 한다.
- live queue에서는 가능한 경우 `Open 42m · No update 31m` 형태로 보여준다.
- historical view에서는 `Created`, `Closed` 등 실제 timestamp 의미를 사용한다.
- 같은 timestamp를 `Age`와 `Updated`라는 서로 다른 의미로 표시하지 않는다.
- 현재 데이터로 해결할 수 있으면 새 API 필드를 추가하지 않는다.

### A4. 테스트 데이터 제외 표시의 신뢰성 확보 — P1

`Test data excluded` 상태에서도 `Demo Customer`, `Smoke Partner`, `Api Smoke Fixture Complete`가 확인됐다.

확인할 코드:

- `apps/api/src/admin/admin-booking-list-query.ts`
- seed/smoke/fixture 예약을 생성하는 모든 호출 경로
- 기존 metadata fixture marker 사용 여부

요구사항:

- 사람 이름이나 메모 문자열만으로 운영 데이터를 임의 제외하지 않는다.
- fixture 생성 경로에서 명시적 metadata marker가 일관되게 저장되는지 확인하고 누락된 생성 경로를 수정한다.
- 기존 데이터 backfill이나 삭제가 필요하면 실행하지 말고 대상, 조건, rollback 방법을 별도 보고한다.
- 완전한 제외를 증명하지 못하면 UI 문구를 `Known fixtures excluded`로 낮춘다.
- fixture가 아닌 실제 운영 데이터가 오탐으로 제외되지 않는 테스트를 포함한다.

## Phase B — 운영자 정보 구조와 문구

### B1. 주요 큐에 기존 count 표시

현재 계산 중인 `bookingViewCounts` 또는 기존 overview summary를 재사용해 다음처럼 표시한다.

- `Needs action 0`
- `Live now 0`
- `Matching now 0`

추가 count API를 만들지 마라. 0건은 중립적으로, 1건 이상의 Needs action은 현재 디자인 토큰의 warning 또는 danger 위계로 표시한다. 색상만으로 상태를 구분하지 마라.

### B2. 0건 상태 간소화

결과가 0건이면 8열 빈 표와 반복 summary를 렌더링하지 마라.

상태별 문구:

- 기본 Needs action: `No stalled bookings need action.`
- Matching now: `No customers are waiting for a Partner match.`
- 검색 결과 없음: `No bookings match “{query}”.`
- 데이터 조회 실패: 기존 `Booking records unavailable` 유지

기본 빈 상태에는 `View Live now`, `View Matching now`, `Return to Shift Command` 중 실제로 유용한 기존 링크만 제공한다. 새 카드 시스템을 만들지 말고 현재 empty-state 컴포넌트나 가장 가까운 기존 패턴을 재사용한다.

### B3. 반복되는 필터 맥락 제거

다음 정보가 같은 사실을 반복하고 있다.

- `Booking workspace filters`
- `Current workspace: Needs action`
- 선택된 queue button
- `View: Needs action`
- `0 bookings` / `Total: 0`
- 결과 section 제목

요구사항:

- 선택된 queue button과 결과 제목만으로 현재 view를 알 수 있게 한다.
- 불필요한 `Booking workspace filters`, `Current workspace`, 중복 View/Total 요약을 제거한다.
- 검색, 기간/나이, SLA, 정렬은 `Search & filters` disclosure에 남긴다.

### B4. Advanced filters 재분류

13개 항목을 한 줄로 평면 나열하지 마라.

- 현재 운영 예외: Matching delays, Preferred pending, Marketplace open, Customer choice, No supply, Handoff repair, Data anomaly, Blocked today
- 과거 결과/기록: Pre-match cancelled, Preferred rejected, Preferred no response, Records

기존 native disclosure 안에서 작은 그룹으로 나누고, 가장 자주 쓰는 현재 운영 항목을 먼저 보여준다. 새 드롭다운 컴포넌트를 만들지 마라.

### B5. 운영자 문구 정리

사용자 노출 용어는 `Partner`로 통일한다. 내부 진단 원문은 기본 목록에서 숨기고 상세 evidence/audit 영역에 유지한다.

| 현재 문구 | 변경 문구 또는 처리 |
|---|---|
| `actor missing closure` | `Closure actor not recorded` |
| `provider closure` | `Partner closure` |
| 긴 terminal 진단 문구 | 목록에서 제거하고 상세 evidence로 이동 |
| `Customer 400.000 VND / min 300.000 VND` | `Customer price 400,000 VND · Minimum 300,000 VND` |
| `Clear` | 의미가 구조 점검이면 `Checks clear`, 후속 작업이 있으면 숨김 |
| `Stop auto-refresh` | compact `Auto-refresh on / Pause` |

`/ min`은 분당 가격처럼 읽히므로 사용하지 마라. Minimum price가 운영 행동에 필요 없으면 목록에서 빼고 상세로 이동한다.

### B6. `Next action`과 상태 신호의 모순 제거

사람의 후속 작업이 필요한 행에 `Clear`를 함께 표시하지 마라.

- 구조 점검만 통과했다면 `Checks clear`로 정확히 표현한다.
- 사람이 해야 할 일이 있으면 그 행동을 우선 표시한다.
- Records에서는 outcome과 follow-up 여부를 우선하고 live-only check signal은 낮추거나 숨긴다.

### B7. Records result tone 수정

Records의 전체 건수는 성공 상태가 아니므로 neutral tone을 사용한다. success tone은 실제로 후속 작업까지 완료된 경우에만 사용한다.

## Phase C — 표 밀도, 반응형, 접근성

### C1. view별 column set

live queue는 운영 판단에 필요한 핵심 열로 줄인다.

1. Priority / state
2. Waiting / idle
3. Customer + service
4. Partner / participation
5. Area
6. Next action

Booking ID는 `Next action` 또는 고객 정보 아래 보조 텍스트로 합친다.

Records는 다음 정보에 맞춘 별도 column set을 사용한다.

1. Outcome
2. Created / closed
3. Customer / Partner
4. Service
5. Follow-up
6. Booking

동일한 row model에서 view별 표시 구성을 분기하고, 불필요한 새 추상화나 테이블 프레임워크를 만들지 마라.

### C2. 1024×768에서 핵심 행동 노출

현재 1024×768에서 본문은 약 701px인데 표 최소 폭은 1,040px이고 약 404px의 가로 이동이 필요하다.

요구사항:

- 1024×768 첫 화면에서 선택된 queue, count, 검색/필터와 결과 시작 부분이 보여야 한다.
- `Next action` 또는 예약 열기 동작을 과도한 가로 스크롤 없이 사용할 수 있어야 한다.
- 가로 스크롤이 남는 경우 핵심 식별 열과 action 열의 sticky 적용을 현재 CSS 범위 안에서 검토한다.
- 고정 너비를 무작정 줄여 텍스트가 읽을 수 없게 만들지 마라.

### C3. 테이블 스크롤 접근성

확인할 코드:

- `apps/admin_web/components/admin-data-table.tsx`
- 관련 `.admin-table-scroll` CSS

요구사항:

- 스크롤 영역에 화면 맥락에 맞는 접근 가능한 이름을 전달할 수 있게 한다.
- 예: `Booking results; scroll horizontally for more columns`
- `.admin-table-scroll:focus-visible`에 기존 accent outline 스타일을 재사용한다.
- Tab 이동, 화살표 가로 스크롤, 200% 확대에서 기본 조작이 가능해야 한다.

## 구현 전 재현 체크

코드를 수정하기 전에 브라우저에서 다음을 확인하고 현재 상태를 간단히 기록해라.

1. `/bookings` 기본 Needs action 상태
2. `Live now` 클릭 후 URL과 실제 선택 view
3. `Matching now` 전환
4. Advanced filters 펼침 상태
5. `/bookings?view=all&dateRange=30d`
6. 1024×768 레이아웃

로그인이 필요하면 기존 로그인된 in-app browser 세션을 우선 사용한다. 인증정보를 코드나 로그에 출력하지 마라.

## 테스트와 검증

최소한 다음 검증을 남겨라.

### 자동 검증

- `readBookingView('active')` 회귀 테스트
- live/historical view별 제목, scope 또는 summary 표시 테스트
- 0건 기본 상태와 검색 0건 상태의 서로 다른 문구 테스트
- Records neutral tone 또는 관련 표시 모델 테스트
- fixture marker 필터를 수정했다면 실제 fixture 제외와 운영 데이터 보존 테스트
- 변경한 패키지의 typecheck/lint와 가장 작은 관련 테스트 suite

프로젝트에 이미 존재하는 테스트 패턴을 사용한다. 새 테스트 프레임워크나 대규모 fixture를 추가하지 마라.

### 브라우저 검증

- `Live now` 클릭, 직접 URL 입력, 새로고침
- 주요 queue count와 selected state
- 0건일 때 빈 표가 렌더링되지 않는지
- Records에서 live-only 문구가 사라졌는지
- 검색과 기존 query parameter 보존
- 1024×768 및 일반 데스크톱 viewport
- 키보드 Tab focus와 table scroll focus 표시
- 변경 전과 변경 후 동일 viewport 스크린샷

## 전체 완료 조건

- `/bookings?view=active`가 모든 진입 방식에서 `Live now`를 유지한다.
- 세 주요 queue의 count를 클릭 전에 볼 수 있다.
- 0건이면 빈 8열 표와 중복 summary가 나오지 않는다.
- Records에서 `Live bookings`, `24h live window`, `Needs action: 0`이 나오지 않는다.
- created time과 last updated time을 문구상 혼동하지 않는다.
- 명시적으로 확인된 fixture는 운영 목록에서 제외되고 실제 운영 데이터는 보존된다.
- 1024×768에서 핵심 다음 행동을 사용할 수 있다.
- table scroll 영역의 키보드 focus가 보이고 접근 가능한 이름이 있다.
- 기본 목록에 내부 진단 문구가 노출되지 않고 `Partner` 용어가 일관된다.
- 새 UI 라이브러리, 새 상태관리, 불필요한 새 route가 없다.
- 관련 자동 테스트와 브라우저 검증이 통과한다.

## 진행 및 최종 보고 형식

작업 중에는 다음 순서로 진행해라.

1. 저장소 지침, 보고서와 현재 코드를 읽는다.
2. 현재 화면에서 주요 결함을 재현한다.
3. 발견한 root cause와 최소 수정 계획을 짧게 공유한다.
4. Phase A를 먼저 구현하고 테스트한다.
5. Phase B와 C를 기존 구조 안에서 구현한다.
6. 동일한 브라우저 상태와 viewport로 최종 검증한다.

최종 답변에는 다음만 명확히 보고해라.

- 수정한 사용자 행동과 운영상 효과
- 핵심 변경 파일
- 실행한 테스트·검증 명령과 결과
- before/after 스크린샷 경로
- 완료하지 못한 항목과 정확한 이유
- 데이터 backfill이나 migration처럼 별도 승인이 필요한 후속 작업

테스트가 실패하거나 live 데이터가 없어 검증하지 못한 상태 조합은 성공했다고 표현하지 마라. 근거 없이 모든 문제가 해결됐다고 선언하지 마라.

## 프롬프트 끝

