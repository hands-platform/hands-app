import type { AdminBooking } from '../../lib/admin-api';
import { marketplaceDisplayText as displayOperationalWording } from '../../lib/admin-copy';
import { formatMoney, formatRelativeTime } from '../../lib/admin-format';
import { LEGACY_OPERATIONAL_POLICY_KEYS, OPERATIONAL_POLICY_KEYS } from '../../lib/operations-policy';
import {
  bookingCustomerLabel,
  bookingPartnerLabel,
  bookingServiceLabel,
  bookingWalletLedgerTotal,
  byNewestBooking,
  shortId,
} from './policy-booking-format';
import { readBookingMatchingPolicySnapshot } from './policy-snapshot';
import { policyCountLabel } from './policy-copy';

type PolicyRelatedBookingPill = {
  readonly label: string;
  readonly className: string;
};

export type PolicyRelatedBookingRecord = {
  readonly id: string;
  readonly href: string;
  readonly title: string;
  readonly subtitle: string;
  readonly pills: readonly PolicyRelatedBookingPill[];
};

export type PolicyRelatedBookingRecordSet = {
  readonly title: string;
  readonly helper: string;
  readonly href: string;
  readonly emptyText: string;
  readonly recordCount: string;
  readonly rows: readonly PolicyRelatedBookingRecord[];
};

export function policyRelatedBookingRecords(
  key: string,
  bookings: readonly AdminBooking[],
): PolicyRelatedBookingRecordSet {
  const activeStatuses = ['OPEN_MATCHING', 'MATCHED', 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'IN_SERVICE'];
  const openMatching = bookings.filter((booking) => booking.status === 'OPEN_MATCHING');
  const acceptedButNotFinal = openMatching.filter(
    (booking) =>
      !booking.selectedProviderId && (booking.participants ?? []).some((item) => item.status === 'ACCEPTED'),
  );
  const marketplaceRows = openMatching.filter(
    (booking) =>
      (booking.participants?.length ?? 0) > 0 ||
      Boolean(readBookingMatchingPolicySnapshot(booking)) ||
      bookingHasCoordinate(booking),
  );
  const walletRows = bookings.filter((booking) => bookingWalletLedgerTotal(booking) < 0);
  const cancellationRows = bookings.filter(
    (booking) => booking.status === 'CANCELLED' || booking.closedReason?.toUpperCase().includes('CANCEL'),
  );
  const noShowRows = bookings.filter(
    (booking) => booking.status === 'NO_SHOW' || booking.closedReason?.toUpperCase().includes('NO_SHOW'),
  );
  const activeRows = bookings.filter((booking) => activeStatuses.includes(booking.status));

  if (key === 'matching.provider_response_window_minutes') {
    return policyRelatedBookingRecordSet({
      title: 'First-pick waiting records',
      helper:
        'Existing open bookings keep their saved expiry; new timer values affect the next booking only.',
      href: '/bookings?view=first-pick',
      emptyText: 'No first-pick waiting booking is currently loaded.',
      bookings: openMatching,
      recordCount: openMatching.length,
      pillBuilder: (booking) => [
        { label: booking.status, className: 'pill-warn' },
        {
          label: booking.expiresAt
            ? `expires ${formatRelativeTime(booking.expiresAt, { justNow: 'Just now', includeFuture: true })}`
            : 'no expiry',
          className: 'pill-info',
        },
        { label: policyCountLabel(booking.participants?.length ?? 0, 'participant row'), className: 'pill-neutral' },
      ],
    });
  }

  if (
    policyKeyMatches(key, [
      OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters,
      OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes,
      OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit,
      OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
      LEGACY_OPERATIONAL_POLICY_KEYS.marketplaceOpenMode,
    ])
  ) {
    return policyRelatedBookingRecordSet({
      title: 'Marketplace participation records',
      helper:
        'These bookings show the current marketplace lane, participant count, saved policy snapshot, or booking coordinate.',
      href: '/bookings?view=marketplace',
      emptyText: 'No marketplace participation booking is currently loaded.',
      bookings: marketplaceRows,
      recordCount: marketplaceRows.length,
      pillBuilder: (booking) => [
        { label: booking.status, className: booking.status === 'OPEN_MATCHING' ? 'pill-warn' : 'pill-info' },
        { label: policyCountLabel(booking.participants?.length ?? 0, 'participant'), className: 'pill-info' },
        {
          label: readBookingMatchingPolicySnapshot(booking) ? 'saved policy' : 'live sample',
          className: readBookingMatchingPolicySnapshot(booking) ? 'pill-success' : 'pill-neutral',
        },
      ],
    });
  }

  if (key === 'matching.preferred_accept_mode') {
    return policyRelatedBookingRecordSet({
      title: 'Customer fallback-choice records',
      helper:
        'Use this queue when first-pick does not validly win and the customer must choose from participating Partners.',
      href: '/bookings?view=customer-choice',
      emptyText: 'No accepted Partner is currently waiting for customer final choice.',
      bookings: acceptedButNotFinal,
      recordCount: acceptedButNotFinal.length,
      pillBuilder: (booking) => [
        { label: 'customer choice', className: 'pill-success' },
        { label: policyCountLabel(booking.participants?.length ?? 0, 'participant'), className: 'pill-info' },
        { label: booking.status, className: 'pill-warn' },
      ],
    });
  }

  if (key === 'wallet.negative_balance_gate') {
    return policyRelatedBookingRecordSet({
      title: 'Cash-fee debt records',
      helper: 'Negative wallet records can hold final acceptance, service start, or payout release.',
      href: '/cash-settlements',
      emptyText: 'No negative wallet booking record is currently loaded.',
      bookings: walletRows,
      recordCount: walletRows.length,
      pillBuilder: (booking) => [
        { label: formatMoney(Math.abs(bookingWalletLedgerTotal(booking))), className: 'pill-danger' },
        { label: booking.status, className: 'pill-info' },
        { label: 'marketplace gate check', className: 'pill-warn' },
      ],
    });
  }

  if (key === 'cancellation.after_match_policy') {
    return policyRelatedBookingRecordSet({
      title: 'Cancellation closeout records',
      helper:
        'Use these records to compare payment release, refund, chat evidence, and closeout reason handling.',
      href: '/bookings?view=closeout',
      emptyText: 'No cancelled booking record is currently loaded.',
      bookings: cancellationRows,
      recordCount: cancellationRows.length,
      pillBuilder: (booking) => [
        { label: booking.status, className: 'pill-warn' },
        { label: booking.closedByRole ?? 'no actor', className: 'pill-info' },
        { label: booking.closedReason ?? 'no reason', className: 'pill-neutral' },
      ],
    });
  }

  if (key === 'no_show.partner_report_policy') {
    return policyRelatedBookingRecordSet({
      title: 'No-show evidence records',
      helper: 'No-show remains an admin evidence review, not an automatic person judgment.',
      href: '/bookings?view=no-show',
      emptyText: 'No no-show closeout record is currently loaded.',
      bookings: noShowRows,
      recordCount: noShowRows.length,
      pillBuilder: (booking) => [
        { label: booking.status, className: 'pill-warn' },
        {
          label: booking.chatRoom?.id ? 'chat retained' : 'chat missing',
          className: booking.chatRoom?.id ? 'pill-success' : 'pill-danger',
        },
        { label: booking.closedReason ?? 'evidence review', className: 'pill-info' },
      ],
    });
  }

  if (key === 'notification.partner_alert_channel') {
    return policyRelatedBookingRecordSet({
      title: 'Alert-sensitive booking records',
      helper: 'Open and active bookings are the records most affected by Partner alert delivery changes.',
      href: '/notifications',
      emptyText: 'No active booking record is currently loaded for alert review.',
      bookings: activeRows,
      recordCount: activeRows.length,
      pillBuilder: (booking) => [
        { label: booking.status, className: 'pill-info' },
        {
          label: booking.chatRoom?.id ? 'chat room' : 'no chat yet',
          className: booking.chatRoom?.id ? 'pill-success' : 'pill-neutral',
        },
        { label: bookingPartnerLabel(booking), className: 'pill-neutral' },
      ],
    });
  }

  return policyRelatedBookingRecordSet({
    title: 'Active booking records',
    helper: 'Review active booking state before changing an enforced operating policy.',
    href: '/bookings',
    emptyText: 'No active booking record is currently loaded.',
    bookings: activeRows,
    recordCount: activeRows.length,
    pillBuilder: (booking) => [
      { label: booking.status, className: 'pill-info' },
      { label: bookingPartnerLabel(booking), className: 'pill-neutral' },
      {
        label: booking.expiresAt
          ? `expires ${formatRelativeTime(booking.expiresAt, { justNow: 'Just now', includeFuture: true })}`
          : 'no expiry',
        className: 'pill-info',
      },
    ],
  });
}

function policyRelatedBookingRecordSet(input: {
  readonly title: string;
  readonly helper: string;
  readonly href: string;
  readonly emptyText: string;
  readonly bookings: readonly AdminBooking[];
  readonly recordCount: number;
  readonly pillBuilder: (booking: AdminBooking) => PolicyRelatedBookingPill[];
}): PolicyRelatedBookingRecordSet {
  return {
    title: input.title,
    helper: input.helper,
    href: input.href,
    emptyText: input.emptyText,
    recordCount: policyCountLabel(input.recordCount, 'record'),
    rows: [...input.bookings]
      .sort(byNewestBooking)
      .slice(0, 3)
      .map<PolicyRelatedBookingRecord>((booking) => ({
        id: booking.id,
        href: `/bookings/${booking.id}`,
        title: displayOperationalWording(`${bookingServiceLabel(booking)} / ${shortId(booking.id)}`),
        subtitle: displayOperationalWording(
          `${bookingCustomerLabel(booking)} / ${bookingPartnerLabel(booking)}`,
        ),
        pills: input.pillBuilder(booking).map((pill) => ({
          ...pill,
          label: displayOperationalWording(pill.label),
        })),
      })),
  };
}

function policyKeyMatches(key: string, candidates: readonly string[]) {
  return candidates.includes(key);
}

function bookingHasCoordinate(booking: AdminBooking) {
  const lat = readOptionalCoordinate(booking.lat, 90);
  const lng = readOptionalCoordinate(booking.lng, 180);
  return lat !== null && lng !== null;
}

function readOptionalCoordinate(value: unknown, maxAbs: number) {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) && Math.abs(parsed) <= maxAbs ? parsed : null;
}
