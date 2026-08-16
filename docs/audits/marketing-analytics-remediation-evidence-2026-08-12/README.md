# Marketing Analytics remediation evidence

Date: 2026-08-12  
Route: `/marketing-analytics`  
Verdict: **RELEASE HOLD**

## Browser evidence

| Evidence | Viewport | State verified |
| --- | --- | --- |
| `01-overview-1440x1000.png` | 1440 x 1000 | Overview, decision readiness, exact action count, tracked entrants |
| `02-campaigns-spend-1440x1000.png` | 1440 x 1000 | Campaigns & spend, incomplete spend coverage, ledger empty state |
| `03-campaigns-spend-1600x1000.png` | 1600 x 1000 | Wide desktop spend workspace and responsive layout |
| `04-attribution-1600x1000.png` | 1600 x 1000 | Attribution quality and platform/source scope |
| `05-coupons-1600x1000.png` | 1600 x 1000 | Coupons-only workspace and valid generated timestamp |

Authenticated local browser checks used read-only navigation. No spend, coupon, or customer data was changed. The spend form was inspected but not submitted.

## Observed local data

- Decision readiness: `INSUFFICIENT`.
- Manual spend evidence: 0 of 7 expected days recorded; 7 days missing.
- Action summary: 2 total, 2 visible, 0 hidden.
- Overview and Attribution use `Tracked entrants`; the old first-open wording is not presented as a stronger attribution claim.
- Coupons does not render campaign/source controls that do not apply to that workspace.
- No page-level horizontal overflow was observed at 1440 or 1600 pixels.
- Final browser console check: 0 errors, 0 warnings.

## Safety notes

- Production/shared database migrations were not applied.
- No external marketing API was called.
- No browser write operation was performed.
- Existing working-tree changes were preserved.
- The permission migration must be applied in a controlled environment before release.

## Verification summary

- Marketing Admin focused tests: 32 passed.
- Marketing API helper tests: 22 passed.
- Marketing service tests: 9 passed.
- Marketing controller tests: 8 passed.
- API full suite: 2,332 passed, 5 skipped; 0 failed.
- API and Admin typecheck, lint, and build: passed.
- Prisma migration manifest check: passed, 93 migrations, 0 violations.
- Admin full suite: 4,534 passed, 1 skipped, 3 unrelated failures.
- Scope and local verification were attempted and remain red because of repository-wide pre-existing contracts documented in the remediation report.

## Impeccable detector

Command:

```powershell
node C:\Users\laboy\.codex\skills\impeccable\scripts\detect.mjs --json apps/admin_web/app/marketing-analytics apps/admin_web/app/globals.css
```

Result: 6 side-border warnings, all in unrelated shared `globals.css` selectors (`vietnam-map-cluster-operator-read`, `service-catalog-health-fact`, `timeline-step`, `dispatch-step-card`, `ops-check-item`, and `booking-unified-info-card`). No finding pointed to the Marketing Analytics components or its scoped selectors. These unrelated surfaces were not modified.

