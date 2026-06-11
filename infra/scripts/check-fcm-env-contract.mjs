import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const apiSourcePaths = [
  resolve(repoRoot, 'apps/api/src/notifications/push-delivery.service.ts'),
  resolve(repoRoot, 'apps/api/src/notifications/firebase-admin-credentials.ts'),
];
const requiredSources = [
  resolve(repoRoot, '.env.example'),
  resolve(repoRoot, 'infra/env/hands-staging.env.example'),
  resolve(repoRoot, 'infra/scripts/check-env.mjs'),
  resolve(repoRoot, 'infra/scripts/check-external-setup.mjs'),
  resolve(repoRoot, 'apps/admin_web/app/setup/page.tsx'),
  resolve(repoRoot, 'docs/architecture/notifications.md'),
];

const apiSource = apiSourcePaths.map((sourcePath) => readFileSync(sourcePath, 'utf8')).join('\n');
const fcmEnvKeys = Array.from(
  new Set(
    [...apiSource.matchAll(/config\.get<string>\('([^']+)'\)/g)]
      .map((match) => match[1])
      .filter(
        (key) =>
          key === 'PUSH_PROVIDER' ||
          key.startsWith('FIREBASE_') ||
          key === 'GOOGLE_APPLICATION_CREDENTIALS',
      ),
  ),
).sort();

const missingBySource = {};
for (const sourcePath of requiredSources) {
  const source = readFileSync(sourcePath, 'utf8');
  const missing = fcmEnvKeys.filter((key) => !source.includes(key));
  if (missing.length > 0) {
    missingBySource[sourcePath.replace(`${repoRoot}\\`, '').replaceAll('\\', '/')] = missing;
  }
}

const result = {
  ok: Object.keys(missingBySource).length === 0,
  fcmEnvKeys,
  missingBySource,
};

if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
