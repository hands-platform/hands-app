# Codex 실행 프롬프트 — Vietnam Overview 운영 화면 개선

- 작성일: 2026-08-05
- 작업 저장소: C:\dev\massage-on-demand-vn
- 대상 화면: http://localhost:3101/vietnam-overview
- 근거 보고서: output/vietnam-overview-audit-2026-08-05/vietnam-overview-operator-audit.md
- 목적: 감사 결과를 실제 코드 수정, 테스트, 로그인된 브라우저 검증까지 이어지는 하나의 실행 명세로 제공

## 사용 방법

아래 MASTER PROMPT 전체를 새 Codex 작업에 그대로 붙여 넣는다.

이 문서는 추가 분석이나 디자인 제안만 받기 위한 프롬프트가 아니다. Codex는 저장소와 기존 사용자 변경을 먼저 확인한 뒤 실제 구현, 관련 테스트, 관리자 화면 검증, 최종 결과 보고까지 완료해야 한다.

---

# MASTER PROMPT

작업 위치는 C:\dev\massage-on-demand-vn 이다.

관리자 화면 http://localhost:3101/vietnam-overview 를 실제 베트남 운영자가 신뢰하고 사용할 수 있는 Vietnam operations workspace로 개선하라.

이번 작업은 단순한 UI 미화가 아니다. 화면에 표시되는 숫자의 시간 기준과 데이터 범위를 먼저 정확하게 만들고, 그다음 운영자가 아래 세 질문에 빠르게 답할 수 있도록 정보 구조를 정리하는 구현 작업이다.

1. 지금 어느 지역에 active booking이 있는가?
2. 해당 지역에 실제로 배정 가능한 Partner가 충분한가?
3. 선택 기간에 완료, 취소, 결제 결과가 어떻게 발생했는가?

계획이나 보고서만 제출하고 멈추지 말라. 코드 수정, 회귀 테스트, 로그인된 로컬 브라우저 검증, 검증 캡처 저장까지 같은 작업에서 완료하라.

## 1. 반드시 먼저 읽고 추적할 자료

다음 순서로 읽는다.

1. 저장소 루트 AGENTS.md
2. output/vietnam-overview-audit-2026-08-05/vietnam-overview-operator-audit.md
3. 같은 감사 폴더의 핵심 화면:
   - 01-live-map-overview.png
   - 03-live-operating-map.png
   - 05-map-filter-result-10-shown.png
   - 06-map-marker-detail.png
   - 07-return-from-booking-marker.png
   - 08-period-report-overview.png
   - 09-period-kpi-cards.png
   - 10-period-regional-table.png
   - 11-period-hcm-focus.png
   - 12-hcm-focus-metric-layout.png
   - 14-period-kpis-1024.png
   - 19-period-kpis-1440.png
   - 20-period-table-1440.png
4. Vietnam Overview의 Admin Web, API, 테스트, CSS

작업 시작 시 반드시 git status --short를 실행한다. 저장소에 이미 존재하는 사용자 변경과 untracked 파일을 보존하고, 이번 작업과 관계없는 수정은 되돌리거나 정리하지 않는다.

수정하려는 함수, type, component, CSS selector의 모든 caller와 사용처를 rg로 먼저 찾는다. 화면 한 곳에 조건을 덧대는 방식보다 summary와 row, API와 UI가 함께 사용하는 실제 공통 원인을 최소 범위에서 고친다.

우선 확인할 파일은 다음과 같다. 목록에 있다는 이유로 전부 수정하지 말고 실제 import와 caller를 확인한 뒤 필요한 최소 파일만 변경한다.

Admin Web:

- apps/admin_web/app/vietnam-overview/page.tsx
- apps/admin_web/app/vietnam-overview/vietnam-overview-live-map.tsx
- apps/admin_web/app/vietnam-overview/vietnam-overview-model.ts
- apps/admin_web/app/vietnam-overview/page.spec.tsx
- apps/admin_web/app/vietnam-overview/vietnam-overview-live-map.spec.tsx
- apps/admin_web/app/vietnam-overview/vietnam-overview-model.spec.ts
- apps/admin_web/app/vietnam-overview/vietnam-overview-map-tooltip-css.spec.tsx
- apps/admin_web/app/globals.css
- apps/admin_web/lib/admin-api.ts
- 기존 날짜, 금액, action notice, table, card, badge component와 helper

API:

- apps/api/src/admin/admin-vietnam-region-overview.ts
- apps/api/src/admin/admin-vietnam-region-overview.spec.ts
- apps/api/src/admin/admin.service.ts
- apps/api/src/admin/admin.service.spec.ts
- apps/api/src/admin/admin-analytics.routes.ts
- 실제 Partner availability/readiness를 정의하는 기존 provider 또는 matching helper
- 관련 route/controller 테스트

Map tile 상태가 관련될 때만 확인:

- apps/admin_web/app/api/admin/maptiler-tiles/[z]/[x]/[y]/route.ts

## 2. 고정 제품 결정

아래 결정은 구현 중 임의로 다른 구조로 확장하지 않는다.

1. 사이드바에는 Vietnam Overview 한 항목만 유지한다.
2. 기존 route /vietnam-overview를 유지한다.
3. 한 페이지 안의 URL 기반 두 mode를 유지한다.
   - Live operations
   - Period outcomes
4. 기존 view, range, region, signals query와 bookmark는 가능한 한 계속 동작하게 한다.
5. Live와 Period를 별도 사이드바 페이지나 별도 제품으로 나누지 않는다.
6. Live는 현재 demand, 실제 배정 가능 supply, coverage 문제만 다룬다.
7. Period는 선택한 베트남 운영 기간의 completed, canceled, cancellation share, paid volume만 중심에 둔다.
8. current inventory, all-time inventory, selected-period outcomes, sampled locations를 하나의 KPI band에 섞지 않는다.
9. 사용자 노출 문구는 기존 관리자 웹 기준에 맞춰 영어로 작성한다.
10. 사용자 노출 문구에서 Provider가 아니라 Partner를 사용한다.
11. 새 UI, chart, map, date, state-management library를 추가하지 않는다.
12. 새 DB table, column, schema, migration을 추가하지 않는다.
13. 기존 Admin/Vuexy component, token, formatter, MapLibre bundle, adminGetResult pattern을 우선 재사용한다.
14. Customer app과 Partner app은 수정하지 않는다.
15. matching, payment, settlement의 mutation 정책은 변경하지 않는다.
16. 기존 Admin 권한과 map tile proxy의 보안 경계를 약화하지 않는다.
17. 임의의 종합 Load score는 조정해서 살리지 말고 제거한다.
18. 표본 위치 데이터로 exact coverage gap이나 지역 전체 규모를 주장하지 않는다.

## 3. 목표 정보 구조

상위 구조는 다음보다 복잡하게 만들지 않는다.

Vietnam Overview
├─ Live operations
│  ├─ Freshness and manual refresh
│  ├─ Active bookings
│  ├─ Actually ready Partners
│  ├─ Coverage gaps
│  ├─ Operating map and map layers
│  └─ Regions needing action
└─ Period outcomes
   ├─ Vietnam-time report period
   ├─ Completed
   ├─ Canceled
   ├─ Cancellation share
   ├─ Paid volume
   └─ Regional outcomes

Live mode의 첫 운영 viewport에서 지도 또는 최소한 지도의 상단이 보여야 한다. KPI 카드와 설명용 장식 카드를 여러 줄 쌓아 지도를 약 1,000px 아래로 밀지 않는다.

Period mode에서는 실시간 point feed를 요청하지 않는 현재 최적화 방향을 유지할 수 있다. 대신 로드하지 않은 실시간 값을 0으로 렌더링하지 않는다.

## 4. P0 — 데이터 의미와 신뢰성을 먼저 수정

### 4.1 Vietnam local-day boundary

현재 Today와 Yesterday가 UTC day를 기준으로 계산되어 베트남 화면에서 07:00부터 다음 날 07:00으로 표시되는 문제를 수정한다.

필수 조건:

- 운영 timezone은 Asia/Ho_Chi_Minh이다.
- Today는 현지 00:00 이상, 다음 현지 00:00 미만이다.
- Yesterday도 동일한 현지 자정 규칙을 사용한다.
- 7 days와 30 days의 시작과 종료 의미를 UI 문구와 테스트에서 명확히 한다.
- All은 무제한 기간이라는 사실을 유지한다.
- summary, regional rows, focused region, filter count가 같은 range boundary를 사용한다.
- 화면의 Window 문구가 실제 API 범위와 일치한다.
- timezone 계산을 page component에 복제하지 말고 기존 helper 또는 admin-vietnam-region-overview의 공통 range 계산을 사용한다.

테스트에는 최소한 다음을 포함한다.

- 베트남 자정 직전과 직후
- UTC 날짜와 베트남 날짜가 다른 시각
- Today와 Yesterday 경계
- end-exclusive 동작

### 4.2 current, period, all-time scope 분리

다음 값들을 같은 Today KPI로 렌더링하지 않는다.

- all-time customer inventory
- all-time Partner inventory
- 최근 세션 기반 customer count
- 현재 Partner availability
- 현재 active bookings
- 선택 기간 completed/canceled/paid outcomes

Live mode:

- Active bookings
- 실제로 배정 가능한 Ready Partners
- 검증 가능한 경우 coverage gap
- freshness 또는 unavailable 상태

Period mode:

- Completed
- Canceled
- Cancellation share
- Paid volume

Customer/Partner inventory가 운영 문맥에 꼭 필요하면 Period KPI가 아니라 별도 neutral한 Inventory context 한 줄로 표시하고 All-time임을 명시한다. 필요성이 없다면 화면에서 제거한다.

기존 Work volume은 current active와 period closed outcomes를 합산하므로 제거한다. Completion rate는 의미를 정확히 드러내는 Completed share of closed bookings로 바꾸거나, completed/(completed+canceled) 조건이 확실할 때만 표시한다.

### 4.3 booking outcome을 실제 사건 시각으로 집계

현재 createdAt, updatedAt, closedAt 중 하나라도 기간에 들어오면 포함되는 OR predicate를 사용하지 않는다.

각 metric은 검증된 사건 시각 하나를 사용한다.

- Completed: 실제 completion 또는 verified closed timestamp
- Canceled: 실제 cancellation 또는 verified cancellation decision timestamp
- Paid volume: payment가 captured 또는 released된 실제 payment timestamp

구현 전에 현재 schema와 service flow에서 각 상태가 언제 기록되는지 모든 writer/caller를 추적한다. 존재하지 않는 timestamp를 추측해서 새 의미를 만들지 않는다.

권위 있는 사건 시각이 현재 데이터에 없을 경우:

- booking updatedAt를 조용히 대체값으로 사용하지 않는다.
- UI에서 해당 metric을 unavailable로 처리한다.
- 최종 보고에 정확히 어떤 필드가 부족했는지 기록한다.
- DB migration을 임의로 추가하지 않는다.

summary count, region row, paid total이 동일한 사건 predicate와 range helper를 사용하도록 한다.

### 4.4 Active customer 문구와 실제 predicate 일치

최근 30일 session을 Realtime 또는 Active customers라고 부르지 않는다.

우선순위:

1. 코드베이스에 신뢰할 수 있는 현재 presence predicate가 이미 있으면 재사용한다.
2. 없다면 현재 30일 predicate를 유지하되 Customers seen in 30 days처럼 실제 의미로 이름을 바꾼다.
3. 운영 판단에 필요하지 않다면 live KPI에서 제거하고 secondary map layer로 내린다.

새 presence framework, heartbeat table, socket tracking을 이번 작업에서 만들지 않는다.

### 4.5 Ready, Busy, Offline, Stale Partner 의미 수정

7일 전 세션을 Ready Partner로 간주하거나 ONLINE_BUSY를 Offline에 합치지 않는다.

먼저 기존 booking matching 또는 provider availability 코드가 실제로 bookable Partner를 판정하는 authoritative predicate를 찾고 재사용한다. 별도의 Vietnam-only readiness 규칙을 복제하지 않는다.

화면에서 최소한 다음 의미가 서로 섞이지 않아야 한다.

- Ready: 현재 배정 가능한 상태
- Busy: 현재 다른 작업 때문에 배정 불가
- Offline: 오프라인
- Stale/Unknown: freshness 기준을 넘었거나 상태를 신뢰할 수 없음

실제 predicate에 필요한 데이터가 없으면 Ready라고 낙관적으로 표시하지 않는다. Unknown 또는 unavailable로 표시한다.

### 4.6 point occurredAt의 now 오염 제거

customer와 Partner point의 occurredAt 후보에 현재 now를 넣어 오래된 좌표가 방금 갱신된 것처럼 보이게 하지 않는다.

- 실제 저장 위치 시각, session 시각, booking address 시각 중 해당 source의 권위 있는 실제 timestamp만 사용한다.
- 실제 시각이 없으면 null/unknown을 반환하거나 age 표시를 생략한다.
- unknown을 current time, epoch, 0으로 대체하지 않는다.
- map popup과 legend의 freshness 문구도 같은 occurredAt을 사용한다.

### 4.7 표본과 전체 수치 분리

현재 source별 최대 50개 point를 전체 데이터처럼 표시하지 않는다.

point feed 응답에 기존 query로 안전하게 제공 가능한 최소 metadata를 추가한다.

- generatedAt
- source별 returned count
- source별 total 또는 total을 계산할 수 없으면 명시적인 totalUnavailable
- truncated 여부
- 적용된 freshness/predicate 설명에 필요한 최소 machine-readable scope

새 analytics framework를 만들지 않는다. 이미 실행하는 query의 count 또는 최소 추가 count query로 해결하고 기존 Admin read budget을 확인한다.

UI 규칙:

- 53/53처럼 의미가 불명확한 분수를 제거한다.
- 표본이면 Sample · up to 50 recent records/source라고 명시한다.
- exact national aggregate와 regional sample을 동일한 강도로 배치하지 않는다.
- 표본으로 Coverage gap, Busiest region, Completion leader 같은 확정적 결론을 만들지 않는다.
- 정확한 coverage를 만들 수 없으면 Active bookings와 Ready Partners를 각각 보여주고 gap은 unavailable로 표시한다.

### 4.8 API error, empty, partial, stale 상태 분리

adminGet(..., emptyFallback) 때문에 API 실패가 0건으로 보이지 않게 한다. 기존 adminGetResult 또는 저장소의 동등한 result pattern을 재사용한다.

구분할 상태:

- loading
- true empty
- filtered empty
- summary unavailable
- realtime feed unavailable
- map tiles unavailable
- partial/truncated sample
- stale data

필수 동작:

- summary 실패 시 0 KPI를 렌더링하지 않는다.
- live feed 실패 시 coverage 판단에 사용하지 말라는 오류를 표시한다.
- tile error는 point가 1개 이상 있어도 visible 상태로 표시한다.
- Retry 또는 기존 route refresh action을 제공한다.
- 마지막 성공 갱신 시각을 표시한다.
- error/freshness 변화는 기존 accessible live-status pattern을 사용한다.

권장 문구:

- Live error: Live Vietnam signals could not be loaded. Retry before using this view for coverage decisions.
- Period error: Period outcomes could not be loaded. Retry before using this report.
- Partial sample: Showing {returned} of {total} mapped signals.
- Unknown total: Showing up to {returned} recent mapped signals. This is not a complete regional total.

### 4.9 실제 refresh 또는 정직한 문구

현재 실제 자동 refresh가 없는데 Refreshes every 60s라고 표시하지 않는다.

가장 작은 안전한 구현을 선택한다.

- 우선 권장: Generated {time}와 수동 Refresh를 제공한다.
- 60초 자동 refresh를 구현한다면 실제로 data를 갱신하고 tab hidden 상태, 중복 요청, loading/error, focus 보존을 검증한다.

이번 작업에서 새 polling abstraction을 만들지 않는다. 자동 refresh가 운영상 필수라는 기존 정책이 없으면 수동 refresh가 기본이다.

### 4.10 Period focus의 가짜 realtime 0 제거

Period mode에서 realtime feed를 요청하지 않는다면 다음을 제거한다.

- Realtime map signals
- All customers 0
- Active customers 0
- Ready Partners 0
- Offline Partners 0
- Active bookings 0
- Map focus 문구

지역 집중 화면은 Report focus: HCMC처럼 기간 outcome 상세로만 구성한다. 지역별 completed, canceled, cancellation share, paid volume과 선택 기간을 보여준다.

not loaded 또는 unavailable을 숫자 0으로 표현하지 않는다.

## 5. P1 — 운영 화면 구조와 상호작용

### 5.1 Live를 map-first로 재배치

권장 순서:

1. Title, 현재 generated/freshness, Refresh
2. compact coverage strip
   - Active bookings
   - Ready Partners
   - Coverage gaps 또는 Coverage unavailable
3. Operating map와 layer control
4. Regions needing action

다음 장식성 또는 중복 요소는 제거하거나 legend 안으로 합친다.

- Live demand 분석 카드
- Realtime focus 분석 카드
- 별도 Map signal sample 카드
- 지표를 반복하는 설명

첫 운영 viewport에서 현재 demand와 map 진입점이 보여야 한다.

### 5.2 coverage 경고를 기존 작업 화면으로 연결

Active bookings가 있고 Ready Partners가 부족한 경우 기존 route를 사용해 바로 행동할 수 있게 한다.

- Open affected bookings
- View Partner availability
- 기존 matching escalation route가 있으면 해당 route

새 command framework나 새 queue를 만들지 않는다. 기존 booking/Partner filter와 deep link를 재사용한다.

### 5.3 map 기본 layer 최소화

기본 ON:

- Active bookings
- 실제 active predicate가 있는 경우 active customers
- 실제 Ready Partners

기본 OFF 또는 secondary:

- all saved customer locations
- stale/inactive Partner locations
- 운영 판단에 직접 필요하지 않은 inventory point

오래된 정확한 좌표를 기본 노출하지 않는다. region aggregate로 충분한지 개인정보 최소화 관점에서 검토한다. 기존 masking과 Admin 권한을 약화하지 않는다.

### 5.4 filter 변경 시 scroll, focus, URL 유지

layer filter 변경이 URL query를 갱신하더라도 page top으로 이동하지 않게 한다.

- 기존 Next router/link pattern 중 scroll false 또는 동일한 최소 패턴을 사용한다.
- share 가능한 query를 유지한다.
- map anchor와 focus context를 보존한다.
- Reset layers를 제공한다.
- navigation 링크와 toggle button semantics를 섞지 않는다.
- 실제 button이면 button과 aria-pressed를 사용한다.
- 실제 navigation이면 link와 aria-current를 사용한다.

### 5.5 marker popup과 구분 가능한 이름

MapLibre와 기존 vietnam-maplibre-popup CSS를 재사용한다. 새 map dependency를 추가하지 않는다.

marker를 누르면 먼저 popup에서 다음을 보여준다.

- record type
- 구분 가능한 short ID 또는 안전한 이름
- current status
- location/session age
- region
- Open booking, Open customer 또는 Open Partner

세 Booking marker가 동일한 accessible name을 가지지 않게 한다. accessible name에 안전한 short ID와 상태를 포함한다.

click, pointerup, touchend마다 window.location.assign을 중복 등록하지 않는다. semantic link 또는 기존 Next navigation 하나로 통일한다.

겹침이 기본 layer 축소 후에도 운영을 방해하면 MapLibre의 기존 기능으로 clustering을 추가한다. point 수가 작아 필요하지 않다면 새 cluster abstraction을 만들지 않는다.

### 5.6 상세 return context

marker에서 상세로 이동할 때 다음 문맥을 보존한다.

- source=Vietnam Overview
- view
- range
- region
- signals
- map anchor

상세 화면의 기존 return-context pattern이 있으면 재사용한다.

Vietnam Overview에서 진입한 상세의 명시적 back action은 Back to Vietnam overview로 돌아가고 기존 query와 map 문맥을 복원해야 한다. 다른 경로에서 상세에 직접 들어온 경우 기존 Booking Monitor 등의 fallback을 유지한다.

상세 페이지 전체를 재설계하지 않는다.

### 5.7 Regions needing action

임의 가중치 Load score를 제거한다.

운영자가 직접 해석할 수 있는 사실만 보여준다.

- Region
- Active bookings
- Ready Partners
- Coverage state
- Oldest active booking 또는 신뢰 가능한 freshness
- Open affected bookings

High, Medium, Low는 실제 제품 policy와 threshold가 코드베이스에 이미 있을 때만 사용한다. 상대 순위만으로 High load를 만들지 않는다.

정확한 regional supply count가 표본 때문에 불가능하면 section title을 Regional location sample로 낮추고 action priority를 만들지 않는다.

### 5.8 Period outcome 중심 축소

상단 KPI는 다음 네 개를 기본으로 한다.

- Completed
- Canceled
- Cancellation share
- Paid volume

모든 카드에 Today badge를 반복하지 않는다. Report period를 section 상단에서 한 번만 표시한다.

90% of closed work needs review처럼 cancellation count를 review backlog로 오해하게 하는 문구를 제거한다.

권장 문구:

- 9 of 10 closed bookings were canceled.
- Completed share of closed bookings
- Paid volume captured in this period

### 5.9 Regional outcomes table 단순화

현재 10열 fixed table과 Region cell의 중복 chip을 줄인다.

권장 열:

- Region
- Completed
- Canceled
- Cancellation share
- Paid volume
- View report

Live 수치가 필요하면 Period 표에 섞지 말고 Live mode에서 제공한다.

표의 정확한 regional aggregate를 만들 수 없고 표본만 있다면:

- 제목을 Regional outcome sample로 바꾼다.
- 표본 범위를 명시한다.
- exact national KPI보다 낮은 시각적 강도로 표시한다.
- closeout 또는 staffing 판단에 사용할 수 있다고 주장하지 않는다.

## 6. P2 — 반응형, 접근성, 문구

### 6.1 KPI와 focused summary 반응형

현재 repeat(6, minmax(0, 1fr))와 overflow-wrap:anywhere로 단어가 글자 단위로 깨지는 문제를 수정한다.

- 실제 content width에 반응하는 CSS auto-fit, minmax 또는 container query를 우선한다.
- JS viewport listener를 추가하지 않는다.
- 카드 최소 폭은 실제 copy가 단어 단위로 읽히는 수준으로 둔다.
- overflow-wrap:anywhere를 KPI와 heading에서 제거한다.
- 긴 ID처럼 정말 필요한 값에만 scoped overflow wrapping을 사용한다.
- 1440에서는 충분한 폭일 때만 한 줄 배치를 허용한다.
- 1280은 3×2 또는 더 단순한 2열/3열 구조가 되어야 한다.
- 1024에서도 단어가 세로 한 글자씩 부서지지 않아야 한다.
- HCMC focused summary의 고정 260px heading과 중첩 grid를 제거하거나 단순화한다.

### 6.2 table 반응형

- table-layout: fixed로 10개 열을 강제 압축하지 않는다.
- 열을 위 권장 구조로 줄인다.
- 필요한 경우 의미 있는 min-width와 scoped horizontal scroll을 사용한다.
- table scroll region에는 접근 가능한 이름과 keyboard focus를 제공한다.
- Region, header, paid amount, action이 ellipsis만으로 사라지지 않아야 한다.
- 페이지 전체의 가로 스크롤은 만들지 않는다.

### 6.3 map 접근성

- pointer target은 최소 44×44px에 가까운 기존 Admin 기준을 적용한다.
- zoom control도 충분한 target을 제공한다.
- marker category를 색상만으로 구분하지 않는다.
- 기본 화면에서 수십 개 marker가 모두 tab stop이 되지 않게 cluster, list 또는 roving 접근법 중 기존 MapLibre에 맞는 가장 작은 해법을 사용한다.
- popup은 Escape로 닫히고 닫힌 후 해당 marker 또는 합리적인 trigger로 focus가 돌아가야 한다.
- keyboard 사용자를 위한 Regions needing action 또는 mapped records 대체 목록을 제공한다.
- map을 건너뛸 수 있는 heading/landmark 구조를 유지한다.

### 6.4 정확한 사용자 문구

실제 predicate를 수정한 뒤 다음 방향으로 정리한다.

- Live map → Live operations
- Current saved customer locations... → Monitor current booking demand and Partner coverage by region.
- Live demand → Active bookings
- Realtime focus → Highest current demand 또는 제거
- Map signal sample → 제거 또는 Mapped signals
- All customers → Mapped customer locations · sample
- Active customers → 실제 presence일 때만 유지
- 최근 30일 predicate면 Customers seen in 30 days
- 7d inactive Partners → Partner session stale over 7 days
- Offline Partners → Busy와 Stale을 분리한 실제 Offline Partners
- Refreshes every 60s → 실제 polling이 없으면 Generated {time} + Refresh
- Realtime signal mix → Map layers
- Regional live load → Regional demand and coverage
- Period report → Period outcomes
- Period metrics range → Report period
- Work volume → 제거
- Completion rate → Completed share of closed bookings
- Map focus: HCMC → Report focus: HCMC
- Clear HCMC → All regions
- Latest 50/source → Sample · up to 50 recent records/source
- Focus region → View region report

문구만 바꿔 잘못된 데이터를 정당화하지 않는다. predicate와 문구를 함께 맞춘다.

## 7. 구현하지 않을 것

이번 작업에서 다음을 추가하지 않는다.

- 새 UI, chart, map, date, polling, state-management dependency
- 새 DB schema, table, column, migration
- 새 realtime presence subsystem
- 새 analytics pipeline 또는 data warehouse
- 새 command framework
- 임의의 Load score 대체 공식
- 별도의 Vietnam-only Partner readiness 규칙
- 모든 map point를 위한 복잡한 범용 repository
- Customer app 또는 Partner app 변경
- matching, payment, settlement mutation 변경
- 감사 캡처를 앱 asset으로 복사
- 무관한 관리자 화면 전역 redesign

기존 helper, component, MapLibre, Admin API response pattern과 현재 schema로 해결하는 것이 기본 범위다.

## 8. 테스트 요구사항

변경한 동작마다 가장 가까운 기존 spec을 수정하거나 작은 회귀 테스트를 추가한다. assertion을 약화하거나 삭제해 테스트를 통과시키지 않는다.

### API 최소 검증

admin-vietnam-region-overview.spec.ts 또는 가장 가까운 테스트:

- Today가 Asia/Ho_Chi_Minh 00:00 기준
- Yesterday 경계
- end-exclusive range
- region mapping 회귀

admin.service.spec.ts 또는 분리된 가장 가까운 작은 spec:

- completed/canceled/paid가 각각 올바른 사건 시각 predicate 사용
- summary와 region이 같은 기간 predicate 사용
- current/all-time/period count가 섞이지 않음
- 최근 30일 고객을 realtime active로 잘못 분류하지 않음
- Ready, Busy, Offline, Stale 분리
- point occurredAt에 now가 들어가지 않음
- timestamp unknown이 current time으로 바뀌지 않음
- sample metadata returned/total/truncated 일치
- sample count로 exact coverage gap을 계산하지 않음

route/controller 테스트:

- summary와 feed error response가 UI에서 구분 가능한 contract 유지
- 권한 guard 회귀 없음

### Admin Web 최소 검증

page.spec.tsx:

- Live와 Period의 payload가 분리됨
- Period에서 realtime 0 section이 렌더링되지 않음
- current/all-time/period KPI가 한 band에 섞이지 않음
- API failure가 0 KPI로 렌더링되지 않음
- generated/freshness와 Refresh 상태
- 지역 집중 화면이 period outcome만 표시

vietnam-overview-live-map.spec.tsx:

- 기본 layer가 active operational signals 중심
- filter 변경 후 query와 map scroll/focus 보존
- Reset layers
- tile error가 point 존재 여부와 무관하게 표시
- marker accessible name이 record별로 구분됨
- popup의 record/status/age/action
- detail return context
- 중복 window.location.assign handler 없음

vietnam-overview-model.spec.ts:

- 실제 predicate와 legend label 일치
- sample/partial/unknown total copy
- Busy, Offline, Stale label 분리
- exact가 아닌 값을 coverage gap으로 만들지 않음

CSS 또는 component contract:

- 6열 고정 grid 제거
- KPI에 overflow-wrap:anywhere 미적용
- 1024/1280/1440에서 사용할 responsive selector 존재
- table이 열을 강제 압축하지 않음
- marker와 map control target 크기
- focus-visible 회귀 없음

## 9. 실행 검증

먼저 관련 spec을 빠르게 실행한 다음 repository scope 검증을 수행한다.

~~~powershell
npm.cmd run test --workspace @massage-vn/admin-web
npm.cmd run test --workspace @massage-vn/api
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
npm.cmd run check:vietnam-scope
~~~

전체 테스트가 오래 걸리면 먼저 Vietnam 관련 spec만 실행해 피드백을 얻어도 된다. 최종 완료 전에는 위 admin/api scope 검증을 반드시 시도한다.

실패하면 다음을 구분해 보고한다.

- 이번 변경으로 발생한 실패
- 이미 존재하던 실패
- 환경 또는 외부 서비스 때문에 실행하지 못한 검증

테스트 통과만으로 완료하지 않는다.

## 10. 실제 브라우저 검증

현재 로그인된 브라우저 세션을 사용할 수 있으면 http://localhost:3101/vietnam-overview 를 직접 확인한다.

필수 상태:

1. Live operations 기본 화면
2. stale/inactive secondary layer ON/OFF
3. active booking marker popup
4. marker에서 booking 상세 이동 후 Back to Vietnam overview
5. Period outcomes Today
6. Period outcomes Yesterday
7. HCMC report focus
8. API error 또는 가능한 가장 가까운 failure state
9. map tile error 또는 가능한 가장 가까운 diagnostic state

필수 viewport:

- 1024×768, sidebar open
- 1280×720, sidebar open
- 1440×900, sidebar open

각 viewport에서 확인:

- KPI 단어가 글자 단위로 깨지지 않음
- first operational viewport에서 demand와 map 진입점 확인 가능
- page 전체 가로 scroll 없음
- table header, amount, action이 잘리지 않음
- HCMC focused summary가 무너지지 않음
- filter 변경 후 map scroll/focus 유지
- marker popup에서 record를 구분 가능
- 명시적 back action이 원래 query와 map 문맥 복원
- stale/inactive 위치가 기본 지도를 압도하지 않음
- API 실패와 실제 0건 구분
- generated time과 refresh 동작 일치
- keyboard로 mode, range, refresh, layer, popup, action, table에 접근 가능
- 200% zoom에서 핵심 흐름 수행 가능
- light/dark theme를 지원하는 화면이면 두 theme에서 상태와 텍스트 대비 확인

검증 캡처는 새 폴더 output/vietnam-overview-improvement-verification-YYYY-MM-DD 에 저장한다. 감사 원본 캡처를 덮어쓰지 않는다.

## 11. 완료 조건

다음 조건이 모두 충족되기 전에는 완료라고 보고하지 않는다.

1. Today와 Yesterday가 Vietnam local midnight 기준이다.
2. 화면의 Window 문구와 실제 API boundary가 일치한다.
3. current, all-time inventory, period outcome이 같은 KPI band에 섞이지 않는다.
4. Active customer 문구가 실제 predicate와 일치한다.
5. Ready, Busy, Offline, Stale Partner가 잘못 합쳐지지 않는다.
6. 실제 polling이 없으면 Refreshes every 60s 문구가 없다.
7. customer와 Partner point occurredAt가 실제 시각이며 unknown을 now로 채우지 않는다.
8. source별 최대 50건 표본을 전체 데이터로 표현하지 않는다.
9. 표본 count로 exact coverage gap을 주장하지 않는다.
10. API 실패, 실제 0건, partial sample, stale 상태가 구분된다.
11. point가 있어도 tile error를 확인할 수 있다.
12. HCMC Period focus에 가짜 realtime 0이 없다.
13. completed, canceled, paid volume이 각각 검증된 사건 시각을 사용한다.
14. Live의 첫 운영 viewport에서 현재 demand와 map 진입점을 확인할 수 있다.
15. coverage 경고가 기존 booking 또는 Partner 작업 화면으로 연결된다.
16. inactive saved locations가 기본 지도를 압도하지 않는다.
17. filter 변경 후 map scroll과 focus가 유지된다.
18. marker popup에서 record, status, age를 구분하고 상세로 이동할 수 있다.
19. 상세의 명시적 back action이 Vietnam Overview 문맥을 복원한다.
20. 임의 Load score가 없다.
21. Period KPI가 outcome 중심으로 축소된다.
22. 1024×768, 1280×720, 1440×900에서 단어가 세로로 깨지지 않는다.
23. HCMC focused summary가 잘리지 않는다.
24. regional table header, paid amount, action이 잘리지 않거나 명확한 scoped horizontal scroll이 있다.
25. keyboard와 200% zoom으로 핵심 흐름을 수행할 수 있다.
26. 새 dependency와 DB migration이 없다.
27. 관련 Admin Web/API 테스트와 admin/api/Vietnam scope 검증 결과가 기록된다.
28. 사용자의 기존 변경이 보존된다.

## 12. 구현 순서

다음 순서를 지킨다. 데이터 의미가 잘못된 상태에서 시각적 카드만 먼저 다듬지 않는다.

Phase 1 — 데이터 신뢰

1. Vietnam local-day boundary
2. current/period/all-time scope 분리
3. completed/canceled/paid 사건 시각
4. active customer와 Partner readiness 의미
5. occurredAt now 오염 제거
6. sample metadata와 coverage 주장 제거
7. error/empty/partial/stale 상태

Phase 2 — 정보 구조

1. Live map-first
2. coverage action 연결
3. default map layer 최소화
4. Period realtime 0 제거
5. Period KPI outcome 중심 축소
6. Load score와 중복 region 정보 제거

Phase 3 — 상호작용과 반응형

1. layer filter scroll/focus 보존
2. marker popup과 return context
3. KPI responsive grid
4. focused summary 단순화
5. regional table 단순화
6. keyboard, 200% zoom, 세 viewport 검증

각 phase가 끝날 때 관련 테스트를 실행한다. 마지막에 전체 diff를 검토해 같은 predicate가 여러 곳에 복제되지 않았는지, user-facing copy가 실제 데이터 의미와 맞는지, 다른 관리자 route에 회귀가 없는지 확인한다.

## 13. 최종 보고 형식

최종 결과는 다음 순서로 보고한다.

1. 운영자 관점에서 달라진 핵심 흐름
2. 데이터 의미 변경
   - timezone
   - active/readiness
   - period event timestamps
   - sample/exact scope
3. 변경 파일
4. 실행한 명령과 pass/fail/skipped
5. 브라우저 검증 상태와 캡처 경로
6. 1024/1280/1440 및 200% zoom 결과
7. 보호 영역 변경 여부
8. 기존 사용자 변경 보존 여부
9. 남은 위험 또는 검증하지 못한 항목
10. commit을 만들었다면 hash, 만들지 않았다면 Not committed

완료되지 않은 항목을 완료된 것처럼 표현하지 않는다. 외부 서비스나 데이터 부족으로 검증하지 못한 항목은 이유와 다음 확인 방법을 구체적으로 남긴다.

계획이나 추가 제안서만 제출하지 말고 실제 구현, 테스트, 브라우저 검증까지 수행하라.

