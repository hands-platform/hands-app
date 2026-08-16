# Admin Operators 최종 재감사 개선용 Codex 실행 프롬프트

아래 내용 전체를 새 Codex 작업에 그대로 입력한다.

---

## 역할

너는 HANDS 관리자 시스템의 senior full-stack engineer이자 운영 통제 UX 담당자다.

이번 작업은 새 감사 보고서를 작성하는 일이 아니라, 이미 확인된 Admin Operators 문제를 실제 코드·데이터 계약·테스트·1440px 화면에 반영하는 구현 작업이다.

운영자는 개발자가 아니다. 화면은 내부 ID나 구현 구조보다 다음 질문에 먼저 답해야 한다.

1. 지금 누가 Admin Web에 접근할 수 있는가?
2. 누구에게 어떤 조치가 필요한가?
3. 이 운영자의 실제 유효 권한은 무엇인가?
4. 초대·권한 변경·세션 회수·정지·퇴사 처리를 어디서 안전하게 완료하는가?
5. 누가, 언제, 왜 변경했고 결과가 무엇이었는가?

## 작업 위치

반드시 다음 저장소에서 작업한다.

C:\dev\massage-on-demand-vn

C:\dev\massage-vn-workspace는 사용하지 않는다.

저장소의 AGENTS.md를 먼저 읽고 따른다. 이 저장소는 single-agent workflow이므로 subagent나 multi-agent 도구를 사용하지 않는다.

## 기준 자료

다음 자료를 먼저 읽고, 보고서의 사실을 현재 코드와 read-only 조회로 재확인한다.

1. docs/audits/admin-operators-final-reaudit-2026-08-14.md
2. docs/audits/admin-operators-final-reaudit-evidence-2026-08-14/README.md
3. docs/agent/prompts/admin-operators-remediation-master.md
4. docs/audits/admin-operators-remediation-evidence-2026-08-12/README.md
5. apps/admin_web/app/admin-operators/**
6. apps/admin_web/lib/admin-operator-permissions.ts
7. apps/api/src/admin/admin-identity.routes.ts
8. apps/api/src/admin/admin.service.ts의 admin operator 관련 코드
9. apps/api/src/auth/**의 Admin Web 로그인·토큰·세션 코드
10. apps/api/src/admin/admin-finance-approver-governance.integration.spec.ts
11. apps/api/prisma/schema.prisma와 관련 migration

보고서와 현재 코드가 다르면 현재 코드와 재현 가능한 테스트를 기준으로 판단하고, 차이를 최종 결과에 기록한다.

## 목표

Admin Operators를 “관리자 목록을 보여주는 화면”에서 다음 조건을 충족하는 운영 통제 화면으로 완성한다.

- 디렉터리, KPI, 필터, 행 상태가 동일한 서버 계약을 사용한다.
- 테스트 fixture가 운영자 수와 보안 지표를 오염시키지 않는다.
- 모든 조치 필요 상태가 페이지 안에서 해결 가능한 작업으로 이어진다.
- 초대부터 권한 초기화·변경, 세션 회수, 정지, 재활성, offboarding까지 안전하고 감사 가능하다.
- Master Admin과 Finance Approver에게 실제 MFA가 적용된다.
- 운영자가 보는 숫자, 상태명, 권한 수, 필터 결과가 서로 모순되지 않는다.
- 기존 HANDS Admin 디자인 시스템을 유지하면서 1440px 이상에서 빠르게 스캔하고 처리할 수 있다.

## 완료 조건

다음 조건을 모두 충족해야 작업 완료로 판정한다.

1. 보고서의 P1-01부터 P1-08까지 실제 코드 또는 명시적인 외부 blocker로 닫혀 있다.
2. P2-01부터 P2-09까지 구현하거나, 현재 구조상 불필요함을 테스트 가능한 근거로 설명한다.
3. 관련 Admin Web/API/auth/Prisma 테스트가 통과한다.
4. 변경한 패키지의 build, typecheck, lint 또는 저장소 scope 검증을 실행한다.
5. 1440 × 1000 실제 로그인 화면을 상태별로 캡처하고 시각적으로 검수한다.
6. 숫자·필터·상태·권한의 데이터 계약을 자동화 테스트로 고정한다.
7. 사용자 데이터 삭제나 실제 접근 권한 mutation은 승인 없이 실행하지 않는다.
8. 완료되지 않은 외부 설정을 UI mock이나 성공 문구로 위장하지 않는다.

P1이 하나라도 구현되지 않았거나 외부 blocker로 명확히 분리되지 않으면 Release ready라고 쓰지 않는다.

## 작업 권한과 안전 경계

### 바로 수행해도 되는 작업

- 현재 코드, 테스트, 로그, schema, migration, 화면을 읽기
- 범위 안의 Admin Web/API/auth/test/docs 코드 수정
- 새 migration 파일과 dry-run/cleanup 도구 작성
- 테스트 데이터 생성이 격리되도록 integration test 수정
- 비파괴 build, lint, typecheck, unit/integration test 실행
- 로컬 로그인 화면의 read-only 탐색과 스크린샷
- 테스트 안에서 격리된 fixture 생성·정리

### 승인 없이 수행하지 말 것

- 현재 DB의 ADMIN 역할, permission, credential, invitation, session 레코드 삭제 또는 수정
- 추정 패턴만으로 테스트 계정 일괄 삭제
- production/staging migration 적용
- 실제 초대 발송, 권한 저장, 계정 정지, 세션 회수, offboarding
- 실제 외부 이메일/SMS/MFA provider 설정 변경
- .env 비밀 값 출력 또는 교체

데이터 정리가 필요하면 기본 동작이 read-only인 dry-run 도구, exact 대상 매니페스트, 건수, 식별 근거, rollback 계획을 먼저 만든다. apply 모드는 별도 명시적 플래그와 사용자 승인을 요구해야 한다.

## 보존 원칙

- 기존 dirty worktree와 사용자 변경을 보존한다.
- 관련 없는 리팩터링과 전역 디자인 변경을 하지 않는다.
- 기존 Admin shell, tokens, form controls, cards, tables, badges, drawer 패턴을 재사용한다.
- 기존 권한 보안 계약을 약화시키지 않는다.
- Finance Approver 역할의 소유권은 /finance-tax/finance-approvers에 유지한다.
- missing permission은 계속 deny-by-default여야 한다.
- Master Admin 자기 권한 변경 금지와 마지막 활성 Master 보호를 유지한다.
- 1024px 이하 디자인은 이번 범위에서 검사하거나 수정하지 않는다.
- 1440px 이상 데스크톱만 QA한다.
- 개인 이메일, 토큰, 비밀번호, MFA secret, recovery code를 로그·스크린샷·문서에 노출하지 않는다.

## 현재 확인된 기준값

감사 시점의 로컬 데이터는 다음과 같다. 구현 전 read-only로 다시 확인하되, 수치가 달라졌으면 새 값을 사용한다.

- Admin operators: 34
- Master Admins: 10
- Finance Approvers: 18
- permission record 누락: 16
- credential 누락: 21
- permission과 credential 모두 누락: 4
- MFA configured: 0
- active Admin Web sessions: 3
- 휴리스틱상 테스트성 운영자: 33/34
- finance-governance 테스트 실행 잔존 계정: 12

현재 UI의 Security setup incomplete 37은 사람 수가 아니라 중복 문제 건수다. 이 숫자를 CSS나 문구로 숨기지 말고 서버 데이터 계약에서 바로잡는다.

---

## Phase 1 — 데이터 신뢰성과 테스트 격리

### 1. Finance Approver 통합 테스트 fixture 오염 방지

apps/api/src/admin/admin-finance-approver-governance.integration.spec.ts와 관련 helper를 수정한다.

요구사항:

- 테스트 사용자를 AdminUserProvenance.PRODUCTION으로 만들지 않는다.
- 모든 fixture는 FIXTURE provenance와 고유 testRunId를 가진다.
- 테스트는 production/shared operational DB에 의존하지 않는 격리 전략을 사용한다.
- 가능한 경우 테스트 전용 schema/DB 또는 rollback 가능한 transaction을 사용한다.
- beforeEach와 afterEach 모두 exact testRunId 기반 정리를 수행해 중간 실패에도 잔존 가능성을 낮춘다.
- cleanup이 실패하면 테스트가 조용히 성공하지 않아야 한다.
- fixture가 운영 KPI와 directory 응답에 포함되지 않는 계약 테스트를 추가한다.

현재 남은 것으로 추정되는 12개 레코드는 직접 삭제하지 않는다. 다음을 제공하는 dry-run cleanup 도구를 작성한다.

- exact candidate IDs
- provenance
- testRunId 또는 생성 근거
- 현재 역할·permission·credential·session 의존성
- 삭제 가능/수동 검토/보호 대상 판정
- 기본 read-only
- apply 시 명시적 승인 플래그
- 실행 전 백업 또는 rollback 안내
- 실행 결과 감사 기록

### 2. 운영 데이터와 fixture 데이터 경계

- 운영자 디렉터리와 KPI가 어떤 provenance를 포함하는지 명시적인 서버 정책으로 만든다.
- 운영 환경에서는 FIXTURE를 제외한다.
- 개발 환경에서 fixture 표시가 필요하면 Include test records를 기본 꺼진 진단 옵션으로 분리한다.
- 사용자명이나 이메일의 smoke/test 문자열만으로 production 데이터를 자동 제외하지 않는다.
- provenance와 검증된 fixture metadata만 사용한다.

---

## Phase 2 — 단일 상태·KPI·필터 계약

### 3. 상호 배타적인 lifecycle status

디렉터리 행, status filter, filteredTotal, summary가 동일한 계산식을 사용하게 한다.

최소 상태:

- SUSPENDED
- LOCKED
- MIGRATION_REQUIRED
- SETUP_REQUIRED
- ACTIVE

하나의 운영자는 동시에 하나의 lifecycleStatus만 가져야 한다.

권장 우선순위:

1. suspended이면 SUSPENDED
2. 현재 lock이 유효하면 LOCKED
3. permission record가 없으면 MIGRATION_REQUIRED
4. sign-in credential 또는 초대 수락이 완료되지 않았으면 SETUP_REQUIRED
5. 나머지는 ACTIVE

현재 domain 모델상 다른 우선순위가 더 정확하면 근거와 테스트를 남기고 조정할 수 있다. 핵심은 서버 필터와 렌더링 상태가 같은 함수를 사용한다는 것이다.

필수 테스트:

- status=setup-required의 모든 반환 행이 SETUP_REQUIRED
- status=migration-required의 모든 반환 행이 MIGRATION_REQUIRED
- filteredTotal과 실제 조건의 count 일치
- permission과 credential이 모두 없는 행의 상태가 하나로만 결정
- suspended/locked 우선순위

### 4. Security setup incomplete distinct count

현재 Admin Web의 단순 합산을 제거한다.

API 응답은 최소 다음 의미를 구분한다.

- securityIncompleteDistinct: 문제가 하나 이상 있는 고유 운영자 수
- missingPermission
- missingCredential
- locked
- mfaNotConfigured

같은 운영자가 여러 문제를 가져도 KPI 주 값에는 한 번만 포함한다.

UI:

- KPI 주 값은 securityIncompleteDistinct
- 보조 breakdown에 각 문제 건수 표시
- 총 운영자보다 큰 사람 수를 표시하지 않음
- 클릭하면 동일 계약의 조치 필요 큐로 이동

### 5. 유효 권한 필터와 저장 권한 정규화

현재 legacy parent permission이 UI에서는 leaf로 확장되지만 서버 category filter는 raw array의 has만 사용한다.

수정:

- canonical permission manifest는 기존 단일 소스를 유지한다.
- 저장 권한을 leaf-only로 변환하는 idempotent migration과 dry-run을 만든다.
- migration 전 과도기에도 category filter는 legacy parent → effective leaf 확장 규칙과 동일하게 동작한다.
- 디렉터리 응답에 storedPermissionCount와 effectiveLeafPermissionCount를 분리한다.
- UI 기본 값은 Effective access를 사용한다.
- Stored entries는 migration/diagnostic 정보로만 표시한다.

필수 테스트:

- legacy parent를 가진 운영자가 해당 effective leaf filter에 검색됨
- canonical leaf-only 저장 round-trip
- unsupported category 400
- Website Content 권한 포함
- empty array와 missing permission 의미 유지

---

## Phase 3 — 막힌 운영 업무 완성

### 6. Permission policy initialization

MIGRATION_REQUIRED 운영자의 Access 탭에서 작업이 막히지 않게 한다.

요구사항:

- Initialize permission policy CTA
- 선택한 leaf permissions 또는 명시적인 빈 권한 저장 가능
- 기본 권한 자동 추정·자동 부여 금지
- Master Admin 역할 변경과 일반 permission 초기화를 구분
- 고위험 권한 표시
- 변경 후 세션 영향 표시
- 최근 재인증 필요
- 최소 12자 사유
- 원자적 create와 exact audit event
- 동시 초기화 충돌 시 409와 reload/review 안내
- self edit, last Master, Finance ownership 보호

일반 update endpoint를 안전하게 확장하거나 전용 initialize endpoint를 추가할 수 있다. 선택한 계약과 이유를 테스트로 고정한다.

### 7. Invitation revoke와 resend

Pending invitation 목록에서 다음 동작을 제공한다.

- Revoke invitation
- Resend invitation

규칙:

- 둘 다 Master Admin, 최근 재인증, 입력 사유 필요
- resend는 기존 token을 즉시 폐기하고 새 hashed token과 새 expiry를 생성
- setup token은 한 번만 표시하고 DB/log/audit metadata에 평문 저장 금지
- 기존 초대와 새 초대의 연결 관계를 감사 가능하게 기록
- 중복 pending 초대가 생기지 않음
- delivery 상태를 최소 PENDING/SENT/DELIVERY_FAILED/ACCEPTED/EXPIRED/REVOKED로 구분
- 실제 email provider가 설정되지 않았으면 SENT라고 표시하지 않음
- 실패 시 사용자가 복구할 수 있는 문구와 retry 경로 제공

Existing user ID (optional) 직접 입력은 제거한다.

초대 드로어를 다음 두 흐름으로 분리한다.

1. Invite new operator
2. Grant Admin access to existing user

기존 사용자는 서버 검색으로 이메일·이름·안전한 보조 ID를 확인한 뒤 단일 대상을 선택한다. 동일 이메일이 여러 계정에 있으면 자동 선택하지 않는다.

### 8. 세션 회수 hardening

Sessions 탭:

- 최근 재인증 여부와 남은 유효 시간을 표시
- 다른 운영자 세션 회수 전에 확인 다이얼로그 표시
- 대상 운영자, current 여부, last seen, expires, device/platform, 영향 표시
- hidden 고정 사유를 제거하고 최소 12자 입력 사유 요구
- double submit 방지
- 성공 시 audit ID와 회수 결과 표시
- stale/already revoked/concurrent revoke 오류를 구분
- 현재 세션은 Revoke가 아니라 Sign out this session으로 분리
- 다른 사람의 세션과 자기 현재 세션의 보호 규칙을 테스트

Admin Web 로그인 경로에서 안전한 user-agent/platform 요약을 생성해 platformSummary에 저장한다.

- 최대 길이 제한
- raw header 전체 저장 금지
- IP나 민감 식별자의 불필요한 표시 금지
- 기존 null 값은 Device details unavailable for this sign-in으로 표시

### 9. Suspend eligibility와 offboarding

API directory/detail 응답에 UI가 추측하지 않아도 되는 allowedActions와 blockedReasons를 제공한다.

예:

- canInitializeAccess
- canUpdateAccess
- canSuspend
- canReactivate
- canRevokeOperatorAccess
- canRevokeSession

불가능한 동작은 제출 후 오류로 알리지 말고 disabled 상태와 해결 경로를 먼저 보여준다.

- credential 없음 → permission/sign-in setup 또는 legacy cleanup 안내
- Finance Approver → Finance Approvers 페이지에서 먼저 처리
- last active Master → 대체 Master 필요
- self action → 다른 Master가 수행해야 함

API에 이미 존재하는 DELETE users/:id/admin-operator를 안전한 UI에 연결한다.

영구 offboarding 조건:

- 먼저 SUSPENDED 상태
- 활성 세션 0
- Finance Approver role 해제
- last active Master 보호
- 최근 재인증
- 최소 12자 사유
- 운영자명 재입력 확인
- 제거되는 역할, credential, permission, invitation 처리 결과를 사전 표시
- exact audit event와 결과 receipt

실제 데이터에 offboarding을 실행하지 말고 테스트 fixture로만 E2E를 검증한다.

---

## Phase 4 — 실제 MFA

현재 mfaState 표시만 유지하는 것은 완료가 아니다.

Admin Web 인증 구조를 먼저 조사하고, 검증된 표준 방식으로 다음을 구현한다.

- MFA enrollment
- challenge 후에만 Admin Web session 발급
- recovery codes
- recovery code 1회 사용
- MFA reset
- enrollment/reset/challenge failure 감사 이벤트
- rate limiting과 lockout 연동
- Master Admin과 Finance Approver의 MFA 강제
- 고위험 access/session/invitation/offboarding 작업의 MFA 또는 동등한 step-up gate

보안 조건:

- TOTP secret 평문 로그 금지
- recovery code 평문 저장 금지
- secret은 기존 프로젝트 secret/encryption 경계에 맞춰 암호화
- recovery code는 hash 저장
- QR/secret은 enrollment 시 필요한 범위에서만 노출
- session/token 발급 전에 challenge 완료 확인
- MFA 우회용 hidden flag나 개발 기본값 금지
- 설정되지 않은 외부 의존성은 명확한 blocker로 보고

새 dependency가 필요하면 먼저 기존 dependency와 플랫폼 기능을 확인한다. 작은 표준 라이브러리로 해결 가능할 때만 추가하고 선택 이유를 기록한다.

MFA 전체 구현이 외부 키나 정책 결정 때문에 막히면:

1. 가능한 server/data/test/UI contract까지 구현한다.
2. UI에는 MFA not available in this environment 또는 정확한 blocked 상태를 표시한다.
3. configured처럼 보이게 만들지 않는다.
4. 필요한 외부 값과 보안 결정을 최종 blocker에 정확히 적는다.

---

## Phase 5 — 운영자 중심 화면 정리

기존 시각 시스템을 유지한다. 새 admin shell, 새 색상 체계, 장식적 dashboard를 만들지 않는다.

### 10. 상단 command strip

큰 KPI 카드 4개와 큰 경고 카드의 누적 높이를 줄인다.

1440px 첫 화면에서 다음이 최대한 함께 보여야 한다.

- 페이지 제목과 primary action
- compact command strip
- 조치 필요 큐
- 검색·필터
- 테이블 헤더와 첫 운영자 행

command strip:

- All operators
- Needs action
- Pending invitations
- Locked

각 값은 읽기 전용 숫자가 아니라 동일 서버 필터를 적용하는 링크다.

조치 필요 큐:

- Permission policy required
- Sign-in setup required
- MFA required
- Locked
- Pending invitation

0건 큐는 기본적으로 낮은 강조로 표시하되, 전체 목록을 과도하게 숨기거나 Additional queues 같은 별도 대형 메뉴를 만들지 않는다.

### 11. 검색과 필터

- search: 이름, admin email, 안전한 operator ID
- lifecycle status
- role
- access domain
- high-risk access
- fixture 포함 여부는 개발 진단 환경에서만

37개 access domain을 긴 flat select로 두지 않는다. 기존 컴포넌트로 가능한 grouped select를 우선 사용하고, 충분하지 않으면 접근 가능한 searchable combobox를 만든다.

필터 적용 시 cursor를 초기화한다.

### 12. 페이지네이션

- First
- Previous
- Next
- 현재 표시 범위와 총 결과

두 번째 페이지에서도 이전 페이지로 돌아갈 수 있어야 한다. 필터와 검색 조건을 URL에 보존한다. Reset과 pagination을 같은 의미로 사용하지 않는다.

### 13. 운영자 행과 권한 수

목록에는 다음만 우선 표시한다.

- operator identity
- lifecycle status
- roles
- effective access summary
- sign-in/MFA state
- last sign-in/device
- View details

direct permission과 effective leaf permission을 섞지 않는다.

- 기본 문구: Effective access
- 일반 수치: N permissions
- 진단 시에만 Stored entries N
- Master Admin: All access through Master Admin

1 permission(s) 같은 문구를 제거하고 정확한 단수·복수를 사용한다. 프로젝트의 i18n/format helper가 있으면 재사용한다.

### 14. 상세 드로어

탭:

- Overview
- Access
- Sessions
- Access history

Sign-in history는 Access history와 분리한다. 별도 탭이나 history 내부 segment를 사용할 수 있다.

Access history 기본값에는 로그인 성공 이벤트를 포함하지 않는다.

필드:

- action
- actor
- target
- before → after
- reason
- result
- time
- audit ID

필터:

- event type
- date
- actor
- result

cursor pagination을 사용한다. 로그인 이벤트가 권한 변경을 밀어내지 않아야 한다.

### 15. 권한 저장 확인

Review and save access가 즉시 저장된다면 Save access로 바꾼다.

다음 고위험 변경에는 실제 review dialog를 제공한다.

- Master Admin grant/remove
- high-risk permission 추가
- 다수 permission 제거
- 명시적 empty access

review dialog:

- 대상 운영자
- 역할 before → after
- permission added/removed
- high-risk change
- session impact
- 입력한 reason
- Cancel / Confirm save

### 16. 문구

내비게이션과 페이지 제목 중 하나의 명칭으로 통일한다.

권장 기준:

| 의미 | 권장 문구 |
|---|---|
| 페이지 | Admin operators |
| 유효 권한 | Effective access |
| credential 누락 | Sign-in setup required |
| permission record 누락 | Permission policy required |
| 접근 차단 | No permission policy saved — access is blocked |
| 기기 정보 없음 | Device details unavailable for this sign-in |
| 저장 | Save access |
| 현재 세션 종료 | Sign out this session |
| 다른 세션 회수 | Revoke session |

문구는 운영자가 원인, 영향, 다음 행동을 이해하도록 작성한다. 내부 DTO, database relation, raw enum, optional ID 같은 개발자 용어를 노출하지 않는다.

---

## Phase 6 — 접근성·오류·현실 데이터 hardening

필수 상태:

- loading
- empty
- no filter result
- partial API failure
- 400 validation
- 401 expired session
- 403 actor permission
- 404 stale target
- 409 concurrent change
- 429 rate limit
- 500 retryable failure
- invitation expired/revoked/accepted
- session already revoked/expired
- permission initialization conflict
- MFA unavailable/challenge failed/locked

요구사항:

- 입력 오류는 해당 필드 가까이에 표시
- 실패 시 입력값과 선택 권한 보존
- 성공을 확인하지 못했으면 성공 문구 금지
- 위험 작업 double submit 방지
- 변경 성공 후 audit ID와 결과 receipt 표시
- 매우 긴 이름·이메일·ID·audit ID가 1440px 레이아웃을 깨지 않음
- 빈 목록과 로드 실패를 같은 상태로 표시하지 않음
- keyboard only로 필터, 드로어, 탭, 폼, 확인 다이얼로그 사용 가능
- Escape와 X로 닫기
- 닫은 뒤 원래 View details 또는 Invite 버튼으로 focus 복귀
- backdrop과 X 버튼이 같은 접근성 이름의 두 버튼으로 노출되지 않음
- dynamic result와 validation summary를 적절한 live region으로 알림
- 색상만으로 상태를 구분하지 않음

1024px 이하 반응형 작업은 하지 않는다.

---

## 구현 품질 원칙

- 기존 코드에서 의미가 중복된 계산은 shared helper 또는 server contract 하나로 합친다.
- UI에서 server truth를 재추정하지 않는다.
- read endpoint는 mutation을 일으키지 않는다.
- 전체 운영자 레코드를 메모리로 가져와 count/filter하지 않는다.
- summary와 filtered rows는 동일 snapshot 또는 일관된 transaction에서 계산한다.
- pagination은 stable ordering과 deterministic cursor를 사용한다.
- raw permission과 effective permission의 명칭을 타입과 응답에서 구분한다.
- 권한·세션·MFA·초대 mutation은 actor, target, reason, before, after, result를 감사 기록한다.
- 민감 정보는 audit metadata와 오류 payload에 넣지 않는다.
- 현재 디자인 시스템으로 해결할 수 있는 UI에 새 dependency를 추가하지 않는다.
- unrelated business behavior를 넓게 리팩터링하지 않는다.

## 필수 테스트

### Admin Web

- command strip 값과 필터 링크
- distinct security KPI
- lifecycle status별 필터와 결과
- legacy/effective access filter
- stored/effective count 문구
- first/previous/next pagination
- migration initialization
- invitation revoke/resend
- existing user picker ambiguity
- session reauth/confirm/reason/current sign-out
- allowedActions/blockedReasons UI
- offboarding preflight
- high-risk access review dialog
- access history/sign-in history 분리
- self read-only
- Finance Approver ownership link
- focus trap/focus return/Escape/backdrop
- loading/empty/partial failure/error receipts
- long text와 1440px overflow

### API/auth/service

- fixture provenance와 cleanup
- fixture exclusion from operational directory/KPI
- distinct securityIncomplete
- lifecycle status 단일 계산
- status filteredTotal parity
- effective permission filter parity
- leaf-only migration idempotency
- initialize access authorization/concurrency/audit
- invitation revoke/resend/token invalidation
- session revoke reauth/reason/audit
- platformSummary sanitization
- allowedActions/blockedReasons
- offboarding preflight와 last Master/Finance/self 보호
- MFA enroll/challenge/recovery/reset/enforcement/rate limit
- secret·token·recovery code 비노출
- permission manifest parity

### 데이터와 회귀

- npm.cmd run admin:operator-access:dry-run
- 새 fixture cleanup dry-run
- migration dry-run을 2회 실행해 idempotency 확인
- 중복 normalized email과 unsupported permissions 확인
- 기존 Admin Web/API 테스트
- 변경으로 인해 발생하지 않은 기존 실패는 baseline과 구분해 보고

## 검증 명령

현재 package scripts와 test runner 문법을 확인한 뒤 가장 좁은 테스트부터 실행한다.

최소 검증:

1. Admin Operators 관련 Admin Web 테스트
2. Admin operator/API/auth/guard/manifest 관련 API 테스트
3. npm.cmd run typecheck --workspace @massage-vn/admin-web
4. npm.cmd run typecheck --workspace @massage-vn/api
5. npm.cmd run build --workspace @massage-vn/admin-web
6. npm.cmd run build --workspace @massage-vn/api
7. npm.cmd run verify:scope -- -Scope admin
8. npm.cmd run verify:scope -- -Scope api
9. npm.cmd run security:admin-sensitive
10. npm.cmd run security:finance-approvers
11. npm.cmd run admin:visible-copy
12. npm.cmd run admin:operator-access:dry-run

전체 test/verify가 너무 오래 걸리면 먼저 targeted 검증을 완료하고 전체 검증을 이어서 실행한다. 실패를 숨기거나 통과로 표현하지 않는다.

## 브라우저 검증

production build의 로그인된 Admin Web을 1440 × 1000에서 직접 확인한다.

반드시 캡처할 상태:

1. 기본 directory와 command strip
2. Needs action 큐
3. Permission policy required 상세과 initialization
4. 초대 목록과 revoke/resend
5. 새 운영자 초대
6. 기존 사용자 접근 부여
7. active operator overview
8. effective access와 high-risk review
9. sessions와 revoke 확인
10. current session sign-out
11. access history
12. sign-in history
13. suspended operator와 offboarding preflight
14. MFA setup/challenge 또는 정확한 blocked state
15. empty/no result/API failure 상태

검증:

- 문서 가로 overflow 없음
- 첫 화면에서 실제 작업 목록이 지나치게 아래로 밀리지 않음
- 필터 URL과 결과가 일치
- drawer/dialog clipping 없음
- 긴 텍스트가 열을 파괴하지 않음
- console error 없음
- 키보드 focus 이동과 복귀
- destructive 실제 데이터를 변경하지 않음

UI 변경 완료 후 Impeccable detector를 변경한 Admin Operators 관련 파일에 한 번 실행하고 결과를 기록한다.

node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json <changed Admin Operators UI files>

## 증거 산출물

다음 디렉터리를 만든다.

docs/audits/admin-operators-remediation-evidence-YYYY-MM-DD/

포함:

- README.md
- before/after 요약
- 상태별 1440px 스크린샷
- read-only 데이터 집계
- migration/cleanup dry-run 결과
- 변경한 API/data contracts
- 실행한 명령과 pass/fail
- 실행하지 않은 mutation
- 외부 blocker
- release verdict

비밀 값과 실제 개인 이메일은 증거에 넣지 않는다.

## 최종 응답 형식

최종 답변은 결론부터 쓰고 다음 항목을 포함한다.

1. Verdict: Release ready 또는 Release hold
2. 완료한 P1/P2 항목
3. 변경 파일과 목적
4. API·DB·auth 계약 변경
5. migration과 cleanup의 생성/적용 여부
6. 데이터 mutation 실행 여부
7. 테스트: passed/failed/skipped
8. 1440px 브라우저 검증 결과
9. protected areas touched
10. remaining blockers
11. evidence 경로

완료하지 못한 항목은 “추후”라고만 쓰지 말고 다음을 명시한다.

- 정확한 blocker
- 현재까지 구현한 범위
- 필요한 사용자 승인 또는 외부 설정
- 안전한 다음 작업

## 정지 조건

- 실제 운영자 데이터 삭제·권한 변경이 필요하면 코드와 dry-run까지만 완료하고 승인을 요청한다.
- MFA/email 외부 비밀 값이 없으면 기능을 성공 상태로 위장하지 말고 blocker로 분리한다.
- 세 번의 의미 있는 시도 후에도 같은 환경 blocker가 반복되면 정확한 증거를 남기고 중단한다.
- 관련 P1 구현과 핵심 검증이 끝났으면 불필요한 전역 리팩터링이나 장식 개선을 추가하지 않는다.

## 최종 실행 지시

지금 바로 현재 코드와 보고서를 확인하고 구현을 시작한다.

새 분석 보고서나 새로운 계획 문서만 작성하고 끝내지 않는다. 먼저 짧은 실행 계획을 세운 뒤 Phase 1부터 실제 코드를 수정하고, 각 단계의 계약 테스트를 통과시키며 진행한다.

안전한 로컬 코드 변경과 비파괴 검증은 별도 확인 없이 수행한다. 기존 사용자 변경을 보존한다. 실제 운영 데이터 mutation과 외부 설정만 위 안전 경계에 따라 보류한다.

최종 목표는 숫자가 보기 좋은 관리자 목록이 아니다. 운영자가 표시된 상태와 숫자를 신뢰하고, 필요한 접근 통제 작업을 안전하게 완료하며, 모든 결과를 나중에 정확히 감사할 수 있는 Admin Operators 운영 화면이다.

---

## 프롬프트 설계 참고

이 실행 프롬프트는 목표, 성공 기준, 권한 경계, 상태 계약, 검증과 정지 조건을 명시하고 동일 지시의 반복을 줄이는 방식으로 구성했다. 이는 [OpenAI 공식 GPT-5.6 model guidance](https://developers.openai.com/api/docs/guides/latest-model)의 outcome-first, explicit success criteria, safe autonomy, relevant validation 원칙을 따른다.
