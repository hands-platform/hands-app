# Codex 구현 프롬프트 — Customer Detail 재감사 후속 개선

아래 프롬프트 전체를 `C:\dev\massage-on-demand-vn`을 작업 폴더로 연 새로운 Codex 작업에 그대로 붙여 넣는다.

---

## 역할과 최종 목표

너는 `C:\dev\massage-on-demand-vn`의 HANDS 관리자 웹을 개선하는 시니어 제품 엔지니어다.

대상 페이지:

- URL: `http://localhost:3101/customers/audit_booking_list_customer_profile`
- 주 구현: `apps/admin_web/app/customers/[id]/page.tsx`
- 재감사 보고서: `output/customer-detail-post-implementation-audit-2026-08-07/customer-detail-post-implementation-deep-audit.md`

이번 작업의 목표는 새 디자인을 만드는 것이 아니다. 재감사에서 확인된 **운영 데이터 범위 오류, 잘못된 drill-down 링크, 예약 표 잘림, 반복 기록 식별 문제와 불필요한 화면 밀도**를 기존 관리자 디자인 시스템 안에서 고친다.

운영자가 다음 질문에 정확히 답할 수 있어야 한다.

1. 현재 활성 예약은 총 몇 건이며 어느 예약이 가장 먼저 확인할 대상인가?
2. 이 고객의 전체 예약과 결제 기록으로 이동했을 때 실제로 이 고객만 필터링되는가?
3. Recent bookings의 모든 핵심 열과 결과를 1440px에서 읽을 수 있는가?
4. 화면의 숫자가 현재값, 전체값, 최신 6건 중 어느 범위인지 분명한가?
5. 서로 다른 예약·채팅·운영 기록을 이름만 보고 구분할 수 있는가?
6. 메모·푸시·지갑 작업 후에도 원래 고객 검색 결과로 돌아갈 수 있는가?

계획이나 추가 감사 보고서만 작성하고 멈추지 마라. 현재 코드를 조사한 뒤 직접 수정하고, 관련 테스트·타입 검사·lint와 로그인된 브라우저의 1440×900/1600×900 검증까지 완료하라.

## 반드시 먼저 읽을 자료

작업 전에 다음 자료를 읽고 보고서의 주장과 현재 코드를 다시 대조하라.

1. 저장소 지침
   - `C:\dev\massage-on-demand-vn\AGENTS.md`
2. 이번 재감사 보고서
   - `C:\dev\massage-on-demand-vn\output\customer-detail-post-implementation-audit-2026-08-07\customer-detail-post-implementation-deep-audit.md`
3. 재감사 화면 증거 14장
   - `C:\dev\massage-on-demand-vn\output\customer-detail-post-implementation-audit-2026-08-07`
4. 이전 구현 프롬프트와 감사 보고서
   - `C:\dev\massage-on-demand-vn\output\customer-detail-audit-post-match-2026-08-06\customer-detail-codex-implementation-prompt.md`
   - `C:\dev\massage-on-demand-vn\output\customer-detail-audit-post-match-2026-08-06\customer-detail-operator-audit.md`
5. 주요 코드
   - `apps/admin_web/app/customers/[id]/page.tsx`
   - `apps/admin_web/app/customers/[id]/actions.ts`
   - `apps/admin_web/app/customers/[id]/customer-booking-operation-board.tsx`
   - `apps/admin_web/app/customers/[id]/customer-detail-overview-shell.tsx`
   - `apps/admin_web/app/customers/[id]/customer-detail-section-shell.tsx`
   - `apps/admin_web/app/customers/[id]/customer-wallet-adjustment-panel.tsx`
   - `apps/admin_web/app/customers/[id]/customer-wallet-adjustment-form.tsx`
   - `apps/admin_web/components/admin-overview-card.tsx`
   - `apps/admin_web/app/bookings/booking-monitor-route-load-plan.ts`
   - `apps/admin_web/app/payments/payment-page-model.ts`
   - `apps/admin_web/app/globals.css`
   - `apps/api/src/admin/admin.service.ts`
   - `apps/api/src/admin/admin-customer-selects.ts`
   - `apps/api/src/admin/admin-booking-list-query.ts`

보고서의 줄 번호는 이후 변경으로 달라질 수 있다. 줄 번호를 그대로 믿지 말고 `rg`로 함수, selector, query parameter와 모든 호출자를 다시 찾아 실제 흐름을 확인하라.

## 작업 범위와 원칙

- 검사·수정 대상 viewport는 **1440×900과 1600×900 데스크톱**이다.
- **1024px 이하, 모바일·태블릿 레이아웃은 이번 작업 범위에서 완전히 제외**한다. 이를 새 완료 조건이나 보고 항목으로 추가하지 마라.
- 기존 디자인 언어, 토큰, 컴포넌트, URL filter 계약을 재사용한다.
- 새 UI 프레임워크, 테이블 라이브러리, 상태관리 라이브러리, 아이콘 패키지를 추가하지 마라.
- 새 디자인 시스템, 전역 상태 체계, 범용 테이블 추상화나 미래를 위한 speculative API를 만들지 마라.
- 공용 컴포넌트를 바꾸기 전에 모든 사용처를 검색한다. 고객 상세에만 필요한 CSS/동작이면 해당 페이지 selector로 제한한다.
- 사용자 변경이 섞인 dirty worktree를 보존한다. 관련 없는 파일을 수정·포맷·되돌리지 마라.
- `git reset --hard`, 광범위한 checkout, 재생성으로 기존 변경 덮어쓰기, 요청받지 않은 commit/push를 하지 마라.
- `AGENTS.md`의 protected area를 준수한다. API 변경이 필요하면 고객 상세 계약에 필요한 최소 범위만 건드린다.
- 사용자 문구에는 `Provider` 대신 `Partner`를 사용한다.
- 숫자·위험 상태·운영 신호를 추측하지 마라. 모든 표시값은 서버 데이터와 명확한 범위로 설명 가능해야 한다.
- 기존 구현에서 이미 완료된 오류 처리, 지갑 부분 실패, safe session summary, diagnostics opt-in, 메모 기본값, push unavailable, 지갑 2단계 검토, native chat disclosure를 훼손하지 마라.
- 실제 브라우저 검증 중 메모 저장, 푸시 발송, 지갑 최종 Apply를 실행하지 마라. 위험 write는 격리된 자동 테스트로만 검증한다.

## 구현 우선순위

다음 P1을 먼저 모두 해결하고 테스트한 뒤 P2와 P3를 진행하라.

## P1 — 운영 오류 가능성이 있는 필수 수정

### P1-1. 단일 `activeBooking`을 다중 활성 예약 계약으로 수정

현재 문제:

- 고객 fixture에는 활성 예약이 2건이다.
- API는 active status를 `createdAt desc`로 정렬한 뒤 `findFirst` 한 건만 반환한다.
- 상단은 더 최근에 만들어진 Matching 예약만 보여 주며, 운영상 더 진행된 In-service 예약을 숨긴다.

요구사항:

- `getCustomerDetail`의 단일 active booking 조회를 bounded `findMany`로 바꾼다.
- 최대 10건 정도의 명시적 제한을 둔다. 고객 상세 payload를 무제한으로 키우지 마라.
- 기존 호출자를 전부 검색한 뒤 응답 필드를 `activeBookings`로 바꾼다.
- 실제 소비자가 하나뿐이라면 사용하지 않는 호환 필드를 speculative하게 유지하지 마라.
- UI는 `N active bookings`를 표시한다.
- 운영 우선순위는 최소한 `In service → Arrived → On the way → Matched → Matching` 순으로 한다. 저장소에 기존 status/stage 정렬 helper가 있으면 재사용하고, 없으면 이 화면 가까이에 가장 작은 명시적 순서만 둔다.
- 상단 primary link는 가장 진행된 예약을 연다.
- 나머지 활성 예약의 존재를 숨기지 않고 `View 2 active bookings`처럼 Recent bookings의 Live 상태로 연결한다.
- `No open action`은 예외 큐 기준임을 문구로 분명히 한다. 예: `No exception queue item requires action.`
- 화면의 `Checked at`이 단순 렌더 시각이라면 `Page refreshed at`으로 이름을 바꾸거나 실제 데이터 생성 시각과 구분한다.

테스트:

- Matching과 In service가 동시에 존재하는 fixture에서 두 예약이 모두 응답에 포함된다.
- 상단에는 `2 active bookings`가 보인다.
- primary 예약은 In service다.
- active booking이 0/1/2건일 때 문구와 링크가 자연스럽다.

### P1-2. `View all bookings` 링크 계약 수정

현재 잘못된 링크:

```text
/bookings?customer={customerId}
```

예약 화면은 `customer`를 읽지 않고 `q`, `view`, `dateRange`를 읽는다. API 검색은 이미 `q`로 `customerProfileId`를 검색한다.

요구사항:

- 링크를 기존 계약을 재사용하는 다음 형태로 수정한다.

```text
/bookings?view=all&dateRange=all&q={encodedCustomerId}
```

- 새 booking API filter나 별도 고객 예약 페이지를 만들지 마라.
- customer ID는 URL encoding한다.
- exact href 또는 URLSearchParams 결과를 검증하는 회귀 테스트를 추가한다.
- 브라우저에서 링크를 열어 해당 고객 ID가 검색 필터에 반영되고 다른 고객의 예약이 섞이지 않는지 확인한다.

### P1-3. `Open payments` 링크 계약 수정

현재 잘못된 링크:

```text
/payments?customer={customerId}
```

결제 화면이 실제로 읽는 query parameter는 `customerProfileId`다.

요구사항:

```text
/payments?customerProfileId={encodedCustomerId}
```

- 기존 payment page filter 계약을 그대로 재사용한다.
- 새 결제 API parameter를 추가하지 마라.
- exact href 회귀 테스트와 실제 브라우저 필터 확인을 추가한다.

### P1-4. 1440·1600 예약 표 clipping 제거

현재 원인:

- 고객 예약 section이 `booking-monitor` class를 공유한다.
- 공용 `.booking-monitor .vuexy-booking-table`에 `min-width: 1480px`가 있다.
- 고객 상세용 `.customer-recent-bookings-table`이 이를 되돌리지 않는다.
- 1440px에서는 Outcome 전체가 사라지고, 1600px에서도 Outcome과 네 번째 metric card가 잘린다.

가장 작은 수정 방향:

```css
.customer-booking-operation-section .customer-recent-bookings-table {
  min-width: 0;
  table-layout: fixed;
  width: 100%;
}
```

요구사항:

- 위와 같은 target-scoped override로 공용 1480px rule을 이긴다.
- 다른 booking monitor 페이지의 테이블 폭을 바꾸지 마라.
- 현재 4개 의미 열 `When & booking / Service & Partner / Money / Outcome`은 유지한다.
- 긴 값은 셀 안에서 자연스럽게 wrap한다. 문제를 새 수평 스크롤 UI로 덮지 마라.
- 1440×900과 1600×900에서 네 열과 네 metric card가 모두 보이는지 실제 스크린샷으로 확인한다.

### P1-5. Latest 6 요약의 잘못된 scope 자동 추론 제거

현재 `AdminTraceSummary`의 자동 추론 때문에 항상 latest 6을 요약하는 카드에 다음 배지가 섞인다.

- `Current filters`
- `All records`
- `Latest 6`

요구사항:

- 이 페이지의 요약 카드에는 `inferScope={false}`를 사용하거나 `scope="Latest 6"`를 명시한다.
- Cancelled/Live 화면 필터를 바꿔도 latest 6 요약의 범위 라벨이 `Current filters`로 바뀌지 않게 한다.
- 공용 `AdminTraceSummary`의 기본 동작을 바꾸기 전 모든 사용처를 조사한다.
- 고객 상세에서만 해결할 수 있으면 호출부에서 명시적으로 해결한다.

테스트:

- 요약 카드에 `All records`, `Current filters`가 나타나지 않는다.
- 모든 카드의 범위가 `Latest 6` 또는 더 명확한 동등 문구다.

### P1-6. 예약·채팅 링크 이름을 고유하게 만들기

현재 `customerRecordLabel`이 ID 마지막 10자만 사용해 서로 다른 예약이 `...on_booking`, `...ed_booking`처럼 같은 이름을 가진다. 채팅의 `Open booking ...on_booking`과 `Open full chat archive ...on_booking`도 반복된다.

요구사항:

- ID suffix만으로 구분하지 말고 `requested time`, 상태, Partner 또는 서비스 중 최소 하나를 결합한다.
- 화면 라벨과 accessible name 모두 서로 다른 목적지를 구분할 수 있어야 한다.
- 예: `Open booking …on_booking requested 16:03`.
- 전체 raw ID는 필요하면 보조 텍스트, title 또는 copy target으로 유지하되 긴 ID를 primary label로 늘어놓지 마라.
- 하나의 작은 formatter를 이미 여러 위치가 공유할 필요가 있을 때만 재사용한다. 한 번 쓰는 범용 추상화는 만들지 마라.

테스트:

- 동일 suffix를 가진 예약 두 건의 link name이 다르다.
- `Open booking`과 `Open full chat archive` 각각 대상 예약이 accessible name에 포함된다.

## P2 — 운영 흐름과 정보 밀도 개선

### P2-1. note/push/wallet action 후 `returnTo` 보존

현재 고객 목록에서 상세로 들어올 때는 `returnTo`가 동작하지만 form action과 wallet panel redirect 이후에는 사라진다.

요구사항:

- 현재 저장소의 `returnTo` 검증 패턴과 `safeCustomerReturnTo` 또는 동등 helper를 먼저 찾는다.
- note, push, wallet form에 검증된 `returnTo`를 hidden field로 전달한다.
- 성공·실패·review 취소·panel 닫기 redirect에서 복귀 문맥을 유지한다.
- 외부 URL, protocol-relative URL, 다른 관리자 경로를 허용하는 open redirect를 만들지 마라.
- 허용 범위는 기존 고객 목록 내부 경로와 현재 제품 규칙을 그대로 따른다.

테스트:

- note/push/wallet 성공과 실패 redirect가 유효한 고객 검색 URL을 보존한다.
- 악성·외부 `returnTo`는 안전한 기본 고객 목록으로 대체된다.

### P2-2. 최대 6건 Recent bookings의 페이지네이션 제거

현재 API 최대가 6건인데 page size 5라 여섯 번째 예약 한 건만 Page 2로 밀린다.

요구사항:

- Recent bookings 6건을 한 화면에 모두 표시한다.
- All/Live/Completed/Cancelled 필터는 유지한다.
- `bookingHistoryPage`와 pagination footer를 제거하거나 더 이상 레코드를 숨기지 않게 한다.
- 과거 URL에 page parameter가 있어도 기록이 숨겨지지 않게 한다. 불필요한 redirect 시스템은 만들지 마라.
- 필터 변경 때문에 전체 customer detail을 다시 읽는 구조는 이번 단계에서 새 상태관리로 재작성하지 마라.

### P2-3. 최대 6개 Chat room의 페이지네이션 제거

- latest 6 booking에서 만들어지는 chat room은 모두 한 compact list에 collapsed 상태로 표시한다.
- 한 번에 한 transcript만 열리는 native `details name` 동작을 유지한다.
- 현재 4번째 방 하나를 보기 위해 별도 Page 2로 이동하지 않게 한다.
- diagnostics를 열었는데 system logs가 0이면 빈 header-only table 대신 compact empty state를 표시한다.

### P2-4. Money의 데이터 범위를 라벨에 명시

현재 current wallet, all-time captured payments, latest 6 booking money가 같은 목록에서 `Recent`라는 모호한 라벨로 섞인다.

최소 수정 예:

- `Current wallet balance`
- `All-time captured payments`
- `Latest 6 authorized / pending`
- `Open refunds now`
- `Latest 6 refund records`
- `Latest 6 cash bookings`

새 KPI 시스템을 만들지 말고 기존 목록 안에서 label, 소제목, divider만 조정한다.

### P2-5. bounded list count를 전체값처럼 표시하지 않기

현재 API 제한:

- bookings: 6
- notifications: 10
- reviews: 각 10
- referrals: 10
- notes/audit logs: 10
- push devices: 10

요구사항:

- 운영 의사결정에 실제 total count가 필요한 곳만 기존 `_count` 패턴을 검토한다.
- 그렇지 않으면 API를 확장하지 말고 `Latest 10 messages`, `Latest 10 notes`, `4 chat rooms in latest 6 bookings`처럼 loaded 범위를 정직하게 표시한다.
- fixture 수가 10 미만이라고 해서 preview count를 all-time total로 표현하지 마라.

### P2-6. zero state 중복과 화면 높이 축소

현재 Referral, Notifications, Notes에서 `0` badge, `0 messages/notes`, empty copy가 반복된다.

요구사항:

- 0건일 때 다음처럼 한 줄 compact state만 남긴다.
  - `No referral activity`
  - `No customer app messages`
  - `No operator notes`
- 데이터가 있을 때만 full history card/table을 보여 준다.
- `Credited 0 VND`처럼 의미 없는 0 지표를 반복하지 마라.
- Retained records 시작 부분에 기존 anchor/link 패턴으로 `Notes / Notifications / Referral / Chat / System` compact index를 추가해도 되지만, 새 tab framework는 만들지 마라.

### P2-7. heading 구조 정리

- 전체 문서 구조를 `h1 → section h2 → nested card h3`로 맞춘다.
- profile 고객명, Operator notes, Chat history 같은 nested 제목이 상위 section과 같은 h2가 되지 않게 한다.
- `AdminSection` 또는 기존 component에 heading level 제어가 이미 있으면 재사용한다.
- 없다면 실제로 여러 nested 사용처가 필요한 최소 prop만 추가하고 기본값은 기존 h2로 유지한다.
- 단순 시각 크기 조절로 semantic heading 문제를 숨기지 마라.

### P2-8. Financial adjustment와 note form의 사전 이해도 개선

- 1440px에서 지갑 조정 5개 입력을 한 줄에 강제로 두지 않는다.
- 해당 form에만 `repeat(auto-fit, minmax(220px, 1fr))` 또는 단순 3열 구조를 적용해 선택값이 잘리지 않게 한다.
- 최종 Apply 버튼은 기존 warning/danger variant가 있으면 재사용한다.
- `Apply 100,000 VND credit now`처럼 금액·방향·즉시성을 담은 현재 안전 문구는 유지한다.
- Activity note label에 `Required · minimum 3 characters`를 입력 전에 표시한다.
- 브라우저 native validation과 서버 validation을 유지한다.

## P3 — 마무리 품질

### P3-1. 중복 페이지 헤더 공간 축소

- breadcrumb와 `Customer Detail` h1은 유지한다.
- 바로 아래 customer command header와 중복되는 설명·padding만 줄인다.
- 새로운 sticky header나 shell 재설계는 하지 마라.

### P3-2. dark warning 대비 확인

- dark mode에서 history signal, warning small text, muted timestamp의 실제 computed foreground/background를 확인한다.
- 정량 확인 없이 WCAG 실패라고 단정하거나 임의 색을 바꾸지 마라.
- 대비가 부족할 때만 기존 semantic token 또는 해당 화면의 scoped token을 조정한다.
- 상태 의미는 계속 텍스트로도 전달한다.

## 이미 개선된 기능을 훼손하지 않는 회귀 조건

다음은 이전 작업에서 개선됐으므로 그대로 통과해야 한다.

- HTTP 404와 401/403/5xx unavailable 상태가 구분된다.
- wallet ledger 실패가 `0 VND`로 위장되지 않는다.
- 일반 customer detail 응답에 IP/deviceId/raw session diagnostics가 포함되지 않는다.
- developer diagnostics는 권한과 `diagnostics=developer` opt-in을 모두 요구한다.
- Add note의 기본 booking은 `No booking link`다.
- active push device가 0이면 발송 form 대신 `Push unavailable`과 대체 연락 동작이 보인다.
- 지갑 조정은 Review → Apply 2단계이며 Before/Change/After를 보여 준다.
- idempotency와 기존 지갑·audit log 안전 검증을 유지한다.
- chat은 native disclosure이며 한 번에 한 transcript만 열린다.
- 저장/발송/지갑 action의 서버 권한 검증을 약화하지 않는다.

## 권장 구현 순서

1. `AGENTS.md`, 재감사 보고서, 현재 git status를 확인한다.
2. 각 대상 함수와 모든 호출자를 `rg`로 찾고 현재 테스트를 읽는다.
3. 잘못된 booking/payment href와 회귀 테스트를 먼저 수정한다.
4. 예약 표의 target-scoped min-width를 수정하고 1440/1600에서 먼저 확인한다.
5. active bookings API 계약과 상단 우선순위를 수정한다.
6. latest 6 scope와 고유 링크 이름을 수정한다.
7. `returnTo`, pagination, money scope, bounded count를 수정한다.
8. zero state, heading, form 밀도, header/dark 품질을 정돈한다.
9. focused test → typecheck/lint 순으로 검증한다.
10. 로그인된 in-app browser에서 1440×900과 1600×900을 다시 캡처하고 acceptance criteria를 점검한다.

한 단계에서 root cause가 보고서와 다르면 실제 코드 증거를 우선하되, 변경 전에 차이와 선택 이유를 작업 기록에 남겨라.

## 최소 테스트 요구사항

기존 spec 구조와 fixture를 재사용하고 최소한 아래 회귀 계약을 추가하거나 갱신한다.

### Admin web

1. `View all bookings` exact query 계약.
2. `Open payments` exact query 계약.
3. active booking 0/1/2건과 stage 우선순위.
4. latest 6 summary에 `Current filters`/`All records` 없음.
5. 동일 ID suffix 예약·채팅의 고유 accessible name.
6. note/push/wallet action 후 안전한 `returnTo` 보존.
7. recent booking 6건이 pagination 없이 모두 표시됨.
8. chat room 4~6개가 pagination 없이 collapsed list에 표시됨.
9. zero record에서 compact state만 표시됨.
10. nested heading의 h1/h2/h3 구조.

### API

1. active status 두 건 이상이 bounded `activeBookings`에 포함됨.
2. active booking projection에 필요한 운영 정보만 포함됨.
3. 기존 safe session summary와 diagnostics gate가 유지됨.
4. customer ownership, wallet authorization와 기존 audit 계약이 유지됨.

### CSS/구조

- 고객 상세 예약 표가 공용 `min-width: 1480px`보다 우선하는 `min-width: 0` 계약을 가진다.
- 다른 booking monitor 화면의 CSS 계약은 변하지 않는다.

## 검증 명령

먼저 변경 범위에 해당하는 focused test를 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- "app/customers/[id]/page.spec.tsx" "app/customers/[id]/customer-booking-operation-board.spec.tsx" "app/customers/[id]/customer-detail-overview-shell.spec.tsx" "app/customers/[id]/customer-detail-section-shell.spec.tsx" "app/customers/[id]/customer-wallet-adjustment-panel.spec.tsx" "app/customers/[id]/actions.spec.ts"
```

```powershell
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts src/admin/admin.controller.spec.ts src/admin/admin-customer-selects.spec.ts -t "customer detail|customer wallet ledger|customer diagnostics"
```

그다음 변경 파일과 workspace 검증을 실행한다.

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
```

```powershell
npx.cmd eslint "app/customers/[id]/page.tsx" "app/customers/[id]/customer-booking-operation-board.tsx" "app/customers/[id]/customer-detail-overview-shell.tsx" "app/customers/[id]/customer-detail-section-shell.tsx" "app/customers/[id]/customer-wallet-adjustment-panel.tsx" "app/customers/[id]/customer-wallet-adjustment-form.tsx" "app/customers/[id]/actions.ts"
npx.cmd eslint "src/admin/admin.service.ts" "src/admin/admin-customer-selects.ts" "src/admin/admin-booking-list-query.ts"
```

- 실제로 건드린 파일이 명령 목록보다 많으면 해당 파일을 lint에 추가한다.
- 공용 component나 CSS를 바꿨다면 관련 기존 consumer test도 실행한다.
- 무관한 전체 test failure가 있으면 숨기지 말고 이번 변경과의 관련 여부를 증거와 함께 분리한다.
- 테스트를 통과시키기 위해 접근성, 권한, 금전 안전성 검증을 삭제하거나 완화하지 마라.

UI 수정이 끝난 뒤 현재 환경에 Impeccable detector가 있으면 변경한 UI 파일을 대상으로 정확히 한 번만 실행한다.

```powershell
node "C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs" --json "apps/admin_web/app/customers/[id]/page.tsx" "apps/admin_web/app/customers/[id]/customer-booking-operation-board.tsx" "apps/admin_web/app/globals.css"
```

detector 결과는 맹목적으로 따르지 말고 대상 페이지에서 실제 재현되는 항목만 처리한다.

## 브라우저 검증 시나리오

로그인된 in-app browser 세션이 있으면 그 세션을 사용한다. 브라우저를 새로 로그인시키거나 사용자 세션을 지우지 마라.

검증 viewport:

- 1440×900 light
- 1600×900 light
- 1440×900 dark는 warning/muted contrast 확인에만 사용

확인 순서:

1. 기본 진입에서 고객명, open action/history signal, `2 active bookings`, 가장 진행된 예약을 확인한다.
2. `View active bookings`가 Recent bookings Live 상태로 연결되는지 확인한다.
3. Recent bookings의 All/Live/Completed/Cancelled 결과가 맞는지 확인한다.
4. 여섯 번째 예약까지 별도 page 이동 없이 보이는지 확인한다.
5. 1440과 1600에서 네 metric card와 `Outcome` 열이 잘리지 않는지 확인한다.
6. `View all bookings`가 이 고객 ID로 실제 필터링되는지 확인한다.
7. `Open payments`가 이 고객 payment records로 실제 필터링되는지 확인한다.
8. money label의 Current/All-time/Latest 6 범위를 확인한다.
9. 0건 Referral/Notification/Notes가 compact state인지 확인한다.
10. chat room 4개가 한 compact list에 있고 각 링크 이름이 구분되는지 확인한다.
11. Financial adjustment는 Review까지만 진행해 1440px field clipping과 Before/Change/After를 확인한다. Apply하지 마라.
12. Add note는 빈 form과 labels만 확인하고 저장하지 마라.
13. console error, hydration warning, network error가 없는지 확인한다.

수정 후 스크린샷은 다음처럼 별도 폴더에 저장한다.

```text
output/customer-detail-post-implementation-audit-2026-08-07/post-fix/
```

최소 캡처:

- `01-top-1440.jpg`
- `02-recent-bookings-1440.jpg`
- `03-recent-bookings-1600.jpg`
- `04-money-and-adjustment-1440.jpg`
- `05-retained-records-1440.jpg`
- `06-top-dark-1440.jpg`

## 금지 사항

- 보고서나 계획만 다시 작성하고 종료하지 마라.
- 1024px 이하 또는 모바일 대응으로 작업 범위를 넓히지 마라.
- latest 6을 all-time 또는 current filter result처럼 표시하지 마라.
- 활성 예약 한 건만 대표하고 나머지를 숨기지 마라.
- 잘못된 query parameter를 새 API가 읽게 만들어 증상을 덮지 마라. 이미 존재하는 booking/payment filter 계약을 사용하라.
- 예약 표 문제를 수평 스크롤이나 viewport 밖 overflow로 숨기지 마라.
- bounded preview count를 전체 count처럼 표시하지 마라.
- 외부 URL을 허용하는 `returnTo`를 만들지 마라.
- 실제 메모, 푸시, 지갑 write를 브라우저에서 실행하지 마라.
- 일반 customer detail 응답에 raw session 진단 정보를 추가하지 마라.
- 새 디자인 시스템, 새 탭 프레임워크, 새 state library, 새 table package를 도입하지 마라.
- 관련 없는 관리자 페이지를 함께 리디자인하지 마라.
- 요청받지 않은 commit, push, deployment를 하지 마라.

## 최종 수용 기준

아래 항목이 모두 충족돼야 완료다.

- 상단이 fixture의 활성 예약 2건을 `2 active bookings`로 표시한다.
- In service가 Matching보다 높은 운영 우선순위로 보인다.
- `View all bookings`가 실제로 이 고객의 all-time booking records로 필터링된다.
- `Open payments`가 실제로 이 고객의 payment records로 필터링된다.
- 1440×900에서 네 booking metric card와 `When / Service & Partner / Money / Outcome`이 모두 보인다.
- 1600×900에서도 Outcome 텍스트와 네 번째 metric card가 잘리지 않는다.
- latest 6 summary에 `All records`, `Current filters`가 나타나지 않는다.
- 서로 다른 예약·채팅 링크의 accessible name이 서로 다르다.
- note/push/wallet action redirect가 유효한 고객 검색 `returnTo`를 보존한다.
- recent booking 6건과 chat room 4~6개를 보기 위해 Page 2가 필요 없다.
- Current wallet, All-time payments, Latest 6 money가 문구로 구분된다.
- notifications/reviews/referrals/notes 등 bounded list가 total처럼 보이지 않는다.
- 0건 Referral/Notification/Notes가 중복 badge와 큰 empty card를 만들지 않는다.
- heading 구조가 `h1 → h2 → h3` 순서다.
- Financial adjustment 입력값이 1440px에서 잘리지 않는다.
- 이전에 완료된 API 오류 처리, safe session summary, diagnostics gate, push unavailable, wallet review/idempotency, chat disclosure가 회귀하지 않는다.
- 관련 테스트, typecheck, lint가 통과한다.
- 1440×900과 1600×900 실제 브라우저 캡처로 주요 acceptance criteria를 확인한다.

완료할 수 없는 항목이 있으면 조용히 생략하지 말고 **정확한 blocker, 확인한 증거, 남은 최소 작업**을 최종 보고에 적는다.

## 최종 보고 형식

작업을 마친 뒤 다음 순서로 간결하게 보고하라.

1. 운영자 관점에서 달라진 결과.
2. P1/P2/P3별 완료·미완료 상태.
3. 변경한 파일과 각 파일의 역할.
4. API 응답 계약 변경 및 민감 정보·금전 안전성 보존 방식.
5. 실행한 명령과 pass/fail/skipped 결과.
6. 1440/1600 브라우저 검증 결과와 post-fix 스크린샷 경로.
7. 제품 소스 외에 건드린 파일과 protected area 여부.
8. 남은 위험과 다음 한 가지 작업.

---

## 구현 판단의 핵심

- 가장 먼저 잘못된 링크와 숨겨진 active booking을 고친다.
- 기존 query/filter 계약과 디자인 컴포넌트를 재사용한다.
- 6건 데이터를 위한 pagination과 0건을 위한 큰 카드는 삭제하는 쪽을 우선한다.
- 공용 CSS를 재설계하지 말고 고객 상세의 1480px 상속만 끊는다.
- 추가 API는 운영상 total이 정말 필요한 경우에만 만든다. 범위 라벨로 정직해질 수 있으면 라벨을 고친다.
- 시각적 미세 조정보다 데이터 범위, 대상 식별, 금전·복귀 안전성을 우선한다.
