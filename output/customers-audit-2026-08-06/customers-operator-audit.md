# Customers 운영자 UX 심층 감사 보고서

- 대상: `http://localhost:3101/customers`
- 감사일: 2026-08-06
- 관점: 개발자가 아니라 고객지원·예약운영·결제/환불 운영자가 실제로 고객을 찾고, 현재 문제를 판단하고, 상세 조치 후 다시 목록으로 돌아오는 흐름
- 확인 범위: 기본 `Needs action`, 전체 고객, 검색, 고급 필터, 오늘 가입/오늘 활동, 페이지네이션, 고객 상세 진입·복귀, 1024/1280/1440px 화면, 관련 Admin Web/API 코드와 테스트
- 변경 여부: 제품 소스는 수정하지 않았으며, 이 보고서와 증거 스크린샷만 추가했다. 현재 워크트리에 있던 기존 사용자 변경도 건드리지 않았다.

## 1. 결론

현재 화면은 이전보다 훨씬 간결해졌고, 기본 진입점을 `Needs action`으로 둔 방향도 운영 화면에 맞다. 이름·전화·이메일·고객 ID를 한 검색창에서 찾고, 전화번호를 마스킹하며, 표·페이지네이션·빈 상태를 공통 컴포넌트로 구성한 점도 좋다.

그러나 지금 상태를 그대로 운영에 투입하면 다음 네 가지가 특히 위험하다.

1. **빈 사용자 지정 기간을 적용하면 실제 날짜 조건은 전혀 전달되지 않지만 화면에는 `Custom period`가 활성 필터처럼 표시되고 전체 35명이 반환된다.** 운영자는 특정 기간만 보고 있다고 오인할 수 있다.
2. **`Needs action`이라는 명칭과 안내 문구가 실제 조회 조건보다 넓다.** 목록 API는 실패 결제·요청 환불·신고 리뷰만 찾지만, 상세 화면은 채팅 누락·최근 예약 차단·추천인 검토·메시지 전송 실패까지 “조치 필요”로 본다. 기본 큐가 0이어도 다른 실제 조치 대상이 있을 수 있다.
3. **목록 또는 요약 API가 실패해도 빈 배열/0으로 대체되어 정상적인 ‘문제 없음’처럼 보인다.** 운영자가 장애를 정상 상태로 오판할 수 있다.
4. **URL의 페이지 번호가 실제 마지막 페이지를 넘으면 데이터는 비어 있는데 페이지네이션은 마지막 페이지를 선택한 것처럼 표시된다.** `page=99`에서 35명 중 0명을 보여 주면서 4페이지가 선택되었다.

따라서 첫 수정은 장식이나 색상이 아니라 **필터 신뢰성, 조치 큐 정의, 오류 상태, 페이지 범위**여야 한다. 그 다음에 목록의 정보 의미와 노트북 폭 대응을 다듬는 것이 맞다.

## 2. 운영자가 이 화면에서 완료해야 하는 일

운영자에게 필요한 흐름은 아래 다섯 단계다.

1. 지금 즉시 처리해야 하는 고객이 있는지 신뢰할 수 있게 확인한다.
2. 이름·전화·이메일·고객 ID로 고객을 빠르게 찾는다.
3. 현재 예약 상태, 최근 앱 활동, 미해결 문제, 이용/결제 이력을 한 행에서 구분해 판단한다.
4. 고객 상세에서 근거를 확인하고 조치한다.
5. 기존 검색·필터·페이지 위치를 유지한 채 목록으로 돌아와 다음 고객을 처리한다.

현재 화면은 2번은 대체로 잘 수행하지만, 1·3·5번에서 신뢰와 맥락이 끊긴다.

## 3. 화면별 감사

### Step 1. 기본 `Needs action` 진입 — 상태: 혼합

![Needs action 기본 화면](C:/dev/massage-on-demand-vn/output/customers-audit-2026-08-06/01-needs-action-overview.png)

좋은 점:

- 첫 진입을 전체 명부가 아니라 조치 큐로 정한 것은 고객지원 운영에 적합하다.
- `Needs action 0 / All customers 35 / New today 0 / Active today 0`을 한 줄에서 비교할 수 있다.
- 빈 상태 제목이 `No customer issues need action`이라서 일반 검색 결과 없음과 구분하려는 의도가 있다.
- 활성 필터가 없을 때 불필요한 `Clear filters`를 숨기고, 표가 첫 화면 안쪽에 빠르게 나타난다.

문제:

- 빈 상태는 `booking, payment, wallet, refund, or reported-review issue`가 없다고 말하지만 실제 API의 조건은 실패 결제, 요청 상태 환불, 신고 상태의 양방향 리뷰뿐이다. 지갑 이상과 일반 예약 이슈는 이 조건에 없다.
- 고객 상세의 조치 큐는 위 조건 외에도 채팅방 누락, 최근 예약 생성 차단, 추천인 검토, 알림 전송 실패를 조치 대상으로 본다.
- 따라서 숫자 `0`은 “고객지원 조치 없음”이 아니라 “세 가지 데이터 조건에 해당하는 고객 없음”에 가깝다.
- 이 화면에서 API 실패도 동일한 0/빈 상태로 보일 수 있다. 운영자는 데이터가 없어서 0인지, 조회에 실패해서 0인지 구별할 수 없다.
- 상단 `Open bookings / Open payments / Open reviews`는 특정 고객 맥락 없이 다른 모듈로 이동하는 일반 링크다. 기본 큐가 비었을 때만 보조 탐색으로는 쓸 수 있지만, 항상 헤더의 가장 강한 위치를 차지할 필요는 없다.

권장 수정:

- 단기 안전 수정: 서버 기준을 확장하기 전에는 큐 이름을 `Payment & review issues`처럼 실제 조건에 맞게 좁히고, 설명도 `Failed payments, requested refunds, and reported reviews`로 정확히 쓴다.
- 목표 수정: 상세 화면이 이미 계산하는 **미해결 조치 신호를 서버에서 한 번 정의**하고 목록과 상세가 같은 정의를 사용하게 한다. 단, 당장 거대한 규칙 엔진을 만들 필요는 없다. 현재 저장돼 있고 상세에서 이미 사용하는 신호만 공유하면 된다.
- 조회 실패 시 `Unable to load customer queue`와 `Retry`를 표시한다. 기존 `adminGetResult`가 이미 있으므로 새 요청 계층을 만들 필요가 없다.
- 큐가 정말 0이면 `All customers`로 가는 한 개의 보조 행동만 빈 상태에 둔다. 세 개의 일반 모듈 링크는 헤더에서 제거하거나 낮은 우선순위 메뉴로 내린다.

권장 문구:

- 정확한 임시 제목: `No payment or review issues found`
- 정확한 임시 설명: `No failed payment, requested refund, or reported review matches this queue.`
- 통합 기준 완성 후 제목: `No open customer actions`
- 통합 기준 완성 후 설명: `No unresolved payment, refund, review, booking-block, chat, referral, or delivery issue was found.`

### Step 2. `All customers` 명부와 표 — 상태: 혼합

![전체 고객 상단](C:/dev/massage-on-demand-vn/output/customers-audit-2026-08-06/02-all-customers-overview-1280.png)

![전체 고객 표](C:/dev/massage-on-demand-vn/output/customers-audit-2026-08-06/03-customer-directory-table-1280.png)

![전체 고객 페이지네이션](C:/dev/massage-on-demand-vn/output/customers-audit-2026-08-06/04-customer-pagination-1280.png)

좋은 점:

- 한 행에 고객, 활동, 예약, 주의 신호, 금액을 모아 운영 밀도가 높다.
- 결제 누계와 지갑 잔액을 합치지 않고 별도 값으로 보여 주는 것은 회계 오판을 줄인다.
- 서버에서 전화번호를 마스킹해 내려보내므로 브라우저 DOM에 원문 전화번호가 노출되지 않는 구조다.
- 표 머리글, 페이지네이션, 포커스 가능한 스크롤 영역이 있으며 스크롤 영역에는 `Scrollable data table` 접근성 이름이 있다.
- 35명을 서버 페이지네이션하고 첫 페이지 10명을 보여 주므로 무제한 DOM 렌더링은 하지 않는다.

문제:

1. **`Last activity` 열이 서로 다른 두 개념을 섞는다.** 배지는 `In service / Matching / Active booking`처럼 예약 상태를 우선 표시하지만 그 아래 시간은 앱 세션의 `lastSeenAt`이다. `In service · 3일 전`처럼 보이면 서비스가 3일째 진행 중인지, 고객 앱 접속이 3일 전인지 구별하기 어렵다.
2. **`Bookings` 아래 완료 일시는 완료 시점이 아니라 해당 완료 예약의 마지막 `updatedAt`일 수 있다.** 사후 수정이 있으면 운영자가 서비스 완료 시각으로 오해한다.
3. **`Last booking date` 필터도 예약 생성/요청 시각이 아니라 최대 `bookings.updatedAt`을 사용한다.** 문구와 데이터 의미가 다르다.
4. `Attention` 열에는 현재 미해결 문제와 과거 행동 이력이 섞인다. `Payment failed 2`와 `Refund 1`은 처리할 수 있는 열린 문제지만 `Customer cancels 1`, `No-show 1`은 누적 이력이다. 같은 색의 경고 배지로 보이면 현재 조치 대상처럼 읽힌다.
5. 이름이 없는 고객은 마스킹 전화번호가 굵은 이름과 보조 문구에 두 번 반복된다. 고객을 구분하는 추가 단서가 없다.
6. 상세 진입은 이름 링크로만 가능하다. 익숙하지 않은 운영자는 행에 조치가 없는 것으로 볼 수 있다.
7. 내부적으로 `10/25/50` 페이지 크기와 여러 정렬을 지원하지만 화면에 제어가 없다. 현재 `newest` 정렬도 운영자에게 보이지 않는다.
8. API가 제공하는 `generatedAt`을 화면에서 사용하지 않아 목록의 기준 시각을 확인할 수 없다. `Online`은 서버 렌더 시점의 30분 규칙이며 자동 갱신되지 않는다.

권장 정보 구조는 5열을 유지하되 의미를 다음처럼 바꾸는 것이다.

| 현재 | 권장 | 이유 |
| --- | --- | --- |
| Customer | Customer | 이름 + 마스킹 전화 + 짧은 고객 ID를 보여 미등록 이름도 구분 |
| Last activity | Current situation | 예약 상태와 그 예약의 상태 시각을 우선, 앱 활동은 `App active …` 보조 줄로 명시 |
| Bookings | Booking history | `1 of 6 completed`와 검증된 완료 시각 또는 `Last booking activity`를 명시 |
| Attention | Open work / History | 열린 이슈와 누적 취소·노쇼를 시각적으로 분리 |
| Customer value | Money | `Paid`와 `Wallet`을 유지하되 열 제목을 더 직접적으로 변경 |

최소 구현안:

- `Current situation` 셀: `In service` + `Booking updated 10 min ago`; 두 번째 줄 `App active 2 h ago`.
- 열린 문제만 빨강/주황 경고 배지로 표시한다. 과거 이력은 `History: 1 customer cancel`처럼 중립 톤으로 내린다.
- 예약 완료의 권위 있는 시각이 스키마에 있으면 그것을 사용한다. 없다면 문구를 `Last booking update`로 바꿔 의미를 정확히 한다.
- 이름이 없으면 `Unnamed customer`를 기본 이름으로 쓰고 아래에 `+84*******18 · ID …4f2a`를 표시한다. 마스킹 전화번호를 이름으로 승격하지 않는다.
- 이름 우측에 작은 chevron 또는 `Open` 링크를 둔다. 별도 액션 열까지 추가할 필요는 없다.
- 정렬은 한 개의 작은 `Sort` 선택으로 노출한다. 사용 빈도가 검증되지 않은 페이지 크기는 당장 노출하지 않아도 된다. 기본 10명이 실제 운영에 부족하다는 로그가 확인될 때 25명으로 바꾼다.
- 표 위에 `Updated 09:04`와 `Refresh` 한 개를 둔다. 실시간 소켓을 새로 만들 필요는 없다.

### Step 3. 고급 필터와 사용자 지정 기간 — 상태: 나쁨

![고급 필터 펼침](C:/dev/massage-on-demand-vn/output/customers-audit-2026-08-06/05-more-filters-expanded-1280.png)

![빈 사용자 지정 기간 결과](C:/dev/massage-on-demand-vn/output/customers-audit-2026-08-06/07-empty-custom-range-result-1280.png)

좋은 점:

- 기본 행에는 검색과 고객 세그먼트만 두고, 낮은 빈도의 날짜·로케일·성별 필터를 `More filters` 안으로 넣은 것은 적절하다.
- 날짜 차원을 `Last active / Joined / Last booking` 중 하나만 고르게 한 것은 여러 날짜 필터가 중첩되는 혼란을 줄인다.
- 기본 기간 프리셋은 베트남 시간대를 기준으로 계산하고 API 경계도 베트남 날짜를 UTC로 올바르게 변환한다.
- 네이티브 날짜 입력을 사용하므로 별도 달력 라이브러리를 추가할 필요가 없다.

심각한 문제:

- `Custom`을 선택한 최초 화면에는 From/To가 나타나지 않는다. 서버는 URL에 이미 `dateRange=custom`이 있을 때만 날짜 입력을 렌더링하기 때문이다. 운영자는 `Apply filters`를 한 번 눌러야 날짜 입력을 볼 수 있다.
- 첫 적용 시 빈 `dateFrom/dateTo`는 URL에서 빠지고 API 쿼리에도 어떤 날짜 조건도 전달되지 않는다.
- 그럼에도 화면은 `Last active date: Custom period`라는 활성 칩을 표시하고 전체 35명을 반환한다.
- 즉, 한 번의 조작이 필요한 정도가 아니라 **필터 적용 여부를 거짓으로 표현하는 데이터 신뢰성 문제**다.

권장 수정:

- `Custom` 선택 즉시 From/To 두 입력을 보여 준다.
- 두 날짜가 모두 없으면 `Apply filters`를 비활성화하고 `Choose a start and end date`를 인라인으로 표시한다.
- 한쪽만 입력했을 때 단측 범위를 허용할 것인지 정책을 명확히 한다. 운영 화면에서는 실수 방지를 위해 두 날짜 필수를 권장한다.
- `From > To`를 거부한다.
- 유효한 범위가 아닐 때 활성 필터 칩과 API 날짜 조건을 만들지 않는다.
- API 경계에서도 잘못된/빈 사용자 지정 범위를 거부하거나 무시한 사실을 명확한 오류로 반환해 URL 수동 조작을 방어한다.
- 날짜 입력은 기존 네이티브 `<input type="date">`를 유지한다. 새 날짜 선택 라이브러리는 필요 없다.

검수 기준:

- `Custom` 선택 한 번으로 두 입력이 나타난다.
- 빈 값으로 적용할 수 없다.
- `2026-08-10 ~ 2026-08-01`은 오류가 난다.
- 유효한 `2026-08-01 ~ 2026-08-06`만 URL과 API에 전달된다.
- 화면의 활성 필터 칩, 결과 수, 실제 API 조건이 항상 일치한다.

`App locale`에도 의미 문제가 있다. 현재 서버는 `-VN/-KR/-JP/-CN/-SG` 접미사를 국가처럼 해석하고, 예외적으로 `vi`만 VN으로 인정한다. 따라서 bare `ko`, `ja`, `zh`는 각각 한국어·일본어·중국어 사용자임에도 선택한 로케일에서 빠질 수 있다. 반대로 언어만으로 사용 국가를 단정해서도 안 된다.

권장 정책은 둘 중 하나다.

- 운영 목적이 언어라면 이름을 `App language`로 바꾸고 `vi/ko/ja/zh/en` 기본 언어 코드를 일관되게 필터링한다.
- 운영 목적이 지역이면 이름을 `Session region`으로 바꾸고 지역이 포함된 태그만 사용하며, bare 언어 코드는 `Unknown region`으로 둔다.

현재 구성에서는 고객 응대 언어를 찾는 목적에 더 가까우므로 첫 번째가 더 직관적이다.

### Step 4. `New today`와 `Active today` 빈 상태 — 상태: 혼합

![오늘 가입 빈 상태](C:/dev/massage-on-demand-vn/output/customers-audit-2026-08-06/08-new-today-empty-1280.png)

![오늘 활동 빈 상태](C:/dev/massage-on-demand-vn/output/customers-audit-2026-08-06/09-active-today-empty-1280.png)

좋은 점:

- 두 기준 모두 베트남 영업일 기준으로 계산된다.
- 운영 뷰 전환 시 페이지가 1로 초기화된다.
- 각 탭에 결과 수가 표시되어 들어가기 전에 규모를 알 수 있다.

문제:

- 필터가 전혀 없고 해당 날짜의 결과가 0인데도 `Change the filters or clear the search`라고 말한다. 운영자는 숨은 필터가 걸린 것으로 오해한다.
- `New today 0`이 오늘 생성된 프로필 0명인지, API 로드 실패인지 구분되지 않는다.
- `Active today`의 ‘활동’은 앱 세션 `lastSeenAt`을 뜻하지만 화면에 기준 설명이 없다. 예약 활동을 포함하는 것으로 읽힐 수 있다.

권장 문구:

- New today: `No customers joined today` / `No customer profile was created today in Vietnam time.`
- Active today: `No app activity today` / `No customer app session was seen today in Vietnam time.`
- 실제 검색/필터가 있을 때만 `No customers match these filters`와 `Clear filters`를 사용한다.
- 조회 실패 시에는 위 빈 상태가 아니라 오류 상태를 사용한다.

### Step 5. 검색 → 상세 → 목록 복귀 — 상태: 나쁨

![고객 검색 결과](C:/dev/massage-on-demand-vn/output/customers-audit-2026-08-06/10-customer-search-result-1280.png)

![고객 상세 진입](C:/dev/massage-on-demand-vn/output/customers-audit-2026-08-06/11-customer-detail-entry-1280.png)

좋은 점:

- `HANDS` 검색으로 35명 중 1명으로 즉시 좁혀졌고 활성 검색 칩도 표시됐다.
- 고객 이름을 통해 상세 페이지에 진입할 수 있다.
- 상세 상단은 `Needs action` 상태와 연락처, 고객 문맥을 먼저 보여 주려는 구조다.

문제:

- 상세의 `Back to customers`는 코드상 고정 `/customers`다.
- 실제로 `view=all&q=HANDS`에서 상세에 들어간 뒤 돌아오면 검색, 뷰, 페이지, 필터가 모두 사라지고 기본 `Needs action` 빈 화면으로 돌아갔다.
- 여러 고객을 연속으로 처리하는 운영자는 매번 검색을 다시 해야 한다.
- 상세의 조치 기준과 목록의 `Needs action` 기준이 다르므로, 목록에서 0이었던 고객이 상세에서는 조치 필요로 나타날 가능성이 있다.

권장 수정:

- 상세 링크에 안전한 `returnTo`를 넣거나, 목록 상태를 나타내는 쿼리를 상세에 전달한다.
- `returnTo`는 반드시 `/customers` 내부 경로만 허용해 외부 리디렉션을 막는다.
- 상세의 `Back to customers`는 `Back to search results`로 표시하고 기존 `view/q/segment/date/page/sort`를 복원한다.
- 브라우저 Back도 동일한 결과를 주도록 링크 탐색과 서버 렌더가 URL 상태를 기준으로 동작해야 한다.
- 복귀 후 가능하면 직전에 열었던 행에 포커스를 돌린다. 이 기능은 키보드 운영 빈도가 확인될 때 추가해도 되며, 1차 필수는 URL 문맥 보존이다.

검수 시나리오:

1. `All customers`에서 `HANDS` 검색.
2. 검색 결과 고객 상세 진입.
3. `Back to search results` 클릭.
4. `view=all&q=HANDS`와 이전 페이지가 유지되고 동일한 한 행이 보인다.

### Step 6. 1024/1440px 반응형 — 상태: 1440 좋음, 1024 나쁨

![1024px 전체 화면](C:/dev/massage-on-demand-vn/output/customers-audit-2026-08-06/12-all-customers-overview-1024.png)

![1024px 고객 표](C:/dev/massage-on-demand-vn/output/customers-audit-2026-08-06/13-customer-directory-table-1024.png)

![1440px 전체 화면](C:/dev/massage-on-demand-vn/output/customers-audit-2026-08-06/14-all-customers-overview-1440.png)

측정 결과:

- 브라우저 콘텐츠 폭: 1009px
- 사이드바를 제외한 표 스크롤 영역: 636px
- 표 실제/스크롤 폭: 780px
- 가로 초과: 144px
- 문서 전체는 가로로 넘치지 않고 표 영역에만 스크롤이 있다.
- 콘솔 warning/error: 이번 감사 흐름에서는 없음.

좋은 점:

- 전체 문서가 가로로 흔들리지 않고 표만 스크롤되도록 격리했다.
- 표 스크롤 영역은 키보드 포커스를 받을 수 있다.
- 1440px에서는 다섯 열과 필터가 안정적으로 보인다.

문제:

- 1024px에서 `Customer value` 열이 잘리고, 가로 스크롤바는 10개 행 아래에 있어서 첫 행을 읽을 때 존재를 알기 어렵다.
- 운영 뷰 버튼과 헤더 액션이 불규칙하게 여러 줄로 감긴다.
- CSS 반응형 기준이 브라우저 폭을 보지만 실제 문제는 사이드바를 뺀 **콘텐츠 폭**에서 발생한다. 그래서 1024px 뷰포트인데도 720px 이하 규칙이 적용되지 않는다.
- 노트북 크기에서 고객 이름과 열린 이슈를 고정해 비교하기 어렵다.

권장 수정 순서:

1. 1180~1200px 이하에서 기존 사이드바를 자동 축소할 수 있으면 먼저 사용한다. 새 레이아웃 시스템을 만들 필요가 없다.
2. 필터와 운영 뷰는 viewport media query 대신 컨테이너 폭 또는 `auto-fit/minmax()`로 정렬한다.
3. 표를 유지한다면 첫 `Customer` 열을 sticky로 만들고 우측에 더 있음 표시를 준다.
4. 그래도 폭이 부족할 때만 `Customer value`를 행의 보조 줄로 내린다. 접근성 있는 표를 전부 카드 DOM으로 복제하는 것은 마지막 수단이다.

검수 폭:

- 1024×768: Customer, 현재 상태, 열린 문제를 스크롤 없이 우선 확인할 수 있어야 한다.
- 1280×800: 다섯 열과 페이지네이션이 자연스럽게 보여야 한다.
- 1440×900: 현재 수준의 정보 밀도를 유지해야 한다.
- 200% 확대: 필터 라벨과 버튼이 겹치지 않고, 표 스크롤 영역에 키보드로 접근할 수 있어야 한다.

### Step 7. 잘못된 페이지 URL — 상태: 나쁨

![page=99 결과](C:/dev/massage-on-demand-vn/output/customers-audit-2026-08-06/15-invalid-page-99-1440.png)

재현 URL: `/customers?view=all&page=99`

실제 결과:

- 결과 문구: `Showing 0 to 0 of 35 entries`
- 표: `No customers found`
- 페이지네이션: 4페이지가 활성화
- URL: 여전히 `page=99`

원인:

- 표시용 현재 페이지는 `Math.min(filters.page, totalPages)`로 4에 고정한다.
- 그러나 서버 목록의 `skip`과 `from/to` 계산은 원래 `filters.page`인 99를 사용한다.
- 즉, 서버에는 980개를 건너뛰라고 요청하면서 화면만 4페이지라고 표시한다.

권장 최소 수정:

- 총 개수를 받은 뒤 요청 페이지가 마지막 페이지보다 크면 유효한 마지막 페이지 URL로 redirect한다.
- 장기적으로 목록 API가 `rows + totalCount + page`를 한 응답으로 주면 이런 불일치와 별도 요약 조회를 줄일 수 있지만, 이번 버그 하나를 고치려고 바로 API 전면 개편을 할 필요는 없다.

검수 기준:

- 35명/10명 단위에서 `page=99` 접근 시 `/customers?view=all&page=4`로 정규화된다.
- 4페이지 실제 5명이 보인다.
- 빈 결과는 유효한 필터 결과가 정말 0일 때만 나타난다.

## 4. 우선순위별 수정 목록

### P0 — 운영 신뢰를 깨뜨리는 문제

1. 빈/역순 사용자 지정 날짜를 차단하고 화면 칩·URL·API 조건을 일치시킨다.
2. `Needs action`의 이름/설명/카운트/행 조건을 같은 정의로 맞춘다. 통합 전에는 문구를 실제 세 조건으로 좁힌다.
3. `adminGet`의 빈 fallback 대신 기존 `adminGetResult`로 실패 상태를 분리한다.
4. 범위를 벗어난 페이지를 마지막 유효 페이지로 정규화한다.

### P1 — 운영 판단과 연속 작업을 방해하는 문제

5. 예약 상태와 앱 활동 시간을 `Current situation` 안에서 명시적으로 분리한다.
6. `updatedAt`을 쓰는 날짜는 `Last booking update/activity`로 정확히 명명하거나 권위 있는 이벤트 시각으로 교체한다.
7. 미해결 문제와 취소·노쇼 누적 이력을 다른 톤/그룹으로 분리한다.
8. 상세에서 목록 검색·필터·페이지 복귀 맥락을 보존한다.
9. New/Active/검색 결과의 빈 상태 문구를 각각의 원인에 맞게 바꾼다.
10. 1024px 콘텐츠 폭에서 사이드바/필터/표 우선 열을 재배치한다.
11. `App locale`의 언어와 지역 의미를 하나로 정하고 코드 파싱을 일치시킨다.

### P2 — 효율과 완성도를 높이는 문제

12. 이름 없는 고객에 `Unnamed customer + masked phone + short ID`를 제공한다.
13. 행에 작은 상세 진입 affordance를 추가한다.
14. `generatedAt`과 수동 새로고침을 표시한다.
15. `Clear filters`가 현재 운영 뷰까지 초기화할지 정책을 정한다. 일반적으로는 뷰를 유지하고 검색/세부 필터만 지우는 편이 안전하다.
16. 상단의 세 일반 이동 버튼을 제거하거나 낮은 우선순위 메뉴로 이동한다.
17. 실제 성능 측정에서 느릴 때만 요약의 다중 count/groupBy와 목록 보조 집계를 합친다. 이번 감사에서는 콘솔 오류는 없었지만 DB 응답 시간은 계측하지 않았다.

## 5. 제거·유지·추가 판단

### 제거 또는 축소

- 헤더의 `Open bookings / Open payments / Open reviews` 상시 노출
- 이름 없는 고객의 마스킹 전화번호 중복 표시
- 열린 문제와 과거 취소 이력을 동일한 `Attention` 경고로 표시
- 유효한 값이 없는 `Custom period` 활성 칩
- 필터가 없을 때의 `Change the filters or clear the search` 문구

### 반드시 유지

- 기본 조치 큐 중심의 진입 구조
- 한 검색창에서 이름·전화·이메일·고객 ID 검색
- 전화번호 서버 마스킹
- 결제 누계와 지갑 잔액 분리
- 고급 필터 disclosure
- 서버 페이지네이션
- 의미 있는 표 머리글, 키보드 접근 가능한 스크롤 영역, `aria-current`를 사용하는 세그먼트 링크
- 베트남 날짜 경계 처리

### 반드시 추가

- 데이터 로드 실패 상태
- 유효한 사용자 지정 기간 검증
- 목록/상세 공통의 조치 기준 또는, 통합 전 정확한 제한 문구
- 상세에서 검색 결과로 돌아가는 문맥 보존
- 앱 활동과 예약 상태의 명확한 시간 라벨
- 범위를 벗어난 페이지 정규화
- 뷰별 빈 상태 문구

## 6. 권장 최종 화면 구성

위에서 아래 순서만 유지하면 된다.

1. 제목 `Customers`
2. 우측 `Updated …` + `Refresh`; 필요하면 더보기 메뉴 안에 모듈 링크
3. 운영 뷰: `Needs action / All customers / New today / Active today`
4. 검색 + 고객 세그먼트 + `More filters` + `Apply`
5. 활성 필터 칩과 정확한 결과 수
6. 고객 표
7. 페이지네이션

별도 KPI 카드, 대형 차트, 새로운 대시보드는 추가하지 않는 것이 좋다. 이 페이지의 일은 분석이 아니라 **고객을 찾고 조치하는 것**이다.

권장 표 예시:

| Customer | Current situation | Booking history | Open work | Money |
| --- | --- | --- | --- | --- |
| HANDS Audit Customer<br>`+84*******11 · …profile` | `In service`<br>`Booking updated 8 min ago · App active 2 h ago` | `1 of 6 completed`<br>`Last service 06 Aug` | `No open issue`<br>`History: 1 customer cancel` | `Paid 500,000`<br>`Wallet 0 VND` |

이 예시는 새 기능을 늘리는 것이 아니라 현재 데이터를 정확한 문장과 그룹으로 재배치한 것이다.

## 7. 코드 근거와 최소 수정 지점

- 목록 실패를 0/빈 배열로 숨기는 호출: `apps/admin_web/app/customers/page.tsx:26-27`
- 재사용 가능한 상태 포함 요청 헬퍼: `apps/admin_web/lib/admin-api.ts:5552-5581`
- Custom일 때만 날짜 입력을 서버 렌더: `apps/admin_web/app/customers/customer-filter-board.tsx:146`
- 빈 날짜를 API 파라미터에서 생략: `apps/admin_web/app/customers/customer-filters.ts:179-185`
- 빈 Custom을 활성 칩으로 표현: `apps/admin_web/app/customers/customer-filters.ts:238`
- 잘못된 페이지의 표시 페이지와 start 불일치: `apps/admin_web/app/customers/customer-list-model.ts:255-270`
- 상세 복귀 링크 고정: `apps/admin_web/app/customers/[id]/page.tsx:364`
- 목록 `Needs action` 실제 조건: `apps/api/src/admin/admin.service.ts:36560` 부근
- 앱 로케일의 국가 접미사/vi 예외 처리: `apps/api/src/admin/admin.service.ts:36730` 부근
- 마지막 예약/완료 활동을 `updatedAt`으로 집계: `apps/api/src/admin/admin.service.ts:27670` 부근
- 목록에서 예약 상태를 앱 활동보다 우선하는 로직: `apps/admin_web/app/customers/customer-management-view-model.ts:181-191`
- 현재 이슈와 과거 취소·노쇼를 함께 만드는 로직: `apps/admin_web/app/customers/customer-management-view-model.ts:194-211`
- 상세 화면의 더 넓은 조치 큐: `apps/admin_web/app/customers/[id]/page.tsx:1755-1888`

최소 수정 원칙:

- 새 상태관리 라이브러리, 날짜 선택 라이브러리, 별도 디자인 시스템을 추가하지 않는다.
- 기존 URL 필터 계약, `AdminEmptyState`, `AdminSegmentedControl`, `AdminTablePaginationFooter`, `adminGetResult`, 네이티브 date input을 재사용한다.
- 한 버그를 화면마다 임시 처리하지 말고, 필터 파싱·페이지 정규화·조치 기준처럼 모든 호출이 지나는 지점에서 고친다.

## 8. 접근성 감사

확인된 장점:

- 표 구조와 머리글이 존재한다.
- 스크롤 영역은 `tabIndex=0`, `aria-label="Scrollable data table"`을 가진다.
- 선택된 운영 뷰는 공통 세그먼트 컴포넌트에서 `aria-current="page"`를 사용한다.
- 빈 상태는 공통 컴포넌트를 사용한다.
- 전화번호는 서버에서 마스킹된다.
- `No attention needed`에는 시각적 `-` 외에 접근성 이름이 있다.

수정할 점:

- 1024px/고배율에서 핵심 열이 가려질 때 가로 스크롤 존재가 시각적으로 드러나야 한다.
- 상태 색만으로 현재 문제와 이력을 구분하지 말고 `Open`, `History` 텍스트를 함께 사용한다.
- 날짜 오류는 입력 가까이에 텍스트로 표시하고 오류 입력과 연결한다.
- 상세 복귀 링크는 `Back to search results`처럼 목적지를 설명해야 한다.
- 로딩 실패를 빈 상태와 다른 제목·아이콘·행동으로 제공한다.

이번 감사에서 하지 않은 것:

- 실제 스크린리더 낭독 순서 테스트
- 키보드만으로 모든 상세 조작 수행
- 200% 브라우저 확대 실기 테스트
- 색 대비 수치 측정
- 네트워크 강제 실패·지연 주입
- 데이터 변경을 일으키는 지갑/메시지/노트 동작

따라서 위 항목은 구현 후 별도 검수가 필요하다.

## 9. 구현 완료 판정 체크리스트

- [ ] Custom 날짜는 두 값이 유효하기 전 적용되지 않는다.
- [ ] 활성 필터 칩, URL, API 조건, 결과 수가 일치한다.
- [ ] 데이터 로드 실패는 0건과 명확히 다르게 보인다.
- [ ] `Needs action` 숫자와 상세의 열린 조치 정의가 일치하거나, 통합 전 문구가 실제 조건만 말한다.
- [ ] `Last activity`에서 예약 상태 시각과 앱 활동 시각을 혼동할 수 없다.
- [ ] 취소·노쇼 이력은 열린 이슈와 분리된다.
- [ ] `New today 0`, `Active today 0`, 필터 결과 0의 문구가 서로 다르다.
- [ ] 상세에서 돌아오면 검색·필터·뷰·페이지가 유지된다.
- [ ] `/customers?view=all&page=99`가 마지막 유효 페이지로 정규화되고 실제 행이 보인다.
- [ ] bare `ko/ja/zh/vi` 로케일 정책이 라벨과 필터 결과에 일치한다.
- [ ] 1024px에서 고객, 현재 상태, 열린 문제를 우선 확인할 수 있다.
- [ ] 1440px 정보 밀도는 현재보다 낮아지지 않는다.
- [ ] 콘솔 warning/error가 없다.
- [ ] 전화번호 마스킹과 기존 표 접근성 속성이 유지된다.

## 10. 권장 구현 순서

1. Custom 날짜 검증 + invalid page 정규화 + API 오류 상태
2. `Needs action` 문구를 실제 조건으로 즉시 정정
3. 목록/상세 조치 정의 통합
4. Current situation / Open work 의미 재구성
5. 상세 복귀 문맥 보존
6. 뷰별 빈 상태 문구
7. 1024px 콘텐츠 폭 대응
8. 로케일 정책 정리, refresh/updated 시각, 이름 없는 고객 표시

이 순서라면 가장 위험한 오판을 먼저 막고, 이후 정보 구조와 시각 완성도를 개선할 수 있다.
