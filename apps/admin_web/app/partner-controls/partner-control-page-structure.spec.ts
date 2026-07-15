import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('partner control page structure', () => {
  it('uses server paged report and account control queues with visible Vuexy pagination', () => {
    const pageSource = readFileSync(join(process.cwd(), 'app/partner-controls/page.tsx'), 'utf8');

    expect(pageSource).toContain('buildPartnerControlPageLoadPlan(params)');
    expect(pageSource).toContain('AdminTablePaginationFooter');
    expect(pageSource).not.toContain('import { AdminRoundedPagination }');
    expect(pageSource).not.toContain('<AdminRoundedPagination');
    expect(pageSource).toContain("partnerControlListHref(params, 'reportPage', page)");
    expect(pageSource).toContain("partnerControlListHref(params, 'sanctionPage', page)");
    expect(pageSource).toContain('partnerControlEstimatedTotalPages(visibleReports.length');
    expect(pageSource).toContain('partnerControlEstimatedTotalPages(visibleSanctions.length');
  });

  it('uses shared admin form controls for filter and report action forms', () => {
    const pageSource = readFileSync(join(process.cwd(), 'app/partner-controls/page.tsx'), 'utf8');

    expect(pageSource).toContain('AdminFormInput');
    expect(pageSource).toContain('AdminFilterPanel');
    expect(pageSource).toContain('AdminFormSearch');
    expect(pageSource).toContain('AdminFormSelect');
    expect(pageSource).toContain('AdminFormTextarea');
    expect(pageSource).toContain('AdminFormControlButton');
    expect(pageSource).toContain('AdminFormControlLink');
    expect(pageSource).not.toContain('<label>\n            Search\n            <input');
    expect(pageSource).not.toContain('<label>\n            Partner\n            <select');
    expect(pageSource).not.toContain('<textarea\n              name="details"');
    expect(pageSource).not.toContain('<button className="button button-primary" type="submit">');
  });
});
