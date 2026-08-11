# Codex 구현 프롬프트 — Payment Clearing / Bank Reconciliation 운영 흐름 개선

아래 프롬프트 전체를 `C:\dev\massage-on-demand-vn`에서 실행하는 새 Codex 작업에 그대로 붙여 넣어라.

---

## 목표

`/finance-tax/payment-clearing`을 단순 현황·담당자 배정 화면에서 실제 운영자가 미매칭 결제 증빙을 찾고, 올바른 은행 거래와 안전하게 연결하고, 결과와 감사 기록까지 확인할 수 있는 운영 흐름으로 개선하라.

핵심 결과는 다음과 같아야 한다.

1. 30일보다 오래되거나 50번째 이후에 있는 payment-clearing record도 Bank Reconciliation에서 검색하고 연결할 수 있다.
2. `OPEN`뿐 아니라 `PARTIALLY_CLEARED` record의 remaining amount도 후속 match가 가능하다.
3. payment-clearing evidence와 bank transaction의 통화·금액뿐 아니라 `INFLOW/OUTFLOW` 방향을 서버가 최종 검증한다.
4. 담당자 배정은 notification 전달 실패와 무관하게 실제 성공/실패 결과를 정확히 반환한다.
5. Payment Clearing 목록, 상세, Bank Reconciliation 사이에서 필터·페이지·대상 문맥이 유지된다.
6. 운영자가 booking/payment/clearing ID로 검색하고, owner와 evidence 상태를 파악하고, 한 흐름 안에서 `Review and match`를 수행할 수 있다.

계획만 작성하고 멈추지 말고, 현재 코드와 도메인 규칙을 확인한 뒤 안전한 범위에서 구현·테스트·브라우저 검증까지 완료하라.

## 반드시 먼저 읽을 자료

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\output\payment-clearing-audit-2026-08-08\payment-clearing-deep-audit-report.md`
3. 다음 현재 구현과 인접 테스트
   - `apps/admin_web/app/finance-tax/payment-clearing/page.tsx`
   - `apps/admin_web/app/finance-tax/payment-clearing/[id]/page.tsx`
   - `apps/admin_web/app/finance-tax/bank-reconciliation/page.tsx`
   - `apps/admin_web/app/finance-tax/bank-reconciliation/[id]/page.tsx`
   - `apps/admin_web/app/finance-tax/tax-settlement-page-model.ts`
   - `apps/api/src/admin/admin-ledger.routes.ts`
   - `apps/api/src/admin/admin.service.ts`
   - 관련 Admin Web/API spec

`AGENTS.md`에 따라 반드시 single-agent로 작업하고 subagent나 별도 worker를 만들지 마라.

작업 시작 전 `git status --short`와 관련 diff를 확인하고 사용자의 기존 변경을 덮어쓰지 마라. 보고서의 파일명이나 코드 위치가 바뀌었다면 실제 코드와 테스트를 source of truth로 사용하되, 아래 금융 불변식과 운영 목표를 약화시키지 마라.

## 현재 확인된 운영 데이터와 문제

감사 시점의 전체 기간 상태:

- Total records: 148
- Needs action: 108
- Open exposure: 36,800,000 VND
- Over 48h: 106
- Oldest: 59 days
- Unassigned: 108
- Partially cleared: 0
- Cleared: 0
- Reversed: 40

현재 주요 원인:

- Payment Clearing 기본 범위가 Today라 실제 backlog가 0처럼 보인다.
- Bank Reconciliation detail이 payment-clearing candidate를 `range=30d`, `review=open`, `take=50`으로 고정 조회한다.
- Payment Clearing detail의 Back link는 현재 목록 문맥이 아니라 `30d/open/25 rows/page 1`로 고정된다.
- `Match bank transaction`은 실제 동작이 아닌 텍스트다.
- API의 payment-clearing source validation은 status와 currency는 확인하지만 bank direction을 확인하지 않는다.
- assignment audit를 기록한 후 notification을 생성하므로 notification 실패가 이미 성공한 assignment를 실패처럼 보이게 할 수 있다.
- `shortId(sourceKey)` 때문에 row와 checkbox가 모두 `booking-`처럼 표시된다.

## 범위와 안전 경계

- 대상은 1440px 이상 데스크톱 관리자 화면이다.
- 1024px 이하 반응형·모바일 개선은 이번 작업 범위에서 제외한다.
- 기존 dark/light theme, 디자인 토큰, Admin 컴포넌트를 재사용한다.
- 브라우저 검증 중 실제 운영 데이터에 assignment, bank match, reversal 등 금융 mutation을 실행하지 마라. mutation은 테스트 fixture 또는 격리된 개발 데이터로 검증한다.
- 결제·정산·은행 매칭·원장·감사 기록의 기존 불변식을 약화시키지 마라.
- 기존 URL을 즉시 삭제하지 말고 호환 redirect 또는 legacy deep-link로 유지한다.
- 기존 공개 API를 불필요하게 깨지 마라. 새 응답 필드는 가능하면 additive하게 추가한다.
- 새로운 DB schema/migration이 꼭 필요하지 않다면 만들지 마라. 필요하다면 기존 outbox/audit/notification 패턴을 먼저 찾아 재사용하고 `AGENTS.md`의 protected-area 검증을 적용한다.
- 화면 문구 변경만으로 금융 안전 문제를 해결했다고 처리하지 마라. 최종 방어는 서버에서 수행한다.
- 관련 없는 대규모 refactor, 신규 UI 라이브러리, 새로운 상태 관리 라이브러리는 추가하지 마라.

## P0 — 반드시 먼저 해결

### P0-1. Payment-clearing candidate 조회를 고정 30일·50건 목록에서 검색 가능한 서버 query로 교체

현재 Bank Reconciliation detail의 다음 하드코딩을 제거하라.

```ts
buildBookingPaymentClearingApiHref({
  page: 1,
  range: '30d',
  review: 'open',
  take: 50,
})
```

요구사항:

- 현재 bank transaction을 기준으로 eligible payment-clearing candidates를 서버가 조회한다.
- 적합한 기존 endpoint를 확장하거나 목적이 명확한 candidate endpoint를 추가한다.
- `OPEN`과 `PARTIALLY_CLEARED`를 포함한다.
- 30일 제한을 제거하되 unbounded 전체 로딩은 하지 않는다.
- server-side search와 pagination을 제공한다.
- 검색 대상:
  - clearing entry ID
  - booking ID
  - payment ID
  - source key
- candidate 응답에 최소 다음을 제공한다.
  - entry ID, booking/payment ID
  - type/status
  - original amount
  - matched amount
  - authoritative remaining amount
  - currency
  - occurredAt/age
  - expected bank direction
  - eligibility 또는 제외 사유
- currency, direction, remaining amount, status가 맞지 않는 candidate는 선택할 수 없게 하되 제외 이유를 확인할 수 있어야 한다.
- 금액 근접도·날짜·reference 관련 증거를 이용한 추천 순위가 기존 코드에 있으면 재사용한다.
- UI 추천 순위는 편의 기능일 뿐이며 server validation을 대체하지 않는다.

완료 기준:

- 59일 된 OPEN record가 검색 결과에 나타난다.
- 50개 이후 record를 pagination/search로 찾을 수 있다.
- PARTIALLY_CLEARED record가 remaining amount와 함께 후보에 나타난다.
- REVERSED/CLEARED 또는 remaining 0 record는 신규 active match 후보가 아니다.

### P0-2. Payment clearing과 bank transaction 방향 검증

`validateBankReconciliationSource`의 payment-clearing 분기에 명시적 direction validation을 추가하라.

요구사항:

- clearing type, source semantics, amount sign을 기준으로 expected bank direction을 한 곳에서 결정한다.
- customer payment/settlement inflow evidence는 허용된 `INFLOW` bank transaction에만 연결한다.
- refund 또는 outflow evidence가 존재한다면 도메인 규칙에 맞는 `OUTFLOW`만 허용한다.
- 의미가 불명확한 legacy source는 추측해서 허용하지 말고 fail closed하거나 명시적 review state로 보낸다.
- 다음 검증을 같은 authoritative preflight에 모은다.
  - source status
  - bank transaction status
  - currency
  - direction
  - source remaining amount
  - bank remaining amount
- direct API 호출도 잘못된 조합을 만들 수 없어야 한다.
- 실패 메시지는 운영자에게 `Direction mismatch: this payment evidence expects an inflow`처럼 원인을 알려준다.

기존 Serializable transaction, over-allocation guard, maker-checker, audit log는 유지한다.

### P0-3. Assignment commit과 notification delivery의 결과 분리

현재 assignment source of truth인 audit log가 생성된 후 notification이 실패하면 API 전체가 실패하는 문제를 해결하라.

요구사항:

- assignment 성공 여부는 durable assignment/audit commit 결과로 결정한다.
- notification 실패가 성공한 assignment를 rollback된 것처럼 보이게 하지 않는다.
- 기존 notification outbox/durable event 패턴이 있으면 재사용한다.
- 없다면 최소한 assignment 성공 응답과 notification warning을 분리하고 retry 가능한 상태를 기록한다.
- 단건과 bulk에 같은 의미를 적용한다.
- 응답에는 다음 결과를 구조화해 포함한다.
  - assigned clearing IDs/count
  - unchanged count
  - assignment audit log IDs
  - notification delivered/failed count 또는 warning
- Admin Web은 `assignment succeeded, notification delivery needs retry`를 실패가 아닌 경고로 표시한다.
- 동일 요청 재시도 시 이미 배정된 record를 중복 성공처럼 세지 않는다.

## P1 — 운영 흐름과 정보 정확성

### P1-1. 기본 진입을 All unresolved로 변경

- `/finance-tax/payment-clearing` 기본값은 전체 기간의 unresolved queue를 보여준다.
- Today는 분석용 filter로 유지한다.
- Today 결과가 0이지만 다른 기간에 backlog가 있으면 cross-range 안내를 표시한다.
- 최초 화면에서 open exposure, over SLA, unassigned, oldest를 확인할 수 있어야 한다.

`normalizeDateRange`의 전역 기본값을 무작정 변경해 다른 관리자 화면을 깨지 말고 Payment Clearing scope에서 명시적으로 기본 범위를 정한다.

### P1-2. 목록·상세·reconciliation 문맥 보존

- canonical Payment Clearing list state를 정의한다.
  - review
  - owner
  - age
  - range
  - page
  - take
  - q
  - sort
- detail link에 검증된 same-origin `returnTo`를 전달하거나 detail drawer를 사용한다.
- `returnTo`는 `/finance-tax/payment-clearing` 내부 경로만 허용한다.
- 외부 URL, protocol-relative URL, 다른 admin route는 거절한다.
- Back/Cancel/Success/Error 후 exact filter/page state와 가능한 경우 선택 row focus를 복원한다.
- notification destination처럼 return context가 없는 진입에는 안전한 All unresolved fallback을 사용한다.

### P1-3. Payment Clearing을 action-complete하게 만들기

- detail의 plain text `Match bank transaction`을 primary action으로 바꾼다.
- 권장 문구: `Find matching bank transaction` 또는 `Open reconciliation case`.
- 이동 시 clearing entry ID, amount, currency, expected direction, occurredAt을 안전한 server-side context로 사용한다.
- Bank Reconciliation에서 candidate bank transactions 또는 현재 bank transaction의 candidate clearing 검색으로 이어진다.
- matching이 완료되면 Payment Clearing detail/list에서 status, matched amount, remaining amount, match/audit link를 즉시 확인할 수 있어야 한다.
- candidate가 없으면 빈 상태에 원인과 다음 행동을 표시한다.

### P1-4. Payment Clearing과 Bank Reconciliation의 운영 workspace 통합

논리적 데이터와 route는 유지하되 운영자의 상위 workspace는 다음 탭 구조로 통합하라.

1. `Bank transactions`
2. `Unmatched payment evidence`
3. `Partial matches`
4. `Cleared & reversed history`

구현 원칙:

- 현재 디자인 시스템의 tab/filter 패턴을 사용한다.
- `/finance-tax/payment-clearing` legacy route는 호환 deep-link로 유지한다.
- 사이드바에서 Bank Reconciliation과 Payment Clearing이 같은 업무를 중복 표현하지 않게 한다.
- navigation 변경이 다른 finance pages와 충돌하지 않는지 확인한다.
- 대규모 route rewrite보다 기존 page를 workspace tab으로 조합하는 최소 변경을 우선한다.

### P1-5. 검색·정렬·필터 개선

기본 화면 구성:

- Queue tabs: Needs bank match / Partially matched / Cleared / Reversed / All records
- Search: booking/payment/clearing/source ID
- Owner
- Sort: Oldest, Highest remaining amount, Recently updated
- Advanced filters: age, range, event type, payment method, rows

규칙:

- 기본값을 active chips로 반복하지 않는다.
- 사용자가 변경한 조건만 chip으로 표시한다.
- filter 변경 시 page는 1로 초기화한다.
- 다른 canonical state는 유지한다.
- 정렬은 pagination 전 서버에서 전역적으로 적용한다.

### P1-6. 목록의 식별자·선택·접근성

- `shortId(entry.sourceKey)`를 row identity나 checkbox label에 사용하지 않는다.
- 모든 checkbox accessible name을 고유하게 만든다.

예:

```text
Select payment clearing cmrj5gbx, booking cmq7vlpo, 400,000 VND
```

- `Select all visible`을 제공한다.
- selected count와 최대 50개 제한을 실시간으로 보여준다.
- 100 rows를 표시하면서 50개만 처리할 수 있는 경우 한도와 동작을 명확히 한다.
- `Settlement Posted` detail link와 `Open detail` 중복을 하나의 `Review and match` 동작으로 정리한다.
- `1423h`는 `59d 7h`로 표시하고 정확한 날짜는 보조 정보로 둔다.
- table의 주 동작이 수평 영역 끝에 숨어 있지 않도록 한다.

### P1-7. Detail과 owner context

Payment Clearing detail에 다음을 표시한다.

- current owner
- assigned at/by
- assignment reason
- relevant assignment history
- original amount
- matched amount
- authoritative remaining amount
- expected bank direction
- candidate availability
- last match/audit result

owner assignment dialog에는 다음 target context를 표시한다.

- booking/payment/clearing identifiers
- amount/currency
- event type
- age/SLA
- current owner
- evidence gap

새 owner를 자동 선택하지 말고 명시적으로 선택하게 한다. current → new owner를 before/after로 보여준다.

### P1-8. KPI 의미 수정

기본 KPI는 다음 네 개로 제한한다.

1. Open exposure
2. Over SLA / oldest
3. Unassigned
4. Terminal outcomes: Cleared / Reversed

- `Cleared ratio = cleared / all records`를 제거하거나 분모를 명시한다.
- 해결률이 필요하면 `(cleared + reversed) / total`과 상태별 count를 함께 보여준다.
- 긴 VND 금액이 card에서 잘리지 않게 한다.
- Unassigned와 Open이 같은 count일 때도 각 카드의 의미를 명확히 한다.

### P1-9. Payment fee evidence 레이아웃

- 존재하지 않는 `.admin-block` class에 의존하지 않는다.
- payment processing fee, method/rate/fixed amount, policy version, payer/treatment를 semantic definition list 또는 명확한 stack으로 렌더링한다.
- `Policy record missing`은 작은 연결 문구가 아니라 별도 warning/evidence gap으로 표시한다.
- raw enum `SETTLEMENT_POSTED`는 `Settlement posted`로 변환한다.
- technical record key와 enum은 secondary technical details로 내린다.

## P2 — 가능하면 함께 개선

- `retained evidence`, `clearing row` 같은 내부 용어를 운영자 언어로 바꾼다.
- `Last refreshed`와 데이터 신선도를 표시한다.
- empty state에 다른 기간 backlog와 다음 행동을 제공한다.
- Reversed detail에 reversal reason, actor, original match를 표시한다.
- assignment 성공 결과에 assigned/unchanged/notification warning/audit ID를 표시한다.
- API 오류를 하나의 `failed` notice로 합치지 말고 permission, stale status, conflict, notification warning을 구분한다.

## 반드시 유지해야 할 현재 강점

- unresolved queue의 server-side oldest-first 정렬
- 현재 page가 아닌 전역 owner workload 집계
- assignee role/category 검증
- bulk assignment의 row lock과 closed/stale 검증
- bank reconciliation의 maker-checker
- Serializable transaction
- source와 bank의 over-allocation guard
- match/reversal과 audit log의 원자성
- semantic table, labeled forms, focusable scroll region, confirm dialog focus boundary
- dark/light design tokens

## 테스트 우선 구현

가능하면 현재 실패 동작을 보여주는 회귀 테스트를 먼저 추가하고 수정 후 통과시켜라.

### Candidate search 테스트

- 59일 된 OPEN record가 candidate search에 나타난다.
- 50개 이후 record를 search 또는 pagination으로 찾는다.
- PARTIALLY_CLEARED record가 remaining amount로 후보에 나타난다.
- CLEARED, REVERSED, remaining 0 record는 active candidate가 아니다.
- currency/direction이 맞지 않는 candidate는 제외되거나 명확한 ineligible reason을 반환한다.

### 금융 무결성 테스트

- positive inflow clearing + OUTFLOW bank transaction 거절
- 허용된 inflow + matching currency + valid remaining amount 성공
- source remaining amount 초과 거절
- bank remaining amount 초과 거절
- direct API 호출도 direction rule을 우회하지 못함
- concurrent/repeated match가 기존 Serializable/over-allocation 불변식을 깨지 않음
- reversal 후 authoritative matched/remaining/status가 정확히 재계산됨

### Assignment 테스트

- audit assignment 성공 + notification 성공
- audit assignment 성공 + notification 실패 → assignment success와 delivery warning을 구분
- bulk notification 일부 실패 결과
- already assigned/unchanged count
- closed/stale row가 포함된 bulk 정책
- permission/category 거절
- UI가 error와 warning을 다른 상태로 표시

### URL·UI 테스트

- 다음 상태에서 detail 진입/복귀 후 query가 그대로 보존됨:

```text
range=all&review=open&owner=unassigned&age=48h&page=4&take=25&q=cmq7vlpo&sort=oldest
```

- 악성 외부 `returnTo` 거절
- owner dialog에 target record context 표시
- checkbox accessible name이 모든 row에서 고유
- Select all visible과 최대 50개 한도
- booking/payment/clearing/source ID 검색
- 기본 진입이 All unresolved
- legacy Payment Clearing URL 호환
- KPI의 cleared/reversed 정의
- fee evidence의 항목별 분리 렌더링

## 브라우저 검증

1440px 이상 데스크톱에서만 검증한다. 1024px 이하 반응형 문제는 이번 보고에 포함하지 마라.

읽기 전용 또는 fixture 환경에서 다음을 확인한다.

1. 기본 Payment Clearing 진입에서 전체 unresolved backlog가 보인다.
2. Queue, owner, age, search, sort, page 상태가 URL에 일관되게 유지된다.
3. 오래된 row에서 detail → reconciliation case → back 흐름이 끊기지 않는다.
4. owner assignment dialog에 정확한 target가 보인다.
5. table checkbox label과 선택 수가 고유하고 명확하다.
6. open, partial, cleared, reversed, empty, permission/error/warning 상태를 확인한다.
7. 긴 VND 금액, enum, payment fee evidence가 잘리거나 붙지 않는다.
8. dark/light theme를 확인한다.
9. keyboard로 filter, table scroll, selection, dialog/drawer, cancel, focus restore가 가능하다.

실제 운영 record를 assign/match/reverse하지 마라.

## 검증 명령

저장소의 실제 package scripts를 먼저 확인한 뒤 최소 다음 범위를 실행하라.

```powershell
npm.cmd --workspace @massage-vn/admin-web test -- app/finance-tax/payment-clearing app/finance-tax/bank-reconciliation
npm.cmd --workspace @massage-vn/api test -- src/admin/admin.controller.spec.ts src/admin/admin.service.spec.ts
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

관련 protected area 또는 Prisma schema/migration을 변경했다면 `AGENTS.md`가 요구하는 추가 검증과 `verify:local`을 실행한다. 전체 API spec가 너무 크다면 관련 테스트를 먼저 실행할 수 있지만, 최종 보고에는 필터링한 테스트와 full 관련 suite 결과를 구분해서 적는다.

## 완료 조건

- P0 세 항목이 코드와 회귀 테스트로 해결되었다.
- 30일/50개 제한으로 처리 불가능한 clearing record가 없다.
- PARTIALLY_CLEARED remaining amount를 후속 match할 수 있다.
- 잘못된 bank direction을 UI와 direct API 모두 거절한다.
- notification 실패가 성공한 assignment를 실패로 오인시키지 않는다.
- 기본 화면이 전체 unresolved 위험을 보여준다.
- 목록·상세·reconciliation 사이에서 문맥이 보존된다.
- 운영자가 ID 검색과 `Review and match` 흐름으로 작업을 완료할 수 있다.
- checkbox와 dialog의 대상 식별이 명확하다.
- KPI와 evidence 문구가 실제 계산·상태 의미와 일치한다.
- 1440px 이상 dark/light 및 keyboard 검증이 완료되었다.
- 관련 Admin Web/API 테스트와 scope verification이 통과했다.

완료하지 못한 항목을 완료했다고 표현하지 마라. schema 또는 운영 정책 결정 때문에 구현할 수 없는 항목은 정확한 blocker, 영향, 가장 작은 다음 변경안을 적어라.

## 최종 보고 형식

다음 순서로 결과를 보고하라.

1. 운영자 관점에서 달라진 핵심 결과
2. 해결한 P0/P1/P2 항목과 남은 항목
3. 변경 파일 목록
4. Payment Clearing ↔ Bank Reconciliation 데이터 흐름 변경
5. 금융 불변식·API 응답·DB/migration 변경
6. 실행한 테스트와 명령별 pass/fail/skipped 결과
7. 1440px 이상 before/after 캡처 경로
8. protected area 수정 여부
9. notification, rollout, legacy data, 권한 관련 남은 위험
10. 다음 권장 작업 한 개

최종 보고 전에 스스로 확인하라.

- 모든 P0 요구가 테스트로 고정되었는가?
- direct API가 UI 검증을 우회할 수 없는가?
- 실제 성공과 notification warning이 구분되는가?
- 오래된/partial candidate가 실제 UI에서 선택 가능한가?
- 사용자의 기존 변경을 덮어쓰지 않았는가?

---
