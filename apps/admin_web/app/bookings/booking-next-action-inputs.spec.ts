import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingNextActionCopyInputFromBooking,
  bookingNextActionOwnerInput,
  bookingNextActionPriorityInput,
  bookingNextOperatorActionInput,
  type BookingNextActionInputReaders,
} from './booking-next-action-inputs';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

function readers(): BookingNextActionInputReaders {
  return {
    cashDebtNeedsOps: vi.fn(() => false),
    completedCloseoutNeedsOps: vi.fn(() => false),
    firstPickPending: vi.fn(() => false),
    flagSeverity: 'high',
    flagTitle: 'Payment reference missing',
    locationNeedsOps: vi.fn(() => false),
    matchingChatReady: vi.fn(() => true),
    paymentNeedsOps: vi.fn(() => false),
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

  it('builds copy input facts from booking status, payment, and marketplace state', () => {
    const item = booking({
      id: 'booking-1',
      matchingEvidence: {
        marketplaceParticipantCount: 2,
      } as AdminBooking['matchingEvidence'],
      payment: {
        status: 'AUTHORIZED',
      } as AdminBooking['payment'],
      preferredProvider: {
        id: 'preferred',
      } as AdminBooking['preferredProvider'],
      status: 'OPEN_MATCHING',
    });

    expect(bookingNextActionCopyInputFromBooking(item)).toEqual({
      backupSelected: false,
      cashDebtNeedsOps: false,
      completedCloseoutNeedsOps: false,
      hasPayment: true,
      hasPreferredPartner: true,
      marketplaceParticipantCount: 2,
      paymentStatus: 'AUTHORIZED',
      preferredAwaitingDecision: true,
      status: 'OPEN_MATCHING',
    });
  });
});
