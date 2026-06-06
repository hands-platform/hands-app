import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ?? '.');
const adminServicePath = resolve(root, 'apps/api/src/admin/admin.service.ts');
const adminWebAppRoot = resolve(root, 'apps/admin_web/app');

const violations = [];

const adminServiceSource = readFileSync(adminServicePath, 'utf8');
if (!adminServiceSource.includes('const ADMIN_APP_SESSION_LIST_LIMIT = 500;')) {
  violations.push({
    area: 'admin app session query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'App session list query must keep the 500-row operations guard.',
  });
}

if (!adminServiceSource.includes('take: ADMIN_APP_SESSION_LIST_LIMIT,')) {
  violations.push({
    area: 'admin app session query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'App session list query must apply ADMIN_APP_SESSION_LIST_LIMIT.',
  });
}

if (!adminServiceSource.includes('const ADMIN_CUSTOMER_LIST_LIMIT = 500;')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list query must keep the 500-row operations guard.',
  });
}

if (!adminServiceSource.includes('take: ADMIN_CUSTOMER_LIST_LIMIT,')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list query must apply ADMIN_CUSTOMER_LIST_LIMIT.',
  });
}

if (!adminServiceSource.includes('const ADMIN_PROVIDER_COMPACT_LIST_LIMIT = 500;')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Compact partner list query must keep the 500-row operations guard.',
  });
}

if (!adminServiceSource.includes('const ADMIN_PROVIDER_COMPACT_BOOKING_RELATION_LIMIT = 50;')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Compact partner list booking relations must keep a 50-row guard.',
  });
}

if (!adminServiceSource.includes('const ADMIN_PROVIDER_COMPACT_PARTICIPANT_RELATION_LIMIT = 50;')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Compact partner list participant relations must keep a 50-row guard.',
  });
}

if (!adminServiceSource.includes('const ADMIN_PROVIDER_COMPACT_EARNING_RELATION_LIMIT = 30;')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Compact partner list earning relations must keep a 30-row guard.',
  });
}

if (!adminServiceSource.includes('...(compact ? { take: ADMIN_PROVIDER_COMPACT_LIST_LIMIT } : {})')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Compact partner list query must apply ADMIN_PROVIDER_COMPACT_LIST_LIMIT.',
  });
}

if (adminServiceSource.includes('take: compact ? 100 : 100')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Compact partner list must not load 100 nested booking or participant rows per partner.',
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
    'Static guard for Admin Operations app session, customer, and partner list query size.',
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
