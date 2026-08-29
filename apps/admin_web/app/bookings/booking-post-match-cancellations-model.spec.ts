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
  postMatchCancellationTimeDisplay,
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

  it('uses the SLA review clock for open timestamps and waiting ages', () => {
    const nowMs = new Date('2026-06-20T10:00:00.000Z').getTime();
    const twentyFiveHours = bookingFixture({
      closedAt: '2026-06-19T09:00:00.000Z',
      id: 'open-25-hours',
      matchedAt: '2026-06-19T08:30:00.000Z',
    });
    const sevenDays = bookingFixture({
      closedAt: '2026-06-13T10:00:00.000Z',
      id: 'open-seven-days',
      matchedAt: '2026-06-13T09:30:00.000Z',
    });

    expect(postMatchCancellationTimeDisplay(twentyFiveHours, nowMs)).toEqual({
      ageLabel: 'Waiting',
      ageMinutes: 25 * 60,
      timestamp: '2026-06-19T09:00:00.000Z',
      timestampLabel: 'Review started',
    });
    expect(postMatchCancellationTimeDisplay(sevenDays, nowMs).ageMinutes).toBe(7 * 24 * 60);
    expect(postMatchCancellationDecisionSla(twentyFiveHours, nowMs).label).toBe('Overdue');
  });

  it('uses the audit time for admin decisions and persisted fallbacks for other resolutions', () => {
    const nowMs = new Date('2026-06-20T10:00:00.000Z').getTime();
    const adminResolved = {
      ...bookingFixture({
        closedAt: '2026-06-19T09:00:00.000Z',
        closedByRole: 'ADMIN',
        closedReason: 'post_match_cancellation_approved',
        id: 'admin-resolved',
        matchedAt: '2026-06-19T08:30:00.000Z',
      }),
      auditLogs: [
        {
          action: 'booking.post_match_cancellation.approve',
          createdAt: '2026-06-19T10:15:00.000Z',
          id: 'audit-admin-resolved',
          metadata: null,
          target: 'booking:admin-resolved',
        },
      ],
    };
    const autoResolved = bookingFixture({
      closedAt: 'invalid',
      closedReason: 'post_match_cancellation_approved',
      id: 'auto-resolved',
      matchedAt: '2026-06-19T08:30:00.000Z',
      metadata: { postMatchCancellation: { autoApproved: true } },
      updatedAt: '2026-06-19T11:00:00.000Z',
    });

    expect(postMatchCancellationTimeDisplay(adminResolved, nowMs)).toMatchObject({
      ageLabel: 'Resolved',
      timestamp: '2026-06-19T10:15:00.000Z',
      timestampLabel: 'Decided at',
    });
    const adminWithoutAudit = bookingFixture({
      closedAt: '2026-06-19T09:00:00.000Z',
      closedByRole: 'ADMIN',
      closedReason: 'post_match_cancellation_approved',
      id: 'admin-without-audit',
      matchedAt: '2026-06-19T08:30:00.000Z',
      updatedAt: '2026-06-19T10:30:00.000Z',
    });
    expect(postMatchCancellationTimeDisplay(adminWithoutAudit, nowMs)).toMatchObject({
      ageLabel: 'Resolved',
      timestamp: '2026-06-19T10:30:00.000Z',
      timestampLabel: 'Resolved at',
    });
    expect(postMatchCancellationTimeDisplay(autoResolved, nowMs)).toMatchObject({
      ageLabel: 'Resolved',
      timestamp: '2026-06-19T11:00:00.000Z',
      timestampLabel: 'Resolved at',
    });
  });

  it('prefers the list decision audit timestamp over a later booking update', () => {
    const booking = {
      ...bookingFixture({
        closedAt: '2026-06-19T09:00:00.000Z',
        closedByRole: 'ADMIN',
        closedReason: 'post_match_cancellation_approved',
        id: 'admin-resolved-list-row',
        matchedAt: '2026-06-19T08:30:00.000Z',
        updatedAt: '2026-06-20T12:00:00.000Z',
      }),
      postMatchCancellationDecisionAt: '2026-06-19T10:15:00.000Z',
    };

    expect(
      postMatchCancellationTimeDisplay(
        booking,
        new Date('2026-06-21T10:15:00.000Z').getTime(),
      ),
    ).toMatchObject({
      ageLabel: 'Resolved',
      ageMinutes: 48 * 60,
      timestamp: '2026-06-19T10:15:00.000Z',
      timestampLabel: 'Decided at',
    });
  });

  it('shows no timestamp only when every persisted time is missing or invalid', () => {
    const booking = bookingFixture({
      closedAt: 'invalid',
      createdAt: 'also-invalid',
      id: 'missing-time',
      matchedAt: '2026-06-19T08:30:00.000Z',
      updatedAt: null,
    });

    expect(postMatchCancellationTimeDisplay(booking, Date.now())).toMatchObject({
      ageMinutes: null,
      timestamp: null,
      timestampLabel: 'Review started',
    });
  });
});

function bookingFixture(input: {
  readonly closedAt: string | null;
  readonly closedReason?: string;
  readonly closedByRole?: string;
  readonly createdAt?: string | null;
  readonly earning?: { readonly netAmount: number; readonly status: string };
  readonly id: string;
  readonly matchedAt: string | null;
  readonly metadata?: unknown;
  readonly selectedProviderId?: string | null;
  readonly status?: string;
  readonly updatedAt?: string | null;
}): AdminBooking {
  return {
    closedAt: input.closedAt,
    closedReason: input.closedReason ?? 'partner_cancelled',
    closedByRole: input.closedByRole ?? 'PROVIDER',
    createdAt: input.createdAt ?? undefined,
    earning: input.earning ? { id: `${input.id}-earning`, ...input.earning } : null,
    id: input.id,
    matchedAt: input.matchedAt,
    metadata: input.metadata,
    selectedProviderId: input.selectedProviderId === undefined ? `${input.id}-partner` : input.selectedProviderId,
    status: input.status ?? 'CANCELLED',
    statusChangedAt: input.closedAt ?? undefined,
    updatedAt: input.updatedAt ?? undefined,
  } as unknown as AdminBooking;
}
