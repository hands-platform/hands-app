# Dependency Security Audit

Date: 2026-06-26
Scope: residual `npm audit --workspaces --audit-level=moderate` findings after safe dependency overrides.
Last reviewed: 2026-06-27

## Current Audit Summary

- Current result: 0 vulnerabilities.
- Recently resolved by `d0066806 chore(deps): pin safe security overrides`:
  - `@babel/core` pinned to `7.29.7`.
  - `form-data` pinned to `2.5.6`.
  - `multer` pinned to `2.2.0`.
- Resolved on 2026-06-27:
  - Removed API runtime dependency on `firebase-admin`.
  - Replaced Firebase Admin messaging with FCM HTTP v1 delivery using `google-auth-library`.
  - Removed the `firebase-admin -> @google-cloud/storage -> gaxios/teeny-request -> uuid` audit chain from the lockfile.
  - Replaced API and Admin Jest test runners with Vitest.
  - Removed `jest`, `@swc/jest`, obsolete Jest config files, and the Jest/Istanbul/js-yaml audit chain from `apps/api` and `apps/admin_web`.
  - Kept `@types/jest` temporarily as a zero-vulnerability compatibility shim for existing spec type annotations while tests run on Vitest.
- Remaining vulnerabilities: none reported by npm audit.

## Remaining Risk Register

### Resolved: Jest / Istanbul / js-yaml Tooling Chain

- File path: `package-lock.json`, root `package.json`, `apps/api/package.json`, `apps/admin_web/package.json`
- Module/page/service name: test toolchain (`jest`, `@jest/transform`, `babel-plugin-istanbul`, `@istanbuljs/load-nyc-config`, `js-yaml`)
- Issue type: dependency vulnerability, development/test tooling
- Severity: medium
- Previous behavior: Jest 29 pulled Istanbul coverage tooling through its own transform stack, which pulled `js-yaml <=4.1.1`.
- Current behavior: API and Admin tests run through Vitest. Jest and `@swc/jest` are no longer installed as workspace dev dependencies.
- Why it matters: the advisory is a YAML parsing denial-of-service risk. In this repo it is reachable through local test tooling, not the production API or Admin runtime.
- Risk to speed/cost/business correctness: low runtime business risk, medium developer tooling risk if untrusted YAML is fed into test/coverage config paths.
- Recommended fix: completed. Keep the Vitest runner and avoid reintroducing Jest/Istanbul unless a future audit confirms the dependency chain is safe.
- Safe code change now: completed.
- 2026-06-27 override check: forcing `@istanbuljs/load-nyc-config -> js-yaml@^4.2.0` left the npm tree in an `invalid` state (`npm ls js-yaml @istanbuljs/load-nyc-config --all` failed), so the override was reverted.
- 2026-06-27 transform check: replacing `ts-jest` with `@swc/jest@0.2.38` in API and Admin reduced full audit findings from 19 to 18 without changing runtime application code.
- 2026-06-27 runner migration check: replacing Jest with Vitest preserved the full API and Admin test suites and reduced npm audit to 0 vulnerabilities.
- Suggested test or smoke check: `just safe-check`, API test suite, Admin test suite, and coverage command if coverage config changes later.

### Resolved: Firebase Admin / Google Cloud Storage Transitive Chain

- File path: `apps/api/package.json`, `package-lock.json`, `apps/api/src/notifications/push-delivery.service.ts`, `apps/api/src/notifications/firebase-admin-credentials.ts`, `apps/api/src/health/health.service.ts`
- Module/page/service name: API notification push delivery and Firebase Admin credential health check
- Issue type: dependency vulnerability, production dependency transitive package
- Severity: medium
- Previous behavior: `firebase-admin@14.1.0` was installed for FCM. It depended on `@google-cloud/storage@7.21.0`, which brought vulnerable transitive packages reported through `gaxios`, `retry-request`, `teeny-request`, and `uuid`.
- Current behavior: API push delivery calls FCM HTTP v1 directly with `google-auth-library@10.7.0`; `firebase-admin`, `@google-cloud/storage`, and `uuid` are no longer present in the package-lock dependency tree.
- Why it matters: this is a production dependency family, so it has higher attention than the Jest tooling chain. However, current HANDS runtime code uses Firebase Admin for app initialization and messaging, not Firebase Storage.
- Evidence:
  - `npm view firebase-admin version` returned `14.1.0`.
  - `npm view @google-cloud/storage version` returned `7.21.0`.
  - Repository search found no runtime use of `admin.storage`, `getStorage`, `bucket(`, `firebase-admin/storage`, or direct `@google-cloud/storage` imports.
  - FCM-related code used to import `firebase-admin/app` and `firebase-admin/messaging`; it now imports `google-auth-library`.
- Risk to speed/cost/business correctness: reduced. HANDS still uses Firebase only as an FCM delivery network and avoids Firebase Storage runtime coupling.
- Recommended fix: keep FCM usage isolated to HTTP v1 messaging-only code paths and avoid adding Firebase Storage usage unless a fresh audit confirms a safe package chain.
- Safe code change now: completed.
- 2026-06-27 override check: `gaxios@6.7.1` and `teeny-request@9.0.0` both depend on `uuid@^9`, while the advisory fix requires `uuid>=11.1.1`. Do not force an override across this runtime dependency boundary without a dedicated Firebase/Admin messaging regression task.
- 2026-06-27 implementation check: `npm ls firebase-admin @google-cloud/storage gaxios teeny-request retry-request uuid google-auth-library --all` shows only `@massage-vn/api -> google-auth-library@10.7.0 -> gaxios@7.1.5`.
- Suggested test or smoke check: notification service unit tests, FCM environment contract check, `just safe-check`, and a production dependency audit after future push delivery dependency changes.

## Guardrails

- Do not use Firebase DB/Auth for HANDS business data or authentication.
- Keep Firebase limited to FCM delivery unless a separate approved design expands it.
- Do not add Firebase Storage or Google Cloud Storage runtime use without updating this audit and the performance/cost risk register.
- Do not run `npm audit fix --force` for future findings without reviewing the proposed dependency direction; the previous Jest remediation proposed an unsafe downgrade path.
- Treat future dependency updates as small PR-sized tasks with `just safe-check` before commit.

## Recommended Follow-up Tasks

1. Replace the remaining `jest.*` spec helper references with direct `vi.*` imports in small batches, then remove `@types/jest`.
2. Add coverage only through a Vitest coverage provider after a fresh audit check.
3. Re-run `npm audit --workspaces --audit-level=moderate` after each dependency bump and update this file if the count or risk changes.

## Verification Captured

- `npm audit --workspaces --audit-level=moderate --json`: previously exited non-zero with 25 moderate vulnerabilities, 0 high, 0 low, 0 critical.
- `npm audit --audit-level=moderate`: now exits zero with 0 vulnerabilities after the Vitest migration.
- `npm ls js-yaml @istanbuljs/load-nyc-config --all`: valid after reverting the attempted `js-yaml` override.
- `npm ls jest @swc/jest @swc/core @types/jest vitest --all`: no workspace `jest` or `@swc/jest` remains; API and Admin both use `vitest@4.1.9`; `@swc/core` remains only as an `@nestjs/cli` transitive dependency.
- `rg -n "admin\.storage|getStorage|bucket\(|@google-cloud/storage|firebase-admin/storage" apps packages infra docs --glob '!**/node_modules/**'`: no matches.
- `npm view firebase-admin version`: `14.1.0`.
- `npm view @google-cloud/storage version`: `7.21.0`.
- `npm.cmd run test --workspace @massage-vn/api -- push-delivery.service.spec.ts firebase-admin-credentials.spec.ts`: passed.
- `npm.cmd run typecheck --workspace @massage-vn/api`: passed.
- `npm.cmd run fcm:env-contract`: passed.
- `npm.cmd run verify:api:fast`: passed.
- `npm.cmd run test --workspace @massage-vn/api`: passed with Vitest, 97 files / 625 tests.
- `npm.cmd run test --workspace @massage-vn/admin-web`: passed with Vitest, 594 files / 1831 tests.
- `npm.cmd run typecheck --workspace @massage-vn/api`: passed.
- `npm.cmd run typecheck --workspace @massage-vn/admin-web`: passed.
- `npm.cmd audit --workspaces --audit-level=moderate`: passed with 0 vulnerabilities.
- `npm.cmd run verify:node:fast`: passed. API/Admin tests, typecheck, lint, admin query guards, visible copy, contracts, Prisma validate, and shared-types typecheck passed; API/Admin builds skipped by `-SkipBuild`.
