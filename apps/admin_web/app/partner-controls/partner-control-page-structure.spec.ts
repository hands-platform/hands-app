import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('partner control page structure', () => {
  const pageSource = readFileSync(join(process.cwd(), 'app/partner-controls/page.tsx'), 'utf8');
  const cssSource = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

  it('uses exact server totals and one shared pagination footer', () => {
    expect(pageSource).toContain('AdminTablePaginationFooter');
    expect(pageSource).toContain('page.totalCount');
    expect(pageSource).toContain('partnerControlListHref(params, pageParam, nextPage)');
    expect(pageSource).not.toContain('partnerControlEstimatedTotalPages');
    expect(pageSource).not.toContain('<AdminRoundedPagination');
  });

  it('removes the forced nested scroll and 1180px Partner Controls table', () => {
    const partnerCss = cssSource.slice(
      cssSource.indexOf('.partner-controls-page'),
      cssSource.indexOf('.earnings-page,', cssSource.indexOf('.partner-controls-page')),
    );
    expect(partnerCss).toContain('max-height: none');
    expect(partnerCss).toContain('overflow: visible');
    expect(partnerCss).toContain('table-layout: auto');
    expect(partnerCss).not.toContain('min-width: 1180px');
    expect(partnerCss).toContain('@media (max-width: 1199px)');
    expect(partnerCss).toContain('content: attr(data-label)');
  });

  it('uses shared labeled controls and explicit restriction confirmation', () => {
    expect(pageSource).toContain('AdminFormSearch');
    expect(pageSource).toContain('AdminFormSelect');
    expect(pageSource).toContain('AdminFormTextarea');
    expect(pageSource).toContain('name="confirmation"');
    expect(pageSource).toContain('minLength={12}');
    expect(pageSource).toContain('name="noExpiry"');
  });

  it('routes every filter form through the shared canonical submit action', () => {
    expect(pageSource.match(/action=\{applyPartnerControlFilters\}/gu)).toHaveLength(4);
    expect(pageSource).not.toContain('action="/partner-controls" method="get"');
  });

  it('keeps desktop filter actions beside the final control with a readable search width', () => {
    expect(pageSource.match(/className="partner-control-filter-grid"/gu)).toHaveLength(4);
    expect(pageSource.match(/<AdminFormActionRow wide=\{false\}>/gu)).toHaveLength(4);
    expect(cssSource).toContain('@media (min-width: 1200px)');
    expect(cssSource).toContain('.partner-control-filter-grid');
    expect(cssSource).toContain('minmax(280px, 1.4fr)');
    expect(cssSource).toContain('justify-content: flex-start');
  });
});
