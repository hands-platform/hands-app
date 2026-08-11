# Bookings Live Queue 운영자 UX 심층 감사

- 감사 대상: `http://localhost:3101/bookings`
- 감사 일자: 2026-08-05 (Asia/Bangkok)
- 관점: 프로그래머가 아닌 실제 운영자 — 상황 파악, 우선순위 결정, 조치, 인수인계
- 검증 방식: 로그인된 실제 화면, URL 상태, 접근성 DOM, 1024px 화면, 현재 코드와 테스트 대조
- 결론: Live Queue 데이터 자체는 조회되지만, 화면 상태와 정렬·시간 의미가 어긋나 운영자가 잘못 판단할 위험이 있다. 시각 장식보다 먼저 상태 정합성과 시간 신뢰성을 고쳐야 한다.

## 1. 핵심 결론

현재 개선에서 잘된 점은 분명하다.

- `Live now`, `Needs action`, `Matching now`를 상위 큐로 분리해 진입 판단이 이전보다 단순해졌다.
- Live Queue는 실제로 `OPEN_MATCHING`, `IN_SERVICE` 2건을 조회한다.
- `Matching now`는 선택 상태, 제목, 설명, 목록이 서로 일치한다.
- 마스킹된 전화번호, 행 단위 상세 링크, 의미 있는 표 헤더, 서버 페이지네이션을 유지했다.
- 24시간 Live 범위와 30분 Needs Action 기준을 서버 쿼리에서 분리한 방향은 좋다.
- 브라우저 콘솔 오류와 경고는 발견되지 않았다.

그러나 출시 차단 수준의 문제가 2개 있다.

1. `?view=active`에서 데이터는 Live now인데 선택 탭·현재 워크스페이스·목록 제목은 Needs action이다.
2. `Oldest first`를 선택해도 목록이 계속 최신 요청순으로 다시 정렬된다.

이 두 문제는 운영자에게 현재 보고 있는 큐와 처리 순서를 거짓으로 안내한다. 아래 P0를 먼저 해결하지 않고 카드, 색상, 아이콘을 다듬는 것은 권장하지 않는다.

## 2. 화면 증거

| 증거 | 확인한 상태 | 핵심 관찰 |
|---|---|---|
| [01-needs-action-default.png](./01-needs-action-default.png) | 기본 Needs action | 0건이어도 8열 테이블 골격이 크게 남고 빈 문구가 일반적이다. |
| [02-live-now-two-bookings.png](./02-live-now-two-bookings.png) | `?view=active`, Live 2건 | URL·데이터는 Live now지만 선택 탭과 제목은 Needs action이다. |
| [03-matching-now-one-booking.png](./03-matching-now-one-booking.png) | Matching now | 선택 상태와 목록이 정상적으로 일치한다. 비교 기준으로 사용했다. |
| [04-advanced-filters-live-data.png](./04-advanced-filters-live-data.png) | 고급 필터 펼침 | 13개 추가 큐가 목적 구분과 건수 없이 한 줄 집합으로 표시된다. |
| [05-records-today.png](./05-records-today.png) | Records 12건 | 목록은 기록인데 상단은 Live bookings, All open, 24h live, Live updated 상태를 유지한다. |
| [06-live-now-1024x768.png](./06-live-now-1024x768.png) | 1024×768 첫 화면 | 목록은 첫 화면 아래에 있고, 운영자는 큐를 선택한 뒤 실제 행을 보기 위해 스크롤해야 한다. |
| [07-live-rows-1024x768.png](./07-live-rows-1024x768.png) | 1024×768 목록 | 표 내부 폭 1040px, 가시 폭 636px로 404px의 수평 이동이 필요하다. Service, Area, Booking 열이 처음부터 숨는다. |

## 3. 우선순위 요약

| ID | 심각도 | 문제 | 운영 영향 | 예상 난이도 |
|---|---|---|---|---|
| BQ-001 | P0 | Live now의 URL·데이터·선택 상태 불일치 | 운영자가 잘못된 큐라고 판단 | 낮음 |
| BQ-002 | P0 | Oldest first가 실제 행 순서에 적용되지 않음 | 오래 정체된 예약을 뒤로 미룸 | 낮음 |
| BQ-003 | P1 | 상대 시간과 정확 시간이 서로 다른 기준 | 지연 시간을 오판 | 중간 |
| BQ-004 | P1 | `Service started at`처럼 시간 없는 상태 문구 | 핵심 상태 시점을 알 수 없음 | 낮음 |
| BQ-005 | P1 | Records가 Live 화면 문맥과 실시간 연결을 유지 | 기록과 실시간 운영을 혼동 | 중간 |
| BQ-006 | P1 | 계산된 요약 중 Needs action 하나만 표시 | 전체 부하와 병목 파악 불가 | 낮음 |
| BQ-007 | P1 | 8열 고정 표와 1024px 수평 스크롤 | 핵심 조치와 예약 식별자가 화면 밖으로 밀림 | 중간 |
| BQ-008 | P1 | Audit fixture가 보이는데 `Test data excluded` 표시 | 데이터 신뢰성 훼손 | 낮음~중간 |
| BQ-009 | P1 | 빈 큐에도 큰 표와 일반 빈 문구 표시 | 정상 상태인지 필터 오류인지 구분 어려움 | 낮음 |
| BQ-010 | P2 | 큐별 건수를 계산하지만 탭에 표시하지 않음 | 들어가 보기 전 업무량을 모름 | 낮음 |
| BQ-011 | P2 | 추가 큐 13개가 목적별 그룹 없이 평면 배치 | 큐 선택 시간이 길어짐 | 중간 |
| BQ-012 | P2 | Next action이 운영자 명령이 아닌 상황 설명 | 다음 행동이 모호함 | 낮음 |
| BQ-013 | P2 | 패널 색조가 실제 위험이 아닌 view 값으로 결정 | 경고색의 의미가 약해짐 | 낮음 |
| BQ-014 | P2 | 상단 문맥과 결과 수가 여러 번 반복 | 실제 예약 행이 아래로 밀림 | 낮음 |
| BQ-015 | P2 | 키보드 스크롤 영역에 이름과 포커스 표시 없음 | 키보드 사용자가 현재 위치를 잃음 | 낮음 |
| BQ-016 | P2 | 가격의 `/ min`이 최소 금액인지 분당 금액인지 모호 | 금액 의미를 오해 | 낮음 |

## 4. 상세 발견 사항

### BQ-001 · P0 · Live now 상태가 두 개로 갈라진다

재현:

1. `/bookings`에서 `Live now`를 연다.
2. 주소는 `/bookings?view=active`가 된다.
3. 목록 API는 realtime 상태 2건을 반환한다.
4. 하지만 선택 탭은 `Needs action`, 현재 워크스페이스도 `Needs action`, 목록 제목도 `Needs action`이다.

화면에 실제로 나타난 모순:

- URL: `view=active`
- 필터 요약: `View: Needs action`
- 범위: `Scope: Live now`
- 목록: `Needs action · 2 bookings`
- 실제 행: 정상 진행 중인 `OPEN_MATCHING`, `IN_SERVICE`

코드 원인:

- `BookingPageView`에는 `active`가 있지만 `BOOKING_VIEWS` 집합에는 없다: `apps/admin_web/app/bookings/booking-page-params.ts:47-79`
- `readBookingView()`는 인식하지 못한 값을 `attention`으로 돌린다: 같은 파일 `107-123`
- 서버 로드 계획은 원시 `view=active`를 명시적으로 처리하지 않고 마지막 `realtime` 분기로 보낸다: `booking-monitor-route-load-plan.ts:138-154`
- 결과적으로 서버 데이터는 realtime, 클라이언트 초기 view는 attention이 된다.
- 파라미터 테스트에는 `active` 사례가 없다: `booking-page-params.spec.ts:3-19`

수정 방법:

1. 최소 수정으로 `BOOKING_VIEWS`에 `'active'`를 추가한다.
2. 로드 계획에도 `active -> realtime`을 명시해 의도를 드러낸다.
3. `readBookingView('active') === 'active'` 단위 테스트를 추가한다.
4. `?view=active`에서 선택 탭, 현재 워크스페이스, 필터 요약, 목록 제목, API statusGroup이 모두 일치하는 통합 테스트를 추가한다.

완료 기준:

- `?view=active`에서 `Live now`만 선택 상태다.
- `Current workspace: Live now`, `View: Live now`, 목록 제목 `Live now`가 표시된다.
- Needs action 설명과 경고색이 Live now 화면에 나타나지 않는다.
- 새로고침과 직접 URL 진입에서도 동일하다.

### BQ-002 · P0 · Oldest first가 실제 목록을 바꾸지 않는다

실제 검증:

- `/bookings?view=active&sort=oldest`를 직접 열었다.
- 18:31 요청이 첫 행, 17:18 요청이 둘째 행으로 표시됐다.
- 즉, 더 오래된 17:18 예약이 뒤에 남았다.

코드 원인:

- 서버에는 `sort=oldest`가 정상 전달된다: `booking-monitor-route-load-plan.spec.ts:100-108`
- 하지만 화면 모델이 모든 결과를 다시 `compareBookingRequestTimeDescending`으로 정렬한다: `booking-monitor.tsx:291-297`
- comparator도 항상 내림차순이다: 같은 파일 `812-813`
- 현재 테스트는 URL에 `sort=oldest`가 들어가는지만 확인하고 최종 행 순서는 확인하지 않는다.

수정 방법:

- 서버 페이지네이션 결과는 서버 순서를 그대로 보존한다. 불필요한 클라이언트 재정렬을 제거하는 것이 가장 작은 근본 수정이다.
- 서버 페이지네이션이 없는 로컬 목록만 정렬해야 한다면 현재 선택된 `queueSort`를 comparator에 반영한다.
- 큐별 기본값을 명확히 한다.
  - Needs action, Matching delays: Oldest first 또는 SLA 위험 우선
  - Live now: 최근 상태 변경 우선
  - Records: Newest first

완료 기준:

- Oldest first 선택 시 17:18이 18:31보다 먼저 표시된다.
- Newest first는 반대 순서다.
- URL, 선택 표시, API 정렬, 화면 행 순서가 모두 같다.
- 최종 렌더 순서를 검증하는 테스트가 있다.

### BQ-003 · P1 · `Updated 2h ago`와 `18:53`이 동시에 표시된다

IN_SERVICE 행에서 확인한 내용:

- 굵은 문구: `Updated 2h ago`
- 바로 아래 정확 시간: `5 Aug 2026, 18:53`
- 화면 갱신 시각: 약 19:00
- 예약 생성 시각: 17:18

상대 표시는 생성 시각을 사용해 약 2시간으로 계산하고, 정확 표시는 상태 변경 시각을 사용해 약 7분으로 표시한다. 한 셀 안에서 서로 다른 사건을 같은 `Updated` 의미로 보여 준다.

코드 원인:

- `bookingRecencyLabel()`은 `bookingListSortTimestamp()`를 사용하고 문구는 `Updated`라고 한다: `booking-list-time.ts:56-77`
- `bookingListSortTimestamp()`는 createdAt을 우선한다: `admin-booking-time.ts:17-19`
- Age 셀의 정확 시간은 상태 변경 시간 `stateChange.dateLabel`이다: `booking-monitor-list-section.tsx:685-695`
- API Age 필터도 createdAt 기준이다: `apps/api/src/admin/admin-booking-list-query.ts:200-203`

수정 방법:

한 셀에 사건 하나만 표현한다.

- 큐 체류 시간: `Waiting 2h 13m` 또는 `Opened 2h ago` — openedAt/createdAt 기준
- 최근 활동: `Last update 7m ago` — updatedAt 기준
- 상태 변경: `Service started 7m ago · 18:53` — 상태별 event timestamp 기준

권장 열 이름은 포괄적인 `Age`가 아니라 현재 큐의 의미에 맞춘 `Waiting` 또는 `Last activity`다. 상대 시간과 정확 시간은 반드시 같은 timestamp에서 파생한다.

완료 기준:

- 상대 시간과 정확 시간이 동일한 사건을 가리킨다.
- `Updated`라고 쓰면 updatedAt을 사용한다.
- createdAt을 쓰면 `Requested` 또는 `Opened`라고 쓴다.
- 필터의 Age 정의를 화면 도움말에 한 문장으로 표시한다.

### BQ-004 · P1 · 상태 문구가 `at`에서 끝나지만 시간이 없다

화면에는 `Matching opened at`, `Service started at`가 표시되고 뒤에 시간이 없다.

코드 원인:

- 상태 라벨이 모두 `... at`으로 끝난다: `booking-monitor-list-section.tsx:1378-1404`
- Operations 표는 `showDate={false}`를 전달한다: 같은 파일 `668-675`

수정 방법:

둘 중 하나로 일관되게 처리한다.

- 시간 미표시: `Matching opened`, `Service started`
- 시간 표시: `Service started · 18:53`와 필요 시 `7m ago`

운영 화면에는 두 번째가 더 유용하다. 상태 열에서 사건과 시점을 한 번에 읽을 수 있기 때문이다.

### BQ-005 · P1 · Records가 역사 화면이 아닌 Live 화면처럼 보인다

Records 선택 시 확인한 모순:

- 결과: `Booking records · 12 bookings`
- 페이지 제목: `Live bookings`
- 데이터 범위: `All open`
- 설명: `24h live window`
- 상태: `Live · updated`, 일시적으로 `Realtime connecting`
- 상단 요약: `Needs action: 0`

코드 원인:

- `kind === 'all'`이면 view와 무관하게 dataScope를 `all-open`으로 고정한다: `booking-monitor-page.tsx:177-180`
- 같은 route kind는 항상 live summary API를 사용한다: `booking-monitor-route-load-plan.ts:44-50`
- 페이지 제목과 설명은 route config에 `Live bookings`로 고정돼 있다: `booking-monitor-page.tsx:36-49`
- realtime 연결 effect는 view가 Records인지 확인하지 않는다: `booking-monitor.tsx:366-453`
- 목록 카드만 `Booking records`로 바뀐다: `booking-monitor.tsx:753-759`

수정 방법:

- `view=all`일 때 페이지 제목을 `Booking records`로 바꾼다.
- 범위를 `Historical` 또는 `Today records`로 표시하고 현재 date range를 함께 보여 준다.
- Live status/Needs action 요약을 숨기고, 기록 결과 수와 상태 분포 등 기록 문맥의 정보만 보여 준다.
- Records에서는 realtime socket을 연결하지 않는다. 검색·기간 변경에 따른 일반 갱신만 사용한다.
- 별도 페이지를 새로 만들 필요는 없다. 현재 컴포넌트에서 view에 따른 문맥 분기면 충분하다.

완료 기준:

- Records 화면 어디에도 `Live now`, `24h live window`, `All open`, `Realtime connecting`이 나오지 않는다.
- 기간, 총 결과, 현재 정렬이 명확하다.
- Records 진입 시 `/api/admin/realtime-token` 요청이 발생하지 않는다.

### BQ-006 · P1 · 요약 데이터를 만들고도 첫 항목만 표시한다

`summary`에는 Needs action, Live bookings, Matching now, Service in progress, Data anomaly, Blocked today가 있다: `booking-monitor.tsx:208-217`.

하지만 상태 섹션은 `summary[0]` 하나만 렌더링한다: `booking-monitor-live-status-section.tsx:55-60`. 테스트도 두 번째 요약이 보이지 않는 것을 기대한다: `booking-monitor-live-status-section.spec.tsx:19-29`.

운영자는 현재 총 Live 부하, Matching 병목, 서비스 진행 수를 한눈에 볼 수 없다.

수정 방법:

- 상단에 최대 4개의 작고 클릭 가능한 지표만 둔다: `Needs action`, `Live now`, `Matching`, `In service`.
- `Data anomaly`, `Blocked today`는 0보다 클 때만 경고형 보조 지표로 노출한다.
- 숫자 자체가 해당 큐 링크가 되도록 해 요약과 탐색을 합친다.
- 큰 KPI 카드 그리드나 새 라이브러리는 필요 없다. 현재 FilterSummary/SegmentedControl 패턴을 재사용한다.

### BQ-007 · P1 · 8열 고정 표가 핵심 정보를 화면 밖으로 보낸다

1024×768에서 실측:

- 표 scrollWidth: 1040px
- 실제 가시 clientWidth: 636px
- 필요한 수평 이동: 404px
- 처음 보이지 않는 열: Service, Area, Booking
- Status, Customer, Partner 텍스트도 잘린다.

코드 원인:

- 8개 고정 열: `booking-monitor-list-section.tsx:279-288`
- 표 min-width 1040px와 fixed layout: `globals.css:4116-4119`
- 각 열에 100~160px의 최소 폭: `globals.css:4201-4251`

수정 방향:

데스크톱에서도 운영 판단 기준으로 6개 열 이하로 재구성한다.

1. 상태 · 상태 변경 시각
2. 예약 · 고객 — 고객명, 짧은 ID, 연락처
3. 파트너 · 매칭 진행
4. 서비스 · 지역
5. 대기/최근 활동
6. 다음 조치

1024px 이하에서는 행 카드로 전환하거나 보조 정보를 셀 내부 2행으로 묶는다. 수평 스크롤이 남는다면 첫 열과 마지막 `Next action` 열을 sticky 처리하고, 스크롤 가능함을 시각적으로 알려야 한다.

완료 기준:

- 1024px에서 상태, 식별자, 경과 시간, Next action이 첫 화면에 모두 보인다.
- 사람 이름이 한두 글자 수준으로 잘리지 않는다.
- 390px 또는 최소 지원 폭에서 행 단위 읽기 순서가 논리적이다.
- 브라우저 body 전체 수평 overflow가 없다.

### BQ-008 · P1 · `Test data excluded`가 현재 데이터와 모순된다

Live 행에는 `HANDS Audit Customer`, `audit_booking_list...` ID가 보이지만 상단에는 `Test data excluded`라고 표시된다.

코드상 Audit fixture는 의도적인 관리자 QA 데이터다.

- `--admin-visible` 플래그와 `auditFixture: booking-list`: `infra/scripts/booking-list-smoke-seed.mjs:15-38`
- production에서는 admin-visible fixture 실행을 막는다: 같은 파일 `27-28`
- 일반 smoke/seed 필터는 auditFixture를 제외 대상으로 보지 않는다: `admin-booking-list-query.ts:116-163`
- 상단 상태 컴포넌트는 live dataClass면 무조건 `Test data excluded`를 출력한다: `dashboard-trace-summary.tsx:133-140`

수정 방법:

- 운영/production: `Production data · Test data excluded`
- 비운영 환경: `Audit fixtures may be visible` 또는 실제 fixture 존재 시 `Audit fixtures visible`
- audit fixture는 삭제하거나 이름 패턴으로 몰래 숨기지 않는다. 이 데이터의 목적은 관리자 UI 검증이므로 환경과 데이터 성격을 정확히 고지한다.

### BQ-009 · P1 · 빈 큐가 정상 상태를 설명하지 못한다

기본 Needs action 0건 화면에도 8열 헤더와 넓은 빈 표가 남고, 문구는 `No bookings match current filters.`다. 운영자는 “업무가 모두 처리됨”, “필터 때문에 안 보임”, “데이터 로드 실패”를 즉시 구분하기 어렵다.

이미 큐별 좋은 문구가 구현돼 있다: `booking-empty-message.ts:3-88`. 그러나 호출부는 일반 문자열을 하드코딩한다: `booking-monitor.tsx:596-604`.

수정 방법:

- 새 문구 시스템을 만들지 말고 기존 `emptyBookingMessage(view)`를 연결한다.
- 0건이면 표 헤더와 페이지네이션을 숨기고 compact empty state를 표시한다.
- Needs action 예시: `No bookings need action right now. Matching delays, expired requests, and missing chat handoffs are clear.`
- Load failed는 empty와 다른 오류 상태 및 Retry를 유지한다.

### BQ-010 · P2 · 큐 건수가 탭에서 사라진다

`bookingViewCounts`는 Live now, Needs action, Matching now 등을 이미 계산한다: `booking-monitor.tsx:299-334`. 그러나 control option으로 변환할 때 label만 넘긴다: `booking-monitor-filters-section.tsx:306-317`.

수정 방법:

- `Live now 2`, `Needs action 1`, `Matching now 1`처럼 표시한다.
- 0건은 `Needs action 0` 또는 `Needs action · Clear` 중 한 가지 규칙으로 통일한다.
- 추가 API 호출 없이 이미 있는 count map을 사용한다.

### BQ-011 · P2 · 추가 큐의 분류가 운영자의 사고 순서와 맞지 않는다

현재 고급 필터에 다음 13개가 같은 수준으로 표시된다.

`Data anomaly`, `Matching delays`, `Preferred pending`, `Marketplace open`, `Customer choice`, `Pre-match cancelled`, `Preferred rejected`, `Preferred no response`, `Matched now`, `Handoff repair`, `No supply`, `Blocked today`, `Records`

실시간 단계, 예외 처리, 종료 사유, 기록이 혼합돼 있다. `showEmptyViewOptions=true`이므로 0건 큐도 모두 보인다: `booking-monitor-page.tsx:36-49`.

권장 그룹:

- Live flow: Preferred pending, Marketplace open, Customer choice, Matched now
- Exceptions: Matching delays, No supply, Handoff repair, Data anomaly, Blocked today
- History: Pre-match cancelled, Preferred rejected, Preferred no response, Records

각 항목에 count를 표시하고 기본적으로 0건 큐는 `Show empty queues` 뒤로 접는다. 단, Records는 0건이어도 항상 보인다.

### BQ-012 · P2 · Next action이 운영자 행동보다 상황 설명에 가깝다

현재 예:

- `Customer can keep waiting or switch to a marketplace Partner.`
- `Track completion and payment capture.`

첫 문장은 고객 선택지를 설명하지만 운영자가 무엇을 해야 하는지 말하지 않는다. 둘째 문장은 정상 모니터링인지 즉시 조치인지 구분이 어렵다.

권장 문구:

| 상태 | 기본 행동 | 보조 설명 |
|---|---|---|
| OPEN_MATCHING 정상 | `Monitor matching` | `Customer may keep waiting or switch to Marketplace.` |
| OPEN_MATCHING 30분+ | `Review stalled matching` | `Check Partner participation and contact the customer if needed.` |
| IN_SERVICE 정상 | `Monitor service completion` | `No action unless the expected end time is exceeded.` |
| IN_SERVICE 지연 | `Contact Partner` | `Confirm completion, then verify payment capture.` |
| MATCHED chat 없음 | `Repair chat handoff` | `Confirm the selected Partner and create/restore the chat room.` |

`Action`, `Watch`, `Clear`를 작은 상태로 분리하면 정상 모니터링 행과 즉시 조치 행을 빠르게 구분할 수 있다.

### BQ-013 · P2 · 색조가 데이터 위험도가 아니라 view 이름으로 정해진다

필터 패널은 `view === 'all' ? success : warning`으로 고정된다: `booking-monitor-filters-section.tsx:163-173`.

따라서 정상 Live now도 warning, 조치가 필요한 Records 결과도 success가 될 수 있다.

수정 방법:

- 정상 Live now: neutral/info
- Needs action, exception queue에 1건 이상: warning 또는 danger
- 큐가 clear: success
- Records: neutral

색상은 현재 view 이름이 아니라 “조치 필요 여부 + 건수”를 반영해야 한다.

### BQ-014 · P2 · 같은 문맥이 반복돼 목록이 아래로 밀린다

현재 상단에는 페이지 제목, 데이터 상태, Needs action 요약, Booking workspace filters, Current workspace, 결과 수, Primary queues, 필터 요약이 이어진다. 1024×768에서는 실제 행이 y=897 부근부터 시작해 첫 화면에 보이지 않는다.

수정 방법:

- 페이지 제목 + 마지막 갱신 + 자동 갱신 버튼을 한 줄에 둔다.
- 클릭 가능한 핵심 큐/건수를 두 번째 줄에 둔다.
- 검색·Age·Order는 세 번째 compact toolbar로 둔다.
- `Current workspace`, `View`, `Scope`, `Total`의 중복 표시는 한 곳만 남긴다.
- 고급 필터 설명 문단은 disclosure summary 한 줄로 충분하다.

목표는 768px 높이에서 최소 한 행 전체가 보이게 하는 것이다.

### BQ-015 · P2 · 수평 스크롤 영역의 키보드 접근성이 불완전하다

긍정적으로 `.admin-table-scroll`에는 `tabIndex=0`이 있다. 하지만 이름이 없고 role/aria-label을 받을 prop도 없다: `admin-data-table.tsx:14-17, 51-56`. 전역 focus-visible 스타일도 div를 포함하지 않는다: `globals.css:17312-17321`.

수정 방법:

- `AdminTableScroll`에 `ariaLabel` prop을 추가하고 bookings에서 `Live bookings table`처럼 전달한다.
- `role="region"`과 `aria-label`을 적용한다.
- `.admin-table-scroll:focus-visible`에 명확한 outline을 추가한다.
- 스크롤 가능할 때만 `Scroll horizontally to see all columns`라는 시각/스크린리더 힌트를 제공한다.

### BQ-016 · P2 · 가격 `/ min`의 의미가 불명확하다

화면: `Customer 500.000 VND / min 500.000 VND`

코드에서 `min`은 minimumPrice를 뜻한다: `booking-service-list-labels.ts:55-72`. 그러나 운영자는 분당 가격으로 읽을 수 있다.

권장 문구:

- `Customer price 500,000 VND`
- `Minimum 500,000 VND`

두 금액이 같으면 한 줄만 표시하고, 다를 때만 `Minimum`을 보조 줄로 표시한다.

## 5. 권장 화면 구성

새 UI 프레임워크나 별도 디자인 시스템은 필요 없다. 기존 컴포넌트를 재배치하고 의미를 바로잡는 정도가 적절하다.

```text
Live bookings                         Live · updated 19:04   [Pause updates]
Handle exceptions first, then monitor matching and service progress.

[Needs action 1] [Live now 2] [Matching 1] [In service 1]   [More queues]

[Search booking / customer / phone / Partner________________] [Search]
Age: [All 2] [<1h 1] [1–4h 1]      Order: [Newest] [Oldest]

Live now · 2 bookings
┌──────────────┬──────────────────┬────────────────┬──────────────┬────────────────┬──────────────────┐
│ Status/time  │ Booking/customer │ Partner        │ Service/area │ Last activity  │ Next action      │
├──────────────┼──────────────────┼────────────────┼──────────────┼────────────────┼──────────────────┤
│ Matching     │ audit_bo         │ Linh Tran      │ Aroma 90m    │ Opened 33m     │ Monitor matching │
│ Opened 18:31 │ HANDS Audit...   │ 2 participants │ District 1   │ Updated 5m     │ [Open booking]   │
└──────────────┴──────────────────┴────────────────┴──────────────┴────────────────┴──────────────────┘
```

### 운영자 읽기 순서

1. 상단 숫자로 현재 위험과 부하를 확인한다.
2. Needs action이 있으면 먼저 진입한다.
3. 목록에서 상태 시점과 대기/최근 활동을 구분해 본다.
4. `Next action`의 동사형 명령을 실행한다.
5. 상세 화면에서 증거를 확인하고 처리 결과를 남긴다.

## 6. 문구 교체안

| 현재 | 권장 | 이유 |
|---|---|---|
| `Handle stalled bookings first, then monitor live matching and service progress.` | `Resolve bookings that need action, then monitor matching and services in progress.` | stalled 외 예외도 포함하고 동사가 명확하다. |
| `Booking workspace filters` | `Booking queues` | 단순하고 운영 용어에 가깝다. |
| `Current workspace: Needs action - ...` | `Needs action · 1 booking` + 짧은 보조 문구 | 제목·결과 수 중복을 줄인다. |
| `Age` | `Waiting` 또는 `Last activity` | 어떤 시간을 뜻하는지 명확히 한다. |
| `Updated 2h ago` | `Requested 2h ago` 또는 `Updated 7m ago` | timestamp와 문구를 일치시킨다. |
| `Service started at` | `Service started · 18:53` | 불완전 문장을 제거한다. |
| `Customer ... / min ...` | `Customer price ... · Minimum ...` | min의 중의성을 제거한다. |
| `No bookings match current filters.` | 큐별 clear 문구 | 정상/오류/필터 불일치를 구분한다. |
| `Records`의 `Live bookings` | `Booking records` | 현재 작업 문맥을 정확히 나타낸다. |
| 비운영 환경의 `Test data excluded` | `Audit fixtures may be visible` | 실제 데이터 성격을 정직하게 알린다. |

## 7. 구현 순서

### 1차 · 즉시 수정

1. `active` 파라미터 파싱과 상태 정합성 수정
2. Oldest/Newest 최종 행 정렬 수정
3. 상대/정확 시간의 timestamp 통일
4. `... at` 불완전 상태 문구 수정

### 2차 · 운영 신뢰성

5. Records의 제목·범위·요약·realtime 분리
6. Audit fixture 환경 표시 정정
7. 핵심 큐 건수 노출
8. 기존 큐별 empty message 연결

### 3차 · 스캔 효율과 접근성

9. 8열을 6열 이하로 통합하고 1024px 대응
10. 추가 큐를 Live flow / Exceptions / History로 그룹화
11. Next action 문구를 동사형 운영 지시로 변경
12. 스크롤 영역 aria label과 focus-visible 추가
13. 가격과 중복 문구 정리

## 8. Codex 구현 수용 기준

### 상태 정합성

- [ ] `/bookings?view=active`의 URL, 선택 탭, 제목, 설명, 요약, API가 모두 Live now를 가리킨다.
- [ ] 새로고침과 직접 링크 진입에서도 selected state가 유지된다.
- [ ] `Needs action`, `Matching now`, `Records`도 동일 원칙을 만족한다.

### 정렬과 시간

- [ ] `sort=oldest`와 `sort=newest`가 실제 최종 행 순서를 바꾼다.
- [ ] 상대 시간과 정확 시간은 같은 timestamp를 사용한다.
- [ ] `Requested`, `Opened`, `Updated`, `Service started` 용어가 해당 timestamp 의미와 일치한다.
- [ ] Needs action의 기본 순서는 오래된 항목 또는 SLA 위험 우선이다.

### Records

- [ ] Records 제목은 `Booking records`다.
- [ ] 기간과 결과 수를 표시한다.
- [ ] Live 범위와 realtime 상태를 표시하지 않는다.
- [ ] realtime token/socket을 시작하지 않는다.

### 정보 구조

- [ ] 상단에서 Needs action, Live now, Matching, In service 건수를 한눈에 볼 수 있다.
- [ ] 추가 큐가 Live flow / Exceptions / History로 구분된다.
- [ ] 0건 큐는 기본적으로 접히며 Records는 계속 접근 가능하다.
- [ ] 빈 큐는 큐별 clear 문구를 사용하고 빈 표 골격을 표시하지 않는다.

### 반응형·접근성

- [ ] 1440×900과 1024×768에서 핵심 6개 정보가 수평 이동 없이 보이거나, 명확한 카드형 대체가 제공된다.
- [ ] 768px 높이 첫 화면에 최소 한 예약 행이 보인다.
- [ ] 스크롤 영역에 접근 가능한 이름과 visible focus가 있다.
- [ ] 키보드만으로 큐 선택, 필터, 행 상세 진입이 가능하다.
- [ ] 고객 전화 마스킹과 지역 일반화는 유지한다.

### 데이터 환경

- [ ] production에서만 `Test data excluded`를 표시한다.
- [ ] audit fixture가 보이는 환경은 이를 명확히 표시한다.
- [ ] audit fixture를 이름 패턴으로 삭제하거나 숨기지 않는다.

## 9. 최소 테스트 추가 목록

1. `readBookingView('active')`가 `active`를 반환한다.
2. `?view=active` route model이 `initialView=active`, `statusGroup=realtime`을 동시에 만든다.
3. Live now SSR/렌더 테스트에서 선택 탭, workspace label, 목록 title이 모두 Live now다.
4. Oldest/Newest 선택에 따라 최종 렌더 행 ID 순서가 바뀐다.
5. 시간 셀의 상대/정확 표기가 같은 timestamp에서 파생된다.
6. Operations 상태 라벨이 시간 없이 `at`으로 끝나지 않는다.
7. Records에서 historical scope가 표시되고 realtime token fetch가 호출되지 않는다.
8. empty view가 `emptyBookingMessage(view)`를 사용한다.
9. `AdminTableScroll`에 `role=region`, aria-label, focus-visible 스타일이 적용된다.

## 10. 이번 감사의 최종 판단

Live Queue 추가 방향은 맞고 서버 데이터 분류도 대체로 건전하다. 현재 문제는 기능을 더 추가해야 해서가 아니라, 이미 있는 데이터와 상태를 화면에서 서로 다른 기준으로 해석하는 데서 발생한다.

가장 작은 올바른 개선은 다음 네 가지다.

1. `active`를 한 번에 같은 view로 해석한다.
2. 서버 정렬을 클라이언트가 다시 뒤집지 않는다.
3. 한 시간 표시는 한 timestamp만 사용한다.
4. Records에서는 Live 문맥과 realtime을 끈다.

그 뒤에 기존 count, 기존 empty message, 기존 컴포넌트를 재사용해 정보 구조를 정리하면 된다. 새 UI 라이브러리, 새 상태 관리 계층, 별도 디자인 시스템 도입은 필요하지 않다.
