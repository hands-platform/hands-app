import type { AdminBooking, AdminOperationalPolicySetting, AdminProvider } from '../../lib/admin-api';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import {
  ADMIN_OPERATIONS_POLICY_DEFAULTS,
  LEGACY_OPERATIONAL_POLICY_KEYS,
  OPERATIONAL_POLICY_KEYS,
  adminPartnerAlertChannelRoutesToFcm,
  adminPreferredAcceptModeUsesFirstPickPriority,
  normalizeAdminMarketplaceOpenMode,
  readPolicyNumber,
  readPolicyString,
  readPolicyStringFromKeys,
} from '../../lib/operations-policy';
import { byNewestBooking, shortId } from './policy-booking-format';
import { policyDisplayByKey } from './policy-value-display';

type PolicySimulatorPartnerRow = {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly distanceLabel: string;
  readonly locationAgeLabel: string;
  readonly pillClass: string;
};

type PolicySimulationInputs = {
  readonly alertChannel: string;
  readonly backupInvitationLimit: number;
  readonly backupLocationFreshnessMinutes: number;
  readonly backupRadiusMeters: number;
  readonly marketplaceOpenMode: string;
  readonly preferredAcceptMode: string;
  readonly responseWindowMinutes: number;
  readonly travelBufferMinutes: number;
};

type PartnerCandidate = {
  readonly provider: AdminProvider;
  readonly distanceMeters: number | null;
  readonly ageMinutes: number | null;
  readonly usableLocation: boolean;
};

export function buildPolicySimulation(
  settings: readonly AdminOperationalPolicySetting[],
  bookings: readonly AdminBooking[],
  providers: readonly AdminProvider[],
) {
  const policyInputs = readPolicySimulationInputs(settings);
  const reference = referenceBookingCoordinate(bookings);
  const partnerCandidates = buildPartnerCandidates(providers, reference);

  const eligiblePartners = partnerCandidates.filter(
    (item) => (item.distanceMeters ?? Infinity) <= policyInputs.backupRadiusMeters,
  );
  const freshEligible = eligiblePartners.filter(
    (item) => (item.ageMinutes ?? Infinity) <= policyInputs.backupLocationFreshnessMinutes,
  );
  const invitedPartners = eligiblePartners.slice(0, policyInputs.backupInvitationLimit);
  const partnerRows = buildPartnerRows(invitedPartners, policyInputs.backupLocationFreshnessMinutes);
  const expiresAt = new Date(Date.now() + policyInputs.responseWindowMinutes * 60 * 1000);
  const immediateBackup = policyInputs.marketplaceOpenMode === 'IMMEDIATE_WITHIN_WINDOW';
  const customerFinalConfirm = adminPreferredAcceptModeUsesFirstPickPriority(policyInputs.preferredAcceptMode);
  const ready = eligiblePartners.length > 0 && freshEligible.length > 0;

  return {
    ready,
    partnerRows,
    metrics: buildSimulationMetrics(
      settings,
      reference,
      policyInputs,
      eligiblePartners,
      freshEligible,
      invitedPartners,
      expiresAt,
    ),
    timeline: buildSimulationTimeline(
      settings,
      policyInputs,
      eligiblePartners,
      invitedPartners,
      immediateBackup,
      customerFinalConfirm,
    ),
    checks: buildSimulationChecks(ready, freshEligible, immediateBackup, customerFinalConfirm),
  };
}

function buildSimulationMetrics(
  settings: readonly AdminOperationalPolicySetting[],
  reference: { readonly lat: number; readonly lng: number; readonly label: string },
  policyInputs: PolicySimulationInputs,
  eligiblePartners: readonly PartnerCandidate[],
  freshEligible: readonly PartnerCandidate[],
  invitedPartners: readonly PartnerCandidate[],
  expiresAt: Date,
) {
  return [
    {
      label: 'Reference location',
      value: reference.label,
      helper: `${reference.lat.toFixed(4)}, ${reference.lng.toFixed(4)}`,
    },
    {
      label: 'First response window',
      value: `${policyInputs.responseWindowMinutes} min`,
      helper: `A request created now would auto-close around ${expiresAt.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Ho_Chi_Minh',
      })}.`,
    },
    {
      label: 'Marketplace policy',
      value: formatDistance(policyInputs.backupRadiusMeters),
      helper: `${eligiblePartners.length} visible partner(s), ${freshEligible.length} fresh location(s).`,
    },
    {
      label: 'Marketplace alert cap',
      value: `${policyInputs.backupInvitationLimit} partner(s)`,
      helper: `${invitedPartners.length} partner(s) would be invited now after distance sorting.`,
    },
    {
      label: 'Partner alert routing',
      value: policyDisplayByKey(settings, 'notification.partner_alert_channel'),
      helper: `${
        adminPartnerAlertChannelRoutesToFcm(policyInputs.alertChannel)
          ? 'FCM push plus in-app listing'
          : 'In-app listing now, FCM push later'
      } for eligible partners.`,
    },
  ];
}

function buildSimulationTimeline(
  settings: readonly AdminOperationalPolicySetting[],
  policyInputs: PolicySimulationInputs,
  eligiblePartners: readonly PartnerCandidate[],
  invitedPartners: readonly PartnerCandidate[],
  immediateBackup: boolean,
  customerFinalConfirm: boolean,
) {
  return [
    {
      step: '1',
      title: 'Customer creates direct request',
      detail:
        'The selected Partner receives the first-pick request. Marketplace Partners are evaluated from current policy and location data.',
      className: 'timeline-done',
      tags: [
        {
          label: customerFinalConfirm ? 'Customer final choice' : 'Historical value ignored',
          tone: 'pill-info',
        },
        { label: `${policyInputs.responseWindowMinutes} min`, tone: 'pill-success' },
      ],
    },
    {
      step: '2',
      title: immediateBackup
        ? 'Marketplace list opens immediately'
        : 'Marketplace list waits unless declined',
      detail: immediateBackup
        ? `${invitedPartners.length}/${eligiblePartners.length} Partner(s) can see or participate while the first Partner decides under current policy.`
        : `Marketplace Partners are held until the ${policyInputs.responseWindowMinutes} minute first-pick window ends, but open immediately if the first-pick Partner declines.`,
      className: immediateBackup ? 'timeline-active' : 'timeline-warn',
      tags: [
        { label: policyDisplayByKey(settings, OPERATIONAL_POLICY_KEYS.marketplaceOpenMode), tone: 'pill-info' },
        {
          label: `${eligiblePartners.length} eligible`,
          tone: eligiblePartners.length ? 'pill-success' : 'pill-danger',
        },
      ],
    },
    {
      step: '3',
      title: 'Partner availability is buffered',
      detail: `After a partner completes a booking, the system uses a ${policyInputs.travelBufferMinutes} minute travel buffer before they become normally available again.`,
      className: 'timeline-done',
      tags: [
        { label: `${policyInputs.travelBufferMinutes} min travel buffer`, tone: 'pill-neutral' },
        { label: 'Location reuse only', tone: 'pill-info' },
      ],
    },
  ];
}

function buildSimulationChecks(
  ready: boolean,
  freshEligible: readonly PartnerCandidate[],
  immediateBackup: boolean,
  customerFinalConfirm: boolean,
) {
  return [
    {
      status: ready ? 'Supply ready' : 'Needs supply',
      title: 'Dispatch supply check',
      detail: ready
        ? `${freshEligible.length} fresh partner location(s) are inside the current radius.`
        : 'No fresh eligible partner location is inside the current radius.',
      operatorAction: ready
        ? 'This policy can support a real customer wait screen for the reference area.'
        : 'Ask partners to open the app and send location, or review radius/city supply before launch.',
      className: ready ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: ready ? 'pill-success' : 'pill-danger',
    },
    {
      status: immediateBackup ? 'Customer alternatives visible' : 'Strict first-pick',
      title: 'Customer waiting experience',
      detail: immediateBackup
        ? 'Customers can see marketplace partner interest during the first response window.'
        : 'Customers may see an empty waiting screen until the first partner times out, unless that partner declines first.',
      operatorAction: immediateBackup
        ? 'Keep monitoring whether customers understand first-pick vs marketplace partner choice.'
        : 'Use only if first-pick response rate is high enough to avoid empty waiting.',
      className: immediateBackup ? 'ops-task-done' : 'ops-task-pending',
      pillClass: immediateBackup ? 'pill-success' : 'pill-warn',
    },
    {
      status: customerFinalConfirm ? 'Customer controls' : 'Fast lock',
      title: 'Final matching decision',
      detail: customerFinalConfirm
        ? 'Customer final selection applies when first-pick does not validly match first.'
        : 'This setting would conflict with the first-pick priority plus customer fallback flow.',
      operatorAction: customerFinalConfirm
        ? 'This matches the current HANDS direction: first-pick can win first, otherwise the customer chooses.'
        : 'Treat this as a configuration conflict for HANDS and return to first-pick priority with customer fallback.',
      className: customerFinalConfirm ? 'ops-task-done' : 'ops-task-blocked',
      pillClass: customerFinalConfirm ? 'pill-success' : 'pill-danger',
    },
  ];
}

function readPolicySimulationInputs(settings: readonly AdminOperationalPolicySetting[]): PolicySimulationInputs {
  const policySettings = [...settings];
  return {
    alertChannel:
      readPolicyString(policySettings, OPERATIONAL_POLICY_KEYS.partnerAlertChannel) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.partnerAlertChannel,
    backupInvitationLimit:
      readPolicyNumber(policySettings, OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceInvitationLimit,
    backupLocationFreshnessMinutes:
      readPolicyNumber(policySettings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceLocationFreshnessMinutes,
    backupRadiusMeters:
      readPolicyNumber(policySettings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceRadiusMeters,
    marketplaceOpenMode: normalizeAdminMarketplaceOpenMode(
      readPolicyStringFromKeys(policySettings, [
        OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
        LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      ]) ?? ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceOpenMode,
    ),
    preferredAcceptMode:
      readPolicyString(policySettings, OPERATIONAL_POLICY_KEYS.preferredAcceptMode) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.preferredAcceptMode,
    responseWindowMinutes:
      readPolicyNumber(policySettings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.providerResponseWindowMinutes,
    travelBufferMinutes:
      readPolicyNumber(policySettings, OPERATIONAL_POLICY_KEYS.travelBufferMinutes) ??
      ADMIN_OPERATIONS_POLICY_DEFAULTS.travelBufferMinutes,
  };
}

function buildPartnerCandidates(
  providers: readonly AdminProvider[],
  reference: { readonly lat: number; readonly lng: number },
): PartnerCandidate[] {
  return providers
    .filter((provider) => provider.status.startsWith('ONLINE'))
    .map((provider) => buildPartnerCandidate(provider, reference))
    .filter((item) => item.usableLocation && item.distanceMeters !== null)
    .sort((left, right) => (left.distanceMeters ?? Infinity) - (right.distanceMeters ?? Infinity));
}

function buildPartnerCandidate(
  provider: AdminProvider,
  reference: { readonly lat: number; readonly lng: number },
): PartnerCandidate {
  const lat = readOptionalNumber(provider.currentLat);
  const lng = readOptionalNumber(provider.currentLng);
  const distanceMeters =
    lat !== null && lng !== null ? haversineDistanceMeters(reference.lat, reference.lng, lat, lng) : null;
  const ageMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
  return {
    provider,
    distanceMeters,
    ageMinutes,
    usableLocation: distanceMeters !== null && ageMinutes !== null && ageMinutes <= 24 * 60 && !provider.blockedAt,
  };
}

function buildPartnerRows(
  invitedPartners: readonly PartnerCandidate[],
  backupLocationFreshnessMinutes: number,
): PolicySimulatorPartnerRow[] {
  return invitedPartners.slice(0, 6).map((item) => {
    const isFresh = (item.ageMinutes ?? Infinity) <= backupLocationFreshnessMinutes;
    return {
      id: item.provider.id,
      name: displayOperationalWording(item.provider.displayName ?? item.provider.user?.fullName ?? 'Partner'),
      status: isFresh ? 'Fresh' : 'Stale',
      distanceLabel: formatDistance(item.distanceMeters ?? 0),
      locationAgeLabel: formatLocationAge(item.ageMinutes),
      pillClass: isFresh ? 'pill-success' : 'pill-warn',
    };
  });
}

export function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
}

function referenceBookingCoordinate(bookings: readonly AdminBooking[]) {
  const withCoordinate = bookings
    .filter((booking) => parseCoordinatePair(booking.lat, booking.lng))
    .sort(byNewestBooking)[0];
  const coordinate = withCoordinate ? parseCoordinatePair(withCoordinate.lat, withCoordinate.lng) : null;
  if (withCoordinate && coordinate) {
    return {
      lat: coordinate.lat,
      lng: coordinate.lng,
      label: `Booking ${shortId(withCoordinate.id)}`,
    };
  }
  return {
    lat: 10.7769,
    lng: 106.7009,
    label: 'Demo Ho Chi Minh City',
  };
}

function parseCoordinatePair(lat: unknown, lng: unknown) {
  const parsedLat = readOptionalNumber(lat);
  const parsedLng = readOptionalNumber(lng);
  if (parsedLat === null || parsedLng === null) {
    return null;
  }
  if (Math.abs(parsedLat) > 90 || Math.abs(parsedLng) > 180) {
    return null;
  }
  return { lat: parsedLat, lng: parsedLng };
}

function haversineDistanceMeters(fromLat: number, fromLng: number, toLat: number, toLng: number) {
  const earthRadiusMeters = 6371000;
  const deltaLat = degreesToRadians(toLat - fromLat);
  const deltaLng = degreesToRadians(toLng - fromLng);
  const startLat = degreesToRadians(fromLat);
  const endLat = degreesToRadians(toLat);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function locationAgeMinutes(value?: string | null) {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return Math.max(0, Math.round((Date.now() - timestamp) / 60000));
}

function formatLocationAge(minutes: number | null) {
  if (minutes === null) {
    return 'unknown';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.round(hours / 24)}d ago`;
}

function readOptionalNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}
