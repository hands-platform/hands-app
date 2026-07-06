import { readFileSync } from 'node:fs';

describe('ServicePricingHealthSection source', () => {
  it('uses the shared Vuexy stage item atom for pricing health rows', () => {
    const source = readFileSync('app/services/service-pricing-health-section.tsx', 'utf8');

    expect(source).toContain('AdminStageItem');
    expect(source).not.toContain('className="setup-stage-item"');
  });
});
