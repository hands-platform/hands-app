# Company Bank Accounts 최종 보강 구현 보고서

- 작업일: 2026-08-14
- 대상: `http://localhost:3101/finance-tax/company-bank-accounts`
- 브라우저 기준: 1440x1000, 1600x1000
- 데이터 변경 원칙: 실제 계좌 분류, 상태 변경, cleanup apply 미실행
- 최종 판정: **코드 구현 완료 / 데이터 운영 준비 미완료 / Release hold 유지**

## 1. Outcome

이번 작업은 기존 JSON/name 추론을 운영 자격 판정에서 제거하고, schema-level `dataScope`와 positive `PRODUCTION` predicate를 추가했다. 생성, 조회, 활성화, import, transaction, replacement, 보관 preflight가 같은 fail-closed 원칙을 사용하도록 정리했다. 운영 화면은 Current production, Pending approvals, Archived history, Data remediation 네 view와 6열 계좌 표, readable lifecycle, drawer/status dialog로 재구성했다.

다만 다음 이유로 release hold를 해제할 수 없다.

1. 현재 13개 legacy 계좌는 모두 `UNKNOWN`이며 실제 운영/합성 분류를 사용자가 승인하지 않았다.
2. archive source 중 `STATEMENT_IMPORTS`, `PAYOUTS`, `REFUNDS`, `SETTLEMENTS`에는 권위 있는 company bank account relation이 없다.
3. restricted ownership evidence의 권위 relation이 없어 activation은 의도적으로 차단된다.

분류 및 파괴적 cleanup apply는 실행하지 않았다.

## 2. Root cause와 구현 전후 계약

| 영역 | 구현 전 | 구현 후 |
|---|---|---|
| 운영 데이터 범위 | metadata/name 기반 fixture 추론 | DB enum `UNKNOWN / PRODUCTION / SYNTHETIC`, default `UNKNOWN` |
| production 사용 경로 | negative exclusion 조합 | 중앙 `companyBankAccountProductionWhere()` positive predicate |
| legacy 데이터 | smoke로 보여도 운영 후보와 혼재 | `UNKNOWN` remediation view에 격리, 활성화와 money-flow 차단 |
| archive 영향 | 미지원 참조가 `null`이어도 ready 가능 | source별 coverage, 하나라도 INCOMPLETE/ERROR면 ready=false |
| 승인 race | client preflight 결과 의존 가능성 | request와 checker decision에서 서버 preflight 재계산 및 hash 비교 |
| 중복 생성 | actor/idempotency 단위 직렬화 | actor/idempotency + normalized bank/currency/last4 advisory lock |
| verification | maker 입력 metadata가 성공처럼 보일 수 있음 | 권위 evidence가 없으면 explicit blocker, maker VERIFIED 확정 제거 |
| 목록 | fixture/운영 혼재, 넓은 표 | 네 view 분리, 6열 표와 visible Actions |
| recent changes | current page 의존 이름, raw JSON/CUID | target-filtered audit + batch account snapshot + structured diff |

## 3. P0/P1 상태

| 항목 | 상태 | 결과 |
|---|---|---|
| P0-A schema provenance | COMPLETE | `CompanyBankAccountDataScope` enum, non-null `dataScope`, UNKNOWN default, index 추가 |
| P0-A production predicate | COMPLETE | list/summary/activation/import/transaction/replacement에 positive PRODUCTION contract 적용 |
| P0-A legacy classification | BLOCKED | 13건 전부 manual review. 사용자 승인 없는 자동 분류 금지 |
| P0-B bank transaction coverage | COMPLETE | direct `bankAccountId`, open/total/last activity를 권위 query로 집계 |
| P0-B remaining archive sources | BLOCKED | statement imports, payouts, refunds, settlements relation 부재. 모두 INCOMPLETE로 fail-closed |
| P0-B race/replacement | COMPLETE | request/decision 재검증, preflight hash, production/active/currency/purpose/direction/verification 검사 |
| P1-A restricted evidence | BLOCKED | 권위 restricted ownership evidence relation 부재. activation blocker 유지 |
| P1-A statement import | PARTIAL | transaction batch metadata는 표시하되 권위 import relation으로 인정하지 않음 |
| P1-B duplicate concurrency | COMPLETE | identity advisory lock과 PostgreSQL concurrent integration test 통과 |
| P1-C operator UI | COMPLETE | view 분리, 6열 표, drawer/dialog, lifecycle, structured diff, exact blocker links 구현 |
| Dirty close browser QA | PARTIAL | 공통 guarded handler와 테스트 완료. Cancel native confirm 확인, X/backdrop/Escape 개별 브라우저 조작은 미완료 |

## 4. Schema와 migration

Migration `20260814113000_add_company_bank_account_data_scope`는 다음만 수행한다.

```text
CompanyBankAccountDataScope = UNKNOWN | PRODUCTION | SYNTHETIC
CompanyBankAccount.dataScope NOT NULL DEFAULT UNKNOWN
INDEX(dataScope, status, currency)
```

기존 레코드를 이름이나 metadata로 자동 분류하지 않는다. migration 적용 후 legacy 레코드는 `UNKNOWN`으로 남아 remediation review를 거쳐야 한다.

### State machine

```text
Create shell -> UNKNOWN + INACTIVE
UNKNOWN -> reviewed classification required
SYNTHETIC -> test harness only; production activation/use blocked
PRODUCTION + verified evidence/import + approval -> ACTIVE candidate
ACTIVE -> archive request -> checker decision -> INACTIVE
```

### Use-path matrix

| Use path | PRODUCTION | UNKNOWN | SYNTHETIC |
|---|---|---|---|
| Current production list | Allow | Remediation only | Excluded |
| Activation request | Preconditions required | Block | Block |
| Statement import operational use | Allow after contract checks | Block | Block |
| Bank transaction operational use | Allow | Block | Block |
| Replacement candidate | Active/verified/compatible only | Block | Block |
| Synthetic test harness | Excluded | Excluded | Allow |

## 5. Current inventory와 data safety

최신 dry-run manifest:

`output/company-bank-accounts-cleanup-manifest-2026-08-14T03-08-22-290Z.json`

결과:

- inventory: 13 records
- classification: 13 `manual-review`
- production/synthetic 자동 결정: 0
- cleanup/classification apply: **NOT RUN**
- destructive delete/archive: **NOT RUN**

Manifest v2는 내용 hash와 명시적 apply confirmation을 요구한다. 현재는 사람의 실제 계좌 분류 결정이 없으므로 apply 조건을 충족하지 않는다.

## 6. Archive source coverage

| Source | Authority | Relation | Coverage | Archive behavior |
|---|---|---|---|---|
| BANK_TRANSACTIONS | `CompanyBankTransaction.bankAccountId` | direct | COMPLETE | open/partial > 0이면 blocked |
| STATEMENT_IMPORTS | transaction metadata의 batch ID뿐 | authoritative relation 없음 | INCOMPLETE | blocked |
| PAYOUTS | payout model/service | company account direct relation 없음 | INCOMPLETE | blocked |
| REFUNDS | refund model/service | company account direct relation 없음 | INCOMPLETE | blocked |
| SETTLEMENTS | settlement/closeout model/service | company account direct relation 없음 | INCOMPLETE | blocked |

`null` 또는 unsupported를 0으로 바꾸지 않는다. 모든 필수 source가 COMPLETE 또는 근거 있는 NOT_APPLICABLE이고 open/in-flight count가 0일 때만 archive ready가 가능하다.

## 7. Evidence/import authority

현재 schema에는 company bank account에 연결된 authoritative restricted ownership evidence relation이 없다. 따라서 자유 입력 object ID나 maker의 datetime을 verification 성공으로 승격하지 않았다. activation preflight는 `EVIDENCE_AUTHORITY_UNAVAILABLE`을 반환하고 submit을 차단한다.

Statement import는 기존 transaction metadata에서 batch 흔적을 확인할 수 있지만, 이것은 독립된 성공 import authority가 아니다. UI의 `Open statement imports`는 기존 reconciliation import workspace로 이동하지만 release gate를 충족했다는 뜻은 아니다.

## 8. Concurrency와 approval safety

- actor + idempotency key lock을 유지한다.
- transaction 안에서 normalized controlled bank code + currency + last4 advisory lock을 추가했다.
- raw/full account number는 수집하지 않는다.
- duplicate는 확정 중복이 아니라 potential duplicate로 표시하고 exact comparison path를 제공한다.
- request 제출과 checker decision 직전에 authoritative preflight를 다시 계산한다.
- preflight source/hash가 바뀌면 approval을 conflict로 중단한다.
- 자기 승인과 maker/checker 동일 actor는 계속 금지한다.

실제 PostgreSQL concurrent integration test는 두 actor/key의 동시 create에서 중복 mutation 없이 reviewable 결과가 남는 것을 확인했다. 테스트 계좌는 제거됐고, append-only audit FK 때문에 test user 세 건만 남았다.

## 9. UI와 blocker workflow

운영 화면은 다음 순서로 정리했다.

1. Operational readiness와 current counts
2. Current production / Pending approvals / Archived history / Data remediation
3. 6-column account table: Account, Use, Readiness, Reconciliation, Last activity, Actions
4. Recent controlled changes vertical lifecycle

Blocker 링크:

- identity/profile -> 해당 account Edit drawer
- statement import -> reconciliation import workspace
- duplicate -> exact candidate comparison drawer
- approver unavailable -> Finance Approvers
- open reconciliation -> filtered reconciliation queue
- evidence authority/archive unsupported source -> 존재하지 않는 workflow를 꾸미지 않고 blocker 설명 유지

1440에서는 Actions가 visible 영역 안에 있고 scoped table overflow만 존재했다. 1600에서는 table `scrollWidth == clientWidth`였다. lifecycle은 raw JSON과 raw CUID 없이 structured field diff로 읽힌다.

## 10. API/DB query budget

Operations page는 row별 query를 추가하지 않는다.

- 10개 bounded query를 `Promise.all`로 병렬 실행: page rows, current count, scope counts, pending, reconciliation, latest import
- 표시된 account IDs에 대해 open reconciliation `groupBy` 1회
- page size 최대 50
- recent changes: target-filtered audit page 1회 + account IDs batch snapshot lookup 1회
- archive preflight: 단일 account, approver count, duplicate/import/open transactions 병렬 조회; open transactions 최대 500

지원되지 않은 payout/refund/settlement source를 가짜 count query로 채우지 않았다.

## 11. Changed files

주요 변경 범위:

- `apps/api/prisma/schema.prisma`: dataScope enum/field/index
- `apps/api/prisma/migrations/20260814113000_add_company_bank_account_data_scope/migration.sql`: provenance migration
- `apps/api/src/admin/company-bank-account-data-scope.ts`: canonical scope predicates
- `apps/api/src/admin/admin.service.ts`: operations projection, preflight, locks, guards, snapshots
- `apps/api/src/admin/admin.dto.ts`: last4-only, controlled bank registry, validation contract
- `apps/api/src/admin/admin.service.spec.ts`, `admin.controller.spec.ts`, DTO/scope/concurrency specs: 회귀 검증
- `apps/admin_web/app/finance-tax/company-bank-accounts/page.tsx`: 네 view, table, lifecycle, links
- `company-bank-account-drawer-shell.tsx`: focus와 guarded close
- `company-bank-account-request-form.tsx`: adjacent field errors와 summary
- `company-bank-account-status-dialog.tsx`: server preflight/action dialog
- `apps/admin_web/app/finance-tax/company-bank-accounts/page.spec.tsx`: UI/contract tests
- `apps/admin_web/app/globals.css`: 1440/1600 table, drawer, lifecycle, dark mode
- `infra/scripts/company-bank-account-cleanup.mjs`와 lib/test: manifest v2 dry-run/apply guard
- `apps/api/prisma/seed.js`: synthetic smoke harness scope

기존 worktree의 다른 사용자 변경은 되돌리거나 정리하지 않았다.

## 12. Verification

### Focused checks

| Command/check | Result |
|---|---|
| Admin company-bank-account/access focused tests | PASS, 16 tests |
| API DTO + data scope specs | PASS, 23 tests |
| API service `company bank account` | PASS, 8 focused tests |
| API controller `company bank account` | PASS, 4 focused tests |
| PostgreSQL duplicate concurrency integration | PASS, 1 test |
| cleanup script tests | PASS, 4 tests |
| Admin typecheck | PASS |
| API typecheck | PASS |
| Admin build | PASS |
| API build | PASS |
| Admin visible-copy | PASS |
| Prisma migrations check | PASS, 97 migrations; pre-existing duplicate timestamp warning |
| `git diff --check` | PASS; line-ending warnings only |

### Scope checks

| Command | Result |
|---|---|
| `verify:scope -- -Scope api` | FAIL: 2 unrelated existing tests; 2,410 passed, 12 skipped |
| `verify:scope -- -Scope admin` | FAIL: 3 unrelated existing tests; 4,592 passed, 1 skipped |

API unrelated failures were referral cashout select and push campaign recipient select expectations. Admin unrelated failures were old admin-surface CSS selector, navigation company-bank link expectation, and finance-closeout 70/74-day expectation.

### Full local verification

`npm.cmd run verify:local` completed with exit code 1.

Passed: Prisma validate, API/Admin typecheck and build, public-web test/typecheck/lint/build, customer/Partner Flutter pub get/analyze/test, security checks, notification contracts, Docker config.

Failed outside this change: setup doctor, authority check, Vietnam scope check, API domain smoke, Supabase schema alignment, and the same three Admin tests. Docker services/API smoke were skipped because `-WithServices` was not used.

## 13. Browser evidence

Evidence directory:

`docs/audits/company-bank-accounts-final-remediation-evidence-2026-08-14/`

Key captures:

- `01-current-1440x1000.png`, `02-current-1440x1000-full.png`
- `03-remediation-1440x1000.png`, `04-pending-empty-1440x1000.png`, `05-archived-empty-1440x1000.png`
- `06-edit-drawer-1440x1000.png`, `07-add-account-drawer-1440x1000.png`
- `08-activation-blocked-1440x1000.png`, `09-archive-blocked-1440x1000.png`
- `10-remediation-1600x1000.png`, `10-remediation-1600x1000-full.png`
- `11-dark-remediation-1440x1000.png`
- `12-recent-lifecycle-expanded-1440x1000.png`
- `13-activation-blocker-links-1440x1000.png`

Confirmed:

- 1440 Actions visible, no page-level horizontal scroll
- 1600 table has no unnecessary horizontal scroll
- pending/archived genuine empty states are distinct
- add creates UNKNOWN + INACTIVE shell and accepts last4 only
- activation/archive remain disabled on unsupported evidence/source coverage
- structured lifecycle has no overlap, raw CUID, or raw account number
- light/dark layouts are readable
- clean verification tab had no console errors

Not claimed as complete: ready activation/archive states could not be produced without falsifying authority data; permission-denied/partial failure were covered by component tests rather than mutating the signed-in role; X/backdrop/Escape dirty prompts were not each replayed after native Cancel confirmation.

## 14. Protected areas

Prisma schema and migration are intentionally changed. Migration was deployed to the local database, Prisma validate and migration checks passed, and the PostgreSQL concurrency integration test passed.

Auth, payment settlement calculations, Partner wallet balances, payout release policy, and matching policy were not weakened or redesigned. No new dependency was added.

## 15. Remaining release blockers

1. Review and explicitly classify all 13 UNKNOWN accounts; run manifest apply only after user approval.
2. Add authoritative account relations for restricted ownership evidence and statement import success.
3. Add authoritative company bank account references for payouts, refunds, and settlements.
4. Re-run ready activation/archive E2E only after those relations exist.

## 16. Next task

가장 중요한 다음 작업은 **restricted ownership evidence와 statement import/payout/refund/settlement의 authoritative company bank account relation을 설계·구현하는 것**이다. 그 전에는 13건 분류 apply와 archive release hold를 해제하면 안 된다.

## 17. Repository state

- Commit: Not committed
- Push/deploy: Not performed
- Existing user changes: Preserved

