import type { AdminBooking } from '../../lib/admin-api';
import { bookingMarketplaceOperatingQueueFact } from './booking-marketplace-operating-queue-inputs';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

describe('bookingMarketplaceOperatingQueueFact', () => {
  it('builds operating queue facts from booking data and marketplace state', () => {
    const item = booking({
      earning: {
        currency: 'VND',
        netAmount: -150000,
        status: 'PENDING',
      } as AdminBooking['earning'],
      id: 'booking-1',
      payment: { method: 'CASH' } as AdminBooking['payment'],
      preferredProvider: { id: 'preferred', displayName: 'First Pick' } as AdminBooking['preferredProvider'],
      status: 'OPEN_MATCHING',
    });

    expect(
      bookingMarketplaceOperatingQueueFact(item, {
        hasCustomerSelectablePartner: true,
        marketplaceParticipantCount: 2,
        preferredAwaitingDecision: true,
        responseWindowExpired: false,
      }),
    ).toEqual({
      booking: item,
      cashDebtNeedsOps: true,
      chatRepairNeedsOps: false,
      hasCustomerSelectablePartner: true,
      hasPreferredPartner: true,
      marketplaceParticipantCount: 2,
      preferredAwaitingDecision: true,
      responseWindowExpired: false,
      status: 'OPEN_MATCHING',
    });
  });
});
