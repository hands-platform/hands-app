import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import CouponsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('CouponsPage', () => {
  beforeEach(() => {
    mockedAdminGet.mockReset();
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it('keeps the default coupon list payload small and fetches usage only on demand', async () => {
    await CouponsPage({
      searchParams: Promise.resolve({}),
    });

    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/coupons?take=25');
    expect(hrefs).toContain('/admin/coupons/summary');
    expect(hrefs.some((href) => String(href).includes('/usage?'))).toBe(false);
  });

  it('fetches one paged coupon usage list when a coupon is selected', async () => {
    await CouponsPage({
      searchParams: Promise.resolve({ usageCouponId: 'coupon-1', usagePage: '3' }),
    });

    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/coupons/coupon-1/usage?take=10&skip=20');
  });
});
