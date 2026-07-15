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

  it('describes coupon KPI scope as an active bounded queue instead of a vague current queue', () => {
    expect(source).toContain('Period coupon discount applied to customer payment.');
    expect(source).not.toContain('current bounded queue');
  });

  it('makes coupon finance KPI cards explicit about period, risk, and records scope', () => {
    expect(source).toContain('const couponRangeScope = dateRangeLabel(filters.range);');
    expect(source).toContain('scope: couponRangeScope');
    expect(source).toContain("scope: 'Needs action'");
    expect(source).toContain("kind: 'risk'");
    expect(source).toContain("scope: 'Reversal records'");
    expect(source).not.toContain('Coupon discount amount applied to customer payment in the active bounded queue.');
  });
});
