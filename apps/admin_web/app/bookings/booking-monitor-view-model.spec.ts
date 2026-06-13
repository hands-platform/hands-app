import type { AdminBooking } from '../../lib/admin-api';
import { bookingMonitorMatchesView } from './booking-monitor-view-model';

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

describe('bookingMonitorMatchesView', () => {
  it('matches attention view from high-priority booking checks', () => {
    expect(
      bookingMonitorMatchesView(
        {
          expiresAt: '2026-06-07T09:45:00.000Z',
          id: 'expired-open-matching',
          participants: [],
          services: [readyService],
          status: 'OPEN_MATCHING',
        } as unknown as AdminBooking,
        'attention',
        nowMs,
      ),
    ).toBe(true);
  });

  it('matches payment view from booking payment facts', () => {
    expect(
      bookingMonitorMatchesView(
        {
          id: 'open-payment',
          services: [readyService],
          status: 'OPEN_MATCHING',
        } as unknown as AdminBooking,
        'payment',
        nowMs,
      ),
    ).toBe(true);
  });

  it('matches stage views from list stage facts', () => {
    expect(
      bookingMonitorMatchesView(
        {
          id: 'marketplace-choice',
          participants: [{ providerProfile: { id: 'partner-1' }, status: 'JOINED' }],
          services: [readyService],
          status: 'OPEN_MATCHING',
        } as unknown as AdminBooking,
        'customer-choice',
        nowMs,
      ),
    ).toBe(true);
  });
});
