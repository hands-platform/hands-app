import type { AdminBooking } from '../../lib/admin-api';
import {
  buildBookingPostMatchCancellationBoard,
  isPostMatchCancellationManualReviewRequired,
  postMatchCancellationFeeState,
  postMatchCancellationResolution,
} from './booking-post-match-cancellations-model';

describe('buildBookingPostMatchCancellationBoard', () => {
  it('summarizes post-match cancellation review load and fee outcomes', () => {
    const nowMs = new Date('2026-06-19T12:00:00.000Z').getTime();
    const board = buildBookingPostMatchCancellationBoard(
      [
        bookingFixture({
          closedAt: '2026-06-19T08:10:00.000Z',
          closedReason: 'post_match_cancellation_approved',
          earning: { netAmount: 0, status: 'CANCELLED' },
          id: 'auto-approved',
          matchedAt: '2026-06-19T08:00:00.000Z',
        }),
        bookingFixture({
          closedAt: '2026-06-19T09:30:00.000Z',
          closedReason: 'partner_cancelled',
          earning: { netAmount: -30000, status: 'PENDING' },
          id: 'manual-pending',
          matchedAt: '2026-06-19T09:00:00.000Z',
        }),
        bookingFixture({
          closedAt: '2026-06-01T10:30:00.000Z',
          closedReason: 'post_match_cancellation_fee_held',
          earning: { netAmount: -30000, status: 'PENDING' },
          id: 'manual-held',
          matchedAt: '2026-06-01T10:00:00.000Z',
        }),
        bookingFixture({
          closedAt: '2026-05-29T10:30:00.000Z',
          closedReason: 'post_match_cancellation_approved',
          earning: { netAmount: 0, status: 'CANCELLED' },
          id: 'previous-month-approved',
          matchedAt: '2026-05-29T10:00:00.000Z',
        }),
        bookingFixture({
          closedAt: '2026-06-19T11:30:00.000Z',
          id: 'pre-match-cancelled',
          matchedAt: null,
          selectedProviderId: null,
        }),
      ],
      nowMs,
    );

    expect(board).toEqual({
      autoApprovedCount: 1,
      autoApprovalWindowCount: 1,
      feeHeldCount: 2,
      feeRestoredCount: 2,
      monthCount: 3,
      pendingManualReviewCount: 1,
      totalCount: 4,
    });
  });

  it('keeps pending manual review separate from approved and held resolutions', () => {
    const pending = bookingFixture({
      closedAt: '2026-06-19T09:30:00.000Z',
      closedReason: 'partner_cancelled',
      earning: { netAmount: -30000, status: 'PENDING' },
      id: 'pending',
      matchedAt: '2026-06-19T09:00:00.000Z',
    });
    const held = bookingFixture({
      closedAt: '2026-06-19T09:30:00.000Z',
      closedReason: 'post_match_cancellation_fee_held',
      earning: { netAmount: -30000, status: 'PENDING' },
      id: 'held',
      matchedAt: '2026-06-19T09:00:00.000Z',
    });

    expect(isPostMatchCancellationManualReviewRequired(pending)).toBe(true);
    expect(postMatchCancellationResolution(pending)).toBe('pending');
    expect(postMatchCancellationFeeState(pending)).toBe('held');
    expect(isPostMatchCancellationManualReviewRequired(held)).toBe(false);
    expect(postMatchCancellationResolution(held)).toBe('held');
    expect(postMatchCancellationFeeState(held)).toBe('held');
  });
});

function bookingFixture(input: {
  readonly closedAt: string;
  readonly closedReason?: string;
  readonly earning?: { readonly netAmount: number; readonly status: string };
  readonly id: string;
  readonly matchedAt: string | null;
  readonly selectedProviderId?: string | null;
}): AdminBooking {
  return {
    closedAt: input.closedAt,
    closedReason: input.closedReason ?? 'partner_cancelled',
    earning: input.earning ? { id: `${input.id}-earning`, ...input.earning } : null,
    id: input.id,
    matchedAt: input.matchedAt,
    selectedProviderId: input.selectedProviderId === undefined ? `${input.id}-partner` : input.selectedProviderId,
    status: 'CANCELLED',
    statusChangedAt: input.closedAt,
  } as unknown as AdminBooking;
}
