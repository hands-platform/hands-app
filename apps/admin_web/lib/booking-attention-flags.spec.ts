import { bookingAttentionFlags } from './booking-attention-flags';

const baseInput = {
  bookingStatus: 'OPEN_MATCHING',
  hasPayment: false,
  paymentStatus: null,
  paymentProviderRef: null,
  cashDebtNeedsSettlement: false,
  cashDebtPartnerLabel: 'Linh Wellness',
  cashDebtAmount: 0,
  cashDebtCurrency: 'VND',
  matchingWindowExpired: false,
  expiresAtLabel: '2026-06-07 12:00',
  hasPreferredPartner: false,
  preferredPartnerLabel: 'Linh Wellness',
  participantCount: 0,
  openedAgeMinutes: null,
  hasChatRoom: false,
  activeWithLocationNeed: false,
  hasLatestProviderLocation: false,
  latestProviderLocationFreshness: null,
  providerLocationAgeLabel: 'updated 20m ago',
  messageCount: 0,
  refundCount: 0,
  formatMoney: (amount?: number | null, currency = 'VND') => `${amount ?? 0} ${currency}`,
};

describe('bookingAttentionFlags', () => {
  it('flags unresolved cancelled payment holds', () => {
    const flags = bookingAttentionFlags({
      ...baseInput,
      bookingStatus: 'CANCELLED',
      hasPayment: true,
      paymentStatus: 'AUTHORIZED',
      paymentProviderRef: 'gateway-ref',
    });

    expect(flags).toEqual([
      expect.objectContaining({
        severity: 'high',
        title: 'Cancelled payment unresolved',
      }),
    ]);
  });

  it('flags cash fee debt blocks using factual settlement copy', () => {
    const flags = bookingAttentionFlags({
      ...baseInput,
      bookingStatus: 'COMPLETED',
      cashDebtNeedsSettlement: true,
      cashDebtAmount: 120000,
    });

    expect(flags).toEqual([
      expect.objectContaining({
        severity: 'high',
        title: 'Cash fee debt blocks Partner',
        detail: 'Linh Wellness collected cash and still owes 120000 VND.',
        action:
          'Confirm the Partner deposit or admin offset before final acceptance, service start, or payout release resumes.',
      }),
    ]);
  });

  it('flags an expired open matching window', () => {
    const flags = bookingAttentionFlags({
      ...baseInput,
      bookingStatus: 'OPEN_MATCHING',
      matchingWindowExpired: true,
      expiresAtLabel: '07 Jun 2026 12:00',
    });

    expect(flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: 'high',
          title: 'Matching window expired',
          detail: 'The request expired at 07 Jun 2026 12:00 but is still open.',
        }),
      ]),
    );
  });

  it('flags a slow preferred Partner and no Partner supply while matching stays open', () => {
    const flags = bookingAttentionFlags({
      ...baseInput,
      bookingStatus: 'OPEN_MATCHING',
      hasPreferredPartner: true,
      openedAgeMinutes: 10,
      participantCount: 0,
    });

    expect(flags.map((flag) => flag.title)).toEqual(['Preferred Partner slow', 'No Partner supply']);
  });

  it('flags matched bookings that are missing the mandatory chat room', () => {
    const flags = bookingAttentionFlags({
      ...baseInput,
      bookingStatus: 'MATCHED',
      hasChatRoom: false,
    });

    expect(flags).toEqual([
      expect.objectContaining({
        severity: 'high',
        title: 'Matched without chat',
      }),
    ]);
  });

  it('flags stale Partner location during active handoff stages', () => {
    const flags = bookingAttentionFlags({
      ...baseInput,
      bookingStatus: 'PROVIDER_ON_THE_WAY',
      activeWithLocationNeed: true,
      hasLatestProviderLocation: true,
      latestProviderLocationFreshness: 'stale',
      providerLocationAgeLabel: 'updated 40m ago',
    });

    expect(flags).toEqual([
      expect.objectContaining({
        severity: 'medium',
        title: 'Partner location is stale',
        detail: 'The latest Partner pin is updated 40m ago.',
      }),
    ]);
  });

  it('flags missing gateway reference and refund/payment mismatch', () => {
    const flags = bookingAttentionFlags({
      ...baseInput,
      bookingStatus: 'MATCHED',
      hasPayment: true,
      paymentStatus: 'AUTHORIZED',
      paymentProviderRef: null,
      refundCount: 1,
    });

    expect(flags.map((flag) => flag.title)).toEqual([
      'Matched without chat',
      'Payment reference missing',
      'Refund/payment mismatch',
    ]);
  });
});
