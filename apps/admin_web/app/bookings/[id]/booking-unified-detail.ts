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
  coordinateLabel,
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
  readonly detail?: string;
  readonly href?: string;
  readonly people?: readonly BookingUnifiedDetailPerson[];
  readonly person?: BookingUnifiedDetailPerson;
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
        value: `${messageCount} chat message(s)`,
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
      label: 'Personal information',
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
    },
    {
      label: 'Reservation address',
      value: addressLine,
      detail:
        addressPin === 'No pin'
          ? 'Booking address snapshot.'
          : `Booking address snapshot. Pin ${addressPin}`,
    },
    {
      label: 'Actual customer location',
      value: actualLocation.value,
      detail: actualLocation.detail,
    },
    {
      label: 'Service details',
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

  return [
    {
      label: 'Matched Partner',
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
      label: 'Profile status',
      value: selectedProvider?.status ?? 'Unknown',
      detail: selectedProvider?.id ? `Partner ${shortId(selectedProvider.id)}` : 'No selected Partner profile.',
    },
    {
      label: 'Match source',
      value: booking.matchSource ?? booking.matchingEvidence?.finalSelection ?? 'Not recorded',
      detail: formatDate(booking.matchedAt),
    },
    {
      label: 'Preferred Partner',
      value: providerName(booking.preferredProvider),
      detail: booking.preferredProvider?.user?.phone ?? 'No preferred Partner phone',
      href: booking.preferredProvider?.id ? `/partners/${booking.preferredProvider.id}` : undefined,
    },
    {
      label: 'Participating Partners',
      value: `${participantPeople.length} Partner${participantPeople.length === 1 ? '' : 's'}`,
      detail:
        participantPeople.length > 0
          ? 'Partner rows that joined, accepted, or responded during matching.'
          : 'No Partner participation recorded yet.',
      people: participantPeople,
    },
    {
      label: 'Latest Partner location',
      value: latestPartnerLocation.value,
      detail: latestPartnerLocation.detail,
    },
  ];
}

function bookingUnifiedFinanceRows({
  booking,
  financeTrace,
}: {
  readonly booking: AdminBookingDetail;
  readonly financeTrace: BookingFinanceTrace;
}): BookingUnifiedDetailRow[] {
  return [
    {
      label: 'Service state',
      value: booking.status,
      detail: `Changed ${formatDate(booking.statusChangedAt ?? booking.updatedAt ?? null)}`,
    },
    {
      label: 'Service end',
      value: formatDate(booking.closedAt ?? booking.scheduledEndAt ?? null),
      detail: booking.closedReason ?? booking.closedNote ?? 'No closure note.',
    },
    {
      label: 'Customer charge',
      value: financeTrace.customerPrice,
      detail: `${financeTrace.paymentMethod} / ${booking.payment?.status ?? 'No payment'}`,
      href: booking.payment?.id ? `/payments/${booking.payment.id}` : undefined,
    },
    {
      label: 'Partner payout',
      value: financeTrace.providerPayout,
      detail: financeTrace.providerNet,
      href: booking.earning?.id ? `/earnings?bookingId=${booking.id}` : undefined,
    },
    {
      label: 'HANDS fee',
      value: financeTrace.platformFee,
      detail: `${financeTrace.feeCosts} / ${financeTrace.netHandsFee} before withholding`,
    },
    {
      label: 'Tax',
      value: financeTrace.withholding,
      detail: `${financeTrace.companyFeeAfterTax} company fee after tax`,
    },
    {
      label: 'Wallet ledger',
      value: financeTrace.walletLedger,
      detail: `${booking.walletLedgerEntries?.length ?? booking.earning?.walletLedgerEntries?.length ?? 0} ledger row(s)`,
    },
    {
      label: 'Refunds',
      value: `${booking.refunds?.length ?? booking.payment?.refunds?.length ?? 0}`,
      detail: `Payment amount ${money(booking.payment?.amount, booking.payment?.currency)}`,
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

function customerDeviceLanguage(booking: AdminBookingDetail) {
  return (
    booking.customerProfile?.user?.appSessions?.find((session) => session.deviceLanguage)
      ?.deviceLanguage ?? 'Unknown'
  );
}

function customerActualLocationLabel(booking: AdminBookingDetail) {
  if (booking.lat === undefined || booking.lat === null || booking.lng === undefined || booking.lng === null) {
    return 'No live customer location';
  }

  return coordinateLabel(booking.lat, booking.lng);
}

function customerActualLocationDetail(booking: AdminBookingDetail) {
  const pin = customerActualLocationLabel(booking);
  if (pin === 'No live customer location') {
    return {
      detail: 'Customer live position was not recorded for this booking request.',
      value: pin,
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
      detail: `Within ${distanceLabel(distance)} of the reservation address. Pin ${pin}`,
      value: 'Live customer location captured',
    };
  }

  return {
    detail: `Separate from the reservation address. Pin ${pin}`,
    value: 'Live customer location captured',
  };
}

function providerCurrentLocationLabel(
  provider: NonNullable<AdminBookingDetail['selectedProvider']> | null,
) {
  if (!provider) {
    return 'No matched Partner location';
  }

  return coordinateLabel(provider.currentLat, provider.currentLng);
}

type BookingUnifiedProviderProfile =
  | NonNullable<NonNullable<AdminBookingDetail['participants']>[number]['providerProfile']>
  | NonNullable<AdminBookingDetail['selectedProvider']>;

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
}) {
  const latestAddress = readAddressText(latestLocation);
  if (latestAddress) {
    return {
      detail: latestLocation
        ? `Recorded ${formatDate(latestLocation.recordedAt)}`
        : 'Latest Partner location address.',
      value: serviceAddressAreaLabel(latestAddress),
    };
  }

  const liveLocationAtReservationAddress = providerLocationAtReservationAddress({
    addressLine,
    booking,
    latestLocation,
    selectedProvider,
  });
  if (liveLocationAtReservationAddress) {
    return liveLocationAtReservationAddress;
  }

  const profileAddress = providerProfileAddressLabel(selectedProvider);
  const pin = latestLocation
    ? coordinateLabel(latestLocation.lat, latestLocation.lng)
    : providerCurrentLocationLabel(selectedProvider);

  if (profileAddress) {
    return {
      detail: latestLocation
        ? `Latest live address was not recorded. Pin ${pin} / recorded ${formatDate(latestLocation.recordedAt)}`
        : `Current live address was not recorded. Profile coordinate ${pin}`,
      value: profileAddress,
    };
  }

  return {
    detail: latestLocation
      ? `Pin ${pin} / recorded ${formatDate(latestLocation.recordedAt)}`
      : `Profile coordinate ${pin}`,
    value: latestLocation || selectedProvider ? 'Location address not recorded' : 'No matched Partner location',
  };
}

function providerLocationAtReservationAddress({
  addressLine,
  booking,
  latestLocation,
  selectedProvider,
}: {
  readonly addressLine: string;
  readonly booking: AdminBookingDetail;
  readonly latestLocation?: AdminLocationSnapshot | null;
  readonly selectedProvider: NonNullable<AdminBookingDetail['selectedProvider']> | null;
}) {
  const address = readAddressText(addressLine);
  if (!address) {
    return null;
  }

  const lat = latestLocation?.lat ?? selectedProvider?.currentLat;
  const lng = latestLocation?.lng ?? selectedProvider?.currentLng;
  const distance = approximateDistanceMeters(booking.lat, booking.lng, lat, lng);
  if (distance === null || distance > 150) {
    return null;
  }

  return {
    detail: latestLocation
      ? `Latest Partner location is within ${distanceLabel(distance)} of the reservation address. Recorded ${formatDate(latestLocation.recordedAt)}`
      : `Partner profile location is within ${distanceLabel(distance)} of the reservation address.`,
    value: address,
  };
}

function providerProfileAddressLabel(provider: BookingUnifiedProviderProfile | null) {
  if (!provider) {
    return null;
  }

  const record = provider as BookingUnifiedProviderProfile & {
    readonly city?: string | null;
    readonly residentialAddress?: unknown;
    readonly serviceArea?: unknown;
  };
  const address =
    readAddressText(record.residentialAddress) ??
    readAddressText(record.serviceArea) ??
    readAddressText(record.city);

  return address ? serviceAddressAreaLabel(address) : null;
}
