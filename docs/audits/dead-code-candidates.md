# HANDS Dead Code And Obsolete Candidate Register

Date: 2026-06-21

Scope: documentation-only candidate list. These are not deletion instructions. Each candidate needs confirmation before removal or behavior change.

## Candidates

### DCC-001: Standalone Supabase location schema draft

- File path: `infra/supabase/location-schema.sql`
- Module/page/service name: Supabase/PostGIS location draft
- Issue type: obsolete feature candidate, old policy code
- Severity: medium
- Current behavior: the file defines standalone provider/customer location tables, nearby function, and public read policies with comments that policies should be tightened later.
- Why it matters: current MVP authority says NestJS owns business rules and current Prisma schema already models Provider location and Booking address snapshots.
- Risk to speed/cost/business correctness: correctness risk if this draft is applied separately and starts bypassing the NestJS boundary.
- Recommended fix: mark as archived/reference-only or replace with a current PostGIS migration plan owned by NestJS/Prisma.
- Safe now or human approval: human approval required before deleting or applying; safe now to document status.
- Suggested test or smoke check: verify no deployment script applies this SQL unexpectedly.

### DCC-002: Legacy `/providers` Admin routes redirect to `/partners`

- File path: `apps/admin_web/app/providers/page.tsx`, `apps/admin_web/app/providers/[id]/page.tsx`, `apps/admin_web/next.config.ts`
- Module/page/service name: Admin legacy Provider routes
- Issue type: obsolete route compatibility
- Severity: low
- Current behavior: legacy `/providers` routes redirect to `/partners`.
- Why it matters: redirects are harmless but can hide old terminology and add route-surface clutter.
- Risk to speed/cost/business correctness: low speed risk; low product-language risk.
- Recommended fix: keep redirects while external links may exist; later remove only after link telemetry confirms no usage.
- Safe now or human approval: human approval required before removal because old bookmarks may depend on redirects.
- Suggested test or smoke check: route smoke confirms `/providers` redirects to `/partners` until removal is approved.

### DCC-003: Partner legacy operations table may be a transition component

- File path: `apps/admin_web/app/partners/partner-legacy-operations-table-section.tsx`
- Module/page/service name: Admin Partner operations table
- Issue type: duplicate UI/helper candidate
- Severity: low
- Current behavior: component name and table structure indicate a legacy Partner operations table still exists.
- Why it matters: the Admin design direction is moving toward shared Vuexy-style tables and compact list/detail pages.
- Risk to speed/cost/business correctness: UI duplication and maintenance cost.
- Recommended fix: confirm current usage; if replaced by the new Partner table, deprecate and remove in a separate UI cleanup commit.
- Safe now or human approval: safe now only after usage search and visual parity check; no immediate deletion.
- Suggested test or smoke check: Partner list smoke for Partners, Unapproved Partners, and Unsettled Partners before/after removal.

### DCC-004: Deprecated operations policy fields remain for backward compatibility

- File path: `apps/admin_web/lib/operations-policy.ts`, `apps/admin_web/app/bookings/[id]/booking-policy-snapshots.ts`
- Module/page/service name: Operations policy snapshot compatibility
- Issue type: old policy code
- Severity: low
- Current behavior: code keeps reading legacy fields such as backup/open-mode aliases while preferring current marketplace policy fields.
- Why it matters: compatibility logic is useful for old seeded bookings, but it can confuse future policy work.
- Risk to speed/cost/business correctness: low speed risk; medium policy drift risk if old names are reused.
- Recommended fix: keep until old seeded data is migrated or explicitly marked as legacy in one helper.
- Safe now or human approval: safe now for comments/documentation; human approval before removing legacy reads.
- Suggested test or smoke check: snapshot tests for old metadata and current metadata both resolve to the same MVP policy values.

### DCC-005: Mobile legacy policy helper accessors remain

- File path: `apps/customer_app/lib/src/features/booking/presentation/customer_booking_ui_helpers.dart`, `apps/provider_app/lib/src/features/provider_request_guidance_helpers.dart`
- Module/page/service name: Customer/Provider booking policy UI helpers
- Issue type: duplicate helper, old policy code
- Severity: low
- Current behavior: tests and helpers still include legacy policy key handling.
- Why it matters: mobile UI can drift from the final authority if legacy naming stays scattered.
- Risk to speed/cost/business correctness: medium business-copy risk; low performance risk.
- Recommended fix: centralize legacy key translation in one compatibility helper and keep visible copy aligned with current MVP.
- Safe now or human approval: safe now for helper consolidation if tests remain green.
- Suggested test or smoke check: Flutter helper tests for first-pick 10 minutes, marketplace radius, and customer cancellation copy.

### DCC-006: Notification target role legacy inference should be reviewed

- File path: `apps/api/src/notifications/notification-target-role.ts`, `apps/api/src/matching/matching.policy.ts`
- Module/page/service name: Notification target role / matching policy compatibility
- Issue type: old policy code
- Severity: low
- Current behavior: compatibility helpers infer target role and keep older notification/provider naming paths.
- Why it matters: FCM is the official push system and role-bound targeting is required.
- Risk to speed/cost/business correctness: notification misrouting risk if legacy inference masks missing explicit target roles.
- Recommended fix: require explicit target role for newly created notifications and keep inference only for old records.
- Safe now or human approval: safe now if new writes are explicit and old records still read.
- Suggested test or smoke check: notification creation tests require target role; old seeded notification still renders.

### DCC-007: Historical tip fields exist only in old migrations

- File path: `apps/api/prisma/migrations/20260518134730_init/migration.sql`, `apps/api/prisma/migrations/20260601113000_remove_tip_fields/migration.sql`
- Module/page/service name: Prisma migration history
- Issue type: obsolete MVP feature in historical migration
- Severity: low
- Current behavior: old migration history contains tip fields, and a later migration removes them.
- Why it matters: tip is removed from MVP, but migration history should remain immutable.
- Risk to speed/cost/business correctness: low; only a documentation/reader confusion risk.
- Recommended fix: do not edit historical migrations. Keep active schema and docs tip-free.
- Safe now or human approval: do not change.
- Suggested test or smoke check: Prisma schema check confirms active models do not expose tip fields.

### DCC-008: Older Partner acceptance documentation conflicts with wallet authority

- File path: `docs/architecture/partner-acceptance-operations.md`
- Module/page/service name: Partner acceptance documentation
- Issue type: old policy documentation
- Severity: medium
- Current behavior: the document includes wording that can be read as stricter negative-wallet blocking than the current master authority.
- Why it matters: booking/matching work depends on exact wallet gate semantics.
- Risk to speed/cost/business correctness: business correctness risk if developers implement from stale doc text.
- Recommended fix: update the document to defer to the current final authority and separate visibility, participation, final acceptance, start, and payout gates.
- Safe now or human approval: human approval recommended because it clarifies business policy.
- Suggested test or smoke check: policy doc review plus tests for each wallet-gated stage.

### DCC-009: Franchise/shop and referral references should stay outside MVP paths

- File path: `docs/apk-analysis/*`, `docs/architecture/master-progress-roadmap.md`
- Module/page/service name: Historical analysis and roadmap docs
- Issue type: later-phase feature references
- Severity: low
- Current behavior: historical docs mention franchise/shop, referrals, or other later-phase ideas.
- Why it matters: current MVP excludes franchise/shop, and referral is later-phase unless already safely implemented.
- Risk to speed/cost/business correctness: scope creep and Admin menu clutter risk.
- Recommended fix: keep historical docs as archive, but do not implement or expose these modules in MVP navigation.
- Safe now or human approval: safe now for documentation labels; approval required before feature work.
- Suggested test or smoke check: Admin navigation smoke should not show franchise/shop MVP routes.

## Deletion Rule

No candidate should be deleted without a small PR/commit that proves:

1. Current usage search is clean.
2. A route or API compatibility decision is documented.
3. Relevant smoke tests pass.
4. The change does not alter protected business behavior without approval.
