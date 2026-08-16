# Finance Approvers 3개 서브뷰 최종 개선용 Codex 마스터 프롬프트

이 문서는 `view=eligible`, `view=pending`, `view=history` 최종 재감사 결과를 실제 코드 수정으로 연결하기 위한 실행 프롬프트다. 저장소의 영구 규칙인 `AGENTS.md`에 합치지 말고, Codex에서 `C:\dev\massage-on-demand-vn`을 workspace로 연 뒤 아래 프롬프트 전체를 한 번에 사용한다.

---

당신은 HANDS 관리자 시스템의 시니어 재무 플랫폼·보안·백엔드·프론트엔드 엔지니어다. 최신 재감사 보고서를 기준으로 Finance Approvers의 세 서브뷰와 실제 금융 승인 권한 경계를 출시 가능한 상태로 수정하라.

이 작업은 문구나 CSS만 다듬는 UI 작업이 아니다. 화면에 표시되는 `Ready`와 실제 돈 이동 API의 승인 권한이 하나의 검증 정책을 사용하도록 통일하고, 공유 DB 통합 테스트 오염, 긴급 계정 정지 deadlock, legacy 권한 근거 부재, exact audit 오작동까지 함께 해결해야 한다.

현재 판정은 **35/100, RELEASE HOLD**다. 아래 P0가 하나라도 남으면 완료·출시 가능·해결됨으로 보고하지 말라. 보고서만 다시 작성하지 말고 실제 코드를 수정하고 테스트와 화면 증거로 검증하라.

## 1. 작업 위치와 필수 자료

```text
Workspace: C:\dev\massage-on-demand-vn
Primary route: http://localhost:3101/finance-tax/finance-approvers
Eligible: http://localhost:3101/finance-tax/finance-approvers?view=eligible
Pending: http://localhost:3101/finance-tax/finance-approvers?view=pending
History: http://localhost:3101/finance-tax/finance-approvers?view=history

Final audit:
docs/audits/finance-approvers-subviews-final-reaudit-2026-08-14.md

Audit evidence:
docs/audits/finance-approvers-subviews-final-reaudit-evidence-2026-08-14/

Previous prompt for comparison only:
docs/agent/prompts/finance-approvers-release-hardening-master-2026-08-14.md

Verification viewports:
1440x1000 and 1920x1080 desktop only

Excluded scope:
1024px 이하 화면은 검사·수정·테스트·보고 범위에 넣지 말 것
```

가장 먼저 루트와 관련 디렉터리의 `AGENTS.md`를 끝까지 읽어라. 최신 감사 보고서와 7개 증거 이미지를 직접 확인하고, 이전 프롬프트는 이미 구현되었다고 가정하지 말고 현재 코드와 diff로 사실 여부를 다시 확인하라. 보고서의 line number는 참고값일 뿐이므로 현재 심볼과 호출자를 다시 검색하라.

핵심 코드 후보:

```text
apps/admin_web/app/finance-tax/finance-approvers/**
apps/admin_web/app/audit-log/**
apps/admin_web/app/api/admin/audit-log/export/**
apps/admin_web/app/globals.css
apps/admin_web/lib/admin-api.ts
apps/admin_web/lib/admin-operator-access.ts
apps/admin_web/lib/admin-operator-permissions.ts

apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin.dto.ts
apps/api/src/admin/admin-identity.routes.ts
apps/api/src/admin/admin-governance.routes.ts
apps/api/src/admin/admin-user-selects.ts
apps/api/src/admin/admin-operator-category.guard.ts
apps/api/src/admin/admin-finance-approver-governance.integration.spec.ts
apps/api/src/admin/**/*.spec.ts
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/**

infra/scripts/check-finance-approver-governance.mjs
infra/scripts/admin-operator-access-migration-dry-run.mjs
infra/scripts/**/*finance*.mjs
infra/scripts/**/*wallet*.mjs
infra/scripts/**/*payout*.mjs
infra/scripts/**/*payment*.mjs
infra/scripts/**/*refund*.mjs
```

## 2. 절대 안전 규칙

1. `git status --short`와 관련 파일 diff를 먼저 확인한다. dirty worktree의 기존 변경은 사용자 소유다.
2. `git reset`, `checkout`, `restore`, `clean`, `stash` 또는 기존 변경을 덮어쓰는 작업을 하지 않는다.
3. 이 작업과 무관한 Booking, Customer, Partner, Marketing, Notification, Website Content 코드는 건드리지 않는다.
4. DB URL, database/schema 이름, 실행 환경을 read-only로 확인하기 전에는 DB 통합 테스트, migration apply, cleanup apply를 실행하지 않는다.
5. 현재 DB가 disposable test DB/schema임을 기술적으로 증명하지 못하면 DB write를 수행하지 않는다.
6. 실제 관리자 역할, provenance, credential, MFA, request, audit 데이터를 임의 수정·삭제하지 않는다.
7. 알려진 테스트 run도 correction audit와 사용자 승인 없이 삭제하거나 production으로 재분류하지 않는다.
8. append-only audit 보호 장치를 끄거나 우회하지 않는다.
9. source/schema/migration 파일 작성은 가능하지만 shared/local operational DB에 migration을 적용하지 않는다.
10. commit, push, deploy를 수행하지 않는다.
11. `RUN_FINANCE_APPROVER_DB_INTEGRATION=1`만으로는 안전한 실행 허가가 아니다. first-write guard가 완성되고 disposable DB가 증명되기 전에는 해당 테스트를 실행하지 않는다.
12. MFA 상태를 확인할 신뢰 가능한 데이터가 없으면 값을 추정하거나 자동으로 verified 처리하지 말고 `MFA_NOT_VERIFIED`로 fail closed한다.
13. `FINANCE_APPROVER` 역할 하나만으로 production provenance, setup, active credential, MFA, legacy attestation을 충족한 것으로 간주하지 않는다.
14. Master Admin을 금융 checker의 암묵적 우회 권한으로 만들지 않는다. 허용 정책이 존재한다면 명시적 정책과 테스트로 증명한다.

## 3. 현재 데이터 진실과 오염 경고

재감사 당시 read-only 조회 결과는 다음과 같다.

```text
High-privilege accounts: 21
Marked production: 9
Finance Approver role holders: 18
Marked production Finance Approvers: 6
Production setup complete: 0
Production MFA ready: 0
Production last login present: 0
Pending requests: 2
History requests: 4
Unknown high-privilege accounts: 11
Fixture high-privilege accounts: 1
Known polluted run: finance-governance-1786644908414
```

표시상 production approver 6명과 pending 2건, history 4건은 알려진 DB 통합 테스트 잔여 데이터다. 여섯 계정은 `setupCompletedAt = null`, MFA `NOT_CONFIGURED`, `lastLoginAt = null`인데 credential row가 존재한다는 이유만으로 verified로 집계된다. 따라서 현재 UI의 `Ready`, `Verified real approvers 6 / 2`, `Eligible candidates 6`은 운영적으로 거짓 양성이다.

반드시 지킬 것:

- 위 6명을 실제 운영 approver로 보고하지 않는다.
- 테스트 데이터가 readiness, 기본 pending queue, 운영 history를 채우지 못하게 구조적으로 분리한다.
- test email/name heuristic 하나에만 의존하지 않는다. 명시적 provenance/run/schema evidence를 사용한다.
- 기존 오염 레코드는 read-only inventory와 승인 가능한 correction plan만 작성한다.
- legacy 권한을 신규 승인 workflow가 있었던 것처럼 위조 backfill하지 않는다.

## 4. 구현 목표와 우선순위

다음 순서를 바꾸지 말고 단계별로 구현하라.

### Phase 0 — Baseline과 데이터 보호

1. 관련 current code, current diff, current tests를 조사한다.
2. 다음 검색어의 정의와 모든 호출자를 전수 목록화한다.

```text
verifiedFinanceApproverWhere
eligibleFinanceApproverCandidateWhere
financeApproverDecisionGovernorWhere
assertFinanceActionApprovalAdmin
setAdminOperatorSuspended
Role.FINANCE_APPROVER
roles: { has: Role.FINANCE_APPROVER }
actorCanApprove
approvalAdminId
currentApprover
separateApprover
```

3. 현재 role-only 권한 경계 목록을 파일·심볼·행위별로 기록한다.
4. DB 통합 테스트가 공유 DB에 첫 write를 수행할 수 없도록 guard를 가장 먼저 구현한다.

DB first-write guard 완료 조건:

- connection string에서 실제 database와 schema를 파싱한다.
- disposable 전용 allowlist를 명시적으로 요구한다.
- database/schema가 불명확하거나 `public`, shared local/dev, 운영 후보이면 첫 create/update 전에 명확한 오류로 중단한다.
- 단순 env flag, `NODE_ENV=test`, 파일명, localhost 여부만으로 허용하지 않는다.
- 테스트가 사용하는 schema/database만 정확히 teardown한다.
- append-only `AdminAuditLog` trigger가 켜진 parity 환경에서도 정리 가능하도록 row delete 대신 disposable schema/database 폐기 전략을 사용한다.
- guard 자체에 허용/거부 unit test가 있다.
- 공유 DB URL에서 first write가 호출되지 않았음을 spy 또는 명확한 preflight test로 증명한다.

현재 오염 run은 자동 청소하지 말고 다음을 제공한다.

- run ID 기반 read-only inventory
- 연관 user/request/audit/session/credential 참조 목록
- 삭제 또는 correction 전 필요한 승인과 감사 이벤트 계획
- dry-run과 apply 경로의 명확한 분리

### Phase 1 — 검증된 Finance Approver 공통 정책

화면 summary, candidate readiness, governance decision, finance preflight, 실제 execute가 같은 정책을 사용하도록 공통 source of truth를 만든다. 비슷한 Prisma where와 boolean helper를 여러 군데 복제하지 않는다.

최소 검증 조건:

```text
provenance = PRODUCTION
operator/account type = ADMIN
required finance approval role present
setupCompletedAt is present
credential exists
credential disabledAt is null
lockedUntil is null or already expired
MFA is verified/enforceable
legacy baseline is attested, or account was created through the governed workflow
actor is not the request maker when maker/checker separation is required
role/category/current-version constraints are satisfied
```

정책 구현 시 다음을 명확히 구분하라.

- `Verified production finance approver`: 실제 금융 결정을 실행할 수 있는 actor
- `Ready for request`: 아직 역할 변경 요청 대상이지만 account/setup/provenance/MFA blocker가 없는 candidate
- `Needs verification`: 하나 이상의 blocker가 있는 candidate
- `Governance viewer`: 페이지 열람만 가능한 actor
- `Governance requester`: access change 요청을 만들 수 있는 actor
- `Governance checker`: 독립적으로 승인/거절할 수 있는 actor
- `Emergency suspender`: 최근 재인증된 Master Admin 등 별도 비상 권한

정책 결과는 단순 boolean만 반환하지 말고 UI와 API가 같은 blocker code를 사용할 수 있게 안정적인 reason code를 제공한다. 예:

```text
NON_PRODUCTION_PROVENANCE
TEST_OR_FIXTURE_ACCOUNT
UNKNOWN_PROVENANCE
SETUP_INCOMPLETE
CREDENTIAL_MISSING
CREDENTIAL_DISABLED
ACCOUNT_LOCKED
MFA_NOT_VERIFIED
LEGACY_ACCESS_UNATTESTED
ROLE_MISSING
CATEGORY_NOT_ALLOWED
MAKER_CHECKER_CONFLICT
STALE_ROLE_VERSION
```

필드가 현재 schema에 없다고 임의의 truth를 만들어내지 말라. 필요한 경우 최소한의 additive schema/migration을 작성하되 shared DB에는 적용하지 않고, migration·backfill·rollout·rollback 영향을 보고한다.

### Phase 2 — 실제 금융 실행 권한 경계 전수 교체

다음으로 확인된 행위와 검색에서 새로 발견한 모든 finance action의 preflight와 execute를 공통 verified policy로 교체한다.

```text
referral reward cashout paid closeout
booking settlement repair
company bank account approval
bank reconciliation match / reversal / ignore
withholding remittance paid closeout
payment fee policy approve / reject
partner bank deposit approve / reject
manual wallet adjustment approve / reject
provider withdrawal paid closeout / reversal
payout paid closeout / reversal
finance approval queue preflight
```

완료 기준:

- list/preflight와 execute가 같은 정책을 사용한다.
- UI에서 버튼을 숨기는 것만으로 권한을 보호하지 않는다.
- API trust boundary에서 매번 actor의 최신 상태를 다시 확인한다.
- fixture에 모든 role을 넣어도 금융 action이 거부된다.
- unknown provenance, setup 미완료, disabled, active lock, MFA 미검증, unattested legacy actor가 안정적인 오류 코드로 거부된다.
- 만료된 lock은 정책 정의대로 처리되고 테스트된다.
- maker가 자기 요청을 승인할 수 없다.
- 승인 직전 상태 변경과 stale role version이 안전하게 거부된다.
- 실제 action handler 단위 회귀 테스트가 있다. helper만 테스트하고 끝내지 않는다.

수정 전후 호출자 inventory를 최종 보고서에 표로 남겨 role-only 경계가 0개인지 증명하라. 의도적으로 예외인 경로가 있다면 파일·심볼·사업 규칙·보완 통제를 명시하고 RELEASE HOLD로 남긴다.

### Phase 3 — Emergency containment와 legacy accountability

#### 3-1. Emergency suspend

현재 `setAdminOperatorSuspended()`는 Finance Approver 역할 보유자를 credential disable/session revoke 전에 차단한다. 탈취 계정에서 위험한 deadlock이다.

다음 흐름으로 수정한다.

1. 권한 있는 emergency actor와 최근 재인증을 검증한다.
2. target이 Finance Approver여도 credential disable과 모든 active session revoke를 먼저 수행할 수 있게 한다.
3. 역할을 비상 동작에서 자동 제거하지 않는다.
4. disabled target은 verified count와 모든 finance action에서 즉시 제외한다.
5. 역할 제거는 기존 maker/checker governance 요청으로 후속 처리한다.
6. suspend와 unsuspend 모두 audit correlation, actor, reason, target snapshot을 남긴다.
7. 실패 시 부분 적용이 발생하지 않도록 transaction/ordering을 검증한다.

최근 재인증 신호가 시스템에 없다면 이를 있는 것처럼 구현하지 말고 필요한 최소 구조와 rollout blocker를 명시한다.

#### 3-2. Legacy baseline attestation

기존 고권한 계정의 근거를 신규 access request로 위조하지 않는다. 별도 attestation event/model 또는 현재 architecture에 맞는 동등한 append-only 구조를 사용한다.

최소 evidence:

```text
target owner identity
roles snapshot
provenance
setup / credential / disabled / lock / MFA snapshot
finance category/scope
attestor
independent checker
reason
source reference
created/decided timestamps
exact audit correlation
```

attestation 전 legacy finance execute는 fail closed한다. 기존 레코드를 자동 production으로 분류하거나 임의 승인하지 않는다. 실제 사람 승인·owner evidence·MFA 준비는 코드로 해결할 수 없는 human blocker이므로 최종 보고서에 분리한다.

### Phase 4 — API/View model을 운영 판단 중심으로 정리

세 화면이 raw DB 존재 여부로 서로 다른 판단을 하지 않게 API가 계산한 공통 policy 결과를 내려준다.

필요한 응답 정보 예시:

- source/provenance: Production / Test run / Fixture / Unknown / Legacy
- test run ID 또는 source reference
- setup state
- credential active/disabled/locked state
- MFA verified state
- role/category/current version
- readiness status와 blocker codes
- request age, SLA, assignment/owner
- actor가 할 수 있는 action과 할 수 없는 이유
- exact audit target/correlation
- legacy attestation 상태

민감 정보를 과도하게 노출하지 말고, 화면별로 필요한 최소 DTO를 사용한다. `Open finance work`가 authoritative source로 계산되지 않는다면 기본 표와 readiness에서 제거하고, 신뢰 가능한 집계가 생길 때까지 `Not available`을 반복 표시하지 않는다.

### Phase 5 — Eligible 서브뷰 재설계

`Eligible admins` 하나에 request-ready candidate와 remediation 대상을 섞지 않는다.

권장 구조:

1. `Ready for request`
2. `Needs verification`

두 영역의 count와 목록은 반드시 같은 API 조건과 같은 filter scope를 사용한다. 현재의 `Eligible candidates 6` 대 `16 candidates` 같은 불일치를 허용하지 않는다.

상단 CTA:

- ready candidate가 있고 actor에게 요청 권한이 있음: `Request approver access`
- ready candidate가 없음: `Resolve candidate blockers`
- actor에게 요청 권한이 없음: `View governance requirements`

기본 표는 5열로 제한한다.

| 열 | 표시 내용 |
|---|---|
| Operator | 이름, work email, source badge |
| Account readiness | setup, active/locked, MFA 핵심 상태 |
| Approval readiness | Ready 또는 첫 blocker와 `+N` |
| Request status | none/pending, last change |
| Next action | Request change / Complete verification / Open pending / View details |

raw ID, 전체 blocker, category, timestamps, audit/open-work 상세는 drawer로 이동한다. `No work email on record`은 데이터 품질 상태로 명확히 표시한다. Action 영역은 고정 폭 또는 안정적인 layout을 사용하고 1440px에서 좌우 스크롤 없이 핵심 5열과 action을 동시에 읽을 수 있어야 한다.

준비되지 않은 대상을 action 가능해 보이는 초록 상태로 표현하지 않는다. 테스트 계정은 `TEST RUN` source badge와 run ID를 표시하되 운영 기본 후보 count에서 제외한다.

### Phase 6 — Pending 서브뷰를 실제 작업 queue로 재설계

기본 6열:

| 열 | 표시 내용 |
|---|---|
| Request | short ID, request age, SLA |
| Target & change | 이름, before → after |
| Maker | 요청자, maker/checker 충돌 여부 |
| Risk check | provenance, setup, MFA, current version |
| Assignment | checker/owner, overdue 상태 |
| Action | Decide request 또는 View request details |

세부 기준:

- 테스트 request는 `TEST RUN` badge와 run ID를 표시하고 운영 queue 기본값에서 제외한다.
- 긴 operator reason은 목록의 주열을 차지하지 않고 요약 + drawer로 이동한다.
- 권한이 없는 사용자는 `Review decision`이라는 실행형 문구 대신 `View request details`를 본다.
- 권한이 있는 독립 checker만 `Decide request`를 본다.
- 권한 부족 시 필요한 역할/조건과 이동 가능한 recovery CTA를 제공한다.
- drawer에 실제 provenance, setup, credential disabled/lock, MFA, category, current role version을 표시한다.
- `Rechecked by the API on decision` 같은 placeholder를 현재 상태 대신 사용하지 않는다.
- `Preparation access only`처럼 실제 category 조회 없이 추정하는 문구를 사용하지 않는다.
- deep link request가 현재 page에 없어도 target-specific fetch로 열거나 명시적 not-found와 `Back to pending queue` 복구 CTA를 제공한다.

### Phase 7 — History를 evidence 중심으로 재설계

기본 6열:

| 열 | 표시 내용 |
|---|---|
| Time / request | 결정·요청 시각, short ID |
| Target / change | 대상, before → after |
| Maker → checker | 독립성 증거 |
| Outcome / reason | 결과와 요약 reason |
| Source | Production / Test run / Legacy attestation |
| Evidence | event count + exact audit |

추가 기준:

- full request ID는 기본 열을 밀어내지 말고 drawer/복사 UI로 이동한다.
- 테스트 history를 production history와 시각·필터·집계에서 구분한다.
- 상단에 `Unattested legacy access N` 경고 queue를 제공한다.
- history count가 테스트 evidence를 실제 governance coverage처럼 보이게 하지 않는다.
- audit link가 정확해지기 전에는 `View exact audit`이라고 부르지 않는다.

### Phase 8 — Exact audit 계약 수정

현재 Finance Approvers는 지원되지 않는 `actions`와 `target`을 링크에 넣지만 Audit Log는 `targetPrefix`만 읽는다. 이 때문에 요청 1건이 아니라 전체 이벤트가 표시되고 refresh/export에서 필터가 사라진다.

가장 작은 올바른 수정은 다음 계약을 사용하는 것이다.

```text
/audit-log?range=all&sort=oldest&targetPrefix=finance_approver_request:{requestId}
```

요구사항:

- 최초 화면, pagination, refresh, filter form, export가 같은 request filter를 보존한다.
- 화면에 현재 exact target이 보인다.
- 다른 request와 무관한 page-view event가 섞이지 않는다.
- request 1건의 expected event count와 목록 count가 일치한다.
- URL만 바꾸고 export/filter model을 놓치지 않는다.

정말 action multi-filter가 필요하면 `actions` contract를 page model, API DTO/query, export, refresh, tests 전체에 end-to-end로 구현한다. 이번 요구를 충족하는 데 불필요하면 기존 `targetPrefix` 계약을 재사용하고 과도한 확장을 하지 않는다.

### Phase 9 — Server action, dirty guard, deep link, semantics

#### 9-1. Decision fail-closed

다음과 같은 default-to-approve 로직을 제거한다.

```ts
decision === 'REJECT' ? 'REJECT' : 'APPROVE'
```

`APPROVE | REJECT` 외의 missing, empty, typo, duplicate/ambiguous 값은 field error로 반환하고 API를 호출하지 않는다. accidental Enter submit도 승인으로 변환되지 않아야 한다.

#### 9-2. Dirty guard

- submit 시작 시 dirty를 해제하지 않는다.
- 성공 receipt와 화면 반영이 확정된 경우에만 dirty를 해제한다.
- API 오류 후 reason/decision 입력을 보존한다.
- Cancel, X, Escape, backdrop, browser/navigation close가 동일한 discard guard를 사용한다.
- 실패 후 close를 시도하면 confirm이 표시된다.
- 성공 후 close에는 불필요한 confirm이 표시되지 않는다.

#### 9-3. Deep link

- 현재 pagination에 없는 `targetUserId` 또는 `requestId`를 조용히 무시하지 않는다.
- target-specific fetch를 사용하거나 명시적인 not-found 상태와 복구 CTA를 제공한다.
- invalid ID, deleted request, permission denied, API unavailable을 구분한다.
- query parameter와 drawer 상태가 어긋나지 않는다.

#### 9-4. Navigation semantics

현재 URL navigation을 `role=tab`으로 표현하면서 `tabpanel`, `aria-controls`, roving focus/arrow-key pattern이 없다. 이 화면이 URL 이동 중심이라면 semantic nav/link와 `aria-current`로 단순화한다. 진짜 tab widget을 유지한다면 WAI-ARIA tab pattern을 완전하게 구현하고 테스트한다. 부분 구현은 허용하지 않는다.

## 5. 문구 수정 기준

다음 의미를 일관되게 사용한다.

| 기존 문구 | 수정 문구 또는 규칙 |
|---|---|
| Primary coverage | `Verified approvers` |
| Backup coverage | `Independent backup available` |
| Eligible admins | `Ready for request` / `Needs verification` |
| N candidates | `N ready / M need verification`처럼 의미를 분리 |
| Preparation access only | 실제 category 정보가 없으면 제거, 필요 시 `No independent approval authority` |
| Work email unavailable | `No work email on record` |
| Review access | 권한에 따라 `Request change`, `Complete verification`, `Open pending`, `View details` |
| Review decision | `Decide request` 또는 `View request details` |
| Last evaluated | `Policy evaluated by server at …` |
| View exact audit | exact 계약이 검증된 뒤에만 사용 |

운영자 문구 원칙:

- 내부 구현 용어보다 “무엇이 문제이고 다음에 무엇을 해야 하는지”를 먼저 쓴다.
- `Ready`, `Verified`, `Production`, `Exact`는 증거가 충족된 경우에만 사용한다.
- status color만으로 의미를 전달하지 않는다.
- raw ID와 기술 세부는 기본 표가 아니라 상세 drawer와 copy action에 둔다.
- permission이 없으면 disabled button만 두지 말고 필요한 조건과 다음 경로를 제공한다.

## 6. 시각·운영 UX 완료 조건

1440x1000과 1920x1080에서 light/dark theme를 직접 열어 확인한다. 1024px 이하 화면은 검사하거나 보고하지 않는다.

반드시 만족할 것:

- core table에 가로 스크롤이 없다.
- Action, Timeline, Audit, Evidence 문구가 한 글자씩 세로로 깨지지 않는다.
- action label은 최대 1~2줄로 읽힌다.
- Eligible 5열, Pending 6열, History 6열의 핵심 정보가 첫 화면에서 비교 가능하다.
- summary count와 현재 filter/list의 의미가 일치한다.
- ready와 needs-verification이 한 목록에 혼합되지 않는다.
- production/test/legacy source가 badge와 문구로 구분된다.
- drawer를 열지 않아도 운영자가 “무엇을 먼저 처리할지” 판단할 수 있다.
- drawer에서는 판단 근거와 exact evidence를 확인할 수 있다.
- API unavailable, empty, not-found, permission denied, stale state가 서로 다른 상태로 표현된다.
- dark theme에서도 surface, text, badge, focus ring, destructive action 대비가 충분하다.
- focus order, Escape, close 후 focus restore, keyboard activation을 직접 검증한다.

기본 screenshot evidence 이름 예시:

```text
01-eligible-overview-1440x1000.png
02-eligible-ready-for-request-1440x1000.png
03-eligible-needs-verification-1440x1000.png
04-pending-operations-queue-1440x1000.png
05-pending-view-only-drawer-1440x1000.png
06-pending-actionable-drawer-1440x1000.png
07-history-source-separated-1440x1000.png
08-history-unattested-legacy-warning-1440x1000.png
09-exact-audit-filter-preserved-1440x1000.png
10-finance-approvers-dark-1440x1000.png
11-finance-approvers-api-unavailable-1440x1000.png
12-finance-approvers-1920x1080.png
```

실제 테스트 데이터로 승인·거절 mutation을 수행하지 말라. mutation evidence가 필요하면 disposable DB가 검증된 환경 또는 deterministic mock/fixture에서만 수행한다.

## 7. 필수 테스트 매트릭스

기존 테스트를 통과시키는 것만으로 완료하지 말고 다음 회귀 테스트를 추가한다.

### 7-1. 공통 정책

```text
production + setup + active credential + verified MFA + role + attestation -> allowed
fixture + every admin/finance role -> denied
test run account -> denied from operational readiness/execute
unknown provenance -> denied
credential missing -> denied
setup missing -> denied
disabled credential -> denied
future lockedUntil -> denied
expired lockedUntil -> policy-defined allowed
MFA not configured/unverified -> denied
legacy unattested -> denied
role/category missing -> denied
maker equals checker -> denied
stale role/request version -> denied
```

### 7-2. 실제 finance action callers

- helper unit test만 작성하지 않는다.
- 확인된 모든 실제 action handler에서 fixture/unknown/disabled actor가 거부되는 테스트를 추가한다.
- preflight가 허용해도 execute 시 상태가 바뀌면 거부되는 테스트를 추가한다.
- caller inventory에 새로 발견한 경로도 포함한다.

### 7-3. DB integration safety

```text
shared DB URL -> guard rejects before first write
unknown DB/schema -> rejects
explicit disposable allowlisted DB/schema -> permits
append-only audit trigger enabled -> test workflow succeeds
cleanup -> exact disposable schema/database teardown only
integration suite -> 4/4 executed and passed only in disposable environment
```

guard와 disposable 환경이 준비되지 않았으면 4/4를 억지로 실행하지 말고 `NOT RUN — unsafe shared DB`로 정확히 보고한다.

### 7-4. Emergency suspend

- finance role target도 credential disable과 session revoke가 가능하다.
- target role은 자동 삭제되지 않는다.
- disabled 직후 verified count와 finance execute에서 제외된다.
- 권한 없는 actor와 recent-reauth 없는 actor는 거부된다.
- audit correlation과 reason이 남는다.

### 7-5. Admin Web action/interaction

```text
missing decision -> field error, zero API calls
invalid decision -> field error, zero API calls
APPROVE -> one correct API call
REJECT -> one correct API call
failed API -> input preserved and dirty remains
Cancel/X/Escape/backdrop/navigation -> same dirty guard
successful submit -> dirty clears
off-page deep link -> fetches target or shows explicit recovery state
invalid/deleted deep link -> explicit not-found
ready count == rendered ready total for same scope
needs-verification count == rendered blocker total for same scope
permission-aware action labels
test source excluded from operational default
```

### 7-6. Exact audit

- request-specific link uses supported query contract.
- initial load, refresh, pagination, filter form, export retain the same target.
- only matching request events are shown/exported.
- exact event count matches visible result.

## 8. 검증 명령 원칙

현재 `package.json`과 `AGENTS.md`에서 실제 script를 확인한 뒤 최소 범위부터 실행한다. 아래 명령은 현재 구조에 맞는 참고값이며, script가 바뀌었다면 정확한 현재 명령으로 조정한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/finance-tax/finance-approvers/actions.spec.ts app/finance-tax/finance-approvers/page.spec.tsx
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "Finance approver|finance approver"
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

보호 영역인 auth/finance/schema/migration을 변경했다면 `AGENTS.md`의 protected-area 요구사항에 맞는 추가 검증과 integration review를 수행한다. 장시간 명령은 결과를 기다리고, 실패하면 원인과 실제 실패 범위를 숨기지 않는다.

DB integration은 다음을 모두 충족할 때만 실행한다.

```text
first-write guard implemented and tested
database/schema identity visibly disposable and allowlisted
append-only trigger parity enabled
teardown target resolved to the same disposable scope
no shared/local operational records can be reached
```

## 9. 완료 금지 조건

다음 중 하나라도 참이면 작업을 “완료”라고 하지 말라.

- UI만 바뀌고 실제 finance execute가 role-only다.
- credential row 존재만으로 verified를 계산한다.
- MFA truth가 없는데 Ready로 표시한다.
- 테스트 run이 verified count, 기본 pending, production history에 포함된다.
- 공유 DB integration first-write가 기술적으로 차단되지 않는다.
- emergency suspend가 finance role 때문에 session revoke 전에 막힌다.
- legacy 권한이 attestation 없이 execute할 수 있다.
- Eligible summary와 목록 count의 의미가 다르다.
- 1440px에서 Action/Timeline/Audit가 세로로 깨지거나 핵심 표에 가로 스크롤이 있다.
- exact audit가 refresh/export에서 request filter를 잃는다.
- missing/invalid decision이 APPROVE로 변환된다.
- API 실패 후 dirty guard가 해제된다.
- invalid/off-page deep link가 아무 안내 없이 빈 화면을 만든다.
- actual production approver 2명의 사람·setup·MFA evidence가 없는데 출시 가능이라고 보고한다.

코드로 해결할 수 없는 실제 운영자 등록, MFA setup, owner attestation, 오염 데이터 correction 승인은 `Human operational blockers`로 분리하고 RELEASE HOLD를 유지한다.

## 10. 재검수 승인 체크리스트

- [ ] 화면 `Ready`와 실제 execute authorization이 같은 공통 정책을 사용한다.
- [ ] setup 미완료 테스트 approver 6명이 verified count에서 제외된다.
- [ ] fixture/test/unknown/unattested actor가 실제 금융 결정을 수행할 수 없다.
- [ ] role-only finance caller 전수 목록의 미해결 항목이 0개다.
- [ ] shared DB integration first-write가 기술적으로 차단된다.
- [ ] disposable DB에서만 integration 4/4가 실행·통과한다.
- [ ] emergency suspend가 역할 제거보다 먼저 credential/session을 차단한다.
- [ ] legacy access에 attestation 또는 명시적 blocker가 있다.
- [ ] Ready/Needs verification count와 목록이 동일한 의미를 사용한다.
- [ ] pending/history에서 test source가 운영 기본 데이터와 분리된다.
- [ ] Eligible 5열, Pending 6열, History 6열이 1440px에서 한눈에 읽힌다.
- [ ] exact audit의 load/refresh/export가 같은 request filter를 유지한다.
- [ ] invalid/missing decision이 API 호출 없이 실패한다.
- [ ] Cancel/X/Escape/backdrop/navigation/API-error dirty guard가 동일하게 작동한다.
- [ ] 없는 target/request deep link가 명시적 오류와 recovery CTA를 제공한다.
- [ ] light/dark 1440과 1920 screenshot evidence가 있다.
- [ ] 실제 운영 approver 2명의 owner/setup/MFA/attestation은 코드 완료와 별도로 검증된다.

## 11. 필수 산출물

코드와 테스트 외에 다음 파일을 작성한다.

```text
docs/audits/finance-approvers-subviews-release-remediation-implementation-2026-08-14.md
docs/audits/finance-approvers-subviews-release-remediation-evidence-2026-08-14/
```

구현 보고서에는 반드시 다음을 포함한다.

1. 최종 판정과 점수
2. 감사 P0/P1 항목별 `완료 / 부분 / 미완료` 매핑
3. 변경 파일과 핵심 symbol
4. verified finance policy의 정확한 조건과 blocker codes
5. role-only finance caller의 수정 전/후 inventory
6. DB first-write guard의 허용/거부 조건
7. 기존 test run inventory와 “변경하지 않은 것”
8. schema/migration/backfill/rollout/rollback 영향
9. 세 서브뷰 IA와 문구 변경표
10. exact audit end-to-end 계약
11. 실행한 테스트 명령, pass/fail/skip 수, 실패 원인
12. 1440/1920 light/dark screenshot evidence 링크
13. 코드로 해결하지 못한 human operational blockers
14. 남은 위험과 출시 권고

증거 없이 “완료”, “안전”, “production-ready”, “exact”, “verified”라고 쓰지 않는다.

## 12. 최종 응답 형식

최종 응답은 다음 순서로 간결하게 작성한다.

```text
1. 최종 결과: RELEASE READY 또는 RELEASE HOLD
2. 실제로 해결한 P0/P1 요약
3. 핵심 변경 파일 링크
4. 테스트 결과와 시각 검증 결과
5. DB/data/migration에 수행한 것과 수행하지 않은 것
6. 남은 human blocker와 정확한 다음 단계
7. 구현 보고서와 evidence 폴더 링크
```

`AGENTS.md`가 요구하는 handoff 형식을 함께 지킨다. 기존 사용자 변경을 보존했는지, 보호 영역을 수정했는지, 실행하지 못한 검증이 무엇인지 명시한다.

---

이 작업의 핵심 원칙은 하나다. **관리자 화면의 초록색 `Ready`는 실제 돈 이동 API가 같은 계정을 승인자로 허용할 때만 표시되어야 한다.** 화면, 권한, 데이터 provenance, 테스트 환경, 감사 evidence가 서로 다른 truth를 사용하면 작업은 미완료다.
