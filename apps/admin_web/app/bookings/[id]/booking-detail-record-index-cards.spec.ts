import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingDetailRecordIndexCards } from './booking-detail-record-index-cards';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-record-index-cards',
    participants: [],
    status: 'MATCHED',
    ...input,
  } as AdminBookingDetail;
}

function baseInput(input: AdminBookingDetail) {
  return {
    booking: input,
    participantCounts: {
      firstPick: 1,
      marketplace: 3,
      total: 4,
    },
    messageCount: 2,
    paymentEvidence: {
      paymentAmountLabel: '500.000 VND',
      paymentStatus: 'AUTHORIZED',
    },
    financeTrace: {
      platformFee: '120.000 VND',
      providerPayout: '380.000 VND',
      payoutRuleStatus: 'Rule active',
      serviceOption: 'Swedish 60m',
      walletLedger: 'No entry',
      withholding: '30.000 VND',
    },
    providerLocationMetric: {
      helper: 'Updated just now',
      value: 'Recent',
    },
    communicationMovementStatus: 'Ready',
    locationTrailCount: 1,
    notificationCount: 5,
    marketplaceAlertBatchCount: 2,
    operatorNoteCount: 1,
    activityRecordCount: 9,
  };
}

describe('bookingDetailRecordIndexCards', () => {
  it('builds full record index cards for linked booking evidence', () => {
    const input = booking({
      chatRoom: { id: 'chat-room-1234567890' } as AdminBookingDetail['chatRoom'],
      customerProfile: {
        id: 'customer-profile-1',
        user: {
          fullName: 'Mai Customer',
          phone: '+84000000001',
        },
      } as AdminBookingDetail['customerProfile'],
      earning: {
        id: 'earning-row-1234567890',
        status: 'READY',
      } as AdminBookingDetail['earning'],
      payment: { method: 'CARD', status: 'AUTHORIZED' } as AdminBookingDetail['payment'],
      preferredProvider: {
        id: 'partner-preferred',
        displayName: 'Preferred Partner',
      } as AdminBookingDetail['preferredProvider'],
    });

    const cards = bookingDetailRecordIndexCards(baseInput(input));

    expect(cards.map((card) => card.label)).toEqual([
      'Customer',
      'Partners',
      'Chat record',
      'Payment and wallet',
      'Finance evidence',
      'Earnings ledger',
      'Cash settlement desk',
      'Tax policy',
      'Service and pricing',
      'Location trail',
      'Communication and movement',
      'Alerts',
      'Operator notes',
      'Activity timeline',
    ]);
    expect(cards.find((card) => card.label === 'Customer')).toMatchObject({
      helper: 'Mai Customer',
      value: '+84000000001',
    });
    expect(cards.find((card) => card.label === 'Chat record')).toMatchObject({
      helper: 'Room chat-roo',
      value: '2',
    });
    expect(cards.find((card) => card.label === 'Cash settlement desk')).toMatchObject({
      helper: 'No cash wallet debt',
      value: 'Clear or non-cash',
    });
  });

  it('keeps cash debt and missing record copy visible', () => {
    const input = booking({
      earning: {
        id: 'earning-cash-debt',
        netAmount: -120000,
        status: 'PENDING',
      } as AdminBookingDetail['earning'],
      payment: { method: 'CASH', status: 'CAPTURED' } as AdminBookingDetail['payment'],
    });

    const cards = bookingDetailRecordIndexCards({
      ...baseInput(input),
      financeTrace: {
        ...baseInput(input).financeTrace,
        walletLedger: '-120.000 VND / 1 entry',
      },
    });

    expect(cards.find((card) => card.label === 'Customer')).toMatchObject({
      helper: 'Customer profile',
      value: 'No phone',
    });
    expect(cards.find((card) => card.label === 'Chat record')).toMatchObject({
      helper: 'No chat room yet',
    });
    expect(cards.find((card) => card.label === 'Cash settlement desk')).toMatchObject({
      helper: '-120.000 VND / 1 entry',
      value: 'Settlement needed',
    });
  });
});
