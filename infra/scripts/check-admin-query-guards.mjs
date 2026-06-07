import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ?? '.');
const adminServicePath = resolve(root, 'apps/api/src/admin/admin.service.ts');
const adminWebAppRoot = resolve(root, 'apps/admin_web/app');

const violations = [];

const adminServiceSource = readFileSync(adminServicePath, 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = adminServiceSource.indexOf(startMarker);
  if (start === -1) return '';
  const end = adminServiceSource.indexOf(endMarker, start + startMarker.length);
  return adminServiceSource.slice(start, end === -1 ? undefined : end);
}

const providerListSource = sourceBetween('async listProviders', 'async getProviderDetail');

if (!adminServiceSource.includes('const ADMIN_APP_SESSION_LIST_LIMIT = 500;')) {
  violations.push({
    area: 'admin app session query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'App session list query must keep the 500-row operations guard.',
  });
}

if (!adminServiceSource.includes('const ADMIN_BOOKING_LIST_LIMIT = 100;')) {
  violations.push({
    area: 'admin booking query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Booking list query must keep the 100-row operations guard.',
  });
}

if (!adminServiceSource.includes('const ADMIN_CHAT_ARCHIVE_LIST_LIMIT = 200;')) {
  violations.push({
    area: 'admin chat archive query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Chat archive list query must keep the 200-row operations guard.',
  });
}

if (!adminServiceSource.includes('take: ADMIN_APP_SESSION_LIST_LIMIT,')) {
  violations.push({
    area: 'admin app session query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'App session list query must apply ADMIN_APP_SESSION_LIST_LIMIT.',
  });
}

if (!adminServiceSource.includes('take: ADMIN_BOOKING_LIST_LIMIT,')) {
  violations.push({
    area: 'admin booking query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Booking list query must apply ADMIN_BOOKING_LIST_LIMIT.',
  });
}

if (!adminServiceSource.includes('take: ADMIN_CHAT_ARCHIVE_LIST_LIMIT,')) {
  violations.push({
    area: 'admin chat archive query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Chat archive list query must apply ADMIN_CHAT_ARCHIVE_LIST_LIMIT.',
  });
}

if (!adminServiceSource.includes('const ADMIN_CUSTOMER_LIST_LIMIT = 500;')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list query must keep the 500-row operations guard.',
  });
}

if (!adminServiceSource.includes('const ADMIN_CUSTOMER_LIST_BOOKING_LIMIT = 25;')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list booking relations must keep a 25-row guard.',
  });
}

if (!adminServiceSource.includes('const ADMIN_CUSTOMER_LIST_LOCATION_LIMIT = 5;')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list selected-location relations must keep a 5-row guard.',
  });
}

if (!adminServiceSource.includes('const ADMIN_CUSTOMER_LIST_SESSION_LIMIT = 3;')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list app-session relations must keep a 3-row guard.',
  });
}

if (!adminServiceSource.includes('const ADMIN_CUSTOMER_LIST_PUSH_DEVICE_LIMIT = 3;')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list push-device relations must keep a 3-row guard.',
  });
}

if (!adminServiceSource.includes('const ADMIN_CUSTOMER_LIST_AUDIT_LOG_LIMIT = 3;')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list audit-log memo relations must keep a 3-row per-customer guard.',
  });
}

if (!adminServiceSource.includes('take: ADMIN_CUSTOMER_LIST_LIMIT,')) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list query must apply ADMIN_CUSTOMER_LIST_LIMIT.',
  });
}

if (
  !adminServiceSource.includes('take: customers.length * ADMIN_CUSTOMER_LIST_AUDIT_LOG_LIMIT,') &&
  !hasBoundedAuditSummaryHelper()
) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list audit-log query must cap rows by customer count and per-customer guard.',
  });
}

if (!hasAuditCountGroupBy('customerAuditCounts') && !hasAuditSummaryGroupByHelper()) {
  violations.push({
    area: 'admin customer query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Customer list must compute full audit-log memo counts separately from the latest memo preview rows.',
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

if (!adminServiceSource.includes('const ADMIN_PROVIDER_LIST_AUDIT_LOG_LIMIT = 3;')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Partner list audit-log memo relations must keep a 3-row per-partner guard.',
  });
}

if (!providerListSource.includes('take: ADMIN_PROVIDER_COMPACT_LIST_LIMIT,')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Partner list query must always apply ADMIN_PROVIDER_COMPACT_LIST_LIMIT.',
  });
}

if (!providerListSource.includes('select: adminProviderListSelect,')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Partner list query must use the bounded adminProviderListSelect.',
  });
}

if (providerListSource.includes('include:')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Partner list query must not use include; use bounded select fields and detail APIs for deep data.',
  });
}

if (providerListSource.includes('compact ?')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Partner list query must not expose full/expanded fetch branches.',
  });
}

if (adminServiceSource.includes('take: compact ? 100 : 100')) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Compact partner list must not load 100 nested booking or participant rows per partner.',
  });
}

if (
  !adminServiceSource.includes('take: providers.length * ADMIN_PROVIDER_LIST_AUDIT_LOG_LIMIT,') &&
  !hasBoundedAuditSummaryHelper()
) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Partner list audit-log query must cap rows by partner count and per-partner guard.',
  });
}

if (!hasAuditCountGroupBy('providerAuditCounts') && !hasAuditSummaryGroupByHelper()) {
  violations.push({
    area: 'admin provider query',
    file: 'apps/api/src/admin/admin.service.ts',
    message: 'Partner list must compute full audit-log memo counts separately from the latest memo preview rows.',
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

function hasAuditCountGroupBy(resultName) {
  const escapedName = resultName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const directGroupBy = new RegExp(
    `const\\s+${escapedName}\\s*=\\s*await\\s+this\\.prisma\\.adminAuditLog\\.groupBy`,
  );
  const promiseAllGroupBy = new RegExp(
    `\\[[^\\]]*${escapedName}[^\\]]*\\]\\s*=\\s*await\\s+Promise\\.all\\(\\[[\\s\\S]*?this\\.prisma\\.adminAuditLog\\.groupBy`,
  );

  return directGroupBy.test(adminServiceSource) || promiseAllGroupBy.test(adminServiceSource);
}

function hasAuditSummaryGroupByHelper() {
  const helperSource = sourceBetween(
    'private async getAuditLogSummaryByTargets',
    'private async findRecentAuditLogsByTargets',
  );
  return helperSource.includes('this.prisma.adminAuditLog.groupBy') && helperSource.includes("by: ['target']");
}

function hasBoundedAuditSummaryHelper() {
  const helperSource = sourceBetween('private async findRecentAuditLogsByTargets', '\n}\n\nfunction toJson');
  return (
    helperSource.includes('ROW_NUMBER() OVER (PARTITION BY logs."target" ORDER BY logs."createdAt" DESC)') &&
    helperSource.includes('WHERE "targetRank" <= ${perTargetLimit}') &&
    helperSource.includes('LIMIT ${targets.length * perTargetLimit}')
  );
}
