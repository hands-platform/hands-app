import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../lib/admin-api';
import BookingSettlementAuditPage from './booking-settlement-audit/page';
import CouponFinancePage from './coupon-finance/page';
import SettlementReversalsPage from './settlement-reversals/page';

vi.mock('../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../lib/admin-api')>('../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

const mockedAdminGet = vi.mocked(adminGet);

describe('finance list pages', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
  });

  it.each([
    ['booking settlement audit', BookingSettlementAuditPage, 'Settlement audit filters', 'Booking settlement snapshot rows'],
    ['coupon finance', CouponFinancePage, 'Coupon finance filters', 'Coupon settlement rows'],
    ['settlement reversals', SettlementReversalsPage, 'Settlement reversal filters', 'Settlement reversal rows'],
  ] as const)('renders %s filters and rows with Vuexy table panels', async (_name, Page, filterTitle, tableTitle) => {
    const page = await Page({
      searchParams: Promise.resolve({ range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain(filterTitle);
    expect(markup).toContain(tableTitle);
    expect(markup).toContain('card admin-filter-panel admin-mb-16');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).not.toContain('card admin-card-scroll');
  });
});
