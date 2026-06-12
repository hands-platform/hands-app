import type { AdminBooking } from '../../lib/admin-api';
import {
  bookingMarketplaceOperationsBookingFact,
  bookingMarketplaceOperationsBookingFactFromBooking,
} from './booking-marketplace-operations-card-inputs';

function booking(input: Partial<AdminBooking>): AdminBooking {
  return input as AdminBooking;
}

describe('bookingMarketplaceOperationsBookingFact', () => {
  it('builds operations card facts from booking data and marketplace facts', () => {
    const nowMs = Date.parse('2026-06-12T10:00:00.000Z');
    const item = booking({
      earning: {
        currency: 'VND',
        netAmount: -150000,
        status: 'PENDING',
      } as AdminBooking['earning'],
      id: 'booking-1',
      metadata: {
        backupNotificationTraces: [
          {
            createdAt: '2026-06-12T09:50:00.000Z',
            notifiedCount: 2,
            stage: 'retry',
          },
        ],
      },
      payment: { method: 'CASH' } as AdminBooking['payment'],
      status: 'OPEN_MATCHING',
    });

    expect(
      bookingMarketplaceOperationsBookingFact(item, nowMs, {
        hasCustomerSelectablePartner: true,
        marketplaceParticipantCount: 2,
        selectedPartnerPresent: false,
      }),
    ).toEqual({
      alertTraceBatchCount: 1,
      hasCustomerSelectablePartner: true,
      hasWalletDebt: true,
      marketplaceParticipantCount: 2,
      selectedPartnerPresent: false,
      status: 'OPEN_MATCHING',
    });
  });

  it('builds operations card facts from booking selection and marketplace counts', () => {
    const nowMs = Date.parse('2026-06-12T10:00:00.000Z');
    const item = booking({
      id: 'booking-2',
      matchingEvidence: {
        finalSelection: 'CUSTOMER_SELECTED_PARTNER',
      } as AdminBooking['matchingEvidence'],
      status: 'OPEN_MATCHING',
    });

    expect(
      bookingMarketplaceOperationsBookingFactFromBooking(item, nowMs, {
        customerSelectableCount: 2,
        marketplaceParticipantCount: 3,
      }),
    ).toEqual({
      alertTraceBatchCount: 0,
      hasCustomerSelectablePartner: true,
      hasWalletDebt: false,
      marketplaceParticipantCount: 3,
      selectedPartnerPresent: true,
      status: 'OPEN_MATCHING',
    });
  });
});
