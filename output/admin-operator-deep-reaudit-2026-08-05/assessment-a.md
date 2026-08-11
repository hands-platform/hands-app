# Assessment A — independent visual, workflow, copy, and code review

Run date: 2026-08-05 (Asia/Bangkok / Vietnam operating time shown in product)

This assessment was completed before running the Impeccable static detector.

## Evidence set

- Current authenticated browser captures: `01` through `16` in this directory.
- Desktop routes reviewed: Shift Command, Booking Monitor, Refunds, Notifications, Customers, Customer Detail, Partner Approvals, Finance Overview, Finance Current Backlog, Operations History, and Current Shift Handoff.
- Responsive spot checks: Notifications and Customers at 1024 × 900.
- Source traced through the corresponding Next.js pages/models and Nest admin service query builders.
- Read-only database aggregates were used to compare the live queue definitions. No customer or booking identifiers were printed.

## Independent findings

### Critical contract failure

1. Shift Command shows 112 open refunds and 410 unresolved notification failures, but its exact queue links open 0-row lists.
2. The common Prisma production-data filters return zero production bookings and notifications because nullable JSON-path predicates are placed inside `NOT: { OR: [...] }`. PostgreSQL null/three-valued semantics make the negated expression fail for ordinary rows with no fixture key.
3. Live aggregate comparison:
   - Booking total: 2,966.
   - SQL production-data predicate: 2,954.
   - Prisma `adminBookingProductionDataWhere()`: 0.
   - SQL unresolved notification failures: 410.
   - Prisma `adminNotificationProductionDataWhere()`: 0.
4. This explains empty Booking, Refund, Payment-linked and Notification queues while raw-SQL Shift Command still reports open work. The product currently gives mutually incompatible operational truths.

### Privacy and data presentation

5. Customer Directory renders the full phone number in every row. At 1024 px it is visible twice in each identity cell. Booking lists already contain a masking pattern; the directory should use a shared server-side masked field and keep full contact detail behind customer-detail authorization/reveal.
6. Customer Detail also presents the full phone in the page subtitle, headline, and contact line. If full detail is required for support, reveal should be permissioned and audited; otherwise default to masking.

### Workflow integrity

7. Shift Handoff correctly separates current handoff from read-only history, but incoming operator, owner, and case IDs are free text. Server validation checks only non-empty values and requires a note when case IDs exist; it does not validate an operator, team, or existing open case.
8. The active breadcrumb/sidebar stays `Operations History` while the H1 is `Shift Handoff`, weakening location awareness.
9. Finance backlog exposes owner, unassigned count, oldest age, and impact, but the tax/closeout card can appear actionable while both visible counters are zero because hidden coupon/reconciliation counters set the warning tone. The triggering signal must be visible.

### Visual hierarchy and responsive behavior

10. Shift Command is materially better: open work is first, owner/age/impact are visible, lower-priority queues are collapsed, and live versus selected-period data is separated.
11. The 987-item historical backlog still dominates the current-shift home without assignment or cleanup framing. Oldest ages of 75–78 days should be explicitly labelled migration/legacy cleanup and separated from same-shift action.
12. Notifications at 1024 px spends the full first viewport on status, queue choices, and advanced filters; the result table and next action are below the fold. The `Historical` badge and `Live · updated` badge are simultaneously visible.
13. Customer Directory at 1024 px has overlapping `Unknown country` and sign-up date text, clipped later columns, and no obvious horizontal-scroll affordance.
14. Partner Approvals and Finance Today are the strongest revised screens: focused purpose, minimal choices, clear empty state, and separation of current versus historical concepts.

### Copy and labeling

15. Mechanical copy remains: `booking(s)`, `row(s)`, `case(s)`, `record(s)`, `Partner(s)`, and `formula issue(s)`.
16. Queue descriptions concatenate a sentence with lower-case continuation, e.g. `Unresolved failures. notifications...` and `Open cases. refunds...`.
17. `1 operating queues clear` has incorrect number agreement.
18. `All loaded` implies a client-side subset rather than an operator-understandable time scope. Use `All dates` or `Entire history` when the API is truly unbounded.
19. Finance Today copy such as `without mixing in older backlog` describes implementation discipline instead of the operator outcome.

### Accessibility limits and observations

20. Heading structure, native form labels, buttons, and link names were inspected through current DOM/source evidence. Screenshots show low-contrast muted text and very dense 1024 layouts that warrant measured contrast and zoom checks.
21. No screen-reader session, complete keyboard-only journey, automated color-contrast measurement, or full 200% zoom workflow was performed. Those remain verification tasks, not claimed passes.

