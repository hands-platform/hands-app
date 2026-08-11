# Vietnam Overview 재감사 보고서

- 대상: `http://localhost:3101/vietnam-overview?view=live#vietnam-operating-map`
- 감사일: 2026-08-07 (Asia/Bangkok)
- 검수 화면: 1440×900, 1600×900, Light/Dark
- 제외 범위: 1024px 이하 화면과 모바일 디자인은 사용자 요청에 따라 전혀 평가하지 않았다.
- 검수 방법: 실제 로그인 브라우저 화면, 레이어·마커·팝업·접힘 목록 상호작용, 키보드 탐색, URL 상태, React/Next 코드, API 집계 코드, 대상 링크의 실제 필터 처리, 관련 테스트를 교차 검증했다.
- 소스 수정: 없음. 이 문서는 감사 보고서만 제공한다.

## 1. 최종 판정

이전보다 분명히 좋아졌다. **Live operations / Period outcomes 분리, 기본 레이어 축소, 표본 범위 고지, URL에 보존되는 레이어 상태, 지도 실패 시 목록 fallback, 키보드 마커 탐색, 1440·1600 데스크톱 안정성**은 잘 구현됐다.

하지만 아직 운영 의사결정 화면으로 완료됐다고 보기는 어렵다. 가장 큰 이유는 미관이 아니라 **지표의 운영 의미와 이동 링크의 신뢰성**이다.

1. `Coverage gaps`가 공급이 필요한 예약만 세지 않고 `MATCHED`, `IN_SERVICE`까지 포함한 모든 활성 상태에서 Ready Partner 수를 뺀다. 현재 화면의 3건 중 실제 상태는 `MATCHED`, `IN_SERVICE`, `OPEN_MATCHING`인데 화면은 공급 부족 3건으로 표시한다.
2. 활성 예약에 상태 유효기간이 없어 22일 전 예약과 45~47시간 전 예약도 현재 수요로 표시된다.
3. 예약 마커의 시간은 상태가 바뀐 시점이 아니라 예약 생성 시점이다. 운영자는 “22일째 MATCHED 상태”인지 “22일 전에 생성됐지만 방금 MATCHED 된 예약”인지 알 수 없다.
4. `Coverage gaps`, `Open affected bookings`, `View Partner availability` 링크가 실제 대상 화면에서 해당 필터를 적용하지 않는다.
5. 보조 레이어를 켜면 50개 마커가 HCM에 겹치며, 동일 좌표 마커는 포인터로 원하는 항목을 선택하기 어렵다.

따라서 판정은 **“시각 구조는 개선됨 / 운영 데이터 신뢰와 drill-down은 수정 필수”**다. 권장 출시 게이트는 P0 1건과 P1 핵심 4건을 해결한 뒤 재검수하는 것이다.

## 2. 구현 품질 점수

| 영역 | 점수 | 판정 |
|---|---:|---|
| 접근성·키보드 | 3/4 | `aria-pressed`, roving tabindex, 방향키 탐색, 팝업 focus return은 좋다. 겹친 마커의 포인터 접근과 빈 문서 제목은 남아 있다. |
| 성능·데이터 로드 | 2/4 | MapLibre 동적 import는 좋다. Live 진입 때 summary와 realtime feed가 고객·파트너·활성 예약을 중복 조회하고, summary는 Live에 필요 없는 period 집계까지 수행한다. |
| 테마 | 3/4 | Light/Dark 모두 구조와 텍스트는 안정적이다. Dark shell 안의 밝은 raster 지도 대비는 다소 강하다. |
| 1440+ 레이아웃 | 3/4 | 1440/1600에서 가로 넘침이 없고 전체 흐름은 안정적이다. 우측 레이어 패널과 다중 마커가 지도 판독 면적을 과도하게 차지한다. |
| 구현·운영 의미 | 1/4 | 활성 수요·공급 부족 계산, 시간 의미, drill-down 필터가 운영자가 기대하는 의미와 일치하지 않는다. |
| **합계** | **12/20** | **Acceptable visually, not yet trustworthy for live staffing decisions** |

## 3. 화면 단계별 감사

### 3.1 페이지 상단과 KPI — 상태: 수정 필요

![1440 상단 KPI](C:/dev/massage-on-demand-vn/output/vietnam-overview-post-implementation-audit-2026-08-07/04-live-overview-top-1440.jpg)

좋아진 점:

- 페이지 목적 문구가 짧고 명확하다.
- `Live operations`와 `Period outcomes`가 한 페이지의 모드로 정리돼 메뉴 중복을 만들지 않는다.
- `Generated`, `Manual refresh`, `Asia/Ho_Chi_Minh`가 함께 있어 데이터 시점과 시간대를 이해하기 쉽다.
- 1440과 1600에서 KPI 3개가 안정적으로 유지되고 가로 스크롤이 없다.

문제:

- `Active bookings`는 “대기·매칭·서비스 중”을 모두 합친 값이고, `Ready Partners`는 “새 예약을 받을 수 있는 공급”이다. 서로 다른 의미의 두 값을 단순 차감해 `Coverage gaps`로 부르는 것은 산술은 맞아도 운영 의미가 틀리다.
- 현재 실제 마커 상태는 `MATCHED`, `IN_SERVICE`, `OPEN_MATCHING`이다. 새 Partner 공급이 필요한 예약은 원칙적으로 `OPEN_MATCHING` 계열이지 이미 매칭되거나 서비스 중인 예약이 아니다.
- 22일 전, 45시간 전, 47시간 전 레코드도 Live KPI에 그대로 포함돼 데이터 이상과 실시간 수요가 섞인다.
- `Coverage gaps` 클릭 URL의 `view=live`는 Booking 화면이 지원하는 view가 아니다. `review=matching`도 대상 화면이 읽지 않는다. 클릭하면 기대한 매칭 부족 목록이 아니라 기본 `attention` 화면으로 정규화된다.

권장 구성:

| 현재 | 권장 | 의미 |
|---|---|---|
| Active bookings | Needs supply now | 아직 Partner가 배정되지 않아 공급이 필요한 유효 예약만 계산 |
| Ready Partners | Ready to accept now | 현재 배정 가능한 Partner |
| Coverage gaps | Supply shortage | `max(Needs supply now - Ready to accept now, 0)` |
| 없음 | Matched / in service | 이미 공급이 배정된 진행 예약, 별도 운영 상태 |
| 없음 | Stale active records | 상태 SLA를 넘겼거나 비정상적으로 오래 열린 예약 |

최소 수정 원칙은 새 대시보드 체계를 만드는 것이 아니다. 기존 Booking queue의 상태·SLA 판정 함수를 재사용해 **공급 필요 / 이미 배정 / 데이터 이상** 세 범주만 분리하면 된다.

관련 코드:

- [page.tsx:259](C:/dev/massage-on-demand-vn/apps/admin_web/app/vietnam-overview/page.tsx:259) — 모든 active booking 수에서 ready Partner 수를 차감
- [page.tsx:312](C:/dev/massage-on-demand-vn/apps/admin_web/app/vietnam-overview/page.tsx:312) — 지원되지 않는 `view=live&review=matching` 링크
- [admin.service.ts:6186](C:/dev/massage-on-demand-vn/apps/api/src/admin/admin.service.ts:6186) — 활성 상태만 조건으로 조회하고 시간 유효성 조건 없음
- [booking-page-params.ts:48](C:/dev/massage-on-demand-vn/apps/admin_web/app/bookings/booking-page-params.ts:48) — 지원 view 목록에 `live` 없음

### 3.2 기본 Operating map — 상태: 양호, 문구 보정 필요

![기본 지도](C:/dev/massage-on-demand-vn/output/vietnam-overview-post-implementation-audit-2026-08-07/01-live-map-1440.jpg)

좋아진 점:

- 기본 표시가 `Ready Partners`와 `Active bookings`로 제한돼 이전보다 목적이 분명하다.
- 표본임을 `Showing up to 53 recent mapped signals`와 `Partial sample`로 중복 고지해 전국 총계로 오해할 가능성을 낮췄다.
- 레이어 변경이 `signals` query에 저장되고 `router.replace(..., { scroll: false })`를 사용해 지도가 튀지 않는다.
- 지도 타일 실패 시 `Mapped records`를 유지하는 fallback 설계가 있다.

수정할 점:

- 패널 부제 `Operational layers are on by default`는 7개 중 2개만 켜지는 현재 동작과 맞지 않는다. `Default: Ready Partners + Active bookings`로 바꿔야 한다.
- `Active bookings`라는 레이어도 KPI와 동일하게 공급 필요 예약과 이미 배정된 예약을 섞는다. `Needs supply`, `Matched`, `In service`를 최소한 상태별 색 또는 필터로 분리해야 한다.
- 표본 chip과 레이어 패널을 모두 지도 내부 absolute overlay로 놓아 지도 상단 사용 면적이 줄었다. 표본 문구는 섹션 설명/toolbar로 빼고 지도 안에는 compact layer trigger만 두는 편이 낫다.

### 3.3 마커 팝업과 시간 정보 — 상태: P1 수정

![예약 마커 팝업](C:/dev/massage-on-demand-vn/output/vietnam-overview-post-implementation-audit-2026-08-07/02-booking-marker-popup-1440.jpg)

![겹친 오래된 마커](C:/dev/massage-on-demand-vn/output/vietnam-overview-post-implementation-audit-2026-08-07/03-overlapping-stale-marker-1440.jpg)

확인 결과:

- 마커 팝업에 상태, 지역, 경과 시간, 상세 이동이 있어 기본 구성은 좋다.
- 팝업이 열리면 첫 링크로 focus가 이동하고 닫히면 마커로 focus가 돌아간다.
- 3개 마커는 방향키로 `MATCHED → IN_SERVICE → OPEN_MATCHING` 순환 탐색이 가능했다.
- 그러나 HCM의 `IN_SERVICE`와 `OPEN_MATCHING` 마커가 정확히 같은 좌표에 겹친다. 포인터 클릭은 위에 그려진 마커를 열기 때문에 사용자가 원하는 아래 마커를 직접 선택하기 어렵다.
- 첫 마커 팝업은 좌측 상단 표본 chip과 시각적으로 충돌해 제목 영역이 답답하고 일부가 가려진 것처럼 보인다.
- 팝업의 `MATCHED`, `IN_SERVICE`, `OPEN_MATCHING`을 `<code>` 모양으로 표시해 운영 상태가 시스템 코드처럼 보인다.
- `22 days ago`는 상태 경과가 아니라 예약 생성 후 경과다. API가 `updatedAt`도 조회하지만 마커에는 `booking.createdAt`을 전달한다.

권장:

1. 팝업 상태를 운영 문구로 변환한다: `Needs matching`, `Matched`, `Partner on the way`, `Service in progress`.
2. `Booking age`와 `Time in current state`를 구분한다. 운영 판단에는 후자를 먼저 보여준다.
3. 정확히 같은 좌표는 단일 집계 마커 `3 records`로 만들고 클릭 시 작은 목록으로 선택하게 한다.
4. 20개 이상 또는 줌 축소 상태에서는 MapLibre 기본 GeoJSON clustering을 사용한다. 새 지도 라이브러리는 필요 없다.
5. 표본 chip을 지도 밖으로 이동해 팝업과 겹칠 공간을 없앤다.

관련 코드:

- [admin.service.ts:6424](C:/dev/massage-on-demand-vn/apps/api/src/admin/admin.service.ts:6424) — `occurredAt: booking.createdAt`
- [vietnam-overview-live-map.tsx:158](C:/dev/massage-on-demand-vn/apps/admin_web/app/vietnam-overview/vietnam-overview-live-map.tsx:158) — 개별 DOM Marker/Popup 생성
- [vietnam-overview-live-map.tsx:304](C:/dev/massage-on-demand-vn/apps/admin_web/app/vietnam-overview/vietnam-overview-live-map.tsx:304) — 상태를 `<code>`로 렌더링
- [vietnam-overview-live-map.tsx:338](C:/dev/massage-on-demand-vn/apps/admin_web/app/vietnam-overview/vietnam-overview-live-map.tsx:338) — 키보드 순환 로직은 유지할 가치가 있음

### 3.4 레이어 메뉴 — 상태: 동작은 좋으나 운영 우선순위 재편 필요

![고객 레이어 활성화](C:/dev/massage-on-demand-vn/output/vietnam-overview-post-implementation-audit-2026-08-07/05-customer-layer-on-1440.jpg)

![50개 신호 밀집](C:/dev/massage-on-demand-vn/output/vietnam-overview-post-implementation-audit-2026-08-07/06-dense-secondary-layers-1440.jpg)

동작 검수:

- 각 버튼은 실제로 레이어를 켜고 끄며 `aria-pressed` 상태가 있다.
- `Reset layers`는 Ready Partner + Active booking 기본 상태로 정상 복귀한다.
- 고객 2건, Busy 1건, Offline 44건, Booking 3건을 함께 켜면 총 50개 마커가 표시된다.

운영 관점 문제:

- `Offline Partners 44`와 `Mapped customer locations 3`은 Live 공급 의사결정의 1차 정보가 아니다. 지도에 모두 켜면 HCM 중심부가 마커로 가려져 오히려 핵심 예약을 놓친다.
- 7개 레이어가 모두 같은 높이·강도로 노출돼 기본 운영 레이어와 조사용 레이어의 우선순위가 보이지 않는다.
- 비활성 상태는 opacity만 낮아져 선택 여부를 빠르게 읽기 어렵다. 현재 active의 좌측 선은 좋은 단서지만 더 명시적인 checked indicator가 있으면 좋다.

권장 IA:

- `Live coverage` 고정 1차 레이어: Needs supply, Ready Partners, Matched/In service.
- `Investigate` 접힘 2차 레이어: Busy Partners, Stale Partner location, Offline Partners.
- `Customer context` 접힘 3차 레이어: Recently active customers, Saved locations.
- `Offline Partners`는 지도 기본 업무가 아니라 Partner availability 조사 목적이므로 기본 패널 밖 `More layers`에 둔다.
- 레이어 패널은 지도 위 420px overlay 대신 우측 상단 `Layers (2 on)` 버튼 + popover로 줄인다. 운영자가 지도를 보는 동안 패널을 닫을 수 있어야 한다.

### 3.5 고객 활동 시간 의미 — 상태: P1 수정

`Customers seen in 30 days`는 세션의 `lastSeenAt`으로 포함 여부를 판단하지만 마커 시간에는 선택 위치의 `createdAt`을 사용한다. 최근 접속한 고객의 오래된 저장 위치를 표시하면서 `n days ago`를 한 번만 보여주면, 운영자는 고객 활동 시간이 오래됐다고 읽거나 위치가 최신이라고 읽을 수 있다.

권장 표기:

- 제목: `Customer active recently`
- 메타 1: `Last app activity: 18 min ago`
- 메타 2: `Location source: saved location · 46 days old`
- 위치가 너무 오래됐으면 고객 활동과 무관하게 지도 점을 약하게 표시하거나 `Saved location` 레이어로만 분리한다.

관련 코드:

- [admin.service.ts:6275](C:/dev/massage-on-demand-vn/apps/api/src/admin/admin.service.ts:6275) — 최근 활동 판단은 `lastSeenAt`
- [admin.service.ts:6289](C:/dev/massage-on-demand-vn/apps/api/src/admin/admin.service.ts:6289) — 표시 시간은 `selectedLocation.createdAt`

### 3.6 Mapped records fallback — 상태: 기능은 유효, 목록 형태 개선 필요

![Mapped records 펼침](C:/dev/massage-on-demand-vn/output/vietnam-overview-post-implementation-audit-2026-08-07/07-mapped-records-expanded-1440.jpg)

좋아진 점:

- 지도 타일·포인터 사용이 어려워도 동일 레코드로 이동할 수 있는 fallback이 있다.
- `<details>`로 접혀 있어 기본 화면을 과도하게 늘리지 않는다.

수정할 점:

- 현재 링크 문구는 마커의 긴 aria-label을 그대로 재사용해 `Active bookings Active booking service address · …, MATCHED, HCM`처럼 한 줄에 정보가 이어진다.
- `22 days ago`, `47 hr ago`, `45 hr ago`가 오른쪽 끝에만 있어 어떤 시간이 예약 생성/상태 변경/위치 갱신 시간인지 알 수 없다.
- stale 레코드가 경고가 아니라 일반 목록처럼 보인다.

권장 최소 열:

| Record | Operational state | Region | State age | Action |
|---|---|---|---|---|
| Booking …n6mmbh5w | Matched | HCM | 22 days · stale | Open |

별도 복잡한 테이블 컴포넌트를 만들 필요는 없고 기존 admin table을 재사용하면 된다.

### 3.7 Regional location sample — 상태: P1, 링크는 즉시 수정

![지역 표](C:/dev/massage-on-demand-vn/output/vietnam-overview-post-implementation-audit-2026-08-07/08-regional-table-1440.jpg)

좋아진 점:

- `Sample · up to 50/source`와 설명이 있어 지역 수치가 전체 합계가 아님을 명시한다.
- 고정된 지역 순서라 매일 위치가 바뀌는 ranking보다 찾기 쉽다.

문제:

- 8개 지역 중 HCM만 값이 있고 나머지 7개는 0인데 모든 행에 동일한 두 링크가 있어 16개 행동이 반복된다.
- 0건 행에도 `Open affected bookings`가 표시된다. “affected”인 대상이 없는데 행동이 있는 셈이다.
- `/bookings?view=live&region=hcm`은 `view=live`가 지원되지 않고 `region`도 booking load plan에 전달되지 않는다.
- `/partners?availability=ready&region=hcm`은 Partner filter parser가 `availability`와 `region`을 읽지 않는다. 현재 `location`, `readiness`도 강제로 빈 값으로 만든다.
- 따라서 운영자는 HCM으로 필터된 booking/Partner 목록을 기대하지만 실제로는 필터되지 않은 목록을 보게 된다.

권장:

1. **즉시 안전 수정:** 대상 페이지에 실제 필터가 없으면 두 링크를 제거한다. 거짓 drill-down보다 링크가 없는 편이 낫다.
2. HCM처럼 표본 값이 있는 지역만 기본 표시하고 `Show 7 regions with no sampled records`로 0행을 접는다.
3. `Open affected bookings`는 `activeBookingCount > 0`이고 실제 필터가 작동할 때만 표시한다.
4. `View Partner availability`는 공급 부족 지역이며 실제 region/ready filter가 작동할 때만 표시한다.
5. 지역 drill-down이 제품 요구라면 Booking/Partner API까지 region code를 전달하고, 대상 페이지 상단에 `Region: Ho Chi Minh City` active filter chip이 보이는 end-to-end 구현과 테스트를 추가한다.
6. region filtering을 아직 만들지 않을 경우 가장 짧고 정직한 대안은 현재 overview 안에서 `?view=live&region=hcm#vietnam-operating-map`로 focus만 바꾸는 것이다.

관련 코드:

- [page.tsx:384](C:/dev/massage-on-demand-vn/apps/admin_web/app/vietnam-overview/page.tsx:384) — 동작하지 않는 Booking region link
- [page.tsx:387](C:/dev/massage-on-demand-vn/apps/admin_web/app/vietnam-overview/page.tsx:387) — 동작하지 않는 Partner availability/region link
- [booking-monitor-route-load-plan.ts:75](C:/dev/massage-on-demand-vn/apps/admin_web/app/bookings/booking-monitor-route-load-plan.ts:75) — list API parameter에 region 없음
- [partner-filters.ts:50](C:/dev/massage-on-demand-vn/apps/admin_web/app/partners/partner-filters.ts:50) — Partner query parser
- [partner-filters.ts:86](C:/dev/massage-on-demand-vn/apps/admin_web/app/partners/partner-filters.ts:86) — location/readiness를 항상 빈 값으로 설정

### 3.8 Dark theme과 1600 desktop — 상태: 양호

![Dark 1440 지도](C:/dev/massage-on-demand-vn/output/vietnam-overview-post-implementation-audit-2026-08-07/09-live-map-dark-1440.jpg)

![1600 상단](C:/dev/massage-on-demand-vn/output/vietnam-overview-post-implementation-audit-2026-08-07/10-live-overview-top-1600.jpg)

- 1440×900과 1600×900에서 body 가로 overflow는 없었다.
- Dark theme에서 카드, badge, layer panel, popup의 텍스트 대비와 상태 구조는 유지된다.
- 다만 밝은 raster tile이 어두운 shell 사이에서 큰 발광 면처럼 보인다. 필수 수정은 아니며, 타일 스타일을 별도로 추가하기보다 지도 위 매우 약한 neutral overlay 또는 Dark-compatible MapTiler style이 이미 계약에 포함돼 있을 때만 사용하면 된다.
- 브라우저 문서 제목이 빈 문자열이라 여러 관리자 탭을 열면 구분이 어렵다. `Vietnam Overview | HANDS Admin` metadata를 추가해야 한다.

## 4. 성능과 데이터 일관성

Live 화면에서도 항상 summary endpoint를 호출하고, summary는 `includePeriodMetrics: true`로 고객·파트너·period booking·active booking·exact total을 만든다. 동시에 realtime endpoint가 고객·파트너·active booking을 다시 조회한다.

결과:

- 같은 화면 진입에서 고객/Partner/active booking sample 조회가 중복된다.
- Live에 필요 없는 period 결과 집계도 수행한다.
- summary와 feed가 다른 시점에 생성되어 KPI와 마커가 순간적으로 어긋날 수 있다.
- `Feed available`는 HTTP 성공을 뜻할 뿐 feed freshness를 보여주지 않는다.

가장 작은 개선안:

- 기존 realtime endpoint 응답에 Live exact totals와 regional sample을 포함하고 Live mode에서는 이 endpoint 하나만 사용한다.
- Period mode만 기존 summary를 사용한다.
- 또는 summary에 `scope=live`를 추가해 period booking 조회를 생략한다. 두 endpoint를 유지한다면 최소한 같은 snapshot timestamp를 표시해야 한다.

관련 코드:

- [page.tsx:135](C:/dev/massage-on-demand-vn/apps/admin_web/app/vietnam-overview/page.tsx:135) — 모든 view에서 summary 요청
- [page.tsx:139](C:/dev/massage-on-demand-vn/apps/admin_web/app/vietnam-overview/page.tsx:139) — Live에서 realtime feed 추가 요청
- [admin.service.ts:5992](C:/dev/massage-on-demand-vn/apps/api/src/admin/admin.service.ts:5992) — summary가 period metrics를 항상 포함
- [admin.service.ts:6004](C:/dev/massage-on-demand-vn/apps/api/src/admin/admin.service.ts:6004) — realtime이 동일 source sample을 다시 구성

## 5. 우선순위별 수정 백로그

### P0 — 운영 판단 오류

1. `Coverage gaps` 계산을 공급이 필요한 예약에만 적용한다. `MATCHED`, `IN_SERVICE`는 제외하고 별도 진행 지표로 둔다.
2. 상태 SLA를 넘긴 활성 예약은 정상 Live demand가 아니라 `Stale active records / Data anomaly`로 분리한다. 숨기지 말고 더 강하게 노출하되 공급 부족 계산에서는 분리한다.

### P1 — 다음 배포 전 권장

1. 예약 마커에 `createdAt` 대신 current-state timestamp를 사용하고, 없으면 `updatedAt`으로 fallback한다.
2. Coverage/region/Partner 링크를 실제 필터와 end-to-end로 연결하거나, 필터를 만들기 전까지 제거한다.
3. 동일 좌표 마커를 집계하고 다수 마커 clustering을 추가한다. 새 dependency 없이 MapLibre 기능을 재사용한다.
4. `Customers seen in 30 days`의 활동 시각과 위치 시각을 분리한다.
5. Live endpoint 중복 조회를 제거하거나 Live 전용 summary scope로 줄인다.
6. 0건 지역의 반복 액션을 숨기고 실제 sample이 있는 지역을 먼저 표시한다.

### P2 — 운영 편의·시각 정리

1. layer panel을 닫을 수 있는 `Layers (2 on)` popover로 축소한다.
2. 표본 chip을 지도 밖 섹션 toolbar로 이동한다.
3. 시스템 상태 코드를 운영 문구 badge로 변환한다.
4. `Mapped records`를 기존 admin table 형태로 정리하고 stale badge를 추가한다.
5. 브라우저 문서 제목을 추가한다.
6. 문구 `Operational layers are on by default`를 실제 기본 상태 설명으로 교체한다.

## 6. 권장 문구 사전

| 현재 문구 | 권장 문구 |
|---|---|
| Active bookings | Needs supply now / Matched & in service로 분리 |
| Coverage gaps | Supply shortage |
| Bookings currently waiting, matched, or in service. | Waiting for Partner assignment now. |
| Operational layers are on by default | Default: Ready Partners + Active bookings |
| Customers seen in 30 days | Customers active in last 30 days |
| Mapped customer locations · sample | Saved customer locations · sample |
| Stale or unknown Partner location | Partner location unavailable / stale |
| Sample only | No sampled live records |
| Potential gap in sample | Possible supply shortage in sample |
| Open affected bookings | Open bookings needing supply |
| View Partner availability | Open ready Partners in this region |
| MATCHED | Matched |
| IN_SERVICE | Service in progress |
| OPEN_MATCHING | Needs matching |

## 7. 수정 완료 수용 기준

### 데이터 의미

- fixture가 `OPEN_MATCHING 1`, `MATCHED 1`, `IN_SERVICE 1`, `Ready Partner 0`일 때 `Supply shortage`는 1이어야 한다.
- 상태 SLA를 넘긴 `OPEN_MATCHING`은 `Stale active records`에 나타나고 정상 supply demand와 분리돼야 한다.
- 오래전에 생성됐지만 최근 상태가 변경된 예약은 `Booking age`와 `State age`가 다르게 표시돼야 한다.
- 최근 접속 고객의 오래된 saved location은 활동 시간과 위치 시간이 따로 표시돼야 한다.

### Drill-down

- Coverage card 클릭 후 Booking 화면에서 실제 `Matching` 또는 `Needs supply` 필터가 활성 상태로 보여야 한다.
- 지역 action을 유지한다면 대상 화면에서 `Region: Ho Chi Minh City` 필터 chip과 서버 요청 region parameter가 모두 확인돼야 한다.
- 실제 필터가 없으면 링크 자체가 렌더링되지 않아야 한다.

### 지도

- 같은 좌표 2건 이상은 포인터와 키보드 모두 각 레코드를 선택할 수 있어야 한다.
- 50개 레이어를 켜도 개별 50개 DOM 마커가 한 지점에 겹치지 않고 cluster count가 보여야 한다.
- 팝업이 표본 안내나 layer panel 아래에 가려지지 않아야 한다.
- 방향키/Home/End 순환과 팝업 close 후 focus return은 현재 동작을 유지해야 한다.

### 데스크톱·테마

- 1440×900, 1600×900 Light/Dark에서 가로 overflow가 없어야 한다.
- 이 수용 기준에는 1024px 이하 화면을 포함하지 않는다.

## 8. 자동 테스트 확인

실행 결과:

- Admin Web Vietnam Overview: **4 files, 30 tests passed**
- API Vietnam Overview 검색 실행: **1 file, 2 tests passed, 548 skipped**

현재 테스트는 component 존재, 동적 MapLibre import, 기본 모델과 endpoint 응답을 확인하지만 다음 운영 의미는 방어하지 못한다.

- 공급 부족 계산에서 MATCHED/IN_SERVICE 제외
- 상태 SLA 초과 레코드 분리
- `createdAt`과 state age 구분
- 지역/availability 링크의 대상 필터 적용
- 동일 좌표 마커의 포인터 선택
- 최근 고객 활동 시간과 saved location 시간 구분

위 수용 기준마다 가장 작은 회귀 테스트 1개씩 추가하는 것이 적절하다.

## 9. 구현 지시 요약

Codex가 수정할 때는 새 디자인 시스템이나 새 지도 dependency를 만들지 않는다. 기존 Booking queue의 상태/SLA 판정, 기존 Admin table/badge, 현재 MapLibre를 재사용한다. 우선순위는 **지표 의미 → 링크 신뢰 → 마커 중첩 → 레이어 정리 → 시각 polish** 순서다. 특히 “보이기 좋게” 바꾸기 전에 `Supply shortage`가 실제로 공급이 필요한 예약만 뜻하도록 데이터 모델부터 바로잡아야 한다.
