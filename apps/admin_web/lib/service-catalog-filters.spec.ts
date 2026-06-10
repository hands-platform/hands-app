import type { AdminServiceCatalogItem, AdminTaxPolicyVersion } from './admin-api';
import {
  filterServiceGroups,
  filterServices,
  groupServices,
  readSingleParam,
  selectActiveTaxPolicy,
} from './service-catalog-filters';

describe('service catalog filters', () => {
  it('groups services by explicit group key or slugified name and sorts durations', () => {
    const services = [
      serviceFixture({ durationMin: 90, name: 'Foot Massage', serviceGroupKey: 'foot' }),
      serviceFixture({ durationMin: 60, name: 'Foot Massage', serviceGroupKey: 'foot' }),
      serviceFixture({ durationMin: 45, name: 'Đá nóng Therapy' }),
    ];

    const groups = groupServices(services);

    expect(groups.map((group) => ({ durations: group.items.map((item) => item.durationMin), key: group.key }))).toEqual([
      { durations: [60, 90], key: 'foot' },
      { durations: [45], key: 'da_nong_therapy' },
    ]);
  });

  it('filters service groups by group metadata or matching child services', () => {
    const groups = groupServices([
      serviceFixture({ durationMin: 60, name: 'Foot Massage', serviceGroupKey: 'foot' }),
      serviceFixture({ durationMin: 90, name: 'Foot Massage', serviceGroupKey: 'foot' }),
      serviceFixture({ active: false, durationMin: 120, name: 'Thai Massage', serviceGroupKey: 'thai' }),
    ]);

    expect(filterServiceGroups(groups, 'foot')[0]?.items.map((item) => item.durationMin)).toEqual([60, 90]);
    expect(filterServiceGroups(groups, '120')).toEqual([
      {
        items: [expect.objectContaining({ durationMin: 120 })],
        key: 'thai',
        label: 'Thai Massage',
      },
    ]);
  });

  it('filters services by searchable fields and reads single query params', () => {
    const services = [
      serviceFixture({
        active: false,
        basePrice: 450000,
        description: 'Deep tissue option',
        durationMin: 90,
        name: 'Deep Tissue',
      }),
      serviceFixture({ durationMin: 60, name: 'Foot Massage' }),
    ];

    expect(filterServices(services, '450000').map((service) => service.name)).toEqual(['Deep Tissue']);
    expect(filterServices(services, 'inactive').map((service) => service.name)).toEqual(['Deep Tissue']);
    expect(readSingleParam(['first', 'second'])).toBe('first');
    expect(readSingleParam('single')).toBe('single');
  });

  it('selects the latest active tax policy currently in effect', () => {
    const nowMs = Date.parse('2026-06-09T12:00:00.000Z');

    expect(
      selectActiveTaxPolicy(
        [
          taxPolicyFixture({
            effectiveFrom: '2026-01-01T00:00:00.000Z',
            id: 'older-active',
            status: 'ACTIVE',
          }),
          taxPolicyFixture({
            effectiveFrom: '2026-05-01T00:00:00.000Z',
            id: 'latest-active',
            status: 'ACTIVE',
          }),
          taxPolicyFixture({
            effectiveFrom: '2026-07-01T00:00:00.000Z',
            id: 'future',
            status: 'ACTIVE',
          }),
          taxPolicyFixture({
            effectiveFrom: '2026-04-01T00:00:00.000Z',
            effectiveTo: '2026-05-01T00:00:00.000Z',
            id: 'expired',
            status: 'ACTIVE',
          }),
          taxPolicyFixture({
            effectiveFrom: '2026-06-01T00:00:00.000Z',
            id: 'draft',
            status: 'DRAFT',
          }),
        ],
        nowMs,
      )?.id,
    ).toBe('latest-active');
  });
});

function serviceFixture({
  active = true,
  basePrice = 300000,
  description,
  durationMin,
  name,
  serviceGroupKey,
}: {
  readonly active?: boolean;
  readonly basePrice?: number;
  readonly description?: string;
  readonly durationMin: number;
  readonly name: string;
  readonly serviceGroupKey?: string;
}): AdminServiceCatalogItem {
  return {
    active,
    basePrice,
    description,
    displayOrder: 0,
    durationMin,
    id: `${name}-${durationMin}`,
    name,
    priceStep: 100000,
    serviceGroupKey,
  };
}

function taxPolicyFixture({
  effectiveFrom,
  effectiveTo,
  id,
  status,
}: {
  readonly effectiveFrom: string;
  readonly effectiveTo?: string;
  readonly id: string;
  readonly status: string;
}): AdminTaxPolicyVersion {
  return {
    effectiveFrom,
    effectiveTo,
    id,
    name: id,
    status,
  };
}
