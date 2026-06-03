# HANDS MVP Master Progress Roadmap

Last checked: 2026-06-03

This is the single working board for day-to-day MVP execution. If this file conflicts with `docs/architecture/hands-mvp-final-authority.md`, the final authority file wins.

## How To Use This Board

- Read this file before starting a new feature.
- Do not add major behavior by inference. Propose the direction, explain the best option, then wait for owner confirmation.
- Keep every implementation small enough to review, test, commit, and push as one stable step.
- Prefer updating an existing focused document over creating another overlapping planning note.
- Do not move old deferred work forward silently. If a dependency is missing, report it and either fix it or keep it listed here.

## Product Authority Snapshot

- HANDS is an address-based, profile-first, on-demand partner marketplace for Vietnam.
- Supabase is infrastructure; NestJS is the business authority.
- Customers can browse partners from any country, but booking creation requires a confirmed service address in an active service area.
- Booking creation requires an immutable `BookingAddressSnapshot`.
- First-pick partner response window is 10 minutes by default.
- Marketplace participation uses booking-address distance, 10km by default.
- Customer always selects the final partner. There is no automatic assignment.
- MVP has no scheduled booking, tip, gratuity, VIP, people-scoring, ranking, or dispatch-priority system.
- Negative partner wallet keeps marketplace visibility but blocks marketplace participation and downstream booking gates until settlement.
- Admin is an Operations Command Center, not CRM.
- Visible product/admin/mobile copy should say Partner. Internal DB/API names may still use Provider for compatibility.

## Collaboration Protocol

For each next feature, present:

1. The problem we are solving.
2. Two or three implementation options.
3. The recommended option and why it is safest.
4. What will change in API, Admin, mobile, docs, and tests.
5. What will remain deferred.

Implement only after the owner accepts the direction. Small bug fixes, verification, and policy guard fixes can be done directly when they preserve the accepted direction.

## Status Legend

- Done: implemented, tested, committed, and pushed.
- Active: current MVP area that can continue after owner confirms the next slice.
- Decision needed: product or operations rule needs owner choice before implementation.
- External wait: account, credential, DNS, vendor approval, or production setting is required.
- Later: valid feature, but intentionally outside MVP phase.

## Current Technical Baseline

Known checks used for stable steps:

```powershell
npm.cmd run setup:doctor
npm.cmd run authority:check
npm.cmd run api:policy-coverage
npm.cmd run api:domain-smoke
npm.cmd run security:secrets
npm.cmd run typecheck
npm.cmd run build --workspace @massage-vn/api
npm.cmd run build --workspace @massage-vn/admin-web
npm.cmd run mobile:architecture:check
npm.cmd run mobile:visible-copy
flutter analyze .\apps\customer_app
flutter analyze .\apps\provider_app
```

Full local smoke needs Docker PostgreSQL and Redis:

```powershell
docker compose up -d
npm.cmd run local:start
node infra/scripts/api-smoke.mjs
node infra/scripts/admin-web-smoke.mjs
```

External setup status:

```powershell
npm.cmd run external:check
npm.cmd run external:check:maps
npm.cmd run external:check:supabase
npm.cmd run external:check:payments
npm.cmd run external:check:production
```

## Progress Board

| Area | Status | Current state | Next decision |
| --- | --- | --- | --- |
| Monorepo and GitHub workflow | Done | Repo is under `hands-platform/hands-app`, branch `develop`, modular commit flow active. | None. Keep every stable step commit-ready. |
| Final authority guard | Done | Final MVP rules are documented and protected by `authority:check`. | None unless product policy changes. |
| Firebase removal | Done | Flutter apps no longer use Firebase as the active MVP path. | Decide production push provider timing separately. |
| Supabase core | Active | Supabase URL, anon, service role, JWT, schema/RLS pack are tracked. NestJS remains business authority. | Decide when to switch real mobile OTP to Supabase Phone Auth plus SMS. |
| Map/location | Active | MapTiler and Geoapify are configured locally; low-cost map path is active. | Decide when to replace remaining placeholder map visuals with final MapLibre screens. |
| Admin Operations Command Center | Active | Dashboard, bookings, customers, partners, services, policy, payments, refunds, earnings, payouts, cash settlements, notifications, chat archive, sessions, audit, setup are present. | Decide Admin information architecture consolidation before adding more pages. |
| Customers admin | Active | Customer list/detail exists with factual records. No customer scoring. | Decide which fields are must-show above the fold. |
| Partners admin | Active | Partner list/detail, KYC, wallet, payout, tax, device/session, document, activity evidence are present. | Decide whether to remove legacy `/providers` routes or keep as redirects only. |
| Booking and marketplace | Active | Address snapshot, first-pick, 10km marketplace, customer final selection, negative wallet blocking, chat evidence closeout are guarded by smoke tests. | Decide next audit slice: API policy consistency or mobile E2E consistency. |
| Payments and gateway callbacks | Active | Payment callback audit, payment detail view, gateway reference wording, capture/release/refund/cash settlement actions are present. | Decide gateway sandbox E2E order: MoMo first, VNPay first, or keep both deferred. |
| Cash fee debt and wallet | Active | Cash bookings can create partner company receivable; negative wallet blocks marketplace participation. | Decide exact operator settlement screen priority versus mobile partner debt UX. |
| Service pricing | Active | Admin service names, duration options, minimum price, price step, partner price, payout rules, and booking price snapshots are modeled. | Decide if service catalog should be frozen before final mobile UI. |
| Earnings and payouts | Active | Earnings, payout batches, payout holds, tax/fee logs, and payout pages exist. | Decide weekly/monthly/manual payout default for first Vietnam launch. |
| Chat archive | Active | Matched bookings open chat; admin keeps chat evidence. | Decide retention/export policy for disputes before production. |
| Notifications | Active | In-app notification path is active; push delivery abstraction exists. | External wait for OneSignal production E2E. |
| Mobile customer app | Active | MVP scaffold supports address, discovery, partner detail, booking, matching, final selection, chat, and maps. | Decide whether to audit mobile flow before Admin consolidation. |
| Mobile partner app | Active | MVP scaffold supports online/location, requests, marketplace, accept/start/chat/complete, earnings/wallet. | Decide partner debt UX wording and first login/onboarding flow. |
| Final design and localization | Later | Figma and multilingual customer/partner/admin copy are intentionally deferred. | Resume after backend/admin/mobile flows stop changing. |

## Decision Backlog

These items should be proposed to the owner before implementation.

1. Admin information architecture
   - Option A: keep all existing pages but add a stronger operations hub and redirects for legacy pages.
   - Option B: restructure navigation now and rename/remove legacy pages.
   - Recommended: Option A first. It reduces breakage while giving operators a clearer entry point.

2. Backend policy consistency pass
   - Option A: audit booking/matching/wallet/payment services first.
   - Option B: continue adding Admin depth first.
   - Recommended: Option A next if we want to reduce hidden rule drift.

3. Mobile E2E consistency pass
   - Option A: customer app first.
   - Option B: partner app first.
   - Option C: paired customer+partner booking walkthrough.
   - Recommended: Option C because booking only proves itself when both sides move together.

4. External production integrations
   - Option A: Supabase Phone Auth plus Vonage SMS first.
   - Option B: OneSignal push first.
   - Option C: MoMo/VNPay sandbox first.
   - Recommended: Phone Auth first only when we are ready to test real mobile login; otherwise keep local dev auth stable.

5. Legacy Provider wording/routes
   - Option A: keep internal names and only enforce visible Partner copy.
   - Option B: migrate route names and schema names.
   - Recommended: Option A for MVP. Full schema rename should be a separate migration after launch logic is stable.

## External Wait Board

Configured or locally usable:

- MapTiler API key
- Geoapify API key
- Supabase core values
- Local MinIO/S3-compatible storage path
- Local in-app notifications
- Local/dev OTP path

Deferred for production-like E2E:

- Supabase Phone Auth switch with `AUTH_BACKEND=supabase`
- Vonage SMS provider credentials
- OneSignal app id and server REST key
- MoMo merchant sandbox credentials
- VNPay merchant sandbox credentials
- Production storage/CDN values
- Final DNS/TLS/deployment cutover
- Production Android release signing verification

## Recommended Next Work Queue

Do not implement these automatically. Propose the selected slice first, then proceed after owner confirmation.

1. Backend policy consistency pass
   - Check booking creation, first-pick, marketplace join, customer final selection, negative wallet gates, payment callbacks, and closeout actions against final authority.

2. Admin information architecture proposal
   - Consolidate current pages into Operations, People, Money, Policy, Evidence, and Setup groups without deleting working pages.

3. Mobile paired E2E audit
   - Walk customer and partner apps through one booking from address selection to chat and completion.

4. Cash settlement UX proposal
   - Align partner negative wallet messaging, company receivable records, settlement actions, and partner app blocked participation message.

5. External integration plan
   - Prepare exact account/credential checklist for Vonage, OneSignal, MoMo, VNPay, storage/CDN, and deployment.

## Code Rules

- Keep code short, current, and modular.
- Keep UI code, API calls, business policy, and data mapping separate.
- Do not hardcode tax rates, fee rules, marketplace radius, first-pick windows, or payout cycles in UI.
- Do not add scoring, VIP, gratuity, ranking, or automatic dispatch logic.
- Do not expose secrets in code, docs, screenshots, or generated files.
- Use existing repo patterns before adding new abstractions.
- Update smoke tests when a policy or visible Admin route changes.

## Definition Of Done

Every stable step should end with:

- Narrow code/doc scope.
- Relevant typecheck/build/test/smoke pass.
- `npm.cmd run authority:check` pass when policy or visible copy changes.
- `npm.cmd run security:secrets` pass before commit.
- Commit pushed to `develop`.
- This roadmap updated only when status, decision backlog, or work order changes.
