import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const apiPartnerAlerts = readStringCollection(
  resolve(repoRoot, 'apps/api/src/notifications/notification-push-payload.ts'),
  'PARTNER_ALERT_TYPES',
);
const adminPartnerAlerts = readStringCollection(
  resolve(repoRoot, 'apps/admin_web/app/notifications/notification-page-model.ts'),
  'PARTNER_ALERT_TYPES',
);
const sharedEvents = readStringCollection(
  resolve(repoRoot, 'packages/shared-types/src/index.ts'),
  'REALTIME_EVENTS',
);

const apiPartnerAlertSet = new Set(apiPartnerAlerts);
const adminPartnerAlertSet = new Set(adminPartnerAlerts);
const sharedEventSet = new Set(sharedEvents);

const missingFromAdmin = apiPartnerAlerts.filter((event) => !adminPartnerAlertSet.has(event));
const missingFromApi = adminPartnerAlerts.filter((event) => !apiPartnerAlertSet.has(event));
const missingFromShared = union(apiPartnerAlerts, adminPartnerAlerts).filter(
  (event) => !sharedEventSet.has(event),
);
const duplicateApiPartnerAlerts = duplicates(apiPartnerAlerts);
const duplicateAdminPartnerAlerts = duplicates(adminPartnerAlerts);

const result = {
  ok:
    missingFromAdmin.length === 0 &&
    missingFromApi.length === 0 &&
    missingFromShared.length === 0 &&
    duplicateApiPartnerAlerts.length === 0 &&
    duplicateAdminPartnerAlerts.length === 0,
  apiPartnerAlertCount: apiPartnerAlerts.length,
  adminPartnerAlertCount: adminPartnerAlerts.length,
  missingFromAdmin,
  missingFromApi,
  missingFromShared,
  duplicateApiPartnerAlerts,
  duplicateAdminPartnerAlerts,
};

if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));

function readStringCollection(filePath, exportName) {
  const source = readFileSync(filePath, 'utf8');
  const arrayPattern = new RegExp(
    `(?:export\\s+)?const\\s+${exportName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`,
  );
  const setPattern = new RegExp(
    `(?:export\\s+)?const\\s+${exportName}\\s*=\\s*new\\s+Set\\s*\\(\\s*\\[([\\s\\S]*?)\\]\\s*\\)`,
  );
  const match = source.match(arrayPattern) ?? source.match(setPattern);
  if (!match) {
    throw new Error(`Unable to find ${exportName} string collection in ${filePath}`);
  }
  return Array.from(match[1].matchAll(/'([^']+)'/g)).map((item) => item[1]);
}

function union(left, right) {
  return [...new Set([...left, ...right])];
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
