import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { vi } from 'vitest';

import { adminGetResult } from '../../lib/admin-api';
import CouponsPage from './page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');
  return { ...actual, adminGetResult: vi.fn() };
});

const mockedAdminGetResult = vi.mocked(adminGetResult);
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

describe('CouponsPage', () => {
  beforeEach(() => {
    mockedAdminGetResult.mockReset();
    mockedAdminGetResult.mockImplementation(async (_href, fallback) => ({ data: fallback, ok: true, status: 200 }));
  });

  it('keeps the default payload small and does not fetch usage until requested', async () => {
    await CouponsPage({ searchParams: Promise.resolve({}) });
    const hrefs = mockedAdminGetResult.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/coupons?take=10&state=live');
    expect(hrefs).toContain('/admin/coupons/summary?state=live');
    expect(hrefs.some((href) => String(href).includes('/usage?'))).toBe(false);
  });

  it('loads exact coupon detail independently before usage or editing', async () => {
    await CouponsPage({
      searchParams: Promise.resolve({ usageCouponId: 'coupon-page-2', usagePage: '3' }),
    });
    const hrefs = mockedAdminGetResult.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/coupons/coupon-page-2');
    expect(hrefs).toContain('/admin/coupons/coupon-page-2/usage?take=10&skip=20');
  });

  it('does not fetch usage when only editing is selected', async () => {
    await CouponsPage({ searchParams: Promise.resolve({ editCouponId: 'coupon-1' }) });
    const hrefs = mockedAdminGetResult.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/coupons/coupon-1');
    expect(hrefs.some((href) => String(href).includes('/usage?'))).toBe(false);
  });

  it('paginates the coupon list after applying DB-backed state and search filters', async () => {
    await CouponsPage({
      searchParams: Promise.resolve({ couponPage: '2', q: 'welcome', view: 'records' }),
    });
    const hrefs = mockedAdminGetResult.mock.calls.map(([href]) => href);

    expect(hrefs).toContain('/admin/coupons?take=10&state=records&q=welcome&skip=10');
    expect(hrefs).toContain('/admin/coupons/summary?state=records&q=welcome');
  });

  it('renders a page-2 confirmation from the independent coupon lookup', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href === '/admin/coupons/coupon-page-2') {
        return {
          data: { active: false, code: 'PAGE2', discount: { type: 'percent', value: 10 }, id: 'coupon-page-2' },
          ok: true,
          status: 200,
        };
      }
      return { data: fallback, ok: true, status: 200 };
    });

    const page = await CouponsPage({
      searchParams: Promise.resolve({
        confirm: 'toggle',
        couponId: 'coupon-page-2',
        couponPage: '2',
        view: 'records',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Activate PAGE2?');
    expect(markup).toContain('name="returnTo"');
    expect(markup).toContain('/coupons?couponPage=2&amp;view=records');
  });

  it('does not render zero KPI values or mutation links when summary fails', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (String(href).includes('/summary')) return { data: fallback, ok: false, status: 503 };
      if (String(href).startsWith('/admin/coupons?')) {
        return {
          data: [{ active: true, code: 'WELCOME10', discount: { type: 'percent', value: 10 }, id: 'coupon-1' }],
          ok: true,
          status: 200,
        };
      }
      return { data: fallback, ok: true, status: 200 };
    });

    const markup = renderToStaticMarkup(await CouponsPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('Coupon summary unavailable');
    expect(markup).toContain('Create unavailable');
    expect(markup).toContain('Actions unavailable');
    expect(markup).not.toContain('Live checkout codes');
    expect(markup).toContain('Count unavailable');
  });

  it('shows current scope and explicit ICT freshness when summary succeeds', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href === '/admin/coupons/summary?state=live') {
        return {
          data: {
            expiredCount: 3,
            filteredCount: 2,
            generatedAt: '2026-06-10T09:00:00.000Z',
            liveCount: 2,
            pausedCount: 4,
            scheduledCount: 1,
            totalCount: 10,
          },
          ok: true,
          status: 200,
        };
      }
      return { data: fallback, ok: true, status: 200 };
    });

    const markup = renderToStaticMarkup(await CouponsPage({ searchParams: Promise.resolve({}) }));

    expect(markup).toContain('Live checkout codes');
    expect(markup).toContain('Scheduled launches');
    expect(markup).toContain('Inactive records');
    expect(markup).toContain('Current');
    expect(markup).toContain('ICT');
    expect(markup).toContain('Refresh now');
  });

  it('uses result-aware reads and a separate create drawer instead of a persistent form', () => {
    expect(pageSource).toContain('adminGetResult');
    expect(pageSource).not.toContain('adminGet<');
    expect(pageSource).toContain('CouponCreateDrawer');
    expect(pageSource).not.toContain('coupons-create-panel');
    expect(pageSource).toContain('AdminTablePaginationFooter');
  });
});
