import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const apiPolicyPath = join(root, 'apps/api/src/matching/matching.policy.ts');
const adminPolicyPath = join(root, 'apps/admin_web/lib/operations-policy.ts');

const apiPolicySource = readFileSync(apiPolicyPath, 'utf8');
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

const ok = checks.every((check) => check.status === 'PASS');
const output = {
  ok,
  purpose:
    'Static guard that Admin operations policy keys and defaults stay aligned with the NestJS business policy source.',
  apiPolicyPath,
  adminPolicyPath,
  checks,
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
