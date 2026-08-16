# Website Content remediation implementation report

Date: 2026-08-12  
Route: `/website-content`  
Baseline: 68/100, launch hold  
Code and operator-workspace assessment after this change: 84/100  
Final launch decision: **HOLD until the reviewed route/readiness rollout is approved and applied**

## 1. Executive verdict

The CMS now has a canonical public-route contract, explicit CMS/code-fallback ownership, scoped readiness metrics, recoverable create forms, and server-enforced publish/offline/delete safeguards. The code gate is substantially complete, but the data rollout was intentionally not applied. Translation source-revision tracking, atomic section reordering, and destructive browser exercises also remain incomplete, so this report does not classify the system as fully launched.

## 2. Baseline and current evidence

The audit baseline showed 17 route groups and 85 locale pages in the Admin, while route declarations and public routing were not governed by one contract. The current authenticated browser verification still showed 17 route groups, 0 Live pages, 85 pages requiring validation, and 19 missing route groups before rollout. Those values are current runtime observations, not fixtures embedded in the UI.

The canonical manifest now defines 35 route groups across five required locales, or 175 expected locale rows. It includes the district list and district Partner detail routes used by the public resolver and the referral route. Legacy `/partners/[city]/[slug]` records are migration candidates rather than a second accepted public contract.

## 3. Requirement status

| Area | Status | Result |
| --- | --- | --- |
| Canonical route manifest | Complete | One validated JSON manifest drives API, migration planning, and public-web contract tests. Duplicate routes and missing required locales fail tests. |
| Revision-aware bootstrap | Complete in code | New rows are planned with Draft revisions and `draftRevisionId`; existing revision-backed content is preserved. Default mode is dry-run. |
| Route/readiness rollout | Partial | Exact dry-run exists; no DB writes were executed. Apply requires environment confirmation and the reviewed checksum. |
| Public ownership | Complete | `CMS_LIVE`, `CODE_FALLBACK`, `NOT_SERVED`, and `OWNERSHIP_CONFLICT` are derived and shown in Admin. Public resolver tests use the same manifest. |
| Scoped summary | Complete | Pages and News use their own query scope. Site, locale, readiness, ownership, and search filters are included in summary calculation. |
| Missing routes/translations | Complete | Counts are derived from the manifest matrix, not from the number of existing rows alone. |
| Stale translations | Partial | The UI and response contract expose the state, but the current model has no authoritative source-revision link. It therefore does not invent stale counts. |
| Readiness reevaluation | Complete in code | A read-only readiness endpoint and dry-run report are available. Unknown records are evaluated, not converted blindly to Ready. |
| Form recovery | Partial | New page and new article create flows use typed action state, preserve submitted values, focus error summaries, expose field errors, and disable duplicate submit. Existing edit forms are not all migrated to the same recovery contract. |
| Publish safety | Complete | Unknown/blocked content renders a semantic disabled control with no confirm URL. The server still rejects non-ready publish attempts. |
| Publish diff and first cutover | Complete | Publishing shows field-level Draft/Live changes and warns when the first CMS publish will replace code fallback delivery. |
| Take offline | Complete in code | Publish permission, reason, typed path, transactional state change, idempotency, visitor outcome, and audit metadata are enforced. |
| Rollback activity | Complete in code | Rollback reason and actor/request metadata are distinguished from the original revision publisher. |
| Hard delete | Complete in code | Current path and reason are checked server-side; routes with Live history or ownership conflict cannot be hard-deleted. |
| Operator directory/detail UI | Complete | Human route names, compact work queues, ownership/delivery, route matrix, clear scopes, page identity headers, advanced danger actions, and accessible tables are present. |
| Section editing | Partial | Internal key and numeric order are removed from the normal workflow and raw JSON is under Advanced settings. Atomic drag/keyboard reorder was not added without a safe reorder API. |
| Media/translation workflow | Partial | Ownership and translation gaps are visible. Thumbnail preview, authoritative stale translation linkage, and baseline-language clone workflow remain. |
| Browser verification | Partial | Read-only, blocked, typed-confirmation, dark-theme, filter, and responsive states were exercised. Actual publish/offline/rollback/delete and forced API failure were not executed against current content. |

## 4. Route manifest, DB, and resolver structure

- Canonical data: `apps/api/src/site-content/public-site-route-manifest.json`
- API validated loader: `apps/api/src/site-content/public-site-route-manifest.ts`
- Public-web validated loader: `apps/public_web/lib/public-site-route-manifest.ts`
- Migration planner: `infra/scripts/lib/public-site-route-migration.mjs`
- Default dry-run entry point: `infra/scripts/bootstrap-public-site-structure.mjs`

The route key is `site + locale + normalized path`. The manifest describes the route label, site, required locales, section template, and public template path. The migration planner classifies every current/expected row as `KEEP`, `CREATE`, `BACKFILL_REVISION`, `MOVE_ROUTE`, `STALE_ROUTE`, `CONFLICT`, or `BLOCKED`. It does not delete stale routes, publish Drafts, overwrite revision-backed content, or remove code fallback source.

Public delivery is explicit:

- `CMS_LIVE`: the active CMS revision is the visitor source.
- `CODE_FALLBACK`: no CMS Live revision exists and a known code fallback serves the route.
- `NOT_SERVED`: neither CMS Live nor an approved fallback serves the route.
- `OWNERSHIP_CONFLICT`: delivery cannot be safely inferred and publishing/deletion requires resolution.

CMS fetch failure remains different from CMS page absence. A temporary API failure is not silently reclassified as a missing CMS page.

## 5. Dry-run result

Evidence: `output/website-content-improvement-verification-2026-08-12/route-readiness-dry-run.json`

| Field | Result |
| --- | ---: |
| Expected route groups | 35 |
| Expected locale rows | 175 |
| Current locale rows | 85 |
| KEEP | 80 |
| CREATE | 90 |
| BACKFILL_REVISION | 0 |
| MOVE_ROUTE | 5 |
| STALE_ROUTE | 0 |
| CONFLICT | 0 |
| BLOCKED | 0 |
| Reviewed manifest checksum | `7d27a6e61c791ce0a9d628f228b96c9f0a8822338b0c6508e9eb0200b235da97` |
| Apply executed | **No** |

No shared, remote, or production data was written. The 90 creates and five route moves require a separate reviewed apply approval. The five moves preserve the existing locale pages while moving the obsolete Partner detail shape to `/partners/[city]/[district]/[slug]`.

## 6. Operator UI changes

- Replaced oversized repeated totals with a compact action strip for blocked, validation, missing route, and missing/stale translation work.
- Added scoped filters for site, locale, readiness, ownership, and search with truthful generated time.
- Separated Pages and News metrics, so an empty News workspace no longer inherits page totals.
- Rebuilt the route table around human page names, actual delivery ownership, five locale statuses, and recent change.
- Added page identity headers that expose label, locale, host/path, Draft/Live state, and delivery ownership together.
- Moved destructive actions under an explicit danger disclosure. Typed path, reason, visitor outcome, Live history, and ownership are shown before action.
- Added field-level Draft/Live publish differences and first-publish code-fallback replacement warning.
- Converted create flows to typed, recoverable action state with duplicate-submit protection and focused errors.
- Removed internal section key and numeric order from normal editing. Section actions keep stable widths at 1440px and the editor becomes a readable single-column workspace when space is constrained.
- Verified the same information structure in light and dark themes with no page-level horizontal overflow at the requested desktop widths.

Impeccable detector was run after the final UI edit. It found no Website Content-specific issue. Six `side-tab` warnings point to pre-existing selectors for unrelated Admin screens in the shared `globals.css`; they were not changed to avoid unrelated visual regressions.

## 7. Main changed files

### Admin Web

- `apps/admin_web/app/website-content/page.tsx`: scoped workspaces, route matrix, ownership, diff, danger actions, and operator hierarchy.
- `apps/admin_web/app/website-content/actions.ts`: typed action results, safe query allowlist, and validated publish/offline/delete actions.
- `apps/admin_web/app/website-content/website-content-action-form.tsx`: recoverable create forms and duplicate-submit protection.
- `apps/admin_web/app/website-content/website-content-types.ts`: manifest, ownership, summary, activity, and offline response contracts.
- `apps/admin_web/app/globals.css`: Website Content-only desktop layouts and section editor safeguards.
- Adjacent Website Content specs: action and rendering regression coverage.

### API

- `apps/api/src/site-content/public-site-route-manifest.json` and loader/spec: canonical route contract.
- `apps/api/src/site-content/site-content.service.ts`: scoped summary, ownership, readiness dry-run, audit metadata, offline, rollback, and guarded deletion.
- `apps/api/src/site-content/site-content.dto.ts`: route, filter, reason, and typed-confirmation validation.
- `apps/api/src/admin/admin-catalog.routes.ts` and `admin.service.ts`: Admin endpoints/delegation.
- `apps/api/src/admin/admin-operator-category.guard.ts`: publish-strength permission for take offline.
- Adjacent service and guard specs: lifecycle and authorization regressions.

### Public Web and scripts

- `apps/public_web/lib/public-site-route-manifest.ts`: validated public consumer.
- `apps/public_web/lib/site-content.ts`: manifest-aware CMS/fallback resolution.
- `infra/scripts/lib/public-site-route-migration.mjs`: idempotent classification and apply guard.
- `infra/scripts/bootstrap-public-site-structure.mjs`: dry-run-first revision-aware bootstrap.
- `infra/scripts/public-site-route-migration.test.mjs`: no-write/idempotency/conflict tests.

No new UI framework, CMS framework, state library, database table, column, or Prisma migration was added.

## 8. Test and verification results

### Passed

- Admin Website Content focused tests: 15/15.
- Admin common form guard plus Website Content tests: 64/64.
- API requested site-content/guard focused tests: 62/62; broader focused run: 65/65.
- Public web focused tests: 6/6.
- Route migration planner tests: 3/3.
- Admin Web typecheck, lint, and build.
- API typecheck and build.
- Public Web full test, typecheck, lint, and build; public test total 16/16.
- `npm.cmd run verify:scope -- -Scope api`: 172 test files passed, 2 skipped; 2,346 tests passed, 6 skipped; typecheck/lint/build passed.
- Prisma migration integrity: 93 migrations validated. The existing duplicate timestamp warning remains.
- Browser console: no error or warning in the final verified state.

### Failed outside this change

`npm.cmd run verify:scope -- -Scope admin` reached the full Admin suite. Website Content tests passed, while three existing unrelated assertions failed:

1. `components/admin-surface-css.spec.tsx`: the shared notice selector's first occurrence does not match the expected grid contract.
2. `lib/admin-navigation.spec.ts`: Finance navigation expectation conflicts with the current Company Bank Accounts entry.
3. `app/finance-closeout/page.spec.tsx`: fixture expects oldest age 70 days while current output is 72 days.

`npm.cmd run verify:local` was fully attempted and exited non-zero because of existing cross-repository gates: Operations Policy/final-authority markers, Vietnam documentation timezone wording, an API domain smoke assertion, and Supabase `file_purpose` schema alignment. The three Admin failures above also remain. In the same run, API/Admin/Public builds, Flutter customer/Partner analyze and tests, Prisma validation, and security checks passed.

### Skipped or intentionally not executed

- `verify-local.ps1 -WithServices`: not rerun after the complete `verify:local` attempt because the remaining failures are documented non-CMS repository gates, not missing local service startup.
- Real publish, take offline, rollback, and delete browser mutations: prohibited against current content by the task's safety boundary.
- Actual route/readiness apply: requires explicit user approval.
- Forced API outage and a separate permission-denied account: not reproduced in the authenticated browser session; contracts are covered by focused tests.

## 9. Browser evidence

Root: `output/website-content-improvement-verification-2026-08-12`

Baseline:

- [`before/01-pages-directory-1600x1000.png`](../../output/website-content-improvement-verification-2026-08-12/before/01-pages-directory-1600x1000.png)

Final representative captures:

- [`after/19-pages-directory-1600x1000-final.png`](../../output/website-content-improvement-verification-2026-08-12/after/19-pages-directory-1600x1000-final.png)
- [`after/15-pages-directory-1440x1000-latest.png`](../../output/website-content-improvement-verification-2026-08-12/after/15-pages-directory-1440x1000-latest.png)
- [`after/06-new-page-1600x1000.png`](../../output/website-content-improvement-verification-2026-08-12/after/06-new-page-1600x1000.png)
- [`after/07-news-directory-1600x1000.png`](../../output/website-content-improvement-verification-2026-08-12/after/07-news-directory-1600x1000.png)
- [`after/09-publishing-blocked-1600x1000.png`](../../output/website-content-improvement-verification-2026-08-12/after/09-publishing-blocked-1600x1000.png)
- [`after/10-activity-1600x1000.png`](../../output/website-content-improvement-verification-2026-08-12/after/10-activity-1600x1000.png)
- [`after/17-section-editor-1440x1000-final.png`](../../output/website-content-improvement-verification-2026-08-12/after/17-section-editor-1440x1000-final.png)
- [`after/12-delete-confirm-1600x1000.png`](../../output/website-content-improvement-verification-2026-08-12/after/12-delete-confirm-1600x1000.png)
- [`after/13-detail-dark-1600x1000.png`](../../output/website-content-improvement-verification-2026-08-12/after/13-detail-dark-1600x1000.png)
- [`after/14-filtered-validation-queue-1600x1000.png`](../../output/website-content-improvement-verification-2026-08-12/after/14-filtered-validation-queue-1600x1000.png)

Verified assertions: no page-level horizontal overflow at 1440x1000 or 1600x1000; blocked publish has no executable confirm link; Delete confirmation initially focuses Cancel; typed path/reason are required; stale section query state does not leak into list/new links; dark theme preserves hierarchy and contrast; final browser console contained no warnings.

## 10. Protected areas and user changes

This task did not change `schema.prisma`, migration files, authentication, payment, booking, matching, or wallet contracts. It did touch existing Admin API route/service/guard files only to expose the Website Content operations and enforce the existing content permission categories. The worktree contained extensive prior user changes, including in large shared files such as `globals.css` and `admin.service.ts`; they were preserved. No reset, checkout, cleanup, commit, push, or deployment was performed.

## 11. Remaining risk and approval work

Launch remains on hold for four concrete reasons:

1. Review and explicitly approve the checksum-bound data apply for 90 creates and five route moves.
2. Add or approve an authoritative source-revision relation before claiming stale translations, and implement the baseline-language clone/review workflow.
3. Add an atomic section reorder API before exposing drag or keyboard reorder controls; numeric order should not return to the normal workflow.
4. Exercise publish/offline/rollback/delete and forced failure states against isolated fixture data, then resolve the unrelated repository-wide verification failures or formally waive them.

The next recommended action is a reviewed, isolated rollout rehearsal using the saved checksum and a disposable database snapshot. It should verify first CMS cutover, code-fallback visitor outcome, idempotent rerun, rollback, and take-offline behavior before any shared-data apply.
