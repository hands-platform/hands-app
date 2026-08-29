# Tax Policy 출시 안전성·승인 통제·운영 UX 개선용 Codex 마스터 프롬프트

이 문서는 저장소의 영구 지침이 아니라 **한 번의 구현 작업에 그대로 붙여 넣는 task prompt**다. `AGENTS.md`에 복사하지 말고, Codex에서 `C:\dev\massage-on-demand-vn`을 workspace로 연 다음 이 문서 전체를 실행 프롬프트로 사용한다.

---

당신은 HANDS 관리자 시스템의 시니어 세금 플랫폼·재무 통제·프로덕트 엔지니어다. `/tax-policy`를 실제 1인 또는 소수 운영자가 Vietnam 파트너 원천징수 정책을 안전하게 준비·검토·승인·예약·적용·감사할 수 있는 운영 화면으로 개선하라.

단순 분석, 카드 재배치, CSS 정리, 문구 변경으로 끝내지 않는다. 현재 코드·DB·권한 guard·earning 계산·감사 로그·smoke 수명주기·실제 1440px 이상 화면을 다시 확인하고 **원천징수 중단 위험과 데이터 무결성 P0부터 구현한 뒤 승인 워크플로, 버전 불변성, 운영 UX, 접근성, 오류 복구, 성능, 회귀 검증까지 완료**한다.

현재 감사 판정은 **29/100, Release hold**다. 다음 중 하나라도 남아 있으면 완료로 보고하지 않는다.

- 미래 시점 정책을 ACTIVE로 만들 때 현재 정책이 즉시 비활성화되는 적용 공백
- ACTIVE/SCHEDULED/과거 정책 또는 규칙의 제자리 수정
- 실제 checker 행위 없이 maker가 approver ID를 대신 제출하는 가짜 이중 승인
- 정책 생성과 기본 규칙 생성의 부분 성공
- 상태 변경과 감사 로그의 비원자성
- smoke가 운영 DB의 ACTIVE 정책을 교체하는 동작
- mutation 오류를 `null` fallback으로 삼키는 동작
- 실제 725건 감사를 0건으로 표시하는 broad 검색
- 브라우저/서버 timezone에 따라 effective instant가 이동하는 동작
- SYSTEM_POLICY와 FINANCE_TAX로 갈라진 권한 경계
- 전체 145개 정책을 20개만 보여 주면서 전체 이력처럼 설명하는 화면

## 1. 작업 위치와 기준 자료

```text
Workspace: C:\dev\massage-on-demand-vn
Primary route: http://localhost:3101/tax-policy
Audit report: docs/audits/tax-policy-final-reaudit-2026-08-11.md
Audit evidence: docs/audits/tax-policy-reaudit-evidence-2026-08-11/
Target viewport: 1440x1000 이상 데스크톱
Excluded viewport: 1024px 이하 전체
``` 

필수 증거 파일:

```text
01-tax-policy-overview.png
03-policy-version-list-middle.png
04-create-policy-and-version-list.png
05-withholding-preview.png
06-selected-policy-editor.png
07-rule-editor-and-add-rule.png
08-audit-and-settlement-consistency.png
09-tax-policy-audit-summary.png
10-create-policy-native-validation.png
``` 

주요 코드와 데이터 흐름:

```text
apps/admin_web/app/tax-policy/**
apps/admin_web/components/admin-form-controls.tsx
apps/admin_web/components/admin-form-date-picker-field.tsx
apps/admin_web/components/admin-page-template.tsx
apps/admin_web/components/admin-surface.tsx
apps/admin_web/components/admin-stage-item.tsx
apps/admin_web/components/admin-drawer-surface.tsx
apps/admin_web/components/status-badge.tsx
apps/admin_web/lib/admin-api.ts
apps/admin_web/lib/admin-navigation.ts
apps/admin_web/lib/admin-operator-access-model.ts
apps/admin_web/app/finance-tax/approval-queue/**
apps/admin_web/app/finance-tax/finance-approvers/**
apps/admin_web/app/audit-log/**
apps/admin_web/app/globals.css

apps/api/src/provider-onboarding/provider-onboarding.controller.ts
apps/api/src/provider-onboarding/provider-onboarding.dto.ts
apps/api/src/provider-onboarding/provider-onboarding.service.ts
apps/api/src/earnings/earnings.service.ts
apps/api/src/admin/admin-operator-category.guard.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/**/*.spec.ts
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/**

apps/api/prisma/seed.js
infra/scripts/api-smoke.mjs
infra/scripts/withholding-remittance-lifecycle-smoke.mjs
infra/scripts/check-prisma-migrations.mjs
infra/scripts/**
``` 

보고서의 line number는 감사 시점 참고값일 뿐이다. 현재 코드에서 심볼, 호출자, 실제 권한 경계, DB 관계, 테스트와 실행 동작을 다시 찾아라.

## 2. 최종 운영 목표

운영자가 다음 흐름을 안전하게 완료할 수 있어야 한다.

```text
현재 적용 정책·출처·건전성 확인
→ 새 Draft 생성 또는 기존 정책을 새 Draft로 복제
→ 정책 근거와 규칙 편집
→ 전체 규칙 검증과 current-vs-proposed 영향 시뮬레이션
→ 승인 요청 제출
→ 요청자와 다른 실제 Finance Tax Policy approver가 검토·승인 또는 반려
→ 승인된 정책을 Vietnam timezone 기준 미래 시점으로 예약
→ 적용 시각에 기존 정책과 새 정책을 원자적으로 교체
→ activation receipt와 정확한 감사 이벤트 확인
→ 정산 integrity와 예외 queue 모니터링
``` 

완료 상태는 다음을 모두 만족해야 한다.

1. 미래 정책을 예약해도 적용 시각 전까지 현재 ACTIVE 정책이 유지된다.
2. 적용 시각에 old→new 전환이 원자적으로 일어나며 gap과 overlap이 없다.
3. ACTIVE, SCHEDULED, SUPERSEDED 정책과 규칙은 수정할 수 없다.
4. 변경은 새 Draft version에서만 이루어진다.
5. 실제로 로그인한 다른 checker가 승인하기 전에는 예약·활성화할 수 없다.
6. maker가 approver ID를 대신 선택해 즉시 변경하는 흐름이 없다.
7. 정책·초기 규칙·승인 요청·활성화·감사 기록이 부분 성공으로 남지 않는다.
8. 두 동시 활성화 요청에서도 ACTIVE가 정확히 하나다.
9. 정책 기준 timezone은 `Asia/Ho_Chi_Minh`이며 화면·API·DB round-trip에서 instant가 이동하지 않는다.
10. smoke/seed/fixture가 운영 정책이나 실제 earning 계산을 오염시키지 않는다.
11. 화면은 전체 정책 total, 정확한 감사 total, 데이터 조회 실패를 사실대로 보여 준다.
12. API 401/403/409/422/500/timeout이 각각 복구 가능한 운영 상태로 표시된다.
13. 현재 적용 정책은 production provenance와 승인된 법적/회계 근거를 가진다.
14. 1440px 이상에서 기본 페이지 세로 스크롤 외 중첩 세로 스크롤이 1개를 넘지 않는다.
15. Current, Drafts & scheduled, History, Audit & integrity를 같은 workspace에서 빠르게 전환할 수 있다.

## 3. 시작 전 필수 절차

1. 루트 `AGENTS.md`를 끝까지 읽고 따른다.
2. 감사 보고서를 끝까지 읽고 모든 관련 증거 PNG를 직접 확인한다.
3. `git status --short`와 관련 파일 diff를 확인한다.
4. dirty worktree의 기존 변경은 사용자 소유다. `reset`, `checkout`, `restore`, `clean`, `stash`로 제거하지 않는다.
5. 특히 Finance Approvers, Operations Policy, Service Catalog, Company Bank Accounts 등 무관한 기존 변경을 보존한다.
6. 현재 Admin/API 서버 PID, command line, 시작 시각, Admin build ID와 연결 DB 대상을 확인한다.
7. DB가 local test인지 공유/운영인지 불명확하면 정책 mutation, fixture cleanup apply, migration apply를 수행하지 않는다.
8. 현재 화면의 정책 수, 규칙 수, active policy, 감사 0건, nested scroll, timezone 표시를 baseline으로 기록한다.
9. 관련 관리자 웹·API 테스트를 먼저 실행해 baseline을 남긴다.
10. tax policy create/update/rule mutation의 모든 호출자와 smoke/seed 직접 쓰기를 전부 검색한다.
11. earning withholding engine과 monthly close/withholding/remittance가 policyVersionId/ruleSnapshot을 어떻게 사용하는지 끝까지 추적한다.
12. 기존 approval queue, scheduler/worker, idempotency, advisory lock/serializable transaction, audit outbox 패턴을 조사하고 재사용 가능성을 기록한다.
13. 구현 계획을 `P0-A → P0-B → P0-C → P0-D → P0-E → P0-F → P0-G → P1 → P2 → QA` 순서로 만들고 한 번에 하나만 `in_progress`로 둔다.
14. 저장소 지침대로 단일 에이전트로 수행하고 하위 에이전트에 위임하지 않는다.
15. 실제 데이터 삭제, 운영 정책 변경, 공유 DB migration 적용처럼 추가 승인이 필요한 지점만 사용자에게 확인한다.

## 4. 절대 제약과 구현 원칙

### 보존할 계약

- completed earning과 settlement가 당시 `policyVersionId`와 immutable rule snapshot을 유지하는 계약
- DEFAULT, SERVICE_TYPE, AMOUNT_BAND의 현재 우선순위 의미
- 한 정책 안의 활성 DEFAULT 중복 차단
- SERVICE_TYPE 중복 차단
- AMOUNT_BAND overlap 차단
- 세율 0..10000 bps와 non-negative fixed amount 검증
- Vietnam/VND 범위
- 기존 Admin shell, Vuexy 기반 컴포넌트, Public Sans, spacing/color/token 체계
- `/tax-policy` route와 관련 audit/booking/earning deep link
- 기존 historical policy/tax log/earning 참조의 보존

### 금지사항

- ACTIVE 정책의 필드를 계속 PATCH할 수 있게 두고 확인 dialog만 추가하는 식으로 끝내지 않는다.
- `Separate Finance approver` dropdown 문구만 바꿔 실제 승인처럼 보이게 하지 않는다.
- `AdminAuditLog` 한 행을 유일한 mutable approval workflow 저장소로 사용하지 않는다.
- 새 UI 프레임워크, 새 상태관리 라이브러리, 새 data-grid 라이브러리, 새 form 라이브러리를 추가하지 않는다.
- 이름에 `smoke`, timestamp가 있다는 이유만으로 기존 데이터를 자동 삭제하거나 숨기지 않는다.
- 공유/운영 DB에서 감사 중 발견된 145개 정책·290개 규칙을 임의 정리하지 않는다.
- `take=20` 결과로 전체 readiness를 계산하지 않는다.
- API 실패를 `[]`, `0`, `No policy`, `Configured`로 대체하지 않는다.
- broad q 검색 후 client filtering으로 exact audit를 흉내 내지 않는다.
- frontend confirmation만으로 동시성·권한·승인·원자성 문제를 해결했다고 보고하지 않는다.
- 브라우저 timezone 또는 서버 process timezone에 의존해 effective instant를 계산하지 않는다.
- 1인 운영 편의를 이유로 조용한 자기 승인 또는 fixture 승인자를 허용하지 않는다.
- 1024px 이하 반응형 작업으로 범위를 확장하지 않는다.
- 전역 Admin shell 또는 다른 Finance 페이지 전체를 재설계하지 않는다.

### 최소 구현 원칙

- 기존 approval queue, admin result/error, pagination, drawer, table, notice, audit action 패턴을 먼저 재사용한다.
- 기존 scheduler/queue infrastructure가 있으면 그것을 사용한다.
- 없다면 tax policy에 필요한 가장 작은 durable scheduling 메커니즘만 추가하고 범용 workflow engine을 새로 만들지 않는다.
- shared `TaxPolicyStatus` enum이 platform fee/payment fee에도 사용되는지 확인하고, 그 의미를 깨는 변경을 하지 않는다.
- 상태 enum 확장이 다른 도메인에 위험하면 tax-policy 전용 lifecycle/status model을 additive하게 도입한다.
- schema migration은 additive하고 rollback/compatibility가 가능해야 한다.
- summary, readiness, approval, active policy truth는 서버에서 계산한다.
- 화면은 Operate 모드다. 장식보다 스캔 속도, 위험 인지, 실수 방지, 복구 가능성을 우선한다.

## 5. 감사 시점 사실을 read-only로 재확인

감사 당시 로컬 환경:

```text
Tax policy versions: 145
Policy status: ACTIVE 1, INACTIVE 144
Tax rules: 290
Admin page loaded policies: 20
Admin page displayed rule count: 40
Current ACTIVE policy: Smoke withholding 1785768305234
Current ACTIVE rules: DEFAULT 5%, AMOUNT_BAND 0..500,000 at 5%
Exact tax_policy/tax_rule audit events: 725
q=tax_ audit events: 1,000
Visible audit summary: 0 recent
Provider earnings: 445
Provider tax logs: 351
NO_APPROVED_TAX_PROFILE snapshots: 177
Approved provider tax profiles: 112
Finance approvers in DB: 12
Approver options visible after current actor exclusion: 11
Page document height at 1440x1000: about 4,943px
Independent vertical scroll regions: policy list, selected editor, consistency list
Stored active effectiveFrom: 2026-08-03T14:44:05.234Z
Visible editor value: 2026-08-03 2:44 PM
Submitted hidden value: 2026-08-03T14:44
Warm local navigation sample: about 131ms
``` 

현재 상태가 바뀌었다면 read-only로 다음을 측정한다.

- 정책 total과 status/provenance별 수
- 규칙 total, active/disabled, scope/taxKind별 수
- 정확히 하나의 current active policy와 effective gap/overlap
- production/seed/smoke/migration provenance별 정책 수
- policy가 참조된 earning/tax log/settlement 수
- exact create/update/request/approve/reject/schedule/activate/supersede 감사 수
- broad query 오염 수
- Finance tax policy 권한별 실제 운영자 수와 fixture/locked/suspended 상태
- `NO_ACTIVE_POLICY`, `NO_APPROVED_TAX_PROFILE`, `NO_MATCHING_RULE` snapshot 수
- 최근 30일 전체 integrity 분모와 예외 수
- 목록 API total/pagination 정확성
- current browser/server timezone과 round-trip 결과

이름 패턴은 진단 힌트일 뿐 source of truth가 아니다. 기존 데이터를 자동 변경하지 않는다.

## 6. P0-A — 즉시 원천징수 안전 차단

전체 workflow를 만들기 전에 현재 위험한 mutation을 먼저 fail-closed로 바꾼다.

### 구현 요구

1. 일반 create/update DTO와 Admin UI에서 `ACTIVE` 직접 선택을 제거하거나 서버에서 거부한다.
2. 현재 ACTIVE 정책과 그 규칙 PATCH를 서버에서 거부한다.
3. historical tax log, earning, settlement가 참조한 policy/rule은 제자리 수정할 수 없게 한다.
4. DRAFT만 수정 가능하게 한다.
5. 기존 active 정책을 비활성화하는 동작은 activation command 한 곳으로 제한한다.
6. default rule이 없거나 conflict/coverage 오류가 있는 정책은 schedule/activate할 수 없다.
7. current active가 없거나 smoke/fixture provenance면 readiness를 Critical로 표시한다.
8. current active query failure를 `No active policy`로 바꾸지 않는다.
9. earning engine에서 `NO_ACTIVE_POLICY`가 발생하면 운영 예외/alert가 남는 기존 경로를 찾고, 없으면 최소한 durable audit/metric hook을 추가한다.
10. current active 정책을 실제 운영 정책으로 자동 교체하지 않는다. 운영 정책 입력과 승인은 사용자/회계 결정이다.

### 안정적인 오류 코드

현재 API convention에 맞춰 다음과 동등한 code를 제공한다.

```text
ACTIVE_POLICY_IMMUTABLE
REFERENCED_POLICY_IMMUTABLE
REFERENCED_RULE_IMMUTABLE
POLICY_NOT_DRAFT
POLICY_NOT_READY_FOR_SCHEDULING
NO_ACTIVE_TAX_POLICY
ACTIVE_POLICY_PROVENANCE_UNSAFE
``` 

### 완료 조건

- 현재 `/tax-policy`에서 ACTIVE policy/rule을 직접 저장할 수 없다.
- API 직접 호출도 같은 변경을 거부한다.
- 기존 current active는 workflow 구현 중 의도치 않게 바뀌지 않는다.
- 오류는 운영자에게 구체적으로 표시되고 입력은 보존된다.

## 7. P0-B — immutable policy version과 lifecycle 상태 머신

현재 `DRAFT | ACTIVE | INACTIVE | ARCHIVED` 직접 편집 모델을 다음 의미로 재구성한다.

```text
DRAFT
→ PENDING_APPROVAL
→ APPROVED 또는 REJECTED
→ SCHEDULED
→ ACTIVE
→ SUPERSEDED
→ ARCHIVED(보존 정책상 허용될 때만)
``` 

정확한 DB enum/필드 이름은 현재 shared enum 영향과 migration 안전성을 검토해 정한다. 상태를 억지로 기존 `INACTIVE`에 모두 매핑하지 않는다.

### Policy version 요구사항

1. Draft creation은 현재 active 또는 historical policy를 `Clone as new draft`할 수 있다.
2. clone은 새 policyVersionId와 새 rule IDs를 만든다.
3. predecessor/successor 또는 supersedes 관계를 저장한다.
4. DRAFT에서만 정책 메타데이터와 규칙을 편집할 수 있다.
5. 승인 요청 이후 payload revision/hash를 고정한다.
6. maker가 승인 대기 중 내용을 바꾸면 기존 요청을 invalid/stale로 만들고 재요청하게 한다.
7. APPROVED/SCHEDULED/ACTIVE/SUPERSEDED는 immutable이다.
8. rejected policy는 수정 재개를 위해 명시적으로 새 revision/Draft를 만들거나 현재 제품에 맞는 안전한 reopen 규칙을 둔다.
9. archive는 계산·감사·법적 보존 참조를 삭제하지 않는다.
10. active 정책에 규칙이 최소 하나 있다는 정도가 아니라 정확히 하나의 active DEFAULT와 valid coverage를 요구한다.

### 구조화할 정책 근거

최소 다음을 durable하게 저장한다.

```text
jurisdiction: VN
displayName
legalSourceTitle
legalSourceUrl 또는 sourceDocumentId/hash
promulgatedDate
effectiveAt 또는 effectiveDate
timezone: Asia/Ho_Chi_Minh
taxSubject/partnerType
taxKind 또는 지원 tax kinds
changeRequestId/ticketRef
changeSummary
supersedesPolicyVersionId
createdByAdminId
createdAt
revision 또는 updatedAt concurrency token
provenance: OPERATOR | SEED | SMOKE_TEST | MIGRATION
environment/runId/expiresAt: fixture일 때
``` 

자유문구 Notes는 보조 설명으로만 사용한다.

### 규칙 요구사항

- DEFAULT, SERVICE_TYPE, AMOUNT_BAND와 taxKind를 명시적으로 표시한다.
- rule priority는 서버와 Admin preview가 동일한 shared pure function 또는 계약 테스트로 보호한다.
- rate는 저장 단위 bps를 유지할 수 있지만 UI는 `%`를 기본 입력/표시로 사용한다.
- VND 금액은 단위와 천 단위 구분을 표시한다.
- SERVICE_TYPE은 free text가 아니라 service catalog ID/code를 사용하되, 기존 historical string 호환성을 보존한다.
- boundary는 inclusive/exclusive 의미를 명확히 하고 서버·preview·copy를 일치시킨다.
- 같은 draft 안의 default 중복, service 중복, band overlap을 client precheck와 server validation 양쪽에서 처리한다.

### 완료 조건

- 현재/과거 정책 원본을 DB와 감사에서 복원할 수 있다.
- 활성 정책 변경은 새 version을 만들지 않고는 불가능하다.
- 화면에서 `Update active policy/rule` 폼이 사라지고 read-only current와 editable draft가 분리된다.

## 8. P0-C — 실제 maker-checker 승인 워크플로

`Separate Finance approver` select와 maker가 입력하는 `Approval evidence`를 독립 승인으로 인정하지 않는다.

### durable approval request

기존 Finance approval queue/request 모델이 tax policy payload snapshot과 lifecycle을 안전하게 수용할 수 있으면 재사용한다. 그렇지 않으면 tax policy 전용의 가장 작은 durable request 모델을 추가한다.

최소 필드:

```text
requestId
policyVersionId
policyRevision 또는 payloadHash
requestedByAdminId
requestReason
requestedAt
status: PENDING | APPROVED | REJECTED | EXPIRED/CANCELLED(실제 필요할 때만)
decidedByAdminId
decisionReason
decidedAt
expiresAt
idempotencyKey
``` 

### 승인 규칙

1. maker와 checker는 다른 사용자여야 한다.
2. checker는 실제 `FINANCE_TAX_POLICY_APPROVE` 또는 동등한 좁은 권한을 가져야 한다.
3. fixture, locked, suspended, revoked 계정은 checker 후보에서 제외한다.
4. maker는 checker ID를 선택해 승인 완료 상태를 만들 수 없다.
5. checker가 자기 로그인 세션에서 before/after diff, source, simulation, effectiveAt을 본 뒤 승인/반려한다.
6. 승인 직전 policy revision/payloadHash를 확인한다.
7. stale request는 거부하고 새 요청을 요구한다.
8. request/decision reason은 whitespace 정규화 후 의미 있는 최소 길이와 최대 500자를 서버에서 검사한다.
9. 승인과 반려는 idempotent하고 중복 결정되지 않는다.
10. 승인됐더라도 schedule/activation 전 readiness를 다시 검사한다.

### 1인 운영과 break-glass

사용자가 실제 독립 승인자 없이 혼자 운영할 가능성이 있다. 이 현실을 가짜 승인으로 숨기지 않는다.

- 독립 checker가 없으면 readiness를 `BLOCKED — Independent approver unavailable`로 표시한다.
- 외부 회계 담당자 또는 비상 백업 운영자 지정 방법을 안내한다.
- 기존 프로젝트에 검증된 break-glass/re-auth/MFA 패턴이 있으면 재사용한다.
- 없다면 일반 화면에 조용한 우회 버튼을 새로 만들지 않는다.
- break-glass가 제품 필수라면 별도 명시적 범위로 구현하며 최소한 재인증/MFA, 짧은 만료, 외부 알림, immutable audit, 사후 검토 기한을 요구한다.
- 독립 승인자 부재를 이유로 테스트 fixture를 승인자로 계산하지 않는다.

### 감사 action

현재 naming convention에 맞춰 exact filter 가능한 action을 둔다.

```text
tax_policy.draft_created
tax_policy.draft_updated
tax_rule.draft_created
tax_rule.draft_updated
tax_policy.approval_requested
tax_policy.approved
tax_policy.rejected
tax_policy.approval_expired
tax_policy.schedule_requested 또는 scheduled
tax_policy.activated
tax_policy.activation_failed
tax_policy.superseded
tax_policy.break_glass
``` 

모든 관련 이벤트는 같은 policyVersionId와 requestId를 가진다.

## 9. P0-D — scheduled activation, 원자성, 동시성, idempotency

### scheduled activation

1. APPROVED 정책만 SCHEDULED로 전환할 수 있다.
2. effectiveAt은 명시적으로 `Asia/Ho_Chi_Minh` 기준을 갖는다.
3. SCHEDULED는 현재 ACTIVE를 즉시 끄지 않는다.
4. 적용 시각에 하나의 transaction에서 다음을 처리한다.
   - 현재 active/revision 재확인
   - scheduled policy readiness 재확인
   - old ACTIVE → SUPERSEDED
   - new SCHEDULED → ACTIVE
   - activation receipt/audit/outbox 기록
5. 실패하면 기존 ACTIVE를 유지한다.
6. activation worker/scheduler 재시도는 idempotent하다.
7. duplicate job, worker restart, process crash, timeout에서도 두 ACTIVE 또는 zero ACTIVE가 생기지 않는다.
8. overdue scheduled policy와 activation failure는 운영 alert/queue에 표시한다.
9. effective window gap/overlap을 schedule 시점과 activation 시점 모두 검사한다.

### 동시성

- 기존 transaction/lock/retry convention을 먼저 사용한다.
- 없으면 current-policy singleton row lock, PostgreSQL advisory lock, 또는 검증된 serializable transaction 중 가장 작은 안전한 방법을 선택한다.
- 가능한 경우 DB invariant 또는 partial unique index로 ACTIVE 하나를 방어한다.
- shared enum/index 영향과 migration portability를 확인한다.
- optimistic concurrency token을 모든 draft update와 schedule/decision에 사용한다.
- conflict는 안정적인 409 code로 반환한다.

권장 code:

```text
POLICY_REVISION_CHANGED
APPROVAL_REQUEST_STALE
ACTIVE_POLICY_CHANGED
POLICY_ACTIVATION_CONFLICT
POLICY_EFFECTIVE_WINDOW_CONFLICT
POLICY_ACTIVATION_NOT_DUE
POLICY_ACTIVATION_ALREADY_COMPLETED
``` 

### 정책 생성과 감사 원자성

1. Draft 정책과 초기 DEFAULT 규칙을 하나의 API/transaction에서 생성한다.
2. mutation과 audit/outbox를 같은 transaction에 기록한다.
3. 현재 서비스처럼 commit 뒤 별도 `writeAudit`가 실패하는 구조를 제거한다.
4. Admin action은 idempotency key/request ID를 생성·재사용한다.
5. API 성공 receipt에 policyVersionId, revision, action, requestId, timestamp를 반환한다.

### 필수 동시성 테스트

- future schedule 중 current ACTIVE 유지
- effectiveAt `T-1ms`, `T`, `T+1ms`
- 두 policy 동시 activation
- 같은 job 10회 중복 실행
- activation transaction 중 audit/outbox 실패
- worker crash 후 retry
- maker 수정과 checker 승인 동시 실행
- 승인 후 schedule 전 draft mutation 시도
- current active 변경 후 stale scheduled activation

mock count만으로 끝내지 말고 실제 PostgreSQL integration test에서 불변식을 확인한다.

## 10. P0-E — 권한 경계 통일

현재 page는 `SYSTEM_POLICY`, API read는 `FINANCE_TAX`, write는 `SYSTEM_POLICY`다. 이를 하나의 명확한 tax-policy 권한 체계로 정리한다.

가능한 최소 capability:

```text
FINANCE_TAX_POLICY_VIEW
FINANCE_TAX_POLICY_PROPOSE
FINANCE_TAX_POLICY_APPROVE
FINANCE_TAX_POLICY_SCHEDULE 또는 ACTIVATE
FINANCE_TAX_POLICY_BREAK_GLASS(실제 구현할 때만)
``` 

기존 permission enum 확장 비용과 상위 카테고리 정책을 조사한다. 불필요하게 많은 capability를 만들지 말되 read/propose/approve/activate는 분리한다.

### 구현 요구

1. Admin page route, Admin server action, API guard, service trust boundary가 같은 의미를 사용한다.
2. 일반 `SYSTEM` 또는 `SYSTEM_POLICY` 상속만으로 approve/activate하지 못한다.
3. FINANCE_TAX read-only 사용자는 current/history/integrity를 보되 편집 form은 보지 않는다.
4. proposer는 draft를 만들 수 있지만 자기 request를 승인할 수 없다.
5. approver는 결정할 수 있지만 승인 payload를 수정할 수 없다.
6. activator 권한을 별도로 둘지 scheduler service identity로 제한할지 기존 구조에 맞춰 명확히 한다.
7. 허용/거부된 고위험 시도를 security audit에 남긴다.
8. 권한 없음과 데이터 없음은 UI에서 다르게 표시한다.
9. 권한 조합별 page/API/service contract test를 추가한다.

## 11. P0-F — smoke/seed 격리와 provenance

현재 `infra/scripts/api-smoke.mjs`는 실행할 때마다 ACTIVE smoke 정책을 만들고 기존 ACTIVE를 비활성화한다. 이를 운영 DB에서 절대 허용하지 않는다.

### 구현 요구

1. tax policy smoke는 전용 test DB/schema/tenant 또는 transaction rollback 환경에서만 실행한다.
2. shared/production-like DB에서 smoke ACTIVE 생성 시 명확히 실패한다.
3. 테스트 정책과 규칙에 explicit provenance, environment, runId, expiresAt을 기록한다.
4. smoke 전후 ACTIVE policy ID와 production policy count 불변식을 검사한다.
5. 생성 ID를 모두 추적하고 teardown 실패를 테스트 실패로 처리한다.
6. cleanup error를 삼키지 말고 남은 IDs와 참조 수를 출력한다.
7. seed는 production에서 Demo Admin/fixture policy를 활성화하지 않는다.
8. fixture 사용자가 Finance approver readiness에 포함되지 않게 한다.

### 기존 145개/290개 정리

기본 동작이 dry-run인 별도 inventory/cleanup 도구를 만든다. 실제 apply는 이 구현 작업에서 자동 실행하지 않는다.

예시:

```text
npm run tax-policy:fixture-cleanup:check
npm run tax-policy:fixture-cleanup:apply -- --manifest=<reviewed-manifest>
``` 

정확한 이름은 저장소 관례에 맞춰도 된다.

dry-run은 최소 다음을 출력한다.

```text
policyVersionId
name
explicit provenance 또는 분류 근거
status
rules count
earning refs
tax log refs
settlement refs
audit refs
proposed action: retain | archive | delete-if-unreferenced | manual-review
blocking references
``` 

규칙:

- 참조된 policy/rule/tax log는 삭제하지 않는다.
- 이름 substring만으로 delete candidate를 결정하지 않는다.
- manifest를 사람이 검토한 뒤에만 apply할 수 있다.
- apply는 manifest hash와 현재 DB 상태를 재검증한다.
- dry-run 결과가 감사 보고서와 달라지면 최신 사실을 구현 보고서에 남긴다.

## 12. P0-G — timezone 계약 복구

### 목표

`2026-08-03T14:44:05.234Z` 같은 instant가 브라우저, Admin server, API server timezone과 무관하게 동일하게 표시·제출·저장되어야 한다.

### 구현 요구

1. tax policy의 legal effective 기준 timezone을 `Asia/Ho_Chi_Minh`으로 고정한다.
2. 정책이 날짜 단위로만 발효된다면 `effectiveDate` + Vietnam 현지 자정 규칙이 더 적합한지 결정하고 근거를 문서화한다.
3. 시각 단위가 필요하면 offset 포함 ISO 또는 instant+timezone을 사용한다.
4. `toISOString().slice(0,16)`을 timezone 없는 local input 기본값으로 사용하는 현재 경로를 제거한다.
5. client hidden input과 server action 사이에 offset이 손실되지 않게 한다.
6. visible label에 `Vietnam time (UTC+7)` 또는 `Asia/Ho_Chi_Minh`을 표시한다.
7. unchanged form submit이 effective instant를 바꾸지 않아야 한다.
8. DST는 Vietnam에 없지만 generic browser/server timezone 차이는 테스트한다.

필수 조합:

```text
Browser Asia/Ho_Chi_Minh + Server UTC
Browser UTC + Server Asia/Ho_Chi_Minh
Browser America/New_York + Server UTC
Stored Z instant → display → unchanged submit → same Z instant
Vietnam midnight boundary
``` 

DateTime component 전체를 무리하게 바꾸지 말고 tax policy의 영향과 shared caller 회귀를 먼저 평가한다.

## 13. P0-H — 오류, 감사, 목록 truth 복구

### mutation 오류

네 server action에서 fallback `adminPost/adminPatch(..., null)`을 제거하고 throw/result 기반 계약을 사용한다.

- 400/422: field validation
- 401: 세션 만료와 재로그인 안내
- 403: 권한 부족
- 404: stale/not found
- 409: revision/active/approval conflict
- 429: 잠시 후 재시도
- 500/timeout: request ID와 retry

요구사항:

- 입력, 선택된 policy/draft, scroll/tab state를 보존한다.
- 실패한 form heading/error summary로 focus를 이동한다.
- raw stack, endpoint, 내부 exception을 노출하지 않는다.
- 성공 receipt에는 대상, 변경 유형, request ID, timestamp, next state를 표시한다.
- 중복 클릭을 막고 pending 상태를 명확히 표시한다.

### read 오류

정책, audit, earnings, approver, current operator read 각각 `ok/status/fetchedAt/requestId`를 보존한다.

- 실제 0건
- 403 permission denied
- 500 unavailable
- timeout
- stale cache
- partial source failure

를 분리한다. 필수 정책 source 실패 시 readiness와 mutation을 fail-closed로 비활성화한다.

### exact audit

`q=tax_&take=8`을 제거한다.

- 서버 exact action 복수 필터를 사용한다.
- page API로 exact total과 pagination을 받는다.
- policyVersionId/requestId/target/action/actor/date로 검색한다.
- page view는 정책 변경 이력 count/page limit를 소비하지 않는다.
- 과거 `tax_policy.create/update`, `tax_rule.create/update`도 compatibility view에서 보존한다.
- 725건이 현재 데이터와 같다면 화면에서도 정확한 total/최신 event가 보이게 한다.

### 정책 목록

배열-only `take=20`을 page contract로 바꾼다.

```text
items
totalCount
cursor 또는 skip
take
hasNext
statusCounts
``` 

- `20 of 145`처럼 사실대로 표시한다.
- 상태, 적용일, provenance, source, creator/approver 검색·필터를 제공한다.
- 요청된 policyId가 현재 page에 없으면 silent active fallback하지 않는다.
- 단일 policy detail endpoint 또는 정확한 query로 해당 policy를 로드한다.

## 14. P1 — 1440px 운영 정보구조 재구성

기존 디자인 시스템을 유지하되 top-level 모든 card에 내부 scroll을 주는 구조를 제거한다.

### 상단 command strip

첫 화면에 다음을 우선 표시한다.

```text
Current policy name
Readiness: Ready | Degraded | Critical
Provenance: Production | Seed | Smoke | Migration
In effect since + Vietnam timezone
Tax kinds/rate summary
Legal/accounting source
Approved by / approved at / request ID
Next scheduled policy and activation time
Integrity exceptions count
Primary action: Create new draft
``` 

현재 정책이 smoke면 초록 success로 표시하지 않는다. `Critical — Test policy is controlling live withholding`처럼 정확한 경고와 안전한 해결 절차를 보여 준다.

### 같은 `/tax-policy`의 4개 view

URL query state 예시:

```text
/tax-policy?view=current
/tax-policy?view=drafts
/tax-policy?view=history
/tax-policy?view=integrity
``` 

정확한 query 이름은 기존 관례에 맞춰도 된다. browser back/forward와 deep link를 유지한다.

#### Current policy

- read-only 정책 메타데이터와 규칙 table
- representative withholding summary
- source/approval/activation receipt
- next scheduled policy
- `Clone as new draft`
- direct Update/On-Off control 없음

#### Drafts & scheduled

- Pending approval, Approved, Scheduled, Draft를 분리
- 검색/필터와 oldest pending 표시
- draft detail 편집
- validation/coverage matrix
- current-vs-proposed diff
- submit approval / reviewer decision / schedule actions
- 각 상태에서 가능한 action만 노출

#### History

- SUPERSEDED/ARCHIVED pagination
- 적용 기간, source, approved by, superseded by
- 사용된 earning/tax log count
- read-only detail와 clone action
- smoke/fixture provenance filter

#### Audit & integrity

- exact policy lifecycle timeline
- activation failures/overdue schedules
- record integrity와 tax applicability를 분리한 summary
- exception queue와 booking/earning/finance evidence links

### scroll/layout

- 기본 document scroll 하나를 사용한다.
- table horizontal scroll은 필요한 경우 허용하되 top-level vertical nested scroll을 제거한다.
- 1440px에서 list/detail split을 쓰면 내부 vertical scroll은 한 영역만 사용한다.
- sticky action bar에는 draft 이름, state, unsaved/stale 여부, primary action을 표시한다.
- 1680px에서도 과도하게 넓어지지 않도록 기존 content width convention을 따른다.

### anchor/deep link

현재 `#tax-policy-editor`가 Create section을 가리키는 오류를 고친다.

- policy/draft detail에 고유 anchor를 둔다.
- link 후 heading으로 focus를 이동한다.
- `Editing {policy name}`을 보조기기에 알린다.
- not found와 not loaded를 active fallback으로 숨기지 않는다.

## 15. P1 — draft rule editor와 영향 시뮬레이터

### 규칙 편집기

반복되는 긴 inline form 대신 다음 기본 table을 사용한다.

```text
Priority
Scope
Applies to
Gross amount range
Tax kind
Rate
Fixed amount
Status
Validation
Last changed
Action
``` 

- 한 번에 하나의 draft rule을 drawer 또는 명확한 detail panel에서 편집한다.
- 기존 Admin drawer/form/table component를 재사용한다.
- scope에 해당하지 않는 필드는 숨기고 stale 값을 저장하지 않는다.
- percent 입력을 bps로 변환하기 전 preview를 제공한다.
- VND 입력은 실제 integer payload를 유지하면서 사람이 읽는 format을 제공한다.
- duplicate/overlap/coverage를 저장 전에 inline 표시한다.
- repeated approver/evidence fields는 각 rule form에서 제거하고 policy draft approval 한 번에 묶는다.

### 영향 시뮬레이터

현재 raw `leg_massage` free text와 500,000 한 건 preview를 운영 시뮬레이터로 확장한다.

최소 입력/근거:

```text
effectiveAt
service catalog selection
gross amount
partner tax profile status 또는 scenario
tax kind
currency VND
current policy
proposed draft
``` 

결과:

- current tax
- proposed tax
- delta
- selected rule와 priority reason
- policy/rule IDs는 technical detail에 접어서 제공
- min boundary 바로 전/정확한 경계/바로 후
- 대표 서비스와 금액 구간 matrix
- no profile/no rule/no active policy scenario

서버 earning engine과 Admin preview가 동일한 결과를 내는 contract test를 추가한다. UI에만 복제된 계산 로직이 drift하지 않게 한다.

### activation impact

가능한 경우 read-only simulation으로 최근 N일 실제 earnings를 proposed policy에 적용해 다음을 보여 준다.

```text
sample/population size
current total withholding
proposed total withholding
delta
affected earnings count
largest deltas
uncovered service/range count
``` 

이 simulation은 실제 earning 또는 tax log를 수정하지 않는다. source period와 generatedAt을 명시한다.

## 16. P1 — integrity를 운영 예외 관리로 변경

현재 `Aligned`는 금액 일치만 검사한다. 이를 다음 두 축으로 나눈다.

### Record integrity

- earning withholding와 tax log amount 일치
- tax log 존재
- immutable snapshot 존재
- policy/rule references 또는 snapshot provenance 존재

### Tax applicability

- occurredAt 시점 유효 policy 존재
- approved tax profile 존재
- matching rule 존재
- rate/fixed math 일치
- tax kind와 currency 일치
- effective window와 source 일치

상태 예시:

```text
Healthy
Amount mismatch
Missing tax log
Missing snapshot
No active policy at earning time
No approved tax profile
No matching rule
Policy/rule reference mismatch
Needs review
``` 

### 요구사항

- 8개 표본만 KPI로 사용하지 않는다.
- 전체 기간 count와 분모, generatedAt, source를 보여 준다.
- sample list는 상세 예시로만 사용한다.
- `NO_APPROVED_TAX_PROFILE` 0원 기록을 초록 Aligned로 표시하지 않는다.
- exception type, age, partner, booking, earning, amount impact로 필터한다.
- booking/earning/finance evidence deep link를 유지한다.
- 자동 수정이나 historical recalculation을 기본 action으로 제공하지 않는다.

## 17. P1 — 운영 문구

내부 enum과 bps를 기본 문구로 노출하지 않는다.

| 현재 | 권장 운영 문구 |
|---|---|
| ACTIVE | In effect |
| DRAFT | Draft |
| INACTIVE | Replaced 또는 Not in effect |
| ARCHIVED | Archived |
| PENDING_APPROVAL | Awaiting review |
| SCHEDULED | Scheduled |
| DEFAULT | Fallback — all services |
| SERVICE_TYPE | Specific service |
| AMOUNT_BAND | Gross amount range |
| Rate bps | Withholding rate (%) |
| Fixed amount | Additional fixed withholding (VND) |
| Separate Finance approver | 제거. 실제 review request/decision으로 대체 |
| Approval evidence | Change rationale and source / Reviewer decision reason으로 분리 |
| Update policy | Save draft |
| Update rule | Save draft rule |
| Add rule | Add draft rule |
| 8 aligned | 8/8 record amounts match |
| Configured | Ready only when production provenance+approval+source+coverage가 모두 충족 |

문구 원칙:

- 실제 하지 않는 기능을 했다고 말하지 않는다.
- `Every retained version is listed here`는 pagination/total이 구현되기 전에는 사용하지 않는다.
- effective time에는 Vietnam timezone을 항상 붙인다.
- `approval evidence`와 실제 승인 결정을 혼동하지 않는다.
- raw error, raw cuid, raw service slug는 technical detail에 둔다.
- 사용자-facing 용어는 `Partner`를 사용한다.

## 18. P2 — 접근성·hardening·성능

### 접근성

- 반복되는 Scope/Rate/Reason label의 accessible name에 draft/rule context를 포함한다.
- rule form은 fieldset/legend 또는 명확한 region heading으로 묶는다.
- native validation bubble 대신 동일 언어 inline error와 error summary를 제공한다.
- `aria-invalid`, `aria-describedby`, live status를 연결한다.
- drawer/dialog의 initial focus, focus trap, Escape, return focus를 검증한다.
- success/failure 후 합리적인 heading/control로 focus를 이동한다.
- keyboard-only로 Draft 생성→규칙 편집→승인 요청까지 완료 가능해야 한다.
- 색상만으로 readiness/validation/status를 구분하지 않는다.
- 200% zoom과 Windows high contrast에서 핵심 action/표가 사용 가능해야 한다.

### hardening

다음을 테스트한다.

- 160자 policy name, 1000자 notes/source metadata
- CJK/베트남어/특수문자/emoji
- 정책 1,000개, 규칙 100개, approver 50개
- policy 0개, draft 0개, audit 0개, integrity exception 0개
- 401/403/404/409/422/429/500/timeout
- stale revision, duplicate click 10회, double approval
- checker account가 decision 직전에 locked/revoked 되는 경우
- effectiveAt past/now/future, invalid timezone, boundary
- source URL/document missing
- long reviewer reason과 long translated copy

### 성능

- default current view는 필요한 source만 읽는다.
- history/audit/integrity는 해당 view에서만 무거운 query를 수행한다.
- total/status counts는 서버에서 효율적으로 집계한다.
- policy list와 audit는 bounded pagination을 사용한다.
- N+1 query를 추가하지 않는다.
- 1440px warm/cold baseline을 기록하고 전후 API request count와 주요 query 수를 비교한다.
- 실패한 한 section 때문에 전체 page를 거짓 empty로 렌더링하지 않는다.

## 19. 데이터 마이그레이션과 하위 호환

schema 변경 전 다음을 작성한다.

```text
현재 schema와 shared enum 영향
새 필드/모델
nullable/backfill 전략
기존 ACTIVE/INACTIVE 145개 mapping
기존 audit compatibility
earning/tax log/settlement reference 보존
rollback 전략
production apply 전 필요한 수동 결정
``` 

원칙:

1. additive migration을 사용한다.
2. 기존 policy/rule ID를 바꾸지 않는다.
3. 현재 ACTIVE smoke 정책을 자동 production 정책으로 승격하지 않는다.
4. 기존 INACTIVE를 무조건 SUPERSEDED production history로 분류하지 않는다. provenance/manual review가 필요하다.
5. migration은 상태 필드나 새 relation을 준비할 수 있지만 실제 운영 정책 source/approval을 만들어내지 않는다.
6. backfill이 불확실하면 `UNKNOWN/LEGACY` provenance와 review-required 상태를 사용한다.
7. migration check와 shadow DB 검증을 실행한다.
8. 공유/운영 DB migration apply는 사용자 승인 없이 실행하지 않는다.

## 20. 필수 테스트

### Admin Web

- Current view는 active policy를 read-only로 표시
- active/historical direct edit control 부재
- Draft create/clone/edit
- state별 허용 action
- exact total/pagination/search/filter
- policyId deep link와 not-found
- exact audit total과 rows
- read error/permission/stale/empty 분리
- 401/403/409/422/500/timeout mutation feedback
- failed form input/tab/focus 보존
- timezone display/hidden value/round-trip
- rule drawer validation/overlap/coverage
- current-vs-proposed preview
- NO_APPROVED_TAX_PROFILE는 green aligned가 아님
- query view back/forward
- keyboard/focus/accessibility contract
- no nested top-level vertical scroll at 1440px

### API/DB

- only DRAFT mutable
- referenced/active/scheduled/superseded immutable
- maker cannot approve own request
- fixture/locked/non-permitted user cannot approve
- stale payloadHash/revision rejected
- duplicate request/decision idempotent
- draft+initial rule+audit atomic
- approval decision+audit atomic
- scheduled activation+old supersede+receipt/audit atomic
- future schedule preserves current active
- failed activation preserves current active
- exactly one ACTIVE under concurrency
- exact effective boundary
- exact audit action filtering/pagination total
- permission matrix
- timezone independent parsing
- tax engine/Admin preview parity
- legacy policy/audit read compatibility

### Smoke/infra

- tax smoke refuses shared/production-like target
- smoke before/after ACTIVE policy invariant
- teardown failure fails smoke
- no remaining policy/rule IDs
- cleanup dry-run is default
- cleanup apply requires reviewed manifest/hash
- referenced historical records are retained

## 21. 검증 명령

저장소와 현재 package script를 다시 확인한 뒤 최소 다음을 실행한다.

```powershell
npm test --workspace @massage-vn/admin-web -- --run app/tax-policy/page.spec.tsx app/tax-policy/actions.spec.ts app/tax-policy/tax-policy-page-model.spec.ts app/tax-policy/tax-policy-audit-summary.spec.ts app/tax-policy/tax-policy-snapshot-consistency.spec.ts app/tax-policy/tax-policy-notice.spec.ts

npm test --workspace @massage-vn/api -- --run src/provider-onboarding/provider-onboarding.service.spec.ts src/provider-onboarding/provider-onboarding.controller.spec.ts src/provider-onboarding/provider-onboarding.dto.spec.ts

npm run typecheck --workspace @massage-vn/admin-web
npm run typecheck --workspace @massage-vn/api
npm run admin:visible-copy
npm run prisma:migrations:check
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
``` 

실제 변경한 파일에 맞춰 관련 earning, admin permission, approval queue, audit, scheduler, smoke 테스트를 추가 실행한다.

보호 영역 동작이 바뀌므로 최종적으로 저장소 지침의 full local verification을 수행한다. 실행할 수 없는 외부 의존 검증은 이유와 남은 위험을 정확히 보고한다.

UI 완료 후 한 번만 mechanical detector를 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json apps/admin_web/app/tax-policy apps/admin_web/app/globals.css
``` 

detector 결과는 맹목적으로 전부 고치지 말고 이 화면과 관련된 실제 위반만 수정한다.

## 22. 브라우저 QA

로그인된 Admin 브라우저에서 1440x1000과 1680x1050을 확인한다. 1024px 이하는 검사·보고하지 않는다.

필수 캡처 상태:

1. Current policy 정상/critical provenance 상태
2. Drafts & scheduled 목록
3. Draft rule editor
4. validation/coverage matrix
5. current-vs-proposed simulation
6. approval request 제출 전
7. approver decision 화면
8. scheduled activation 상태
9. exact audit timeline
10. integrity exceptions
11. permission denied/read-only
12. API unavailable와 retry
13. 409 stale conflict와 입력 보존
14. history 145개 pagination/search
15. 1440px 전체 화면에서 nested vertical scroll 부재

운영/공유 DB mutation이 필요한 브라우저 상태는 직접 실행하지 않는다. 격리 test data, read-only rendering, mocked integration fixture 중 안전한 방법을 사용한다. production-like 화면에 승인 완료나 activation 성공을 fake static copy로 넣지 않는다.

## 23. 구현 보고서

다음 파일을 작성한다.

```text
docs/audits/tax-policy-remediation-implementation-YYYY-MM-DD.md
``` 

최소 포함 내용:

- 최종 판정과 점수
- 변경 파일
- schema/migration과 하위 호환
- 정책 lifecycle과 승인 workflow
- 권한 matrix
- activation transaction/lock/idempotency 방식
- timezone 계약
- exact audit와 pagination 계약
- smoke 격리와 cleanup dry-run 결과
- read-only DB 재측정 전후
- 테스트 명령과 pass/fail/skipped
- 1440/1680 캡처 경로
- protected areas touched
- 실제 운영 데이터에 적용하지 않은 항목
- 남은 위험과 다음 권장 작업

완료 보고 전에 `git diff --check`, 관련 diff, `git status --short`를 확인한다. 사용자 요청이 없으면 commit하지 않는다.

## 24. 최종 완료 기준

다음 질문에 모두 증거로 `예`라고 답할 수 있어야 한다.

1. 미래 정책을 예약해도 현재 원천징수가 적용 시각 전까지 유지되는가?
2. 적용 시각에 old/new 전환이 원자적이며 실패 시 old가 유지되는가?
3. ACTIVE/SCHEDULED/과거 정책과 규칙이 immutable인가?
4. 실제 다른 checker의 인증된 승인 없이는 schedule/activate할 수 없는가?
5. 1인 운영 시 독립 승인 부재를 가짜 fixture 승인으로 숨기지 않는가?
6. 두 동시 활성화에서도 ACTIVE가 정확히 하나인가?
7. draft+rules, approval, activation, audit가 부분 성공으로 남지 않는가?
8. 브라우저와 서버 timezone이 달라도 effective instant가 보존되는가?
9. 현재 active가 smoke이면 화면이 Critical로 표시하고 운영 준비 완료로 보지 않는가?
10. smoke가 운영 DB의 active policy를 변경하지 않는가?
11. 화면이 실제 total과 exact audit total을 보여 주는가?
12. API 장애와 실제 0건을 구분하는가?
13. current policy와 historical policy는 read-only이고 변경은 clone draft에서만 하는가?
14. proposed policy의 규칙 coverage와 current-vs-proposed 영향이 승인 전에 보이는가?
15. integrity가 금액 일치와 세금 적용 적정성을 분리하는가?
16. page/API/service 권한 경계가 일치하는가?
17. 1440px 이상에서 중첩 세로 스크롤과 잘못된 editor anchor가 제거됐는가?
18. keyboard-only 흐름과 오류 focus/input 보존이 검증됐는가?
19. 기존 earning/tax log/settlement history와 legacy audit가 보존되는가?
20. 관련 단위·통합·동시성·timezone·browser·migration 검증이 통과했는가?

## 25. 최종 응답 형식

최종 응답은 다음 순서로 간결하게 작성한다.

1. 출시 차단 항목 해결 여부
2. 실제 구현한 lifecycle/approval/activation 핵심
3. 변경 파일 링크
4. DB/migration/운영 데이터 적용 여부
5. 테스트·브라우저 QA 결과
6. 남은 blocker와 다음 한 가지 권장 작업

단순히 “UI를 개선했다”, “테스트가 통과했다”고 보고하지 않는다. ACTIVE 불변성, 독립 승인, 원자적 예약 활성화, exact audit, timezone, smoke 격리의 증거를 각각 제시하라.
