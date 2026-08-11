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
      'Closeout status',
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
    expect(review.rows.find((row) => row.label === 'Closeout status')).toMatchObject({
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
        updatedAt: '2026-06-13T00:00:00.000Z',
      }),
      closeoutOpenItemCount: 2,
      closureSummary: {
        status: 'Terminal without closure stamp',
        detail: 'This booking is terminal but has no explicit closure actor/reason saved.',
      },
      messageCount: 0,
      nowMs: new Date('2026-06-13T03:00:00.000Z').getTime(),
      operatorNoteCount: 0,
    });

    expect(review.visible).toBe(true);
    expect(review.title).toBe('Post-match cancellation review');
    expect(review.tone).toBe('pill-warn');
    expect(review.primaryHref).toBe('/bookings/post-match-cancellations?view=manual-decision#booking-booking-test');
    expect(review.primaryLabel).toBe('Back to Needs decision');
    expect(review.postMatchDecision).toMatchObject({
      canResolve: true,
      feeLabel: 'Fee outcome pending',
      resolutionLabel: 'Pending admin decision',
      timingLabel: 'Match time missing',
      visible: true,
    });
    expect(review.postMatchContext).toMatchObject({
      summary: expect.arrayContaining([
        expect.objectContaining({
          label: 'Decision SLA',
          value: 'Overdue',
        }),
      ]),
      reason: {
        value: 'Legacy reason',
      },
      evidence: [
        {
          label: 'Chat evidence',
          value: 'No messages',
        },
        {
          label: 'Location evidence',
          value: 'No location record',
        },
      ],
      money: [
        {
          label: 'Customer money',
          value: 'No company funds moved',
        },
        {
          label: 'Partner fee',
          value: 'No Partner payable',
        },
      ],
    });
    expect(review.rows.find((row) => row.label === 'Closure record')).toMatchObject({
      tone: 'pill-warn',
    });
    expect(review.rows.find((row) => row.label === 'Closeout status')).toMatchObject({
      helper: 'Open closeout items need review.',
      value: '2 open items',
      tone: 'pill-warn',
    });
  });

  it('builds an operator-ready reason, location, and wallet outcome from existing detail data', () => {
    const review = panel({
      booking: booking({
        addressSnapshot: {
          bookingId: 'booking-test',
          customerProfileId: 'customer-1',
          id: 'address-1',
          latitude: 21.0278,
          longitude: 105.8342,
        },
        closedAt: '2026-06-13T03:30:00.000Z',
        closedNote: 'Could not meet customer: fallback note',
        matchedAt: '2026-06-13T03:00:00.000Z',
        metadata: {
          postMatchCancellation: {
            detail: 'Arrived at the saved address and called twice.',
            reasonCode: 'CUSTOMER_NOT_FOUND',
            requiresAdminReview: true,
          },
        },
        payment: {
          amount: 400_000,
          currency: 'VND',
          id: 'payment-1',
          method: 'CUSTOMER_WALLET',
          status: 'AUTHORIZED',
        },
        selectedProviderId: 'partner-1',
        snapshots: [
          {
            addressText: 'Cau Giay, Ha Noi',
            bookingId: 'booking-test',
            id: 'location-1',
            lat: 21.028,
            lng: 105.834,
            providerProfileId: 'partner-1',
            recordedAt: '2026-06-13T03:29:00.000Z',
          },
        ],
        status: 'CANCELLED',
      }),
      messageCount: 4,
    });

    expect(review.postMatchContext?.reason).toMatchObject({
      helper: 'Arrived at the saved address and called twice.',
      tone: 'pill-warn',
      value: 'Could not meet customer',
    });
    expect(review.postMatchContext?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Chat evidence', value: '4 messages' }),
        expect.objectContaining({
          label: 'Location evidence',
          tone: 'pill-success',
          value: 'Cancellation location saved',
        }),
      ]),
    );
    expect(review.postMatchContext?.money).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Customer money',
          tone: 'pill-warn',
          value: 'Wallet amount still held',
        }),
      ]),
    );
  });

  it('shows the pending Finance refund request instead of an unexplained captured payment', () => {
    const review = panel({
      booking: booking({
        status: 'CANCELLED',
        selectedProviderId: 'partner-1',
        matchedAt: '2026-06-13T03:00:00.000Z',
        payment: {
          id: 'payment-1',
          method: 'CARD',
          status: 'CAPTURED',
          amount: 400_000,
          currency: 'VND',
          refunds: [{ id: 'refund-1', amount: 400_000, status: 'REQUESTED' }],
        },
      }),
    });

    expect(review.postMatchContext?.money.find((row) => row.label === 'Customer money')).toMatchObject({
      helper: '400.000 VND / CARD / CAPTURED / REFUND REQUESTED',
      tone: 'pill-warn',
      value: 'Refund approval pending',
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
    expect(review.primaryHref).toBe('/bookings/post-match-cancellations?view=manual-decision#booking-booking-test');
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
        metadata: { postMatchCancellation: { autoApproved: true } },
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

  it('keeps the original cancellation facts separate from the admin decision audit event', () => {
    const review = panel({
      booking: booking({
        auditLogs: [
          {
            action: 'booking.post_match_cancellation.approve',
            actor: { fullName: 'Ops Kim' },
            createdAt: '2026-06-13T04:15:00.000Z',
            id: 'decision-1',
            metadata: {
              decisionReasonLabel: 'Customer request confirmed',
              operatorNote: 'Customer request confirmed in retained chat.',
              previousClosedByRole: 'PROVIDER',
              previousClosedNote: 'Customer asked to cancel.',
              previousClosedReason: 'CUSTOMER_REQUESTED',
            },
            target: 'booking:booking-test',
          },
        ],
        closedAt: '2026-06-13T03:10:00.000Z',
        closedByRole: 'ADMIN',
        closedReason: 'post_match_cancellation_approved',
        matchedAt: '2026-06-13T03:00:00.000Z',
        selectedProviderId: 'partner-1',
        status: 'CANCELLED',
      }),
    });

    expect(review.postMatchContext?.summary).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Cancellation actor', value: 'Partner cancelled' }),
      expect.objectContaining({
        dateTimeValue: '2026-06-13T03:10:00.000Z',
        label: 'Cancellation time',
      }),
      expect.objectContaining({
        helper: expect.stringContaining('Customer request confirmed · Ops Kim'),
        label: 'Admin decision',
      }),
    ]));
    expect(review.postMatchContext?.reason).toMatchObject({
      helper: 'Customer asked to cancel.',
      value: 'Customer Requested',
    });
    expect(review.postMatchDecision).toMatchObject({
      canResolve: false,
      decidedBy: 'Ops Kim',
      decisionAt: '2026-06-13T04:15:00.000Z',
      decisionReasonLabel: 'Customer request confirmed',
      operatorNote: 'Customer request confirmed in retained chat.',
    });
  });
});
