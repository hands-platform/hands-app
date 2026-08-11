# Codex implementation prompt — Partner Notes About Customers

Copy the full prompt below into a Codex task. This brief is intentionally prescriptive: implement it without reopening the product decisions unless the current code proves a stated assumption false.

---

## Prompt

Work only in `C:\dev\massage-on-demand-vn`.

Improve the admin route `http://localhost:3101/reviews/partner-customer-evaluations` from a passive, misleading table into a trustworthy global search and review surface for internal partner-written notes about customers.

Read these first:

1. `C:\dev\massage-on-demand-vn\AGENTS.md`
2. `C:\dev\massage-on-demand-vn\output\partner-customer-evaluations-audit-2026-08-06\partner-customer-evaluations-operator-audit.md`
3. All screenshots in `C:\dev\massage-on-demand-vn\output\partner-customer-evaluations-audit-2026-08-06\`

Inspect the live page before editing, then trace the page, shared review model, API route/service, Prisma model, audit-log pattern, permission guard, navigation entry, and the same note records embedded in Booking, Customer, and Partner detail pages. Do not rely on the report alone when code has changed since the audit.

### 1. Goal

An operator must be able to answer, without guessing:

- What did a Partner write about this customer?
- When was the note submitted?
- Which Partner and booking produced it?
- Is the note retained, awaiting review, or restricted?
- Why was its review state changed, by whom, and when?
- Is the list complete, filtered, empty, or unavailable because loading failed?

The result must be understandable to an operations user, not only to a programmer. Optimize for fast reading, reliable evidence, clear next actions, and auditability.

### 2. Locked product and information-architecture decisions

These decisions supersede the report's recommendation to remove the standalone page:

1. Keep `/reviews/partner-customer-evaluations` as the global search/review surface.
2. Rename the page to **Partner Notes About Customers** and the navigation item to **Partner Notes**.
3. Keep the same records visible in Booking, Customer, and Partner detail pages as contextual evidence. The global page is for cross-record search and review; detail pages are for one-entity context.
4. Do not merge these notes into the customer-facing **Customer Reviews** page. The visibility, subject, and policy risks differ.
5. Partner-written comment text is immutable evidence. An admin may change only review state and review metadata; never edit or delete the original comment in this work.
6. Keep the existing database enum values, but map them to operator language in the UI:
   - `PUBLISHED` → `Retained`
   - `REPORTED` → `Needs review`
   - `HIDDEN` → `Restricted`
7. Preserve current downstream behavior in which a `REPORTED` provider note contributes to the customer's reported-review risk signal, unless an existing policy document or test explicitly proves otherwise. Make that consequence visible in the confirmation UI and preserve it with a test. Do not silently redefine the policy.
8. This pass does not add export, assignment, SLA, bulk actions, a new workflow engine, a new database enum, or editable notes.

### 3. Confirmed problems to fix

Treat these as reproducible defects unless the current implementation has already fixed them:

- The base route defaults to `Today`, although the page reads like a complete internal-note archive.
- `All dates` removes `dateRange=all`, causing the base route to resolve back to `Today`.
- Empty custom dates behave as all time but are labeled `Custom: Any start - Any end`.
- Reversed custom dates are silently swapped instead of being rejected.
- The UI calls the date `Request Time` or `Evaluation request date`, while the server filters/sorts by the note's `createdAt` and some local display helpers use the booking request time.
- List and summary requests use fallback values, so an API failure looks like a real zero-result state.
- An out-of-range URL such as `?dateRange=custom&page=99` can show a non-zero total, an empty table, and `0 to 0 of 2` at the same time.
- The shared review table has `min-width: 1320px`. At a 1024px viewport the content area is about 660px, so the actual note and review state are off-screen; it still overflows at 1440px.
- The screen spends space on static metric cards and repeated explanations but omits the note's stored status, report reason, and moderation time.
- Full customer phone/presence and the repeated `Text-only customer evaluation` helper add noise to this global list.
- Search can match `reportReason`, but the page does not show that field.
- Empty data, no filtered matches, and API failure are not distinct states.
- The schema already has `status`, `reportReason`, `moderatedAt`, and `updatedAt`, but there is no usable admin review action for this note type.

### 4. Inspect before changing

At minimum inspect these current paths and all callers of any shared helper you plan to change:

- `apps/admin_web/app/reviews/partner-customer-evaluations/page.tsx`
- `apps/admin_web/app/reviews/partner-customer-evaluations-section.tsx`
- `apps/admin_web/app/reviews/review-page-model.ts`
- nearby `*.spec.ts` / `*.spec.tsx` files for both review pages
- `apps/admin_web/app/globals.css`
- `apps/admin_web/lib/admin-api.ts` and relevant response types
- the admin navigation configuration used by the sidebar
- `AdminReviewRecordsSection` and its Booking, Customer, and Partner detail callers
- existing admin confirmation, feedback, error-state, drawer/details, and moderation patterns
- `apps/api/src/admin/admin-review.routes.ts`
- relevant admin DTOs, service methods, permission guards, audit-log helpers, and specs
- `apps/api/prisma/schema.prisma`, especially `ProviderCustomerReview`
- `apps/api/src/bookings/bookings.service.ts`, where provider-to-customer notes are created
- the customer activity/risk summary query that counts reported provider notes

Use `rg` first. Before changing a shared helper, find every caller and fix the root cause once where that is safer than page-specific patches. Do not make a broad shared CSS or model change that accidentally breaks Customer Reviews.

### 5. Required implementation

#### P0 — trustworthy data and governance

##### A. Loading and error states

- Replace silent list and summary fallbacks with the existing result-aware request pattern, such as `adminGetResult` if that remains the project standard.
- If either required request fails, show an explicit operator-facing error with a retry action and enough context to distinguish list failure from summary failure.
- Never render an API failure as `0 notes`.
- If partial rendering is safe, clearly label the unavailable section; otherwise use one coherent page error state. Prefer the existing admin error component/pattern.

##### B. Date semantics

- Make the base route mean **All dates**.
- Use `?dateRange=today` for Today; do not infer Today from a missing parameter.
- Empty custom dates must normalize to All dates, not a pseudo-custom label.
- Display visible `From` and `To` labels.
- If `From > To`, show an inline validation error and do not silently swap values.
- Use one timestamp definition throughout this page: **Submitted date** means `ProviderCustomerReview.createdAt`.
- Server filtering, server sorting, control labels, summary label, and the primary table timestamp must all use the submitted timestamp.
- Booking requested/opened time may appear only as clearly labeled secondary context in row details.
- Rename sort copy to `Most recently submitted` and `Oldest submitted`.

##### C. Pagination correctness

- A requested page greater than the last valid page must be canonicalized to the last valid page and must show its actual rows, preferably by redirecting to a canonical URL or by performing one safe re-fetch.
- A page below 1 must canonicalize to page 1.
- Preserve `q`, `dateRange`, `dateFrom`, `dateTo`, `sort`, `status`, and `pageSize` during canonicalization.
- Fix the shared root cause only if both review pages share it, and then run both pages' model/page tests.
- The count, visible rows, range text, and URL must never contradict one another.

##### D. Review-state API

- Add the smallest admin API action consistent with the current route structure, for example `PATCH /admin/partner-customer-reviews/:id/moderate`.
- Reuse the existing admin auth/permission category that already governs reviews; do not invent a second permission system.
- Accept only a valid target state and normalized reason.
- Require a non-empty reason for `REPORTED` / `Needs review` and `HIDDEN` / `Restricted`.
- When returning to `PUBLISHED` / `Retained`, clear the current active reason unless an existing moderation convention requires retaining it elsewhere in audit history.
- Fetch the existing row first and update only `status`, `reportReason`, and `moderatedAt` (plus any already-established moderator metadata). Never accept or update `comment`.
- Reject missing records and invalid transitions/inputs using existing API error conventions.
- Write an admin audit event containing actor, note ID, booking/customer/partner identifiers when available, before state, after state, reason, and timestamp.
- Do not add a Prisma migration merely to implement fields that already exist.

##### E. Review-state UI

- Add a state filter: `All`, `Retained`, `Needs review`, `Restricted`.
- Show the mapped state, current reason when present, and last review time in the list or its directly accessible row detail.
- Provide only the minimal row actions needed to set the three states.
- Before changing state, show a keyboard-accessible confirmation that includes the note excerpt, current state, target state, reason, and the known downstream effect. For `Needs review`, state that the current system includes it in the customer's reported-review risk signal.
- Preserve all current filters and pagination in `returnTo` after success or failure.
- Use the existing admin success/error feedback pattern. Do not use browser-native `alert()`.
- Never mutate data while verifying the UI. Open and cancel confirmations only.

#### P1 — operator reading efficiency

##### A. Page hierarchy and summary

- H1: `Partner Notes About Customers`
- Description: `Internal notes Partners submit about customers after completed bookings. These notes are not customer-visible.`
- Add a compact trust label near the title: `Internal · Not customer-visible`.
- Remove the current three large/static metric cards.
- Replace them with one compact summary row showing `Total`, `Needs review`, `Restricted`, and `Retained` for the active date/search scope.
- Extend the existing summary query with a minimal grouped count if needed. Do not create a generic analytics subsystem.

##### B. Filters

- Panel heading: `Partner note search`.
- Search placeholder: `Search note, customer, Partner, or booking`.
- Keep only useful controls: search, submitted-date range, state, sort, and page size.
- Add a visible `Clear filters` action only when filters are active.
- Search fields and displayed fields must agree. If report reason is searchable, expose it in row details or remove it from search deliberately and cover that behavior in a test.
- Keep URL state shareable and preserve all independent filters when one control changes.

##### C. Table/list structure

- Replace the 1320px inherited layout with a page-specific responsive structure. Do not globally weaken Customer Reviews without verifying it.
- The default reading order should be approximately:
  1. `Submitted`
  2. `Partner note`
  3. `Customer`
  4. `Author / booking`
  5. `Review state / actions`
- The note is the primary content. Show a readable 2–3 line preview and provide an accessible details/drawer pattern for the complete immutable text and secondary metadata.
- Row details should include, when already available without extra architecture: full note, Partner, customer, booking link, service, note submitted time, booking requested time, status, reason, and moderation time.
- Remove customer phone, online presence, and the static `Text-only customer evaluation` line from the default list. Keep sensitive/contact context in entity detail pages unless an existing policy requires it here.
- At 1024×768 and 1440×900, the note preview and review state/action must be visible without horizontal scrolling.
- Prefer responsive CSS/grid and existing components over JavaScript viewport logic.

##### D. Empty and result states

Render different messages for:

- no notes exist in the selected scope: `No Partner notes were submitted in this period.`
- filters/search have no match: `No Partner notes match the current filters.` plus `Clear filters`
- loading failed: an explicit unavailable/error message plus retry

Use natural count copy: `1 note`, `2 notes`; never `evaluation(s)`.

#### P2 — copy and consistency

Use `Partner` in user-facing copy even if internal code/types still say provider.

Replace programmer-oriented or ambiguous labels:

- `Partner-to-Customer Evaluations` → `Partner Notes About Customers`
- navigation `Partner > Customer` → `Partner Notes`
- `Evaluation filters` → `Partner note search`
- `Evaluation request date` → `Submitted date`
- `Request Time` → `Submitted`
- `Customer evaluation` → `Partner note`
- `Newest request` / `Oldest request` → `Most recently submitted` / `Oldest submitted`
- `Total evaluations` → `Total notes`

Keep a short policy explanation once near the title; remove repeated prose from cards, filters, and every row.

### 6. Accessibility requirements

- All form controls have visible labels, not only `aria-label` or placeholders.
- Search/filter feedback and mutation feedback are announced appropriately.
- State is communicated with text, not color alone.
- Confirmation and note details are fully keyboard operable; focus moves into them, Escape closes where appropriate, and focus returns to the trigger.
- Touch/click targets follow the existing admin minimum-size rule.
- At 200% zoom the note, state, filters, actions, and pagination remain reachable without two-dimensional scrolling.
- Preserve sensible heading order and table/list semantics.

### 7. Tests required

Add or update the smallest focused tests that prove the behavior. Reuse current test style; do not add a test framework.

At minimum cover:

1. missing `dateRange` resolves to All dates;
2. explicit Today remains Today;
3. empty custom dates resolve to All dates;
4. reversed custom dates produce validation feedback and are not silently swapped;
5. submitted-date filtering/sorting/display all use note `createdAt`;
6. list failure is not rendered as zero;
7. summary failure is explicit;
8. page 99 canonicalizes and loads the last page's rows;
9. state filter and grouped summary mapping;
10. status labels map `PUBLISHED/REPORTED/HIDDEN` to `Retained/Needs review/Restricted`;
11. moderation input validation and reason requirements;
12. moderation cannot change `comment`;
13. audit entry records actor, before/after, reason, and timestamp;
14. the existing reported-review risk-count behavior is preserved and made explicit;
15. query parameters survive filter, state change, pagination, and return navigation;
16. empty-data, no-match, and error messages differ;
17. the page-specific responsive markup/class no longer inherits a forced 1320px table for this page.

If you modify a shared review helper or shared CSS, run the relevant Customer Reviews tests as regression coverage.

### 8. Browser verification required

Use the already running authenticated admin app if available. Verify at least:

- `/reviews/partner-customer-evaluations`
- `?dateRange=today`
- empty custom dates
- a valid custom range
- reversed custom dates
- a search hit such as `refunded`
- a guaranteed no-match search
- `?dateRange=custom&page=99`
- each review-state filter
- each moderation confirmation opened and cancelled without submission

Verify at 1024×768 and 1440×900. Confirm:

- no horizontal scroll hides the note or review state/action;
- error, empty, and filtered states are visually distinct;
- counts, rows, range text, and URL agree;
- keyboard focus/close/restore behavior works;
- no new console errors or warnings appear.

Do not perform a real moderation mutation against existing local records during visual verification. Use automated tests for mutation behavior and cancel all live confirmations.

Save verification screenshots to:

`C:\dev\massage-on-demand-vn\output\partner-notes-improvement-verification-2026-08-06\`

Include desktop and narrow-desktop overview/table states, search result, no-match, invalid-date state, canonicalized page, and a cancelled moderation confirmation.

### 9. Engineering boundaries

- Preserve all unrelated user changes in the dirty worktree. Inspect `git diff` before editing overlapping files.
- Reuse existing helpers, components, permissions, audit logging, confirmation, and feedback patterns before adding code.
- No new packages, UI frameworks, design system, state library, generic repository layer, workflow engine, or speculative abstraction.
- Use native inputs and CSS where they are sufficient.
- Keep the diff to the fewest files that correctly fix the root causes.
- Do not rename internal provider types across the repository just to change user-facing copy.
- Do not add a schema migration unless current code proves a required field truly does not exist.
- Do not edit or delete Partner note text.
- Do not run broad formatters over unrelated files.
- Do not claim completion if required tests or browser checks were skipped. Report the exact skip and reason.
- Follow the protected-area verification rules in `AGENTS.md`; API and booking/risk behavior require proportionate integration checks.

### 10. Completion criteria

The work is complete only when all of the following are true:

- the route and nav clearly identify `Partner Notes` and internal visibility;
- the base URL consistently means All dates;
- all date labels and behavior use note submission time;
- invalid dates are explained instead of silently repaired;
- failures cannot masquerade as zero data;
- invalid pages canonicalize and show real rows;
- the note and state are readable at both required viewports without horizontal scrolling;
- state, reason, and moderation metadata are visible;
- operators can review/restrict/retain with confirmation and audit logging while the original note remains unchanged;
- counts and status mapping are covered by tests;
- contextual copies on Booking, Customer, and Partner details still work;
- relevant tests, typecheck/lint, and browser checks pass;
- screenshots are saved in the required folder.

### 11. Final response format

Report only verified facts under these headings:

1. **Implemented** — concise P0/P1/P2 checklist
2. **Changed files** — file and reason
3. **Verification** — exact command, pass/fail, and relevant test count
4. **Browser QA** — exact URLs, viewports, console result, and mutation-safety statement
5. **Screenshots** — absolute file paths
6. **Protected areas** — what was touched and which required checks ran
7. **Remaining risks / deferred** — only real items, including any skipped check and why

Do not provide a plan and stop. Inspect, implement, test, visually verify, and report the completed result.

---

## Why this prompt is constrained this way

The audit's largest risk was not visual polish; it was operator trust. This prompt therefore fixes contradictory dates, silent failures, pagination, immutable evidence, and review-state governance before layout polish. It also locks the standalone-page decision so implementation does not stall on product ambiguity, while explicitly excluding export, assignment, SLA, bulk actions, and new infrastructure until actual operating volume justifies them.
