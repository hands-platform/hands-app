import type { AdminBooking } from '../../lib/admin-api';
import {
  buildBookingPostMatchCancellationBoard,
  isPostMatchCancellationAutoApproved,
  isPostMatchCancellationManualReviewRequired,
  postMatchCancellationDecisionSource,
  postMatchCancellationDecisionAt,
  postMatchCancellationDecisionSla,
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
          metadata: { postMatchCancellation: { autoApproved: true } },
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
          closedByRole: 'ADMIN',
        }),
        bookingFixture({
          closedAt: '2026-05-29T10:30:00.000Z',
          closedReason: 'post_match_cancellation_approved',
          earning: { netAmount: 0, status: 'CANCELLED' },
          id: 'previous-month-approved',
          matchedAt: '2026-05-29T10:00:00.000Z',
          closedByRole: 'ADMIN',
        }),
        bookingFixture({
          closedAt: '2026-06-19T11:30:00.000Z',
          id: 'pre-match-cancelled',
          matchedAt: null,
          selectedProviderId: null,
        }),
        bookingFixture({
          closedAt: '2026-06-19T11:45:00.000Z',
          id: 'no-show-after-match',
          matchedAt: '2026-06-19T11:30:00.000Z',
          status: 'NO_SHOW',
        }),
      ],
      nowMs,
    );

    expect(board).toEqual({
      autoApprovedCount: 1,
      autoApprovalWindowCount: 1,
      feeHeldCount: 2,
      feeRestoredCount: 2,
      monthCount: 4,
      pendingManualReviewCount: 2,
      totalCount: 5,
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
      closedByRole: 'ADMIN',
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

  it('keeps non-customer reasons in manual review inside the legacy timing window', () => {
    const booking = bookingFixture({
      closedAt: '2026-06-19T09:05:00.000Z',
      closedReason: 'post_match_cancellation_partner_pending',
      earning: { netAmount: -30000, status: 'PENDING' },
      id: 'customer-not-found',
      matchedAt: '2026-06-19T09:00:00.000Z',
      metadata: {
        postMatchCancellation: {
          reasonCode: 'CUSTOMER_NOT_FOUND',
          requiresAdminReview: true,
        },
      },
    });

    expect(isPostMatchCancellationManualReviewRequired(booking)).toBe(true);
  });

  it('uses only explicit persisted facts for decision source classification', () => {
    const inferredOnly = bookingFixture({
      closedAt: '2026-06-19T09:05:00.000Z',
      closedReason: 'partner_cancelled',
      earning: { netAmount: 0, status: 'CANCELLED' },
      id: 'legacy',
      matchedAt: '2026-06-19T09:00:00.000Z',
    });
    const auto = bookingFixture({
      closedAt: '2026-06-19T09:05:00.000Z',
      closedReason: 'post_match_cancellation_approved',
      id: 'auto',
      matchedAt: '2026-06-19T09:00:00.000Z',
      metadata: { postMatchCancellation: { autoApproved: true } },
    });

    expect(postMatchCancellationDecisionSource(inferredOnly)).toBe('legacy');
    expect(postMatchCancellationResolution(inferredOnly)).toBe('legacy');
    expect(isPostMatchCancellationAutoApproved(inferredOnly)).toBe(false);
    expect(postMatchCancellationDecisionSource(auto)).toBe('auto-resolved');
    expect(isPostMatchCancellationAutoApproved(auto)).toBe(true);
  });

  it('uses decisionAt and the shared two-hour cancellation SLA', () => {
    const booking = bookingFixture({
      closedAt: '2026-06-19T09:00:00.000Z',
      id: 'overdue',
      matchedAt: '2026-06-19T08:30:00.000Z',
    });

    expect(postMatchCancellationDecisionSla(booking, new Date('2026-06-19T11:00:00.000Z').getTime()))
      .toEqual({ ageMinutes: 120, label: 'Overdue', overdue: true });
  });

  it('uses the admin audit event as the decision timestamp without changing the review clock', () => {
    const booking = {
      ...bookingFixture({
        closedAt: '2026-06-19T09:00:00.000Z',
        closedByRole: 'ADMIN',
        closedReason: 'post_match_cancellation_approved',
        id: 'resolved',
        matchedAt: '2026-06-19T08:30:00.000Z',
      }),
      auditLogs: [
        {
          action: 'booking.post_match_cancellation.approve',
          createdAt: '2026-06-19T10:15:00.000Z',
          id: 'audit-1',
          metadata: { previousClosedByRole: 'PROVIDER' },
          target: 'booking:resolved',
        },
      ],
    };

    expect(postMatchCancellationDecisionAt(booking)).toBe('2026-06-19T10:15:00.000Z');
    expect(postMatchCancellationDecisionSla(booking, new Date('2026-06-19T11:00:00.000Z').getTime()))
      .toEqual({ ageMinutes: 120, label: 'Overdue', overdue: true });
  });
});

function bookingFixture(input: {
  readonly closedAt: string;
  readonly closedReason?: string;
  readonly closedByRole?: string;
  readonly earning?: { readonly netAmount: number; readonly status: string };
  readonly id: string;
  readonly matchedAt: string | null;
  readonly metadata?: unknown;
  readonly selectedProviderId?: string | null;
  readonly status?: string;
}): AdminBooking {
  return {
    closedAt: input.closedAt,
    closedReason: input.closedReason ?? 'partner_cancelled',
    closedByRole: input.closedByRole ?? 'PROVIDER',
    earning: input.earning ? { id: `${input.id}-earning`, ...input.earning } : null,
    id: input.id,
    matchedAt: input.matchedAt,
    metadata: input.metadata,
    selectedProviderId: input.selectedProviderId === undefined ? `${input.id}-partner` : input.selectedProviderId,
    status: input.status ?? 'CANCELLED',
    statusChangedAt: input.closedAt,
  } as unknown as AdminBooking;
}
