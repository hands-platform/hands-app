import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const apiRetryAudit = readSource('apps/api/src/notifications/notification-retry-audit.ts');
const adminAuditLog = readSource('apps/admin_web/app/audit-log/page.tsx');
const fcmPushSmoke = readSource('infra/scripts/fcm-push-smoke.mjs');

const retryAuditMetadataKeys = [
  'notificationId',
  'latestDelivery',
  'retryJob',
  'retryAlreadyDelivered',
  'retryRisk',
  'operatorAction',
];

const latestDeliveryKeys = [
  'id',
  'provider',
  'status',
  'attemptedAt',
  'failureCode',
  'pushDeviceId',
  'pushDeviceEnabled',
  'pushDeviceLastSeenAt',
  'pushDevicePlatform',
];

const retryJobKeys = ['queueName', 'jobName', 'attempts', 'backoffMs', 'queuedJobId'];

const apiRequiredKeys = [...retryAuditMetadataKeys, ...latestDeliveryKeys, ...retryJobKeys];
const adminRequiredKeys = [
  'latestDelivery',
  'retryJob',
  'retryAlreadyDelivered',
  'retryRisk',
  'provider',
  'status',
  'attemptedAt',
  'failureCode',
  'pushDeviceId',
  'pushDeviceEnabled',
  'pushDeviceLastSeenAt',
  'pushDevicePlatform',
  'jobName',
];
const smokeRequiredKeys = [
  'latestDelivery',
  'retryJob',
  'retryAlreadyDelivered',
  'retryRisk',
  'provider',
  'status',
  'failureCode',
  'pushDeviceId',
  'pushDeviceEnabled',
  'pushDeviceLastSeenAt',
  'pushDevicePlatform',
  'jobName',
  'queueName',
  'attempts',
  'backoffMs',
  'queuedJobId',
];

const result = {
  ok: true,
  apiMissingKeys: missingKeys(apiRetryAudit, apiRequiredKeys),
  adminMissingKeys: missingKeys(adminAuditLog, adminRequiredKeys),
  smokeMissingKeys: missingKeys(fcmPushSmoke, smokeRequiredKeys),
  duplicateMetadataKeys: duplicates(retryAuditMetadataKeys),
  duplicateLatestDeliveryKeys: duplicates(latestDeliveryKeys),
  duplicateRetryJobKeys: duplicates(retryJobKeys),
};

result.ok =
  result.apiMissingKeys.length === 0 &&
  result.adminMissingKeys.length === 0 &&
  result.smokeMissingKeys.length === 0 &&
  result.duplicateMetadataKeys.length === 0 &&
  result.duplicateLatestDeliveryKeys.length === 0 &&
  result.duplicateRetryJobKeys.length === 0;

if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));

function readSource(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function missingKeys(source, keys) {
  return keys.filter((key) => !source.includes(key));
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      repeated.add(value);
    }
    seen.add(value);
  }
  return [...repeated];
}
