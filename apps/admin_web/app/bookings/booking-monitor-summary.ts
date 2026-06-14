import type { BookingListStageKey } from '../../lib/booking-list-stage';

export type BookingMonitorSummaryRow = readonly [string, string];

export type BookingMonitorSummaryFact = {
  readonly addressNeedsOps: boolean;
  readonly backupSelected: boolean;
  readonly chatEvidenceNeedsOps: boolean;
  readonly chatRepairNeedsOps: boolean;
  readonly closeoutNeedsOps: boolean;
  readonly decisionEvidenceMissing: boolean;
  readonly firstPickPending: boolean;
  readonly highPriorityCheck: boolean;
  readonly locationNeedsOps: boolean;
  readonly marketplaceParticipantCount: number;
  readonly matchingChatReady: boolean;
  readonly participantCount: number;
  readonly paymentNeedsOps: boolean;
  readonly policySnapshotPresent: boolean;
  readonly pricingPolicyNeedsOps: boolean;
  readonly refundReviewNeedsOps: boolean;
  readonly stageKey: BookingListStageKey;
  readonly status: string;
};

export const activeBookingStatuses = new Set([
  'OPEN_MATCHING',
  'MATCHED',
  'PROVIDER_ON_THE_WAY',
  'ARRIVED',
  'IN_SERVICE',
]);

export function bookingMonitorSummaryRows(input: {
  bookings: readonly BookingMonitorSummaryFact[];
  blockedCreateAttemptCount: number;
}): BookingMonitorSummaryRow[] {
  const stageCounts = bookingStageCounts(input.bookings);
  const rows: Array<readonly [string, number]> = [
    ['Active bookings', countWhere(input.bookings, (booking) => activeBookingStatuses.has(booking.status))],
    ['Open matching', countWhere(input.bookings, (booking) => booking.status === 'OPEN_MATCHING')],
    ['Matched', countWhere(input.bookings, (booking) => booking.status === 'MATCHED')],
    ['Follow-up queue', countWhere(input.bookings, (booking) => booking.highPriorityCheck)],
    ['Blocked create attempts', input.blockedCreateAttemptCount],
    ['Stage 1 first-pick', stageCounts.get('first-pick') ?? 0],
    ['Stage 2 marketplace', stageCounts.get('marketplace') ?? 0],
    ['Stage 3 customer choice', stageCounts.get('customer-choice') ?? 0],
    ['Stage 4 handoff repair', stageCounts.get('handoff-repair') ?? 0],
    [
      'No Partners yet',
      countWhere(
        input.bookings,
        (booking) => booking.status === 'OPEN_MATCHING' && booking.participantCount === 0,
      ),
    ],
    ['First-pick pending', countWhere(input.bookings, (booking) => booking.firstPickPending)],
    [
      'Marketplace options',
      countWhere(
        input.bookings,
        (booking) => booking.status === 'OPEN_MATCHING' && booking.marketplaceParticipantCount > 0,
      ),
    ],
    ['Marketplace selected', countWhere(input.bookings, (booking) => booking.backupSelected)],
    ['Chat live', countWhere(input.bookings, (booking) => booking.matchingChatReady)],
    ['No-show', countWhere(input.bookings, (booking) => booking.status === 'NO_SHOW')],
    ['Expired', countWhere(input.bookings, (booking) => booking.status === 'EXPIRED')],
    ['Policy snapshots', countWhere(input.bookings, (booking) => booking.policySnapshotPresent)],
    ['Address checks', countWhere(input.bookings, (booking) => booking.addressNeedsOps)],
    ['Payment checks', countWhere(input.bookings, (booking) => booking.paymentNeedsOps)],
    ['Closeout checks', countWhere(input.bookings, (booking) => booking.closeoutNeedsOps)],
    ['Pricing checks', countWhere(input.bookings, (booking) => booking.pricingPolicyNeedsOps)],
    ['Location checks', countWhere(input.bookings, (booking) => booking.locationNeedsOps)],
    ['Chat repair', countWhere(input.bookings, (booking) => booking.chatRepairNeedsOps)],
    ['Chat evidence review', countWhere(input.bookings, (booking) => booking.chatEvidenceNeedsOps)],
    ['Evidence missing', countWhere(input.bookings, (booking) => booking.decisionEvidenceMissing)],
    ['Refund review', countWhere(input.bookings, (booking) => booking.refundReviewNeedsOps)],
  ];

  return rows.map(([label, value]): BookingMonitorSummaryRow => [label, value.toString()]);
}

function bookingStageCounts(bookings: readonly BookingMonitorSummaryFact[]) {
  return bookings.reduce((counts, booking) => {
    counts.set(booking.stageKey, (counts.get(booking.stageKey) ?? 0) + 1);
    return counts;
  }, new Map<BookingListStageKey, number>());
}

function countWhere<T>(items: readonly T[], predicate: (item: T) => boolean) {
  return items.filter(predicate).length;
}
