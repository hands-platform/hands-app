# Notification Templates remediation implementation

Date: 2026-08-13  
Route: `/notifications/templates`  
Baseline: `docs/audits/notification-templates-final-reaudit-2026-08-12.md`

## Verdict

The managed notification-copy path is release-ready at the contract and operator-tooling level. Localized rollout remains gated because the 96 non-English catalog entries are intentionally marked `SOURCE_COPIED` and must be translated and reviewed before they can become runtime `READY` copy.

## P0 send contract

- A central `(notification type, target role) -> template key` resolver owns the managed-copy decision.
- Runtime delivery uses `READY` requested-locale copy, then `READY` English copy, then the caller's existing fallback copy.
- An unresolved managed route never persists or enqueues an empty notification.
- Customer and Partner variants for matched, chat, cancellation, no-show, and service-start events no longer share ambiguous role-agnostic keys.
- Required placeholders are validated before an operator can save; unknown and missing placeholders block the action.
- Managed copy can be disabled without disabling the underlying notification because the caller fallback remains authoritative.
- Logs identify the managed template key and fallback reason without recording rendered PII-bearing copy.

### Runtime route map

| Notification type | Audience | Managed template key |
|---|---|---|
| `booking.opened` | Customer | `booking.opened` |
| `booking.requested` | Partner | `booking.requested` |
| `booking.backup_available` | Partner | `booking.backup_available` |
| `provider.joined` | Customer | `provider.joined` |
| `booking.matched` | Customer | `booking.matched` |
| `booking.matched` | Partner | `booking.matched.partner` |
| `booking.rejected` | Customer | `booking.rejected` |
| `provider.accepted` | Customer | `provider.accepted` |
| `provider.rejected` | Customer | `provider.rejected` |
| `service.started` | Customer | `service.started` |
| `service.started` | Partner | `service.started.partner` |
| `service.completed` | Customer | `service.completed` |
| `earning.created` | Partner | `earning.created` |
| `payment.updated` | Customer | `payment.updated` |
| `chat.message.created` | Customer | `chat.message` |
| `chat.message.created` | Partner | `chat.message.partner` |
| `booking.cancelled` | Customer | `booking.cancelled` |
| `booking.cancelled` | Partner | `booking.cancelled.partner` |
| `booking.no_show` | Customer | `booking.no_show` |
| `booking.no_show` | Partner | `booking.no_show.partner` |
| `provider.account.blocked` | Partner | `provider.account.blocked` |
| `provider.account.unblocked` | Partner | `provider.account.unblocked` |
| `provider.payout_setup_required` | Partner | `provider.payout_setup_required` |
| `provider.payout_batch.updated` | Partner | `provider.payout_batch.updated` |

`admin.push.broadcast` is not part of the managed transactional catalog. Manual campaign composition remains owned by Push Send.

## Readiness and migration

- The catalog contains 24 managed events and 120 locale rows (`en`, `vi`, `ko`, `ja`, `zh`).
- Readiness states are `SOURCE_COPIED`, `NEEDS_TRANSLATION`, `NEEDS_REVIEW`, and `READY`.
- English bootstrap copy is `READY`; copied non-English bootstrap rows remain explicitly non-ready.
- Runtime fallback therefore stays deterministic while localization work is incomplete.
- Migration `20260813181500_add_notification_translation_readiness` inserts only missing catalog data, backfills explicit readiness, preserves existing customized copy and timestamps, and disables the obsolete managed admin broadcast entry.
- The complete 95-migration chain passed against an isolated local database. A pre-existing customized `provider.joined` English/Vietnamese row survived the final migration unchanged and was classified `NEEDS_REVIEW`.
- Both pending migrations were applied to the developer's local `massage_vn` database only. No shared, staging, or production database was changed.

## Save safety and error recovery

- GET is read-only; catalog bootstrap is migration-owned.
- A save requires `expectedUpdatedAt` and runs in one transaction.
- A stale operator revision returns conflict without partial writes; the UI keeps the draft and offers `Reload latest` and `Copy my draft`.
- All changed languages save atomically with a required operator reason.
- Audit metadata includes reason, readiness transitions, revision timestamps, and before/after values.
- API load failure, permission denial, incomplete catalog setup, and optimistic conflict have distinct UI states.
- Incomplete catalog setup blocks the editor instead of presenting a partially trustworthy catalog.
- Invalid or missing variables disable Save. Leaving a dirty template triggers an explicit discard confirmation.

## Operator UI and accessibility

- The 24-event catalog is searchable, grouped, and filterable by audience, channel, readiness, and managed-copy state.
- The editor exposes five language tabs with Arrow, Home, and End keyboard behavior and tab/tabpanel semantics.
- Form labels, character counts, supported-variable controls, readiness state, Push/In-app previews, and a concise change summary are visible before save.
- Customer-facing copy consistently uses `Partner`.
- 1440x1000 dark and 1600x1000 light verification showed no page-level horizontal overflow.
- Browser verification produced no console warnings or errors.

## Verification evidence

- [1440x1000 dark catalog](../../output/notification-templates-remediation-verification-2026-08-13/01-templates-dark-1440x1000.png)
- [1600x1000 light catalog](../../output/notification-templates-remediation-verification-2026-08-13/03-templates-light-1600x1000.png)
- [Load error and retry](../../output/notification-templates-remediation-verification-2026-08-13/04-load-error-retry-1600x1000.png)
- [Optimistic conflict recovery](../../output/notification-templates-remediation-verification-2026-08-13/05-save-conflict-recovery-1600x1000.png)
- [Browser console results](../../output/notification-templates-remediation-verification-2026-08-13/browser-console.json)
- [Layout and interaction checks](../../output/notification-templates-remediation-verification-2026-08-13/layout-checks.json)

## Automated verification

Focused verification completed before the repository scope gates:

- Admin template specs: 40 passed.
- API notification specs: 29 passed.
- Admin service notification-template specs: 4 passed.
- Admin and API type checks: passed.
- Targeted lint: passed.
- Prisma migration history: 95 migrations valid.
- Prisma client generation: passed.
- API build: passed.

Repository scope gate outcomes:

- API scope: contract guards, Prisma validation, typecheck, and build passed. The full API suite finished with 2,380 passed and 1 failed; the remaining failure is the separate Push Send campaign receipt test expecting an old Prisma `include` shape after the campaign read projection changed to `select`. API lint found two unused `updated` variables in unrelated Admin operator access methods.
- Admin scope: FCM and notification contracts, API budget, typecheck, lint, query guards, visible-copy guard, and production build passed. The full Admin suite finished with 4,555 passed and 3 failed: shared notice CSS selector shape, operator navigation access expectation, and a time-sensitive Finance Closeout age expectation (`70d` versus current `73d`).
- None of these six failures exercise the notification template catalog, runtime resolution, template editor, migration, or browser fixtures.

Full local verification also completed. API, Admin, and Public Web builds passed; Customer and Partner Flutter dependency resolution, analysis, and tests passed. The overall command returned failure because of existing setup-doctor/final-authority/Vietnam-scope/API-domain/Supabase-schema checks and the three Admin suite failures above. No failure reported by `verify:local` exercised the notification-template catalog, editor, migration, routing fallback, or browser recovery states.

## Protected areas

- No authentication policy was weakened.
- No queue, transport, provider token, payment, settlement, or booking state-machine policy was redesigned.
- No real push was sent.
- No production or shared database was mutated.
- No dependency, UI framework, route, or new delivery subsystem was added.
- Existing unrelated worktree changes were preserved.

## Remaining rollout work

Engineering readiness score: **90/100**. Transactional routing, fallback safety, editor recovery, and desktop operator UX are ready. Localized content rollout is not complete: Vietnamese, Korean, Japanese, and Chinese copy needs translation, reviewer attribution, and final `READY` promotion. Until then, the runtime safely uses reviewed English or the caller fallback.
