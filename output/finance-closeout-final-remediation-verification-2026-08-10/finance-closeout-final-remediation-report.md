# Finance Closeout final remediation

Date: 2026-08-10  
Route: `/finance-closeout`  
Status: Partially complete - read-only release candidate; production repair writes remain unverified by design.

## 1. 결과

The Finance Closeout queue, comparison flow, blocker guidance, Finance Overview handoff, and repair concurrency guard were implemented and verified. Focused Admin/API tests and both full scope verifications passed. Logged-in browser validation covered the queue, 0/1/10 selection states, comparison, batch safety check, blocked/canonical/historical drawers, dark theme, keyboard close/focus return, and the handoff destination at 1440 x 900.

Release judgment: the read-only operations flow is ready for review. Production repair release is still blocked on one controlled staging repair because this task explicitly prohibited submitting the repair POST in browser.

## 2. 운영자 관점 변화

- The page is now titled `Settlement Repair`, and the dead Shift Handoff destination now opens Finance Overview.
- Queue metrics use the same active month, payment, age, track, and search scope as the visible rows. Batch totals intentionally use the broader settlement-gap scope and state that difference.
- Selection supports exactly 0 through 10 records with live feedback; the comparison action is disabled at 0 and additional records are disabled at 10.
- The comparison table exposes Record, Policy, Expected accounting, Evidence, and Action without pushing the decision fields off screen.
- Blocked repairs now show responsible team, missing evidence, next action, and a real operational destination. Machine codes remain secondary under Technical details.
- Batch preview is explicitly read-only and no longer implies that it will mutate settlements.
- Escape closes the drawer and focus returns to the original `Preview repair` link.

## 3. 감사 항목 매핑

### P1 - 해결

- Dead Finance Handoff destination replaced with Finance Overview.
- Queue summary and row scope aligned, including age and repair track.
- Page and metadata renamed to Settlement Repair.
- Blocker remediation made actionable and duplicate technical copy reduced.
- Same-booking repair requests serialized with a PostgreSQL advisory transaction lock; source-version validation remains inside the lock.

### P2 - 해결

- Comparison reduced from seven columns to five operator-facing columns.
- Selection states 0, 1, and 10 are bounded and tested.
- Duplicate drawer close target removed; backdrop is not a keyboard target.
- Batch preview and repair copy distinguish read-only inspection from a write.
- Snake-case policy codes are no longer the primary operator labels.

### P3 - 부분 해결

- Current 66-record browser dry-run completed in about 1.05 seconds.
- The 100-record contract test confirms the current fanout shape: one list query, one count query, and 100 policy previews.
- A bulk policy-preview rewrite was deferred because the observed local workload is responsive and a new bulk path would duplicate sensitive policy logic. The linear fanout remains a scaling risk.

## 4. 변경 파일

- `apps/admin_web/app/finance-closeout/page.tsx`: title, scoped metrics, filters, handoff, and drawer wiring.
- `apps/admin_web/app/finance-closeout/finance-closeout-settlement-backlog-section.tsx`: bounded selection integration.
- `apps/admin_web/app/finance-closeout/finance-closeout-settlement-selection-controls.tsx`: 0-10 client selection controls and live status.
- `apps/admin_web/app/finance-closeout/finance-closeout-settlement-batch-preview-section.tsx`: five-column operator comparison.
- `apps/admin_web/app/finance-closeout/finance-closeout-settlement-dry-run-section.tsx`: read-only safety-check copy and labels.
- `apps/admin_web/app/finance-closeout/finance-closeout-settlement-repair-drawer.tsx`: blocker remediation, one close target, focus-safe router close.
- `apps/admin_web/app/finance-closeout/page.spec.tsx`: UI, metadata, selection, handoff, blocker, and focus regressions.
- `apps/admin_web/app/globals.css`: desktop-only comparison and remediation layout.
- `apps/admin_web/lib/finance-closeout.ts`: queue/batch scope URLs and Finance Overview destination.
- `apps/admin_web/lib/admin-api.ts`: summary scope contract.
- `apps/api/src/admin/admin-settlement.routes.ts`: age/track forwarding.
- `apps/api/src/admin/admin.service.ts`: scoped summary facets and serialized repair transaction.
- `apps/api/src/admin/admin.controller.spec.ts`, `apps/api/src/admin/admin.service.spec.ts`: scope, fanout, parity, and concurrency regressions.

No commit was created.

## 5. 수치 scope 계약

- Queue cards and rows share month, payment status, age, repair track, and search filters.
- Age and track facet counts intersect the active base scope rather than silently switching to global totals.
- `Oldest gap` uses the same active scope as the queue.
- Batch safety totals intentionally omit age and track, use the service's all-gap defaults, and are labeled as broader read-only evaluation totals.
- Active-filter labels avoid redundant `All months` and `All payments` noise when defaults are selected.

## 6. Finance Handoff destination

The old Shift Handoff anchor was removed. The operator action now targets `/finance-overview?range={range}` and legacy `/finance-closeout?view=operations&range=7d` resolves to Finance Overview. The Finance Overview route canonicalizes its default seven-day query.

## 7. 금융 안전

- No settlement repair POST was submitted during browser validation.
- Repair approval validation remains before the write transaction.
- A transaction-scoped PostgreSQL advisory lock serializes repairs for the same booking.
- Preview and source-version checks execute after the lock is acquired, so a second stale concurrent request fails before duplicate writes.
- Canonical approved repair still requires dual approval fields, reason, and booking-ID confirmation.
- Blocked and historical-policy review states do not expose a repair submit action.

## 8. 성능

- 10 selected records: comparison rendered successfully with no page-level horizontal overflow.
- 66 available records: logged-in batch safety check evaluated in approximately 1.05 seconds.
- 100-record synthetic contract: 1 list + 1 count + 100 preview calls; bounded output and call shape are covered by test.
- Decision: do not introduce a second bulk policy engine in this change. Revisit only if production p95 or record volume shows material degradation.

## 9. 자동 테스트

- Admin focused: PASS - 8 files, 51 tests.
- API focused: PASS - 3 files, 11 matched tests; 795 unrelated tests skipped by the name filter.
- `npm.cmd run verify:scope -- -Scope api`: PASS - 161 files passed, 1 skipped; 2,128 tests passed, 1 skipped; Prisma validation, policy checks, typecheck, lint, and build passed.
- `npm.cmd run verify:scope -- -Scope admin`: PASS - 830 files, 4,442 tests; typecheck, lint, query guards, visible-copy guard, and production build passed.
- `git diff --check` for the touched scope: PASS; only existing LF-to-CRLF conversion warnings were emitted.
- Impeccable detector: completed once. Six findings were pre-existing shared `globals.css` side-tab accent warnings outside the Finance Closeout selectors.
- `npm.cmd run verify:local`: SKIPPED. It starts Docker, database seed, Flutter apps, and unrelated web applications; running it against the existing broadly dirty worktree would not provide a safely isolated signal beyond the completed Admin/API scope verification.

## 10. 브라우저 증거

Logged-in validation used 1440 x 900 and covered light and dark themes:

1. `01-default-queue-light-1440x900.png`
2. `02-ten-selected-light-1440x900.png`
3. `03-ten-record-comparison-light-1440x900.png`
4. `04-batch-safety-check-light-1440x900.png`
5. `05-evidence-blocked-drawer-light-1440x900.png`
6. `06-evidence-blocked-queue-dark-1440x900.png`
7. `07-evidence-blocked-drawer-dark-1440x900.png`
8. `08-finance-overview-handoff-dark-1440x900.png`
9. `09-blocker-remediation-dark-1440x900.png`
10. `10-approved-repair-preview-light-1440x900.png`
11. `11-historical-policy-review-drawer-light-1440x900.png`

Evidence folder: `output/finance-closeout-final-remediation-verification-2026-08-10`

Validated states:

- 0, 1, and 10 record selection and the 10-record cap.
- Comparison layout without page-level horizontal overflow.
- Read-only batch safety check.
- Evidence-blocked, canonical approved, and historical policy review drawers.
- Blocker links to payment-fee policy and Partner withholding.
- Escape close and focus return to the original preview link.
- Finance Overview handoff.

Console review found two Next/Turbopack development-only `Performance.measure` negative timestamp messages for FinanceCloseoutPage and FinanceOverviewPage. No business-flow JavaScript error was observed.

## 11. Protected areas touched

This task changed Admin Web files and Admin API route/service code only. It did not change Prisma schema or migrations, authentication, payment mutation modules, settlement domain modules, shared contracts, customer app, or Partner app. The scope verifier reported a protected-files warning because the pre-existing worktree already contains unrelated changes in protected directories; those changes were preserved and not modified by this task.

## 12. 남은 위험

- Production repair writes were not exercised, per the explicit safety constraint.
- Policy preview remains linear in selected batch size. The observed local workload is acceptable, but production p95 is not known.
- The two Turbopack development timing messages remain an environment-level diagnostic concern, not a Finance Closeout flow failure.
- The repository remains broadly dirty, so commit-level isolation and release packaging still require a separate checkpoint process.

## 13. 다음 권장 작업

Run one controlled staging repair for a canonical approved record and verify the resulting settlement rows, ledger effects, source-version rejection on replay, and audit entry before enabling production repair writes.
