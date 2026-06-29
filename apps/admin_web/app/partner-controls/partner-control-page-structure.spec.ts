import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('partner control page structure', () => {
  it('uses server paged report and account control queues with visible Vuexy pagination', () => {
    const pageSource = readFileSync(join(process.cwd(), 'app/partner-controls/page.tsx'), 'utf8');

    expect(pageSource).toContain('buildPartnerControlPageLoadPlan(params)');
    expect(pageSource).toContain('AdminRoundedPagination');
    expect(pageSource).toContain("partnerControlListHref(params, 'reportPage', page)");
    expect(pageSource).toContain("partnerControlListHref(params, 'sanctionPage', page)");
    expect(pageSource).toContain('partnerControlEstimatedTotalPages(visibleReports.length');
    expect(pageSource).toContain('partnerControlEstimatedTotalPages(visibleSanctions.length');
  });
});
