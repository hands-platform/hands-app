import { renderToStaticMarkup } from 'react-dom/server';
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

    expect(hrefs).toContain('/admin/coupons?take=10');
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

  it('paginates the coupon list with server skip and take', async () => {
    await CouponsPage({
      searchParams: Promise.resolve({ couponPage: '3' }),
    });

    const hrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/coupons?take=10&skip=20');
  });

  it('keeps the coupon creation form on shared AdminForm atoms', async () => {
    const page = await CouponsPage({
      searchParams: Promise.resolve({}),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Create coupons');
    expect(markup).toContain('card admin-filter-panel coupons-create-panel');
    expect(markup).toContain('admin-filter-panel-body');
    expect(markup).toContain('admin-form-textarea');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('coupon-create-form-field');
    expect(markup).not.toContain('calendar-field');
    expect(markup).toContain('class="admin-form-control-button button button-primary" type="submit">Create coupons');
  });

  it('renders coupon save feedback through the shared Vuexy inline notice atom', async () => {
    const page = await CouponsPage({
      searchParams: Promise.resolve({ couponNotice: 'created', created: '2' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('class="admin-inline-notice admin-inline-notice-success coupon-create-notice"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('Coupon created');
    expect(markup).not.toContain('coupon-create-notice-success');
  });
});
