# Finance Approvers 출시 보안·운영성 개선용 Codex 마스터 프롬프트

이 문서는 저장소의 영구 지침이 아니라 **한 번의 구현 작업에 그대로 붙여 넣는 실행 프롬프트**다. `AGENTS.md`에 복사하지 않는다. Codex에서 `C:\dev\massage-on-demand-vn`을 workspace로 연 뒤 아래 프롬프트 전체를 사용한다.

---

당신은 HANDS 관리자 시스템의 시니어 보안·재무 플랫폼·백엔드·프론트엔드 엔지니어다. 최신 재감사 보고서를 기준으로 `/finance-tax/finance-approvers`와 연결된 실제 금융 승인 권한을 출시 가능한 수준으로 수정하라.

이 작업은 단순 UI 수정이 아니다. Finance Approver readiness와 실제 돈 이동 authorization을 하나의 검증 정책으로 통일하고, disabled/locked/not-setup/fixture 계정을 fail-closed 처리하며, 긴급 계정 정지 deadlock과 공유 DB를 오염시키는 integration test를 해결한 뒤 1440px 운영 UI까지 검증해야 한다.

현재 판정은 **43/100, RELEASE HOLD**다. 아래 P0가 하나라도 남으면 완료 또는 출시 가능으로 보고하지 않는다.

## 1. 작업 위치와 기준 자료

```text
Workspace: C:\dev\massage-on-demand-vn
Primary route: http://localhost:3101/finance-tax/finance-approvers
Audit report: docs/audits/finance-approvers-final-reaudit-2026-08-14.md
Audit evidence: docs/audits/finance-approvers-final-reaudit-evidence-2026-08-14/
Previous implementation prompt: docs/agent/prompts/finance-approvers-remediation-master.md
Target viewport: 1440x1000 이상 데스크톱
Excluded viewport: 1024px 이하 전체 — 검사·수정·보고에 포함하지 말 것
```

보고서와 증거 이미지 8개를 모두 직접 확인하라. 보고서의 line number나 심볼 위치는 감사 시점 참고값일 뿐이므로 현재 코드에서 호출자와 권한 경계를 다시 찾아라.

핵심 코드 후보:

```text
apps/admin_web/app/finance-tax/finance-approvers/**
apps/admin_web/app/finance-tax/approval-queue/**
apps/admin_web/app/refunds/**
apps/admin_web/app/wallet-adjustments/**
apps/admin_web/app/payouts/**
apps/admin_web/app/finance-tax/payment-clearing/**
apps/admin_web/app/admin-operators/**
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
apps/api/src/admin/**/*finance*.spec.ts
apps/api/src/admin/admin-finance-approver-governance.integration.spec.ts
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/**

infra/scripts/check-finance-approver-governance.mjs
infra/scripts/admin-operator-access-migration-dry-run.mjs
infra/scripts/**/*wallet*.mjs
infra/scripts/**/*payout*.mjs
infra/scripts/**/*payment*.mjs
infra/scripts/**/*refund*.mjs
infra/scripts/**/*finance*.mjs
```

## 2. 시작 전 절대 안전 절차

다른 구현보다 먼저 다음을 수행하라.

1. 루트와 관련 디렉터리의 `AGENTS.md`를 끝까지 읽고 따른다.
2. 감사 보고서와 증거 이미지를 모두 확인한다.
3. `git status --short`와 관련 파일 diff를 확인한다. dirty worktree의 기존 변경은 사용자 소유다.
4. `reset`, `checkout`, `restore`, `clean`, `stash`로 기존 변경을 제거하지 않는다.
5. 이 작업과 무관한 Booking, Customer, Partner, Marketing, Notification, Website Content 변경을 보존한다.
6. DB URL, database/schema 이름, `NODE_ENV`, 실행 프로세스를 read-only로 확인해 현재 DB가 disposable test DB인지 공유 local/dev DB인지 판정한다.
7. DB 정체가 불명확하면 integration test, migration apply, fixture cleanup apply, role/provenance mutation을 실행하지 않는다.
8. 소스 수정 전 현재 관련 unit test와 read-only 진단만 실행해 baseline을 기록한다.
9. `Role.FINANCE_APPROVER`, `roles: { has: Role.FINANCE_APPROVER }`, `actorCanApprove`, `currentApprover`, `separateApprover`의 모든 호출자를 전수 검색한다.
10. 변경 계획을 `Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → QA` 순서로 만들고 하나씩 완료한다.
11. 실제 계정 분류, 역할 변경, 레코드 삭제, 공유 DB migration apply는 자동 수행하지 않는다.
12. 구현에 필요한 source/schema/migration 파일은 수정할 수 있지만 공유·운영 DB에는 적용하지 않는다.
13. commit, push, deploy를 수행하지 않는다.

## 3. 현재 데이터에 대한 특별 경고

감사 시작 전 정상 baseline:

```text
High privilege accounts: 12
Production high privilege: 0
Unknown provenance: 11
Fixture: 1
Pending finance access requests: 0
Verified real approvers: 0 / 2
```

감사 중 기존 integration test를 실제 실행하자 append-only `AdminAuditLog` cleanup이 실패해 다음 테스트 데이터가 공유 local DB에 남았다.

```text
Test run ID: finance-governance-1786644908414
Created users: 12
Created production high-privilege users: 9
Created Finance Approvers: 6
Remaining pending requests: 2
Observed post-test totals: 21 high privilege / 9 production / 2 pending
```

이 값은 실제 운영 readiness가 아니다. 특히 `finance-governance-1786644908414:*` 계정을 실제 production approver로 취급하지 않는다.

금지사항:

- 알려진 test run 계정을 실제 담당자로 분류하지 말 것
- 자동 role revoke, 자동 provenance 변경, 강제 삭제를 수행하지 말 것
- append-only audit trigger를 끄거나 우회하지 말 것
- 오염된 post-test count를 release evidence로 사용하지 말 것
- 이름에 `smoke`, `audit`, `demo`, `local`이 포함됐다는 이유로 fixture로 단정하지 말 것

허용되는 작업:

- test run ID 기준 read-only inventory
- 참조 관계와 correction 필요 항목을 출력하는 dry-run
- cleanup apply 전에 사용자 승인을 요구하는 별도 안전 절차 작성
- shared DB에서 integration test를 실행하지 못하게 하는 코드 수정

## 4. 최종 운영 목표

모든 Finance Approver 관련 화면과 실제 돈 이동 API가 다음 동일한 진실을 사용해야 한다.

```text
verified production operator
→ Admin 역할 보유
→ Finance Approver 역할 보유
→ provenance = PRODUCTION
→ Admin credential setup 완료
→ credential disabled 아님
→ 현재 잠금 상태 아님
→ 제품 정책이 요구하는 MFA 검증 완료
→ 해당 금융 action의 category/재인증 조건 충족
→ maker와 checker가 서로 다름
→ 대상·요청·정책 상태가 최신임
→ 서버 트랜잭션에서 최종 재검사
→ 실행·request·audit가 원자적으로 기록됨
```

UI readiness가 BLOCKED인데 실제 돈 이동은 가능한 상태, 또는 UI readiness가 READY인데 실제 checker가 로그인할 수 없는 상태가 절대 없어야 한다.

## 5. 구현 원칙

- 보안 truth는 서버에서 계산한다. UI가 역할 배열만 보고 승인 가능 여부를 추론하지 않는다.
- 공통 predicate와 runtime assertion을 만들고 count, preflight, execute가 같은 규칙을 사용한다.
- 역할 존재만 필요한 비보안 표시와 실제 돈 이동 authorization을 구분한다.
- 기존 maker/checker, stale-state, idempotency, Serializable transaction을 약화하지 않는다.
- 기존 Admin component, Finance table, drawer, filter, notice, action 패턴을 재사용한다.
- 새 UI/data-grid/state/validation 라이브러리를 추가하지 않는다.
- `AdminAuditLog`를 mutable workflow 저장소로 사용하지 않는다.
- 오류를 0건, READY, empty state로 대체하지 않는다.
- 정상 운영 편의를 위해 fixture/unknown/self approval 우회를 만들지 않는다.
- 필요한 최소 범위만 수정하고 전역 권한 프레임워크를 새로 만들지 않는다.
- 검증되지 않은 MFA 상태 문자열이나 production provenance를 만들어 내지 않는다.
- 데이터 owner 증거가 필요한 작업은 코드로 추측하지 말고 remaining blocker로 보고한다.

## 6. Phase 0 — Integration test 격리부터 해결

다른 DB integration test를 실행하기 전에 이 단계부터 구현하라.

### 문제

`admin-finance-approver-governance.integration.spec.ts`의 `afterEach`는 `AdminAuditLog.deleteMany()`를 호출한다. 실제 DB의 append-only trigger가 이를 거부하므로 cleanup이 중단되고 테스트용 production 고권한 계정과 pending request가 공유 DB에 남는다.

### 요구사항

1. Finance Approver DB integration test는 전용 disposable database/schema에서만 실행할 수 있게 한다.
2. main `DATABASE_URL`을 암묵적으로 재사용하지 않는다. 명시적인 테스트 전용 URL 또는 검증된 격리 설정을 요구한다.
3. 실행 전 최소 다음을 검증한다.
   - explicit opt-in flag
   - `NODE_ENV=test` 또는 저장소의 동등한 테스트 신호
   - database/schema 이름이 명시적 test allowlist와 일치
   - production/shared/local 기본 DB 이름과 불일치
4. 조건이 하나라도 맞지 않으면 **첫 write 전에** 안정적인 오류로 중단한다.
5. append-only trigger를 유지한 production parity schema에서 검증한다.
6. 감사 row를 개별 삭제하는 cleanup을 제거한다.
7. 테스트 수명주기는 전용 schema/database 전체 생성·폐기 또는 저장소의 기존 disposable DB harness를 사용한다.
8. disposable DB가 준비되지 않은 현재 환경에서는 integration test를 실행하지 말고 `BLOCKED: dedicated test database required`로 보고한다.
9. guard 자체는 unit test로 검증한다.
10. 기존 오염 레코드용 read-only inventory를 추가할 수 있으나 apply cleanup은 구현 또는 실행하지 않는다.

### 완료 조건

- 공유 DB URL로 실행하면 아무 row도 생성되기 전에 실패한다.
- disposable DB에서만 concurrency/rollback test가 실행된다.
- append-only audit를 삭제하지 않는다.
- 테스트 성공·실패 후 공유 DB high-privilege count와 pending count가 변하지 않는다.

## 7. Phase 1 — 실제 금융 권한을 공통 fail-closed 정책으로 통일

### P0 문제

Finance Approver governance는 fixture를 제외하지만 실제 환불, wallet, bank deposit, withdrawal, payout 등 여러 승인 경로는 `FINANCE_APPROVER` 역할만 확인한다. 현재 fixture 계정은 Finance Approver, Master Admin, 전체 금융 category를 보유하므로 UI 정책과 실행 권한이 불일치한다.

### 7.1 공통 정책 만들기

기존 helper와 permission model을 조사한 뒤 가장 작은 공통 정책을 구현한다. 이름은 현재 convention에 맞추되 다음 역할을 분리한다.

```text
verifiedProductionAdminWhere(now)
verifiedProductionFinanceApproverWhere(now)
assertVerifiedProductionFinanceApprover(db, actorId, context)
financeApproverEligibilityView(operator, now)
```

필수 조건:

```text
roles includes ADMIN
roles includes FINANCE_APPROVER — Finance decision일 때
adminUserProvenance = PRODUCTION
adminOperatorCredential exists
setupCompletedAt is not null
disabledAt is null
lockedUntil is null or <= now
MFA policy satisfied when an enforceable repository signal exists
```

MFA 주의:

- 현재 저장소에 검증 가능한 MFA 완료 상태와 enforcement가 있으면 재사용한다.
- `mfaState`가 단순 문자열이고 실제 검증 계약이 없다면 임의의 값을 production truth로 만들지 않는다.
- 이 경우 고위험 release readiness에 `MFA_NOT_VERIFIED` blocker를 표시하고, enforcement 미구현을 remaining P0로 보고한다.

### 7.2 모든 실제 돈 이동 경로에 적용

최소 다음 흐름과 모든 호출자를 전수 확인한다.

```text
Finance approval queue
Refund approval/rejection
Manual wallet adjustment approval/rejection
Partner bank deposit approval/rejection
Payment clearing/reconciliation decisions
Provider withdrawal bank-transfer paid closeout
Payout closeout/reversal
Cash settlement or journal action requiring an independent Finance Approver
Finance closeout approval paths
Related smoke scripts and preflight summaries
```

각 흐름에서:

1. list/read 권한과 execute 권한을 구분한다.
2. preflight와 execute가 같은 actor predicate를 사용한다.
3. 다른 Finance Approver 존재 여부도 같은 verified predicate로 계산한다.
4. fixture/unknown/not-setup/disabled/locked 계정은 역할과 category가 있어도 decision 불가다.
5. execute trust boundary에서 다시 확인한다. UI나 route guard만 믿지 않는다.
6. 거부 시 안정적인 error code와 operator-friendly message를 제공한다.
7. blocked security audit에 actor, action, reason code, target, request ID를 남긴다. 비밀정보는 남기지 않는다.
8. 기존 maker-cannot-approve와 별도 checker 규칙을 유지한다.

권장 안정 코드 예시:

```text
FINANCE_APPROVER_PRODUCTION_REQUIRED
FINANCE_APPROVER_SETUP_REQUIRED
FINANCE_APPROVER_DISABLED
FINANCE_APPROVER_LOCKED
FINANCE_APPROVER_MFA_REQUIRED
FINANCE_APPROVER_CATEGORY_REQUIRED
```

현재 오류 convention과 충돌하면 기존 패턴에 맞추되 UI와 테스트가 구분 가능한 code를 사용한다.

### 완료 조건

- fixture 계정이 `ADMIN + FINANCE_APPROVER + MASTER_ADMIN + 모든 category`를 가져도 실제 금융 결정을 실행하지 못한다.
- unknown provenance 계정도 실행하지 못한다.
- credential row만 있고 setup이 끝나지 않은 계정은 readiness/checker 수에 포함되지 않는다.
- disabled와 현재 locked 계정은 포함되지 않는다.
- 잠금이 만료된 계정의 처리 기준은 인증 정책과 일치한다.
- UI readiness와 실제 execute authorization의 핵심 predicate가 같다.

## 8. Phase 2 — Governance readiness와 emergency containment 수정

### 8.1 Readiness truth 통일

다음을 Phase 1의 공통 predicate로 교체한다.

```text
verifiedFinanceApproverWhere
eligibleFinanceApproverCandidateWhere
financeApproverDecisionGovernorWhere
financeApproverGovernanceActorView
assertFinanceApproverTargetEligible
availableCheckerCount
verifiedRealApproverCount
independentApproverAvailable
```

동일 계정이 summary에서는 제외되지만 다른 preflight에서는 포함되는 경로가 없어야 한다.

### 8.2 긴급 계정 정지 deadlock 제거

현재 Finance Approver 역할이 붙은 계정은 먼저 역할을 제거하지 않으면 suspend할 수 없고, 역할 제거는 최소 2명 유지 규칙 때문에 막힐 수 있다.

가장 작은 안전한 emergency containment를 구현한다.

1. Master Admin + recent reauthentication 등 기존 고위험 정지 권한을 유지한다.
2. 사고 계정은 Finance Approver 역할 보유 여부와 관계없이 credential disable과 모든 Admin Web session revoke를 먼저 수행할 수 있어야 한다.
3. 긴급 정지는 Finance Approver 역할을 자동 제거하지 않는다.
4. disabled 계정은 즉시 verified coverage와 checker count에서 제외된다.
5. readiness는 coverage 부족으로 BLOCKED가 되고 복구 task를 표시한다.
6. suspend audit에 reason, revoked session count, 이전 역할, incident/change reference를 남긴다.
7. 역할 제거는 기존 maker/checker governance로 별도 처리한다.
8. 비상 정지가 minimum coverage보다 우선한다는 테스트를 추가한다.

### 8.3 Zero-bootstrap 처리

- verified checker가 0명일 때 일반 화면 우회 grant를 만들지 않는다.
- 기존 고권한 계정의 owner/provenance/credential을 Admin Operators에서 검증하면 checker가 될 수 있는지 현재 모델을 우선 활용한다.
- 안전한 기존 bootstrap/setup pattern이 있으면 그것을 확장하되 one-time, environment-guarded, reasoned, audited, idempotent하게 구현한다.
- 안전한 bootstrap authority가 저장소에 없다면 임의 CLI grant를 만들지 말고 UI에 `Bootstrap requires verified operator setup` blocker와 runbook 링크를 제공하고 remaining P0로 보고한다.
- 1인 운영을 이유로 자기 승인이나 fixture 승인을 허용하지 않는다.

## 9. Phase 3 — 기존 권한의 provenance와 baseline accountability

### 9.1 계정 분류 UI 지원

기존 11개 unknown 계정을 코드가 자동 분류하지 않는다. Admin Operators 또는 기존 operator detail 흐름에서 운영자가 다음을 확인할 수 있게 한다.

```text
Owner / work email
Provenance
Credential setup state
Disabled / locked state
MFA state
Roles and finance categories
Last login / last attested
Fixture kind / run ID / expiry when applicable
Finance Approver governance blocker
```

Finance Approvers row와 drawer에서 해당 Admin Operator detail로 이동하는 CTA를 제공한다.

### 9.2 Legacy baseline

현재 12개 기존 Finance Approver는 `No executed change`, History 0건이다.

요구사항:

1. 기존 권한을 가짜 승인 request로 backfill하지 않는다.
2. 기존 durable attestation/workflow가 있으면 재사용한다.
3. 없으면 가장 작은 additive baseline attestation 모델 또는 exact event 흐름을 설계한다.
4. 최소 기록:

```text
target user
roles at attestation
provenance and credential state snapshot
owner evidence reference
attested by
independent reviewer when policy requires
reason
source / migration or import reference
attestedAt
exact audit correlation ID
```

5. 미확인 기존 계정은 `UNVERIFIED_LEGACY_ACCESS`로 표시하고 실제 금융 execute를 차단한다.
6. baseline이 없는 현재 권한과 신규 request history를 한 화면에서 혼동하지 않게 구분한다.
7. schema/migration이 필요하면 additive 파일을 작성하고 validate/generate까지만 수행한다. 공유 DB migration apply는 하지 않는다.

## 10. Phase 4 — 1440px 운영 UI 재구성

1024px 이하는 작업하지 않는다. 1440x1000 이상에서만 검증한다.

### 10.1 Readiness 문구

현재 `Primary coverage`, `Backup coverage`는 실제 담당자 지정이 아니라 단순 count다.

- 명시적 primary/backup assignment를 구현하지 않을 경우 `Verified approvers`와 `Independent backup` 또는 동등한 count 기반 문구로 바꾼다.
- 실제 지정 모델 없이 primary/on-call을 암시하지 않는다.
- blocker마다 해결 CTA를 제공한다.
  - operator 검증 → Admin Operators detail
  - candidate 없음 → Needs verification
  - MFA 미검증 → operator security setup
  - zero bootstrap → setup/runbook
  - coverage 부족 → ready candidate view

### 10.2 Candidate 의미 정리

같은 화면에서 `Eligible candidates 0`과 `10 candidates`가 동시에 보이지 않게 한다.

권장 정보 구조:

```text
Active approvers
Ready for request
Needs verification
Pending requests
History
```

또는 현재 API를 최소 변경하는 동등한 구조를 사용한다.

- `Ready for request`는 실제 request 가능한 계정만 표시한다.
- `Needs verification`은 provenance/credential/MFA/category blocker가 있는 Admin을 표시한다.
- badge의 명사와 count predicate가 일치해야 한다.
- header action은 ready 후보가 없으면 `Resolve candidate blockers`로 바뀌어야 한다.

### 10.3 1440px table을 5열 중심으로 축소

Active/Ready/Needs verification 기본 표:

```text
1. Operator — 이름, work email, account badge
2. Approval authority — Finance Approver / No independent approval authority
3. Readiness — 핵심 blocker 한 줄 + 추가 blocker 수
4. Request status — pending/none + last change
5. Action — 고정 폭, 의미에 맞는 label
```

세부사항은 drawer로 이동한다.

```text
Raw operator ID + copy
전체 blocker
Provenance/credential/MFA detail
Finance categories
Open finance work
Full timestamps
Exact audit links
```

규칙:

- 1440px에서 component-level horizontal scroll 없이 핵심 5열과 action을 볼 수 있어야 한다.
- action button이 한 글자씩 세로로 줄바꿈되면 실패다.
- 항상 `Not available`인 `Open finance work` 열은 authoritative source가 생길 때까지 기본 표에서 제거한다.
- raw ID는 기본 표에 반복 노출하지 않는다.
- blocker 전체 문장으로 row 높이를 과도하게 늘리지 않는다.
- action은 실행 가능성에 따라 다르게 표시한다.

```text
실행 가능: Request change
권한 없음: View access details
검증 필요: Complete operator verification
Pending 존재: Open pending request
```

### 10.4 정확한 권한 문구

`PREPARATION_ONLY`를 역할 부재만으로 계산하지 않는다.

- Finance category를 확인하지 않는다면 label을 `No independent approval authority`로 변경한다.
- 실제 preparation category를 표시하려면 server에서 category를 함께 계산한다.
- Finance Approver grant가 category를 자동 확대하지 않는다면 drawer와 receipt에서 이를 설명한다.

### 10.5 Drawer와 입력 보호

- blocker 해결 CTA를 drawer에 제공한다.
- deep link target이 현재 pagination/filter에 없더라도 target 전용 fetch 또는 명시적 not-found state를 제공한다.
- Cancel, X, backdrop, Escape, browser navigation이 동일한 dirty guard를 사용한다.
- submit 시 dirty를 즉시 해제하지 않는다. 성공 receipt가 확정될 때만 해제한다.
- API 오류 후 reason을 보존하고 닫으려 하면 discard confirm이 나와야 한다.
- 성공 receipt, exact audit link, before/after, requester/checker는 유지한다.

## 11. Phase 5 — Server action fail-closed와 문구 정리

### Decision validation

현재 Web server action은 `decision === 'REJECT' ? 'REJECT' : 'APPROVE'`이므로 missing/오타가 APPROVE로 변환된다.

수정:

1. `APPROVE`, `REJECT`만 허용한다.
2. missing/unknown이면 field error를 반환하고 API를 호출하지 않는다.
3. approve와 reject가 서로 다른 명확한 action label을 사용한다.
4. 고위험 approve에는 현재 Admin interaction pattern과 일치하는 명시적 최종 확인을 사용한다.
5. Enter key, double submit, network retry가 의도하지 않은 APPROVE를 만들지 않게 테스트한다.

### 운영 문구

- `Work email unavailable` → `No work email on record` 또는 현재 product tone의 동등 문구
- `Preparation access only` → 실제 category를 반영하거나 `No independent approval authority`
- `10 candidates` → 실제 predicate에 맞는 `10 admins need verification`
- `Review access` → action 가능성에 맞게 구분
- `How dual control works`에서 checker가 Finance Approver와 Master Admin을 모두 가져야 하는지 명확히 설명
- `Last evaluated`가 server evaluation timestamp임을 설명

## 12. 필수 테스트

### 12.1 공통 actor policy

다음 actor가 readiness, checker count, preflight, execute에서 모두 같은 결과를 내는지 테스트한다.

| Actor | 예상 |
|---|---|
| PRODUCTION + setup complete + active + required role/category + MFA verified | 허용 |
| FIXTURE + 모든 role/category | 거부 |
| provenance UNKNOWN + 모든 role/category | 거부 |
| credential 없음 | 거부 |
| setupCompletedAt 없음 | 거부 |
| disabledAt 존재 | 거부 |
| lockedUntil이 미래 | 거부 |
| 잠금 만료 | 인증 정책에 따른 명시적 결과 |
| MFA 미검증 | 제품 정책에 따라 거부 또는 remaining blocker |
| maker와 checker 동일 | 거부 |

### 12.2 실제 금융 action

최소 다음에 fixture/unknown/disabled actor 차단 test를 추가한다.

```text
refund
wallet adjustment
partner bank deposit
payment clearing/reconciliation
withdrawal paid closeout
payout closeout/reversal
```

mocked UI만 테스트하지 말고 service trust boundary를 검증한다.

### 12.3 Emergency containment

- Finance Approver 역할이 있어도 suspend 가능
- credential disabled
- active sessions revoked
- 역할은 자동 변경되지 않음
- verified coverage에서 즉시 제외
- exact suspend audit 기록
- 자기 정지와 권한 없는 정지는 기존대로 차단

### 12.4 Governance workflow

- request reason 0/1/11/12/500/501
- decision reason 0/1/11/12/500/501
- missing/invalid decision은 API 호출 없음
- self target, self decision, maker decision 차단
- duplicate pending, no-op, idempotency replay
- stale role/version 차단
- 동시 revoke 시 최소 coverage 보존
- 승인 role update와 audit rollback 원자성

### 12.5 Test isolation

- main/shared DB URL이면 first write 전에 실패
- allowlisted disposable DB에서만 실행
- append-only trigger 활성
- 공유 DB count 변화 없음
- cleanup이 audit delete에 의존하지 않음

### 12.6 Admin Web

- API failure와 empty state 분리
- Ready candidate count와 list total 일치
- Needs verification count와 list total 일치
- 권한 없는 사용자는 View-only action
- dirty Cancel/X/Escape/backdrop/navigation
- API 오류 후 입력 보존
- deep link target fetch/not-found
- receipt와 exact audit link

### 12.7 1440px visual verification

인증된 브라우저에서 최소 다음을 1440x1000으로 직접 캡처하고 확인한다.

```text
01-readiness-blocked-or-ready-1440x1000
02-active-approvers-table-1440x1000
03-ready-for-request-1440x1000
04-needs-verification-1440x1000
05-view-only-drawer-1440x1000
06-actionable-request-drawer-1440x1000
07-pending-request-decision-1440x1000
08-history-and-legacy-baseline-1440x1000
09-api-unavailable-1440x1000
10-dark-mode-1440x1000
```

각 이미지를 직접 열어 다음을 확인한다.

- action이 잘리지 않음
- 한 글자 세로 줄바꿈 없음
- 핵심 5열이 horizontal scroll 없이 보임
- blocker가 표를 압도하지 않음
- count와 목록 의미 일치
- focus, disabled, error, success가 텍스트로 구분됨

1024px 이하 screenshot이나 responsive 보고는 만들지 않는다.

## 13. 실행 순서와 검증 명령

현재 package script와 저장소 지침을 먼저 확인하고 실제 존재하는 명령만 사용한다.

권장 순서:

1. 관련 Admin Web unit test baseline
2. 관련 API unit test baseline
3. read-only governance inventory
4. Phase 0 test isolation 구현과 unit test
5. 공통 actor predicate와 API service test
6. 실제 finance decision callers 교체와 focused test
7. emergency containment test
8. governance UI/server action test
9. lint/typecheck
10. disposable DB가 준비됐을 때만 integration test
11. authenticated 1440px browser verification
12. read-only governance inventory 재실행

DB integration command는 Phase 0 guard가 구현되고 disposable DB가 명백히 준비된 뒤에만 실행한다. 준비되지 않았다면 skip이 아니라 명확한 blocked evidence를 남긴다.

## 14. 완료 기준

다음을 모두 충족해야 완료다.

- [ ] fixture/unknown/disabled/locked/not-setup 계정이 실제 금융 decision을 실행할 수 없음
- [ ] readiness, checker count, preflight, execute가 같은 공통 predicate 사용
- [ ] role/category만 많은 fixture 계정의 금융 승인 회귀 테스트 존재
- [ ] shared DB에서 integration test first write 차단
- [ ] append-only audit를 삭제하는 cleanup 제거
- [ ] emergency Finance Approver 계정 suspend와 session revoke 가능
- [ ] zero-bootstrap을 일반 UI 우회로 해결하지 않음
- [ ] 기존 unknown 계정 remediation CTA 제공
- [ ] legacy access가 unattested로 명확히 표시되거나 안전한 baseline workflow 구현
- [ ] Eligible 수치와 탭 목록 predicate 일치
- [ ] Primary/Backup 문구가 실제 count 의미와 일치
- [ ] `Preparation access only` 오표현 제거
- [ ] missing/invalid decision fail-closed
- [ ] dirty Cancel/API error 동작 수정
- [ ] 1440px table action과 핵심 정보가 잘리지 않음
- [ ] API 오류·권한 없음·0건 구분 유지
- [ ] focused unit/lint/typecheck 통과
- [ ] disposable DB concurrency/rollback test 통과 또는 환경 blocker를 정확히 보고
- [ ] 실제 계정·공유 DB 데이터에 승인 없는 mutation 없음

## 15. 완료 보고서와 증거

다음 파일을 작성한다.

```text
docs/audits/finance-approvers-release-hardening-implementation-2026-08-14.md
docs/audits/finance-approvers-release-hardening-evidence-2026-08-14/
```

보고서에 반드시 포함할 내용:

1. 최종 verdict와 점수
2. 수정한 P0/P1/P2 mapping
3. 실제 변경 파일과 핵심 심볼
4. `Role.FINANCE_APPROVER` authorization caller inventory와 교체 결과
5. verified predicate 정의
6. test DB guard와 disposable DB 요구사항
7. 실행한 명령과 pass/fail/skip/blocked 수치
8. 1440px screenshot별 확인 결과
9. 데이터 mutation 목록
10. migration 작성 여부와 적용 여부
11. 알려진 test run 오염 레코드 처리 상태
12. 실제 사람의 owner evidence가 필요한 remaining blocker
13. rollback 절차
14. 출시 승인 체크리스트

최종 응답은 다음 순서로 작성한다.

```text
Verdict
Completed changes
Security invariants
Tests and visual evidence
Data/migration impact
Remaining human/external blockers
Report and evidence links
```

## 16. 중단·에스컬레이션 조건

다음 경우 추측하거나 우회하지 말고 안전한 코드 작업까지 완료한 뒤 사용자에게 정확히 보고한다.

- disposable integration DB가 없음
- MFA에 검증 가능한 완료 상태 또는 enforcement가 없음
- bootstrap authority가 정의되지 않음
- 기존 11개 unknown 계정의 owner evidence가 없음
- known test run cleanup이 append-only audit 또는 FK를 훼손할 수 있음
- 공유 DB migration apply가 필요함
- 실제 production approver 역할 변경이 필요함
- 무관한 사용자 변경과 충돌해 안전한 병합이 불가능함

이 경우에도 구현 가능한 guard, fail-closed policy, UI blocker, unit test, dry-run, 문서는 완료한다. 외부 조건이 남았다는 이유로 이미 안전하게 수행할 수 있는 작업을 생략하지 않는다.

---

이 프롬프트의 목표는 화면을 "좋아 보이게" 만드는 것이 아니라, **운영자가 보는 readiness와 실제 돈 이동 권한이 동일한 검증 정책을 사용하고, 테스트가 운영 데이터를 오염시키지 않으며, 1440px에서 안전하게 판단·조치할 수 있게 만드는 것**이다.
