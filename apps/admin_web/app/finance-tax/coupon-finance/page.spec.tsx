import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('CouponFinancePage Vuexy links', () => {
  const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');

  it('uses the shared Vuexy text link atom for coupon finance links', () => {
    expect(source).toContain("import { AdminTextLink } from '../../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
  });

  it('keeps coupon finance CSV download off the page payload', () => {
    expect(source).toContain('buildCouponFinanceExportHref');
    expect(source).not.toContain('data:text/csv');
    expect(source).not.toContain('buildBookingSettlementSnapshotRowsCsvHref');
  });

  it('describes coupon totals as selected-range accounting values', () => {
    expect(source).toContain('Coupon discount applied to the customer-facing price.');
    expect(source).not.toContain('current bounded queue');
  });

  it('keeps action, period totals, filters, and records visible on one page', () => {
    expect(source).toContain('const couponRangeScope = dateRangeLabel(filters.range);');
    expect(source).toContain('<FinanceListCommandBoard ariaLabel="Coupon finance command board">');
    expect(source).toContain('label="Needs review"');
    expect(source).toContain('label="All coupon records"');
    expect(source).toContain('compact');
    expect(source).toContain('title="No coupon activity in this scope"');
    expect(source).toContain('title="Current filtered totals"');
    expect(source).toContain('id="coupon-finance-records"');
    expect(source).toContain('COUPON_FINANCE_REVIEW_LINKS');
    expect(source).toContain('FINANCE_ACCOUNTING_PAGE_SIZE_LINKS');
    expect(source).toContain('summary.reversedCompanyCouponExpense');
    expect(source).not.toContain('metrics={[');
    expect(source).not.toContain('Coupon discount amount applied to customer payment in the active bounded queue.');
    expect(source).not.toContain('customerProfile?.user?.phone');
    expect(source).not.toContain('providerProfile?.user?.phone');
    expect(source).not.toContain('No customer phone');
    expect(source).not.toContain('No partner phone');
  });
});
