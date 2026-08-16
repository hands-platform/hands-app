# Tax Policy final remediation implementation report

- Date: 2026-08-14
- Repository: `C:\dev\massage-on-demand-vn`
- Route: `/tax-policy`
- Final verdict: **Code remediation complete; operational release still blocked**
- Commit: Not committed

## 1. Implementation summary

The Tax Policy workspace now presents four explicit operator views: Current policy, Drafts & scheduled, History, and Audit & integrity. High-risk mutations fail closed when the session is not a verified production identity, when MFA or recent password confirmation is missing, or when no independent Finance checker is available.

The currently ACTIVE `Smoke withholding 1785768305234` policy was not edited, deleted, replaced, approved, or rescheduled. The existing policy inventory was not mutated. The production replacement remains an operational procedure described in `docs/runbooks/tax-policy-smoke-active-replacement.md`.

## 2. Changed implementation surfaces

### API and authorization

- `apps/api/src/admin/finance-approver-policy.ts` and spec: centralized fail-closed Finance capability, MFA challenge, recent reauthentication, and independent-checker decisions.
- `apps/api/src/provider-onboarding/tax-policy-fixture-write-guard.ts` and spec: strict disposable-target allowlist for fixture writes.
- `apps/api/src/provider-onboarding/provider-onboarding.service.ts` and spec: exact policy/receipt/audit filters, full-workspace counts, independent integrity queues, source lineage, clean-source acknowledgement, and guarded lifecycle mutations.
- `apps/api/src/provider-onboarding/provider-onboarding.controller.ts` and spec: capability, workspace, integrity, and exact-filter contracts; session assurance is passed to high-risk mutations.
- `apps/api/src/provider-onboarding/provider-onboarding.dto.ts` and spec: clean-source acknowledgement and exact query inputs.
- `apps/api/src/admin/admin-analytics.routes.ts`: Tax Policy route ownership is mapped to the existing Admin domain.

### Admin Web

- `apps/admin_web/lib/admin-api.ts`: typed Tax Policy capability, workspace, history, approval, audit, lineage, and integrity contracts.
- `apps/admin_web/app/tax-policy/tax-policy-page-model.ts` and spec: four-view URL model, independent issue pagination, exact audit/approval loading, and production-first history.
- `apps/admin_web/app/tax-policy/actions.ts` and spec: `useActionState` signatures, retained form values/errors, exact redirects, and no legal/rationale leakage into query strings.
- `apps/admin_web/app/tax-policy/action-state.ts`, `tax-policy-action-form.tsx`, `tax-policy-hash-focus.tsx`, and time helper/spec: durable action feedback, exact hash focus, and Vietnam-time presentation.
- `apps/admin_web/app/tax-policy/page.tsx` and spec: read-only current view, full draft queue, source lineage, exact approval receipt, four-view information architecture, integrity queues, and guarded forms.
- `apps/admin_web/app/tax-policy/tax-policy-layout-css.spec.ts`: regression coverage for compact status title/detail separation.
- `apps/admin_web/app/globals.css`: Tax Policy desktop layout, action forms, tables, integrity cards, focus states, and light/dark presentation.

### Fixture safety and documentation

- `infra/scripts/lib/tax-policy-fixture-write-target.mjs` and test: disposable database/schema/env target validation.
- `infra/scripts/api-smoke.mjs`: Tax Policy fixture write preflight.
- `docs/runbooks/tax-policy-smoke-active-replacement.md`: maker-checker activation, stop/abort, rollback, and evidence procedure.
- `docs/audits/tax-policy-final-remediation-evidence-2026-08-14`: verified 1440x1000 light/dark screenshots.

## 3. Security and lifecycle behavior

- Production writes are denied for test, fixture, smoke, or shared identities.
- Draft approval and scheduling require the Finance capability, enforceable MFA, a verified MFA challenge receipt, and recent password confirmation.
- Maker and checker must be distinct verified operators.
- Approval reads and counts are bound to the exact selected policy ID and content hash rather than an aggregate receipt.
- Draft creation requires explicit clean-source acknowledgement. Smoke rates, test provenance, and legal free text are not treated as a production source.
- Form failures retain non-secret user input in server action state. Legal source and rationale values are not placed in redirect query strings.
- Fixture write scripts fail closed outside an explicitly disposable database/schema/environment.
- No schema, migration, authentication source, payment mutation, settlement mutation, or retained earning record was changed by this remediation.

## 4. Data and operator UX behavior

- Current policy shows provenance, Vietnam effective time, withholding rate, legal source, approval receipt, and next activation without exposing edit controls.
- Non-current views retain a compact critical status for the ACTIVE smoke policy without duplicating the full current-policy card.
- Draft queue totals come from the complete server result, not the visible page.
- History defaults to production provenance. Test/legacy evidence is a separate source filter; current data contains 0 production-history rows and 144 test/legacy rows.
- Integrity cards use independent predicates and totals. The verified 30-day population is 123 earnings, including 13 missing-tax-log records and 59 records without an approved tax profile.
- Every integrity issue opens its own paginated queue. Audit evidence and settlement evidence are secondary disclosures, not mixed into the action queue.
- Empty, blocked, fixture, and incomplete states are explicit; missing data is not rendered as a trusted zero.
- The compact critical status now separates the title and explanation with a dedicated grid/gap contract.

## 5. Verification results

| Verification | Result |
| --- | --- |
| Admin Tax Policy focused suite | PASS · 8 files / 34 tests |
| API Tax Policy focused suite | PASS · 6 files / 59 tests |
| Fixture target Node tests | PASS · 2 tests |
| Admin typecheck | PASS |
| API typecheck | PASS |
| Admin lint | PASS |
| API lint | PASS |
| Admin production build | PASS |
| API production build | PASS |
| `admin:visible-copy` | PASS |
| `admin:query-guards` | PASS |
| `tax-policy:fixture-cleanup:test` | PASS |
| `tax-policy:fixture-cleanup:check` | PASS · dry-run only; 145 policies inspected, ACTIVE smoke retained, no mutation |
| Related shared Admin surface guards | PASS after replacing page-local raw article and reserved error-summary naming |
| Scoped `git diff --check` | PASS; line-ending warnings only |

Commands included:

```text
npm.cmd run test --workspace @massage-vn/admin-web -- app/tax-policy
npm.cmd run test --workspace @massage-vn/api -- src/provider-onboarding/provider-onboarding.service.spec.ts src/provider-onboarding/provider-onboarding.controller.spec.ts src/provider-onboarding/provider-onboarding.dto.spec.ts src/provider-onboarding/tax-policy-fixture-write-guard.spec.ts src/admin/finance-approver-policy.spec.ts src/earnings/tax-policy-withholding.spec.ts
node --test infra/scripts/lib/tax-policy-fixture-write-target.test.mjs
npm.cmd run verify:scope -- -Scope admin
npm.cmd run verify:scope -- -Scope api
```

### Scope verification exceptions

`verify:scope admin` was attempted. Tax Policy tests, typecheck, lint, query guards, visible-copy checks, and build passed. The full Admin suite remains red on three unrelated dirty-worktree expectations:

1. `components/admin-surface-css.spec.tsx`: shared notice CSS grid expectation.
2. `lib/admin-navigation.spec.ts`: Company Bank Account navigation visibility expectation.
3. `app/finance-closeout/page.spec.tsx`: pre-existing 70d versus rendered 74d expectation.

`verify:scope api` was attempted. Tax Policy tests, typecheck, lint, contracts, and build passed. The full API suite remains red on one unrelated Push campaign mock expecting `include` while the implementation uses `select` in post-enqueue receipt persistence. The run reported 178 files passed, 5 skipped, 2449 tests passed, 12 skipped, and 1 unrelated failure.

`verify:local` was not rerun after these known scope failures because it would repeat the same unrelated failures. This is recorded as skipped, not passed.

## 6. Browser verification

The signed-in local browser was verified against a fresh Admin/API pair using the current code: Admin `http://localhost:3112`, API `http://localhost:3001`. The user's original `3101/3000` processes were not stopped or modified.

Viewport policy followed the task constraint: desktop only, 1440x1000. No viewport at or below 1024 was inspected or reported.

| URL/state | Result |
| --- | --- |
| `/tax-policy` | Current smoke ACTIVE policy and immutable replacement warning visible |
| `?view=drafts` | Queue counts 0/0/0/0; production write blocked; Create draft disabled |
| `?view=history` | Production history count 0; true empty state |
| `?view=history&source=test-legacy` | 144 test/legacy records; 25 rows on first page |
| `?view=integrity` | Independent 30-day integrity cards and source population visible |
| `?view=integrity&issue=missing-tax-log&page=1` | Exact missing-tax-log queue opens without changing other counts |
| Dark theme | Integrity cards, alerts, labels, and controls remain legible |

All six routes reported `scrollWidth <= viewport width`; there was no page-level horizontal overflow. The fresh 3112 session reported zero console errors. The original 3101 development session produced a transient ChunkLoadError only after its chunks were invalidated by a concurrent production build; it was excluded from evidence and replaced by the clean 3112 validation session.

Evidence:

- `01-current-policy-1440x1000.png`
- `02-drafts-scheduled-1440x1000.png`
- `03-history-production-1440x1000.png`
- `04-history-test-1440x1000.png`
- `05-integrity-overview-1440x1000.png`
- `06-integrity-missing-tax-log-1440x1000.png`
- `07-integrity-dark-1440x1000.png`

## 7. Protected areas and worktree preservation

- No Prisma schema or migration was added or changed by this task.
- No Auth implementation, payment/settlement mutation contract, or retained finance history was changed by this task.
- No production/shared database write, policy activation, approval, schedule, cleanup, commit, push, or deployment was performed.
- The large pre-existing dirty worktree, including unrelated tracked and untracked files, was preserved. No reset, checkout, cleanup, or broad formatting command was used.

## 8. Remaining operational blockers

Operational release remains blocked because:

1. the ACTIVE policy is still smoke provenance with a 5% rate, missing legal source, and no recorded approval receipt;
2. there is no verified production operator session with enforceable MFA, recent password confirmation, and a separate checker in the local environment;
3. no clean production policy has been legally sourced, independently approved, scheduled, or activated;
4. 145 existing policies require controlled retention/review, and destructive cleanup was intentionally not performed;
5. 13 of 123 recent earnings are missing a tax log and 59 of 123 lack an approved tax profile;
6. unrelated Admin/API scope failures remain in the shared dirty worktree.

The next action is to assign the runbook owners and execute the production replacement only after every hard precondition is met. Until then: **Code remediation complete; operational release still blocked**.
