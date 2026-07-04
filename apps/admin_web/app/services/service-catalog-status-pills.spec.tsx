import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

import { ServiceCatalogStatusPills } from './service-catalog-status-pills';

describe('ServiceCatalogStatusPills', () => {
  it('uses the shared Vuexy status badge atom', () => {
    const source = readFileSync('app/services/service-catalog-status-pills.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-success">{serviceTypeCount} service type(s)</span>');
    expect(source).not.toContain('<span className="pill pill-info">{activeServiceCount} active duration option(s)</span>');
    expect(source).not.toContain('<span className="pill pill-info">{payoutRuleCount} payout rule(s)</span>');
    expect(source).not.toContain("<span className={`pill ${activeTaxPolicy ? 'pill-success' : 'pill-warn'}`}>");
  });

  it('keeps service catalog summary labels visible', () => {
    const markup = renderToStaticMarkup(
      <ServiceCatalogStatusPills
        activeServiceCount={6}
        activeTaxPolicy={{
          effectiveFrom: '2026-07-01T00:00:00.000Z',
          id: 'tax-1',
          name: 'VAT 8%',
          status: 'ACTIVE',
        }}
        payoutRuleCount={3}
        serviceTypeCount={2}
      />,
    );

    expect(markup).toContain('2 service type(s)');
    expect(markup).toContain('6 active duration option(s)');
    expect(markup).toContain('3 payout rule(s)');
    expect(markup).toContain('Tax: VAT 8%');
  });
});
