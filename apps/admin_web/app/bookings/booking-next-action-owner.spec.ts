import {
  bookingNextActionOwnerFromFacts,
  type BookingNextActionOwnerInput,
} from './booking-next-action-owner';

function buildInput(
  overrides: Partial<
    Omit<BookingNextActionOwnerInput, 'completedCloseoutNeedsOps' | 'paymentNeedsOps'>
  > & {
    completedCloseoutNeedsOps?: boolean;
    paymentNeedsOps?: boolean;
  } = {},
): BookingNextActionOwnerInput {
  return {
    completedCloseoutNeedsOps: () => overrides.completedCloseoutNeedsOps ?? false,
    flagTitle: overrides.flagTitle,
    paymentNeedsOps: () => overrides.paymentNeedsOps ?? false,
    status: overrides.status,
  };
}

describe('bookingNextActionOwnerFromFacts', () => {
  it.each([
    ['payment flag', { flagTitle: 'Payment reference missing' }],
    ['closeout flag', { flagTitle: 'Completed closeout incomplete' }],
    ['cash flag', { flagTitle: 'Cash fee debt gates final acceptance' }],
    ['payout flag', { flagTitle: 'Partner payout exceeds price' }],
    ['payment ops', { paymentNeedsOps: true }],
    ['closeout ops', { completedCloseoutNeedsOps: true }],
  ] as const)('routes %s to Finance', (_label, overrides) => {
    expect(bookingNextActionOwnerFromFacts(buildInput(overrides))).toBe('Finance');
  });

  it('does not read finance readers when the flag title already routes to Finance', () => {
    const input = {
      completedCloseoutNeedsOps: jest.fn(() => false),
      flagTitle: 'Payment reference missing',
      paymentNeedsOps: jest.fn(() => false),
      status: 'NO_SHOW',
    } satisfies BookingNextActionOwnerInput;

    expect(bookingNextActionOwnerFromFacts(input)).toBe('Finance');
    expect(input.paymentNeedsOps).not.toHaveBeenCalled();
    expect(input.completedCloseoutNeedsOps).not.toHaveBeenCalled();
  });

  it('routes no-show to Safety after finance checks', () => {
    expect(bookingNextActionOwnerFromFacts(buildInput({ status: 'NO_SHOW' }))).toBe('Safety');
    expect(
      bookingNextActionOwnerFromFacts(buildInput({ flagTitle: 'No-show payment unresolved' })),
    ).toBe('Finance');
  });

  it('routes cancelled, expired, or chat work to Support', () => {
    expect(bookingNextActionOwnerFromFacts(buildInput({ status: 'CANCELLED' }))).toBe('Support');
    expect(bookingNextActionOwnerFromFacts(buildInput({ status: 'EXPIRED' }))).toBe('Support');
    expect(bookingNextActionOwnerFromFacts(buildInput({ flagTitle: 'Matched without chat' }))).toBe(
      'Support',
    );
  });

  it('falls back to Dispatch', () => {
    expect(bookingNextActionOwnerFromFacts(buildInput({ status: 'OPEN_MATCHING' }))).toBe(
      'Dispatch',
    );
  });
});
