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
});
