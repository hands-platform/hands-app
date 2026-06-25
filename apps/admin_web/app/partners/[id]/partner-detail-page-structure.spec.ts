import { readFileSync } from 'fs';
import { join } from 'path';

describe('partner detail page structure', () => {
  it('keeps activity CSV export bounded inside the SSR page', () => {
    const pageSource = readFileSync(join(process.cwd(), 'app/partners/[id]/page.tsx'), 'utf8');

    expect(pageSource).toContain('PARTNER_ACTIVITY_CSV_EXPORT_LIMIT = 30');
    expect(pageSource).toContain('filteredPartnerActivityRecords.slice(0, PARTNER_ACTIVITY_CSV_EXPORT_LIMIT)');
  });
});
