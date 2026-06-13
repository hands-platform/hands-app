import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const apiPushDataKeys = readStringCollection(
  resolve(repoRoot, 'apps/api/src/notifications/notification-push-payload.ts'),
  'PUSH_DATA_KEYS',
);
const customerOpenIntentKeys = readDartOpenIntentKeys(
  resolve(
    repoRoot,
    'apps/customer_app/lib/src/features/notification/domain/entities/push_notification_open_intent.dart',
  ),
);
const providerOpenIntentKeys = readDartOpenIntentKeys(
  resolve(
    repoRoot,
    'apps/provider_app/lib/src/features/notification/domain/entities/push_notification_open_intent.dart',
  ),
);

const sensitiveKeys = [
  'address',
  'addressText',
  'body',
  'customerAddress',
  'email',
  'fullName',
  'message',
  'notes',
  'operatorNote',
  'phone',
  'pushToken',
  'reason',
  'title',
  'token',
];
const requiredBackendKeys = ['notificationId'];
const apiPushDataKeySet = new Set(apiPushDataKeys);
const mobileOpenIntentKeys = union(customerOpenIntentKeys, providerOpenIntentKeys);
const missingFromApi = mobileOpenIntentKeys.filter((key) => !apiPushDataKeySet.has(key));
const missingBackendKeys = requiredBackendKeys.filter((key) => !apiPushDataKeySet.has(key));
const sensitiveKeysAllowed = apiPushDataKeys.filter((key) => sensitiveKeys.includes(key));
const duplicateApiPushDataKeys = duplicates(apiPushDataKeys);

const result = {
  ok:
    missingFromApi.length === 0 &&
    missingBackendKeys.length === 0 &&
    sensitiveKeysAllowed.length === 0 &&
    duplicateApiPushDataKeys.length === 0,
  apiPushDataKeys,
  customerOpenIntentKeys,
  providerOpenIntentKeys,
  missingFromApi,
  missingBackendKeys,
  sensitiveKeysAllowed,
  duplicateApiPushDataKeys,
};

if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));

function readStringCollection(filePath, exportName) {
  const source = readFileSync(filePath, 'utf8');
  const setPattern = new RegExp(
    `(?:export\\s+)?const\\s+${exportName}\\s*=\\s*new\\s+Set\\s*\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)`,
  );
  const match = source.match(setPattern);
  if (!match) {
    throw new Error(`Unable to find ${exportName} string set in ${filePath}`);
  }
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((item) => item[1]);
}

function readDartOpenIntentKeys(filePath) {
  const source = readFileSync(filePath, 'utf8');
  return unique(Array.from(source.matchAll(/_stringValue\(\s*data,\s*'([^']+)'\s*\)/g)).map((item) => item[1]));
}

function union(left, right) {
  return unique([...left, ...right]);
}

function unique(values) {
  return [...new Set(values)];
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
