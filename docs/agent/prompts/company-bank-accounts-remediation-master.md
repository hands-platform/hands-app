# Company Bank Accounts 출시 안전성 및 운영 UX 개선용 Codex 마스터 프롬프트

이 문서는 저장소의 영구 지침이 아니라 **한 번의 구현 작업에 그대로 붙여 넣는 task prompt**다. `AGENTS.md`에 복사하지 말고, Codex에서 `C:\dev\massage-on-demand-vn`을 workspace로 연 다음 이 문서 전체를 실행 프롬프트로 사용한다.

---

당신은 HANDS 관리자 시스템의 시니어 프로덕트·재무 플랫폼 엔지니어다. `/finance-tax/company-bank-accounts`를 1인 또는 소수 운영자가 실제 회사 계좌 등록, 검증, 활성화, 보관, statement import 및 reconciliation 준비 상태 확인에 안전하게 사용할 수 있도록 개선하라.

단순 분석, CSS 정리, 문구 변경으로 끝내지 않는다. 현재 코드·DB 모델·권한·감사 로그·smoke 수명주기·실제 1440px 화면을 다시 확인하고 **보안과 데이터 무결성 P0부터 구현한 뒤 운영 UX를 개선하고 회귀 테스트와 브라우저 증거까지 완료**한다.

현재 감사 점수는 **46/100, Release hold**다. P0가 남아 있는데 카드와 drawer만 개선한 상태를 완료로 보고하지 않는다.

## 1. 작업 위치와 기준 자료

```text
Workspace: C:\dev\massage-on-demand-vn
Primary route: http://localhost:3101/finance-tax/company-bank-accounts
Audit report: docs/audits/company-bank-accounts-final-reaudit-2026-08-11.md
Audit evidence: docs/audits/company-bank-accounts-reaudit-evidence-2026-08-11/
Target viewport: 1440x1000 이상 데스크톱
Excluded viewport: 1024px 이하 전체
```

반드시 직접 열어 볼 증거:

```text
01-company-bank-accounts-overview.png
03-add-bank-account-drawer.png
04-edit-bank-account-drawer.png
05-archive-confirmation.png
06-activate-confirmation.png
08-audit-log-page-view-rows.png
09-recent-account-changes-polluted.png
```

주요 코드 후보:

```text
apps/admin_web/app/finance-tax/company-bank-accounts/**
apps/admin_web/app/finance-tax/approval-queue/**
apps/admin_web/app/finance-tax/finance-approval-summary.ts
apps/admin_web/app/finance-tax/finance-table-panel.tsx
apps/admin_web/app/finance-tax/finance-data-table.tsx
apps/admin_web/components/admin-drawer-surface.tsx
apps/admin_web/components/admin-form-controls.tsx
apps/admin_web/components/confirm-dialog.tsx
apps/admin_web/lib/admin-api.ts
apps/admin_web/lib/admin-operator-access-model.ts

apps/api/src/admin/admin.controller.ts
apps/api/src/admin/admin.dto.ts
apps/api/src/admin/admin.service.ts
apps/api/src/admin/admin-operator-category.guard.ts
apps/api/src/admin/**/*.spec.ts
apps/api/prisma/schema.prisma
apps/api/prisma/migrations/**

infra/scripts/api-smoke.mjs
infra/scripts/**
```

보고서의 line number는 감사 시점 참고값일 뿐이다. 현재 코드에서 심볼, 호출 경로, 테스트와 실제 동작을 다시 찾아라.

## 2. 최종 운영 목표

운영자가 다음 흐름을 실수 없이 완료할 수 있어야 한다.

```text
사용 가능한 실제 회사 계좌와 운영 이상 확인
→ 새 계좌의 은행·법인 소유자·용도·끝 네 자리 입력
→ 검증 증거와 statement import 준비 상태 확인
→ Before/After 및 영향 범위 검토
→ 다른 승인자에게 요청 제출
→ 중앙 Finance Approval Queue에서 승인 또는 반려
→ 활성화 후 import/reconciliation 건강도 확인
→ 보관 전 열린 거래·기본 계좌·대체 계좌 영향 확인
→ 계좌 전용 감사 타임라인에서 전 과정 추적
```

완료 상태는 다음을 모두 만족해야 한다.

1. 어떤 구분자나 문자열을 사용해도 원문 계좌번호가 DB·로그·감사·URL에 저장되지 않는다.
2. production 목록·선택기·업무 처리에서 smoke/test 계좌가 사용될 수 없다.
3. 페이지 조회 로그가 계좌 변경 이력의 상위 N건을 소비하지 않는다.
4. 권한 부족, API 장애, 실제 0건이 서로 다른 화면 상태로 보인다.
5. 승인 절차 밖에서 상태 기본값 때문에 활성 계좌가 생성될 수 없다.
6. 동시 생성·중복 전송이 중복 계좌와 중복 감사 요청을 만들지 않는다.
7. 승인자 부재, 활성화 준비 부족, 보관 영향이 제출 전에 보인다.
8. 승인 결정 workspace는 중앙 Finance Approval Queue 한 곳이다.
9. 운영자는 Current와 Archived를 분리해 보고, 상태 의미를 정확히 이해한다.
10. 1440px 화면에서 입력·비교·제출 액션을 찾기 위해 중첩 disclosure를 펼치거나 긴 페이지를 왕복하지 않는다.

## 3. 시작 전 필수 절차

1. 루트 `AGENTS.md`를 끝까지 읽고 따른다.
2. 기준 감사 보고서를 끝까지 읽고 모든 증거 이미지를 직접 확인한다.
3. `git status --short`와 관련 파일 diff를 확인한다.
4. dirty worktree의 변경은 사용자 소유다. `reset`, `checkout`, `restore`, `clean`, `stash`로 제거하지 않는다.
5. 현재 Admin/API 서버와 DB가 로컬·공유·운영 중 어느 것인지 확인한다. 불명확하면 mutation과 cleanup apply를 수행하지 않는다.
6. 현재 동작을 재현하고 관련 테스트를 먼저 실행해 baseline을 기록한다.
7. API와 UI를 별개의 진실로 만들지 말고 데이터·권한·감사 계약을 먼저 확정한다.
8. 작업 계획을 `P0-A → P0-B → P0-C → P0-D → P1 → P2 → QA` 순서로 만들고 한 번에 하나씩 완료한다.
9. 저장소 지침대로 단일 에이전트로 수행한다. 하위 에이전트에 위임하지 않는다.
10. 실제 데이터 삭제나 권한 정책 변경처럼 추가 승인이 필요한 지점만 사용자에게 확인하고, 나머지는 현재 코드 증거를 바탕으로 계속 진행한다.

## 4. 절대 보존할 안전장치

다음 기존 통제를 제거하거나 약화하지 않는다.

- 생성·편집·활성화·보관을 즉시 적용하지 않고 승인 요청으로 만드는 흐름
- maker/checker 분리와 자기 승인 금지
- 승인·반려 사유와 감사 이벤트
- 거래가 연결된 계좌의 은행명·통화·식별정보 불변 원칙
- `updatedAt` 또는 버전에 의한 낙관적 동시성 검사
- 승인 요청의 정확한 `requestId`
- 위험 행동 확인창의 `alertdialog`, 포커스 경계, Escape와 포커스 복귀
- 원문 계좌번호를 저장하지 않는 보안 원칙
- 기존 거래·statement import·reconciliation·감사 참조의 보존

다음 방식은 금지한다.

- 1인 운영을 이유로 자기 승인 금지를 조용히 제거하는 것
- 원문 계좌번호를 평문, 암호화 컬럼, metadata, 로그, URL에 추가하는 것
- `smoke`, `test`, timestamp 이름만 보고 레코드를 자동 삭제하는 것
- 권한/API 실패를 빈 배열이나 0으로 대체하는 것
- broad audit text query 후 클라이언트에서 target을 필터링하는 것
- 기존 active smoke 계좌를 참조 확인 없이 삭제하는 것
- 새 UI 프레임워크, 상태 관리 라이브러리, 무거운 테이블 라이브러리를 추가하는 것
- 전역 Admin shell이나 무관한 재무 페이지를 함께 재설계하는 것
- 1024px 이하 반응형 작업으로 범위를 확장하는 것

## 5. 감사 시점 사실을 read-only로 재확인

감사 당시 로컬 DB에서는 다음이 확인됐다.

```text
전체 회사 계좌: 13
ACTIVE: 2
INACTIVE: 11
smoke/test로 식별된 계좌: 13/13
실제 회사 계좌: 0
활성 smoke 계좌 연결 거래: 1 + 56 = 57
비활성 staged smoke 계좌 연결 거래: 0
```

최근 변경 화면은 실제 mutation 없이 페이지와 관련 화면을 탐색하는 동안 다음처럼 감소했다.

```text
20 → 19 → 18 → 17 → 14
```

원인 후보는 `/admin/audit-logs?q=company_bank_account&take=20`이 `take=20`을 먼저 적용하고, 페이지 조회 이벤트까지 가져온 뒤 Admin Web에서 `target.startsWith('company_bank_account:')`만 남기는 구조다.

현재 데이터가 달라졌다면 다음을 보고서에 기록한다.

- 총 계좌와 상태별 수
- fixture provenance 근거
- 계좌별 transaction/import/reconciliation 참조 수
- pending approval 수와 가장 오래된 실제 `requestedAt`
- 정확한 계좌 audit 수와 page-view 오염 수
- cleanup 후보와 절대 자동 삭제하면 안 되는 참조 계좌

읽기 측정 자체가 audit page-view를 만들 수 있으므로, 측정 전후 수치 변화도 구분한다.

## 6. P0-A — 계좌번호 입력과 저장 보안

### 현재 문제

공백과 하이픈만 제거한 뒤 전체 숫자인지 검사하면 `1234.5678`, `1234/5678`, 문자·Unicode 공백이 섞인 값이 원문과 유사한 형태로 마스킹 필드에 저장될 수 있다. 화면의 “Raw account numbers are never stored” 약속을 서버가 완전히 보장하지 못한다.

### 구현 요구

1. 일반 Admin 폼에서는 `accountNumberLast4` 네 자리만 입력받는다.
2. `accountNumberMasked` 운영자 입력란을 제거하고 서버가 `•••• 5678` 또는 기존 일관된 형식으로 파생한다.
3. DTO/API가 legacy `accountNumberMasked`를 계속 받아야 한다면 다음 중 하나로 처리한다.
   - 외부 입력을 완전히 거부하고 서버 파생값만 허용한다.
   - 호환 기간에는 strict canonical mask만 허용하고, 입력 전체에 숫자가 네 개를 초과하면 구분자 종류와 관계없이 거부한다.
4. last4는 ASCII 숫자 정확히 네 자리만 허용한다. 공백, 전각 숫자, 기호, 문자, 붙여넣기 혼합값을 구조화된 field error로 거절한다.
5. 원문 계좌번호나 원문과 유사한 입력이 request log, validation log, exception, audit metadata, URL, redirect, telemetry에 남지 않게 한다.
6. 오류 메시지에 사용자가 입력한 원문을 echo하지 않는다.
7. 마스킹 우회 테스트를 최소 다음 값으로 추가한다.

```text
12345678
1234 5678
1234-5678
1234.5678
1234/5678
1234(5678)
1234A5678
1234\u00A05678
１２３４５６７８
```

8. 정상 `last4=5678`은 저장되고 반환값은 서버 파생 마스크만 포함해야 한다.

### 중복 식별 원칙

끝 네 자리만으로 서로 다른 실제 계좌를 완전히 구분할 수 없다. `bank + currency + last4`를 절대적인 중복 키로 주장하지 않는다.

- 기존 bank connector가 안정적인 외부 account ID를 제공하면 이를 우선 사용한다.
- 이미 안전하게 관리되는 일회성 원문 입력 경로가 있고 HMAC secret 운영이 검증된 경우에만 비가역 fingerprint를 고려한다. 원문은 fingerprint 계산 직후 폐기하고 어떤 로그에도 남기지 않는다.
- 중복 검사를 위해 새로 원문 계좌번호 수집을 도입하지 않는다.
- 안전한 고유 식별자가 아직 없다면 potential duplicate 경고와 수동 검토로 처리하고, 동시 요청 중복은 idempotency key와 DB 원자성으로 방지한다.

### P0-A 완료 조건

- 모든 우회 입력 테스트가 서버에서 실패한다.
- Admin Web은 last4만 전송한다.
- 저장·응답·로그·감사·URL에 원문과 유사한 값이 없다.
- 사용자에게 보이는 마스크는 서버 파생값이다.

## 7. P0-B — smoke/test 데이터 격리와 안전한 정리

### 현재 문제

`infra/scripts/api-smoke.mjs`는 안정적인 ACTIVE smoke 계좌를 직접 만들거나 재사용하고, lifecycle smoke는 매번 생성·승인·이름 변경·보관한 레코드를 남긴다. 현재 활성 smoke 계좌 두 건에는 거래 57건이 연결되어 있으므로 이름만 보고 지우면 안 된다.

### 구현 요구

1. 가능한 경우 smoke를 전용 test DB/schema/tenant 또는 transaction rollback에서 실행한다.
2. 불가능하면 모든 fixture에 명시적인 provenance와 run ID를 기록한다. 이름 substring을 source of truth로 사용하지 않는다.
3. provenance 표현은 현재 metadata 계약으로 충분한지 먼저 검토한다. schema 필드가 필요하면 additive migration만 사용한다.
4. production 환경에서는 다음을 서버에서 차단한다.
   - fixture 계좌 생성
   - fixture 계좌 활성화
   - fixture 계좌를 import/reconciliation/payment/refund/payout 계좌로 선택
5. lifecycle smoke는 생성 ID를 추적하고 `finally`에서 참조가 없는 자기 fixture만 정리한다.
6. smoke 시작 전후 다음 불변식을 확인한다.

```text
real account count unchanged
unreferenced fixture count unchanged
active fixture count unchanged or zero in production
no orphan pending approval
no duplicate audit request for same smoke command
```

7. 기존 누적 데이터용 정리 도구는 기본 dry-run으로 구현한다.

예시 계약:

```text
npm run company-bank-accounts:cleanup:check
npm run company-bank-accounts:cleanup:apply -- --manifest=<reviewed-manifest> --confirm
```

정확한 script 이름은 저장소 관례에 맞게 조정해도 된다.

8. dry-run manifest에는 다음을 포함한다.

- account ID와 명시적 provenance
- 상태와 pending approval
- transaction, import batch, reconciliation, payment/refund/payout 참조 수
- audit 보존 요구
- 추천 조치: retain / archive / delete-candidate / manual-review
- 조치 근거

9. apply는 검토된 manifest와 명시적 confirm이 모두 있어야 한다.
10. 이 작업에서는 공유·운영 데이터 cleanup apply를 실행하지 않는다.
11. 거래 57건이 연결된 기존 활성 smoke 계좌는 자동 삭제 후보에서 제외한다.

### P0-B 완료 조건

- production 업무 선택기에 fixture 계좌가 0개다.
- smoke 재실행 후 누적 계좌 수가 증가하지 않는다.
- 참조 있는 fixture는 cleanup delete candidate가 아니다.
- dry-run 결과가 사람이 읽을 수 있는 요약과 machine-readable manifest를 모두 제공한다.

## 8. P0-C — 감사 이력 정확성

### 구현 요구

1. 계좌 변경 audit는 limit 적용 전에 서버에서 정확히 필터링한다.
2. 다음 중 저장소 계약에 가장 작은 방식을 선택한다.
   - audit API에 권한 검증된 `targetPrefix=company_bank_account:` 필터 추가
   - 계좌 관리 전용 recent changes endpoint 제공
   - account list/summary 응답에 제한된 change timeline 포함
3. broad `q=company_bank_account` 후 Admin Web post-filter는 제거한다.
4. 서버는 허용된 action과 target namespace를 모두 검증한다. 임의 prefix로 다른 audit domain을 조회할 수 없어야 한다.
5. page-view target이 `/finance-tax/company-bank-accounts`를 포함해도 계좌 변경 결과의 `take`를 소비하지 않아야 한다.
6. 한 request lifecycle을 다음처럼 하나의 운영 타임라인으로 묶는다.

```text
Requested by Maker · 10:12
Approved by Checker · 10:18
Before / After
Evidence
Request ID
```

7. “Latest 20”은 정확히 필터된 최신 20건을 의미하게 하고, 전체 수가 있으면 `Showing 20 of 86 changes`로 표시한다.
8. `Open full audit log`는 동일한 exact filter를 유지한다.
9. full audit 권한이 별도라면 권한 있는 운영자에게만 링크를 보여주고, 없는 운영자에게는 제한된 계좌 timeline만 제공한다.

### 회귀 테스트

- 계좌 change 25건과 page-view 50건을 섞는다.
- recent API가 정확한 최신 계좌 change 20건을 반환하는지 확인한다.
- 페이지를 30회 조회한 후에도 결과가 동일한지 확인한다.
- 다른 audit targetPrefix 접근이 권한상 차단되는지 확인한다.

### P0-C 완료 조건

- 단순 페이지 조회로 recent change 수와 항목이 줄지 않는다.
- full audit 링크에서 계좌 변경이 먼저 보인다.
- request lifecycle과 Before/After를 한 단위로 추적할 수 있다.

## 9. P0-D — 권한, 실패 상태, 승인 workspace 정렬

### 현재 문제

감사 시점 계약은 페이지·mutation은 `SYSTEM_POLICY`, 계좌 read와 approval은 `FINANCE_BANK_RECONCILIATION`, full audit는 `SYSTEM_AUDIT`로 분리되어 있었다. 동시에 `adminGet(..., [])` fallback 때문에 401/403/5xx가 실제 0건처럼 보일 수 있다.

### 구현 요구

1. 현재 navigation IA, access model, API guard와 실제 역할을 다시 매핑한다.
2. 이 route의 기본 소유 영역은 Finance operations/records가 되어야 한다. 계좌 목록을 읽을 수 없는 사용자가 빈 화면으로 들어오게 하지 않는다.
3. maker와 checker가 서로 다른 역할이어야 한다면 해당 분리를 유지하되 다음을 명시한다.
   - 누가 목록을 볼 수 있는가
   - 누가 변경 요청을 만들 수 있는가
   - 누가 승인할 수 있는가
   - 누가 full audit evidence를 볼 수 있는가
4. 기존 category 이름을 무조건 하나로 바꾸지 말고, 실제 권한 의미를 보존하는 최소 계약으로 정렬한다.
5. 페이지 수준에서는 다음 상태를 분리한다.

```text
loading
genuine empty
permission denied
authentication expired
API/service failure
partial failure: accounts loaded, timeline failed
stale last-success data
success
```

6. 빈 배열 fallback으로 실패를 숨기지 않는 result 타입을 사용한다. 최소한 `ok`, `status`, safe error code, request ID를 보존한다.
7. 오류에는 내부 stack과 endpoint를 노출하지 말고 다음 행동을 제공한다.
   - 재로그인
   - 권한 요청
   - 다시 시도
   - 마지막 정상 조회 시각 확인
8. 승인·반려 실행 UI는 `/finance-tax/approval-queue?view=bank-accounts` 한 곳이 소유한다.
9. 계좌 설정 페이지의 pending row와 상단 지표는 중앙 queue의 정확한 request로 deep link한다.
10. 설정 페이지의 중복된 inline 승인/반려 아이콘은 제거한다.
11. 중앙 queue의 기존 maker/checker, current/proposed values, reason, readiness 표시를 재사용하고 약화하지 않는다.
12. 알 수 없는 request ID, 만료된 요청, 이미 처리된 요청, 자기 승인 시 구조화된 상태를 보여준다.

### 1인 운영 고려

자기 승인 금지를 제거하지 않는다.

- 요청 전 `Eligible approvers: 0` 또는 실제 수를 보여준다.
- 승인 가능한 다른 운영자가 0명이면 일반 요청 제출을 막고 이유를 설명한다.
- 기본 권장은 외부 회계 담당자 또는 백업 Finance approver 지정이다.
- break-glass가 이미 제품 정책에 존재한다면 재인증, 시간 지연, 경고 알림, 불변 감사, 사후 검토를 모두 요구한다.
- 기존 정책에 없는 break-glass를 임의로 만들지 않는다. 필요하면 별도 의사결정 항목으로 보고한다.

### P0-D 완료 조건

- 권한 부족은 0 accounts로 보이지 않는다.
- 부분 실패가 정상 계좌 데이터를 지우지 않는다.
- 승인 실행은 중앙 queue에만 존재한다.
- 승인자 0명 상태에서 영구 대기 요청을 만들 수 없다.

## 10. P0-E — 상태 기본값, 멱등성, 동시 생성

1. Prisma `CompanyBankAccount.status` 기본값을 `INACTIVE`로 바꾸거나 기본값을 제거해 생성자가 상태를 반드시 명시하게 한다.
2. additive migration과 기존 데이터 영향 분석을 작성한다.
3. production 코드에서 승인 절차 밖의 `ACTIVE` create가 없는지 전역 검색한다.
4. smoke helper의 직접 ACTIVE 생성은 격리 환경 전용으로 제한한다.
5. create/update/status request에 idempotency key를 적용한다. 동일 키 재전송이 중복 계좌·pending request·audit row를 만들지 않아야 한다.
6. duplicate check와 create가 원자적 경계 안에 있도록 한다.
7. 안전한 account identity가 없으면 last4 기반 DB unique constraint를 만들지 않는다. 서로 다른 계좌의 끝 네 자리가 같을 수 있다.
8. optimistic concurrency 충돌과 potential duplicate를 같은 generic 409 문구로 합치지 않는다.

권장 안정적 오류 코드 예:

```text
COMPANY_BANK_ACCOUNT_INVALID_LAST4
COMPANY_BANK_ACCOUNT_RAW_NUMBER_REJECTED
COMPANY_BANK_ACCOUNT_POTENTIAL_DUPLICATE
COMPANY_BANK_ACCOUNT_VERSION_CONFLICT
COMPANY_BANK_ACCOUNT_APPROVER_UNAVAILABLE
COMPANY_BANK_ACCOUNT_READ_FORBIDDEN
COMPANY_BANK_ACCOUNT_ACTIVATION_NOT_READY
COMPANY_BANK_ACCOUNT_ARCHIVE_BLOCKED
```

문자열 비교가 아니라 code와 field path를 사용한다.

## 11. P1-A — 계좌 운영 모델 보강

현재 스키마와 bank reconciliation/import 흐름에 이미 존재하는 정보를 먼저 재사용한다. 중복 컬럼을 만들지 않는다.

운영자가 최소한 다음을 판단할 수 있어야 한다.

```text
법인 계좌주명
정규화된 은행 코드와 표시 이름
통화
끝 네 자리
용도: collection / refund / payout / reconciliation / adjustment
방향: inbound / outbound / both
통화·용도별 primary/default 여부
verification status와 method
evidence reference
verifiedBy / verifiedAt
effectiveFrom / archivedAt
last successful statement import
unmatched count와 reconciliation health
transaction/import/reference counts
```

구현 원칙:

1. 자유 입력 bank name보다 기존 은행 목록 또는 통제된 bank code를 우선한다.
2. 통화는 ISO 목록으로 제한한다. 현재 제품 범위가 VND뿐이면 VND로 잠근다.
3. 증거 파일은 제한된 storage object ID를 사용한다. 공개 URL과 장기 signed URL을 metadata에 저장하지 않는다.
4. verification과 active를 같은 의미로 사용하지 않는다.
5. primary/default 계좌는 currency×purpose×direction 범위에서 충돌 검사를 한다.
6. 계산 가능한 health와 reference count는 별도 중복 저장보다 조회 projection/summary로 제공한다.
7. schema 변경이 크다면 최소 출시 필드와 후속 필드를 구분하되, 활성화 readiness를 속이지 않는다.

## 12. P1-B — 실제 상태 의미 구현

현재 모든 non-ACTIVE를 `Inactive`로 표시하지 않는다.

필요한 표시 상태:

```text
Pending activation
Active
Never activated
Rejected
Archived with history
Disabled by system
Test fixture
```

1. 상태는 이름 또는 timestamp heuristic이 아니라 persisted lifecycle fact에서 파생한다.
2. `pendingApproval.requestedAt`을 SLA 기준으로 사용한다. account `updatedAt`을 승인 대기 시작 시각으로 대체하지 않는다.
3. pending metadata가 손상되었거나 필드가 없으면 조용히 inactive로 숨기지 말고 data anomaly로 보낸다.
4. `DISABLED`가 실제 코드에서 사용되지 않는다면 즉시 삭제하지 말고 진입·복구 의도를 확인해 구현 또는 안전한 후속 제거 후보로 보고한다.
5. “Inactive accounts are retained only for historical matching”처럼 사실과 다른 문구를 제거한다.

## 13. P1-C — 활성화와 보관 preflight

### 활성화 요청 전

다음을 서버가 계산한 readiness로 보여준다.

- 법인 소유자 확인
- verification evidence 상태
- bank identity/potential duplicate 검토
- statement import 테스트 결과
- purpose·direction·currency completeness
- primary/default 충돌
- 다른 승인자 존재

하나라도 필수 항목이 실패하면 `Submit activation request`를 비활성화하고 해결 링크를 제공한다. 프런트 disabled만 믿지 말고 API도 같은 정책으로 거절한다.

### 보관 요청 전

다음을 서버가 계산한 impact로 보여준다.

- 열린·미매칭 transaction 수
- 미완료 statement import batch
- 예정된 지급·환불·정산·배치 참조
- 최근 import와 reconciliation 시각
- 현재 primary/default인지
- 대체 계좌와 전환 시점

열린 영향이 남아 있으면 archive를 거절하고 해결 workspace로 이동시킨다. 영향이 0이어도 Before/After, 사유, 적용 시점을 확인한다.

## 14. P1-D — 1440px 운영 화면 재구성

화면 모드는 내부 운영 도구에 맞는 **Operate**다. 장식보다 스캔 속도, 상태 정확성, 위험 예방을 우선한다. 기존 Vuexy 기반 Admin shell, Public Sans, 디자인 토큰과 공통 컴포넌트를 재사용한다.

### 상단 헤더

```text
Company bank accounts
Manage verified company accounts used for collections, refunds, payouts, and bank reconciliation.

[Add account] [Open reconciliation]
Last refreshed 10:42 · All data available
```

### health strip

기존 `Total / Active / Pending / Inactive` 대형 카드 대신 다음을 보여준다.

1. `Usable real accounts`
2. `Pending approval · oldest wait`
3. `Import & reconciliation health`
4. `Last successful statement import`

- fixture는 usable count에서 제외한다.
- fixture가 운영 환경에서 발견되면 KPI가 아니라 명확한 환경 경고로 표시한다.
- 각 항목은 해당 filtered workspace로 이동할 수 있어야 한다.

### 목록 구조

```text
Current   기본: Active + Pending activation
Archived  보관·반려·never activated history
```

필터:

```text
Purpose
Currency
Verification
Health
Status
```

테이블 열:

```text
Account
Bank & legal owner
Purpose
Currency
Verification
Import/reconciliation health
Last activity
Status
Action
```

요구 사항:

- 서버 pagination과 authoritative total을 사용한다. 최대 100개 배열 길이를 Total로 표시하지 않는다.
- 고위험 icon-only 액션을 작은 아이콘 두 개로 나열하지 않는다.
- `View details`, `Edit name`, `Request activation`, `Request archive`가 명시된 overflow menu 또는 text action을 사용한다.
- pending row의 primary action은 중앙 approval queue request 열기다.
- 긴 은행명·계좌명·법인명은 1440px에서 표를 무너뜨리지 않게 wrap/truncate와 title/detail 접근을 제공한다.
- 데이터가 0, 1, 100, 1,000+일 때 pagination·empty·overflow가 안정적이어야 한다.

### Add/Edit drawer

현재 목록 중간의 `AdminDisclosure`를 기존 Admin drawer 패턴으로 교체한다.

- `?dialog=new`, `?dialog=edit&accountId=...` deep link는 유지한다.
- drawer open 시 제목으로 포커스를 이동하고, 닫을 때 트리거로 복귀한다.
- Escape, backdrop, Close 버튼, unsaved change 경고를 지원한다.
- 1440px에서 내부 이중 스크롤을 만들지 않는다.
- sticky footer에 `Cancel`과 `Submit for approval`을 항상 노출한다.
- create 단계는 Identity → Purpose → Verification → Review 순으로 구성한다.
- last4만 입력하고 mask preview는 read-only로 파생한다.
- edit는 거래 연결 후 immutable identity를 변경할 수 없다는 설명을 유지한다.
- 서버 오류 후 drawer와 입력값을 유지하고 해당 필드 아래에 오류를 표시한다.
- 성공 후 request ID, maker, 제출 시각, next approver 상태, queue link가 있는 receipt를 보여준다.

### Confirmation dialog

- 사유 최소 12자를 충족하기 전 위험 CTA는 disabled다.
- 글자 수, 좋은 사유 예시, 영향 요약을 함께 표시한다.
- native validation bubble만 의존하지 않는다.
- 제출 중 중복 클릭을 막는다.
- API 실패 후 dialog와 사유를 유지한다.

## 15. P1-E — 오류·빈 상태·문구

### 필드·서버 오류

- 400 validation은 field path별 inline error로 매핑한다.
- 401은 로그인 만료 상태와 재로그인 액션을 보여준다.
- 403은 필요한 권한과 요청 경로를 설명한다.
- 409 potential duplicate와 version conflict를 구분한다.
- 429는 재시도 가능 시점을 보여준다.
- 5xx/timeout은 입력을 보존하고 다시 시도하게 한다.

### 자연스러운 문구

다음 placeholder 복수 표기를 제거한다.

```text
13 account(s)
14 recent change(s)
```

실제 i18n/plural helper 또는 자연스러운 영어 문장을 사용한다.

권장 문구:

```text
Enter only the last four digits. Full account numbers are not accepted or stored.
Why is this account needed?
Review and submit
Submit activation request
Submit archive request
This account changed while you were reviewing it. Refresh and review the latest values.
```

상태는 raw enum `ACTIVE`, `INACTIVE`를 그대로 노출하지 말고 운영 의미가 있는 title case label로 표시한다. 색상만으로 상태를 구분하지 않는다.

## 16. 성능과 데이터 로딩 계약

1. 기본 page load는 accounts summary, current list, 제한된 exact recent timeline만 가져온다.
2. archive impact, activation readiness, full timeline은 drawer/dialog를 열 때 필요한 범위만 조회한다.
3. 계좌·audit·access 요청 중 하나가 실패해도 정상 section을 지우지 않는다.
4. `take=100` 배열 길이를 total로 사용하지 않는다.
5. pagination과 summary를 하나의 경량 projection으로 반환할 수 있는지 검토한다.
6. 큰 metadata와 원문 audit payload를 목록 API로 보내지 않는다.
7. N+1 query를 만들지 않는다.
8. 마지막 정상 조회와 새로고침 상태를 구분한다.
9. `admin:api-budget`이 401이면 성능 PASS로 기록하지 말고 인증 fixture 또는 측정 방법을 수정하거나 BLOCKED로 보고한다.

## 17. 필수 테스트

### API·DB

1. last4 네 자리 정상 입력과 mask 서버 파생
2. 점·슬래시·공백·하이픈·문자·Unicode를 이용한 raw-like 입력 전부 거절
3. validation/error/audit/log에서 입력 원문 미노출
4. 상태 미지정 create가 ACTIVE가 되지 않음
5. 동일 idempotency key 동시 전송 시 계좌·pending request·audit 각각 한 건
6. potential duplicate와 version conflict의 오류 코드 구분
7. maker 자기 승인 금지 유지
8. 다른 승인자 0명일 때 activation request 거절
9. readiness 미충족 activation 거절
10. 열린 참조가 있는 archive 거절
11. exact audit filter가 limit 전에 적용됨
12. page-view 50건이 recent account changes 20건을 밀어내지 않음
13. fixture 계좌가 production selection endpoint에서 제외됨
14. smoke 전후 unreferenced fixture count invariant
15. cleanup dry-run이 참조 있는 계좌를 delete candidate로 분류하지 않음
16. pending SLA가 account `updatedAt`이 아니라 실제 `requestedAt`을 사용

### Admin Web

1. genuine empty, 401, 403, 5xx, partial audit failure 상태 분리
2. account total이 pagination total과 일치
3. Current/Archived 필터와 deep link 유지
4. create drawer가 last4만 전송
5. 서버 field error 후 입력값과 drawer 유지
6. 사유 12자 미만에서 CTA disabled
7. success receipt에 request ID와 approval queue link 표시
8. pending row의 승인 실행이 중앙 queue로만 이동
9. recent timeline이 page-view 재방문에 영향받지 않음
10. 단수·복수 문구와 상태 label 정확성
11. drawer/dialog 포커스 open-close-error-success lifecycle
12. 100자 이상 계좌명·은행명, CJK/베트남어, empty, 1건, 1,000+ total에서 레이아웃 안정성

### 통합

1. 생성 요청 → 다른 승인자 승인 → Active → import readiness 표시
2. 자기 승인 시도 실패와 불변 audit
3. 보관 영향 0 → 승인 → Archived history
4. 보관 영향 존재 → 요청 차단 → 해결 링크
5. 계좌 설정 pending link → 중앙 queue exact request
6. page view 반복 후 account timeline 불변

## 18. 검증 명령

현재 package script와 파일 존재 여부를 확인한 뒤 아래와 동등한 검증을 실행한다.

### 집중 테스트

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/finance-tax/company-bank-accounts lib/admin-operator-access-model.spec.ts
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts src/admin/admin.controller.spec.ts src/admin/admin-operator-category.guard.spec.ts
```

필요한 새 spec 파일은 위 명령 대상에 추가한다.

### 정적·범위 검증

```powershell
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run admin:visible-copy
npm.cmd run admin:api-budget
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

Prisma schema/migration을 수정했다면:

```powershell
npm.cmd run prisma:migrations:check
npm.cmd run verify:local
```

UI 구현 완료 후 Impeccable detector가 현재 환경에 있다면 변경한 UI 파일을 대상으로 한 번만 실행한다.

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json apps/admin_web/app/finance-tax/company-bank-accounts apps/admin_web/components
```

환경·인증 문제로 실패한 명령은 `BLOCKED` 또는 `FAIL`로 기록하고 원인과 재현 명령을 남긴다. 실행하지 않은 검증을 PASS로 기록하지 않는다.

## 19. 브라우저 QA

로그인된 로컬 Admin과 격리된 fixture를 사용해 검증한다. 공유·운영 계좌에 실제 submit을 하지 않는다.

```text
Required viewport: 1440x1000
Optional viewport: 1680x1050
Excluded: 1024px 이하
```

캡처할 상태:

1. 실제 계좌 기준 기본 Current 목록과 health strip
2. production fixture 감지 경고
3. genuine empty 상태
4. 권한 부족 상태
5. accounts 정상 + timeline 실패 partial state
6. Add drawer 기본 상태와 last4 mask preview
7. validation 오류 후 입력 보존
8. activation readiness blocked/ready 상태
9. archive impact blocked/ready 상태
10. 승인자 0명 상태
11. success receipt와 approval queue deep link
12. exact recent timeline과 full audit filter
13. Archived 목록
14. 키보드 focus와 unsaved close guard 증거

확인 항목:

- 1440px에서 primary 상태와 주요 CTA가 첫 화면에서 스캔되는가
- KPI와 테이블이 같은 숫자를 반복하지 않는가
- fixture가 usable account처럼 보이지 않는가
- drawer submit이 화면 아래에 사라지지 않는가
- 위험 행동에 영향과 다음 단계가 보이는가
- status가 색상 없이도 이해되는가
- icon-only 고위험 액션이 남지 않았는가
- 오류와 실제 빈 상태가 명확히 다른가
- 긴 계좌명·법인명 때문에 action 열이 밀리지 않는가
- 중첩 drawer/dialog/scroll이 생기지 않는가

UI 변경은 완성 후 1440px에서 한 번에 결함을 수집해 일괄 수정하고, 최대 한 번만 재확인한다. 끝없는 미세 조정 루프를 만들지 않는다.

## 20. 완료 산출물

구현과 함께 다음을 만든다.

```text
docs/audits/company-bank-accounts-remediation-report-2026-08-11.md
docs/audits/company-bank-accounts-remediation-evidence-2026-08-11/
```

보고서 필수 내용:

1. 구현 전후 구조와 root cause
2. P0-A~P0-E, P1, P2별 완료·미완료 상태
3. 마스킹 보안 계약과 회귀 입력 결과
4. 권한 matrix 전후 비교
5. recent audit query 전후 결과와 page-view 불변 증거
6. fixture inventory와 cleanup dry-run 결과
7. 실제 cleanup apply 미실행 확인
8. schema/migration/idempotency 설명
9. 계좌 readiness와 archive impact 계약
10. 테스트 명령과 실제 PASS/FAIL/BLOCKED 결과
11. 1440px 캡처 목록
12. 변경 파일 목록
13. 보호 영역 변경 여부
14. 남은 출시 차단 위험
15. 다음에 할 가장 중요한 한 가지

## 21. 최종 인수 체크리스트

다음 항목이 모두 충족되기 전에는 `완료` 또는 `출시 가능`이라고 하지 않는다.

```text
[ ] Admin 입력은 last4 네 자리뿐이며 mask는 서버가 파생한다.
[ ] 점·슬래시·문자·Unicode를 이용한 raw-number 우회가 모두 차단된다.
[ ] 원문 계좌번호가 DB·URL·로그·감사에 없다.
[ ] DB 기본 상태로 승인 없는 ACTIVE 계좌가 생기지 않는다.
[ ] idempotency와 동시 생성 테스트가 통과한다.
[ ] production에서 fixture 계좌를 생성·활성화·선택할 수 없다.
[ ] smoke 실행 전후 fixture 누적이 없다.
[ ] 기존 fixture cleanup은 dry-run만 수행했고 참조 계좌를 삭제하지 않았다.
[ ] audit filter가 서버에서 limit 전에 적용된다.
[ ] 페이지 조회 30회 후에도 recent account changes가 동일하다.
[ ] 권한/API 실패가 0 accounts로 보이지 않는다.
[ ] 승인 실행은 중앙 Finance Approval Queue 한 곳에만 있다.
[ ] 자기 승인 금지가 유지된다.
[ ] 승인자 0명이 제출 전에 보이고 일반 요청이 차단된다.
[ ] 활성화 readiness를 UI와 API가 동일하게 검증한다.
[ ] archive impact와 대체 계좌가 제출 전에 보인다.
[ ] Current와 Archived의 의미가 분리된다.
[ ] raw ACTIVE/INACTIVE 대신 운영 상태가 표시된다.
[ ] health strip이 실제 usable account와 reconciliation 상태를 보여준다.
[ ] total은 pagination의 authoritative total이다.
[ ] create/edit가 drawer와 sticky footer를 사용한다.
[ ] 오류 후 입력값과 작업 위치가 유지된다.
[ ] 성공 receipt에 request ID와 next step이 있다.
[ ] 위험 CTA가 유효한 사유와 readiness 전에는 disabled다.
[ ] 1440x1000 브라우저 QA와 증거가 있다.
[ ] focused tests, typecheck, visible copy, scope verification 결과가 기록됐다.
[ ] schema/migration 변경 시 migration check와 verify:local을 수행했다.
[ ] 실제 공유·운영 데이터에 파괴적 cleanup을 적용하지 않았다.
```

## 22. 중단 조건

작업량이 크다는 이유로 분석만 하고 멈추지 않는다. P0-A부터 안전하게 구현하고 각 slice를 검증한다.

다만 다음 상황에서는 read-only 증거와 선택지를 정리한 뒤 사용자에게 확인한다.

- 공유·운영 DB에 실제 cleanup apply가 필요할 때
- 현재 dirty change와 같은 파일에서 사용자 의도를 보존할 수 없는 충돌이 있을 때
- 어떤 DB가 운영 데이터인지 확인할 수 없을 때
- 계좌 원문을 새로 수집해야만 중복 식별이 가능하다고 판단될 때
- maker/checker 또는 break-glass라는 실제 재무 정책을 변경해야 할 때
- bank account purpose/default 규칙이 코드와 문서 어디에도 없어 금전 흐름 결과가 달라질 때
- destructive migration이나 기존 거래 참조 변경이 필요할 때

그 외에는 합리적인 가정을 보고서에 기록하고 계속 진행한다.

## 23. 최종 응답 형식

결과부터 간결하게 보고한다.

```text
Outcome
- Release hold 해제 가능 여부
- 해결한 P0 요약

Changed files
- 파일과 목적

Verification
- 명령별 PASS/FAIL/BLOCKED
- 1440px QA 증거

Protected areas / migrations
- 변경 여부와 검증 결과

Data safety
- fixture inventory
- cleanup dry-run 결과
- apply 미실행 확인

Remaining risks
- 출시 차단/비차단 구분

Next action
- 가장 중요한 한 가지
```

실제로 완료되지 않은 항목은 명확히 `미완료`로 표시한다. 화면이 더 정돈됐다는 이유로 보안·권한·감사·데이터 격리 문제를 완료 처리하지 않는다.
