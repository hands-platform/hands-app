import type { AdminAuditLog, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import { readPlainRecord } from '../../lib/admin-format';
import {
  ADMIN_OPERATIONS_POLICY_DEFAULTS,
  OPERATIONAL_POLICY_KEYS,
  adminOperationalPolicySettingByKey,
  readPolicyNumber,
} from '../../lib/operations-policy';
import { formatDistance } from './policy-simulation';

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
  const distanceGateEnabled = policyBooleanValue(policySettings, 'booking.distance_gate_enabled') ?? true;
  const serviceAreaRequired = policyBooleanValue(policySettings, 'booking.service_area_required') ?? true;

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
      key: 'booking.distance_gate_enabled',
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
      key: 'booking.service_area_required',
      gate: 'Service area',
      current: policy.serviceAreaRequired ? 'Required' : 'Optional',
      defaultValue: 'Required',
      operatorMeaning: policy.serviceAreaRequired
        ? 'Booking address must be inside an enabled Vietnam service area.'
        : 'Booking can be created outside configured service areas. Use only before a city launch test.',
      evidence: `${reasonCounts.get('BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA') ?? 0} reject(s)`,
      href: '/audit-log?query=BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
      pillClass: policy.serviceAreaRequired ? 'pill-success' : 'pill-warn',
    },
    {
      key: 'booking.max_customer_current_to_booking_address_km',
      gate: 'Optional customer GPS evidence',
      current: `${policy.customerDistanceKm} km`,
      defaultValue: '20 km',
      operatorMeaning:
        'A customer can browse globally and book from a confirmed Vietnam service address. GPS distance is retained only as optional evidence.',
      evidence: `${reasonCounts.get('CUSTOMER_CURRENT_LOCATION_TOO_FAR') ?? 0} historical row(s)`,
      href: '/audit-log?query=CUSTOMER_CURRENT_LOCATION_TOO_FAR',
      pillClass: policy.customerDistanceKm === 20 ? 'pill-success' : 'pill-warn',
    },
    {
      key: 'booking.max_preferred_partner_distance_km',
      gate: 'First-pick partner',
      current: `${policy.preferredPartnerDistanceKm} km`,
      defaultValue: '50 km',
      operatorMeaning:
        'The selected first-pick Partner must be close enough to the booking address before payment authorization.',
      evidence: `${reasonCounts.get('PREFERRED_PARTNER_TOO_FAR') ?? 0} reject(s)`,
      href: '/audit-log?query=PREFERRED_PARTNER_TOO_FAR',
      pillClass: policy.preferredPartnerDistanceKm === 50 ? 'pill-success' : 'pill-warn',
    },
    {
      key: 'booking.current_location_freshness_minutes',
      gate: 'Optional GPS freshness',
      current: `${policy.freshnessMinutes} min`,
      defaultValue: '10 min',
      operatorMeaning:
        'Fresh customer GPS can be stored as optional support evidence when available. Booking authority remains the confirmed service address.',
      evidence: `${bookingGateCurrentLocationRejectCount(reasonCounts)} historical row(s)`,
      href: '/audit-log?query=CUSTOMER_CURRENT_LOCATION',
      pillClass: policy.freshnessMinutes === 10 ? 'pill-success' : 'pill-warn',
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
      reason: bookingGateReasonLabel(reasonCode),
      detail: bookingGateAttemptDetail(metadata),
      createdAt: log.createdAt,
      href: `/audit-log?query=${encodeURIComponent(reasonCode)}`,
      pillClass: bookingGateReasonPill(reasonCode),
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

function bookingGateReasonLabel(reasonCode: string) {
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TOO_FAR') {
    return 'Optional customer GPS distance evidence';
  }
  if (reasonCode === 'PREFERRED_PARTNER_TOO_FAR') {
    return 'First-pick partner too far';
  }
  if (reasonCode === 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA') {
    return 'Outside service area';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_STALE') {
    return 'Optional stale customer GPS';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_MISSING') {
    return 'Optional missing customer GPS';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_MISSING') {
    return 'Optional missing GPS timestamp';
  }
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_INVALID') {
    return 'Optional invalid GPS timestamp';
  }
  return displayOperationalWording(reasonCode.replace(/_/g, ' ').toLowerCase());
}

function bookingGateReasonPill(reasonCode: string) {
  if (reasonCode === 'CUSTOMER_CURRENT_LOCATION_TOO_FAR') {
    return 'pill-warn';
  }
  if (reasonCode === 'PREFERRED_PARTNER_TOO_FAR') {
    return 'pill-danger';
  }
  return 'pill-info';
}

function bookingGateCurrentLocationRejectCount(counts: ReadonlyMap<string, number>) {
  return [
    'CUSTOMER_CURRENT_LOCATION_MISSING',
    'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_MISSING',
    'CUSTOMER_CURRENT_LOCATION_TIMESTAMP_INVALID',
    'CUSTOMER_CURRENT_LOCATION_STALE',
  ].reduce((total, key) => total + (counts.get(key) ?? 0), 0);
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
