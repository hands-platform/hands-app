# Customer Usage remediation implementation report

- Date: 2026-08-13 ICT
- Target: `/usage-overview`
- Repository: `C:\dev\massage-on-demand-vn`
- Launch verdict: **HOLD · 88/100**
- Reason: the code now fails closed and exposes source health correctly, but 2,961 existing bookings still require provenance review and no recent production usage aggregate is available.
- Commit: Not committed

## 1. Outcome

The reporting contract is now split into two independently trustworthy sources.

- Booking records are included only when server-owned `metadata.dataOrigin=PRODUCTION` is present and linked fixture ownership does not contradict it.
- Usage telemetry retains its separate production-origin and freshness contract.
- Unknown or failed usage telemetry renders as `— / Data unavailable`, not as customer activity `0`.
- Unknown booking provenance is excluded from production metrics and disclosed as an incomplete source.
- A page can remain operational in a booking-only degraded state instead of hiding all activity behind a generic empty state.

The screen now answers these questions in order:

1. What period is applied?
2. Which source is usable or incomplete?
3. Which customer queue needs action now?
4. What booking activity and outcomes occurred independently of usage telemetry?

## 2. Requirement status

| Requirement | Status | Evidence |
| --- | --- | --- |
| Booking aggregation contract | Complete | Created, preferred request, and closed-completion trend series are separate and share the period/provenance helpers. |
| Booking provenance contract | Code complete, rollout partial | New bookings receive server-owned production metadata. Existing unknown records fail closed. Dry-run produced a review manifest; no write was applied. |
| Usage freshness release gate | UI/API complete, production E2E blocked | Unknown freshness is rendered unavailable. The local smoke could not authenticate because the admin operator is revoked, and no recent production aggregate exists. |
| Custom range consistency | Complete | Bare Custom canonicalizes to a valid previous-six-days-through-today ICT range. Invalid or reversed input remains visible with field errors. |
| Customer ranking | Complete | Usage ranking requires at least one production usage event; zero-event booking-only customers cannot become usage rank #1. |
| Needs-attention parity | Complete | Queue and destination share verified-production predicate and joined-date range. Destination rows disclose excluded non-production/unverified history. |
| Desktop information density | Complete | Data health is compact, Needs attention is visible in the first 1600×1000 viewport, and 1440/1600 layouts have no page-level horizontal overflow. |
| Performance budget | Partial | Local production-build navigation returned in 544 ms, while operational content became detectable in 3,143 ms. No production-like p50/p95 dataset was available, so the 2-second full-analysis target is not claimed. |
| Accessibility hardening | Partial | Semantic headings, status regions, links, disclosures, exact chart tables, visible focus patterns, and keyboard-operated controls remain. NVDA/JAWS and Windows High Contrast were not executed. |

## 3. Data contract changes

### 3.1 Booking activity

The former ambiguous booking-request trend was split into:

- `createdBookingCount`: verified production bookings whose `createdAt` is in the applied period.
- `preferredRequestCount`: the subset with a preferred Partner, also grouped by `createdAt`.
- `completedBookingCount`: verified production bookings whose `closedAt` is in the applied period and status is completed.

The UI uses the exact labels below in chart legend and exact data rows:

- `Bookings created`
- `Preferred Partner requests`
- `Completed during period`

Booking outcomes remain a created-period cohort reconciled by current status. The page explains that completed trend activity uses `closedAt`; it does not force these two different populations to match.

### 3.2 Production provenance

Strategy A was selected because the existing JSON metadata can support a fail-closed server-owned contract without a schema migration.

- Booking creation now writes `dataOrigin: PRODUCTION` on the server.
- Client input does not choose the production marker.
- A shared verified-production predicate is reused by Usage Overview and the customer action queue.
- Explicit fixture markers, synthetic origin, and fixture-linked customer/Partner owners are excluded.
- Missing origin is `UNKNOWN`, never silently promoted to production.
- Names or IDs containing Demo/Smoke are heuristic evidence only in the review manifest and never production authority.

### 3.3 Usage freshness

The API and screen distinguish source state instead of treating absent collection as a measured zero.

- Usage telemetry: fresh, delayed, unknown, or failed.
- Usage provenance: production verified or incomplete.
- Booking records: verified or incomplete with excluded unknown count.
- Report generated time is independent of source event time.

When usage is unknown or failed, usage-derived reach, retention, ranking, and current-base activity values render unavailable. Booking-derived outcomes and trend activity remain visible.

## 4. Provenance dry-run

Command behavior is read-only by default. `--apply` intentionally rejects because this implementation does not contain a shared-database write path.

| Classification | Count |
| --- | ---: |
| KEEP_PRODUCTION | 0 |
| MARK_SYNTHETIC | 19 |
| REVIEW_UNKNOWN | 2,961 |
| CONFLICT | 0 |
| Total | 2,980 |

- Apply enabled: `false`
- Database writes: `0`
- Manifest digest: `8d7bb8fd15fc0abbef5e330aeb1acf99e43c9e27b8c589dc1c78ca2480d67af8`
- Manifest: `output/usage-overview-improvement-verification-2026-08-13/booking-provenance-dry-run.json`
- Apply attempt: performed only to verify rejection; the command stopped before any mutation.

The 2,961 unknown rows need an owner-reviewed evidence rule or approved exception list. Automatically marking them production would recreate the original reporting defect.

## 5. Usage pipeline status

- `app-usage:backfill:test`: passed, 5 tests.
- `app-usage:retention:check`: passed in dry-run mode; zero candidates and no mutation.
- `app-usage:smoke`: failed with HTTP 403 because the local Admin operator is revoked.
- Smoke cleanup confirmed zero residual smoke events and sessions.
- Current UI state: `Usage telemetry · Data unavailable · No production aggregate timestamp`.
- Release gate remains open: a real production event must reach daily aggregate, Admin API, and UI with a timestamp no older than 48 hours.

No fake event, timestamp, or synthetic aggregate was promoted to production.

## 6. UI and operator flow

- The range, applied ICT dates, comparison, generated time, and source health are grouped near the top.
- Needs attention precedes analysis and shows a complete action in the first desktop viewport.
- Queue wording is now `New customers without a verified production booking`.
- Destination rows say `No verified production booking` and separately disclose excluded non-production/unverified records.
- `Most active customers · Top 5` contains only customers with production usage events.
- Chart empty state requires all usage and all three booking series to be zero.
- Booking-only data stays visible while telemetry is unavailable.
- Data-health cards collapse from four columns to two at narrower desktop widths and do not force page overflow.

## 7. Changed files

### API and domain contract

- `apps/api/src/admin/admin-booking-list-query.ts`: canonical production and unknown booking predicates.
- `apps/api/src/admin/admin-usage-overview-query.ts`: source provenance, freshness, separate booking series, ranking exclusion, and shared predicates.
- `apps/api/src/admin/admin.service.ts`: verified-production customer queue and fixture-owner exclusion.
- `apps/api/src/bookings/bookings.matching-policy.ts`: server-owned production metadata on new booking creation.
- Corresponding API specs: aggregation, fail-closed provenance, queue parity, and creation metadata regression coverage.

### Admin Web

- `apps/admin_web/app/usage-overview/page.tsx`: compact health/action structure and unavailable-versus-zero rendering.
- `apps/admin_web/app/usage-overview/usage-overview-model.ts`: canonical Custom range and source-aware view model.
- `apps/admin_web/app/usage-overview/usage-overview-trend-chart.tsx`: three booking series and booking-only degraded behavior.
- `apps/admin_web/app/customers/customers-table-section.tsx`: queue-row production wording and excluded-history evidence.
- `apps/admin_web/lib/admin-api.ts`: response contract types.
- `apps/admin_web/app/globals.css`: Usage Overview data-health responsive layout.
- Corresponding Admin specs: custom, degraded states, chart labels, ranking, queue link, and destination rows.

### Safe data tooling

- `infra/scripts/lib/booking-provenance-classifier.mjs`
- `infra/scripts/booking-provenance-dry-run.mjs`
- `infra/scripts/booking-provenance-dry-run.test.mjs`

The repository already contained large user changes in `globals.css`, `admin.service.ts`, `admin-api.ts`, and their specs. This work changed only the Usage-related selectors, predicates, types, and assertions; unrelated dirty changes were preserved.

## 8. Verification

### Focused checks

| Command | Result |
| --- | --- |
| Admin focused tests for Usage Overview and customer queue | PASS · 49/49 |
| API focused tests for Usage Overview, provenance, queue, matching metadata | PASS · 24 selected tests; 648 skipped by test-name filter |
| Matching-policy focused spec | PASS · 4/4 |
| Provenance dry-run tests | PASS · 4/4 |
| Admin typecheck | PASS |
| API typecheck | PASS |
| Focused Admin/API ESLint | PASS |
| Prisma migration check | PASS · 93 migrations, no migration added |
| `git diff --check` for target files | PASS · line-ending warnings only |

### Scope checks

- API scope: PASS, including 172 test files passed, 2 skipped; 2,347 tests passed, 6 skipped; typecheck, lint, and build passed.
- Admin scope: typecheck, lint, guards, and build passed. Full Admin test gate failed on three pre-existing unrelated contracts:
  - shared notice CSS rhythm
  - finance operator navigation visibility
  - settlement repair oldest-age fixture expectation

### Full local verification

`npm.cmd run verify:local` was attempted and completed with an overall failure caused by repository-wide existing gates.

Passed items include:

- API/Admin/Public Web typecheck/build as applicable.
- Public Web tests and lint.
- Customer Flutter analyze and 138 tests.
- Partner Flutter analyze and tests.
- secret, Admin-sensitive, notification, realtime, FCM, policy-coverage, architecture, Prisma validation, and Docker compose guards.

Unrelated blockers include:

- setup-doctor copy/authority prerequisites in Operations Policy.
- final-authority markers across existing Admin pages.
- Vietnam scope warnings in existing audit documents.
- API domain smoke assertion outside Usage Overview.
- Supabase `FilePurpose.FINANCE_EVIDENCE` alignment.
- the same three Admin tests listed above.

### Impeccable detector

The detector was run once after UI work. It reported six existing global CSS side-border patterns outside the Usage Overview selectors. No new Usage Overview-specific issue was reported. These unrelated global patterns were not rewritten.

## 9. Browser verification

Production-mode local Admin was rebuilt and opened with the existing authenticated browser session.

Verified:

- 7-day and Today reports.
- canonical bare Custom URL with valid ICT dates and no contradictory error.
- usage-unavailable plus booking-source-independent rendering.
- source activity disclosure.
- Needs-attention destination, three-row parity, filter chip, and excluded-history copy.
- light and dark information parity.
- 1440×900 and 1600×1000 with no page-level horizontal overflow.
- no browser console log entries after the final navigation.

Measured on the local production build at 1600×1000:

- 30-day navigation return: 544 ms.
- operational content detection: 3,143 ms.
- This is a single local observation, not a production p50/p95 claim.

Evidence:

- `output/usage-overview-improvement-verification-2026-08-13/after/01-7d-1600x1000-full.png`
- `output/usage-overview-improvement-verification-2026-08-13/after/02-7d-1600x1000-first-viewport.png`
- `output/usage-overview-improvement-verification-2026-08-13/after/03-today-1600x1000-full.png`
- `output/usage-overview-improvement-verification-2026-08-13/after/04-queue-customers-1600x1000-full.png`
- `output/usage-overview-improvement-verification-2026-08-13/after/05-7d-1440x1000-light.png`
- `output/usage-overview-improvement-verification-2026-08-13/after/06-7d-1440x1000-dark.png`
- `output/usage-overview-improvement-verification-2026-08-13/after/07-final-7d-1440x900-light.png`
- `output/usage-overview-improvement-verification-2026-08-13/after/08-source-activity-times-1440x900.png`
- `output/usage-overview-improvement-verification-2026-08-13/after/10-final-7d-1600x1000-light.png`

The pre-change visual baseline remains the adopted audit evidence under `docs/audits/usage-overview-final-reaudit-evidence-2026-08-12`. A separate local before image was not persisted, so this report does not claim one.

## 10. Protected areas and remaining risk

Protected booking creation logic was changed only to add server-owned production provenance. No booking state transition, payment, matching selection, wallet, auth, Prisma schema, migration, or shared database record was changed. API scope verification passed.

Remaining release blockers:

1. An operator must review the 2,961 unknown booking records and approve a classification manifest or exception policy.
2. Only after explicit approval should a separate checksum-bound backfill tool gain a write path and be applied to the intended environment.
3. The usage pipeline needs a valid Admin operator and one real production event-to-aggregate-to-UI verification within 48 hours.
4. Production-like p50/p95 measurement and NVDA/JAWS/High Contrast validation remain unverified.
5. Repository-wide existing verification failures should be repaired independently; they are not caused by this Usage Overview work.

## 11. Final decision

The screen is materially safer and more operable than the 79/100 audit baseline. Code readiness is approximately 94/100, but release readiness is **88/100 and HOLD** because the two source-of-truth rollout gates are not complete. Launch should resume only after approved booking provenance classification and a fresh production usage aggregate E2E.
