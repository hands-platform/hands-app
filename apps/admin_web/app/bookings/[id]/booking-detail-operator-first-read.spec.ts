import type { AdminBookingDetail } from '../../../lib/admin-api';
import { bookingFinalPartnerSummary } from './booking-final-partner-summary';
import { bookingDetailOperatorFirstRead } from './booking-detail-operator-first-read';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-operator-first-read',
    participants: [],
    status: 'MATCHED',
    ...input,
  } as AdminBookingDetail;
}

function baseInput(input: AdminBookingDetail) {
  return {
    booking: input,
    addressLine: 'District service address',
    addressPin: '10.7627, 106.6603',
    matchingRuleStatus: 'Policy ready',
    customerWaitSignalStatus: 'Waiting',
    eligibleMarketplaceCount: 4,
    finalPartnerSummary: bookingFinalPartnerSummary(input),
    participantCounts: { marketplace: 3, total: 4 },
    messageCount: 2,
    paymentEvidence: {
      paymentQueueValue: 'AUTHORIZED',
      paymentMethodAmountLabel: 'CARD / 500.000 VND',
    },
    financeTrace: {
      walletLedger: 'No entry',
      platformFee: '120.000 VND',
    },
  };
}

describe('bookingDetailOperatorFirstRead', () => {
  it('builds first read rows for selected Partner and retained chat', () => {
    const input = booking({
      chatRoom: { id: 'chat-room-1234567890' } as AdminBookingDetail['chatRoom'],
      payment: { method: 'CARD', status: 'AUTHORIZED' } as AdminBookingDetail['payment'],
      selectedProvider: {
        id: 'partner-selected',
        displayName: 'Linh Partner',
      } as AdminBookingDetail['selectedProvider'],
    });

    const rows = bookingDetailOperatorFirstRead(baseInput(input));

    expect(rows.map((row) => row.label)).toEqual([
      'Service address',
      'Matching state',
      'Customer choice',
      'Marketplace participants',
      'Chat evidence',
      'Money path',
    ]);
    expect(rows.find((row) => row.label === 'Customer choice')).toMatchObject({
      href: '/partners/partner-selected',
      value: 'Linh Partner',
      detail: 'Final Partner exists; confirm chat handoff before service coordination.',
    });
    expect(rows.find((row) => row.label === 'Service address')).toMatchObject({
      detail: 'District service address',
      value: 'Service address record saved',
    });
    expect(JSON.stringify(rows)).not.toMatch(/\d{1,3}\.\d{4,6},\s*\d{1,3}\.\d{4,6}/);
    expect(rows.find((row) => row.label === 'Chat evidence')).toMatchObject({
      value: '2 messages',
    });
    expect(rows.find((row) => row.label === 'Money path')).toMatchObject({
      href: '#payment',
      detail: 'CARD / 500.000 VND.',
    });
  });

  it('keeps pending final Partner and cash settlement path visible', () => {
    const input = booking({
      earning: {
        currency: 'VND',
        netAmount: -120000,
        status: 'PENDING',
      } as unknown as AdminBookingDetail['earning'],
      payment: { method: 'CASH', status: 'CAPTURED' } as AdminBookingDetail['payment'],
    });

    const rows = bookingDetailOperatorFirstRead({
      ...baseInput(input),
      financeTrace: {
        walletLedger: '-120.000 VND / 1 entry',
        platformFee: '120.000 VND',
      },
    });

    expect(rows.find((row) => row.label === 'Customer choice')).toMatchObject({
      value: 'Pending',
      detail: 'Customer must choose the final Partner before matched chat opens.',
    });
    expect(rows.find((row) => row.label === 'Chat evidence')).toMatchObject({
      value: 'Missing room',
    });
    expect(rows.find((row) => row.label === 'Money path')).toMatchObject({
      href: '/cash-settlements',
      detail: '-120.000 VND / 1 entry / 120.000 VND HANDS fee.',
    });
  });
});
