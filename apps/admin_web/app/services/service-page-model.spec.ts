import type { AdminServiceCatalogItem, AdminServicePayoutRule } from '../../lib/admin-api';
import { buildServicePageModel } from './service-page-model';

describe('buildServicePageModel', () => {
  it('trims search params, filters services, and exposes action notices', () => {
    const model = buildServicePageModel({
      auditLogs: [],
      params: { q: ' foot ', reason: 'service-updated', status: 'saved' },
      services: [
        serviceFixture({ id: 'foot-60', name: 'Foot Massage', serviceGroupKey: 'foot' }),
        serviceFixture({ active: false, id: 'stone-60', name: 'Hot Stone', serviceGroupKey: 'stone' }),
      ],
      taxPolicies: [],
    });

    expect(model.serviceSearchQuery).toBe('foot');
    expect(model.filteredGroupedServices.map((group) => group.key)).toEqual(['foot']);
    expect(model.filteredActiveServices.map((service) => service.id)).toEqual(['foot-60']);
    expect(model.actionNotice?.title).toBe('Service option updated');
  });

  it('caps visible service groups and coverage rows for large catalogs', () => {
    const services = Array.from({ length: 41 }, (_, index) =>
      serviceFixture({
        id: `service-${index + 1}`,
        name: `Service ${index + 1}`,
        serviceGroupKey: `service_${index + 1}`,
      }),
    );

    const model = buildServicePageModel({
      auditLogs: [],
      params: {},
      services,
      taxPolicies: [],
    });

    expect(model.groupedServices).toHaveLength(41);
    expect(model.visibleGroupedServices).toHaveLength(40);
    expect(model.hiddenServiceGroupCount).toBe(1);
    expect(model.visibleServiceTypeCoverageRows).toHaveLength(40);
    expect(model.hiddenServiceTypeCoverageRowCount).toBe(1);
  });
});

function serviceFixture(input: {
  readonly active?: boolean;
  readonly id: string;
  readonly name: string;
  readonly serviceGroupKey: string;
}): AdminServiceCatalogItem {
  return {
    _count: { bookings: 0, providers: 0 },
    active: input.active ?? true,
    basePrice: 300000,
    bookings: [],
    description: null,
    displayOrder: 1,
    durationMin: 60,
    id: input.id,
    name: input.name,
    payoutRules: [payoutRuleFixture(input.id)],
    priceStep: 100000,
    providers: [],
    serviceGroupKey: input.serviceGroupKey,
  };
}

function payoutRuleFixture(serviceId: string): AdminServicePayoutRule {
  return {
    active: true,
    currency: 'VND',
    customerPrice: 300000,
    id: `${serviceId}-rule`,
    notes: null,
    otherCostAmount: 0,
    providerPayoutAmount: 220000,
    serviceId,
    vatBps: 0,
  };
}
