import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const apiSourcePaths = [
  resolve(repoRoot, 'apps/api/src/notifications/push-delivery.service.ts'),
  resolve(repoRoot, 'apps/api/src/notifications/firebase-admin-credentials.ts'),
];
const smokeSourcePaths = [
  resolve(repoRoot, 'infra/scripts/fcm-push-smoke.mjs'),
  resolve(repoRoot, 'infra/scripts/fcm-token-registration-smoke.mjs'),
];
const requiredSources = [
  resolve(repoRoot, '.env.example'),
  resolve(repoRoot, 'infra/env/hands-staging.env.example'),
  resolve(repoRoot, 'infra/scripts/check-env.mjs'),
  resolve(repoRoot, 'infra/scripts/check-external-setup.mjs'),
  resolve(repoRoot, 'infra/scripts/external-registration-pack.mjs'),
  resolve(repoRoot, 'apps/admin_web/app/setup/setup-page-data.ts'),
  resolve(repoRoot, 'docs/architecture/external-setup-checklist.md'),
  resolve(repoRoot, 'docs/architecture/notifications.md'),
];
const smokeEnvRequiredSources = [
  resolve(repoRoot, '.env.example'),
  resolve(repoRoot, 'infra/env/hands-staging.env.example'),
];

const apiSource = apiSourcePaths.map((sourcePath) => readFileSync(sourcePath, 'utf8')).join('\n');
const fcmEnvKeys = Array.from(
  new Set(
    [...apiSource.matchAll(/config\.get<string>\('([^']+)'\)/g)]
      .map((match) => match[1])
      .filter(
        (key) =>
          key === 'PUSH_PROVIDER' || key.startsWith('FIREBASE_') || key === 'GOOGLE_APPLICATION_CREDENTIALS',
      ),
  ),
).sort();
const smokeSource = smokeSourcePaths.map((sourcePath) => readFileSync(sourcePath, 'utf8')).join('\n');
const fcmSmokeEnvKeys = Array.from(
  new Set([...smokeSource.matchAll(/\b(FCM_(?:SMOKE|TOKEN_SMOKE)_[A-Z0-9_]+)\b/g)].map((match) => match[1])),
).sort();

const missingBySource = {};
for (const sourcePath of requiredSources) {
  const source = readFileSync(sourcePath, 'utf8');
  const missing = fcmEnvKeys.filter((key) => !source.includes(key));
  if (missing.length > 0) {
    missingBySource[relativePath(sourcePath)] = missing;
  }
}

const missingSmokeBySource = {};
for (const sourcePath of smokeEnvRequiredSources) {
  const source = readFileSync(sourcePath, 'utf8');
  const missing = fcmSmokeEnvKeys.filter((key) => !source.includes(key));
  if (missing.length > 0) {
    missingSmokeBySource[relativePath(sourcePath)] = missing;
  }
}

const result = {
  ok: Object.keys(missingBySource).length === 0 && Object.keys(missingSmokeBySource).length === 0,
  fcmEnvKeys,
  fcmSmokeEnvKeys,
  missingBySource,
  missingSmokeBySource,
};

if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));

function relativePath(sourcePath) {
  return sourcePath.replace(`${repoRoot}\\`, '').replaceAll('\\', '/');
}
