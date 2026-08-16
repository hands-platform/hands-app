import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const apiPolicyPath = join(root, 'apps/api/src/matching/matching.policy.ts');
const apiAdminServicePath = join(root, 'apps/api/src/admin/admin.service.ts');
const adminPolicyPath = join(root, 'apps/admin_web/lib/operations-policy.ts');

const apiPolicySource = readFileSync(apiPolicyPath, 'utf8');
const apiAdminServiceSource = readFileSync(apiAdminServicePath, 'utf8');
const adminPolicySource = readFileSync(adminPolicyPath, 'utf8');

const adminPolicyKeysSource = readConstObjectSource(adminPolicySource, 'OPERATIONAL_POLICY_KEYS');
const adminDefaultsSource = readConstObjectSource(adminPolicySource, 'ADMIN_OPERATIONS_POLICY_DEFAULTS');
const apiStartShiftPolicyKeysSource = readConstObjectSource(
  apiPolicySource,
  'START_SHIFT_ACTION_SLA_POLICY_KEYS',
);
const apiStartShiftDefaultsSource = readConstObjectSource(
  apiPolicySource,
  'DEFAULT_START_SHIFT_ACTION_SLA_MINUTES',
);
const adminStartShiftDefaultsSource = readConstObjectSource(
  adminPolicySource,
  'ADMIN_START_SHIFT_ACTION_SLA_DEFAULTS',
);

const lifecycleCheck = checkLifecycleAndConsumers();

const requiredPolicies = [
  {
    label: 'travel buffer',
    apiKeyConst: 'MATCHING_TRAVEL_BUFFER_MINUTES_KEY',
    apiDefaultConst: 'DEFAULT_TRAVEL_BUFFER_MINUTES',
    adminKeyProp: 'travelBufferMinutes',
    adminDefaultProp: 'travelBufferMinutes',
  },
  {
    label: 'first-pick response window',
    apiKeyConst: 'MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY',
    apiDefaultConst: 'DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES',
    adminKeyProp: 'providerResponseWindowMinutes',
    adminDefaultProp: 'providerResponseWindowMinutes',
  },
  {
    label: 'marketplace radius',
    apiKeyConst: 'MATCHING_MARKETPLACE_PARTNER_RADIUS_METERS_KEY',
    apiDefaultConst: 'DEFAULT_BACKUP_PROVIDER_RADIUS_METERS',
    adminKeyProp: 'marketplaceRadiusMeters',
    adminDefaultProp: 'marketplaceRadiusMeters',
  },
  {
    label: 'marketplace location freshness',
    apiKeyConst: 'MATCHING_MARKETPLACE_PARTNER_LOCATION_MAX_AGE_MINUTES_KEY',
    apiDefaultConst: 'DEFAULT_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES',
    adminKeyProp: 'marketplaceLocationFreshnessMinutes',
    adminDefaultProp: 'marketplaceLocationFreshnessMinutes',
  },
  {
    label: 'marketplace invitation limit',
    apiKeyConst: 'MATCHING_MARKETPLACE_PARTNER_INVITATION_LIMIT_KEY',
    apiDefaultConst: 'DEFAULT_BACKUP_PROVIDER_INVITATION_LIMIT',
    adminKeyProp: 'marketplaceInvitationLimit',
    adminDefaultProp: 'marketplaceInvitationLimit',
  },
  {
    label: 'customer current-to-address evidence',
    apiKeyConst: 'BOOKING_MAX_CUSTOMER_CURRENT_TO_ADDRESS_KM_KEY',
    apiDefaultConst: 'DEFAULT_BOOKING_MAX_CUSTOMER_CURRENT_TO_ADDRESS_KM',
    adminKeyProp: 'bookingMaxCustomerCurrentToAddressKm',
    adminDefaultProp: 'bookingMaxCustomerCurrentToAddressKm',
  },
  {
    label: 'first-pick partner distance gate',
    apiKeyConst: 'BOOKING_MAX_PREFERRED_PROVIDER_DISTANCE_KM_KEY',
    apiDefaultConst: 'DEFAULT_BOOKING_MAX_PREFERRED_PROVIDER_DISTANCE_KM',
    adminKeyProp: 'bookingMaxPreferredPartnerDistanceKm',
    adminDefaultProp: 'bookingMaxPreferredPartnerDistanceKm',
  },
  {
    label: 'customer current location freshness',
    apiKeyConst: 'BOOKING_CURRENT_LOCATION_FRESHNESS_MINUTES_KEY',
    apiDefaultConst: 'DEFAULT_BOOKING_CURRENT_LOCATION_FRESHNESS_MINUTES',
    adminKeyProp: 'bookingCurrentLocationFreshnessMinutes',
    adminDefaultProp: 'bookingCurrentLocationFreshnessMinutes',
  },
  {
    label: 'marketplace open mode',
    apiKeyConst: 'MATCHING_MARKETPLACE_OPEN_MODE_KEY',
    apiDefaultConst: 'BACKUP_OPEN_IMMEDIATE',
    adminKeyProp: 'marketplaceOpenMode',
    adminDefaultProp: 'marketplaceOpenMode',
  },
  {
    label: 'first-pick acceptance contract',
    apiKeyConst: 'MATCHING_PREFERRED_ACCEPT_MODE_KEY',
    apiDefaultConst: 'PREFERRED_ACCEPT_CUSTOMER_CONFIRM',
    adminKeyProp: 'preferredAcceptMode',
    adminDefaultProp: 'preferredAcceptMode',
  },
  {
    label: 'partner alert channel',
    apiKeyConst: 'NOTIFICATION_PARTNER_ALERT_CHANNEL_KEY',
    apiDefaultConst: 'PARTNER_ALERT_IN_APP_WITH_PUSH_LATER',
    adminKeyProp: 'partnerAlertChannel',
    adminDefaultProp: 'partnerAlertChannel',
  },
  {
    label: 'negative wallet gate',
    apiKeyConst: 'WALLET_NEGATIVE_BALANCE_GATE_KEY',
    apiDefaultConst: 'WALLET_BLOCK_MARKETPLACE_PARTICIPATION',
    adminKeyProp: 'walletNegativeGate',
    adminDefaultProp: 'walletNegativeGate',
  },
  {
    label: 'cash settlement clearance',
    apiKeyConst: 'CASH_SETTLEMENT_CLEARANCE_POLICY_KEY',
    apiDefaultConst: 'CASH_CLEAR_DEPOSIT_OR_OFFSET_REQUIRED',
    adminKeyProp: 'cashSettlementClearance',
    adminDefaultProp: 'cashSettlementClearance',
  },
  {
    label: 'payout batch cycle',
    apiKeyConst: 'PAYOUT_BATCH_CYCLE_POLICY_KEY',
    apiDefaultConst: 'PAYOUT_BATCH_WEEKLY_OR_MONTHLY',
    adminKeyProp: 'payoutBatchCycle',
    adminDefaultProp: 'payoutBatchCycle',
  },
  ...[
    ['matching delay review SLA', 'matchingDelays', 'startShiftMatchingDelaysSlaMinutes'],
    ['payment hold review SLA', 'paymentHolds', 'startShiftPaymentHoldsSlaMinutes'],
    ['cancellation review SLA', 'cancellationReview', 'startShiftCancellationReviewSlaMinutes'],
    ['refund review SLA', 'refundReview', 'startShiftRefundReviewSlaMinutes'],
    [
      'notification failure review SLA',
      'notificationFailures',
      'startShiftNotificationFailuresSlaMinutes',
    ],
    [
      'cash reconciliation SLA',
      'cashReconciliation',
      'startShiftCashReconciliationSlaMinutes',
    ],
    ['partner approval SLA', 'partnerApprovals', 'startShiftPartnerApprovalsSlaMinutes'],
  ].map(([label, apiObjectProp, adminKeyProp]) => ({
    label,
    apiKeyObjectProp: apiObjectProp,
    apiDefaultObjectProp: apiObjectProp,
    adminKeyProp,
    adminDefaultProp: apiObjectProp,
    adminDefaultSource: adminStartShiftDefaultsSource,
  })),
];

const checks = requiredPolicies.map((policy) => {
  const apiKey = policy.apiKeyConst
    ? readExportedLiteral(apiPolicySource, policy.apiKeyConst)
    : readObjectLiteral(apiStartShiftPolicyKeysSource, policy.apiKeyObjectProp);
  const apiDefault = policy.apiDefaultConst
    ? readExportedLiteral(apiPolicySource, policy.apiDefaultConst)
    : readObjectLiteral(apiStartShiftDefaultsSource, policy.apiDefaultObjectProp);
  const adminKey = readObjectLiteral(adminPolicyKeysSource, policy.adminKeyProp);
  const adminDefault = readObjectLiteral(
    policy.adminDefaultSource ?? adminDefaultsSource,
    policy.adminDefaultProp,
  );
  const apiKeyReference = policy.apiKeyConst
    ?? `START_SHIFT_ACTION_SLA_POLICY_KEYS.${policy.apiKeyObjectProp}`;
  const apiDefaultReference = policy.apiDefaultConst
    ?? `DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.${policy.apiDefaultObjectProp}`;
  const definedInApiMetadata = apiPolicySource.includes(`key: ${apiKeyReference}`);

  const problems = [];
  if (apiKey === undefined) {
    problems.push(`Missing API key ${apiKeyReference}`);
  }
  if (apiDefault === undefined) {
    problems.push(`Missing API default ${apiDefaultReference}`);
  }
  if (adminKey === undefined) {
    problems.push(`Missing Admin key property ${policy.adminKeyProp}`);
  }
  if (adminDefault === undefined) {
    problems.push(`Missing Admin default property ${policy.adminDefaultProp}`);
  }
  if (apiKey !== undefined && adminKey !== undefined && apiKey !== adminKey) {
    problems.push(`Admin key ${adminKey} does not match API key ${apiKey}`);
  }
  if (apiDefault !== undefined && adminDefault !== undefined && apiDefault !== adminDefault) {
    problems.push(`Admin default ${adminDefault} does not match API default ${apiDefault}`);
  }
  if (!definedInApiMetadata) {
    problems.push(`API operational metadata does not expose ${apiKeyReference}`);
  }

  return {
    area: policy.label,
    status: problems.length === 0 ? 'PASS' : 'FAIL',
    apiKey,
    adminKey,
    apiDefault,
    adminDefault,
    problems,
  };
});

const ok = checks.every((check) => check.status === 'PASS') && lifecycleCheck.status === 'PASS';
const output = {
  ok,
  purpose:
    'Static guard that Admin operations policy keys and defaults stay aligned with the NestJS business policy source.',
  apiPolicyPath,
  adminPolicyPath,
  checks,
  lifecycleCheck,
};

console.log(JSON.stringify(output, null, 2));
if (!ok) {
  process.exit(1);
}

function readConstObjectSource(source, name) {
  const startMarker = `export const ${name} = {`;
  const start = source.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Cannot find ${name}`);
  }
  const end = source.indexOf('} as const;', start);
  if (end === -1) {
    throw new Error(`Cannot find end of ${name}`);
  }
  return source.slice(start + startMarker.length, end);
}

function checkLifecycleAndConsumers() {
  const problems = [];
  const baseDefinitionsSource = readBetween(
    apiPolicySource,
    'const OPERATIONAL_POLICY_BASE_DEFINITIONS: OperationalPolicyBaseDefinition[] = [',
    'const PLANNED_OPERATIONAL_POLICY_KEYS',
  );
  const definitionReferences = [...baseDefinitionsSource.matchAll(/\bkey:\s*([A-Za-z0-9_.]+)/g)].map(
    (match) => match[1],
  );
  const apiKeys = definitionReferences.map(resolveApiKeyReference).filter((value) => value !== undefined);
  if (apiKeys.length !== definitionReferences.length) {
    problems.push('Every API policy definition key reference must resolve to a literal key.');
  }
  const duplicateKeys = apiKeys.filter((key, index) => apiKeys.indexOf(key) !== index);
  if (duplicateKeys.length > 0) problems.push(`Duplicate API policy keys: ${[...new Set(duplicateKeys)].join(', ')}`);

  const plannedKeys = readSetKeyReferences(apiPolicySource, 'PLANNED_OPERATIONAL_POLICY_KEYS').map(
    resolveApiKeyReference,
  );
  const lockedKeys = readSetKeyReferences(apiPolicySource, 'LOCKED_OPERATIONAL_POLICY_KEYS').map(
    resolveApiKeyReference,
  );
  if (plannedKeys.some((key) => key === undefined) || lockedKeys.some((key) => key === undefined)) {
    problems.push('Every planned and locked lifecycle key must resolve to an API policy key.');
  }
  const expectedPlannedKeys = [
    'wallet.negative_balance_gate',
    'decision.action_evidence_gate_mode',
    'cash.settlement_clearance_policy',
    'payout.batch_cycle_policy',
    'matching.first_pick_expiry_action_policy',
    'cancellation.after_match_policy',
    'no_show.evidence_requirement_policy',
  ].sort();
  const expectedLockedKeys = [
    'matching.marketplace_open_mode',
    'matching.preferred_accept_mode',
  ].sort();
  if (JSON.stringify(plannedKeys.filter(Boolean).sort()) !== JSON.stringify(expectedPlannedKeys)) {
    problems.push('Planned lifecycle keys do not match the reviewed reference-only contract.');
  }
  if (JSON.stringify(lockedKeys.filter(Boolean).sort()) !== JSON.stringify(expectedLockedKeys)) {
    problems.push('Locked lifecycle keys do not match the fixed MVP contract.');
  }

  const adminKeys = [...adminPolicyKeysSource.matchAll(/\b\w+\s*:\s*['"]([^'"]+)['"]/g)]
    .map((match) => match[1])
    .filter((key) => key !== 'matching.backup_open_mode');
  const missingAdminKeys = apiKeys.filter((key) => !adminKeys.includes(key));
  const unknownAdminKeys = adminKeys.filter((key) => !apiKeys.includes(key));
  if (missingAdminKeys.length > 0) problems.push(`Admin is missing policy keys: ${missingAdminKeys.join(', ')}`);
  if (unknownAdminKeys.length > 0) problems.push(`Admin exposes unknown policy keys: ${unknownAdminKeys.join(', ')}`);

  const contractSource = readBetween(
    apiPolicySource,
    'function operationalPolicyConsumerContract(',
    'export const OPERATIONAL_POLICY_DEFINITIONS',
  );
  const consumerIds = readStringArrayValues(contractSource, 'consumerIds');
  const integrationTestIds = readStringArrayValues(contractSource, 'integrationTestIds');
  if (consumerIds.length === 0 || integrationTestIds.length === 0) {
    problems.push('Live policies must declare allowlisted consumer and integration test IDs.');
  }
  for (const consumerId of new Set(consumerIds)) {
    const [relativePath, symbol] = consumerId.split('#');
    const absolutePath = join(root, relativePath);
    if (!relativePath || !symbol || !existsSync(absolutePath)) {
      problems.push(`Unknown operational policy consumer ID: ${consumerId}`);
      continue;
    }
    if (!readFileSync(absolutePath, 'utf8').includes(symbol)) {
      problems.push(`Operational policy consumer symbol is missing: ${consumerId}`);
    }
  }
  for (const testId of new Set(integrationTestIds)) {
    if (!existsSync(join(root, testId))) problems.push(`Unknown operational policy integration test ID: ${testId}`);
  }

  const liveCount = apiKeys.length - plannedKeys.length - lockedKeys.length;
  if (apiKeys.length !== 28 || liveCount !== 19 || lockedKeys.length !== 2 || plannedKeys.length !== 7) {
    problems.push(
      `Lifecycle count drift: ${liveCount} live, ${lockedKeys.length} locked, ${plannedKeys.length} planned across ${apiKeys.length} definitions.`,
    );
  }
  if (!apiAdminServiceSource.includes("definition.lifecycle !== 'live'")) {
    problems.push('API write guard does not reject non-live lifecycle definitions.');
  }

  return {
    status: problems.length === 0 ? 'PASS' : 'FAIL',
    definitionCount: apiKeys.length,
    lifecycleCounts: { live: liveCount, locked: lockedKeys.length, planned: plannedKeys.length },
    consumerIds: [...new Set(consumerIds)].sort(),
    integrationTestIds: [...new Set(integrationTestIds)].sort(),
    problems,
  };
}

function resolveApiKeyReference(reference) {
  if (reference.startsWith('START_SHIFT_ACTION_SLA_POLICY_KEYS.')) {
    return readObjectLiteral(apiStartShiftPolicyKeysSource, reference.split('.')[1]);
  }
  return readExportedLiteral(apiPolicySource, reference);
}

function readSetKeyReferences(source, name) {
  const body = readBetween(source, `const ${name} = new Set<string>([`, ']);');
  return body.match(/[A-Z][A-Z0-9_]+/g) ?? [];
}

function readStringArrayValues(source, propertyName) {
  const values = [];
  const pattern = new RegExp(`${propertyName}:\\s*\\[([\\s\\S]*?)\\]`, 'g');
  for (const match of source.matchAll(pattern)) {
    values.push(...[...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((value) => value[1]));
  }
  return values;
}

function readBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) throw new Error(`Cannot find ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end === -1) throw new Error(`Cannot find ${endMarker}`);
  return source.slice(start + startMarker.length, end);
}

function readExportedLiteral(source, name) {
  const match = source.match(new RegExp(`export const ${escapeRegExp(name)}\\s*=\\s*([\\s\\S]*?);`));
  if (!match) {
    return undefined;
  }
  return parseLiteral(match[1]);
}

function readObjectLiteral(objectSource, propertyName) {
  const match = objectSource.match(new RegExp(`${escapeRegExp(propertyName)}\\s*:\\s*([^,\\n]+)`));
  if (!match) {
    return undefined;
  }
  return parseLiteral(match[1]);
}

function parseLiteral(rawValue) {
  const value = rawValue.trim();
  const stringMatch = value.match(/^['"]([^'"]+)['"]$/);
  if (stringMatch) {
    return stringMatch[1];
  }

  const normalizedNumber = value.replaceAll('_', '');
  if (/^-?\d+(\.\d+)?$/.test(normalizedNumber)) {
    return Number(normalizedNumber);
  }

  return undefined;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
