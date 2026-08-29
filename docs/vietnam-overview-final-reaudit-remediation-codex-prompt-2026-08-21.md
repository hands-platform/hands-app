# HANDS Vietnam Overview 최종 재감사 수정 프롬프트

아래 전체 내용을 새 Codex 작업에 그대로 전달하라.

---

## 역할과 목표

`C:\dev\massage-on-demand-vn`의 HANDS Admin `Vietnam Overview` 페이지를 최종 재감사 보고서에 따라 **검증 후 최소 범위로 수정하고 재검증**하라.

대상 페이지:

- `http://localhost:3101/vietnam-overview`
- `http://localhost:3101/vietnam-overview?view=period&range=today`
- `http://localhost:3101/vietnam-overview?view=period&range=7d`
- region 및 `signals` query를 사용하는 Live 하위 상태

기준 보고서:

- `C:\dev\massage-on-demand-vn\output\vietnam-overview-final-reaudit-2026-08-21\vietnam-overview-final-deep-reaudit.md`

기준 시각:

- 2026-08-21 ICT
- `Asia/Ho_Chi_Minh`

목표는 새 화면을 설계하거나 대규모 구조를 바꾸는 것이 아니다. 현재 개선된 운영 흐름을 보존하면서 다음을 달성하는 것이다.

1. Live와 Period 사이의 전환 오류 제거
2. 운영 지도와 KPI에서 fixture 데이터 제거
3. KPI와 지도 marker의 운영 분류 일치
4. 공급 수치의 의미를 실제 계산 범위에 맞게 정직하게 표현
5. 좌표 aggregate와 cluster의 정확성 회복
6. popup, regional sample, Period 결과의 운영 편의성 개선
7. 사용하지 않는 Period 쿼리 제거
8. 관련 회귀 테스트와 1440px 이상 실제 화면 검증

## 반드시 사용할 작업 원칙

먼저 `receiving-code-review` skill을 사용하라.

필요한 범위에서만 다음 skill을 사용하라.

- `vercel-react-best-practices`: React effect lifecycle, Next.js client navigation, bundle 경계 검토
- `webapp-testing` 또는 로그인 세션이 있는 Browser skill: 실제 화면·상호작용·스크린샷 검증
- `ui-ux-pro-max`: popup, table density, focus visibility 같은 확인된 UI 문제의 최소 수정

단일 agent로 작업하라. subagent, worker, handoff, multi-agent 기능을 사용하지 마라.

## 절대 제약

1. `C:\dev\massage-on-demand-vn`만 사용한다.
2. `C:\dev\massage-vn-workspace`는 검사하거나 수정하지 않는다.
3. 먼저 분석하고 각 finding을 현재 코드에서 다시 검증한다.
4. 보고서의 지적을 사실로 가정하거나 맹목적으로 구현하지 않는다.
5. 확인된 항목만 수정한다. 코드와 보고서가 다르면 현재 코드와 재현 증거를 우선한다.
6. 기존 business flow, API contract, DB compatibility, frontend/backend integration을 보존한다.
7. DB schema와 migration을 변경하지 않는다.
8. 새 API endpoint나 외부 API contract를 만들지 않는다.
9. MapLibre를 교체하지 않는다.
10. 새 패키지, 지도 라이브러리, geo dependency, 상태관리 라이브러리를 설치하지 않는다.
11. 대규모 refactor, 파일 재배치, 이름 일괄 변경, 디자인 시스템 교체를 하지 않는다.
12. 관련 없는 파일이나 기존 사용자 변경을 수정·정리·되돌리지 않는다.
13. 현재 working tree가 dirty여도 사용자 변경을 보존한다.
14. `git reset --hard`, `git checkout --`, 무단 삭제를 사용하지 않는다.
15. 명시적으로 요청받지 않은 commit을 만들지 않는다.
16. 1440px 이상 데스크톱만 검수한다.
17. 1024px 이하 화면과 모바일 디자인은 열거나 수정하거나 보고하지 않는다.
18. Dark raster 밝기처럼 `preference`로 분류된 항목은 자동 수정하지 않는다.
19. 테스트를 통과시키기 위해 production behavior를 테스트의 잘못된 기대에 맞추지 않는다.
20. 한 단계씩 수정하고 단계마다 관련 테스트를 실행한다.

## 반드시 보존할 현재 개선

다음 동작은 회귀시키지 마라.

- Live operations / Period outcomes를 한 페이지 안에서 전환하는 IA
- Live가 realtime payload 하나만 요청하는 구조
- Needs supply / Ready Partners / Matched or in service / Stale active records 구분
- 예약 상태 시각과 예약 생성 시각 구분
- 고객 활동 시각과 저장 위치 시각 구분
- Booking/Partner의 지원하지 않는 외부 region filter 링크를 만들지 않는 원칙
- 내부 `Focus on map` 동작
- `signals`, `region`, `range`, `view` URL 상태 보존
- Reset layers
- Mapped records 키보드 대체 경로
- 운영 상태를 raw enum 대신 운영 문구로 표시하는 구조
- popup Escape 닫기와 닫은 후 marker focus return
- `Asia/Ho_Chi_Minh` 시간대
- bounded Period paid volume을 `Unavailable`로 표시하는 정직한 계약
- 기존 Admin component, spacing, typography, color token, Light/Dark theme

## 0단계 — 수정 전 검증

다음 파일을 먼저 읽고 실제 caller와 테스트를 추적하라.

- `AGENTS.md`
- 기준 보고서 전체
- `apps/admin_web/app/vietnam-overview/page.tsx`
- `apps/admin_web/app/vietnam-overview/vietnam-overview-live-map.tsx`
- `apps/admin_web/app/vietnam-overview/vietnam-overview-model.ts`
- `apps/admin_web/app/vietnam-overview/page.spec.tsx`
- `apps/admin_web/app/vietnam-overview/vietnam-overview-live-map.spec.tsx`
- `apps/admin_web/app/vietnam-overview/vietnam-overview-model.spec.ts`
- `apps/admin_web/app/vietnam-overview/vietnam-overview-map-tooltip-css.spec.tsx`
- `apps/admin_web/app/globals.css`의 Vietnam/MapLibre 관련 규칙
- `apps/admin_web/lib/admin-api.ts`의 Vietnam Overview type
- `apps/admin_web/app/layout.tsx`의 metadata title template
- `apps/api/src/admin/admin.service.ts`의 Vietnam Overview와 production-data predicate
- `apps/api/src/admin/admin-booking-list-query.ts`
- `apps/api/src/admin/admin-booking-list-metadata.ts`
- `apps/api/src/bookings/bookings.backup-providers.ts`
- 관련 caller와 테스트

수정 전 다음을 기록하라.

1. `git branch --show-current`
2. `git status --short`
3. 시작 status 항목 수
4. 관련 파일의 기존 diff
5. 로컬 Admin/API 상태

보고서의 VO-01~VO-14를 다음 중 하나로 다시 분류한 짧은 검증표를 먼저 작성하라.

- confirmed issue
- probable issue
- recommendation
- preference
- already fixed
- not applicable

각 항목에는 정확한 파일/함수, 현재 근거, 최소 수정, 회귀 위험, 필요한 테스트를 포함한다.

검증표를 작성한 뒤 명확한 confirmed issue는 별도 승인 대기 없이 아래 순서로 수정한다. 다만 DB schema/API contract 변경이 실제로 필요하거나 보고서와 현재 코드가 충돌하면 구현을 멈추고 근거를 보고한다.

## 1단계 — VO-01 Live → Period 전환 crash

### 확인할 현재 증상

Live에서 `Period outcomes`를 클릭하면 전체 페이지가 다음 오류로 중단된다.

```text
TypeError: Cannot read properties of undefined (reading 'getLayer')
```

직접 Period URL을 새로 열면 정상 렌더된다.

### 원인 후보

- map mount effect cleanup이 `map.remove()` 후 `mapRef.current = null`을 수행한다.
- layer effect cleanup이 이미 제거된 map에 `off`, `getLayer`, `getSource`를 호출한다.

### 요구사항

1. 실제 cleanup 순서를 component lifecycle test 또는 브라우저 로그로 다시 확인한다.
2. 두 effect를 광범위하게 재작성하지 않는다.
3. layer cleanup이 이미 제거되거나 더 이상 current가 아닌 map에 접근하지 않도록 최소 guard를 추가한다.
4. 정상적인 layer 변경과 region focus 재마운트 cleanup은 계속 수행돼야 한다.
5. 오류를 `try/catch`로 숨기지 않는다.
6. cleanup 후 listener, marker, popup, source, layer가 중복으로 남지 않아야 한다.

### 필수 테스트

- MapLibre mock의 실제 mount/unmount
- Live → Period
- Period → Live
- Live → Period → Live 반복
- browser back/forward
- region focus 변경
- 빠른 연속 모드 클릭
- browser console error 0건

이 단계가 통과하기 전에는 다음 단계로 넘어가지 마라.

## 2단계 — VO-02 / VO-11 fixture 및 profile lifecycle scope

### 현재 문제

Booking query는 production-data predicate를 사용하지만 customer/provider sample과 exact count는 무필터로 조회한다. 실제 화면에 다음과 같은 레코드가 보였다.

- `Smoke Referral Claim Partner`
- `Smoke Referral Parent Partner`
- `Smoke Referral Referred Partner`
- `Smoke Partner`
- `audit_...` profile

### 요구사항

1. 기존 함수를 재사용한다.
   - `adminCustomerProductionDataWhere()`
   - `adminProviderProductionDataWhere()`
2. 새 fixture 판별 체계를 만들지 않는다.
3. customer/provider sample `findMany`, exact `count`, ready-provider 후보가 같은 production scope를 사용하게 한다.
4. Vietnam current coverage에서는 `deletedAt != null` Provider를 제외한다.
5. `blockedAt != null` Provider는 Ready뿐 아니라 current operating coverage와 offline/busy signal에서도 제외한다. 제재·차단 조사는 Partner Controls의 책임이며 Vietnam coverage 수치로 세지 않는다.
6. production profile은 유지한다.
7. Booking의 기존 production predicate를 회귀시키지 않는다.
8. filtering 후 sample source count와 actual returned points의 의미를 다시 검증한다.

### 필수 테스트

- fixtureKind, fixtureRunId, fixtureExpiresAt 제외
- `smoke`, `seed-`, `audit_`, demo profile 제외
- deleted Provider 제외
- blocked Provider 제외
- production customer/provider 유지
- sample과 exact totals의 scope 일치
- 기존 테스트의 `findMany`에 `where`가 없어야 한다는 잘못된 기대 제거
- 실제 Mapped records에 fixture 이름 0건

## 3단계 — VO-04 exact totals와 marker 분류 일치

### canonical 기준

`adminBookingListStatusGroupWhere('matching-delays')`가 기준이다.

다음 의미를 보존한다.

- matching age는 `openedAt` 기준
- 만료 booking은 `expiresAt`
- participant 응답은 `respondedAt != null`과 JOINED/ACCEPTED를 함께 확인
- data anomaly와 matching delay를 정상 needs-supply와 분리

### 현재 불일치

sample JavaScript는 `createdAt`과 participant status만 사용한다.

### 요구사항

1. sample query가 필요한 field를 모두 select하도록 한다. 특히 `participants.respondedAt`을 포함한다.
2. sample 분류는 canonical queue predicate와 동일한 의미를 사용한다.
3. 큰 repository abstraction을 만들지 않는다.
4. 필요한 경우 작은 pure helper 하나로 분류 의미만 공유한다.
5. needs supply, assigned/in service, stale active는 상호 배타적이어야 한다.
6. 세 범주의 합은 active total과 일치해야 한다.
7. existing queue behavior를 변경하지 않는다.

### 필수 테스트

- createdAt은 오래됐지만 openedAt은 최신인 OPEN_MATCHING booking
- openedAt이 threshold를 넘고 응답 participant가 없는 booking
- JOINED + respondedAt null
- JOINED + respondedAt 있음
- ACCEPTED + respondedAt null/있음
- expiresAt 만료
- data anomaly
- exact total 분류와 realtime point kind 일치
- 세 범주 합계 불변식

## 4단계 — VO-03 공급 KPI 의미 수정

### 현재 문제

`supplyShortageCount = max(needsSupplyNowCount - readyPartnerCount, 0)`은 전국 또는 지역의 단순 수량 차이다. 실제 matching은 service, 거리/radius, 위치 freshness, alert preference 등 추가 조건을 사용한다.

### 구현 원칙

이 작업에서 새 matching engine이나 무거운 공간 집계를 만들지 않는다.

기존 booking별 eligible-candidate read model을 아주 작은 범위로 안전하게 재사용할 수 있다는 것이 명확히 증명되지 않으면, 현재 숫자를 유지하되 UI 의미를 축소한다.

### 요구 문구와 동작

1. 페이지 description에서 `assignable Partner coverage`라는 과장 표현을 제거한다.
2. `Ready Partners` helper는 현재 Ready predicate가 확인하는 조건만 설명한다.
3. `Supply shortage`는 `National count gap` 또는 동일하게 “단순 수량 차이”임이 분명한 label로 변경한다.
4. helper에 service/radius matchability를 의미하지 않는다고 명시한다.
5. 지역 표의 `Shortage`도 `Sample count gap`처럼 의미를 축소한다.
6. `needs=0, ready=0`이면 다음 의미로 표시한다.
   - `No valid matching demand currently needs supply.`
7. needs가 ready보다 많으면 다음 의미를 포함한다.
   - `N more valid matching bookings than ready Partners nationally.`
   - `Count balance only; service and radius eligibility are not evaluated.`
8. action은 기존 valid Matching queue로 유지한다.
9. API field를 불필요하게 rename하거나 contract를 깨지 않는다.

### 필수 테스트

- HCMC 수요 1 + Hanoi Ready Partner 1
- 서로 다른 service 수요/공급
- needs=0, ready=0 copy
- needs>ready copy
- ready>needs copy
- UI에서 `assignable coverage` 또는 실제 matchability로 읽히는 표현 제거

## 5단계 — VO-05 좌표 aggregate 정확성

### 현재 문제

`groupPointsByCoordinate()`가 `toFixed(2)`를 사용해 수백 m~약 1km 떨어진 위치까지 `at this location`으로 합칠 수 있다.

### 요구사항

1. 새 geo dependency를 추가하지 않는다.
2. exact 또는 사실상 동일한 GPS 위치만 aggregate한다.
3. 소수 5자리 또는 동등하게 작은 명시적 tolerance를 사용한다.
4. 20m 이상 떨어진 위치는 별도 group으로 남아야 한다.
5. proximity는 aggregate가 아니라 MapLibre cluster가 처리한다.
6. 함수명, popup copy, 테스트명이 실제 기준과 일치해야 한다.
7. 기존 `toFixed(2)` 존재를 요구하는 source-string 테스트를 삭제하거나 실제 behavior test로 교체한다.

### 필수 테스트

- 완전히 같은 좌표 2건은 aggregate
- 아주 작은 GPS rounding 차이는 의도한 tolerance 안에서 aggregate
- 20m 이상 차이는 별도 group
- 기존 0.01 bucket은 같지만 수백 m 떨어진 좌표는 분리

## 6단계 — VO-06 GeoJSON / DOM marker 중복 제거

### 요구사항

1. 한 zoom 상태에서 한 group은 하나의 주 시각 표식과 하나의 명확한 pointer action만 가져야 한다.
2. coordinate group이 clustering threshold 이하이면 DOM marker만 사용하고 GeoJSON unclustered circle을 중복 표시하지 않는다.
3. threshold 초과 저배율에서는 GeoJSON cluster와 필요한 unclustered feature를 사용한다.
4. 저배율 cluster에 포함된 DOM marker는 tab order와 화면에서 제거한다.
5. cluster에 포함되지 않은 개별 point도 pointer로 상세에 도달할 수 있어야 한다.
6. 확대 후 DOM marker, 의미별 색, aggregate count가 복원돼야 한다.
7. Mapped records를 keyboard-only 공식 대체 경로로 유지한다.
8. `fitBounds`의 right padding 330이 현재 toolbar 구조에 필요한지 확인하고 필요 없으면 기존 일반 padding 수준으로 줄인다.
9. 새 지도 component 체계로 재작성하지 않는다.

### 필수 테스트

- 20개 이하에서 duplicate dot/hit target 0건
- 20개 초과 national zoom에서 cluster와 singleton 구분
- cluster 확대 후 모든 record 도달
- hidden marker가 tab order에 없음
- Mapped records에서 모든 record 도달
- 20+ 실제 운영 데이터가 없으면 DB를 seed하지 말고 component fixture/MapLibre mock으로 검증하고 브라우저 미재현 사실을 명시

## 7단계 — VO-07 aggregate popup

### 요구사항

1. MapLibre close button을 popup 우상단의 absolute control로 복구한다.
2. `top/right`가 실제로 동작하도록 positioning contract를 완성한다.
3. popup과 내부 list의 최대 높이를 map viewport 안에 맞춘다.
4. 1건, 9건, 20건에서 popup 전체와 close action이 shell 안에 있어야 한다.
5. mouse close, outside/map click close, Escape를 모두 확인한다.
6. close 후 marker focus return을 유지한다.
7. popup 내부 scroll이 page scroll을 부당하게 막지 않아야 한다.
8. Mapped records fallback을 제거하지 않는다.

### 필수 테스트와 화면

- 1440×1000 top/bottom marker
- 1980×1100 aggregate marker
- mouse close
- Escape
- focus return
- popup 안 마지막 record action 도달

## 8단계 — VO-08 Regional sample과 focused zero region

### 요구사항

1. `activeRegion`은 coverage count가 0이어도 row를 유지한다.
2. focused zero row에는 `No sampled coverage records` 또는 동등하게 범위가 분명한 문구를 사용한다.
3. sample copy는 현재 region/layer filter 적용 전 전국 feed 값을 현재 표시 건수처럼 말하지 않는다.
4. toolbar에는 전체 bounded source scope와 현재 표시 수를 구분한다.
5. customer/offline/busy/stale partner만 있는 지역을 `no sampled live records`라고 표현하지 않는다.
6. 표의 목적을 coverage records로 유지한다면 접힘 copy도 `no sampled coverage records`로 맞춘다.
7. `1 regions`를 `1 region`으로 수정한다.
8. 외부 Booking/Partners region filter를 새로 만들지 않는다.

### 필수 테스트

- focused zero region
- customer-only region
- offline-only region
- 선택 layer 0건
- 전국 source 15건 / focused visible 0건 copy
- 1 region / 2 regions

## 9단계 — VO-09 Period query plan

### 현재 문제

Period summary가 UI에서 사용하지 않는 customer/provider/active-booking sample과 Live exact count를 수행한다.

### 요구사항

1. 기존 summary response contract는 유지한다.
2. Period UI에 실제로 필요한 closed outcome national metrics와 bounded regional outcome sample만 조회한다.
3. Period에서 customer sample, provider sample, realtime active booking sample을 조회하지 않는다.
4. Period에서 사용하지 않는 Live customer/partner/active exact count를 조회하지 않는다.
5. Live endpoint에서는 period booking과 period payment query를 수행하지 않는다.
6. `getVietnamOverview()` legacy caller가 있으면 먼저 확인하고 호환성을 유지한다.
7. 한 값 때문에 새 service/repository 계층을 만들지 않는다.
8. today, yesterday, 7d, 30d, all의 의미를 유지한다.
9. bounded paid volume은 계속 `Unavailable`이어야 한다.

### 필수 테스트

- Period customerProfile.findMany 0회
- Period providerProfile.findMany 0회
- Period active booking sample query 0회
- Period 불필요 Live exact count 0회
- Live period booking query 0회
- Live payment aggregate 0회
- today/yesterday/7d/30d/all 결과 유지

## 10단계 — VO-10 Period zero rows

이 항목은 correctness defect가 아니라 운영 밀도 recommendation이다. 기존 component 안에서 작은 수정으로 해결 가능한 경우에만 구현한다.

### 요구사항

1. completed/canceled가 있는 region을 먼저 표시한다.
2. 0건 region은 `Show N regions with no sampled outcomes`에 접는다.
3. focused region은 0건이어도 항상 표시한다.
4. 0건 region에 반복되는 `View region report`를 기본 화면에서 노출하지 않는다.
5. 새로운 table system이나 chart를 만들지 않는다.

### 필수 테스트

- all-zero Today
- HCMC 1건 + 나머지 0건
- focused zero region
- details keyboard toggle

## 11단계 — 작은 P3 정리

다음 두 항목만 수정한다.

### 문서 제목

- root layout이 `%s · HANDS Admin`을 추가하므로 page metadata title은 `Vietnam Overview`만 사용한다.
- 실제 `document.title`은 `Vietnam Overview · HANDS Admin`이어야 한다.

### Generated 중복

- 페이지 상단 freshness를 authoritative 생성 시각으로 유지한다.
- Operating map section에서는 지도 고유 상태인 `Partial sample`만 표시한다.
- API 실패 freshness/error 상태를 회귀시키지 않는다.

### 자동 수정하지 않을 항목

- Dark raster map 밝기

이는 preference다. 기존 MapTiler 계약에 이미 사용 가능한 dark style이 있고 운영자가 명시적으로 요청한 경우가 아니면 변경하지 않는다.

## 테스트 개선 원칙

현재 green test 중 일부가 잘못된 behavior를 고정한다.

반드시 수정할 잘못된 기대:

1. `exact coordinates`라는 이름으로 `toFixed(2)` 존재를 확인하는 test
2. customer/provider Vietnam query에 `where`가 없어야 한다는 test
3. source text 존재만 확인하고 실제 MapLibre lifecycle을 실행하지 않는 핵심 test

테스트 원칙:

- source-string assertion보다 observable behavior를 우선한다.
- pure 분류와 coordinate helper는 input/output 경계로 검증한다.
- MapLibre는 최소 mock으로 mount/unmount, listener, source/layer cleanup을 실행한다.
- 브라우저 테스트로 Live/Period 전환과 popup geometry를 검증한다.
- 테스트만 바꾸고 실제 동작을 수정하지 않는 방식은 금지한다.

## 단계별 검증 명령

각 단계의 작은 테스트를 먼저 실행한 뒤 최종적으로 다음을 실행한다.

```powershell
npm.cmd exec --workspace @massage-vn/admin-web -- vitest run --config vitest.config.mts app/vietnam-overview
npm.cmd exec --workspace @massage-vn/api -- vitest run --config vitest.config.mts src/admin/admin.service.spec.ts -t "Vietnam overview|Vietnam realtime|saved customer|partner map dots"
npm.cmd run verify:admin:fast
npm.cmd run verify:scope -- -Scope api
```

API scope 검증이 기존 사용자 변경 때문에 실패하면 실패를 숨기지 말고 이번 변경과 관련 있는지 구분한다. 관련 없는 기존 변경을 되돌리지 않는다.

DB schema나 migration을 변경하지 않았더라도 현재 working tree에 기존 Prisma 변경이 있을 수 있다. 그것을 이번 작업 결과로 주장하거나 수정하지 않는다.

## 실제 브라우저 재검수

수정 전과 수정 후 동일 상태를 캡처한다.

출력 폴더:

```text
C:\dev\massage-on-demand-vn\output\vietnam-overview-final-remediation-verification-2026-08-21
```

필수 viewport:

- 1440×1000
- 1980×1100

1024px 이하 화면은 전혀 검사하지 않는다.

필수 상태:

1. Live 기본 화면
2. Layers open
3. Offline/Customer secondary layers
4. Mapped records open
5. 같은 좌표 aggregate popup
6. popup mouse close와 Escape
7. zero-count region focus
8. Live → Period → Live
9. browser back/forward
10. Period Today
11. Period 7 days
12. 1980 Light
13. 1980 Dark popup

각 상태에서 확인:

- body horizontal overflow 0
- browser console error 0
- fixture 이름 0건
- KPI와 marker 분류 일치
- duplicate dot/hit target 없음
- popup clipping 없음
- mouse/keyboard로 모든 visible action 도달
- URL state 보존
- `Asia/Ho_Chi_Minh`
- 문서 제목 중복 없음
- raw enum이나 비베트남 지역·시간대 문구 없음

로그인이 필요하면 임의로 인증을 우회하지 말고 사용자에게 해당 브라우저에서 로그인해 달라고 요청한다.

## 완료 조건

다음 조건이 모두 충족돼야 완료로 보고한다.

- Live → Period → Live가 반복 동작하고 console error가 없음
- fixture customer/provider가 지도, Mapped records, totals에 포함되지 않음
- deleted/blocked Provider가 current coverage에 포함되지 않음
- count gap이 actual service/radius matchability로 표현되지 않음
- exact totals와 marker의 booking 분류가 동일함
- 20m 이상 떨어진 좌표가 같은 location aggregate로 합쳐지지 않음
- 동일 group의 GeoJSON/DOM 중복 표식이 없음
- aggregate popup을 mouse와 keyboard로 닫고 모든 record에 도달 가능
- focused zero region과 secondary-only region copy가 정직함
- Period가 불필요한 Live query를 실행하지 않음
- Period zero row가 핵심 결과를 묻지 않음
- 문서 제목과 Generated 중복이 정리됨
- 기존 URL state, fallback list, time semantics, Light/Dark가 유지됨
- focused test와 Admin/API scope verification 결과가 기록됨
- 1440/1980 after screenshot이 저장됨

## 중단 조건

다음 중 하나가 발생하면 범위를 확대하지 말고 중단 후 보고한다.

- DB schema 또는 migration이 필요함
- 기존 외부 API contract 변경이 필요함
- matching engine 재구현이 필요함
- blocked Provider의 coverage 포함 여부가 기존 정책에서 서로 충돌함
- MapLibre를 교체해야만 해결 가능함
- 관련 없는 사용자 변경과 충돌해 안전하게 분리할 수 없음
- 로그인 또는 실제 화면 접근이 불가능함

## 완료 보고 형식

다음 순서로 간결하지만 빠짐없이 보고하라.

1. 최종 판정
2. finding별 `fixed / not applicable / deferred / blocked` 표
3. 변경 파일과 변경 이유
4. 운영 데이터 의미 변경
5. MapLibre lifecycle, marker, popup 변경
6. API query plan 변경
7. 테스트 명령과 pass/fail/skipped 수
8. 1440/1980 before/after screenshot 경로
9. browser console 결과
10. protected area 변경 여부
11. 시작/종료 git status 항목 수
12. 남은 위험
13. 다음 한 가지 권장 작업

완료되지 않은 항목을 완료했다고 표현하지 마라. recommendation과 preference를 결함처럼 보고하지 마라.

---

## 구현 후 별도 읽기 전용 재감사 프롬프트

> `C:\dev\massage-on-demand-vn`의 Vietnam Overview 수정분을 읽기 전용으로 재감사하라. 기준 보고서는 `output\vietnam-overview-final-reaudit-2026-08-21\vietnam-overview-final-deep-reaudit.md`다. 보고서 지적을 사실로 가정하지 말고 현재 코드, API query plan, focused test, 로그인된 실제 화면을 교차 검증하라. 특히 Live→Period cleanup crash, fixture profile 격리, exact/sample booking 분류 일치, count gap 문구, coordinate tolerance, GeoJSON/DOM 중복, aggregate popup, focused zero region, Period 불필요 Live query를 확인하라. 애플리케이션 파일은 수정하지 말고 P0/P1/P2/P3와 confirmed/probable/recommendation/preference를 구분한 보고서만 작성하라. 1440×1000과 1980×1100만 검사하고 1024px 이하 화면은 보고서에서 완전히 제외하라.
