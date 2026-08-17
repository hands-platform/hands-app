import type { AdminGetOptions, AdminOperationalPolicySetting } from './admin-api';

export const OPERATIONAL_POLICY_CACHE_OPTIONS = {
  freshness: 'stable',
  revalidateSeconds: 300,
  tags: ['operations-policy'],
} satisfies AdminGetOptions;

export const OPERATIONAL_POLICY_KEYS = {
  startShiftMatchingDelaysSlaMinutes: 'command.start_shift.matching_delays_sla_minutes',
  startShiftPaymentHoldsSlaMinutes: 'command.start_shift.payment_holds_sla_minutes',
  startShiftCancellationReviewSlaMinutes: 'command.start_shift.cancellation_review_sla_minutes',
  startShiftRefundReviewSlaMinutes: 'command.start_shift.refund_review_sla_minutes',
  startShiftNotificationFailuresSlaMinutes: 'command.start_shift.notification_failures_sla_minutes',
  startShiftCashReconciliationSlaMinutes: 'command.start_shift.cash_reconciliation_sla_minutes',
  startShiftPartnerApprovalsSlaMinutes: 'command.start_shift.partner_approvals_sla_minutes',
  travelBufferMinutes: 'matching.travel_buffer_minutes',
  providerResponseWindowMinutes: 'matching.provider_response_window_minutes',
  marketplaceRadiusMeters: 'matching.marketplace_partner_radius_meters',
  marketplaceLocationFreshnessMinutes: 'matching.marketplace_partner_location_max_age_minutes',
  marketplaceInvitationLimit: 'matching.marketplace_partner_invitation_limit',
  marketplaceOpenMode: 'matching.marketplace_open_mode',
  bookingDistanceGateEnabled: 'booking.distance_gate_enabled',
  bookingServiceAreaRequired: 'booking.service_area_required',
  bookingMaxCustomerCurrentToAddressKm: 'booking.max_customer_current_to_booking_address_km',
  bookingMaxPreferredPartnerDistanceKm: 'booking.max_preferred_partner_distance_km',
  bookingCurrentLocationFreshnessMinutes: 'booking.current_location_freshness_minutes',
  // Compatibility alias for older saved policy snapshots and Admin pages.
  backupOpenMode: 'matching.backup_open_mode',
  preferredAcceptMode: 'matching.preferred_accept_mode',
  partnerAlertChannel: 'notification.partner_alert_channel',
  walletNegativeGate: 'wallet.negative_balance_gate',
  cancellationAfterMatch: 'cancellation.after_match_policy',
  noShowPartnerReport: 'no_show.partner_report_policy',
  actionEvidenceGateMode: 'decision.action_evidence_gate_mode',
  cashSettlementClearance: 'cash.settlement_clearance_policy',
  firstPickExpiryAction: 'matching.first_pick_expiry_action_policy',
  noShowEvidenceRequirement: 'no_show.evidence_requirement_policy',
  payoutBatchCycle: 'payout.batch_cycle_policy',
} as const;

export const LEGACY_OPERATIONAL_POLICY_KEYS = {
  marketplaceRadiusMeters: 'matching.backup_provider_radius_meters',
  marketplaceLocationFreshnessMinutes: 'matching.backup_provider_location_max_age_minutes',
  marketplaceInvitationLimit: 'matching.backup_provider_invitation_limit',
  marketplaceOpenMode: 'matching.backup_open_mode',
} as const;

export const ADMIN_OPERATIONS_POLICY_DEFAULTS = {
  travelBufferMinutes: 30,
  providerResponseWindowMinutes: 10,
  marketplaceRadiusMeters: 10_000,
  marketplaceLocationFreshnessMinutes: 90,
  marketplaceInvitationLimit: 50,
  bookingMaxCustomerCurrentToAddressKm: 50,
  bookingMaxPreferredPartnerDistanceKm: 50,
  bookingCurrentLocationFreshnessMinutes: 15,
  marketplaceOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
  // Compatibility alias for older saved policy snapshots and Admin pages.
  backupOpenMode: 'IMMEDIATE_WITHIN_WINDOW',
  preferredAcceptMode: 'FIRST_PICK_MATCHES_ON_ACCEPT',
  partnerAlertChannel: 'IN_APP_WITH_PUSH_LATER',
  walletNegativeGate: 'BLOCK_MARKETPLACE_PARTICIPATION',
  cashSettlementClearance: 'DEPOSIT_OR_ADMIN_OFFSET_REQUIRED',
  payoutBatchCycle: 'WEEKLY_OR_MONTHLY_BATCH',
} as const;

export function adminPreferredAcceptModeUsesFirstPickPriority(value: unknown) {
  return value === 'FIRST_PICK_MATCHES_ON_ACCEPT' || value === 'CUSTOMER_FINAL_CONFIRM_AFTER_ACCEPT';
}

export const ADMIN_START_SHIFT_ACTION_SLA_DEFAULTS = {
  cancellationReview: 120,
  cashReconciliation: 1_440,
  matchingDelays: 15,
  notificationFailures: 60,
  partnerApprovals: 1_440,
  paymentHolds: 60,
  refundReview: 240,
} as const;

export type AdminLiveOperationsPolicy = {
  travelBufferMinutes: number;
  providerResponseWindowMinutes: number;
  marketplaceRadiusMeters: number;
  marketplaceLocationFreshnessMinutes: number;
  marketplaceInvitationLimit: number;
  marketplaceOpenMode: string;
  /** @deprecated Use marketplaceOpenMode in new Admin code. */
  backupOpenMode: string;
  preferredAcceptMode: string;
  walletNegativeGate: string;
  cashSettlementClearance: string;
  payoutBatchCycle: string;
};

export const ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS = ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'] as const;
export const ADMIN_WALLET_BLOCK_FINAL_GATE = 'BLOCK_MARKETPLACE_PARTICIPATION';
/** @deprecated Use ADMIN_WALLET_BLOCK_FINAL_GATE in new Admin code. */
export const ADMIN_WALLET_BLOCK_MARKETPLACE_PARTICIPATION = ADMIN_WALLET_BLOCK_FINAL_GATE;
export const ADMIN_LEGACY_WALLET_BLOCK_ACCEPTS_WHEN_NEGATIVE = 'BLOCK_ACCEPTS_WHEN_NEGATIVE';
export const ADMIN_WALLET_ALLOW_ONE_RECOVERY_BOOKING = 'ALLOW_ONE_RECOVERY_BOOKING';
export const ADMIN_MARKETPLACE_OPEN_IMMEDIATE = 'IMMEDIATE_WITHIN_WINDOW';
export const ADMIN_MARKETPLACE_OPEN_LEGACY_DELAYED = 'AFTER_FIRST_PICK_DELAY';
export const ADMIN_PARTNER_ALERT_FCM_FOR_ALL_BOOKINGS = 'FCM_FOR_ALL_BOOKINGS';
export const ADMIN_PARTNER_ALERT_LEGACY_OS_PUSH_FOR_ALL_BOOKINGS = 'ONESIGNAL_FOR_ALL_BOOKINGS';

export type AdminPartnerMarketplaceReadinessProvider = {
  status?: string | null;
  blockedAt?: string | null;
  verification?: ({ status?: string | null } & Record<string, unknown>) | null;
  kyc?: ({ status?: string | null } & Record<string, unknown>) | null;
  documents?: Array<{ type?: string | null; status?: string | null } & Record<string, unknown>> | null;
  bankAccounts?: Array<{ status?: string | null } & Record<string, unknown>> | null;
  earnings?: Array<{ netAmount?: number | string | null }> | null;
  currentLat?: number | string | null;
  currentLng?: number | string | null;
  currentLocationUpdatedAt?: string | null;
  user?: { pushDevices?: Array<{ enabled?: boolean | null } & Record<string, unknown>> | null } | null;
  sanctions?: Array<{ status?: string | null } & Record<string, unknown>> | null;
  devices?: Array<{ blockedAt?: string | null; enabled?: boolean | null } & Record<string, unknown>> | null;
  sessions?: Array<{ suspicious?: boolean | null } & Record<string, unknown>> | null;
  sharedDeviceMatches?: unknown[] | null;
};

export type AdminPartnerMarketplaceReadiness = {
  accountNeedsFollowUp: boolean;
  identityReady: boolean;
  bankReady: boolean;
  walletBalance: number;
  locationFresh: boolean;
  pushEnabled: boolean;
  marketplaceBlocked: boolean;
  finalGateHeld: boolean;
  canCompleteFinalGate: boolean;
};

export function buildAdminLiveOperationsPolicy(
  settings: AdminOperationalPolicySetting[],
): AdminLiveOperationsPolicy {
  const marketplaceOpenMode =
    readPolicyStringFromKeys(settings, [
      OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
    ]) ?? ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceOpenMode;

  return {
    travelBufferMinutes:
      readPolicyNumber(settings, OPERATIONAL_POLICY_KEYS.travelBufferMinutes) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.travelBufferMinutes,
    providerResponseWindowMinutes:
      readPolicyNumber(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.providerResponseWindowMinutes,
    marketplaceRadiusMeters:
      readPolicyNumberFromKeys(settings, [
        OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
        LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
      ]) ?? ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceRadiusMeters,
    marketplaceLocationFreshnessMinutes:
      readPolicyNumberFromKeys(settings, [
        OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
        LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
      ]) ?? ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceLocationFreshnessMinutes,
    marketplaceInvitationLimit:
      readPolicyNumberFromKeys(settings, [
        OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
        LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
      ]) ?? ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceInvitationLimit,
    marketplaceOpenMode: normalizeAdminMarketplaceOpenMode(marketplaceOpenMode),
    backupOpenMode: normalizeAdminMarketplaceOpenMode(marketplaceOpenMode),
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

export function buildAdminPartnerMarketplaceReadiness({
  provider,
  freshnessMinutes,
  hardWalletBlock,
  now = Date.now(),
}: {
  provider: AdminPartnerMarketplaceReadinessProvider;
  freshnessMinutes: number;
  hardWalletBlock: boolean;
  now?: number;
}): AdminPartnerMarketplaceReadiness {
  const accountNeedsFollowUp = adminPartnerAccountNeedsFollowUp(provider);
  const identityReady = adminPartnerIdentityReady(provider);
  const bankReady = adminPartnerBankReady(provider);
  const walletBalance = adminPartnerWalletBalance(provider);
  const locationFresh = adminPartnerLocationFresh(provider, freshnessMinutes, now);
  const pushEnabled = adminPartnerHasEnabledPush(provider);
  const marketplaceBlocked = adminPartnerMarketplaceBlocked(provider, { hardWalletBlock });
  const finalGateHeld = adminPartnerFinalGateHeld(provider, { hardWalletBlock });
  const canCompleteFinalGate = adminPartnerCanCompleteFinalGate(provider, {
    freshnessMinutes,
    hardWalletBlock,
    now,
  });

  return {
    accountNeedsFollowUp,
    identityReady,
    bankReady,
    walletBalance,
    locationFresh,
    pushEnabled,
    marketplaceBlocked,
    finalGateHeld,
    canCompleteFinalGate,
  };
}

export function adminPartnerCanCompleteFinalGate(
  provider: AdminPartnerMarketplaceReadinessProvider,
  policy: { freshnessMinutes: number; hardWalletBlock: boolean; now?: number },
) {
  return (
    provider.status === 'ONLINE_AVAILABLE' &&
    !adminPartnerFinalGateHeld(provider, policy) &&
    adminPartnerLocationFresh(provider, policy.freshnessMinutes, policy.now ?? Date.now()) &&
    adminPartnerHasEnabledPush(provider)
  );
}

export function adminPartnerMarketplaceBlocked(
  provider: AdminPartnerMarketplaceReadinessProvider,
  _policy: { hardWalletBlock?: boolean } = {},
) {
  void _policy;
  return adminPartnerAccountNeedsFollowUp(provider) || !adminPartnerIdentityReady(provider);
}

export function adminPartnerFinalGateHeld(
  provider: AdminPartnerMarketplaceReadinessProvider,
  policy: { hardWalletBlock: boolean },
) {
  return (
    adminPartnerMarketplaceBlocked(provider, policy) ||
    (policy.hardWalletBlock && adminPartnerWalletBalance(provider) < 0)
  );
}

export function adminPartnerAccountNeedsFollowUp(provider: AdminPartnerMarketplaceReadinessProvider) {
  return (
    Boolean(provider.blockedAt) ||
    (provider.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE') ||
    (provider.devices ?? []).some((device) => Boolean(device.blockedAt) || device.enabled === false) ||
    (provider.sessions ?? []).some((session) => Boolean(session.suspicious)) ||
    (provider.sharedDeviceMatches ?? []).length > 0
  );
}

export function adminPartnerIdentityReady(provider: AdminPartnerMarketplaceReadinessProvider) {
  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === 'APPROVED')
      .map((document) => document.type),
  );

  return (
    provider.verification?.status === 'APPROVED' &&
    provider.kyc?.status === 'APPROVED' &&
    ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.every((type) => approvedDocuments.has(type))
  );
}

export function adminPartnerBankReady(provider: AdminPartnerMarketplaceReadinessProvider) {
  return (provider.bankAccounts ?? []).some((account) => account.status === 'APPROVED');
}

export function adminPartnerWalletBalance(provider: AdminPartnerMarketplaceReadinessProvider) {
  return (provider.earnings ?? []).reduce((total, earning) => {
    const amount = Number(earning.netAmount ?? 0);
    return Number.isFinite(amount) ? total + amount : total;
  }, 0);
}

export function adminPartnerLocationFresh(
  provider: AdminPartnerMarketplaceReadinessProvider,
  freshnessMinutes: number,
  now: number,
) {
  if (readOptionalNumber(provider.currentLat) === null || readOptionalNumber(provider.currentLng) === null) {
    return false;
  }

  const updatedAt = Date.parse(provider.currentLocationUpdatedAt ?? '');
  if (!Number.isFinite(updatedAt)) {
    return false;
  }

  return Math.max(0, Math.round((now - updatedAt) / 60000)) <= freshnessMinutes;
}

export function adminPartnerHasEnabledPush(provider: AdminPartnerMarketplaceReadinessProvider) {
  return (provider.user?.pushDevices ?? []).some((device) => device.enabled);
}

export function adminWalletGateBlocksFinalGate(value: string | null | undefined) {
  return (
    value === ADMIN_WALLET_BLOCK_FINAL_GATE ||
    value === ADMIN_LEGACY_WALLET_BLOCK_ACCEPTS_WHEN_NEGATIVE ||
    value === ADMIN_WALLET_ALLOW_ONE_RECOVERY_BOOKING
  );
}

/** @deprecated Use adminWalletGateBlocksFinalGate in new Admin code. */
export function adminWalletGateBlocksMarketplaceParticipation(value: string | null | undefined) {
  return adminWalletGateBlocksFinalGate(value);
}

export function adminPartnerAlertChannelRoutesToFcm(value: unknown) {
  return (
    value === ADMIN_PARTNER_ALERT_FCM_FOR_ALL_BOOKINGS ||
    value === ADMIN_PARTNER_ALERT_LEGACY_OS_PUSH_FOR_ALL_BOOKINGS
  );
}

export function normalizeAdminMarketplaceOpenMode(value: unknown) {
  if (typeof value !== 'string') {
    return ADMIN_MARKETPLACE_OPEN_IMMEDIATE;
  }
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return ADMIN_MARKETPLACE_OPEN_IMMEDIATE;
  }
  if (
    normalizedValue === ADMIN_MARKETPLACE_OPEN_LEGACY_DELAYED ||
    normalizedValue === 'DELAYED_UNTIL_FIRST_PICK_EXPIRES' ||
    normalizedValue === 'DELAYED_UNTIL_FIRST_WINDOW_END'
  ) {
    return ADMIN_MARKETPLACE_OPEN_IMMEDIATE;
  }
  return normalizedValue;
}

export function readPolicyNumber(settings: AdminOperationalPolicySetting[], key: string) {
  const value = adminOperationalPolicySettingByKey(settings, key)?.value;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function readPolicyNumberFromKeys(settings: AdminOperationalPolicySetting[], keys: string[]) {
  for (const key of keys) {
    const value = readPolicyNumber(settings, key);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

export function readPositivePolicyNumber(settings: AdminOperationalPolicySetting[], key: string) {
  const value = readPolicyNumber(settings, key);
  return value !== null && value > 0 ? value : null;
}

export function readPolicyString(settings: AdminOperationalPolicySetting[], key: string) {
  const value = adminOperationalPolicySettingByKey(settings, key)?.value;
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function readPolicyStringFromKeys(settings: AdminOperationalPolicySetting[], keys: string[]) {
  for (const key of keys) {
    const value = readPolicyString(settings, key);
    if (value !== null) {
      return value;
    }
  }
  return null;
}

export function formatPolicyDistance(meters: number) {
  if (meters >= 1000) {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(meters / 1000)}km`;
  }
  return `${new Intl.NumberFormat('en-US').format(meters)}m`;
}

export function adminOperationalPolicySettingByKey(settings: AdminOperationalPolicySetting[], key: string) {
  return adminOperationalPolicyEquivalentKeys(key)
    .map((candidateKey) => settings.find((setting) => setting.key === candidateKey))
    .find((setting) => setting !== undefined);
}

export function adminOperationalPolicyEquivalentKeys(key: string) {
  const aliases: Record<string, string[]> = {
    [OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters]: [
      OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
    ],
    [LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters]: [
      OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
    ],
    [OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes]: [
      OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
    ],
    [LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes]: [
      OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
    ],
    [OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit]: [
      OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
    ],
    [LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit]: [
      OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
    ],
    [OPERATIONAL_POLICY_KEYS.marketplaceOpenMode]: [
      OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
    ],
    [LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode]: [
      OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
    ],
  };
  return aliases[key] ?? [key];
}

export function operationalPolicyAnchor(key: string) {
  const canonicalKey = adminOperationalPolicyEquivalentKeys(key)[0] ?? key;
  return `policy-${canonicalKey.replaceAll('backup', 'marketplace').replaceAll('.', '-').replaceAll('_', '-')}`;
}

export function operationalPolicyHref(key: string) {
  return `/operations-policy#${operationalPolicyAnchor(key)}`;
}

export function humanizePolicyValue(value: string) {
  const labelOverride = ADMIN_POLICY_VALUE_LABEL_OVERRIDES[value];
  if (labelOverride) {
    return labelOverride;
  }

  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const ADMIN_POLICY_VALUE_LABEL_OVERRIDES: Record<string, string> = {
  [ADMIN_WALLET_BLOCK_FINAL_GATE]: 'Final Gate Hold',
};

function readOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}
