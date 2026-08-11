# Booking Settlement Audit 개선 구현용 Codex 프롬프트

아래의 `붙여넣기용 프롬프트` 전체를 `C:\dev\massage-on-demand-vn`을 workspace로 연 Codex 작업에 그대로 전달한다.

---

## 붙여넣기용 프롬프트

당신은 HANDS 관리자 웹의 재무·정산 도메인을 수정하는 시니어 풀스택 엔지니어이자 Revenue Operations UX 담당자다. 단순히 색상과 간격을 다듬는 것이 아니라, 운영자가 정산 증거의 이상 여부·담당자·기한·다음 조치를 정확하게 판단할 수 있도록 판정 계약, API, 집계, 성능, 목록·상세 UX를 함께 수정하라.

### 1. 작업 목표

`Booking Settlement Audit`을 다음 조건을 만족하는 신뢰 가능한 운영 작업공간으로 완성하라.

- 정상적인 회계·세무 workflow와 실제 integrity exception을 분리한다.
- 결제수단별 reversal 증거 계약을 실제 정산 생성 로직과 일치시킨다.
- command board, queue, 목록, 상세 화면이 동일한 판정과 집계를 사용한다.
- 운영자가 한 레코드의 모든 blocker, 담당자, 기한과 직접 해결 경로를 볼 수 있게 한다.
- 데이터가 증가해도 목록·summary·CSV export가 전체 중첩 데이터를 반복 full scan하지 않게 한다.
- 1440×900 이상의 데스크톱에서 빠르고 읽기 쉬운 화면을 만든다.
- 구현 후 코드, API, 문구, 실제 브라우저 화면과 테스트를 모두 검증한다.

보고서만 새로 작성하고 끝내지 말고, 실제 소스 코드와 테스트를 수정하고 실행해 완료하라.

### 2. 반드시 먼저 읽을 자료

작업 시작 전에 아래 보고서를 처음부터 끝까지 읽고, 보고서의 각 P0/P1/P2 항목을 구현 체크리스트로 옮겨라.

`C:\dev\massage-on-demand-vn\output\booking-settlement-audit-post-remediation-reaudit-2026-08-09\booking-settlement-audit-post-remediation-deep-reaudit-report.md`

주요 대상 경로:

- 목록: `http://localhost:3101/finance-tax/booking-settlement-audit`
- 상세: `http://localhost:3101/finance-tax/booking-settlement-audit/[id]`
- 건강도 판정: `apps/api/src/settlements/settlement-audit-health.ts`
- 정산·reversal 생성 계약: `apps/api/src/settlements/settlements.service.ts`
- 관리자 목록·summary API: `apps/api/src/admin/admin.service.ts`
- 목록 UI: `apps/admin_web/app/finance-tax/booking-settlement-audit/page.tsx`
- 상세 UI: `apps/admin_web/app/finance-tax/booking-settlement-audit/[id]/page.tsx`
- CSV export: `apps/admin_web/app/api/admin/finance-tax/booking-settlement-audit/export/route.ts`
- 관련 전역 스타일: `apps/admin_web/app/globals.css`

먼저 repository의 `AGENTS.md`, package scripts, Prisma/schema/migration 규칙과 현재 dirty worktree를 확인하라. 사용자가 만든 기존 변경을 덮어쓰거나 되돌리지 말고, 이 작업과 관련된 부분만 최소 범위로 수정하라. destructive git 명령을 사용하지 말고 임의로 commit하지 마라.

### 3. 작업 전 기준선 재현

`$impeccable`의 audit/clarify 흐름을 사용하고, 로그인된 in-app browser가 있으면 그대로 활용하라. 화면 평가는 **1440×900 및 1440px 이상 데스크톱만** 대상으로 한다. 1024px 이하, 모바일, 태블릿, 반응형 디자인은 검사·구현·보고 범위에서 제외한다.

수정 전에 최소한 다음 상태를 1440×900에서 직접 확인하고 캡처하라.

1. 기본 `All dates / Needs action / Oldest first`
2. `All records`
3. `Reversed records`
4. 실제 reversed 상세 상단과 Evidence hub
5. `Resolved` 0건 상태
6. 결과가 없는 검색
7. 테이블을 오른쪽 끝까지 가로 스크롤한 상태
8. `More finance pages` 메뉴의 키보드 이동과 Escape
9. 다크 테마

재감사 당시 local 기준선은 다음과 같았다. 이 숫자를 하드코딩하지 말고, 현재 데이터가 달라졌다면 달라진 이유를 확인하라.

- 전체 240건, Needs action 240건
- Journal 30건
- Clearing/bank 107건
- Payment fee 107건이며 당시 clearing queue와 ID 집합이 완전히 같았음
- Tax/period 199건
- Tax open 199건이며 당시 tax/period queue와 ID 집합이 완전히 같았음
- Reversed 40건, reversal incomplete 8건
- Resolved 0건

### 4. 유지해야 할 기존 개선 사항

다음은 이미 개선된 동작이다. 특별한 근거 없이 되돌리거나 약화하지 마라.

- 기본 범위 `All dates / Needs action / Oldest first`
- `All records`가 실제 전체 레코드를 표시하는 동작
- 고객명·파트너명 검색과 회계 기간·결제수단·정렬·page size의 서버 전달
- coupon 비용을 포함한 서버 권위 배분 판정
- source별 reversal evidence와 Evidence hub
- upstream 오류를 빈 성공 상태로 위장하지 않는 처리
- 전체 CSV 내보내기, 전화번호 미출력, export activity 기록
- 상세 진입 후 `returnTo`로 목록 context 복귀
- menu/menuitem, Arrow key, Escape 동작
- 명확한 heading/table semantics, focus-visible, light/dark theme

### 5. P0 — 판정 신뢰성부터 수정

UI 재배치보다 아래 판정 계약을 먼저 수정하고 테스트로 고정하라.

#### P0-1. 정상 Tax workflow를 integrity exception에서 분리

현재 `OPEN` 또는 `DECLARED`인 Tax 상태가 due date와 무관하게 `TAX_WORKFLOW_OPEN` BLOCKER가 되고, blocker가 하나라도 있으면 전체가 `ACTION_REQUIRED`가 된다. 정상적인 월중 workflow를 무결성 오류로 취급하지 마라.

다음과 같이 서로 독립적인 축을 모델링하라. 기존 타입과 호환되는 더 나은 이름이 있으면 사용해도 되지만 의미는 유지해야 한다.

```text
integrityState = CLEAR | ACTION_REQUIRED | UNKNOWN | REVERSED_CLEAR
workflowState  = TAX_OPEN | TAX_DECLARED | TAX_PAID | TAX_CLOSED | REVERSED
urgency        = NORMAL | DUE_SOON | OVERDUE | BLOCKED
```

필수 동작:

- `TAX_PERIOD_MISMATCH`, 증거 누락, 금액 불일치 등은 integrity blocker로 유지한다.
- 정상 `OPEN/DECLARED`는 Tax workflow 상태이지 integrity blocker가 아니다.
- due date 또는 closeout 기준을 넘긴 `OPEN/DECLARED`만 근거가 있는 `OVERDUE` 작업으로 만든다.
- due date를 데이터에서 확인할 수 없으면 정상 또는 overdue를 추측하지 말고 `UNKNOWN`/명시적 미확인 상태로 fail closed 한다.
- `Integrity exceptions` queue에는 실제 증거·배분·중복·불일치만 들어가야 한다.
- Tax 카드와 상세 화면에는 status, due date, urgency와 판단 근거를 표시한다.

#### P0-2. 결제수단별 reversal clearing 계약 정합성

현재 reversal 생성 서비스는 `CASH`와 `CUSTOMER_WALLET`에 external refund clearing을 만들지 않지만 audit health는 모든 reversal에서 refund clearing을 요구한다. 두 코드 경로가 동일한 명시적 정책을 공유하게 하라.

필수 동작:

- audit 판정에 `paymentMethod` 또는 명시적 `reversalClearingRequired` 정책을 전달한다.
- `CASH`와 `CUSTOMER_WALLET`은 external refund clearing을 `NOT_APPLICABLE`로 판정한다.
- 이 두 방식은 journal 및 cash/wallet ledger evidence를 별도 check로 검증한다.
- `CARD`, `MOMO`, `VNPAY`처럼 외부 환불 clearing이 필요한 방식은 증거가 없으면 `FAIL`한다.
- open-period/closed-period와 결제수단 조합에서 동일한 정책을 사용한다.
- 생성 서비스와 감사 서비스에 서로 다른 결제수단 분기표를 중복 작성하지 말고 한 정책 함수/테이블을 공유한다.

#### P0-3. 판정 회귀 테스트

최소 다음 matrix를 테스트하라.

- Tax: 정상 open, 정상 declared, due soon, overdue, period mismatch, due date unknown
- Reversal: CASH, CUSTOMER_WALLET, MOMO, CARD, VNPAY × open-period/closed-period
- clearing required/optional/N/A별 존재·누락·reversed 상태
- reversal PASS지만 다른 blocker가 있는 경우
- 모든 evidence가 clear인 reversal

### 6. P1 — 집계와 queue 정보 구조 수정

#### P1-1. Reversal 집계를 실제 의미대로 분리

`reversedClearCount`를 reversal 증거 완료 건수처럼 사용하지 마라. API summary에 최소 다음 지표를 분리하고 UI 카드도 정확한 지표만 사용하라.

- `reversalEvidenceCompleteCount`: reversal signal이 있고 `checks.reversal === PASS`
- `reversalEvidenceIncompleteCount`: reversal signal이 있고 `checks.reversal === FAIL`
- `reversedWithOtherBlockersCount`: reversal은 PASS지만 다른 integrity blocker가 있음
- `reversedClearCount`: 모든 검사가 clear인 최종 건수

`0 reversal(s) evidenced`와 실제 상세의 reversal PASS가 동시에 나타나면 안 된다. 영어 문구도 어떤 지표인지 정확히 드러내라.

#### P1-2. 모든 blocker와 실제 우선순위 제공

배열 생성 순서의 `health.blockers[0]`을 “Highest blocker”로 표시하지 마라.

- blocker 모델에 `priority`, `owner`, `dueAt`, `blockingCloseout`, `remediationHref`를 제공한다.
- 우선순위 정책을 한 함수에서 결정하고 목록·상세·export가 공유한다.
- 목록에는 `Top blocker + N more`, owner, SLA/due, 직접 해결 CTA를 표시한다.
- 상세에는 모든 blocker를 우선순위순 checklist로 보여 준다.
- 각 blocker는 근거 evidence, 운영 문구, 담당자, 다음 조치, 실제 수정 workspace 링크를 가진다.
- remediation URL은 allowlist/route builder로 만들고 외부 입력을 그대로 링크로 사용하지 마라.

#### P1-3. 중복 queue를 primary lane + reason/status facet으로 정리

14개 review option과 같은 레코드 집합을 중복 표시하는 queue를 그대로 두지 마라. 다음 구조를 기본안으로 사용하되 현재 도메인 구조에 맞는 작은 조정은 허용한다.

Primary queue:

- `Integrity exceptions`
- `Payment evidence`
- `Tax workflow`
- `Reversals`
- `Resolved`
- `All records`

Secondary facets:

- Reason: allocation, journal, clearing, bank match, fee policy, coupon, tax period, unknown
- Status: open, declared, paid, closed, reversed
- Owner: Accounting, Finance Operations, Tax & Period Close

구현 요구:

- Clearing/bank와 fee policy는 `Payment evidence` 안의 reason으로 제공한다.
- Tax period mismatch와 정상 Tax open을 같은 queue로 취급하지 않는다.
- 한 레코드에 여러 reason chip을 동시에 표시한다.
- unique record count와 reason별 overlap count를 구분한다.
- URL query는 새 taxonomy를 명확하게 표현한다.
- 기존 deep link가 있다면 새 query로 redirect 또는 호환 매핑하여 깨뜨리지 않는다.

#### P1-4. Command board의 scope를 명시

검색이나 표 필터 때문에 global backlog가 0처럼 보이지 않게 하라.

- 각 카드에 `Global backlog` 또는 `Filtered result`를 명시한다.
- 가능하면 global summary는 검색어와 표 전용 필터의 영향을 받지 않게 유지한다.
- filtered summary를 함께 보여 준다면 `0 filtered / 107 global`처럼 두 값을 구분한다.
- 카드마다 unique count, overlap, oldest age/SLA, amount at risk, owner와 클릭 후 적용될 filter를 명시한다.
- 데이터 갱신 시점과 timezone을 운영자 형식으로 표시한다.

권장 owner lane:

- Accounting integrity
- Payment evidence
- Tax workflow
- Reversal lifecycle

### 7. P1 — 성능과 데이터 최소화

현재 목록과 summary가 전체 settlement와 중첩 journal/clearing/bank/reversal evidence를 hydrate한 뒤 Node에서 filter/sort하고, 목록은 마지막에 `slice`한다. export는 page마다 이 full scan을 반복할 수 있다. 데이터가 커져도 bounded query가 되도록 수정하라.

#### 요구사항

- list는 DB-side filter/sort와 cursor 또는 안정적인 pagination을 사용하고 현재 page에 필요한 bounded 데이터만 hydrate한다.
- summary는 전체 nested evidence를 Node로 가져오지 않는 aggregate query 또는 indexed read model을 사용한다.
- health가 여러 테이블 계산을 요구한다면 `SettlementAuditHealthSnapshot`에 준하는 read model을 도입하라.
- read model에는 state, workflow, urgency, reason codes, primary owner, risk amount, due/oldest, checkedAt, formulaVersion과 source revision을 저장하고 필요한 index를 둔다.
- journal/clearing/reversal mutation transaction 또는 idempotent reconciliation job으로 snapshot을 갱신한다.
- canonical evidence와 snapshot이 불일치하거나 stale 판정을 확정할 수 없으면 `UNKNOWN`으로 fail closed 한다.
- export는 cursor/seek pagination과 streaming 또는 bounded chunk 처리를 사용하고 동일한 전체 집합을 page마다 재계산하지 않는다.
- export의 성공·실패·부분 실패·행 수·필터·actor activity 기록을 유지한다.
- 목록과 summary에서 사용하지 않는 customer/partner phone select를 제거한다.
- production DB에 임의로 migration을 적용하지 말고, repository 규칙에 맞는 migration 파일과 검증 절차를 제공한다.

현재 구조에 이미 더 단순한 indexed 해결책이 있다면 read model을 새로 만들기 전에 그것을 사용해도 된다. 단, full nested `findMany` 후 Node filter/sort와 export의 반복 full scan이 실제로 제거됐음을 query/code/test/benchmark로 증명해야 한다.

#### 성능 검증

production-like fixture 또는 생성 데이터로 최소 10k/100k 규모를 검증하라. 환경상 100k 실행이 불가능하면 10k 결과와 query count/complexity를 근거로 100k 추정임을 명확히 표시하라. 기준 없는 “빨라졌다”는 완료 증거가 아니다.

기록할 항목:

- API list/summary p50 또는 반복 측정값
- query count와 hydrate된 row 수
- Node heap 또는 응답 payload의 유의미한 변화
- 첫 operator content 표시 시간
- CSV 처리량과 최대 메모리
- 측정 데이터 규모와 warm/cold 조건

### 8. P1/P2 — 1440px 운영 화면 재구성

`$impeccable clarify → distill → layout → optimize → polish` 순서로 적용하라. 브랜드 전체를 재설계하지 말고 현재 관리자 디자인 시스템과 토큰을 재사용한다.

#### 첫 viewport

1440×900에서 첫 완전한 데이터 행이 `y <= 680`에서 시작하도록 정보 밀도를 조정하라.

권장 순서:

1. 한 줄 compact header: 제목, 현재 scope, primary action
2. compact command strip: unique action, overdue, amount at risk, oldest age
3. primary filters: Search, Queue, Owner, Sort, Apply
4. applied-filter chips와 Clear
5. table
6. advanced filters disclosure: range, period, payment method, rows

중요 filter나 queue를 `Additional queues` 같은 발견하기 어려운 숨김 메뉴에 넣지 마라. 자주 쓰는 Queue, Owner, Search, Sort는 항상 노출하고 고급 조건만 disclosure에 둔다.

#### 테이블

1440px에서 다음 5개 의미 열을 우선한다.

1. Record & parties
2. Exposure
3. Evidence & blockers
4. Owner & next action
5. Review

필수 동작:

- 고객 금액, allocation delta, unmatched/at-risk amount를 구분한다.
- evidence 상태와 blocker reason chip을 함께 제공한다.
- enum/ID보다 운영 문구와 next action을 먼저 보여 준다.
- 가로 스크롤을 제거하는 방향을 우선한다.
- 가로 스크롤을 유지한다면 첫 Record 열은 실제 scrollport 왼쪽에 고정되어 사이드바 뒤로 사라지지 않아야 한다.
- DOM E2E에서 `firstHeader.left >= scrollContainer.left`를 검증한다.
- table scroll region의 aria-label, keyboard focus와 focus-visible을 유지한다.

#### 상세 화면

다음 순서로 정보 계층을 정리한다.

1. Audit decision strip: 전체 상태, blocker 수, primary owner, oldest/due, amount at risk
2. All blockers checklist와 remediation CTA
3. Identity
4. Allocation equation
5. Canonical evidence
6. Reversal evidence — signal이 있으면 항상 표시
7. Payment fee/coupon/tax evidence
8. raw ID/sourceKey를 접은 Technical evidence

상단 metric과 overview의 중복을 제거한다. 긴 sourceKey는 축약 표시하되 전체 값을 복사할 수 있고 accessible name이 있어야 한다.

#### 운영 문구

raw enum과 수식명을 그대로 노출하지 마라. 예:

- `CUSTOMER_PLUS_COMPANY_COUPON_V1` → `Allocation rule: Customer payment + HANDS-funded coupon`
- `CLEARING_STILL_OPEN` → `Settlement clearing is still open`
- ISO timestamp → `Checked 09 Aug 2026, 23:30 ICT` 형식
- `Review evidence` → 원인별 `Open clearing`, `Open journal`, `Review tax period`
- `Paid / closed records` → 실제 포함 범위에 맞는 `Resolved evidence` 또는 `Clear & evidenced reversals`

문구는 영어 관리자 UI의 현재 언어 체계를 유지하되, 개발 enum이 아니라 운영자가 바로 행동할 수 있는 표현을 사용한다.

### 9. 오류·빈 상태·권한 경계

- `Resolved 0`이 audit model 오류 또는 historical evidence migration gap 때문일 가능성이 있으면 단순 성공색 빈 상태로 표시하지 않는다.
- upstream 오류, timeout, partial data를 0건 또는 성공 상태로 위장하지 않는다.
- summary와 list 중 하나만 실패하면 어느 범위가 stale/unknown인지 명시한다.
- remediation CTA와 export는 기존 관리자 권한 검사를 유지한다.
- CSV와 목록 payload에 불필요한 PII를 넣지 않는다.
- 금액·세금·정산 값을 추측하거나 client-only로 재계산하지 않는다.

### 10. 테스트와 검증

기존 테스트를 통과시키는 데 그치지 말고 위 계약을 검증하는 회귀 테스트를 추가하라.

필수 테스트:

- Tax normal/due-soon/overdue/unknown/period-mismatch state
- CASH/WALLET/MOMO/CARD/VNPAY reversal matrix
- reversal evidence complete/incomplete/other-blocker/fully-clear summary count
- 한 상세 화면에 모든 blocker가 우선순위순으로 render되는지
- queue unique count와 overlap count
- 검색 0건에서도 global backlog가 0으로 오해되지 않는지
- legacy query/deep link 호환
- list가 bounded rows만 읽는지 또는 read model cursor pagination을 쓰는지
- export cursor/stream completion, large dataset, upstream partial failure와 activity log
- phone이 list/summary select와 CSV에 없는지
- 1440×900 첫 완전한 row 위치
- horizontal scroll을 유지한다면 sticky first column bounding box
- menu Arrow key/Escape, focus-visible, light/dark theme

최소한 기존 관련 명령을 다시 실행하라. repository script가 바뀌었다면 동등한 현재 명령을 사용한다.

```powershell
npm.cmd test --workspace @massage-vn/admin-web -- --run "app/finance-tax/booking-settlement-audit/page.spec.tsx" "app/finance-tax/booking-settlement-audit/[id]/page.spec.tsx" "app/api/admin/finance-tax/booking-settlement-audit/export/route.spec.ts" "app/finance-tax/tax-settlement-page-model.spec.ts"
npm.cmd test --workspace @massage-vn/api -- --run "src/settlements/settlement-audit-health.spec.ts" "src/settlements/settlements.service.spec.ts"
npm.cmd test --workspace @massage-vn/api -- --run "src/admin/admin.service.spec.ts" -t "booking settlement snapshot"
```

Admin/API typecheck도 실행하라. lint/build가 이 workspace에서 합리적인 시간 안에 실행 가능하면 함께 수행한다. 실패를 숨기거나 unrelated failure를 수정 범위에 몰래 포함하지 말고, 기존 실패인지 신규 실패인지 구분한다.

### 11. 완료 수용 기준

아래가 모두 참일 때만 완료로 판정하라.

#### 판정

- 정상 Tax OPEN이 `Integrity exceptions`에 들어가지 않는다.
- overdue Tax는 due date 근거와 함께 별도 작업으로 표시된다.
- CASH/CUSTOMER_WALLET reversal은 external refund clearing 없이 올바른 N/A 판정을 받는다.
- 외부 clearing이 필요한 결제수단은 증거가 없으면 FAIL한다.
- reversal evidence 카드 집계와 실제 상세 check가 일치한다.

#### 운영 UX

- unique backlog와 reason overlap을 구분할 수 있다.
- command board가 Global인지 Filtered인지 명시한다.
- 모든 blocker, owner, due/SLA, next action과 remediation link를 볼 수 있다.
- 중복 queue가 primary lane과 facet으로 정리됐다.
- 1440×900 첫 화면에서 최소 한 개의 완전한 데이터 행이 보인다.
- 테이블 첫 열이 가로 스크롤 후에도 scroll container 왼쪽에서 사라지지 않는다.
- raw enum, 수식명, ISO 시간이 운영 문구로 번역됐다.

#### 성능·데이터

- list가 page 크기만 hydrate하거나 명시적으로 bounded candidate set을 사용한다.
- summary가 전체 nested evidence를 Node로 가져오지 않는다.
- large CSV export가 page마다 전체 후보를 재계산하지 않는다.
- list/summary/export에 불필요한 전화번호가 없다.
- production-like benchmark와 query evidence가 남아 있다.

#### 품질

- 관련 unit/integration/component/E2E와 typecheck가 통과한다.
- 변경 전후 1440×900 캡처가 있다.
- 유지 대상으로 지정한 기존 개선 사항이 회귀하지 않았다.
- 미충족 항목이 있다면 완료라고 주장하지 않고 원인과 다음 작업을 명시한다.

### 12. 작업 방식과 최종 산출물

진행 순서는 다음과 같이 한다.

1. 보고서·AGENTS·현재 코드·스키마·dirty worktree 확인
2. 수정 전 실화면과 API 기준선 재현
3. P0 판정 계약과 matrix test 구현
4. 집계·queue taxonomy·모든 blocker 구현
5. DB-side pagination/read model/export 성능 개선
6. 1440px 목록·상세 정보 구조와 운영 문구 개선
7. unit/integration/component/E2E/typecheck/benchmark 실행
8. 1440×900 실화면으로 재감사하고 남은 결함 수정
9. 구현 보고서 작성

구현 보고서는 다음 경로에 저장하라.

`C:\dev\massage-on-demand-vn\output\booking-settlement-audit-remediation-implementation-report.md`

보고서에는 다음을 포함한다.

- P0/P1/P2별 구현 결과와 변경 파일
- 변경 전후 판정 계약
- queue/URL 호환 관계
- schema/migration/read model 변경과 운영 적용·rollback 주의사항
- 테스트 명령과 실제 pass/fail 수
- benchmark 데이터 규모와 결과
- 1440×900 before/after 캡처 링크
- 수용 기준 체크리스트
- 미완료 또는 외부 의존 항목

최종 응답은 결과를 먼저 말하고, 변경 파일·검증 결과·남은 위험을 간결하게 요약하라. 설명만 하고 멈추지 말고 안전한 범위 안에서 구현과 검증을 끝까지 수행하라.

---

## 프롬프트 사용 시 참고

- 이 프롬프트는 일회성 구현 작업용이다. 저장소 전체에서 반복 사용할 규칙은 `AGENTS.md`로, 재사용 가능한 전문 workflow는 Skill로 옮기는 편이 적합하다.
- 범위가 크므로 한 번에 모든 UI를 바꾸기 전에 P0 판정 계약과 테스트가 먼저 통과했는지 중간 결과를 확인하는 것이 안전하다.
- Codex가 중간에 “보고서만 작성”하려 하면 `실제 구현과 검증까지 완료하라`는 목표를 다시 강조한다.
