import type { AdminAuditLog, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import { readPlainRecord } from '../../lib/admin-format';
import {
  BOOKING_CREATE_GATE_REASONS,
  bookingCreateGateCustomerGpsRejectCount,
  bookingCreateGateReasonLabel,
  bookingCreateGateReasonPill,
} from '../../lib/booking-create-gate-reasons';
import {
  ADMIN_OPERATIONS_POLICY_DEFAULTS,
  OPERATIONAL_POLICY_KEYS,
  adminOperationalPolicySettingByKey,
  readPolicyNumber,
} from '../../lib/operations-policy';
import { formatDistance } from './policy-distance-format';
import { policyCountLabel } from './policy-copy';

export type BookingCreateGateReview = {
  readonly currentPolicyLabel: string;
  readonly summary: readonly BookingCreateGateSummaryItem[];
  readonly rows: readonly BookingCreateGateRow[];
  readonly recentAttempts: readonly BookingCreateGateRecentAttempt[];
};

type BookingCreateGateSummaryItem = {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
};

type BookingCreateGateRow = {
  readonly key: string;
  readonly gate: string;
  readonly current: string;
  readonly defaultValue: string;
  readonly operatorMeaning: string;
  readonly evidence: string;
  readonly href: string;
  readonly pillClass: string;
};

type BookingCreateGateRecentAttempt = {
  readonly id: string;
  readonly reason: string;
  readonly detail: string;
  readonly createdAt: string;
  readonly href: string;
  readonly pillClass: string;
};

type BookingCreateGatePolicy = {
  readonly customerDistanceKm: number;
  readonly distanceGateEnabled: boolean;
  readonly freshnessMinutes: number;
  readonly preferredPartnerDistanceKm: number;
  readonly serviceAreaRequired: boolean;
};

export function buildBookingCreateGateReview(
  settings: readonly AdminOperationalPolicySetting[],
  auditLogs: readonly AdminAuditLog[],
): BookingCreateGateReview {
  const policy = readBookingCreateGatePolicy(settings);
  const rejections = bookingGateRejections(auditLogs);
  const reasonCounts = bookingGateReasonCounts(rejections);

  return {
    currentPolicyLabel: policy.distanceGateEnabled ? 'Distance gates active' : 'Distance gates disabled',
    summary: buildBookingCreateGateSummary(policy, rejections.length),
    rows: buildBookingCreateGateRows(policy, reasonCounts),
    recentAttempts: buildBookingGateRecentAttempts(rejections),
  };
}

function readBookingCreateGatePolicy(
  settings: readonly AdminOperationalPolicySetting[],
): BookingCreateGatePolicy {
  const policySettings = [...settings];
  const customerDistanceKm =
    readPolicyNumber(policySettings, OPERATIONAL_POLICY_KEYS.bookingMaxCustomerCurrentToAddressKm) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.bookingMaxCustomerCurrentToAddressKm;
  const preferredPartnerDistanceKm =
    readPolicyNumber(policySettings, OPERATIONAL_POLICY_KEYS.bookingMaxPreferredPartnerDistanceKm) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.bookingMaxPreferredPartnerDistanceKm;
  const freshnessMinutes =
    readPolicyNumber(policySettings, OPERATIONAL_POLICY_KEYS.bookingCurrentLocationFreshnessMinutes) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.bookingCurrentLocationFreshnessMinutes;
  const distanceGateEnabled =
    policyBooleanValue(policySettings, OPERATIONAL_POLICY_KEYS.bookingDistanceGateEnabled) ?? true;
  const serviceAreaRequired =
    policyBooleanValue(policySettings, OPERATIONAL_POLICY_KEYS.bookingServiceAreaRequired) ?? true;

  return {
    customerDistanceKm,
    distanceGateEnabled,
    freshnessMinutes,
    preferredPartnerDistanceKm,
    serviceAreaRequired,
  };
}

function bookingGateRejections(auditLogs: readonly AdminAuditLog[]) {
  return auditLogs
    .filter((log) => log.action === 'booking.create.rejected')
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

function buildBookingCreateGateSummary(
  policy: BookingCreateGatePolicy,
  rejectionCount: number,
): BookingCreateGateReview['summary'] {
  return [
    {
      label: 'Optional customer GPS evidence',
      value: `${policy.customerDistanceKm} km`,
      helper: 'Optional evidence only. Booking authority comes from the confirmed service address.',
    },
    {
      label: 'First-pick partner gate',
      value: `${policy.preferredPartnerDistanceKm} km`,
      helper: 'Preferred partner must be near the booking address before payment opens.',
    },
    {
      label: 'Location freshness',
      value: `${policy.freshnessMinutes} min`,
      helper: 'Optional GPS evidence freshness when the app can provide it.',
    },
    {
      label: 'Blocked attempts',
      value: String(rejectionCount),
      helper: 'Recent booking create requests stopped before payment and matching.',
    },
  ];
}

function buildBookingCreateGateRows(
  policy: BookingCreateGatePolicy,
  reasonCounts: ReadonlyMap<string, number>,
): BookingCreateGateReview['rows'] {
  return [
    {
      key: OPERATIONAL_POLICY_KEYS.bookingDistanceGateEnabled,
      gate: 'Distance gate',
      current: policy.distanceGateEnabled ? 'Enabled' : 'Disabled',
      defaultValue: 'Enabled',
      operatorMeaning: policy.distanceGateEnabled
        ? 'First-pick partner distance is checked from the booking address. Customer GPS stays optional evidence.'
        : 'Partner distance gate is disabled. Keep this only for controlled tests.',
      evidence: 'Blocked attempts',
      href: '/bookings?view=blocked-create',
      pillClass: policy.distanceGateEnabled ? 'pill-success' : 'pill-danger',
    },
    {
      key: OPERATIONAL_POLICY_KEYS.bookingServiceAreaRequired,
      gate: 'Service area',
      current: policy.serviceAreaRequired ? 'Required' : 'Optional',
      defaultValue: 'Required',
      operatorMeaning: policy.serviceAreaRequired
        ? 'Booking address must be inside an enabled Vietnam service area.'
        : 'Booking can be created outside configured service areas. Use only before a city launch test.',
      evidence: policyCountLabel(
        reasonCounts.get(BOOKING_CREATE_GATE_REASONS.addressOutsideServiceArea) ?? 0,
        'reject',
      ),
      href: `/audit-log?query=${BOOKING_CREATE_GATE_REASONS.addressOutsideServiceArea}`,
      pillClass: policy.serviceAreaRequired ? 'pill-success' : 'pill-warn',
    },
    {
      key: OPERATIONAL_POLICY_KEYS.bookingMaxCustomerCurrentToAddressKm,
      gate: 'Optional customer GPS evidence',
      current: `${policy.customerDistanceKm} km`,
      defaultValue: '20 km',
      operatorMeaning:
        'A customer can browse globally and book from a confirmed Vietnam service address. GPS distance is retained only as optional evidence.',
      evidence: policyCountLabel(
        reasonCounts.get(BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTooFar) ?? 0,
        'historical row',
      ),
      href: `/audit-log?query=${BOOKING_CREATE_GATE_REASONS.customerCurrentLocationTooFar}`,
      pillClass: policy.customerDistanceKm === 20 ? 'pill-success' : 'pill-warn',
    },
    {
      key: OPERATIONAL_POLICY_KEYS.bookingMaxPreferredPartnerDistanceKm,
      gate: 'First-pick partner',
      current: `${policy.preferredPartnerDistanceKm} km`,
      defaultValue: '50 km',
      operatorMeaning:
        'The selected first-pick Partner must be close enough to the booking address before payment authorization.',
      evidence: policyCountLabel(
        reasonCounts.get(BOOKING_CREATE_GATE_REASONS.preferredPartnerTooFar) ?? 0,
        'reject',
      ),
      href: `/audit-log?query=${BOOKING_CREATE_GATE_REASONS.preferredPartnerTooFar}`,
      pillClass: policy.preferredPartnerDistanceKm === 50 ? 'pill-success' : 'pill-warn',
    },
    {
      key: OPERATIONAL_POLICY_KEYS.bookingCurrentLocationFreshnessMinutes,
      gate: 'Optional GPS freshness',
      current: `${policy.freshnessMinutes} min`,
      defaultValue: '15 min',
      operatorMeaning:
        'Fresh customer GPS can be stored as optional support evidence when available. Booking authority remains the confirmed service address.',
      evidence: policyCountLabel(
        bookingCreateGateCustomerGpsRejectCount(reasonCounts),
        'historical row',
      ),
      href: '/audit-log?query=CUSTOMER_CURRENT_LOCATION',
      pillClass: policy.freshnessMinutes === 15 ? 'pill-success' : 'pill-warn',
    },
  ];
}

function buildBookingGateRecentAttempts(
  rejections: readonly AdminAuditLog[],
): BookingCreateGateReview['recentAttempts'] {
  return rejections.slice(0, 5).map((log) => {
    const metadata = readPlainRecord(log.metadata);
    const reasonCode = readOptionalString(metadata?.reasonCode) ?? 'UNKNOWN';
    return {
      id: log.id,
      reason: bookingCreateGateReasonLabel(reasonCode, 'operations', (reason) =>
        displayOperationalWording(reason.replace(/_/g, ' ').toLowerCase()),
      ),
      detail: bookingGateAttemptDetail(metadata),
      createdAt: log.createdAt,
      href: `/audit-log?query=${encodeURIComponent(reasonCode)}`,
      pillClass: bookingCreateGateReasonPill(reasonCode),
    };
  });
}

function policyBooleanValue(settings: readonly AdminOperationalPolicySetting[], key: string) {
  const value = adminOperationalPolicySettingByKey([...settings], key)?.value;
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return null;
}

function bookingGateReasonCounts(logs: readonly AdminAuditLog[]) {
  const counts = new Map<string, number>();
  logs.forEach((log) => {
    const metadata = readPlainRecord(log.metadata);
    const reasonCode = readOptionalString(metadata?.reasonCode) ?? 'UNKNOWN';
    counts.set(reasonCode, (counts.get(reasonCode) ?? 0) + 1);
  });
  return counts;
}

function bookingGateAttemptDetail(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return 'No detailed booking gate evidence was recorded.';
  }
  const reason = readOptionalString(metadata.reason);
  const customerDistance = readOptionalNumber(metadata.customerDistanceMeters);
  const customerLimit = readOptionalNumber(metadata.customerDistanceLimitMeters);
  const partnerDistance = readOptionalNumber(metadata.preferredProviderDistanceMeters);
  const partnerLimit = readOptionalNumber(metadata.preferredProviderDistanceLimitMeters);
  const address = readPlainRecord(metadata.bookingAddress);
  const addressText = readOptionalString(address?.addressText);
  const parts = [
    reason,
    customerDistance !== null && customerLimit !== null
      ? `Customer ${formatDistance(customerDistance)} / limit ${formatDistance(customerLimit)}`
      : null,
    partnerDistance !== null && partnerLimit !== null
      ? `First-pick ${formatDistance(partnerDistance)} / limit ${formatDistance(partnerLimit)}`
      : null,
    addressText ? `Address: ${addressText}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('. ') : 'Booking create was stopped before payment authorization.';
}

function readOptionalNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
