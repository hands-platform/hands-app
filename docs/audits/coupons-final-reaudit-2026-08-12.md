# Coupons 페이지 최종 재감사 보고서

- 감사일: 2026-08-12 (ICT)
- 대상: `http://localhost:3101/coupons`
- 화면 범위: 1440 × 1000 이상만 검사
- 제외 범위: 1024px 이하 반응형/모바일 화면 전체
- 방법: 로그인된 실제 화면 캡처, DOM 상태 확인, Admin Web/API/Booking/Settlement/권한 코드 교차 검토, 관련 단위 테스트 실행
- 변경 여부: 이번 감사에서는 애플리케이션 코드를 수정하지 않았다.

## 1. 최종 판정

이전 감사의 핵심 방향은 상당 부분 잘 반영됐다. 특히 쿠폰을 기본적으로 `Paused`로 생성하고, 활성화/일시중지에 별도 확인 단계를 두며, ICT 시간대를 명시하고, 목록·요약·상세·사용내역 실패를 분리한 점은 좋다. 생성·수정·상태 변경·삭제의 서버 액션과 관련 테스트도 안정적으로 구성돼 있다.

그러나 현재 상태를 **출시 가능한 쿠폰 운영 도구**로 판정할 수는 없다. 가장 큰 이유는 화면 미관이 아니라 실제 운영 데이터와 할인 통제 모델이다.

1. 현재 라이브 쿠폰 84개 중 `SMOKE` 검색에 83개가 일치한다. 즉 라이브 체크아웃 코드의 **98.8%가 스모크 테스트 성격의 레코드**다.
2. 해당 레코드는 실제 화면에서 `ACTIVE`, `Starts immediately`, `No end date`, `10% off`로 노출된다.
3. 데이터 모델에는 총 사용 한도, 고객별 한도, 예산 한도, 서비스 범위, 캠페인 소유자, provenance가 없다.
4. 1440px에서도 목록의 `Actions`가 잘리고 내부 가로 스크롤이 필요하다.
5. 사용내역은 전체 할인 비용이 아니라 현재 페이지 합계만 보여 운영자가 재무 노출을 판단할 수 없다.

따라서 판정은 다음과 같다.

| 구분 | 점수 | 판정 |
|---|---:|---|
| 이전 개선 반영도 | 82/100 | 대부분 반영 |
| 화면 완성도 | 74/100 | 구조는 안정적이나 표 밀도/스크롤 문제 존재 |
| 운영자 사용성 | 63/100 | 기본 작업 가능, 우선순위·노출·이력 판단은 어려움 |
| 변경 안전성 | 68/100 | 확인창은 좋으나 예산/한도/사유/동시성 통제가 없음 |
| 데이터·재무 통제 | 42/100 | 라이브 테스트 데이터와 무제한 할인 노출이 출시 차단 요소 |
| 접근성 기초 | 80/100 | 라벨·dialog·버튼 의미는 대체로 양호; 정식 WCAG 판정은 아님 |
| 테스트 신뢰도 | 84/100 | 관련 테스트 통과, 운영 데이터 정리/한도 동시성 테스트는 없음 |
| **종합** | **64/100** | **부분 개선 완료 · 출시 보류** |

## 2. 화면별 상태 점검

| 단계 | 상태 | 확인 결과 | 증거 |
|---|---|---|---|
| 기본 Live 목록 | ⚠️ | 요약·필터·목록의 구조는 명확하나 목록이 첫 화면 아래로 밀리고 운영 KPI가 부족함 | [기본 화면](coupons-reaudit-evidence-2026-08-12/01-coupons-default.png) |
| 쿠폰 생성 | ⚠️ | Paused 생성, 배치 50개, ICT, 입력 라벨은 좋음. 예산·사용 한도·소유자·회계 영향이 없음 | [생성 drawer](coupons-reaudit-evidence-2026-08-12/02-coupons-create-drawer.png) |
| 쿠폰 수정 | ⚠️ | 상태 변경을 분리한 것은 좋음. 이미 사용된 캠페인의 비율 변경 위험과 변경 이력이 보이지 않음 | [수정 drawer](coupons-reaudit-evidence-2026-08-12/03-coupons-edit-drawer.png) |
| 사용내역 | ❌ | 데이터가 없을 때 큰 빈 카드만 보이며, 데이터가 있어도 전체 금액이 아닌 현재 페이지 금액만 합산함 | [사용내역 drawer](coupons-reaudit-evidence-2026-08-12/04-coupons-usage-drawer.png) |
| Scheduled 빈 상태 | ✅ | `0 matching`, `0 shown`, 빈 상태 문구가 일관되고 오해 가능성이 낮음 | [Scheduled 빈 상태](coupons-reaudit-evidence-2026-08-12/05-coupons-scheduled-empty.png) |
| Pause 확인 | ⚠️ | 코드·할인·기간·고객 영향이 확인창에 표시됨. 변경 사유와 소유자/예산 정보는 없음 | [Pause 확인](coupons-reaudit-evidence-2026-08-12/06-coupons-pause-confirmation.png) |
| 운영 데이터 위생 | ❌ | `SMOKE` 검색 결과 83개이며 모두 Live 범위에 포함됨 | [SMOKE 83개](coupons-reaudit-evidence-2026-08-12/07-coupons-smoke-records.png) |
| 1440px 목록 가독성 | ❌ | Actions가 오른쪽에서 잘리고, 별도 가로·세로 스크롤이 생기며 Delete가 모든 행에 노출됨 | [1440px 표](coupons-reaudit-evidence-2026-08-12/08-coupons-table-1440.png) |

## 3. 잘 개선된 부분

### 3.1 안전한 생성 기본값

- 신규 쿠폰은 배치 API에서도 기본 `active: false`로 생성된다.
- 화면 문구도 `Create as Paused`와 `Safe launch sequence`로 동일한 운영 원칙을 전달한다.
- 코드 정규화, 중복 제거, 허용 문자, 80자 제한, 50개 배치 제한이 프런트와 API에 모두 있다.
- 일부 코드만 실패한 배치 결과를 성공/실패별로 반환한다.

관련 코드:

- `apps/admin_web/app/coupons/coupon-create-drawer.tsx`
- `apps/admin_web/app/coupons/coupon-code-batch.ts`
- `apps/admin_web/app/coupons/actions.ts`
- `apps/api/src/admin/admin.service.ts`의 `createCouponBatch`

### 3.2 시간대와 상태 계약

- 페이지, 생성, 수정, 확인창에서 ICT `(UTC+7)`를 반복해서 명시한다.
- `Live`, `Scheduled`, `Paused`, `Expired` 계산은 체크아웃의 시작/종료 조건과 대체로 맞는다.
- 만료된 Paused 쿠폰을 재활성화하려 할 때 종료 시각을 먼저 수정하도록 차단한다.

### 3.3 위험 작업 확인과 실패 분리

- Pause/Activate/Delete는 즉시 실행되지 않고 별도 확인 상태를 거친다.
- 목록과 요약 중 하나라도 실패하면 mutation을 비활성화한다.
- 상세/사용내역은 현재 목록 페이지에 의존하지 않고 대상 쿠폰을 별도 조회한다.
- 사용된 쿠폰의 hard delete는 API가 거부한다.

### 3.4 역할 분리 방향

`Coupons`, `Marketing Analytics`, `Coupon Finance`는 합치지 않는 것이 맞다.

- Coupons: 코드·기간·활성 상태 운영
- Marketing Analytics: 전환/완료/환불 등 캠페인 성과
- Coupon Finance: 할인 비용·정산·역분개·회계 증거

현재 Marketing Analytics에서 Coupons와 Coupon Finance로 연결하는 방향은 적절하다. 개선 시에도 한 페이지로 합치기보다 동일 코드로 상호 이동하는 링크를 강화해야 한다.

## 4. 출시 차단 및 최우선 문제

### P0-1. 라이브 SMOKE 쿠폰 83개

#### 확인 사실

- 기본 화면: `Live checkout codes 84`, `Scheduled launches 0`, `Inactive records 0`
- `q=SMOKE`: `83 matching`
- 표의 첫 페이지에 `SMOKE178...`, `Smoke test checkout discount`, `10% off`, `ACTIVE`, `Starts immediately`, `No end date`가 반복됨
- 즉 현재 라이브 쿠폰 중 83/84, 약 98.8%가 스모크 레코드다.

#### 운영 위험

- 예측 가능한 테스트 코드가 고객 체크아웃에서 실제 할인으로 사용될 수 있다.
- 종료일과 예산 한도가 없어 할인 비용이 계속 발생할 수 있다.
- 운영자가 정상 캠페인 1개를 찾기 위해 9페이지에 가까운 테스트 데이터를 통과해야 한다.
- 마케팅/재무 쿠폰 집계가 테스트 레코드로 오염될 수 있다.

#### 수정 요구

1. 즉시 mutation을 실행하는 임의 삭제가 아니라 **검토 가능한 dry-run inventory**를 먼저 만든다.
2. 후보 조건은 코드 `^SMOKE\d+$`, 설명 `Smoke test checkout discount`, 사용 여부, 생성 출처를 조합한다.
3. 83개를 우선 일괄 Pause한 뒤 다음처럼 처리한다.
   - 사용 0: 검토 후 삭제 가능
   - 사용 있음: 삭제 금지, `ARCHIVED_TEST_FIXTURE`로 보존
4. 운영 DB에서 smoke 실행을 막거나 격리 DB/schema를 사용한다.
5. smoke 종료 시 생성한 쿠폰을 Pause하고, 실패해도 `finally` 정리 루틴이 실행되게 한다.
6. `Coupon`에 provenance와 fixture run ID를 추가해 문자열 검색에 의존하지 않게 한다.
7. 출시 체크에 `active fixture coupon count = 0` 검사를 추가한다.

#### 완료 기준

- `/coupons?q=SMOKE`의 Live 결과가 0개다.
- 정상 캠페인과 fixture가 별도 상태/출처로 구분된다.
- production/shared DB에서 smoke coupon을 생성하는 실행은 명시적 승인 없이는 실패한다.
- cleanup은 dry-run manifest와 exact confirmation 없이 apply되지 않는다.

### P0-2. 할인 비용 상한과 사용 한도가 없음

현재 `Coupon` 모델은 `code`, `description`, `discount`, `active`, `startsAt`, `endsAt`만 가진다. 체크아웃은 활성/기간만 확인하고 퍼센트 할인을 계산한다. 예약 생성 시 총 사용량이나 고객별 사용량을 원자적으로 검사·예약하지 않는다.

#### 운영 위험

- 한 고객이 같은 쿠폰을 반복 사용할 수 있다.
- 전체 사용 횟수와 할인 예산을 초과해도 자동 중단되지 않는다.
- 100% 할인이 허용되고 최종 금액은 0까지 내려갈 수 있다.
- Preview 시점과 Booking 생성 시점 사이의 동시 요청을 통제할 ledger가 없다.
- 회사 부담 쿠폰 비용이 무제한 증가할 수 있다.

#### 최소 출시 모델

`Coupon`에 다음을 추가한다.

- `maxRedemptions`
- `perCustomerLimit`
- `budgetAmount`, `currency`
- `minimumOrderAmount`
- `ownerUserId`
- `provenance`, `fixtureRunId`
- `createdAt`, `updatedAt`, `version`
- `pausedReason`, `archivedAt`

그리고 별도 `CouponRedemption`을 둔다.

- `couponId`
- `bookingId` unique
- `customerProfileId`
- `discountAmount`
- `state: RESERVED | APPLIED | REVERSED`
- `createdAt`, `reversedAt`

쿠폰 검증과 redemption reservation은 예약 생성 트랜잭션 안에서 처리해야 한다. Preview는 안내용이며 최종 권한이 아님을 유지한다.

#### 최소 정책 권고

- 초기 출시 기본값: 고객당 1회
- 모든 쿠폰: 총 사용 한도 또는 예산 중 하나 필수
- 100% 또는 회사 비용 상한 초과: 2차 승인
- `No end date`: Master Admin 전용 + 사유 필수
- 서비스 범위가 없다면 최소한 `All services`를 명시적으로 저장

## 5. 1440px 화면 문제

### P1-1. Actions가 잘리고 내부 가로 스크롤이 필요함

`coupon-operations-table`은 각 열의 최소 너비가 누적되고, Actions에 `min-width: 235px`가 지정되어 있다. 1440px 화면의 실제 본문 폭에서 Pause/Edit/Delete가 한 번에 보이지 않는다. 표 내부에는 세로 스크롤과 가로 스크롤이 동시에 생긴다.

또한 `ActionMenu`를 `variant="dropdown"` 없이 사용해 Delete가 overflow menu가 아니라 모든 행에 pill로 노출된다.

#### 수정안

- 표 내부 세로 스크롤을 제거하고 페이지 pagination을 사용한다.
- 1440px에서 `scrollWidth <= clientWidth`가 되도록 열을 재설계한다.
- `Coupon + description + discount`를 한 열로 묶는다.
- `Window + status`를 `Availability` 한 열로 묶는다.
- `Usage`는 횟수와 비용을 같이 표시한다.
- 행의 직접 액션은 `Manage` 또는 `Pause/Activate` 하나만 둔다.
- Edit/Delete는 `ActionMenu variant="dropdown" managedDropdown`으로 이동한다.
- Actions 열은 140~160px 고정, 오른쪽 sticky를 적용한다.
- 긴 코드에는 복사 버튼과 ellipsis를 제공하되 전체 코드는 tooltip/상세에서 확인 가능하게 한다.

#### 완료 기준

- 1440 × 1000에서 가로 스크롤 없이 코드·상태·노출·대표 액션이 모두 보인다.
- Delete는 menu를 열기 전에는 보이지 않는다.
- 표를 스크롤해도 헤더와 대표 액션을 잃지 않는다.

### P1-2. 첫 화면의 정보 밀도가 낮음

큰 KPI 카드 3개와 segmented control이 동일한 Live/Scheduled/Inactive 수를 반복한다. 운영자가 봐야 할 목록은 첫 화면 아래로 밀린다.

#### 수정안

큰 카드 3개를 1줄 compact metric strip으로 바꾸고 다음을 보여준다.

- Live
- Starts within 24h
- Ends within 24h
- No end date
- Redemptions today
- Discount cost today

Segmented control은 상태 선택에만 사용하고 counts를 유지한다. `Records`는 `Paused`와 `Expired`로 분리한다.

## 6. 운영자 판단에 부족한 정보

### P1-3. 목록 정렬이 코드 알파벳순

API는 `orderBy: { code: 'asc' }`만 사용한다. Live 페이지에서 가장 급한 쿠폰은 종료 임박, 할인 노출 급증, 예산 소진 임박인데 코드 알파벳순은 운영 우선순위를 제공하지 않는다.

#### 권장 기본 정렬

- Live: 종료 임박 → 예산 소진율 → 최근 사용
- Scheduled: 시작 임박
- Paused: 최근 변경
- Expired: 종료 최신
- All: 최근 변경

정렬 선택지는 `Ends soon`, `Starts soon`, `Highest exposure`, `Recently changed`, `Code A–Z`로 제공한다.

### P1-4. `Records`가 Paused와 Expired를 합침

Paused는 재활성화/유지 판단 대상이고 Expired는 기록/재발행 대상이다. 운영 행동이 다른데 하나의 큐로 묶여 있다.

#### 수정안

- `Live | Scheduled | Paused | Expired | All`
- 각 상태에 맞는 기본 sort와 empty guidance 제공
- 별도 hygiene quick filter: `No end date`, `Zero usage`, `Fixture`, `Ends <24h`

### P1-5. 사용량 링크가 항상 `View usage`

목록 API는 사용 건수를 반환하지 않으므로 `usageCountKnown`이 false이고 실제 수치가 보이지 않는다. 모든 쿠폰을 하나씩 열어야 한다.

#### 수정안

목록 응답에 다음 집계를 추가한다.

- applied/reversed redemption count
- total discount amount
- last used at
- budget used / budget remaining

목록에는 `12 uses · 480,000 VND`처럼 표시한다.

### P1-6. 사용내역 drawer가 전체 노출을 보여주지 않음

현재 mini metrics의 금액은 `visible page`의 10건만 합산한다. 전체 건수와 현재 페이지 금액이 혼합되어 운영자가 전체 비용으로 오해할 수 있다.

#### 수정안

API가 전체 summary를 계산해 반환한다.

- all linked bookings
- applied / reversed count
- total customer paid
- total discount
- reversed discount
- completed / cancelled count
- first used / last used

drawer에는 `Campaign summary`와 `Current page rows`를 명확히 분리한다. `Marketing performance`와 `Coupon finance`로 쿠폰 코드가 유지되는 scoped link를 둔다.

### P2-1. 사용내역 빈 상태가 지나치게 큼

빈 상태 카드가 drawer 높이 대부분을 차지하며 다음 행동이 없다.

#### 수정안

높이 120~180px의 compact empty state로 줄이고 다음을 제공한다.

- `No redemption has been recorded.`
- `Created / starts / ends / current status`
- `Edit campaign`
- `Pause coupon`
- `Open marketing analytics`

## 7. 생성·수정·활성화 통제

### P1-7. 생성 화면에 재무 영향이 없음

현재 정산 코드는 funding source가 없으면 `COMPANY`, accounting treatment는 `MARKETING_EXPENSE`로 해석한다. 그러나 생성 화면은 이 쿠폰이 회사 부담 비용이며 파트너 정산 기준은 할인 전 금액이라는 사실을 보여주지 않는다.

#### 수정안

생성/수정 drawer에 읽기 전용 정책 블록을 둔다.

- Funding: Company
- Accounting: Marketing expense
- Partner settlement base: Pre-coupon service amount
- Estimated maximum liability: budget 또는 rate × eligible price × max uses

현재 지원하지 않는 Partner-funded/Platform-fee-funded 옵션은 UI에 노출하지 않는다.

### P1-8. 활성화 전 검증 도구가 없음

문구는 `verify the code and checkout window`라고 지시하지만 실제 검증 버튼이 없다.

#### 수정안

`Preview checkout`을 제공한다.

- 대표 서비스 선택
- 정상 가격
- 할인 금액
- 고객 결제액
- 회사 부담액
- 시작/종료 판단
- 사용/예산 한도

Preview 성공만으로 활성화를 허용하면 안 되며, 최종 activation confirmation에서 동일 정보를 다시 보여준다.

### P1-9. 캠페인 소유자와 변경 사유가 없음

현재 coupon audit metadata는 주로 변경 후 값만 남긴다. 누가 어떤 이유로 언제 몇 %에서 몇 %로 바꿨는지를 쿠폰 화면에서 복원하기 어렵다.

#### 수정안

- owner 필수
- Create/Activate/Pause/Delete에 reason 필수
- update audit에 before/after, actor, occurredAt, request ID 저장
- drawer에 최근 변경 5건 표시
- 이미 사용된 쿠폰의 discount/window를 바꿀 때 경고: `Past bookings retain snapshots; future bookings use the new rule.`
- optimistic version check로 두 운영자의 동시 수정 충돌 방지

### P2-2. 100% 쿠폰과 무기한 쿠폰의 위험도가 동일함

현재 1~100%를 동일한 한 단계로 저장할 수 있다.

#### 수정안

- 기본 운영 상한을 정책으로 관리한다. 예: 30%
- 상한 초과, 100%, No end date는 elevated confirmation/2인 승인 대상으로 분리한다.
- 1인 소규모 운영이라면 2인 승인 대신 `Master Admin + typed confirmation + mandatory reason + immediate notification`을 사용한다.

### P2-3. 시작과 종료가 같은 시각이어도 허용됨

프런트와 API가 `start > end`만 거부하므로 `start === end`는 통과한다. 문구는 “start must be before end”다.

#### 수정안

- `start >= end` 거부
- 최소 캠페인 창(예: 5분 또는 15분) 정책 검토

## 8. 권한과 정보구조

Coupons 화면은 `Growth & Communications` 아래에 있지만 API/웹 권한 계약은 `SYSTEM_COUPONS`이며 parent alias는 `SYSTEM`, 기본 소유자는 `Master Admin`이다. 높은 할인 위험 때문에 elevated 권한을 분리한 의도는 타당하지만 이름과 소유 구조가 운영자에게 모호하다.

#### 권장안

- 페이지 위치는 `Growth & Communications > Coupons` 유지
- 권한 키는 `GROWTH_COUPONS_OPERATE`처럼 명확히 분리
- 조회/분석과 mutation을 나눈다.
  - `GROWTH_COUPONS_VIEW`
  - `GROWTH_COUPONS_EDIT`
  - `GROWTH_COUPONS_ACTIVATE`
  - `GROWTH_COUPONS_DELETE`
- `Master Admin`만 모든 권한을 갖고 Growth Admin은 필요한 mutation만 위임 가능하게 한다.
- Admin Operators 화면에서 권한 설명에 “discount liability”를 명시한다.

Coupons를 Administration & Settings로 다시 옮기는 것은 권장하지 않는다. 위치와 위험 권한은 별개의 문제다.

## 9. 오류·접근성·문구 검토

### 잘된 점

- dialog와 drawer 제목이 의미 있는 accessible name을 가진다.
- 입력 필드 라벨이 보인다.
- 생성 버튼은 유효 코드가 없으면 disabled다.
- 목록/요약/상세/사용내역 오류가 빈 상태와 구분된다.
- Scheduled empty state의 `0 matching`, `0 shown`이 일관된다.
- 브라우저 console warn/error는 감사 동선에서 발견되지 않았다.

### 보완점

- Delete를 매 행에 빨간 pill로 노출하지 말고 dropdown으로 이동한다.
- `ACTIVE`와 `Available at checkout now`의 반복을 줄이고 한 상태 신호로 통합한다.
- `Current` badge가 모든 KPI에 반복되므로 제거하거나 freshness timestamp 하나로 대체한다.
- 빈 description은 `-`보다 `No campaign description`처럼 의미를 드러낸다.
- action 결과 notice는 상태 변화 전/후와 적용 시각을 포함한다.
- 색상 대비, 키보드 trap, screen reader announcement는 이번 1440px 시각/DOM 감사만으로 완전한 WCAG 준수를 주장하지 않는다. 별도 자동/수동 접근성 테스트가 필요하다.

## 10. 코드·테스트 확인 결과

### 실행 결과

- Admin Web coupons: **10 files, 46 tests passed**
- API coupon-focused: **3 files, 21 tests passed, 629 skipped by name filter**
- 브라우저 console warning/error: 없음

### 검토한 핵심 코드

- `apps/admin_web/app/coupons/page.tsx`
- `apps/admin_web/app/coupons/coupon-create-drawer.tsx`
- `apps/admin_web/app/coupons/coupon-management-drawer.tsx`
- `apps/admin_web/app/coupons/coupons-table-section.tsx`
- `apps/admin_web/app/coupons/coupon-filter-board.tsx`
- `apps/admin_web/app/coupons/actions.ts`
- `apps/admin_web/app/globals.css`
- `apps/api/src/admin/admin-coupon.routes.ts`
- `apps/api/src/admin/admin.service.ts`
- `apps/api/src/bookings/bookings.pricing.ts`
- `apps/api/src/bookings/bookings.service.ts`
- `apps/api/src/customers/customers.service.ts`
- `apps/api/src/settlements/coupon-settlement.ts`
- `apps/api/prisma/schema.prisma`
- `infra/scripts/api-smoke.mjs`

### 테스트가 보장하지 않는 것

- 총 예산/사용 한도 동시성
- 동일 고객 반복 사용 방지
- activation 두 운영자 동시 충돌
- smoke fixture 생성 후 정리
- 1440px 표 scrollWidth 회귀
- 전체 사용 금액과 pagination row의 합계 일치

## 11. 권장 구현 순서

### Phase 0 — 출시 차단 해소

1. 쿠폰 fixture dry-run inventory 작성
2. 83개 SMOKE Live 쿠폰 즉시 Pause 계획 검토
3. 사용 0은 삭제 후보, 사용 있음은 archive 후보로 분리
4. smoke 실행 환경 격리와 cleanup finally 추가
5. release gate에 active fixture count 0 추가

### Phase 1 — 할인 손실 통제

1. Coupon provenance/owner/timestamps/version 추가
2. CouponRedemption ledger 추가
3. budget, total limit, per-customer limit 추가
4. 예약 생성 트랜잭션에서 원자적 reserve/apply/reverse
5. 100%/No end date elevated policy

### Phase 2 — 운영 화면 재구성

1. 1440px 가로 스크롤 제거
2. Delete dropdown 이동
3. 큰 KPI 카드 compact strip 전환
4. Paused/Expired 분리
5. 종료 임박/노출/최근 변경 정렬
6. 목록에 usage/discount/budget remaining 추가

### Phase 3 — 상세 판단과 교차 이동

1. 전체 usage summary API
2. 사용내역 empty state 축소
3. Marketing Analytics/Coupon Finance scoped link
4. Preview checkout
5. 변경 이력과 before/after 표시

## 12. 최종 수용 기준

다음이 모두 충족되어야 Coupons 도메인을 출시 가능으로 판정할 수 있다.

- Live fixture coupon 0개
- 모든 Live 쿠폰에 owner, end date 또는 approved no-end reason 존재
- 모든 Live 쿠폰에 budget 또는 redemption cap 존재
- 동일 고객 제한이 서버 트랜잭션에서 강제됨
- 1440px에서 가로 스크롤 없이 핵심 정보와 액션 확인 가능
- Paused/Expired가 분리됨
- 목록에서 usage count, total discount, remaining budget 확인 가능
- 사용내역 summary가 전체 데이터 기준임
- activation confirmation에 예상 최대 회사 부담액이 표시됨
- coupon mutation audit에 reason과 before/after가 남음
- Marketing Analytics와 Coupon Finance로 코드가 유지되는 scoped link 제공
- cleanup, redemption concurrency, reversal, 1440px layout 회귀 테스트 통과

## 13. 결론

이 페이지는 “CRUD가 가능한 쿠폰 관리 화면” 단계는 넘어섰다. 생성 안전값, 확인창, ICT, 오류 분리, 사용내역 drawer, pagination은 이전보다 확실히 좋아졌다.

하지만 운영자의 핵심 질문인 **“지금 어떤 쿠폰이 위험한가, 얼마까지 손실될 수 있는가, 누가 책임지고 있는가, 이미 얼마나 사용됐는가”**에는 아직 답하지 못한다. 특히 Live SMOKE 83개와 무제한 할인 모델은 화면 개선보다 먼저 해결해야 하는 출시 차단 문제다.

이번 재감사의 우선순위는 다음 한 줄로 정리된다.

> 테스트 쿠폰을 안전하게 격리·정리하고, 할인 한도와 redemption ledger를 먼저 만든 뒤, 1440px 표와 운영 노출 정보를 정리한다.
