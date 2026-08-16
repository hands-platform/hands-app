# Company Bank Accounts 최종 보완 구현용 Codex 실행 프롬프트

이 문서는 저장소의 영구 지침이 아니라 **한 번의 구현 작업에 그대로 붙여 넣는 task prompt**다. `AGENTS.md`에 복사하지 말고, Codex에서 `C:\dev\massage-on-demand-vn`을 workspace로 연 뒤 이 문서 전체를 실행 프롬프트로 사용한다.

---

당신은 HANDS 관리자 시스템의 시니어 재무 플랫폼·프로덕트 엔지니어다. `/finance-tax/company-bank-accounts`의 2026-08-14 재감사에서 확인된 잔여 결함을 실제 코드로 수정하라.

이번 작업은 분석 보고서 작성이 아니라 **구현, migration, 테스트, 1440px 이상 브라우저 검증과 구현 보고서 작성까지 포함한 완료 작업**이다. 기존에 해결된 안전장치를 보존하면서 P0를 먼저 제거하고 P1 운영 UX를 마무리하라. 실행하지 않은 검증이나 미해결 수동 단계를 PASS로 보고하지 않는다.

## 1. 작업 위치와 기준 자료

```text
Workspace: C:\dev\massage-on-demand-vn
Primary route: http://localhost:3101/finance-tax/company-bank-accounts
Final re-audit: docs/audits/company-bank-accounts-final-reaudit-2026-08-14.md
Previous implementation prompt: docs/agent/prompts/company-bank-accounts-remediation-master.md
Previous remediation report: docs/audits/company-bank-accounts-remediation-report-2026-08-11.md
Current audit evidence: docs/audits/company-bank-accounts-final-reaudit-evidence-2026-08-14/
Required desktop viewport: 1440x1000 and 1600x1000
Excluded viewport: 1024px 이하 전체
```

감사 보고서와 아래 증거를 직접 열어 확인한 뒤 구현한다.

```text
01-current-overview-1440x1000.png
02-current-table-1440x1000.png
03-add-account-drawer-1440x1000.png
06-last4-mask-preview-1440x1000.png
07-archived-smoke-records-1440x1000.png
08-activation-preflight-blocked-1440x1000.png
09-archive-preflight-blocked-1440x1000.png
10-edit-account-drawer-1440x1000.png
11-recent-change-timeline-1440x1000.png
12-dark-overview-1440x1000.png
13-current-table-1600x1000.png
14-behavior-and-layout-observations.md
```

보고서의 line number는 감사 시점 참고값이다. 현재 코드에서 심볼, 호출 경로, DTO, guard, 테스트와 실제 DB 계약을 다시 찾아라.

## 2. 현재 판정과 이번 작업의 목표

현재 재감사 점수는 **67/100, Release hold**다.

이번 작업의 최종 목표는 다음 두 P0를 제거하고, 운영자가 1440px 화면에서 실제 회사 계좌와 테스트 데이터를 혼동하지 않으며 안전하게 등록·검증·활성화·보관할 수 있게 만드는 것이다.

1. fixture/production provenance와 summary/row/use-path 판정을 하나의 권위 source로 통일한다.
2. archive preflight가 확인하지 못한 지급·환불·정산·import 참조를 0으로 간주하지 않고 fail-closed한다.

P0 완료 후 다음 P1을 구현한다.

- 증거 객체와 statement import 테스트를 실제 권위 record로 검증
- 1440/1600px에서 주요 Actions가 항상 보이는 account table
- 읽을 수 있는 recent lifecycle과 structured diff
- footer Cancel의 unsaved guard 통합
- blocker별 정확한 해결 링크
- controlled bank identity와 정확한 lifecycle filter
- 운영 readiness 문구와 집계 의미 정정

## 3. 작업 방식과 권한 경계

1. 루트 `AGENTS.md`를 끝까지 읽고 단일 에이전트로 수행한다.
2. `git status --short`와 관련 diff를 먼저 확인한다. dirty worktree는 사용자 소유이므로 `reset`, `checkout`, `restore`, `clean`, `stash`로 제거하지 않는다.
3. 관련 baseline 테스트와 현재 브라우저 동작을 먼저 재현한다.
4. 이 프롬프트는 관련 로컬 코드·테스트·문서·Prisma migration 수정과 비파괴 검증을 승인한다. 각 안전한 수정마다 재확인을 요청하지 않는다.
5. 실제 계좌 삭제, fixture cleanup apply, 공유/운영 DB의 데이터 분류 적용, 외부 저장소 파일 변경, 실제 승인 제출은 승인하지 않는다.
6. 파괴적 데이터 변경이나 운영 정책 변경이 필요할 때만 중단하고, read-only 증거와 최소 선택지를 제시한다.
7. 보호 영역을 수정하면 `AGENTS.md`의 integration review와 필수 검증을 수행한다.
8. 관련 없는 리팩터링, 디자인 시스템 교체, 새 대형 dependency 도입을 하지 않는다.
9. visible Admin copy는 기존 정책대로 English를 유지한다. 코드 내부 provider 명칭을 UI에 노출하지 말고 Partner 용어를 유지한다.
10. 1024px 이하 responsive 수정·검증을 작업 범위에 넣지 않는다.

## 4. 반드시 보존할 기존 통제

다음 구현은 이미 검증됐으므로 제거하거나 약화하지 않는다.

- Admin은 계좌번호 끝 네 자리만 입력하고 서버가 `•••• 1234` mask를 생성한다.
- `accountNumberMasked` client input과 raw-like account number를 DTO/API가 거부한다.
- DB의 신규 계좌 기본 상태는 `INACTIVE`다.
- 생성·편집·활성화·보관은 즉시 적용하지 않고 approval request를 만든다.
- maker/checker 분리, 자기 승인 금지, 다른 Finance approver 요구를 유지한다.
- 요청·승인·반려 사유와 account-target audit event를 유지한다.
- 정확한 `requestId`, idempotency key, optimistic version check를 유지한다.
- transaction history가 있는 계좌의 bank identity/currency 변경을 막는다.
- 최근 변경은 `targetPrefix=company_bank_account:`를 서버에서 limit 전에 적용한다.
- 권한 부족, API 오류, 실제 0건을 서로 다른 상태로 표시한다.
- Add/Edit는 drawer와 sticky footer를 사용한다.
- status dialog의 `alertdialog`, focus trap, Escape, focus return을 유지한다.
- 승인 실행 workspace는 중앙 Finance Approval Queue로 유지한다.

원문 계좌번호를 fingerprint 명목으로 새로 수집·저장·로그·전송하지 않는다.

## 5. 구현 순서

다음 순서를 지킨다.

```text
Baseline and current-data read-only inventory
→ P0-A schema-level data scope and one classification contract
→ P0-B fail-closed archive reference coverage
→ P1 authoritative verification/import evidence
→ P1 concurrency and duplicate review
→ P1 operator-facing information architecture and interactions
→ focused tests and scope verification
→ 1440/1600 browser QA
→ remediation report and final handoff
```

각 단계는 API 계약과 회귀 테스트를 먼저 확정하고 UI를 연결한다. UI에만 경고 문구를 추가해 P0를 해결한 것으로 처리하지 않는다.

## 6. P0-A — Schema-level data scope와 단일 판정 계약

### 6.1 문제

현재 화면은 `Usable real accounts 0`을 표시하면서 fixture가 아닌 `Active` smoke 계좌 행을 동시에 보여준다. fixture warning은 1건이지만 current 2건과 archived 11건 모두 smoke 성격이다.

현재 구현은 nullable JSON path를 사용하는 Prisma `NOT fixtureWhere`와 별도 JavaScript `companyBankAccountIsFixture()`를 유지한다. summary, row lifecycle, production list, import selection과 transaction guard가 같은 진실을 사용하지 않는다.

### 6.2 권위 모델

Prisma schema에 nullable JSON 추론이 아닌 명시적 data scope를 둔다. 현재 저장소 naming과 migration 관례를 확인하되 최소 계약은 다음과 같다.

```text
CompanyBankAccountDataScope
- UNKNOWN
- PRODUCTION
- SYNTHETIC

CompanyBankAccount.dataScope
- non-null
- safe default UNKNOWN
- indexed with status/currency if query plan에 필요
```

분류 변경에는 actor, reason, before/after와 결정 시각이 account-target audit log에 남아야 한다. 별도 여러 provenance column을 무조건 추가하지 말고, 기존 audit/metadata 계약으로 충분한지 먼저 확인한다. 그러나 **사용 가능 여부를 결정하는 data scope 자체는 JSON 문자열 추론에 두지 않는다.**

### 6.3 생성과 상태 규칙

- 일반 Admin create request는 즉시 production으로 간주하지 않는다.
- 생성 직후와 maker 제안 상태는 `UNKNOWN + INACTIVE`가 기본이다.
- checker가 법인 소유권과 권위 증거를 승인한 뒤에만 `PRODUCTION` 분류가 가능하다.
- smoke/test harness가 만드는 계좌는 명시적으로 `SYNTHETIC`을 기록한다.
- activation은 `dataScope === PRODUCTION`인 계좌만 허용한다.
- `UNKNOWN`과 `SYNTHETIC`은 환경과 무관하게 operational import, transaction creation, replacement selection, payout/refund/settlement use-path에서 fail-closed한다.
- 개발 환경에서 synthetic 데이터가 필요하면 일반 운영 API를 느슨하게 하지 말고 격리된 test helper/DB 계약을 사용한다.

### 6.4 단일 query/predicate 적용 범위

다음 경로가 모두 같은 schema field와 공용 domain helper를 사용하게 한다.

- operations page current/archived/data-remediation 목록
- usable real account summary
- fixture/synthetic/unknown summary
- lifecycle status와 row badge
- reconciliation import account selection
- company bank transaction creation/import
- duplicate comparison 대상
- activation preflight
- archive replacement candidate
- payout/refund/settlement가 계좌를 선택하는 경로
- smoke/cleanup manifest

production selection은 `dataScope: PRODUCTION`이라는 positive predicate를 사용한다. nullable JSON path에 대한 `NOT`, name regex, bank name 또는 account name으로 production 여부를 결정하지 않는다.

### 6.5 기존 13건 데이터 처리

1. 현재 계좌와 모든 참조를 read-only로 다시 inventory한다.
2. 안전한 migration은 기존 행을 `UNKNOWN`으로 둔다.
3. explicit metadata signal, 이름, 참조 수, pending approval, transaction/reconciliation/audit 수를 포함한 classification review manifest를 생성한다.
4. 이름에 smoke/test가 있다는 이유만으로 migration 또는 script가 자동 분류·삭제하지 않는다.
5. `--apply`는 별도 확인 문구와 reviewed manifest hash를 요구하게 한다.
6. 이번 작업에서는 사용자가 명시적으로 승인하지 않는 한 apply를 실행하지 않는다.
7. UNKNOWN 13건은 `Data remediation` queue에서 보이되 operational candidate에는 절대 포함하지 않는다.

현재 데이터 분류 apply가 남으면 코드 구현 완료와 release hold 해제를 구분해서 보고한다.

### 6.6 필요한 테스트

- Prisma/PostgreSQL integration test: metadata null, fixture key missing, legacy `smokeFixture`, `smoke`, explicit fixture, explicit production
- summary count와 row lifecycle data scope 합계 일치
- UNKNOWN/SYNTHETIC가 production list에서 제외됨
- UNKNOWN/SYNTHETIC activation/import/transaction/replacement가 구조화된 오류로 차단됨
- create request는 UNKNOWN/INACTIVE이고 승인 없는 ACTIVE/PRODUCTION 생성이 없음
- explicit test harness만 SYNTHETIC을 생성함
- cleanup dry-run은 참조 레코드를 삭제 후보로 만들지 않음

## 7. P0-B — Archive reference coverage를 fail-closed로 구현

### 7.1 문제

현재 preflight는 `scheduledReferenceCount: null`을 반환하면서도 `blockers.length === 0`이면 `ready=true`다. 지급·환불·정산이 해당 계좌를 참조하는지 모르는 상태에서 archive가 가능해진다.

### 7.2 먼저 할 schema/source 조사

다음 실제 모델과 service 경로를 `rg`와 Prisma schema로 조사한다.

- company bank transactions와 reconciliation matches
- statement import 또는 batch import evidence
- scheduled/queued partner payouts
- pending/in-flight refunds
- cash/booking settlement 또는 closeout reference
- payment clearing 또는 transfer instruction
- primary/default account selection

이름이 비슷하다는 이유로 임의 relation을 추측하지 않는다. 각 source에 대해 다음을 문서화한다.

```text
source name
authoritative model/table/service
direct account relation 존재 여부
open/in-flight 상태 정의
count query
조회 실패 시 동작
```

### 7.3 preflight 계약

archive preflight 응답을 source별 coverage가 드러나는 구조로 변경한다. 구체적 타입명은 저장소 관례에 맞추되 의미는 다음과 같아야 한다.

```text
archiveImpact.sources[]
- source
- coverage: COMPLETE | INCOMPLETE | ERROR | NOT_APPLICABLE
- openCount: number | null
- totalCount: number | null
- lastActivityAt: ISO string | null
- reason: string | null

archiveImpact.ready
- 모든 필수 source coverage가 COMPLETE 또는 근거 있는 NOT_APPLICABLE
- 모든 open/in-flight count가 0
- replacement 검증 통과
- 별도 approver 존재
```

`INCOMPLETE`, `ERROR`, 지원되지 않는 relation, timeout, permission failure, `null/unknown`은 모두 `REFERENCE_COVERAGE_INCOMPLETE` 또는 source-specific blocker로 만들고 `ready=false`로 둔다.

현재 모델에서 권위 relation을 이번 작업 안에 안전하게 추가할 수 없다면 숫자 0을 만들지 말고 archive를 차단한 상태로 남긴 뒤 blocker와 후속 schema task를 보고한다.

### 7.4 race 방지

- archive request 제출 server action에서 preflight를 다시 계산한다.
- checker approval 직전 같은 authoritative preflight를 다시 계산한다.
- request 시점의 impact version/source timestamps를 저장한다.
- decision 시점에 새 reference가 생기거나 source가 실패하면 approval을 conflict로 중단한다.
- client의 `ready`나 hidden input을 신뢰하지 않는다.

### 7.5 replacement validation

replacement account는 서버에서 다음을 모두 검증한다.

- 다른 account ID
- `PRODUCTION`
- `ACTIVE`
- verification complete
- pending change 없음
- 같은 currency
- purpose와 direction 호환
- fixture/unknown 아님
- primary/default conflict 없음

### 7.6 필요한 테스트

- open reconciliation > 0이면 blocked
- payout/refund/settlement 중 하나라도 open이면 blocked
- source coverage null/incomplete/error이면 blocked
- 모든 source complete + open 0일 때만 ready
- request 후 reference 추가 시 checker approval conflict
- incompatible replacement 차단
- 현재의 `scheduledReferenceCount: null + ready: true` 기대값 제거

## 8. P1-A — Verification evidence와 statement import를 권위 record로 연결

### 8.1 목표

activation readiness가 maker가 입력한 자유 텍스트와 임의 datetime이 아니라 실제 증거와 성공한 import 결과를 검증해야 한다.

### 8.2 구현 요구

1. 기존 restricted file/storage entity와 권한·보존 정책을 먼저 찾는다.
2. 존재한다면 `evidenceObjectId` 자유 입력 대신 해당 객체 선택/업로드 결과를 연결한다.
3. 서버가 object 존재, restricted scope, actor access, 보존 상태와 account 연결을 검증한다.
4. public URL, 임의 attachment URL, 원문 계좌번호가 포함된 metadata를 만들지 않는다.
5. statement import test는 실제 성공한 import batch/transaction evidence를 account와 연결한다.
6. maker가 `VERIFIED`를 직접 선택하지 못하게 한다. verification status는 workflow 결과로 파생한다.
7. verifiedAt/verifiedBy는 checker 결정 시 서버가 기록한다.
8. 임의 datetime 입력은 제거하거나 보조 메모로만 사용한다. 미래 시각은 DTO와 service에서 거부한다.
9. 권위 evidence relation을 찾을 수 없다면 activation을 차단하고 존재하지 않는 검증 성공을 시뮬레이션하지 않는다.

### 8.3 Add/Edit workflow

권장 흐름은 다음과 같다.

```text
Create inactive account shell
→ attach/review restricted ownership evidence
→ run or select successful statement import test
→ checker verifies account
→ activation preflight
→ activation approval
```

create form에서 `Unverified`인데 evidence fields가 모두 required인 모순을 제거한다. account shell 생성과 verification 단계를 분리하는 것이 기존 approval model에 더 자연스러우면 그 방식을 사용한다.

## 9. P1-B — Duplicate concurrency와 review path

현재 advisory lock은 actor+idempotency key 단위여서 서로 다른 actor/key의 같은 bank/currency/last4 동시 요청을 직렬화하지 않는다.

구현 요구:

- request idempotency lock은 유지한다.
- 별도로 normalized controlled bank ID + currency + last4 기반 duplicate-check lock을 transaction 안에서 획득한다.
- raw/full account number를 수집하지 않는다.
- last4 duplicate는 확정 중복이 아니라 potential duplicate다.
- false positive를 처리할 수 있는 checker comparison/review path를 제공한다.
- 두 duplicate candidate를 모두 활성화 불가능 상태로 영구 교착시키지 않는다.
- concurrent create integration test를 실제 PostgreSQL transaction으로 실행한다.

HMAC fingerprint가 full number 수집을 요구한다면 구현하지 말고 중단 조건으로 보고한다.

## 10. P1-C — 운영자 화면 재구성

기존 Admin shell, color, spacing, form, table, status badge와 drawer component를 재사용한다. 새로운 시각 언어나 대형 UI dependency를 도입하지 않는다.

### 10.1 Operational readiness

상단 카드 네 개와 긴 성공/경고 strip을 다음 판단 구조로 단순화한다.

```text
Operational readiness: READY | NOT READY | ATTENTION | UNKNOWN
verified production accounts
pending approvals
successful statement import evidence
open reconciliation
data remediation count
last refreshed / exact current-view result count
```

규칙:

- usable production account가 0이면 `NOT READY`다.
- last successful import가 없으면 `Import not proven`이다.
- reconciliation open count 0만으로 전체를 `Healthy`라고 하지 않는다.
- approver 11명 같은 정상 정보는 큰 성공 배너 대신 helper/status line으로 낮춘다.
- `Server total`은 `Current results N`, `Archived results N`, `Remediation results N`처럼 현재 view의 의미를 표시한다.

### 10.2 View 구조

```text
Current production
Pending approvals
Archived history
Data remediation
```

- production default view에 SYNTHETIC/UNKNOWN을 섞지 않는다.
- Data remediation은 UNKNOWN과 review가 필요한 legacy records를 보여준다.
- synthetic test history를 반드시 보여야 한다면 별도 권한/환경 view로 분리한다.

### 10.3 Account table

1440px에서 가로 스크롤 없이 다음 6개 핵심 열과 주요 행동이 보여야 한다.

```text
Account
Use
Readiness
Reconciliation
Last activity
Actions
```

- bank/legal owner/mask는 Account cell의 보조 1~2줄에 배치한다.
- verification/import blocker는 Readiness cell에 우선순위순으로 요약한다.
- Actions는 오른쪽 sticky column 또는 항상 보이는 compact control로 만든다.
- 긴 계좌명·법인명·영문/베트남어/CJK에서도 Actions가 밀리지 않아야 한다.
- 1600px에서도 불필요한 horizontal scrollbar가 없어야 한다.
- 세부 profile과 전체 counts는 row detail/drawer에서 제공한다.

### 10.4 Lifecycle filter

UI에 표시하는 lifecycle과 API filter contract를 일치시킨다.

```text
ACTIVE
PENDING_ACTIVATION
PENDING_CHANGE
NEVER_ACTIVATED
REJECTED
ARCHIVED_WITH_HISTORY
DISABLED_BY_SYSTEM
TEST_FIXTURE 또는 SYNTHETIC
UNKNOWN_DATA_SCOPE
```

`All lifecycle states`라는 label로 DB `ACTIVE/INACTIVE`만 필터링하지 않는다.

### 10.5 Recent controlled changes

겹치는 5열 table을 vertical lifecycle list 또는 충분한 폭을 가진 compact list로 바꾼다.

한 lifecycle의 기본 요약:

```text
Account name and mask
requested by / requested at
approved or rejected by / decided at
result
operator reason
request ID copy action
```

- recent-changes API가 account `{id, name, bankName, mask}` snapshot을 함께 반환하게 해 current pagination과 무관하게 raw CUID fallback을 제거한다.
- before/after는 raw JSON이 아니라 changed fields만 보여주는 structured diff로 렌더링한다.
- raw JSON은 SYSTEM_AUDIT 권한의 full audit technical detail에만 둔다.
- 문구는 `10 request lifecycles from the latest 20 of 66 audit events`처럼 row 수와 event 수를 구분한다.

### 10.6 Drawer와 status dialog

- X, backdrop, Escape, footer Cancel이 하나의 guarded close handler를 사용한다.
- 변경 후 네 경로 모두 discard confirmation을 보여준다.
- submit 중에는 guard가 중복 동작하지 않는다.
- blocker code별 해결 링크를 매핑한다.

```text
identity/profile → exact Edit drawer
evidence → exact restricted evidence workflow
statement import → exact import test/reconciliation workflow
duplicate → duplicate comparison
approver unavailable → Finance Approvers
open reconciliation → filtered reconciliation queue
archive coverage incomplete → 해당 source 설정/후속 작업 안내
```

- `Immutable bank identity`와 editable free-text bank code 모순을 제거한다.
- create/edit 모두 동일한 controlled bank registry를 사용한다.
- history가 있으면 bank code/name/mask/currency를 immutable로 유지한다.

## 11. 오류·접근성·성능 계약

### 오류와 접근성

- server field error를 해당 input 바로 아래 표시하고 `aria-describedby`로 연결한다.
- 오류가 해결되면 `aria-invalid`를 제거한다.
- error summary는 유지하고 클릭 시 정확한 field로 이동한다.
- empty, permission denied, partial API failure, full failure를 구분한다.
- status는 색상 없이 label과 helper만으로 이해 가능해야 한다.
- dialog/drawer open, validation error, success receipt, close 후 focus lifecycle을 테스트한다.
- 주요 icon-only finance action을 만들지 않는다.

### 성능

- account row마다 API/DB 요청을 추가하지 않는다.
- operations projection은 bounded query를 유지한다.
- account snapshot과 lifecycle diff는 recent-changes API에서 batch로 반환한다.
- 새로운 summary/source count는 가능한 병렬 aggregate 또는 bounded query로 구현한다.
- current/archived/remediation page의 API call budget과 DB query 수를 구현 보고서에 기록한다.
- 기존 Admin 전체 shell loading을 불필요하게 blocking하지 않는다.

## 12. 필수 테스트

### API/DB

1. last4-only와 client mask 거부 회귀
2. dataScope default UNKNOWN migration
3. production positive predicate와 nullable metadata 조합
4. summary/list/lifecycle/use-path 판정 일치
5. UNKNOWN/SYNTHETIC activation/import/transaction/replacement 차단
6. maker/checker와 자기 승인 금지
7. archive source coverage complete/incomplete/error
8. request 후 새 reference 생성 시 decision conflict
9. replacement compatibility
10. evidence object와 successful import relation 검증
11. future datetime 거부
12. different actor/key concurrent duplicate request
13. recent target filter와 account snapshot
14. cleanup classification dry-run과 confirmation guard

### Admin Web

1. operational readiness의 READY/NOT READY/ATTENTION/UNKNOWN
2. current/pending/archived/remediation view 분리
3. lifecycle filter와 row badge 일치
4. 1440px에서 Actions visibility
5. long content에서도 6열 table 안정성
6. structured recent lifecycle과 raw CUID 미노출
7. structured before/after diff
8. blocker별 정확한 link
9. X/backdrop/Escape/Cancel dirty guard
10. adjacent field errors와 error cleanup
11. partial API failure와 genuine empty 구분
12. create/edit controlled bank registry
13. drawer/dialog focus lifecycle

### 통합/E2E

1. UNKNOWN account create → evidence 검증 → checker production classification → activation
2. synthetic/unknown operational use 차단
3. archive all sources complete + zero open → request → checker decision
4. archive source unknown/error/open → blocked
5. request 후 impact 변경 → checker conflict
6. duplicate concurrent create → 하나의 reviewable 결과, 중복 mutation 없음
7. page view 반복 후 recent account lifecycle 불변

## 13. 검증 명령

현재 package script와 파일 경로를 확인한 뒤 아래와 동등한 검증을 실행한다.

```powershell
npm.cmd run test --workspace @massage-vn/admin-web -- app/finance-tax/company-bank-accounts lib/admin-operator-access-model.spec.ts
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-company-bank-account.dto.spec.ts
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts --testNamePattern="company bank account"
npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.controller.spec.ts --testNamePattern="company bank account"
npm.cmd run company-bank-accounts:cleanup:test
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run admin:visible-copy
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

Prisma schema/migration 또는 보호 영역을 변경하므로 다음도 실행한다.

```powershell
npm.cmd run prisma:migrations:check
npm.cmd run verify:local
```

서비스가 준비되고 비파괴적으로 실행 가능하면 다음도 수행한다.

```powershell
powershell -ExecutionPolicy Bypass -File .\infra\scripts\verify-local.ps1 -WithServices
```

명령이 현재 저장소에 없으면 조용히 생략하지 말고 대체 검증을 찾고 보고한다. 환경·인증·기존 unrelated failure는 `BLOCKED` 또는 `FAIL`로 기록하며 PASS로 바꾸지 않는다.

## 14. 브라우저 QA

로그인된 in-app browser와 격리된 로컬 fixture를 사용한다. 공유·운영 계좌에 실제 submit, activation, archive, cleanup을 하지 않는다.

```text
Required: 1440x1000
Required: 1600x1000
Excluded: 1024px 이하
```

최소 캡처:

1. Operational readiness와 current production view
2. Pending approvals view
3. Archived history view
4. Data remediation view
5. 1440 account table 전체와 visible Actions
6. 1600 account table 전체와 scrollbar 상태
7. Add account shell 단계
8. verification evidence 단계
9. activation blocked와 ready 상태
10. archive coverage incomplete blocked 상태
11. archive all-sources-complete 상태
12. blocker별 해결 링크
13. readable recent lifecycle와 expanded structured diff
14. permission denied/partial failure/genuine empty
15. unsaved changes: X/backdrop/Escape/Cancel
16. dark mode overview와 table

브라우저 검수 시 다음을 수치 또는 DOM evidence로 확인한다.

- 1440px에서 Actions 열의 bounding box가 visible table 영역 안에 있음
- account table의 horizontal scroll width가 client width를 불필요하게 초과하지 않음
- recent lifecycle 각 row의 content overlap이 없음
- long account name과 reason에서도 row content가 겹치지 않음
- raw account number와 raw CUID가 visible copy에 없음
- drawer Cancel이 guarded handler를 통과함
- status/action은 keyboard로 접근 가능하고 focus가 복귀함

## 15. 완료 산출물

다음을 생성한다.

```text
docs/audits/company-bank-accounts-final-remediation-report-2026-08-14.md
docs/audits/company-bank-accounts-final-remediation-evidence-2026-08-14/
```

보고서 필수 내용:

- root cause와 구현 전후 계약
- P0-A/P0-B/P1별 COMPLETE/PARTIAL/BLOCKED
- schema와 migration 설명
- dataScope state machine과 사용 경로 matrix
- 현재 13건 classification dry-run 결과와 apply 미실행 확인
- archive source coverage matrix
- evidence/import authority 설명
- duplicate concurrency 결과
- UI 전후 구조와 1440/1600 evidence
- 명령별 실제 PASS/FAIL/BLOCKED
- API/DB query budget
- 변경 파일
- 보호 영역 변경과 검증
- 남은 release blocker
- 다음 가장 중요한 한 가지

## 16. 완료 판정

다음이 모두 충족되기 전에는 `완료`, `출시 가능`, `release hold 해제`라고 하지 않는다.

```text
[ ] schema-level dataScope가 존재하고 default는 UNKNOWN이다.
[ ] production use-path는 positive PRODUCTION predicate를 사용한다.
[ ] JSON NOT/name inference가 operational eligibility를 결정하지 않는다.
[ ] summary, row lifecycle, list, import, transaction, replacement 판정이 일치한다.
[ ] UNKNOWN/SYNTHETIC는 activation과 모든 money-flow use-path에서 차단된다.
[ ] 기존 13건은 reviewed manifest에 있고 apply 여부가 명확하다.
[ ] 파괴적 cleanup은 실행하지 않았다.
[ ] archive의 모든 필수 source coverage가 권위 relation으로 확인된다.
[ ] unknown/incomplete/error source는 archive ready=false다.
[ ] request와 checker decision 시점에 preflight가 재검증된다.
[ ] replacement account compatibility가 서버에서 검증된다.
[ ] verification evidence와 statement import가 실제 record로 검증된다.
[ ] maker가 VERIFIED와 검증 시각을 임의 확정할 수 없다.
[ ] different actor/key duplicate race 테스트가 통과한다.
[ ] 1440/1600에서 주요 Actions가 visible하다.
[ ] recent lifecycle이 raw CUID/겹침/raw JSON 없이 읽힌다.
[ ] 모든 close trigger가 같은 unsaved guard를 사용한다.
[ ] blocker link가 정확한 해결 위치로 이동한다.
[ ] focused tests, typecheck, visible copy, scope 검증 결과가 기록됐다.
[ ] schema/protected-area 변경 검증 결과가 기록됐다.
```

코드가 안전하게 구현됐더라도 실제 13건의 production/synthetic 분류가 사용자 승인 전 UNKNOWN으로 남으면 **코드 구현 완료 / 데이터 운영 준비 미완료 / release hold 유지**로 정확히 구분한다.

## 17. 중단 조건

다음 경우에만 사용자 확인을 요청한다.

- 공유 또는 운영 DB에 classification/cleanup apply가 필요함
- 실제 회사 계좌의 production 분류 결정을 코드 증거만으로 할 수 없음
- destructive migration 또는 reference rewrite가 필요함
- 기존 dirty change와 충돌해 사용자 변경을 보존할 수 없음
- raw account number를 새로 수집해야만 요구사항을 만족한다고 판단함
- maker/checker, break-glass, 실제 재무 승인 정책 변경이 필요함
- payout/refund/settlement account relation을 추가하면 기존 돈 흐름 결과가 달라지는데 정책 근거가 없음

작업량이 크거나 테스트 시간이 길다는 이유로 분석만 하고 멈추지 않는다. 안전한 P0 slice부터 구현하고 검증을 계속한다.

## 18. 최종 응답 형식

결론부터 다음 순서로 보고한다.

```text
Outcome
- 코드 구현 완료 여부
- release hold 해제 가능 여부
- 실제 데이터 분류 apply 필요 여부

P0 status
- P0-A provenance/data scope
- P0-B archive coverage

Changed files
- 파일과 변경 목적

Verification
- 명령별 PASS/FAIL/BLOCKED
- 1440/1600 browser evidence

Protected areas / migrations
- 변경 내용과 integration verification

Data safety
- 13건 inventory와 reviewed manifest
- cleanup/classification apply 실행 여부

Remaining risks
- 미완료 또는 외부 결정이 필요한 항목

Next task
- 가장 중요한 다음 한 가지
```

최종 응답에는 근거 없는 “모두 해결됨”을 쓰지 않는다. 결과와 테스트 증거가 다른 경우 더 보수적인 판정을 사용한다.
