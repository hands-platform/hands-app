# Finance Overview 최종 개선용 Codex 구현 프롬프트

아래 프롬프트 전체를 새 Codex 작업에 그대로 전달한다.

---

## 실행 프롬프트

`C:\dev\massage-on-demand-vn` 저장소에서 관리자 웹의 **Finance Overview를 직접 수정하고 검증하라.** 분석이나 제안서만 작성하지 말고, 실제 코드·테스트·브라우저 화면까지 완료하라.

### 목표

`http://localhost:3101/finance-overview`를 재무 운영자가 신뢰하고 사용할 수 있는 상태로 만든다.

이번 작업의 최우선 목표는 UI 장식이 아니라 다음 운영 계약을 보장하는 것이다.

> Finance Overview에 표시되는 queue의 count·amount·scope와 클릭 후 목적지의 total·amount·filter가 동일해야 한다.

현재 화면 구조인 `Today movement / Current backlog / Money flow`는 유지한다. 세 작업공간을 별도 페이지로 분리하거나 전체 디자인을 새로 만들지 않는다.

보고서의 `6건`, `28건`, 금액은 2026-08-09 감사 snapshot의 재현 값이다. 구현·검증 시 운영 데이터가 바뀌었다면 이 숫자를 코드나 테스트에 하드코딩하지 말고, **동일한 refreshed snapshot 시점의 Overview total과 destination total이 일치하는지** 비교한다.

### 필수 참고 자료

먼저 아래 파일을 끝까지 읽고, 보고서의 스크린샷도 직접 확인하라.

- 감사 보고서:
  - `C:\dev\massage-on-demand-vn\output\finance-overview-post-remediation-reaudit-2026-08-09\finance-overview-post-remediation-deep-reaudit-report.md`
- 감사 스크린샷 폴더:
  - `C:\dev\massage-on-demand-vn\output\finance-overview-post-remediation-reaudit-2026-08-09`
- 이전 감사·구현 기준:
  - `C:\dev\massage-on-demand-vn\output\finance-overview-reaudit-2026-08-08\finance-overview-reaudit-report.md`
  - `C:\dev\massage-on-demand-vn\output\finance-overview-reaudit-2026-08-08\finance-overview-codex-implementation-prompt.md`

저장소의 `AGENTS.md`와 더 가까운 하위 `AGENTS.md`가 있으면 먼저 읽고 반드시 따른다.

### 화면 범위

- 검사 및 구현 기준은 **1440px 이상 데스크톱 전용**이다.
- 기준 viewport: `1440×900`
- 보조 확인 viewport: `1728×1000` 이상
- **1024px 이하 화면, 모바일, 태블릿 반응형은 이번 작업에서 검사하거나 변경하지 않는다.**
- 기존 라이트·다크 테마를 모두 유지한다.
- 현재 로그인 세션과 운영 데이터를 사용하되 승인·지급·배정·삭제 등 데이터 변경 동작은 실행하지 않는다.

### 작업 원칙

1. 현재 dirty worktree와 사용자의 기존 변경을 보존한다. 관련 없는 파일을 되돌리거나 정리하지 않는다.
2. 숫자를 목적지에 맞추기 위해 UI에서 임의로 변경하거나 숨기지 않는다.
3. summary와 destination이 동일한 entity·query contract를 사용하도록 근본 원인을 수정한다.
4. 이미 존재하는 query builder, filter model, route, component를 우선 재사용한다.
5. 정확한 목록을 표현할 기존 화면이 없으면 가장 가까운 기존 화면을 작은 범위로 확장한다. 근거 없이 유사한 화면으로 redirect하지 않는다.
6. 새로운 범용 framework나 과도한 추상화를 만들지 않는다. 공유 계약은 실제로 함께 사용해야 하는 summary와 destination 사이에만 둔다.
7. 실제 자동 갱신이 없는 상태를 `Live`라고 부르지 않는다. 현재 구현된 Snapshot/Refresh/stale 동작은 유지한다.
8. 사용자에게 중간 선택을 맡기지 말고, 저장소와 실제 화면을 조사해 가장 작고 안전한 구현을 선택한다. 사업 규칙을 코드·테스트·기존 화면으로 확인할 수 없을 때만 질문한다.
9. 실패를 0으로 위장하지 않는다. 부분 데이터를 표시한다면 section별 오류와 재시도 상태를 명확히 표시한다.
10. 변경 후 반드시 실제 로그인된 브라우저에서 클릭 결과까지 검증한다.

## 1. 작업 전 기준선 확인

코드를 수정하기 전에 다음을 수행하라.

1. 관련 파일과 기존 테스트를 찾는다.
2. 현재 구현이 어떤 source entity와 filter로 count/amount를 만드는지 표로 정리한다.
3. 각 Overview action의 `href`가 어떤 destination loader/API를 호출하는지 추적한다.
4. 아래 세 P0 문제를 실제 브라우저에서 재현한다.
5. 관련 테스트를 먼저 실행해 기준선을 기록한다.

우선 확인할 파일:

- `apps/admin_web/app/finance-overview/page.tsx`
- `apps/admin_web/app/finance-overview/finance-overview-model.ts`
- `apps/admin_web/app/finance-overview/finance-overview-model.spec.ts`
- `apps/admin_web/app/finance-overview/page.spec.tsx`
- `apps/admin_web/app/finance-overview/finance-overview-snapshot-control.tsx`
- `apps/admin_web/app/finance-overview/finance-overview-snapshot-control.spec.tsx`
- `apps/admin_web/components/admin-segmented-control.tsx`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/app/loading.tsx`
- `apps/api/src/admin/admin.service.ts`
- Finance Tax, payout, bank reconciliation, partner deposit 관련 route·query·test

## 2. P0 — 숫자와 목적지 계약 수정

### P0-1. Payout bank outflow reconciliation

현재 문제:

- Overview: `Payout bank outflow reconciliation · 6 open · 약 3.15m VND`
- 목적지: `/finance-tax/bank-reconciliation?workspace=operations&range=all&review=unmatched&type=OUTFLOW`
- 목적지 결과: 0 transactions

코드상 source count는 `ProviderPayoutBatch` 중 PAID이고 해당 월의 bank match가 target보다 부족한 payout batch다. 목적지는 이미 존재하는 unmatched `CompanyBankTransaction`을 조회한다. 서로 다른 entity이므로 URL 문구 변경만으로 해결할 수 없다.

수정 요구사항:

1. `openPayoutBankOutflows`를 구성하는 payout-batch candidate와 동일한 목록을 목적지에서 보여준다.
2. 기존 `/payouts`가 이 목록을 표현할 수 있으면 `period`, `status=paid`, `bankEvidence=incomplete`에 해당하는 명시적 필터를 추가하고 그 화면으로 연결한다.
3. Bank Reconciliation 안에서 처리해야 한다면 destination loader/API가 payout-batch missing-evidence candidate를 실제로 조회하는 별도 view/source를 지원해야 한다.
4. `period=2026-08`, `source=payout`, owner/sort가 있으면 해당 값, `returnTo`를 보존한다.
5. Overview 6건이면 목적지 total도 6건이고 합산 remaining amount도 동일해야 한다.
6. bank transaction이 존재하지 않는 payout batch도 처리 목록에서 사라지면 안 된다.

### P0-2. Partner deposit reconciliation

현재 문제:

- Overview: `Partner deposit reconciliation · 28 open · 약 2.24m VND`
- 모델이 legacy `/finance-tax/approval-queue?view=reconciliation&owner=unassigned`를 생성함
- redirect 후 generic bank queue `44 unmatched / 24 unassigned / 약 13.4m VND`가 열림

source count는 executed `PartnerBankDepositRequest`의 target/matched 차이이고 목적지는 generic unmatched bank transaction이다.

수정 요구사항:

1. `PartnerBankDepositRequest`의 미완료 reconciliation candidate와 동일한 목록을 목적지에서 보여준다.
2. 가능한 경우 기존 partner deposit 관련 화면 또는 Bank Reconciliation의 명시적인 `source=partner-deposit` view를 확장한다.
3. exact candidate view가 없으면 가장 가까운 기존 Finance Tax 화면 안에 작은 전용 view를 구현한다. unrelated generic queue로 redirect하지 않는다.
4. legacy approval-queue URL 생성 helper를 제거하거나 더 이상 사용하지 않는다.
5. `owner=unassigned`, `sort=oldest`, 필요한 period/scope와 `returnTo`를 유지한다.
6. Overview 28건이면 목적지 total도 28건이고 remaining amount 합계도 동일해야 한다.

### P0-3. Tax and closeout review

현재 문제:

- Overview: `Tax and closeout review · 6 closeout checks`
- 실제 목적지: booking settlement audit `Needs action 200`
- count는 open tax + coupon review + payout outflow + payout return + formula issue를 단순 합산함
- 현재 데이터에서는 `Payout bank outflow 6`과 동일한 문제를 중복 표시함

수정 우선순위:

1. `/finance-tax` 또는 기존 monthly close 화면에 heterogeneous closeout blocker를 정확히 표현하는 실제 preflight가 있고 `preflight.blockers`를 제공한다면:
   - 단순 합산 count를 제거한다.
   - server preflight blocker count를 사용한다.
   - selected `period`를 포함해 해당 preflight 화면으로 연결한다.
   - 목적지에서 blocker 유형별 count 합계가 Overview count와 일치해야 한다.
2. 정확한 목적지가 없다면:
   - **Current backlog에서 `Tax and closeout review` 복합 행을 제거한다.**
   - 개별 payout/tax/coupon/formula queue가 각자 정확한 목적지를 제공하도록 한다.
3. booking settlement audit의 200건으로 보내는 현재 링크는 반드시 제거한다.
4. 같은 6건을 `Payout bank outflow`와 `Tax and closeout review` 두 행에 중복 표시하지 않는다.

### P0 공통 구현 계약

필요한 최소 수준에서 다음 계약을 코드와 테스트에 명시하라.

- source entity
- scope: `current`, `all-open`, `period`
- period/range/owner/source/review filter
- count
- amount와 currency
- destination href
- destination total/amount를 계산하는 동일 query 또는 공유 predicate

UI count와 destination count를 서로 다른 코드에서 우연히 같은 숫자로 만드는 테스트는 부족하다. 동일 fixture 또는 실제 destination query를 사용한 계약 테스트를 작성하라.

## 3. P1 — 1440px 시각·범위·상태 완성

### P1-1. 재무 금액 ellipsis 제거

현재 `.finance-overview-principle-card > div > strong`의 다음 규칙 때문에 1440px에서 네 KPI가 잘린다.

```css
overflow: hidden;
text-overflow: ellipsis;
white-space: nowrap;
```

수정 요구사항:

1. 재무 금액에는 ellipsis를 사용하지 않는다.
2. 금액과 currency를 별도 element로 렌더링하거나 currency를 더 작은 보조 텍스트로 표시한다.
3. 숫자에는 `font-variant-numeric: tabular-nums`를 사용한다.
4. `16,400,000 VND`, `3,187,963 VND`, `12,835,000 VND`, `3,175,963 VND`가 1440px에서 완전히 보여야 한다.
5. 필요하면 font-size clamp 또는 2×2 grid를 사용하되 숫자를 `16.4m`으로 임의 축약하거나 잘라내지 않는다.
6. 라이트·다크 테마 모두 검증한다.

### P1-2. Reconciliation scope badge

- `Current and all-open controls`가 1440px에서 잘리지 않게 한다.
- 권장 문구는 `Current + all-open`이다.
- badge에 고정 폭을 주지 말고 내용이 온전히 보이게 한다.

### P1-3. Today 빈 상태 압축

`isTodayMovementClear`일 때 큰 `AdminSection`을 유지하지 않는다.

- Current Balances 바로 위에 높이 약 40~48px의 inline notice를 배치한다.
- 현재 안내 문구는 유지할 수 있다.
- 1440×900 첫 viewport 안에 Current Balances의 실제 KPI 값이 보여야 한다.
- Today movement가 존재할 때의 기존 KPI section은 유지한다.

### P1-4. 월간 tax 링크에 period 보존

다음 월간 항목이 선택한 `period`를 목적지에 전달하게 한다.

- Company output VAT
- Partner withholding
- monthly formula/close 관련 링크
- payment fee 관련 월간 링크

`Partner tax profile action`은 all-open/current scope다. 월간 tax와 같은 범위처럼 보이지 않도록 별도 scope 또는 detail에 `All settlement-active Partners`를 명시한다.

### P1-5. Comparison drill-down 범위 보존

7/30/90일 comparison KPI의 클릭 목적지가 현재 기간과 이전 기간을 재현해야 한다.

- destination이 지원하는 정확한 `from/to`, range token 또는 period filter를 전달한다.
- destination이 동일 집합을 표현할 수 없다면 카드 전체 링크를 제거하고 `View current period records`처럼 정확한 action만 제공한다.
- 필터 없는 settlement audit 또는 earnings로 보내지 않는다.

### P1-6. Finance 전용 loading 상태

`apps/admin_web/app/finance-overview/loading.tsx`를 추가하거나 동등한 route-level boundary를 구현한다.

- title: `Finance Overview`
- workspace를 확정할 수 있으면 해당 문맥을 표시한다.
- 최소 문구: `Loading current finance snapshot.`
- `Shift Command`, `Loading priority queue`가 Finance 페이지 이동 중 노출되면 안 된다.
- 실제 loading 상태에서 레이아웃이 크게 이동하지 않게 한다.

## 4. P2 — 운영 친화성과 복원력

P0/P1을 완료한 뒤 다음을 구현하라.

1. `Payment fee methods · 2026-08`의 대표 값 `3`을 `3 configured methods`, `0 VND across 3 methods`, 또는 실제 fee가 존재하는 method coverage로 명확히 바꾼다.
2. Backlog 헤더에 `Sorted by operational risk`를 표시한다.
3. 별도 정렬 UI는 실제 요구가 명확할 때만 `Risk / Oldest` 두 옵션으로 제한한다. 불필요한 다중 정렬은 만들지 않는다.
4. range control은 URL navigation이므로 가능하면 `<nav aria-label="Finance overview range">`와 active link의 `aria-current="page"`를 사용한다.
5. `role=tab`을 유지한다면 연결된 `tabpanel`, roving tabindex, 좌우 화살표 키를 포함한 완전한 tabs pattern을 구현한다. 불완전한 tabs ARIA는 남기지 않는다.
6. API의 22개 summary `Promise.all`은 먼저 실제 latency와 query profile을 확인한다. 브라우저 요청을 여러 개로 쪼개는 client waterfall은 만들지 않는다.
7. 가장 작은 안전한 범위에서 section별 오류·freshness를 보존하고 하나의 비핵심 summary 실패가 전체 Finance Overview를 0 또는 error page로 만들지 않게 한다.
8. workspace별로 사용하지 않는 historical summary를 생략할 수 있는지는 결과 계약을 깨지 않는 범위에서만 최적화한다.

성능 최적화는 P0/P1을 지연시키지 말고, 측정 근거 없는 대규모 API 재작성은 하지 않는다.

## 5. 테스트 요구사항

기존 테스트를 유지하고 다음 회귀 테스트를 추가하라.

### 필수 계약 테스트

1. payout outflow Overview count/amount와 destination total/amount 일치
2. bank transaction이 없는 payout batch도 payout reconciliation candidate에 포함
3. partner deposit Overview count/amount와 destination total/amount 일치
4. partner deposit owner/period/source filter 보존
5. closeout composite를 유지하면 preflight blocker total과 Overview count 일치
6. closeout composite를 제거하면 중복 행이 렌더링되지 않음
7. 목적지 URL에 period/range/source/owner/returnTo가 정확히 포함됨
8. selected period 변경 시 VAT/withholding/payment fee 목적지가 동일 period 사용
9. comparison 목적지가 current window를 보존

### 필수 UI·접근성 테스트

1. Today clear 상태에서 큰 empty KPI section이 렌더링되지 않음
2. Finance route loading에 `Shift Command`와 `priority queue` 문구가 없음
3. range control을 navigation으로 구현하면 active link에 `aria-current=page`
4. snapshot refresh/stale 기존 테스트 유지
5. Backlog의 visible content가 링크의 접근 가능한 이름에서 유지됨

### 필수 1440px 시각 검증

Playwright 또는 저장소의 기존 브라우저 도구로 `1440×900`에서 확인한다.

- 네 개의 긴 VND KPI가 잘리지 않음
- Reconciliation scope badge가 잘리지 않음
- Backlog의 Queue/Work/Oldest/Impact/Owner/Open 열이 겹치지 않음
- Today clear 상태에서 Current Balances 값이 첫 viewport에 보임
- 라이트·다크 테마 모두 통과

가능하면 overflow assertion을 추가한다.

```text
element.scrollWidth <= element.clientWidth
```

단, wrapping을 허용한 요소는 screenshot과 bounding box로 검증한다.

## 6. 검증 명령

저장소의 실제 package scripts를 기준으로 필요 범위만 실행하라. 최소한 다음을 포함한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/finance-overview/finance-overview-model.spec.ts app/finance-overview/page.spec.tsx app/finance-overview/finance-overview-snapshot-control.spec.tsx
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run lint --workspace @massage-vn/admin-web
```

API 파일을 변경했다면 관련 API 테스트와 다음도 실행한다.

```powershell
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run lint --workspace @massage-vn/api
```

전체 suite가 지나치게 크면 우선 관련 테스트를 실행하고, 실행하지 못한 검증은 이유와 정확한 남은 명령을 최종 보고에 적는다. 실패를 숨기거나 기존 실패라고 추정하지 말고 기준선과 변경 후 결과를 비교한다.

## 7. 브라우저 수동 검수 순서

로그인된 브라우저에서 다음 순서대로 직접 확인하고 최종 증거 스크린샷을 남긴다.

1. `/finance-overview`
   - Snapshot/Refresh 유지
   - Today clear 상태 압축
   - Current Balances가 첫 viewport에 보이는지 확인
2. `/finance-overview?view=queues`
   - 중복 closeout row 여부
   - 열 정렬과 정렬 기준 문구 확인
3. `Payout bank outflow reconciliation` 클릭
   - 출발 count/amount와 목적지 total/amount 일치
4. `Partner deposit reconciliation` 클릭
   - 출발 count/amount와 목적지 total/amount 일치
5. closeout entry를 유지한 경우 클릭
   - preflight blocker 합계가 출발 count와 일치
6. `/finance-overview?view=flow&range=7d&period=2026-08`
   - 4개 금액 전체 표시
   - comparison 링크 범위 유지
   - VAT/withholding 링크 period 유지
   - scope badge 전체 표시
7. 라이트·다크 테마 반복 확인
8. 브라우저 콘솔 warning/error 확인
9. 느린 navigation 또는 loading 상태에서 Finance 문맥 확인

각 단계는 화면을 보는 데서 끝내지 말고 URL, filter chip, destination total을 함께 확인한다.

## 8. 완료 조건

다음 조건을 모두 만족해야 작업을 완료로 판단한다.

- Payout outflow가 동일 snapshot의 같은 count와 amount를 처리하는 목적지를 연다.
- Partner deposit이 동일 snapshot의 같은 count와 amount를 처리하는 목적지를 연다.
- Closeout entry가 unrelated settlement 전체 목록을 열지 않는다.
- 같은 payout 6건이 두 개의 Backlog 행에 중복 표시되지 않는다.
- non-zero Backlog 행의 Overview count/amount와 destination total/amount가 모두 일치한다.
- 1440px에서 모든 핵심 VND 금액과 scope badge가 생략 없이 보인다.
- 선택한 tax period와 comparison range가 목적지에 보존된다.
- Today clear 상태에서 Current Balances가 첫 viewport에 보인다.
- Finance loading에 Shift Command 문맥이 나타나지 않는다.
- 기존 46개 테스트와 신규 계약·시각 테스트가 통과한다.
- Admin Web/API의 관련 typecheck와 lint가 통과한다.
- 라이트·다크 테마에 회귀가 없다.
- 1024px 이하 UI를 이번 변경 범위에 포함하지 않는다.

## 9. 최종 보고 형식

작업이 끝나면 다음 순서로 간결하지만 검증 가능하게 보고하라.

1. 최종 판정: 완료 / 부분 완료 / 차단
2. P0별 수정 내용과 선택한 source/destination 계약
3. 변경 파일 목록과 각 파일의 역할
4. Overview count/amount ↔ destination total/amount 검증 표
5. 1440×900 라이트·다크 스크린샷 경로
6. 실행한 테스트·typecheck·lint 명령과 결과
7. 실행하지 못한 검증과 이유
8. 남은 위험 또는 후속 작업

`잘 수정했습니다` 같은 추상적인 결론만 쓰지 말고, 다음 형식의 근거 표를 반드시 포함한다.

| Queue | Overview | Destination | Scope/filter | Result |
|---|---:|---:|---|---|
| Payout bank outflow | snapshot count / amount | same count / amount | period + payout source | PASS |
| Partner deposit | snapshot count / amount | same count / amount | owner + deposit source | PASS |

분석 보고서만 만들고 종료하지 말라. 실제 구현, 테스트, 1440px 브라우저 검수, 최종 근거 보고까지 완료하라.

---

## 프롬프트 설계 기준

이 프롬프트는 Codex가 복잡한 코드 변경을 안정적으로 수행하도록 다음 네 요소를 명시한다.

- **Goal:** Finance Overview의 운영 신뢰성 복구
- **Context:** 감사 보고서, 스크린샷, 관련 소스·테스트 경로
- **Constraints:** 1440px+, 기존 IA 유지, 데이터 무변경, dirty worktree 보존, 과도한 재설계 금지
- **Done when:** count/amount 계약, 테스트, 타입체크, lint, 브라우저 검증이 모두 통과
