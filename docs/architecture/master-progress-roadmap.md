# HANDS MVP Master Progress Roadmap

Last checked: 2026-06-16

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
- First-pick valid acceptance can match first; otherwise the customer selects from participating partners. There is no automatic nearest-partner assignment.
- MVP has no scheduled booking, tip, gratuity, VIP, people-scoring, ranking, or dispatch-priority system.
- Negative partner wallet keeps marketplace visibility and participation open, but blocks final acceptance, service start, and payout release until settlement.
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
npm.cmd run policy:coverage
npm.cmd run api:test
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
npm.cmd run api:smoke
npm.cmd run admin:web-smoke:critical
node infra/scripts/admin-web-smoke.mjs
```

Use `npm.cmd run admin:web-smoke:critical` during daily development for the high-signal Operations Command Center routes. Keep the full Admin smoke for larger Admin route changes, release checks, and overnight/full verification windows.

External setup status:

```powershell
npm.cmd run external:check
npm.cmd run external:check:maps
npm.cmd run external:check:supabase
npm.cmd run external:check:payments
npm.cmd run external:check:production
```

## Progress Board

| Area                            | Status | Current state                                                                                                                                                                                                                                                                                                                                                                             | Next decision                                                                                       |
| ------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Monorepo and GitHub workflow    | Done   | Repo is under `hands-platform/hands-app`, branch `develop`, modular commit flow active.                                                                                                                                                                                                                                                                                                   | None. Keep every stable step commit-ready.                                                          |
| Final authority guard           | Done   | Final MVP rules are documented and protected by `authority:check`.                                                                                                                                                                                                                                                                                                                        | None unless product policy changes.                                                                 |
| Firebase scope                  | Active | Firebase is allowed only for FCM push. Firebase DB/Auth/Firestore remain outside MVP. Firebase Admin credentials and mobile Android configs are aligned for the current FCM smoke path.                                                                                                                                                                                                   | Decide production FCM rollout timing separately.                                                    |
| Supabase core                   | Active | `hands-staging` was restored on 2026-07-14. Core URL/key checks pass, the exact Partner-location and default PostgREST privilege patches are applied remotely, anonymous table/RPC access is denied, service-role access remains available, real Customer Phone Auth plus Nest exchange passed, and the same identity was linked to an approved Partner profile with Supabase role sync. NestJS remains business authority. | Register a Vietnam SMS sender and complete fresh Partner OTP verify plus `/provider/me` before any broad mobile auth rollout. |
| Map/location                    | Active | MapTiler and Geoapify are configured locally; `external:check:maps` and the live style/geocoding check pass.                                                                                                                                                                                                                                                                              | Decide when to replace remaining placeholder map visuals with final MapLibre screens.               |
| Admin Operations Command Center | Active | Dashboard, bookings, customers, partners, services, policy, payments, refunds, earnings, payouts, cash settlements, notifications, chat archive, sessions, audit, setup are present. Sidebar IA now groups existing routes into Command, Bookings, Partners, Customers, Finance, Policy, Evidence/System without deleting pages. Date-range `Today` filters use the Vietnam business day. | Continue adding depth inside existing command lanes before creating new top-level pages.            |
| Customers admin                 | Active | Customer list/detail exists with factual records. No customer scoring.                                                                                                                                                                                                                                                                                                                    | Decide which fields are must-show above the fold.                                                   |
| Partners admin                  | Active | Partner list/detail, KYC, wallet, payout, tax, device/session, document, activity evidence are present. Legacy `/providers` routes stay as redirects only.                                                                                                                                                                                                                                | Continue improving partner list/detail depth without rebuilding separate partner-risk pages.        |
| Booking and marketplace         | Active | Address snapshot, first-pick, 10km marketplace, customer final selection, negative wallet blocking, chat evidence closeout, and Admin/API policy-default consistency are guarded. Admin booking detail keeps actual participant records as evidence and does not list wallet-debt partners as booking-level candidates.                                                                   | Decide next audit slice: mobile paired E2E consistency or payment/settlement gateway audit.         |
| Payments and gateway callbacks  | Active | Payment callback audit, payment detail view, gateway reference wording, capture/release/refund/cash settlement actions are present.                                                                                                                                                                                                                                                       | Decide gateway sandbox E2E order: MoMo first, VNPay first, or keep both deferred.                   |
| Cash fee debt and wallet        | Active | Cash bookings can create partner company receivable; negative wallet keeps marketplace requests visible and participation open, but blocks final acceptance, service start, and payout release until settlement or approved offset. Partner app warning copy is aligned.                                                                                                                  | Decide finance SLA and deposit evidence requirements for production operations.                     |
| Service pricing                 | Active | Admin service names, duration options, minimum price, price step, partner price, payout rules, and booking price snapshots are modeled.                                                                                                                                                                                                                                                   | Decide if service catalog should be frozen before final mobile UI.                                  |
| Earnings and payouts            | Active | Earnings, payout batches, payout holds, tax/fee logs, and payout pages exist.                                                                                                                                                                                                                                                                                                             | Decide weekly/monthly/manual payout default for first Vietnam launch.                               |
| Chat archive                    | Active | Matched bookings open chat; admin keeps chat evidence.                                                                                                                                                                                                                                                                                                                                    | Decide retention/export policy for disputes before production.                                      |
| Notifications                   | Active | In-app notification path is active; FCM delivery abstraction exists; registered-device FCM live smoke has sent a non-payment notification, token registration/recovery smokes pass against the local API/DB, and the Admin FCM readiness card links audit evidence.                                                                                                                       | Decide production FCM rollout timing separately.                                                    |
| Mobile customer app             | Active | MVP scaffold supports address, discovery, partner detail, booking, matching, final selection, chat, and maps.                                                                                                                                                                                                                                                                             | Decide whether to audit mobile flow before Admin consolidation.                                     |
| Mobile partner app              | Active | MVP scaffold supports online/location, requests, marketplace, accept/start/chat/complete, earnings/wallet, and negative-wallet final acceptance/service-start blocking.                                                                                                                                                                                                                      | Decide first login/onboarding flow before final mobile UI pass.                                     |
| Final design and localization   | Later  | Figma and multilingual customer/partner/admin copy are intentionally deferred.                                                                                                                                                                                                                                                                                                            | Resume after backend/admin/mobile flows stop changing.                                              |

## Decision Backlog

These items should be proposed to the owner before implementation.

1. Admin information architecture
   - Decision: Option A is active. Keep all existing pages, strengthen the operations sidebar and hub, and avoid route deletion during MVP.
   - Next: add depth inside existing lanes before introducing new top-level pages.

2. Backend policy consistency pass
   - Current: booking/matching/wallet smoke coverage exists, and `policy:coverage` now also checks Admin operations policy defaults against the NestJS policy source.
   - Next: payment callbacks, settlement closeout, or mobile paired E2E can be audited as the next focused slice.

3. Mobile E2E consistency pass
   - Option A: customer app first.
   - Option B: partner app first.
   - Option C: paired customer+partner booking walkthrough.
   - Recommended: Option C because booking only proves itself when both sides move together.

4. External production integrations
   - Option A: Supabase Phone Auth plus Vonage SMS first.
   - Option B: FCM push first.
   - Option C: MoMo/VNPay sandbox first.
   - Current: FCM push smoke, Supabase JWT API exchange smoke, real Customer Phone Auth plus Nest exchange, and Partner local linking/approval/Supabase role sync pass. The final Partner OTP exchange is externally blocked because Vonage Vietnam delivery fell back to voice and repeated sends did not arrive.
   - Owner decision (2026-07-14): defer server purchase, public hosting, DNS/TLS, live Partner OTP delivery, payment gateway sandbox E2E, and store-link E2E until local product completeness is at least 95%.
   - Recommended: keep every external integration fail-closed and disabled while local product work continues. Resume with hosting and DNS/TLS first, then Partner OTP delivery, payment callbacks, and store-link E2E.

5. Legacy Provider wording/routes
   - Option A: keep internal names and only enforce visible Partner copy.
   - Option B: migrate route names and schema names.
   - Recommended: Option A for MVP. Full schema rename should be a separate migration after launch logic is stable.

## External Wait Board

Configured or locally usable:

- MapTiler API key with live style check passing
- Geoapify API key with Vietnam geocoding check passing
- Supabase core values
- Supabase JWT API exchange smoke and role-boundary contract
- Supabase Phone Auth Customer OTP send/verify and Nest exchange path with `AUTH_BACKEND=supabase`
- Vonage credentials for the current Phone Auth OTP send smoke
- FCM project config, Firebase Admin server credentials, and Android client configs
- Registered-device FCM live smoke for a non-payment notification
- FCM token registration and token recovery smoke against local API/DB
- Local MinIO/S3-compatible storage upload/read smoke passing
- Local in-app notifications
- Local/dev OTP path
- Customer and Partner Android upload keystores, read-only alias validation, and independently signed release APK/AAB builds

Deferred until local product completeness is at least 95% and server purchase begins:

- Vonage `HANDS` sender registration for Vietnam, or a switch to an approved Vietnam SMS provider through the Supabase Send SMS Hook, followed by fresh Partner OTP verify and `/provider/me`
- MoMo merchant sandbox credentials
- VNPay merchant sandbox credentials
- Production storage/CDN values
- Final DNS/TLS/deployment cutover

The read-only production network smoke is available as `npm.cmd run external:check:network`. Do not treat its expected DNS failure as an active local-development defect before server purchase. Resume it at the 95% release-readiness gate; it checks DNS resolution, TLS certificate validity, HTTPS-only redirects, public/Admin roots, and API `/api/health/ready` including database and Redis readiness.
- Play Console app creation, upload-key fingerprint registration, and production AAB upload verification

## Recommended Next Work Queue

Do not implement these automatically. Propose the selected slice first, then proceed after owner confirmation.

1. Backend policy consistency pass
   - Check booking creation, first-pick, marketplace participation, customer final selection, negative wallet gates, payment callbacks, and closeout actions against final authority.

2. Admin lane depth
   - Continue improving existing Command, Bookings, Partners, Customers, Finance, Policy, and Evidence/System lanes without deleting working pages.

3. Mobile paired E2E audit
   - Walk customer and partner apps through one booking from address selection to chat and completion.

4. Cash settlement operations proposal
   - Decide production finance SLA, accepted deposit evidence, admin offset approval rule, and customer-support wording for partner settlement delays.

5. External integration plan (deferred until 95% local completeness)
   - At the release-readiness gate, prepare the exact server, DNS/TLS, Vonage or Vietnam SMS provider, MoMo, VNPay, storage/CDN, Play Console, and deployment checklist.

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
