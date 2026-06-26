import {
  bookingNextOperatorActionFromFacts,
  type BookingNextOperatorActionInput,
} from './booking-next-operator-action';

function buildInput(
  overrides: Partial<
    Omit<
      BookingNextOperatorActionInput,
      | 'cashDebtNeedsOps'
      | 'completedCloseoutNeedsOps'
      | 'firstPickPending'
      | 'locationNeedsOps'
      | 'matchingChatReady'
      | 'paymentNeedsOps'
    >
  > & {
    cashDebtNeedsOps?: boolean;
    completedCloseoutNeedsOps?: boolean;
    firstPickPending?: boolean;
    locationNeedsOps?: boolean;
    matchingChatReady?: boolean;
    paymentNeedsOps?: boolean;
  } = {},
): BookingNextOperatorActionInput {
  return {
    cashDebtNeedsOps: () => overrides.cashDebtNeedsOps ?? false,
    completedCloseoutNeedsOps: () => overrides.completedCloseoutNeedsOps ?? false,
    firstPickPending: () => overrides.firstPickPending ?? false,
    flagTitle: overrides.flagTitle,
    locationNeedsOps: () => overrides.locationNeedsOps ?? false,
    matchingChatReady: () => overrides.matchingChatReady ?? true,
    paymentNeedsOps: () => overrides.paymentNeedsOps ?? false,
    status: overrides.status,
  };
}

describe('bookingNextOperatorActionFromFacts', () => {
  it('prioritizes payment actions before status actions', () => {
    expect(
      bookingNextOperatorActionFromFacts(
        buildInput({ cashDebtNeedsOps: true, status: 'NO_SHOW' }),
      ),
    ).toBe(
      'Confirm Partner wallet debt and request company fee settlement before final acceptance, service start, or payout release resumes.',
    );
    expect(
      bookingNextOperatorActionFromFacts(buildInput({ completedCloseoutNeedsOps: true })),
    ).toBe('Run closeout reconciliation so payment, earning, tax, fee, and wallet records match.');
    expect(bookingNextOperatorActionFromFacts(buildInput({ paymentNeedsOps: true }))).toBe(
      'Open the booking payment panel and decide capture, release, refund, cash debt, or missing reference handling.',
    );
  });

  it('builds status actions in operator order', () => {
    expect(bookingNextOperatorActionFromFacts(buildInput({ status: 'NO_SHOW' }))).toBe(
      'Record Customer and Partner notes, then close payment and safety follow-up.',
    );
    expect(bookingNextOperatorActionFromFacts(buildInput({ status: 'EXPIRED' }))).toBe(
      'Release the hold, notify the customer, and confirm no Partner remains assigned.',
    );
    expect(
      bookingNextOperatorActionFromFacts(
        buildInput({ firstPickPending: true, status: 'OPEN_MATCHING' }),
      ),
    ).toBe('Monitor the first-pick Partner response window and prepare marketplace Partner options.');
    expect(bookingNextOperatorActionFromFacts(buildInput({ status: 'OPEN_MATCHING' }))).toBe(
      'Check nearby Partner supply and notification delivery until the customer has options.',
    );
    expect(
      bookingNextOperatorActionFromFacts(
        buildInput({ matchingChatReady: false, status: 'MATCHED' }),
      ),
    ).toBe('Create or repair chat handoff before the service moves forward.');
  });

  it('falls through to location, in-service, flag fallback, and default actions', () => {
    expect(bookingNextOperatorActionFromFacts(buildInput({ locationNeedsOps: true }))).toBe(
      'Ask the Partner to refresh location once; use last-known location only, no live routing.',
    );
    expect(bookingNextOperatorActionFromFacts(buildInput({ status: 'IN_SERVICE' }))).toBe(
      'Monitor completion timing and prepare payment capture or cash fee ledger closeout.',
    );
    expect(
      bookingNextOperatorActionFromFacts(buildInput({ flagTitle: 'Matched without chat' })),
    ).toBe('Review matched without chat and add an ops note before closing.');
    expect(bookingNextOperatorActionFromFacts(buildInput())).toBe(
      'Keep watching status, chat, and Partner handoff.',
    );
  });

  it('does not read lower-priority readers after a payment action matches', () => {
    const input = {
      cashDebtNeedsOps: vi.fn(() => true),
      completedCloseoutNeedsOps: vi.fn(() => false),
      firstPickPending: vi.fn(() => true),
      locationNeedsOps: vi.fn(() => true),
      matchingChatReady: vi.fn(() => false),
      paymentNeedsOps: vi.fn(() => true),
      status: 'OPEN_MATCHING',
    } satisfies BookingNextOperatorActionInput;

    expect(bookingNextOperatorActionFromFacts(input)).toBe(
      'Confirm Partner wallet debt and request company fee settlement before final acceptance, service start, or payout release resumes.',
    );
    expect(input.completedCloseoutNeedsOps).not.toHaveBeenCalled();
    expect(input.paymentNeedsOps).not.toHaveBeenCalled();
    expect(input.firstPickPending).not.toHaveBeenCalled();
    expect(input.locationNeedsOps).not.toHaveBeenCalled();
    expect(input.matchingChatReady).not.toHaveBeenCalled();
  });
});
