import type { AdminOperationalPolicySetting } from './admin-api';

export const OPERATIONAL_POLICY_KEYS = {
  providerResponseWindowMinutes: 'matching.provider_response_window_minutes',
  marketplaceRadiusMeters: 'matching.backup_provider_radius_meters',
  marketplaceLocationFreshnessMinutes: 'matching.backup_provider_location_max_age_minutes',
  marketplaceInvitationLimit: 'matching.backup_provider_invitation_limit',
  backupOpenMode: 'matching.backup_open_mode',
  preferredAcceptMode: 'matching.preferred_accept_mode',
  walletNegativeGate: 'wallet.negative_balance_gate',
  cashSettlementClearance: 'cash.settlement_clearance_policy',
  payoutBatchCycle: 'payout.batch_cycle_policy',
} as const;

export type AdminLiveOperationsPolicy = {
  providerResponseWindowMinutes: number;
  marketplaceRadiusMeters: number;
  marketplaceLocationFreshnessMinutes: number;
  marketplaceInvitationLimit: number;
  backupOpenMode: string;
  preferredAcceptMode: string;
  walletNegativeGate: string;
  cashSettlementClearance: string;
  payoutBatchCycle: string;
};

export function buildAdminLiveOperationsPolicy(
  settings: AdminOperationalPolicySetting[],
): AdminLiveOperationsPolicy {
  return {
    providerResponseWindowMinutes:
      readPolicyNumber(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ?? 10,
    marketplaceRadiusMeters:
      readPolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ?? 10_000,
    marketplaceLocationFreshnessMinutes:
      readPolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ?? 30,
    marketplaceInvitationLimit:
      readPolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit) ?? 50,
    backupOpenMode:
      readPolicyString(settings, OPERATIONAL_POLICY_KEYS.backupOpenMode) ?? 'IMMEDIATE',
    preferredAcceptMode:
      readPolicyString(settings, OPERATIONAL_POLICY_KEYS.preferredAcceptMode) ?? 'CUSTOMER_CONFIRM',
    walletNegativeGate:
      readPolicyString(settings, OPERATIONAL_POLICY_KEYS.walletNegativeGate) ??
      'BLOCK_ACCEPTS_WHEN_NEGATIVE',
    cashSettlementClearance:
      readPolicyString(settings, OPERATIONAL_POLICY_KEYS.cashSettlementClearance) ??
      'DEPOSIT_OR_ADMIN_OFFSET_REQUIRED',
    payoutBatchCycle:
      readPolicyString(settings, OPERATIONAL_POLICY_KEYS.payoutBatchCycle) ??
      'WEEKLY_OR_MONTHLY',
  };
}

export function readPolicyNumber(settings: AdminOperationalPolicySetting[], key: string) {
  const value = settings.find((setting) => setting.key === key)?.value;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function readPolicyString(settings: AdminOperationalPolicySetting[], key: string) {
  const value = settings.find((setting) => setting.key === key)?.value;
  return typeof value === 'string' && value.trim() ? value : null;
}

export function formatPolicyDistance(meters: number) {
  if (meters >= 1000) {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(meters / 1000)}km`;
  }
  return `${new Intl.NumberFormat('en-US').format(meters)}m`;
}

export function humanizePolicyValue(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
