import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const apiRetryAudit = readSource('apps/api/src/notifications/notification-retry-audit.ts');
const apiNotificationsService = readSource('apps/api/src/notifications/notifications.service.ts');
const adminAuditLog = readSources([
  'apps/admin_web/app/audit-log/page.tsx',
  'apps/admin_web/app/audit-log/page-content.tsx',
  'apps/admin_web/app/audit-log/audit-evidence-drawer.tsx',
  'apps/admin_web/app/audit-log/audit-notification-retry-evidence.tsx',
]);
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
const serviceSharedTypeKeys = ['NotificationRetryAuditLatestDelivery', 'NotificationRetryAuditJobSummary'];

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

const apiRetryDecisionOrder = [
  'latestDelivery.pushDeviceEnabled === false',
  "latestDelivery.status === 'FAILED'",
  'hasStalePushTokenTimestamp(latestDelivery)',
];
const adminRetryDecisionOrder = [
  'latestDelivery.pushDevice?.enabled === false',
  "latestDelivery.status === 'FAILED'",
  'isStaleNotificationPushDeviceDelivery(latestDelivery)',
];

const result = {
  ok: true,
  apiMissingKeys: missingKeys(apiRetryAudit, apiRequiredKeys),
  apiServiceMissingSharedTypes: missingKeys(apiNotificationsService, serviceSharedTypeKeys),
  adminMissingKeys: missingKeys(adminAuditLog, adminRequiredKeys),
  smokeMissingKeys: missingKeys(fcmPushSmoke, smokeRequiredKeys),
  duplicateMetadataKeys: duplicates(retryAuditMetadataKeys),
  duplicateLatestDeliveryKeys: duplicates(latestDeliveryKeys),
  duplicateRetryJobKeys: duplicates(retryJobKeys),
  apiRetryDecisionOrder: orderedMarkers(apiRetryAudit, apiRetryDecisionOrder),
  adminRetryDecisionOrder: orderedMarkers(
    readSource('apps/admin_web/app/notifications/notification-action-confirmation.ts'),
    adminRetryDecisionOrder,
  ),
};

result.ok =
  result.apiMissingKeys.length === 0 &&
  result.apiServiceMissingSharedTypes.length === 0 &&
  result.adminMissingKeys.length === 0 &&
  result.smokeMissingKeys.length === 0 &&
  result.duplicateMetadataKeys.length === 0 &&
  result.duplicateLatestDeliveryKeys.length === 0 &&
  result.duplicateRetryJobKeys.length === 0 &&
  result.apiRetryDecisionOrder.ok &&
  result.adminRetryDecisionOrder.ok;

if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));

function readSource(relativePath) {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

function readSources(relativePaths) {
  return relativePaths
    .filter((relativePath) => existsSync(resolve(repoRoot, relativePath)))
    .map(readSource)
    .join('\n');
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

function orderedMarkers(source, markers) {
  const positions = markers.map((marker) => ({
    marker,
    index: source.indexOf(marker),
  }));
  const missing = positions.filter((entry) => entry.index === -1).map((entry) => entry.marker);
  const inOrder = positions.every((entry, index) => index === 0 || positions[index - 1].index < entry.index);

  return {
    ok: missing.length === 0 && inOrder,
    missing,
    positions,
  };
}
