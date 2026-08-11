# Customers 운영자 UX 개선용 Codex 실행 프롬프트

아래 프롬프트 전체를 `C:\dev\massage-on-demand-vn` 프로젝트를 연 Codex 작업에 그대로 붙여 넣으면 된다.

```text
목표

`C:\dev\massage-on-demand-vn`의 관리자 웹 `http://localhost:3101/customers`를 실제 고객지원·예약운영 담당자가 신뢰하고 반복 사용할 수 있는 고객 운영 화면으로 개선해라.

단순히 보기 좋게 꾸미는 작업이 아니다. 운영자가 다음 작업을 정확하고 빠르게 완료할 수 있어야 한다.

1. 지금 처리해야 할 고객이 있는지 확인한다.
2. 이름, 전화번호, 이메일, 고객 ID로 고객을 찾는다.
3. 현재 예약 상황, 최근 앱 활동, 열린 문제, 과거 이력, 결제/지갑 정보를 혼동 없이 판단한다.
4. 고객 상세에서 근거를 확인한다.
5. 기존 검색·필터·페이지 맥락을 유지한 채 목록으로 돌아와 다음 고객을 처리한다.

이 작업은 분석 보고서 작성으로 끝내지 말고 코드를 수정하고, 테스트하고, 실제 브라우저에서 검증하는 것까지 완료해라.

필수 참고 자료

작업 전에 다음 파일을 끝까지 읽어라.

- `C:\dev\massage-on-demand-vn\AGENTS.md`
- `C:\dev\massage-on-demand-vn\output\customers-audit-2026-08-06\customers-operator-audit.md`

보고서의 스크린샷도 직접 열어 확인해라.

- `C:\dev\massage-on-demand-vn\output\customers-audit-2026-08-06\01-needs-action-overview.png`
- `C:\dev\massage-on-demand-vn\output\customers-audit-2026-08-06\07-empty-custom-range-result-1280.png`
- `C:\dev\massage-on-demand-vn\output\customers-audit-2026-08-06\10-customer-search-result-1280.png`
- `C:\dev\massage-on-demand-vn\output\customers-audit-2026-08-06\11-customer-detail-entry-1280.png`
- `C:\dev\massage-on-demand-vn\output\customers-audit-2026-08-06\13-customer-directory-table-1024.png`
- `C:\dev\massage-on-demand-vn\output\customers-audit-2026-08-06\15-invalid-page-99-1440.png`

보고서는 강한 근거이지만 절대적인 진실로 가정하지 마라. 각 문제를 현재 코드와 현재 실행 화면에서 다시 재현하고, 실제 원인을 확인한 뒤 수정해라. 이미 수정되어 재현되지 않는 항목은 중복 구현하지 말고 검증 결과만 남겨라.

작업 경계

- 기존 워크트리에 사용자 변경이 많이 있다. `git status`와 관련 diff를 먼저 확인하고, 기존 변경을 되돌리거나 덮어쓰지 마라.
- `git reset --hard`, `git checkout --`, 광범위한 자동 포맷, 무관한 리팩터링을 하지 마라.
- 사용자가 요청하지 않은 commit, push, 배포를 하지 마라.
- 고객·예약·결제·지갑·메시지·노트 데이터를 변경하는 관리자 액션은 브라우저 검증 중 실행하지 마라.
- 기존 디자인 시스템과 공통 컴포넌트를 재사용해라. 새 디자인 시스템, 상태관리 라이브러리, 날짜 선택 라이브러리, 테이블 라이브러리를 추가하지 마라.
- 네이티브 `<input type="date">`, 기존 URL 필터 계약, 기존 공통 Admin 컴포넌트로 해결해라.
- 새로운 대시보드, KPI 카드, 차트, 실시간 소켓, 별도 규칙 엔진을 만들지 마라.
- 전화번호 서버 마스킹, 권한 검사, 접근성 속성, 서버 페이지네이션을 약화시키지 마라.
- 화면 문구는 프로그래머 용어가 아니라 운영자가 사실을 바로 이해할 수 있는 영어 문구로 작성해라. 이 관리자 웹의 기존 언어가 영어이므로 화면 전체를 임의로 한국어화하지 마라.
- 새 추상화보다 기존 helper와 가장 작은 공통 수정 지점을 우선해라. 같은 버그를 여러 컴포넌트에서 각각 막지 말고 모든 호출이 지나는 원인 지점에서 해결해라.

먼저 확인할 코드

다음 파일과 관련 호출자·테스트를 추적하되, 목록에 없더라도 실제 흐름에 필요한 파일은 확인해라.

- `apps/admin_web/app/customers/page.tsx`
- `apps/admin_web/app/customers/customer-filter-board.tsx`
- `apps/admin_web/app/customers/customer-filters.ts`
- `apps/admin_web/app/customers/customer-list-model.ts`
- `apps/admin_web/app/customers/customer-management-view-model.ts`
- `apps/admin_web/app/customers/customers-table-section.tsx`
- `apps/admin_web/app/customers/[id]/page.tsx`
- `apps/admin_web/components/admin-data-table.tsx`
- `apps/admin_web/components/admin-segmented-control.tsx`
- `apps/admin_web/lib/admin-api.ts`
- `apps/admin_web/app/globals.css`
- `apps/api/src/admin/admin-customer.routes.ts`
- `apps/api/src/admin/admin-customer-selects.ts`
- `apps/api/src/admin/admin.service.ts`
- 위 파일과 같은 디렉터리의 customer 관련 spec 파일

기존에 재사용할 가능성이 높은 요소

- `adminGetResult`
- `AdminEmptyState`
- `AdminSegmentedControl`
- `AdminTableScroll`
- `AdminTablePaginationFooter`
- `AdminFormControlLink`
- `DateTimeText`
- `MoneyText`
- 기존 고객 필터 URL builder/parser
- 기존 베트남 시간대 날짜 경계 helper

구현 우선순위

아래 순서대로 진행해라. 각 단계가 끝날 때 관련 테스트를 실행하고, 실패한 상태에서 다음 단계로 넘어가지 마라.

PHASE 1 — 데이터 신뢰성 P0

1. 사용자 지정 날짜 필터

현재 재현해야 할 문제:

- `More filters`에서 Period를 `Custom`으로 바꾼 최초 화면에 From/To 입력이 바로 나타나지 않는다.
- `Apply filters`를 한 번 눌러야 날짜 입력이 나타난다.
- 빈 날짜로 적용하면 URL에는 `dateRange=custom`이 남고 활성 칩에는 `Custom period`가 표시되지만 API 날짜 조건은 빠져 전체 고객이 반환된다.

필수 결과:

- `Custom` 선택 즉시 From/To 입력을 보여라.
- 운영 실수를 줄이기 위해 두 날짜를 모두 필수로 해라.
- 빈 값, 한쪽만 입력, 잘못된 날짜, `From > To` 상태에서는 적용하지 못하게 해라.
- 오류 메시지는 입력 가까이에 표시하고 접근성 있게 연결해라.
- 유효하지 않은 범위는 활성 필터 칩, URL, API 파라미터를 만들지 않아야 한다.
- 유효한 범위에서는 화면 칩, URL, API 조건, 결과 수가 동일한 범위를 나타내야 한다.
- 브라우저 UI만 막지 말고 URL 직접 입력도 안전하게 처리해라.
- 새 달력 라이브러리를 추가하지 마라.

권장 오류 문구:

- `Choose a start and end date.`
- `Start date must be on or before end date.`

2. API 실패와 정상 0건 분리

현재 `page.tsx`의 `adminGet(..., [])` 및 `adminGet(..., { totalCount: 0 })` fallback 때문에 조회 실패가 정상적인 빈 큐처럼 보일 수 있다.

필수 결과:

- 이미 존재하는 `adminGetResult`를 재사용해 목록과 요약의 성공/실패를 구분해라.
- 조회 실패 시 `No customer issues need action` 또는 `No customers found`를 보여 주지 마라.
- 별도의 오류 상태를 보여라.
- 사용자가 다시 시도할 수 있는 간단한 동작을 제공해라. 서버 페이지 구조에 맞으면 페이지 새로고침 링크로 충분하며 복잡한 클라이언트 재시도 시스템은 만들지 마라.
- 목록과 요약 중 하나만 실패하는 부분 실패도 숫자와 행이 서로 모순되지 않도록 처리해라.

권장 문구:

- 제목: `Unable to load customers`
- 설명: `Customer data could not be loaded. Refresh the page and try again.`
- 행동: `Refresh`

3. 범위를 벗어난 페이지 번호

현재 `/customers?view=all&page=99`에서 35명 중 0명을 보여 주면서 페이지네이션은 4페이지를 활성화한다.

원인을 추적해 표시용 page와 서버 skip/start 계산이 서로 다른 값을 사용하지 않게 해라.

필수 결과:

- 전체 35명, pageSize 10일 때 `page=99` 접근은 유효한 마지막 페이지 4로 정규화되어야 한다.
- URL도 가능하면 `/customers?view=all&page=4`로 정규화해 북마크/새로고침 결과가 안정적이어야 한다.
- 마지막 페이지 실제 행이 보여야 한다.
- `Showing 0 to 0 of 35`와 활성 페이지 4가 동시에 보이는 상태가 없어야 한다.
- 음수, 0, 숫자가 아닌 page 값도 기존 parser 또는 가장 작은 공통 지점에서 안전하게 처리해라.
- 이 버그 하나 때문에 목록 API 전면 개편을 하지 마라. 기존 구조에서 redirect 또는 일관된 clamp로 해결 가능한지 먼저 검토해라.

4. `Needs action`의 사실성

현재 목록 API의 `needs-action`은 다음 조건을 사용한다.

- failed payment
- requested refund
- reported customer review
- reported provider-to-customer review

반면 고객 상세의 조치 큐는 chat-room gap, recent booking block, referral review, failed notification delivery까지 포함한다. 목록 빈 상태는 wallet/booking issue도 포함하는 것처럼 말한다.

필수 결과:

- 목록의 탭 이름, 결과 수, 빈 상태, 표 설명이 실제 서버 조건과 거짓 없이 일치해야 한다.
- 먼저 현재 데이터 모델을 확인해 상세의 추가 신호를 목록 쿼리에 안정적이고 저비용으로 포함할 수 있는지 판단해라.
- 기존 관계 조회만으로 신뢰성 있게 포함할 수 있으면 목록과 상세가 같은 열린 조치 정의를 사용하도록 최소 공통화를 해라.
- audit log 해석이나 최신 delivery 판정처럼 큰 신규 집계/규칙 엔진이 필요한 신호는 추측으로 포함하지 마라.
- 모든 상세 신호를 안전하게 통합할 수 없다면 이번 작업에서는 목록 큐를 실제 조건에 맞는 더 정확한 이름과 문구로 좁혀라. `Needs action 0`이 모든 고객지원 조치가 0이라고 암시해서는 안 된다.
- `wallet issue`는 실제 판정 조건이 없으면 문구에서 제거해라.
- 무엇을 포함했고 무엇을 포함하지 못했는지는 최종 보고에 명시해라.

안전한 최소 문구 예시:

- 탭: `Payment & review`
- 표 제목: `Payment and review queue`
- 빈 제목: `No payment or review issues found`
- 빈 설명: `No failed payment, requested refund, or reported review matches this queue.`

기존 `view=needs-action` URL slug는 호환성을 위해 유지해도 된다. 화면 라벨만 정확하게 바꾸는 것이 더 작은 안전 수정이면 그렇게 해라.

PHASE 2 — 운영 판단 P1

5. 예약 상태와 앱 활동 분리

현재 `Last activity` 열은 배지에 예약 상태(`In service`, `Matching`, `Active booking`)를 표시하면서 아래 시간은 앱 세션 `lastSeenAt`을 보여 준다.

필수 결과:

- 열 제목을 `Current situation` 또는 같은 의미의 명확한 문구로 바꿔라.
- 예약 상태와 앱 활동 시각을 각각 라벨이 있는 정보로 보여라.
- `In service · 3 days ago`처럼 서비스가 3일째 진행 중인 것으로 오해할 표현을 만들지 마라.
- 예약 상태 시각에 사용할 권위 있는 필드를 코드에서 확인해라. 없다면 `Booking updated ...`라고 정확히 써라.
- 앱 활동은 `App active ...`, `No app activity`, `Never active`처럼 명시해라.
- 서버 렌더 시점의 30분 `Online` 규칙을 실시간처럼 과장하지 마라.

권장 셀 구조:

- 1행: 상태 배지 `In service`
- 2행: `Booking updated 8 min ago`
- 3행: `App active 2 h ago`

필요한 데이터를 추가 조회하기 전에 현재 directory select와 activity summary에 이미 있는 필드를 최대한 재사용해라.

6. 예약 날짜 문구의 정확성

현재 last booking과 last completed가 `updatedAt` 기반일 수 있다.

필수 결과:

- 스키마와 기존 booking time helper에서 실제 request/opened/completed/closed 시각을 확인해라.
- 권위 있는 완료 시각이 있으면 그것을 사용해라.
- 없다면 `Last completed booking`을 실제 완료 시각처럼 표현하지 말고 `Last completed booking update`처럼 정확히 이름 붙여라.
- 필터의 `Last booking date`가 `bookings.updatedAt`을 사용한다면 `Last booking activity`로 바꾸거나 실제 예약 이벤트 시각을 사용해라.
- 화면 라벨, 활성 필터 칩, API 조건, 테스트 이름이 같은 의미를 사용해야 한다.

7. 열린 문제와 과거 이력 분리

현재 `Attention`은 failed payment/refund/reported review와 customer cancel/no-show를 한 배열에 넣는다.

필수 결과:

- 지금 처리해야 하는 신호는 `Open work`로 표시해라.
- 누적 취소·노쇼는 `History`로 구분하고 중립 또는 낮은 경고 톤으로 보여라.
- 과거 취소 1회만 있는 고객이 현재 미해결 문제 고객처럼 보이지 않아야 한다.
- 색만으로 구분하지 말고 `Open`/`History` 텍스트를 포함해라.
- 데이터가 없을 때 단순 `-`보다 `No open issue`처럼 운영자가 판단할 수 있는 문구를 우선 검토해라.
- 새 액션 열은 추가하지 말고 현재 5열 안에서 해결해라.

8. 검색 결과 → 상세 → 복귀 맥락 보존

현재 고객 상세의 `Back to customers`는 고정 `/customers`라서 `view=all&q=HANDS&page=...`가 사라진다.

필수 결과:

- 목록에서 상세로 갈 때 현재 고객 목록 URL을 안전한 `returnTo` 또는 동등한 방법으로 전달해라.
- 상세의 복귀 링크는 이전 검색·뷰·세그먼트·날짜·성별·로케일·정렬·페이지를 복원해야 한다.
- 표시 문구는 `Back to search results` 또는 현재 맥락을 설명하는 문구를 사용해라.
- 외부 URL, protocol-relative URL, 다른 관리자 경로로 열리는 open redirect를 허용하지 마라.
- 허용 범위는 `/customers`와 그 쿼리 내부로 제한해라.
- returnTo가 없거나 유효하지 않으면 `/customers`로 안전하게 fallback해라.
- 이 검증 로직에는 최소 단위 테스트를 추가해라.

필수 브라우저 시나리오:

1. `/customers?view=all&q=HANDS`
2. 검색 결과 고객 상세 진입
3. 복귀 링크 클릭
4. URL과 한 건의 검색 결과가 그대로 복원되는지 확인

9. 뷰별 빈 상태

필수 문구를 다음처럼 분리해라.

- New today 0
  - 제목: `No customers joined today`
  - 설명: `No customer profile was created today in Vietnam time.`
- Active today 0
  - 제목: `No app activity today`
  - 설명: `No customer app session was seen today in Vietnam time.`
- 실제 검색/필터 결과 0
  - 제목: `No customers match these filters`
  - 설명: `Change or clear the active filters to view customer records.`
- 전체 고객 0
  - 제목: `No customer profiles found`
  - 검색/필터를 지우라는 거짓 안내를 하지 마라.
- API 실패
  - PHASE 1의 오류 상태 사용

활성 검색/필터 유무와 `view`를 기준으로 공통 empty-state 컴포넌트에 올바른 내용을 전달해라.

10. `App locale` 의미 정리

현재 로직은 locale의 국가 접미사를 기준으로 하면서 bare `vi`만 VN으로 예외 처리한다. bare `ko`, `ja`, `zh`는 일관되게 처리되지 않는다.

필수 결과:

- 기존 데이터의 `deviceLanguage` 실제 값과 이 필터의 운영 목적을 확인해라.
- 고객 응대 언어를 찾는 목적이라면 필터 이름을 `App language`로 바꾸고 base language(`vi`, `ko`, `ja`, `zh`, `en`)를 일관되게 해석해라.
- 지역이 목적인 경우 `Session region`으로 바꾸고 bare 언어에서 국가를 추측하지 마라.
- `zh`를 무조건 CN으로 간주하지 마라.
- 목록 표시의 국기/국가 라벨과 필터 기준이 충돌하면 언어 라벨을 우선하고, 불확실한 지역은 `Unknown region`으로 표현해라.
- 기존 필터 URL의 `country`가 다른 화면/링크에서 사용되는지 모든 caller를 검색하고 호환성을 유지하거나 안전한 migration을 제공해라.
- bare locale과 region locale에 대한 테스트를 추가해라.

PHASE 3 — 화면 효율과 반응형 P1/P2

11. 이름 없는 고객 식별

- 마스킹 전화번호를 굵은 이름과 보조 문구에 두 번 표시하지 마라.
- 이름이 없으면 기본 이름을 `Unnamed customer`로 표시해라.
- 보조 문구에는 `masked phone · short customer ID`를 표시해 서로 다른 무명 고객을 구분할 수 있게 해라.
- 전체 ID를 과도하게 노출할 필요는 없지만 상세 링크와 row key는 안정적인 전체 customer ID를 계속 사용해라.
- 전화번호 마스킹은 서버에서 유지해라.

12. 상세 진입 affordance

- 이름 링크는 유지해라.
- 이름 근처에 기존 아이콘 라이브러리의 작은 chevron 또는 명확한 `Open` 표현을 추가해 상세 진입 가능성을 알 수 있게 해라.
- 별도 Actions 열을 추가하거나 행 전체를 중복 링크로 만들지 마라.

13. 1024px 콘텐츠 폭 대응

현재 1024px에서 표 컨테이너는 약 636px이고 표는 780px라 `Customer value`가 가려진다.

필수 결과:

- 1024×768에서 고객, 현재 상황, 열린 문제를 우선 파악할 수 있어야 한다.
- 1280×800과 1440×900에서 현재 정보 밀도를 유지해라.
- 먼저 기존 사이드바의 축소 기능을 재사용할 수 있는지 확인해라.
- 필터와 운영 뷰의 wrapping은 viewport만 보는 breakpoint보다 실제 콘텐츠 폭에 반응하는 `auto-fit/minmax()` 또는 container query 같은 네이티브 CSS를 우선해라.
- 표를 유지할 경우 첫 Customer 열 sticky, 우측 overflow 단서, 핵심 열 우선순위를 검토해라.
- 접근성 있는 table DOM을 카드 DOM으로 복제하지 마라.
- 가로 스크롤이 남는다면 키보드 접근성과 시각적 발견 가능성을 모두 유지해라.
- 전체 문서에 가로 스크롤을 만들지 마라.

14. 낮은 우선순위 정리

다음은 P0/P1 완료 후 작은 수정으로 해결될 때만 포함해라.

- `generatedAt`을 사용한 `Updated ...` 표시와 단순 Refresh 링크
- 현재 뷰를 유지하면서 검색/세부 필터만 지우는 `Clear filters`
- 헤더의 `Open bookings / Open payments / Open reviews`를 제거하거나 더 낮은 우선순위로 이동
- 화면에 이미 지원되는 정렬이 있다면 작은 Sort 선택 노출

다음은 이번 작업에서 만들지 마라.

- 자동 새로고침/실시간 소켓
- 고객 export 신규 기능
- 새 KPI/차트
- 대규모 목록 API envelope 개편
- 별도 모바일 고객관리 화면
- 25/50 페이지 크기 UI를 사용 근거 없이 추가

디자인 및 문구 기준

- 기존 Vuexy/HANDS Admin 시각 언어를 유지해라.
- 새로운 색상 체계나 큰 카드 레이아웃을 도입하지 마라.
- 가장 중요한 것은 `무엇이 현재 문제인가`, `그 시각은 무엇의 시각인가`, `다음 행동은 무엇인가`가 보이는 것이다.
- 경고색은 실제 열린 문제에 우선 사용해라.
- 과거 이력은 중립 톤과 명시적 `History` 문구를 사용해라.
- 탭과 빈 상태의 숫자는 실제 API 범위와 같아야 한다.
- 내부 enum, Prisma 필드, API 용어를 운영자 문구에 그대로 노출하지 마라.
- 모든 날짜 기준에 필요하면 `Vietnam time`을 명시해라.
- 영문 대소문자와 Partner 표기는 기존 제품 문구 규칙을 유지해라.

접근성 기준

- 기존 semantic table과 headers를 유지해라.
- `AdminTableScroll`의 focusability와 접근성 이름을 유지해라.
- 선택된 운영 뷰의 `aria-current`를 유지해라.
- 폼 오류는 텍스트로 표시하고 입력과 연결해라.
- 색만으로 Open/History/오류를 구분하지 마라.
- 상세 복귀 링크는 목적지를 설명해야 한다.
- 200% 확대에서 필터 라벨과 버튼이 겹치지 않아야 한다.
- 클릭/링크 affordance에 접근 가능한 이름이 있어야 한다.

테스트 요구사항

작업 시작 전에 package manager와 관련 scripts를 확인해라. repo 지침에 있는 명령을 우선 사용해라.

최소한 다음 회귀 테스트를 추가하거나 갱신해라.

1. Custom 날짜 입력은 유효한 From/To가 있을 때만 API 파라미터와 활성 칩을 만든다.
2. From > To와 부분 입력은 거부된다.
3. API 실패는 정상 0건 empty state로 렌더링되지 않는다.
4. `page=99`는 마지막 유효 페이지로 정규화되고 실제 행을 표시한다.
5. `Needs action` 라벨과 설명은 실제 서버 조건을 정확히 반영한다.
6. 예약 상태와 앱 activity 문구가 명확히 분리된다.
7. 열린 문제와 History가 구분된다.
8. 상세 returnTo는 `/customers` 내부 URL만 허용한다.
9. 검색/필터/page가 상세 복귀 후 보존된다.
10. New today, Active today, filter result, API error의 empty state 문구가 각각 다르다.
11. locale/language 정책에 따라 bare/region tag가 일관되게 처리된다.
12. 전화번호 원문이 목록 markup에 노출되지 않는다.
13. 기존 `aria-current`, table headers, scroll region 접근성 속성이 유지된다.

관련 unit/component/API 테스트를 먼저 실행한 뒤, 영향 범위에 맞는 typecheck와 lint를 실행해라. 전체 테스트가 지나치게 크거나 기존 실패가 있으면 관련 테스트를 모두 통과시키고, 실행하지 못한 명령과 기존 실패를 최종 보고에 정확히 적어라.

브라우저 검증

로그인된 관리자 세션이 있는 브라우저를 사용해 실제 화면을 검증해라. 가능한 경우 in-app browser를 사용하고, 임의로 다른 브라우저나 새 로그인 세션을 만들지 마라.

수정 전후 다음 경로와 상태를 확인해라.

- `/customers`
- `/customers?view=all`
- Custom 날짜 선택 전/후
- New today 0건
- Active today 0건
- `/customers?view=all&q=HANDS`
- 위 검색 결과에서 상세 진입 후 복귀
- `/customers?view=all&page=99`
- 1024×768
- 1280×800
- 1440×900

검증 중 고객 데이터에 쓰기 작업을 하지 마라.

수정 후 스크린샷을 다음 새 폴더에 저장해라. 기존 감사 스크린샷을 덮어쓰지 마라.

`C:\dev\massage-on-demand-vn\output\customers-implementation-verification-2026-08-06`

최소 스크린샷:

- 기본 운영 큐 또는 정확히 이름이 바뀐 큐
- 유효한 Custom 날짜 입력과 적용 결과
- 날짜 검증 오류
- All customers 표
- 검색 결과
- 상세의 복귀 링크와 복귀 후 검색 결과
- page=99 정규화 결과
- 1024px 표
- 1440px 표
- API 실패 상태를 테스트 환경에서 재현할 수 있으면 오류 상태

브라우저 콘솔의 error/warning도 확인해라.

완료 조건

다음 조건을 모두 만족해야 완료로 간주한다.

- 빈 Custom 기간이 전체 목록을 필터된 결과처럼 보여 주지 않는다.
- 날짜 UI, URL, API 조건, 활성 칩이 일치한다.
- API 장애와 정상 0건이 구분된다.
- 큐 이름과 설명이 실제 포함 조건보다 넓은 약속을 하지 않는다.
- `/customers?view=all&page=99`가 유효 페이지와 실제 행으로 정규화된다.
- 예약 상태 시각과 앱 활동 시각을 혼동하지 않는다.
- 열린 문제와 누적 취소/노쇼 이력이 구분된다.
- 상세에서 돌아오면 검색·필터·뷰·페이지가 유지된다.
- 각 운영 뷰의 0건 문구가 원인을 정확히 설명한다.
- locale/language 필터의 이름과 판정 기준이 일치한다.
- 1024px에서 핵심 정보가 우선 보이고 1440px 정보 밀도가 유지된다.
- 전화번호 마스킹과 기존 접근성 기본이 유지된다.
- 관련 테스트, typecheck, lint가 통과하거나 실행 불가/기존 실패가 명확히 보고된다.
- 수정 후 실제 스크린샷을 직접 열어 레이아웃을 확인한다.

작업 방식

1. 먼저 현재 코드, 관련 테스트, git diff, 실행 화면을 조사하고 재현 결과를 짧게 정리해라.
2. 기존 변경과 충돌하지 않는 최소 수정 계획을 세워라.
3. PHASE 1부터 순서대로 구현해라.
4. 각 원인 수정과 함께 가장 작은 회귀 테스트를 남겨라.
5. 관련 테스트를 통과시킨 후 다음 phase로 이동해라.
6. 브라우저에서 운영 시나리오를 검증하고 스크린샷을 저장해라.
7. 최종 diff를 다시 검토해 무관한 변경, 중복 코드, 과도한 추상화, 접근성 회귀를 제거해라.

진행 중 애매한 부분이 있어도 안전한 최소 방향으로 계속 진행해라. 단, 다음 경우에는 추측해서 구현하지 말고 최종 보고에 남겨라.

- 실제 데이터 모델에 없는 조치 신호
- 정책 결정 없이는 언어와 지역 중 하나를 고를 수 없는 데이터
- 권위 있는 완료/상태 시각 필드가 없는 경우
- 기존 사용자 변경과 직접 충돌해 보존할 방법이 없는 경우

최종 응답 형식

1. 운영자 입장에서 무엇이 달라졌는지
2. 수정한 핵심 원인과 파일
3. 통과한 테스트/typecheck/lint
4. 브라우저에서 검증한 URL·화면 크기·스크린샷 폴더
5. 기존 변경 때문에 건드리지 않은 부분 또는 남은 데이터/정책 제한

단순히 “개선했습니다”라고 말하지 말고 완료 조건별 결과를 근거와 함께 보고해라. 제품 소스 파일, 테스트 파일, 새 스크린샷 외의 무관한 파일은 변경하지 마라.
```

## 사용 팁

- 한 번에 전체 구현을 맡기려면 위 프롬프트 전체를 그대로 사용한다.
- Codex가 작업 중일 때 방향을 추가하고 싶다면 기존 작업을 중단시키는 새 요청보다 현재 작업에 짧게 보충한다.
- 완료 후에는 감사 보고서의 `구현 완료 판정 체크리스트`와 Codex가 만든 검증 스크린샷을 함께 비교한다.
