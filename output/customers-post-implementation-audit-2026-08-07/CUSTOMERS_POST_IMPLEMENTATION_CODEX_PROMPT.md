# Customers 운영 화면 후속 개선 Codex 구현 프롬프트

아래 내용을 새 Codex 작업에 그대로 붙여 넣어 사용한다.

---

`C:\dev\massage-on-demand-vn`의 관리자 웹 Customers 화면을 실제 고객지원 운영자가 신뢰하고 반복 사용할 수 있도록 후속 개선해라.

이번 작업은 새 디자인을 만드는 작업이 아니다. 이미 구현된 Customers 화면에서 감사 후 남은 **권한 인지, 데이터 의미, 빈 상태, 결과 가시성, 행 정보 밀도** 문제를 기존 HANDS Admin 디자인 시스템과 코드 구조 안에서 최소 수정으로 해결하는 작업이다.

계획만 작성하고 멈추지 말고, 조사 → 구현 → 테스트 → 실제 브라우저 검증 → 최종 보고까지 완료해라.

## 1. 작업 위치와 필수 기준 문서

작업 루트:

```text
C:\dev\massage-on-demand-vn
```

가장 먼저 다음 파일을 읽어라.

```text
C:\dev\massage-on-demand-vn\AGENTS.md
C:\dev\massage-on-demand-vn\output\customers-post-implementation-audit-2026-08-07\customers-post-implementation-deep-audit.md
```

화면 증거:

```text
C:\dev\massage-on-demand-vn\output\customers-post-implementation-audit-2026-08-07\01-payment-review-empty-1440.jpg
C:\dev\massage-on-demand-vn\output\customers-post-implementation-audit-2026-08-07\02-all-customers-top-1440.jpg
C:\dev\massage-on-demand-vn\output\customers-post-implementation-audit-2026-08-07\03-customer-table-rows-1440.jpg
C:\dev\massage-on-demand-vn\output\customers-post-implementation-audit-2026-08-07\05-more-filters-expanded-1440.jpg
C:\dev\massage-on-demand-vn\output\customers-post-implementation-audit-2026-08-07\06-custom-date-fields-1440.jpg
C:\dev\massage-on-demand-vn\output\customers-post-implementation-audit-2026-08-07\07-search-audit-results-1440.jpg
C:\dev\massage-on-demand-vn\output\customers-post-implementation-audit-2026-08-07\08-search-no-results-1440.jpg
C:\dev\massage-on-demand-vn\output\customers-post-implementation-audit-2026-08-07\10-all-customers-dark-1440.jpg
C:\dev\massage-on-demand-vn\output\customers-post-implementation-audit-2026-08-07\11-invalid-page-normalized-1440.jpg
C:\dev\massage-on-demand-vn\output\customers-post-implementation-audit-2026-08-07\14-detail-access-restricted-1440.jpg
C:\dev\massage-on-demand-vn\output\customers-post-implementation-audit-2026-08-07\15-filtered-payment-review-empty-1440.jpg
```

보고서의 우선순위와 수용 기준을 기준으로 삼되, line number를 맹목적으로 믿지 말고 현재 소스와 `git diff`를 다시 확인해라. 보고서 작성 후 코드가 바뀌었다면 현재 코드가 사실의 기준이다.

## 2. 작업 전 필수 조사

수정 전에 다음을 수행해 짧게 현황을 정리해라.

1. `git status --short`와 Customers 관련 `git diff`를 확인한다.
2. 기존 사용자 변경이 많은 dirty worktree임을 전제로 무관한 변경을 보존한다.
3. Customers 페이지, 필터, 표, 권한 게이트, Admin API 목록/요약, 관련 테스트를 끝까지 읽는다.
4. 같은 저장소에서 operator access를 UI affordance에 반영하는 기존 패턴을 검색한다.
5. permission category의 사용자용 label을 제공하는 기존 helper/registry를 찾는다.
6. booking 상태 age/SLA를 계산하는 기존 helper나 정책이 있는지 검색한다.
7. 현재 앱 세션 구조에서 “최신 세션”을 서버 페이지네이션과 summary count에 일관되게 적용할 수 있는지 확인한다.
8. 현재 로그인 세션이 유지된 in-app browser로 `/customers` 기준 화면을 다시 확인한다.

가능하면 `impeccable` 스킬과 in-app browser를 사용하되, 제품 디자인을 새로 발명하지 말고 기존 화면을 기준으로 감사·수정·검증해라.

## 3. 화면 검수 범위

검수 및 스크린샷 범위는 다음뿐이다.

```text
1440×900
1600×900
```

Light와 Dark를 모두 확인한다. 이 작업에서 다른 화면 크기의 반응형 개선, 테스트, 보고를 추가하지 마라.

## 4. 반드시 보존할 현재 개선사항

다음은 이미 잘 수정된 기능이다. 후속 작업 중 회귀시키지 마라.

- 기본 운영 뷰 `Payment & review`
- 실제 서버 조건과 일치하는 queue 설명
- Custom 선택 즉시 From/To 표시
- 빈 날짜, 부분 날짜, 역순 날짜 적용 차단
- 네이티브 `<input type="date">`
- API 실패와 정상 0건 분리
- 범위 밖 page의 마지막 유효 페이지 redirect
- Vietnam 영업일 기준 날짜 preset
- 예약 상태 시각과 앱 활동 시각의 명시적 분리
- Open work와 History 분리
- base app language 코드 `vi/ko/ja/zh/en` 처리
- `Unnamed customer + masked phone + short ID`
- 서버 전화번호 masking
- 검색/필터/page가 포함된 안전한 `returnTo`
- `returnTo`의 `/customers` 내부 경로 제한
- `Updated`와 수동 `Refresh`
- 서버 페이지네이션과 bounded query
- semantic table, table headers, `aria-current`, native disclosure
- Light/Dark 디자인 토큰

## 5. PHASE 1 — 운영 차단 및 데이터 신뢰성 P1

### 5.1 Customer detail 권한을 목록 affordance에 반영

현재 실제 브라우저에서는 Customers 목록을 볼 수 있지만 고객 이름/chevron을 누르면 `CUSTOMERS_DETAIL` 접근 거부 화면으로 끝난다. 권한을 완화하지 말고 **목록이 현재 운영자의 detail 권한을 알도록** 수정해라.

필수 결과:

- 현재 운영자에게 `CUSTOMERS_DETAIL` 또는 이를 포함하는 상위 권한이 있을 때만 고객 이름과 chevron이 상세 링크가 된다.
- detail 권한이 없으면 `AdminPersonCell`의 기존 non-link 경로 또는 같은 저장소의 기존 패턴을 재사용한다.
- 권한이 없을 때 chevron을 숨긴다.
- 보조 문구 또는 중립 lock 상태로 `Customer detail access required`를 표시한다.
- 클릭할 수 없는 텍스트를 링크처럼 보이게 만들지 않는다.
- 권한을 자동 부여하거나 directory 권한으로 detail API를 우회하지 않는다.
- 전화번호/이메일/고객 ID의 기존 masking과 노출 범위를 넓히지 않는다.

접근 거부 공통 화면도 Customers 흐름에서 운영자 친화적으로 바꿔라.

- raw enum `CUSTOMERS_DETAIL`을 사용자 문구에 노출하지 않는다.
- `customers_detail category access` 같은 내부 구현 문구를 노출하지 않는다.
- 기존 permission registry의 label `Customer detail`을 재사용한다. 새 label map을 중복 생성하지 마라.
- Customers 상세 거부 시 primary action은 `Back to customers`여야 한다.
- URL에 검증된 same-origin Customers `returnTo`가 있으면 그것을 우선 사용하고, 없으면 `/customers`로 돌아간다.
- 다른 category의 접근 거부 동작을 불필요하게 전면 재설계하지 마라. 공통 helper에서 작은 안전한 개선이 가능하면 그 지점에서 한 번만 고친다.

권장 문구:

```text
Customer detail access required
You can search the customer directory, but this account cannot open customer profiles. Ask a Master Admin for Customer detail access.
Back to customers
```

필수 테스트:

- directory만 있는 운영자는 list를 보고 detail link는 보지 않는다.
- detail 권한이 있는 운영자는 기존 detail link와 chevron을 본다.
- parent/legacy permission 호환성이 유지된다.
- 접근 거부 화면은 사용자용 permission label을 사용한다.
- 악의적인 외부 `returnTo`, protocol-relative URL, 다른 admin path는 거부한다.

### 5.2 필터 결과 0과 운영 뷰 자체 0을 분리

현재 `CustomerTableEmptyState`는 활성 필터보다 view를 먼저 판정한다. 이 때문에 검색 chip이 있는데도 전체 Payment & review queue가 비어 있는 것처럼 말한다.

새 상태 시스템을 만들지 말고 기존 함수의 판정 순서와 문구를 최소 수정해라.

판정 순서:

1. API 오류
2. 검색 또는 세부 필터가 활성화된 결과 0건
3. 필터가 없는 현재 운영 뷰 자체 0건
4. 필터가 없고 전체 customer profile 자체가 0건

필수 문구:

```text
Payment & review + filter 0
Title: No payment or review issues match these filters
Message: Change or clear the active filters to view this queue.

New today + filter 0
Title: No new customers match these filters
Message: Change or clear the active filters.

Active today + filter 0
Title: No app-active customers match these filters
Message: Change or clear the active filters.

All customers + filter 0
Title: No customers match these filters
Message: Change or clear the active filters to view customer records.

All customers + no filters + database total 0
Title: No customer profiles found
Message: No customer accounts have been created yet.
```

기존 filter footer의 `Clear filters`는 현재 view와 지원되는 sort/pageSize 정책을 유지해야 한다.

### 5.3 현재 예약 status와 updatedAt의 권위 범위 수정

현재 customer directory select는 최근 예약을 `createdAt desc`, 최대 10개만 가져온다. 반면 전체 active booking count는 별도 aggregate다. UI의 `openMatchingBookings`, `serviceLiveBookings`, `currentBookingUpdatedAt`은 최근 10개 배열에서 계산하므로 전체 summary와 모순될 수 있다.

원인을 공통 지점에서 수정해라.

필수 결과:

- 활성 예약이 최근 10개 history 표본 밖에 있어도 정확한 current status와 updatedAt이 표시된다.
- `Active booking`과 `No current booking update`가 데이터 부족 때문에 동시에 나타나지 않는다.
- 전체 예약을 브라우저로 내려 보내거나 client에서 다시 필터링하지 않는다.
- 기존 bounded directory select와 서버 페이지네이션을 유지한다.
- 현재 status/updatedAt을 API activity summary에서 제공하거나, 현재 활성 예약 한 개를 별도 bounded relation으로 select하는 최소안을 사용한다.
- 동일 정보를 여러 query에서 중복 계산하지 말고 기존 `getCustomerListActivitySummaries` 또는 가장 가까운 공통 집계 지점을 우선 검토한다.
- status raw enum을 운영자 문구에 그대로 노출하지 않는다.

stale 상태:

- 화면에서 오래된 `In service` 상태가 관측됐다.
- 기존 booking SLA/age policy helper가 있으면 그것을 재사용해 stale 상태를 표시한다.
- 권위 있는 기준이 없다면 임의로 24시간 같은 threshold를 만들지 않는다.
- 기준이 없을 때도 `Booking updated …`의 age는 숨기지 않는다.
- stale 표시가 필요해도 예약을 자동 종료하거나 상태를 변경하지 않는다.

### 5.4 App language와 activity period의 기준 일치

현재 API는 `appSessions.some(...)`으로 필터하지만 행은 `lastSeenAt desc` 최신 세션 한 개를 표시한다. 따라서 과거 세션이 match하고 최신 세션은 다른 언어/기간인 고객이 결과에 포함될 수 있다.

목표 결과:

- filter predicate, summary count, list result, row presentation이 같은 세션 정의를 사용한다.
- 운영 목적은 최신 고객 상태 파악이므로 가능하면 최신 app session을 기준으로 한다.
- 검색/필터 때문에 전체 customer row를 메모리로 로드하지 않는다.
- pagination 후 client filter를 적용하지 않는다.
- list와 summary count가 서로 다른 방식으로 계산되지 않는다.

구현 판단:

- 현재 schema/query helper로 최신 세션 조건을 정확하고 bounded하게 표현할 수 있으면 그 최소 구현을 사용한다.
- 이를 위해 schema migration, 대규모 raw SQL directory rewrite, 새 범용 query framework가 필요하다면 이번 작업에서 과도하게 만들지 마라.
- 정확한 latest-session 구현이 안전하지 않다면 현재 predicate에 맞게 UI를 정직하게 바꾸는 임시안을 사용한다.

안전한 임시 문구:

```text
Last active date -> Session activity period
App language -> Recorded app language
```

임시안을 선택했다면 왜 latest-session 구현을 보류했는지 최종 보고에 정확히 적어라. 추측으로 완료 처리하지 마라.

### 5.5 결과 수와 정렬을 보이게 만들기

현재 `CustomersTableSection`은 title, result count, sort description을 만들지만 customer table panel header는 CSS로 숨긴다. sort도 hidden input으로만 존재한다.

필수 결과:

- 표 위에 compact 한 줄로 현재 결과 수와 sort를 표시한다.
- 예: `35 customers · Newest first`
- 검색 중이면 `2 customers · Newest first`처럼 현재 필터 결과 단위를 표시한다.
- tab count가 고객 수임을 접근 가능한 이름으로 명확히 한다.
- 큰 KPI/card header를 새로 만들지 않는다.
- 현재 지원 sort 중 운영 가치가 있는 옵션만 기존 `AdminFormSelect`로 노출한다.

권장 sort 옵션:

```text
Newest first
Customer name
Most bookings
```

`Fewest bookings`는 현재 운영 근거가 없으면 URL 호환성만 유지하고 UI에서 노출하지 않아도 된다. 새로운 정렬 API를 만들지 마라.

sort 변경 시:

- 현재 view, q, segment, language, gender, date filter를 유지한다.
- page는 1로 초기화한다.
- 현재 URL 기반 서버 렌더 구조를 유지한다.

### 5.6 결제·지갑 문구를 실제 계산 의미와 일치

현재 `Total paid`는 CAPTURED payment amount 합계다. completed refund를 차감한 순액이라고 보장되지 않는다.

이번 작업의 안전한 최소 수정:

```text
Column: Customer value -> Payments & wallet
Total paid -> Captured payments
Wallet -> Wallet balance
```

필수 조건:

- captured payment와 wallet balance를 합산하지 않는다.
- wallet을 고객 가치나 매출로 표현하지 않는다.
- net paid를 새로 표시하려면 refund status와 partial refund 정책을 코드에서 확인하고 정확한 테스트를 추가해야 한다.
- 정책을 확인하지 못하면 계산식을 바꾸지 말고 문구만 실제 집계에 맞춘다.

### 5.7 브라우저 document title

현재 `document.title`이 빈 문자열이다.

필수 결과:

```text
Customers | HANDS Admin
Access restricted | HANDS Admin
```

- Customers 한 페이지에 client side title script를 넣지 않는다.
- 기존 Next metadata/layout 구조의 가장 작은 공통 지점에서 해결한다.
- 다른 페이지 title을 무관하게 대량 변경하지 않는다.
- customer detail의 동적 이름 title은 기존 데이터 흐름에서 간단히 가능한 경우만 포함한다.

## 6. PHASE 2 — 행 스캔 속도와 시각 밀도 P2

P1이 통과한 뒤 아래를 구현해라.

### 6.1 반복되는 부정 문구와 0값 축약

예약과 앱 활동이 전혀 없는 행이 현재 다음 문구를 반복한다.

```text
No open booking
No current booking update
No app activity
0/0 completed
No completed booking
No open work
0 VND
0 VND
```

의미를 잃지 않는 범위에서 한 셀당 한 번만 말하도록 정리해라.

권장:

```text
Current situation: No booking · No app activity
Booking history: No bookings yet
Open work: None
Payments & wallet: Captured 0 VND / Wallet 0 VND
```

예약 이력이 있으면:

```text
1 completed · 6 total
Last completion updated …
```

`0/0 completed`는 사용하지 마라.

### 6.2 고객 이름 가독성

- 1440px에서 일반적인 고객 이름을 식별할 수 있어야 한다.
- Customer name을 최대 2줄 허용하거나 열 비율을 소폭 조정한다.
- phone과 short ID는 현재 한 줄 구조를 유지한다.
- hover tooltip만으로 해결하지 않는다.
- table 전체 폭과 다른 핵심 열을 불필요하게 넓히지 않는다.

### 6.3 badge와 History 문구

다음처럼 단위를 명확히 한다.

```text
Refund 1 -> Refund requests 1
Reported 1 -> Reported reviews 1
Customer cancels 1 -> Customer cancellations 1
```

- 열린 문제만 danger/warning tone을 사용한다.
- 누적 취소/no-show History는 neutral tone을 유지한다.
- 색만으로 open/history를 구분하지 않는다.

### 6.4 filter footer와 기본 빈 큐 행동

- 활성 filter chip과 `Clear filters`가 생겼을 때 filter card에 큰 빈 여백이 생기지 않게 한다.
- 기존 form/grid 안의 compact 한 줄을 우선 사용한다.
- 별도 wrapper/card를 추가하지 않는다.
- Payment & review가 필터 없이 0건이면 `Browse all {count} customers` 한 개의 보조 행동을 제공한다.
- 이미 위에 있는 All customers tab을 제거하지 않는다.

### 6.5 `Active today`의 의미

실제 조건은 현재 접속 presence가 아니라 오늘 app session이 관측된 고객이다.

권장 라벨:

```text
App seen today
```

기존 URL `view=active-today`는 호환성을 위해 유지한다.

## 7. 주요 관련 파일

아래 파일을 시작점으로 보되, 수정 전 모든 caller와 테스트를 검색해라.

```text
apps/admin_web/app/customers/page.tsx
apps/admin_web/app/customers/customer-filter-board.tsx
apps/admin_web/app/customers/customer-filters.ts
apps/admin_web/app/customers/customer-list-model.ts
apps/admin_web/app/customers/customer-management-view-model.ts
apps/admin_web/app/customers/customers-table-section.tsx
apps/admin_web/app/customers/[id]/page.tsx
apps/admin_web/app/globals.css
apps/admin_web/components/admin-person-cell.tsx
apps/admin_web/components/admin-operator-access-gate.tsx
apps/admin_web/components/admin-page-template.tsx
apps/admin_web/lib/admin-operator-access-model.ts
apps/admin_web/lib/admin-operator-permissions.ts
apps/admin_web/lib/admin-api.ts
apps/api/src/admin/admin-customer.routes.ts
apps/api/src/admin/admin-customer-selects.ts
apps/api/src/admin/admin.service.ts
```

관련 테스트:

```text
apps/admin_web/app/customers/customer-filter-board.spec.tsx
apps/admin_web/app/customers/customer-filters.spec.ts
apps/admin_web/app/customers/customer-list-model.spec.ts
apps/admin_web/app/customers/customer-management-view-model.spec.ts
apps/admin_web/app/customers/customers-table-section.spec.tsx
apps/admin_web/app/customers/page.spec.tsx
apps/admin_web/app/customers/[id]/page.spec.tsx
apps/admin_web/components/admin-operator-access-gate.spec.tsx
apps/admin_web/lib/admin-operator-access-model.spec.ts
apps/api/src/admin/admin-customer-selects.spec.ts
apps/api/src/admin/admin.controller.spec.ts
apps/api/src/admin/admin.service.spec.ts
apps/api/src/admin/admin-operator-category.guard.spec.ts
```

## 8. 디자인·구현 제약

- 기존 HANDS Admin/Vuexy 시각 언어와 token을 유지한다.
- 새 UI library나 production dependency를 추가하지 않는다.
- lucide-react에 이미 있는 icon만 사용한다.
- 새 KPI, 차트, hero, dashboard card를 만들지 않는다.
- 자동 새로고침, realtime socket, infinite scroll을 추가하지 않는다.
- 새 mobile/customer-card 화면을 만들지 않는다.
- page-size selector를 추가하지 않는다.
- 기존 route와 query parameter를 깨지 않는다.
- `view=needs-action`, `view=active-today`, legacy country aliases는 호환성을 유지한다.
- Admin API response를 불필요하게 전면 envelope 구조로 바꾸지 않는다.
- 모든 customer를 로드한 뒤 client filtering하지 않는다.
- PII masking을 약화하지 않는다.
- 권한 검사를 UI에만 두지 않는다. 기존 서버 guard를 유지한다.
- 기존 사용자 변경을 되돌리거나 포맷팅으로 대량 변경하지 않는다.
- protected area를 건드릴 필요가 없으면 건드리지 않는다.
- 별도 abstraction, registry, generic framework를 만들기 전에 기존 helper를 검색하고 재사용한다.
- 현재 문제를 한두 조건과 기존 컴포넌트로 해결할 수 있으면 그 최소안을 선택한다.

## 9. 접근성 기준

- semantic table과 headers를 유지한다.
- 선택된 operational view의 `aria-current`를 유지한다.
- native `<details>`와 keyboard 동작을 유지한다.
- Custom date 오류의 `role=alert`, `aria-invalid`, `aria-describedby`를 유지한다.
- 권한이 없는 항목은 focus 가능한 가짜 link가 되면 안 된다.
- permission 상태를 lock 색상만으로 전달하지 않는다.
- sort select에는 영구 label 또는 접근 가능한 이름이 있어야 한다.
- 결과 수는 시각적으로 보이고 screen reader에서도 읽을 수 있어야 한다.
- 이름을 2줄로 만들더라도 row link의 full accessible name을 유지한다.
- Light/Dark focus-visible 상태를 확인한다.

## 10. 테스트 요구사항

기존 테스트 convention을 재사용하고 수정한 root cause마다 가장 작은 회귀 테스트를 남겨라.

최소 Admin Web 테스트:

1. detail 권한 유/무에 따라 row link와 chevron이 달라진다.
2. directory-only operator에게 사용자용 lock 설명이 보인다.
3. safe Customers `returnTo`와 악의적인 `returnTo`가 구분된다.
4. 각 operational view의 필터 결과 0과 자체 0이 다른 문구를 사용한다.
5. 전체 customer 자체가 0일 때 filter를 지우라고 안내하지 않는다.
6. compact result count와 sort control이 렌더링된다.
7. sort 변경 URL이 필터를 유지하고 page를 초기화한다.
8. 예약 0건은 `No bookings yet`이며 `0/0 completed`가 없다.
9. payment/wallet 문구가 실제 집계 의미와 맞는다.
10. existing custom date, pagination, returnTo, phone masking 테스트가 계속 통과한다.

최소 API 테스트:

1. 최근 10개 history 표본 밖의 active booking도 current status/updatedAt summary에 반영된다.
2. Payment & review view count와 list predicate가 계속 일치한다.
3. latest-session 구현을 선택했다면 언어와 activity period가 동일한 최신 세션을 기준으로 한다.
4. summary count와 list result가 같은 predicate를 사용한다.
5. take/skip bound와 production-data filter를 유지한다.
6. operator category guard를 약화하지 않는다.

먼저 다음 focused test를 실행해라.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/customers/customer-filter-board.spec.tsx app/customers/customer-filters.spec.ts app/customers/customer-list-model.spec.ts app/customers/customer-management-view-model.spec.ts app/customers/customers-table-section.spec.tsx app/customers/page.spec.tsx app/customers/[id]/page.spec.tsx components/admin-operator-access-gate.spec.tsx lib/admin-operator-access-model.spec.ts
```

API는 관련 test name을 확인한 후 customer directory, activity summary, operator category에 해당하는 focused test를 실행해라. 전체 `admin.service.spec.ts`를 무조건 모두 실행하기보다 관련 test를 먼저 통과시켜라.

관련 lint:

```powershell
npm.cmd exec --workspace @massage-vn/admin-web -- eslint app/customers components/admin-operator-access-gate.tsx lib/admin-operator-access-model.ts
npm.cmd exec --workspace @massage-vn/api -- eslint src/admin/admin-customer.routes.ts src/admin/admin-customer-selects.ts
```

typecheck:

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
```

현재 감사 시점의 Admin Web typecheck에는 Customers와 무관한 기존 오류가 있었다.

```text
apps/admin_web/app/bookings/[id]/page.tsx:1028
bookingId prop mismatch
```

이 오류가 그대로라면 이번 작업 범위를 넓혀 Bookings를 수정하지 말고 기존 실패로 정확히 보고해라. Customers 변경으로 새 오류가 추가되지 않았는지는 별도로 확인한다.

## 11. 브라우저 검증

로그인 상태가 유지된 in-app browser를 사용한다. 데이터 쓰기 작업은 하지 않는다.

필수 URL/상태:

```text
/customers
/customers?view=all
/customers?view=all&q=Audit
/customers?q=zzzz-no-customer
/customers?view=new-today&q=zzzz-no-customer
/customers?view=active-today&q=zzzz-no-customer
/customers?view=all&page=99
/customers?view=all&sort=name
Custom date: 선택 직후, 빈 값, 역순, 유효 범위
Customer detail: detail 권한 있음
Customer detail: directory-only/detail 권한 없음
Access restricted return path
```

각 상태에서 확인할 것:

- queue count와 visible result count의 단위
- filter chip과 empty-state 문구의 원인 일치
- sort label, URL, row 순서 일치
- current booking status와 updatedAt의 모순 없음
- detail permission에 맞는 link/lock affordance
- 접근 거부 화면의 사용자 친화적 label과 `Back to customers`
- 고객 이름 식별 가능성
- 반복 null 문구 감소
- Light/Dark 대비와 focus-visible
- 문서 전체 가로 overflow 없음
- `document.title`
- console error/warning

수정 후 스크린샷을 새 폴더에 저장해라.

```text
C:\dev\massage-on-demand-vn\output\customers-post-implementation-remediation-2026-08-07
```

최소 스크린샷:

```text
01-payment-review-empty-1440.png
02-all-customers-1440.png
03-filtered-empty-1440.png
04-current-booking-row-1440.png
05-directory-only-permission-1440.png
06-detail-access-denied-1440.png
07-sort-name-1440.png
08-custom-date-validation-1440.png
09-all-customers-1600.png
10-all-customers-dark-1440.png
```

스크린샷을 저장만 하지 말고 직접 열어 잘림, 과도한 여백, 이름 말줄임, badge 겹침, 컬럼 정렬을 확인해라.

## 12. 완료 조건

다음을 모두 만족해야 작업 완료다.

- [ ] directory-only 운영자가 실패하는 detail 링크를 보지 않는다.
- [ ] detail 권한이 있는 운영자는 기존 상세 흐름과 안전한 returnTo를 유지한다.
- [ ] 접근 거부 문구에 raw enum과 내부 slug가 없다.
- [ ] 접근 거부 후 Customers 목록으로 돌아갈 수 있다.
- [ ] 필터 결과 0과 운영 뷰 자체 0이 구분된다.
- [ ] 전체 customer 자체 0의 문구가 정확하다.
- [ ] 현재 예약 상태와 updatedAt이 최근 10개 history 표본에 의존하지 않는다.
- [ ] 세션 필터와 행 표시가 같은 기준을 사용하거나, 현재 조건에 맞는 정직한 임시 라벨을 사용한다.
- [ ] result count와 sort가 화면에 보인다.
- [ ] 정렬 UI는 기존 URL/server sort를 재사용한다.
- [ ] `Total paid`가 실제 계산보다 넓은 의미를 약속하지 않는다.
- [ ] `0/0 completed`와 반복 부정 문구가 정리된다.
- [ ] 1440px에서 일반 고객 이름을 식별할 수 있다.
- [ ] open work와 History의 현재 구분이 유지된다.
- [ ] Custom date, page redirect, 오류 상태, masking이 회귀하지 않는다.
- [ ] Customers document title이 설정된다.
- [ ] 관련 테스트와 lint가 통과한다.
- [ ] API typecheck가 통과한다.
- [ ] Admin typecheck의 기존/신규 실패가 구분되어 보고된다.
- [ ] 실제 브라우저와 저장한 스크린샷을 직접 검수했다.

## 13. 최종 보고 형식

최종 응답은 다음 순서로 작성해라.

1. 운영자 입장에서 달라진 점
2. 해결한 root cause와 수정 파일
3. 권한을 약화하지 않았다는 근거
4. latest-session 구현 또는 정직한 임시안 중 선택한 방향과 이유
5. 통과한 테스트, lint, typecheck 명령과 결과
6. 브라우저에서 검증한 URL·화면 크기·상태
7. 스크린샷 폴더
8. 건드리지 않은 기존 사용자 변경과 protected area
9. 남은 데이터/정책 제한

단순히 “개선했습니다”라고 쓰지 마라. 완료 조건별로 코드, 테스트, 브라우저 증거를 제시해라.

## 14. 작업 방식

1. 현재 코드·화면·권한·테스트를 조사한다.
2. P1을 작은 root-cause 단위로 구현하고 해당 테스트를 통과시킨다.
3. P2를 기존 컴포넌트와 CSS 안에서 최소 수정한다.
4. 관련 lint/typecheck를 실행한다.
5. in-app browser에서 모든 필수 상태를 확인한다.
6. 스크린샷을 저장하고 직접 열어 검수한다.
7. 최종 diff에서 무관한 변경, 중복 helper, 새 dependency, 과도한 추상화를 제거한다.
8. 완료 조건과 최종 보고 형식에 맞춰 결과를 보고한다.

애매한 정책을 추측해 구현하지 마라. 안전한 기존 의미를 보존하면서 문구를 정직하게 좁힐 수 있으면 먼저 그렇게 처리하고, 정책 결정이 필요한 부분은 정확한 근거와 함께 남겨라.

---

## 프롬프트 작성 기준

이 프롬프트는 Codex 공식 prompting 원칙의 `Goal`, `Context`, `Output`, `Boundaries`, 최종 검증 구조를 따르며, 저장소의 `AGENTS.md`를 지속적인 프로젝트 규칙으로 우선하도록 작성됐다.
