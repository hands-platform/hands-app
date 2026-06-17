import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingMonitorNextActions } from './booking-monitor-next-actions-model';

const nowMs = new Date('2026-06-07T10:00:00.000Z').getTime();

const readyService = {
  price: 200000,
  service: {
    basePrice: 100000,
    payoutRules: [
      {
        active: true,
        customerPrice: 200000,
        providerPayoutAmount: 150000,
      },
    ],
    priceStep: 100000,
  },
};

describe('buildBookingMonitorNextActions', () => {
  it('returns flagged booking actions without duplicating normal active monitoring', () => {
    const actions = buildBookingMonitorNextActions(
      [
        {
          chatRoom: { id: 'chat-1', messages: [{ id: 'message-1' }] },
          id: 'arrived-clean',
          services: [readyService],
          selectedProvider: {
            currentLat: '10.7769',
            currentLng: '106.7009',
            currentLocationUpdatedAt: '2026-06-07T09:55:00.000Z',
          },
          status: 'ARRIVED',
          updatedAt: '2026-06-07T09:55:00.000Z',
        } as unknown as AdminBooking,
        {
          id: 'matched-without-chat',
          services: [readyService],
          selectedProvider: { id: 'partner-1' },
          status: 'MATCHED',
          updatedAt: '2026-06-07T09:50:00.000Z',
        } as unknown as AdminBooking,
      ],
      nowMs,
    );

    expect(actions[0]).toMatchObject({
      booking: { id: 'matched-without-chat' },
      title: 'Matched without chat',
      tone: 'danger',
    });
    expect(actions).toHaveLength(1);
  });

  it('returns no action for inactive calm bookings', () => {
    expect(
      buildBookingMonitorNextActions(
        [
          {
            earning: {
              platformFeeLogs: [{ id: 'fee-log' }],
              taxLogs: [{ id: 'tax-log' }],
              walletLedgerEntries: [{ id: 'wallet-log' }],
            },
            id: 'completed-clean',
            payment: { status: 'CAPTURED' },
            services: [readyService],
            status: 'COMPLETED',
          } as unknown as AdminBooking,
        ],
        nowMs,
      ),
    ).toEqual([]);
  });
});
