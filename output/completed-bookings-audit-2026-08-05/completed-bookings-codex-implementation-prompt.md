# Codex 실행 프롬프트 — Completed Bookings 운영 화면 개선

아래 `MASTER PROMPT` 전체를 새 Codex 작업에 붙여 넣는다. 작업 폴더는 반드시 `C:\dev\massage-on-demand-vn`으로 연다. 복잡한 API·UI 동시 변경이므로 가능하면 Plan mode로 시작하되, 계획만 제출하지 말고 같은 작업에서 구현·검증까지 완료한다.

---

# MASTER PROMPT

## 목표

`C:\dev\massage-on-demand-vn`의 관리자 화면 `http://localhost:3101/bookings/completed`를 실제 운영자가 빠르고 안전하게 closeout 업무를 처리할 수 있는 화면으로 수정하라.

이번 작업의 핵심은 단순한 시각적 미화가 아니다. 아래 흐름이 한 화면에서 일치해야 한다.

> 큐의 포함 사유 → 판단에 필요한 금융 증거 → 지금 수행할 한 가지 행동

작업이 끝나면 운영자는 목록만 보고 다음을 판단할 수 있어야 한다.

1. 어떤 예약이 왜 이 큐에 들어왔는가?
2. 얼마나 오래 미해결 상태인가?
3. payment, Partner earning, platform fee, tax, wallet 중 무엇이 정상이고 무엇이 누락됐는가?
4. 지금 클릭해야 할 정확한 다음 행동은 무엇인가?

## 반드시 먼저 읽을 자료

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\output\completed-bookings-audit-2026-08-05\completed-bookings-operator-audit.md`
3. 같은 폴더의 화면 캡처:
   - `01-completed-overview.png`
   - `04-closeout-table.png`
   - `05-payment-ops-table.png`
   - `06-pricing-ops-mixed-records.png`
   - `08-search-empty-copy.png`
   - `09-custom-range-empty-all-history.png`

보고서의 현상만 패치하지 말고 관련 호출 경로와 공유 컴포넌트를 확인해 한 번에 원인을 수정하라. 작업 전 `git status --short`를 확인하고 사용자의 기존 변경을 보존한다.

## 확정된 제품 결정

아래 항목은 다시 질문하지 말고 그대로 구현한다.

1. 현재 route `/bookings/completed`는 유지한다.
2. 실제 데이터 범위가 COMPLETED, REFUNDED, EXPIRED terminal records를 포함하므로 화면과 내비게이션 이름은 `Closeout operations`로 변경한다.
3. 전체 기록 queue의 이름은 `Terminal records`로 변경한다.
4. `Pricing ops`는 원칙적으로 `COMPLETED` 예약만 포함한다. 환불/만료 건의 단순 서비스 정보 누락은 pricing exception으로 취급하지 않는다.
5. closeout 관련 작업 큐의 기본 정렬은 오래 기다린 건 우선이다. `Terminal records`만 최근 종료 건 우선이다.
6. 사용자에게 보이는 문구는 영어로 유지하고 `Provider` 대신 `Partner`를 사용한다.
7. 새 UI 라이브러리, 전역 상태 라이브러리, 테이블 라이브러리를 추가하지 않는다.
8. DB schema나 migration을 추가하지 않는다. 기존 timestamp와 기존 `AdminBooking` finance facts를 재사용한다.
9. 고객 앱과 Partner 앱은 수정하지 않는다.

## 구현 범위

### 1. Custom dates 전체 조회 사고 방지

현재 `dateRange=custom`인데 날짜가 없으면 날짜 조건이 사라져 전체 이력을 조회한다. UI와 API 양쪽에서 막아라.

#### UI

- `Custom dates`를 누르면 URL을 즉시 `dateRange=custom`으로 변경하지 말고 날짜 입력 영역만 연다.
- `Apply dates`를 눌렀을 때만 URL을 변경한다.
- 시작일과 종료일을 모두 필수로 한다.
- 한쪽만 입력, 잘못된 날짜, 종료일 < 시작일, 90일 초과 범위는 제출을 막는다.
- 오류는 입력 근처에 문장으로 표시하고 `aria-describedby` 또는 기존 form error 패턴으로 연결한다.
- search, view, age, sort 등 기존 query parameter를 유효한 날짜 적용 후에도 보존한다.

#### API

- `dateRange=custom`이면 `dateFrom`, `dateTo` 모두 유효한 `YYYY-MM-DD`여야 한다.
- 시작일은 종료일보다 늦을 수 없고 범위는 최대 90일이다.
- invalid custom range는 날짜 조건을 제거하지 말고 HTTP 400으로 거부한다.
- UI 검증을 우회한 직접 API 호출도 전체 조회가 되지 않아야 한다.
- Asia/Ho_Chi_Minh 날짜 시작·종료 경계를 유지한다.

### 2. Pricing ops 분류와 큐별 다음 행동 일치

#### API 분류

- `completed-pricing` 조건에 `facts.status = COMPLETED`를 명시한다.
- COMPLETED가 아닌 REFUNDED/EXPIRED 예약이 서비스 또는 payout rule 누락만으로 Pricing ops에 들어오지 않게 한다.
- summary count와 list result가 동일한 조건을 공유해야 한다. 카운트와 목록 조건을 별도로 복제하지 않는다.

#### UI 행동

- 현재 `bookingMonitorNextAction(booking, nowMs)`가 booking status만 보는 구조를 수정해 active `view`를 고려하게 한다.
- 현재 큐의 문제를 해결하는 행동을 우선한다.

필수 행동 예시:

- `payment`: `Resolve authorization`, `Release payment hold`, `Add gateway reference`, `Confirm cash status`
- `closeout`: `Create Partner earning`, `Add platform fee log`, `Add tax log`, `Add wallet entry`, `Reconcile closeout`
- `pricing`: `Verify booked price`, `Fix payout rule`
- `refund-review`: `Review refund mismatch`, `Confirm release or refund`
- `expired`: `Release payment hold`, `Confirm customer notice`

실제 fact에 따라 가장 구체적인 하나를 primary action으로 선택한다. 알 수 없는 경우에만 일반적인 `Review ...`를 사용한다.

### 3. 큐 포함 사유를 행에서 표시

기존 `AdminBooking`의 다음 데이터를 재사용해 issue model을 만든다.

- `payment.method`, `payment.status`, `payment.amount`, `payment.providerRef`
- `earning.status`, `earning.netAmount`
- `earning.platformFeeLogs`
- `earning.taxLogs`
- `earning.walletLedgerEntries`
- refund records/status
- pricing policy signal

행마다 현재 view의 포함 사유를 1~3개의 짧은 issue chip으로 표시한다.

예:

- `Payment authorized`
- `Gateway ref missing`
- `Earning missing`
- `Platform fee missing`
- `Tax missing`
- `Wallet entry missing`
- `Payout rule missing`
- `Refund mismatch`

같은 예약이 여러 큐에 포함될 수 있다는 사실을 큐 영역에 한 번만 설명한다.

정확한 문구:

`Bookings may appear in more than one queue.`

중복을 없애기 위해 예약을 임의의 한 큐에만 배정하지 않는다.

### 4. 운영용 표 정보 구조 변경

operations table을 다음 6개 정보 묶음으로 재구성한다.

1. `Priority · Issue`
2. `Booking · Customer`
3. `Completed service`
4. `Payment`
5. `Partner · Closeout`
6. `Next action`

#### Priority · Issue

- terminal event 이후 waiting time
- 현재 큐의 issue chip
- 상태와 종료시각을 중복 없이 표시

권장 형태:

```text
Action · waiting 4h
Completed 5 Aug, 18:18
Earning missing · Tax missing
```

#### Booking · Customer

- short booking ID
- customer name
- masked phone
- 앱 online/offline dot은 제거

#### Completed service

- service name / duration
- completion 또는 terminal time
- area
- 고객 가격

#### Payment

- method / status
- amount / currency
- provider ref 존재 여부
- refund state가 있으면 함께 표시

#### Partner · Closeout

- final Partner
- earning status / net amount
- platform fee, tax, wallet의 존재 여부
- `participants` count와 matching 정보는 제거

#### Next action

- 현재 큐 원인과 일치하는 primary link 하나
- 1줄 helper
- 상세 화면의 기존 유효한 anchor를 재사용

긴 `closedNote`, `provider closure / ... / Audit: ...` 전문은 목록에서 제거하고 상세 화면에서만 제공한다.

### 5. 1280px에서도 읽히는 반응형 레이아웃

현재 viewport 1280px + 열린 sidebar에서 표 내용이 겹친다.

- viewport media query만 사용하지 말고 표가 배치된 실제 container width를 기준으로 반응형을 전환한다.
- 가능한 경우 CSS container query를 사용한다.
- 컨테이너가 약 1,050~1,100px 미만이면 각 예약을 2열 또는 3열 operations card row로 전환한다.
- 1440px 이상에서 6열 table을 유지한다.
- 텍스트를 작게 만들어 숨기거나 핵심 값을 ellipsis만으로 감추는 방식은 금지한다.
- 긴 ID나 ref는 `overflow-wrap`을 적용하되 행 간 내용이 겹치지 않아야 한다.
- 가로 스크롤을 유지할 경우 스크롤 영역의 keyboard focus와 accessible name을 보존한다.

반드시 다음 화면을 실제 캡처해 비교한다.

- 1280 × 720, sidebar open
- 1024 × 768 desktop pointer 환경
- 1440 × 900

### 6. terminal queue age와 정렬 기준 수정

현재 age가 `createdAt` 기준이라 closeout 대기시간과 다르다.

- completed route의 age/count/sort는 terminal reference time을 사용한다.
- 새 DB 필드는 추가하지 않는다.
- 최소 기준:
  - COMPLETED/REFUNDED: `COALESCE(closedAt, updatedAt, createdAt)`
  - EXPIRED: `COALESCE(closedAt, expiresAt, updatedAt, createdAt)`
- list filtering, queue age counts, server ordering이 같은 timestamp 정의를 공유하게 한다.
- closeout/payment/cash-debt/pricing/refund-review/expired의 URL에 sort가 없으면 오래 기다린 건 우선으로 정렬한다.
- `Terminal records`는 최근 terminal event 우선이다.

문구 변경:

- `Requested` → `Waiting`
- `Oldest first` → `Longest waiting`
- `Newest first` → `Recently closed`
- 도움말은 `Waiting time starts from the terminal booking event.`처럼 실제 기준과 일치시킨다.

### 7. 기간 필터 의미 통일

completed route의 기간은 “어느 timestamp 하나라도 기간에 포함”이 아니라 terminal event 기간이어야 한다.

- 기본 terminal period는 위에서 정의한 terminal reference time을 사용한다.
- UI 라벨은 `Closed period`로 변경한다.
- completed route의 모든 queue에서 기간 필터를 볼 수 있게 한다.
- `Today`, `Previous day`, `Last 7 days`, `Last month`, `Custom dates`가 동일한 terminal timestamp를 사용한다.
- 오래된 예약이 단순 `updatedAt` 때문에 오늘의 completed record로 잘못 들어오지 않게 주의한다. closedAt이 존재하면 updatedAt보다 closedAt을 우선한다.

### 8. 페이지 범위와 문구 정리

route는 유지하면서 다음 문구를 정확히 사용한다.

#### Page

- 제목: `Closeout operations`
- 설명: `Review completed, refunded, and expired bookings that still need payment or settlement follow-up.`
- 내비게이션: `Closeout Operations`
- `Booking queues` → `Closeout queues`
- `Records` → `Terminal records`

#### Queue descriptions

- Closeout ops: `Completed services with one or more missing closeout records.`
- Payment ops: `Terminal bookings with unresolved capture, release, refund, cash, or gateway reference.`
- Pricing ops: `Completed services whose booked price or Partner payout rule cannot be verified.`
- Terminal records: `Completed, refunded, and expired records closed in the selected period.`

기존 `Booking history across all states` 문구는 실제 범위와 다르므로 제거한다.

### 9. Historical 화면의 realtime 오표시 제거

- completed route는 realtime socket을 사용하지 않는다.
- `Realtime connecting`, `Opening realtime socket`, `Realtime paused`를 렌더링하지 않는다.
- historical 화면 상태는 하나의 명확한 문구로 표시한다.

권장 형태:

`Historical snapshot · refreshed 21:55`

`Historical`과 `Live · updated`를 동시에 표시하지 않는다.

### 10. 첫 화면의 정적 안내 축소

`Completed closeout flow` 3개 카드는 실제 큐를 첫 화면 아래로 밀어낸다.

- 기존 flow 설명은 삭제하지 말고 기존 disclosure 컴포넌트로 `How to review closeout` 아래에 기본 닫힘 상태로 이동한다.
- 첫 화면에는 closeout queue chips와 첫 결과 행이 보여야 한다.
- `oldestCloseoutAt`이 있으면 `Oldest waiting ...`을 queue summary에 표시한다.
- 별도의 새 대시보드 컴포넌트를 만들지 말고 기존 summary/queue UI를 재사용한다.

### 11. 필터 상태를 반영하는 empty state

empty message가 `view`만 보지 말고 search/date/age 활성 상태를 함께 보게 한다.

- 검색 활성:
  - `No bookings match “{query}”. Clear search or change the closed period.`
- 날짜 또는 waiting filter 활성:
  - `No records match the current closed-period and waiting-time filters.`
- 필터가 없는 actionable queue:
  - 기존 큐별 정상 상태 문구를 유지
- clear link는 현재 route/view를 유지하면서 search만 제거해야 한다.

### 12. 작은 운영 노이즈 정리

- terminal operations table에서 고객/Partner app online/offline 표시 제거
- participant count 제거
- `totalPages <= 1`이면 pagination page buttons를 숨기고 summary만 표시
- completed route page size를 25로 변경
- post-match cancellation 등 다른 route의 page size는 의도치 않게 변경하지 않는다

## 주요 코드 후보

먼저 아래 파일과 모든 관련 호출자를 확인하라. 파일 목록은 시작점이며, 원인 수정에 필요한 최소 파일만 변경한다.

- `apps/admin_web/app/bookings/booking-monitor-page.tsx`
- `apps/admin_web/app/bookings/booking-monitor.tsx`
- `apps/admin_web/app/bookings/booking-monitor-options.ts`
- `apps/admin_web/app/bookings/booking-monitor-filters-section.tsx`
- `apps/admin_web/app/bookings/booking-monitor-list-section.tsx`
- `apps/admin_web/app/bookings/booking-monitor-list-row-model.ts`
- `apps/admin_web/app/bookings/booking-monitor-next-action-label.ts`
- `apps/admin_web/app/bookings/booking-empty-message.ts`
- `apps/admin_web/app/bookings/booking-monitor-route-load-plan.ts`
- `apps/admin_web/components/admin-data-table.tsx`
- `apps/admin_web/app/globals.css`
- `apps/api/src/admin/admin-booking.routes.ts`
- `apps/api/src/admin/admin-booking-list-query.ts`
- `apps/api/src/admin/admin.service.ts`

## 구현 제약

- `AGENTS.md`를 따른다.
- 단일 에이전트로 작업한다.
- 사용자의 기존 변경을 덮어쓰거나 되돌리지 않는다.
- 새 dependency를 설치하지 않는다.
- DB schema/migration, auth, payment mutation, settlement mutation은 변경하지 않는다.
- 이번 API 수정은 관리자 read query와 custom date validation에만 제한한다.
- 기존 customer/Partner phone masking을 유지한다.
- detail anchor와 현재 deep link를 깨지 않는다.
- 접근성 기본을 축소하지 않는다: label, table header, region name, focus-visible, keyboard navigation을 유지한다.
- 테스트를 통과시키기 위해 assertion을 약화하거나 삭제하지 않는다.
- 공통 helper가 이미 있으면 재사용한다. 한 화면 전용 추상화나 새 상태 관리 계층을 만들지 않는다.
- 보고서의 캡처는 증거 자료다. 앱 asset으로 복사하거나 배포하지 않는다.

## 테스트 요구사항

변경된 동작마다 가장 가까운 기존 spec을 수정하거나 추가한다. 최소한 다음을 검증한다.

### Admin Web

- `booking-monitor-filters-section.spec.tsx`
  - Custom dates를 여는 것만으로 URL 조회가 발생하지 않음
  - required/invalid/reversed/over-90-days validation
  - valid query parameter 보존
- `booking-monitor-next-action-label.spec.ts`
  - view별 action과 helper
- `booking-monitor-list-row-model.spec.ts`
  - finance facts와 issue chips
- `booking-monitor-list-section.spec.tsx`
  - 새 6개 정보 묶음, presence/participants 제거, 접근 가능한 action
- `booking-monitor-live-status-section.spec.tsx` 또는 `booking-monitor-realtime.spec.ts`
  - completed/historical에서 realtime 문구 없음
- `booking-empty-message.spec.ts`
  - search/date/waiting filter별 문구
- `booking-monitor-options.spec.ts`
  - Closeout operations/Terminal records 범위 문구
- `booking-monitor-route-load-plan.spec.ts`
  - completed page size 25, 기본 sort/period query
- `admin-data-table.spec.tsx`
  - totalPages 1일 때 pagination buttons 없음
- CSS contract 또는 component spec
  - container query/card layout selector가 유지됨

### API

- `admin-booking-list-query.spec.ts`
  - terminal reference date bounds
  - custom range 빈 값, 한쪽 값, invalid, reversed, 90일 초과
  - 베트남 시간 경계
- `admin.service.spec.ts`
  - completed-pricing은 COMPLETED만 포함
  - pricing summary와 list 조건 일치
  - terminal age counts와 sort가 같은 timestamp 정의를 사용
- route/controller spec
  - invalid custom range가 HTTP 400

## 실행 검증

우선 관련 spec을 빠르게 실행하고, 그다음 repository scope 검증을 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web
npm.cmd run test --workspace @massage-vn/api
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

전체 test가 지나치게 오래 걸리면 먼저 관련 Vitest 파일만 실행해 피드백을 얻어도 되지만, 최종 완료 전에는 위 admin/api scope 검증을 반드시 시도한다. 실패하면 원인과 이번 변경과의 관련성을 구분해 보고한다.

## 실제 브라우저 검증

코드 테스트만으로 끝내지 않는다. 현재 로그인된 브라우저 세션을 사용할 수 있으면 `http://localhost:3101/bookings/completed`를 직접 확인한다.

필수 상태:

1. 기본 Closeout ops
2. Payment ops
3. Pricing ops
4. Terminal records / Today
5. 검색 결과 없음
6. Custom dates 미입력/invalid/valid
7. totalPages 1인 큐
8. 상세 action deep link

필수 viewport:

- 1280 × 720, sidebar open
- 1024 × 768
- 1440 × 900

다음을 확인한다.

- 텍스트 겹침 0건
- 핵심 금액과 issue가 ellipsis 때문에 사라지지 않음
- 현재 큐와 primary action 일치
- Refunded/Expired가 Pricing ops에 잘못 나타나지 않음
- 빈 Custom dates가 전체 이력을 조회하지 않음
- historical route에 realtime socket 문구 없음
- 키보드로 필터, table region, booking link, primary action에 접근 가능
- 상세 링크가 올바른 anchor로 이동

검증 캡처는 새 폴더 `output/completed-bookings-improvement-verification-YYYY-MM-DD`에 저장한다.

## 완료 조건

다음이 모두 충족되기 전에는 완료라고 보고하지 않는다.

1. P0 세 문제(table overlap, queue/action mismatch, empty custom range)가 재현되지 않는다.
2. closeout 목록에서 payment/earning/fee/tax/wallet 상태와 누락 원인이 보인다.
3. closeout 작업 큐는 longest waiting 우선이고 Terminal records는 recently closed 우선이다.
4. 페이지 제목·설명·큐 이름이 실제 terminal 데이터 범위와 일치한다.
5. realtime 오표시와 필터와 맞지 않는 empty message가 제거된다.
6. 1280/1024/1440 화면 검증이 끝난다.
7. 관련 테스트와 admin/api scope 검증 결과가 기록된다.
8. 새 dependency와 DB migration이 없다.
9. 사용자의 기존 변경이 보존된다.
10. 최종 diff를 스스로 검토해 중복 로직, 잘못된 copy, 다른 booking route 회귀가 없는지 확인한다.

## 최종 보고 형식

결과 보고는 다음 순서로 작성한다.

1. 운영자 관점에서 무엇이 달라졌는지
2. 변경 파일
3. queue 분류·날짜·정렬 동작 변경
4. 브라우저 캡처 경로
5. 실행한 명령과 pass/fail/skipped
6. 보호 영역 변경 여부
7. 남은 위험 또는 검증하지 못한 항목
8. commit을 만들었다면 commit hash, 만들지 않았다면 `Not committed`

계획이나 제안만 제출하지 말고 구현·테스트·브라우저 확인까지 수행하라.

