# Customer Usage Overview 운영자 UX·데이터 신뢰성 심층 감사

- 감사 대상: `http://localhost:3101/usage-overview`
- 감사일: 2026-08-06 (Asia/Bangkok, 화면 표시는 Asia/Ho_Chi_Minh)
- 감사 관점: 고객지원/운영 담당자가 이상 징후를 빠르게 발견하고, 수치를 정확히 이해하고, 올바른 후속 화면으로 이동할 수 있는가
- 감사 방법: 로그인된 관리자 화면 직접 탐색, Today/7 days/Custom/범위 보정/1024px/200% 확대 상당 화면 캡처, 프런트·API·권한·테스트 코드 대조
- 변경 범위: 앱 코드는 수정하지 않음. 본 문서와 감사 스크린샷만 생성함.

## 1. 종합 판정

**판정: 운영 보고서로 쓰기에는 아직 위험하며, 시각 다듬기보다 데이터 의미와 후속 행동 연결을 먼저 고쳐야 한다.**

현재 페이지는 큰 구조 자체는 좋다. 기간 선택, 핵심 지표, 우선순위, 고객 여정, 추세, 세부 표가 한 페이지에 있고 API 실패를 실제 0으로 위장하지 않는다. 그러나 다음 문제 때문에 운영자가 반대 결론을 내릴 수 있다.

1. 7일 화면에서 `Created 350`, `Closed cancelled / expired 304`, `Completed 1`인데도 `Watch booking completion 100%`로 보인다.
2. `Review problem customers` 링크는 지원되지 않는 `segment=issue`를 보내므로 의도한 취소 위험 고객 목록으로 이동하지 않는다.
3. 기간 지표와 현재 시점 누적 지표가 같은 `Today`/`Last 7 days` 배지 아래 섞인다.
4. Custom의 요청 기간이 서버에서 90일로 자동 보정돼도 화면은 사용자가 입력한 원래 날짜를 그대로 보여준다.
5. Demo/Smoke/Audit 데이터가 실사용 지표와 섞여 350건 같은 수치를 만든다.
6. `Updated`는 원천 데이터의 최신 시각이 아니라 API가 응답을 만든 시각이다.
7. 1440px에서도 일부 카드 문구가 글자 단위로 쪼개지고, 1024px/확대 보기에서는 판단이 어려울 정도로 무너진다.

따라서 권장 순서는 **P0 데이터 계약과 링크 수정 → P0 레이아웃 결함 수정 → P1 정보 구조 정리 → P2 문구·시각 다듬기**다.

## 2. 운영자가 이 페이지에서 끝내야 하는 일

운영자는 이 페이지에서 다음 네 질문에 30초 안에 답할 수 있어야 한다.

1. 선택 기간에 고객 활동이 늘었나, 줄었나?
2. 고객 여정 중 어느 단계에서 가장 크게 이탈했나?
3. 지금 확인해야 할 실제 고객·예약·Partner는 누구인가?
4. 이 수치를 믿어도 되는가? 데이터는 언제까지 반영됐고 테스트 데이터는 제외됐는가?

현재 화면은 1번의 일부만 비교적 잘 답한다. 2번은 고객 단위와 예약 단위가 섞여 잘못된 결론을 낼 수 있고, 3번은 링크가 잘못되거나 범위를 잃으며, 4번은 확인할 방법이 없다.

## 3. 잘된 점

- `Usage data unavailable`과 실제 0건 보고서를 분리해 API 실패를 0으로 위장하지 않는다.
- Asia/Ho_Chi_Minh 기준을 명시하고 Today/Yesterday/7 days/30 days/Month/Custom를 제공한다.
- 기간 버튼은 링크 기반이고 활성 상태에 `aria-current="page"`가 적용된다.
- H1/H2, breadcrumb, 표의 column header/row header, 날짜 필드의 visible label이 존재한다.
- Customer journey는 같은 고객 집합을 단계별로 좁히므로 퍼센트를 0~100%로 제한한다.
- GPS 원본 좌표를 반환하지 않고 지역 버킷으로 집계한다.
- Customer와 Partner 세부 화면으로 이동할 수 있는 링크가 있다.
- 기존 컴포넌트와 스타일 시스템을 재사용하고 있어 새 UI 라이브러리는 필요 없다.

## 4. 캡처 단계별 감사

### Step 1 — Today 상단과 기간 선택 · 상태: 주의

![Today 상단](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/02-today-top.png)

- H1, 기간, 업데이트 시각, KPI 순서는 이해하기 쉽다.
- 제목 설명의 `stored Vietnam-time usage aggregates`는 개발자 용어다. 운영자에게는 데이터가 무엇을 의미하는지가 더 중요하다.
- Today의 모든 액션이 0인데도 `Needs action` 영역이 다섯 장의 카드로 크게 노출된다.
- 건강한 0건과 실제 조치 필요 항목이 같은 영역에 있어 “무엇부터 해야 하는지”가 약해진다.
- `Updated`가 원천 데이터 최신 시각처럼 보이지만 실제로는 API 응답 생성 시각이다.

### Step 2 — Today 우선순위·고객 여정·0건 추세 · 상태: 위험

![Today 고객 여정과 추세](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/03-today-journey-retention.png)

- 0건인데도 24개의 0값 row가 있어 차트 empty state가 실행되지 않고 빈 좌표계가 표시된다.
- 운영자는 “데이터가 없나”, “수집은 됐지만 0인가”, “차트가 고장 났나”를 구분하기 어렵다.
- `Improve Partner discovery 0%`, `Watch booking completion 0%`가 Needs action처럼 보이지만 분모가 0인 상태다. 이는 0% 실패가 아니라 계산 불가다.
- 분모가 0이면 `— / No eligible activity`로 보여야 한다.

### Step 3 — Today Lifecycle·Retention·Booking·Payment · 상태: 위험

![Today lifecycle과 retention](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/04-today-lifecycle-tables.png)

- Today 활동은 모두 0인데 `Never booked 35`, `D1 0 of 2 eligible`가 같은 화면에 나타난다.
- `Never booked 35`는 선택 기간 값이 아니라 전체 현재 스냅샷이다.
- D1은 “오늘 가입자”가 아니라 오늘 D1 도달일을 맞은 과거 가입 코호트다. 계산은 가능하지만 문구가 이를 설명하지 않는다.
- `0 of 0 eligible`을 `0%`로 표시하면 성과가 나쁜 것으로 오해한다. `N/A · No eligible customers`가 맞다.
- 카드 문구가 1440px에서도 글자 단위로 쪼개진다. 이 현상은 데이터보다 레이아웃이 먼저 시선을 빼앗는다.

### Step 4 — Today 고객·Partner 표와 하단 빈 상태 · 상태: 주의

![Today 하단](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/05-today-bottom.png)

- Customer activity 카드가 절반 폭인데 7개 열을 가지므로 빈 상태 문구조차 잘린다.
- Partner discovery는 전체 폭을 차지해 같은 그룹의 두 표가 다른 규칙으로 보인다.
- 빈 섹션이 연속으로 길게 쌓인다. Today가 비어 있을 때는 섹션별 큰 카드 대신 한 번의 통합 empty summary가 낫다.
- Top regions의 `Open Vietnam Overview`는 유용하지만 오른쪽 좁은 열에서 여러 줄로 깨진다.

### Step 5 — Last 7 days 상단 · 상태: 주의

![7일 상단](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/06-7d-top.png)

- KPI 비교 방향은 빠르게 읽힌다.
- `Completed bookings 1 · New activity`는 이전 기간 0에서 1이 된 사실만 말한다. 분모와 운영 영향은 알 수 없다.
- `Action priorities`가 KPI 바로 아래 있는 것은 올바른 위치다. 다만 실제 조치 대상만 남겨야 한다.

### Step 6 — Last 7 days 우선순위와 고객 여정 · 상태: 심각

![7일 우선순위와 고객 여정](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/07-7d-actions-journey.png)

- `Review problem customers 4`는 실제 조치 후보로 이해 가능하다.
- `Recover churn risk 0`은 조치 항목이 아니므로 숨기거나 `No churn-risk customers` 한 줄로 처리해야 한다.
- `Improve Partner discovery 100%`의 설명은 “views that are not becoming requests”라는 부정 문장인데 값은 100%다. 성과/실패 방향이 반대다.
- `Watch booking completion 100%`는 고객 단위 고객 여정의 2/2를 사용하면서 문구는 예약 요청 단위 완료율처럼 말한다.
- 같은 화면 아래쪽의 예약 건수는 350 created, 1 completed다. 이 상태에서 100% 완료라고 말하는 것은 운영상 치명적이다.

### Step 7 — Last 7 days 추세와 상세 지표 · 상태: 심각

![7일 상세 지표](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/08-7d-metrics.png)

- booking requests 약 180의 피크와 app opens/Partner views를 한 Y축에 겹쳐 작은 선이 거의 읽히지 않는다.
- `Created 350`, `Closed cancelled / expired 304`, `Completed 1`은 페이지에서 가장 중요한 운영 신호지만 화면 중간 아래에 작게 숨어 있다.
- `Review problem customers 4`만 보면 업무량이 4건처럼 보이나 실제 문제 예약은 304건이다. `4 customers · 304 booking cases`처럼 두 단위를 함께 보여야 한다.
- Refund amount가 좁은 카드에서 숫자 단위로 줄바꿈된다.
- Payment methods `1`은 운영 의사결정 가치가 거의 없다. 실패 결제·환불만 액션 영역에 남기고 결제수단 구성은 재무/마케팅 화면으로 보내는 편이 낫다.

### Step 8 — Last 7 days 고객·Partner 활동 · 상태: 심각

![7일 고객 및 Partner 표](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/09-7d-customer-table.png)

- Customer 표는 절반 폭이라 주요 열을 보기 위해 내부 가로 스크롤이 필요하다.
- 고객 전화번호가 전체 노출된다. 이 화면의 목적은 순위·이상 징후 파악이므로 전체 번호가 필요하지 않다.
- Demo/Smoke/Audit 이름이 운영 지표에 그대로 나타난다.
- Customer의 `Issues 295`와 상단 `Review problem customers 4`는 단위가 다르지만 설명이 없다.
- Partner 표는 10행을 전부 보여 페이지가 길다. 기본 5행과 `View all Partners`가 더 빠르다.

### Step 9 — Partner·서비스·지역 분포 · 상태: 위험

![7일 서비스와 지역](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/10-7d-partners-services-regions.png)

- Smoke Partner가 다수 포함되어 실서비스 순위를 오염시킨다.
- Foot Massage 338 bookings, HCMC 350 requests, 1 completed가 보여 데이터 오염 또는 심각한 운영 실패를 시사한다.
- 이 수치가 실제인지 synthetic인지 구분할 표식이 없다.
- Top regions는 requests와 completed만 있어 350→1이라는 실패 원인을 알 수 없다. 취소/만료 및 open 상태를 함께 보여야 한다.

### Step 10 — Custom 기본 상태 · 상태: 주의

![Custom 기본 기간](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/11-custom-range.png)

- From/To 라벨과 Apply 버튼은 명확하다.
- 필터 요약은 `Range: Custom period`만 보여 실제 적용 날짜를 반복 확인할 수 없다.
- 하루짜리 Custom은 API에서 시간별 차트를 만들지만 페이지 설명은 `Daily activity`로 표시한다.
- 최대 90일 제한, 미래 날짜 처리, From > To 처리 규칙이 화면에 없다.

### Step 11 — Custom 90일 자동 보정 · 상태: 심각

![Custom 자동 보정](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/12-custom-range-clamped.png)

- 사용자는 2026-01-01~2026-12-31을 입력한 것으로 보지만 서버는 미래 To를 현재로 줄이고 From을 최대 90일 범위로 당긴다.
- 화면 입력값은 원래 요청값을 그대로 유지하고 실제 적용 범위를 표시하지 않는다.
- 이 상태의 모든 KPI·비교값은 화면에 보이는 날짜와 다른 기간의 값이다.
- 자동 보정 대신 입력 단계에서 오류를 표시하거나, 보정 후 canonical URL과 입력값을 실제 적용 범위로 바꿔야 한다.

### Step 12 — 1024px 상단 · 상태: 위험

![1024px 상단](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/13-1024-top.png)

- 좌측 탐색과 본문이 각각 스크롤돼 스크롤 위치를 잃기 쉽다.
- H1/설명 카드가 불필요하게 높고, 기간 설명과 상태 배지가 좁은 폭을 과도하게 사용한다.
- KPI가 2열로 내려가는 동작 자체는 괜찮다.
- 상단 breadcrumb와 workspace actions가 두 줄로 갈라져 헤더 높이가 커진다.

### Step 13 — 1024px 지표 · 상태: 사용 불가

![1024px 상세 지표](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/14-1024-metrics.png)

- Lifecycle 카드의 각 라벨이 글자 단위로 세로 배치된다.
- 이는 콘텐츠가 좁은데도 2열 insight grid를 유지하고, 같은 grid class가 바깥 body와 안쪽 metric strip에 중복 적용되기 때문이다.
- 추세 차트는 높이를 많이 쓰지만 booking spike 때문에 다른 지표는 읽을 수 없다.
- 이 화면 크기는 일반 운영 노트북에서도 발생하므로 모바일 폴리시 문제로 미룰 수 없다.

### Step 14 — 200% 확대 상당 상단 · 상태: 주의

![200% 확대 상당 상단](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/15-200pct-equivalent-top.png)

- 720 CSS px에서는 좌측 탐색이 메뉴 버튼으로 접혀 상단은 비교적 정상적으로 재배치된다.
- 기간 버튼은 한 줄을 유지해 누르기 쉽다.
- 상태 배지와 필터 요약이 중복되어 좁은 화면 공간을 많이 사용한다.

### Step 15 — 200% 확대 상당 지표 · 상태: 사용 불가

![200% 확대 상당 지표](C:/dev/massage-on-demand-vn/output/usage-overview-audit-2026-08-06/16-200pct-equivalent-metrics.png)

- 720px에서도 insight 영역이 2열을 유지해 모든 lifecycle 라벨이 세로 글자처럼 깨진다.
- WCAG 1.4.10 Reflow 관점에서 심각한 위험이다. 실제 브라우저 200% 확대와 스크린리더는 별도 검증이 필요하지만, 현재 캡처만으로도 확대 사용이 어렵다는 점은 확인된다.

## 5. P0 — 먼저 고쳐야 할 항목

### P0-1. 모든 Action priorities 링크를 실제 대상 필터 계약과 맞춘다

#### 확인된 문제

- `Review problem customers` → `/customers?segment=issue`
  - Customers가 지원하는 segment는 `cancellation-risk`이며 `issue`는 무시된다.
  - 잘못된 segment가 사라진 뒤 기본 view `needs-action`이 적용되어 결제/리뷰 큐로 간다.
- `Recover churn risk` → `/customers?segment=inactive-30d`
  - segment는 유효하지만 `view=all`이 없어 기본 `needs-action`과 결합된다.
- `Convert new unbooked` → `/customers?segment=never-booked`
  - 동일하게 기본 `needs-action`과 결합된다.
- `Improve Partner discovery` → `/partners?sort=profile-views`
  - Partner sort는 `profile-views`를 지원하지 않아 기본 `ops-priority`로 바뀐다.
- `Watch booking completion` → `/bookings?view=all`
  - 선택 기간과 미완료/실패 조건이 전혀 전달되지 않는다.

#### 수정 요건

1. 문자열 href를 직접 쓰지 말고 대상 페이지의 기존 href/query builder를 재사용한다.
2. 고객 링크는 반드시 명시적으로 `view=all`을 포함한다.
3. source의 Today/7d/30d/Custom 범위를 target이 지원하는 날짜 필터로 전달한다.
4. target이 같은 cohort를 표현할 수 없으면 링크를 만들기 전에 target filter 계약을 최소 확장한다.
5. target 페이지 상단 active filter summary가 source 카드의 의미와 동일해야 한다.
6. source count와 target total이 같은 데이터 계약으로 계산되는 통합 테스트를 추가한다.

### P0-2. 고객 단위 전환율과 예약 단위 전환율을 분리한다

#### 확인된 문제

- `Customer journey`는 unique customer count다.
- `Action priorities`의 완료율은 이 customer funnel rate를 재사용한다.
- 카드 문구는 preferred Partner **requests**의 완료율처럼 표현한다.
- 7일 실제 화면은 고객 여정 2→2→2→2로 100%지만 booking records는 Created 350, Completed 1, Closed cancelled/expired 304다.

#### 수정 요건

- Customer journey는 유지하되 제목을 `Customer reach funnel` 또는 `Unique-customer journey`로 바꾸고 각 단계에 `unique customers`를 표시한다.
- 별도 `Booking outcomes`를 추가한다.
  - Created booking records
  - Completed in period
  - Closed cancelled / no-show / expired
  - Refunded
  - Still open / unresolved
  - 완료율 분모와 시간 기준을 명시한다.
- `Watch booking completion`은 booking record 단위로 계산한다.
- 문제 카드는 `4 affected customers · 304 booking cases`처럼 고객 수와 사건 수를 함께 표시한다.
- 서로 다른 timestamp 기준을 숨기지 않는다.
  - Created: `booking.createdAt`
  - Completed/cancelled/refunded: `booking.closedAt` 또는 명시된 상태 전환 시각

### P0-3. 기간 지표와 현재 스냅샷을 분리한다

#### 확인된 문제

- `neverBookedCustomerCount`는 선택 기간과 무관한 전체 현재 수치다.
- `churnRiskCustomerCount`도 현재 기준 30일 비활성 스냅샷이다.
- 화면은 이들을 Today/Last 7 days/Custom 배지 아래 둔다.

#### 수정 요건

- `Period activity`에는 기간 조건이 실제 적용되는 지표만 둔다.
- `Current customer base · As of now` 그룹에 다음을 옮긴다.
  - Never booked
  - Churn risk
  - 필요하면 Active today/7d/30d snapshot
- 현재 스냅샷 카드에 선택 기간 badge를 사용하지 않는다.
- 비교 기간 delta도 기간 지표에만 표시한다.

### P0-4. Custom 실제 적용 기간을 canonical하게 만든다

#### 수정 요건

- From/To에 최대 90일, 미래 날짜 불가, From ≤ To 규칙을 입력 단계에서 제공한다.
- 서버는 신뢰 경계에서 계속 검증하되 조용히 다른 기간으로 바꾸지 않는다.
- 보정을 유지한다면 응답의 `fromDate`, `toDate`를 프런트가 사용해 URL과 input을 실제 적용 값으로 canonical redirect한다.
- 필터 요약과 모든 scope badge에 실제 날짜 범위를 표시한다. 예: `8 May–6 Aug 2026 · 90 days`.
- 하루짜리 Custom은 `Hourly activity`, 3일 이상은 `Daily activity`처럼 실제 trend granularity로 설명한다.

### P0-5. synthetic/test 데이터에 명시적 provenance를 부여하고 운영 통계에서 제외한다

#### 확인된 문제

- 화면에 Demo/Smoke/Audit 고객과 Partner가 나타난다.
- 현재 query에는 synthetic 제외 조건이 없다.
- User/AppUsageDailyAggregate에는 운영 통계에서 신뢰할 수 있는 provenance 필드가 없다.

#### 최소 수정 방향

- `User`에 명시적인 synthetic/data-origin marker를 두고 smoke/seed/audit writer가 생성 시 설정한다.
- booking/payment/refund/review 집계는 해당 customer/Partner의 marker 또는 booking의 명시적 metadata marker를 통해 제외한다.
- AppUsageEvent/AppUsageDailyAggregate도 synthetic user를 server-side join으로 제외한다.
- 이름, 전화번호, ID prefix로 런타임 필터링하지 않는다.
- 현재 로컬 DB의 기존 fixture는 자동 삭제하지 말고 별도 점검 스크립트로 목록화·마킹한다.
- 응답/화면에서 실제로 보장될 때만 `Synthetic data excluded`를 표시한다.

### P0-6. `Updated`를 실제 데이터 freshness로 바꾼다

#### 확인된 문제

- API의 `generatedAt`은 `new Date()`다.
- 이는 쿼리 시각이지 aggregate가 마지막으로 반영된 시각이 아니다.
- `refreshSeconds: 60`은 프런트에서 사용되지 않는다.

#### 수정 요건

- `generatedAt`은 `Report generated`로만 사용하거나 숨긴다.
- 별도 `dataThroughAt`을 AppUsageDailyAggregate의 `lastOccurredAt` 및 관련 booking/review/refund 원천의 최신 시각에서 정의한다.
- 화면에는 `Data through 6 Aug 2026, 13:20 ICT`처럼 표시한다.
- 자동 새로고침은 필수가 아니다. 최소 구현은 명확한 `Refresh` 링크/버튼과 실제 source freshness다.
- `refreshSeconds`를 구현하지 않을 것이면 제거한다.

### P0-7. 레이아웃 연결 오류를 바로잡는다

#### 코드 원인

- 공용 content variant가 출력하는 클래스: `usage-overview-grid`
- 새 CSS가 대상으로 삼는 클래스: `usage-overview-content-grid`
- 기존 `.usage-overview-ranking-card:last-child`가 Partner 표를 전체 폭으로 만든다.
- `usage-overview-mini-metric-list`가 AdminSection body와 AdminMiniMetricStrip 안쪽에 동시에 적용되어 중첩 3열 grid가 된다.

#### 수정 요건

- 존재하지 않는 `.usage-overview-content-grid` override를 제거하거나 실제 wrapper class를 명시적으로 연결한다.
- Customer와 Partner 표는 둘 다 full-width 순차 section으로 만든다.
- `usage-overview-mini-metric-list`는 내부 strip 한 곳에만 적용한다.
- 1280px 이하에서 insight section은 한 열로 쌓는 편이 안전하다.
- metric strip은 `repeat(auto-fit, minmax(140px, 1fr))` 또는 공용 strip의 기존 안전한 규칙을 사용한다.
- 1440/1280/1024/720 CSS px에서 글자 단위 줄바꿈이 없어야 한다.

### P0-8. 목록 전화번호를 서버에서 마스킹한다

- Customer ranking의 `secondary`에 raw phone을 그대로 넣고 있다.
- Partner도 city가 없으면 raw phone을 보낸다.
- 상세 화면으로 들어가기 전 순위 목록에서 전체 번호는 필요하지 않다.
- API 응답부터 `+84••••••0001`처럼 마스킹한다. UI-only masking은 개발자 도구/네트워크에서 원문이 남으므로 부족하다.
- 현재 접근 권한이 `CUSTOMERS_DIRECTORY`인 것은 유지 가능하지만, 집계 조회와 전체 PII 조회 필요성은 별도로 검토한다.

## 6. P1 — 운영 효율을 높이는 구조 개선

### P1-1. Action priorities에는 실제 trigger만 보여준다

- count가 0이거나 denominator가 0이면 카드로 만들지 않는다.
- 조치 항목이 없으면 `No usage alerts in this period` 한 줄과 마지막 확인 시각을 보여준다.
- 정렬 기준: 고객/금액 영향 → 오래된 미해결 → 급증률.
- 카드에는 `문제`, `영향`, `다음 행동`만 남긴다.

### P1-2. 예약 품질을 화면 상단으로 올린다

7일 화면의 핵심은 350 created 중 304 closed cancelled/expired다. 이 정보는 Action priorities 바로 아래 또는 KPI 행에 있어야 한다. 현재처럼 lifecycle 아래 작은 카드에 두면 실제 운영 경보를 놓친다.

권장 상단 4개:

1. Active customers · unique customers
2. Partner views · events
3. Booking records created
4. Booking completion rate · completed / resolved booking records

App opens는 trend/secondary metric으로 내릴 수 있다.

### P1-3. 추세를 두 스케일로 분리한다

새 차트 라이브러리는 필요 없다. 기존 Recharts로 다음 중 더 단순한 방식을 선택한다.

- 권장: `Customer activity`와 `Booking activity` 두 개의 작은 차트로 분리
- 대안: 한 차트에 series toggle을 두고 기본은 customer activity

예약 피크가 고객 활동 선을 눌러버리는 현재 한 Y축 구성은 피한다.

### P1-4. 0건 추세와 N/A 상태를 정확히 표현한다

- 모든 row의 합이 0이면 chart 대신 empty state를 표시한다.
- 분모 0 conversion은 `0%`가 아니라 `N/A`다.
- retention eligible 0도 `N/A`다.
- `No activity`, `No eligible cohort`, `Source unavailable`을 서로 다른 상태로 유지한다.

### P1-5. 표를 운영 요약형으로 줄인다

Customer 기본 표 권장:

- Customer
- Engagement: app opens / Partner views
- Booking outcome: completed / issues
- Risk badge
- Last active

Partner 기본 표 권장:

- Partner
- Views
- Preferred requests
- Completed
- Last activity

두 표 모두 full width, 기본 top 5, `View all`을 제공한다. 내부 가로 스크롤은 최후 수단으로 둔다.

### P1-6. Retention 기준을 운영자가 이해할 수 있게 쓴다

현재 정의는 “선택 기간에 D1/D7/D30 milestone date가 들어온 가입자 중 정확히 그날 돌아온 비율”이다. 다음처럼 바꾼다.

- 제목: `Return on milestone day`
- 도움말: `Customers whose D1/D7/D30 milestone fell inside the selected period.`
- 각 카드: `12 returned / 20 eligible`를 먼저, 퍼센트를 보조로 표시
- eligible이 너무 적으면 `Low sample` 표시를 고려하되 임의 threshold를 만들지 말고 제품 기준을 정한 뒤 적용한다.

### P1-7. 하단 콘텐츠의 역할을 정리한다

- Popular services: 유지. `bookings`가 booking records인지 requests인지 명확히 표시한다.
- Top regions: requests, completed 외에 cancelled/expired 또는 completion rate를 표시한다.
- Coupon bookings와 payment methods count: 이 페이지 핵심에서 제거하고 Growth/Finance 화면으로 연결한다.
- Failed payments와 refund amount: 실제 조치가 있으면 Action priorities에 포함한다.

## 7. P2 — 문구·시각 개선

### 페이지 문구

| 현재 | 권장 |
|---|---|
| Customer Usage Overview | Customer Usage |
| Customer activity, Partner discovery, booking conversion, and retention from stored Vietnam-time usage aggregates. | See how customers use the app, where booking attempts drop, and who needs follow-up. |
| Usage range | Reporting period |
| Choose a bounded Vietnam-time period... | All dates use Vietnam time. Compare with the immediately preceding period. |
| Action priorities | Needs attention |
| Review problem customers | Review affected customers |
| Recover churn risk | Follow up with inactive customers |
| Convert new unbooked | Help new customers book |
| Improve Partner discovery | Review view-to-request drop-off |
| Watch booking completion | Review unresolved booking attempts |
| Lifecycle and segments | Period customers |
| Booking quality | Booking outcomes |
| Payment and coupon | Payment issues |

### 시각 원칙

- 같은 기간 badge를 모든 카드에 반복하지 말고 section header 한 번만 표시한다.
- 색은 상태를 보조해야 하며 `Review now`, `N/A`, `No issue` 텍스트를 함께 둔다.
- Action card 전체가 링크임을 `Open` 텍스트보다 명확한 `View 4 customers →`로 표현한다.
- 상단 H1 카드 높이를 줄여 첫 화면에 기간과 핵심 alert가 함께 보이게 한다.
- 카드 그림자·border·radius는 기존 디자인 시스템을 유지한다. 새 시각 언어나 의존성은 필요 없다.

## 8. 코드 감사 결과

### 프런트

- `apps/admin_web/app/usage-overview/page.tsx`
  - 기간/section 구조는 명확하다.
  - 동일한 `usage-overview-mini-metric-list`를 body와 inner strip에 중복 적용한다.
  - trend 설명은 range 이름으로 hourly/daily를 결정해 하루짜리 Custom을 잘못 설명한다.
  - Customer table 7열을 절반 폭에 둔다.
- `apps/admin_web/app/usage-overview/usage-overview-model.ts`
  - 5개 action href 중 4개가 target filter 계약과 맞지 않거나 범위를 잃는다.
  - request-level 문구에 customer-level funnel conversion을 재사용한다.
- `apps/admin_web/app/usage-overview/usage-overview-trend-chart.tsx`
  - `rows.length === 0`만 확인해 24개의 0 row를 empty로 인식하지 못한다.
  - chart의 접근 가능한 이름만 있고 값 요약이 없다.
- `apps/admin_web/app/globals.css`
  - `.usage-overview-content-grid`는 실제 DOM에 연결되지 않은 dead selector다.
  - `.usage-overview-ranking-card:last-child` legacy 규칙과 v2 의도가 충돌한다.

### API

- `apps/api/src/admin/admin-usage-overview-query.ts`
  - 10개 raw query를 병렬 실행하며 comparison summary가 무거운 summary query를 한 번 더 실행한다.
  - 성능 문제는 이번 브라우저에서 확정하지 않았으므로 먼저 latency/DB plan을 측정한다. 추측으로 캐시나 새 집계 시스템을 만들지 않는다.
  - never booked/churn risk는 period filter를 적용하지 않는다.
  - customer/Partner phone을 raw로 반환한다.
  - `paymentFailureCount`는 payment 실패 시각이 아니라 연결된 booking createdAt 기준이다. 화면 문구에 맞는 시간 기준인지 재검토한다.
  - `generatedAt`은 source freshness가 아니다.
  - `platformUsage`는 항상 빈 배열이며 현재 화면에서도 사용하지 않는다.
- `apps/api/src/admin/admin-usage-overview.ts`
  - Custom을 최대 90일로 안전하게 제한하지만 적용 결과를 프런트가 알 수 있게 canonical 처리하지 않는다.
- `apps/api/src/admin/admin.service.ts`
  - `getLegacyUsageOverview`는 호출이 없는 약 761줄의 dead implementation이다. 새 query 안정화 후 삭제한다.

### 권한·개인정보

- Web과 API 모두 `/usage-overview`를 `CUSTOMERS_DIRECTORY` category로 분류한다.
- 지역 집계는 좌표를 노출하지 않아 좋다.
- 전화번호는 server-side masking이 필요하다.

### 테스트

기존 focused 테스트 결과:

- Admin Web: 2 files, 10 tests passed
- API: 2 files, 7 tests passed

하지만 현재 테스트는 section/copy 존재, query 호출 횟수, 기본 range만 주로 확인한다. 다음 회귀를 잡지 못한다.

- unsupported action href
- source count와 target total 불일치
- customer rate를 booking rate로 잘못 표시
- global snapshot에 period badge 표시
- Custom silent clamping
- all-zero rows가 빈 차트로 처리되지 않음
- 1024/720 reflow 붕괴
- raw phone 반환
- synthetic 데이터 포함

## 9. 권장 화면 구성

한 페이지를 유지하고 새 분석 플랫폼은 만들지 않는다.

### A. Compact header

- Customer Usage
- 실제 적용 날짜 범위
- Data through 시각
- Refresh
- Vietnam time

### B. Reporting period

- Today / Yesterday / 7 days / 30 days / Month / Custom
- Custom From/To validation
- 비교 기간을 실제 날짜로 표시

### C. Needs attention

- trigger된 항목만 표시
- 각 항목: 문제명 / 영향 고객·예약 / 변화 / 정확히 필터된 target link
- 0건이면 단일 healthy state

### D. Period health

- Active customers
- Partner views
- Booking records created
- Booking completion rate

각 KPI에 unit과 comparison denominator를 명시한다.

### E. Two funnels

- Unique-customer journey
- Booking outcomes

서로 다른 단위를 같은 퍼센트로 섞지 않는다.

### F. Trends

- Customer activity
- Booking activity

### G. Current customer base

- Never booked
- Churn risk
- `As of now` 표시

### H. Retention

- D1/D7/D30 eligibility와 return count
- 0 eligible은 N/A

### I. Drill-down tables

- Customer activity full width, top 5
- Partner discovery full width, top 5
- server-masked phone

### J. Demand patterns

- Popular services
- Regions with outcomes
- 관련 전용 화면 link

## 10. 구현 순서

### 1차 배포 — 신뢰성

1. action links와 target filters 수정
2. booking-unit completion/issue contract 분리
3. global snapshot 분리
4. Custom canonical range 처리
5. synthetic provenance와 server exclusion
6. dataThroughAt 추가
7. server-side phone masking

### 2차 배포 — 레이아웃

1. metric class 중복 제거
2. content wrapper selector 수정
3. Customer/Partner full-width
4. 1280/1024/720 reflow
5. zero-data chart/N/A 처리

### 3차 배포 — 운영 효율

1. triggered actions만 표시
2. booking outcomes 상단 이동
3. trend 분리
4. 표 top 5 및 명확한 unit
5. 문구 정리

## 11. 수용 기준

- Today가 전부 0이면 큰 Needs attention 카드 5개 대신 단일 정상 상태가 보인다.
- 7일 예시에서 350 created / 1 completed / 304 cancelled·expired가 booking-unit 경보에 정확히 반영된다.
- customer-unit 100%는 별도 Unique-customer journey 안에서만 보인다.
- 모든 action link 도착 화면의 active filter summary가 source 카드와 같은 범위·조건을 보여준다.
- `segment=issue`, `sort=profile-views` 같은 unsupported query가 남지 않는다.
- Custom 90일 초과/미래/역전 입력은 오류 또는 canonical 적용 값으로 명확히 처리된다.
- 실제 적용 날짜와 비교 날짜가 화면에 표시된다.
- synthetic marker가 있는 사용자/예약/usage event는 운영 집계와 ranking에서 제외된다.
- raw phone은 API 응답과 화면 모두에 없다.
- `Updated`는 원천 freshness와 혼동되지 않고 `Data through`가 표시된다.
- all-zero trend는 좌표계 대신 empty state를 보여준다.
- retention eligible 0은 0%가 아니라 N/A다.
- 1440, 1280, 1024, 720 CSS px에서 글자 단위 줄바꿈, 겹침, 잘린 empty message가 없다.
- Customer/Partner 표는 각각 full width이며 기본 화면에서 핵심 열을 한 번에 읽을 수 있다.
- 브라우저 200% 확대, 키보드 focus order, 날짜 picker keyboard operation, chart screen-reader summary를 별도로 검증한다.

## 12. 의도적으로 하지 말아야 할 것

- 새 BI/analytics 플랫폼 도입
- 새 차트/UI 라이브러리 추가
- action card마다 새 상세 페이지 생성
- 이름·전화·ID prefix 기반 synthetic 필터
- 현재 로컬 DB fixture 자동 삭제
- customer-level과 booking-level을 하나의 추상 `conversionRate`로 다시 합치기
- 성능 측정 없이 캐시·materialized view를 먼저 추가하기
- 운영 의미를 바꾸면서 UI copy만 수정하기

## 13. 검증 한계

- 캡처는 로그인된 로컬 환경의 현재 데이터 기준이다.
- 서버가 중간에 종료돼 `Review problem customers` 도착 화면 스크린샷은 확보하지 못했다. 이후 코드 대조에서 `segment=issue` 미지원과 기본 `needs-action` 적용을 확인했다.
- 실제 200% 브라우저 zoom은 브라우저 정책상 직접 조작하지 않고 720 CSS px viewport로 reflow 상당 상태를 확인했다.
- contrast ratio, screen reader 발화, date picker keyboard interaction, 전체 focus order는 스크린샷만으로 확정하지 않았다.
- 성능은 query 구조를 검토했지만 부하 테스트나 DB execution plan을 실행하지 않았다.

