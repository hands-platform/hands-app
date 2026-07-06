import { bookingRequestOpenedAt } from '../../../lib/admin-booking-time';
import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import type { AdminAvatarStatus } from '../../../lib/admin-avatar-status';
import {
  isPostMatchCancellationManualReviewRequired,
  isPostMatchCancellationReviewBooking,
} from '../booking-post-match-cancellations-model';
import { readAddressText, serviceAddressAreaLabel } from '../booking-address-readers';
import type { BookingFinalPartnerSummary } from './booking-final-partner-summary';
import type { bookingFinanceTrace } from './booking-finance-trace';
import {
  bookingServiceOptionLabel,
  approximateDistanceMeters,
  distanceLabel,
  formatDate,
  money,
  providerName,
  shortId,
} from './booking-formatters';

type BookingFinanceTrace = ReturnType<typeof bookingFinanceTrace>;

export type BookingUnifiedDetailCard = {
  readonly label: string;
  readonly value: string;
  readonly helper: string;
  readonly href?: string;
};

export type BookingUnifiedDetailPerson = {
  readonly helper?: string;
  readonly href?: string;
  readonly id: string;
  readonly label: string;
  readonly status?: AdminAvatarStatus;
  readonly statusLabel?: string;
};

export type BookingUnifiedDetailRow = {
  readonly label: string;
  readonly value: string;
  readonly valueDateTimeValue?: string | null;
  readonly detail?: string;
  readonly detailDateTimeFallback?: string;
  readonly detailDateTimePrefix?: string;
  readonly detailDateTimeSuffix?: string;
  readonly detailDateTimeValue?: string | null;
  readonly detailSecondDateTimeFallback?: string;
  readonly detailSecondDateTimePrefix?: string;
  readonly detailSecondDateTimeSuffix?: string;
  readonly detailSecondDateTimeValue?: string | null;
  readonly href?: string;
  readonly people?: readonly BookingUnifiedDetailPerson[];
  readonly person?: BookingUnifiedDetailPerson;
  readonly variant?: 'finance-highlight' | 'inactive' | 'secondary';
};

type BookingUnifiedDetailDateMeta = {
  readonly detail: string;
  readonly detailDateTimeFallback?: string;
  readonly detailDateTimePrefix?: string;
  readonly detailDateTimeSuffix?: string;
  readonly detailDateTimeValue?: string | null;
  readonly detailSecondDateTimeFallback?: string;
  readonly detailSecondDateTimePrefix?: string;
  readonly detailSecondDateTimeSuffix?: string;
  readonly detailSecondDateTimeValue?: string | null;
};

type BookingUnifiedLocationDetail = BookingUnifiedDetailDateMeta & {
  readonly value: string;
};

export type BookingUnifiedDetail = {
  readonly customerRows: readonly BookingUnifiedDetailRow[];
  readonly financeRows: readonly BookingUnifiedDetailRow[];
  readonly matchedPartnerRows: readonly BookingUnifiedDetailRow[];
  readonly statusLabel: string;
  readonly statusTone: string;
  readonly summaryCards: readonly BookingUnifiedDetailCard[];
};

export function bookingUnifiedDetail({
  addressLine,
  addressPin,
  booking,
  financeTrace,
  finalPartnerSummary,
  latestLocation,
  messageCount,
}: {
  readonly addressLine: string;
  readonly addressPin: string;
  readonly booking: AdminBookingDetail;
  readonly financeTrace: BookingFinanceTrace;
  readonly finalPartnerSummary: BookingFinalPartnerSummary;
  readonly latestLocation?: AdminLocationSnapshot | null;
  readonly messageCount: number;
}): BookingUnifiedDetail {
  const customerName = booking.customerProfile?.user?.fullName ?? 'Customer';
  const partnerName = finalPartnerSummary.selected ? finalPartnerSummary.label : 'Not matched';
  const reservationTime = formatDate(bookingRequestOpenedAt(booking));
  const partnerHref = finalPartnerSummary.selected ? finalPartnerSummary.href : undefined;

  return {
    customerRows: bookingUnifiedCustomerRows({ addressLine, addressPin, booking }),
    financeRows: bookingUnifiedFinanceRows({ booking, financeTrace }),
    matchedPartnerRows: bookingUnifiedMatchedPartnerRows({
      booking,
      addressLine,
      finalPartnerSummary,
      latestLocation,
      partnerHref,
    }),
    statusLabel: bookingUnifiedStatusLabel(booking),
    statusTone: bookingUnifiedStatusTone(booking.status),
    summaryCards: [
      {
        label: 'Customer',
        value: customerName,
        helper: booking.customerProfile?.user?.phone ?? 'No phone',
        href: booking.customerProfile?.id ? `/customers/${booking.customerProfile.id}` : undefined,
      },
      {
        label: 'Matched Partner',
        value: partnerName,
        helper: booking.selectedProvider?.user?.phone ?? finalPartnerSummary.id ?? 'No Partner yet',
        href: partnerHref,
      },
      {
        label: 'Reservation',
        value: reservationTime,
        helper: addressLine,
      },
      {
        label: 'Service / Price',
        value: bookingServiceOptionLabel(booking),
        helper: financeTrace.customerPrice,
      },
      {
        label: 'Settlement',
        value: financeTrace.providerNet,
        helper: `${financeTrace.platformFee} platform fee / ${financeTrace.withholding} tax`,
      },
      {
        label: 'Updates',
        value: countLabel(messageCount, 'chat message'),
        helper: `${bookingUnifiedStatusLabel(booking)} / ${booking.status}`,
      },
    ],
  };
}

function bookingUnifiedCustomerRows({
  addressLine,
  addressPin,
  booking,
}: {
  readonly addressLine: string;
  readonly addressPin: string;
  readonly booking: AdminBookingDetail;
}): BookingUnifiedDetailRow[] {
  const customerProfileId = booking.customerProfile?.id;
  const actualLocation = customerActualLocationDetail(booking);

  return [
    {
      label: 'Request time',
      value: formatDate(bookingRequestOpenedAt(booking)),
      valueDateTimeValue: bookingRequestOpenedAt(booking),
      detail: 'Customer booking request opened.',
      variant: 'secondary',
    },
    {
      label: 'Customer',
      value: booking.customerProfile?.user?.fullName ?? 'Customer',
      detail: booking.customerProfile?.user?.phone ?? 'No phone',
      href: customerProfileId ? `/customers/${customerProfileId}` : undefined,
      person: {
        helper: booking.customerProfile?.user?.phone ?? 'No phone',
        href: customerProfileId ? `/customers/${customerProfileId}` : undefined,
        id: customerProfileId ?? 'customer',
        label: booking.customerProfile?.user?.fullName ?? 'Customer',
        status: bookingUserStatus(booking, 'customer'),
      },
    },
    {
      label: 'Device language',
      value: customerDeviceLanguage(booking),
      detail: 'Customer app session language.',
      variant: 'secondary',
    },
    {
      label: 'Service address',
      value: addressLine,
      detail: addressPin === 'No pin' ? 'Booking address snapshot.' : 'Booking address snapshot saved.',
    },
    {
      label: 'Live customer location',
      value: actualLocation.value,
      detail: actualLocation.detail,
      variant: 'secondary',
    },
    {
      label: 'Service request',
      value: bookingServiceOptionLabel(booking),
      detail: booking.notes ?? 'No customer note saved.',
    },
  ];
}

function bookingUnifiedMatchedPartnerRows({
  addressLine,
  booking,
  finalPartnerSummary,
  latestLocation,
  partnerHref,
}: {
  readonly addressLine: string;
  readonly booking: AdminBookingDetail;
  readonly finalPartnerSummary: BookingFinalPartnerSummary;
  readonly latestLocation?: AdminLocationSnapshot | null;
  readonly partnerHref?: string;
}): BookingUnifiedDetailRow[] {
  const selectedProvider = booking.selectedProvider ?? null;
  const participantPeople = bookingUnifiedParticipantPeople(booking);
  const latestPartnerLocation = providerLocationAddressDetail({
    addressLine,
    booking,
    latestLocation,
    selectedProvider,
  });
  const partnerLocationRows = bookingUnifiedPartnerLocationRows({
    addressLine,
    booking,
    latestLocation,
    selectedProvider,
  });

  return [
    bookingUnifiedRequestedPartnerRow(booking),
    {
      label: 'Matched',
      value: finalPartnerSummary.selected ? finalPartnerSummary.label : 'Not matched',
      detail: selectedProvider?.user?.phone ?? 'No matched Partner phone',
      href: partnerHref,
      person: finalPartnerSummary.selected
        ? {
            helper: selectedProvider?.user?.phone ?? 'No matched Partner phone',
            href: partnerHref,
            id: finalPartnerSummary.id ?? selectedProvider?.id ?? 'matched-partner',
            label: finalPartnerSummary.label,
            status: bookingUserStatus(booking, 'partner'),
          }
        : undefined,
    },
    {
      label: 'Profile',
      value: selectedProvider?.status ?? 'Unknown',
      detail: selectedProvider?.id
        ? `Partner ${shortId(selectedProvider.id)}`
        : 'No selected Partner profile.',
      variant: 'secondary',
    },
    {
      label: 'Match source',
      value: booking.matchSource ?? booking.matchingEvidence?.finalSelection ?? 'Not recorded',
      detail: formatDate(booking.matchedAt),
      detailDateTimeFallback: formatDate(booking.matchedAt),
      detailDateTimeValue: booking.matchedAt,
      variant: 'secondary',
    },
    ...partnerLocationRows,
    {
      label: 'Participating',
      value: `${participantPeople.length} Partner${participantPeople.length === 1 ? '' : 's'}`,
      detail:
        participantPeople.length > 0
          ? 'Partner rows that joined, accepted, or responded during matching.'
          : 'No Partner participation recorded yet.',
      people: participantPeople,
    },
    {
      label: 'Latest location',
      value: latestPartnerLocation.value,
      detail: latestPartnerLocation.detail,
      detailDateTimeFallback: latestPartnerLocation.detailDateTimeFallback,
      detailDateTimePrefix: latestPartnerLocation.detailDateTimePrefix,
      detailDateTimeSuffix: latestPartnerLocation.detailDateTimeSuffix,
      detailDateTimeValue: latestPartnerLocation.detailDateTimeValue,
      detailSecondDateTimeFallback: latestPartnerLocation.detailSecondDateTimeFallback,
      detailSecondDateTimePrefix: latestPartnerLocation.detailSecondDateTimePrefix,
      detailSecondDateTimeSuffix: latestPartnerLocation.detailSecondDateTimeSuffix,
      detailSecondDateTimeValue: latestPartnerLocation.detailSecondDateTimeValue,
      variant: 'secondary',
    },
  ];
}

function bookingUnifiedRequestedPartnerRow(booking: AdminBookingDetail): BookingUnifiedDetailRow {
  const requested = booking.preferredProvider ?? null;
  const requestedId = requested?.id ?? booking.preferredProviderId ?? null;

  return {
    label: 'Requested',
    value: requested ? providerName(requested) : 'No requested Partner',
    detail: requested?.user?.phone ?? 'No requested Partner phone',
    href: requestedId ? `/partners/${requestedId}` : undefined,
    person: requested
      ? {
          helper: requested.user?.phone ?? 'No requested Partner phone',
          href: requestedId ? `/partners/${requestedId}` : undefined,
          id: requestedId ?? 'requested-partner',
          label: providerName(requested),
          status:
            requestedId && requestedId === (booking.selectedProviderId ?? booking.selectedProvider?.id)
              ? 'working'
              : 'matching',
          statusLabel: 'Requested',
        }
      : undefined,
  };
}

function bookingUnifiedFinanceRows({
  booking,
  financeTrace,
}: {
  readonly booking: AdminBookingDetail;
  readonly financeTrace: BookingFinanceTrace;
}): BookingUnifiedDetailRow[] {
  const walletEntryCount =
    booking.walletLedgerEntries?.length ?? booking.earning?.walletLedgerEntries?.length ?? 0;
  const refundCount = booking.refunds?.length ?? booking.payment?.refunds?.length ?? 0;
  const refundAmount = booking.refunds?.reduce((sum, refund) => sum + Number(refund.amount ?? 0), 0);
  const paymentCurrency = booking.payment?.currency ?? financeTrace.currency;

  return [
    {
      label: 'Payment record',
      value: financeTrace.customerPrice,
      detail: `${financeTrace.paymentMethod} / ${booking.payment?.status ?? 'No payment'} / ref ${
        booking.payment?.providerRef ?? 'no provider ref'
      }`,
      href: booking.payment?.id ? `/payments/${booking.payment.id}` : undefined,
      variant: 'finance-highlight',
    },
    {
      label: 'Partner earning',
      value: financeTrace.providerPayout,
      detail: `${financeTrace.providerNet} / ${financeTrace.payoutRuleLine}`,
      href: booking.earning?.id ? `/earnings?bookingId=${booking.id}` : undefined,
      variant: 'finance-highlight',
    },
    {
      label: 'HANDS fee and costs',
      value: financeTrace.platformFee,
      detail: `${financeTrace.feeCosts} / ${financeTrace.netHandsFee} before withholding`,
      variant: 'finance-highlight',
    },
    {
      label: 'Service state',
      value: booking.status,
      detail: `Changed ${formatDate(booking.statusChangedAt ?? booking.updatedAt ?? null)}`,
      detailDateTimeFallback: formatDate(booking.statusChangedAt ?? booking.updatedAt ?? null),
      detailDateTimePrefix: 'Changed ',
      detailDateTimeValue: booking.statusChangedAt ?? booking.updatedAt ?? null,
      variant: 'secondary',
    },
    {
      label: 'Closeout decision',
      value: booking.closedReason ?? (booking.closedAt ? 'Closed' : 'Open'),
      detail: booking.closedNote ?? `Closeout time ${formatDate(booking.closedAt ?? null)}`,
      detailDateTimeFallback: booking.closedNote ? undefined : formatDate(booking.closedAt ?? null),
      detailDateTimePrefix: booking.closedNote ? undefined : 'Closeout time ',
      detailDateTimeValue: booking.closedNote ? null : booking.closedAt ?? null,
      variant: 'secondary',
    },
    {
      label: 'Pricing basis',
      value: financeTrace.pricingSource,
      detail: `${financeTrace.serviceOption} / min ${financeTrace.adminMinimum}`,
      variant: 'secondary',
    },
    {
      label: 'Tax withholding',
      value: financeTrace.withholding,
      detail: `${financeTrace.companyFeeAfterTax} company fee after tax`,
      variant: 'secondary',
    },
    {
      label: 'Wallet ledger',
      value: financeTrace.walletLedger,
      detail: `${walletEntryCount} ledger row(s) / Partner wallet impact`,
      variant: 'secondary',
    },
    {
      label: 'Refunds',
      value: `${refundCount}`,
      detail: `${money(refundAmount ?? 0, paymentCurrency)} refunded / payment amount ${money(
        booking.payment?.amount,
        paymentCurrency,
      )}`,
      variant: 'secondary',
    },
  ];
}

function bookingUnifiedStatusLabel(booking: AdminBookingDetail) {
  if (isPostMatchCancellationReviewBooking(booking)) {
    return isPostMatchCancellationManualReviewRequired(booking)
      ? 'Post-match cancellation review'
      : 'Post-match cancellation resolved';
  }

  if (booking.status === 'COMPLETED') {
    return 'Completed booking detail';
  }

  if (booking.status === 'IN_SERVICE' || booking.selectedProviderId) {
    return 'Post-match in progress detail';
  }

  return 'Realtime booking detail';
}

function bookingUnifiedStatusTone(status: string) {
  switch (status) {
    case 'COMPLETED':
      return 'pill-success';
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'pill-danger';
    case 'IN_SERVICE':
    case 'MATCHED':
      return 'pill-info';
    default:
      return 'pill-warn';
  }
}

function countLabel(count: number, singular: string) {
  if (count === 0) {
    return `No ${singular}s`;
  }

  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function customerDeviceLanguage(booking: AdminBookingDetail) {
  return (
    booking.customerProfile?.user?.appSessions?.find((session) => session.deviceLanguage)?.deviceLanguage ??
    'Unknown'
  );
}

function customerActualLocationDetail(booking: AdminBookingDetail) {
  if (
    booking.lat === undefined ||
    booking.lat === null ||
    booking.lng === undefined ||
    booking.lng === null
  ) {
    return {
      detail: 'Customer live position was not recorded for this booking request.',
      value: 'No live customer location',
    };
  }

  const distance = approximateDistanceMeters(
    booking.addressSnapshot?.latitude,
    booking.addressSnapshot?.longitude,
    booking.lat,
    booking.lng,
  );
  if (distance !== null) {
    return {
      detail: `Within ${distanceLabel(distance)} of the reservation address. Raw coordinates are hidden in the admin UI.`,
      value: 'Live customer location captured',
    };
  }

  return {
    detail: 'Separate from the reservation address. Raw coordinates are hidden in the admin UI.',
    value: 'Live customer location captured',
  };
}

function bookingUnifiedParticipantPeople(booking: AdminBookingDetail): BookingUnifiedDetailPerson[] {
  const selectedProviderId = booking.selectedProviderId ?? booking.selectedProvider?.id ?? null;
  const people: BookingUnifiedDetailPerson[] = [];

  for (const participant of booking.participants ?? []) {
    const profile = participant.providerProfile;
    const profileId = participant.providerProfileId ?? profile?.id;
    if (!profileId) {
      continue;
    }

    const label = providerName(profile);
    const responseLabel = participant.respondedAt
      ? `Responded ${formatDate(participant.respondedAt)}`
      : participant.joinedAt
        ? `Joined ${formatDate(participant.joinedAt)}`
        : 'No response time';
    const distance = distanceLabel(participant.distanceMeters);
    const statusLabel = bookingParticipantStatusLabel(participant.status, profileId === selectedProviderId);

    people.push({
      helper: `${statusLabel} / ${distance} / ${responseLabel}`,
      href: `/partners/${profileId}`,
      id: participant.id,
      label,
      status: bookingParticipantAvatarStatus(participant.status, profileId === selectedProviderId),
      statusLabel,
    });
  }

  return people;
}

function bookingParticipantStatusLabel(status: string, selected: boolean) {
  if (selected) {
    return 'Matched';
  }
  switch (status) {
    case 'ACCEPTED':
      return 'Accepted';
    case 'JOINED':
    case 'PENDING':
      return 'Waiting';
    case 'REJECTED':
      return 'Rejected';
    case 'EXPIRED':
      return 'Expired';
    default:
      return status;
  }
}

function bookingParticipantAvatarStatus(status: string, selected: boolean): AdminAvatarStatus {
  if (selected || status === 'SELECTED') {
    return 'working';
  }
  if (status === 'REJECTED' || status === 'EXPIRED' || status === 'CANCELLED') {
    return 'offline';
  }
  return 'matching';
}

function bookingUserStatus(booking: AdminBookingDetail, role: 'customer' | 'partner'): AdminAvatarStatus {
  if (booking.status === 'IN_SERVICE' || booking.status === 'MATCHED') {
    return 'working';
  }
  if (role === 'partner' && !booking.selectedProviderId && !booking.selectedProvider) {
    return 'offline';
  }
  if (!['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(booking.status)) {
    return 'matching';
  }
  return 'offline';
}

function bookingUnifiedPartnerLocationRows({
  addressLine,
  booking,
  latestLocation,
  selectedProvider,
}: {
  readonly addressLine: string;
  readonly booking: AdminBookingDetail;
  readonly latestLocation?: AdminLocationSnapshot | null;
  readonly selectedProvider: NonNullable<AdminBookingDetail['selectedProvider']> | null;
}): BookingUnifiedDetailRow[] {
  const snapshots = bookingUnifiedSelectedProviderLocationSnapshots({
    booking,
    latestLocation,
    selectedProvider,
  });
  const hasMatchedPartner = Boolean(booking.matchedAt || selectedProvider || booking.selectedProviderId);
  const hasCompletion = booking.status === 'COMPLETED';
  const hasPostMatchCancellation =
    isPostMatchCancellationReviewBooking(booking) ||
    ((booking.status === 'CANCELLED' || booking.status === 'NO_SHOW') && hasMatchedPartner);

  return [
    bookingUnifiedPartnerLocationCheckpointRow({
      addressLine,
      booking,
      eventAt: booking.matchedAt ?? booking.statusChangedAt ?? booking.createdAt,
      inactiveDetail: 'No matching location is available before a Partner is selected.',
      inactiveValue: 'Not matched yet',
      label: 'Matching location',
      selectedProvider,
      showCheckpoint: hasMatchedPartner,
      snapshots,
    }),
    bookingUnifiedPartnerLocationCheckpointRow({
      addressLine,
      booking,
      eventAt: booking.closedAt ?? booking.scheduledEndAt ?? booking.statusChangedAt ?? booking.updatedAt,
      inactiveDetail: 'The Partner has not completed this booking yet.',
      inactiveValue: 'Not completed',
      label: 'Completion location',
      selectedProvider,
      showCheckpoint: hasCompletion,
      snapshots,
    }),
    bookingUnifiedPartnerLocationCheckpointRow({
      addressLine,
      booking,
      eventAt: booking.closedAt ?? booking.statusChangedAt ?? booking.updatedAt,
      inactiveDetail: 'Only shown for post-match cancellation review.',
      inactiveValue: 'Not applicable',
      label: 'Cancellation location',
      selectedProvider,
      showCheckpoint: hasPostMatchCancellation,
      snapshots,
    }),
  ];
}

function bookingUnifiedPartnerLocationCheckpointRow({
  addressLine,
  booking,
  eventAt,
  inactiveDetail,
  inactiveValue,
  label,
  selectedProvider,
  showCheckpoint,
  snapshots,
}: {
  readonly addressLine: string;
  readonly booking: AdminBookingDetail;
  readonly eventAt?: string | null;
  readonly inactiveDetail: string;
  readonly inactiveValue: string;
  readonly label: string;
  readonly selectedProvider: NonNullable<AdminBookingDetail['selectedProvider']> | null;
  readonly showCheckpoint: boolean;
  readonly snapshots: readonly AdminLocationSnapshot[];
}): BookingUnifiedDetailRow {
  if (!showCheckpoint) {
    return {
      detail: inactiveDetail,
      label,
      value: inactiveValue,
      variant: 'inactive',
    };
  }

  const preferBookingActionSnapshot = label === 'Completion location' || label === 'Cancellation location';
  const snapshot = bookingUnifiedLocationSnapshotForEvent(
    snapshots,
    eventAt,
    preferBookingActionSnapshot ? booking.id : undefined,
  );
  const location = providerLocationCheckpointDetail({
    actionSnapshotLabel: preferBookingActionSnapshot,
    addressLine,
    booking,
    eventAt,
    selectedProvider,
    snapshot,
  });

  return {
    detail: location.detail,
    detailDateTimeFallback: location.detailDateTimeFallback,
    detailDateTimePrefix: location.detailDateTimePrefix,
    detailDateTimeSuffix: location.detailDateTimeSuffix,
    detailDateTimeValue: location.detailDateTimeValue,
    detailSecondDateTimeFallback: location.detailSecondDateTimeFallback,
    detailSecondDateTimePrefix: location.detailSecondDateTimePrefix,
    detailSecondDateTimeSuffix: location.detailSecondDateTimeSuffix,
    detailSecondDateTimeValue: location.detailSecondDateTimeValue,
    label,
    value: location.value,
    variant: 'secondary',
  };
}

function bookingUnifiedSelectedProviderLocationSnapshots({
  booking,
  latestLocation,
  selectedProvider,
}: {
  readonly booking: AdminBookingDetail;
  readonly latestLocation?: AdminLocationSnapshot | null;
  readonly selectedProvider: NonNullable<AdminBookingDetail['selectedProvider']> | null;
}) {
  const selectedProviderId = booking.selectedProviderId ?? selectedProvider?.id ?? null;
  const snapshots: AdminLocationSnapshot[] = [];

  snapshots.push(...(booking.snapshots ?? []));

  if (selectedProvider?.locationSnapshots) {
    snapshots.push(...selectedProvider.locationSnapshots);
  }

  for (const participant of booking.participants ?? []) {
    const participantProviderId = participant.providerProfileId ?? participant.providerProfile?.id ?? null;
    if (!selectedProviderId || participantProviderId === selectedProviderId) {
      snapshots.push(...(participant.providerProfile?.locationSnapshots ?? []));
    }
  }

  if (latestLocation) {
    snapshots.push(latestLocation);
  }

  const unique = new Map<string, AdminLocationSnapshot>();
  for (const snapshot of snapshots) {
    if (
      selectedProviderId &&
      snapshot.providerProfileId &&
      snapshot.providerProfileId !== selectedProviderId
    ) {
      continue;
    }
    unique.set(bookingUnifiedLocationSnapshotKey(snapshot), snapshot);
  }

  return [...unique.values()].sort(
    (left, right) => bookingUnifiedTimeValue(left.recordedAt) - bookingUnifiedTimeValue(right.recordedAt),
  );
}

function bookingUnifiedLocationSnapshotForEvent(
  snapshots: readonly AdminLocationSnapshot[],
  eventAt?: string | null,
  preferBookingId?: string,
) {
  if (snapshots.length === 0) {
    return null;
  }

  const eventTime = bookingUnifiedTimeValue(eventAt);
  if (!Number.isFinite(eventTime)) {
    return snapshots.at(-1) ?? null;
  }

  const beforeOrAt = snapshots.filter(
    (snapshot) => bookingUnifiedTimeValue(snapshot.recordedAt) <= eventTime,
  );
  const bookingLinkedBeforeOrAt = preferBookingId
    ? beforeOrAt.filter((snapshot) => snapshot.bookingId === preferBookingId)
    : [];
  const bookingLinkedAfter = preferBookingId
    ? snapshots.find(
        (snapshot) =>
          snapshot.bookingId === preferBookingId && bookingUnifiedTimeValue(snapshot.recordedAt) > eventTime,
      )
    : null;
  return (
    bookingLinkedBeforeOrAt.at(-1) ??
    bookingLinkedAfter ??
    beforeOrAt.at(-1) ??
    null
  );
}

function bookingUnifiedLocationSnapshotKey(snapshot: AdminLocationSnapshot) {
  return (
    snapshot.id || `${snapshot.providerProfileId}:${snapshot.recordedAt}:${snapshot.lat}:${snapshot.lng}`
  );
}

function bookingUnifiedTimeValue(value?: string | null) {
  if (!value) {
    return Number.NaN;
  }
  return new Date(value).getTime();
}

function providerLocationCheckpointDetail({
  actionSnapshotLabel,
  addressLine,
  booking,
  eventAt,
  selectedProvider,
  snapshot,
}: {
  readonly actionSnapshotLabel: boolean;
  readonly addressLine: string;
  readonly booking: AdminBookingDetail;
  readonly eventAt?: string | null;
  readonly selectedProvider: NonNullable<AdminBookingDetail['selectedProvider']> | null;
  readonly snapshot?: AdminLocationSnapshot | null;
}): BookingUnifiedLocationDetail {
  const checkpointMeta = providerLocationCheckpointMeta({
    actionSnapshotLabel,
    bookingId: booking.id,
    eventAt,
    snapshot,
  });
  if (!snapshot) {
    return {
      ...checkpointMeta,
      value: selectedProvider ? 'Location address not recorded' : 'No matched Partner location',
    };
  }

  const snapshotAddress = readAddressText(snapshot);

  if (snapshotAddress) {
    return {
      ...checkpointMeta,
      value: serviceAddressAreaLabel(snapshotAddress),
    };
  }

  const atReservationAddress = providerLocationAtReservationAddress({
    addressLine,
    booking,
    includeRecordedAt: false,
    latestLocation: snapshot,
    selectedProvider,
  });
  if (atReservationAddress) {
    return {
      ...providerLocationCheckpointDetailWithSuffix(checkpointMeta, atReservationAddress.detail),
      value: atReservationAddress.value,
    };
  }

  return {
    ...providerLocationCheckpointDetailWithSuffix(
      checkpointMeta,
      'Location coordinate recorded without readable address text',
    ),
    value: snapshot || selectedProvider ? 'Location address not recorded' : 'No matched Partner location',
  };
}

function providerLocationCheckpointMeta({
  actionSnapshotLabel,
  bookingId,
  eventAt,
  snapshot,
}: {
  readonly actionSnapshotLabel: boolean;
  readonly bookingId: string;
  readonly eventAt?: string | null;
  readonly snapshot?: AdminLocationSnapshot | null;
}): BookingUnifiedDetailDateMeta {
  const stateLabel = eventAt ? `State ${formatDate(eventAt)}` : 'State not recorded';
  if (!snapshot) {
    return {
      detail: `${stateLabel} / No linked Partner location`,
      detailDateTimeFallback: eventAt ? formatDate(eventAt) : undefined,
      detailDateTimePrefix: eventAt ? 'State ' : undefined,
      detailDateTimeSuffix: eventAt ? ' / No linked Partner location' : undefined,
      detailDateTimeValue: eventAt,
    };
  }

  const snapshotLabel = actionSnapshotLabel && snapshot.bookingId === bookingId ? 'Action' : 'Captured';
  if (!eventAt) {
    return {
      detail: `${stateLabel} / ${snapshotLabel} ${formatDate(snapshot.recordedAt)}`,
      detailDateTimeFallback: formatDate(snapshot.recordedAt),
      detailDateTimePrefix: `${stateLabel} / ${snapshotLabel} `,
      detailDateTimeValue: snapshot.recordedAt,
    };
  }

  return {
    detail: `${stateLabel} / ${snapshotLabel} ${formatDate(snapshot.recordedAt)}`,
    detailDateTimeFallback: formatDate(eventAt),
    detailDateTimePrefix: 'State ',
    detailDateTimeSuffix: ` / ${snapshotLabel} `,
    detailDateTimeValue: eventAt,
    detailSecondDateTimeFallback: formatDate(snapshot.recordedAt),
    detailSecondDateTimeValue: snapshot.recordedAt,
  };
}

function providerLocationCheckpointDetailWithSuffix(
  checkpointMeta: BookingUnifiedDetailDateMeta,
  suffix: string,
): BookingUnifiedDetailDateMeta {
  const detail = `${checkpointMeta.detail} / ${suffix}`;
  if (checkpointMeta.detailSecondDateTimeValue) {
    return {
      ...checkpointMeta,
      detail,
      detailSecondDateTimeSuffix: `${checkpointMeta.detailSecondDateTimeSuffix ?? ''} / ${suffix}`,
    };
  }

  if (checkpointMeta.detailDateTimeValue) {
    return {
      ...checkpointMeta,
      detail,
      detailDateTimeSuffix: `${checkpointMeta.detailDateTimeSuffix ?? ''} / ${suffix}`,
    };
  }

  return {
    ...checkpointMeta,
    detail,
  };
}

function providerLocationAddressDetail({
  addressLine,
  booking,
  latestLocation,
  selectedProvider,
}: {
  readonly addressLine: string;
  readonly booking: AdminBookingDetail;
  readonly latestLocation?: AdminLocationSnapshot | null;
  readonly selectedProvider: NonNullable<AdminBookingDetail['selectedProvider']> | null;
}): BookingUnifiedLocationDetail {
  const latestAddress = readAddressText(latestLocation);
  if (latestAddress) {
    return {
      detail: latestLocation
        ? `Recorded ${formatDate(latestLocation.recordedAt)}`
        : 'Latest Partner location address.',
      detailDateTimeFallback: latestLocation ? formatDate(latestLocation.recordedAt) : undefined,
      detailDateTimePrefix: latestLocation ? 'Recorded ' : undefined,
      detailDateTimeValue: latestLocation?.recordedAt,
      value: serviceAddressAreaLabel(latestAddress),
    };
  }

  const liveLocationAtReservationAddress = providerLocationAtReservationAddress({
    addressLine,
    booking,
    includeRecordedAt: true,
    latestLocation,
    selectedProvider,
  });
  if (liveLocationAtReservationAddress) {
    return liveLocationAtReservationAddress;
  }

  const hasProviderCoordinate =
    selectedProvider?.currentLat !== undefined &&
    selectedProvider.currentLat !== null &&
    selectedProvider?.currentLng !== undefined &&
    selectedProvider.currentLng !== null;

  return {
    detail: latestLocation
      ? `Recorded ${formatDate(latestLocation.recordedAt)}. Readable address was not recorded.`
      : hasProviderCoordinate
        ? 'Current live coordinate exists, but readable address was not recorded.'
        : selectedProvider
          ? 'Current live address was not recorded.'
          : 'No matched Partner location.',
    value:
      latestLocation || selectedProvider ? 'Location address not recorded' : 'No matched Partner location',
  };
}

function providerLocationAtReservationAddress({
  addressLine,
  booking,
  includeRecordedAt = true,
  latestLocation,
  selectedProvider,
}: {
  readonly addressLine: string;
  readonly booking: AdminBookingDetail;
  readonly includeRecordedAt?: boolean;
  readonly latestLocation?: AdminLocationSnapshot | null;
  readonly selectedProvider: NonNullable<AdminBookingDetail['selectedProvider']> | null;
}) {
  const address = readAddressText(addressLine);
  if (!address) {
    return null;
  }

  const lat = latestLocation?.lat ?? selectedProvider?.currentLat;
  const lng = latestLocation?.lng ?? selectedProvider?.currentLng;
  const reservationLat = booking.addressSnapshot?.latitude ?? booking.lat;
  const reservationLng = booking.addressSnapshot?.longitude ?? booking.lng;
  const distance = approximateDistanceMeters(reservationLat, reservationLng, lat, lng);
  if (distance === null || distance > 150) {
    return null;
  }

  return {
    detail: latestLocation
      ? includeRecordedAt
        ? `Latest Partner location is within ${distanceLabel(distance)} of the reservation address. Recorded ${formatDate(latestLocation.recordedAt)}`
        : `Latest Partner location is within ${distanceLabel(distance)} of the reservation address.`
      : `Partner profile location is within ${distanceLabel(distance)} of the reservation address.`,
    value: address,
  };
}
