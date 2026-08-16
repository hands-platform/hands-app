# Finance Approvers 권한 통제 및 운영 UX 개선용 Codex 마스터 프롬프트

이 문서는 저장소의 영구 지침이 아니라 **한 번의 구현 작업에 그대로 붙여 넣는 task prompt**다. `AGENTS.md`에 복사하지 말고, Codex에서 `C:\dev\massage-on-demand-vn`을 workspace로 연 다음 이 문서 전체를 실행 프롬프트로 사용한다.

---

당신은 HANDS 관리자 시스템의 시니어 보안·재무 플랫폼·프로덕트 엔지니어다. `/finance-tax/finance-approvers`를 1인 또는 소수 운영자가 재무 승인 권한을 최소권한 원칙과 이중 통제로 안전하게 관리할 수 있도록 개선하라.

단순 분석, 카드 재배치, CSS 정리, 문구 변경으로 끝내지 않는다. 현재 코드·DB·권한 guard·승인 흐름·감사 로그·seed/smoke 수명주기·실제 1440px 화면을 다시 확인하고 **P0 보안과 데이터 무결성부터 구현한 뒤 운영 UX, 접근성, 성능, 회귀 검증까지 완료**한다.

현재 감사 판정은 **38/100, Release hold**다. 직접 Grant/Revoke API, optional API 사유, 동시 회수 경쟁 조건, fixture 포함 coverage, broad audit 검색, empty fallback 중 하나라도 남아 있으면 완료로 보고하지 않는다.

## 1. 작업 위치와 기준 자료

```text
Workspace: C:\dev\massage-on-demand-vn
Primary route: http://localhost:3101/finance-tax/finance-approvers
Audit report: docs/audits/finance-approvers-final-reaudit-2026-08-11.md
Audit evidence: docs/audits/finance-approvers-reaudit-evidence-2026-08-11/
Target viewport: 1440x1000 이상 데스크톱
Excluded viewport: 1024px 이하 전체
```

반드시 직접 확인할 증거:

```text
01-finance-approvers-overview.png
02-finance-approver-directory-top.png
03-finance-approver-directory-bottom.png
04-empty-reason-browser-validation.png
05-generic-role-update-failure.png
06-audit-log-page-view-pollution.png
07-audit-log-only-page-views.png
```

주요 코드 후보:

```text
apps/admin_web/app/finance-tax/finance-approvers/**
apps/admin_web/app/finance-tax/approval-queue/**
apps/admin_web/app/finance-tax/company-bank-accounts/**
apps/admin_web/app/audit-log/**
apps/admin_web/components/admin-drawer-surface.tsx
apps/admin_web/components/admin-form-controls.tsx
apps/admin_web/components/admin-page-template.tsx
apps/admin_web/components/admin-surface.tsx
apps/admin_web/components/status-badge.tsx
apps/admin_web/lib/admin-api.ts
apps/admin_web/lib/admin-operator-access-model.ts

apps/api/src/admin/admin-identity.routes.ts
apps/api/src/admin/admin-governance.routes.ts
apps/api/src/admin/admin.dto.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin-text-helpers.ts
apps/api/src/admin/admin-operator-category.guard.ts
apps/api/src/admin/admin-user-selects.ts
apps/api/src/admin/**/*.spec.ts
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/**

apps/api/prisma/seed.js
infra/scripts/api-smoke.mjs
infra/scripts/provider-wallet-withdrawal-lifecycle-smoke.mjs
infra/scripts/provider-payout-reversal-lifecycle-smoke.mjs
infra/scripts/**
```

보고서의 line number는 감사 시점 참고값일 뿐이다. 현재 코드에서 심볼, 호출자, 권한 경계, 테스트와 실제 동작을 다시 찾아라.

## 2. 최종 운영 목표

운영자가 다음 흐름을 안전하게 완료할 수 있어야 한다.

```text
실제 독립 승인 준비 상태 확인
→ Active approvers 또는 Eligible admins에서 대상 검색
→ 계정 상태·fixture 여부·현재 업무·역할 이력 확인
→ Grant/Revoke 영향과 primary/backup 변화를 사전검사
→ 12–500자의 구체적인 사유 입력
→ 권한 변경 요청 제출
→ 요청자와 다른 권한 관리자가 검토·승인 또는 반려
→ 직렬화된 서버 트랜잭션에서 역할 변경
→ request ID 기반 성공 영수증 확인
→ 역할 전용 감사 타임라인에서 전 과정 추적
```

완료 상태는 다음을 모두 만족해야 한다.

1. 한 운영자가 단독으로 재무 승인 권한을 즉시 생성하거나 제거할 수 없다.
2. 일반 `SYSTEM` 권한만으로 역할 변경 결정을 실행할 수 없다.
3. 요청자와 결정자가 같은 경우 서버가 거부한다.
4. API 직접 호출도 의미 있는 사유 없이는 실패한다.
5. 동시 회수로 승인자가 0명 또는 정책 최소 인원 미만이 되지 않는다.
6. fixture, 잠긴 계정, 중지된 계정은 실제 승인 준비도에 포함되지 않는다.
7. 현재 역할마다 요청·승인·실행·사유의 추적 근거가 있다.
8. page view가 역할 변경 감사 이력에 섞이지 않는다.
9. API 오류·권한 없음·실제 0건이 서로 다른 상태로 표시된다.
10. 1440px에서 Active approvers, Eligible admins, Pending requests, History를 한 페이지에서 전환할 수 있다.
11. 현재 로그인 운영자는 `You`로 표시되고 자기 역할 변경이 사전에 차단된다.
12. 실제 독립 승인자가 없으면 `Protected`가 아니라 차단 상태와 해결 방법을 보여준다.

## 3. 시작 전 필수 절차

1. 루트 `AGENTS.md`를 끝까지 읽고 따른다.
2. 감사 보고서를 끝까지 읽고 모든 증거 이미지를 직접 확인한다.
3. `git status --short`와 관련 파일 diff를 확인한다.
4. dirty worktree의 기존 변경은 사용자 소유다. `reset`, `checkout`, `restore`, `clean`, `stash`로 제거하지 않는다.
5. 특히 Operations Policy, Company Bank Accounts, Service Catalog 등 무관한 작업을 보존한다.
6. Admin/API 서버와 DB가 로컬·공유·운영 중 어느 것인지 확인한다. 불명확하면 역할 mutation, fixture cleanup apply, 공유 DB migration apply를 수행하지 않는다.
7. 현재 화면, 빈 사유 검증, generic failure, audit 검색 오염을 재현하고 baseline을 기록한다.
8. 관련 테스트를 먼저 실행해 baseline을 기록한다.
9. 역할 API의 모든 호출자와 `FINANCE_APPROVER`를 직접 쓰는 seed/smoke/관리 코드를 전부 검색한다.
10. 계획을 `P0-A → P0-B → P0-C → P0-D → P0-E → P0-F → P1 → P2 → QA` 순서로 만들고 한 번에 하나씩 완료한다.
11. 저장소 지침대로 단일 에이전트로 수행하고 하위 에이전트에 위임하지 않는다.
12. 실제 데이터 삭제·운영 역할 변경·공유 DB migration처럼 추가 승인이 필요한 지점만 사용자에게 확인한다.

## 4. 최소 구현 원칙과 금지사항

보안과 접근성은 줄이지 말되 불필요한 범용 시스템은 만들지 않는다.

- 기존 Admin drawer, form, notice, table, filter, approval-queue 패턴을 먼저 재사용한다.
- 기존 `assertMasterAdminAccess` 또는 동등한 좁은 검증이 목적에 맞으면 새 권한 프레임워크를 만들지 않는다.
- 재사용 가능한 durable approval request가 없을 때만 finance approver 전용의 가장 작은 request 모델을 추가한다.
- `AdminAuditLog` 한 행을 유일한 mutable workflow 상태 저장소로 사용하지 않는다.
- 새 UI·상태관리·validation·data-grid 라이브러리를 추가하지 않는다.
- 전역 Admin shell과 무관한 재무 페이지를 함께 재설계하지 않는다.
- summary, readiness, 권한, 감사 truth는 서버에서 계산하고 UI가 임의 추론하지 않는다.
- 이름의 `smoke` substring을 영구 provenance 또는 자동 삭제 조건으로 사용하지 않는다.
- 기존 money-action maker/checker와 자기 승인 금지를 약화하지 않는다.
- 1인 운영 편의를 이유로 자기 승인 우회 버튼을 만들지 않는다.
- 권한/API 실패를 `[]`, `0`, `Protected`로 대체하지 않는다.
- 1024px 이하 반응형 작업으로 범위를 확장하지 않는다.

## 5. 감사 시점 사실을 read-only로 재확인

감사 당시 로컬 환경:

```text
Admin users: 22
Finance approvers: 12
Non-approver admins: 10
이름상 Smoke/Demo/Local/Audit 계열: 22/22
이름상 fixture 계열 finance approvers: 12/12
비-fixture로 확인 가능한 finance approvers: 0
admin_user.finance_approver.grant/revoke audit events: 0
q=finance_approver audit search: 156 events, 표시 행은 page view
directory API take limit: 50
```

이름 패턴은 현재 환경 진단일 뿐 source of truth가 아니다. 현재 데이터가 바뀌었다면 read-only로 다음을 측정한다.

- 전체 관리자와 실제 total
- 역할별 수, 목록 상한, 다음 페이지 존재 여부
- explicit fixture provenance별 수
- active/locked/suspended/revoked 계정 수
- 실제 primary/backup 후보 수
- pending role request 수와 oldest age
- exact request/approve/reject/grant/revoke audit 수
- broad page-view 오염 수
- seed/smoke 고권한 사용자와 cleanup 잔여

모바일 `appSessions`를 관리자 readiness로 단정하지 않는다. 관리자 인증 신호가 없으면 `UNKNOWN`으로 모델링한다. 기존 22명이나 역할은 자동 수정·삭제하지 않는다.

## 6. P0-A — 역할 변경 자체의 이중 승인

현재 `Grant approver`와 `Revoke approver`는 역할 배열을 즉시 바꾼다. 이를 request → independent decision → execution으로 변경한다.

### 구현 요구

1. Admin Web의 직접 grant/revoke 제출을 제거한다.
2. 기존 mutation endpoint는 request 생성으로 명확히 전환하거나 새 request endpoint를 만들고 기존 endpoint를 외부에서 사용할 수 없게 한다.
3. durable request에는 최소 다음을 저장한다.

```text
requestId
targetUserId
requestedEnabled
previous finance-role state 또는 role snapshot
requestedByAdminId
operatorReason
requestedAt
expectedTargetUpdatedAt 또는 role version
status
decidedByAdminId
decisionReason
decidedAt
executedAt
idempotencyKey
```

4. 상태는 실제 필요한 것만 둔다: `PENDING`, `APPROVED`, `REJECTED`; cancel/expire는 실제 정책이 있을 때만 추가한다.
5. 요청자와 결정자가 같으면 안정적인 `MAKER_CANNOT_APPROVE` 계열 code로 거부한다.
6. 결정 직전 대상의 현재 role/version을 snapshot과 비교하고 달라졌으면 stale로 거부한다.
7. 승인 후 role 변경, request 상태 전이, audit event를 같은 트랜잭션에서 처리한다.
8. 반려는 role을 바꾸지 않고 결정 사유를 기록한다.
9. idempotency key로 중복 제출을 한 request로 만든다.
10. 이미 같은 상태인 no-op과 같은 대상·방향의 중복 pending request를 거부한다.
11. request, decision, execution audit에 같은 request ID를 기록한다.

권장 audit action:

```text
admin_user.finance_approver.requested
admin_user.finance_approver.approved
admin_user.finance_approver.rejected
admin_user.finance_approver.grant
admin_user.finance_approver.revoke
admin_user.finance_approver.blocked
```

현재 convention에 맞게 이름을 조정할 수 있지만 exact action filter가 가능해야 한다.

### 1인 운영 원칙

- 실제 독립된 두 번째 운영자가 없으면 readiness를 `BLOCKED`로 표시한다.
- 외부 회계 담당자 또는 비상 백업 권한 관리자가 필요하다는 해결 방법을 표시한다.
- bootstrap/break-glass는 일반 화면에서 조용히 우회하지 않는다.
- 기존 정책이 없다면 새 break-glass를 임의 구현하지 말고 blocker와 안전한 runbook 요구사항을 보고한다.

### 완료 조건

- 한 버튼으로 role이 즉시 바뀌지 않는다.
- 다른 결정자의 승인이 있어야 role이 바뀐다.
- 자기 승인과 자기 역할 변경이 UI/API 양쪽에서 차단된다.
- request부터 execution까지 같은 ID로 추적된다.

## 7. P0-B — 최소권한 경계

현재 `/admin/users`는 `SYSTEM_ADMIN_OPERATORS`에 매핑되고 상위 `SYSTEM`도 통과한다. role change service 내부의 명시적 Master Admin/role-governance 검증이 없다.

### 구현 요구

1. read-only page와 request/decision 권한을 분리한다.
2. 가장 작은 안전한 기존 통제를 우선 사용한다.
   - 기존 `assertMasterAdminAccess`가 제품 정책에 맞으면 request/decision에 재사용한다.
   - 이미 정확한 governance capability가 있으면 그것을 사용한다.
   - 둘 다 부적합할 때만 새 capability를 추가한다.
3. 상위 `SYSTEM`의 암묵적 상속만으로 decision을 허용하지 않는다.
4. route guard뿐 아니라 service trust boundary에서도 actor 권한을 확인한다.
5. page read, request create, decision, history read 계약을 각각 테스트한다.
6. 허용되지 않은 시도는 role을 변경하지 않고 blocked security audit를 남긴다.
7. read-only 사용자는 form 대신 정책과 담당자 안내를 본다.
8. 기존 재인증/MFA 신호가 있으면 고권한 decision에 재사용한다. 없으면 새 인증 프레임워크를 억지로 만들지 말고 blocker와 hook 지점을 보고한다.

## 8. P0-C — 사유, no-op, 동시성

### 사유

- DTO에서 사유를 필수로 한다.
- 공백을 정규화한 뒤 최소 12자, 최대 500자를 서버에서 검사한다.
- 이 흐름에서는 `No reason provided by API caller` fallback을 금지한다.
- 요청 사유와 결정 사유를 구분한다.
- UI에 글자 수, 예시, inline field error를 표시하고 실패 후 입력을 보존한다.
- 0/1/11/12/500/501자 테스트를 추가한다.

### no-op/stale/idempotency

- 이미 승인자인 사용자 grant, 비승인자 revoke를 거부한다.
- 실제 변경이 없으면 grant/revoke audit를 만들지 않는다.
- 요청 후 대상 role/account 상태가 바뀌면 decision을 stale로 거부한다.
- 중복 클릭과 네트워크 재전송은 request 하나만 생성한다.

### 동시성

현재 count 후 update는 두 approver 동시 revoke 시 둘 다 성공할 수 있다.

1. 승인자 집합을 변경하는 decision을 DB에서 직렬화한다.
2. 기존 transaction/retry helper가 있으면 재사용한다.
3. 없으면 serializable transaction + bounded retry 또는 역할 집합 전용 advisory lock 중 가장 작은 안전한 방법을 사용한다.
4. decision transaction 안에서 대상 상태와 유효한 실제 승인자 수를 다시 읽는다.
5. fixture, locked, suspended, revoked 계정은 실제 남은 승인자에 포함하지 않는다.
6. 정책 최소 인원 미만이 되는 revoke를 차단한다.
7. 두 approver 동시 revoke integration test에서 정책 불변식을 검증한다. mock count만으로 완료하지 않는다.
8. conflict는 `APPROVER_SET_CHANGED`, `MINIMUM_APPROVER_COVERAGE_REQUIRED` 계열의 안정적인 code로 반환한다.

## 9. P0-D — fixture provenance와 smoke 수명주기

seed/smoke는 role 배열에 `FINANCE_APPROVER`와 `MASTER_ADMIN`을 직접 넣을 수 있고 일부 cleanup 오류를 삼킨다.

### 구현 요구

1. User schema와 기존 provenance 패턴을 먼저 조사한다.
2. 기존 필드로 표현할 수 없을 때만 additive provenance를 추가한다.

최소 후보:

```text
fixtureKind nullable
fixtureRunId nullable
fixtureExpiresAt nullable
```

3. production에서는 fixture의 고권한 role 생성·부여를 서버 또는 release invariant로 차단한다.
4. readiness 집계에서 explicit fixture를 제외한다.
5. seed/smoke가 테스트 환경에서 직접 role을 넣으면 provenance와 run ID를 기록한다.
6. lifecycle smoke의 `.catch(() => undefined)` cleanup을 제거한다.
7. 원래 테스트 오류와 cleanup 오류를 둘 다 보존하고, 남은 fixture ID를 출력하며 cleanup 실패 시 성공 종료하지 않는다.
8. smoke 전후 다음을 검증한다.

```text
real high-privilege user set unchanged
fixture high-privilege set restored or explicitly reported
no orphan pending finance-role request
no duplicate audit for one idempotency key
```

9. 가능하면 전용 test DB/tenant를 사용한다.
10. 기존 22명은 자동 삭제·role revoke하지 않는다.
11. 정리가 필요하면 user ID, provenance, roles, 참조 수, 추천 조치를 포함한 별도 read-only dry-run만 만든다.

## 10. P0-E — 정확한 역할 감사

`q=finance_approver` broad 검색은 page view URL에 오염된다.

### 구현 요구

1. 서버가 지원하는 exact `action` 다중 필터를 우선 재사용한다.
2. page와 Audit log 링크는 허용된 역할 action 집합만 전송한다.
3. broad q 조회 후 client post-filter를 사용하지 않는다.
4. `History` 탭에서 request ID 기준으로 요청·결정·실행을 묶는다.
5. target, before/after, requester, decision maker, status, reason, times, request ID를 표시한다.
6. 대상별 history는 exact target 계약을 사용한다.
7. page view를 반복 생성해도 role history 결과가 변하지 않는 테스트를 추가한다.
8. 차단된 권한 변경 시도는 execution audit와 구분한다.

## 11. P0-F — API 오류와 actual empty 분리

핵심 fetch의 `adminGet(..., [])` fallback을 제거한다.

| 상태 | UI 처리 |
|---|---|
| 401 | 로그인 만료와 재로그인 |
| 403 | read-only/권한 없음과 담당자 안내 |
| 404 | 대상 소멸과 목록 새로고침 |
| 409 | stale/no-op/pending/conflict별 해결 안내 |
| 400/422 | 필드별 validation 오류 |
| 429 | 대기 후 재시도 |
| 500 | 요청 ID와 재시도 |
| timeout/network | 연결 문제와 재시도 |
| success + 0 | 실제 empty state와 다음 행동 |

추가 요구:

- summary 실패 시 수치를 0으로 만들거나 READY/BLOCKED를 추론하지 않는다.
- `UNKNOWN`과 마지막 정상 조회 시각을 표시하고 mutation을 비활성화한다.
- 오류 후 drawer, 대상, 방향, 사유를 보존한다.
- 성공 receipt에 target, before/after, requester, approver, time, request ID, exact audit link를 표시한다.
- raw URL 상태 `updated`, `failed`를 사용자 배지로 노출하지 않는다.

## 12. P1 — 한 페이지 운영 UX

별도 route를 늘리지 말고 `/finance-tax/finance-approvers`에서 기존 query-param tab 패턴을 사용한다.

### 헤더

```text
Title: Finance approval access
Description: Manage who may provide the independent second approval for money movement. Access changes require a different role governor.
Actions: View finance approvals / View role history / Request access change
```

`Tax overview`는 primary action이 아니므로 우선순위를 낮춘다.

### readiness

`Approver coverage 54.5%`를 제거하고 서버 계산으로 표시한다.

```text
Independent approval readiness: READY / BLOCKED / UNKNOWN
Verified real approvers: N / required minimum
Primary coverage: Ready / Missing / Unknown
Backup coverage: Ready / Missing / Unknown
Pending access requests: N
Fixture accounts excluded: N
Last evaluated: timestamp
```

- 권한 비율을 success KPI로 쓰지 않는다.
- 비승인 관리자를 `Pending`으로 표시하지 않는다.
- fixture나 상태 불명 계정으로 `Protected`를 만들지 않는다.
- 실제 두 번째 사람이 없으면 해결 방법이 있는 차단 배너를 보여준다.
- 부분 데이터로 readiness를 계산하지 않는다.

### 탭

```text
Active approvers (default)
Eligible admins
Pending requests
History
```

탭은 URL에 보존되어 새로고침, 뒤로 가기, 공유 링크가 동작해야 한다.

### 검색·필터·페이지네이션

- 이름, 업무 이메일, 안정 operator ID로 서버 검색
- account status, access, readiness, request status 필터
- API `items`, `totalCount`, `skip`, `take`
- `Showing 1–50 of 73`
- summary는 현재 page를 세지 않고 서버 집계
- 검색 결과 없음, 실제 empty, 403, 500을 구분
- virtualization은 추가하지 않음

### 테이블

```text
Operator
Account status
Finance access
Separation readiness
Open finance work
Last changed
Review status
Action
```

- 현재 actor에 `You`
- fixture에 `Test fixture — excluded`
- raw enum 대신 운영 문구
- 불필요한 전체 전화번호는 마스킹 또는 상세로 이동
- 자기 자신, locked/suspended/fixture/ineligible action은 이유와 함께 비활성화
- 행별 reason input 제거
- action은 `Review access` 하나
- 실제 workload 계약이 없으면 숫자를 추정하지 않고 `Not available`

### access review drawer

기존 Admin drawer를 재사용하고 다음 순서를 따른다.

```text
Target and account status
Current access
Proposed access
Policy preflight
Impact and reassignment
Reason 12–500
Request summary
Submit access request
```

preflight:

```text
not current actor
real admin base role
not fixture
eligible account
no duplicate pending request
not no-op
primary/backup remains valid after revoke
different role governor available
target state/version current
```

서버가 모르는 값을 UI에서 pass로 꾸미지 않는다. 필요한 값이면 `Unknown`으로 제출을 차단한다.

### pending decision

Pending 탭 또는 기존 중앙 approval queue 중 한 곳만 decision owner로 선택한다. 중복 decision UI를 만들지 않는다.

표시 정보:

```text
requester / requested time
target
before / after
operator reason
preflight
conflicts/workload impact
decision reason
Approve / Reject
request ID
```

### 반복 설명 축소

현재 `Finance approver operating rule` 카드 세 개는 짧은 `How dual control works` 도움말 또는 disclosure 하나로 축소한다. 실제 readiness와 pending work보다 위에 큰 설명 블록을 두지 않는다.

## 13. 문구 계약

| 현재 | 권장 |
|---|---|
| Finance Approvers | Finance approval access |
| Approver coverage | Independent approval readiness |
| Non-approver admins / Pending | Eligible candidates |
| Dual-control guard / Protected | Primary + backup / Ready, Missing, Unknown |
| Finance approver operating rule | How dual control works |
| 22 admin(s) | 22 admins |
| Assigned roles | Access roles |
| Second approver | Finance approver |
| Maker only | Preparation access only |
| Grant approver | Request approver access |
| Revoke approver | Request access removal |
| Reason | Reason for changing {operator}'s access |
| Role update notice | Access request update |
| failed | 구체적인 복구 가능한 오류 제목 |

필수 오류 예:

```text
You cannot change your own finance approval access. Ask another role governor.
This operator already has the requested access.
This request is out of date because the operator's access changed. Review the latest state and submit again.
Removing this approver would leave finance operations without an independent backup.
This test fixture cannot count toward production finance approval readiness.
Finance approval access could not be loaded. No readiness decision was made.
```

내부 enum, raw API error, URL status code를 사용자 문구로 그대로 노출하지 않는다.

## 14. 접근성·hardening

- form control 이름에 대상과 목적을 포함한다. 22개의 동일한 `Reason`을 만들지 않는다.
- 기존 focus trap, Escape, 닫기 후 trigger focus 복귀 패턴을 유지한다.
- 오류 요약과 field를 `aria-describedby`로 연결한다.
- 성공·실패를 live region으로 알린다.
- disabled 이유를 텍스트로 제공한다.
- 키보드로 tab, filter, drawer, 입력, 제출을 완료할 수 있어야 한다.
- 200% zoom과 Windows high contrast에서 정보 손실이 없어야 한다.
- 100자 이름, 긴 이메일, CJK, RTL, emoji, 500자 사유에서 레이아웃이 깨지지 않아야 한다.
- placeholder를 유일한 설명으로 사용하지 않는다.
- double submit을 차단하고 slow/timeout 재시도에도 request가 중복 생성되지 않게 한다.
- 영문 Admin UI에서는 inline validation도 영문으로 일관되게 제공하며 native validation은 보조 안전망으로 유지한다.

1024px 이하 반응형 문제는 검사·수정·최종 보고에 포함하지 않는다.

## 15. 성능과 데이터 최소화

1. `finance-approver-directory`에서 사용하지 않는 `appSessions`와 `pushDevices`를 제거한다.
2. 관리자 readiness에 필요한 신호는 정확한 최소 필드로 별도 조회한다.
3. summary는 현재 page 50명을 세어 만들지 않는다.
4. count와 paged list query를 분리한다.
5. 검색/필터/pagination은 서버에서 수행한다.
6. 불필요한 전화번호·세션·device를 payload에 포함하지 않는다.
7. 인증된 환경에서 API budget, query count, payload size를 측정한다.
8. budget command가 401이면 통과가 아니라 BLOCKED다.
9. 새 cache, virtualization, data-grid는 측정 근거가 없으면 추가하지 않는다.

## 16. 권장 API 역할 분리

route 이름은 현재 convention에 맞춰도 되지만 책임은 분리한다.

```text
GET  /admin/finance-approver-governance/summary
GET  /admin/finance-approver-governance/operators
GET  /admin/finance-approver-governance/requests
POST /admin/finance-approver-governance/requests
POST /admin/finance-approver-governance/requests/:id/decision
GET  /admin/finance-approver-governance/history
```

기존 admin identity/governance route에 명확히 추가하는 편이 작다면 그렇게 한다. 일반 사용자 목록과 role decision의 권한·계약은 분리한다.

summary 최소 형태:

```ts
type FinanceApproverGovernanceSummary = {
  readiness: 'READY' | 'BLOCKED' | 'UNKNOWN';
  requiredApproverCount: number;
  verifiedRealApproverCount: number;
  primaryReady: boolean | null;
  backupReady: boolean | null;
  eligibleCandidateCount: number;
  pendingRequestCount: number;
  fixtureExcludedCount: number;
  lastEvaluatedAt: string;
  blockers: Array<{ code: string; message: string }>;
};
```

기존 타입과 blocker 패턴을 먼저 재사용하고 동일 타입을 중복 정의하지 않는다.

## 17. 테스트 요구사항

### API/서비스

- 대상 없음/비관리자/자기 자신
- 일반 SYSTEM decision 거부와 허용된 governor
- requester와 decision maker 동일
- 사유 0/1/11/12/500/501자
- no-op, duplicate pending, idempotency, stale version
- grant/revoke success와 exact audit
- reject 시 role 불변
- blocked attempt audit
- fixture/ineligible target
- read-only 권한
- exact action history filter
- total/pagination/search/filter
- summary 실패 시 임의 READY 미생성

### DB/integration

- 두 approver 동시 revoke
- 동일 request 동시 approve
- audit 실패 시 approval/role rollback
- request 상태 전이 원자성
- 최소 실제 승인자 정책
- fixture exclusion
- smoke cleanup 전후 고권한 fixture invariant

동시성은 mock count 테스트만으로 완료하지 말고 가능한 로컬 test DB에서 실제 두 트랜잭션을 경쟁시킨다.

### Admin Web

- Active/Eligible/Pending/History 탭과 URL 상태
- `You`와 자기 action 비활성
- read-only
- actual empty vs 401/403/500/timeout
- READY/BLOCKED/UNKNOWN
- fixture excluded
- raw enum과 `admin(s)` 미노출
- 행별 reason form 제거
- drawer preflight와 reason min/max
- 오류 후 입력 보존과 double submit 차단
- success receipt와 exact audit link
- 긴 이름/CJK/RTL/긴 사유
- 키보드 focus open/cancel/success/error 복귀

### smoke

- explicit provenance
- production guard
- cleanup 오류 가시화와 잔여 ID 보고
- 시작/종료 invariant

## 18. 검증 명령

실제 script 이름을 확인하고 좁은 테스트부터 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/finance-tax/finance-approvers lib/admin-operator-access-model.spec.ts
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts src/admin/admin.controller.spec.ts src/admin/admin-operator-category.guard.spec.ts -t "finance approver|finance-approver|finance approver directories"
npm.cmd run admin:visible-copy
npm.cmd run admin:api-budget
```

변경 범위에 따라 DTO/route/guard/DB concurrency/smoke 테스트와 Admin Web/API typecheck·lint, Prisma migration validation을 추가한다.

UI 구현 후 다음 detector를 한 번 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <changed-admin-web-targets>
```

지적을 한 번에 수정하고 1440×1000 브라우저 QA를 한 번 수행한 뒤 필요한 수정만 묶어 반영하고 최종 확인 한 번으로 종료한다. 끝없는 미세조정 루프를 만들지 않는다.

## 19. 브라우저 검증

1440×1000 이상에서 다음을 확인한다. 1024px 이하 화면은 검사하지 않는다.

1. readiness overview
2. Active approvers
3. Eligible admins search/filter
4. current actor `You`
5. fixture/ineligible/locked 차단 이유
6. Grant request drawer
7. Revoke impact와 primary/backup 차단
8. 0/11/12/500/501자 사유
9. double submit과 slow response
10. request success receipt
11. same-maker decision 차단
12. independent approve/reject
13. stale/conflict
14. actual empty
15. 401/403/500/timeout
16. Pending oldest-first
17. exact History
18. page view 반복 후 History 불변
19. keyboard only
20. 200% zoom, 긴 이름, CJK, RTL

기존 이미지를 덮어쓰지 말고 다음 폴더에 증거를 저장한다.

```text
docs/audits/finance-approvers-remediation-evidence-YYYY-MM-DD/
```

최소 캡처:

```text
01-readiness-overview.png
02-active-approvers.png
03-eligible-admins.png
04-access-request-drawer.png
05-revoke-impact-blocked.png
06-pending-requests.png
07-request-success-receipt.png
08-structured-error-preserved-input.png
09-exact-role-history.png
10-api-unavailable-state.png
```

## 20. 완료 판정 체크리스트

### P0

- [ ] direct one-person grant/revoke 제거
- [ ] request와 decision actor 분리
- [ ] service 내부 최소권한 검증
- [ ] 사유 12–500자 API 강제
- [ ] no-op, duplicate, stale 차단
- [ ] 동시 revoke 정책 불변식 보장
- [ ] fixture readiness 제외와 production guard
- [ ] smoke cleanup 오류 가시화
- [ ] exact audit + request ID chain
- [ ] API 오류와 actual empty 분리

### UX

- [ ] Ready/Blocked/Unknown readiness
- [ ] primary/backup 상태
- [ ] Active/Eligible/Pending/History 한 route
- [ ] current actor `You`
- [ ] 행별 reason form 제거
- [ ] drawer before/after/impact
- [ ] search/filter/total/pagination
- [ ] success receipt와 exact audit link
- [ ] generic `failed`, raw enum, `admin(s)` 제거

### 접근성·검증

- [ ] 고유 accessible names와 field errors
- [ ] focus trap/Escape/focus return
- [ ] keyboard, 200% zoom, high contrast
- [ ] 긴 이름/CJK/RTL/긴 사유
- [ ] double submit/slow/timeout
- [ ] 관련 Web/API/DTO/guard 테스트
- [ ] 실제 DB concurrency 테스트
- [ ] smoke invariant
- [ ] visible-copy
- [ ] 인증된 API budget 또는 정확한 blocker
- [ ] migration validation
- [ ] Impeccable detector
- [ ] 1440px 증거
- [ ] unrelated dirty change 보존

P0 하나라도 남으면 완료라고 선언하지 말고 `Release hold`와 정확한 blocker를 보고한다.

## 21. 최종 산출물

1. 변경 파일과 목적
2. 구현한 권한·request·decision·동시성 계약
3. migration 및 rollback/배포 주의사항
4. read-only 데이터 진단과 fixture cleanup dry-run
5. 변경 전후 UI 요약
6. 실행한 테스트와 정확한 pass/fail/blocked
7. 1440px 증거 경로
8. 남은 위험과 Release ready/hold 판정
9. 사용자 승인 없이는 실행하지 않은 데이터 mutation

최종 응답 형식:

```text
Verdict: Release ready | Release hold
P0 remaining: 0 | N
Tests: N passed, N failed, N blocked
Data mutations: none | explicit list
Evidence: path
Remaining blockers: exact list
```

보안·동시성·fixture·감사 문제가 해결되지 않았는데 시각적 개선만으로 Release ready를 선언하지 않는다.
