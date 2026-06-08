import type { AdminOperationalPolicySetting } from '../../lib/admin-api';
import {
  ADMIN_OPERATIONS_POLICY_DEFAULTS,
  LEGACY_OPERATIONAL_POLICY_KEYS,
  OPERATIONAL_POLICY_KEYS,
  adminWalletGateBlocksMarketplaceParticipation,
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
  const marketplaceOpenMode =
    policyStringValueFromKeys(settings, [
      OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
    ]) ?? ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceOpenMode;
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
      api: 'POST /customer/bookings',
      server: 'BookingsService.createBooking -> MatchingService.openBooking',
      verify:
        'Verify with a new booking, then open the booking detail timeline and matching policy snapshot.',
    },
    {
      scope: 'Marketplace participation',
      title: `${formatDistance(backupRadiusMeters)} marketplace alert policy`,
      detail:
        'Marketplace partners are prioritized by booking-address distance before alerts and operator review.',
      api: 'GET /provider/bookings/open, POST /provider/bookings/:id/join',
      server: 'Marketplace eligibility pipeline -> visibility check -> booking-address radius gate',
      verify: 'Verify from Operations Policy simulator and Partner Controls location freshness records.',
    },
    {
      scope: 'Location gate',
      title: `${backupLocationFreshnessMinutes} minute location freshness`,
      detail:
        'Partners with stale or missing last location are flagged before marketplace participation and shown as dispatch checks.',
      api: 'POST /provider/location, GET /provider/bookings/open',
      server: 'Marketplace eligibility pipeline -> providerLocationFreshEnough',
      verify:
        'Verify by opening App Sessions and Partner Controls after a partner app sends or misses a location heartbeat.',
    },
    {
      scope: 'Customer choice',
      title:
        preferredAcceptMode === 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT'
          ? 'Customer keeps final partner selection'
          : 'Customer final selection policy conflict',
      detail:
        'HANDS MVP requires customer final partner selection. Treat any policy that removes that step as an operations conflict before rollout.',
      api: 'POST /provider/bookings/:id/accept, POST /customer/bookings/:id/select-provider',
      server: 'BookingsService.updateParticipant -> BookingsService.selectProvider',
      verify:
        'Verify by creating a direct booking, sending the partner response in the Partner app, then checking the customer waiting screen.',
    },
    {
      scope: 'Marketplace timing',
      title:
        marketplaceOpenMode === 'IMMEDIATE_WITHIN_WINDOW'
          ? 'Marketplace partners can participate during the wait'
          : 'Marketplace partners wait until timer or decline',
      detail:
        'This controls whether marketplace partners can participate during the first-pick response window.',
      api: 'GET /provider/bookings/open, POST /provider/bookings/:id/join',
      server: 'BookingsService.isBackupWindowOpen',
      verify: 'Verify from partner app open request list while a direct booking is still waiting.',
    },
    {
      scope: 'Wallet gate',
      title: adminWalletGateBlocksMarketplaceParticipation(walletGate)
        ? 'Negative wallet gates marketplace participation'
        : 'Historical exception mode is not active for MVP',
      detail:
        'Cash-service company fee debt is enforced before marketplace participation and payout release.',
      api: 'POST /provider/bookings/:id/join, POST /admin/payout-batches',
      server: 'BookingsService.joinBooking wallet guard -> EarningsService wallet release guards',
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
