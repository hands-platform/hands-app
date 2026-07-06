import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingOutcomeReviewPanel } from './booking-outcome-review-panel';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    id: 'booking-test',
    status: 'OPEN_MATCHING',
    ...input,
  } as AdminBookingDetail;
}

function panel(input: Partial<Parameters<typeof bookingOutcomeReviewPanel>[0]> = {}) {
  return bookingOutcomeReviewPanel({
    booking: booking({ status: 'OPEN_MATCHING' }),
    closeoutOpenItemCount: 0,
    closureSummary: {
      status: 'Open',
      detail: 'No closure has been recorded yet.',
    },
    messageCount: 0,
    operatorNoteCount: 0,
    ...input,
  });
}

describe('bookingOutcomeReviewPanel', () => {
  it('shows completed booking evidence and closeout links', () => {
    const review = panel({
      booking: booking({
        status: 'COMPLETED',
        statusChangedAt: '2026-06-13T03:15:00.000Z',
        statusChangedLabel: 'Completed at',
      }),
      closureSummary: {
        status: '13 Jun 2026, 03:15',
        detail: 'provider closure / Service Completed / Smoke: service completed; closeout reconciliation still needs review.',
      },
      messageCount: 2,
      operatorNoteCount: 1,
    });

    expect(review.visible).toBe(true);
    expect(review.title).toBe('Completed booking review');
    expect(review.tone).toBe('pill-success');
    expect(review.primaryHref).toBeNull();
    expect(review.primaryLabel).toBeNull();
    expect(review.postMatchDecision.visible).toBe(false);
    expect(review.rows.map((row) => row.label)).toEqual([
      'Closure record',
      'Chat evidence',
      'Operator notes',
      'Closeout readiness',
      'Outcome time',
    ]);
    expect(review.rows.find((row) => row.label === 'Chat evidence')).toMatchObject({
      helper: 'Retained chat attached.',
      value: '2 messages',
      href: '#chat',
      tone: 'pill-success',
    });
    expect(review.rows.find((row) => row.label === 'Operator notes')).toMatchObject({
      helper: 'Operator note attached.',
    });
    expect(review.rows.find((row) => row.label === 'Closeout readiness')).toMatchObject({
      helper: 'No closeout exceptions.',
    });
    expect(review.rows.find((row) => row.label === 'Closure record')).toMatchObject({
      helper: 'Service completed; closeout reconciliation needs review.',
    });
    expect(review.rows.find((row) => row.label === 'Outcome time')).toMatchObject({
      dateTimeValue: '2026-06-13T03:15:00.000Z',
      value: 'Not set',
    });
  });

  it('keeps pre-match cancellation out of the post-match review panel', () => {
    const review = panel({
      booking: booking({
        status: 'CANCELLED',
        selectedProviderId: null,
        matchedAt: null,
      }),
      closureSummary: {
        status: 'Terminal without closure stamp',
        detail: 'This booking is terminal but has no explicit closure actor/reason saved.',
      },
    });

    expect(review.visible).toBe(false);
    expect(review.rows).toEqual([]);
  });

  it('shows post-match cancellation when a final Partner or retained chat exists', () => {
    const review = panel({
      booking: booking({
        status: 'CANCELLED',
        selectedProviderId: 'partner-1',
        chatRoom: { id: 'chat-room-1' },
      }),
      closeoutOpenItemCount: 2,
      closureSummary: {
        status: 'Terminal without closure stamp',
        detail: 'This booking is terminal but has no explicit closure actor/reason saved.',
      },
      messageCount: 0,
      operatorNoteCount: 0,
    });

    expect(review.visible).toBe(true);
    expect(review.title).toBe('Post-match cancellation review');
    expect(review.tone).toBe('pill-warn');
    expect(review.primaryHref).toBe('/bookings/post-match-cancellations?view=post-match-cancellations#booking-booking-test');
    expect(review.primaryLabel).toBe('Open review queue');
    expect(review.postMatchDecision).toMatchObject({
      canResolve: true,
      feeLabel: 'No earning',
      resolutionLabel: 'Pending admin decision',
      timingLabel: 'Match time missing',
      visible: true,
    });
    expect(review.rows.find((row) => row.label === 'Closure record')).toMatchObject({
      tone: 'pill-warn',
    });
    expect(review.rows.find((row) => row.label === 'Closeout readiness')).toMatchObject({
      helper: 'Open closeout items need review.',
      value: '2 open items',
      tone: 'pill-warn',
    });
  });

  it('highlights no-show evidence gaps before final confirmation', () => {
    const review = panel({
      booking: booking({
        status: 'NO_SHOW',
        matchedAt: '2026-06-13T02:30:00.000Z',
      }),
      closureSummary: {
        status: 'Terminal without closure stamp',
        detail: 'This booking is terminal but has no explicit closure actor/reason saved.',
      },
    });

    expect(review.visible).toBe(true);
    expect(review.title).toBe('No-show confirmation review');
    expect(review.tone).toBe('pill-danger');
    expect(review.primaryHref).toBe('/bookings/post-match-cancellations?view=post-match-cancellations#booking-booking-test');
    expect(review.postMatchDecision.visible).toBe(false);
    expect(review.rows.find((row) => row.label === 'Chat evidence')).toMatchObject({
      helper: 'Retained chat is missing.',
      value: 'No messages',
      tone: 'pill-warn',
    });
  });

  it('marks auto-approved post-match cancellations as resolved in detail review', () => {
    const review = panel({
      booking: booking({
        status: 'CANCELLED',
        selectedProviderId: 'partner-1',
        matchedAt: '2026-06-13T03:00:00.000Z',
        closedAt: '2026-06-13T03:10:00.000Z',
        closedReason: 'post_match_cancellation_approved',
        earning: {
          status: 'CANCELLED',
          netAmount: 0,
        } as AdminBookingDetail['earning'],
      }),
      closureSummary: {
        status: '13 Jun 2026, 03:10',
        detail: 'provider closure / approved',
      },
    });

    expect(review.postMatchDecision).toMatchObject({
      canResolve: false,
      feeLabel: 'Fee restored',
      resolutionLabel: 'Auto-approved',
      timingLabel: 'Auto-approved',
      visible: true,
    });
  });
});
