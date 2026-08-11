# Codex 실행 프롬프트 — Closeout operations 2차 정밀 보정

아래 `MASTER PROMPT` 전체를 새 Codex 작업에 붙여 넣는다. 작업 폴더는 반드시 `C:\dev\massage-on-demand-vn`으로 연다. 계획만 작성하지 말고 같은 작업에서 코드 수정, 테스트, 로그인된 실제 화면 검증까지 완료한다.

이번 프롬프트의 제품 결정은 이미 운영 관점에서 확정됐다. 구현 중 같은 결정을 다시 질문하거나 대체 대시보드를 제안하지 않는다. 다만 실제 코드·데이터가 아래 전제와 충돌해 금전 오처리 위험이 생기는 경우에는 변경을 멈추고 근거를 보고한다.

---

# MASTER PROMPT

## 역할과 목표

너는 HANDS 관리자 웹의 운영 UX와 금융 closeout 로직을 함께 수정하는 시니어 엔지니어다.

`C:\dev\massage-on-demand-vn`의 관리자 페이지 `http://localhost:3101/bookings/completed`를 수정하라. 이번 작업은 시각적 미화가 아니라 **큐의 포함 사유, 행에 표시되는 금융 증거, 다음 행동을 정확히 일치시키는 2차 보정**이다.

운영자는 목록에서 다음을 오해 없이 판단할 수 있어야 한다.

1. 이 예약이 왜 현재 큐에 들어왔는가?
2. 고객 결제, Partner earning, 플랫폼 수수료, 세금, wallet 중 실제 예외는 무엇인가?
3. 지금 해야 할 검토 행동은 무엇인가?
4. 작업 큐와 단순 이력 중 어느 쪽인가?
5. 큐 숫자를 처리해서 실제로 줄일 수 있는가?

핵심 원칙은 다음 한 줄이다.

> Inclusion reason → retained finance evidence → one accurate review action

## 사용할 작업 방식

- 먼저 저장소의 `AGENTS.md`를 읽고 단일 에이전트로 작업한다.
- `impeccable` 스킬이 있으면 현재 관리자 UI를 더 추가하는 용도가 아니라 정보 위계, 문구, 대비, 밀도 검수에 사용한다.
- 로그인된 세션을 유지할 수 있는 browser control을 사용해 실제 화면을 검증한다.
- 작업 전 `git status --short`를 확인하고 사용자의 기존 dirty worktree를 그대로 보존한다.
- 관련 함수의 모든 caller를 `rg`로 확인한 뒤 가장 작은 공통 원인을 수정한다.
- 구현·테스트·브라우저 검증까지 같은 작업에서 끝낸다.

## 반드시 먼저 읽을 자료

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. 감사 보고서:
   - `C:\dev\massage-on-demand-vn\output\completed-improvement-verification-2026-08-07\completed-post-implementation-deep-audit.md`
3. 같은 폴더의 핵심 화면 증거:
   - `01-default-today-1440.png`
   - `04-last-month-filters-1440.png`
   - `06-payment-table-1440.png`
   - `08-refund-review-table-1440.png`
   - `10-payment-table-1600.png`
   - `12-custom-dates-error-1440.png`
   - `13-payment-table-dark-1440.png`

보고서의 파일·라인 번호는 출발점일 뿐이다. 현재 코드가 바뀌었을 수 있으므로 실제 호출 경로와 테스트를 다시 확인한다.

## 현재 검증된 핵심 결함

### 배포 차단 결함

현재 `Payment ops`에는 다음 행이 포함된다.

```text
CASH / CAPTURED / 400.000 VND
Partner earning PENDING / -80.000 VND
Fee recorded / Tax recorded / Wallet recorded
Gateway ref missing
Release 또는 Review payment hold
```

이 행의 실제 예외는 현금 예약의 Partner commission debt인데, 화면은 gateway reference와 payment hold 문제로 설명한다. 운영자가 잘못된 금융 행동을 선택할 수 있으므로 가장 먼저 수정한다.

### 구조 결함

- `Expired 1084`는 미해결 업무가 아니라 `status = EXPIRED`인 모든 이력을 warning 작업처럼 보여준다.
- 이미 payment가 `RELEASED` 또는 `REFUNDED`여도 `Customer notice check`가 생성된다.
- notice 확인을 저장하거나 resolved 처리하는 상태가 없어 이 큐는 구조상 0으로 줄일 수 없다.
- completed route 기본 view는 `closeout`인데 primary chip은 `payment`여서 active queue가 숨겨진다.
- `Payment ops 988`, `Refund review 949`, `Cash debt 39`가 겹치지만 상위 집합 관계가 이름에 드러나지 않는다.
- 1440px에서 table wrapper보다 table이 68px 넓어 `Next action`이 잘린다.

## 반드시 보존할 정상 동작

아래 항목은 이미 잘 구현됐다. 다시 작성하거나 다른 방식으로 교체하지 않는다.

- Custom dates 미입력, invalid, 역전 날짜, 90일 초과의 UI/API 차단
- terminal event 기준 기간, waiting age, 정렬 SQL의 공유 정의
- `completed-pricing`의 COMPLETED-only 조건
- historical 화면에서 realtime socket 상태를 표시하지 않는 동작
- 검색 결과 없음 문구와 `Reset filters`
- closeout 표의 6개 정보 묶음
- page size 25와 서버 페이지네이션
- booking detail의 `returnTo`와 finance deep anchor
- 고객·Partner 전화번호 masking
- light/dark theme 기본 구조

정상 동작을 보존하는 기존 helper와 컴포넌트를 우선 재사용한다. 새 UI/table/state 라이브러리를 도입하지 않는다.

## 확정된 제품 결정

아래 결정은 다시 질문하지 말고 그대로 구현한다.

1. route는 `/bookings/completed`를 유지한다.
2. query/API 호환을 위해 내부 view 값 `payment`, `cash-debt`, `refund-review`, `closeout`, `pricing`, `expired`, `all`을 유지한다. 새로운 view id를 만들지 않는다.
3. 사용자에게 보이는 `Payment ops`는 `All payment exceptions`로 변경한다.
4. `payment` view는 cash commission, refund mismatch, unresolved authorization, 실제 payment release 예외를 포함하는 상위 집합으로 유지한다.
5. completed route의 고정 기본 view는 `payment`다. 현재 건수에 따라 default를 동적으로 바꾸지 않는다.
6. `Expired`는 action queue가 아니라 neutral history인 `Expired records`다.
7. unresolved expired payment는 기존 `All payment exceptions`에서 처리한다. notification delivery failure와 persisted resolution fact가 없는 상태에서 별도 고객 알림 작업 큐를 만들지 않는다.
8. `all`은 `Terminal records` history다.
9. 사용자 문구는 영어로 유지하며 `Provider`가 아니라 `Partner`를 사용한다.
10. 목록의 action은 mutation 버튼이 아니라 booking detail의 retained evidence로 이동하는 검토 링크다. 실제 동작보다 강한 성공·처리 완료 의미를 쓰지 않는다.

## 구현 요구사항

### 1. Payment 상위 큐의 reason/action truth table 수정 — P0

다음 파일을 시작점으로 모든 caller와 관련 helper를 확인한다.

- `apps/admin_web/app/bookings/booking-monitor-next-action-label.ts`
- `apps/admin_web/app/bookings/booking-monitor-list-row-model.ts`
- `apps/admin_web/app/bookings/booking-monitor-list-section.tsx`
- `apps/admin_web/app/bookings/booking-payment-closeout-facts.ts`
- `apps/api/src/admin/admin.service.ts`

`payment` view에서 issue와 primary action을 **같은 booking facts에서 결정**한다. 이미 존재하는 `bookingCashDebtNeedsOps()` 등 closeout fact helper를 재사용한다. 한 화면만을 위한 새 service/factory/state 계층은 만들지 않는다.

최소 truth table:

| Booking facts | Primary issue | Primary action | 금지 표시 |
|---|---|---|---|
| payment 없음 | `Payment missing` | `Review payment record` | 임의의 hold/release 단정 |
| non-CASH + `AUTHORIZED` + provider ref 없음 | `Gateway ref missing` | `Add gateway reference` | cash commission 문구 |
| non-CASH + `AUTHORIZED` + provider ref 있음 | `Payment authorized` | `Resolve authorization` | gateway ref missing |
| `CASH + PENDING` | `Cash status pending` | `Confirm cash status` | gateway ref missing |
| refund record 있음 + payment가 `REFUNDED` 아님 | `Refund mismatch` | `Review refund mismatch` | 일반 hold fallback |
| `CASH + CAPTURED` + negative/unpaid Partner earning | `Cash commission due` | `Settle cash commission` | gateway ref missing, release payment hold |
| expired + 실제 unresolved payment | `Payment release pending` | `Review payment hold` | customer notice를 근거 없이 생성 |
| API상 aggregate에 포함됐지만 UI가 구체 원인을 찾지 못함 | `Payment exception` | `Review payment exception` | `Release payment hold` 무조건 fallback |

추가 규칙:

- primary issue/action 우선순위는 구체적인 retained facts가 일반 fallback보다 앞서야 한다.
- 한 booking에 실제 원인이 여러 개면 issue chip은 최대 3개까지 모두 보여도 된다. primary action은 가장 구체적인 한 개만 보여준다.
- `Release payment hold` 또는 이에 준하는 문구는 실제 authorized/unresolved hold fact가 있을 때만 허용한다.
- API의 `completed-payment`가 `completed-cash-debt`를 포함하는 현재 제품 의도는 유지한다.
- API predicate, UI issue, UI action이 서로 다른 정의로 표류하지 않도록 기존 fact helper 수준에서 가능한 최소한으로 정렬한다. API/클라이언트 패키지를 새로 공유하려는 대형 리팩터링은 하지 않는다.

완료 기준:

- 감사 화면의 CASH/CAPTURED/negative earning 행에 `Cash commission due`와 `Settle cash commission`이 보인다.
- 같은 행에서 gateway ref missing과 payment hold action이 사라진다.
- 테스트가 이 조합을 고정한다.

### 2. CASH와 gateway reference 표시 규칙 수정 — P0

Payment 열 renderer를 수정한다.

- `payment.method === 'CASH'`이면 `Gateway ref missing`을 렌더링하지 않는다.
- CASH에는 gateway reference 행 자체를 숨기는 것을 우선한다. 디자인 정렬상 행이 반드시 필요하면 `Gateway reference · Not applicable`을 neutral copy로 사용한다.
- non-CASH에서 reference가 있으면 목록에는 전체 원문 대신 `Reference saved` 같은 짧은 상태를 표시한다. 원문은 기존 상세 화면에서 확인한다.
- non-CASH에서 실제 required reference가 없을 때만 missing 상태를 표시한다.

### 3. Expired를 작업이 아닌 이력으로 재분류 — P1

새 DB 필드나 resolved 상태를 만들지 않는다. 가장 작은 안전한 변경은 기존 `expired` view를 history로 명확히 낮추는 것이다.

- visible label: `Expired records`
- description: `Expired booking records closed in the selected period.`
- `RELEASED` 또는 `REFUNDED` payment를 가진 정상 expired row에 warning `Action`, `Customer notice check`, `Confirm customer notice`를 표시하지 않는다.
- expired history의 issue tone은 neutral이어야 한다.
- expired history의 마지막 열은 `Record` 성격으로 표시한다.
- link label은 `Open expired record` 또는 기존 detail-link 규칙에 맞춘 neutral `Review record`를 사용한다.
- unresolved payment가 있는 expired booking은 `All payment exceptions`에서 정확한 payment issue/action을 가진다.
- 단순 `status = EXPIRED`만으로 notification follow-up을 추론하지 않는다.
- `completed-expired` API predicate는 history 목록으로 유지할 수 있다. 별도의 action predicate를 새로 만들지 않는다.

완료 기준:

- 정상 release/refund된 expired row가 경고 작업처럼 보이지 않는다.
- 처리 불가능한 `Customer notice check` backlog가 사라진다.
- `Expired records`와 `Terminal records`는 neutral history로 구분된다.

### 4. completed 전용 queue 정보 구조와 기본 view 수정 — P1

generic booking queue 구조를 억지로 확장하지 말고, 현재 filters component 안에서 completed workspace에 필요한 가장 작은 분기와 기존 segmented/disclosure 컴포넌트를 재사용한다.

고정 구조:

```text
Needs action
[All payment exceptions] [Cash commission] [Refund mismatch]
[Closeout records] [Pricing]

History
[Expired records] [Terminal records]

[Show N empty checks]
```

규칙:

- 기본 view는 항상 `payment`다.
- 선택된 queue는 primary 영역에서 즉시 보여야 한다. active queue를 찾기 위해 `Additional queues`를 열게 하지 않는다.
- non-zero queue와 현재 active queue를 우선 표시한다.
- 0건의 비활성 action queue는 `Show N empty checks` disclosure 안에 둔다.
- `1 queue currently has no records`, `2 queues currently have no records`처럼 단수/복수를 정확히 처리한다.
- completed workspace에서 `Additional queues / Live flow, exceptions, and history` 문구를 사용하지 않는다.
- 필요한 disclosure 제목은 `Other closeout queues and records` 또는 위의 `Show N empty checks`로 제한한다.
- `All payment exceptions` 설명은 정확히 다음 의미를 전달한다.

```text
Includes cash commission, refund mismatch, unresolved authorization, and payment release exceptions.
```

- 겹치는 count 설명을 한 번만 표시한다.

```text
Counts overlap: All payment exceptions includes the cash and refund queues.
```

- 상위 historical summary badge와 queue chip이 같은 숫자를 중복 표시하지 않게 한다. completed route에서는 queue chip/count를 단일 navigation source로 사용한다.
- 다른 booking workspace의 `Additional queues`, live flow, exception directory 구조는 변경하지 않는다.

완료 기준:

- `/bookings/completed?dateRange=30d`에서 selected chip과 result title이 모두 `All payment exceptions`를 가리킨다.
- active queue가 disclosure 안에 숨지 않는다.
- action queue와 history가 색과 그룹으로 구분된다.
- 서로 겹치는 숫자를 합산 가능한 독립 KPI처럼 보이게 하지 않는다.

### 5. 금융 문구를 운영 언어로 정리 — P1

다음 문구를 수정한다. 공유 helper를 바꾸기 전 모든 caller를 확인하고, 다른 booking route에 회귀가 생기지 않는 가장 작은 위치에서 고친다.

1. `Customer price · Customer price 400.000 VND`
   - prefix가 한 번만 보이게 한다.
2. `Minimum 300.000 VND`
   - pricing view에서만 `Catalog minimum 300.000 VND`로 표시한다.
   - 다른 closeout queue에서는 minimum 정보를 숨긴다.
3. `Earning PENDING · -80.000 VND`
   - cash debt fact가 참이면 기존 cash settlement helper를 재사용해 `Partner owes HANDS 80.000 VND`처럼 방향이 분명한 문구로 표시한다.
   - 일반 earning 상태는 기존 표시를 유지한다.
4. action helper
   - 링크가 상세 검토로 이동한다는 점을 `Open booking finance evidence...` 또는 현재 detail action 패턴에 맞는 문구로 밝힌다.
   - 실제 mutation을 실행하는 것처럼 쓰지 않는다.
5. CASH에는 gateway missing copy를 사용하지 않는다.

### 6. 1440px table overflow 제거 — P1

현재 closeout table은 1440px 화면에서 wrapper 1052px, table 1120px로 68px overflow가 발생한다. 새로운 카드 레이아웃이나 table 라이브러리는 필요 없다.

- closeout operations table에 한해 강제 `min-width: 1120px`을 제거한다.
- table은 available container에 맞춰 `width: 100%`로 들어가야 한다.
- 6개 열의 정보 그룹은 유지한다.
- `Partner · Closeout`과 `Next action`은 필요한 범위에서 폭을 줄이고 자연스러운 줄바꿈을 허용한다.
- primary action link는 잘리거나 ellipsis로 숨지 않아야 한다.
- helper는 최대 2줄 정도로 유지하되 접근 가능한 전체 의미는 보존한다.
- 긴 gateway reference 원문을 목록에서 제거해 폭을 확보한다.
- shared `.admin-table` 전체에 광범위한 회귀를 만들지 말고 completed closeout scope selector를 사용한다.

합격 조건:

- 1440×900에서 closeout table scroll container의 `scrollWidth - clientWidth`가 0이다.
- `Next action` 링크가 가로 이동 없이 읽힌다.
- 1600×900에서도 열 비율과 정렬이 안정적이다.

### 7. 첫 화면 밀도와 중복 summary 정리 — P2

더 많은 카드나 KPI를 추가하지 않는다.

- `BookingCompletedCloseoutSection`의 raised `AdminDisclosureCard`를 기존 compact `AdminDisclosure` 한 줄로 바꾸거나 같은 수준의 기존 compact pattern을 재사용한다.
- 도움말 내용은 삭제하지 않되 기본 닫힘 상태로 둔다.
- historical summary와 queue count가 중복되면 completed caller에서 summary를 비우거나 렌더링을 생략한다. 다른 historical route에 필요한 summary는 보존한다.
- page title, historical/data-class status, queue navigation, 검색·기간·waiting·sort 필터, result header의 순서가 명확해야 한다.
- 1440×900에서 result header와 첫 row 상단이 첫 viewport 안에 보여야 한다.

### 8. Custom dates의 시각 라벨과 오류 배치 보정 — P2

현재 validation 로직은 그대로 재사용한다.

- `AdminFormDate`와 관련 CSS를 확인해 `Start date`, `End date`가 화면에 실제로 보이게 한다.
- 같은 input에 label을 중복 생성하지 않는다.
- error message는 두 날짜 입력 아래의 고정된 full-width row에 둔다.
- 오류가 나타나도 Apply 버튼이 갑자기 다음 줄 전체 폭으로 이동하거나 form 높이가 크게 뛰지 않게 한다.
- 기존 `role="alert"`, `aria-describedby`, required, query parameter 보존을 유지한다.

### 9. 상태 색·대비·historical data-class 신뢰 보정 — P2

- 0건 queue는 warning orange를 사용하지 않는다. neutral 또는 success로 표시한다.
- 실제 미해결 action count만 warning/danger tone을 사용한다.
- `Expired records`와 `Terminal records`는 neutral history tone을 사용한다.
- active purple 배경과 일반 크기 흰 텍스트의 대비를 4.5:1 이상으로 조정한다.
- light/dark theme에서 같은 상태 의미를 유지한다.
- historical branch에서도 API의 명시적 `dataClass`/test fact를 사용해 compact 상태를 표시한다.
  - test/audit fact가 보이면 `Audit fixtures visible`
  - production에서 제외됐으면 `Production data · Test data excluded`
- customer name에 `Demo`가 있다는 이유로 fixture를 추측하지 않는다.
- historical status를 추가하면서 제거한 중복 summary만큼의 세로 공간을 다시 소비하지 않는다.

## 주요 코드 후보

아래 파일은 시작점이다. 현재 코드와 caller를 확인하고 실제 원인을 해결하는 최소 파일만 변경한다.

- `apps/admin_web/app/bookings/booking-monitor-page.tsx`
- `apps/admin_web/app/bookings/booking-monitor-options.ts`
- `apps/admin_web/app/bookings/booking-monitor-filters-section.tsx`
- `apps/admin_web/app/bookings/booking-monitor-list-row-model.ts`
- `apps/admin_web/app/bookings/booking-monitor-next-action-label.ts`
- `apps/admin_web/app/bookings/booking-monitor-list-section.tsx`
- `apps/admin_web/app/bookings/booking-monitor-live-status-section.tsx`
- `apps/admin_web/app/bookings/booking-completed-closeout-section.tsx`
- `apps/admin_web/app/bookings/booking-payment-closeout-facts.ts`
- `apps/admin_web/lib/booking-service-list-labels.ts`
- `apps/admin_web/app/globals.css`
- `apps/api/src/admin/admin.service.ts`

관련 spec과 caller가 다른 경로에 있으면 `rg` 결과를 따른다. 이 목록의 파일을 모두 수정할 필요는 없다.

## 구현 제약

- `AGENTS.md`를 따른다.
- 단일 에이전트로 작업한다.
- 기존 dirty worktree를 되돌리거나 정리하지 않는다.
- 새 dependency, UI library, table library, state library를 설치하지 않는다.
- DB schema와 migration을 추가하지 않는다.
- payment/refund/settlement mutation을 수정하지 않는다.
- API 변경이 필요하면 관리자 read predicate와 summary/list 일치 범위에만 제한한다.
- customer app과 Partner app을 수정하지 않는다.
- `returnTo`, booking detail anchor, phone masking을 보존한다.
- terminal timestamp SQL과 custom date validation을 복제하거나 재작성하지 않는다.
- 테스트 assertion을 삭제·완화해 통과시키지 않는다.
- 새 디자인 시스템, 새 대시보드, 새 도메인 추상화는 만들지 않는다.
- 보고서 PNG를 앱 asset으로 복사하지 않는다.
- 요청받지 않은 commit은 만들지 않는다.

## 테스트 요구사항

변경한 동작마다 가장 가까운 기존 spec을 수정한다. production abstraction을 테스트 편의 때문에 만들지 않는다.

### Admin Web 필수 회귀 테스트

#### `booking-monitor-next-action-label.spec.ts`

최소 cases:

- CASH + CAPTURED + negative/unpaid earning + payment view → `Settle cash commission`
- CASH + PENDING → `Confirm cash status`
- non-CASH + AUTHORIZED + no ref → `Add gateway reference`
- non-CASH + AUTHORIZED + ref → `Resolve authorization`
- refund mismatch → `Review refund mismatch`
- expired + unresolved payment in payment view → 실제 hold review
- API aggregate에 들어왔지만 구체 원인이 없는 defensive case → `Review payment exception`
- released/refunded expired history → customer notice action 없음

#### `booking-monitor-list-row-model.spec.ts`

- payment aggregate에서 cash debt issue chip 표시
- CASH에서 gateway missing issue를 만들지 않음
- expired released/refunded row는 neutral record reason
- aggregate에 원인이 여러 개면 최대 3개까지 deterministic order

#### `booking-monitor-list-section.spec.tsx`

- CASH renderer에 `Gateway ref missing` 없음
- non-CASH saved reference는 compact copy
- customer price prefix 1회
- cash debt의 `Partner owes HANDS ...` 방향성
- expired history의 마지막 열은 warning action이 아니라 record

#### `booking-monitor-filters-section.spec.tsx`

- completed default/primary grouping
- active completed queue가 disclosure 안에 숨지 않음
- `All payment exceptions` 이름과 overlap 설명
- zero queue의 neutral/success tone
- `1 queue`와 `2 queues` 단수·복수
- 다른 live booking workspace의 Additional queues 구조 보존

#### `booking-monitor-live-status-section.spec.tsx`

- historical realtime 문구 없음
- historical data-class/test badge 표시
- completed summary 중복 제거 방식 검증

#### Custom date 관련 기존 spec

- 기존 invalid/reversed/90-day validation assertions를 그대로 통과시킨다.
- visible `Start date`, `End date`와 stable error row만 추가 검증한다.

#### CSS contract 또는 component test

- completed table에 container를 강제 초과하는 1120px minimum이 없음
- active control color contrast target이 문서화되거나 token test로 고정됨

### API 필수 회귀 테스트

`apps/api/src/admin/admin.service.spec.ts`의 completed 관련 테스트에서 다음을 명시한다.

- `completed-payment`가 cash debt를 포함하는 것이 의도된 상위 집합임
- summary와 list가 같은 predicate를 사용함
- `completed-expired`는 terminal history이며 단순 status predicate를 유지할 수 있음
- unresolved expired payment는 payment exception predicate에서 누락되지 않음

API production 코드 변경이 필요하지 않다면 테스트만으로 현재 계약을 고정하고 억지로 코드를 수정하지 않는다.

## 테스트 실행

우선 변경 부근의 focused spec을 실행한다. 실제 파일명을 `rg --files`로 확인한 뒤 아래 형태로 실행한다.

```powershell
npm.cmd exec --workspace @massage-vn/admin-web -- vitest run --config vitest.config.mts <관련 admin spec 파일들>
npm.cmd exec --workspace @massage-vn/api -- vitest run --config vitest.config.mts src/admin/admin.service.spec.ts -t "completed"
```

그다음 scope 검증을 반드시 시도한다.

```powershell
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

현재 감사 시점의 baseline 참고:

- Admin Web 관련 8개 spec: 83/83 통과
- API completed 관련 spec: 10/10 통과
- API의 더 넓은 두 spec 실행: 556개 중 555 통과, 1개 기존 실패
- 기존 실패: `builds booking monitor totals from database counts instead of the current page`
- 기존 원인: test mock에 `operationalPolicySetting.findUnique`가 없음

이 baseline을 면죄부로 사용하지 않는다. 같은 실패가 재현되면 이번 변경과의 관련성을 확인해 구분 보고한다. 관련 없는 mock 실패를 숨기려고 production 코드나 assertion을 왜곡하지 않는다.

## 실제 브라우저 검증

코드 테스트만으로 완료하지 않는다. 로그인된 브라우저에서 `http://localhost:3101/bookings/completed`를 직접 조작하고 새 증거 폴더에 캡처한다.

검증 화면은 다음 두 크기만 사용한다.

- 1440×900
- 1600×900

필수 상태:

1. light theme 기본 진입
2. Last month + All payment exceptions
3. Cash commission
4. Refund mismatch
5. Expired records
6. Terminal records
7. 검색 결과 없음과 Reset filters
8. Custom dates 미입력 오류
9. dark theme All payment exceptions

필수 상호작용:

- 기본 URL에서 active chip과 result title 일치
- action/history queue 선택
- empty checks disclosure 열기·닫기
- search 제출과 reset
- custom date 오류 후 수정·정상 적용
- first/next/last pagination
- primary action을 눌러 booking detail finance anchor와 `returnTo` 확인

브라우저 합격 기준:

- CASH/CAPTURED/negative earning 행에 `Cash commission due`와 `Settle cash commission`이 보인다.
- 같은 행에 `Gateway ref missing`, `Release payment hold`, 일반 hold fallback이 없다.
- normal RELEASED/REFUNDED expired row에 `Customer notice check` warning action이 없다.
- selected queue가 primary 영역에서 보이며 result title과 같다.
- count overlap 설명이 한 번만 보인다.
- 0건 queue가 warning orange가 아니다.
- 1440×900과 1600×900에서 table horizontal overflow가 0이다.
- 1440×900 첫 viewport 안에 result header와 첫 row 상단이 보인다.
- action link, 긴 copy, 금액이 잘리거나 겹치지 않는다.
- active control 텍스트 대비가 4.5:1 이상이다.
- light/dark theme에서 상태 의미가 같다.
- Custom dates에 `Start date`, `End date`가 실제로 보이고 오류 발생 시 layout jump가 작다.
- historical data-class/test 상태가 이름 추측 없이 표시된다.
- 다른 booking routes의 live queue navigation이 회귀하지 않는다.

DOM 측정값을 최종 보고에 포함한다.

```text
viewport width
table clientWidth
table scrollWidth
horizontal overflow
result header top
first row top
active control foreground/background colors와 contrast ratio
```

캡처는 기존 감사 증거를 덮어쓰지 말고 새 폴더에 저장한다.

```text
output/completed-remediation-verification-YYYY-MM-DD/
```

## 완료 조건

다음이 모두 충족되기 전에는 완료라고 보고하지 않는다.

1. payment aggregate의 CASH debt reason/action이 실제 facts와 일치한다.
2. CASH에 gateway reference missing이 보이지 않는다.
3. generic payment hold fallback이 제거되고 실제 hold에서만 hold review가 나온다.
4. Expired는 neutral history이며 처리 불가능한 customer notice 작업이 없다.
5. 기본 view, selected chip, result title이 `All payment exceptions`로 일치한다.
6. action queue와 history가 구분되고 overlap 관계가 설명된다.
7. 1440×900 table overflow가 0이고 Next action이 보인다.
8. first viewport에 result header와 첫 row 상단이 보인다.
9. 금융 문구 중복·방향성·gateway copy가 수정된다.
10. Custom date 기존 validation을 보존하면서 시각 라벨과 오류 배치가 개선된다.
11. active contrast가 4.5:1 이상이고 dark theme 의미가 유지된다.
12. historical data-class 상태가 명시적 fact로 표시된다.
13. 관련 unit tests와 admin/api scope 검증을 시도하고 결과를 기록한다.
14. 새 dependency, migration, mutation 변경이 없다.
15. 사용자의 기존 변경과 다른 booking workspace를 보존한다.
16. 최종 diff를 검토해 불필요한 추상화와 중복 로직이 없는지 확인한다.

## 최종 보고 형식

다음 순서로 짧고 증거 중심으로 보고한다.

1. 운영자 관점의 결과
2. 변경 파일
3. payment truth table과 Expired 재분류 결과
4. queue IA·문구·1440 table 결과
5. 브라우저 캡처 경로와 DOM 측정값
6. 실행한 명령과 pass/fail/skipped
7. 보호 영역 변경 여부
8. 남은 위험 또는 검증하지 못한 항목
9. commit을 만들지 않았으면 `Not committed`

계획이나 제안만 제출하지 말고 구현, 테스트, 브라우저 검증까지 완료하라.
