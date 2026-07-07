import { bookingDecisionNotePresets } from './booking-decision-note-presets';

const baseInput = {
  bookingStatus: 'MATCHED',
  messageCount: 0,
  hasLatestLocation: false,
  notificationCount: 0,
  operatorNoteCount: 0,
  paymentMethod: 'MOMO',
  paymentStatus: 'AUTHORIZED',
  refundRowCount: 0,
  cashFeeDebtNeedsSettlement: false,
  closeoutOpenItemLabels: [],
};

describe('bookingDecisionNotePresets', () => {
  it('offers missing evidence notes for active bookings without chat, alerts, location, or notes', () => {
    const presets = bookingDecisionNotePresets(baseInput);

    expect(presets.map((preset) => preset.id)).toEqual([
      'chat-empty-note',
      'alert-empty-note',
      'operator-note-needed',
      'payment-review-note',
    ]);
  });

  it('adds a location note when service-stage bookings have no retained Partner pin', () => {
    const presets = bookingDecisionNotePresets({
      ...baseInput,
      bookingStatus: 'IN_SERVICE',
    });

    expect(presets.some((preset) => preset.id === 'location-empty-note')).toBe(true);
  });

  it('adds cash debt and closeout notes when settlement records are still open', () => {
    const presets = bookingDecisionNotePresets({
      ...baseInput,
      paymentMethod: 'CASH',
      paymentStatus: 'PAID',
      cashFeeDebtNeedsSettlement: true,
      closeoutOpenItemLabels: ['Payment', 'Tax'],
    });

    expect(presets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'cash-debt-note',
          label: 'Cash',
          preset:
            'Cash settlement note: Partner cash-fee debt remains open; final acceptance, service start, and payout release should stay blocked until company deposit or admin offset is verified.',
        }),
        expect.objectContaining({
          id: 'closeout-open-items-note',
          detail: 'Payment, Tax',
          preset: 'Closeout status note: open factual items - Payment, Tax.',
        }),
      ]),
    );
  });

  it('falls back to evidence reviewed when no gap is visible', () => {
    const presets = bookingDecisionNotePresets({
      ...baseInput,
      bookingStatus: 'COMPLETED',
      messageCount: 3,
      hasLatestLocation: true,
      notificationCount: 2,
      operatorNoteCount: 1,
      paymentStatus: 'CAPTURED',
    });

    expect(presets).toEqual([
      expect.objectContaining({
        id: 'evidence-reviewed-note',
        label: 'Clear',
      }),
    ]);
  });
});
