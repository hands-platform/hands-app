import type { AdminBooking, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import { readPlainRecord } from '../../lib/admin-format';
import { OPERATIONAL_POLICY_KEYS, adminOperationalPolicySettingByKey } from '../../lib/operations-policy';

export type BookingMatchingPolicySnapshot = {
  providerResponseWindowMinutes: number | null;
  backupProviderRadiusMeters: number | null;
  backupProviderLocationMaxAgeMinutes: number | null;
  backupProviderInvitationLimit: number | null;
  preferredAcceptMode: string | null;
  backupOpenMode: string | null;
  travelBufferMinutes: number | null;
};

export function readBookingMatchingPolicySnapshot(
  booking: AdminBooking,
): BookingMatchingPolicySnapshot | null {
  const metadata = readPlainRecord(booking.metadata);
  const policy = readPlainRecord(metadata?.matchingPolicy);
  if (!policy) {
    return null;
  }
  return {
    providerResponseWindowMinutes: readOptionalNumber(policy.providerResponseWindowMinutes),
    backupProviderRadiusMeters: readOptionalNumber(policy.backupProviderRadiusMeters),
    backupProviderLocationMaxAgeMinutes: readOptionalNumber(policy.backupProviderLocationMaxAgeMinutes),
    backupProviderInvitationLimit: readOptionalNumber(policy.backupProviderInvitationLimit),
    preferredAcceptMode: readOptionalString(policy.preferredAcceptMode),
    backupOpenMode: readOptionalString(policy.backupOpenMode),
    travelBufferMinutes: readOptionalNumber(policy.travelBufferMinutes),
  };
}

export function summarizeSnapshotValues(
  bookings: AdminBooking[],
  readValue: (snapshot: BookingMatchingPolicySnapshot) => string | number | null,
  formatValue: (value: string | number) => string,
) {
  const counts = new Map<string, number>();
  for (const booking of bookings) {
    const snapshot = readBookingMatchingPolicySnapshot(booking);
    if (!snapshot) {
      continue;
    }
    const value = readValue(snapshot);
    if (value === null || value === undefined) {
      continue;
    }
    const label = formatValue(value);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const entries = Array.from(counts.entries()).sort((left, right) => right[1] - left[1]);
  if (!entries.length) {
    return 'No saved value';
  }
  if (entries.length === 1) {
    return `${entries[0][0]} (${entries[0][1]})`;
  }
  const preview = entries
    .slice(0, 2)
    .map(([label, count]) => `${label} (${count})`)
    .join(', ');
  return entries.length > 2 ? `${preview}, +${entries.length - 2} more` : preview;
}

export function bookingPolicySnapshotDrift(
  booking: AdminBooking,
  settings: AdminOperationalPolicySetting[],
) {
  const snapshot = readBookingMatchingPolicySnapshot(booking);
  if (!snapshot) {
    return [];
  }
  const comparisons = [
    {
      label: 'response window',
      saved: snapshot.providerResponseWindowMinutes,
      live: policyRawValue(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes),
    },
    {
      label: 'marketplace radius',
      saved: snapshot.backupProviderRadiusMeters,
      live: policyRawValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters),
    },
    {
      label: 'marketplace location freshness',
      saved: snapshot.backupProviderLocationMaxAgeMinutes,
      live: policyRawValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes),
    },
    {
      label: 'marketplace invitation limit',
      saved: snapshot.backupProviderInvitationLimit,
      live: policyRawValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit),
    },
    {
      label: 'accept mode',
      saved: snapshot.preferredAcceptMode,
      live: policyRawValue(settings, OPERATIONAL_POLICY_KEYS.preferredAcceptMode),
    },
    {
      label: 'marketplace open mode',
      saved: snapshot.backupOpenMode,
      live: policyRawValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceOpenMode),
    },
    {
      label: 'travel buffer',
      saved: snapshot.travelBufferMinutes,
      live: policyRawValue(settings, OPERATIONAL_POLICY_KEYS.travelBufferMinutes),
    },
  ];
  return comparisons.filter((comparison) => {
    if (comparison.saved === null || comparison.saved === undefined) {
      return false;
    }
    return String(comparison.saved) !== String(comparison.live);
  });
}

export function formatSnapshotPolicyValue(
  settings: AdminOperationalPolicySetting[],
  key: string,
  value: string | number,
) {
  const setting = adminOperationalPolicySettingByKey(settings, key);
  const stringValue = String(value);
  return displayOperationalWording(
    setting?.options?.find((option) => option.value === stringValue)?.label ??
      formatPolicyValue(value, setting?.unit),
  );
}

function policyRawValue(settings: AdminOperationalPolicySetting[], key: string) {
  return adminOperationalPolicySettingByKey(settings, key)?.value;
}

function formatPolicyValue(value: unknown, unit?: string | null) {
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

function readOptionalNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
