import { bookingRequestOpenedAt } from '../../../lib/admin-booking-time';
import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import {
  isPostMatchCancellationManualReviewRequired,
  isPostMatchCancellationReviewBooking,
  postMatchCancellationFeeState,
  postMatchCancellationMinutesAfterMatch,
  postMatchCancellationResolution,
} from '../booking-post-match-cancellations-model';
import type { BookingFinalPartnerSummary } from './booking-final-partner-summary';
import type { bookingFinanceTrace } from './booking-finance-trace';
import {
  bookingServiceOptionLabel,
  coordinateLabel,
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

export type BookingUnifiedDetailRow = {
  readonly label: string;
  readonly value: string;
  readonly detail?: string;
  readonly href?: string;
};

export type BookingUnifiedDetailTimelineItem = {
  readonly at: string;
  readonly detail: string;
  readonly lane: string;
  readonly status: string;
  readonly title: string;
  readonly tone: string;
};

export type BookingUnifiedDetail = {
  readonly customerRows: readonly BookingUnifiedDetailRow[];
  readonly financeRows: readonly BookingUnifiedDetailRow[];
  readonly matchedPartnerRows: readonly BookingUnifiedDetailRow[];
  readonly statusLabel: string;
  readonly statusTone: string;
  readonly summaryCards: readonly BookingUnifiedDetailCard[];
  readonly timelineItems: readonly BookingUnifiedDetailTimelineItem[];
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
        helper: `${bookingUnifiedTimelineItems({ booking, finalPartnerSummary }).length} booking event(s)`,
      },
    ],
    timelineItems: bookingUnifiedTimelineItems({ booking, finalPartnerSummary }),
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

  return [
    {
      label: 'Personal information',
      value: booking.customerProfile?.user?.fullName ?? 'Customer',
      detail: booking.customerProfile?.user?.phone ?? 'No phone',
      href: customerProfileId ? `/customers/${customerProfileId}` : undefined,
    },
    {
      label: 'Device language',
      value: customerDeviceLanguage(booking),
      detail: 'Latest known customer app session language.',
    },
    {
      label: 'Reservation address',
      value: addressLine,
      detail: 'Address selected for this service booking.',
    },
    {
      label: 'Reservation pin',
      value: addressPin,
      detail: 'Pinned service address snapshot saved at booking time.',
    },
    {
      label: 'Actual customer location',
      value: customerActualLocationLabel(booking),
      detail: 'Live/customer request coordinate, separate from the reservation address.',
    },
    {
      label: 'Service details',
      value: bookingServiceOptionLabel(booking),
      detail: booking.notes ?? 'No customer note saved.',
    },
  ];
}

function bookingUnifiedMatchedPartnerRows({
  booking,
  finalPartnerSummary,
  latestLocation,
  partnerHref,
}: {
  readonly booking: AdminBookingDetail;
  readonly finalPartnerSummary: BookingFinalPartnerSummary;
  readonly latestLocation?: AdminLocationSnapshot | null;
  readonly partnerHref?: string;
}): BookingUnifiedDetailRow[] {
  const selectedProvider = booking.selectedProvider ?? null;

  return [
    {
      label: 'Matched Partner',
      value: finalPartnerSummary.selected ? finalPartnerSummary.label : 'Not matched',
      detail: selectedProvider?.user?.phone ?? 'No matched Partner phone',
      href: partnerHref,
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
      value: `${booking.participants?.length ?? 0}`,
      detail: 'Partner rows that joined or responded during matching.',
    },
    {
      label: 'Latest Partner location',
      value: latestLocation
        ? coordinateLabel(latestLocation.lat, latestLocation.lng)
        : providerCurrentLocationLabel(selectedProvider),
      detail: latestLocation
        ? `Recorded ${formatDate(latestLocation.recordedAt)}`
        : 'Uses current profile coordinate when no snapshot exists.',
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

function bookingUnifiedTimelineItems({
  booking,
  finalPartnerSummary,
}: {
  readonly booking: AdminBookingDetail;
  readonly finalPartnerSummary: BookingFinalPartnerSummary;
}): BookingUnifiedDetailTimelineItem[] {
  const items: BookingUnifiedDetailTimelineItem[] = [
    {
      at: formatDate(bookingRequestOpenedAt(booking)),
      detail: 'Reservation request entered the realtime booking queue.',
      lane: 'Realtime Bookings',
      status: 'Created',
      title: 'Reservation request opened',
      tone: 'pill-info',
    },
  ];

  if (booking.status === 'OPEN_MATCHING' || (booking.participants?.length ?? 0) > 0) {
    items.push({
      at: formatDate(booking.updatedAt ?? booking.createdAt ?? null),
      detail: `${booking.participants?.length ?? 0} participating Partner(s) recorded.`,
      lane: 'Realtime Bookings',
      status: 'Matching wait',
      title: 'Matching participation updated',
      tone: 'pill-warn',
    });
  }

  if (finalPartnerSummary.selected) {
    items.push({
      at: formatDate(booking.matchedAt ?? booking.statusChangedAt ?? null),
      detail: `${finalPartnerSummary.label} is the actual matched Partner.`,
      lane: 'Post-match / In Progress',
      status: booking.status === 'IN_SERVICE' ? 'Working' : 'Matched',
      title: 'Partner matched',
      tone: 'pill-info',
    });
  }

  if (booking.status === 'IN_SERVICE') {
    items.push({
      at: formatDate(booking.statusChangedAt ?? booking.updatedAt ?? null),
      detail: 'Service is active until completion, no-show, or Partner cancellation.',
      lane: 'Post-match / In Progress',
      status: 'In progress',
      title: 'Service is in progress',
      tone: 'pill-info',
    });
  }

  if (booking.status === 'COMPLETED') {
    items.push({
      at: formatDate(booking.closedAt ?? booking.statusChangedAt ?? booking.updatedAt ?? null),
      detail: 'Booking reached completed state and can be reviewed for final closeout.',
      lane: 'Completed',
      status: 'Completed',
      title: 'Service completed',
      tone: 'pill-success',
    });
  }

  if (isPostMatchCancellationReviewBooking(booking)) {
    const resolution = postMatchCancellationResolution(booking);
    const feeState = postMatchCancellationFeeState(booking);
    const minutesAfterMatch = postMatchCancellationMinutesAfterMatch(booking);
    const needsReview = isPostMatchCancellationManualReviewRequired(booking);

    items.push({
      at: formatDate(booking.closedAt ?? booking.statusChangedAt ?? booking.updatedAt ?? null),
      detail: `${minutesAfterMatch ?? '-'} min after match / fee ${feeState}`,
      lane: needsReview
        ? 'Post-match Cancellations / Needs Review'
        : 'Post-match Cancellations / Resolved',
      status: resolution,
      title: needsReview ? 'Cancellation needs admin review' : 'Cancellation decision recorded',
      tone: needsReview ? 'pill-warn' : resolution === 'approved' ? 'pill-success' : 'pill-danger',
    });
  }

  return items.sort((left, right) => safeTime(left.at) - safeTime(right.at));
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

function providerCurrentLocationLabel(
  provider: NonNullable<AdminBookingDetail['selectedProvider']> | null,
) {
  if (!provider) {
    return 'No matched Partner location';
  }

  return coordinateLabel(provider.currentLat, provider.currentLng);
}

function safeTime(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}
