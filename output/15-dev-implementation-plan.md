# Dev Implementation Plan

## Principle
- Keep current monorepo, NestJS, Prisma, PostgreSQL/PostGIS, Redis, BullMQ, Flutter, Next.js admin.
- Do not rebuild working modules.
- Move feature by feature, with small commit-ready changes.
- Do not silently skip errors.

## MVP Completion Order
1. Align product docs and admin wording around Partner.
2. Keep booking/matching policy configurable in Admin.
3. Finish customer/partner detail admin pages with factual activity records.
4. Stabilize service type + duration + price policy.
5. Stabilize platform fee, tax, cash debt, payout ledger.
6. Add customer list/detail operational depth.
7. Add partner list/detail operational depth.
8. Add chat archive by booking/customer/partner.
9. Add notification delivery diagnostics.
10. Add setup checklist for external services.

## Phase 2
1. Supabase Auth/PostgreSQL/Storage migration by domain.
2. MapTiler + Geoapify location UX hardening.
3. OneSignal or other push provider.
4. Storage policies and document upload review loop.
5. Admin exports and filtered reports.

## Phase 3
1. Final Figma-driven UI polish.
2. Full multilingual copy.
3. Production payment integrations.
4. CDN/storage optimization.
5. Deep link production routing.

## Verification Commands
```powershell
cd C:\dev\massage-vn-workspace\repo
npm.cmd run typecheck --workspace @massage-vn/api
npm.cmd run typecheck --workspace @massage-vn/admin-web
npm.cmd run build --workspace @massage-vn/api
npm.cmd run build --workspace @massage-vn/admin-web
node infra\scripts\admin-web-smoke.mjs
flutter analyze apps\customer_app
flutter analyze apps\provider_app
```

## External Setup Backlog
- hands.vn DNS records
- Supabase production/staging credentials
- MapTiler key
- Geoapify key
- OneSignal or push provider
- Vonage phone OTP
- MoMo/VNPay merchant keys
- R2/S3 bucket credentials
