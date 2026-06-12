import {
  bookingNextActionOwnerInput,
  bookingNextActionPriorityInput,
  bookingNextOperatorActionInput,
  type BookingNextActionInputReaders,
} from './booking-next-action-inputs';

function readers(): BookingNextActionInputReaders {
  return {
    cashDebtNeedsOps: jest.fn(() => false),
    completedCloseoutNeedsOps: jest.fn(() => false),
    firstPickPending: jest.fn(() => false),
    flagSeverity: 'high',
    flagTitle: 'Payment reference missing',
    locationNeedsOps: jest.fn(() => false),
    matchingChatReady: jest.fn(() => true),
    paymentNeedsOps: jest.fn(() => false),
    status: 'MATCHED',
  };
}

describe('booking next action input helpers', () => {
  it('maps common readers to priority inputs without evaluating them', () => {
    const input = readers();

    expect(bookingNextActionPriorityInput(input)).toEqual({
      completedCloseoutNeedsOps: input.completedCloseoutNeedsOps,
      flagSeverity: 'high',
      locationNeedsOps: input.locationNeedsOps,
      paymentNeedsOps: input.paymentNeedsOps,
      status: 'MATCHED',
    });
    expect(input.paymentNeedsOps).not.toHaveBeenCalled();
  });

  it('maps common readers to owner inputs without evaluating them', () => {
    const input = readers();

    expect(bookingNextActionOwnerInput(input)).toEqual({
      completedCloseoutNeedsOps: input.completedCloseoutNeedsOps,
      flagTitle: 'Payment reference missing',
      paymentNeedsOps: input.paymentNeedsOps,
      status: 'MATCHED',
    });
    expect(input.completedCloseoutNeedsOps).not.toHaveBeenCalled();
  });

  it('maps common readers to operator action inputs without evaluating them', () => {
    const input = readers();

    expect(bookingNextOperatorActionInput(input)).toEqual({
      cashDebtNeedsOps: input.cashDebtNeedsOps,
      completedCloseoutNeedsOps: input.completedCloseoutNeedsOps,
      firstPickPending: input.firstPickPending,
      flagTitle: 'Payment reference missing',
      locationNeedsOps: input.locationNeedsOps,
      matchingChatReady: input.matchingChatReady,
      paymentNeedsOps: input.paymentNeedsOps,
      status: 'MATCHED',
    });
    expect(input.cashDebtNeedsOps).not.toHaveBeenCalled();
  });
});
