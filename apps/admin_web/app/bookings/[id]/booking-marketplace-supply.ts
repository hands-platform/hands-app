import { marketplaceDisplayText, partnerOperatingStatusLabel } from '../../../lib/admin-copy';
import type {
  AdminBookingDetail,
  AdminOperationalPolicySetting,
  AdminProvider,
} from '../../../lib/admin-api';
import { formatDistanceMeters } from '../../../lib/admin-format';
import { approximateDistanceMeters, distanceLabel } from './booking-formatters';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { bookingPreferredProviderId } from './booking-participant-rules';
import { readBookingMatchingPolicySnapshot } from './booking-policy-snapshots';
import { readOptionalNumber } from './booking-readers';
import { providerLocationAgeMinutes, STALE_LOCATION_MINUTES } from './booking-status-location';
import {
  OPERATIONAL_POLICY_KEYS,
  adminPartnerWalletBalance,
  adminOperationalPolicySettingByKey,
  adminWalletGateBlocksFinalGate,
  buildAdminLiveOperationsPolicy,
  operationalPolicyHref,
} from '../../../lib/operations-policy';

export function bookingMarketplacePartnerSupply(
  booking: AdminBookingDetail,
  providers: AdminProvider[],
  settings: AdminOperationalPolicySetting[],
) {
  const savedPolicy = readBookingMatchingPolicySnapshot(booking);
  const livePolicy = buildAdminLiveOperationsPolicy(settings);
  const walletGateBlocksFinalGate = adminWalletGateBlocksFinalGate(livePolicy.walletNegativeGate);
  const radiusMeters =
    savedPolicy.backupProviderRadiusMeters ??
    readOptionalNumber(
      adminOperationalPolicySettingByKey(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters)?.value,
    ) ??
    10000;
  const freshnessMinutes =
    savedPolicy.backupProviderLocationMaxAgeMinutes ??
    readOptionalNumber(
      adminOperationalPolicySettingByKey(
        settings,
        OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
      )?.value,
    ) ??
    STALE_LOCATION_MINUTES;
  const invitationLimit =
    savedPolicy.backupProviderInvitationLimit ??
    readOptionalNumber(
      adminOperationalPolicySettingByKey(settings, OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit)?.value,
    ) ??
    50;
  const policyPin = bookingDispatchPin(booking);
  const customerLat = policyPin.lat;
  const customerLng = policyPin.lng;
  const hasCustomerPin = Number.isFinite(customerLat) && Number.isFinite(customerLng);
  const participantProviderIds = new Set(
    (booking.participants ?? []).map((participant) => participant.providerProfile?.id).filter(Boolean),
  );
  const preferredProviderId = bookingPreferredProviderId(booking);
  const selectedProviderId = bookingFinalPartnerSummary(booking).id;

  const evaluatedRows = hasCustomerPin
    ? providers
        .map((provider) => {
          const lat = Number(provider.currentLat);
          const lng = Number(provider.currentLng);
          const distanceMeters =
            Number.isFinite(lat) && Number.isFinite(lng)
              ? approximateDistanceMeters(customerLat, customerLng, lat, lng)
              : null;
          const locationAgeMinutes = providerLocationAgeMinutes(provider.currentLocationUpdatedAt);
          const walletBalance = adminPartnerWalletBalance(provider);
          const blockers: string[] = [];

          if (provider.blockedAt) {
            blockers.push('account blocked');
          }
          if (provider.verification?.status !== 'APPROVED') {
            blockers.push(
              `verification ${partnerOperatingStatusLabel(provider.verification?.status ?? 'DRAFT')}`,
            );
          }
          if (provider.status !== 'ONLINE_AVAILABLE') {
            blockers.push(`status ${partnerOperatingStatusLabel(provider.status)}`);
          }
          if (walletGateBlocksFinalGate && walletBalance < 0) {
            blockers.push('final gate settlement required');
          }
          if (distanceMeters === null) {
            blockers.push('no current coordinates');
          } else if (distanceMeters > radiusMeters) {
            blockers.push(`outside ${formatDistanceMeters(radiusMeters)} radius`);
          }
          if (locationAgeMinutes === null) {
            blockers.push('location missing');
          } else if (locationAgeMinutes > freshnessMinutes) {
            blockers.push(`location older than ${freshnessMinutes}m`);
          }

          const role =
            provider.id === selectedProviderId
              ? 'Selected Partner'
              : provider.id === preferredProviderId
                ? 'Preferred Partner'
                : participantProviderIds.has(provider.id)
                  ? 'Shortlist Partner'
                  : 'Marketplace candidate';

          return {
            id: provider.id,
            name: marketplaceDisplayText(
              provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id,
            ),
            role,
            status: partnerOperatingStatusLabel(provider.status),
            eligible: blockers.length === 0,
            blockers,
            distanceMeters,
            distance:
              distanceMeters === null ? 'Unknown distance' : distanceLabel(Math.round(distanceMeters)),
            locationAge:
              locationAgeMinutes === null
                ? 'No location timestamp'
                : locationAgeMinutes < 1
                  ? 'Location just now'
                  : `Location ${locationAgeMinutes}m old`,
            detail: blockers.length
              ? `Excluded: ${blockers.join(', ')}.`
              : `Inside ${formatDistanceMeters(radiusMeters)} radius from ${bookingDispatchPinSourceLabel(
                  policyPin.source,
                )} and location is within ${freshnessMinutes}m.`,
          };
        })
        .sort((left, right) => {
          if (left.eligible !== right.eligible) return left.eligible ? -1 : 1;
          const leftDistance = left.distanceMeters ?? Number.POSITIVE_INFINITY;
          const rightDistance = right.distanceMeters ?? Number.POSITIVE_INFINITY;
          if (leftDistance !== rightDistance) return leftDistance - rightDistance;
          return left.name.localeCompare(right.name);
        })
    : [];

  const candidateRows = evaluatedRows;
  const rows = candidateRows.slice(0, 8);
  const eligibleRows = candidateRows.filter((row) => row.eligible);
  const eligibleCount = eligibleRows.length;
  const nearbyExcluded = candidateRows.filter(
    (row) => !row.eligible && row.distanceMeters !== null && row.distanceMeters <= radiusMeters,
  ).length;
  const outOfRadius = candidateRows.filter(
    (row) => (row.distanceMeters ?? Number.POSITIVE_INFINITY) > radiusMeters,
  ).length;
  const staleOrMissing = candidateRows.filter((row) =>
    row.blockers.some((blocker) => blocker.startsWith('location')),
  ).length;
  const excludedGroups = bookingMarketplacePartnerExcludedGroups(candidateRows, radiusMeters);
  const candidateCommand = bookingMarketplaceCandidateCommand({
    hasCustomerPin,
    eligibleCount,
    nearbyExcluded,
    staleOrMissing,
    outOfRadius,
  });

  return {
    evaluatedAt: new Date().toISOString(),
    rows,
    topCandidates: eligibleRows.slice(0, 5),
    excludedGroups,
    candidateCommand,
    policyPin,
    radiusMeters,
    freshnessMinutes,
    invitationLimit,
    eligibleCount,
    evaluatedCount: candidateRows.length,
    decisionStatus: hasCustomerPin ? (eligibleCount ? 'Supply available' : 'Supply low') : 'Missing pin',
    decisionTone: hasCustomerPin ? (eligibleCount ? 'pill-success' : 'pill-warn') : 'pill-danger',
    decisionTitle: hasCustomerPin
      ? eligibleCount
        ? 'Marketplace matching has usable nearby supply'
        : 'No evaluated Partner can participate under current policy'
      : 'Service address pin is required before Partner radius can be checked',
    decisionDetail: hasCustomerPin
      ? eligibleCount
        ? 'Operators can use the eligible Partners as marketplace participants while the customer waits.'
        : 'Review radius, Partner online status, location freshness, and verification before extending the waiting window.'
      : 'Ask the customer to confirm the service address pin before dispatching Partners.',
    metrics: [
      {
        label: 'Radius pin',
        value: policyPin.label,
        helper: `${bookingDispatchPinSourceLabel(policyPin.source)} is used for marketplace distance checks.`,
      },
      {
        label: 'Eligible Partners',
        value: eligibleCount.toString(),
        helper: `Online, verified, fresh location, and within ${formatDistanceMeters(radiusMeters)}.`,
      },
      {
        label: 'Nearby excluded',
        value: nearbyExcluded.toString(),
        helper:
          'Inside radius but blocked by status, verification, location freshness, or final gate settlement.',
      },
      {
        label: 'Out of radius',
        value: outOfRadius.toString(),
        helper: 'Too far from this booking pin for marketplace matching.',
      },
      {
        label: 'Location stale/missing',
        value: staleOrMissing.toString(),
        helper: `Current policy requires location within ${freshnessMinutes} minutes.`,
      },
      {
        label: 'Wallet gate boundary',
        value: 'Final gate only',
        helper:
          'Cash-debt Partners stay visible for operator review, but final acceptance, service start, and payout release wait for settlement.',
      },
      {
        label: 'Invite cap',
        value: invitationLimit.toString(),
        helper:
          'Nearest eligible marketplace Partners opened for this request before notifications are created.',
      },
    ],
  };
}

export function bookingDispatchPin(booking: AdminBookingDetail) {
  const snapshotLat = readOptionalNumber(booking.addressSnapshot?.latitude);
  const snapshotLng = readOptionalNumber(booking.addressSnapshot?.longitude);
  const legacyLat = readOptionalNumber(booking.lat);
  const legacyLng = readOptionalNumber(booking.lng);
  const hasSnapshotPin = snapshotLat !== null && snapshotLng !== null;
  const lat = hasSnapshotPin ? snapshotLat : legacyLat;
  const lng = hasSnapshotPin ? snapshotLng : legacyLng;
  const legacyDriftMeters =
    hasSnapshotPin && legacyLat !== null && legacyLng !== null
      ? approximateDistanceMeters(snapshotLat, snapshotLng, legacyLat, legacyLng)
      : null;

  return {
    lat,
    lng,
    source: hasSnapshotPin ? 'BookingAddressSnapshot' : 'Stored booking pin',
    label: bookingDispatchPinLabel({ hasSnapshotPin, lat, lng }),
    legacyDriftMeters,
  };
}

function bookingDispatchPinLabel({
  hasSnapshotPin,
  lat,
  lng,
}: {
  hasSnapshotPin: boolean;
  lat: number | null;
  lng: number | null;
}) {
  if (lat === null || lng === null) {
    return 'No service address location';
  }

  return hasSnapshotPin ? 'Service address record saved' : 'Stored booking location saved';
}

function bookingDispatchPinSourceLabel(source: string) {
  return source === 'BookingAddressSnapshot' ? 'confirmed service address' : 'stored booking location';
}

function bookingMarketplacePartnerExcludedGroups(
  rows: Array<{
    name: string;
    blockers: string[];
  }>,
  radiusMeters: number,
) {
  const group = (label: string, href: string, detail: string, match: (blocker: string) => boolean) => {
    const matched = rows.filter((row) => row.blockers.some(match));
    return {
      label,
      count: matched.length,
      detail,
      href,
      samples: matched.slice(0, 3).map((row) => row.name),
    };
  };

  return [
    group(
      'Account blocked',
      '/partners?review=blocked',
      'Partner account is blocked and should not receive direct or marketplace work.',
      (blocker) => blocker === 'account blocked',
    ),
    group(
      'Verification not approved',
      '/partners?review=kyc',
      'Partner needs KYC/verification approval before paid dispatch.',
      (blocker) => blocker.startsWith('verification'),
    ),
    group(
      'Not online available',
      '/partners?verification=APPROVED&providerStatus=OFFLINE&kyc=APPROVED',
      'Partner must open the app or become online available before they can be relied on.',
      (blocker) => blocker.startsWith('status'),
    ),
    group(
      'Location stale or missing',
      '/partners?review=available-blocked-location',
      'Partner location should be refreshed before marketplace decisions are confirmed.',
      (blocker) => blocker.startsWith('location') || blocker === 'no current coordinates',
    ),
    group(
      `Outside ${formatDistanceMeters(radiusMeters)}`,
      operationalPolicyHref(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters),
      'Partner is outside the configured marketplace policy distance for this booking pin.',
      (blocker) => blocker.startsWith('outside'),
    ),
  ];
}

function bookingMarketplaceCandidateCommand(input: {
  hasCustomerPin: boolean;
  eligibleCount: number;
  nearbyExcluded: number;
  staleOrMissing: number;
  outOfRadius: number;
}) {
  if (!input.hasCustomerPin) {
    return {
      status: 'NO PIN',
      tone: 'pill-danger',
      title: 'Customer location must be confirmed first',
      detail:
        'Distance, marketplace eligibility, and Partner exclusion reasons cannot be confirmed without a booking pin.',
      href: '/bookings',
      action: 'Open bookings',
    };
  }
  if (input.eligibleCount > 0) {
    return {
      status: 'SUPPLY READY',
      tone: 'pill-success',
      title: 'This booking has usable marketplace Partner supply',
      detail: `${input.eligibleCount} Partner(s) can be nudged or exposed to the customer choice list under current policy.`,
      href: '/partners?review=ready-now',
      action: 'Open marketplace-ready',
    };
  }
  if (input.nearbyExcluded > 0 || input.staleOrMissing > 0) {
    return {
      status: 'REPAIR SUPPLY',
      tone: 'pill-warn',
      title: 'Nearby Partners need supply repair',
      detail:
        'Prioritize app-open/location refresh, online status, and KYC before extending customer wait time.',
      href: '/partners?review=available-blocked',
      action: 'Review supply blockers',
    };
  }
  if (input.outOfRadius > 0) {
    return {
      status: 'NO 10KM SUPPLY',
      tone: 'pill-warn',
      title: 'Partners are outside the configured marketplace radius',
      detail:
        'Do not widen radius blindly. Check city supply, customer location accuracy, and operations policy first.',
      href: operationalPolicyHref(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters),
      action: 'Review radius policy',
    };
  }
  return {
    status: 'NO SUPPLY',
    tone: 'pill-danger',
    title: 'No Partner supply is available for this booking',
    detail:
      'Escalate to support, confirm service location, or prepare customer cancellation/refund handling.',
    href: '/partners',
    action: 'Open Partners',
  };
}
