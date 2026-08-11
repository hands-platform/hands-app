# Codex 실행 프롬프트 — Finance & Tax 재감사 후 개선 구현

아래 프롬프트 전체를 `C:\dev\massage-on-demand-vn`을 연 Codex 작업에 그대로 전달한다.

---

## 복사해서 사용할 프롬프트

당신은 HANDS 관리자 웹의 Finance & Tax 영역을 수정하는 시니어 풀스택 엔지니어이자 재무 운영 UX 설계자다. 이번 작업은 추가 감사 보고서를 작성하는 일이 아니라, 아래 재감사 결과를 바탕으로 **코드 수정, 회귀 테스트, 1440px 실제 브라우저 검증까지 완료하는 구현 작업**이다.

### 1. 목표

`http://localhost:3101/finance-tax`를 재무 운영자가 월 마감 판단과 작업 진입에 신뢰할 수 있는 관제 화면으로 완성한다.

반드시 달성할 핵심 결과는 다음과 같다.

1. 선택 회계월의 숫자와 드릴다운 목록의 범위·건수·금액이 일치한다.
2. Tax workflow, review flag, integrity exception, hard blocker의 의미가 overview/list/detail/export에서 일관된다.
3. 현재월, 미래월, 무활동월, 오류 상태가 서로 다른 의미와 가능한 행동을 정확히 표현한다.
4. 1440×900 첫 화면에서 실제 Active control의 첫 번째 전체 행과 행동 버튼을 볼 수 있다.
5. 운영자가 처리 우선순위와 담당 상태를 판단할 수 있고, 제공할 수 없는 데이터는 꾸며서 표시하지 않는다.

### 2. 먼저 읽을 자료와 지침

작업 시작 전에 아래 순서대로 읽고 현재 코드를 직접 확인하라.

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\output\finance-tax-post-remediation-reaudit-2026-08-09\finance-tax-post-remediation-deep-reaudit-report.md`
3. 보고서 폴더의 1440×900 스크린샷 10개
4. 다음 주요 코드와 모든 직접 호출자·테스트

```text
apps/admin_web/app/finance-tax/page.tsx
apps/admin_web/app/finance-tax/page.spec.tsx
apps/admin_web/app/finance-tax/tax-settlement-page-model.ts
apps/admin_web/app/finance-tax/tax-settlement-page-model.spec.ts
apps/admin_web/app/finance-tax/finance-overview-table-panel.tsx
apps/admin_web/app/finance-tax/finance-list-command-card.tsx
apps/admin_web/app/finance-tax/booking-settlement-audit/page.tsx
apps/admin_web/app/finance-tax/booking-settlement-audit/page.spec.tsx
apps/admin_web/app/finance-tax/booking-settlement-audit/[id]/page.tsx
apps/admin_web/app/finance-tax/monthly-tax-closing/page.tsx
apps/admin_web/app/cash-settlements/page.tsx
apps/admin_web/app/cash-settlements/page.spec.tsx
apps/admin_web/app/cash-settlements/cash-settlement-page-model.ts
apps/admin_web/app/cash-settlements/cash-settlement-page-model.spec.ts
apps/admin_web/lib/admin-api.ts
apps/admin_web/app/globals.css
apps/api/src/admin/admin.controller.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin.controller.spec.ts
apps/api/src/admin/admin.service.spec.ts
apps/api/src/earnings/earnings.service.ts
apps/api/src/earnings/earnings.service.spec.ts
```

파일명만 믿지 말고 `rg`로 실제 데이터 흐름을 추적하라. 특히 다음 항목의 정의, query predicate, API type, URL builder, list summary, export를 모두 찾는다.

```text
cashDebtTotal
cash settlement range / period filters
monthlyTaxClosingSummary
review=tax-open
TAX_WORKFLOW_OPEN
Integrity exceptions
preflight.blockers
returnTo
oldest / owner / SLA
```

작업 전 `git status --short`와 관련 파일 diff를 확인하라. 현재 worktree에는 사용자의 대규모 미커밋 변경이 있으므로 관련 없는 변경을 덮어쓰거나 정리하지 마라.

### 3. 작업 원칙

- `AGENTS.md`에 따라 **single-agent**로만 작업한다. subagent를 만들지 않는다.
- 기존 디자인 시스템, 컴포넌트, 토큰, URL helper, 서버 predicate를 우선 재사용한다.
- 문제의 공통 원인을 한 번 수정하라. 각 화면에 임시 조건을 복제하지 않는다.
- 새 UI 라이브러리나 production dependency를 추가하지 않는다.
- 데이터가 없는데 숫자·담당자·시간을 임의 생성하지 않는다.
- DB schema/migration은 이 작업에서 원칙적으로 변경하지 않는다. 기존 데이터와 query로 해결할 수 있는지 먼저 증명한다.
- 서버의 `preflight.blockers`를 hard blocker의 단일 출처로 유지한다.
- 현재 올바른 회사 부담 쿠폰 포함 정산식과 `settlementAllocationIdentity`를 훼손하지 않는다.
- API 실패 시 가짜 0건 KPI를 표시하지 않는 현재 오류 안전성을 유지한다.
- overview summary API 1회 호출 구조를 유지한다. queue별 대형 list를 overview에서 병렬 hydration하지 않는다.
- 기존 dark theme, focus ring, table semantics, month label을 보존한다.
- UI 문구는 현재 제품과 같이 영어로 작성하되 운영자가 이해하는 업무 용어를 사용한다.
- 1024px 이하 화면, 모바일, 태블릿, 반응형 축소 화면은 이번 작업의 설계·검수·보고 범위에서 완전히 제외한다.
- 1440px 이상 desktop 운영 환경만 최적화한다.
- 실제 승인, 송금, 마감 전환, 데이터 수정 버튼을 브라우저 검수 중 실행하지 않는다.

---

## 4. 구현 범위와 우선순위

### Batch 1 — P0: Cash debt 월 범위 계약 수정

현재 `/finance-tax?period=2026-08`의 월별 `cashDebtTotal`을 클릭하면 `/cash-settlements?range=all`로 이동해 출발 숫자와 도착 목록 범위가 다르다. 이 문제를 UI 링크만 바꾸는 수준이 아니라 API와 summary까지 end-to-end로 수정하라.

#### 구현 요구사항

1. Cash settlement admin URL/filter model/API에 `period=YYYY-MM`을 정식 지원한다.
2. 선택 월의 시작/끝 경계 또는 저장된 monthly period 기준은 `monthlyTaxClosingSummary`가 cash debt를 계산하는 기준과 정확히 같아야 한다.
3. Cash settlement list와 summary가 동일한 공통 predicate/helper를 사용하게 한다.
4. `/finance-tax`의 Cash debt 링크에 선택 `period`와 안전한 local `returnTo`를 넣는다.
5. 기존 cash settlement queue/review query key가 있으면 그대로 재사용한다. 같은 의미의 새 query vocabulary를 불필요하게 만들지 않는다.
6. 목록 → 상세 → 목록 → Tax close overview 왕복에서 period와 returnTo를 유지한다.
7. overview 금액, destination summary 금액, destination row 합계가 동일한 fixture로 회귀 테스트를 작성한다.
8. 2026-07과 2026-08 fixture가 서로 섞이지 않는 테스트를 작성한다.

#### URL 인수 조건

정확한 queue key는 기존 cash settlement 모델을 따르되 최소한 다음 계약을 만족해야 한다.

```text
/cash-settlements?period=2026-08&...&returnTo=%2Ffinance-tax%3Fperiod%3D2026-08
```

`range=all` 또는 `range=today`로 월별 마감 범위를 대체하지 마라.

#### 완료 조건

- 2026-08 Cash debt 클릭 후 URL에 `period=2026-08`이 있다.
- 도착 목록의 표시 합계가 출발 overview 금액과 정확히 일치한다.
- 다른 월 레코드가 섞이지 않는다.
- Back 동선이 원래 선택 월로 돌아간다.

---

### Batch 2 — P0: Tax workflow와 integrity taxonomy 통일

현재 overview는 `Open tax rows`를 hard blocker가 아닌 review flag로 설명하지만, Booking Settlement Audit는 동일 subset을 `Action required`, `Integrity exceptions`, `Tax Workflow Open`으로 표시한다. 같은 레코드가 화면별로 다른 위험 등급을 갖지 않도록 수정하라.

#### canonical 분류 규칙

```text
Tax workflow open + SLA 이내
  → Tax review queue / In progress

Tax workflow open + SLA 초과
  → Overdue tax review

필수 tax evidence 누락 또는 실제 integrity predicate 충족
  → Evidence exception / Integrity exception

서버 monthly close preflight blocker code에 포함
  → Hard blocker
```

#### 구현 요구사항

1. 서버에 기존 분류 helper/predicate가 있다면 그것을 공통 기준으로 사용한다.
2. `TAX_WORKFLOW_OPEN`이라는 이유만으로 integrity exception에 포함하지 않는다.
3. overview, Booking Settlement Audit summary cards, queue label, row signal, detail, export에서 같은 classification을 사용한다.
4. hard blocker는 계속 `preflight.blockers`에서만 파생한다.
5. SLA/due date를 계산할 수 있는 기존 authoritative timestamp가 있으면 정상 진행과 overdue를 분리한다.
6. authoritative due/owner 데이터가 없다면 임의 규칙이나 시간을 만들지 않는다. 분류를 workflow로 유지하고, unavailable metadata는 UI에서 제거한다.
7. 기존 실제 integrity exception 조건과 test fixture는 유지한다.
8. 다음 케이스를 테스트한다.
   - tax-open이지만 SLA 이내인 정상 workflow row
   - SLA 초과 tax review row
   - evidence 누락 row
   - 실제 amount/journal integrity mismatch row
   - 서버 preflight blocker row

#### 완료 조건

- tax-open 36건이 자동으로 `Integrity exceptions 36`이 되지 않는다.
- 동일 settlement ID가 overview/list/detail/export에서 같은 위험 등급을 갖는다.
- `Hard blockers 0`이면 destination도 hard error처럼 표현하지 않는다.
- 실제 evidence/integrity fixture만 exception에 포함된다.

---

### Batch 3 — P1: 운영 우선순위 metadata와 표 정합성

현재 `Oldest`와 `Owner`가 모두 하드코딩된 `—`이며, 건수가 `Affected records`와 `Exposure`에 중복된다.

#### 구현 요구사항

1. 각 active control이 실제로 참조하는 queue와 summary source를 조사한다.
2. 기존 데이터에 authoritative `createdAt/requestedAt/updatedAt/assigned owner/SLA`가 있으면 bounded aggregate로 다음을 제공한다.
   - oldest open timestamp
   - assigned owner summary
   - unassigned count
   - overdue count
3. overview에서 각 queue의 row list를 hydration하거나 N+1 query를 만들지 않는다.
4. 하나의 summary 요청과 상수 개수의 aggregate query를 유지한다.
5. authoritative source가 없는 값은 만들지 않는다.
   - 모든 값이 unavailable이면 해당 열과 KPI scope 문구를 제거한다.
   - `—`만 반복되는 열을 남기지 않는다.
   - `Owner`를 단순히 `Finance` 같은 임의 팀명으로 채우지 않는다.
6. `Affected records`는 레코드 수만 표시한다.
7. `Financial exposure`는 금액만 표시한다. 금액을 계산할 수 없으면 `Not calculated` 또는 명시적 empty state를 쓰고 count를 반복하지 않는다.
8. 겹치는 queue 수를 합산해 unique affected records처럼 보이게 하지 않는다.
9. 기본 정렬은 가능한 데이터 안에서 `hard blocker → overdue → oldest → exposure` 순으로 한다.

#### 완료 조건

- 전부 `—`인 열이 없다.
- `36 records / 36 record(s)` 중복이 없다.
- 실제 source가 있는 경우 Oldest/Owner/Overdue가 올바르게 표시된다.
- source가 없는 경우 표가 거짓 metadata 없이 더 간결해진다.

---

### Batch 4 — P1: 미래월·무활동월·clear 상태 의미 수정

#### 미래월

- `Future period — monitoring not started`를 주 상태로 표시한다.
- nextStatus가 없으므로 transition CTA를 표시하지 않는다.
- `Hard blockers 0` green success card 또는 클릭 가능한 zero blocker card를 표시하지 않는다.
- `No server-enforced blocker prevents the next transition`처럼 존재하지 않는 transition을 말하지 않는다.

#### 과거 무활동월

- `No activity — no close record`를 주 상태로 표시한다.
- `NOT STARTED → REVIEWED`, 0 blocker, 0 review flag, 0 active workload 카드 4개를 그대로 보여 주지 않는다.
- zero-activity close가 실제 정책과 기존 action으로 지원될 때만 그 CTA를 제공한다.
- 정책이 코드에서 확인되지 않으면 CTA를 만들지 않는다.

#### Clear taxonomy

클라이언트에서 `count === 0`이라는 이유만으로 `Cleared`로 분류하지 않는다.

```text
OPEN
  실제 검토/처리 필요

VERIFIED_CLEAR
  검증 근거와 검증 완료 상태가 서버에 존재

NO_SIGNAL
  해당 월에 open signal 없음

NOT_EVALUATED
  아직 평가하지 않았거나 근거 없음
```

- 서버가 verified metadata를 제공하지 않으면 현재 `Cleared controls`를 `Controls with no open signal`로 변경한다.
- `Verified clear`를 도입하는 경우에만 `verifiedAt`, `verifiedBy`, evidence link를 요구한다.
- disclosure label은 펼침 상태에 따라 `Show ...` / `Hide ...`로 변경하고 `aria-expanded`와 일치시킨다.

#### 완료 조건

- 미래월에 actionable success나 transition CTA가 없다.
- 무활동월에 `9 cleared`가 없다.
- 데이터 없음, open signal 없음, 검증 완료가 서로 다른 상태로 보인다.

---

### Batch 5 — P1/P2: CTA, 문구, 상단 밀도, 관련 원장 개선

#### 상태별 CTA를 명시적 map으로 구현

enum을 소문자로 붙여 문장을 만들지 마라.

```text
NOT STARTED → Review monthly totals
REVIEWED    → Prepare tax declaration
DECLARED    → Record tax payment
PAID        → Run final close checks
CLOSED      → View closed period
FUTURE      → transition CTA 없음
NO ACTIVITY → 실제 zero-close 정책이 있을 때만 Create zero-activity close
```

문구는 기존 실제 화면 행동과 일치하도록 최종 확인하라. 버튼을 눌렀을 때 단순 view인지 mutation 준비인지 명확해야 한다.

#### 1440×900 레이아웃

현재 첫 Active control row는 y=1078에 있어 화면 밖이다. 다음 목표를 만족하도록 기존 컴포넌트와 CSS를 간결하게 조정한다.

- Page title, month picker, state, generated age, refresh, next action을 compact command area로 구성한다.
- month/state/generated 정보를 각각 한 번만 표시한다.
- 큰 설명과 빈 vertical space를 줄인다.
- Decision summary는 최대 한두 줄 또는 높이 120px 이하를 목표로 한다.
- 1440×900, browser zoom 100%에서 Active controls header와 첫 전체 row가 보이게 한다.
- 첫 row bottom은 반드시 900 이하, 권장 820 이하로 한다.
- 1440에서 action label과 핵심 값이 줄바꿈으로 깨지지 않게 한다.
- 1024px 이하 media query는 수정 목표나 검수 결과에 포함하지 않는다.

#### KPI/link 규칙

- 실제 subset을 열 수 있는 숫자만 clickable card/link로 둔다.
- 0건이고 열 대상이 없으면 link 역할을 제거한다.
- 빈 `Affected records — · Oldest — · Owner —` scope를 표시하지 않는다.
- screen reader link name은 `Open active controls`, `Open tax review queue`처럼 짧고 행동 중심으로 지정한다.
- 긴 설명은 `aria-describedby`로 분리한다.

#### Related registers

4개 탐색 링크를 큰 표로 유지할 실익이 없다면 기존 compact link pattern으로 바꾼다. 새 component abstraction을 만들기 전에 기존 link group을 찾는다.

표시 scope는 같은 차원으로 맞춘다.

```text
Settlement audit · 2026-08
General ledger · 2026-08
Reversals · 2026-08
Tax policy · Global
```

#### 문구 정리

- `record(s)`, `control(s)`, `flag(s)`를 제거하고 locale-aware helper 또는 자연스러운 고정 문구를 사용한다.
- raw signal code보다 `Tax review`, `Fee evidence`, `Bank match`, `Cash debt` 같은 운영 label을 우선 표시한다.
- `No finance rows`를 선택 월과 상태를 설명하는 구체적 empty copy로 바꾼다.
- `View resolved controls`가 펼친 상태에도 남지 않게 한다.

---

## 5. 보존해야 할 현재 개선 사항

아래 항목은 regression을 만들지 마라.

- 서버 `preflight.blockers` 기반 hard blocker
- 회사 부담 쿠폰을 포함하는 canonical settlement allocation identity
- tax-open, payment-fee, coupon, Partner deposit, payout bank links의 period/source/type/sort/returnTo
- 관련 Settlement audit의 `review=all`
- API 오류 시 unavailable state와 retry, 가짜 0건 미표시
- active control과 zero-signal control의 시각적 분리 방향
- 구체적인 row action label
- table header semantics, form label, keyboard focus, dark theme
- summary API 1회 호출 구조

---

## 6. 구현 방식 제한

- 이 작업을 계기로 Finance 전체를 재설계하거나 파일을 대규모 이동하지 마라.
- 단일 사용처를 위한 factory, registry, generic framework를 새로 만들지 마라.
- 이미 있는 helper/type/component를 먼저 찾아 재사용하라.
- public URL query를 불필요하게 rename하지 마라.
- 관련 없는 페이지 문구나 디자인을 일괄 변경하지 마라.
- fixture에만 맞는 hard-coded month, count, owner를 production code에 넣지 마라.
- 실데이터 근거 없이 `verified`, `cleared`, `owner`, `overdue`를 표시하지 마라.
- Prisma schema/migration, auth, wallet, payment, matching, shared types 등 `AGENTS.md` 보호 영역을 건드려야 한다면 먼저 필요성을 증명하고 해당 scope/full verification을 수행하라.
- 포매터나 line-ending 변경으로 관련 없는 대규모 diff를 만들지 마라.

---

## 7. 필수 테스트

현재 테스트를 단순히 수정해 통과시키지 말고, 새로운 계약이 실패하면 깨지는 assertion을 추가한다.

### Admin Web 대상 테스트

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- `
  app/finance-tax/page.spec.tsx `
  app/finance-tax/tax-settlement-page-model.spec.ts `
  app/finance-tax/booking-settlement-audit/page.spec.tsx `
  app/finance-tax/booking-settlement-audit/[id]/page.spec.tsx `
  app/cash-settlements/page.spec.tsx `
  app/cash-settlements/cash-settlement-page-model.spec.ts
```

### API 대상 테스트

실제 test name을 확인한 뒤 최소한 다음 범위를 실행한다.

```powershell
npm.cmd test --workspace @massage-vn/api -- `
  src/earnings/earnings.service.spec.ts -t "cash settlement"

npm.cmd test --workspace @massage-vn/api -- `
  src/admin/admin.controller.spec.ts -t "cash settlement"

npm.cmd test --workspace @massage-vn/api -- `
  src/admin/admin.service.spec.ts -t "monthly tax closing"
```

### 타입 검사

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
```

### Scope 검사

```powershell
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

보호 영역이나 공통 계약을 변경했다면 `AGENTS.md`가 요구하는 full local verification도 수행한다. 환경이나 기존 unrelated failure 때문에 실행하지 못한 검사는 숨기지 말고 정확한 명령, 오류, 이번 diff와의 관련성을 보고한다.

### 반드시 추가할 회귀 계약

1. Cash debt link가 선택 period와 returnTo를 보존한다.
2. Cash debt overview amount와 destination summary/list amount가 같다.
3. 서로 다른 월의 cash settlement row가 섞이지 않는다.
4. in-SLA tax-open row는 integrity exception이 아니다.
5. overdue/evidence/integrity/preflight 상태가 각각 올바르게 분류된다.
6. 미래월에는 transition CTA와 clickable zero blocker card가 없다.
7. 무활동월에는 `cleared`라는 표현이 없다.
8. affected records와 exposure가 같은 count를 중복 표시하지 않는다.
9. availability가 없는 Owner/Oldest 열을 렌더링하지 않는다.
10. overview → queue → detail → queue → overview 왕복에서 period가 유지된다.

---

## 8. 실제 브라우저 검증

로그인된 in-app browser 세션을 사용해 코드를 수정한 뒤 실제 화면을 확인하라. read-only navigation과 disclosure/filter 조작만 수행하고 재무 mutation은 실행하지 않는다.

### 고정 환경

- viewport: **1440 × 900**
- zoom: 100%
- 검사 대상: 1440px 이상 desktop만
- 1024px 이하 화면은 캡처·분석·보고하지 않는다.

### 필수 시나리오

1. `/finance-tax?period=2026-08` 현재 활동 월
2. `/finance-tax?period=2026-09` 미래 월
3. `/finance-tax?period=2025-01` 과거 무활동 월
4. Open tax rows 클릭 후 tax-open queue classification 확인
5. Cash debt 클릭 후 URL period와 도착 합계 확인
6. queue → detail → queue → overview period round-trip
7. no-signal disclosure의 열림/닫힘 label과 keyboard focus 확인
8. dark theme에서 주요 텍스트와 상태 확인
9. 오류 상태는 가능하면 mock/test로 확인하고 production 데이터를 깨뜨려 재현하지 않는다.

### 레이아웃 실측

브라우저 DOM에서 다음 값을 실제로 측정한다.

```text
command area bottom
decision summary bottom
active section top
active table header top
first active row top/bottom
body scroll height
```

첫 active row bottom이 900 이하인지 수치로 보고한다.

### 결과 캡처

다음 폴더를 만들고 핵심 상태별 1440×900 스크린샷을 저장한다.

```text
output/finance-tax-remediation-verification-2026-08-10/
```

최소 캡처:

```text
01-current-period-top-1440x900.png
02-active-controls-1440x900.png
03-future-period-1440x900.png
04-no-activity-period-1440x900.png
05-tax-workflow-drilldown-1440x900.png
06-cash-debt-period-drilldown-1440x900.png
07-dark-theme-1440x900.png
```

UI 파일 변경이 끝난 뒤 Impeccable detector를 대상 변경 파일에 **한 번만** 실행하고, 실제 이 화면에 적용되는 finding만 판단한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <changed UI targets>
```

---

## 9. 완료 판정

다음이 모두 충족되기 전에는 “완료”라고 하지 마라.

### P0

- [ ] Cash debt destination이 선택 월과 동일한 subset을 보여 준다.
- [ ] overview/list의 cash debt 금액이 일치한다.
- [ ] tax workflow와 integrity exception이 분리됐다.
- [ ] 동일 settlement의 분류가 overview/list/detail/export에서 같다.
- [ ] period round-trip이 유지된다.

### P1

- [ ] 전부 `—`인 Owner/Oldest 열이 없다.
- [ ] count와 exposure를 중복하지 않는다.
- [ ] 미래월에 잘못된 success/transition UI가 없다.
- [ ] 무활동월과 verified clear가 구분된다.
- [ ] CTA가 상태별 실제 행동을 설명한다.
- [ ] 1440×900에서 첫 active row 전체가 보인다.

### 품질

- [ ] 기존 preflight와 settlement formula가 유지된다.
- [ ] 오류 상태가 가짜 0건을 표시하지 않는다.
- [ ] overview API 1회 구조와 bounded query를 유지한다.
- [ ] dark theme, keyboard focus, table/form semantics가 유지된다.
- [ ] 대상 테스트, typecheck, scope verification 결과를 보고했다.
- [ ] 관련 없는 사용자 변경을 건드리지 않았다.

어떤 항목이 기술적·정책적 이유로 불가능하다면 placeholder로 덮지 말고 다음을 최종 보고에 남긴다.

```text
미충족 항목
확인한 코드/데이터 근거
왜 안전하게 구현할 수 없는지
현재 적용한 안전한 fallback
완료에 필요한 정확한 후속 결정
```

---

## 10. 최종 보고 형식

구현 후 다음 순서로 간결하지만 구체적으로 보고하라.

1. **결과** — 운영자 관점에서 무엇이 달라졌는지
2. **P0 해결 증거** — Cash debt 월 일치와 tax taxonomy 일치
3. **1440px 검증** — 첫 row bottom 실측과 상태별 스크린샷 경로
4. **변경 파일** — 파일별 핵심 변경
5. **실행한 명령** — pass/fail/skipped와 개수
6. **보호 영역** — 변경 여부와 추가 검증
7. **남은 위험** — production 성능, 데이터 정책, 실행하지 못한 검사
8. **다음 권장 작업** — 한 가지

추가 감사 보고서만 작성하고 멈추지 말고, 현재 repository 코드에서 구현과 검증을 완료하라.

---

## 프롬프트 작성 기준

이 프롬프트는 다음 원칙으로 구성됐다.

- 목표, 코드·보고서 context, 변경 금지 조건, 완료 조건을 분리했다.
- P0 데이터 계약을 시각 polish보다 먼저 처리한다.
- 실제 근거가 없는 owner/verified/SLA를 생성하지 않는다.
- 기존 helper와 컴포넌트를 재사용하고 신규 의존성·추상화를 피한다.
- 구현 후 자동 테스트와 실제 1440px 브라우저 검증을 모두 요구한다.
- 사용자의 미커밋 변경과 보호 영역을 보존한다.
