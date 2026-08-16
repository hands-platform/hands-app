# Service Catalog remediation report

Date: 2026-08-11  
Route: `/services`  
Status: local implementation complete; staging migration and disposable publish smoke remain release gates

## 1. Outcome

The Service Catalog is now an operator-controlled publication workflow instead of a direct view over every `MassageService` row.

- The default screen shows publication health, language readiness, payout-rule coverage, anomalies, drafts, and the three operational service groups.
- `?dialog=new` and `?dialog=edit&group=...` remain supported.
- Editing happens in one controlled drawer with customer and Partner previews, VND amounts, impact counts, and before/after comparison.
- Draft, publish, hide, and archive are explicit group-level states.
- Customer price and Partner payout are validated together. A payout above the customer price blocks submission in both the UI and API.
- Publishing is atomic across the standard 60/90/120-minute options and guarded by catalog version, mutation key, transaction, and audit evidence.
- Invalid group URLs recover to the catalog instead of rendering a broken editor.

## 2. Root causes and fixes

### Public catalog pollution

Before remediation, the public catalog returned 259 groups and 436 options. The audit identified 256 groups and 426 options as historical smoke/test pollution.

The public read now returns only active, `PUBLISHED`, `OPERATOR`/`SEED` service options with a current safe payout rule. The production-local response after rebuild is:

- HTTP 200
- 3 groups
- 9 options
- 3,577 bytes
- 0 missing EN/VI labels
- 0 payout, fee, commission, or internal finance keys

### Publication and provenance were implicit

`MassageService` now records publication status, provenance, catalog version, idempotent mutation metadata, and publish metadata. A group/duration uniqueness constraint prevents duplicate operational options.

### Pricing was mutable after booking

Each `BookingService` now snapshots the payout rule identifier, customer price, Partner payout, and catalog version at booking time. Earnings use that immutable snapshot. Legacy rows without a verified snapshot fail closed instead of silently applying the latest catalog rule.

### UI did not support safe one-person operation

The editor now provides:

- EN/VI localization inputs and customer/Partner previews
- customer price and Partner payout side by side
- inline and summary validation
- active Partner, custom-price, and nonterminal-booking impact counts
- before/after comparison before publication
- focus trap, Escape close, focus return, and unsaved-change confirmation
- readable full-width comparison table at 1440px

## 3. Phase completion

| Phase | Result |
| --- | --- |
| P0 data trust | Complete locally: publication/provenance, clean public projection, payout snapshot, fail-closed legacy earnings |
| P1 operator workflow | Complete locally: group editor, impact preview, draft/publish/hide/archive, audit receipt links |
| P2 cleanup safety | Complete as tooling and dry-run only: explicit provenance candidates, references force archive, reviewed manifest and confirmation required for apply |

## 4. Database and migration safety

Added migrations:

- `20260811143000_add_service_catalog_publication_and_payout_snapshot`
- `20260811161000_backfill_operational_service_translations`

They were validated and applied only to the confirmed local development database at `localhost:5432/massage_vn`. No shared, staging, or production database was mutated.

The migration adds:

- `ServicePublicationStatus`
- `ServiceCatalogProvenance`
- service publication/provenance/version/mutation fields
- one service per group/duration constraint
- service catalog draft storage
- booking payout snapshot fields and supporting indexes
- EN/VI backfill for the three verified operational groups without replacing existing operator translations

Protected areas changed intentionally:

- `apps/api/prisma/`
- `apps/api/src/bookings/`
- `apps/api/src/earnings/`

The changes are required to make published pricing and later earnings agree. Payment capture, settlement mutation, auth, and unrelated finance policies were not changed.

## 5. Cleanup dry-run

Evidence: `docs/audits/services-remediation-evidence-2026-08-11/cleanup-dry-run.json`

- Candidate source: explicit provenance only
- Candidates: 426
- Planned archive: 426
- Planned delete: 0
- Actual archived: 0
- Actual deleted: 0
- Substring classification in cleanup: false

Apply was deliberately not run. The command requires a reviewed manifest and exact confirmation, and referenced rows are archived rather than deleted.

## 6. Main changed areas

### Admin Web

- `apps/admin_web/app/services/`: catalog page, actions, controlled editor, drawer behavior, notices, tests
- `apps/admin_web/app/globals.css`: scoped catalog table, drawer, responsive, and validation styles
- `apps/admin_web/components/admin-form-controls.tsx`: reusable controlled field support used by the editor
- `apps/admin_web/lib/admin-api.ts`: service catalog Admin API contracts
- `apps/admin_web/lib/service-action-notice.ts`: exact audit-target success receipts
- `apps/admin_web/lib/service-catalog-filters.ts`: URL/filter preservation

### API and persistence

- `apps/api/prisma/schema.prisma` and the two migrations: publication, provenance, drafts, catalog versioning, payout snapshots
- `apps/api/src/services/`: bounded public catalog projection and tests
- `apps/api/src/admin/`: atomic group reads/writes, validation, impact endpoint, audit metadata, tests
- `apps/api/src/bookings/`: payout-rule snapshot at booking creation
- `apps/api/src/earnings/`: snapshot-only earning calculation and fail-closed legacy behavior
- `apps/api/src/providers/providers.service.ts`: Partner service catalog translation mapping

### Mobile and operations tooling

- Customer app service helpers/screens: requested locale -> VI -> EN -> legacy -> stable unavailable fallback
- Partner app service model: VI -> EN -> legacy -> stable Vietnamese unavailable fallback
- `infra/scripts/api-smoke.mjs`: catalog invariant and smoke provenance coverage
- `infra/scripts/service-catalog-cleanup.mjs` and library/tests: guarded dry-run/apply cleanup workflow

## 7. Verification

### Focused tests

- Admin Service Catalog: 7 files, 21 tests passed
- API catalog/input/select contracts: 4 files, 16 tests passed
- Booking and earnings contracts: 3 files, 153 tests passed
- Additional API/Admin focused runs performed during implementation also passed
- Cleanup tool tests: 5 passed

### Scope verification

- API scope: PASS, 167 files passed / 1 skipped; 2,224 tests passed / 1 skipped; policy contracts, typecheck, lint, and build passed
- Customer scope: PASS; analyze passed; 138 tests passed
- Partner scope: PASS; analyze passed; 180 tests passed
- Admin scope: service tests, typecheck, lint, query guards, visible-copy guard, and production build passed; full suite had 2 unrelated failures among 4,519 tests

The two existing Admin failures are:

1. `app/finance-closeout/page.spec.tsx` hard-codes `Oldest: 70d ago`; on 2026-08-11 the rendered result is correctly 71 days.
2. `components/admin-surface-css.spec.tsx` finds an earlier `.admin-notice-card` focus-visible block before the expected shared layout block.

### Other commands

- Admin typecheck: PASS
- API typecheck: PASS
- Admin visible-copy guard: PASS, 1,609 files
- Prisma migration check: PASS, no violations; one pre-existing duplicate timestamp warning
- Admin production build: PASS
- API production build: PASS
- Public web test/typecheck/lint/build: PASS
- `git diff --check`: PASS with line-ending warnings only

### Full local verification

`npm.cmd run verify:local` was attempted and completed with failures outside this Service Catalog scope:

- Operations Policy final-authority markers are out of sync with its current refactor.
- Vietnam scope guard flags Bangkok timezone examples in Tax Policy audit/prompt documents.
- Supabase schema alignment is missing the existing `FINANCE_EVIDENCE` enum value.
- API domain smoke has a pre-existing assertion failure.
- The same two unrelated Admin tests above fail.
- Mobile visible-copy cleanup remains explicitly deferred with 50 existing violations.

All builds, Prisma validation, secret checks, Admin copy checks, API policy coverage, Flutter architecture checks, and both mobile analyze/test suites passed inside the same run.

## 8. Browser verification

Verified in the logged-in in-app browser at 1440x1000 against rebuilt local production servers.

Evidence folder: `docs/audits/services-remediation-evidence-2026-08-11/`

- `05-services-catalog-1440-list.png`: fixed comparison table and catalog health
- `06-add-service-drawer-1440.png`: add-service editor
- `07-payout-above-price-blocked.png`: payout-above-price blocker
- `11-edit-impact-and-publish-1440.png`: impact, before/after, and publish controls
- `12-invalid-service-group-recovery.png`: invalid group recovery
- `13-services-catalog-production-1440.png`: final rebuilt production-mode catalog

Interaction checks:

- Drawer body scrolls independently.
- Shift+Tab wraps focus inside the drawer.
- Escape closes and returns focus to the exact Review link.
- Dirty close opens the native unsaved-change confirmation.
- No catalog mutation was submitted during browser QA.
- Browser console error/warning checks were empty during the main interaction pass.

Stopping the API also removes the Admin permission source, so the nearest failure test reached the existing `Access restricted` shell before the service-specific retry state. The API was restarted and the catalog recovered normally. A service-endpoint-only failure still needs a controlled staging fault or request interception to capture the exact Retry panel.

## 9. Remaining risks and release decision

- A real publish success receipt and public anomaly state were not generated because doing so would require mutating the current catalog or introducing a fault fixture.
- The two migrations must be applied and checked in staging before release.
- A disposable staging catalog should run one create -> draft -> publish -> hide -> archive cycle and verify the linked audit record.
- Existing repository-wide guard failures listed above should be handled separately; they are not caused by the Service Catalog implementation.
- The current dependency audit reports five existing high-severity findings. No broad dependency upgrade or automatic fix was attempted in this scoped change.

Local release hold can be lifted for the Service Catalog implementation. Production release remains gated by staging migration verification and the disposable publish smoke.

## 10. Source control

Not committed. Existing user changes and unrelated untracked files were preserved.
