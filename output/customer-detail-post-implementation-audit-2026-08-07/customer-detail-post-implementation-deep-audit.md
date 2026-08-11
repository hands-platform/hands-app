# 고객 상세 페이지 재감사 보고서

- 대상: `http://localhost:3101/customers/audit_booking_list_customer_profile`
- 감사 일자: 2026-08-07 (Asia/Bangkok)
- 감사 기준: 실제 고객 문의·예약·금전·증거 보존 업무를 처리하는 운영자 관점
- 화면 범위: **1440×900, 1600×900 데스크톱만 확인**
- 제외 범위: 1024px 이하, 모바일·태블릿 레이아웃은 검사와 평가에서 완전히 제외
- 안전 범위: 실제 메모 저장, 푸시 발송, 지갑 반영은 실행하지 않았다. 지갑은 최종 적용 직전의 검토 단계까지만 확인했다.
- 변경 범위: 제품 소스는 수정하지 않았으며, 이 보고서와 현재 감사 스크린샷만 추가했다.

## 1. 최종 결론

이전 감사에서 지적한 **데이터 신뢰성과 위험 작업 안전성은 상당히 좋아졌다.** 특히 다음 항목은 실제 화면과 코드에서 개선을 확인했다.

- 고객 404와 API 장애가 분리된다.
- 지갑 원장 장애가 `0 VND`로 위장되지 않는다.
- 일반 운영자 응답에는 IP·deviceId 같은 진단 정보가 빠지고 안전한 언어·최근 활동 요약만 전달된다.
- 메모의 기본 예약 연결은 `No booking link`다.
- 활성 기기가 없으면 발송 폼 대신 `Push unavailable / no active device`와 대체 연락 동작이 보인다.
- 지갑 조정은 `Review balance change` 이후에만 금액·방향이 포함된 최종 적용 버튼이 나타난다.
- 채팅은 native `details` 기반의 접힌 방 목록으로 정리됐고 한 번에 한 방만 열 수 있다.
- 고객 목록에서 상세로 들어올 때 `returnTo`를 통해 검색 결과 복귀 문맥을 전달한다.

하지만 현재 상태를 “운영 배포 완료”로 보기는 어렵다. 가장 중요한 이유는 미관이 아니라 **운영자가 다른 고객·예약·금전 기록을 보거나, 일부 기록을 놓칠 수 있는 연결 및 범위 오류**다.

1. 현재 고객은 활성 예약이 2건인데 상단은 1건만 `Active booking`으로 대표한다. API가 가장 최근 생성된 한 건만 반환하기 때문에, 더 진행된 `In progress` 예약이 상단에서 빠진다.
2. `View all bookings`는 예약 페이지가 읽지 않는 `customer` 파라미터를 사용한다. 운영자가 누르면 이 고객의 전체 예약으로 필터링되지 않는다.
3. `Open payments`도 결제 페이지가 읽는 `customerProfileId`가 아니라 `customer`를 사용한다.
4. 예약 테이블에 공용 `.booking-monitor .vuexy-booking-table { min-width: 1480px; }`가 상속되어 1440px에서는 `Outcome`이 완전히 안 보이고 1600px에서도 오른쪽이 잘린다.
5. 요약 카드가 자동 추론한 `Current filters`, `All records` 배지는 실제 `Latest 6` 범위와 충돌한다.
6. 동일 suffix를 가진 예약 링크가 서로 다른 목적지인데도 `...on_booking`, `...ed_booking`처럼 동일한 이름으로 반복된다.

따라서 권장 판단은 다음과 같다.

> **핵심 안전 로직은 개선됐지만, 다중 활성 예약·드릴다운 링크·대형 데스크톱 예약 표를 먼저 바로잡은 뒤 운영 승인해야 한다.**

## 2. Audit Health Score

| # | 평가 차원 | 점수 | 핵심 판단 |
|---|---|---:|---|
| 1 | 접근성 | 3/4 | visible label·native details·상태 텍스트는 좋지만 중복 링크 이름과 중첩 h2 구조가 남음 |
| 2 | 성능·응답성 | 3/4 | API payload는 제한되고 병렬 조회하나 6건 필터·페이지 이동도 전체 서버 재렌더링 |
| 3 | 1440px+ 데스크톱 레이아웃 | 1/4 | 핵심 예약 `Outcome`이 1440에서 사라지고 1600에서도 잘림 |
| 4 | 테마 | 3/4 | light/dark 모두 기능하며 토큰을 사용하나 dark warning의 저대비 가능성은 계측 필요 |
| 5 | 구현 무결성 | 2/4 | 데이터 실패 계약은 좋아졌지만 잘못된 드릴다운 파라미터와 단일 활성 예약 계약이 남음 |
| **합계** |  | **12/20** | **Acceptable — 핵심 개선 후 재검수 필요** |

- 이슈 수: **P0 0 / P1 6 / P2 8 / P3 2**
- 구현 무결성 verdict: **부분 통과**. 이전보다 제품 고유 운영 흐름은 분명해졌지만, 현재 보이는 링크와 상단 예약 요약을 그대로 신뢰하면 다른 범위의 데이터를 보거나 진행 중 예약 하나를 놓칠 수 있다.

## 3. 이전 감사 요구사항 반영 상태

| 이전 요구 | 현재 상태 | 판정 |
|---|---|---|
| 고객 404와 장애 분리 | 404만 `notFound()`, 401/403과 5xx는 명시적 오류 화면 | 완료 |
| 지갑 장애를 0원으로 숨기지 않기 | 지갑 실패 시 `Wallet data unavailable`과 retry 표시 | 완료 |
| 안전한 언어·최근 활동 요약 | `sessionSummary`에 `deviceLanguage`, `lastSeenAt`만 제공 | 완료 |
| raw diagnostics opt-in | `diagnostics=developer`와 권한을 모두 충족해야 로드 | 완료 |
| 활성 예약을 latest 6 의존에서 분리 | 별도 API 조회는 추가됐지만 **한 건만 반환** | 부분 완료 |
| 최신 일부 범위 명시 | 주요 제목은 `Recent bookings / Latest 6`로 개선 | 부분 완료 |
| 메모 기본 예약 없음 | `No booking link`가 기본값 | 완료 |
| 빈 메모 검증 | HTML required/minLength와 서버 실패 notice가 있음 | 대체로 완료 |
| 푸시 불가 dead form 제거 | active device 0이면 연락 대체 동작만 제공 | 완료 |
| 지갑 Before→Change→After | 최종 적용 전 금액·방향·실행자를 표시 | 완료 |
| 채팅 compact disclosure | native `details name`을 사용 | 완료 |
| 고유 예약·채팅 식별 | 시간·상태가 주변에 추가됐지만 링크 이름은 여전히 중복 | 미완료 |
| 4열 예약 표 | 구조는 4열이나 공용 1480px 최소 폭 때문에 실제 화면 실패 | 미완료 |
| 목록 복귀 문맥 | 진입 직후에는 유지되지만 메모·푸시·지갑 작업 후 소실 | 부분 완료 |
| 0건 기록 compact 처리 | 표 대신 문장으로 바뀐 곳은 있으나 중복 배지와 큰 빈 카드가 남음 | 부분 완료 |

## 4. 화면 단계별 재감사

### 4.1 페이지 진입과 command header — 개선됐지만 다중 활성 예약 위험

![1440px 상단](C:/dev/massage-on-demand-vn/output/customer-detail-post-implementation-audit-2026-08-07/01-customer-detail-top-1440.jpg)

좋아진 점:

- 고객명, 전화, 상태, Add note, Contact customer, Financial adjustment가 첫 화면에 모였다.
- `No open action`과 `1 history signals`를 분리했다.
- 즉시 조치가 없더라도 Partner 취소 반복을 별도 history signal로 남긴다.
- 활성 예약 링크가 command header에 직접 있다.

남은 문제:

- 최근 예약 요약에는 `Live now 2`가 보이지만 상단은 `Active booking` 한 건만 보여 준다.
- API는 active status 중 `createdAt desc` 첫 건만 반환한다. 이 fixture에서는 신규 Matching 예약이 선택되고, 더 진행된 In progress 예약은 상단에서 빠진다.
- `No open action`은 “예외 큐가 없음”이라는 뜻인데, 바로 아래 warning 색상의 active booking이 있어 처음 보는 운영자는 “조치 없음”과 “진행 상황 확인 필요”의 차이를 한 번 더 해석해야 한다.
- `Checked at`은 데이터 소스가 생성한 시각이 아니라 서버 렌더 시각이다. 재로딩할 때마다 바뀌므로 데이터 최신성 보증으로 읽히지 않도록 `Page refreshed at` 또는 실제 `sourceGeneratedAt`으로 구분해야 한다.

권장 수정:

- API의 단일 `activeBooking`을 bounded `activeBookings`로 바꾼다. 새 시스템을 만들 필요 없이 기존 active status query를 `findMany`로 바꾸고 최대 10건만 반환하면 된다.
- 상단에는 `2 active bookings`를 표시하고, `In service → Arrived → On the way → Matched → Matching` 순으로 운영 우선순위를 정한다.
- 첫 번째 버튼은 `Open in-service booking`, 보조 링크는 `View 2 active bookings`로 recent booking의 Live 필터에 연결한다.
- `No open action` 설명을 `No exception queue item requires action`처럼 예외 판단임을 더 분명히 한다.

### 4.2 1600px 상단 — 폭은 넓지만 정보 밀도는 낮음

![1600px 상단](C:/dev/massage-on-demand-vn/output/customer-detail-post-implementation-audit-2026-08-07/08-customer-detail-top-1600.jpg)

- 상단 command header 자체는 1600px에서 안정적이다.
- 다만 `Customer Detail` 페이지 헤더가 큰 빈 공간을 차지하고 바로 아래에 고객 command header가 다시 나온다.
- 운영자가 항상 이 상세 화면을 사용한다면 페이지 헤더는 breadcrumb + 짧은 제목으로 줄이고, 확보된 세로 공간을 Current status까지 끌어올리는 편이 효율적이다.
- 이는 기능 차단 문제는 아니므로 P3다.

### 4.3 Current status — 신뢰도 개선, 문구 결합은 여전히 어색함

좋아진 점:

- 언어 `vi-VN`, 국가 `Vietnam`, 앱 최근 활동 시각이 안전한 session summary에서 나온다.
- `No active device`가 실제 장애를 뜻하는 빨간 점 대신 중립 상태로 표시된다.
- 전체 customer ID가 짧은 ID 아래에 남아 있다.
- 주소는 2개까지만 보이고 나머지는 native disclosure로 넘긴다.

남은 문제:

- `Language and profile: vi-VN / Not saved`는 언어와 성별을 하나의 값으로 합쳐 운영 의미가 불명확하다.
- 상단 badge와 fact 영역에서 `No active device`가 두 번 반복된다.
- profile card 내부 고객명이 section band의 `Current status`와 같은 h2로 노출되어 문서 구조상 하위 heading이 아니다.

권장 수정:

- `Language`와 `Gender`를 별도 fact로 분리한다.
- 상단 badge는 `Active booking`, `Active in last 7 days`만 두고 device 상태는 `App reachability` fact에만 둔다.
- nested profile name은 h3 또는 일반 strong으로 내려 heading 구조를 정리한다.

### 4.4 Recent bookings — 현재 가장 큰 화면 결함

![1440px 취소 필터](C:/dev/massage-on-demand-vn/output/customer-detail-post-implementation-audit-2026-08-07/14-cancelled-bookings-filter-1440.jpg)

![1600px 예약 표](C:/dev/massage-on-demand-vn/output/customer-detail-post-implementation-audit-2026-08-07/09-recent-bookings-1600.jpg)

좋아진 점:

- 7열을 `When & booking / Service & Partner / Money / Outcome` 4개 의미 그룹으로 줄였다.
- 주소는 disclosure로 내렸다.
- `Funds released`, `Payment captured` 등 운영 문구로 번역했다.
- All/Live/Completed/Cancelled 필터와 결과 건수가 일치한다.
- 요청 시각과 상태 시각의 동사를 `Requested`, `Closed at`, `Updated at`로 구분했다.

치명적인 남은 문제:

1. `.customer-booking-operation-section`이 `booking-monitor` class를 함께 사용한다.
2. 공용 CSS `.booking-monitor .vuexy-booking-table`이 `min-width: 1480px`를 부여한다.
3. 이 페이지용 `.customer-recent-bookings-table`은 width와 열 비율만 지정하고 `min-width`를 되돌리지 않는다.
4. 결과적으로 1440px에서는 Outcome 열 전체가 화면 밖에 있고, 1600px에서도 Outcome과 네 번째 요약 카드가 잘린다.

이 문제는 사용자 범위인 1440px와 1600px 모두에서 재현됐으므로 반응형 보류 항목이 아니라 P1이다.

가장 작은 수정:

```css
.customer-booking-operation-section .customer-recent-bookings-table {
  min-width: 0;
  table-layout: fixed;
  width: 100%;
}
```

필요하면 현재 25/32/20/23% 열 비율은 유지하고, 셀 내부 긴 텍스트만 자연스럽게 줄바꿈한다. 새 테이블 컴포넌트나 별도 스크롤 시스템은 필요 없다.

### 4.5 예약 요약 범위 — `Latest 6`와 `All records`가 충돌

현재 DOM과 화면에는 다음 조합이 같이 보인다.

- `Current filters / Latest 6 bookings`
- `Live / Live now`
- `All records / Completed in latest 6`
- `Current filters / Cancellations in latest 6`

원인은 `AdminTraceSummary`의 자동 scope 추론이다. 이 카드들은 현재 필터 결과도 아니고 all records도 아니다. 항상 API가 로드한 latest 6 전체의 요약이다.

권장 수정:

- 이 요약에서는 `inferScope={false}`를 사용하거나 모든 카드에 명시적으로 `scope="Latest 6"`를 전달한다.
- 필터를 Cancelled로 바꿔도 위 카드가 필터에 따라 바뀌지 않으므로 `Current filters`는 제거해야 한다.
- 이 오류는 단순 장식 문제가 아니라 운영자가 전체 이력과 최근 6건을 혼동하게 하므로 P1이다.

### 4.6 예약 필터와 페이지네이션 — 동작은 맞지만 6건에 2페이지는 불필요

확인 결과:

- Cancelled 필터는 3건을 정확히 보여 준다.
- All 상태에서 Page 2는 6번째 한 건만 보여 준다.
- 필터와 페이지는 URL에 보존된다.

운영 문제:

- API 최대가 6건인데 5행 페이지 크기 때문에 항상 최대 1건이 두 번째 페이지로 밀릴 수 있다.
- 최근 6건의 패턴을 한 번에 보려는 화면 목적과 충돌한다.
- 필터·페이지를 바꿀 때마다 고객 상세과 지갑 원장을 다시 서버에서 읽는다.

권장 수정:

- 최근 예약은 최대 6건이므로 페이지네이션을 삭제하고 6건을 모두 표시한다.
- 필터 URL 보존이 꼭 필요하면 유지하되, 페이지 파라미터와 pagination footer는 제거한다.
- 별도 클라이언트 상태 라이브러리는 추가하지 않는다. 서버 필터를 유지해도 페이지 한 단계를 없애는 것만으로 충분하다.

### 4.7 `View all bookings` — 보이는 약속과 실제 동작이 다름

현재 링크:

```text
/bookings?customer=audit_booking_list_customer_profile
```

하지만 예약 페이지와 API load plan은 `q`, `view`, `dateRange`를 읽고 `customer`를 읽지 않는다. 따라서 고객 필터가 적용되지 않는다.

가장 작은 수정:

```text
/bookings?view=all&dateRange=all&q=audit_booking_list_customer_profile
```

예약 검색은 이미 `customerProfileId contains q`를 지원하므로 새 API 파라미터가 필요 없다. 링크 계약 테스트만 추가한다.

### 4.8 Money — 장애 처리 완료, drill-down과 범위 문구는 미완료

좋아진 점:

- 지갑 balance와 결제 captured spend를 분리했다.
- 지갑 API 실패 시 Money 영역만 오류 상태가 되고 고객 정보는 유지된다.
- 지갑 원장에는 Before / Change / After가 명확하다.

남은 문제:

- `Open payments`는 `/payments?customer=...`를 사용하지만 결제 페이지가 읽는 파라미터는 `customerProfileId`다.
- `Recent authorized / pending`, `Recent refund records`, `Recent cash bookings`가 실제 `Latest 6 bookings` 범위를 명시하지 않는다.
- `Money position` 안에서 all-time, current, latest 6가 여전히 한 목록에 섞여 있다.

권장 수정:

- 링크를 `/payments?customerProfileId={id}`로 교체한다.
- 라벨을 `All-time captured payments`, `Latest 6 authorized / pending`, `Open refunds now`, `Latest 6 refunds`, `Latest 6 cash bookings`로 바꾼다.
- KPI를 `Current wallet / All time / Latest 6` 세 묶음으로 나누되 새 카드 시스템은 만들지 말고 소제목과 divider만 사용한다.

### 4.9 Financial adjustment — 안전성은 좋아졌고 1440px 폼 밀도만 조정 필요

![지갑 최종 검토 상태](C:/dev/massage-on-demand-vn/output/customer-detail-post-implementation-audit-2026-08-07/04-financial-adjustment-review-1440.jpg)

확인한 좋은 점:

- 금액과 사유가 유효해야 review 상태로 들어간다.
- 금액·방향·유형을 바꾸면 review가 해제된다.
- `Before 0 → Credit 100,000 → After 100,000`이 보인다.
- 최종 버튼은 `Apply 100,000 VND credit now`처럼 금액·방향·즉시성을 포함한다.
- 실행자와 ledger/audit 생성 사실, 회계상 발생하지 않는 항목을 버튼 근처에 설명한다.
- idempotency key가 있어 중복 적용 방어가 있다.

남은 문제:

- 1440px에서 5개 입력이 한 줄에 모여 Customer와 Adjustment type 텍스트가 잘린다.
- 위험 작업의 최종 버튼이 일반 primary 색이라 `Immediate financial action` badge와 위험성이 충분히 연결되지 않는다.
- evidence placeholder는 좁아서 잘리지만 아래 설명은 온전히 보여 기능 차단은 아니다.

권장 수정:

- 이 폼에만 `repeat(auto-fit, minmax(220px, 1fr))` 또는 명시적인 3열 레이아웃을 적용해 3+2행으로 만든다.
- 최종 Apply 버튼은 기존 danger/warning button variant를 재사용하고, 색뿐 아니라 현재 문구도 유지한다.
- 별도 다중 승인 시스템은 추가하지 않는다.

### 4.10 Add note — 기본 연결과 라벨은 개선, 복귀 문맥은 소실

![메모 입력](C:/dev/massage-on-demand-vn/output/customer-detail-post-implementation-audit-2026-08-07/05-operator-note-1440.jpg)

좋아진 점:

- `Quick note preset`, `Related booking`, `Activity note`가 모두 visible label이다.
- Related booking 기본값이 `No booking link`다.
- option은 시간·결제·상태를 같이 보여 같은 suffix라도 선택 시 구분 가능하다.
- textarea는 `required`, `minLength=3`이고 서버도 빈 note/preset을 거부한다.

남은 문제:

- 고객 목록에서 `returnTo`를 갖고 들어와도 메모 저장·실패 redirect가 `returnTo`를 전달하지 않는다.
- 메모 저장 버튼은 빈 상태에서도 enabled로 보이고 필수 표시가 시각적으로 없다. 브라우저 validation은 동작하지만 운영자는 누르기 전 요구조건을 알기 어렵다.
- 닫힌 상태의 section 제목이 계속 `Add customer activity note`라 history만 읽는 운영자에게도 입력 섹션처럼 보인다.

권장 수정:

- hidden `returnTo`를 form에 포함하고 서버 action에서 `safeCustomerReturnTo`와 같은 허용 규칙을 재사용한다.
- redirect에 `returnTo`를 보존한다.
- section 제목은 `Operator notes`, action은 `Add note`로 바꾼다.
- `Activity note · required, minimum 3 characters`를 짧게 표시한다.

### 4.11 Referral·Notifications·Notes empty state — 데이터는 정직하지만 페이지가 여전히 김

![추천과 알림 빈 상태](C:/dev/massage-on-demand-vn/output/customer-detail-post-implementation-audit-2026-08-07/13-behavior-referral-1440.jpg)

![알림과 감사 기록](C:/dev/massage-on-demand-vn/output/customer-detail-post-implementation-audit-2026-08-07/12-notifications-empty-1440.jpg)

좋아진 점:

- 0건 표를 억지로 렌더링하지 않고 문장형 empty state를 쓴다.
- active device가 없을 때 message form을 열지 않는다.
- 전화 연락 대체 동작이 있다.

남은 문제:

- Referral은 `0 referred`, `Credited 0 VND`, `No activity`를 동시에 보여 준다.
- Notifications는 상단 `0 messages`와 `Notification history 0 messages`를 반복한다.
- Notes도 section `0 notes`와 history `0 notes`가 반복된다.
- zero state 세 영역이 각각 큰 card를 차지해 Chat evidence까지 여러 화면을 내려가야 한다.

권장 수정:

- 0건일 때 badge는 하나만 남기고 `No referral activity`, `No customer app messages`, `No operator notes` 한 줄로 축소한다.
- History section 안에 `Notes / Notifications / Referral / Chat` compact anchor index를 추가한다.
- Notification과 Referral은 데이터가 있을 때만 full card를 펼치고 0건일 때는 compact row로 표현한다.

### 4.12 Retained record의 데이터 범위 — 여러 count가 “전체”처럼 보임

API select는 다음 항목을 제한한다.

- bookings: 6
- notifications: 10
- reviews: 각 10
- referrals made: 10
- operator notes / audit logs: 10
- push devices: 10

하지만 화면의 `4 chats`, `0 messages`, `0 notes`, `n referred`, `n signals`는 total인지 loaded preview인지 설명하지 않는다. 현재 fixture는 수가 적어 문제가 드러나지 않지만 10건을 넘는 실제 고객에서 잘못된 전체 수처럼 읽힐 수 있다.

권장 수정:

- count를 총계로 쓸 필요가 있으면 API `_count`를 추가한다.
- 총계가 필요 없다면 더 단순하게 `Latest 10 messages`, `Latest 10 notes`, `4 chat rooms in latest 6 bookings`처럼 표시한다.
- customer behavior의 completed Partner도 `Completed Partners in latest 6`로 범위를 명시한다.

### 4.13 Chat evidence — 구조는 좋아졌으나 식별과 페이지 분할이 남음

![채팅방 목록](C:/dev/massage-on-demand-vn/output/customer-detail-post-implementation-audit-2026-08-07/06-chat-evidence-1440.jpg)

좋아진 점:

- 3개의 transcript를 한꺼번에 펼치지 않는다.
- native `details name="customer-chat-history"`라 한 방을 열면 다른 방은 닫힌다.
- 펼친 DOM에는 고객/Partner 발신자, 메시지, 시각, booking과 full archive 링크가 있다.
- Developer/System audit는 명시적 opt-in이다.

남은 문제:

- 두 Partner cancellation 방의 시각적 제목이 모두 `...on_booking / Aromatherapy Massage / 90 min`이다.
- `Open booking ...on_booking`과 `Open full chat archive ...on_booking` accessible name도 서로 다른 목적지에 반복된다.
- 최신 6건 중 chat room이 최대 6개인데 3개씩 2페이지로 나눠, 현재도 4번째 방 하나만 별도 페이지에 있다.
- diagnostics를 열었는데 system logs가 0이면 header만 있는 빈 표가 보인다.

권장 수정:

- 링크 이름에 requested time 또는 Partner를 포함한다. 예: `Open booking …on_booking requested 16:03`.
- 채팅방 6개 이하라면 pagination을 제거하고 모두 collapsed row로 보여 준다.
- system logs 0이면 표를 숨기고 `No system audit logs loaded for this customer`를 표시한다.

### 4.14 Dark mode — 기능 통과, warning 대비는 별도 계측 필요

![다크 모드 상단](C:/dev/massage-on-demand-vn/output/customer-detail-post-implementation-audit-2026-08-07/10-customer-detail-top-dark-1440.jpg)

- card, border, text, action button은 dark token을 따라 정상 전환됐다.
- command history signal과 active booking warning은 색상 차이가 약하다.
- 스크린샷만으로 WCAG 대비 수치를 확정할 수 없으므로 `history signal`, warning small text, muted timestamp는 자동 contrast 측정으로 확인해야 한다.
- 상태는 텍스트도 함께 있어 색상만으로 의미를 전달하지는 않는다.

## 5. 우선순위별 수정 요구사항

### P1-1. 다중 활성 예약을 상단에서 모두 인지 가능하게 만들기

- API: 단일 `findFirst`를 bounded `findMany`로 변경.
- UI: `N active bookings`와 운영 우선순위가 가장 높은 예약을 표시.
- 링크: `View active bookings`는 recent booking Live 필터로 연결.
- 테스트: Matching + In service 동시 fixture에서 두 건이 모두 인지되고 In service가 우선되는지 확인.

### P1-2. 고객 전체 예약 링크 수정

- 현재: `/bookings?customer={id}`
- 수정: `/bookings?view=all&dateRange=all&q={id}`
- 기존 booking q 검색을 재사용하고 새 API filter를 만들지 않는다.

### P1-3. 고객 결제 링크 수정

- 현재: `/payments?customer={id}`
- 수정: `/payments?customerProfileId={id}`
- payment page의 기존 필터 계약을 재사용한다.

### P1-4. 1440·1600 예약 표 clipping 제거

- target table에서 공용 `min-width:1480px`를 명시적으로 해제.
- 4열 fixed table을 유지하고 cell 내부만 wrap.
- 1440×900과 1600×900에서 Outcome과 네 요약 카드가 동시에 보여야 한다.

### P1-5. scope 자동 추론 제거

- `AdminTraceSummary inferScope={false}` 또는 `scope="Latest 6"` 명시.
- `All records`, `Current filters`가 최신 6 요약에 나오지 않게 한다.

### P1-6. 예약·채팅 링크 이름 고유화

- 시간·상태·Partner 중 하나를 link accessible name에 포함.
- 동일 `...on_booking` 두 링크가 서로 다른 목적지를 가리키지 않게 한다.

### P2-1. action 후에도 `returnTo` 보존

- note, push, wallet form 모두 hidden `returnTo`를 전달.
- 서버 redirect에서 내부 `/customers?...`만 허용.
- 저장 성공·실패·닫기 후에도 원래 고객 검색 결과로 복귀.

### P2-2. Latest 6 예약의 pagination 삭제

- 6건 모두 한 화면에서 볼 수 있게 한다.
- 불필요한 `bookingHistoryPage`와 footer 제거.

### P2-3. 최대 6개 chat room의 pagination 삭제

- collapsed room 전체를 표시하고 한 방만 open 유지.

### P2-4. Money 라벨 범위 명확화

- Current / All time / Latest 6를 라벨 자체에 포함.

### P2-5. bounded record count 정직하게 표시

- total count를 추가하거나 `Latest N`으로 바꾼다.

### P2-6. zero state 중복 제거

- 0 badge와 0 empty copy를 동시에 반복하지 않는다.
- Referral, Notification, Notes를 compact row로 축소한다.

### P2-7. nested heading 구조 정리

- `Customer Detail` h1 아래 section band h2, 내부 card h3 순서를 지킨다.
- 현재 shared `AdminSection`이 항상 h2이므로 필요한 경우 최소 heading-level prop을 추가하고 이 페이지의 nested section에만 h3를 전달한다.

### P2-8. 지갑·메모 폼의 사전 이해도 개선

- wallet input은 1440에서 선택값이 온전히 보이도록 3열 또는 min 220px.
- Activity note의 required/minimum 안내를 입력 전에 표시.

### P3-1. 상단 페이지 헤더 세로 공간 축소

- breadcrumb와 h1은 유지하되 빈 padding을 줄여 Current status를 더 빨리 보여 준다.

### P3-2. dark warning 대비 측정

- muted timestamp와 warning soft panel의 실제 대비를 자동 도구로 측정한 뒤 토큰만 조정한다.

## 6. 권장 정보 구조

현재 페이지를 새 탭 시스템으로 나누기보다 기존 한 페이지 구조를 유지하고, 가장 작은 계층 조정을 권장한다.

1. **Customer command header**
   - 고객 식별
   - open actions / history signals
   - N active bookings + 최고 우선순위 예약
   - Add note / Contact / Financial adjustment
2. **Current status**
   - profile, contact, language, app reachability, addresses
3. **Recent bookings**
   - Latest 6 전체 표시, no pagination
   - All/Live/Completed/Cancelled
4. **Money**
   - Current wallet
   - All-time payment
   - Latest 6 money
   - wallet ledger / adjustment
5. **Retained records**
   - compact anchor row: Notes / Notifications / Referral / Chat / System
   - 0건은 한 줄
   - 데이터가 있을 때만 full history

## 7. Codex 구현 수용 기준

다음 항목이 모두 통과돼야 재개선 완료로 판단한다.

- 상단이 활성 예약 2건을 `2 active bookings`로 표시한다.
- In service 예약이 Matching 예약보다 높은 운영 우선순위로 보인다.
- `View all bookings`가 이 고객의 all-time booking records로 실제 필터링된다.
- `Open payments`가 이 고객의 payment records로 실제 필터링된다.
- 1440×900에서 When, Service & Partner, Money, Outcome 네 열이 모두 보인다.
- 1600×900에서 네 번째 metric card와 Outcome 시각이 잘리지 않는다.
- 최신 6 요약에 `All records`와 `Current filters`가 나타나지 않는다.
- 서로 다른 두 예약 링크의 accessible name이 동일하지 않다.
- note/push/wallet action 후에도 `Back to search results`가 원래 검색·필터·페이지를 보존한다.
- recent 6의 여섯 번째 예약을 보기 위해 별도 페이지 이동이 필요 없다.
- chat room 4개를 한 compact list에서 볼 수 있다.
- all-time, current, latest 6 money 라벨이 서로 구분된다.
- bounded lists가 total처럼 보이지 않는다.
- 0건 referral/notification/note가 중복 badge와 큰 빈 card를 만들지 않는다.
- nested heading이 h1 → h2 → h3 순서로 읽힌다.
- 실제 저장·발송·지갑 적용 없이 브라우저 검증이 가능하다.

## 8. 추가해야 할 최소 테스트

1. `CustomerBookingOperationBoard`의 `View all bookings` exact href.
2. Money section의 `Open payments` exact href.
3. 두 개 이상 active booking fixture와 우선순위.
4. 동일 suffix booking의 고유 link name.
5. note/push/wallet action success·failure 후 `returnTo` 보존.
6. `AdminTraceSummary`가 scope 자동 추론을 하지 않는 계약.
7. target CSS에 `min-width: 0`이 있고 공용 1480px rule을 이기는 visual/structure contract.
8. chat room 4~6개가 pagination 없이 모두 collapsed로 렌더링되는 계약.

## 9. 실행한 검증과 결과

### 브라우저

- 1440×900 light: 상단, 예약 필터, 예약 Page 2, wallet form, wallet review, note form, notifications, referral, chat, diagnostics 확인
- 1600×900 light: 상단과 예약 표 확인
- 1440×900 dark: 상단 command header 확인
- 실제 write 동작: 모두 미실행
- 최종 브라우저 상태: 대상 URL, light theme, 1440×900

### 테스트

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- "app/customers/[id]/page.spec.tsx" "app/customers/[id]/customer-booking-operation-board.spec.tsx" "app/customers/[id]/customer-detail-overview-shell.spec.tsx" "app/customers/[id]/customer-detail-section-shell.spec.tsx" "app/customers/[id]/customer-wallet-adjustment-panel.spec.tsx" "app/customers/[id]/actions.spec.ts"
```

- 결과: **6 files / 58 tests passed**

```powershell
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts src/admin/admin.controller.spec.ts src/admin/admin-customer-selects.spec.ts -t "customer detail|customer wallet ledger|customer diagnostics"
```

- 결과: **3 files / 11 tests passed / 701 skipped by filter**

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
```

- 결과: **둘 다 pass**

```powershell
npx.cmd eslint "app/customers/[id]/page.tsx" "app/customers/[id]/customer-booking-operation-board.tsx" "app/customers/[id]/customer-detail-overview-shell.tsx" "app/customers/[id]/customer-wallet-adjustment-panel.tsx" "app/customers/[id]/customer-wallet-adjustment-form.tsx" "app/customers/[id]/actions.ts"
npx.cmd eslint "src/admin/admin-customer.routes.ts" "src/admin/admin-customer-selects.ts"
```

- 결과: **둘 다 pass**

### Impeccable detector

- 현재 대상 파일에서 직접 검증된 target-specific 위반은 없었다.
- detector가 보고한 7개 side-tab 경고는 `globals.css`의 다른 관리자 화면 selector이며 이번 고객 상세의 현재 캡처 결함과 직접 관련이 없어 false positive/범위 밖으로 분리했다.

## 10. 코드 근거

- 고객 오류·지갑 부분 실패: `apps/admin_web/app/customers/[id]/page.tsx:164-216`, `586-610`
- 단일 active booking 선택: `apps/api/src/admin/admin.service.ts:3669-3685`, `apps/admin_web/app/customers/[id]/page.tsx:231`, `457-468`
- latest 6 select: `apps/api/src/admin/admin-customer-selects.ts:260-263`
- 잘못된 booking link: `apps/admin_web/app/customers/[id]/customer-booking-operation-board.tsx:109`
- booking page가 q만 읽는 계약: `apps/admin_web/app/bookings/booking-monitor-route-load-plan.ts:65-68`, `91-95`
- booking q가 customerProfileId를 이미 검색: `apps/api/src/admin/admin-booking-list-query.ts`
- 잘못된 payment link: `apps/admin_web/app/customers/[id]/page.tsx:545-547`
- payment page 실제 filter: `apps/admin_web/app/payments/payment-page-model.ts:129`, `157-158`
- 1480px 상속 원인: `apps/admin_web/app/globals.css:4127-4135`
- target table override 미완료: `apps/admin_web/app/globals.css:21679-21703`
- scope 자동 추론: `apps/admin_web/components/admin-overview-card.tsx:304-339`
- note returnTo 소실: `apps/admin_web/app/customers/[id]/actions.ts`
- wallet returnTo hardcode: `apps/admin_web/app/customers/[id]/customer-wallet-adjustment-panel.tsx:60`
- 예약 suffix 10자: `apps/admin_web/app/customers/[id]/page.tsx:1436-1441`
- chat disclosure: `apps/admin_web/app/customers/[id]/page.tsx:1303-1350`

## 11. 파일·보호 영역·잔여 위험

### 이번 감사에서 추가한 파일

- `output/customer-detail-post-implementation-audit-2026-08-07/customer-detail-post-implementation-deep-audit.md`
- 같은 폴더의 `01`~`14` 감사 스크린샷

### 제품 소스 변경

- 없음

### Protected areas

- 변경 없음
- API, Prisma schema/migration, auth, payment, wallet, matching, shared-types는 수정하지 않았다.

### 남은 검증 한계

- 실제 write action은 안전상 실행하지 않아 최종 저장 후 toast/focus 이동은 코드와 단위 테스트로만 확인했다.
- dark mode contrast는 스크린샷으로 수치 판정하지 않았다.
- 1024px 이하와 모바일은 사용자 요청에 따라 확인·평가하지 않았다.

## 12. 권장 실행 순서

1. 잘못된 booking/payment 링크 수정.
2. target table의 1480px 최소 폭 해제.
3. 다중 active bookings 계약과 상단 우선순위 수정.
4. metric scope 자동 추론 제거.
5. 고유 booking/chat accessible name 적용.
6. action 후 returnTo 보존.
7. 6건 예약·채팅 pagination 제거와 zero state 압축.
8. focused tests → typecheck/lint → 1440/1600 브라우저 재검수.

새 디자인 시스템이나 새 상태 관리 라이브러리는 필요 없다. 기존 query, `AdminSection`, `AdminTraceSummary`, native `details`, 현재 URL filter 패턴을 그대로 재사용하는 것이 가장 작고 안전한 개선 경로다.
