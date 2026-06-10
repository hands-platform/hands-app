import {
  bookingNextActionCopy,
  type BookingNextActionCopyInput,
} from './booking-next-action-copy';

const baseInput: BookingNextActionCopyInput = {
  status: 'PENDING',
  hasPayment: false,
  paymentStatus: null,
  cashDebtNeedsOps: false,
  hasPreferredPartner: false,
  preferredAwaitingDecision: false,
  marketplaceParticipantCount: 0,
  backupSelected: false,
  completedCloseoutNeedsOps: false,
};

describe('bookingNextActionCopy', () => {
  it.each([
    [
      { status: 'NO_SHOW', hasPayment: true, paymentStatus: 'AUTHORIZED' },
      'No-show is marked. Decide payment release, refund, or fee handling before closing.',
    ],
    [
      { status: 'NO_SHOW', hasPayment: true, paymentStatus: 'RELEASED' },
      'No-show is marked and payment outcome is already closed. Confirm customer and partner notes.',
    ],
    [
      { status: 'EXPIRED', paymentStatus: 'RELEASED' },
      'Matching expired and the payment hold is released. Confirm customer communication.',
    ],
    [
      { status: 'CANCELLED', paymentStatus: 'AUTHORIZED' },
      'Customer cancelled. Review the linked payment and release or refund before closing the case.',
    ],
    [
      { status: 'REFUNDED' },
      'Refund is recorded. Check the refund board and customer communication.',
    ],
  ] satisfies ReadonlyArray<[Partial<BookingNextActionCopyInput>, string]>)(
    'returns terminal payment guidance',
    (overrides, expected) => {
      expect(bookingNextActionCopy({ ...baseInput, ...overrides })).toBe(expected);
    },
  );

  it('prioritizes cash debt before matching guidance', () => {
    expect(
      bookingNextActionCopy({
        ...baseInput,
        status: 'OPEN_MATCHING',
        cashDebtNeedsOps: true,
        hasPreferredPartner: true,
        preferredAwaitingDecision: true,
      }),
    ).toBe(
      'Partner collected cash. Finance must settle the HANDS fee debt before this partner participates in marketplace bookings again or receives payout release.',
    );
  });

  it.each([
    [
      {
        status: 'OPEN_MATCHING',
        hasPreferredPartner: true,
        preferredAwaitingDecision: true,
      },
      'Wait for the first-pick partner, but monitor marketplace partner supply.',
    ],
    [
      { status: 'OPEN_MATCHING', marketplaceParticipantCount: 0 },
      'Check notifications and nearby partner supply.',
    ],
    [
      { status: 'OPEN_MATCHING', marketplaceParticipantCount: 2 },
      'Customer can keep waiting or switch to a marketplace partner.',
    ],
    [
      { status: 'MATCHED', backupSelected: true },
      'Customer switched away from the first-pick partner. Confirm chat, route, and partner handoff.',
    ],
    [
      { status: 'MATCHED' },
      'Customer selection is locked. Check chat creation, route tracking, and partner departure.',
    ],
  ] satisfies ReadonlyArray<[Partial<BookingNextActionCopyInput>, string]>)(
    'returns matching guidance',
    (overrides, expected) => {
      expect(bookingNextActionCopy({ ...baseInput, ...overrides })).toBe(expected);
    },
  );

  it.each([
    ['PROVIDER_ON_THE_WAY', 'Monitor live location and arrival progress.'],
    ['IN_SERVICE', 'Track completion and payment capture.'],
    ['COMPLETED', 'Review payment, customer feedback, and closeout records.'],
  ])('returns active service guidance for %s', (status, expected) => {
    expect(bookingNextActionCopy({ ...baseInput, status })).toBe(expected);
  });

  it('prioritizes completed closeout before the completed default copy', () => {
    expect(
      bookingNextActionCopy({
        ...baseInput,
        status: 'COMPLETED',
        completedCloseoutNeedsOps: true,
      }),
    ).toBe(
      'Completed service needs closeout reconciliation for payment, earning, tax, and wallet records.',
    );
  });

  it('returns normal operating copy for calm states', () => {
    expect(bookingNextActionCopy(baseInput)).toBe('Normal operating state.');
  });
});
