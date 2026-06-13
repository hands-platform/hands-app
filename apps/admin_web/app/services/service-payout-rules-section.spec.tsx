import type { AdminServiceCatalogItem, AdminServicePayoutRule } from '../../lib/admin-api';
import { ServicePayoutRulesSection } from './service-payout-rules-section';

describe('ServicePayoutRulesSection', () => {
  it('renders Partner-facing payout copy and bulk import guidance', () => {
    const section = ServicePayoutRulesSection({
      activeTaxPolicy: undefined,
      service: serviceFixture(),
    });

    const rendered = JSON.stringify(section);

    expect(rendered).toContain('Partner payout');
    expect(rendered).toContain('customerPrice,partnerPayout');
    expect(rendered).toContain('Import payout ladder');
  });
});

function serviceFixture(): AdminServiceCatalogItem {
  return {
    _count: { bookings: 0, providers: 1 },
    active: true,
    basePrice: 500000,
    bookings: [],
    description: null,
    displayOrder: 0,
    durationMin: 60,
    id: 'service-1',
    name: 'Foot Massage',
    payoutRules: [payoutRuleFixture('service-1')],
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
