import { readFileSync } from 'fs';
import { join } from 'path';

describe('partner detail page structure', () => {
  it('keeps activity CSV export bounded inside the SSR page', () => {
    const pageSource = readFileSync(join(process.cwd(), 'app/partners/[id]/page.tsx'), 'utf8');

    expect(pageSource).toContain('PARTNER_ACTIVITY_CSV_EXPORT_LIMIT = 30');
    expect(pageSource).toContain('filteredPartnerActivityRecords.slice(0, PARTNER_ACTIVITY_CSV_EXPORT_LIMIT)');
  });

  it('keeps review and evaluation record requests bounded inside the full detail page', () => {
    const pageSource = readFileSync(join(process.cwd(), 'app/partners/[id]/page.tsx'), 'utf8');

    expect(pageSource).toContain('PARTNER_DETAIL_REVIEW_RECORD_LIMIT = 10');
    expect(pageSource).toContain("take: String(PARTNER_DETAIL_REVIEW_RECORD_LIMIT)");
  });

  it('loads bounded manual wallet adjustment history only on the full detail page', () => {
    const pageSource = readFileSync(join(process.cwd(), 'app/partners/[id]/page.tsx'), 'utf8');

    expect(pageSource).toContain('AdminManualWalletAdjustmentHistory');
    expect(pageSource).toContain('partnerManualAdjustmentRows');
    expect(pageSource).toContain('/admin/wallet-adjustments?ownerType=PARTNER');
  });
});
