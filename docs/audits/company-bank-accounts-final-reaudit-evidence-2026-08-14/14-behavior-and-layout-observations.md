# Company Bank Accounts browser behavior observations

- Audited route: `http://localhost:3101/finance-tax/company-bank-accounts`
- Audit date: 2026-08-14
- Viewports: 1440 × 1000 and 1600 × 1000 desktop only
- No write request was submitted and no database record was changed.

## Unsaved-change guard

1. Opened the Add company bank account drawer.
2. Entered `5678` in `Last four digits`.
3. Confirmed the preview changed to `•••• 5678`.
4. Selected the footer `Cancel` link.
5. The drawer closed immediately without the discard confirmation that appears through the drawer shell's close handler.

Source inspection confirmed that backdrop, Escape, and the X button call the guarded `onClose`, while the footer Cancel controls are direct navigation links (`page.tsx:711` and `page.tsx:779`).

## Desktop table width

- At 1440px viewport width the Current accounts table required horizontal scrolling and the Action column was outside the initial viewport.
- At 1600px viewport width the table still required horizontal scrolling; the Action column remained partially outside the visible table region.
- The CSS table minimum width is 1320px inside a content area reduced by the permanent sidebar and page padding.

## Recent change timeline

- The timeline reported `Showing 20 of 66 changes · 10 request lifecycles`.
- Multiple rows visually overlapped in the lifecycle table, including maker/checker, request ID, evidence, and before/after content.
- Several account labels fell back to raw CUIDs because only accounts from the currently loaded account page were available to the UI mapping.

