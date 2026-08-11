# Live Bookings 재개선 심층 감사 보고서

- 감사 대상: `http://localhost:3101/bookings`
- 감사 일자: 2026-08-07 (Asia/Bangkok)
- 검증 화면: 1440×900, 1600×900 데스크톱
- 검증 방식: 로그인 상태의 실제 화면, 키보드/접근성 트리, URL 상태, 현재 소스와 API 쿼리, 관련 단위 테스트를 함께 확인
- 현재 데이터 상태: 기본 Live 큐 0건, Last month Records 1,290건

## 1. 결론

현재 구현은 이전 버전보다 분명히 좋아졌다. 기본 URL과 선택 큐가 일치하고, 정렬 방향이 실제 결과와 맞으며, 빈 Live 큐가 거대한 빈 테이블 대신 구체적인 빈 상태를 보여 준다. 자동 새로고침 중지 상태도 명확하고, Records는 전용 제목·설명·기간 필터·6열 테이블을 갖췄다.

그러나 운영자 기준으로는 아직 **조건부 통과**다. 가장 큰 이유는 다음 세 가지다.

1. `Additional queues`가 서로 다른 성격의 **업무 큐, 단계 필터, 예외 필터, 기록 결과**를 한 메뉴에 섞고 있다.
2. `Records`에서 요청 생성 후 경과시간 필터를 그대로 사용해 1,290건 전부가 `24h+`에 몰리며, 기록 검색에 필요한 필터가 아니다.
3. Records 표가 1440에서 가로 스크롤을 요구하고, 1600에서도 Status 내용이 다음 열을 침범한다. 정보 중복과 원문 진단 문구도 많다.

종합 점수는 **72/100**이다. 기능적 기반은 안정됐지만, 운영 정보구조와 기록 표의 가독성은 실제 운영 배포 전에 정리해야 한다.

## 2. 현재 화면 증거

### 2.1 기본 Live 화면 — 개선됐지만 결과가 첫 화면 아래에 있음

![기본 Needs action 1440](C:/dev/massage-on-demand-vn/output/bookings-improvement-verification-2026-08-07/01-needs-action-1440.png)

- 기본 진입 시 `Needs action`이 선택되고 URL·제목·설명이 일치한다.
- `Live now / Needs action / Matching now / In service`의 건수가 바로 보인다.
- 그러나 Booking queues 패널 높이가 약 552px이고 실제 `Needs action` 결과 영역은 약 y=879에서 시작한다. 900px 높이 화면에서 결과가 사실상 보이지 않는다.
- 현재처럼 모든 건수가 0이어도 검색, 5개 요청연령 옵션, 2개 정렬 옵션, Additional queues가 동일한 면적을 사용한다.

### 2.2 빈 Live 결과 — 이전보다 적합

![Needs action 빈 상태 1440](C:/dev/massage-on-demand-vn/output/bookings-improvement-verification-2026-08-07/02-needs-action-empty-1440.png)

- 빈 표를 렌더링하지 않고 `No bookings need action right now...`를 보여 주는 방식은 적합하다.
- 현재 선택 큐에서 어떤 위험이 없다는지 알려 주므로 단순 `No data`보다 운영 판단에 도움이 된다.

### 2.3 Additional queues 펼침 — 점진적 공개는 개선, 내용 구조는 부적합

![빈 Additional queues 펼침 1440](C:/dev/massage-on-demand-vn/output/bookings-improvement-verification-2026-08-07/11-additional-empty-queues-expanded-1440.png)

- 이전의 평면 목록보다 `Live flow / Exceptions / History` 그룹과 2단 disclosure는 좋아졌다.
- 하지만 펼친 뒤 0건인 12개 링크가 같은 크기와 같은 강조도로 나타난다. 운영자가 지금 처리할 일이 없는 상태에서 가장 큰 영역을 차지한다.
- `Records 0`이 History에 먼저 노출되고, 아래 History에 세 개의 종료 사유가 다시 나타난다. History가 두 번 보이는 구조다.
- `Show empty queues`와 `queues currently have no records`는 시스템 상태 설명이지 운영 목적이 아니다.

### 2.4 Records 기간·연령·정렬 — 기간은 적합, 요청연령은 부적합

![Records Last month 필터 1440](C:/dev/massage-on-demand-vn/output/bookings-improvement-verification-2026-08-07/05-records-30d-top-1440.png)

- `Today / Previous day / Last 7 days / Last month / Custom dates`는 기록 검색에 적합하다.
- 반면 `Requested`의 `Under 1h / 1-4h / 4-24h / 24h+`는 booking `createdAt`부터 현재까지의 나이를 계산한다. Last month 기록 1,290건이 전부 `24h+`여서 분류 가치가 없다.
- Records 화면 안에서도 Live 큐 4개와 Additional queues가 그대로 보여서 `Live 운영`과 `기록 조회`가 한 패널 안에 섞인다.

### 2.5 Records 표 — 1440과 1600 모두 수정 필요

![Records 표 1440](C:/dev/massage-on-demand-vn/output/bookings-improvement-verification-2026-08-07/06-records-30d-table-1440.png)

1440에서 표의 최소 너비는 1,120px인데 실제 스크롤 영역은 약 1,052px이다. 따라서 오른쪽 `Next action` 일부가 잘리고 약 68px의 가로 스크롤이 필요하다.

![Records 표 1600](C:/dev/massage-on-demand-vn/output/bookings-improvement-verification-2026-08-07/14-records-table-1600.png)

1600에서는 표 전체 너비가 들어오지만 첫 번째 Status 셀의 실제 내용 너비가 207px, 할당 너비가 약 158px이고 `overflow: visible`이라 Booking 열을 침범한다. 화면 폭 문제가 아니라 셀 정보량과 열 설계 문제다.

### 2.6 검색 빈 결과 — 기능은 작동하지만 문구가 잘못됨

![Records 검색 빈 결과 1440](C:/dev/massage-on-demand-vn/output/bookings-improvement-verification-2026-08-07/08-records-search-empty-1440.png)

- 존재하는 booking ID 검색은 1건으로 정확히 좁혀지고 `Reset filters`도 나타난다.
- 존재하지 않는 값은 0건으로 정확히 처리된다.
- 그러나 결과 문구가 `No booking records are available yet.`이다. 데이터가 없는 것이 아니라 **현재 검색과 필터에 일치하는 결과가 없는 것**이므로 원인과 복구 방법을 잘못 전달한다.

### 2.7 Custom dates — 오류는 보이지만 필드 의미와 접근성 상태가 부족

![Custom dates 오류 상태 1440](C:/dev/massage-on-demand-vn/output/bookings-improvement-verification-2026-08-07/10-records-custom-dates-error-1440.png)

- 빈 값 제출 시 `Choose a valid start date and end date.` 오류는 즉시 보인다.
- 두 입력은 캘린더 아이콘만 있고 화면에 `From / To` 라벨이 없다.
- 오류 후 입력에 `aria-invalid`가 설정되지 않고, 포커스도 첫 오류 필드로 이동하지 않는다.

## 3. 이전 감사 항목 재검증

| 이전 문제 | 현재 상태 | 판정 |
|---|---|---|
| 기본 URL과 선택 view 불일치 | `/bookings`에서 Needs action 선택, `?view=active`에서 Live now 선택 | 해결 |
| Oldest/Newest 실제 정렬 역전 | Newest 첫 행 `4 Aug`, Oldest 첫 행 `19 Jul`로 실제 순서 일치 | 해결 |
| 상대시간과 정확시간 불일치 | 동일 이벤트 기준으로 일치 | 해결 |
| 빈 큐에 큰 빈 테이블 | 큐별 구체적 빈 상태로 교체 | 해결 |
| 큐 건수 없음 | 주요·추가 큐 모두 건수 표시 | 해결 |
| Additional queues 평면 13개 | 그룹화·0건 2단 접기 적용 | 부분 해결 |
| Records가 Live 화면처럼 보임 | 전용 H1·설명·기간·표 적용, 자동 새로고침 숨김 | 부분 해결 |
| 테스트/감사 fixture 신뢰 표시 | Live에는 표시되나 Records에서는 완전히 숨김 | 미해결 |
| `/ min` 가격 문구 | `Minimum`으로 변경 | 부분 해결 — 최소 무엇인지 여전히 모호 |
| Next action이 모호함 | 구체적 문구로 개선 | 부분 해결 — 링크가 실행처럼 보이고 `Clear`와 충돌 |

## 4. P1 — 운영 배포 전에 수정할 항목

### BKV-01. Additional queues는 “큐”가 아니라 서로 겹치는 뷰의 모음이다

현재 이름은 각 숫자를 서로 독립적인 작업량처럼 보이게 한다. 실제 소스에서는 다음과 같이 겹친다.

- `Live now`는 Matching, Matched, Arrival, In service를 포괄한다.
- `Needs action`은 오래 멈춘 Live, 만료된 Matching, chat 없는 Matched를 포괄한다.
- `Matching delays`, `No supply`, `Handoff repair`는 Needs action 또는 Matching now의 하위 조건과 겹친다.
- `Matched now`는 `IN_SERVICE`까지 포함하므로 `In service`와 겹친다.
- `Blocked today`는 booking row가 아니라 booking create 거절 audit log다.

코드 근거:

- 그룹 구성: [booking-monitor-filters-section.tsx](C:/dev/massage-on-demand-vn/apps/admin_web/app/bookings/booking-monitor-filters-section.tsx:391)
- 실제 상태 쿼리: [admin-booking-list-query.ts](C:/dev/massage-on-demand-vn/apps/api/src/admin/admin-booking-list-query.ts:240)
- Needs action 중첩 조건: [admin-booking-list-query.ts](C:/dev/massage-on-demand-vn/apps/api/src/admin/admin-booking-list-query.ts:314)

수정 요건:

1. 상단을 `Work now`와 `Monitor`로 구분한다.
   - Work now: `Needs action`
   - Monitor: `Live now`, `Matching now`, `In service`
2. Additional은 `Exception filters`로 바꾸고 **0보다 큰 항목만** 기본 노출한다.
3. 겹치는 숫자를 유지한다면 `Views can overlap` 안내를 한 줄 표시한다.
4. `Blocked today`는 `Creation failures today` 상태 카드 또는 알림으로 분리한다.
5. `History`는 Live Additional에서 제거하고 Records 안의 결과 필터로 이동한다.

### BKV-02. `Marketplace open`과 `Matching delays`의 쿼리가 문구를 보장하지 않는다

`Marketplace open`의 API 조건은 `status = OPEN_MATCHING`뿐이다. 따라서 “eligible nearby Partners에게 공개된 상태”라는 문구를 보장하지 않고 `Matching now`와 사실상 중복될 수 있다.

`Matching delays`는 `expiresAt <= now OR participants none`이다. 방금 생성되어 아직 참여자가 없는 정상 요청도 즉시 “delay”로 들어갈 수 있다. `No supply`도 같은 무참여 조건을 사용한다.

코드 근거: [admin-booking-list-query.ts](C:/dev/massage-on-demand-vn/apps/api/src/admin/admin-booking-list-query.ts:256), [admin-booking-list-query.ts](C:/dev/massage-on-demand-vn/apps/api/src/admin/admin-booking-list-query.ts:265), [admin-booking-list-query.ts](C:/dev/massage-on-demand-vn/apps/api/src/admin/admin-booking-list-query.ts:307)

수정 요건:

- Marketplace open은 실제 marketplace open event/flag/시간이 존재할 때만 포함한다.
- Matching delays는 `expired` 또는 `no participant + configured wait threshold exceeded`로 정의한다.
- No supply는 초기 정상 대기와 구분한다. 예: `No joins yet`는 상태 필터, SLA 초과 후에만 `Supply intervention` 예외 큐로 승격한다.
- 각 predicate를 한 곳에서 정의하고 summary count와 list query가 같은 predicate를 사용하도록 계약 테스트를 둔다.

### BKV-03. 액션 큐의 기본 정렬이 Newest first다

정렬 버튼 자체는 정확히 동작한다. 문제는 기본값이다. `Needs action`에서 오래 기다린 건보다 새 건이 먼저 보이면 SLA와 고객 대기 위험이 뒤로 밀린다. API도 sort 미지정 시 newest를 호환 기본값으로 사용한다.

수정 요건:

- `Needs action`, `Matching delays`, `Handoff repair`, `No supply`, `Data anomaly` 기본값: Oldest first.
- `Live now`, `Matching now`, `In service`: 현재 목적에 따라 Newest first 또는 예정 종료시간 우선.
- `Records`: Newest first 유지.
- URL에 sort가 없을 때 view별 기본값을 한 함수에서 결정하고, UI 선택 상태와 API order가 같은지 테스트한다.

### BKV-04. Records에서 Requested age 필터가 운영 의미를 잃는다

요청연령 필터는 `createdAt` 기준이다. 소스 테스트도 이를 명시한다. Records 1,290건이 전부 `24h+`인 것이 정상 동작이지만, 기록 조회에는 쓸모가 없다.

코드 근거:

- Records에서도 age UI를 항상 노출: [booking-monitor.tsx](C:/dev/massage-on-demand-vn/apps/admin_web/app/bookings/booking-monitor.tsx:643)
- age를 API에 그대로 전달: [booking-monitor-route-load-plan.ts](C:/dev/massage-on-demand-vn/apps/admin_web/app/bookings/booking-monitor-route-load-plan.ts:114)
- createdAt 기준: [admin-booking-list-query.spec.ts](C:/dev/massage-on-demand-vn/apps/api/src/admin/admin-booking-list-query.spec.ts:55)

수정 요건:

- `view=all`, `pre-match-cancelled`, `preferred-rejected`, `preferred-no-response`에서는 Requested age를 제거한다.
- Records에는 `Outcome`, `Follow-up`, `Closure evidence`, `Payment outcome`처럼 실제 조회 목적에 맞는 필터만 둔다.
- 새 필터가 아직 준비되지 않았다면 기간+검색+정렬만 유지하는 것이 현재 age 필터를 유지하는 것보다 낫다.

### BKV-05. Records 표 열 설계가 정보량을 감당하지 못한다

현재 `Status`에는 상태+초 단위 시각+closure badge+closure detail+reason이 들어가고, `Last activity`가 동일 상태와 시각을 다시 보여 준다. 중복 때문에 Status가 넘치고 표가 넓어진다.

코드 근거:

- 6열 구조: [booking-monitor-list-section.tsx](C:/dev/massage-on-demand-vn/apps/admin_web/app/bookings/booking-monitor-list-section.tsx:298)
- Status에 closure/reason 전체 렌더링: [booking-monitor-list-section.tsx](C:/dev/massage-on-demand-vn/apps/admin_web/app/bookings/booking-monitor-list-section.tsx:1303)
- 1,120px 고정 최소 너비와 열 비율: [globals.css](C:/dev/massage-on-demand-vn/apps/admin_web/app/globals.css:4123), [globals.css](C:/dev/massage-on-demand-vn/apps/admin_web/app/globals.css:4267)

권장 5열:

| 열 | 내용 |
|---|---|
| Booking · Customer | ID, 요청시각, 고객, 연락처 |
| Status · Closed | 상태, 종료시각, closure evidence 한 개 |
| Partner · Service | 최종 Partner, 서비스, 가격 |
| Area · Payment | 서비스 주소/지역, 결제 결과 |
| Follow-up | `Needs follow-up / No follow-up`, 검토 링크, 짧은 이유 |

`Last activity`를 제거하거나 Status와 합치고, 긴 closure 원문은 상세 페이지에서만 보여 준다. CSS로 잘라 숨기는 것만으로 해결하지 않는다.

### BKV-06. Records에서 fixture 여부를 확인할 수 없다

Records는 `BookingMonitorLiveStatusSection` 전체를 렌더링하지 않는다. 그 결과 Live에서 보이던 `Audit fixtures may be visible`도 사라진다. 현재 목록은 `Demo Customer`, `Smoke Partner`, `Api Smoke Fixture Complete`가 반복되는데 데이터 출처 안내가 없다.

코드 근거: [booking-monitor.tsx](C:/dev/massage-on-demand-vn/apps/admin_web/app/bookings/booking-monitor.tsx:368), [booking-monitor.tsx](C:/dev/massage-on-demand-vn/apps/admin_web/app/bookings/booking-monitor.tsx:571)

수정 요건:

- Records 상단에 `Historical · Last month · 1,290 records · Audit fixtures included`처럼 한 줄의 데이터 신뢰 상태를 표시한다.
- 운영 환경에서는 test/audit data를 기본 제외하고, 포함 시 명시적 필터와 배지를 제공한다.
- `may be visible`처럼 불확실한 표현 대신 실제 응답의 dataClass/count를 근거로 단정적으로 표시한다.

### BKV-07. Custom dates 입력은 시각 라벨과 오류 연결이 부족하다

`AdminFormDate`의 기본 labelVisibility가 hidden이고 현재 호출부가 이를 바꾸지 않는다. 또한 shared date picker 경로에서 `ariaDescribedBy`와 `ariaInvalid`가 실제 picker에 전달되지 않는다.

코드 근거:

- 호출부: [booking-monitor-filters-section.tsx](C:/dev/massage-on-demand-vn/apps/admin_web/app/bookings/booking-monitor-filters-section.tsx:245)
- shared control: [admin-form-controls.tsx](C:/dev/massage-on-demand-vn/apps/admin_web/components/admin-form-controls.tsx:317)

수정 요건:

- 두 필드에 화면에 보이는 `From`과 `To` 라벨을 둔다.
- 오류 시 두 필드 또는 해당 필드에 `aria-invalid=true`, 오류 ID를 `aria-describedby`로 연결한다.
- 제출 실패 후 첫 오류 필드에 포커스를 이동한다.
- `Apply dates` 버튼은 필드 오른쪽 한 줄 또는 아래 한 줄 중 하나로 일관되게 배치한다.

## 5. P2 — 다음 개선 묶음

### BKV-08. 결과가 필터 아래로 너무 늦게 나타남

수정 방향:

- 상단 큐 4개와 검색을 첫 줄로 유지한다.
- `Requested age`와 `Order`를 하나의 `Filters` 버튼/팝오버로 합치고, 적용된 값만 chip으로 보여 준다.
- Additional/Queue directory는 결과 뒤 또는 우측 utility 영역으로 이동한다.
- 목표: 1440×900에서 선택 큐의 제목, 건수, 첫 행 또는 빈 상태가 첫 화면에 보이도록 한다.

### BKV-09. 검색 빈 결과 문구가 현재 상태를 설명하지 못함

원인은 `emptyBookingMessage`가 검색 전용 문구를 지원하지만 `/bookings?view=all`에서는 filters 객체를 전달하지 않기 때문이다.

코드 근거: [booking-empty-message.ts](C:/dev/massage-on-demand-vn/apps/admin_web/app/bookings/booking-empty-message.ts:13), [booking-monitor.tsx](C:/dev/massage-on-demand-vn/apps/admin_web/app/bookings/booking-monitor.tsx:696)

수정 문구 예시:

> No records match “NO-SUCH-BOOKING-2026” in Last month. Clear the search or change the period.

결과 패널 안에도 `Clear search`를 둔다. 상단의 Reset filters만 찾도록 강요하지 않는다.

### BKV-10. `Clear`와 실제 Next action이 서로 모순됨

`Clear`는 `No active checks`라는 내부 check signal이다. 그런데 같은 셀 바로 아래에 `Release payment hold`, `Review payment outcome`이 있어 운영자는 “완료인가, 할 일이 있는가”를 동시에 보게 된다.

코드 근거: [booking-check-level.ts](C:/dev/massage-on-demand-vn/apps/admin_web/lib/booking-check-level.ts:26), [booking-monitor-list-section.tsx](C:/dev/massage-on-demand-vn/apps/admin_web/app/bookings/booking-monitor-list-section.tsx:1108)

수정 방향:

- `Clear` → `Checks clear`로 정확히 이름을 바꾼다.
- 더 좋은 방식은 Records에서 check signal을 숨기고 `Needs follow-up / No follow-up`으로 통합하는 것이다.
- Next action이 존재하면 `No follow-up`을 표시하지 않는다.

### BKV-11. 실행처럼 보이는 링크가 실제로는 상세 페이지 이동임

`Release payment hold`는 클릭 즉시 release하는 버튼처럼 보이지만 실제로는 booking detail anchor로 이동한다. 안전한 운영 문구는 `Review payment hold` 또는 `Open payment decision`이다. 실제 실행은 상세 화면의 확인 절차에서만 `Release`로 표시한다.

### BKV-12. 내부 진단 원문이 운영 문구로 노출됨

현재 예:

- `actor missing closure`
- `provider closure`
- `Terminal booking has no explicit closure actor/reason saved yet.`
- `Api Smoke Fixture Complete`

소스는 role을 단순 소문자로 만들고 원문 note를 이어 붙인다: [booking-closure-list-signal.ts](C:/dev/massage-on-demand-vn/apps/admin_web/app/bookings/booking-closure-list-signal.ts:17)

수정 방향:

- `actor missing closure` → `Closure actor missing`
- `provider closure` → `Closed by Partner`
- `Terminal...` → `Closure metadata missing`
- fixture 내부 note는 `Test fixture` badge 뒤 tooltip/상세에서만 표시한다.
- 운영 목록에서는 사람에게 필요한 상태와 다음 행동만 남긴다.

### BKV-13. 같은 의미가 한 셀에서 중복됨

- `No address` + `Address missing` → `Service address missing` 한 개만 유지.
- `Expired · 12:06:56` + `Closed 4 Aug, 12:06` + `Expired 3d ago / 4 Aug, 12:06` → 상태+종료시각 한 번만 유지.
- `Minimum 300.000 VND` → `Partner minimum 300.000 VND` 또는 실제 의미에 맞는 `Partner payout 300.000 VND`.
- `Open a row for full evidence`는 행 전체가 클릭되지 않으므로 `Open the booking ID or follow-up link for full evidence`로 수정하거나 행 전체 클릭을 구현한다.

## 6. Additional queues 항목별 판정

| 현재 항목 | 실제 성격 | 판정 | 권장 위치/수정 |
|---|---|---|---|
| Records | 기록 workspace | 중복 | Live Additional에서 제거, 상단 `Booking records` 모드 링크 |
| Preferred pending | Matching 단계 | 유지 가능 | `Matching stage` 필터, 응답 마감시간 함께 표시 |
| Marketplace open | Matching 단계 | 쿼리 수정 필요 | 실제 marketplace open 조건을 보장한 뒤 단계 필터 |
| Customer choice | Matching 단계 | 적합 | `Waiting for customer choice`로 행동 주체 명확화 |
| Matched now | Live 단계 | 중복 | In service 제외, `Matched / handoff`로 범위 축소 |
| Data anomaly | 예외/수리 큐 | 적합 | 비정상 건이 있을 때만 노출, danger 우선순위 |
| Matching delays | 예외/SLA 큐 | 조건 부정확 | 무참여 즉시 포함 금지, SLA 초과 기준 적용 |
| Handoff repair | 예외/수리 큐 | 적합 | `Chat handoff missing`처럼 증상 중심 문구 |
| No supply | 진단 필터 | 조건부 | 초기 상태는 단계 필터, SLA 초과만 intervention 큐 |
| Blocked today | 생성 거절 audit | 분리 필요 | `Creation failures today` 카드/알림 |
| Pre-match cancelled | 역사 결과 | 이동 | Records의 Outcome 필터 |
| Preferred rejected | 역사 결과 | 이동 | Records의 Outcome 필터 |
| Preferred no response | 역사 결과 | 이동 | Records의 Outcome 필터 |

## 7. 권장 화면 구조

새 라우트를 추가할 필요는 없다. 현재 `?view=all` 동작을 유지하되 화면에서 Live와 Records를 명확히 분리하는 것이 가장 작은 수정이다.

```text
Live bookings                                      [Stop auto-refresh]
[Work now] Needs action 0
[Monitor]  Live now 0 | Matching now 0 | In service 0

[Search booking ID, customer, Partner, address] [Search] [Filters]
Applied: Oldest first

No bookings need action right now...

Additional exceptions
No additional exceptions                     [Browse queue directory]

Utility link: Booking records →
```

`Browse queue directory`를 열었을 때도 0건 링크를 pill 12개로 나열하지 말고, 그룹별 설명과 함께 일반 텍스트 목록으로 제공한다. 이 디렉터리는 장애 조사나 교육용 보조 도구이지, 매 순간 사용하는 운영 큐가 아니다.

Records 모드는 다음처럼 단순화한다.

```text
Booking records
Historical · Last month · 1,290 records · Audit fixtures included

[Search] [Period] [Outcome] [Follow-up] [Newest first]

5-column records table
```

## 8. 버튼·필터 최종 판정

| 컨트롤 | 동작 검증 | 운영 판정 | 조치 |
|---|---|---|---|
| Stop/Start auto-refresh | 정상, pause 상태·socket·last refresh 표시 | 적합 | 유지 |
| Live now | 선택/URL/설명 정상 | 적합한 umbrella view | `Monitor` 그룹으로 명시 |
| Needs action | 기본 선택 정상 | 가장 중요한 work queue | 기본 Oldest first |
| Matching now | 선택/URL 정상 | 단계 모니터 | 유지 |
| In service | 선택/URL 정상 | 단계 모니터 | 유지 |
| Search | 정확 검색/0건 처리 정상 | 적합 | 결과 문구와 결과 내부 Clear 보완 |
| Period presets | 정상 | Records에 적합 | 유지 |
| Custom dates | validation 문구 정상 | 부분 적합 | 보이는 라벨, ARIA, 포커스 보완 |
| Requested age | 기능 정상 | Live에는 유용, Records에는 부적합 | History/Records에서 제거 |
| Oldest/Newest | 실제 정렬 정상 | 기본값만 부적합 | action view별 기본값 적용 |
| Additional queues | 열기/링크/선택 상태 정상 | 정보구조 부적합 | 예외 중심으로 재구성 |
| Show empty queues | 열기/그룹 정상 | 주 운영 화면에는 불필요 | Queue directory로 교체 |
| Records pagination | 20행, 65페이지 정상 | 적합 | 유지 |
| Next action links | 상세 anchor 이동 정상 | 실행처럼 보여 오해 가능 | `Review/Open` 동사 사용 |
| Theme toggle | Light/Dark 정상 | 적합 | 유지 |

## 9. 접근성 검토

좋은 점:

- 검색은 `Search bookings` accessible name이 있다.
- 선택된 기간·연령·정렬·Records는 `aria-current=page`로 식별된다.
- 표 스크롤 영역은 `Booking records booking table` 이름이 있다.
- Additional과 Empty queue는 native disclosure로 키보드 포커스를 받을 수 있다.
- pause 상태는 status 영역으로 전달된다.

수정할 점:

- Custom date 오류를 실제 입력의 `aria-invalid`와 `aria-describedby`에 연결한다.
- 오류 제출 후 첫 필드로 포커스를 이동한다.
- 1440에서 가로 스크롤이 필요하다는 사실이 시각적으로 명확하지 않다. 근본적으로 열을 줄여 제거한다.
- 링크가 실제 명령처럼 읽히지 않도록 이름을 바꾼다.

이번 검토는 접근성 트리와 키보드 상태를 수동 확인한 결과이며, 전체 WCAG 자동 스캔 결과는 아니다.

## 10. 구현 순서와 완료 기준

### 1차 — 운영 오류 방지

1. action queue 기본 정렬을 Oldest first로 변경.
2. Marketplace open / Matching delays / No supply predicate를 실제 의미에 맞게 수정.
3. Records에서 Requested age와 Live Additional을 제거.
4. Records 표 중복 열·Status overflow 해결.
5. fixture 포함 여부를 Records에 표시.

완료 기준:

- Needs action URL에 sort가 없어도 UI와 API가 oldest를 사용한다.
- 새 요청이 참여자 0명이라는 이유만으로 Matching delays에 즉시 들어가지 않는다.
- Marketplace open 건수와 목록이 동일한 marketplace-open predicate를 사용한다.
- 1440과 1600에서 Records 셀 텍스트가 이웃 열을 침범하지 않고 가로 스크롤 없이 핵심 5열이 보인다.

### 2차 — 운영 속도

1. 상단 필터를 한 줄로 압축하고 결과를 첫 화면 안으로 올림.
2. Additional exceptions는 non-zero만 노출.
3. History outcome을 Records 필터로 이동.
4. 검색 빈 상태와 Clear action 보완.

완료 기준:

- 1440×900에서 현재 큐의 첫 행 또는 빈 상태가 보인다.
- 모든 추가 예외가 0일 때 `No additional exceptions` 한 줄만 보인다.
- `Show empty queues`가 기본 운영 흐름에 노출되지 않는다.

### 3차 — 문구·접근성

1. Custom date visible labels, invalid state, focus.
2. 내부 closure 문구를 운영 문구로 변환.
3. `Clear`, 가격 최소값, 주소, 초 단위 시간 중복 정리.
4. navigation link와 실행 action의 동사 구분.

## 11. 검증 결과

- 브라우저: 1440×900 및 1600×900에서 Live, Records, Additional, Search, Custom dates, pause/resume, Light/Dark 확인
- 정렬: Newest와 Oldest의 첫 행 booking/date가 실제로 변경됨
- 검색: 정확 ID 1건, 없는 ID 0건 확인
- Admin Web 단위 테스트: **9 files, 107 tests passed**
- API 쿼리 단위 테스트: **2 files, 21 tests passed**
- Live 데이터가 현재 0건이어서 non-zero Live 행의 시각적 우선순위는 직접 캡처하지 못했다. 대신 해당 큐의 API predicate와 UI 분기 소스를 대조했다.

## 12. 보호한 범위

- 애플리케이션 소스, 데이터베이스, 운영 데이터는 변경하지 않았다.
- 기존의 광범위한 작업 트리 변경은 건드리지 않았다.
- 이번 작업에서 추가한 것은 이 보고서와 현재 실행에서 저장한 증거 스크린샷뿐이다.
