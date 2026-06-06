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

export const ADMIN_OPERATIONS_POLICY_DEFAULTS = {
  providerResponseWindowMinutes: 10,
  marketplaceRadiusMeters: 10_000,
  marketplaceLocationFreshnessMinutes: 30,
  marketplaceInvitationLimit: 50,
  backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
  preferredAcceptMode: 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT',
  walletNegativeGate: 'BLOCK_ACCEPTS_WHEN_NEGATIVE',
  cashSettlementClearance: 'DEPOSIT_OR_ADMIN_OFFSET_REQUIRED',
  payoutBatchCycle: 'WEEKLY_OR_MONTHLY_BATCH',
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
      readPolicyNumber(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.providerResponseWindowMinutes,
    marketplaceRadiusMeters:
      readPolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceRadiusMeters,
    marketplaceLocationFreshnessMinutes:
      readPolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceLocationFreshnessMinutes,
    marketplaceInvitationLimit:
      readPolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceInvitationLimit,
    backupOpenMode:
      readPolicyString(settings, OPERATIONAL_POLICY_KEYS.backupOpenMode) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.backupOpenMode,
    preferredAcceptMode:
      readPolicyString(settings, OPERATIONAL_POLICY_KEYS.preferredAcceptMode) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.preferredAcceptMode,
    walletNegativeGate:
      readPolicyString(settings, OPERATIONAL_POLICY_KEYS.walletNegativeGate) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.walletNegativeGate,
    cashSettlementClearance:
      readPolicyString(settings, OPERATIONAL_POLICY_KEYS.cashSettlementClearance) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.cashSettlementClearance,
    payoutBatchCycle:
      readPolicyString(settings, OPERATIONAL_POLICY_KEYS.payoutBatchCycle) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.payoutBatchCycle,
  };
}

export function readPolicyNumber(settings: AdminOperationalPolicySetting[], key: string) {
  const value = settings.find((setting) => setting.key === key)?.value;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function readPositivePolicyNumber(settings: AdminOperationalPolicySetting[], key: string) {
  const value = readPolicyNumber(settings, key);
  return value !== null && value > 0 ? value : null;
}

export function readPolicyString(settings: AdminOperationalPolicySetting[], key: string) {
  const value = settings.find((setting) => setting.key === key)?.value;
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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
