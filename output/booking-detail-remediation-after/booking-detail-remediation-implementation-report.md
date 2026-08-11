# Booking Detail Post-match Cancellation Remediation

Date: 2026-08-07  
Route: `/bookings/[id]`  
Protected booking: `cmrksdu210061vy3gfrmot29g`

## 1. Completion status

The post-match cancellation decision flow is implemented and verified in focused tests and the local browser. The protected booking was opened only to verify the final read-only presentation; no mutation was submitted against it.

Repository-wide verification is **partial** because unrelated, pre-existing Admin/authority/smoke guard failures remain in the dirty worktree. The focused Admin tests, Admin typecheck, lint, build, focused API tests, API scope verification, and the cancellation money smoke passed.

## 2. Operator flow

- The decision section is placed before supporting records so the operator sees the pending action first.
- Original cancellation facts and the later Admin decision are separate records.
- A pending review never displays an implied approval or an invented decision time.
- Decision preview requires an explicit choice and reason before confirmation.
- Confirmation describes the exact payment and Partner-fee effect for cash, wallet authorization, and captured card payments.
- A successful decision becomes read-only and shows the actual Admin actor, timestamp, reason, note, payment result, and fee result.
- A concurrent decision returns a visible conflict message and moves focus to the status message.
- Supporting customer, Partner, chat, money, timeline, review, and technical records remain on the same page under one collapsed `Supporting records` disclosure.

## 3. Safety matrix

| Scenario | Before | Verified result |
| --- | --- | --- |
| Cash, nothing collected | Could read like a refund/settlement action | Explicitly says no customer refund and no company-held funds |
| Cash, retainable fee | Fee result was easy to miss | Confirmation and resolved state state whether the fee is kept or waived |
| Wallet authorization | Payment effect was mixed with generic refund copy | Approval releases the authorization; resolved view shows `RELEASED` |
| Captured card payment | Refund could look completed immediately | Creates a refund request and says Finance approval is still required |
| Refund already requested | Top summary only showed captured payment | Shows `Refund approval pending` and `REFUND REQUESTED` |
| Missing evidence | Room existence could be treated as chat evidence | Requires actual chat messages and an operator note; room-only is partial |
| Concurrent decision | Conflict could remain hidden behind the dialog | Dialog closes and the 409 status is visible and focused |
| Resolved review | Decision facts could be reconstructed from booking closure | Reads the Admin audit decision and renders it read-only |

## 4. Data and evidence semantics

- Admin decision projection comes from the post-match decision audit record, not from booking `updatedAt` or the original cancellation reason.
- Review age starts from the verified close/update/create timestamps in that order.
- Original actor, original reason, original note, Admin reason, and Admin note are independent fields.
- Evidence is ready only when chat messages and an operator note exist.
- A retained chat room with zero messages is reported as retained but empty.
- Location and alert records remain supporting evidence and cannot independently satisfy the decision gate.
- Cash bookings with no captured company funds report refund as `Not expected`.

## 5. Main changed files

### API

- `apps/api/src/admin/admin.service.ts`: include post-match decision audit and operator-note evidence in the lightweight booking detail response.
- `apps/api/src/admin/admin.service.spec.ts`: regression coverage for the lightweight detail contract.

### Admin Web

- `apps/admin_web/app/bookings/booking-post-match-cancellations-model.ts`: separate original cancellation and Admin decision projections.
- `apps/admin_web/app/bookings/booking-post-match-cancellations-model.spec.ts`: audit projection and timestamp regressions.
- `apps/admin_web/app/bookings/[id]/actions.ts`: guarded decision mutation and concurrent-resolution handling.
- `apps/admin_web/app/bookings/[id]/actions.spec.ts`: decision validation and conflict regressions.
- `apps/admin_web/app/bookings/[id]/booking-outcome-review-panel.ts`: payment/refund/fee facts, including active refund state.
- `apps/admin_web/app/bookings/[id]/booking-outcome-review-panel.spec.ts`: cash, wallet, card, and requested-refund cases.
- `apps/admin_web/app/bookings/[id]/booking-detail-post-match-decision-section.tsx`: pending, confirmation, conflict, and resolved read-only UI.
- `apps/admin_web/app/bookings/[id]/booking-detail-post-match-decision-section.spec.tsx`: form and status behavior.
- `apps/admin_web/app/bookings/[id]/booking-evidence-sections.tsx`: one concise evidence summary plus advanced records.
- `apps/admin_web/app/bookings/[id]/booking-evidence-sections.spec.tsx`: evidence disclosure regressions.
- `apps/admin_web/app/bookings/[id]/booking-operator-sections.tsx`: remove ghost scope copy and distinguish available/unavailable actions.
- `apps/admin_web/app/bookings/[id]/booking-operator-sections.spec.tsx`: operator-action rendering regressions.
- `apps/admin_web/app/bookings/[id]/booking-detail-decision-readiness.ts`: require real chat and note evidence.
- `apps/admin_web/app/bookings/[id]/booking-detail-evidence-packet.ts`: consistent evidence packet status.
- `apps/admin_web/app/bookings/[id]/page.tsx`: decision-first information architecture and compact supporting records.
- `apps/admin_web/app/bookings/[id]/page.spec.tsx`: page assembly and post-match structure.
- `apps/admin_web/lib/booking-evidence-packet.ts`: canonical evidence readiness.
- `apps/admin_web/lib/booking-decision-evidence-guardrails.ts`: decision guardrails aligned to the same evidence facts.
- `apps/admin_web/lib/booking-chat-evidence-decision-board.ts`: retained-room versus actual-message semantics.

### Smoke

- `infra/scripts/post-match-cancellation-smoke.mjs`: minimal `--seed-only` mode and cash/wallet/card cancellation fixtures.

## 6. Verification commands

### Passed

- Focused Admin regression suite: 15 files, 91 tests passed.
- Booking detail page assembly: 2 files, 34 tests passed.
- Latest changed Admin set: 4 files, 41 tests passed.
- Focused API post-match suite: 9 tests passed, 589 skipped by test name selection.
- `npm.cmd run typecheck --workspace @massage-vn/admin-web`
- `npm.cmd run lint --workspace @massage-vn/admin-web`
- `npm.cmd run build --workspace @massage-vn/admin-web` (65 static pages built)
- `npm.cmd run verify:scope -- -Scope api` (156 files, 1 skipped; 1,978 tests, 1 skipped; typecheck/lint/build passed)
- Post-match money smoke against the latest local API:
  - wallet approve
  - wallet hold
  - card authorization release
  - captured card refund request
  - cash with no collection
  - duplicate refund returns 409

### Repository-wide existing failures

- `verify:local`: failed on existing setup-doctor/visible-copy/authority/API-domain-smoke/Admin full-test guards. Log: `verify-local.log`.
- `verify:local -WithServices`: Docker, migration, seed, and API readiness passed; existing Admin API budget/API smoke/realtime smoke and global guard failures remained. Log: `verify-local-with-services.log`.
- Existing Admin full-test failures: 7 failures among about 4,300 tests (form-control CSS, raw-details surface guard, calendar/finance/booking CSS guards, and concise lifecycle copy).
- Existing Admin visible-copy violations: three `Trust badge` occurrences.

These failures were not introduced or weakened to make this work pass.

## 7. Browser verification

Console errors and warnings were empty in the tested tabs. No page-level horizontal overflow was observed.

| Capture | Result |
| --- | --- |
| `01-pending-cash-no-money-1440-light.png` | cash/no-company-money pending state |
| `02-pending-cash-retainable-fee-1440-light.png` | retainable cash fee state |
| `03-validation-missing-reason.png` | required decision reason validation |
| `04-missing-chat-and-note-evidence.png` | room with zero messages and zero notes |
| `05-wallet-authorization-release-confirmation.png` | wallet release confirmation |
| `06-wallet-authorization-released-read-only.png` | resolved wallet read-only result |
| `07-card-captured-refund-request-confirmation.png` | captured-card refund request confirmation |
| `08-card-refund-requested-read-only.png` | requested-refund top summary and resolved state |
| `09-concurrent-decision-409.png` | visible concurrent decision conflict |
| `10-resolved-protected-booking-1440-light.png` | protected booking, light, 1440x900 |
| `11-resolved-protected-booking-1600-light.png` | protected booking, light, 1600x900 |
| `12-resolved-protected-booking-1440-dark.png` | protected booking, dark, 1440x900 |

The longest pending fixture measured 5,391px at 900px viewport height (5.99 viewports). The protected resolved booking measured 4,269px at 1440x900 and 4,123px at 1600x900. Viewports at or below 1024px were intentionally not tested for this desktop-only Admin task.

## 8. Data protection and worktree

- Protected booking `cmrksdu210061vy3gfrmot29g`: read-only browser verification only.
- All mutation tests used `audit_post_match_*` fixtures.
- The 409 test intentionally resolved the safe `audit_post_match_card-approve_booking` fixture from a second session.
- Existing dirty and untracked user changes were preserved; no reset, checkout, broad formatting, commit, push, or deployment was performed.
- No new dependency or database migration was added.

## 9. Remaining risk

The repository-wide Admin and authority guards need a separate cleanup pass because their failures predate and span outside this booking-detail remediation. The post-match cancellation path itself is covered by focused tests, API scope verification, money smoke, and browser evidence.

Commit: Not committed.
