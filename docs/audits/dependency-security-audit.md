# Dependency Security Audit

Date: 2026-06-26
Scope: residual `npm audit --workspaces --audit-level=moderate` findings after safe dependency overrides.

## Current Audit Summary

- Current result: 25 moderate vulnerabilities, 0 high, 0 low, 0 critical.
- Recently resolved by `d0066806 chore(deps): pin safe security overrides`:
  - `@babel/core` pinned to `7.29.7`.
  - `form-data` pinned to `2.5.6`.
  - `multer` pinned to `2.2.0`.
- Remaining vulnerabilities fall into two dependency families:
  - Jest/Istanbul test tooling through `js-yaml`.
  - Firebase Admin's transitive Google Cloud Storage dependency chain.

## Remaining Risk Register

### Jest / Istanbul / js-yaml Tooling Chain

- File path: `package-lock.json`, root `package.json`, `apps/api/package.json`, `apps/admin_web/package.json`
- Module/page/service name: test toolchain (`jest`, `ts-jest`, `babel-plugin-istanbul`, `@istanbuljs/load-nyc-config`, `js-yaml`)
- Issue type: dependency vulnerability, development/test tooling
- Severity: medium
- Current behavior: Jest 29 and `ts-jest` pull Istanbul coverage tooling, which pulls `js-yaml <=4.1.1`.
- Why it matters: the advisory is a YAML parsing denial-of-service risk. In this repo it is reachable through local test tooling, not the production API or Admin runtime.
- Risk to speed/cost/business correctness: low runtime business risk, medium developer tooling risk if untrusted YAML is fed into test/coverage config paths.
- Recommended fix: keep the current Jest stack for now, then schedule a separate dev-toolchain upgrade task for Jest/ts-jest/Istanbul once npm offers a safe non-downgrade remediation path.
- Safe code change now: no. The npm fix path proposes major/downgrade changes such as older Jest or `ts-jest@27.0.3`, which can break the existing test setup.
- Suggested test or smoke check: `just safe-check`, API test suite, Admin test suite, and coverage command if coverage config changes later.

### Firebase Admin / Google Cloud Storage Transitive Chain

- File path: `apps/api/package.json`, `package-lock.json`, `apps/api/src/notifications/push-delivery.service.ts`, `apps/api/src/notifications/firebase-admin-credentials.ts`, `apps/api/src/health/health.service.ts`
- Module/page/service name: API notification push delivery and Firebase Admin credential health check
- Issue type: dependency vulnerability, production dependency transitive package
- Severity: medium
- Current behavior: `firebase-admin@14.1.0` is installed for FCM. It depends on `@google-cloud/storage@7.21.0`, which still brings vulnerable transitive packages reported through `gaxios`, `retry-request`, `teeny-request`, and `uuid`.
- Why it matters: this is a production dependency family, so it has higher attention than the Jest tooling chain. However, current HANDS runtime code uses Firebase Admin for app initialization and messaging, not Firebase Storage.
- Evidence:
  - `npm view firebase-admin version` returned `14.1.0`.
  - `npm view @google-cloud/storage version` returned `7.21.0`.
  - Repository search found no runtime use of `admin.storage`, `getStorage`, `bucket(`, `firebase-admin/storage`, or direct `@google-cloud/storage` imports.
  - FCM-related code imports `firebase-admin/app` and `firebase-admin/messaging`.
- Risk to speed/cost/business correctness: low current business risk if HANDS continues to use Firebase only as an FCM delivery network; higher future risk if Firebase Storage APIs are introduced without revisiting this audit.
- Recommended fix: do not apply npm's suggested force fix. Track upstream Firebase Admin / Google Cloud Storage releases. Keep FCM usage isolated to messaging-only code paths and avoid adding Firebase Storage usage unless a fresh audit confirms a safe package chain.
- Safe code change now: no. The npm fix path proposes `firebase-admin@10.3.0`, a major downgrade from the current latest `14.1.0`.
- Suggested test or smoke check: notification service unit tests, FCM environment contract check, `just safe-check`, and a production dependency audit after the next Firebase Admin release.

## Guardrails

- Do not use Firebase DB/Auth for HANDS business data or authentication.
- Keep Firebase Admin limited to FCM delivery unless a separate approved design expands it.
- Do not add Firebase Storage or Google Cloud Storage runtime use without updating this audit and the performance/cost risk register.
- Do not run `npm audit fix --force` for the remaining findings; current automated remediation proposes unsafe downgrade paths.
- Treat future dependency updates as small PR-sized tasks with `just safe-check` before commit.

## Recommended Follow-up Tasks

1. Create a dependency watch task for Firebase Admin / Google Cloud Storage transitive fixes.
2. Create a separate Jest/ts-jest upgrade spike that validates API and Admin test behavior before changing versions.
3. Add a CI note or docs reminder that residual audit findings are known and classified, not ignored.
4. Re-run `npm audit --workspaces --audit-level=moderate` after each dependency bump and update this file if the count or risk changes.

## Verification Captured

- `npm audit --workspaces --audit-level=moderate --json`: exits non-zero with 25 moderate vulnerabilities, 0 high, 0 low, 0 critical.
- `rg -n "admin\.storage|getStorage|bucket\(|@google-cloud/storage|firebase-admin/storage" apps packages infra docs --glob '!**/node_modules/**'`: no matches.
- `npm view firebase-admin version`: `14.1.0`.
- `npm view @google-cloud/storage version`: `7.21.0`.
- `just safe-check`: passed after the safe override commit that reduced audit exposure.
