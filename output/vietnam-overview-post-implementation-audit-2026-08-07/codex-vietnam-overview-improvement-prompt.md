# Codex 실행 프롬프트 — Vietnam Overview 개선

아래 프롬프트를 `C:\dev\massage-on-demand-vn`을 workspace로 연 Codex 작업에 그대로 붙여 넣는다.

---

## Prompt

`C:\dev\massage-on-demand-vn` 프로젝트의 Vietnam Overview Live Operations 화면을 감사 보고서에 따라 실제로 수정해라.

대상 URL:

- `http://localhost:3101/vietnam-overview?view=live#vietnam-operating-map`

필수 기준 문서:

- `C:\dev\massage-on-demand-vn\output\vietnam-overview-post-implementation-audit-2026-08-07\vietnam-overview-post-implementation-deep-audit.md`
- 같은 폴더의 `01`~`10` 감사 스크린샷

이 작업의 목표는 화면을 단순히 예쁘게 만드는 것이 아니다. 운영자가 이 화면만 보고 현재 공급 부족을 잘못 판단하지 않고, 필요한 예약이나 Partner 조사로 정확하게 이동하며, 밀집된 지도에서도 대상 레코드를 선택할 수 있게 만드는 것이다.

가능하면 다음 skill을 사용해라.

- `impeccable`: 기존 관리자 디자인 시스템 안에서 정보 위계·문구·상태·접근성을 개선
- `browser:control-in-app-browser`: 로그인된 실제 화면을 1440×900과 1600×900에서 검증하고 캡처
- `ponytail`: 새 dependency와 불필요한 추상화를 피하고 기존 코드의 공통 판정을 재사용

### 1. 먼저 확인할 것

코드를 수정하기 전에 다음을 수행해라.

1. `git status --short`로 기존 사용자 변경을 확인하고 관련 없는 변경을 보존한다.
2. 감사 보고서를 처음부터 끝까지 읽는다.
3. 다음 파일과 모든 직접 caller/test를 조사한다.
   - `apps/admin_web/app/vietnam-overview/page.tsx`
   - `apps/admin_web/app/vietnam-overview/vietnam-overview-live-map.tsx`
   - `apps/admin_web/app/vietnam-overview/vietnam-overview-model.ts`
   - `apps/admin_web/app/vietnam-overview/*.spec.ts*`
   - `apps/admin_web/app/bookings/booking-page-params.ts`
   - `apps/admin_web/app/bookings/booking-monitor-route-load-plan.ts`
   - `apps/admin_web/app/partners/partner-filters.ts`
   - `apps/api/src/admin/admin.service.ts`의 Vietnam Overview 집계 코드와 관련 테스트
4. Booking 화면이 이미 사용하는 matching/no-supply/SLA/expiry 판정과 Partner ready-now 판정을 찾는다. 같은 운영 개념을 새로 재구현하지 말고 기존 공통 판정 또는 query builder를 재사용한다.
5. 현재 Live 페이지가 호출하는 summary/realtime endpoint와 DB query를 끝까지 추적한다.
6. 간단한 실행 계획을 작성한 뒤 바로 구현한다. 실제 데이터 계약을 바꿔야 하거나 안전한 구현이 불가능한 경우에만 중단하고 구체적인 blocker를 보고한다.

### 2. 범위와 금지사항

필수 범위:

- Vietnam Overview Live mode의 API 집계, KPI, 지도, 레이어, 레코드 fallback, 지역 표, 실제 drill-down
- 필요한 최소 범위의 Booking/Partner query 처리 또는 링크 정직성 수정
- 관련 unit/component/API 회귀 테스트
- 실제 브라우저 검증과 결과 캡처

금지사항:

- 1024px 이하 화면과 모바일 디자인은 작업하거나 보고하지 않는다.
- 1440×900과 1600×900 데스크톱만 시각 검수한다.
- 새 UI 프레임워크, 새 지도 라이브러리, 새 상태관리 라이브러리를 추가하지 않는다.
- 현재 MapLibre, 기존 Admin component, badge, table, filter, query helper를 재사용한다.
- `Period outcomes`의 기존 동작과 API 의미를 깨지 않는다.
- 관련 없는 페이지를 재설계하지 않는다.
- 실제로 적용되지 않는 query parameter를 URL에 붙여 필터처럼 보이게 만들지 않는다.
- 임의의 새 SLA 값을 하드코딩하지 않는다. 기존 운영 정책·expiresAt·queue SLA를 재사용한다.
- 오래된 활성 레코드를 숨기거나 집계에서 조용히 삭제하지 않는다. 정상 Live demand와 분리해 더 명확하게 노출한다.
- 사용자 작업을 덮어쓰거나 destructive git command를 사용하지 않는다.
- 한 구현만 필요한데 factory/interface/config 계층을 새로 만들지 않는다.

### 3. P0 — 운영 지표의 의미부터 수정

현재 `Coverage gaps = activeBookingCount - readyPartnerCount` 계산을 폐기해라. `activeBookingCount`에는 `MATCHED`, `PROVIDER_ON_THE_WAY`, `ARRIVED`, `IN_SERVICE`가 포함되어 이미 공급이 배정된 예약도 공급 부족으로 계산된다.

서버에서 다음 개념을 명시적으로 계산하고 UI와 지역 sample에서도 동일한 의미를 사용해라.

1. `needsSupplyNowCount`
   - Partner 공급이 아직 필요한 유효 예약만 포함한다.
   - 현재 상태만 보고 새 규칙을 만들지 말고 기존 Booking matching/no-supply/expiry 판정을 조사해 재사용한다.
   - 최소한 `MATCHED`, `PROVIDER_ON_THE_WAY`, `ARRIVED`, `IN_SERVICE`는 포함하지 않는다.
2. `assignedOrInServiceCount`
   - 이미 Partner가 배정됐거나 이동/도착/서비스 중인 진행 예약을 별도 표시한다.
3. `staleActiveRecordCount`
   - 상태 SLA, matching expiry, 비정상적으로 오래 유지된 상태 등 기존 운영 정책을 넘어선 활성 레코드다.
   - 정상 `needsSupplyNowCount`와 분리하지만 화면에서 숨기지 않는다.
   - Booking `Data anomaly` 또는 `Matching delays`로 이동할 수 있어야 한다.
4. `readyPartnerCount`
   - 기존 `adminPartnerReadyNowWhere` 의미를 유지한다.
5. `supplyShortageCount`
   - `max(needsSupplyNowCount - readyPartnerCount, 0)`으로 계산한다.

UI KPI를 다음 의미로 정리해라.

- `Needs supply now`
- `Ready Partners`
- `Supply shortage`
- 보조 정보 또는 compact status로 `Matched / in service`
- 경고 상태로 `Stale active records`

`Active bookings` 전체 수가 다른 소비자에게 필요하면 기존 field를 호환 목적으로 유지해도 된다. 그러나 새 공급 부족 계산에는 사용하지 않는다. API field 변경은 기존 caller를 확인하고 가장 작은 호환 가능한 diff로 처리한다.

반드시 추가할 회귀 테스트:

- `OPEN_MATCHING 1`, `MATCHED 1`, `IN_SERVICE 1`, `Ready Partner 0`일 때 `Supply shortage`는 1이다.
- 이미 배정된 상태는 `assignedOrInServiceCount`에 포함되고 공급 부족에서는 제외된다.
- expiry/SLA를 넘긴 matching record는 stale/data anomaly로 분리되고 정상 수요와 섞이지 않는다.

### 4. 예약과 고객의 시간 의미 수정

예약 지도 마커의 `occurredAt`에 무조건 `booking.createdAt`을 전달하지 마라.

1. 현재 상태로 전환된 timestamp가 schema/기존 lifecycle data에 있으면 그것을 사용한다.
2. 정확한 상태 timestamp가 없으면 이미 조회 중인 `updatedAt`을 명시적인 fallback으로 사용한다.
3. 가능하면 API 모델에 다음 의미를 구분한다.
   - booking created time
   - current state changed/updated time
4. 팝업과 fallback list에는 운영 판단에 필요한 `State age`를 먼저 표시한다. Booking age가 필요하면 별도로 표시한다.

`Customers seen in 30 days`는 `lastSeenAt`으로 포함 여부를 판단하면서 표시 시간은 `selectedLocation.createdAt`을 사용한다. 다음 두 시간을 분리해라.

- `Last app activity`
- `Location source/freshness`

최근 접속과 오래된 saved location을 하나의 `n days ago`로 합치지 않는다. 위치가 오래된 경우 `Saved location`/stale 성격을 문구와 스타일로 명확히 한다.

반드시 추가할 회귀 테스트:

- 오래전에 생성되고 최근 updated된 예약에서 `State age`가 created age로 표시되지 않는다.
- 최근 활동 고객 + 오래된 saved location fixture에서 활동 시각과 위치 시각이 서로 다르게 전달된다.

### 5. 실제로 작동하는 drill-down만 제공

현재 다음 링크는 수정 대상이다.

- `/bookings?view=live&review=matching`
- `/bookings?view=live&region=...`
- `/partners?availability=ready&region=...`

`view=live`는 Booking view가 아니고, `review=matching`, `region`, `availability`는 현재 대상 parser/load plan이 실제로 적용하지 않는다.

수정 원칙:

1. `Supply shortage` KPI는 지원되는 실제 Booking view로 이동시킨다. 현재 구조에서는 `/bookings?view=matching` 또는 기존 공통 helper가 만드는 동등한 유효 경로를 우선 사용한다.
2. `Stale active records`는 실제 `/bookings?view=data-anomaly` 또는 `/bookings?view=matching-delays&sla=overdue&sort=oldest` 중 판정 의미와 일치하는 경로를 사용한다.
3. 지역별 Booking/Partner 필터가 이미 API와 UI에 재사용 가능한 형태로 존재하면 region code를 end-to-end로 연결하고 대상 화면에 active filter chip을 보여라.
4. 재사용 가능한 region filter가 없다면 이 작업에서 큰 신규 지역 검색 체계를 만들지 않는다.
   - 거짓 `Open affected bookings`와 `View Partner availability` 링크는 제거한다.
   - 대신 Vietnam Overview 내부의 실제 region focus 링크 `?view=live&region=<code>#vietnam-operating-map`를 제공하거나 action을 표시하지 않는다.
5. count가 0인 행에는 `Open affected bookings` 같은 행동을 절대 표시하지 않는다.
6. 링크 테스트는 href 문자열만 검사하지 말고 대상 parser/load plan이 그 값을 실제 API request에 반영하는지 검증한다.

수용 기준:

- Supply shortage 클릭 후 Booking 화면에서 Matching 관련 유효 view가 활성화돼 있다.
- 지원하지 않는 query parameter가 남아 있지 않다.
- region filtering을 구현했다면 대상 화면에 region chip과 서버 request parameter가 모두 보인다.
- region filtering을 구현하지 않았다면 해당 외부 drill-down 링크가 렌더링되지 않는다.

### 6. 지도 마커 중첩과 밀집 해결

현재 동일 좌표의 `IN_SERVICE`와 `OPEN_MATCHING` 마커는 포인터로 아래 항목을 선택하기 어렵고, 보조 레이어를 켜면 약 50개 마커가 HCM에 겹친다.

현재 MapLibre 안에서 다음을 구현해라.

1. 완전히 동일하거나 사실상 동일한 좌표는 하나의 집계 marker로 표시한다.
2. 집계 marker에는 `2 records`, `3 records`처럼 count를 표시하고 클릭/Enter 시 해당 레코드 목록을 선택할 수 있게 한다.
3. 다수 레코드 또는 낮은 zoom에서는 MapLibre GeoJSON source clustering을 사용한다. 새 dependency를 추가하지 않는다.
4. cluster를 확대하거나 목록을 열어 모든 개별 레코드에 포인터와 키보드로 접근할 수 있어야 한다.
5. 현재 방향키/Home/End roving tabindex와 popup close 후 focus return 동작을 유지한다.
6. 표본 chip과 popup이 겹치지 않게 한다. 가장 단순한 해결은 표본 안내를 지도 내부 absolute chip에서 section toolbar/description으로 옮기는 것이다.
7. 마커 status raw code를 운영 문구로 변환한다.
   - `OPEN_MATCHING` → `Needs matching`
   - `MATCHED` → `Matched`
   - `PROVIDER_ON_THE_WAY` → `Partner on the way`
   - `ARRIVED` → `Partner arrived`
   - `IN_SERVICE` → `Service in progress`

반드시 확인할 상호작용:

- 동일 좌표의 서로 다른 예약을 마우스로 각각 열 수 있다.
- 키보드만으로 cluster/집계 목록과 개별 상세 링크에 접근할 수 있다.
- 50개 신호를 켜도 한 지점이 개별 DOM marker 50개로 가려지지 않는다.
- popup이 표본 안내나 layer panel 아래에 가려지지 않는다.

### 7. 레이어 메뉴를 운영 순서로 정리

기본 지도는 공급 결정에 필요한 신호만 보여라.

권장 그룹:

1. `Live coverage`
   - Needs supply
   - Ready Partners
   - Matched / in service
2. `Investigate`
   - Busy Partners
   - Partner location unavailable/stale
   - Offline Partners
3. `Customer context`
   - Customers active in last 30 days
   - Saved customer locations

요구사항:

- 기본 on 상태는 `Needs supply + Ready Partners`로 한다.
- `Offline Partners`, customer saved location 등 조사 레이어는 기본 off로 둔다.
- `Operational layers are on by default`를 실제 동작과 맞는 `Default: Needs supply + Ready Partners`로 바꾼다.
- 7개 레이어를 항상 지도 위에 펼쳐 놓지 않는다. 기존 component로 구현 가능한 `Layers (N on)` trigger + popover/details를 사용해 지도 판독 면적을 확보한다.
- 새 popover framework를 추가하지 않는다. 기존 Admin control/details 패턴을 먼저 찾는다.
- `aria-pressed`, 명확한 active indicator, `Reset layers`, URL의 bookmarkable `signals` 상태를 유지한다.
- URL의 예전 signal key가 있으면 안전하게 normalize하거나 기존 bookmark를 가능한 범위에서 호환한다.

### 8. Regional sample과 fallback 목록 정리

Regional table:

- sample이라는 범위 고지는 유지한다.
- 표본 수치가 있는 지역과 실제 possible shortage 지역을 먼저 표시한다.
- 모든 값이 0인 지역은 `Show N regions with no sampled records` 아래로 접거나 기본 숨김 처리한다.
- `Sample only` 대신 `No sampled live records`처럼 0이 전체 0을 뜻하지 않는다는 문구를 사용한다.
- `Potential gap in sample`은 새 `needsSupplyNowCount`와 `readyPartnerCount`를 기준으로 계산한다.
- 실제 동작하지 않는 반복 action 16개를 제거한다.

Mapped records fallback:

- 긴 marker aria-label을 화면 링크 문구로 그대로 재사용하지 않는다.
- 기존 Admin table/list component를 재사용해 최소한 다음 정보를 분리한다.
  - Record
  - Operational state
  - Region
  - State age 또는 location freshness
  - Action
- stale record에는 warning badge를 표시한다.
- 지도 타일 오류가 발생해도 목록은 계속 사용할 수 있어야 한다.

### 9. Live 데이터 요청 중복 제거

현재 Live 페이지는 summary와 realtime feed를 동시에 호출하고 양쪽에서 customer/Partner/active booking sample을 중복 조회한다. summary는 Live에 필요 없는 period metrics도 계산한다.

최종 상태에서 다음 조건을 만족시켜라.

- Live 진입 시 customer/Partner/active booking sample DB query를 중복 수행하지 않는다.
- Live KPI와 map marker는 같은 snapshot/generatedAt을 사용한다.
- Period mode는 기존 period summary 동작을 유지한다.
- 가장 작은 호환 가능한 방법을 선택한다.
  - 우선안: realtime Live response에 필요한 exact Live totals와 regional Live sample을 포함하고 Live mode는 한 endpoint만 사용
  - 대안: 기존 builder에 Live 전용 scope를 추가하되, 중복 sample query가 남지 않게 공유하거나 한쪽을 제거
- response와 caller가 하나뿐인 값을 위해 새 repository/service abstraction을 만들지 않는다.
- `Feed available`만 표시하지 말고 generated/freshness가 기존 페이지 status에서 일관되게 확인되게 한다.

관련 API 테스트로 Live와 Period query plan의 의미가 분리되는지 검증한다.

### 10. 작은 시각·문구 개선

P0/P1이 완료된 뒤 다음을 적용해라.

- document metadata title: `Vietnam Overview | HANDS Admin`
- raw status code 대신 기존 StatusBadge tone과 운영 문구 사용
- Dark theme에서 기존 대비를 유지한다. 별도 유료/외부 tile style 계약이 없다면 지도 스타일을 새로 추가하지 않는다.
- 레이어 패널, popup, fallback list에 기존 radius/color/type token을 사용한다.
- 과도한 gradient, 장식 icon, 신규 시각 언어를 만들지 않는다.
- `Refresh`, Live/Period segmented control, generated/timezone status는 유지한다.

### 11. 테스트와 브라우저 검증

구현 후 최소한 다음을 실행해라.

```powershell
npm.cmd exec --workspace @massage-vn/admin-web -- vitest run --config vitest.config.mts app/vietnam-overview
npm.cmd exec --workspace @massage-vn/api -- vitest run --config vitest.config.mts src/admin/admin.service.spec.ts -t "Vietnam overview"
```

변경한 shared Booking/Partner filter 또는 model에 더 작은 관련 테스트가 있으면 함께 실행한다. 프로젝트에 이미 정의된 typecheck/lint 명령을 확인하고 변경 파일 범위에 맞는 가장 작은 검증도 실행한다.

로그인된 in-app browser를 사용해 다음을 직접 확인하고 스크린샷을 저장한다.

- 1440×900 Light: 페이지 상단과 기본 지도
- 1440×900 Light: layer menu open
- 1440×900 Light: 동일 좌표 집계/cluster open
- 1440×900 Light: Regional sample과 Mapped records
- 1440×900 Dark: 지도와 popup
- 1600×900 Light: 전체 상단과 지도

1024px 이하 viewport는 열거나 검사하지 않는다.

브라우저 수용 기준:

- body 가로 overflow 없음
- KPI가 `Needs supply / Ready / Supply shortage` 의미로 일치
- stale active records가 별도 경고로 보임
- layer state와 Reset이 정상 동작하고 URL에 유지됨
- cluster/동일 좌표 레코드를 마우스와 키보드로 모두 선택 가능
- popup과 overlay가 겹치지 않음
- 지역의 가짜 drill-down이 없음
- Light/Dark에서 상태와 텍스트가 읽힘
- Period outcomes 진입과 복귀가 정상

### 12. 완료 보고 형식

작업을 완료한 뒤 다음 순서로 짧고 구체적으로 보고해라.

1. 운영 의미가 어떻게 바뀌었는지
2. 변경한 파일
3. 주요 UI 변경
4. API/query 변경과 중복 제거 결과
5. 실행한 테스트 명령과 통과/실패 수
6. 1440/1600 브라우저 검증 결과와 스크린샷 경로
7. 남은 제한 또는 실제 데이터에서 확인이 필요한 점

코드 변경 없이 계획만 제시하고 끝내지 마라. P0 데이터 의미, 실제 링크, 지도 중첩, 테스트, 브라우저 검증까지 완료해라. 다만 region filtering을 새로 만드는 것이 큰 별도 기능이라면 가짜 링크를 제거하는 정직한 최소 구현을 선택하고 완료 보고에 그 이유를 한 줄로 남겨라.

---

## 완료 후 추가 검수용 짧은 프롬프트

구현이 끝난 뒤 별도 Codex 검수에 아래 문장을 사용할 수 있다.

> Vietnam Overview 변경분을 감사 보고서와 비교해 review해라. 특히 `Supply shortage`가 공급이 필요한 예약만 계산하는지, stale active record가 정상 수요와 분리되는지, region/availability 가짜 링크가 사라졌는지, 동일 좌표와 50개 marker를 마우스·키보드로 선택할 수 있는지 확인해라. 1440×900과 1600×900 Light/Dark만 브라우저로 검증하고, 회귀가 있으면 직접 수정한 뒤 관련 테스트를 다시 실행해라. 1024px 이하 화면은 검사하거나 보고하지 마라.
