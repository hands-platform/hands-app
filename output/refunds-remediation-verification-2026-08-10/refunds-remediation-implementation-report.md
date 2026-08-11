# Refunds Remediation Implementation Report

- Date: 2026-08-10
- Route: `http://localhost:3101/refunds`
- Verification viewport: `1440 x 900`
- Final result: **Complete**
- Commit: **Not committed**

## 1. Outcome

The Refunds workspace now preserves the selected refund ID from triage through approval review, state-mismatch investigation, and payment-timeline review.

- `AWAITING_DECISION` opens an exact focused Approval Queue case instead of a generic queue.
- `STATE_MISMATCH` opens the same exact evidence view and no longer sends operators to unrelated Settlement Repair results.
- The focused Approval Queue reads the selected request independently of its normal `take=10` list and sort order.
- Ready cases retain the existing maker-checker approve/reject controls. Mismatch, blocked, missing, or changed cases never expose those mutations.
- Each refund row has a real keyboard-operable control-readiness disclosure. Closed detail rows are not rendered.
- Payment detail recognizes an active refund and replaces duplicate refund creation with a link to the existing case.
- The desktop table uses the document scroll only, with one base row per refund and one conditional detail row.

The existing default contract remains intact in the verified local data:

| Queue | Count |
| --- | ---: |
| Approval required | 3 |
| Gateway processing | 0 |
| Reconciliation required | 109 |
| Open work | 112 |

## 2. P1 / P2 / P3 Status

| Requirement | Status | Implementation evidence |
| --- | --- | --- |
| P1-1 Approval Queue exact focus | Complete | `requestId`, safe `returnTo`, exact API read, focused panel, no duplicate normal-table row |
| P1-2 State mismatch handoff | Complete | Exact Approval Queue case with refund/payment/booking state, mismatch reason, timeline/detail links, refresh and escalation guidance |
| P1-3 Real checklist disclosure | Complete | Button state, `aria-expanded`, `aria-controls`, click/Enter/Space, Escape close and focus restore, one open row |
| P1-4 Active refund in Payment detail | Complete | Duplicate request CTA hidden; active refund ID/status and exact case link shown |
| P2-1 Remove nested vertical scrolling | Complete | `overflow-x: auto`, `overflow-y: visible`, no table max-height |
| P2-2 One case / six columns | Complete | Six-column desktop table and conditional full-width checklist row |
| P2-3 Control readiness terminology | Complete | Control facts/gaps and Available/Missing/Not required/Mismatch states |
| P2-4 Command cards are queue links | Complete | Requested, processing, mismatch, overdue and oldest links; active link has `aria-current` |
| P2-5 More filters discovery | Complete | `More filters · Age and SLA` plus active-filter count |
| P2-6 Source presentation | Complete | Known source mappings, legacy constraint copy, humanized unknown fallback with raw code secondary |
| P2-7 Document title | Complete | `Refunds | HANDS Admin` |
| P2-8 Dark mode hierarchy | Complete | Existing Admin theme tokens used; visually checked, no quantitative WCAG claim |
| P3-1 Full identifiers | Complete | Full refund, payment and booking IDs in expanded control context and focused review |
| P3-2 Unused checklist component | Preserved by design | `refund-decision-checklist-section.tsx` was already dirty before this task; it was not deleted or overwritten |
| P3-3 Legacy Refund CSS | Complete | Unreferenced `.refunds-table-card` rules removed; shared payout/coupon rules preserved |

## 3. Changed Files and Responsibilities

### Refunds workspace

- `apps/admin_web/app/refunds/page.tsx`: exact handoff links, current return URL, source copy, readiness model, metadata.
- `apps/admin_web/app/refunds/page.spec.tsx`: queue, source, title, default/search/empty/canonicalization regressions.
- `apps/admin_web/app/refunds/refund-focus-links.ts`: `URLSearchParams`-based exact focus URL and safe local `returnTo` validation.
- `apps/admin_web/app/refunds/refund-focus-links.spec.ts`: query preservation, hash contract and unsafe return rejection.
- `apps/admin_web/app/refunds/refund-rows-table.tsx`: client-only row disclosure and keyboard/focus behavior.
- `apps/admin_web/app/refunds/refund-command-board-section.tsx`: linked command metrics and active state.
- `apps/admin_web/app/refunds/refund-filter-board-section.tsx`: advanced-filter label/count.
- `apps/admin_web/app/refunds/refunds-table-section.tsx`: six-column table shell and accessible table region.
- Matching Refunds specs: component and contract regressions.

### Approval and payment handoff

- `apps/admin_web/app/finance-tax/approval-queue/page.tsx`: focused case states, full identifiers, safe actions, evidence links and back navigation.
- `apps/admin_web/app/finance-tax/approval-queue/actions.ts`: preserve validated `returnTo` through decision confirmation.
- Matching Approval Queue specs: ready, mismatch, missing/changed, duplicate and unsafe-return contracts.
- `apps/admin_web/app/payments/[id]/page.tsx`: latest active-refund awareness.
- `apps/admin_web/app/payments/[id]/payment-detail-action-map-section.tsx`: replace duplicate request action with existing refund progress/review link.
- Matching Payment detail specs: active-refund CTA regression.

### Shared Admin and API

- `apps/admin_web/components/admin-overview-card.tsx`: optional linked mini metric with `aria-current`.
- `apps/admin_web/lib/admin-api.ts`: focused approval response types.
- `apps/admin_web/app/globals.css`: Refunds table, checklist, focus panel and dark-theme desktop rules.
- `apps/api/src/admin/admin-finance.routes.ts`: `requestId` query contract.
- `apps/api/src/admin/admin.service.ts`: exact focused refund read, payment/booking status and mismatch reason.
- `apps/api/src/admin/admin.service.spec.ts`: exact read outside the normal page window.
- `apps/api/src/admin/admin.controller.spec.ts`: route forwarding contract.

The files above were edited in an already heavily modified worktree. This list describes this remediation's intentional responsibility; it does not claim ownership of unrelated pre-existing hunks in those files.

## 4. Exact-Focus Contract

### URL

```text
/finance-tax/approval-queue?view=refunds&requestId={refundId}&returnTo={encodedLocalRefundsUrl}#approval-{refundId}
```

- Query construction uses `URLSearchParams`.
- `returnTo` accepts only a local `/refunds` path and rejects external or unrelated paths.
- Search, range, review, age, SLA, sort and page context can be restored.

### API read

- The selected request is read independently with its exact ID and current `REQUESTED` state.
- It does not depend on the normal queue `take`, sort, page, or review filter.
- The normal summary and list remain unchanged.
- The focused result is returned separately as `FOUND` or `NOT_FOUND_OR_CHANGED`.
- A focused case already present in the normal list is omitted from the normal table to prevent duplicate rendering.

### Focused states

- **Ready:** latest server state plus existing approve/reject controls.
- **Blocked:** blocker explanation and evidence links, no decision mutation.
- **State mismatch:** refund/payment/booking status, reason, IDs, payment timeline, booking detail, refresh and Finance escalation; no approve/reject.
- **Missing or changed:** explicit not-found/state-changed notice instead of an empty queue.

## 5. State Mismatch Destination and Actions

The final destination is the exact focused Refund Approval Queue case, not `/finance-closeout`.

Operators receive:

- full Refund, Payment and Booking IDs;
- current refund, payment and booking statuses;
- a human-readable mismatch reason;
- exact Payment timeline and Booking detail links;
- Refresh/revalidate and Back to refund queue;
- Finance escalation guidance when no safe repair mutation exists.

No fake repair action, client-side state mutation, direct Refunds approve/reject, or Settlement Repair shortcut was added.

## 6. Payment Detail Active-Refund Policy

| Latest active refund state | Payment detail behavior |
| --- | --- |
| No active refund | Existing `Request refund review` policy remains |
| `REQUESTED` | Show pending refund review and exact case link |
| Approval/provider/gateway processing | Show refund progress and exact case link |
| State mismatch | Show state-mismatch review and exact case link |
| Completed/rejected only | Existing new-request eligibility policy remains authoritative |

The server mutation's duplicate protection remains unchanged.

## 7. Browser Verification

All verification used the signed-in in-app browser at `1440 x 900`. Every saved capture was opened and visually inspected.

### Before evidence

- `C:\dev\massage-on-demand-vn\output\refunds-post-remediation-reaudit-2026-08-09\02-default-case-table.png`
- `C:\dev\massage-on-demand-vn\output\refunds-post-remediation-reaudit-2026-08-09\03b-checklist-detail.png`
- `C:\dev\massage-on-demand-vn\output\refunds-post-remediation-reaudit-2026-08-09\06-approval-queue-handoff.png`
- `C:\dev\massage-on-demand-vn\output\refunds-post-remediation-reaudit-2026-08-09\08-reconciliation-handoff.png`

### After evidence

1. `01-refunds-default-1440.png`: default 3 / 0 / 109 / 112 contract and linked command board.
2. `02-refund-checklist-open-1440.png`: one full-width open control-readiness row.
3. `03-refunds-approval-required-1440.png`: three approval-required cases and readable source labels.
4. `04-approval-focus-ready-1440.png`: selected refund preserved; ready decision controls.
5. `05-approval-focus-state-mismatch-1440.png`: state evidence and no approve/reject.
6. `06-payment-active-refund-1440.png`: one existing-refund link and no duplicate request CTA.
7. `07-refunds-exact-id-search-1440.png`: exact-ID search returns one case.
8. `08-refunds-more-filters-open-1440.png`: advanced filters and active-count treatment.
9. `09-refunds-today-empty-1440.png`: true empty period plus all-open recovery link.
10. `10-refunds-dark-1440.png`: dark-theme hierarchy.
11. `11-approval-focus-not-found-1440.png`: missing/changed focused state.

All after captures are in:

```text
C:\dev\massage-on-demand-vn\output\refunds-remediation-verification-2026-08-10
```

### Browser contract results

- Document horizontal overflow: none.
- Refund table inner vertical overflow: none; document scroll only.
- Table at 1440: `clientWidth === scrollWidth === 1050`.
- Closed checklist rows: not rendered.
- Click, Enter and Space: open the selected checklist.
- Escape: closes it and restores focus to its toggle.
- Exact approval and mismatch links: preserve selected refund and return URL.
- State mismatch approve/reject controls: 0.
- Active-refund payment `Request refund review` links: 0.
- Active-refund exact case links: 1.
- `page=999`: canonicalized to the last valid page (`page=12`, rows 111-112 of 112).
- Console errors/warnings after final pass: 0.
- `document.title`: `Refunds | HANDS Admin`.

Approval/rejection mutations were not executed because they would change local finance data. Their visibility and server-side gating were verified through UI state and automated tests.

## 8. Automated Verification

### Focused regressions

- Admin focused Refunds/Approval/Payment suite: **PASS**, 9 files / 108 tests in the last focused run before the final full scope.
- API refund queue contract: **PASS**, 9 tests.
- API focused exact-service contract: **PASS**, 1 selected test.
- API focused controller forwarding contract: **PASS**, 1 selected test.

### Full scope

```powershell
npm.cmd run verify:scope -- -Scope admin
```

- Admin tests: **PASS** (832 files / 4,444 tests in the full run).
- Admin typecheck: **PASS**.
- Admin lint: **PASS**.
- Admin query guards: **PASS**.
- Admin visible-copy guard: **PASS**.
- Admin build: **PASS**.
- Log: `admin-scope-final.log`.

```powershell
npm.cmd run verify:scope -- -Scope api
```

- API tests: **PASS** (160 passed / 1 skipped files; 2,116 passed / 1 skipped tests).
- API typecheck: **PASS**.
- API lint: **PASS**.
- API policy coverage: **PASS**.
- Prisma validation: **PASS**.
- API build: **PASS**.
- Log: `api-scope.log`.

Additional result:

- `git diff --check`: **PASS**. The command emitted existing line-ending notices but no whitespace error.
- Impeccable detector: warning exit. It found six pre-existing side-accent patterns in unrelated global selectors (Vietnam map, marketing, booking, dispatch, timeline and ops check styles). No Refunds-specific new pattern was reported; unrelated selectors were preserved.

## 9. Performance Samples and Limits

The parallel Refund queue-meta plus rows structure remains in place. Command links add no database read. Exact Approval focus adds one exact read only on its deep-link path and does not ship the 109 mismatch cases to the client.

| Flow | Previous audit warm sample | Current local navigation sample |
| --- | --- | --- |
| Default | 326ms / 334ms | 475ms / 493ms |
| Approval required | 322ms / 322ms | 451ms / 435ms |
| Exact ID search | 352ms / 322ms | 475ms / 446ms |

The current sample used in-app browser navigation timing after the implementation; the audit used a separate warmed measurement sequence. The methods and machine state are not identical, so this table is only a local smoke signal, not a regression proof or production p95/p99 claim. Query count and request shape did not increase on the default Refunds route.

## 10. Protected Areas and Preserved Work

- Protected Admin read-contract files changed: `apps/api/src/admin/admin.service.ts` and Admin finance route/query contracts.
- No Prisma schema, migration, authentication, payment mutation, refund state transition, RBAC, maker-checker, seed, or external gateway behavior changed.
- The worktree contained hundreds of existing modified/untracked files across Admin, API, apps, infra, docs and output. They were left intact.
- In particular, the already-dirty unused `refund-decision-checklist-section.tsx` and its related work were preserved rather than deleted.
- Pre-existing Approval Queue snapshot-control/loading and Refunds loading files were preserved.

## 11. Remaining Risks

1. There is still no generic safe mutation for a refund/payment/booking state mismatch. The UI correctly exposes evidence and escalation instead of inventing repair behavior.
2. Performance samples are local and methodologically different from the prior audit; production DB query plans and p95/p99 remain unmeasured.
3. Dark mode was visually inspected with existing tokens, but no quantitative contrast audit was run.
4. The repository-wide protected-files warning remains because the shared dirty worktree contains unrelated protected changes; this remediation did not clean or revert them.
5. The legacy unused checklist file remains pending a clean ownership checkpoint because deleting it would risk removing pre-existing user work.

The user-requested 1024px-and-below, tablet and mobile scope was intentionally not implemented or evaluated.
