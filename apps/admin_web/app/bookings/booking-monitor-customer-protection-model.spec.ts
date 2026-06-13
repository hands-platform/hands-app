import type { AdminBooking } from '../../lib/admin-api';
import { buildBookingMonitorCustomerProtectionBoard } from './booking-monitor-customer-protection-model';

describe('buildBookingMonitorCustomerProtectionBoard', () => {
  it('builds unresolved terminal payment lanes from booking facts', () => {
    const lanes = buildBookingMonitorCustomerProtectionBoard([
      {
        id: 'cancelled-payment',
        payment: { status: 'AUTHORIZED' },
        status: 'CANCELLED',
      } as unknown as AdminBooking,
    ]);

    expect(lanes[0]).toMatchObject({
      bookings: [{ id: 'cancelled-payment' }],
      status: 'Release/refund',
      title: 'Cancelled payment release',
      tone: 'danger',
    });
  });
});
