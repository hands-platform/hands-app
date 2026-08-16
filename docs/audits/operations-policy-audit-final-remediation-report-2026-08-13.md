# Operations Policy Audit Final Remediation

- Implemented: 2026-08-14
- Scope: `/operations-policy?details=audit` and scoped `/audit-log`
- Verdict: **Complete for the requested 1440/1600 desktop contract**
- Safety: no policy save, database mutation, backfill, schema change, migration, or dependency addition

## 1. Result

Operations Policy Audit is now an evidence workspace rather than an isolated recent-change table. The compact source views, Full Audit workspace API, summary, facets, cursor pagination, refresh, CSV, JSON, and selected Evidence drawer all retain the same `Operations/Policy` bucket. The running scoped Full Audit returned 1,325 policy events and the visible result actions were `operational_policy.*`.

## 2. P0 — Scope and evidence reliability

- Added `bucket` to the normalized Audit Log filter contract used by workspace data, saved views, refresh, pagination, CSV, and JSON.
- Added `bucket` to the Admin export proxy allowlist and API export request.
- `Open full audit` now opens `/audit-log?bucket=Operations%2FPolicy&range=all&sort=newest`.
- Added a fixed `Scope: Operations / Policy` context with `Exit policy scope`; `Clear refinements` preserves the bucket.
- Event detail lookup accepts the bucket and refuses an event outside that scope.
- Full Audit and compact rows use the same audit event ID.
- Policy evidence exposes event ID, policy key and target, exact time, actor, source trust, environment, run ID, restoration, reason, before/after, request ID, and correlation ID when recorded.
- Legacy metadata remains `Legacy / unknown · unverified metadata`; reason wording never promotes it to verified automation.

## 3. P1 — Investigation flow and desktop layout

- Replaced inline `<details>` with a unique `Evidence` link to the existing Full Audit drawer.
- Canonical policy definition label/category is preferred over raw-key wording.
- Added bounded cursor history with `First page`, `Newer records`, and `Older records`; page 3 and return to page 2/page 1 were verified with live data.
- Source changes reset cursor/history. Invalid cursor input falls back safely to page 1.
- Active workspace and source use `aria-current`, active class, border/underline, weight, and theme tokens.
- At 1440px the columns measure `148 / 240 / 200 / 190 / 240 / 104` px. Rows measure `106–107px`; no native details remain.
- The table alone owns the required horizontal scroll at 1440px. The Evidence column is sticky, while the page itself has no horizontal overflow.
- Exact source empty states and API access/error states remain distinct.

## 4. Changed areas

- `apps/admin_web/app/operations-policy/*audit*`, page model/page specs: source views, evidence links, cursor history, canonical labels, error/empty states.
- `apps/admin_web/app/audit-log/page-content.tsx`, drawer and specs: fixed scope propagation, scope UI, policy evidence.
- `apps/admin_web/app/api/admin/audit-log/export/*`: export bucket forwarding.
- `apps/admin_web/app/globals.css`: desktop table density, active state, sticky Evidence action.
- `apps/admin_web/lib/admin-api.ts`: canonical policy definition contract.
- `apps/api/src/admin/admin-governance.routes.ts`, `admin.service.ts` and spec: scoped export/detail and canonical projection.

## 5. Verification

### Passed

- Admin focused Vitest: 8 files, 55 tests.
- API focused Vitest: 1 file, 3 tests passed, 662 skipped by test-name filter.
- Admin Web typecheck.
- API typecheck.
- `policy:admin-consistency`: PASS, 28 definitions and lifecycle consumers aligned.
- `git diff --check`: no whitespace errors; only existing CRLF conversion warnings.
- Browser: 1440×1000 light/dark and 1600×1000 light; console warnings/errors: 0/0.
- Live services: API health 200 and Admin 200 after production rebuild.

### Scope verification limitation

`verify:scope -- -Scope admin` and `verify:scope -- -Scope api` both reached a pre-existing unrelated API suite failure in push campaign receipt persistence: `keeps a consumed campaign queued when only post-enqueue receipt persistence fails`. Expected Prisma `include.recipients`; current unrelated implementation returns `select`. The API run otherwise reported 174 passed files, 4 skipped files, 2,401 passed tests, and 11 skipped tests. This remediation does not touch that notification campaign behavior.

## 6. Browser evidence

1. `01-operator-audit-empty-1440x1000-light.png`
2. `02-automated-smoke-empty-1440x1000-light.png`
3. `03-legacy-audit-first-page-1440x1000-light.png`
4. `04-legacy-audit-older-page-1440x1000-light.png`
5. `05-full-audit-policy-scope-1440x1000-light.png`
6. `06-full-audit-evidence-drawer-1440x1000-light.png`
7. `07-legacy-audit-1600x1000-light.png`
8. `08-legacy-audit-1440x1000-dark.png`
9. `browser-metrics.json`

Evidence directory: `docs/audits/operations-policy-audit-final-remediation-evidence-2026-08-13/`

## 7. Worktree preservation

The repository was already extensively dirty before this task. Existing modified and untracked files were preserved; no reset, checkout, stash, clean, commit, or unrelated formatting was performed. No protected database, auth, payment, wallet, booking, settlement, or deployment contract was changed by this remediation.

## 8. Remaining risk

The local dataset contains zero authenticated operator rows and zero server-verified automated smoke rows, so those live states were validated as true-empty states. Populated operator/automated rows, permission denial, invalid cursor, and API failure are covered by focused regression tests without mutating policy or shared data. The unrelated push campaign test remains the only known scope-gate blocker.
