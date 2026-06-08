import type { AdminBooking, AdminOperationalPolicySetting, AdminProvider } from '../../lib/admin-api';
import {
  ADMIN_OPERATIONS_POLICY_DEFAULTS,
  OPERATIONAL_POLICY_KEYS,
  adminPartnerFinalGateHeld,
  adminPartnerMarketplaceBlocked,
  adminWalletGateBlocksMarketplaceParticipation,
} from '../../lib/operations-policy';

export type PolicySupplySensitivity = {
  referenceLabel: string;
  currentPolicyLabel: string;
  summary: Array<{ label: string; value: string; helper: string }>;
  radiusRows: Array<{
    radiusLabel: string;
    eligible: number;
    fresh: number;
    finalGateHeld: number;
    operatorRead: string;
    pillClass: string;
  }>;
  freshnessRows: Array<{
    freshnessLabel: string;
    eligible: number;
    staleExcluded: number;
    operatorRead: string;
    pillClass: string;
  }>;
};

export function buildPolicySupplySensitivity(
  settings: AdminOperationalPolicySetting[],
  bookings: AdminBooking[],
  providers: AdminProvider[],
  now = Date.now(),
): PolicySupplySensitivity {
  const backupRadiusMeters =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceRadiusMeters;
  const freshnessMinutes =
    policyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.marketplaceLocationFreshnessMinutes;
  const walletGate =
    policyStringValue(settings, OPERATIONAL_POLICY_KEYS.walletNegativeGate) ??
    ADMIN_OPERATIONS_POLICY_DEFAULTS.walletNegativeGate;
  const hardWalletBlock = adminWalletGateBlocksMarketplaceParticipation(walletGate);
  const reference = referenceBookingCoordinate(bookings);
  const candidates = providers
    .map((provider) => {
      const coordinate = parseCoordinatePair(provider.currentLat, provider.currentLng);
      const ageMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt, now);
      const distanceMeters = coordinate
        ? haversineDistanceMeters(reference.lat, reference.lng, coordinate.lat, coordinate.lng)
        : null;
      return {
        provider,
        ageMinutes,
        distanceMeters,
        hasCoordinate: Boolean(coordinate),
        marketplaceBlocked: adminPartnerMarketplaceBlocked(provider, { hardWalletBlock }),
        finalGateHeld: adminPartnerFinalGateHeld(provider, { hardWalletBlock }),
        online: provider.status === 'ONLINE_AVAILABLE',
      };
    })
    .filter((item) => item.hasCoordinate && item.distanceMeters !== null);
  const currentVisibleSupply = candidates.filter(
    (item) =>
      item.online &&
      !item.marketplaceBlocked &&
      (item.distanceMeters ?? Infinity) <= backupRadiusMeters &&
      (item.ageMinutes ?? Infinity) <= freshnessMinutes,
  );
  const currentFinalGateHeld = candidates.filter(
    (item) => item.finalGateHeld && (item.distanceMeters ?? Infinity) <= backupRadiusMeters,
  );
  const currentStaleExcluded = candidates.filter(
    (item) =>
      item.online &&
      !item.marketplaceBlocked &&
      (item.distanceMeters ?? Infinity) <= backupRadiusMeters &&
      (item.ageMinutes === null || item.ageMinutes > freshnessMinutes),
  );

  const radiusOptions = uniqueNumbers([5000, 10000, backupRadiusMeters, 15000, 20000]).sort(
    (left, right) => left - right,
  );
  const freshnessOptions = uniqueNumbers([10, 30, freshnessMinutes, 60, 120]).sort(
    (left, right) => left - right,
  );

  return {
    referenceLabel: reference.label,
    currentPolicyLabel: `${formatDistance(backupRadiusMeters)} / ${freshnessMinutes}m fresh`,
    summary: [
      {
        label: 'Coordinate sample',
        value: candidates.length.toString(),
        helper: `${providers.length} total partner(s), ${candidates.length} with saved coordinates.`,
      },
      {
        label: 'Current visible supply',
        value: currentVisibleSupply.length.toString(),
        helper: 'Online, marketplace eligible, inside radius, and fresh enough.',
      },
      {
        label: 'Marketplace/payout held in radius',
        value: currentFinalGateHeld.length.toString(),
        helper:
          'Marketplace participation or payout release may wait for settlement, identity, bank, or account controls.',
      },
      {
        label: 'Stale excluded',
        value: currentStaleExcluded.length.toString(),
        helper: 'Could become usable by opening the Partner app and refreshing location.',
      },
    ],
    radiusRows: radiusOptions.map((radius) => {
      const insideRadius = candidates.filter((item) => (item.distanceMeters ?? Infinity) <= radius);
      const eligible = insideRadius.filter(
        (item) =>
          item.online && !item.marketplaceBlocked && (item.ageMinutes ?? Infinity) <= freshnessMinutes,
      );
      const fresh = insideRadius.filter((item) => (item.ageMinutes ?? Infinity) <= freshnessMinutes);
      const finalGateHeld = insideRadius.filter((item) => item.finalGateHeld);
      return {
        radiusLabel: formatDistance(radius),
        eligible: eligible.length,
        fresh: fresh.length,
        finalGateHeld: finalGateHeld.length,
        operatorRead: radiusSensitivityRead(radius, backupRadiusMeters, eligible.length),
        pillClass:
          radius === backupRadiusMeters
            ? 'pill-info'
            : radius < backupRadiusMeters
              ? 'pill-warn'
              : 'pill-neutral',
      };
    }),
    freshnessRows: freshnessOptions.map((freshness) => {
      const insideRadius = candidates.filter(
        (item) =>
          item.online && !item.marketplaceBlocked && (item.distanceMeters ?? Infinity) <= backupRadiusMeters,
      );
      const eligible = insideRadius.filter((item) => (item.ageMinutes ?? Infinity) <= freshness);
      const staleExcluded = insideRadius.length - eligible.length;
      return {
        freshnessLabel: `${freshness} min`,
        eligible: eligible.length,
        staleExcluded,
        operatorRead: freshnessSensitivityRead(freshness, freshnessMinutes, eligible.length, staleExcluded),
        pillClass:
          freshness === freshnessMinutes
            ? 'pill-info'
            : freshness < freshnessMinutes
              ? 'pill-warn'
              : 'pill-neutral',
      };
    }),
  };
}

function policyNumberValue(settings: AdminOperationalPolicySetting[], key: string) {
  return readOptionalNumber(policyRawValue(settings, key));
}

function policyStringValue(settings: AdminOperationalPolicySetting[], key: string) {
  return readOptionalString(policyRawValue(settings, key));
}

function policyRawValue(settings: AdminOperationalPolicySetting[], key: string) {
  return settings.find((setting) => setting.key === key)?.value;
}

function readOptionalNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readOptionalString(value: unknown) {
  if (typeof value === 'string' && value.trim() !== '') {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
}

function referenceBookingCoordinate(bookings: AdminBooking[]) {
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

function byNewestBooking(left: AdminBooking, right: AdminBooking) {
  return Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '');
}

function shortId(id: string) {
  return id.length > 10 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
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
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(value: number) {
  return (value * Math.PI) / 180;
}

function locationAgeMinutes(value: string | null | undefined, now: number) {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return Math.max(0, Math.round((now - timestamp) / 60000));
}

function formatDistance(meters: number) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toLocaleString('en', { maximumFractionDigits: 1 })} km`;
}

function uniqueNumbers(values: number[]) {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value) && value > 0)));
}

function radiusSensitivityRead(radius: number, currentRadius: number, eligibleCount: number) {
  if (eligibleCount === 0) {
    return 'No usable marketplace supply at this radius. Operators should improve partner location/push readiness before relying on it.';
  }
  if (radius < currentRadius) {
    return 'Tighter radius improves arrival quality but can create empty customer waiting screens in thin cities.';
  }
  if (radius > currentRadius) {
    return 'Wider radius increases customer options, but operators should watch late arrivals and ignored alerts.';
  }
  return 'Current live radius. Use this as the baseline before changing matching policy.';
}

function freshnessSensitivityRead(
  freshness: number,
  currentFreshness: number,
  eligibleCount: number,
  staleExcluded: number,
) {
  if (eligibleCount === 0) {
    return 'No visible partner remains under this freshness rule. Ask partners to reopen the app or loosen only with caution.';
  }
  if (freshness < currentFreshness) {
    return 'Stricter freshness improves distance confidence, but may hide partners who update every 10 minutes imperfectly.';
  }
  if (freshness > currentFreshness) {
    return 'Looser freshness exposes more supply, but stale pins can create bad arrival expectations.';
  }
  return staleExcluded
    ? 'Current live freshness. Stale partners can be recovered by opening the Partner app.'
    : 'Current live freshness. No stale partner is being excluded in this sample.';
}
