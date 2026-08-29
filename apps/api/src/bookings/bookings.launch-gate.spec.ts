import { BookingsService } from './bookings.service';

describe('Bookings coupon launch gate', () => {
  it('rejects coupon input before any booking dependency is called when launch is disabled', async () => {
    vi.stubEnv('COUPON_LAUNCH_ENABLED', 'false');
    try {
      await expect(
        BookingsService.prototype.createOpenMatchingBooking.call({} as BookingsService, 'customer-1', {
          couponCode: 'SAVE10',
          idempotencyKey: 'booking-key-1',
          paymentMethod: 'CASH',
          serviceId: 'service-1',
        }),
      ).rejects.toThrow('Coupons are not active for the current launch');
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
