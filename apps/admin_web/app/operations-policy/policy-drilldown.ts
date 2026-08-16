import type { AdminBooking, AdminOperationalPolicySetting } from '../../lib/admin-api';
import { formatMoney, formatRelativeTime } from '../../lib/admin-format';
import {
  bookingCustomerLabel,
  bookingPartnerLabel,
  bookingServiceLabel,
  bookingWalletLedgerTotal,
  byNewestBooking,
  shortId,
} from './policy-booking-format';
import type { PolicyDrilldownListView, PolicyDrilldownRow } from './operations-policy-drilldown-section';
import { bookingPolicySnapshotDrift } from './policy-snapshot';
import { policyCountLabel } from './policy-copy';

export function buildPolicyDrilldown(
  bookings: readonly AdminBooking[],
  settings: AdminOperationalPolicySetting[],
) {
  const openMatchingRows = buildOpenMatchingRows(bookings);
  const driftRows = buildSnapshotDriftRows(bookings, settings);
  const walletRows = buildWalletGateRows(bookings);

  const lists: PolicyDrilldownListView[] = [
    {
      key: 'open-matching',
      title: 'Open matching queue',
      helper: 'Bookings currently waiting for first-pick and marketplace Partner decisions.',
      className: openMatchingRows.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: openMatchingRows.length ? 'pill-warn' : 'pill-success',
      emptyText: 'No open matching booking needs policy review right now.',
      rows: openMatchingRows,
    },
    {
      key: 'snapshot-drift',
      title: 'Snapshot drift',
      helper: 'Bookings whose saved policy snapshot differs from the current Admin policy.',
      className: driftRows.length ? 'ops-task-pending' : 'ops-task-done',
      pillClass: driftRows.length ? 'pill-warn' : 'pill-success',
      emptyText: 'No sampled booking has policy drift.',
      rows: driftRows,
    },
    {
      key: 'wallet-gate',
      title: 'Wallet gate queue',
      helper:
        'Partners with negative recent wallet impact entries that may hold final acceptance, service start, or payout release.',
      className: walletRows.length ? 'ops-task-blocked' : 'ops-task-done',
      pillClass: walletRows.length ? 'pill-danger' : 'pill-success',
      emptyText: 'No negative recent wallet impact was found in the current booking sample.',
      rows: walletRows,
    },
  ];

  return {
    totalCount: lists.reduce((total, list) => total + list.rows.length, 0),
    lists,
  };
}

function buildOpenMatchingRows(bookings: readonly AdminBooking[]): PolicyDrilldownRow[] {
  return bookings
    .filter((booking) => booking.status === 'OPEN_MATCHING')
    .sort(byNewestBooking)
    .slice(0, 6)
    .map((booking) => {
      const participantCount = booking.participants?.length ?? 0;
      return {
        id: booking.id,
        href: `/bookings/${booking.id}`,
        title: `${bookingServiceLabel(booking)} / ${shortId(booking.id)}`,
        subtitle: `${bookingPartnerLabel(booking)} / ${bookingCustomerLabel(booking)}`,
        pills: [
          { label: booking.status, className: 'pill-warn' },
          {
            label: policyCountLabel(participantCount, 'participant'),
            className: participantCount ? 'pill-info' : 'pill-neutral',
          },
          {
            label: booking.expiresAt
              ? `expires ${formatRelativeTime(booking.expiresAt, { justNow: 'Just now', includeFuture: true })}`
              : 'no expiry',
            className: 'pill-info',
          },
        ],
        operatorAction:
          'Review this booking before changing response-window, marketplace-radius, or marketplace-open policy.',
      };
    });
}

function buildSnapshotDriftRows(
  bookings: readonly AdminBooking[],
  settings: AdminOperationalPolicySetting[],
): PolicyDrilldownRow[] {
  return bookings
    .map((booking) => ({ booking, drift: bookingPolicySnapshotDrift(booking, settings) }))
    .filter(({ drift }) => drift.length > 0)
    .sort((left, right) => byNewestBooking(left.booking, right.booking))
    .slice(0, 6)
    .map(({ booking, drift }) => ({
      id: booking.id,
      href: `/bookings/${booking.id}`,
      title: `${bookingServiceLabel(booking)} / ${shortId(booking.id)}`,
      subtitle: `${booking.status} / ${bookingPartnerLabel(booking)}`,
      pills: drift.slice(0, 3).map((item) => ({
        label: item.label,
        className: 'pill-warn',
      })),
      operatorAction:
        drift.length > 3
          ? `${drift.length} policy values differ. Use the booking detail snapshot before manual action.`
          : 'Saved booking policy differs from live policy. Check the booking detail snapshot first.',
    }));
}

function buildWalletGateRows(bookings: readonly AdminBooking[]): PolicyDrilldownRow[] {
  return bookings
    .map((booking) => ({ booking, recentWalletTotal: bookingWalletLedgerTotal(booking) }))
    .filter(({ recentWalletTotal }) => recentWalletTotal < 0)
    .sort((left, right) => left.recentWalletTotal - right.recentWalletTotal)
    .slice(0, 6)
    .map(({ booking, recentWalletTotal }) => ({
      id: booking.id,
      href: `/bookings/${booking.id}`,
      title: `${bookingPartnerLabel(booking)} / ${shortId(booking.id)}`,
      subtitle: `${bookingServiceLabel(booking)} / ${booking.payment?.method ?? 'payment unknown'}`,
      pills: [
        { label: formatMoney(recentWalletTotal), className: 'pill-danger' },
        { label: booking.payment?.status ?? 'payment unknown', className: 'pill-warn' },
        { label: booking.status, className: 'pill-neutral' },
      ],
      operatorAction:
        'Recent wallet entries are negative. Confirm settlement before final acceptance, service start, or payout release.',
    }));
}
