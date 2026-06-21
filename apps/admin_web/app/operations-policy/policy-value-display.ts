import type { AdminOperationalPolicySetting } from '../../lib/admin-api';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import {
  ADMIN_WALLET_BLOCK_FINAL_GATE,
  OPERATIONAL_POLICY_KEYS,
  adminOperationalPolicySettingByKey,
} from '../../lib/operations-policy';

export function formatPolicyValue(value: unknown, unit?: string | null) {
  if (value === null || value === undefined) return '-';
  if (unit === 'meters') {
    return `${(Number(value) / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
  }
  if (unit === 'minutes') {
    return `${value} min`;
  }
  const suffix = unit ? ` ${unit}` : '';
  return `${String(value)}${suffix}`;
}

export function policyDisplayValue(setting: AdminOperationalPolicySetting, recommended = false) {
  const value = String(recommended ? setting.recommendedValue : setting.value);
  const labelOverride = policyValueLabelOverride(setting, value);
  if (labelOverride) {
    return labelOverride;
  }

  return displayOperationalWording(
    setting.options?.find((option) => option.value === value)?.label ??
      formatPolicyValue(value, setting.unit),
  );
}

export function policyDisplayByKey(settings: readonly AdminOperationalPolicySetting[], key: string) {
  const setting = adminOperationalPolicySettingByKey([...settings], key);
  return setting ? policyDisplayValue(setting) : 'Not configured';
}

function policyValueLabelOverride(setting: AdminOperationalPolicySetting, value: string) {
  if (
    setting.key === OPERATIONAL_POLICY_KEYS.walletNegativeGate &&
    value === ADMIN_WALLET_BLOCK_FINAL_GATE
  ) {
    return 'Final Gate Hold';
  }
  return null;
}
