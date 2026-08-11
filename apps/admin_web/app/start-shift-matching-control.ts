import type {
  AdminBooking,
  AdminDashboardSummary,
  AdminOperationalPolicySetting,
  AdminProvider,
} from '../lib/admin-api';
import { adminCountLabel } from '../lib/admin-copy';
import {
  formatDistanceMeters,
  readPlainRecord,
  shortUnknownId,
} from '../lib/admin-format';
import {
  OPERATIONAL_POLICY_KEYS,
  adminOperationalPolicySettingByKey,
  normalizeAdminMarketplaceOpenMode,
} from '../lib/operations-policy';
import { bookingRegionLabel } from './start-shift-booking-insights';

type DashboardBookingMatchingPolicySnapshot = {
  providerResponseWindowMinutes: number | null;
  backupProviderRadiusMeters: number | null;
  backupProviderLocationMaxAgeMinutes: number | null;
  backupProviderInvitationLimit: number | null;
  preferredAcceptMode: string | null;
  backupOpenMode: string | null;
  travelBufferMinutes: number | null;
};

export function buildMatchingControlRoom(
  bookings: AdminBooking[],
  providers: AdminProvider[],
  settings: AdminOperationalPolicySetting[],
  partnerSupplySummary?: Pick<
    AdminDashboardSummary['partnerSupply'],
    'online' | 'onlineAvailable' | 'staleLocation'
  >,
) {
  const openMatching = bookings
    .filter((booking) => booking.status === 'OPEN_MATCHING')
    .sort(
      (left, right) =>
        Date.parse(left.expiresAt ?? left.createdAt ?? '') -
        Date.parse(right.expiresAt ?? right.createdAt ?? ''),
    );
  const responseWindowMinutes =
    dashboardPolicyNumberValue(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ?? 10;
  const backupRadiusMeters =
    dashboardPolicyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ?? 10000;
  const backupLocationMaxAgeMinutes =
    dashboardPolicyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ?? 30;
  const backupInvitationLimit =
    dashboardPolicyNumberValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit) ?? 50;
  const backupOpenMode = normalizeAdminMarketplaceOpenMode(
    dashboardPolicyStringValue(settings, OPERATIONAL_POLICY_KEYS.marketplaceOpenMode) ??
      'IMMEDIATE_WITHIN_WINDOW',
  );
  const immediateBackup = backupOpenMode === 'IMMEDIATE_WITHIN_WINDOW';
  const openMatchingWithPolicySnapshot = openMatching.filter((booking) =>
    dashboardBookingPolicySnapshot(booking),
  );
  const hasProviderRows = providers.length > 0;
  const freshOnlinePartners = providers.filter(
    (provider) =>
      provider.status.startsWith('ONLINE') &&
      !provider.blockedAt &&
      parseCoordinatePair(provider.currentLat, provider.currentLng) &&
      locationAgeMinutes(provider.currentLocationUpdatedAt) !== null &&
      (locationAgeMinutes(provider.currentLocationUpdatedAt) ?? Infinity) <= backupLocationMaxAgeMinutes,
  );
  const freshOnlinePartnerCount = hasProviderRows
    ? freshOnlinePartners.length
    : (partnerSupplySummary?.onlineAvailable ?? 0);
  const openRows = openMatching.slice(0, 8).map((booking) => {
    const savedPolicy = dashboardBookingPolicySnapshot(booking);
    const bookingResponseWindowMinutes = savedPolicy?.providerResponseWindowMinutes ?? responseWindowMinutes;
    const bookingBackupRadiusMeters = savedPolicy?.backupProviderRadiusMeters ?? backupRadiusMeters;
    const bookingBackupLocationMaxAgeMinutes =
      savedPolicy?.backupProviderLocationMaxAgeMinutes ?? backupLocationMaxAgeMinutes;
    const bookingBackupInvitationLimit = savedPolicy?.backupProviderInvitationLimit ?? backupInvitationLimit;
    const bookingBackupOpenMode = savedPolicy?.backupOpenMode ?? backupOpenMode;
    const bookingImmediateBackup = bookingBackupOpenMode === 'IMMEDIATE_WITHIN_WINDOW';
    const coordinate = parseCoordinatePair(booking.lat, booking.lng);
    const eligiblePartnersAll =
      hasProviderRows && coordinate
        ? providersWithinRadius(providers, coordinate.lat, coordinate.lng, bookingBackupRadiusMeters)
        : [];
    const eligiblePartners = eligiblePartnersAll.slice(0, bookingBackupInvitationLimit);
    const freshEligible = eligiblePartners.filter(
      (item) => (item.ageMinutes ?? Infinity) <= bookingBackupLocationMaxAgeMinutes,
    );
    const summaryEligibleCount = hasProviderRows
      ? eligiblePartners.length
      : coordinate
        ? Math.max(partnerSupplySummary?.online ?? 0, partnerSupplySummary?.onlineAvailable ?? 0)
        : 0;
    const summaryFreshEligibleCount = hasProviderRows
      ? freshEligible.length
      : coordinate
        ? (partnerSupplySummary?.onlineAvailable ?? 0)
        : 0;
    const participantCount = booking.participants?.length ?? 0;
    const expired = booking.expiresAt ? Date.parse(booking.expiresAt) < Date.now() : false;
    const firstPickDeclined = Boolean(
      booking.preferredProvider?.id &&
      (booking.participants ?? []).some(
        (participant) =>
          participant.providerProfile?.id === booking.preferredProvider?.id &&
          participant.status === 'REJECTED',
      ),
    );
    const backupWindowOpen = bookingImmediateBackup || firstPickDeclined || expired;
    const needsSameShiftDispatch = expired || summaryFreshEligibleCount === 0;
    const customerReadyToChoose = participantCount > 0;
    const hasCustomerPin = Boolean(coordinate);
    const customerState = customerReadyToChoose ? 'Customer can choose' : 'Customer waiting';
    const customerPillClass = customerReadyToChoose ? 'pill-success' : 'pill-warn';
    const backupState = backupWindowOpen ? 'Marketplace open' : 'First-pick window';
    const backupPillClass = backupWindowOpen ? 'pill-success' : 'pill-info';
    const supplyState = hasCustomerPin
      ? hasProviderRows
        ? `${freshEligible.length} fresh / ${eligiblePartners.length} nearby`
        : `${summaryFreshEligibleCount} fresh / ${summaryEligibleCount} live supply`
      : 'No customer pin';
    const supplyPillClass = !hasCustomerPin
      ? 'pill-danger'
      : summaryFreshEligibleCount
        ? 'pill-success'
        : 'pill-danger';
    const nextAction = matchingRowNextAction({
      expired,
      hasCustomerPin,
      customerReadyToChoose,
      backupWindowOpen,
      freshEligibleCount: summaryFreshEligibleCount,
      eligibleCount: summaryEligibleCount,
      firstPickName: booking.preferredProvider?.displayName ?? null,
    });
    const detail = [
      bookingRegionLabel(booking),
      `first-pick ${booking.preferredProvider?.displayName ?? 'none'}`,
      adminCountLabel(participantCount, 'participant row'),
      firstPickDeclined
        ? 'first-pick declined'
        : backupWindowOpen
          ? 'marketplace open'
          : 'marketplace waiting',
      coordinate && hasProviderRows
        ? `${freshEligible.length}/${eligiblePartners.length} fresh eligible / ${eligiblePartnersAll.length} in radius`
        : coordinate
          ? `${summaryFreshEligibleCount}/${summaryEligibleCount} live supply from summary`
          : 'no customer pin',
      `${bookingBackupInvitationLimit} invite cap`,
      `${formatDistanceMeters(bookingBackupRadiusMeters)} radius`,
      `${bookingBackupLocationMaxAgeMinutes}m freshness`,
      `${bookingResponseWindowMinutes}m window`,
      savedPolicy ? 'saved policy' : 'live policy default',
      booking.expiresAt ? `timer ${timeUntilLabel(booking.expiresAt)}` : 'no timer',
    ].join(' / ');

    return {
      id: booking.id,
      title: `${bookingServiceLabel(booking)} / ${shortUnknownId(booking.id)}`,
      detail,
      status: needsSameShiftDispatch ? 'Dispatch now' : 'Monitor',
      pillClass: needsSameShiftDispatch ? 'pill-danger' : 'pill-warn',
      eligibleCount: summaryEligibleCount,
      freshEligibleCount: summaryFreshEligibleCount,
      expired,
      hasPolicySnapshot: Boolean(savedPolicy),
      customerState,
      customerPillClass,
      backupState,
      backupPillClass,
      supplyState,
      supplyPillClass,
      nextAction,
    };
  });
  const attentionRows = openRows.filter((row) => row.expired || row.freshEligibleCount === 0);
  const averageEligible =
    openRows.length > 0
      ? (openRows.reduce((sum, row) => sum + row.eligibleCount, 0) / openRows.length).toFixed(1)
      : '0';
  const insideFirstPickWindow = openMatching.filter((booking) =>
    bookingInsideResponseWindow(booking, responseWindowMinutes),
  ).length;
  const pastFirstPickWindow = openMatching.length - insideFirstPickWindow;
  const customerChoiceReady = openMatching.filter((booking) =>
    (booking.participants ?? []).some((participant) => participant.status === 'ACCEPTED'),
  ).length;

  return {
    openRows,
    healthLabel: attentionRows.length ? `${attentionRows.length} attention` : 'Stable',
    healthPillClass: attentionRows.length ? 'pill-danger' : 'pill-success',
    metrics: [
      {
        label: 'Open matching',
        value: String(openMatching.length),
        helper: `${adminCountLabel(attentionRows.length, 'booking')} ${attentionRows.length === 1 ? 'needs' : 'need'} dispatch review now.`,
      },
      {
        label: 'Inside first window',
        value: String(insideFirstPickWindow),
        helper: `Open bookings still inside the first-pick response window using the live ${responseWindowMinutes}m policy.`,
      },
      {
        label: 'Past first-pick',
        value: String(pastFirstPickWindow),
        helper: 'Open bookings past the first-pick response window and ready for marketplace handling.',
      },
      {
        label: 'Customer can choose',
        value: String(customerChoiceReady),
        helper: 'Open bookings with accepted Partners visible in the customer choice list.',
      },
      {
        label: 'Policy timer',
        value: `${responseWindowMinutes} min live`,
        helper: 'New bookings use this value; open rows keep their saved matching rules.',
      },
      {
        label: 'Marketplace radius',
        value: formatDistanceMeters(backupRadiusMeters),
        helper: `${averageEligible} average eligible Partners using row-level saved radius when available.`,
      },
      {
        label: 'Marketplace invite cap',
        value: String(backupInvitationLimit),
        helper: 'Maximum nearest eligible Partners opened for marketplace participation on new bookings.',
      },
      {
        label: 'Marketplace open rule',
        value: immediateBackup ? 'Immediate live' : 'Delayed live',
        helper: immediateBackup
          ? 'New bookings allow eligible Partners during the first-pick timer.'
          : 'New bookings hold marketplace Partners unless first-pick declines or the window expires.',
      },
      {
        label: 'Saved rules',
        value: `${openMatchingWithPolicySnapshot.length}/${openMatching.length}`,
        helper: 'Open bookings with saved dispatch rules for audit review.',
      },
      {
        label: 'Fresh online supply',
        value: String(freshOnlinePartnerCount),
        helper: hasProviderRows
          ? `Ready Partners with a location update in the last ${backupLocationMaxAgeMinutes} minutes.`
          : 'Partner supply total comes from the current Shift command summary.',
      },
    ],
    checks: [
      {
        status: attentionRows.length ? 'Action needed' : 'Clear',
        title: 'Timer and supply check',
        detail: attentionRows.length
          ? `${adminCountLabel(attentionRows.length, 'open matching booking')} ${attentionRows.length === 1 ? 'is expired or has' : 'are expired or have'} no fresh eligible nearby Partner.`
          : 'Open matching bookings have usable Partner supply in the current sample.',
        operatorAction: attentionRows.length
          ? 'Open the affected bookings, contact Partners, or widen/refresh supply before customer wait grows.'
          : 'Keep monitoring response speed and participant depth.',
        className: attentionRows.length ? 'ops-task-blocked' : 'ops-task-done',
        pillClass: attentionRows.length ? 'pill-danger' : 'pill-success',
      },
      {
        status: immediateBackup ? 'Visible early' : 'Delayed',
        title: 'Marketplace participation mode',
        detail: immediateBackup
          ? 'New bookings can show nearby marketplace Partners during the first-pick response window.'
          : 'New bookings keep marketplace Partners waiting until timeout, unless first-pick declines first.',
        operatorAction: immediateBackup
          ? 'This supports the current customer anxiety-reduction direction.'
          : 'Use this only when first-pick Partner response rate is strong enough, and monitor decline recovery.',
        className: immediateBackup ? 'ops-task-done' : 'ops-task-pending',
        pillClass: immediateBackup ? 'pill-success' : 'pill-warn',
      },
      {
        status:
          openMatching.length === 0 || openMatchingWithPolicySnapshot.length === openMatching.length
            ? 'Traceable'
            : 'Live policy default',
        title: 'Open booking policy records',
        detail:
          openMatching.length === 0
            ? 'No open matching booking needs policy record review right now.'
            : `${openMatchingWithPolicySnapshot.length}/${openMatching.length} open matching bookings have saved matching policy.`,
        operatorAction:
          openMatchingWithPolicySnapshot.length === openMatching.length
            ? 'Use each booking row and detail page for manual dispatch decisions.'
            : 'Older open bookings without saved rules should be reviewed against current policy and audit notes.',
        className:
          openMatching.length === 0 || openMatchingWithPolicySnapshot.length === openMatching.length
            ? 'ops-task-done'
            : 'ops-task-pending',
        pillClass:
          openMatching.length === 0 || openMatchingWithPolicySnapshot.length === openMatching.length
            ? 'pill-success'
            : 'pill-warn',
      },
      {
        status: freshOnlinePartners.length ? 'Location ready' : 'Location gap',
        title: 'Partner app location freshness',
        detail: freshOnlinePartners.length
          ? `${adminCountLabel(freshOnlinePartners.length, 'online Partner')} ${freshOnlinePartners.length === 1 ? 'has' : 'have'} location data fresh within ${backupLocationMaxAgeMinutes} minutes.`
          : 'No online Partner has a fresh location update in the current admin sample.',
        operatorAction: freshOnlinePartners.length
          ? 'This is enough to validate the low-cost last-location model.'
          : 'Ask Partners to open the app so one fresh low-cost location update can seed matching.',
        className: freshOnlinePartners.length ? 'ops-task-done' : 'ops-task-blocked',
        pillClass: freshOnlinePartners.length ? 'pill-success' : 'pill-danger',
      },
    ],
  };
}

function dashboardPolicyNumberValue(settings: AdminOperationalPolicySetting[], key: string) {
  const raw = adminOperationalPolicySettingByKey(settings, key)?.value;
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

function dashboardPolicyStringValue(settings: AdminOperationalPolicySetting[], key: string) {
  const raw = adminOperationalPolicySettingByKey(settings, key)?.value;
  return typeof raw === 'string' ? raw : null;
}

function dashboardBookingPolicySnapshot(
  booking: AdminBooking,
): DashboardBookingMatchingPolicySnapshot | null {
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

function bookingInsideResponseWindow(booking: AdminBooking, responseWindowMinutes: number) {
  const createdAtMs = Date.parse(booking.createdAt ?? '');
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }
  return Date.now() - createdAtMs <= responseWindowMinutes * 60 * 1000;
}

function matchingRowNextAction(input: {
  expired: boolean;
  hasCustomerPin: boolean;
  customerReadyToChoose: boolean;
  backupWindowOpen: boolean;
  freshEligibleCount: number;
  eligibleCount: number;
  firstPickName: string | null;
}) {
  if (input.expired) {
    return 'Expire or manually recover this request before the customer waits longer.';
  }
  if (!input.hasCustomerPin) {
    return 'Confirm the customer service location so distance-based marketplace matching can work.';
  }
  if (input.customerReadyToChoose) {
    return 'Confirm the customer sees the shortlist and can select the final Partner.';
  }
  if (input.freshEligibleCount === 0 && input.eligibleCount > 0) {
    return 'Ask nearby Partners to refresh location or open the Partner app before widening policy.';
  }
  if (input.freshEligibleCount === 0) {
    return 'Check local supply; no fresh nearby Partner is currently available for marketplace participation.';
  }
  if (input.backupWindowOpen) {
    return `Nudge ${adminCountLabel(input.freshEligibleCount, 'eligible nearby Partner')} to join the customer choice list.`;
  }
  return `Monitor first-pick response from ${input.firstPickName ?? 'the preferred Partner'} while marketplace supply stays ready.`;
}

function readOptionalNumber(value: unknown) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function readOptionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function providersWithinRadius(providers: AdminProvider[], lat: number, lng: number, radiusMeters: number) {
  return providers
    .map((provider) => {
      const coordinate = parseCoordinatePair(provider.currentLat, provider.currentLng);
      const ageMinutes = locationAgeMinutes(provider.currentLocationUpdatedAt);
      const distanceMeters = coordinate
        ? haversineDistanceMeters(lat, lng, coordinate.lat, coordinate.lng)
        : null;
      return {
        provider,
        ageMinutes,
        distanceMeters,
      };
    })
    .filter(
      (item) =>
        item.provider.status.startsWith('ONLINE') &&
        !item.provider.blockedAt &&
        item.distanceMeters !== null &&
        item.distanceMeters <= radiusMeters &&
        item.ageMinutes !== null &&
        item.ageMinutes <= 24 * 60,
    )
    .sort((left, right) => (left.distanceMeters ?? Infinity) - (right.distanceMeters ?? Infinity));
}

function bookingServiceLabel(booking: AdminBooking) {
  const service = booking.services?.[0];
  const name = service?.service?.name ?? 'Booking';
  const duration = service?.service?.durationMin ? `${service.service.durationMin} min` : null;
  return duration ? `${name} (${duration})` : name;
}

function parseCoordinatePair(lat: unknown, lng: unknown) {
  const parsedLat = typeof lat === 'number' ? lat : typeof lat === 'string' ? Number(lat) : NaN;
  const parsedLng = typeof lng === 'number' ? lng : typeof lng === 'string' ? Number(lng) : NaN;
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
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

function timeUntilLabel(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return 'unknown';
  }
  const minutes = Math.round((timestamp - Date.now()) / 60000);
  if (minutes < 0) {
    return `${Math.abs(minutes)}m overdue`;
  }
  if (minutes < 60) {
    return `${minutes}m left`;
  }
  return `${Math.round(minutes / 60)}h left`;
}
