import type { AdminOperationalPolicySetting } from '../../lib/admin-api';
import {
  ADMIN_OPERATIONS_POLICY_DEFAULTS,
  LEGACY_OPERATIONAL_POLICY_KEYS,
  OPERATIONAL_POLICY_KEYS,
  adminWalletGateBlocksMarketplaceParticipation,
  normalizeAdminMarketplaceOpenMode,
} from '../../lib/operations-policy';

export type PolicyEnforcementTraceItem = {
  scope: string;
  title: string;
  detail: string;
  api: string;
  server: string;
  verify: string;
};

export function buildPolicyEnforcementTrace(
  settings: AdminOperationalPolicySetting[],
): PolicyEnforcementTraceItem[] {
  const responseWindowMinutes =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.providerResponseWindowMinutes;
  const backupRadiusMeters =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceRadiusMeters;
  const backupLocationFreshnessMinutes =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceLocationFreshnessMinutes;
  const rawMarketplaceOpenMode =
    policyStringValueFromKeys(settings, [
      OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
    ]) ?? ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceOpenMode;
  const marketplaceOpenMode = normalizeAdminMarketplaceOpenMode(rawMarketplaceOpenMode);
  const marketplaceTimingIsNormalized = rawMarketplaceOpenMode !== marketplaceOpenMode;
  const marketplaceTimingTitle = marketplaceTimingIsNormalized
    ? 'Legacy delayed value normalized to immediate marketplace'
    : marketplaceOpenMode === 'IMMEDIATE_WITHIN_WINDOW'
      ? 'Marketplace Partners can participate during the wait'
      : 'Marketplace Partners wait until timer or decline';
  const marketplaceTimingDetail = marketplaceTimingIsNormalized
    ? 'The API accepts legacy delayed policy rows but runs marketplace participation in parallel with the first-pick window.'
    : 'This controls whether marketplace Partners can participate during the first-pick response window.';
  const preferredAcceptMode =
    policyStringValue(settings, OPERATIONAL_POLICY_KEYS.preferredAcceptMode) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.preferredAcceptMode;
  const walletGate =
    policyStringValue(settings, OPERATIONAL_POLICY_KEYS.walletNegativeGate) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.walletNegativeGate;

  return [
    {
      scope: 'Booking create',
      title: `${responseWindowMinutes} minute first-pick timer`,
      detail:
        'New direct bookings store the current response-window policy in booking metadata and expiry time.',
      api: 'Customer booking creation endpoint',
      server: 'Booking creation flow -> matching open flow',
      verify:
        'Verify with a new booking, then open the booking detail timeline and matching policy snapshot.',
    },
    {
      scope: 'Marketplace participation',
      title: `${formatDistance(backupRadiusMeters)} marketplace alert policy`,
      detail:
        'Marketplace Partners are prioritized by booking-address distance before alerts and operator review.',
      api: 'Partner open-request list and marketplace join endpoints',
      server: 'Marketplace eligibility pipeline -> visibility check -> booking-address radius gate',
      verify: 'Verify from Operations Policy simulator and Partner Controls location freshness records.',
    },
    {
      scope: 'Location gate',
      title: `${backupLocationFreshnessMinutes} minute location freshness`,
      detail:
        'Partners with stale or missing last location are flagged before marketplace alerts, participation, and shown as dispatch checks.',
      api: 'Partner location heartbeat and open-request list endpoints',
      server: 'Marketplace eligibility pipeline -> location freshness guard',
      verify:
        'Verify by opening App Sessions and Partner Controls after a partner app sends or misses a location heartbeat.',
    },
    {
      scope: 'Customer choice',
      title:
        preferredAcceptMode === 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT'
          ? 'First-pick priority with customer fallback'
          : 'Customer final selection policy conflict',
      detail:
        'The first-pick Partner can match first under API rules; otherwise the customer selects from participating Partners. Treat policies that remove the fallback as an operations conflict.',
      api: 'Partner accept endpoint and customer final-choice endpoint',
      server: 'Participant response flow -> customer final-choice guard',
      verify:
        'Verify by creating a direct booking, sending the partner response in the Partner app, then checking the customer waiting screen.',
    },
    {
      scope: 'Marketplace timing',
      title: marketplaceTimingTitle,
      detail: marketplaceTimingDetail,
      api: 'Partner open-request list and marketplace join endpoints',
      server: 'Marketplace timing guard',
      verify: 'Verify from partner app open request list while a direct booking is still waiting.',
    },
    {
      scope: 'Wallet gate',
      title: adminWalletGateBlocksMarketplaceParticipation(walletGate)
        ? 'Negative wallet gates marketplace alerts and participation'
        : 'Historical exception mode is not active for MVP',
      detail:
        'Cash-service company fee debt is enforced before marketplace alerts, participation, and payout release.',
      api: 'Partner marketplace join endpoint and admin payout batch endpoint',
      server: 'Booking join wallet guard -> earnings payout release guards',
      verify:
        'Verify from Cash Settlements, Partner Controls, and a blocked marketplace participation attempt in the partner app.',
    },
  ];
}

function policyNumberValue(settings: AdminOperationalPolicySetting[], key: string) {
  return readOptionalNumber(policyRawValue(settings, key));
}

function policyStringValue(settings: AdminOperationalPolicySetting[], key: string) {
  return readOptionalString(policyRawValue(settings, key));
}

function policyStringValueFromKeys(settings: AdminOperationalPolicySetting[], keys: string[]) {
  for (const key of keys) {
    const value = policyStringValue(settings, key);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

function policyRawValue(settings: AdminOperationalPolicySetting[], key: string) {
  return settings.find((setting) => setting.key === key)?.value;
}

function readOptionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readOptionalString(value: unknown) {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
}
