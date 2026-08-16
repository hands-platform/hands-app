import type { AdminOperationalPolicySetting } from '../../lib/admin-api';
import { OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';

export type OperationsPolicyGroupId =
  | 'shift-queue'
  | 'booking-safety'
  | 'matching-availability'
  | 'money-settlement'
  | 'exceptions-evidence'
  | 'notification-routing';

export type OperationsPolicyStatusFilter = 'all' | 'needs-review' | 'changed';
export type OperationsPolicyLifecycle =
  | NonNullable<AdminOperationalPolicySetting['lifecycle']>
  | 'unknown';
export type OperationsPolicyLifecycleFilter = OperationsPolicyLifecycle | 'all';

export const OPERATIONS_POLICY_GROUPS: ReadonlyArray<{
  description: string;
  id: OperationsPolicyGroupId;
  keys: readonly string[];
  label: string;
}> = [
  {
    description: 'Start Shift review windows and overdue queue promotion.',
    id: 'shift-queue',
    keys: [
      OPERATIONAL_POLICY_KEYS.startShiftMatchingDelaysSlaMinutes,
      OPERATIONAL_POLICY_KEYS.startShiftPaymentHoldsSlaMinutes,
      OPERATIONAL_POLICY_KEYS.startShiftCancellationReviewSlaMinutes,
      OPERATIONAL_POLICY_KEYS.startShiftRefundReviewSlaMinutes,
      OPERATIONAL_POLICY_KEYS.startShiftNotificationFailuresSlaMinutes,
      OPERATIONAL_POLICY_KEYS.startShiftCashReconciliationSlaMinutes,
      OPERATIONAL_POLICY_KEYS.startShiftPartnerApprovalsSlaMinutes,
    ],
    label: 'Shift & Queue SLA',
  },
  {
    description: 'Booking address, location evidence, distance, and service-area gates.',
    id: 'booking-safety',
    keys: [
      OPERATIONAL_POLICY_KEYS.bookingDistanceGateEnabled,
      OPERATIONAL_POLICY_KEYS.bookingServiceAreaRequired,
      OPERATIONAL_POLICY_KEYS.bookingMaxCustomerCurrentToAddressKm,
      OPERATIONAL_POLICY_KEYS.bookingMaxPreferredPartnerDistanceKm,
      OPERATIONAL_POLICY_KEYS.bookingCurrentLocationFreshnessMinutes,
    ],
    label: 'Booking Safety',
  },
  {
    description: 'First-pick timing, marketplace reach, availability, and final selection behavior.',
    id: 'matching-availability',
    keys: [
      OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes,
      OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
      OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
      OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
      OPERATIONAL_POLICY_KEYS.travelBufferMinutes,
      OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      OPERATIONAL_POLICY_KEYS.preferredAcceptMode,
    ],
    label: 'Matching & Availability',
  },
  {
    description: 'Negative wallet, cash clearance, and payout batch controls.',
    id: 'money-settlement',
    keys: [
      OPERATIONAL_POLICY_KEYS.walletNegativeGate,
      OPERATIONAL_POLICY_KEYS.cashSettlementClearance,
      OPERATIONAL_POLICY_KEYS.payoutBatchCycle,
    ],
    label: 'Money & Settlement',
  },
  {
    description: 'Evidence review, expiry, cancellation, and no-show closeout controls.',
    id: 'exceptions-evidence',
    keys: [
      OPERATIONAL_POLICY_KEYS.actionEvidenceGateMode,
      OPERATIONAL_POLICY_KEYS.firstPickExpiryAction,
      OPERATIONAL_POLICY_KEYS.cancellationAfterMatch,
      OPERATIONAL_POLICY_KEYS.noShowPartnerReport,
      OPERATIONAL_POLICY_KEYS.noShowEvidenceRequirement,
    ],
    label: 'Exceptions & Evidence',
  },
  {
    description: 'Partner booking and marketplace alert delivery route.',
    id: 'notification-routing',
    keys: [OPERATIONAL_POLICY_KEYS.partnerAlertChannel],
    label: 'Notification Routing',
  },
];

export function buildOperationsPolicyGroups(
  settings: readonly AdminOperationalPolicySetting[],
  filters: {
    group?: OperationsPolicyGroupId | 'all';
    lifecycle?: OperationsPolicyLifecycleFilter;
    query?: string;
    status?: OperationsPolicyStatusFilter;
  } = {},
) {
  const settingsByKey = new Map(settings.map((setting) => [setting.key, setting]));
  const query = filters.query?.trim().toLowerCase() ?? '';
  const status = filters.status ?? 'all';
  const lifecycle = filters.lifecycle ?? 'all';
  return OPERATIONS_POLICY_GROUPS.filter((group) => !filters.group || filters.group === 'all' || filters.group === group.id)
    .map((group) => {
      const allRows = group.keys.flatMap((key) => {
        const setting = settingsByKey.get(key);
        return setting ? [setting] : [];
      });
      const rows = allRows.filter((setting) => {
        const matchesQuery =
          !query ||
          setting.label.toLowerCase().includes(query) ||
          setting.description?.toLowerCase().includes(query);
        const matchesStatus =
          status === 'all' ||
          (status === 'changed' && Boolean(setting.updatedAt)) ||
          (status === 'needs-review' && isOperationsPolicyDeviation(setting));
        const matchesLifecycle = lifecycle === 'all' || operationsPolicyLifecycle(setting) === lifecycle;
        return matchesQuery && matchesStatus && matchesLifecycle;
      });
      return {
        ...group,
        allCount: allRows.length,
        changedCount: allRows.filter((setting) => Boolean(setting.updatedAt)).length,
        deviationCount: allRows.filter(isOperationsPolicyDeviation).length,
        rows,
      };
    })
    .filter((group) => group.rows.length > 0 || (!query && status === 'all' && lifecycle === 'all'))
    .sort((left, right) => {
      const attentionOrder = Number(right.deviationCount > 0) - Number(left.deviationCount > 0);
      return attentionOrder || OPERATIONS_POLICY_GROUPS.findIndex((group) => group.id === left.id) - OPERATIONS_POLICY_GROUPS.findIndex((group) => group.id === right.id);
    });
}

export function isOperationsPolicyDeviation(setting: AdminOperationalPolicySetting) {
  if (setting.recommendedValue === null || setting.recommendedValue === undefined) return false;
  return JSON.stringify(setting.value) !== JSON.stringify(setting.recommendedValue);
}

export function operationsPolicyCounts(settings: readonly AdminOperationalPolicySetting[]) {
  return {
    changedCount: settings.filter((setting) => Boolean(setting.updatedAt)).length,
    deviationCount: settings.filter(isOperationsPolicyDeviation).length,
    enforcedCount: settings.filter((setting) => operationsPolicyLifecycle(setting) === 'live').length,
    lifecycleCounts: {
      deprecated: settings.filter((setting) => operationsPolicyLifecycle(setting) === 'deprecated').length,
      live: settings.filter((setting) => operationsPolicyLifecycle(setting) === 'live').length,
      locked: settings.filter((setting) => operationsPolicyLifecycle(setting) === 'locked').length,
      planned: settings.filter((setting) => operationsPolicyLifecycle(setting) === 'planned').length,
      unknown: settings.filter((setting) => operationsPolicyLifecycle(setting) === 'unknown').length,
    },
    provenanceCounts: {
      automatedSmoke: settings.filter((setting) => setting.auditSource === 'automated_smoke').length,
      legacyUnknown: settings.filter((setting) => setting.auditSource === 'legacy_unknown').length,
      operator: settings.filter((setting) => setting.auditSource === 'operator').length,
      unattributed: settings.filter((setting) => Boolean(setting.updatedAt) && !setting.auditSource).length,
    },
    totalCount: settings.length,
  };
}

export function operationsPolicyLifecycle(
  setting: Pick<AdminOperationalPolicySetting, 'lifecycle'>,
): OperationsPolicyLifecycle {
  return setting.lifecycle === 'live' ||
    setting.lifecycle === 'locked' ||
    setting.lifecycle === 'planned' ||
    setting.lifecycle === 'deprecated'
    ? setting.lifecycle
    : 'unknown';
}

export function normalizeOperationsPolicyGroup(value: string): OperationsPolicyGroupId | 'all' {
  return OPERATIONS_POLICY_GROUPS.some((group) => group.id === value)
    ? (value as OperationsPolicyGroupId)
    : 'all';
}

export function normalizeOperationsPolicyStatus(value: string): OperationsPolicyStatusFilter {
  return value === 'needs-review' || value === 'changed' ? value : 'all';
}

export function normalizeOperationsPolicyLifecycle(value: string): OperationsPolicyLifecycleFilter {
  return value === 'live' ||
    value === 'locked' ||
    value === 'planned' ||
    value === 'deprecated' ||
    value === 'unknown'
    ? value
    : 'all';
}
