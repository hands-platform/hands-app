# Local 95% Checkpoint Plan

Updated: 2026-07-30

## Baseline

- Branch: `develop`
- Base commit: `c9185793e`
- Working tree before this checkpoint plan: 837 entries
  - 487 modified
  - 184 deleted
  - 166 untracked
- Existing user work must be preserved.
- Do not create commits automatically. Stage and commit a unit only after its required gates pass.
- Use `git add -p` for cross-cutting files such as `admin.service.ts`, `admin-api.ts`, `globals.css`,
  root scripts, environment templates, and shared contracts.

## Repeatable Inventory

Run the inventory before staging any checkpoint:

```text
npm.cmd run checkpoint:inventory
npm.cmd run checkpoint:inventory:test
node infra/scripts/checkpoint-inventory.mjs --unit=03 --paths
```

The inventory expands untracked directories to individual files, assigns every changed path to one
or more checkpoint units, and fails when a path has no owner. Paths assigned to multiple units,
shared entry points, generated screenshots, and cross-cutting files are marked for manual hunk
review. Use `node infra/scripts/checkpoint-inventory.mjs --verbose` when the full manual-review list
is needed. Use `--unit=<01-09> --paths` to print a sorted path list for one checkpoint; cross-cutting
paths must still be staged by hunk.

Public Web files stay in Unit 06 with the Admin CMS surface that owns their content. Root lint,
workspace, CI, and repository-contract changes stay in Unit 09.

Current inventory:

```text
Changed paths: 1,266
Modified: 631
Deleted: 185
Untracked: 450
Unclassified: 0
Manual hunk review: 266
```

Checkpoint ownership counts are intentionally non-additive because cross-cutting files can belong
to more than one unit:

```text
01 Authority and static policy: 10
02 Database and shared contracts: 16
03 Identity, security, and notifications: 80
04 Booking marketplace lifecycle: 103
05 Finance lifecycle: 50
06 Admin operations surfaces: 549
07 Admin Finance and Analytics: 136
08 Customer and Partner apps: 142
09 Tooling, docs, and cleanup: 268
```

## Checkpoint Units

| Unit                                      | Scope                                                                          | Required verification                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| 01. Authority and static policy           | Final authority, visible-copy, route compatibility, category/write manifests   | `authority:check`, `mobile:visible-copy`, `policy:coverage`                                 |
| 02. Database and shared contracts         | Prisma schema/migrations, Supabase draft schema, shared types                  | `prisma validate`, `prisma migrate status`, `supabase:schema:check`, `verify:api:fast`      |
| 03. Identity, security, and notifications | Auth, refresh revocation, Admin session/realtime token, FCM and delivery retry | `security:secrets`, `security:admin-sensitive`, focused auth/notification tests             |
| 04. Booking marketplace lifecycle         | Booking, matching, locations, chat, cancellation, no-show, completion          | `verify:api:fast`, `verify:customer:fast`, `verify:provider:fast`, booking lifecycle smokes |
| 05. Finance lifecycle                     | Payments, refunds, GL, wallet, deposits, payouts, withholding, reconciliation  | `verify:api:fast`, Finance lifecycle matrix, debit/credit reconciliation                    |
| 06. Admin operations surfaces             | Start Shift, bookings, customers, partners, navigation, shared Admin controls  | `verify:admin:fast`, Admin critical smoke, Admin production build                           |
| 07. Admin Finance and Analytics           | Finance/Tax pages, Finance Overview, Usage/Partner/Marketing analytics         | `verify:admin:fast`, Admin API budget, relevant export and query tests                      |
| 08. Customer and Partner apps             | Mobile repositories, screens, notifications, session reporting, final copy     | both Flutter analyze/test gates, mobile architecture and visible-copy guards                |
| 09. Tooling, docs, and cleanup            | CI, smoke scripts, reachability cleanup, CSS removal supported by deleted UI   | `verify:full`, both production builds, `git diff --check`                                   |

## Verification Ledger

No checkpoint is staged or committed automatically. `VERIFIED_UNSTAGED` means its current focused
contract is green, but cross-cutting hunks still need explicit staging review.

| Unit | State                                | Latest evidence                                                                                                                                               |
| ---- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01   | `VERIFIED_UNSTAGED`                  | Authority, mobile visible-copy, policy coverage, route/category tests, and filesystem-wide KPI scope guard pass                                               |
| 02   | `VERIFIED_UNSTAGED`                  | Prisma schema valid, 72 migrations applied, Supabase schema guard and focused DB contracts pass; concurrent Partner wallet summary refresh is serialized      |
| 03   | `VERIFIED_UNSTAGED`                  | Mobile/Admin role isolation, refresh revocation, production storage fail-closed behavior, validated chat attachments, and logout push-token invalidation pass |
| 04   | `VERIFIED_UNSTAGED`                  | 35 changed API spec files / 967 tests pass; paired E2E, cancellation, no-show, availability, chat unread, and stale-smoke checks pass                         |
| 05   | `VERIFIED_WITH_POLICY_HOLD_UNSTAGED` | 36 Finance API files / 351 tests and the full local Finance lifecycle smoke matrix pass; automatic referral wallet credit remains an explicit policy hold     |
| 06   | `VERIFIED_UNSTAGED`                  | 804 Admin files / 4,091 tests, typecheck, lint, query/copy guards, production build, critical smoke, and strict route/API budgets pass                        |
| 07   | `VERIFIED_UNSTAGED`                  | 115 focused Admin files / 779 tests, 5 Analytics API files / 652 tests, exports, query guards, strict API/page budgets, and production runtime pass          |
| 08   | `VERIFIED_UNSTAGED`                  | Customer analyze/121 tests, Partner analyze/174 tests, mobile architecture/copy/foundation guards, and live app-usage event smoke pass                       |
| 09   | `VERIFIED_UNSTAGED`                  | Full local verify passes: Admin 4,091 tests, both mobile suites, API/Admin builds, static security/policy guards, and Docker config                           |

## Promotion Rules

1. A unit may be staged only when its focused tests pass.
2. Cross-cutting files are staged by hunk with the unit whose behavior they change.
3. Deleted source and its dedicated tests/CSS move in the same unit.
4. Compatibility routes `/files`, `/providers`, and `/providers/[id]` remain until access evidence
   supports removal.
5. No database reset, forced seed, production environment change, or external rollout belongs in a
   local checkpoint.
6. Unit 09 is the integration checkpoint and must leave `verify:full`, API build, and Admin build
   green before the local product is called 95% complete.

## Deferred Release Unit

Server purchase, DNS/TLS, production SMS, MoMo/VNPay merchant sandbox, production FCM, storage/CDN,
Play Console upload, managed monitoring, and backup/restore drills remain outside these local units.

## 2026-08-03 Booking Marketplace Regression Checkpoint

Completed locally without staging or committing:

- Fixed the marketplace Partner join runtime failure caused by sending the parent `bookingId` inside
  Prisma's nested participant `create`; the parent booking relation now supplies it.
- Late customer selection, Partner join, and Partner response requests now return `409` with the
  latest safe booking state instead of a generic stale-screen error.
- Booking timeout tests now pin the match-versus-timeout winner and retry payment release without
  emitting the expiry event twice.
- The post-match cancellation smoke uses its fixture Admin identities and explicit category grants,
  so an expired shared `ADMIN_ACCESS_TOKEN` cannot invalidate the local evidence.

Verification evidence:

```text
Focused API booking/timeout tests: 3 files / 59 tests passed
API fast gate: 154 files / 1,895 tests passed; Prisma, policy, realtime, typecheck, and lint passed
Customer booking/realtime tests: 42 passed
Partner booking/chat/push tests: 35 passed
Admin booking monitor/detail/cancellation tests: 4 files / 26 tests passed
Customer/Partner paired E2E: booking, participation, selection, chat, arrival, start, completion,
  availability, balanced journal, cash capture, and settlement snapshot passed
Cash/wallet lifecycle: pre-match cancellation, no-show review, wallet reservation concurrency,
  coupon accounting, refund reversal, and cash debt reconciliation passed
Post-match cancellation: wallet/card/cash approve and hold paths passed; captured-card duplicate
  refund returned 409 with one persisted refund
Payment lifecycle: MoMo/VNPay callback replay, Card closed-period reversal, monthly close, and
  withholding export passed with local gateway fixtures
```

## 2026-07-28 Integration Checkpoint

Completed locally:

- Final authority now accepts the page-based `/providers` compatibility redirect and contract-based
  Partner ledger coverage.
- Mobile visible-copy checks production `lib` UI copy without treating internal keys or test names
  as user-visible text.
- Customer/Partner paired booking smoke covers discovery, matching, chat, completion, availability,
  balanced accounting, cash capture, and settlement snapshot persistence.
- Finance smokes cover payment settlement, cash debt, manual wallet adjustment, Partner bank
  deposit, referral cashout/withholding, withdrawal, payout reversal, and remittance.
- Local demo login and fallback booking locations are debug-only and guarded by mobile architecture
  checks.
- Customer/Partner Flutter analyze and complete test suites pass.
- API auth, IDOR, payment replay/refund, Admin fail-closed permission, Supabase schema, and static
  location-exposure regressions pass.
- Admin runtime cleanup remains bounded: operator pages use summary projections by default,
  Developer diagnostics require explicit access, and the runtime import audit has only the documented
  compatibility/test-only candidates.
- Prisma migration contract checks all migration directories, the PostgreSQL lock provider,
  executable SQL, and duplicate SQL before CI can proceed.
- CI now runs authority/security/policy/mobile contracts, migration validation, both Flutter apps,
  and a PostGIS/Redis-backed paired lifecycle smoke.

Latest local integration and security results:

```text
API fast gate: 150 files / 1,777 tests passed; typecheck and lint passed
Admin fast gate: 804 files / 4,091 tests passed; typecheck, lint, query and copy guards passed
Customer app: Flutter analyze and 121 tests passed
Partner app: Flutter analyze and 174 tests passed
Prisma: 72 migrations valid and local database up to date
API production build: passed
Admin production build: passed, 98 routes generated (77 pages and 21 API routes)
Production npm audit: 0 vulnerabilities
Paired lifecycle smoke: passed, including balanced journal and settlement snapshot
```

### Unit 01 Authority and Static Policy Evidence

The authority and static-policy checkpoint is locally verified. No files are staged or committed.

```text
Focused Admin route, navigation, access, and KPI tests: 4 files / 17 tests passed
Final authority guard: passed
Mobile visible-copy guard: 194 production Dart files and 2 text files checked, 0 violations
API policy coverage and Admin/API policy consistency: passed
Checkpoint inventory: 1,216 changed paths, 0 unclassified
```

The KPI scope test walks the Admin application filesystem directly, so new untracked `.tsx` source
files are covered before they are added to Git. Spec and test files remain excluded from visible UI
scope enforcement.

#### Unit 01 Promotion Manifest

Unit 01 is a contract checkpoint, not a standalone first commit. Its nine changed files are green,
but each guard must be promoted with or after the implementation it asserts:

```text
Unit 06: admin-kpi-scope-guard.spec.ts
Unit 06: admin-page-shell-inventory.spec.ts
Unit 06: admin-navigation.ts + admin-navigation.spec.ts
Unit 05/06: admin-operator-access-model.spec.ts
Unit 04/05: check-api-policy-coverage.mjs
Unit 08: check-mobile-visible-copy.mjs
Unit 04/06: check-operations-policy-consistency.mjs
Unit 09, after implementation units: check-final-authority.mjs
```

Do not stage these nine files as an isolated commit. The focused contract is:

```text
Admin route/navigation/access/KPI tests: 4 files / 17 tests passed
Final authority, mobile visible-copy, and policy coverage: passed
Unit 01 diff integrity: passed
Git index: unchanged
```

### Unit 02 Database and Shared Contract Evidence

The database and shared-contract checkpoint is locally verified. No files are staged or committed.

```text
Prisma schema validation: passed
Prisma migration contract: 72 migrations valid; local database up to date
Supabase schema guard: 21 enum checks, 39 required tables, and 39 RLS tables passed
Focused app usage, Partner availability, and wallet summary tests: 5 files / 24 tests passed
Installed wallet summary function: advisory transaction lock confirmed
Manual wallet adjustment lifecycle: ledger, journal, and Partner balance summary remained synchronized
Wallet summary concurrency smoke: concurrent inserts and mixed insert/update/delete mutations passed
API typecheck: passed
```

The app-usage daily backfill is idempotent in `Asia/Ho_Chi_Minh`, Provider availability transitions
restore the original Partner schedule after smoke, and the wallet summary trigger remains correct
under concurrent inserts and mixed mutations. The two existing `20260701093000_*` migrations share
a timestamp but are independent and deterministically ordered by full directory name; renaming an
applied migration would be less safe than retaining the warning.

The original wallet summary migration remains immutable because it was already applied locally. A
follow-up migration replaces only the refresh function and serializes one Partner/currency bucket
with a transaction-scoped PostgreSQL advisory lock before recomputing the ledger aggregate. The
permanent concurrency smoke uses eight independent Prisma clients and removes all fixtures after
checking the final balance, entry count, and latest-entry timestamp against the source ledger.

#### Unit 02 Promotion Manifest

Promote the Prisma schema with its six additive migrations as one database checkpoint:

```text
schema.prisma
20260718090000_add_partner_bio_translations_and_media_order
20260718233000_add_app_usage_events
20260719013000_add_app_usage_daily_aggregates
20260719033000_add_provider_availability_schedule
20260719133000_add_provider_wallet_balance_summary
20260728113000_serialize_provider_wallet_balance_summary_refresh
```

Promote `packages/shared-types/src/index.ts` with the Unit 04 realtime implementation that consumes
`provider.arrived`. Keep the Supabase README, schema snapshots, and the two restrictive policy
patches together as reviewed deployment artifacts; do not apply them to a live project before the
server rollout and anonymous-access regression smoke.

```text
Prisma and local database contract: passed
App usage backfill: 5 tests passed
App usage live smoke: passed
Provider availability lifecycle smoke: passed and fixtures restored
Wallet summary concurrency smoke: passed and fixtures removed
Unit 02 focused API tests: 5 files / 24 tests passed
Git index: unchanged
```

### Unit 03 Identity, Security, and Notification Evidence

The identity, storage, chat attachment, and notification-device checkpoint is locally verified. No
files are staged or committed.

```text
Focused auth/file/chat/notification tests: 9 files / 117 tests passed
API fast gate: 150 files / 1,777 tests passed; typecheck and lint passed
Customer app: Flutter analyze and 86 tests passed
Partner app: Flutter analyze and 158 tests passed
Secret scan: 2,652 files checked, 0 violations
Admin-sensitive exposure guard: passed
Mobile architecture and visible-copy guards: passed
Production dependency audit: 0 vulnerabilities
```

The mobile identity boundary now prevents OTP, refresh, or Supabase exchange from inheriting stored
Admin roles. Dual Customer/Partner memberships remain in the database, while each mobile access and
refresh token carries only its selected active role. Existing Supabase-ID and phone collisions with
Admin operator accounts fail closed.

#### 2026-07-29 Security Refresh

Unit 03 currently owns 78 changed paths: 59 modified, 2 deleted, and 17 untracked. Thirty-two paths
cross into Admin operations, booking policy, or deployment tooling and therefore require manual
hunk review before staging. No files were staged or committed automatically.

```text
API fast gate: 153 files / 1,844 tests passed; typecheck and lint passed
Focused API auth, file, notification, and middleware security: 14 files / 143 tests passed
Focused Admin session and realtime security: 7 files / 43 tests passed
Admin category and route guards: 4 files / 28 tests passed
Customer and Partner mobile analyze/test gates: passed
Admin category guard: read/write routes fail closed when no category is mapped
Admin realtime token: scoped Socket token accepted; broad Admin REST token rejected
Supabase schema guard: published-only public reviews and no direct browser Storage writes
Rate limits: auth, public discovery, and payment callbacks covered
Secret, Admin-sensitive exposure, authority, and policy checks: passed
Production dependency audit: 0 vulnerabilities
```

The existing-project Supabase hardening SQL remains a deferred deployment artifact and was not
applied to a live project. Apply it only during the server rollout after taking a policy snapshot
and running the live anonymous-access regression checks.

Placeholder file storage remains a local-development convenience only. Production upload, private
read, completion, and deletion require configured S3-compatible storage. Private owners can obtain
signed reads, and the other booking participant can read a chat attachment only after a persisted
message links that validated, uploaded, private `CHAT_ATTACHMENT` file. Client-defined attachment
URLs and metadata are rejected.

Customer and Partner apps now disable the current remote FCM device token on explicit logout before
clearing local credentials. Local sign-out still completes when the API is unavailable, and
in-app-only development tokens are never sent to the disable endpoint.

#### Unit 03 Promotion Manifest

The API auth, file-storage boundary, rate limiting, notification policy, delivery queue, and health
changes form the Unit 03 security checkpoint. Keep their focused specs beside the implementation.

Do not promote the following cross-cutting paths as isolated Unit 03 files:

```text
Admin notification UI and realtime-token route/lib: promote with Unit 06
Admin controller/service/DTO/module and every admin-*.routes.ts class: promote as one route-chain
Customer notification policy used by Booking events: promote after Unit 04
Mobile logout/device-token handling: promote with Unit 08
nginx.conf and fcm-push-smoke.mjs: promote with Unit 09
Deleted notification command-header component/spec: promote with the Unit 06 notification cleanup
```

The Admin route classes are a single inheritance chain from customer routes through catalog routes.
Splitting that chain by domain would create non-compiling intermediate commits, so it must be
promoted only after the Unit 04, 05, and 07 route implementations are ready.

```text
Secret scan: 2,652 files, 0 violations
Admin-sensitive exposure guard: passed
Unit 03 focused tests: passed
Live Supabase, SMS OTP, FCM, and device checks: deferred until server rollout
Git index: unchanged
```

### Unit 04 Booking Marketplace Lifecycle Evidence

The Booking lifecycle checkpoint is locally verified. No files are staged or committed.

```text
Changed Booking/Admin/API specs: 35 selected specs; Vitest 36 files / 968 tests passed
Customer/Partner paired E2E: discovery, selection, matching, chat, arrival, start, completion passed
Post-match cancellation: wallet, card, and cash approval/hold paths passed
Cash lifecycle: cancellation, no-show, completion, refund, coupon, wallet, and debt settlement passed
Provider chat unread lifecycle: room isolation, opened-room clearing, and cleanup passed
Provider availability lifecycle: ready, schedule hold, busy, completion restore, and manual off passed
Stale smoke booking check: 0 records
```

The cash, Partner deposit, and withdrawal smokes now follow the production bank reconciliation
controls: every manual bank row includes an operator reason, an eligible review owner is assigned,
and a different signed-in Finance approver performs match, reverse, or ignore decisions. Request
body `approvalAdminId` values are not treated as proof of approval.

The cash lifecycle fixture now grants its maker and approver only the Admin detail categories used
by their no-show, refund, wallet deposit, and bank reconciliation requests. This keeps the
fail-closed category guard active instead of bypassing it with a master role.

#### Unit 04 Promotion Manifest

Promote Unit 04 in dependency order:

```text
04A Partner profile, onboarding media, public readiness, availability, and working hours
04B Customer discovery, favorites, profile views, attribution, and app-usage aggregates
04C Booking, matching, chat, location, cancellation reason, and customer notification policy
04D Admin Booking/Customer/Partner query projections and route implementations
04E Lifecycle and stale-fixture smoke scripts
```

`customer-wallet-payment.ts` crosses into Finance and must be promoted with Unit 05. The Admin
controller/service/DTO/module and the complete `admin-*.routes.ts` inheritance chain must be
promoted together after Units 04, 05, and 07. Smoke scripts belong in Unit 09 after the API
implementations they exercise.

```text
Paired E2E, post-match cancellation, cash lifecycle, and chat unread smokes: passed
Provider availability smoke: passed and original state restored
Stale booking detector: 6 tests passed; 0 stale records
Unit 04 diff integrity: passed
Git index: unchanged
```

### Unit 05 Finance Lifecycle Evidence

The focused Finance checkpoint is locally verified. No Finance files are staged or committed.

```text
Changed Finance API specs: 13 files / 897 tests passed
Payment lifecycle smoke: MoMo, VNPay, card refund/reversal, monthly close, withholding CSV passed
Manual wallet adjustment smoke: balanced journals, immediate customer credit, reversal, closed-period guard, and Partner balance summary passed
Cash lifecycle smoke: no-show, refund, coupon, customer wallet, debt deposit, and bank match passed
Partner bank deposit smoke: dual approval, allocation, bank reconciliation, reversal, monthly close gate passed
Referral money lifecycle smoke: credit, notification, cashout, withholding, reversal, idempotency passed
Provider withdrawal smoke: dual approval, paid/reversal journal, bank match, wallet restoration passed
Provider payout reversal smoke: monthly-close gates, exact reversal, wallet restoration passed
Withholding remittance smoke: declaration, payment, close, evidence, bank entry, reconciliation blockers passed
Withdrawal journal backfill tests: 3 tests passed
Stale smoke booking check: 0 stale records
```

Every manual bank transaction in the lifecycle matrix now records a bounded operator reason. A
Bank Reconciliation operator owns the review, while a different signed-in Finance approver performs
the monetary match, reverse, or ignore action. Batch import remains maker-only until explicit
assignment; client-supplied approval IDs do not create approval evidence.

Referral reward release intentionally remains a candidate-only transition:

- `releaseAvailableRewards` moves eligible rewards from `PENDING` to `AVAILABLE` without posting money.
- The audited Admin `credit` action performs the idempotent customer or Partner wallet ledger post,
  balanced referral journal, reward ledger linking, and customer notification.
- Automatic referral wallet credit remains disabled until product policy explicitly approves automatic
  money movement. This is a policy hold, not a missing ledger or accounting implementation.
- `referrals:wallet-credit-readiness` reports `blocked-by-candidate-only-release` and preserves this
  fail-closed contract.

Cold Admin Finance detail routes showed approximately 2.1-4.9 second response times during smoke
startup. Warm routes were substantially faster. Correctness is verified; payload and cold-render
performance remain Unit 07 work.

#### Unit 05 Promotion Manifest

Promote the Finance API in dependency order:

```text
05A Payment capture, callback idempotency, refunds, and customer wallet payment
05B Earnings, settlement snapshots, balanced journals, and reversal posting
05C Manual wallet adjustment, Partner deposit, withdrawal, and payout lifecycle
05D Referral credit, cashout, withholding, and reversal lifecycle
05E Admin Finance route implementations after the complete Admin route chain is ready
05F Finance lifecycle smoke and backfill checks with Unit 09
```

The Finance smoke actors now receive only the categories needed by each request path. This repaired
stale fixtures for payment clearing, Finance approval queue, Partner withdrawal, payout reversal,
General Ledger evidence, and tax summaries without weakening the production category guard.

```text
Finance API specs: 13 files / 897 tests passed
Payment, manual wallet, Partner deposit, referral, withdrawal, payout reversal, and withholding smokes: passed
Cash lifecycle smoke shared with Unit 04: passed
Withdrawal backfill: 3 tests passed
All modified smoke scripts: node --check passed
Git index: unchanged
```

### Unit 06 Admin Operations Surface Evidence

The Admin operations checkpoint is locally verified. No Admin files are staged or committed.

```text
Admin fast gate: 804 files / 4,091 tests passed
Admin typecheck and lint: passed
Admin query and visible-copy guards: passed
Admin navigation, permission, middleware, and route manifests: 9 files / 34 tests passed
Admin API read budget: all sampled endpoints passed
Admin production build: passed, 98 routes generated (77 pages and 21 API routes)
Admin critical smoke: 20 operating, compatibility, detail, and diagnostics routes passed
Admin strict route budget: 44 pages passed in production mode
Admin strict API read budget: all sampled list, summary, and detail endpoints passed
Local API and Admin production runtime: healthy on ports 3000 and 3101
```

The smoke contract now follows the current runtime boundaries:

- Start Shift verifies the summary-only operating surface and no longer expects removed
  `details=booking` or `details=operations` diagnostic workspaces.
- Partner detail verifies the default fast operations overview first, the complete one-page record
  through `section=full`, and the existing bookings, records, finance, and Developer diagnostics
  workspaces separately.
- Customer detail verifies the default chat evidence without loading system diagnostics, then
  verifies the protected `diagnostics=developer` system audit path separately.

The default Partner detail is 103 KB and the default Customer detail is 176 KB in the production
smoke. The explicitly requested complete Partner record is 265 KB and the Booking Developer
diagnostics view is 294 KB. These two non-default payloads are monitored exceptions and do not block
daily operator workflows.

#### Unit 06 Promotion Manifest

Promote the Admin operations surface in operator-flow order:

```text
06A Shared page shell, desktop-only gate, navigation, session, access model, and common queue controls
06B Start Shift, Operations Handoff, Calendar, Vietnam Overview, and Developer/System separation
06C Customer directory/detail, reviews, referrals, notifications, and audit notes
06D Partner directory/detail, KYC/media, services, and operating controls
06E Booking lists, monitor, detail, closeout, cancellation review, chat, and file evidence
06F Coupons, notification operations, policies, setup, audit log, and compatibility redirects
06G Dead component and CSS cleanup only with the replacement surface and its regression tests
```

Do not stage the 184 deleted files as a standalone cleanup. Booking owns 62 of those deletions,
Partner owns 26, and Services owns 26; each deletion must travel with the replacement page/model
that removed its last import. Promote the complete Admin API route inheritance chain only after the
Unit 04, 05, and 07 route implementations are present.

```text
Admin fast gate: 804 files / 4,091 tests passed
Admin typecheck, lint, query guard, and visible-copy guard: passed
Admin build and production smoke evidence: passed
Git index: unchanged
```

### Unit 07 Admin Finance and Analytics Evidence

The Admin Finance and Analytics checkpoint is locally verified. No files are staged or committed.

```text
Focused Admin Finance and Analytics tests: 115 files / 779 tests passed
Focused Analytics API tests: 5 files / 652 tests passed
Finance/Tax and customer activity export route contracts: passed in the focused Admin suite
Admin query guards: passed
Strict Admin API read budget: every sampled endpoint passed
Strict Admin production page budget: 44 pages passed
```

The strict production page budget now includes the three Analytics workspaces in addition to the
Finance and settlement surfaces:

```text
Usage Overview: 596 ms / 150 KB
Partner Overview: 303 ms / 216 KB
Marketing Analytics: 77 ms / 170 KB
Finance Overview: 111 ms / 135 KB
Finance/Tax landing: 64 ms / 120 KB
Payment Clearing: 85 ms / 168 KB
General Ledger: 57 ms / 111 KB
Bank Reconciliation: 141 ms / 249 KB
```

Finance lists, summaries, review-owner workloads, detail reads, payouts, withdrawals, wallet
adjustments, tax close, and analytics queries remain bounded by the shared API and page budget
contracts.

#### Unit 07 Promotion Manifest

Promote Finance and Analytics screens in this order:

```text
07A Finance Today: landing, approval queue, refunds, and current money-risk summaries
07B Money Movement: payments, clearing, wallet adjustments, Partner deposits, payouts, and cash debt
07C Accounting Records: General Ledger, settlement records, reversals, and coupon Finance
07D Tax and Close: monthly close, VAT, withholding, payment fees, bank accounts, and approvers
07E Analytics: Usage, Partner, Marketing, and Finance overviews with bounded trend/ranking queries
07F Finance/Analytics API projections, exports, and route classes after the full Admin route chain
```

Keep detail actions with their list/detail surface and its permission tests. Export routes must
travel with the corresponding bounded query projection. Do not separate Finance table components
from their filter/query models because the pagination and total-count contracts are tested together.

```text
Focused Admin Finance/Analytics: 56 files / 580 tests passed
Focused Admin Analytics API: 6 files / 696 tests passed
Strict page and API budget evidence: passed
Git index: unchanged
```

### Unit 08 Customer and Partner App Evidence

The Customer and Partner app checkpoint is locally verified. No mobile files are staged or
committed.

```text
Customer Flutter analyze: passed
Customer Flutter tests: 121 passed
Partner Flutter analyze: passed
Partner Flutter tests: 174 passed
Mobile architecture guard: 194 Dart files checked, 0 violations
Mobile visible-copy guard: 194 Dart string files and 2 text files checked, 0 violations
Mobile foundation smoke: Customer/Partner Android/iOS version contracts and FCM device registration passed
App-usage live smoke: APP_OPEN, SESSION_START, and PROVIDER_PROFILE_VIEW persistence and Admin aggregate reads passed
```

The architecture guard keeps Firebase usage limited to push infrastructure, prevents presentation
layers from importing Supabase, rejects global `Supabase.instance` access, and keeps local demo
controls behind debug-only access. Release configuration tests require remote HTTPS API/socket
endpoints and reject partial Supabase credentials.

The Customer booking login fallback now renders its local demo control only under the explicit
debug gate. The architecture check accepts that gate when combined with a stricter callback
condition, and active language labels remain compatible with the mobile visible-copy policy.

The app-usage smoke confirmed that locally persisted Customer and Partner activity reaches the
Admin analytics sources:

```text
Customer APP_OPEN events: 8
Partner APP_OPEN events: 4
Customer SESSION_START events: 3
Partner SESSION_START events: 2
PROVIDER_PROFILE_VIEW events: 5
Customer ranking active records: 31
Partner ranking active records: 6
```

Still external or release-only:

- Live Supabase project reachability and anonymous-location denial against the hosted project.
- Real SMS OTP delivery behavior and provider throttling.
- Real MoMo/VNPay merchant sandbox callbacks.
- Android/iOS physical-device location, push, reconnect, and background lifecycle.
- DNS/TLS, production runtime, monitoring, backup, and restore drills.

#### Unit 08 Promotion Manifest

Promote mobile work in app-specific slices:

```text
08A Shared mobile boundary: release config, auth refresh, secure storage, session reporting, version gates
08B Customer app: design system, discovery, Partner detail, booking, chat, wallet, referral, notifications
08C Partner app: design system, availability, requests/jobs, chat, completion, earnings, wallet, notifications
08D Android/iOS manifests, Firebase registration, deep links, and package metadata
08E App-specific tests beside each implementation slice
```

Keep Customer and Partner app changes in separate checkpoints after the shared API contracts are
present. Promote `packages/shared-types/src/index.ts` before realtime consumers. Keep the Customer
README with Unit 09 documentation rather than mixing it into runtime code.

```text
Customer analyze: passed; 121 tests passed
Partner analyze: passed; 174 tests passed
Physical-device and provider-backed checks: deferred until server rollout
Git index: unchanged
```

### Unit 09 Tooling, Docs, and Integration Evidence

The complete local integration checkpoint is verified. No files are staged or committed.

```text
Full local verification: passed
Admin tests: 804 files / 4,091 tests passed
Customer Flutter analyze/tests: passed / 121 tests
Partner Flutter analyze/tests: passed / 174 tests
API typecheck and production build: passed
Admin typecheck and production build: passed, 98 routes generated (77 pages and 21 API routes)
Prisma validation and Supabase schema alignment: passed
Authority, visible-copy, shared-format, secret, sensitive-data, policy, and Vietnam-scope guards: passed
Docker Compose configuration contract: passed
npm production dependency audit: 0 vulnerabilities
Checkpoint inventory tests: 6 passed
Checkpoint inventory: 1,216 changed paths, 0 unclassified, 261 manual-review paths
Git diff integrity check: passed
Local API/Admin production runtime: healthy on ports 3000 and 3101
Strict Admin production page budget: 44 pages passed
```

The Admin shared-format guard now follows formatter ownership across page models and extracted
sections. It recursively rejects new local `relativeTime` implementations while requiring the
shared formatter in the concrete rendering owners, avoiding stale checks against page entry files
that no longer render those values.

The full verification intentionally runs without managed service startup. Database mutation,
forced seed, migration application, and external provider calls remain excluded from this
integration checkpoint.

### Final Promotion Order

Use this order when the owner is ready to stage and commit:

```text
1. Prisma schema and six additive migrations
2. API auth, file, rate-limit, notification, and health security
3. Partner profile/availability and Customer discovery/usage APIs
4. Booking, matching, chat, location, and cancellation lifecycle
5. Payment, settlement, wallet, payout, referral, and tax lifecycle
6. Complete Admin API route inheritance chain plus all Admin query projections
7. Admin shared shell, navigation, access, session, and common controls
8. Admin operator surfaces by domain: Command -> Customer -> Partner -> Booking -> System
9. Admin Finance and Analytics surfaces
10. Customer app
11. Partner app
12. Smoke scripts, CI/tooling, documentation, and verified dead-component cleanup
13. Full verification and production builds
```

Promote each Unit 01 guard with or after the implementation it asserts. Never stage the Admin route
classes or the 184 deleted Admin files as isolated commits. Supabase live-policy patches remain
reviewed deployment artifacts until server rollout. The Git index remains intentionally unchanged.
