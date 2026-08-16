# Setup Runtime Deferred Remediation Report

> All dates and times in this report use `Asia/Ho_Chi_Minh` (`UTC+7`).

## Verdict

**Release hold · 94/100**

The Setup Deferred implementation, focused tests, production build, restarted runtime, HTTP checks, and browser QA are ready. The repository-wide Admin/API scope gates still contain unrelated pre-existing failures, so this report does not claim a repository release-ready state.

## Operator outcome

- `/setup?mode=runtime&view=deferred` now redirects on the server to the canonical `/setup?mode=readiness&view=deferred` URL.
- Runtime and Launch readiness have independent allow-listed views. Runtime now exposes `Active services` and `Evidence gaps`; Launch readiness exposes `Required capabilities` and `Deferred`.
- The Deferred view is a five-column future-work ledger: capability, reason, re-entry prerequisites, review trigger, and action.
- Exactly three capabilities are deferred for the cash-only launch: `MoMo payments`, `Referral app links`, and `VNPay payments`.
- `Needs action 0`, `Required capabilities 6`, and `Deferred 3` agree with the rendered rows and API counts.
- Native `details` disclosures retain the compact comparison rows and open a readable fixed checklist panel at 1440px and 1600px.
- Manual refresh preserves the current snapshot and canonical URL, exposes a non-flickering pending state, announces completion, and restores focus to the refresh button.

## Audit baseline and resolution

| Baseline issue | Resolution | Status |
| --- | --- | --- |
| Runtime/deferred rendered a generic Runtime table | Server-side canonical redirect to Launch readiness Deferred | Resolved |
| Runtime and readiness view names could be mixed | Mode-specific allow-lists and deterministic normalization | Resolved |
| Deferred scope was inferred from a broad category | Single launch manifest with explicit launch scope and re-entry metadata | Resolved |
| Deferred rows lacked operator decision context | Dedicated five-column ledger plus full checklist disclosures | Resolved |
| Referral Android MVP and iOS requirements conflicted | Release-profile requirement helper separates Android MVP from future iOS | Resolved |
| Referral destination was generic | Direct link to `/referrals/customers#referral-link-readiness` | Resolved |
| Refresh could show only a brief spinner | Minimum 600ms observable pending state outside tests | Resolved |
| Detail panels clipped at the table boundary | Fixed right-side checklist panel with viewport max-height | Resolved |
| Repository-wide scope verification | Unrelated existing failures remain | Open release gate |

## Launch manifest

The API health model now returns one policy-backed representation for current and future capabilities:

- Current launch: `CASH_ONLY`
- Referral release profile: `ANDROID_MVP`
- Current required capabilities: six
- Deferred capabilities: three
- Deferred metadata: `launchScope`, `deferredReason`, `futureReadiness`, `reentryChecks`, `reviewTrigger`, `reviewedAt`, and optional `platformScope`
- Future readiness states: `NOT_STARTED`, `PARTIAL`, and `READY_FOR_REENTRY`

Configuration alone cannot mark a deferred capability ready for re-entry. Functional checks, public routes, signed flows, and operational evidence remain explicit prerequisites.

## Deferred classification evidence

| Capability | Current reason | Re-entry trigger | Destination |
| --- | --- | --- | --- |
| MoMo payments | Online payments are outside the cash-only launch | Online-payment phase approval | `/payments` |
| VNPay payments | VNPay is intentionally disabled during the cash-only launch | Online-payment phase and public DNS/TLS approval | `/payments` |
| Referral app links | Public sharing and store routing are outside the current launch stage | Public referral sharing or Android store release preparation | `/referrals/customers#referral-link-readiness` |

All three show `0/4 current gates verified` in the current local environment. This is future-work evidence and does not increase `Needs action`, which remains zero.

## Android and iOS policy

- `ANDROID_MVP` requires a public referral base URL, Customer Android destination, Partner Android destination, and Android device-routing smoke.
- Customer and Partner iOS destinations are shown as `Future scope` and do not block the Android MVP.
- The `IOS_RELEASE` profile adds the two iOS destinations when that release phase begins.
- The UI states `Android MVP; iOS remains future scope` and does not present missing iOS destinations as current launch blockers.

## URL and layout evidence

- Canonical redirect observed: `/setup?mode=runtime&view=deferred` → `/setup?mode=readiness&view=deferred`.
- At 1440×1000, the document and Deferred ledger had `0px` horizontal overflow.
- Five headers rendered exactly: `Capability`, `Why deferred`, `Re-entry prerequisites`, `Review trigger`, `Action`.
- Three base row heights measured `99.98px`, `105px`, and `135.64px`; all were visible together in the comparison viewport.
- At 1600×1000, both dark and light themes had `0px` horizontal overflow.
- Open MoMo detail panel measured `420px` wide, top `112px`, bottom `451.4px`, and no internal overflow.
- Runtime-only status columns and legacy Deferred wording are absent from the Deferred ledger.

## Refresh state transition

1. Pending: button disabled, label `Refreshing`, live status `Refreshing external service status.`
2. Complete: button enabled, status `External service status refreshed.`
3. Canonical URL remained `/setup?mode=readiness&view=deferred`.
4. `Launch readiness` and `Deferred 3` remained selected.
5. Focus returned to `Refresh External Services status`.
6. Existing data stayed rendered throughout; no automatic polling or external mutation was added.

## Accessibility and themes

- Mode and saved-view navigation expose current selection through `aria-current`.
- Deferred checklists use native `details`/`summary` semantics and visible focus styling.
- Refresh uses a disabled control plus an `aria-live="polite"` status region.
- Supporting destinations are semantic links with separate related-workspace/runbook roles.
- Long copy does not use mid-word breaking or hyphenation.
- Browser console diagnostics returned an empty log list.
- Dark and light theme screenshots were verified at 1600×1000.

## Evidence files

Folder: `docs/audits/setup-runtime-deferred-remediation-evidence-2026-08-14/`

1. `01-runtime-active-1440.jpg`
2. `02-runtime-evidence-gaps-1440.jpg`
3. `03-canonical-readiness-deferred-1440.jpg`
4. `04-readiness-deferred-entire-1440.jpg`
5. `05-all-three-deferred-rows-1440.jpg`
6. `06-momo-details-1440.jpg`
7. `07-vnpay-details-1440.jpg`
8. `08-referral-details-1440.jpg`
9. `09-referral-destination-1440.jpg`
10. `10-refresh-pending-1440.jpg`
11. `11-refresh-complete-1440.jpg`
12. `12-dark-theme-1600.jpg`
13. `13-light-theme-1600.jpg`

## Changed files

### API and contract

- `apps/api/src/health/health.service.ts`: launch manifest, Deferred metadata, readiness states, Android/iOS profile requirements, counts.
- `apps/api/src/health/health.controller.ts`: external readiness response contract wiring.
- `apps/api/src/health/health.service.spec.ts`
- `apps/api/src/health/health.controller.spec.ts`
- `apps/admin_web/lib/admin-api.ts`: typed external readiness contract.

### Admin Setup and Referral destination

- `apps/admin_web/app/setup/page.tsx`
- `apps/admin_web/app/setup/page.spec.tsx`
- `apps/admin_web/app/setup/setup-page-model.ts`
- `apps/admin_web/app/setup/setup-page-model.spec.ts`
- `apps/admin_web/app/setup/setup-overview-section.tsx`
- `apps/admin_web/app/setup/setup-overview-section.spec.tsx`
- `apps/admin_web/app/setup/actions.ts`
- `apps/admin_web/app/setup/actions.spec.ts`
- `apps/admin_web/app/setup/setup-refresh-control.tsx`
- `apps/admin_web/app/setup/setup-browser-fixtures.ts`
- `apps/admin_web/app/setup/loading.tsx`
- `apps/admin_web/app/globals.css`
- `apps/admin_web/app/referrals/referral-dashboard.tsx`
- `apps/admin_web/app/referrals/referral-dashboard.spec.tsx`

### Documentation

- `docs/architecture/health-readiness.md`
- `docs/architecture/external-setup-checklist.md`
- This report and its evidence folder.

The worktree contained extensive user changes before this remediation. Git's stat is inflated by existing line-ending and dirty-tree changes, so the paths above identify the reviewed scope without claiming every changed line as newly authored here.

## Verification results

| Command | Result |
| --- | --- |
| `npm.cmd run test --workspace @massage-vn/admin-web -- app/setup` | PASS · 15 files, 65 tests |
| `npm.cmd run test --workspace @massage-vn/api -- src/health/health.controller.spec.ts src/health/health.service.spec.ts` | PASS · 2 files, 30 tests |
| `npm.cmd run test --workspace @massage-vn/admin-web -- app/referrals` | PASS · 10 files, 98 tests |
| `npm.cmd run typecheck --workspace @massage-vn/admin-web` | PASS |
| `npm.cmd run typecheck --workspace @massage-vn/api` | PASS |
| `npm.cmd run admin:visible-copy` | PASS · 1,651 files, 0 violations |
| `npm.cmd run build --workspace @massage-vn/admin-web` | PASS |
| Scoped `git diff --check` | PASS · line-ending warnings only |
| `npm.cmd run verify:scope -- -Scope admin` | FAIL · three unrelated existing assertions |
| `npm.cmd run verify:scope -- -Scope api` | FAIL · one unrelated existing push-campaign assertion |

Admin scope residuals:

- `components/admin-surface-css.spec.tsx`: existing shared notice/icon spacing contract.
- `lib/admin-navigation.spec.ts`: existing direct-link/local-workspace contract.
- `app/finance-closeout/page.spec.tsx`: existing settlement backlog pagination contract.

API scope residual:

- `src/admin/admin.service.spec.ts`: existing consumed-campaign receipt-persistence assertion expects `include` while the implementation uses `select`.

All Setup, Health, and Referral focused tests pass. The residual failures are outside the files and behavior changed for this remediation, but they keep the repository verdict at Release hold.

## Source marker search

- Positive markers found in live API/UI/test/docs paths: `evidence-gaps`, `evidenceGaps`, `notMonitored`, `deferredReason`, `futureReadiness`, `reviewTrigger`, `relatedWorkspaceHref`, `runbookHref`.
- No scoped hits: `Unknown or not monitored`, `View deferred scope`, `isDeferredExternalCategory`, `min-width: 1260px`.
- No search-only dead constants or comments were added.

## Build and runtime proof

- Admin build artifact updated: `2026-08-15 03:58:22 +07:00`.
- Admin production process started: `2026-08-15 03:58:39 +07:00`, PID `11360`.
- API production process started: `2026-08-15 03:20:05 +07:00`, PID `33708`.
- Build artifact predates the running Admin process.
- `GET http://localhost:3101/setup?mode=readiness&view=deferred`: HTTP `200`.
- `GET http://localhost:3000/api/health`: HTTP `200`.
- Local status: Admin and API running; API build freshness `fresh`.
- Browser console result: no messages.

## Safety and protected areas

- No `.env` value was changed.
- No Prisma schema, migration, authentication, payment mutation, provider, matching, booking, or shared-type protected area was changed for this remediation.
- No real gateway was enabled.
- No payment, message, upload, credential registration, or external service mutation was performed.
- Browser actions were limited to authenticated local reads, navigation, native disclosure toggles, theme toggles, and the safe health refresh read.
- Existing dirty worktree and untracked user files were preserved; no reset, checkout, cleanup, commit, push, or deployment was performed.

## Remaining risk and next action

The Deferred feature has no known in-scope blocker. The next release action is to repair or formally re-baseline the four unrelated Admin/API scope assertions above, rerun both scope gates, and then change the repository verdict from Release hold to Ready.
