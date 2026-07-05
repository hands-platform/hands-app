import { readFileSync } from 'node:fs';

import type { AdminServiceCatalogItem, AdminServicePayoutRule } from '../../lib/admin-api';
import { ServiceDurationPricingMatrixSection } from './service-duration-pricing-matrix-section';

describe('ServiceDurationPricingMatrixSection', () => {
  it('uses the shared Vuexy status badge atom for matrix state labels', () => {
    const source = readFileSync('app/services/service-duration-pricing-matrix-section.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain("<span className={`pill ${matrix.blockedCount ? 'pill-danger' : 'pill-success'}`}>");
    expect(source).not.toContain('<span className="pill pill-neutral">Not configured</span>');
    expect(source).not.toContain("className={cell.baseRule ? 'pill pill-success' : 'pill pill-danger'}");
  });

  it('uses shared money atoms for duration matrix amounts', () => {
    const source = readFileSync('app/services/service-duration-pricing-matrix-section.tsx', 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
  });

  it('renders the standard duration matrix, policy state, and hidden group copy', () => {
    const section = ServiceDurationPricingMatrixSection({
      activeTaxPolicy: undefined,
      hiddenGroupCount: 2,
      totalGroupCount: 3,
      visibleGroups: [
        {
          items: [
            serviceFixture({ durationMin: 60, id: 'foot-60' }),
            serviceFixture({ durationMin: 90, id: 'foot-90' }),
          ],
          key: 'foot',
          label: 'Foot Massage',
        },
      ],
    });

    const rendered = JSON.stringify(section);

    expect(section.type.name).toBe('AdminTableSection');
    expect(section.props).toMatchObject({
      bodyClassName: 'admin-table-section-body',
      className: 'admin-card-scroll admin-mb-16',
      statusLabel: '60 / 90 / 120 min',
      statusTone: 'info',
      title: 'Duration pricing matrix',
    });
    expect(rendered).toContain('Duration pricing matrix');
    expect(rendered).toContain('60 / 90 / 120');
    expect(rendered).toContain('120 min');
    expect(rendered).toContain('Foot Massage');
    expect(rendered).toContain('Bookable');
    expect(rendered).toContain('Showing first');
  });
});

function serviceFixture({
  durationMin,
  id,
}: {
  readonly durationMin: number;
  readonly id: string;
}): AdminServiceCatalogItem {
  return {
    active: true,
    basePrice: 500000,
    bookings: [],
    description: null,
    displayOrder: durationMin,
    durationMin,
    id,
    name: 'Foot Massage',
    payoutRules: [payoutRuleFixture(id)],
    priceStep: 100000,
    providers: [],
    serviceGroupKey: 'foot',
  };
}

function payoutRuleFixture(serviceId: string): AdminServicePayoutRule {
  return {
    active: true,
    currency: 'VND',
    customerPrice: 500000,
    id: `${serviceId}-rule`,
    notes: null,
    otherCostAmount: 0,
    providerPayoutAmount: 380000,
    serviceId,
    vatBps: 0,
  };
}
