# Codex implementation prompt — Tax Policy final remediation

아래 프롬프트 전체를 새 Codex 작업에 그대로 입력한다.

---

## Role

당신은 `C:\dev\massage-on-demand-vn` HANDS 모노레포의 시니어 엔지니어이자 관리자 운영 UX 책임자다. 이번 작업은 단순한 화면 미화가 아니라 `/tax-policy`를 실제 운영자가 신뢰할 수 있는 세금 정책 통제 화면으로 개선하는 작업이다.

한 명의 운영자가 실수 없이 현재 정책을 확인하고, 새 정책을 준비하고, 별도 승인자의 검토를 거쳐 예약 적용하고, 문제가 생겼을 때 증거를 추적할 수 있어야 한다.

## Goal

다음 감사 보고서의 미해결 P0와 P1을 실제 코드로 수정한다.

- 감사 보고서: `C:\dev\massage-on-demand-vn\docs\audits\tax-policy-final-reaudit-2026-08-14.md`
- 화면 증거: `C:\dev\massage-on-demand-vn\docs\audits\tax-policy-final-reaudit-evidence-2026-08-14`
- 이전 구현 보고서: `C:\dev\massage-on-demand-vn\docs\audits\tax-policy-remediation-implementation-2026-08-12.md`
- 저장소 지침: `C:\dev\massage-on-demand-vn\AGENTS.md`

감사 보고서에 적힌 해결 완료 항목은 회귀시키지 않는다. 보고서만 다시 작성하고 끝내지 말고, 허용된 범위의 코드·테스트·화면·문구를 직접 수정하고 검증한다.

## Working rules

1. 반드시 `C:\dev\massage-on-demand-vn`에서 작업한다.
2. `C:\dev\massage-vn-workspace`는 사용하지 않는다.
3. 단일 에이전트로 작업한다. subagent나 multi-agent 도구를 사용하지 않는다.
4. 기존 dirty worktree와 사용자 변경을 보존한다. 관련 없는 파일을 되돌리거나 정리하지 않는다.
5. 먼저 감사 보고서, `AGENTS.md`, 관련 코드와 테스트를 읽고 현재 구현을 확인한다. 보고서의 파일/라인 정보가 현재 코드와 다르면 현재 코드를 기준으로 판단하되 차이를 기록한다.
6. 기존 Admin 디자인 토큰, 공용 surface/form/table/badge 컴포넌트와 URL query-state 패턴을 재사용한다. 별도 디자인 시스템이나 대형 UI 의존성을 추가하지 않는다.
7. `/tax-policy`의 네 개 URL-addressable view를 유지한다.
   - `view=current`
   - `view=drafts`
   - `view=history`
   - `view=integrity`
8. 새 top-level Tax Policy 페이지를 추가하지 않는다.
9. 이번 화면 검증 범위는 1440px 이상이다. 1024px 이하 화면은 검사·리포트·수정 범위에 넣지 않는다. 단, 기존 반응형 동작을 의도적으로 훼손하지는 않는다.
10. 사용자에게 보이는 명칭은 `Partner`를 사용한다. 내부 모델·DB 이름의 `provider`는 불필요하게 바꾸지 않는다.
11. 현재 ACTIVE 정책, 세금 로그, 정산 스냅샷, 감사 로그, 기존 145개 정책을 삭제·수정·재분류하지 않는다.
12. 실제 법령명, 법령 URL, 세율, 공포일, 세금 대상, 승인자 신원 또는 운영 근거를 추측하거나 생성하지 않는다.
13. 실제 정책 승인·예약·활성화를 자동 실행하지 않는다. 이 작업은 코드와 안전한 운영 절차를 준비하는 작업이다.
14. production/shared DB에 쓰는 smoke/e2e 명령을 실행하지 않는다.
15. commit, push, 배포는 사용자가 별도로 요청하지 않는 한 하지 않는다.

## Current confirmed facts

다음 사실을 구현 판단의 출발점으로 사용하되, 작업 시작 시 읽기 전용으로 다시 확인한다.

- 현재 ACTIVE 정책: `Smoke withholding 1785768305234`
- 현재 provenance: `SMOKE_TEST`
- 현재 rate: 5%
- 현재 legal source: Missing
- 현재 approval receipt: Not recorded
- 정책 총 145개, 145개 모두 `SMOKE_TEST`
- ACTIVE 1개, INACTIVE/legacy 144개
- ACTIVE smoke 정책에 tax logs 5건, booking settlement snapshots 5건이 연결됨
- 삭제 또는 직접 수정이 아니라 `RETAIN_AND_MANUAL_REVIEW`가 필요함
- History 총 144개
- Tax Policy lifecycle audit 총 725건
- 최근 30일 earnings 123건
- record amount healthy 110/123
- missing tax log 13건
- no approved tax profile 59건

## Preserve these resolved contracts

다음 동작을 반드시 보존하고 회귀 테스트를 유지한다.

- ACTIVE, SCHEDULED, APPROVED, SUPERSEDED, ARCHIVED, legacy-review 정책과 규칙은 제자리 수정 불가
- 변경은 새 DRAFT 버전으로 시작
- maker와 checker는 인증된 실제 사용자 ID에서 결정
- maker는 자신의 요청을 승인할 수 없음
- 승인 요청과 결과는 durable record와 payload hash로 보존
- 미래 정책은 effective time 전까지 현재 ACTIVE를 끄지 않음
- activation은 transaction/lock/idempotency를 사용
- DB가 ACTIVE 하나를 보장
- 생성 정책, optional default rule, audit log가 한 transaction으로 생성
- Vietnam time은 명시적으로 round-trip
- integrity API 실패는 0건이 아닌 unavailable로 표시
- record integrity와 tax applicability는 별도 차원
- audit와 history는 실제 total과 pagination을 표시
- Admin/API의 Tax Policy 접근 카테고리는 `FINANCE_TAX`

## Phase 1 — P0 security and data isolation

### P0-1. Centralize and strengthen verified Finance actor readiness

현재 Tax Policy write 권한과 Finance Approver readiness가 단순히 다음 조건만으로 “verified”를 판단하는지 확인한다.

- production provenance
- credential row 존재

이것만으로는 충분하지 않다. Tax Policy 승인 요청과 승인 결정에 사용할 중앙 readiness/capability 판정을 만든다. 이미 저장소에 신뢰 가능한 공용 predicate가 있으면 반드시 재사용한다. 같은 조건을 여러 서비스에 복사하지 않는다.

판정 시 현재 스키마와 인증 구현에서 실제로 검증 가능한 다음 항목을 포함한다.

- production provenance
- ADMIN 역할
- 작업별 필수 역할: Finance approver decision에는 `FINANCE_APPROVER`
- `FINANCE_TAX` permission category
- operator setup 완료
- credential 존재
- credential disabled 아님
- 현재 시각에 locked 아님
- MFA configured/verified 상태
- 필요한 attestation이 존재하고 유효함
- 현재 세션이 고위험 승인에 필요한 assurance/re-auth 조건을 만족함
- maker와 checker가 서로 다른 immutable user ID

중요:

- 현재 인증 모델에 “최근 재인증”이나 “세션 MFA 검증”을 증명하는 신뢰 가능한 데이터가 없다면 boolean을 추측하거나 단순 `mfaState=CONFIGURED`를 “session verified”라고 부르지 않는다.
- 증명할 수 없는 조건은 명시적 blocker code로 fail closed하고, 구현 보고서에 필요한 후속 인증 작업을 적는다.
- 기존 인증 흐름을 넓게 재작성하지 않는다. 가장 작은 중앙 capability 계층을 만든다.
- API가 `canSubmit`, `canDecide`, blocker codes와 안전한 운영자용 설명을 반환하도록 한다.
- Admin은 `currentOperatorRoles.includes(...)`만으로 승인 폼을 노출하지 말고 서버 capability를 사용한다.
- Finance Approver governance summary와 Tax Policy request/decision이 동일한 readiness 정의를 사용하도록 한다.

필수 blocker 예시 이름은 현재 프로젝트 naming convention에 맞춰 결정하되 다음 의미를 구분한다.

- setup incomplete
- credential missing
- credential disabled
- account locked
- MFA unavailable/unverified
- attestation missing/stale
- recent re-auth required
- Finance Tax permission missing
- Finance approver role missing
- independent checker unavailable
- maker/checker conflict

### P0-2. Prevent fixture writes to a shared operational database

provenance 표시는 격리가 아니다. fixture/smoke actor가 공유 운영 DB에 Tax Policy 데이터를 생성하지 못하도록 첫 write 이전에 차단한다.

1. 기존 환경 분류, test DB guard, smoke-script guard 패턴을 먼저 찾는다.
2. 기존 공용 guard가 있으면 재사용한다.
3. Tax Policy fixture/smoke write는 disposable test database 또는 명시적으로 허용된 isolated environment에서만 가능해야 한다.
4. 환경 식별이 없거나 모호하면 fail closed한다.
5. shared/operational 환경에서는 fixture actor의 Tax Policy create/update/rule/approval write를 거부한다.
6. API smoke/e2e script가 있다면 DB 식별을 첫 write 이전에 검사하도록 한다.
7. Admin이 fixture identity 또는 test environment에서 열렸다면 상단에 지속적인 `Test environment`/`Fixture identity` 경고를 표시한다.
8. 기존 dry-run cleanup은 계속 기본 read-only여야 하며 `--apply`를 새로 허용하지 않는다.

기존 145개 fixture 정책은 삭제하지 않는다. 이 단계의 목적은 추가 오염 방지다.

### P0-3. Prepare a safe replacement workflow without mutating live data

현재 ACTIVE smoke 정책은 이 코드 작업에서 교체하지 않는다. 대신 운영자가 나중에 안전하게 replacement를 만들 수 있도록 UI와 lineage를 수정한다.

- non-`OPERATOR` active/history 정책에는 `Clone as new draft`를 사용하지 않는다.
- action label은 `Prepare clean production draft`처럼 의도를 명확히 한다.
- smoke/seed/legacy source의 name, notes, legal evidence와 세율을 무심코 production draft로 복사하지 않는다.
- 최소한 rate와 자유문구는 비워 두고 운영자가 권한 있는 근거로 다시 입력하게 한다.
- source policy ID와 supersession lineage는 유지한다.
- 화면에 다음 두 축을 별도로 표시한다.
  - `Created by`: draft 작성자/환경 provenance
  - `Source lineage`: smoke/seed/legacy/operator source
- source가 non-production이면 명확한 danger warning과 수동 검토 attestation을 요구한다.
- production approval 요청은 complete legal evidence와 clean-source acknowledgement 없이는 fail closed한다.

새 schema field가 정말 필요하면 기존 모델과 migration을 먼저 검토하고 최소 변경만 한다. schema/migration을 변경하면 protected-area 절차와 전체 검증을 수행한다. 기존 필드로 안전하게 표현할 수 있으면 불필요한 migration을 만들지 않는다.

## Phase 2 — P1 workflow truth and operator efficiency

### P1-1. Preserve mutation context and entered values

다음 모든 action을 확인한다.

- create policy draft
- save policy draft
- create rule
- save rule
- submit approval request
- approve
- reject

성공 시:

- 항상 `view=drafts`를 유지한다.
- 생성/수정된 정확한 `policyId`를 선택한다.
- 정확한 editor anchor로 이동한다.
- 새 draft 생성 결과에서 API가 반환한 ID를 사용한다.

실패 시:

- 400/401/403/409/422/500/timeout을 성공과 구분한다.
- 입력값과 선택 정책을 보존한다.
- legal/rationale 내용을 URL query에 넣지 않는다.
- form-level error summary와 field-level error를 모두 표시한다.
- field error/helper를 `aria-describedby`로 연결한다.
- 첫 invalid field로 focus를 이동한다.
- stale/conflict 오류에는 reload/review 안내를 제공한다.

프로젝트의 기존 `useActionState` 또는 shared form-state 패턴이 있으면 재사용한다. 새 form framework를 도입하지 않는다.

### P1-2. Load the selected policy’s exact approval receipt

정책 목록 pagination과 승인 요청 pagination을 결합하지 않는다.

- selected policy가 있으면 `/admin/tax-policy-approval-requests?policyVersionId=<exact id>` 형태로 exact request를 로드한다.
- general approval queue와 selected-policy receipt를 별도 데이터로 취급한다.
- pending request가 있는데 화면이 새 제출 폼을 보여 주는 상태가 없어야 한다.
- decided receipt도 해당 정책 detail에서 탐색 가능해야 한다.
- API 실패는 `No request`가 아니라 `Approval evidence unavailable`로 표시한다.

### P1-3. Load the exact nearest scheduled activation

Current 화면의 `Next scheduled`를 mixed workspace 첫 25건에서 계산하지 않는다.

- 서버에서 `SCHEDULED`, `effectiveFrom >= now`, ascending, `take=1`을 정확히 조회한다.
- drafts가 25개 이상이거나 scheduled가 여러 개여도 가장 가까운 예약 정책을 반환해야 한다.
- scheduled query 실패 시 `None`이 아니라 `Unavailable`을 표시한다.
- 필요한 경우 기존 list API에 좁은 filter/sort를 추가하거나 작은 summary endpoint를 만든다. 중복 계산 authority는 만들지 않는다.

### P1-4. Fix Create/Clone scroll and focus

현재 URL에 `#create-tax-policy`가 있어도 `scrollY=0`, focus=`BODY`로 남는 문제를 수정한다.

- server-rendered target이 준비된 뒤 `scrollIntoView({ block: 'start' })`를 실행한다.
- section heading 또는 적절한 focus target에 `tabIndex=-1`을 주고 focus를 이동한다.
- Create와 Prepare clean draft 모두 동일하게 동작한다.
- reduced-motion 설정을 존중한다.
- 1440×1000 browser test에서 URL hash, target visibility, focus를 검증한다.

### P1-5. Reduce repeated above-the-fold content

- `view=current`에서만 현재의 expanded six-fact command strip을 유지한다.
- Drafts, History, Integrity에서는 현재 위험을 한 줄/한 카드의 compact status banner로 표시한다.
- critical smoke 경고는 숨기지 않되 같은 긴 문단과 6개 fact를 반복하지 않는다.
- 1440×1000 첫 화면에서 현재 view의 title, 핵심 status, 첫 queue/table/summary가 보이게 한다.
- sticky view navigation은 유지하되 content를 가리지 않아야 한다.

### P1-6. Make Drafts a real work queue

Drafts header에 selected policy가 없어도 다음을 보여 준다.

- verified independent approver readiness
- blocker summary
- Finance Approvers deep link
- queue groups/counts: Needs author, Awaiting checker, Approved, Scheduled

count는 실제 server result를 사용한다. 표본 25개에서 전체 count를 추론하지 않는다.

### P1-7. Fix History truth, filtering and 1440px layout

History는 production evidence와 test/legacy evidence를 구분한다.

- default: Production history
- secondary filter: Test/legacy evidence with exact count
- filters: provenance, lifecycle, effective date range
- search: policy name, policy ID, legal source
- query state는 URL에 보존한다.
- filter/search는 server-side total/pagination과 일치해야 한다.
- unavailable과 zero results를 구분한다.

1440px table 요구사항:

- primary History table에 horizontal scroll이 없어야 한다.
- 다음 5개 운영자 중심 열을 기준으로 재구성한다.
  1. Policy/source
  2. Lifecycle/effective
  3. Rule coverage
  4. Legal/approval readiness
  5. Open
- revision/provenance는 policy cell 안의 secondary metadata로 합친다.
- effective time은 lifecycle cell에 합친다.
- row action은 `Inspect` 또는 `Open` 하나를 기본으로 한다.
- smoke/legacy row의 Clone 버튼은 제거한다.

### P1-8. Turn integrity metrics into actionable queues

다음 non-zero metric을 단순 neutral 숫자로 표시하지 않는다.

- missing tax log
- amount mismatch
- missing immutable snapshot
- no active policy at earning time
- no approved tax profile
- no matching rule

각 metric은 가능한 범위에서 다음을 제공한다.

- exact count
- denominator/rate
- severity based on explicit rule
- oldest affected age
- owner/SLA 또는 “owner not assigned”의 정직한 상태
- `Open records` action

`Open records`는 실제 server-side filtered evidence를 열어야 한다. 빈 링크나 client-side 표본 필터를 만들지 않는다. query state 예시는 `view=integrity&issue=missing-tax-log&page=1`처럼 같은 workspace 안에서 유지한다.

다음을 명확히 구분한다.

- record corruption/integrity 문제
- tax applicability/readiness 문제
- legacy/migration debt
- current pipeline regression

`No approved tax profile`은 금액 불일치와 동일한 위험으로 오해되지 않게 설명한다.

### P1-9. Improve lifecycle audit investigation

- default는 production/operator evidence다.
- test/smoke/legacy evidence는 별도 source filter로 본다.
- action, actor, source/provenance, policy ID, date filters를 제공한다.
- exact total과 server pagination을 유지한다.
- row에서 exact policy로 deep link한다.
- dense metadata는 event detail disclosure/drawer로 분리한다.
- detail에는 사용 가능한 immutable ID, before/after, payload hash, approval request, activation attempt/failure code를 보여 준다.
- copy ID 기능은 가능하면 native clipboard 패턴을 재사용한다.
- export를 구현한다면 현재 프로젝트의 안전한 export 패턴을 재사용하고 민감정보를 추가 노출하지 않는다.

### P1-10. Make simulation wording truthful

현재 simulator가 persisted selected policy만 계산한다면 제목을 `Saved policy preview`로 바꾸고 unsaved form 값을 계산한다고 암시하지 않는다.

가능하면 기존 form architecture를 과도하게 재작성하지 않는 범위에서 unsaved draft model을 preview endpoint에 전달하고 다음을 구현한다.

- current vs proposed withholding
- delta
- selected rule
- service coverage
- boundary amounts
- no-match state

서버는 production calculation function을 재사용해 다시 계산해야 한다. client-only 세금 계산 authority를 만들지 않는다.

unsaved preview가 이번 범위에서 안전하게 구현되지 않으면 정확한 라벨 변경과 설명을 완료하고 후속 위험으로 명시한다. 거짓 preview보다 제한을 정직하게 표현하는 것이 우선이다.

### P1-11. Copy, accessibility and dark theme

- visible `Provider`를 `Partner`로 수정한다.
- immutable source에는 `Editing <name>`을 사용하지 않는다. `Source policy` 또는 `Reviewing source`를 사용한다.
- required 표시, helper, error association을 일관되게 적용한다.
- keyboard-only로 view 이동, draft 열기, form 이동, error recovery가 가능해야 한다.
- focus ring이 sticky nav나 cards에 가려지지 않아야 한다.
- light/dark에서 muted text, borders, warning/danger notice, disabled action, focus ring의 contrast를 검사한다.
- WCAG 통과를 측정하지 않았다면 통과했다고 주장하지 않는다.

## Required tests

기존 테스트를 유지하고 다음 회귀 테스트를 추가한다.

### API/security tests

1. setup incomplete operator cannot submit/decide
2. missing credential cannot submit/decide
3. disabled credential cannot submit/decide
4. locked credential cannot submit/decide
5. MFA/session assurance insufficient cannot decide
6. missing/stale attestation cannot decide when required by current policy
7. fixture actor cannot write Tax Policy in shared/operational environment
8. fixture actor can write only in explicitly isolated test environment
9. maker cannot decide their own request
10. role alone cannot grant decision capability
11. Finance readiness summary and Tax Policy decision use the same predicate
12. selected policy approval query returns only exact policy requests
13. nearest scheduled query returns earliest upcoming item beyond the first 25 mixed rows
14. scheduled query failure is distinguishable from no scheduled item
15. non-operator source cannot silently enter production approval without clean-source acknowledgement

### Admin tests

1. success redirects preserve `view=drafts`, exact policy ID and anchor
2. validation/API failure preserves entered form state
3. field errors have `aria-describedby`
4. first invalid field receives focus
5. pending exact request suppresses duplicate submission UI
6. approval evidence failure is not rendered as no request
7. non-current views use compact command banner
8. history defaults to production evidence and preserves filters in pagination
9. smoke/legacy rows do not show direct Clone
10. integrity non-zero cards expose real filtered actions
11. copy uses Partner
12. persisted-only simulator is labelled Saved policy preview
13. immutable selected source is not labelled Editing

### Browser tests at 1440×1000

1. Current view
2. Drafts empty and populated queue
3. blocked approver readiness
4. exact pending approval receipt
5. invalid create form with preserved values and focused error
6. Create/Prepare clean draft anchor visibility and focus
7. History production/test filters and pagination
8. History table has no horizontal overflow
9. Integrity issue queue and filtered records
10. Audit filter and event detail
11. light and dark theme

1024px 이하 viewport 테스트를 새로 추가하거나 보고서에 포함하지 않는다.

## Validation commands

현재 package scripts를 먼저 확인한 뒤 실제 존재하는 명령만 실행한다. 최소한 다음을 수행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/tax-policy/page.spec.tsx app/tax-policy/actions.spec.ts app/tax-policy/tax-policy-page-model.spec.ts app/tax-policy/tax-policy-audit-summary.spec.ts app/tax-policy/tax-policy-snapshot-consistency.spec.ts app/tax-policy/tax-policy-notice.spec.ts app/tax-policy/tax-policy-time.spec.ts

npm.cmd run test --workspace @massage-vn/api -- src/provider-onboarding/provider-onboarding.service.spec.ts src/earnings/tax-policy-withholding.spec.ts

npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run lint --workspace @massage-vn/admin-web
npm.cmd run lint --workspace @massage-vn/api
npm.cmd run build --workspace @massage-vn/admin-web
npm.cmd run build --workspace @massage-vn/api

npm.cmd run admin:visible-copy
npm.cmd run admin:query-guards
npm.cmd run tax-policy:fixture-cleanup:test
npm.cmd run tax-policy:fixture-cleanup:check
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

조건부 검증:

- Prisma schema/migration, auth, shared types 또는 다른 protected area를 변경했다면 `AGENTS.md`의 matching checks와 `npm.cmd run verify:local`을 실행한다.
- 서비스가 필요한 검증은 기존 local orchestration script를 사용한다.
- destructive cleanup, migration reset, seed, smoke write는 실행하지 않는다.
- 전체 검증이 기존 unrelated failure로 중단되면 해당 실패가 이번 diff와 관련 있는지 증거를 제시한다. 실패를 숨기거나 모두 기존 문제라고 가정하지 않는다.

## Visual verification

코드 수정 후 실제 로그인된 Admin 화면을 새로 캡처하고 직접 검사한다. 기존 감사 스크린샷을 수정 후 증거로 재사용하지 않는다.

필수 viewport:

- 1440×1000
- 가능하면 추가로 1680px 또는 1920px desktop

검사 항목:

- clipping/overflow
- table action visibility
- first-viewport information priority
- scroll/focus destination
- loading/empty/unavailable/error/conflict states
- production vs test evidence distinction
- non-zero exception severity
- form error retention
- light/dark consistency

새 증거는 다음처럼 날짜가 포함된 별도 폴더에 저장한다.

`C:\dev\massage-on-demand-vn\docs\audits\tax-policy-final-remediation-evidence-YYYY-MM-DD`

## Operational migration runbook

코드 수정과 별도로, 현재 ACTIVE smoke 정책을 사람이 안전하게 교체하기 위한 runbook을 작성한다.

파일:

`C:\dev\massage-on-demand-vn\docs\runbooks\tax-policy-smoke-active-replacement.md`

runbook에는 다음을 포함한다.

1. 사전 backup과 read-only inventory
2. authoritative Vietnam legal/accounting evidence 수집
3. production operator draft 생성
4. rule coverage/boundary 확인
5. 다른 verified Finance approver의 검토
6. Vietnam effective time 예약
7. activation 직전/직후 one-ACTIVE 검사
8. calculation sample과 new immutable snapshot 확인
9. audit receipt와 approval payload hash 확인
10. rollback가 아니라 새 corrective version을 사용하는 원칙
11. 기존 smoke policy를 삭제하지 않고 retained historical evidence로 두는 원칙
12. 각 단계의 stop/abort 조건

실제 이름, 법령, 세율, 승인자를 채우지 말고 명확한 placeholder와 required owner를 사용한다.

## Completion criteria

### Code-complete criteria

다음을 모두 충족해야 코드 구현 완료로 보고할 수 있다.

1. Tax Policy와 Finance Approver가 같은 중앙 readiness/capability 판정을 사용한다.
2. 현재 시스템이 증명할 수 없는 session assurance는 fail closed 또는 명시적 blocker로 남는다.
3. fixture actor가 shared/operational DB에 Tax Policy write를 할 수 없다.
4. non-production source에서 production draft를 준비할 때 source lineage와 clean-review가 명확하다.
5. selected policy가 exact approval request를 로드한다.
6. nearest scheduled activation이 전체 데이터 기준으로 정확하다.
7. mutation 성공/실패 모두 Drafts context와 form state를 보존한다.
8. Create/Prepare action이 target을 실제로 scroll/focus한다.
9. History가 production과 test/legacy evidence를 분리하고 1440px에서 가로 스크롤 없이 보인다.
10. integrity exceptions가 real filtered records로 연결된다.
11. audit investigation filters/detail이 동작한다.
12. misleading `Editing`, `Provider`, unsaved preview 표현이 제거된다.
13. 관련 테스트, typecheck, lint, build와 scope verification 결과가 보고된다.
14. fresh authenticated screenshots가 생성되고 직접 검사된다.

### Operational release criteria

코드 완료와 운영 출시 가능을 같은 것으로 보고하지 않는다. 다음은 사람과 실제 운영 증거가 필요하다.

1. 권한 있는 담당자가 production legal/accounting evidence를 입력
2. 실제 production maker와 별도 checker가 승인
3. ACTIVE smoke가 governed OPERATOR policy로 예약 교체
4. 새 정책의 immutable approval receipt와 activation evidence 확인
5. smoke 정책의 연결된 5 tax logs/5 settlement snapshots 보존 확인
6. 실제 두 계정 end-to-end browser verification

이 단계가 수행되지 않았으면 최종 판정은 `Code remediation complete; operational release still blocked`여야 한다. ACTIVE smoke가 남아 있는데 출시 가능이라고 보고하지 않는다.

## Stop rules

- 필요한 법령, 세율, 승인자 또는 production 계정이 없으면 값을 만들지 말고 해당 운영 단계만 blocked로 보고한다.
- schema/auth 변경 없이 충족할 수 없는 보안 조건을 발견하면 가능한 안전한 fail-closed 구현과 테스트를 완료한 뒤 정확한 남은 blocker를 기록한다.
- 실제 shared DB write, 정책 활성화, 승인 행위, destructive cleanup이 필요해지면 실행하지 말고 사용자 승인을 요청한다.
- 관련 없는 광범위한 리팩터링이 필요해 보이면 현재 목표에 필요한 최소 경계까지만 수정한다.
- 한 테스트 실패가 다음 검증을 막지 않으면 나머지 독립 검증도 계속 수행한다.
- 핵심 요구사항과 검증이 완료되면 더 많은 장식이나 새 기능을 추가하지 않는다.

## Required final output

구현 후 다음 구조로 최종 응답과 구현 보고서를 작성한다.

구현 보고서 경로:

`C:\dev\massage-on-demand-vn\docs\audits\tax-policy-final-remediation-implementation-YYYY-MM-DD.md`

필수 내용:

1. 최종 결론: code-complete 여부와 operational release 여부를 분리
2. 감사 P0/P1별 `완료 / 부분 완료 / 차단` 표
3. 변경 파일과 변경 목적
4. API/data/security contract 변경
5. 운영자 화면과 문구 변경
6. 테스트/검증 명령별 PASS/FAIL/SKIPPED와 실제 수치
7. fresh screenshot 목록
8. protected areas touched 여부
9. DB mutation/정책 activation/approval을 수행하지 않았다는 확인
10. 기존 사용자 변경 보존 확인
11. 남은 위험과 수동 운영 단계
12. 다음 한 가지 권장 작업

최종 응답은 결론부터 간결하게 작성하되 실패·미검증·운영 blocker를 숨기지 않는다.

---

## Expected result

이 프롬프트의 목표는 Tax Policy 화면을 단순히 더 예쁘게 만드는 것이 아니다. 운영자가 다음 질문에 화면과 증거만으로 답할 수 있게 만드는 것이다.

1. 지금 어떤 production 정책이 돈 계산을 통제하는가?
2. 그 정책의 법적 근거와 승인자는 누구인가?
3. 다음 정책은 언제, 어떤 검증을 거쳐 적용되는가?
4. 현재 예외는 몇 건이며 어디서 처리하는가?
5. test/smoke 증거와 실제 운영 증거가 명확히 분리되는가?

이 다섯 질문에 정직하고 즉시 답할 수 없으면 작업을 완료로 표시하지 않는다.
