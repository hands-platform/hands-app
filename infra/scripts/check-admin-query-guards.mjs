import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ?? '.');
const adminServicePath = resolve(root, 'apps/api/src/admin/admin.service.ts');
const adminWebAppRoot = resolve(root, 'apps/admin_web/app');

const violations = [];

const adminServiceSource = readFileSync(adminServicePath, 'utf8');
if (!adminServiceSource.includes('const ADMIN_PROVIDER_COMPACT_LIST_LIMIT = 500;')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Compact partner list query must keep the 500-row operations guard.',
  });
}

if (!adminServiceSource.includes('...(compact ? { take: ADMIN_PROVIDER_COMPACT_LIST_LIMIT } : {})')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Compact partner list query must apply ADMIN_PROVIDER_COMPACT_LIST_LIMIT.',
  });
}

for (const file of listFiles(adminWebAppRoot)) {
  if (!file.endsWith('.ts') && !file.endsWith('.tsx')) continue;
  const source = readFileSync(file, 'utf8');
  const providerListCalls = [
    ...source.matchAll(/adminGet<AdminProvider\[]>\(['"`](\/admin\/(?:partners|providers)(?!\/)[^'"`]*)['"`]/g),
  ];

  for (const call of providerListCalls) {
    const route = call[1];
    if (!route.includes('view=list')) {
      violations.push({
        area: 'admin provider query',
        file: relativePath(file),
        message: `Admin provider list calls must request compact view=list. Found ${route}.`,
      });
    }
  }
}

const result = {
  ok: violations.length === 0,
  purpose:
    'Static guard for Admin Operations partner list query size and Admin Web compact partner list usage.',
  violations,
};

console.log(JSON.stringify(result, null, 2));
if (!result.ok) {
  process.exit(1);
}

function listFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

function relativePath(path) {
  return path.replace(root, '').replace(/^[/\\]/, '').replaceAll('\\', '/');
}
