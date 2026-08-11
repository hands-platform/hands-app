# Vietnam Overview 운영자 UX·데이터 신뢰·접근성 감사 보고서

- 감사일: 2026-08-05
- 대상 저장소: `C:\dev\massage-on-demand-vn`
- 대상 화면:
  - `http://localhost:3101/vietnam-overview`
  - `http://localhost:3101/vietnam-overview?range=today&view=period`
  - 지역 집중 상태: `?range=today&view=period&region=hcm`
- 검증 화면 크기: 1280×720, 1024×768, 1440×900
- 감사 방식: 로그인된 실제 관리자 화면 캡처, 필터·지도 점·상세 이동 확인, 화면 코드·Admin API 집계 조건·테스트·CSS 대조
- 소스 수정: 없음

## 1. 최종 결론

`Vietnam Overview`라는 단일 메뉴와 `Live map / Period report` 두 mode를 둔 큰 방향은 맞다. 그러나 현재 화면은 운영자가 숫자를 신뢰하고 공급 부족을 판단하기에는 위험하다.

가장 큰 문제는 시각적 완성도가 아니라 **서로 다른 시간 범위와 표본을 같은 의미의 숫자처럼 보여준다는 점**이다.

- `Today`는 베트남 자정이 아니라 현지 시각 오전 07:00부터 시작한다.
- `Active customers`는 실제 현재 접속자가 아니라 최근 30일 세션이다.
- `Ready Partners`는 최대 7일 전 마지막 세션도 ready로 볼 수 있다.
- `Offline Partners` 안에는 실제로 `ONLINE_BUSY`인 Partner도 포함된다.
- 지도 숫자는 source별 최근 최대 50건 표본인데 `All customers`, coverage gap처럼 전체 사실처럼 보인다.
- 기간 보고서의 Customers/Partners는 all-time, Active/Ready/Active bookings는 current, 완료/취소/금액은 period다.
- 완료·취소 기간 판정도 사건 발생 시각 하나가 아니라 booking의 created/updated/closed 중 하나만 범위에 들어오면 포함된다.
- HCMC 기간 집중 화면은 realtime point API를 요청하지 않으면서 `Realtime map signals`를 렌더링해 전부 0으로 표시한다.
- 1024, 1280, 1440 모두에서 KPI 카드 문구가 글자 단위로 부서져 사실상 읽을 수 없다.

운영자가 이 페이지에서 답을 얻어야 하는 질문은 세 가지면 충분하다.

1. 지금 어느 지역에 active booking이 있는가?
2. 그 지역에 실제로 배정 가능한 Partner가 충분한가?
3. 선택 기간에 완료·취소·결제 결과가 어떻게 발생했는가?

따라서 화면을 없앨 필요는 없지만, 다음처럼 범위를 다시 고정해야 한다.

- `Live operations`: 실제 현재 booking demand와 실제 배정 가능 supply만 보여준다.
- `Period outcomes`: 베트남 운영일 기준으로 발생한 완료·취소·paid volume만 보여준다.
- stored customer/Partner inventory와 표본 위치는 운영 판단 숫자와 분리한다.
- live와 period의 숫자·문구·API predicate를 절대 섞지 않는다.

> 핵심 판단: **화면 구조의 뼈대는 유지할 수 있지만, 현재 숫자의 이름과 시간 기준은 운영 의사결정에 사용하면 안 된다.**

## 2. 운영자 목표와 현재 상태

| 운영 질문 | 현재 답변 상태 | 판단 |
|---|---|---|
| 지금 active booking은 어디에 있는가? | 지도에 3건이 보이지만 60초 자동 갱신은 없다. | 부분 실패 |
| 지금 배정 가능한 Partner는 어디에 있는가? | 7일 freshness와 상태값으로 ready를 판정한다. | 위험 |
| 공급 부족 지역은 어디인가? | source별 50건 표본으로 coverage gap을 계산한다. | 위험 |
| 오늘 완료/취소는 몇 건인가? | 현지 오전 07:00 경계와 created/updated/closed OR 조건을 쓴다. | 실패 |
| 기간별 고객/Partner 수는 몇 명인가? | all-time inventory를 Today 카드로 표시한다. | 실패 |
| 지역별 숫자는 전체인가? | 최신 50/source 표본이며 일부 카드만 이를 밝힌다. | 혼동 |
| API가 실패했는가, 실제 0건인가? | fallback 0으로 합쳐진다. | 실패 |
| 1024px 관리자 화면에서 읽을 수 있는가? | KPI와 집중 요약이 세로 글자처럼 부서진다. | 실패 |
| 지도 점을 눌렀다가 같은 문맥으로 돌아올 수 있는가? | 브라우저 Back은 복원하지만 상세의 Back은 Booking Monitor로 간다. | 미흡 |

## 3. 감사 단계와 화면 상태

### Step 1 — Live map 첫 화면

상태: **보기에는 정돈됐지만 운영 숫자의 의미가 불명확함**

![Live map overview](C:/dev/massage-on-demand-vn/output/vietnam-overview-audit-2026-08-05/01-live-map-overview.png)

확인된 장점:

- 페이지 목적, Live map/Period report 전환, 주요 지표 카드가 명확히 구분된다.
- `Partner` 용어가 사용자 노출 문구에 일관되게 사용된다.
- Active bookings 3, Ready Partners 0의 공급 부족 신호가 빠르게 보인다.
- live mode는 period의 대형 table을 동시에 렌더링하지 않는다.

확인된 문제:

- 페이지 이름은 `Live map`인데 실제 지도는 KPI 4개와 분석 카드 2개 아래, 약 1,000px 아래에 있다.
- `Live demand`, `Realtime focus`, `Map signal sample`은 운영 action보다 dashboard 장식에 가깝다.
- `Ready partners 0`은 긴급 신호지만 연결되는 action이 없다.
- `Map signal sample 53/53`은 source별 제한된 표본이라는 사실과 분모의 의미를 설명하지 않는다.
- `Realtime`이라는 문구와 달리 화면 자체의 자동 refresh 로직은 없다.

### Step 2 — 지도와 signal filter

상태: **시각화는 동작하지만 표본·갱신·상호작용이 운영용으로 부족함**

![Live operating map](C:/dev/massage-on-demand-vn/output/vietnam-overview-audit-2026-08-05/03-live-operating-map.png)

![Map filter result](C:/dev/massage-on-demand-vn/output/vietnam-overview-audit-2026-08-05/05-map-filter-result-10-shown.png)

실제 동작:

- 기본값은 53/53개 점을 모두 켠다.
- 이 중 `7d inactive Partners`가 43개라 지도의 대부분을 차지한다.
- 해당 layer를 끄면 10/53개로 줄어든다.
- filter를 누르는 순간 query URL로 navigation하며 scroll 위치가 0으로 초기화된다.
- 운영자는 지도로 다시 약 1,000px 내려가야 변경 결과를 볼 수 있다.

운영 문제:

- current demand보다 inactive Partner 점이 기본 화면을 지배한다.
- HCMC에 많은 점이 겹쳐 어떤 record인지 구분할 수 없다.
- 점을 누르기 전 이름, age, 상태, 주소 범위, 다음 action을 확인할 popup이 없다.
- `All customers`는 실제 전체 고객이 아니라 최근 조회 표본 중 좌표가 있는 고객이다.
- inactive customer의 saved location과 stale Partner의 마지막 위치를 기본 노출하는 것은 live 운영 목적에 비해 과도하다.

지도 배경은 이번 캡처에서 흰색으로 보였다. console error는 없었으며, 캡처 환경의 WebGL 제약인지 MapTiler tile 응답 문제인지 이번 감사만으로 단정할 수 없다. 다만 코드상 tile error는 점이 1개 이상 있으면 운영자에게 표시되지 않는다.

### Step 3 — 지도 점에서 상세로 이동

상태: **직접 이동은 되지만 판단·복귀 문맥이 부족함**

![Map marker opens booking](C:/dev/massage-on-demand-vn/output/vietnam-overview-audit-2026-08-05/06-map-marker-detail.png)

![Browser back restores map](C:/dev/massage-on-demand-vn/output/vietnam-overview-audit-2026-08-05/07-return-from-booking-marker.png)

확인된 동작:

- active booking 점은 click 즉시 booking 상세로 이동한다.
- 별도 popup이나 confirmation 없이 이동한다.
- 상세 화면의 명시적 back action은 `Back to booking monitor`다.
- 브라우저 Back을 사용하면 기존 signal query와 지도 scroll이 복원됐다.

문제:

- 세 개의 booking marker가 모두 `Active booking service address in HCM`이라는 동일 accessible name을 가진다.
- 운영자는 점을 누르기 전 booking ID, status, age를 알 수 없다.
- 상세 화면의 back action으로는 Vietnam Overview 문맥으로 돌아올 수 없다.
- 코드가 anchor의 자연스러운 navigation 대신 click/pointerup/touchend에서 각각 `window.location.assign`을 등록한다. 입력 방식에 따라 중복 navigation 위험이 있고 Next navigation/return context를 우회한다.

### Step 4 — Period report 첫 화면

상태: **필터 구조는 좋지만 날짜와 metric scope가 잘못됨**

![Period report overview](C:/dev/massage-on-demand-vn/output/vietnam-overview-audit-2026-08-05/08-period-report-overview.png)

화면에서 확인된 가장 중요한 사실:

- `Today` window가 `5 Aug 2026, 07:00 - 6 Aug 2026, 07:00`으로 표시된다.
- 베트남 운영일의 00:00–24:00이 아니라 UTC day를 현지 시각으로 렌더링한 결과다.
- `Work volume 13`은 current active 3 + period completed 1 + period cancellation 9를 합친 혼합값이다.
- `Completion rate 10%`는 완료/(완료+취소)인데, 같은 줄의 work volume에는 current active가 섞인다.

장점:

- Today, Yesterday, 7 days, 30 days, All이 직접 보인다.
- 선택 범위와 집중 지역을 URL에 보존한다.
- national exact aggregate와 regional sample을 구분하려는 설명이 있다.

문제:

- `Exact national period totals`라는 설명과 실제 API 범위가 다르다.
- `Realtime map dots stay current`라고 쓰지만 period mode는 realtime point API를 요청하지 않는다.
- `trend` review를 말하지만 이전 기간 비교나 trend는 없다.
- Window card는 end time을 ellipsis로 잘라 운영자가 전체 경계를 확인하기 어렵다.

### Step 5 — 기간 KPI 카드와 반응형

상태: **1024·1280·1440 모두 실패**

![Period KPI cards at 1280](C:/dev/massage-on-demand-vn/output/vietnam-overview-audit-2026-08-05/09-period-kpi-cards.png)

![Period KPI cards at 1024](C:/dev/massage-on-demand-vn/output/vietnam-overview-audit-2026-08-05/14-period-kpis-1024.png)

![Period KPI cards at 1440](C:/dev/massage-on-demand-vn/output/vietnam-overview-audit-2026-08-05/19-period-kpis-1440.png)

확인된 문제:

- KPI 6개를 무조건 한 줄에 배치한다.
- 각 카드 안의 icon, `Today` badge, label, value, helper가 매우 좁은 영역을 공유한다.
- `overflow-wrap: anywhere` 때문에 `Customers`, `Completed`, `Captured`가 글자 단위로 분리된다.
- 1024에서는 화면 높이가 4,394px까지 늘어나며 핵심 report scan이 불가능하다.
- 1440에서도 Customers/Cancellations/Paid volume이 정상 단어 단위로 읽히지 않는다.
- 모든 카드에 Today를 반복해 section 범위를 여섯 번 말한다.
- `Cancellations 90% of closed work needs review`는 취소 record 수와 미처리 review queue를 같은 의미로 만든다.

코드 원인:

- `.vietnam-overview-metric-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }`
- 단일 열 전환은 viewport `max-width: 980px`에서만 적용된다.
- admin sidebar를 뺀 실제 content width는 더 좁지만 viewport media query는 이를 모른다.
- KPI content에 `overflow-wrap: anywhere`가 적용된다.

### Step 6 — Regional metrics table

상태: **semantic table은 있으나 정보 중복과 열 압축이 심함**

![Regional table at 1280](C:/dev/massage-on-demand-vn/output/vietnam-overview-audit-2026-08-05/10-period-regional-table.png)

![Regional table at 1440](C:/dev/massage-on-demand-vn/output/vietnam-overview-audit-2026-08-05/20-period-table-1440.png)

확인된 문제:

- 1280에서 `Customers`, `Partners`, `Bookings`, `Cancel` header가 잘린다.
- paid volume이 잘리며 region name도 ellipsis로 사라진다.
- table을 scrollable component로 감쌌지만 table 자체가 `table-layout: fixed; min-width: 100%`라 horizontal scroll 대신 10개 열을 강제로 압축한다.
- Region cell 안의 Active/Ready/Bookings chip과 뒤 numeric 열이 같은 숫자를 중복한다.
- `High load 38`은 raw count가 아니라 임의 가중치다.
- 가장 큰 region이면 절대량이 작아도 상대적으로 High가 될 수 있다.
- HCMC 46 Partners/0 ready는 최신 50 provider sample의 지역 분포이며, 국가 exact 1,378/24와 범위가 다르다.

운영자가 필요한 열은 다음 정도면 충분하다.

| Region | Active bookings | Ready Partners | Coverage gap | Completed | Canceled | Paid volume | Open |
|---|---:|---:|---:|---:|---:|---:|---|

Customers/Partners inventory가 꼭 필요하면 secondary detail로 내리고, 같은 수치를 chip과 열에서 반복하지 않는다.

### Step 7 — HCMC 집중 상태

상태: **데이터 모순과 집중 card layout 모두 실패**

![HCMC focus summary](C:/dev/massage-on-demand-vn/output/vietnam-overview-audit-2026-08-05/11-period-hcm-focus.png)

![HCMC focus metric layout](C:/dev/massage-on-demand-vn/output/vietnam-overview-audit-2026-08-05/12-hcm-focus-metric-layout.png)

실제 모순:

- 전체 지역 표의 HCMC row: Active customers 3, Ready 0, Active bookings 3
- HCMC focused summary의 Realtime map signals: 전 항목 0
- 같은 focused summary의 Period totals: Customers 7, Partners 46, Completed 1, Canceled 9

코드 원인:

- period mode는 realtime point endpoint를 호출하지 않는다.
- 그 상태에서 empty realtime feed를 기반으로 `regionRealtimeSummary`를 렌더링한다.
- 테스트도 `period reports without requesting realtime map points`와 focused summary 렌더링을 각각 확인하지만, focused summary 숫자의 의미를 검증하지 않는다.

권장 최소 수정:

- Period report에서 `Realtime map signals` group을 제거한다.
- focused section은 `Report focus: Ho Chi Minh City`와 period outcomes만 보여준다.
- period 화면의 `map focus` 문구도 `report focus`로 교체한다.
- live context가 정말 필요하다는 운영 요구가 확인되면 그때 active region에 한해 realtime feed를 조건부 요청한다.

현재처럼 빈 payload를 0으로 표현하는 방식은 금지한다.

## 4. P0 — 먼저 고쳐야 할 문제

### P0-1. 베트남 운영일 경계 수정

증거:

- 화면의 Today window가 07:00–07:00이다.
- `adminVietnamOverviewRangeWindow`는 `startOfUtcDay`를 사용한다.

영향:

- 현지 00:00–06:59 사건이 전날 report에 들어간다.
- 현지 다음 날 00:00–06:59 사건이 오늘 report에 섞인다.
- Today/Yesterday/7d/30d의 모든 완료·취소·금액 해석이 틀어진다.

수정 기준:

- `Asia/Ho_Chi_Minh` 운영일 00:00을 기준으로 UTC query boundary를 만든다.
- shared timezone/date-range helper가 있으면 재사용한다.
- 화면과 API test는 DST가 없는 UTC+7 기준의 실제 UTC boundary를 검증한다.
- UI에는 `Vietnam time` 또는 기존 admin timezone convention을 명확히 표시한다.

### P0-2. Realtime·active·ready의 실제 의미 수정

현재 코드 기준:

- Active customer window: 30일
- Stale Partner window: 7일
- Ready Partner: `ONLINE_AVAILABLE`이면서 7일 내 app session
- `ONLINE_BUSY` Partner: Offline Partners로 분류
- 화면 자동 refresh: 없음
- 화면 문구: `Realtime`, `Current`, `Refreshes every 60s`

운영 위험:

- 29일 전에 마지막으로 접속한 고객도 active customer로 보일 수 있다.
- 6일 전에 마지막으로 접속한 Partner도 ready supply로 보일 수 있다.
- 현재 서비스 중인 busy Partner가 offline으로 보인다.
- operator는 화면이 자동 갱신된다고 믿지만 실제로는 navigation/reload 전까지 그대로다.

수정 기준:

- customer active는 기존 app presence/session freshness 정책을 재사용한다. 30일을 유지하려면 label을 `Customers seen in last 30 days`로 바꾸고 live demand에서 제거한다.
- Partner ready는 matching에서 사용하는 실제 availability/readiness/fresh location 기준을 재사용한다.
- Busy, Ready, Offline, Stale를 서로 다른 상태로 분류한다.
- 실제 60초 refresh를 구현하거나 `Refreshes every 60s` 문구를 제거하고 manual refresh와 generated age를 제공한다.
- generatedAt가 허용 freshness를 넘으면 `Data may be stale` 상태를 표시한다.

### P0-3. point occurredAt가 항상 now가 되는 문제 수정

API는 customer와 Partner point의 occurredAt 계산에 `latestDate(..., now)`를 넣는다. `now`가 항상 가장 최신이므로 실제 saved-location/session/location timestamp가 사라진다.

영향:

- 오래된 위치도 방금 갱신된 것처럼 보일 수 있다.
- 앞으로 marker popup에 age를 추가해도 잘못된 age가 표시된다.
- stale 분류와 표시 timestamp가 서로 모순될 수 있다.

수정 기준:

- customer point는 selectedLocation.createdAt 또는 실제 session lastSeenAt 중 의미에 맞는 한 시각을 사용한다.
- Partner point는 currentLocationUpdatedAt와 lastSeenAt을 별도 field로 제공한다.
- timestamp가 없으면 null/unknown으로 표현하고 now로 채우지 않는다.
- customer/Partner/booking 종류별 freshness 의미를 response contract에 명시한다.

### P0-4. 표본 숫자로 coverage를 판단하지 않기

현재 realtime endpoint는 customer, Partner, booking을 source별 최대 50건씩 읽는다.

- customer: 최신 profile ID 순 50
- Partner: updatedAt 순 50
- active booking: updatedAt 순 50
- 응답에는 각 source 전체 eligible count, 잘린 여부, sample 기준이 없다.

그런데 UI는 다음처럼 전체 사실처럼 말한다.

- `All customers`
- `Ready partners`
- `3 booking coverage gap`
- `Regional live load`

수정 기준:

- 가장 좋은 방향은 exact count와 map point sample을 분리하는 것이다.
- coverage KPI는 exact/current predicate count만 사용한다.
- map 응답에는 최소한 `limit`, source별 returned count, total eligible count 또는 `truncated`를 제공한다.
- 표본만 가능한 항목은 `Mapped … sample`로 이름을 바꾸고 staffing/coverage 결정에 사용하지 않는다.
- 서로 다른 source cap을 뺀 값으로 coverage gap을 계산하지 않는다.

### P0-5. Period metric scope와 사건 시각 통일

현재 national 카드의 scope:

| Metric | 실제 기준 |
|---|---|
| Customers | all-time customerProfile count |
| Active customers | 현재 기준이 아니라 최근 30일 session |
| Partners | all-time providerProfile count |
| Ready Partners | current status + 7일 session |
| Active bookings | current active statuses |
| Completed | selected range의 booking created/updated/closed OR + completed status |
| Cancellations | selected range의 booking created/updated/closed OR + cancellation status |
| Paid volume | booking created/updated/closed OR가 range에 있는 captured/released payment |

따라서 `Vietnam period report · Today`라는 한 범위로 묶을 수 없다.

수정 기준:

- Live mode에 current inventory/demand를 둔다.
- Period mode에는 selected period의 outcome만 둔다.
- 완료는 실제 completion/closed timestamp를 사용한다.
- 취소는 실제 cancellation/closed/decision timestamp 중 검증된 domain field를 사용한다.
- paid volume은 payment가 captured/released된 실제 timestamp를 사용한다.
- customer/Partner 기간 metric이 필요하면 `New customers`, `New/approved Partners`처럼 created/approved event를 명시한다.
- all-time inventory를 유지하면 `All-time inventory`라는 별도 scope로 분리한다.
- summary, region row, filter count가 같은 predicate와 timezone을 사용한다.

### P0-6. Period focused realtime 0 제거

period mode는 realtime API를 요청하지 않으므로 focused realtime section을 렌더링하지 않는다. 0은 실제 0이 아니라 `not loaded`다.

- 추천: Period에서는 realtime group과 map focus 문구를 제거한다.
- 대안: 운영상 꼭 필요할 때만 active region에 대해 realtime feed를 조건부 load한다.
- 어떤 경우든 unavailable/not loaded를 숫자 0으로 표현하지 않는다.

### P0-7. API 실패와 실제 0건을 분리

현재 summary와 point feed는 `adminGet(..., emptyFallback)`을 사용한다.

영향:

- API permission/network/non-2xx가 모두 0건 화면이 된다.
- operator는 Vietnam에 demand가 없는지, 화면이 고장났는지 알 수 없다.
- map tile error도 points가 있으면 화면에 보이지 않는다.

수정 기준:

- 기존 `adminGetResult` pattern을 사용한다.
- summary unavailable, realtime feed unavailable, tile unavailable를 각각 구분한다.
- live data 실패 시 `Live Vietnam signals could not be loaded. Retry before using this view for coverage decisions.`를 표시한다.
- period summary 실패 시 숫자 카드 대신 report unavailable 상태를 표시한다.
- mapStatus error는 point 수와 관계없이 visible banner와 Retry/diagnostic hint를 제공한다.
- 오류를 0이나 epoch timestamp로 대체하지 않는다.

### P0-8. KPI·집중 summary·table 반응형 수정

수정 기준:

- KPI grid는 viewport 980px이 아니라 실제 content width에 반응한다.
- 새 JS resize observer보다 CSS auto-fit/container query를 우선한다.
- 예: 최소 card width 220–240px의 auto-fit grid.
- 1440은 3×2 또는 충분한 폭일 때만 6열, 1280은 3×2, 1024는 2×3 정도가 적절하다.
- `overflow-wrap: anywhere`를 제거하고 normal word wrapping을 사용한다.
- 각 card의 반복 Today badge를 제거하고 section header에서 범위를 한 번만 말한다.
- HCMC focused summary의 260px heading + 2개 nested grid 고정을 제거한다.
- regional table은 열을 줄이거나 충분한 min-width와 scoped horizontal scroll을 제공한다.
- text를 잘라 맞추지 말고 정보 구조를 줄인다.

## 5. P1 — 운영 속도를 높이는 구조 개선

### P1-1. Live mode를 map-first로 재배치

권장 순서:

1. 페이지 title + generated/freshness + manual refresh
2. critical coverage strip
   - Active bookings
   - Actually ready Partners
   - Coverage gaps
   - Stale/unavailable supply
3. map + layer control rail
4. region action list

현재 KPI 4개 + 분석 카드 2개를 전부 지도 위에 두지 않는다. `Map signal sample`은 제거하고, signal layer count는 legend 안에서 충분히 전달한다.

### P1-2. 경고를 action으로 연결

`Ready Partners 0 / Active bookings 3`이면 다음을 바로 제공한다.

- `Open affected bookings`
- `View Partner availability`
- 가능하면 existing matching escalation route

새 command framework를 만들지 말고 기존 Live Bookings/Partner filter URL을 사용한다.

### P1-3. 기본 map layer를 운영 목적에 맞게 줄이기

권장 기본 ON:

- Active bookings
- genuinely active customers
- actually ready Partners
- operationally unavailable/offline Partners가 coverage 판단에 필요할 때만

기본 OFF 또는 별도 secondary layer:

- 모든 saved customer locations
- 7d inactive Partner locations

inactive/stale 점은 exact coordinate 대신 region aggregate로 충분한지 개인정보 최소화 관점에서 검토한다.

### P1-4. marker cluster와 popup

MapLibre dependency와 `.vietnam-maplibre-popup` CSS가 이미 있으므로 새 library 없이 구현할 수 있다.

marker click 시 먼저 popup에서 다음을 보여준다.

- record type
- 구분 가능한 short ID/name
- current status
- location/session age
- region
- `Open booking/customer/Partner`

겹친 점은 cluster count 또는 region aggregate로 먼저 보여준다. 53개 marker를 모두 keyboard tab stop으로 두지 않는다.

### P1-5. filter 변경 시 scroll 위치 유지

현재 anchor query navigation이 page top으로 이동한다.

- map filter는 client state 또는 existing router navigation의 `scroll: false` pattern을 사용한다.
- URL shareability가 필요하면 query를 replace하되 `#vietnam-operating-map` anchor/scroll context를 보존한다.
- filter change 후 focus가 갑자기 page top으로 이동하지 않게 한다.
- `Reset layers`를 명시적으로 제공한다.

### P1-6. 상세 return context 보존

marker에서 상세로 이동할 때 source route, range, region, signals, map anchor를 보존한다.

- booking 상세의 back action: `Back to Vietnam overview`
- 외부에서 직접 들어온 상세는 기존 booking monitor fallback 유지
- 브라우저 Back뿐 아니라 화면의 명시적 back action도 같은 문맥으로 돌아와야 한다.

### P1-7. Period report는 outcome 중심으로 축소

권장 상단 KPI:

- Completed
- Canceled
- Cancellation share
- Paid volume

current Active bookings/Ready Partners는 Live mode에 둔다. all-time Customers/Partners가 필요하면 `Inventory context` 한 줄로 내리거나 Customer/Partner 전용 overview 링크를 사용한다.

### P1-8. opaque Load score 제거

현재 score:

- active booking × 5
- completed × 2
- cancellation × 2
- active customer × 1

이 가중치는 UI에서 설명되지 않고 `High load`가 상대 순위라 절대 위험을 의미하지 않는다.

추천:

- operator가 직접 해석 가능한 raw `Active bookings / Ready Partners / Gap`을 보여준다.
- SLA나 staffing threshold가 실제 product policy에 존재할 때만 `High`를 사용한다.
- 임의 score를 새로 조정하지 않는다.

### P1-9. regional sample의 역할 축소

정확한 region aggregate를 만들 수 없다면 다음을 지킨다.

- section title: `Regional location sample`
- copy: `Up to 50 recent location-bearing records per source. Not a complete regional total.`
- `Busiest region`, `Ready supply`, `Completion leader` 같은 확정적 판단 label 제거
- exact national KPI와 sample table을 같은 색·강도로 두지 않음
- export/closeout 판단에는 사용하지 않음

## 6. 권장 정보 구조

```text
Vietnam Overview
├─ Live operations
│  ├─ Freshness / manual refresh
│  ├─ Active bookings · Ready Partners · Coverage gaps
│  ├─ Operating map
│  │  ├─ Active booking layer
│  │  ├─ Active customer layer
│  │  ├─ Ready / unavailable Partner layer
│  │  └─ Marker popup → domain detail
│  └─ Regions needing action
└─ Period outcomes
   ├─ Vietnam-time report period
   ├─ Completed · Canceled · Cancellation share · Paid volume
   └─ Regional outcomes table
```

한 mode에서 current inventory, current presence, period outcome, all-time inventory, sampled locations를 동시에 하나의 KPI band로 만들지 않는다.

## 7. 권장 문구

| 현재 문구 | 권장 문구 |
|---|---|
| `Live map` | `Live operations` 또는 map이 첫 화면이면 유지 |
| `Current saved customer locations...` | `Monitor current booking demand and Partner coverage by region.` |
| `Live demand` | `Active bookings` |
| `Ready partners` | 실제 readiness predicate 수정 후 `Ready Partners` |
| `Realtime focus` | `Highest current demand` |
| `Map signal sample` | 제거 또는 `Mapped signals` |
| `All customers` | `Mapped customer locations · sample` |
| `Active customers` | 실제 presence면 유지, 30일이면 `Customers seen in 30 days` |
| `7d inactive Partners` | `Partner session stale over 7 days` |
| `Offline Partners` | busy를 분리한 뒤 `Offline Partners` |
| `Refreshes every 60s` | 실제 refresh 구현 후 유지; 아니면 `Generated {time}` + `Refresh` |
| `Realtime signal mix` | `Map layers` |
| `Regional live load` | `Regional demand and coverage` |
| `Period report` | 유지 |
| `Period metrics range` | `Report period` |
| `Exact national period totals...` | `Review completed, canceled, and paid outcomes for the selected Vietnam-time period.` |
| `Work volume` | current와 period 분리 후 `Closed bookings` 또는 제거 |
| `Completion rate` | `Completed share of closed bookings` |
| `90% of closed work needs review` | `9 of 10 closed bookings were canceled.` |
| `Map focus: HCMC` | Period에서는 `Report focus: HCMC` |
| `Clear HCMC` | `All regions` |
| `Latest 50/source` | `Sample · up to 50 recent records/source` |
| `Focus region` | `View region report` |

## 8. 접근성 위험

스크린샷과 DOM/코드에서 확인 가능한 위험이다. 전체 WCAG 준수 판정을 의미하지 않는다.

1. map marker가 28×28px로 작은 target이다.
2. zoom control도 30×30px다.
3. 기본 화면에 최대 53개 marker가 각각 keyboard focus 대상이 된다.
4. active booking marker 3개가 동일 accessible name을 가진다.
5. marker category는 작은 점의 색상에 크게 의존하며 shape/text가 없다.
6. layer control은 anchor인데 `role=button`과 `aria-pressed`를 사용한다. navigation과 toggle semantics가 섞인다.
7. filter navigation 후 focus/scroll이 page top으로 이동한다.
8. 1024/1280/1440 KPI 문구가 글자 단위로 분리돼 perceivable하지 않다.
9. table header와 paid volume이 시각적으로 잘린다.
10. tile/API error를 보조기기와 화면 모두에 명확히 전달하는 live status가 없다.
11. base map과 marker만으로는 keyboard 사용자가 공간 관계를 이해하기 어렵고 대체 list가 없다.
12. 200% zoom에서는 현재 6열/fixed table 구조가 더 크게 무너질 가능성이 높다.

검증해야 할 항목:

- marker cluster/popup의 keyboard open/close와 focus return
- signal toggle의 Space/Enter 동작
- map을 건너뛸 수 있는 skip path
- 200% zoom
- screen reader에서 중복 marker 이름
- error/freshness update의 `aria-live`
- light/dark theme에서 muted text와 map control contrast

## 9. 유지해야 할 좋은 구현

- 사이드바에 `Vietnam Overview` 한 항목만 둔 점
- Live map/Period report의 URL 기반 mode 분리
- live mode에서 period 대형 table을 load/render하지 않는 방향
- map client bundle을 dynamic boundary 뒤로 미룬 점
- map tile proxy에 Admin session guard와 Vietnam tile bounds가 있는 점
- semantic heading, region, table, time 요소
- shared Admin/Vuexy card, badge, table, money/date component 사용
- `Partner` 사용자 노출 용어
- national aggregate와 regional sample을 구분하려는 기본 의도
- MapTiler/OpenStreetMap attribution
- marker accessible label과 focus outline의 출발점
- 이번 확인 시 page console error가 없었던 상태

단, `period mode에서 realtime point를 요청하지 않는다`는 최적화는 period에서 realtime section을 제거할 때만 좋은 구현이다. 현재처럼 0으로 렌더링하면 데이터 신뢰 문제다.

## 10. 코드 근거와 구현 영향 파일

주요 Admin Web:

- `apps/admin_web/app/vietnam-overview/page.tsx`
  - summary/feed fallback
  - live/period 조건부 loading
  - mixed metric 계산
  - focused realtime 0
  - coverage/load 계산
- `apps/admin_web/app/vietnam-overview/vietnam-overview-live-map.tsx`
  - refresh 부재
  - marker direct navigation
  - error visibility
  - filter navigation
- `apps/admin_web/app/vietnam-overview/vietnam-overview-model.ts`
  - realtime legend label
  - sample endpoint href
  - map point model
- `apps/admin_web/app/globals.css`
  - 6열 grid
  - `overflow-wrap: anywhere`
  - viewport 980 breakpoint
  - focused nested grid
  - fixed 10열 table
  - 28px marker/30px map control
- `apps/admin_web/lib/admin-api.ts`
  - overview/point response types
- 관련 `.spec.ts` / `.spec.tsx`

주요 API:

- `apps/api/src/admin/admin-vietnam-region-overview.ts`
  - UTC day boundary
  - region classification
- `apps/api/src/admin/admin.service.ts`
  - 30일 active customer
  - 7일 Partner freshness
  - sample limit
  - mixed exact totals
  - booking period predicate
  - point occurredAt
- `apps/api/src/admin/admin-analytics.routes.ts`
- 관련 service/route/helper tests

Map tile 상태를 보강할 때:

- `apps/admin_web/app/api/admin/maptiler-tiles/[z]/[x]/[y]/route.ts`

새 DB schema는 이번 개선에 우선 필요하지 않다. timezone boundary, 기존 presence/readiness policy, response metadata, CSS/layout, 화면 조건을 바로잡는 것이 먼저다.

## 11. 권장 구현 순서

### Phase 1 — 숫자를 믿을 수 있게 만들기

1. Vietnam local-day boundary 수정
2. current/period/all-time scope 분리
3. 완료·취소·paid volume 사건 시각 predicate 수정
4. active customer/ready/busy/offline 의미 수정
5. occurredAt에서 now fallback 제거
6. sample count로 coverage 계산하는 동작 제거
7. API failure와 0건 분리

### Phase 2 — 화면 구조 축소

1. Live를 map-first로 재배치
2. coverage gap에 domain action 연결
3. Period focused realtime 0 section 제거
4. Period KPI를 outcome 중심으로 축소
5. opaque load score와 중복 region signal chip 제거
6. regional sample의 표현 강도 낮추기

### Phase 3 — 상호작용과 반응형

1. signal toggle scroll 유지
2. marker popup/cluster와 return context
3. KPI auto-fit/container responsiveness
4. focused summary 단순화
5. table 열 축소 또는 정확한 horizontal scroll
6. 1024/1280/1440, keyboard, 200% zoom 검증

## 12. 완료 조건

- Today/Yesterday가 Vietnam local midnight 기준이다.
- current, all-time inventory, period outcomes가 같은 KPI band에 섞이지 않는다.
- Active customer가 실제 predicate와 같은 이름을 사용한다.
- Ready/Busy/Offline/Stale Partner가 잘못 합쳐지지 않는다.
- 화면이 실제로 60초 갱신되거나 해당 문구가 제거된다.
- customer/Partner point occurredAt가 실제 시각이며 unknown을 now로 채우지 않는다.
- sample count로 exact coverage gap을 주장하지 않는다.
- API 실패가 0건으로 보이지 않는다.
- HCMC focused period 화면에 가짜 realtime 0이 없다.
- period 완료·취소·paid volume이 각각 검증된 사건 시각을 사용한다.
- 지도는 첫 운영 viewport에서 접근 가능하다.
- filter 변경 후 지도 scroll/focus가 유지된다.
- marker를 누르기 전에 record와 age를 구분할 수 있다.
- 상세의 명시적 back action이 Vietnam Overview 문맥을 복원한다.
- default map이 inactive saved locations로 압도되지 않는다.
- 1024×768, 1280×720, 1440×900에서 KPI 단어가 글자 단위로 깨지지 않는다.
- HCMC focused summary가 잘리지 않는다.
- regional table header·paid volume이 잘리지 않거나 명확한 horizontal scroll이 있다.
- 200% zoom과 keyboard로 핵심 flow를 수행할 수 있다.
- 새 UI library와 DB migration이 없다.
- 관련 Admin Web/API tests가 실제 데이터 의미와 layout 회귀를 검증한다.

## 13. 증거 한계

- 운영/공유 데이터에 영향을 주지 않기 위해 booking, Partner, customer record를 생성·수정하지 않았다.
- 지도 base tile은 캡처에서 흰색으로 보였지만 console error는 없었다. WebGL screenshot 한계와 MapTiler 응답 문제를 구분하지 못했으므로 실제 일반 브라우저에서 추가 확인이 필요하다.
- direct tile URL은 브라우저 client 정책에 의해 차단되어 tile HTTP status를 별도로 확인하지 못했다.
- API error/empty 상태를 강제로 만들지 않았다. 코드의 fallback 경로를 기준으로 위험을 판단했다.
- screen reader와 실제 200% zoom은 수행하지 않았다.
- 현재 데이터는 HCMC에 집중되어 있어 여러 지역에 live point가 있는 상태의 지도 clustering은 확인하지 못했다.
- 캡처의 숫자는 2026-08-05 당시 local data snapshot이며 production 전체 현황을 의미하지 않는다.

