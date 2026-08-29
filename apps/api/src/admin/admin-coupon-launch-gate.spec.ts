import { AdminCouponRoutes } from './admin-coupon.routes';
import { CustomersController } from '../customers/customers.controller';

describe('Coupon launch route gates', () => {
  it('rejects Admin mutation and customer preview before their services are called', () => {
    vi.stubEnv('COUPON_LAUNCH_ENABLED', 'false');
    try {
      const admin = { createCoupon: vi.fn() };
      const adminRoutes = new AdminCouponRoutes(admin as never);
      const customers = { previewCoupon: vi.fn() };
      const customerController = new CustomersController(customers as never);

      expect(() => adminRoutes.createCoupon({ id: 'admin-1' } as never, {} as never)).toThrow(
        'Coupons are not active for the current launch',
      );
      expect(() => customerController.previewCoupon({} as never)).toThrow(
        'Coupons are not active for the current launch',
      );
      expect(admin.createCoupon).not.toHaveBeenCalled();
      expect(customers.previewCoupon).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
