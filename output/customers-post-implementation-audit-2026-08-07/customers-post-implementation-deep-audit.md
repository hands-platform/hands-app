# Customers 구현 후 운영자 UX 심층 재감사 보고서

- 대상: `http://localhost:3101/customers`
- 감사일: 2026-08-07
- 관점: 고객지원·예약운영 담당자가 고객을 찾고, 현재 상황을 판단하고, 실제 후속 조치로 이어가는 흐름
- 화면 검증: 1440×900, 1600×900, Light/Dark
- 코드 검증: Admin Web 페이지·필터·표·상세 이동·권한 게이트, Admin API 목록·요약·필터·집계, 관련 테스트
- 변경 범위: 제품 소스는 수정하지 않았다. 이번 보고서와 현재 화면 증거만 새 출력 폴더에 추가했다.

## 1. 최종 판정

이전 감사에서 지적한 핵심 신뢰성 문제는 상당 부분 제대로 수정됐다.

- 빈 Custom 날짜가 전체 목록을 필터 결과처럼 보이던 문제는 해결됐다.
- API 실패와 정상 0건이 구분된다.
- `page=99`는 실제 마지막 페이지로 정규화된다.
- 과장된 `Needs action` 대신 실제 조건에 맞는 `Payment & review`가 사용된다.
- 예약 상태 시각과 앱 활동 시각이 분리됐다.
- 열린 문제와 누적 취소·노쇼 이력이 분리됐다.
- 앱 언어 필터가 `vi/ko/ja/zh/en` 기준으로 정리됐다.
- 무명 고객 식별, 상세 chevron, 업데이트 시각, Refresh가 추가됐다.
- Light/Dark와 1440/1600 데스크톱 레이아웃은 전반적으로 안정적이다.

다만 “운영자가 바로 믿고 다음 행동을 수행할 수 있는 화면”이라는 기준에서는 아직 완료가 아니다. 가장 중요한 잔여 문제는 다음과 같다.

1. 현재 로그인한 운영자는 고객 목록은 볼 수 있지만 모든 고객 상세 링크가 `CUSTOMERS_DETAIL` 접근 거부 화면으로 끝난다. 목록은 이 권한 차이를 알지 못한 채 chevron 링크를 강하게 노출한다.
2. 운영 뷰 안에서 검색/필터 결과가 0건이어도 필터 때문이 아니라 전체 큐가 비어 있는 것처럼 말한다.
3. 현재 예약 상태와 시각은 최근 10개 예약 표본에서 계산한다. 오래된 활성 예약이 그 표본 밖에 있으면 `Active booking`은 보이지만 정확한 상태와 업데이트 시각이 사라질 수 있다.
4. `Last active date`와 `App language`는 최신 세션이 아니라 조건에 맞는 과거 세션이 하나라도 있으면 고객을 포함한다. 행은 최신 세션을 표시하므로 필터와 표시값이 서로 다를 수 있다.
5. 결과 수와 정렬 설명을 이미 계산하지만 CSS로 숨겨 운영자는 현재 결과 단위와 정렬을 확인할 수 없다.
6. 예약·앱·결제 이력이 없는 행마다 부정 문구와 0값이 반복되어 실제 신호가 묻힌다.
7. 브라우저 탭 제목이 비어 있어 여러 관리자 탭을 동시에 사용할 때 페이지를 구분하기 어렵다.

현재 완성도는 **15/20, 운영 가능하지만 P1 보완이 필요한 상태**로 판단한다.

| 평가 항목 | 점수 | 판정 |
| --- | ---: | --- |
| 접근성·권한 피드백 | 3/4 | 기본 시맨틱은 좋지만 상세 권한과 문서 제목이 약함 |
| 성능·데이터 범위 | 3/4 | 서버 페이지네이션과 bounded query는 좋으나 일부 현재 상태가 10개 표본에 의존 |
| Light/Dark 일관성 | 4/4 | 두 테마 모두 안정적 |
| 1440/1600 화면 구성 | 3/4 | 안정적이지만 이름 잘림, 필터 footer 여백, 반복 문구가 남음 |
| 운영 의미·구현 신뢰성 | 2/4 | 빈 상태 우선순위, 세션 필터 의미, 현재 예약 권위 데이터가 남음 |

## 2. 이전 보고서 요구사항 재검수

| 이전 핵심 요구 | 현재 판정 | 근거 |
| --- | --- | --- |
| Custom 선택 즉시 From/To 표시 | 완료 | 클라이언트 상태로 즉시 렌더링 |
| 빈 값·부분 값·역순 날짜 적용 차단 | 완료 | 버튼 비활성화, 인라인 `role=alert`, 서버 URL 정규화 |
| API 실패와 정상 0건 분리 | 완료 | `adminGetResult`와 별도 `AdminErrorState` |
| 범위 밖 page를 마지막 페이지로 정규화 | 완료 | 브라우저에서 `page=99` → `page=4`, 실제 5행 표시 |
| 큐 이름을 실제 서버 조건에 맞춤 | 완료 | `Payment & review`: failed payment, requested refund, reported review |
| 예약 상태/예약 시각/앱 활동 분리 | 대체로 완료 | 문구는 분리됐으나 데이터 권위 범위가 최근 예약 10개에 의존 |
| Open work와 History 분리 | 완료 | 현재 문제 badge와 중립 이력 분리 |
| 검색·필터별 정확한 빈 상태 | 부분 완료 | All customers는 정확하나 운영 뷰가 검색/필터보다 먼저 판정됨 |
| 앱 언어 필터 의미 정리 | 부분 완료 | base language 처리는 완료, 최신 세션과의 일치성은 미완료 |
| 무명 고객 식별 | 완료 | `Unnamed customer + masked phone + short ID` |
| 상세 진입 affordance | 완료 | 이름 링크와 chevron 추가 |
| 검색 결과 복귀 URL 보존 | 코드상 완료 | 안전한 `returnTo`와 단위 테스트 존재. 현재 세션은 상세 권한 거부로 실제 복귀까지 검증 불가 |
| Updated/Refresh | 완료 | 상단에 생성 시각과 수동 Refresh 제공 |
| Sort 노출 | 미완료 | 정렬 enum과 설명은 있으나 UI는 hidden input이며 표 설명도 CSS로 숨김 |

## 3. 화면 흐름별 재감사

### Step 1. 기본 `Payment & review` 큐 — 상태: 좋음, 보조 행동 필요

![Payment & review 기본 빈 큐](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/01-payment-review-empty-1440.jpg)

좋아진 점:

- 실제 서버 조건과 같은 이름을 사용한다.
- 0건을 정상 성공 상태로 표현하고, 오류 상태와 혼동하지 않는다.
- `Payment & review 0 / All customers 35 / New today 0 / Active today 0`을 한 줄에서 볼 수 있다.
- 검색·세그먼트·추가 필터가 큐 아래에 일관되게 유지된다.

남은 점:

- 페이지 설명은 “고객 계정 찾기”와 “결제·환불·리뷰 문제 해결”을 함께 약속하지만 첫 화면은 빈 이슈 큐다. 운영 큐 우선 진입은 합리적이므로 기본값을 다시 `All customers`로 바꿀 필요는 없다.
- 다만 큐가 0건일 때 빈 상태 안에 `Browse all 35 customers` 한 개를 두면, 위 탭을 다시 해석하지 않고 바로 명부로 갈 수 있다.
- 탭 숫자는 고객 수이지만 단위가 없다. 이슈 건수로 읽힐 수 있다. 결과 header를 보이면 `0 customers`로 범위를 보완할 수 있다.

권장 문구:

- 빈 상태 보조 행동: `Browse all 35 customers`
- 큐 count의 접근 가능한 이름: `Payment & review, 0 customers`

### Step 2. 전체 고객 명부와 행 정보 — 상태: 혼합

![전체 고객 상단](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/02-all-customers-top-1440.jpg)

![고객 행 정보](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/03-customer-table-rows-1440.jpg)

![고객 페이지네이션](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/04-pagination-bottom-1440.jpg)

좋아진 점:

- 고객 신원, 현재 상황, 예약 이력, 열린 문제, 금액을 5열로 안정적으로 정리했다.
- 무명 고객은 전화번호를 이름처럼 중복하지 않고 short ID로 구별한다.
- `Booking updated`와 `App active`를 별도 줄로 표시한다.
- `Open work`와 `History`가 분리됐다.
- 35명을 서버에서 10명 단위로 나누며, 페이지 링크도 현재 필터를 보존한다.
- 전화번호는 서버에서 마스킹된 값이 내려온다.

운영 판단을 늦추는 점:

- 예약이 한 번도 없는 고객 한 행에서 `No open booking`, `No current booking update`, `No app activity`, `0/0 completed`, `No completed booking`, `No open work`, `0 VND`, `0 VND`가 반복된다. 10개 행 대부분이 이 패턴이어서 실제 문제가 있는 첫 행을 찾기 어렵다.
- `0/0 completed`는 비율처럼 보이지만 의미가 없다. `No bookings yet`가 정확하다.
- `1/6 completed`도 `1 completed · 6 total`이 더 빨리 읽힌다.
- `Customer cancels 1`은 문법과 단위가 어색하다. `1 customer cancellation` 또는 `Customer cancellations 1`이 맞다.
- `Refund 1`, `Reported 1`은 무엇의 수인지 모호하다. `Refund requests 1`, `Reported reviews 1`로 써야 한다.
- 1440px에서 비교적 짧은 `HANDS Audit Customer`도 말줄임된다. 전체 이름을 보려면 2줄 허용 또는 Customer 열 재배분이 필요하다. tooltip만 추가하는 것은 주 해결책이 아니다.
- `Customer value` 열 안의 wallet은 고객 가치가 아니라 회사가 고객에게 부담하는 잔액이다. `Payments & wallet`이 더 안전한 제목이다.
- `Total paid`는 API가 CAPTURED payment amount를 합한 값이다. 완료 환불을 순액으로 차감한 값이라고 보장되지 않으므로 `Captured payments`가 더 정확하다. 순액을 원하면 환불 차감 로직을 먼저 정의해야 한다.

권장 행 구조:

| 상황 | Current situation | Booking history | Open work | Payments & wallet |
| --- | --- | --- | --- | --- |
| 완전 신규 | `No booking · No app activity` | `No bookings yet` | `None` | `Captured 0 / Wallet 0` |
| 진행 예약 | 상태 badge + `Updated …` + `App active …` | `1 completed · 6 total` | 실제 열린 badge만 | `Captured … / Wallet …` |
| 과거 취소만 | 현재 상태 | 완료/전체 | `None` + `History: 1 customer cancellation` | 두 금액 분리 |

### Step 3. 추가 필터와 Custom 날짜 — 상태: 기능은 좋음, 의미 일치성 보완 필요

![추가 필터 펼침](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/05-more-filters-expanded-1440.jpg)

![Custom 날짜 검증](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/06-custom-date-fields-1440.jpg)

좋아진 점:

- 낮은 빈도의 날짜·언어·성별 필터를 `More filters`에 둔 위계가 적절하다.
- Custom 선택 즉시 From/To가 나타난다.
- 두 날짜가 없거나 역순이면 적용할 수 없고 오류가 입력 가까이에 표시된다.
- 네이티브 date input을 사용해 불필요한 라이브러리를 추가하지 않았다.
- 활성 추가 필터가 있으면 disclosure가 다시 열린 상태로 렌더링된다.
- 날짜 preset은 Vietnam 영업일 경계를 사용한다.

중요한 데이터 의미 문제:

- `Last active date`의 API 조건은 최신 세션 날짜가 아니라 `appSessions.some(lastSeenAt in range)`다. 과거 세션 하나가 범위에 들어오면 최신 활동이 범위 밖이어도 고객이 포함될 수 있다.
- `App language`도 최신 세션이 아니라 조건에 맞는 세션이 하나라도 있으면 포함한다. 표의 언어/활동 모델은 최신 세션 한 개를 사용하므로 필터 결과와 행 표시가 어긋날 수 있다.
- 즉, 언어 코드 정규화는 잘 수정됐지만 “어느 세션을 기준으로 하는가”는 아직 일치하지 않는다.

수정 선택지:

1. 목표안: 목록과 요약 API가 최신 app session을 기준으로 날짜와 언어를 필터링한다.
2. 안전한 임시안: 실제 조건을 유지한다면 라벨을 `Session activity during period`, `Recorded app language`처럼 바꾸고 과거 어느 세션이 match했는지 보조 설명을 제공한다.

운영 목적은 최신 고객 상태 파악에 가까우므로 1안을 권장한다. 다만 이 한 페이지를 위해 별도 범용 세션 규칙 엔진을 만들 필요는 없다. 현재 최신 세션 select/정렬 규칙을 API filter query와 공유하는 가장 작은 구현이면 된다.

시각적 보완:

- 활성 필터가 생기면 filter card footer에 큰 빈 여백이 생긴다. 활성 chip과 `Clear filters`를 form 마지막의 compact 한 줄로 두고 불필요한 footer 높이를 제거한다.
- `Apply filters`가 입력 그룹에서 멀리 떨어져 보인다. 1440px에서 오른쪽 정렬은 유지하되 입력 그룹과 같은 grid 경계 안에 붙이는 편이 좋다.

### Step 4. 검색과 검색 결과 없음 — 상태: All은 좋음, 운영 뷰는 미완료

![검색 결과 2명](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/07-search-audit-results-1440.jpg)

![All customers 검색 결과 없음](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/08-search-no-results-1440.jpg)

![Payment & review에서 필터된 0건](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/15-filtered-payment-review-empty-1440.jpg)

좋아진 점:

- 이름·전화·이메일·고객 ID를 한 검색창에서 찾는다.
- 검색어가 활성 chip으로 보이고 `Clear filters`가 현재 운영 뷰를 유지한다.
- All customers의 필터 결과 0건은 `No customers match these filters`로 정확히 말한다.
- 검색 시 각 운영 뷰 count도 같은 검색 조건으로 다시 계산된다.

미완료 문제:

- `CustomerTableEmptyState`가 활성 필터보다 `view`를 먼저 검사한다.
- 따라서 `/customers?q=zzzz-no-customer`는 활성 검색 chip이 있는데도 `No payment or review issues found`라고 말한다.
- New today와 Active today도 검색/필터가 결과를 0으로 만든 경우 전체 오늘 데이터가 0인 것처럼 말한다.
- 전체 customer가 실제로 0명이고 필터도 없을 때도 `Change the filters or clear the search`라고 안내한다. 지울 필터가 없는 잘못된 문구다.

권장 판정 순서:

1. API 오류
2. 활성 검색/필터 존재 + 0건
3. 현재 운영 뷰 자체가 0건
4. 전체 customer profile 자체가 0건

권장 문구:

| 상태 | 제목 | 설명 |
| --- | --- | --- |
| Payment & review + 필터 0 | `No payment or review issues match these filters` | `Change or clear the active filters to view this queue.` |
| New today + 필터 0 | `No new customers match these filters` | `Change or clear the active filters.` |
| Active today + 필터 0 | `No app-active customers match these filters` | `Change or clear the active filters.` |
| All + 필터 0 | `No customers match these filters` | 현재 문구 유지 |
| All + 데이터 자체 0 | `No customer profiles found` | `No customer accounts have been created yet.` |

### Step 5. 빈 운영 뷰와 잘못된 page 복구 — 상태: 좋음

![잘못된 page가 마지막 페이지로 정규화](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/11-invalid-page-normalized-1440.jpg)

![New today 정상 빈 상태](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/12-new-today-empty-1440.jpg)

![Active today 정상 빈 상태](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/13-active-today-empty-1440.jpg)

검증 결과:

- `/customers?view=all&page=99`는 `/customers?view=all&page=4`로 바뀌고 마지막 5행을 표시했다.
- `New today`는 `No customers joined today`로 표시된다.
- `Active today`는 `No app activity today`로 표시된다.
- 오류와 0건을 같은 fallback으로 처리하던 이전 문제는 코드에서 제거됐다.

추가 권장:

- `Active today`는 현재 접속 중이라는 뜻으로도 읽힐 수 있다. 실제 조건은 오늘 app session이 관측됐는지이므로 positive 라벨도 `App seen today` 또는 `App-active today`가 더 정확하다.
- 빈 상태 설명에 영업일 기준이 중요한 조직이라면 `Vietnam time`을 추가한다. Bangkok과 Vietnam은 같은 UTC+7이지만 화면 문구는 운영 정책을 독립적으로 설명해야 한다.

### Step 6. 1440/1600 및 Dark — 상태: 좋음

![1600px 전체 고객](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/09-all-customers-top-1600.jpg)

![1440px Dark](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/10-all-customers-dark-1440.jpg)

검증 결과:

- 1440px과 1600px 모두 문서 전체 가로 overflow가 없다.
- 운영 뷰, 기본 필터, 추가 필터, 표가 동일한 grid 흐름을 유지한다.
- Dark에서 surface, border, muted text, status badge가 안정적이다.
- 1600px에서는 이름과 5개 열의 가독성이 더 좋아진다.

남은 시각적 개선은 대규모 재디자인이 아니라 아래 세 가지면 충분하다.

1. Customer 이름을 최대 2줄 허용한다.
2. 반복되는 null/0 표현을 상태별 한 줄로 축약한다.
3. 현재 숨겨진 `Customer directory · 35 customers · newest first`를 compact header로 복원한다.

### Step 7. 고객 상세 이동과 권한 — 상태: 나쁨

![고객 상세 접근 거부](C:/dev/massage-on-demand-vn/output/customers-post-implementation-audit-2026-08-07/14-detail-access-restricted-1440.jpg)

실제 확인 결과:

- 현재 로그인한 운영자는 `/customers` 명부를 볼 수 있다.
- 목록의 고객 이름과 chevron은 모두 상세 링크처럼 보인다.
- 상세로 이동하면 `CUSTOMERS_DETAIL` 권한 부족으로 콘텐츠가 숨겨진다.
- 접근 거부 화면은 내부 enum `CUSTOMERS_DETAIL`, 내부 route slug `Audit_booking_list_customer_profile`, `customers_detail category access`를 그대로 노출한다.
- 복귀 행동은 `Back to command center`뿐이라, 방금 보던 고객 검색 결과로 돌아가는 운영 맥락이 끊긴다.

이것은 권한을 완화하라는 뜻이 아니다. 현재 `CUSTOMERS_DIRECTORY`와 `CUSTOMERS_DETAIL`을 분리한 최소권한 구조는 유지해야 한다. 문제는 목록이 자신의 다음 행동 권한을 모르는 것이다.

권장 수정:

- 목록 렌더링 시 현재 운영자의 `CUSTOMERS_DETAIL` 가능 여부를 확인한다.
- 권한이 있으면 현재 이름 링크와 chevron을 유지한다.
- 권한이 없으면 링크와 chevron을 제거하고 `Customer detail access required`라는 중립 lock 상태를 표시한다.
- 권한 요청 경로가 있다면 `Ask a Master Admin` 설명을 tooltip이 아니라 명시적 보조 문구로 둔다.
- 접근 거부 공통 화면은 permission registry의 사용자용 label `Customer detail`을 사용하고 raw enum을 숨긴다.
- 접근 거부 페이지의 복귀는 현재 route의 안전한 parent인 `/customers` 또는 검증된 same-origin `returnTo`를 사용한다.
- 권한을 자동 부여하거나 directory 권한으로 detail API를 우회하지 않는다.

권장 접근 거부 문구:

- 제목: `Customer detail access required`
- 설명: `You can search the customer directory, but this account does not have permission to open customer profiles. Ask a Master Admin for Customer detail access.`
- 행동: `Back to customers`

## 4. 코드·데이터 구현 심층 분석

### 4.1 현재 예약 상태가 최근 10개 예약 표본에 의존

관련 코드:

- `apps/api/src/admin/admin-customer-selects.ts:69-73`: 고객별 최근 예약을 `createdAt desc`, 최대 10개로 제한
- `apps/api/src/admin/admin.service.ts:28145-28258`: 전체 예약 count와 상태별 집계는 별도 summary로 계산
- `apps/admin_web/app/customers/customer-list-model.ts:100-110`: `openMatchingBookings`, `serviceLiveBookings`, `currentBooking`은 최근 10개 배열에서 계산
- `apps/admin_web/app/customers/customer-management-view-model.ts:170-174`: 위 값을 사용해 현재 상태 badge를 생성

문제:

- 전체 summary가 `activeBookingCount > 0`이라고 말해도 활성 예약이 최근 10개 `createdAt` 표본 밖이면 정확한 status와 updatedAt을 잃는다.
- 그 경우 UI는 `Active booking`과 `No current booking update`를 동시에 표시할 수 있다.
- 화면에 보인 `In service` 행은 2026-08-05 이후 업데이트가 없는데도 stale 표시가 없다. 코드에는 상태 age 검사가 없다.

최소 수정안:

- 기존 `getCustomerListActivitySummaries`의 status group `_max.updatedAt`을 재사용해 `currentBookingStatus`와 `currentBookingUpdatedAt`을 summary에 추가한다.
- 화면 모델은 최근 10개 history 배열보다 이 summary를 우선한다.
- stale booking을 자동 종료하지 말고, 기존 booking SLA/policy가 있으면 그 기준을 재사용해 `Stale booking state`를 별도 badge로 표시한다.
- 권위 있는 SLA가 아직 없다면 최소한 상대 age를 명확히 보여 주고 임의의 시간 threshold를 새로 만들지 않는다.

### 4.2 앱 세션 필터와 행 표시의 기준이 다름

관련 코드:

- `apps/api/src/admin/admin.service.ts:37387-37400`: 언어/활동 기간을 `appSessions.some(...)`으로 필터
- `apps/api/src/admin/admin.service.ts:37605-37648`: base language match는 올바르게 정규화
- `apps/api/src/admin/admin-customer-selects.ts:50-53`: 행은 최신 `lastSeenAt` 세션 한 개만 선택
- `apps/admin_web/app/customers/customer-list-model.ts:146-148`: 표시값도 최신 세션 한 개 사용

판정:

- 언어 코드 수정은 잘됐다.
- 그러나 filter predicate와 row presentation이 같은 세션을 보지 않는다.
- 운영자가 Korean을 골랐는데 행의 최신 session이 English로 보이는 상황이 데이터상 가능하다.

수정 기준:

- 필터, active chip, 행 표시, summary count가 모두 같은 “최신 세션” 정의를 사용해야 한다.
- 최신 세션을 API에서 계산하기 전까지는 라벨이 현재 `some` 조건보다 좁은 약속을 하지 않아야 한다.

### 4.3 결과 수와 정렬 설명을 만들고도 숨김

관련 코드:

- `apps/admin_web/app/customers/customers-table-section.tsx:25-35`: title, sort description, result count를 `AdminTablePanel`에 전달
- `apps/admin_web/app/globals.css:19983-19986`: customer table card의 panel header를 `display: none`
- `apps/admin_web/app/customers/customer-filters.ts:16`: 네 가지 sort 지원
- `apps/admin_web/app/customers/customer-filter-board.tsx:98`: sort는 hidden input으로만 전달

결과:

- `35 customers`와 `Sorted by newest customers`가 DOM에서 시각적으로 제거된다.
- 현재 탭 count가 필터 적용 후 바뀌지만, “필터된 고객 수”인지 “전체 큐 수”인지 설명이 없다.
- 운영자는 이름순·예약 많은 순이 이미 지원되는 것도 알 수 없다.

최소 수정안:

- 큰 카드 header를 다시 만들 필요 없이 표 바로 위 한 줄에 `35 customers · Newest first`를 표시한다.
- 이미 지원하는 정렬 4개 중 운영 가치가 분명한 `Newest`, `Name`, `Most bookings`만 select로 노출하고 `Fewest bookings`는 실제 사용 필요가 없다면 숨긴다.
- 페이지 크기 25/50은 35명 수준에서 지금 추가할 필요가 없다.

### 4.4 빈 상태 판정 순서

관련 코드:

- `apps/admin_web/app/customers/customers-table-section.tsx:151-183`

현재 함수는 `needs-action`, `new-today`, `active-today`를 먼저 반환하고, active filter 검사는 그 뒤에 있다. 가장 작은 수정은 새로운 상태 시스템이 아니라 조건 순서를 명시적으로 재배치하는 것이다.

필수 회귀 테스트:

- Payment & review + 검색 0
- New today + 검색 0
- Active today + 언어/성별 필터 0
- All + 필터 0
- All + 필터 없음 + 실제 total 0

### 4.5 브라우저 문서 제목 없음

실제 `document.title`은 빈 문자열이었다. 고객지원 운영자는 Customers, Customer Detail, Reviews, Chat Evidence를 여러 탭으로 열 가능성이 높다.

권장:

- Customers: `Customers | HANDS Admin`
- Customer detail: `{Customer name} | Customers | HANDS Admin`
- 접근 거부: `Access restricted | HANDS Admin`

이 문제는 Customers 한 페이지에 임시 script를 넣지 말고 기존 Next metadata 계층의 가장 작은 공통 위치에서 해결해야 한다.

## 5. 우선순위별 수정 백로그

### P1 — 다음 운영 배포 전에 권장

| ID | 수정 | 운영 영향 | 최소 구현 위치 |
| --- | --- | --- | --- |
| CUS-P1-01 | 목록 링크를 Customer detail 권한 인지형으로 변경 | 클릭 후 접근 거부·맥락 손실 방지 | Customers page/table + operator access model 재사용 |
| CUS-P1-02 | 필터 0건을 운영 뷰 자체 0건과 분리 | 결과 없음 원인 오판 방지 | `CustomerTableEmptyState` 조건 순서 |
| CUS-P1-03 | 현재 예약 status/updatedAt을 전체 예약 summary에서 제공 | `Active booking + No update` 모순, stale 상태 누락 방지 | API activity summary + row model |
| CUS-P1-04 | Last active/App language를 최신 session 기준으로 통일 | 필터와 행 표시 불일치 방지 | API customer where/query |
| CUS-P1-05 | compact result/sort line 노출 | 결과 단위와 정렬을 즉시 확인 | table panel header 또는 compact meta |
| CUS-P1-06 | `Total paid`를 실제 계산 의미에 맞게 수정 | 환불 후 금액·고객 가치 오판 방지 | API 집계 정책 확인 + 열 문구 |
| CUS-P1-07 | Customers 및 접근 거부 document title 설정 | 다중 탭 운영 식별 | Next metadata 공통 계층 |

### P2 — P1 후 화면 효율 개선

| ID | 수정 | 권장 결과 |
| --- | --- | --- |
| CUS-P2-01 | 신규/무활동 행의 반복 부정 문구 축약 | `No activity yet`, `No bookings yet`, `None`으로 scan noise 감소 |
| CUS-P2-02 | 이름 최대 2줄 허용 | 1440px에서 일반 이름을 말줄임 없이 식별 |
| CUS-P2-03 | badge 문구 단위 명확화 | `Refund requests`, `Reported reviews`, `Customer cancellations` |
| CUS-P2-04 | `Customer value`를 `Payments & wallet`로 변경 | 수익과 고객 wallet liability 혼동 방지 |
| CUS-P2-05 | 활성 필터 footer 높이 축소 | 검색 후 불필요한 빈 공간 제거 |
| CUS-P2-06 | 0건 기본 큐에 `Browse all customers` 보조 행동 | 명부 탐색으로 빠르게 전환 |
| CUS-P2-07 | `Active today`를 `App seen today`로 정확화 | 실시간 presence와 당일 session 활동 구분 |

### 지금 만들지 않아도 되는 것

- 고객 KPI 차트
- 자동 새로고침 또는 새 realtime socket
- 새 필터 프레임워크
- 별도 모바일/카드형 Customer 화면
- 무한 스크롤
- 새로운 date picker 라이브러리
- 사용 근거 없는 25/50 page-size control
- 권한을 우회하는 별도 고객 상세 API

현재 공통 컴포넌트, 네이티브 `<details>`, 네이티브 date input, 기존 access model과 activity summary를 재사용하는 수정이면 충분하다.

## 6. 권장 최종 화면 구성

```text
Customers                                      Loaded 7 Aug 2026, 16:41  [Refresh]
Find customer accounts and handle payment, refund, and review issues.

Operational view
[Payment & review 0] [All customers 35] [New today 0] [App seen today 0]

[Search name, phone, email, customer ID] [Customer segment] [Apply filters]
[More filters: activity period, app language, gender]
[Search: Audit] [Clear filters]

Customer directory                    2 customers · Newest first  [Sort ▾]
--------------------------------------------------------------------------------
Customer | Current situation | Booking history | Open work | Payments & wallet
--------------------------------------------------------------------------------
HANDS Audit Customer                  1 completed · 6 total       None
+84••••31 · ID …                      Last completion updated…     History: 1 cancellation
              In service
              Booking updated 2 days ago
              App active 2 days ago
--------------------------------------------------------------------------------
```

상세 권한이 없는 운영자라면 첫 열은 아래처럼 달라져야 한다.

```text
HANDS Audit Customer
+84••••31 · ID …
Customer detail access required 🔒
```

## 7. 수용 기준

### 권한과 다음 행동

- [ ] `CUSTOMERS_DETAIL`이 있는 운영자만 고객 이름/chevron을 상세 링크로 본다.
- [ ] 상세 권한이 없는 운영자는 클릭 가능한 것처럼 보이는 요소를 보지 않는다.
- [ ] 접근 거부 화면에 raw permission enum과 내부 slug를 노출하지 않는다.
- [ ] 접근 거부에서 `Back to customers` 또는 안전한 `returnTo`로 돌아간다.
- [ ] 권한 완화나 API 우회는 없다.

### 결과·필터·빈 상태

- [ ] 활성 필터 0건은 각 운영 뷰 전체 0건과 다른 문구를 사용한다.
- [ ] All customers 자체가 0명일 때 존재하지 않는 필터를 지우라고 안내하지 않는다.
- [ ] visible result count와 현재 sort가 표 위에 보인다.
- [ ] view count가 고객 수인지 이슈 건수인지 접근 가능한 이름으로 구분된다.
- [ ] Custom 날짜 검증과 URL 정규화는 현재 동작을 유지한다.

### 데이터 의미

- [ ] 현재 예약 status와 updatedAt이 최근 10개 history 표본 밖에서도 정확하다.
- [ ] 오래된 활성 상태는 최소한 age를 숨기지 않는다.
- [ ] Last active/App language 필터와 행 표시가 같은 latest session 정의를 사용한다.
- [ ] `Captured payments`, `Net paid` 중 실제 집계와 맞는 용어를 선택한다.
- [ ] wallet은 수익/고객 가치와 합산되지 않는다.

### 화면·접근성

- [ ] 1440px에서 일반 고객 이름을 전체 식별할 수 있다.
- [ ] Light/Dark의 현재 대비와 status tone을 유지한다.
- [ ] table headers, `aria-current`, native disclosure, 날짜 오류 연결을 유지한다.
- [ ] `document.title`이 `Customers | HANDS Admin`으로 설정된다.
- [ ] 키보드로 운영 뷰 → 검색 → Apply → More filters → 고객 상세/권한 상태 순서가 자연스럽다.

## 8. 검증 기록

### 브라우저

검증한 상태:

- `/customers`
- `/customers?view=all`
- `/customers?view=all&q=Audit`
- `/customers?view=all&q=zzzz-no-customer`
- `/customers?q=zzzz-no-customer`
- `/customers?view=new-today`
- `/customers?view=active-today`
- `/customers?view=all&page=99`
- Custom 날짜 선택 직후/부분 입력/역순 방지 구조
- 고객 상세 권한 거부
- 1440×900 Light/Dark
- 1600×900 Light

### 테스트·정적 검사

- Admin Web Customers 관련 6개 test file: **40 passed**
- Admin API 고객 directory/controller/select 관련 focused test: **6 passed, 706 skipped**
- Customers 관련 Admin Web ESLint: **passed**
- 고객 route/select 관련 API ESLint: **passed**
- API typecheck: **passed**
- Admin Web typecheck: **failed — Customers와 무관한 기존 Bookings 오류**
  - `apps/admin_web/app/bookings/[id]/page.tsx:1028`
  - `bookingId` prop이 `BookingOutcomeReviewPanel` component props에 없음

### Impeccable detector

전체 `globals.css`에서 다른 화면의 side accent border warning 7건을 찾았지만, 이번 Customers 화면 구조에 직접 해당하는 warning은 확인되지 않았다. Customers 개선을 위해 전역 CSS의 무관한 warning까지 함께 수정할 필요는 없다.

## 9. 소스 근거 위치

- 페이지 로드·오류·페이지 정규화: `apps/admin_web/app/customers/page.tsx:27-83`
- 필터 UI·Custom 검증: `apps/admin_web/app/customers/customer-filter-board.tsx:35-209`
- URL·view·sort·날짜 범위: `apps/admin_web/app/customers/customer-filters.ts:45-429`
- 고객 row 집계: `apps/admin_web/app/customers/customer-list-model.ts:66-214`
- 현재 상태·열린 문제·이력 문구: `apps/admin_web/app/customers/customer-management-view-model.ts:141-213`
- 표·빈 상태·페이지네이션: `apps/admin_web/app/customers/customers-table-section.tsx:20-183`
- 상세 permission category: `apps/admin_web/lib/admin-operator-access-model.ts:70-80`
- 접근 거부 공통 화면: `apps/admin_web/components/admin-operator-access-gate.tsx:16-45`
- Customer permission label: `apps/admin_web/lib/admin-operator-permissions.ts:65-77`
- API 목록·summary: `apps/api/src/admin/admin.service.ts:3516-3665`
- API customer filter predicate: `apps/api/src/admin/admin.service.ts:37339-37648`
- 최근 10개 directory select: `apps/api/src/admin/admin-customer-selects.ts:62-74`

## 10. 최종 결론

이번 개선은 이전 보고서의 “신뢰성 P0/P1” 대부분을 실제로 해결했다. 특히 Custom 날짜, 오류 상태, page 정규화, 정확한 큐 이름, 상태/시각 분리, 언어 코드 정리는 잘됐다. 화면을 다시 갈아엎을 필요는 없다.

다음 수정은 **권한을 모르는 상세 링크**, **필터된 빈 상태의 잘못된 설명**, **최근 10개 예약 표본에 의존하는 현재 상태**, **과거 세션까지 포함하는 최신 활동/언어 필터** 네 가지에 집중하는 것이 가장 효율적이다. 이 네 가지를 해결한 뒤 결과/정렬 한 줄과 행 noise를 정리하면 Customers 페이지는 운영자용 명부와 이슈 큐로 충분히 안정적인 수준에 도달한다.
