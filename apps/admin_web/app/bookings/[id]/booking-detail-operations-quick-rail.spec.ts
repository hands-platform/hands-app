import type { AdminBookingDetail, AdminLocationSnapshot } from '../../../lib/admin-api';
import { bookingDetailOperationsQuickRail } from './booking-detail-operations-quick-rail';

function booking(input: Partial<AdminBookingDetail>): AdminBookingDetail {
  return {
    createdAt: '2026-06-14T01:00:00.000Z',
    id: 'booking-detail-operations-quick-rail',
    participants: [],
    status: 'MATCHED',
    ...input,
  } as AdminBookingDetail;
}

function location(input: Partial<AdminLocationSnapshot> = {}): AdminLocationSnapshot {
  return {
    id: 'location-1',
    lat: 10.7627,
    lng: 106.6603,
    providerProfileId: 'partner-1',
    recordedAt: '2999-01-01T00:00:00.000Z',
    ...input,
  } as AdminLocationSnapshot;
}

describe('bookingDetailOperationsQuickRail', () => {
  it('builds booking operations quick rail rows', () => {
    const rows = bookingDetailOperationsQuickRail({
      activityRecordCount: 9,
      addressLine: 'District service address',
      addressPin: '10.7627, 106.6603',
      booking: booking({
        chatRoom: { id: 'chat-room-1' } as AdminBookingDetail['chatRoom'],
        selectedProvider: {
          id: 'partner-selected',
          displayName: 'Linh Partner',
          locationSnapshots: [location()],
        } as AdminBookingDetail['selectedProvider'],
      }),
      connectedRecordCount: 6,
      evidenceLaneCount: 8,
      financeTrace: {
        netHandsFee: '90.000 VND',
        platformFee: '120.000 VND',
        withholding: '30.000 VND',
      },
      matchingRuleStatus: 'Policy ready',
      messageCount: 3,
      operatorPriorityStatus: 'Action first',
      operatorQueue: {
        commands: [{ id: 'location-request' }, { id: 'payment-review' }],
        status: '2 action(s)',
      },
      participantCounts: {
        marketplace: 4,
        total: 5,
      },
      paymentEvidence: {
        paymentStatus: 'AUTHORIZED',
        readablePaymentMethodAmountLabel: 'CARD / 500.000 VND',
      },
    });

    expect(rows.map((row) => row.label)).toEqual([
      'Priority',
      'Matching rules',
      'Evidence bundle',
      'Linked records',
      'Marketplace',
      'Chat',
      'Payment',
      'Fees and tax',
      'Address',
      'Location',
      'Operator queue',
      'Activity',
    ]);
    expect(rows.find((row) => row.label === 'Evidence bundle')).toMatchObject({
      value: '8 lanes',
    });
    expect(rows.find((row) => row.label === 'Marketplace')).toMatchObject({
      detail:
        '5 total participant row(s). First-pick and marketplace rows are separated for operator review.',
      value: '4 marketplace row(s)',
    });
    expect(rows.find((row) => row.label === 'Fees and tax')).toMatchObject({
      detail: '30.000 VND withholding / 90.000 VND net HANDS fee.',
      value: '120.000 VND',
    });
    expect(rows.find((row) => row.label === 'Address')).toMatchObject({
      detail: 'District service address',
      value: 'Service address record saved',
    });
    expect(JSON.stringify(rows)).not.toMatch(/\d{1,3}\.\d{4,6},\s*\d{1,3}\.\d{4,6}/);
    expect(rows.find((row) => row.label === 'Location')).toMatchObject({
      detail: 'Updated just now',
      value: 'Recent',
    });
    expect(rows.find((row) => row.label === 'Operator queue')).toMatchObject({
      detail: '2 same-shift command(s).',
      value: '2 action(s)',
    });
  });

  it('keeps missing chat and location copy visible', () => {
    const rows = bookingDetailOperationsQuickRail({
      activityRecordCount: 0,
      addressLine: 'No address',
      addressPin: 'No pin',
      booking: booking({ status: 'OPEN_MATCHING' }),
      connectedRecordCount: 0,
      evidenceLaneCount: 0,
      financeTrace: {
        netHandsFee: 'Not calculated',
        platformFee: 'Not calculated',
        withholding: 'Not created',
      },
      matchingRuleStatus: 'Waiting',
      messageCount: 0,
      operatorPriorityStatus: 'Monitoring',
      operatorQueue: {
        commands: [],
        status: 'Monitor',
      },
      participantCounts: {
        marketplace: 0,
        total: 0,
      },
      paymentEvidence: {
        paymentStatus: 'NONE',
        readablePaymentMethodAmountLabel: 'No payment',
      },
    });

    expect(rows.find((row) => row.label === 'Chat')).toMatchObject({
      value: 'Missing room',
    });
    expect(rows.find((row) => row.label === 'Location')).toMatchObject({
      detail: 'No Partner location shared yet',
      value: 'Missing',
    });
  });
});
