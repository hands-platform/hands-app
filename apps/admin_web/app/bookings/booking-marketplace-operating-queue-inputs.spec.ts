import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMarketplaceOperatingQueueFact,
  bookingMarketplaceOperatingQueueFactFromBooking,
} from './booking-marketplace-operating-queue-inputs';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

const nowMs = new Date('2026-06-12T10:00:00.000Z').getTime();

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

  it('builds queue facts from booking timing and marketplace counts', () => {
    expect(
      bookingMarketplaceOperatingQueueFactFromBooking(
        booking({
          expiresAt: '2026-06-12T09:45:00.000Z',
          id: 'booking-2',
          preferredProvider: { id: 'preferred' } as AdminBooking['preferredProvider'],
          status: 'OPEN_MATCHING',
        }),
        nowMs,
        {
          customerSelectableCount: 1,
          marketplaceParticipantCount: 3,
          preferredAwaitingDecision: true,
        },
      ),
    ).toMatchObject({
      cashDebtNeedsOps: false,
      chatRepairNeedsOps: false,
      hasCustomerSelectablePartner: true,
      hasPreferredPartner: true,
      marketplaceParticipantCount: 3,
      preferredAwaitingDecision: true,
      responseWindowExpired: true,
      status: 'OPEN_MATCHING',
    });
  });
});
