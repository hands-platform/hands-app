# Codex 실행 프롬프트 — Vietnam Overview 재감사 후 최소 보완

아래 Prompt 전체를 C:\dev\massage-on-demand-vn을 workspace로 연 Codex 작업에 그대로 붙여 넣는다.

---

## Prompt

C:\dev\massage-on-demand-vn의 Admin Web Vietnam Overview를 기존 구조 안에서 최소 범위로 보완하고 재검증하라.

대상:

- http://localhost:3101/vietnam-overview
- http://localhost:3101/vietnam-overview?view=live#vietnam-operating-map
- http://localhost:3101/vietnam-overview?view=period&range=7d

감사 기준 시각은 2026-08-20 ICT, Asia/Ho_Chi_Minh이다.

이 작업의 목적은 새 화면을 설계하는 것이 아니다. 이미 반영된 개선을 보존하면서 운영자가 지도와 KPI를 실제 배정 가능성으로 오해할 수 있는 부분, 지도 좌표·집계의 정확성, Live KPI와 지도 표본의 분류 일관성, Period 화면의 불필요한 조회만 좁게 보완하는 것이다.

### 1. 필수 작업 원칙

1. C:\dev\massage-on-demand-vn\AGENTS.md를 먼저 전부 읽고 따른다.
2. 단일 에이전트로 작업한다. 하위 에이전트나 병렬 에이전트를 만들지 않는다.
3. receiving-code-review skill을 사용한다. 아래 지적을 사실로 가정하지 말고 현재 코드와 실행 결과로 다시 검증한다.
4. 화면 검수에는 browser:control-in-app-browser 또는 프로젝트의 webapp-testing skill을 사용한다.
5. React/Next.js 성능 판단에는 vercel-react-best-practices를 사용한다.
6. 기존 사용자의 dirty worktree를 보존한다. 관련 없는 파일을 수정하지 않는다.
7. 새 패키지를 설치하지 않는다.
8. DB schema, migration, 인증, 권한, 결제, 지갑, 공용 계약을 변경하지 않는다.
9. API contract는 가능한 한 유지한다. 정말 변경해야 하면 caller와 회귀 테스트를 먼저 확인하고 호환 가능한 최소 변경만 한다.
10. MapLibre, 기존 Admin component, 기존 상태 배지, 기존 Booking queue 판정과 matching policy를 재사용한다.
11. 새 디자인 시스템, 새 지도 라이브러리, 새 전역 상태관리, 대규모 컴포넌트 재구성을 만들지 않는다.
12. 1440px 이상 데스크톱만 검수한다. 1024px 이하 화면은 열거나 수정하거나 보고하지 않는다.
13. 로그인되지 않은 브라우저에서는 시각 결론을 내리지 않는다. 로그인 요청 후 실제 화면을 캡처한 다음 UI 수정을 결정한다.
14. 명시적으로 요청받지 않은 git commit은 만들지 않는다.

### 2. 먼저 읽고 추적할 파일

- apps/admin_web/app/vietnam-overview/page.tsx
- apps/admin_web/app/vietnam-overview/vietnam-overview-live-map.tsx
- apps/admin_web/app/vietnam-overview/vietnam-overview-model.ts
- apps/admin_web/app/vietnam-overview/page.spec.tsx
- apps/admin_web/app/vietnam-overview/vietnam-overview-live-map.spec.tsx
- apps/admin_web/app/vietnam-overview/vietnam-overview-model.spec.ts
- apps/admin_web/app/globals.css의 vietnam-overview 및 vietnam-map 관련 규칙
- apps/admin_web/lib/admin-api.ts의 AdminVietnamOverview 타입
- apps/api/src/admin/admin.service.ts의 getVietnamOverview 계열과 buildVietnamOverview
- apps/api/src/admin/admin-booking-list-query.ts
- apps/api/src/admin/admin-booking-list-metadata.ts의 bookingStatusChangedAt
- apps/api/src/matching/matching.policy.ts
- apps/api/src/bookings/bookings.backup-providers.ts
- 관련 caller와 테스트

기준 문서:

- output/vietnam-overview-post-implementation-audit-2026-08-07/vietnam-overview-post-implementation-deep-audit.md
- output/vietnam-overview-post-implementation-audit-2026-08-07/codex-vietnam-overview-improvement-prompt.md

### 3. 수정 전에 제출할 짧은 검증표

아래 각 항목을 confirmed issue, probable issue, recommendation, already correct 중 하나로 분류하라.

각 항목에는 다음을 적는다.

- 정확한 파일과 함수
- 현재 동작
- 재현 또는 정적 근거
- 최소 수정
- 회귀 위험
- 필요한 테스트

코드와 실행 화면이 지적과 다르면 지적을 따르지 말고 근거와 함께 제외한다.

### 4. 반드시 보존할 현재 개선

다음은 현재 코드에서 확인된 개선이므로 회귀시키지 않는다.

- Live operations와 Period outcomes의 한 페이지 내 분리
- Live 진입 시 realtime payload 한 번만 요청하는 구조
- Needs supply now, Ready Partners, Matched / in service, Stale active records 분리
- 상태 시각과 예약 생성 시각의 구분
- 고객 활동 시각과 저장 위치 시각의 구분
- 지원하지 않는 region/availability 외부 필터 링크 제거
- 지도 레이어의 URL 보존과 Reset layers
- 지도 실패 시 Mapped records 대체 목록 유지
- exact coordinate aggregate 의도와 MapLibre clustering 의도
- 운영 문구로 변환된 booking 상태
- Vietnam Overview | HANDS Admin 문서 제목
- Asia/Ho_Chi_Minh 시간대
- 기존 Light/Dark 테마와 Admin UI 토큰

### 5. P1 — Supply shortage 의미를 실제 matchability와 혼동하지 않게 수정

현재 totals.supplyShortageCount는 전국 needsSupplyNowCount에서 전국 readyPartnerCount를 단순 차감한다. 그러나 실제 matching은 최소한 다음 조건을 사용한다.

- booking과 Partner 거리 또는 matching radius
- Partner가 제공 가능한 service
- Partner readiness와 위치 freshness
- 기존 matching/participation 정책

따라서 Hanoi의 Ready Partner가 HCMC의 booking 부족을 상쇄하거나, 해당 서비스를 제공하지 못하는 Partner가 공급으로 계산될 수 있다. 이 숫자를 Supply shortage 또는 Assignable coverage라고 단정하면 운영 판단이 틀릴 수 있다.

다음 순서로 처리하라.

1. 기존 matching 또는 booking 코드에 booking별 eligible candidate 수나 동일 의미의 재사용 가능한 read model이 있는지 먼저 찾는다.
2. 이미 존재하고 작은 범위로 재사용할 수 있으면 그것을 사용해 uncovered booking 수를 계산한다.
3. 재사용 가능한 근거가 없다면 이 작업에서 새 matching engine이나 무거운 공간 집계를 만들지 않는다.
4. 그 경우 전국 단순 차감 값은 National ready balance처럼 의미를 축소하고, helper에 service/radius matchability를 의미하지 않는다고 명시한다.
5. 운영자가 실제 조치해야 할 핵심 KPI는 Needs supply now와 기존 Matching 또는 No supply queue로 유지한다.
6. 지역 sample의 shortage도 같은 한계를 갖는다. 실제 eligible supply가 아니라면 Potential sample balance처럼 정직하게 표시한다.
7. 기존 totals field를 다른 caller가 사용하면 호환을 유지하되, Admin UI에서 과장된 의미를 제거한다.

수용 기준:

- 서로 다른 지역의 수요와 공급이 상쇄돼도 화면이 이를 실제 배정 가능 공급으로 표현하지 않는다.
- 서비스가 맞지 않는 Partner 수가 booking의 assignable supply로 설명되지 않는다.
- KPI helper만 읽어도 전국 단순 수량 균형인지 실제 matching coverage인지 구분된다.
- 유효한 Booking queue 이동은 유지된다.

필수 테스트:

- HCMC 수요 1, Hanoi Ready Partner 1인 fixture가 실제 shortage 0으로 오해되는 문구를 만들지 않는다.
- 서로 다른 service의 booking과 Partner가 assignable coverage로 합쳐지지 않거나, 계산을 유지할 경우 UI 문구가 명확히 한계를 고지한다.

### 6. P1 — Exact totals와 지도/지역 sample의 booking 분류를 일치시켜라

현재 Prisma exact totals는 adminBookingListWhere와 adminBookingListStatusGroupWhere를 사용한다. 반면 realtime sample 반복문은 별도 JavaScript 조건으로 matching delay를 판정한다.

확인할 불일치:

- canonical matching-delays 판정은 openedAt을 사용하지만 sample 분류는 createdAt을 사용한다.
- canonical participant 조건은 respondedAt과 JOINED/ACCEPTED를 함께 보지만 sample 분류는 status만 본다.
- 이 차이로 상단 KPI는 정상 수요인데 같은 booking marker는 stale로 보이거나 반대가 될 수 있다.

요구사항:

1. 기존 queue 정책을 기준으로 exact totals와 in-memory sample이 같은 분류 규칙을 사용하게 한다.
2. 큰 repository abstraction을 만들지 않는다.
3. 이미 있는 pure metadata/helper에 최소한의 공통 분류 함수를 둘 수 있는지 먼저 검토한다.
4. needs supply, assigned/in service, stale active는 서로 배타적이어야 한다.
5. stale 이유가 matching delay인지 data anomaly인지 가능하면 API 내부에서 구분하되, 새 외부 contract가 불필요하면 내부 분류와 테스트만 보강한다.

필수 테스트:

- createdAt은 오래됐지만 openedAt은 임계값 안인 OPEN_MATCHING booking
- openedAt이 임계값을 넘고 응답한 Partner가 없는 booking
- JOINED/ACCEPTED 상태와 respondedAt 조합의 경계 사례
- exact total 분류와 realtime point kind의 일치
- 세 범주의 합이 activeBookingCount와 일치하고 중복 집계되지 않음

### 7. P1 — 서로 다른 실제 위치를 한 aggregate marker로 합치지 마라

groupPointsByCoordinate는 위도·경도를 소수 둘째 자리로 반올림한 문자열을 key로 사용한다. Vietnam 위도에서 같은 0.01도 bucket은 서로 약 1km 이상 떨어진 신호까지 한 위치로 합칠 수 있다.

요구사항:

1. exact 또는 사실상 동일 위치만 묶는다.
2. 기존 값이 일반 GPS 정밀도라면 소수 5자리 수준 또는 명시적인 매우 작은 거리 허용치처럼 운영 위치를 왜곡하지 않는 기준을 사용한다.
3. 약 100m 이상 떨어진 booking/Partner를 같은 위치라고 표시하지 않는다.
4. 새 geo dependency를 추가하지 않는다.
5. proximity clustering과 exact-coordinate aggregation을 구분한다. 가까운 점은 zoom cluster가 담당하고 같은 위치 목록은 aggregate marker가 담당한다.

필수 테스트:

- 완전히 같은 좌표 두 건은 한 aggregate가 된다.
- 약 20m 이상 떨어진 좌표는 별도 group으로 남는다.
- 기존 소수 둘째 자리 bucket에는 같지만 실제로 수백 m 떨어진 좌표는 합쳐지지 않는다.

### 8. P2 — GeoJSON layer와 DOM marker의 중복 렌더링 및 hit target을 정리

현재 구현은 같은 coordinate group을 GeoJSON source/layer와 DOM Marker 양쪽에 모두 그린다. coordinateGroups가 20개 이하이면 DOM marker가 숨겨지지 않으므로 파란 unclustered circle과 의미별 DOM marker가 동시에 보일 수 있다. 20개 초과에서도 zoom 조건에 따라 같은 문제가 재발할 수 있다.

요구사항:

1. 한 zoom 상태에서 같은 record/group은 하나의 주 시각 표식과 하나의 명확한 hit target만 가진다.
2. cluster가 표시되는 동안 cluster에 포함된 DOM marker만 숨긴다.
3. cluster에 포함되지 않은 개별 group은 계속 선택 가능해야 한다.
4. cluster가 해제되면 의미별 marker 색과 aggregate count가 복원돼야 한다.
5. cluster click은 확대만 하고 끝나지 말고 결국 개별 record 또는 동일 위치 목록에 도달할 수 있어야 한다.
6. pointer로 파란 원과 DOM marker가 겹쳐 서로 다른 동작을 하지 않게 한다.
7. map.fitBounds의 right padding 330이 이전 지도 내부 패널을 위한 잔재인지 확인한다. 현재 layer menu가 toolbar로 이동했다면 불필요한 오른쪽 여백을 줄인다.

필수 브라우저 확인:

- 20개 이하 기본 상태에서 이중 점이 보이지 않는다.
- 20개 초과 national zoom에서 cluster와 독립 marker가 올바르게 구분된다.
- 확대 후 모든 개별 record에 도달한다.
- popup과 layer menu가 서로 가리지 않는다.

### 9. P2 — Cluster와 지도 작업의 키보드 경로를 검증하고 보완

현재 20개 초과, zoom 9 이하에서는 DOM marker button 전체를 hidden 처리한다. MapLibre canvas cluster에는 별도 keyboard handler가 없으므로 지도 안의 cluster 탐색은 pointer 중심이 된다.

요구사항:

1. keyboard-only 운영자가 모든 record action에 도달할 수 있어야 한다.
2. Mapped records 표를 공식 대체 경로로 유지한다.
3. cluster 자체를 키보드로 조작 가능하게 만들 수 없다면 지도 toolbar에서 해당 record list로 이동하는 명확한 링크 또는 버튼과 설명을 제공한다.
4. 숨겨진 marker가 tab order에 남거나 focus가 사라지지 않게 한다.
5. popup close 후 focus return, Home/End, 방향키 marker 이동을 회귀시키지 않는다.
6. 접근성 향상을 위해 새 component framework를 추가하지 않는다.

수용 기준:

- 마우스를 사용하지 않고 현재 선택 레이어의 모든 booking/customer/Partner 상세 링크에 도달한다.
- focus가 숨겨진 marker로 이동하지 않는다.
- focus indicator가 layer menu 또는 popup에 가려지지 않는다.

### 10. P2 — Regional sample의 숨김 기준과 문구를 실제 데이터와 맞춰라

현재 visibleRegions는 needs supply, assigned, stale booking, ready Partner만 합산한다. customer, busy Partner, offline Partner, stale-location Partner 신호만 있는 지역은 숨겨지지만 접힘 문구는 no sampled live records라고 표시한다.

또한 region query가 직접 들어온 focused region의 핵심 count가 모두 0이면 해당 행도 사라질 수 있다.

요구사항:

1. activeRegion이 있으면 0 sample이어도 그 지역 행을 보여 주고 No sampled coverage records로 명확히 표시한다.
2. 숨김 기준을 모든 mapped signal count에 맞추거나, 표의 목적을 live coverage records로 좁혀 copy를 맞춘다.
3. 실제 customer/offline signal이 있는 지역을 no sampled live records라고 표현하지 않는다.
4. 0은 전국 실제 0이 아니라 bounded sample 0임을 유지한다.
5. 외부 region filter가 실제로 지원되지 않는 Booking/Partners 링크는 다시 만들지 않는다.

필수 테스트:

- focused zero-count region이 행에서 사라지지 않는다.
- customer-only 또는 offline-only region의 접힘 문구가 사실과 일치한다.
- 비어 있는 지역에도 가짜 drill-down action이 생기지 않는다.

### 11. P2 — Period outcomes에서 사용하지 않는 Live 조회를 제거

현재 getVietnamOverviewSummary는 includePeriodMetrics true, includeRealtimePoints false로 buildVietnamOverview를 호출한다. 그러나 buildVietnamOverview는 Period에서도 customer sample, provider sample, active booking sample과 여러 live exact count를 수행한다. Period UI는 completed, canceled, cancellation share, paid volume과 regional closed outcome sample만 사용한다.

요구사항:

1. Period 화면에서 사용하지 않는 customer/provider/live booking sample 조회와 live exact count를 식별한다.
2. 기존 응답 contract를 깨지 않는 가장 작은 query plan 분리를 적용한다.
3. getVietnamOverview legacy caller가 있다면 그 동작은 유지한다.
4. 한 값 때문에 새 repository/service 계층을 만들지 않는다.
5. Period exact national metrics와 bounded regional outcome sample의 의미는 유지한다.
6. Live endpoint의 단일 authoritative payload를 회귀시키지 않는다.

필수 테스트:

- Live endpoint가 period booking query를 수행하지 않는다.
- Period summary가 active booking sample query를 수행하지 않는다.
- Period summary가 사용하지 않는 customer/provider sample query를 수행하지 않는다.
- Today, 7d, 30d, all의 기존 period 결과가 유지된다.
- bounded paid volume은 계속 Unavailable로 정직하게 표시된다.

### 12. P3 — 화면에서 확인 후에만 적용할 작은 정리

다음은 코드만으로 즉시 결함으로 확정하지 않는다. 로그인된 실제 화면에서 불편이 재현될 때만 수정한다.

- 페이지 freshness 영역과 Operating map의 Generated badge가 같은 시각을 중복 표시하는지
- stale active records 하나에 Matching delays와 Data anomalies 링크 두 개가 동시에 노출돼 다음 행동이 모호한지
- region focus chip의 top 118px가 불필요하게 지도 중앙을 가리는지
- sampleCopy가 region/layer filter 후 실제 표시 수로 오해되는지
- Layers details가 열린 상태에서 지도와 popup을 과도하게 가리는지
- 1980px에서 지도와 지역 표 사이 정보 밀도가 지나치게 낮거나 넓게 퍼지는지

수정하더라도 기존 Admin spacing, typography, radius, color token 안에서 copy와 배치만 최소 조정한다.

### 13. 로그인된 실제 브라우저 검수

코드 수정 전에 before 캡처를 만들고, 수정 후 동일 상태에서 after 캡처를 만든다.

필수 viewport:

- 1440×1000
- 1980×1100

1024px 이하 화면은 검사하지 않는다.

필수 상태:

1. Live 기본 화면 상단과 Operating map
2. Layers 메뉴 open
3. Needs supply + Ready Partners 기본 레이어
4. 모든 조사/고객 레이어를 켠 밀집 상태
5. 같은 좌표 aggregate popup
6. national zoom cluster와 확대 후 개별 marker
7. Mapped records 펼침
8. region focus가 있는 지도
9. sample 0인 region focus
10. Period outcomes Today
11. Period outcomes 7 days
12. Dark theme 지도와 popup

각 상태에서 확인:

- body 가로 overflow 없음
- KPI 의미와 API 값 일치
- 지도 marker 수, layer count, Mapped records 수의 설명 가능성
- 이중 marker 또는 이중 hit target 없음
- mouse와 keyboard로 상세 도달 가능
- URL의 view, range, region, signals 상태 보존
- Refresh 후 동일 상태 유지
- popup, layer menu, focus chip 겹침 없음
- Vietnam 시간대와 문구 일관성
- raw enum이나 비베트남 지역·시간대 문구 없음

시각 문제가 재현되지 않으면 선호도 차이로 분류하고 수정하지 않는다.

### 14. 구현 순서

한꺼번에 넓게 수정하지 말고 아래 순서로 진행한다.

1. 현재 화면과 API를 캡처하고 검증표 작성
2. Supply shortage 의미 수정
3. exact/sample booking 분류 일치
4. coordinate grouping 정밀도 수정
5. 중복 marker/cluster 상호작용 수정
6. keyboard 대체 경로 검증
7. regional sample 0/숨김 문구 수정
8. Period query plan 최소화
9. 실제 화면에서 재현된 P3만 수정
10. focused test
11. 1440/1980 before/after 비교
12. Admin/API scope verification

각 단계가 끝날 때 관련 작은 테스트를 먼저 실행하고 다음 단계로 넘어간다.

### 15. 검증 명령

프로젝트의 실제 package script를 확인한 뒤 최소한 다음을 실행한다.

~~~powershell
npm.cmd exec --workspace @massage-vn/admin-web -- vitest run --config vitest.config.mts app/vietnam-overview
npm.cmd exec --workspace @massage-vn/api -- vitest run --config vitest.config.mts src/admin/admin.service.spec.ts -t "Vietnam overview|Vietnam realtime|saved customer|partner map dots"
npm.cmd run verify:admin:fast
npm.cmd run verify:scope -- -Scope api
~~~

API scope 전체 검증이 기존 사용자 변경 때문에 실패하면 실패를 숨기지 말고 이번 변경과의 관련성을 구분한다. 테스트를 통과시키기 위해 관련 없는 기존 변경을 되돌리지 않는다.

### 16. 완료 조건

다음 조건이 모두 충족돼야 완료다.

- 전국 단순 수량 차이가 실제 assignable supply로 과장되지 않음
- exact totals와 realtime marker가 같은 booking을 같은 운영 범주로 분류
- 수백 m 이상 떨어진 좌표가 같은 aggregate location으로 합쳐지지 않음
- 같은 record의 GeoJSON dot와 DOM marker가 중복 표시되지 않음
- cluster 이후 모든 record에 pointer와 keyboard 대체 경로로 도달 가능
- focused zero-sample region이 운영자에게 정직하게 설명됨
- Period 화면이 사용하지 않는 Live read를 수행하지 않음
- 기존 Live/Period 전환, URL 상태, fallback list, Light/Dark가 유지됨
- 1440×1000과 1980×1100 실제 캡처 확인 완료
- 관련 focused test와 scope verification 결과 기록

### 17. 완료 보고 형식

다음 순서로 보고하라.

1. 최종 판정
2. 검증 결과와 제외한 지적
3. 운영 의미 변경
4. 변경 파일
5. API/query 변경
6. 지도와 접근성 변경
7. 테스트 명령과 pass/fail/skipped 수
8. 1440/1980 before/after 스크린샷 경로
9. protected area 변경 여부
10. 남은 실제 데이터 위험
11. 다음 한 가지 권장 작업

각 변경에는 왜 필요한지와 회귀 위험을 짧게 적는다. 구현하지 않은 recommendation을 완료된 수정처럼 쓰지 않는다.

---

## 짧은 재감사 프롬프트

구현 완료 후 별도 Codex 작업에서 다음을 사용한다.

> C:\dev\massage-on-demand-vn의 Vietnam Overview 변경분을 읽기 전용으로 재감사하라. 이전 지적을 사실로 가정하지 말고 코드, API query plan, focused test, 로그인된 실제 화면을 교차 검증하라. 특히 전국 수요와 Ready Partner 단순 차감이 actual matchability로 표현되지 않는지, exact totals와 realtime marker 분류가 일치하는지, 서로 수백 m 떨어진 좌표가 aggregate로 합쳐지지 않는지, GeoJSON dot와 DOM marker가 중복되지 않는지, cluster 이후 keyboard 대체 경로가 있는지, focused zero-sample region이 정직하게 표시되는지, Period 화면이 불필요한 Live query를 수행하지 않는지 확인하라. 1440×1000과 1980×1100만 검사하고 1024px 이하 화면은 보고서에서 완전히 제외하라. 파일은 수정하지 말고 P0/P1/P2/P3, confirmed/probable/recommendation/preference를 구분한 보고서만 작성하라.
