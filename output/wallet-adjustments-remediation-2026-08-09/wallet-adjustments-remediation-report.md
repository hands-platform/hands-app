# Wallet Adjustments remediation report

Date: 2026-08-09

## Result

`/wallet-adjustments` now separates immutable executed records, approval requests, and maker-only request preparation into URL-addressable views. Only the active view loads its data. Search and preview use POST-backed local state, and wallet owner, amount, reason, and evidence values are not written to the browser URL.

No wallet-changing request, approval, reversal, or ledger mutation was executed during browser verification. The browser stopped at the safe preview state.

## Server policy

The API now owns a deny-by-default allowlist shared by preview and request creation.

| Wallet owner | Direction | Allowed adjustment reasons |
| --- | --- | --- |
| Customer | Credit | Promotion credit, Customer compensation, Referral correction, Error correction |
| Customer | Debit | Referral correction, Error correction |
| Partner | Credit | Partner compensation, Partner bonus, Referral correction, Error correction, Receivable write-off |
| Partner | Debit | Referral correction, Error correction, Penalty |

Explicit denials use stable codes:

- `WALLET_ADJUSTMENT_COMBINATION_NOT_ALLOWED`
- `WALLET_ADJUSTMENT_REVERSAL_SOURCE_REQUIRED`
- `WALLET_ADJUSTMENT_SETTLEMENT_ROUTE_REQUIRED`

Cash booking deductions remain settlement-only. Manual reversals require an executed source request, the exact original amount, and the opposite direction. High-value requests and receivable write-offs retain evidence requirements.

## Implementation

### API

- `apps/api/src/wallet-adjustments/manual-wallet-adjustment-policy.ts`: canonical policy, limits, and denial codes.
- `apps/api/src/wallet-adjustments/wallet-adjustments.accounting.ts`: accounting mapping guarded by the same policy.
- `apps/api/src/admin/admin.service.ts`: identical preview/create validation and source-bound reversal validation.
- `apps/api/src/admin/admin-wallet.routes.ts`: policy and single-request read endpoints.
- `apps/api/src/admin/admin-route-domain.spec.ts`: route-domain ownership regression.
- Policy, accounting, and Admin service specs cover all combinations and reversal invariants.

### Admin Web

- `apps/admin_web/app/wallet-adjustments/page.tsx`: Records, Requests, and New request workspaces with active-view-only fetching and separate filters.
- `apps/admin_web/app/wallet-adjustments/actions.ts`: POST owner search, POST preview, local error state, and safe redirects.
- `apps/admin_web/app/wallet-adjustments/wallet-adjustment-create-workspace.tsx`: verified owner selection, policy-derived reasons, preview invalidation, and maker/checker handoff.
- `apps/admin_web/app/wallet-adjustments/wallet-adjustment-reversal-workspace.tsx`: immutable source-bound reversal draft.
- `apps/admin_web/app/wallet-adjustments/wallet-adjustment-form-key.ts`: preview-to-current-input binding.
- `apps/admin_web/components/admin-form-controls.tsx`: minimal ARIA error passthrough for existing form controls.
- `apps/admin_web/app/globals.css`: scoped 1440px table, form, preview, focus, and long-identifier behavior.
- `apps/admin_web/lib/admin-api.ts`: typed policy contract.

## Verification

### Tests and builds

- Focused Admin: `20` tests passed in `2` files.
- Full Admin scope: `831` files and `4,423` tests passed; typecheck, lint, query guards, visible-copy guard, and production build passed.
- Focused API policy/accounting/routes: `84` tests passed in `3` files.
- Full API scope: `159` files passed, `1` skipped; `2,105` tests passed, `1` skipped; typecheck, lint, build, Prisma validation, and contracts passed.
- Impeccable detector: no Wallet Adjustments finding. Six warnings point to older unrelated selectors elsewhere in the shared `globals.css`.
- Scope scripts reported the existing repository-wide protected-file warning because the worktree already contains many unrelated changes.

### Browser

Verified in the signed-in local browser at `1440x900`:

- Records default view and unique `Executed wallet ledger` region.
- Requests view and pending approval filter with age, blocker, and Approval Queue action.
- Partner and Customer owner search; the visible wallet type remains aligned with returned results.
- Safe POST preview with current balance, resulting balance, no bank/cash movement, and no output VAT.
- Preview reason remains aligned after the server action reset.
- Exact-owner record filter and clear action.
- Record evidence disclosure and source-bound reversal link.
- Page width `1425/1425`; no document-level horizontal overflow.
- Browser console warnings/errors: none.
- URLs remained limited to view/filter context. No owner search, phone, amount, reason, or evidence draft appeared in the URL.

Screenshots:

1. `01-records-1440.png`
2. `02-requests-1440.png`
3. `03-requests-pending-1440.png`
4. `04-create-initial-1440.png`
5. `05-partner-search-1440.png`
6. `06-customer-search-1440.png`
7. `07-preview-1440.png`
8. `08-exact-owner-records-1440.png`
9. `09-record-details-1440.png`

## Boundaries and residual risk

- No Prisma schema, migration, auth policy, payment mutation, settlement mutation, or dependency was added.
- Existing unrelated dirty and untracked files were preserved.
- Evidence remains a validated controlled HTTPS reference because the repository does not yet expose an attachment-ID upload contract for this workflow. It is never placed in the query string.
- A real request-to-approval-to-ledger lifecycle was intentionally not run in the browser because it would create financial records. That lifecycle is covered by focused and scope tests; a dedicated disposable-database smoke remains the appropriate next live verification.
- Not committed.
