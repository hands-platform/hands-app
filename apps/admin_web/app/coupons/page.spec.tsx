import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
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
const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const globalCss = readFileSync('app/globals.css', 'utf8');

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
    expect(markup).toContain('form-grid coupon-create-form');
    expect(markup).toContain('admin-form-textarea-compact');
    expect(markup).not.toContain('coupon-create-form-field');
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

  it('uses the shared table pagination footer for the coupon list', () => {
    expect(pageSource).toContain('AdminTablePaginationFooter');
    expect(pageSource).toContain('ariaLabel="Coupon list pagination"');
    expect(pageSource).not.toContain('import { AdminRoundedPagination }');
    expect(pageSource).not.toContain('<AdminRoundedPagination');
  });

  it('scopes coupon creation notice copy to the shared inline notice message slot', () => {
    expect(globalCss).toContain('.coupon-create-notice .admin-inline-notice-message > strong');
    expect(globalCss).toContain('.coupon-create-notice .admin-inline-notice-message > span');

    expect(globalCss).not.toContain('.coupon-create-notice strong {');
    expect(globalCss).not.toContain('.coupon-create-notice span {');
  });

  it('keeps coupon creation date fields wide enough for the Vuexy datepicker input', () => {
    const formIndex = globalCss.indexOf('.coupon-create-form {');
    const formBlock = cssRuleBlockAt(formIndex);
    const buttonIndex = globalCss.indexOf('.coupon-create-form .admin-form-control-button {');
    const buttonBlock = cssRuleBlockAt(buttonIndex);

    expect(formIndex).toBeGreaterThan(-1);
    expect(formBlock).toContain('repeat(2, minmax(210px, 0.75fr))');
    expect(buttonIndex).toBeGreaterThan(formIndex);
    expect(buttonBlock).toContain('inline-size: max-content');
    expect(buttonBlock).toContain('justify-self: start');
  });
});

function cssRuleBlockAt(index: number) {
  if (index < 0) {
    return '';
  }

  const endIndex = globalCss.indexOf('}', index);
  return globalCss.slice(index, endIndex + 1);
}
