# General Ledger remediation verification

Verified on 2026-08-10 against the local HANDS Admin and API.

## Implemented contract

- The legacy `/finance-tax/general-ledger` route is retained and presented as **Journal Batches**.
- List, summary, detail, monthly-close gating, and bounded CSV export reuse one server-side journal integrity evaluation.
- Integrity states are `CLEAR`, `BLOCKED`, and `UNKNOWN`; unavailable evidence is never rendered as zero discrepancy.
- Posted batches are blocked when header totals, entry totals, required formula evidence, or accounting-period evidence disagree.
- List requests remain bounded and detail requests load entry evidence only for the selected batch.
- Search, range, source, period, review, and sort filters are URL-addressable. Detail navigation preserves the filtered return context.
- CSV export applies the same filters and integrity state, is bounded, and returns `no-store` attachment responses.

## Read-only data audit

- Rows inspected: 472 across 5 bounded pages.
- `CLEAR`: 441.
- `BLOCKED`: 31.
- `UNKNOWN`: 0.
- Blocker counts: `HEADER_ENTRY_MISMATCH` 30, `POSTED_WITHOUT_ENTRIES` 29, `FORMULA_DELTA` 26.
- Largest maximum discrepancy: 400,000 VND on `cmr3a1fxp0o1tvyjg8rj5fy6y`.
- Oldest blocker: `seed-finance-smoke-journal-batch`, posted 2026-07-01.
- No mutation, repair, reseed, or CSV distribution was performed.

See `read-only-journal-integrity-audit.md` for the audit detail.

## Automated verification

- Focused API journal tests: 22 passed.
- Focused Admin journal tests: 124 passed.
- Ledger controller tests: 3 passed.
- Monthly-close integrity tests: 6 passed.
- Finance list/model tests: 68 passed.
- Admin scope verification: PASS, including tests, typecheck, lint, query guards, visible-copy guard, API budget, and production build.
- API scope verification: PASS, including 2,146 passed tests and 1 skipped test, typecheck, lint, policy/contracts, Prisma validation, and production build.
- Scoped `git diff --check`: PASS; only repository line-ending notices were emitted.

Logs:

- `verify-scope-admin.log`
- `verify-scope-api-final.log`
- `browser-console-current.log` (`0` errors, `0` warnings)

## Browser verification

Verified with an authenticated local browser at 1440 x 900:

- Needs-action and all-record queues.
- All-dates and Posted filters.
- Exact source-key search, clear search, and true empty search.
- Blocked journal detail and entry-level debit/credit evidence.
- Back-to-results filter preservation.
- Keyboard access to Related finance.
- Light and dark themes.
- Filter-preserving bounded CSV response.

Screenshots are stored in this directory as `01-after-needs-action-1440x900.png` through `10-after-dark-mode-1440x900.png`.

## Boundaries

- No database schema or migration was added.
- No journal, settlement, payment, or bank record was mutated.
- Existing unrelated worktree changes were preserved.
- No commit or deployment was created.
