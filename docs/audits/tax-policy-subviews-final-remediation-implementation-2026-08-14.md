# Tax Policy subviews final remediation implementation

Date: 2026-08-14  
Route: `/tax-policy`  
Viewport verified: 1440 x 1000  
Commit: Not committed

## 1. Conclusion

The requested code remediation is complete within the Tax Policy Admin/API boundary. Drafts, History, Integrity, and Lifecycle audit now use explicit provenance, exact server-side populations, capability-aware write controls, and recoverable URL/form state.

Operational release is still blocked. The current ACTIVE smoke policy remains referenced by financial evidence, the local fixture operator does not have production capability, and no authoritative Vietnam legal/accounting source, production maker, independent checker, governed activation, or production calculation evidence was supplied. No production/shared database mutation was performed.

**Code remediation complete/partial; operational release still blocked.**

## 2. Requirement status

| Requirement | Status | Evidence |
| --- | --- | --- |
| P0-1 production/test/smoke/legacy/unknown separation | Complete | API provenance taxonomy, History source filters, audit source filters |
| P0-2 shared Tax Policy/Finance capability truth | Complete in this route boundary | Capability-aware read model and fail-closed write controls; broader Finance action convergence remains outside scope |
| P0-3 fixture actor operational write block | Complete | Server guard and Admin blocked states |
| P0-4 non-production silent clone removal | Complete | Clean production draft preparation starts with blank governed fields and retains hidden lineage only |
| P1-1 exact selected approval request/receipt | Complete | Exact policy/event identifiers and selected detail state |
| P1-2 nearest scheduled from full dataset | Complete | Server count/nearest-scheduled query independent of list pagination |
| P1-3 mutation context and entered-value recovery | Complete | Draft context, field errors, retained values, stable notices |
| P1-4 Create/Prepare scroll and focus | Complete | Browser-verified hash focus and accessible focus handoff |
| P1-5 reduce repeated current-policy content | Complete | Compact status/readiness context precedes each workspace |
| P1-6 Drafts as real work queue | Complete | Exact queue counts, readiness blockers, selected work item |
| P1-7 explicit create field contract | Complete | Grouped fields, `aria-describedby`, field-level validation focus |
| P1-8 production-first server-filtered History | Complete | Production default, test/legacy isolation, exact server totals |
| P1-9 five-column History without 1440 overflow | Complete | Measured page and table regions have no horizontal overflow |
| P1-10 inspection-oriented History detail | Complete | Source, lifecycle, hash and immutable evidence context |
| P1-11 actionable Integrity cards | Complete | Exact exception categories and `Open records` actions |
| P1-12 exact Integrity evidence list | Complete | Source/date/classification filters, exact pagination and linked booking evidence |
| P1-13 Lifecycle audit investigation | Complete | Source/event filters, exact event detail, copy/back/deep-link behavior |
| P1-14 truthful copy | Complete | No silent production promotion or unverified readiness claim |
| P2-1 accessibility | Complete for verified desktop scope | Labeled regions, focusable errors/hash targets, keyboard-accessible controls |
| P2-2 theme and visual polish | Complete for verified desktop scope | Light/dark checked; History and Integrity table collisions removed |
| Production legal evidence and governed replacement | Blocked | Requires human legal owner, production maker/checker and scheduled activation |

## 3. Changed files and purpose

### API and data contract

- `apps/api/src/provider-onboarding/provider-onboarding.service.ts`: exact lifecycle event IDs, source taxonomy, exact audit/integrity filters, Vietnam-time date boundaries, evidence joins, classifications, totals and pagination.
- `apps/api/src/provider-onboarding/provider-onboarding.controller.ts`: source/date/event/integrity filter passthrough.
- `apps/api/src/provider-onboarding/*.spec.ts`: provenance, nearest-scheduled, exact count, source and integrity regression coverage.
- `apps/admin_web/lib/admin-api.ts`: Tax Policy audit/integrity response types.

### Admin workspace

- `apps/admin_web/app/tax-policy/page.tsx`: real Draft work queue, capability-aware actions, production/test History separation, actionable Integrity records, exact Lifecycle investigation, truthful copy and finance evidence links.
- `apps/admin_web/app/tax-policy/tax-policy-page-model.ts`: stable query builders, exact source normalization and event/integrity URLs.
- `apps/admin_web/app/tax-policy/tax-policy-action-form.tsx`: field error descriptions, first-invalid-field focus and entered-value recovery.
- `apps/admin_web/app/tax-policy/tax-policy-hash-focus.tsx`: pathname/search-safe hash focus and browser history navigation support.
- `apps/admin_web/app/globals.css`: scoped five-column Tax Policy tables, wrapping, responsive layout and dark-theme corrections.
- `apps/admin_web/app/tax-policy/*.spec.*`: Admin rendering, model, CSS, form, time and snapshot regressions.

### Operations documentation

- `docs/runbooks/tax-policy-smoke-active-replacement.md`: governed 12-step replacement, evidence retention, stop/abort and corrective-version procedure.
- This report records verification and unresolved release blockers.

## 4. Admin IA, component and copy changes

- Drafts shows action queues and capability/readiness before policy detail.
- A smoke/test/legacy source can only prepare a clean production draft; unsafe governed fields are blank instead of silently cloned.
- History defaults to Production and exposes Test / legacy evidence separately with exact server totals.
- History uses five readable columns; long source/status content wraps inside the cell rather than overlapping.
- Integrity cards open the exact filtered record population. Partner, booking and earning evidence share one compact identity column so the action remains visible.
- Lifecycle audit supports exact source/event investigation and stable back/deep links.
- Browser-discovered broken finance links now open the booking finance section: `/bookings/{bookingId}#finance`.
- Unverified identities, source provenance and approval readiness are presented as blockers, not optimistic success states.

## 5. API, query, data and security changes

- Provenance is classified as production, test, legacy, unknown, or test-legacy; unknown evidence is never promoted to production.
- Audit and integrity queries use exact server-side source/date/state filters and exact totals instead of client-only filtering.
- Vietnam day filters use UTC+7 local midnight and an end-exclusive upper boundary.
- Integrity evidence joins earning, booking, Partner, policy and tax-log facts and classifies current regression, applicability readiness, legacy migration debt, or unknown.
- Lifecycle items expose their exact event ID and policy provenance.
- Fixture/non-production actors fail closed for operational writes; read-only inspection remains available.
- The selected approval and scheduled-policy facts are loaded independently of preview pagination.

## 6. Schema, migration and index changes

None were introduced by this remediation. Prisma schema and migration files were already dirty in the shared worktree and were preserved without modification for this task.

## 7. Test and verification results

| Command/scope | Result | Actual result |
| --- | --- | --- |
| Final Admin Tax Policy focused suite | PASS | 9 files, 42 tests passed |
| Required API service + withholding focused suite | PASS | 2 files, 32 tests passed |
| Broader API Tax Policy regression set | PASS | 5 files passed, 1 file skipped; 61 tests passed, 4 skipped |
| Final Admin page/CSS regression rerun | PASS | 2 files, 16 tests passed |
| Admin typecheck / lint / build | PASS | All three completed successfully; build rerun after browser fixes |
| API typecheck / lint / build | PASS | All three completed successfully |
| `admin:visible-copy` | PASS | 1,646 files checked |
| `admin:query-guards` | PASS | Completed successfully |
| Fixture cleanup unit test | PASS | Completed successfully |
| Fixture cleanup check | PASS, dry-run only | 145 policies inspected; ACTIVE and referenced records retained |
| `verify:scope -Scope api` | FAIL outside this remediation | 2,454 passed, 12 skipped, 1 failed in campaign receipt persistence expectation |
| `verify:scope -Scope admin` | FAIL outside this remediation | 4,613 passed, 1 skipped, 3 failed in navigation, shared notice CSS and finance-closeout age expectations |
| `verify:local` / service-backed full verification | SKIPPED | This remediation did not add a protected schema/auth/shared-types change; shared write verification was prohibited |
| Production DB mutation/integration | SKIPPED | No disposable production-equivalent database was established |

The scope failures do not target Tax Policy changed behavior. They are reported rather than hidden; no unrelated assertion was weakened to make the scope green.

## 8. Authenticated browser measurements

- Verified the actual logged-in Admin build at `http://localhost:3101/tax-policy` in a 1440 x 1000 viewport.
- History page width: 1425 / 1425; table region: 1065 / 1065; no horizontal overflow or text overlap.
- Integrity page width: 1425 / 1425; record region: 1065 / 1065; action links remain visible.
- Lifecycle table region: 1050 / 1050; no horizontal overflow.
- Hash focus moved to the exact audit event target near the fixed header and survived URL filter/detail transitions.
- Production History returned 0 exact records; Test / legacy returned 144. Production lifecycle audit returned 0; test/smoke returned 725.
- Integrity summary showed 123 earnings, 13 missing-tax-log records and 59 no-approved-tax-profile records; filtered records matched the selected issue.
- Fresh browser console errors/warnings on the final Integrity load: none.
- Light and dark theme states were opened and visually inspected.

## 9. Fresh screenshots

Evidence directory: `docs/audits/tax-policy-subviews-final-remediation-evidence-2026-08-14`

1. `01-drafts-first-viewport.png`
2. `02-draft-form-blocked-state.png`
3. `03-selected-policy-blocked-state.png`
4. `04-history-production.png`
5. `05-history-test-legacy.png`
6. `06-history-table-no-overflow.png`
7. `07-clean-production-draft-preparation.png`
8. `08-integrity-summary.png`
9. `09-integrity-filtered-records.png`
10. `10-lifecycle-audit-filters.png`
11. `11-audit-event-detail.png`
12. `12-dark-theme.png`

All twelve captures were opened and visually inspected after capture. The form-error capture uses the fixture actor's server-authoritative blocked state; native invalid submit could not be invoked because the submit action correctly remained disabled. Field-error and value-retention behavior is covered by focused tests.

## 10. Protected areas and preserved work

- No Prisma schema, migration, auth contract, shared type package, matching, payment or settlement mutation was changed by this remediation.
- Provider-onboarding Admin read/security boundaries and Admin API display types were changed and received focused API/Admin verification.
- The worktree contained extensive existing modified and untracked files before this task. They were not reset, reformatted, deleted or committed.

## 11. Forbidden operational actions confirmation

No shared/production database write, policy approval, schedule, activation, direct ACTIVE edit, destructive cleanup, or fixture deletion was executed. The ACTIVE smoke policy and its five tax logs and five immutable snapshots remain governed historical evidence.

## 12. Remaining risks and required human steps

- Supply authoritative Vietnam legal/accounting evidence and assign its accountable owner.
- Use a verified production maker and a separate verified Finance checker with enforceable MFA/re-authentication evidence.
- Create and review a clean production draft, then schedule a governed Vietnam-time replacement.
- Verify one ACTIVE policy, immutable financial snapshots and controlled withholding output before release.
- Existing unrelated full-scope failures must be resolved before claiming a globally green repository.

## 13. Next recommended action

Run the replacement runbook's read-only inventory and owner-assignment steps with the real Finance/legal owners. Do not create or activate a production candidate until every hard precondition is evidenced.

**Code remediation complete/partial; operational release still blocked.**
