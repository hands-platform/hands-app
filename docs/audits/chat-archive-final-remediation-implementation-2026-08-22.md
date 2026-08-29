# Chat Archive final remediation implementation report

- Date: 2026-08-22 ICT
- Business timezone: `Asia/Ho_Chi_Minh`
- Repository: `C:\dev\massage-on-demand-vn`
- Branch: `develop`
- Result: code remediation complete; GOV-01 remains blocked by an owner policy decision; CA-05 remains deliberately deferred.

## 1. Finding status and reproduction

| Finding | Before remediation | Final status | Evidence |
|---|---|---|---|
| CA-01 transcript hash target | Reproduced. A canceled booking opened with `#booking-chat-history`, but the enclosing `details` remained closed and the target had a zero-size rectangle. | **Fixed** | The client hash helper opens only the target's ancestor disclosure, scrolls without smooth motion, and focuses the section. Browser result: disclosure open, active element `booking-chat-history`, `tabindex=-1`, target top about `0.4px`; Escape still closes the disclosure and returns focus to `SUMMARY`. |
| FLOW-01 Partner customer evaluation | Reproduced in source. Jobs and Chat completed a booking without collecting the existing customer-evaluation contract. | **Fixed** | Both entry points now execute completion first, then require a text evaluation, then run the existing refresh/navigation success path. |
| GOV-01 retention policy | No authoritative retention/legal-hold/export/delete policy exists in the repository. | **BLOCKED BY OWNER POLICY DECISION** | `docs/decisions/chat-evidence-retention-decision.md` records every required owner answer and explicitly prohibits automatic deletion. |
| CA-02 1440px filter readability | Reproduced. Search label wrapped, the search icon was clipped, and active-filter actions could be clipped at the card boundary. | **Fixed** | Search width is 320px, label is one line, icon is 18×18px, input is 290px, action text is nowrap. At 1440px the action row moves below the fields; at 1600px it stays inline. No horizontal overflow and the first data row remains visible. |
| CA-03 unbounded q/audit metadata | Reproduced in source. UI, page model, API predicate, and audit metadata had no single 120-character boundary. | **Fixed** | UI `maxLength=120`; canonical URL, list/summary API query, predicate, and `booking.chat.search` audit metadata use the same trimmed first 120 characters. |
| CA-04 audit destination | Source validation found that Audit Log supports `q` and `range=all`, but `adminAuditLogBucketWhere` has no enforced `Booking` bucket case. | **Fallback completed** | Per the approved fallback, the button is now `Booking audit log`; the existing `/audit-log?bucket=Booking` destination is retained. No Audit Log refactor was made. Clear refinements preserves the requested bucket. |
| CA-05 list/summary snapshot skew | No mismatch was reproduced in focused tests or browser checks. | **Probable / deferred** | No combined endpoint, snapshot token, transaction, or cache was added. See Remaining risks. |
| Clear filters DOM reuse | Found during final browser verification. URL cleared, but uncontrolled q/sender values remained in the reused form and could leak into the next submit. | **Fixed** | The existing form remounts only when `plan.currentHref` changes. Browser result after Clear: q/sender/status empty, range `all`, sort `newest`, URL `/chat-archive`. |

## 2. Changed files and reasons

### Admin Web

- `apps/admin_web/app/bookings/[id]/booking-detail-chat-hash-focus.tsx` and `.spec.ts`: minimal hash-focus helper and contract tests.
- `apps/admin_web/app/bookings/[id]/booking-detail-chat-transcript-section.tsx` and `.spec.tsx`: mount the helper beside the existing transcript section without changing the transcript API or disclosure behavior.
- `apps/admin_web/app/chat-archive/chat-archive-page-model.ts` and `.spec.ts`: 120-character query normalization and canonical redirect contract.
- `apps/admin_web/app/chat-archive/page.tsx` and `.spec.tsx`: input max length, canonical form remount, clearer audit button label, and page-level regression coverage.
- `apps/admin_web/components/admin-form-controls.tsx`: pass the native optional `maxLength` prop through the shared search control.
- `apps/admin_web/app/globals.css`: Chat Evidence-scoped desktop filter layout only.
- `apps/admin_web/app/audit-log/page.spec.ts`: confirms q/bucket/range forwarding and bucket preservation after Clear refinements.

### API

- `apps/api/src/admin/admin.service.ts`: one bounded Chat Archive query helper reused by the search predicate and audit metadata.
- `apps/api/src/admin/admin.service.spec.ts`: list/summary predicate parity and bounded multilingual audit metadata coverage.

### Provider app

- `apps/provider_app/lib/src/features/booking/domain/repositories/provider_booking_repository.dart`
- `apps/provider_app/lib/src/features/booking/data/repositories/provider_booking_repository_impl.dart`
- `apps/provider_app/lib/src/app_state.dart`
- `apps/provider_app/lib/src/features/booking/presentation/partner_jobs_screen.dart`
- `apps/provider_app/lib/src/features/chat/presentation/provider_chat_screen.dart`
- `apps/provider_app/lib/src/features/booking/presentation/provider_customer_evaluation_dialog.dart`
- `apps/provider_app/test/provider_booking_repository_test.dart`
- `apps/provider_app/test/provider_customer_evaluation_dialog_test.dart`
- `apps/provider_app/test/partner_jobs_screen_test.dart`

These changes reuse the existing `POST /partner/bookings/:bookingId/customer-evaluation` contract. The request body is only `{ comment }`; input is trimmed, required, and limited to 1000 characters.

### Governance and evidence

- `docs/decisions/chat-evidence-retention-decision.md`: owner decision packet; no automation.
- `output/chat-archive-final-remediation-verification-2026-08-22/`: four 1440×900 light/dark approval screenshots plus CA-01 after evidence.

## 3. CA-01 browser before/after evidence

Before:

- `output/chat-archive-final-reaudit-2026-08-21/02-open-transcript-closed-disclosure-1440x900.png`
- Canceled booking `cmsq76nag00ajvyx04wnaj0k4`: `details.open=false`, target rectangle 0×0, no focused target.

After:

- `output/chat-archive-final-remediation-verification-2026-08-22/ca01-open-transcript-after-1440x900.png`
- Same booking: `details.open=true`, `document.activeElement.id=booking-chat-history`, target top about `0.4px`, height about `344px`, `scrollY=3127`.
- Escape regression: disclosure closes and focus returns to the existing `SUMMARY` element.
- Completed booking `cmsd5lxwy08nuvyygsc6e128u` also scrolls/focuses correctly; it has no ancestor disclosure to open. Its `returnTo` query returns to the same filtered Chat Evidence URL.

## 4. FLOW-01 sequence and failure handling

Jobs and Chat use the same sequence:

1. Capture/validate the existing action location.
2. Call the existing completion endpoint.
3. Open the non-dismissible Vietnamese customer-evaluation dialog.
4. Validate a trimmed required comment with a 1000-character limit.
5. POST only the comment to the existing customer-evaluation endpoint.
6. After evaluation success, execute the previous heartbeat, reload, success-message, and next-chat behavior.

The submit control is disabled in flight. An evaluation failure stays in the dialog with an inline readable error and can be retried. The completion request is outside the retry callback, so retrying an evaluation does not complete the booking twice. Completion is not rolled back when the later evaluation request fails.

## 5. Chat Evidence and Partner Notes remain separate

No Chat Evidence write path, message schema, or chat API was reused for evaluations. Chat Evidence remains a read-only retained booking-message search. The Provider flow calls the existing customer-evaluation endpoint, whose records are surfaced through Partner Notes/Booking Reviews. API focused tests include the existing Partner-note/evaluation regressions. No rating, star, tag, ChatMessage, or export integration was added.

## 6. GOV-01 owner decision block

GOV-01 is not presented as implemented. Retention duration, legal-hold entry/release, export requester/approver/format/redaction, deletion executor/approval/audit, backup behavior, and restore behavior all require owner decisions. Until approval, the decision packet prohibits a delete job, queue, cron, schema field, migration, or automatic archive.

## 7. Validation performed

| Validation | Result |
|---|---|
| Admin focused Chat Archive/transcript/audit tests | **PASS** — 55 tests |
| API focused booking/chat archive/Partner note tests | **PASS** — 11 tests, 805 intentionally skipped by name filter |
| Provider focused repository/dialog/Jobs/Chat tests | **PASS** — 29 tests |
| Admin typecheck | **PASS** |
| API typecheck | **PASS** |
| Provider `flutter analyze` | **PASS** |
| `verify:scope -Scope admin` | **PASS** — 4,819 tests passed, 1 skipped; lint, visible-copy guard, typecheck, and production build passed |
| `verify:scope -Scope api` | **PASS** — 2,841 tests passed, 18 skipped; Prisma validate, lint, typecheck, and build passed |
| `verify:scope -Scope provider` | **PASS** — 187 tests; analyze passed |
| Targeted `git diff --check` | **PASS**; only repository line-ending notices were emitted |

The first Admin scope run exposed one selector-collision test and literal Hangul visible-copy guard violations in tests. Both were corrected, and the complete Admin scope was rerun to a clean pass.

## 8. Browser verification

Authenticated read-only verification used `http://localhost:3102` only.

- 1440×900 and 1600×1000, light and dark: no horizontal overflow; first data row visible.
- 1440 search control: 320px; input: 290px; label: one line; icon: 18×18px.
- Active search: Apply/Clear text remains one line and both actions remain inside the filter card.
- Search focus: `:focus-visible=true` with the existing purple box-shadow.
- q Apply/Clear: applied `Realtime`; Clear reset both URL and all live DOM field values.
- Partner sender: 4 visible results; every sender badge was `Partner`.
- Custom valid range: 14 messages / 14 rooms for 2026-08-01 through 2026-08-06.
- Custom invalid range: From-after-To error, `Search not run`, and `No API request was sent` copy.
- Empty result: distinct `No matching messages` state and evidence caveat.
- `page=999`: canonicalized to `/chat-archive?page=24`, showing 231 of 231.
- Direct 121-character Korean q: URL and input canonicalized to exactly 120 characters; input max length was 120.
- Canceled and completed Open transcript paths, hash focus, Escape, and `returnTo` were verified.
- Audit combination direct check returned 115 `booking.chat.search` events; Clear refinements retained `bucket=Booking`.
- A fresh authenticated Chat Evidence tab produced only React development/HMR informational logs; no console error/warning or failed resource request was observed during the acceptance run.

Screenshots:

- `output/chat-archive-final-remediation-verification-2026-08-22/1440x900-default-light.png`
- `output/chat-archive-final-remediation-verification-2026-08-22/1440x900-default-dark.png`
- `output/chat-archive-final-remediation-verification-2026-08-22/1440x900-active-search-light.png`
- `output/chat-archive-final-remediation-verification-2026-08-22/1440x900-active-search-dark.png`

## 9. Protected areas and dirty tree

- Start status: 348 entries from `git status --short --untracked-files=all`.
- Finish status: 380 entries at final handoff. The count also includes unrelated user-owned files that appeared in the shared dirty workspace during this run.
- The repository was already heavily dirty. Existing changes were not reset, stashed, cleaned, or reformatted.
- `apps/admin_web/app/globals.css`, `apps/api/src/admin/admin.service.ts`, and `apps/api/src/admin/admin.service.spec.ts` already contained large user changes. Only the scoped Chat Archive blocks/tests were patched.
- Scope verification reports `apps/api/prisma/` as protected and already changed. This task did **not** edit Prisma schema, migrations, seed data, or database state.
- No auth/session/MFA contract, payment/settlement logic, API route name, package dependency, or production data was changed.
- Provider evaluation tests used mocks/fixtures; no real customer, Partner, booking, or finance record was mutated. Browser search created only its normal `booking.chat.search` audit evidence.

## 10. Remaining risks and explicit deferrals

1. **GOV-01 blocked:** owner policy is still required before any retention/deletion implementation.
2. **CA-05 deferred:** list and summary are separate reads and can theoretically observe adjacent database states. No mismatch was reproduced. A combined endpoint, transaction, cache, or snapshot token remains unjustified without production-like evidence.
3. **Evaluation lost-response duplicate:** the current API duplicate response exposes no stable machine-readable duplicate code. If evaluation commits but its response is lost, a retry can surface the existing duplicate error. No brittle message parsing was added.
4. **Booking audit bucket:** `q=booking.chat.search&range=all` works, but the API has no separately enforced `Booking` bucket case. The narrow Chat-search button was therefore not advertised; adding a real Booking bucket is separate Audit Log contract work.

## Recommended next action

Obtain and record the GOV-01 owner decisions in the retention decision packet. Do not start deletion automation before that approval.
