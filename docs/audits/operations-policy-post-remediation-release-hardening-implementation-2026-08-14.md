# Operations Policy post-remediation release hardening

Date: 2026-08-14  
Route: `http://localhost:3101/operations-policy`  
Result: **COMPLETE for the requested Operations Policy scope.** The latest production build is running on port 3101 and the non-destructive browser matrix passed. Repository-wide scope verification still reports unrelated pre-existing failures listed below.

## One-line conclusion

Operations Policy now separates policy state, lifecycle, provenance, supply diagnostics, and audit evidence; uses source-bound opaque pagination; protects unsaved editor work across all internal navigation; and links Full Audit to the same `Operations/Policy` action scope used by the screen and API.

## P0 changes

### Full Audit scope and evidence integrity

- `Open full audit` now carries `bucket=Operations/Policy`, `range=all`, and `sort=newest`.
- The screen, Admin proxy, API audit query, and exact event drawer use the same policy action predicate: `operational_policy.update`.
- Compact audit rows link to an exact event URL, not a broad bucket-only result.
- Each row exposes when, policy and actor, before-to-after value, and evidence action in a four-column desktop layout.
- Operator, verified smoke, and legacy/unknown sources have distinct filters and source-specific empty states.
- Opaque cursors are base64url JSON containing both `id` and `source`; malformed or cross-source cursors fail closed to the first page.

### Full Audit data flow

Before:

```text
Operations Policy link
  -> bucket label could be normalized without preserving exact policy scope
  -> generic audit query/export path
  -> unrelated Operations events could be shown as policy evidence
```

After:

```text
/operations-policy?details=audit
  -> /audit-log?bucket=Operations%2FPolicy&range=all&sort=newest
  -> normalized Admin query keeps Operations/Policy
  -> Admin API/proxy forwards the same bucket and exact event when present
  -> API where clause requires action = operational_policy.update
  -> screen rows, exact event drawer, and export upstream use the same scope
```

The focused Admin tests cover link construction, normalization, proxy forwarding, screen rows, and export scope. The API tests cover the action predicate and source-bound cursor behavior. In the browser, the scoped Full Audit showed only `operational_policy.update` rows and the evidence drawer event ID matched the compact row.

### Provenance trust

- Saved rows are no longer presented as current baseline deviations.
- The command strip separates `Current deviations` from `Saved values`.
- Saved values are split into `Operator`, `Smoke`, and `Legacy/unknown` provenance counts.
- A final consistency defect was fixed: a saved audit without trusted `metadata.source` is now classified as `legacy_unknown` in both settings and audit views, rather than operator in one view and legacy in another.
- The current production data reads: `Saved values 6 · Operator 0 · Smoke 0 · Legacy/unknown 6`.

## P1 changes

### Lifecycle and operating copy

- Lifecycle filtering supports Live, Locked, Planned, Deprecated, and Unknown while preserving deep links.
- Direct Locked and Planned policy URLs are read-only and explain why editing is unavailable.
- `Live · aligned` is now `Live · baseline aligned`.
- Help text states that the saved/current value matches the launch baseline and does not claim that live Partner supply is verified.

### Shift SLA impact

- All seven Start Shift SLA policies have explicit impact definitions instead of a generic live-policy fallback.
- Each impact identifies the authoritative queue/action route, overdue transition, and runtime behavior.
- Copy states that existing record timestamps are not rewritten and that reclassification occurs on the next Start Shift/read.
- The consistency tests fail if a live Start Shift SLA falls back to generic impact copy.

### Editor safety

- All same-origin internal navigation is guarded while the policy form is dirty.
- Coverage includes policy-to-policy navigation, workspace navigation, Close, browser Back, and Shift Command.
- Cancel keeps the current policy and draft. Accept navigates and resets to the target's canonical state.
- A confirmed internal navigation bypasses a duplicate `beforeunload` prompt.
- Browser Back cancel restores the temporary draft after the Next.js remount and removes the temporary session value.
- Pending saves remain guarded; save success/error cleanup is covered by component contracts.
- High-risk acknowledgement and reason validation were tested only up to Save enablement. No policy save or revert was submitted.

## P2 changes

### Workspace and audit density

- Policies, Supply, Simulation, and Audit are compact, URL-addressable workspace tabs.
- The first 1440px viewport shows the command strip, filters, and first two SLA rows.
- The audit table uses four readable columns and unique action/evidence affordances.
- Light/dark active states and 1440/1920 layouts were checked without page-level horizontal overflow.

### Supply and Simulation

- Supply keeps blocked/no-eligible and Demo reference warnings visible.
- Expanded sensitivity rows focus on Eligible, Visible, Held, Excluded stale, and Delta versus current.
- All 0-to-0 scenarios collapse to `No scenario produces eligible supply`.
- Simulation is labelled `Read-only, no-write preview`.
- Small samples show a confidence warning; blocked live data is not presented as successful supply.
- Ready, same-value, and changed-value simulation paths are covered by fixtures/tests without runtime writes.

## Primary changed files and symbols

- `apps/api/src/admin/admin.service.ts`
  - operational policy settings audit provenance
  - `listOperationalPolicyAudit`
  - source-bound cursor parsing and stable ordering
  - `findRecentAuditLogsByTargets`
- `apps/api/src/admin/admin.service.spec.ts`
  - action scope, source metadata, legacy fallback, and cursor regressions
- `apps/admin_web/app/operations-policy/page.tsx`
  - workspace navigation, command strip, provenance/lifecycle presentation
- `apps/admin_web/app/operations-policy/operations-policy-page-model.ts`
  - safe query and opaque cursor normalization
- `apps/admin_web/app/operations-policy/operations-policy-groups.ts`
  - lifecycle and provenance aggregation
- `apps/admin_web/app/operations-policy/operations-policy-audit-trail-section.tsx`
  - four-column evidence table and source-aware pagination/empty states
- `apps/admin_web/app/operations-policy/operations-policy-form.tsx`
  - dirty navigation guard, one-confirm navigation, Back draft restoration
- `apps/admin_web/app/operations-policy/policy-impact-details.ts`
  - explicit seven-lane Start Shift SLA impact contracts
- `apps/admin_web/app/operations-policy/policy-supply-sensitivity.ts`
  - eligible/visible/held/stale/delta scenario model
- `apps/admin_web/app/operations-policy/operations-policy-sensitivity-preview-section.tsx`
  - concise sensitivity table and all-zero collapse
- `apps/admin_web/app/operations-policy/operations-policy-live-simulator-section.tsx`
  - read-only/no-write and sample confidence copy
- `apps/admin_web/app/operations-policy/actions.ts`
  - exact scoped audit evidence URL after a successful update
- `apps/admin_web/app/globals.css`
  - compact workspace, command/filter layout, audit columns, and theme states
- Adjacent `*.spec.ts` and `*.spec.tsx` files provide the corresponding regression coverage.

## Verification commands

| Command | Result |
| --- | --- |
| `npm.cmd run test --workspace @massage-vn/admin-web -- app/operations-policy` | PASS · 45 files / 173 tests |
| `npm.cmd run test --workspace @massage-vn/admin-web -- app/operations-policy app/audit-log app/api/admin/audit-log` | PASS · 53 files / 208 tests |
| `npm.cmd run test --workspace @massage-vn/api -- src/admin/admin.service.spec.ts -t "operational policy\|Operations/Policy"` | PASS · 9 tests |
| `npm.cmd run test --workspace @massage-vn/api -- src/admin/admin-operational-policy-audit-source.spec.ts src/matching/matching.policy.spec.ts` | PASS · 2 files / 19 tests |
| `npm.cmd run policy:admin-consistency` | PASS · 28 definitions; lifecycle 19 live / 2 locked / 7 planned |
| Admin Web typecheck | PASS |
| API typecheck | PASS |
| Focused Admin ESLint | PASS |
| Focused API ESLint | PASS |
| Admin production build | PASS |
| `npm.cmd run verify:scope -- -Scope api` | FAIL outside scope · push campaign receipt test expects `include.recipients` while current implementation uses `select` |
| `npm.cmd run verify:scope -- -Scope admin` | FAIL outside scope · existing failures in `admin-surface-css.spec.tsx`, `admin-navigation.spec.ts`, and `finance-closeout/page.spec.tsx` |
| `npm.cmd run verify:local` | SKIPPED because the two scope commands already expose the unrelated repository-wide failures above |

No focused or in-scope failure remains.

## Latest production runtime evidence

- HEAD: `406d16a7919c500f7b098f98bd43e83b0cad3c35`
- Dirty worktree: yes, existing user changes preserved
- Admin BUILD_ID: `3Zw8P8aCAcnCu1VdYNJgX`
- BUILD_ID time: `2026-08-14T23:42:48.8473277+07:00`
- Latest relevant source time: `2026-08-14T23:36:55.4854279+07:00`
- Port 3101 listener: Node PID `31208`
- Listener start: `2026-08-14T23:42:50.6890688+07:00`
- Server mode/port: production / 3101
- API and Admin health: reachable; Admin HTTP 200; API health HTTP 200

Both BUILD_ID creation and the 3101 listener start are later than the latest relevant source change.

## Browser verification matrix

All checks used the logged-in local Admin session and made no server mutation.

| Check | Result |
| --- | --- |
| 1440x1000 light · command strip and first two SLA rows | PASS |
| Lifecycle Live/Locked/Planned filters and deep links | PASS |
| Normal editor and representative SLA impact | PASS |
| High-risk editor validation through Save enablement, not submitted | PASS |
| Locked/Planned direct URL read-only state | PASS |
| Dirty policy-to-policy Cancel/Accept | PASS |
| Dirty workspace/Close/Shift Command Cancel/Accept | PASS |
| Dirty browser Back Cancel/Accept and draft restoration | PASS |
| Supply blocked/default and expanded diagnostics | PASS |
| Simulation blocked/read-only state | PASS |
| Operator/smoke/legacy source filters and exact empty copy | PASS |
| Legacy first/older/newer/first cursor round trip | PASS |
| Scoped Full Audit query, row action type, exact event drawer | PASS |
| 1440 dark active states and audit table | PASS |
| 1920x1080 light editor breakpoint | PASS |
| Page horizontal overflow at 1440 and 1920 | PASS · none |
| Console error/warning and operational request failures | PASS · none observed in the validation session |

## Screenshot evidence

Folder: `docs/audits/operations-policy-post-remediation-release-hardening-evidence-2026-08-14/`

1. `01-policies-light-1440x1000.png`
2. `02-lifecycle-locked-light-1440x1000.png`
3. `03-sla-editor-light-1440x1000.png`
4. `04-high-risk-editor-light-1440x1000.png`
5. `05-supply-blocked-light-1440x1000.png`
6. `06-supply-expanded-light-1440x1000.png`
7. `07-simulation-light-1440x1000.png`
8. `08-audit-operator-empty-light-1440x1000.png`
9. `09-audit-legacy-page-1-light-1440x1000.png`
10. `10-full-audit-policy-scope-light-1440x1000.png`
11. `11-audit-dark-1440x1000.png`
12. `12-sla-editor-light-1920x1080.png`
13. `13-policies-provenance-final-light-1440x1000.png`

## Protected areas and data safety

- No Prisma schema, migration, auth, payment, wallet, booking, settlement, or matching mutation behavior was changed by this task.
- The API change is limited to Admin read/audit provenance and pagination behavior plus tests.
- No real policy update, revert, export download, or operational data mutation was performed during browser validation.
- No dependency was added.
- No commit or push was created.

## Existing user changes

The worktree was already heavily modified. All unrelated tracked and untracked user changes were preserved. No reset, checkout, broad formatting, cleanup, or unrelated deletion was performed.

## Remaining limitations

- Current records lack trusted source metadata, so they are correctly labelled `Legacy/unknown`; they cannot be retroactively attributed to an operator without authoritative evidence.
- Repository-wide Admin/API verification remains red only for the unrelated tests listed above.
- Browser validation did not download an export because it may contain sensitive audit data; the export filter contract is covered by focused tests and the upstream href/query was verified.

## Dead-module appendix

No dead module was removed in this critical diff. Production import tracing found `operations-policy-recommended-value-review-section.tsx` and `policy-recommendation-review.ts` referenced only by their isolated tests, not by `page.tsx`; removing them would also require deleting or replacing those specs and confirming no planned workspace depends on them. `policy-simulation.ts` was already deleted in the pre-existing dirty worktree and was not changed or cleaned up by this task. Any deletion should remain a separate approved cleanup.
