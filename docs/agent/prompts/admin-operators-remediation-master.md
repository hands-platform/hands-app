# Admin Operators 데이터·권한·보안·운영 UX 개선용 Codex 마스터 프롬프트

이 문서는 저장소의 영구 지침이 아니라 한 번의 구현 작업에 그대로 붙여 넣는 task prompt다. AGENTS.md에 복사하지 말고, Codex에서 C:\dev\massage-on-demand-vn을 workspace로 연 다음 이 문서 전체를 실행 프롬프트로 사용한다.

---

당신은 HANDS 관리자 시스템의 시니어 보안·인증·권한관리·프로덕트 엔지니어다. /admin-operators를 1인 또는 소수 운영자가 관리자 신원, 역할, 세부 접근권한, 세션, 변경 이력을 정확하고 안전하게 관리할 수 있는 production-grade Operator Access 화면으로 개선하라.

단순 분석, CSS 정리, 카드 재배치, 문구 변경으로 끝내지 않는다. 현재 화면·코드·DB·권한 guard·관리자 인증·감사 로그·fixture 수명주기·관련 페이지를 직접 다시 확인하고 데이터 truth와 권한 불변식부터 수정한 뒤 운영 UX, 접근성, 성능, 테스트, 1440px 브라우저 증거까지 완료한다.

현재 감사 판정은 28/100, Release hold다. 다음 중 하나라도 남아 있으면 완료 또는 Release ready로 보고하지 않는다.

- 전체 운영자가 아닌 최신 전체 사용자 일부만 가져와 ADMIN을 화면에서 필터링하는 문제
- 화면 KPI와 실제 역할 count 불일치
- UI permission과 API 저장 허용 목록 불일치
- CONTENT_VIEW/EDIT/PUBLISH/DELETE가 저장 시 사라지는 문제
- 빈 permission 배열이 기본 권한으로 변하는 문제
- permission 레코드가 없는 ADMIN의 UI/API effective access 불일치
- 비고유 User.email을 findFirst로 관리자 신원에 연결하는 문제
- 운영자가 초기 비밀번호를 직접 지정하는 영구 자격 증명 흐름
- Admin Web 세션을 추적·회수할 수 없는 문제
- 접근 회수의 확인·필수 사유·세션 종료 부재
- Finance Approver 역할 변경 경로 중복
- Operator activity log가 admin_operator.*가 아닌 page view를 보여주는 문제

## 1. 작업 위치와 기준 자료

~~~text
Workspace: C:\dev\massage-on-demand-vn
Primary route: http://localhost:3101/admin-operators
Audit report: docs/audits/admin-operators-final-reaudit-2026-08-11.md
Baseline evidence: docs/audits/admin-operators-reaudit-evidence-2026-08-11/
New evidence target: docs/audits/admin-operators-remediation-evidence-2026-08-11/
Target viewport: 1440x1000 이상 데스크톱
Excluded viewport: 1024px 이하 전체
~~~

반드시 직접 확인할 baseline 증거:

~~~text
01-admin-operators-overview.png
02-admin-operators-full-page.png
03-add-operator.png
04-category-permissions.png
05-operator-activity-log.png
06-operator-directory.png
07-operator-row-actions.png
~~~

주요 코드 후보:

~~~text
apps/admin_web/app/admin-operators/**
apps/admin_web/app/login/**
apps/admin_web/app/api/admin/session/**
apps/admin_web/app/finance-tax/finance-approvers/**
apps/admin_web/app/audit-log/**
apps/admin_web/app/website-content/**
apps/admin_web/components/admin-operator-access-gate.tsx
apps/admin_web/components/admin-data-table.tsx
apps/admin_web/components/admin-drawer-surface.tsx
apps/admin_web/components/admin-form-controls.tsx
apps/admin_web/components/admin-inline-action-form.tsx
apps/admin_web/components/admin-page-template.tsx
apps/admin_web/components/admin-surface.tsx
apps/admin_web/components/status-badge.tsx
apps/admin_web/lib/admin-api.ts
apps/admin_web/lib/admin-session.ts
apps/admin_web/lib/admin-operator-access.ts
apps/admin_web/lib/admin-operator-access-model.ts
apps/admin_web/lib/admin-operator-permissions.ts
apps/admin_web/app/globals.css

apps/api/src/admin/admin-identity.routes.ts
apps/api/src/admin/admin-governance.routes.ts
apps/api/src/admin/admin.dto.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin-text-helpers.ts
apps/api/src/admin/admin-user-selects.ts
apps/api/src/admin/admin-operator-category.guard.ts
apps/api/src/auth/admin-operator-credential.ts
apps/api/src/auth/auth.controller.ts
apps/api/src/auth/auth.service.ts
apps/api/src/security/rate-limit.middleware.ts
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/**

apps/api/prisma/seed.js
infra/scripts/bootstrap-admin-operator.mjs
infra/scripts/api-smoke.mjs
infra/scripts/admin-web-smoke.mjs
infra/scripts/admin-api-read-budget.mjs
infra/scripts/check-admin-visible-copy.mjs
infra/scripts/check-secret-leaks.mjs
packages/shared/**
~~~

보고서의 line number는 감사 시점 참고값이다. 현재 코드에서 심볼, 호출자, 테스트, 실제 동작을 다시 찾아라. 현재 admin.service.ts와 다른 관련 파일에 사용자 작업이 있을 수 있으므로 diff를 기준으로 기존 변경을 보존한다.

## 2. 최종 운영 목표

운영자가 다음 흐름을 안전하게 완료할 수 있어야 한다.

~~~text
정확한 전체 운영자·역할·보안 상태 확인
→ 이름/이메일/상태/역할/업무영역으로 대상 검색
→ 운영자 상세에서 직접 부여·상속된 effective access 확인
→ 변경 전후 diff와 위험 권한 영향 확인
→ 필수 사유 입력 및 필요한 경우 Master 재인증
→ 버전 검사를 포함한 접근권한 변경
→ audit ID가 포함된 성공 영수증 확인
→ 관리자 세션과 최근 로그인 상태 확인
→ 확인 절차 후 Admin Web 접근 정지 및 세션 즉시 종료
→ access change history에서 actor/target/before/after/reason/result 추적
~~~

완료 상태는 다음을 모두 만족해야 한다.

1. 모든 ADMIN 운영자가 서버 필터 목록과 정확한 total에 포함된다.
2. Master Admin·Finance Approver KPI가 같은 서버 snapshot의 역할 count와 일치한다.
3. UI에 보이는 모든 permission이 API에 저장되고 guard가 동일하게 해석한다.
4. undefined, 빈 배열, 기존 값 유지가 서로 다른 의미를 가진다.
5. permission 레코드가 없는 ADMIN을 추정 권한으로 조용히 표시하지 않는다.
6. 중복 이메일이 임의의 기존 사용자에게 관리자 권한을 연결하지 않는다.
7. 신규 운영자는 영구 초기 비밀번호가 아니라 만료되는 안전한 초대/설정 흐름을 사용한다.
8. 고위험 변경은 Master 권한, 필수 사유, 재인증, 동시성 검사를 통과한다.
9. 접근 정지 시 서버 추적 Admin Web 세션이 즉시 무효화된다.
10. Finance Approver 역할 변경은 한 페이지와 한 서비스 계약만 소유한다.
11. 변경 이력은 정확히 운영자 초대·생성·권한 변경·정지·재활성·세션 회수를 보여준다.
12. API 실패, 권한 없음, 실제 0건, migration 필요 상태가 서로 다르게 표시된다.
13. 1440px에서 목록 행은 컴팩트하며 권한 편집은 드로어/상세 흐름으로 분리된다.
14. 1024px 이하 반응형 작업으로 범위를 확장하지 않는다.

## 3. 시작 전 필수 절차

1. 루트 AGENTS.md를 끝까지 읽고 따른다.
2. 감사 보고서를 끝까지 읽고 baseline 증거 이미지를 직접 확인한다.
3. git status --short와 관련 파일 diff를 확인한다.
4. dirty worktree의 기존 변경은 사용자 소유다. reset, checkout, restore, clean, stash로 제거하지 않는다.
5. Operations Policy와 다른 페이지의 무관한 수정은 절대 덮어쓰지 않는다.
6. 현재 서버와 DB가 local/shared/production 중 어디인지 확인한다.
7. DB 상태가 불명확하면 role 변경, fixture 삭제, invitation 생성, migration apply를 수행하지 않는다.
8. 현재 1440px 화면과 핵심 실패 상태를 다시 재현하고 baseline을 기록한다.
9. 관련 Web/API/auth/guard 테스트와 typecheck baseline을 먼저 실행한다.
10. ADMIN, MASTER_ADMIN, FINANCE_APPROVER, permission, credential의 모든 쓰기 경로를 검색한다.
11. /finance-tax/finance-approvers와 역할 변경 중복 경로를 반드시 확인한다.
12. 계획을 P0-A → P0-B → P0-C → P0-D → P0-E → P1 → P2 → QA 순서로 만들고 한 번에 하나씩 완료한다.
13. 저장소 지침에 별도 위임 요구가 없다면 단일 에이전트로 수행한다.
14. 실제 데이터 삭제, 공유/운영 DB migration apply, 실운영 초대 발송처럼 추가 승인이 필요한 mutation만 사용자에게 확인한다.

## 4. 감사 시점 사실을 read-only로 재확인

감사 당시 로컬 DB:

~~~text
Total users: 1,478
ADMIN role users: 22
Page-visible ADMIN users: 4
MASTER_ADMIN role users: 4
Page-visible MASTER_ADMIN users: 0
FINANCE_APPROVER role users: 12
Page-visible FINANCE_APPROVER users: 2
AdminOperatorPermission rows: 18
ADMIN users without permission row: 4
AdminOperatorCredential rows: 1
Active ADMIN app sessions: 0
admin_operator.* audit actions: 4
Latest 30 Admin Web actions: 30 admin_web.page_view
Name/id heuristic audit-or-smoke ADMIN users: 20/22
~~~

이 수치는 하드코딩하지 않는다. 현재 데이터가 바뀌었다면 read-only 진단으로 다시 측정한다.

- 전체 사용자와 ADMIN total
- 역할별 count
- 목록 조건과 total의 동일성
- next page/cursor 존재 여부
- permission row 있음/없음/empty 수
- direct categories와 effective categories
- credential/invitation/status별 수
- Admin Web active/recent/stale session 수
- exact operator lifecycle audit action별 수
- explicit fixture provenance별 수
- production에서 허용되지 않는 high-privilege fixture 수

이름에 smoke, audit, demo, local이 포함된다는 이유만으로 자동 삭제하거나 production fixture로 확정하지 않는다. 이름 패턴은 진단 신호일 뿐 source of truth가 아니다.

## 5. 최소 구현 원칙과 금지사항

보안과 정확성을 줄이지 말되 불필요한 범용 프레임워크를 만들지 않는다.

- 기존 Admin surface, drawer, dialog, form, notice, filter, table, date formatting 패턴을 먼저 재사용한다.
- 새 data-grid, form, state-management, validation, icon, UI 라이브러리를 추가하지 않는다.
- permission manifest를 위한 새 package를 만들지 말고 기존 packages/shared 또는 가장 작은 공유 모듈을 사용한다.
- API truth를 UI에서 재계산하거나 부분 목록으로 KPI를 만들지 않는다.
- API 실패를 빈 배열, 0, No operators로 대체하지 않는다.
- unsupported permission을 조용히 버리지 않는다.
- 빈 permission 배열을 기본 권한으로 바꾸지 않는다.
- 신규 운영자에게 Push send, Finance, Publish, Delete, Admin operator management를 기본 부여하지 않는다.
- User.email 전체에 검증 없이 unique migration을 바로 추가하지 않는다.
- email 중복 시 findFirst로 계속하지 않는다.
- 운영자가 영구 초기 비밀번호를 지정하거나 채팅/문서로 전달하게 하지 않는다.
- 비밀번호 hash/salt, invitation raw token, session secret을 UI/API/audit/log에 노출하지 않는다.
- AdminAuditLog를 invitation 또는 session의 유일한 mutable 상태 저장소로 사용하지 않는다.
- Master Admin 0명 fallback을 일반 웹 운영 경로로 유지하지 않는다.
- Finance Approver 변경을 이 페이지와 Finance Approvers 페이지 양쪽에 남기지 않는다.
- 고위험 권한을 bulk edit하거나 bulk suspend하는 기능을 추가하지 않는다.
- 전체 Admin shell이나 다른 Finance 화면을 함께 재설계하지 않는다.
- 1024px 이하 반응형 CSS를 추가하거나 검수하지 않는다.
- 디자인 개선만 완료하고 P0를 남긴 채 Release ready를 선언하지 않는다.

## 6. P0-A — 정확한 운영자 전용 목록과 KPI

현재 /admin/users?take=100은 API에서 최대 50으로 제한되고, 최신 전체 사용자 50명 중 ADMIN만 화면에서 필터링한다. 이를 제거한다.

### 구현 요구

1. 운영자 전용 서버 필터 계약을 만든다.

권장 예시:

~~~http
GET /admin/users/admin-operators?q=&status=&role=&category=&cursor=&take=25
~~~

현재 route ownership에 더 자연스러운 이름이 있으면 조정할 수 있지만 일반 사용자 목록의 부분집합을 UI에서 만드는 방식은 금지한다.

2. 응답은 최소 다음 형태를 가진다.

~~~ts
type AdminOperatorDirectoryPage = {
  items: AdminOperatorDirectoryItem[];
  totalCount: number;
  countsByRole: {
    admin: number;
    masterAdmin: number;
    financeApprover: number;
  };
  countsByState: Record<string, number>;
  nextCursor: string | null;
};
~~~

3. 목록·total·role count는 동일한 필터 정의와 일관된 snapshot을 사용한다.
4. cursor에 안정적인 tie-breaker를 포함한다.
5. take는 25 기본, 50 최대 등 bounded 상태를 유지한다.
6. 목록 item은 화면에 필요한 최소 select만 사용한다.

~~~text
id
fullName
adminEmail
state
roles
directCategories
effectiveCategorySummary
authenticationSetupState
mfaState
lastAdminWebSignInAt
activeAdminWebSessionCount
permissionVersion
createdAt
updatedAt
~~~

7. customerProfile, providerProfile, pushDevices, 모바일 appSessions 전체를 목록 payload에 포함하지 않는다.
8. All records는 true total을 받았을 때만 사용한다.
9. count endpoint 실패 시 카드별 0이 아니라 명시적인 load failure와 Retry를 보여준다.
10. 일반 사용자 50명보다 오래된 ADMIN도 반드시 발견되는 회귀 테스트를 추가한다.

## 7. P0-B — UI/API/guard permission manifest 단일화

현재 프런트는 36개 leaf permission을 보여주지만 API 저장 allowlist에는 Content 4개가 없고 legacy parent가 섞여 있다.

### 구현 요구

1. 하나의 canonical permission manifest를 만든다.
2. 기존 shared package가 있으면 그 안에 최소 모듈을 추가한다.
3. manifest는 필요한 최소 정보를 포함한다.

~~~ts
type AdminOperatorPermissionDefinition = {
  key: string;
  group: string;
  label: string;
  description: string;
  risk: 'READ' | 'OPERATE' | 'APPROVE' | 'PUBLISH' | 'DELETE' | 'ADMINISTER';
  defaultOwner: string;
};
~~~

4. Admin Web 체크박스, route access model, API 저장 validation, API category guard test가 같은 key 집합을 사용한다.
5. Prisma enum과 canonical leaf manifest의 parity를 CI에서 검증한다.
6. CONTENT_VIEW, CONTENT_EDIT, CONTENT_PUBLISH, CONTENT_DELETE를 저장·조회·guard에서 실제 지원한다.
7. legacy parent category는 migration 호환에만 사용하고 신규 UI에서 직접 부여하지 않는다.
8. legacy parent로 얻은 권한은 effective access에서 원인을 표시한다.
9. 알 수 없거나 미지원 permission은 400 structured error로 거부한다.
10. UI에서 선택한 모든 key가 저장 후 round-trip 되는 parity 테스트를 추가한다.
11. Content View/Edit/Publish/Delete 각각에 대해 page/API method 접근 테스트를 추가한다.

## 8. P0-C — empty, undefined, missing permission 의미 분리

계약:

~~~text
permissionCategories omitted/undefined = 기존 값 유지
permissionCategories [] = 명시적 권한 없음
permissionCategories [keys...] = 정확히 해당 direct permissions로 교체
permission row missing = MIGRATION_REQUIRED 또는 명시적 legacy state
~~~

### 구현 요구

1. empty 배열을 기본 권한으로 변환하는 로직을 제거한다.
2. 신규 초대 기본 direct permission은 0개로 한다.
3. 운영자가 역할 템플릿을 선택한 경우에만 template이 명시적으로 key 목록을 채운다.
4. Push send는 어떤 기본 템플릿에서도 자동 부여하지 않는다.
5. permission row가 없는 ADMIN을 위한 read-only 진단과 migration dry-run을 만든다.
6. migration 정책 확정 전 임의 default를 DB에 쓰지 않는다.
7. page gate, API guard, directory effective access가 같은 서버 계약을 사용한다.
8. permission missing 상태는 Access setup required로 표시한다.
9. 안전한 기본값은 deny-by-default이며 UI도 deny 상태를 그대로 보여준다.
10. empty remains empty, undefined preserves, missing is not guessed, template explicit, Push not implicit 테스트를 추가한다.

## 9. P0-D — 관리자 신원 연결과 이메일 중복 차단

현재 User.email은 unique가 아니고 생성 서비스가 email/phone findFirst로 기존 사용자를 선택한다.

### 구현 요구

1. 신규 관리자 이메일을 trim + lowercase + 현재 normalization 규칙으로 정규화한다.
2. AdminOperatorCredential.email 또는 invitation email을 canonical unique login boundary로 유지한다.
3. 기존 사용자에게 Admin access를 부여하려면 별도 existingUserId 흐름을 사용한다.
4. email이 같은 User 후보가 있다고 자동 연결하지 않는다.
5. 중복 또는 모호한 후보가 있으면 409 stable error를 반환한다.

~~~text
ADMIN_OPERATOR_EMAIL_CONFLICT
ADMIN_OPERATOR_IDENTITY_AMBIGUOUS
ADMIN_OPERATOR_CREDENTIAL_EXISTS
~~~

6. Invite new operator와 Grant existing user Admin access를 UI/API에서 구분한다.
7. 기존 credential이 있는 email로 초대를 다시 제출해 비밀번호를 덮어쓰지 않는다.
8. credential reset은 별도 action과 audit event를 가진다.
9. User.email 전체 unique migration은 실제 고객/파트너 데이터 dry-run 없이 적용하지 않는다.
10. 정규화 후 중복, null, 동일 email 여러 User, 기존 credential, revoked operator 재활성을 테스트한다.

## 10. P0-E — Master Admin과 bootstrap 경계

1. 최초 Master Admin 생성은 기존 admin:bootstrap-operator 또는 동등한 1회성 CLI/runbook이 소유한다.
2. CLI는 production에서 명시적 환경 확인, 대상 이메일, dry-run/confirmation, audit evidence를 요구한다.
3. 일반 API는 Master Admin이 0명이어도 non-master ADMIN을 허용하지 않는다.
4. 마지막 Master Admin 제거 방지 가드를 concurrency-safe하게 유지한다.
5. actor가 자신을 수정·정지·강등하지 못하는 기존 가드를 유지한다.
6. Master Admin grant/revoke, operator suspend, credential reset은 최근 재인증을 요구한다.
7. 기존 step-up auth가 없으면 가장 좁은 범위의 재인증 계약을 구현한다.
8. 재인증 token/cookie를 URL, audit metadata, client log에 기록하지 않는다.
9. 1인 운영을 이유로 숨겨진 self-approval 또는 zero-master 웹 fallback을 만들지 않는다.
10. 별도 정책이 없다면 Master role을 위해 새 범용 approval engine을 임의로 만들지 않는다. Master + step-up + required reason + last-master invariant를 완성한다.

## 11. P1-A — 안전한 운영자 초대와 자격 증명 수명주기

목표 흐름:

~~~text
Invite operator
→ email/name 입력
→ 중복/기존 신원 preflight
→ 역할 템플릿 또는 custom access 선택
→ 위험 권한 diff 확인
→ 필수 사유 + Master 재인증
→ 만료되는 one-time invitation 생성
→ 운영자가 자신의 비밀번호 설정
→ 가능한 경우 MFA 등록
→ invitation consumed 및 Active 전환
~~~

### 구현 요구

1. existing invitation/auth mechanism이 있으면 재사용한다.
2. 없다면 관리자 초대에 필요한 가장 작은 durable model을 추가한다.
3. 최소 상태는 normalizedEmail, targetUserId, role/access snapshot, tokenHash, expiresAt, acceptedAt, revokedAt, invitedBy, reason이다.
4. raw invitation token은 hash만 저장한다.
5. token은 one-time, short-lived, cryptographically random이어야 한다.
6. replay, expired, revoked, accepted를 구분한다.
7. 검증된 email delivery가 있으면 사용한다.
8. delivery가 없으면 성공으로 가장하지 말고 durable invitation + copy-once link와 정확한 production blocker를 제공한다.
9. 최초 설정 시 비밀번호 정책을 서버에서 강제한다.
10. 기존 scrypt + random salt + timing-safe compare를 유지한다.
11. password 변경 시 passwordUpdatedAt을 갱신한다.
12. credential에는 setup, failedLoginCount, lockedUntil, lastLoginAt, lastFailedLoginAt, disabled 상태를 필요한 최소 범위로 추가한다.
13. MFA 공급자/계약이 없으면 가짜 MFA를 만들지 말고 NOT_CONFIGURED와 production blocker를 표시한다.
14. login rate limit을 유지한다.

## 12. P1-B — 서버 추적 Admin Web 세션과 즉시 회수

1. Admin Web session을 서버에서 식별·조회·무효화할 수 있게 한다.
2. 모바일 app session 의미를 오염시키면 별도 최소 model을 사용한다.
3. session에는 id/jti, userId, issuedAt, expiresAt, lastSeenAt, revokedAt, revocation actor/reason, platform summary가 필요하다.
4. raw cookie/token은 저장하지 않는다.
5. Admin Web 요청에서 revoked/expired와 ADMIN role을 검증한다.
6. 접근 정지, credential reset, revoke-all 시 활성 세션을 무효화한다.
7. login/session create/revoke를 exact audit action으로 남긴다.
8. Active sessions KPI는 Admin Web session만 의미하도록 문구와 계산을 맞춘다.
9. 모바일 appSessions를 Admin Web activity로 계산하지 않는다.
10. directory에는 Last Admin Web sign-in, Active sessions, Never signed in을 구분한다.
11. 현재 session은 You · current session으로 식별한다.

## 13. P1-C — 페이지 정보 구조 재구성

route는 /admin-operators를 유지한다. 페이지와 navigation naming은 IA와 충돌하지 않는 범위에서 Operator Access로 통일한다.

### 헤더

~~~text
Title: Operator Access
Description: Invite operators, review effective access, and suspend Admin Web access.
Primary CTA: Invite operator
Secondary: Permission guide
Secondary: Access change history
~~~

### KPI

~~~text
Active operators
Pending / expired invites
Master Admins
Security setup incomplete
~~~

Finance Approver는 읽기 전용 link card로 표시할 수 있지만 역할 변경은 Finance Approvers 페이지가 소유한다.

### 위험 알림

실제로 문제가 있을 때만 permission setup required, expired invite, high privilege without MFA, stale high privilege, fixture provenance violation, last Master risk, session data unavailable를 표시한다.

### 검색과 필터

~~~text
Search: name or admin email
Status: All / Invited / Active / Suspended / Locked / Invite expired
Role: All / Admin / Master Admin / Finance Approver
Access domain: All / Bookings / Customers / Partners / Finance / Communications / Content / Administration
Sign-in: All / Never / Active now / Stale
Risk: All / Security setup / Excess privilege / Legacy permission / Fixture provenance
~~~

필터는 URL query에 반영하고 필터 변경 시 cursor를 초기화한다.

### 컴팩트 디렉터리

한 행에 36개 checkbox를 렌더하지 않는다.

| 열 | 내용 |
|---|---|
| Operator | 이름, 관리자 이메일, You |
| Status | Active/Invited/Suspended/Locked/Setup required |
| Roles | 읽기 전용 badge |
| Effective access | 도메인 요약 + N |
| Security | MFA/setup/invite 상태 |
| Last sign-in | Admin Web 기준 |
| Action | View access |

- raw fixture ID와 generated phone을 기본 행에 반복하지 않는다.
- 내부 ID는 상세 technical details에서 복사 가능하게 한다.
- pagination total과 current range를 표시한다.
- empty, no-results, failed 상태를 분리한다.

### 운영자 상세

기존 drawer 패턴을 재사용하고 Overview, Access, Sessions, Change history 탭을 제공한다.

## 14. P1-D — 권한 편집기와 변경 diff

1. 권한은 Bookings, Customers, Partners, Finance, Communications, Website Content, Administration, Developer/System 그룹으로 구성한다.
2. 기존 36개 평면 pill/checklist를 반복하지 않는다.
3. 각 permission에 설명, risk, prerequisite를 표시한다.
4. 필요한 최소 role template만 둔다.

~~~text
Booking operator
Customer support
Partner review
Content editor
Read-only auditor
Custom
~~~

Finance Approver와 Master Admin을 일반 template로 자동 부여하지 않는다.

5. direct/effective/inherited permissions를 구분한다.
6. Master Admin은 All access through Master Admin role로 표시한다.
7. legacy parent access는 원인을 보여준다.
8. 저장 전 Added, Removed, Role changes, High-risk changes, Session impact diff를 보여준다.
9. reason은 12–500자 필수다.
10. expectedVersion을 제출한다.
11. stale version은 409와 비교/재검토 흐름을 제공한다.
12. double submit을 막고 실패 시 입력을 보존한다.
13. 성공 후 audit ID와 변경 요약 receipt를 표시한다.

## 15. P1-E — 접근 정지와 재활성

Delete operator를 제거하고 Suspend Admin Web access로 바꾼다.

~~~text
Suspend Admin Web access
→ 대상 identity 확인
→ roles/access/active sessions 영향 표시
→ 필수 사유
→ Master 재인증
→ 확인
→ 상태 변경 + session 처리 + audit
→ 성공 receipt
~~~

확인 문구:

~~~text
Suspend access for {operator}?
This blocks new Admin Web requests and revokes {N} active session(s).
The underlying customer/Partner user record will not be deleted.
~~~

서버 불변식:

1. actor 자신은 정지할 수 없다.
2. 마지막 Master Admin은 정지할 수 없다.
3. Finance Approver invariant를 약화하지 않는다.
4. 동일 대상 동시 정지는 idempotent 또는 stable conflict여야 한다.
5. 정지와 session revoke가 부분 성공으로 남지 않는다.
6. User 레코드를 삭제하지 않는다.
7. 재활성 시 기존 credential 재사용 또는 새 setup 요구 정책을 명확히 적용한다.

## 16. P1-F — 정확한 Access change history

현재 bucket=Admin Web 30건을 제거한다.

exact lifecycle 예시:

~~~text
admin_operator.invitation.create/resend/revoke/accept
admin_operator.create 또는 activate
admin_operator.access.update
admin_operator.role.master.grant/revoke
admin_operator.access.suspend/reactivate
admin_operator.session.revoke
admin_operator.credential.reset
admin_operator.login.success/failed/lock
~~~

현재 naming을 유지할 수 있지만 exact filter와 의미가 명확해야 한다.

화면 열:

~~~text
Actor
Target operator
Action
Before → After
Reason
Result
Time
Audit ID / correlation ID
~~~

- page view를 기본 history에 섞지 않는다.
- target 상세에서는 target만 필터링한다.
- pagination과 exact total을 제공한다.
- metadata에 token/password/hash/cookie를 기록하지 않는다.
- mutation reason placeholder를 만들지 않는다.
- full Audit Log link는 exact action/target filter를 유지한다.

## 17. P1-G — Finance Approver 역할 소유권 통일

/finance-tax/finance-approvers를 Finance Approver 지정/회수의 단일 운영 화면으로 사용한다.

Admin Operators:

- FINANCE_APPROVER는 읽기 전용 badge다.
- Manage Finance Approver role link를 제공한다.
- assignable roles에서 FINANCE_APPROVER를 제거한다.
- invite/create payload에서 FINANCE_APPROVER를 직접 받지 않는다.

API:

- generic operator access update가 FINANCE_APPROVER를 변경하지 못한다.
- Finance Approvers 전용 service/endpoint만 변경한다.
- 모든 기존 호출자를 검색하고 compatibility plan을 만든다.
- last approver, self-change, independent approval 정책을 약화하지 않는다.

Master Admin role은 Operator Access가 소유한다.

## 18. P1-H — actor capability와 read-only 상태

1. current actor access를 서버에서 가져온다.
2. Master가 아닌 사용자가 directory view 권한만 가진 경우 read-only 화면을 제공한다.
3. 사용할 수 없는 Add/Edit/Suspend form을 렌더한 뒤 API 403을 보여주지 않는다.
4. read-only 문구:

~~~text
View-only access
Master Admin access is required to invite operators or change Admin Web access.
~~~

5. API는 service 내부에서 Master 권한을 다시 검증한다.
6. category view와 role mutation 책임을 테스트한다.

## 19. 오류·상태·문구 계약

generic operatorNotice=failed 하나로 실패를 합치지 않는다.

stable error 예시:

~~~text
ADMIN_OPERATOR_UNAUTHORIZED
ADMIN_OPERATOR_MASTER_REQUIRED
ADMIN_OPERATOR_REAUTH_REQUIRED
ADMIN_OPERATOR_EMAIL_CONFLICT
ADMIN_OPERATOR_IDENTITY_AMBIGUOUS
ADMIN_OPERATOR_INVITATION_EXPIRED
ADMIN_OPERATOR_INVITATION_REVOKED
ADMIN_OPERATOR_PERMISSION_UNSUPPORTED
ADMIN_OPERATOR_PERMISSION_VERSION_CONFLICT
ADMIN_OPERATOR_SELF_CHANGE_BLOCKED
ADMIN_OPERATOR_LAST_MASTER_BLOCKED
ADMIN_OPERATOR_LAST_FINANCE_APPROVER_BLOCKED
ADMIN_OPERATOR_ALREADY_SUSPENDED
ADMIN_OPERATOR_SESSION_REVOKE_FAILED
ADMIN_OPERATOR_REASON_REQUIRED
~~~

상태를 구분한다.

~~~text
Loading
Loaded
Actual empty
No search results
Read-only
Permission denied
Authentication expired
API unavailable
Validation failed
Version conflict
Partial failure if unavoidable
~~~

문구 교체:

| 현재 | 변경 |
|---|---|
| Admin Operators | Operator Access |
| Master admin control | 제거; Invite operator CTA |
| Add operator | Send invite |
| Temporary password | 제거 |
| Access request reason | Reason for access (required) |
| Save permissions | Review access changes |
| Delete operator | Suspend Admin Web access |
| Category permissions are stored separately... | Choose only the work areas this operator needs. |
| Operator activity log | Access change history |
| This table uses the existing bounded... | Active, invited, and suspended Admin Web operators. |
| No recent session | Never signed in 또는 Last sign-in not recorded |
| No platform | 제거 |
| Operator action finished. | 구체적인 결과 |

API, bounded, duplicate phone, role guard 같은 구현 용어를 화면에서 제거한다.

URL query만으로 성공 notice를 위조하지 않는다. 기존 안전한 flash/action-state 패턴이 있으면 재사용하고 실제 서버 응답의 audit ID와 연결한다.

## 20. API와 데이터 계약 원칙

책임 분리 예시:

~~~http
GET    /admin/users/admin-operators
GET    /admin/users/admin-operators/:id
POST   /admin/operator-invitations
POST   /admin/operator-invitations/:id/resend
POST   /admin/operator-invitations/:id/revoke
PATCH  /admin/users/:id/admin-operator-access
POST   /admin/users/:id/admin-operator-suspend
POST   /admin/users/:id/admin-operator-reactivate
GET    /admin/users/:id/admin-web-sessions
POST   /admin/users/:id/admin-web-sessions/revoke-all
POST   /admin/session/reauthenticate
~~~

route 이름은 기존 ownership에 맞게 조정할 수 있다. 다음은 금지한다.

- 일반 user list를 UI에서 ADMIN으로 필터링
- invitation/create/reset을 하나의 upsert로 처리
- FINANCE_APPROVER를 generic access patch에서 변경
- session revoke 없이 suspend 성공 처리
- unsupported permission silent drop

access patch는 permissionCategories, masterAdminEnabled, expectedVersion, reason, step-up proof를 필요한 최소 구조로 받고 before, after, effective access, version, audit ID를 반환한다.

## 21. DB migration과 데이터 안전

1. schema 변경이 필요하면 migration을 추가한다.
2. 기존 사용자/permission/credential 데이터를 임의 삭제하지 않는다.
3. normalized admin email duplicate를 dry-run한다.
4. permission missing ADMIN을 dry-run한다.
5. legacy parent를 leaf로 변환하면 before/after와 손실 여부를 검증한다.
6. fixture cleanup은 explicit provenance가 있을 때만 자동화한다.
7. 이름 substring으로 delete/update하지 않는다.
8. production high-privilege fixture guard는 explicit provenance를 사용한다.
9. 공유/production DB migration apply는 사용자 승인 없이 실행하지 않는다.
10. rollback 또는 forward-fix 절차를 문서화한다.

migration 후 invariant:

~~~text
모든 Active ADMIN은 explicit permission 또는 Master access를 가진다.
관리자 login email은 canonical boundary에서 중복되지 않는다.
마지막 Master Admin은 존재한다.
Suspended operator는 active Admin Web session이 없다.
Invitation raw token은 DB에 없다.
~~~

## 22. 성능 요구사항

- 기본 page size 25, max 50
- 행에 36개 permission control을 렌더하지 않음
- detail/history/session은 선택 운영자만 로드
- server filter와 index 사용
- 중복 API 호출 제거
- customer/provider profile, pushDevices, mobile session overfetch 제거
- 인증된 API query budget 측정
- 수천 px 반복 폼 제거
- 1440px 첫 화면에 KPI, risk, filter, directory header와 여러 행 표시

## 23. 접근성 및 hardening

### 키보드와 포커스

- 필터, row action, drawer tab, checkbox, confirmation을 키보드로 사용
- drawer/dialog focus trap, Escape, trigger focus return
- active tab과 선택 운영자 전달
- destructive confirm accessible name에 대상 포함

### 오류와 입력

- field error를 입력과 연결
- dynamic result를 live region으로 알림
- reason 11/12/500/501자 테스트
- email normalization, long name, CJK, accents, RTL, emoji 테스트
- timeout, 401, 403, 409, 429, 500 구분
- 실패 후 입력 보존
- submit 연타 idempotency

### 데이터 경계

- 0, 1, 25, 26, 1000+ 운영자
- 긴 이름/이메일/ID
- permission 0/all/legacy/unsupported
- session 0/1/many/expired/revoked
- invitation pending/expired/revoked/accepted

### 데스크톱 범위

- 1440x1000, 1600x1000, 1920x1080
- 1024px 이하 검사·보고·수정 금지
- 가능하면 200% zoom과 Windows high contrast 확인

## 24. 필수 테스트

### Admin Web

- true total/KPI
- server pagination/cursor
- filters와 URL
- actual empty/no results/API failure
- read-only non-master
- invite validation/input preservation
- grouped access editor와 diff
- empty permissions
- Content round-trip
- Master reauth
- suspend confirm
- version conflict recovery
- session list/revoke
- exact history without page views
- Finance role read-only/link
- drawer focus/Escape/return
- long/CJK/RTL layout

### API/service/DTO/guard

- ADMIN filter before take
- total/counts/items consistency
- stable cursor
- permission parity
- unsupported 400
- Content enforcement
- empty vs undefined
- missing permission deny/migration state
- ambiguous email 409
- credential not overwritten by invite
- token hash/expiry/replay/revoke
- passwordUpdatedAt
- login failure/lock/rate limit
- Master-only mutation
- zero-master fallback removed
- self change blocked
- last Master blocked under concurrency
- generic patch cannot change FINANCE_APPROVER
- expectedVersion conflict
- required reason 12–500
- suspend/session revoke atomic
- audit excludes secrets

### 데이터·동시성

- 50명 일반 사용자 뒤의 오래된 ADMIN 발견
- 같은 operator 동시 수정
- 마지막 Master 동시 강등/정지
- suspend와 session refresh 경쟁
- invitation accept/revoke 경쟁
- duplicate invitation idempotency

### 기존 회귀

- AdminOperatorCategoryGuard
- AuthService/AdminService
- Admin Web login/session
- Finance Approvers
- Website Content permission
- visible-copy
- sensitive exposure/secret leak
- Web/API typecheck
- 관련 smoke와 API budget

현재 테스트가 /admin/users?take=100, partial All records, Delete operator, Admin Web bucket history를 기대한다면 삭제하지 말고 새 계약을 검증하도록 수정한다.

## 25. 브라우저 검증과 증거

인증된 in-app browser 또는 저장소가 허용하는 브라우저 도구를 사용한다. 로그인 세션이 없으면 사용자에게 로그인만 요청하고 계속한다.

검증 흐름:

1. true KPI
2. 검색/상태/역할/권한 필터
3. pagination/cursor
4. operator overview
5. direct/effective/inherited access
6. diff와 required reason
7. unsupported/error 상태
8. version conflict
9. invitation preflight/setup
10. suspend/session impact
11. session revoke
12. target exact history
13. read-only non-master
14. actual empty/API failure

저장할 증거:

~~~text
docs/audits/admin-operators-remediation-evidence-2026-08-11/

01-operator-access-overview.png
02-filtered-operator-directory.png
03-operator-detail-overview.png
04-effective-access.png
05-access-change-diff.png
06-required-reason-validation.png
07-version-conflict.png
08-invite-operator.png
09-suspend-confirmation.png
10-session-revoked.png
11-exact-access-history.png
12-read-only-master-required.png
13-api-unavailable.png
~~~

안전하게 재현할 수 없는 상태는 production DB에 가짜로 만들지 말고 test/fixture environment를 사용한다. 재현하지 못하면 정확한 blocker로 보고한다.

UI 변경 후 Impeccable detector를 관련 변경 대상에 한 번 실행한다.

~~~powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <changed-ui-targets>
~~~

검출 결과를 실제 결함 기준으로 한 번의 bounded 수정 pass에서 해결하고 최종 확인한다.

## 26. 권장 실행 순서

### Phase 0 — 증거와 계약

- 화면/DB/API/auth/permission truth
- role/permission/credential/session 호출자 inventory
- baseline tests

### Phase 1 — P0 데이터·권한

- operator directory API와 true count
- canonical permission manifest
- Content 저장/guard
- empty/undefined/missing
- ambiguous identity 차단
- zero-master fallback 제거

### Phase 2 — 인증·세션

- invitation/setup
- credential timestamp/lock
- Admin Web session
- step-up reauth
- suspend/session revoke

### Phase 3 — 운영 UI

- KPI/risk/filter/compact directory
- operator detail
- grouped permission editor/diff
- exact history
- Finance ownership
- structured error/receipt

### Phase 4 — migration·검증

- migration/dry-run
- unit/integration/concurrency/E2E
- copy/security/typecheck/budget
- 1440px evidence/detector

P0가 크다는 이유로 시각 개선만 먼저 적용하고 종료하지 않는다. 반대로 backend만 수정하고 10,000px 반복 폼을 남기지 않는다.

## 27. 완료 판정 체크리스트

### P0

- [ ] server-filtered directory와 true count
- [ ] stable pagination
- [ ] canonical permission manifest
- [ ] Content 4개 round-trip
- [ ] unsupported 400
- [ ] empty/undefined 분리
- [ ] missing permission 통일
- [ ] ambiguous email 409
- [ ] zero-master fallback 제거

### 인증·세션

- [ ] 초기 비밀번호 제거
- [ ] expiring one-time invitation
- [ ] credential overwrite 제거
- [ ] passwordUpdatedAt
- [ ] login failure/lock
- [ ] Admin Web session tracking
- [ ] suspend session revoke
- [ ] step-up reauth
- [ ] secret 비노출

### UX

- [ ] Operator Access header/CTA
- [ ] 정확한 KPI/risk
- [ ] search/filter/total/pagination
- [ ] compact directory
- [ ] Overview/Access/Sessions/History
- [ ] grouped editor
- [ ] direct/effective/inherited
- [ ] before/after diff
- [ ] required reason
- [ ] conflict recovery
- [ ] Suspend confirmation
- [ ] Finance ownership
- [ ] exact history
- [ ] read-only state
- [ ] empty/failure 분리

### 검증

- [ ] keyboard/focus/accessibility
- [ ] long/CJK/RTL/high contrast/zoom
- [ ] slow/error/double submit
- [ ] Web/API/auth/guard tests
- [ ] concurrency tests
- [ ] migration dry-run
- [ ] visible-copy/security/typecheck
- [ ] API budget 또는 blocker
- [ ] Impeccable detector
- [ ] 1440px evidence
- [ ] unrelated changes 보존

P0 하나라도 남으면 Release hold와 blocker를 보고한다.

## 28. 최종 산출물과 응답

산출물:

1. 변경 파일과 목적
2. identity/access/session 계약
3. permission parity
4. migration/dry-run/rollback
5. read-only 데이터 진단
6. fixture/provenance 위험
7. 변경 전후 UI
8. tests pass/fail/blocked
9. performance/API budget
10. 1440px evidence
11. 실행하지 않은 mutation
12. Release 판정

최종 응답 형식:

~~~text
Verdict: Release ready | Release hold
P0 remaining: 0 | N
Tests: N passed, N failed, N blocked
Data mutations: none | explicit list
Migrations: created/not applied | applied with approval | none
Evidence: path
Remaining blockers: exact list
~~~

## 29. Codex 최종 실행 지시

지금 바로 구현을 시작하라. 새 분석 보고서나 또 다른 프롬프트만 작성하고 멈추지 않는다.

- 현재 코드와 DB를 다시 확인한다.
- 계획을 만들고 P0부터 실제 코드를 수정한다.
- 기존 사용자 변경을 보존한다.
- 필요한 테스트를 작성하고 실행한다.
- 1440px 실제 화면을 캡처해 검증한다.
- 권한이 없는 DB/data mutation만 보류하고 나머지는 끝까지 완료한다.
- 보류 항목은 필요한 승인이나 외부 설정을 정확히 보고한다.

최종 목표는 운영자 4명이 보이는 권한 체크박스 페이지가 아니라 모든 관리자 신원과 실제 effective access가 정확하며, 초대부터 정지와 세션 회수까지 추적 가능한 운영 통제 화면이다.

