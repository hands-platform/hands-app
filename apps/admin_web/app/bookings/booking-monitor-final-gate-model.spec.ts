import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingMonitorFinalGateReason } from './booking-monitor-final-gate-model';

describe('buildBookingMonitorFinalGateReason', () => {
  it('routes cash fee debt bookings to settlement review', () => {
    expect(
      buildBookingMonitorFinalGateReason({
        earning: {
          netAmount: -20_000,
          status: 'PENDING',
        },
        id: 'cash-debt',
        payment: {
          method: 'CASH',
        },
        status: 'OPEN_MATCHING',
      } as unknown as AdminBooking),
    ).toMatchObject({
      href: '/cash-settlements',
      label: 'Wallet debt gate',
      tone: 'pill-danger',
    });
  });

  it('flags matched bookings without chat as handoff repair work', () => {
    expect(
      buildBookingMonitorFinalGateReason({
        addressSnapshot: { id: 'address-1' },
        id: 'matched-no-chat',
        status: 'MATCHED',
      } as unknown as AdminBooking),
    ).toMatchObject({
      href: '/bookings?view=chat-repair',
      label: 'Chat handoff gate',
      tone: 'pill-danger',
    });
  });
});
