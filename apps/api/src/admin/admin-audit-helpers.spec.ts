import {
  changedFields,
  serviceAuditSnapshot,
  servicePayoutRuleAuditSnapshot,
  toJson,
} from './admin-audit-helpers';

describe('admin audit helpers', () => {
  it('serializes values as Prisma JSON input', () => {
    expect(toJson({ createdAt: new Date('2026-06-11T00:00:00.000Z') })).toEqual({
      createdAt: '2026-06-11T00:00:00.000Z',
    });
  });

  it('builds service audit snapshots from mutable service fields', () => {
    expect(
      serviceAuditSnapshot({
        active: true,
        basePrice: 300000,
        displayOrder: 1,
        durationMin: 60,
        id: 'service-1',
        name: 'Massage 60',
        priceStep: 100000,
        serviceGroupKey: 'massage',
      }),
    ).toEqual({
      active: true,
      basePrice: 300000,
      displayOrder: 1,
      durationMin: 60,
      id: 'service-1',
      name: 'Massage 60',
      priceStep: 100000,
      serviceGroupKey: 'massage',
    });
  });

  it('builds service payout rule audit snapshots', () => {
    expect(
      servicePayoutRuleAuditSnapshot({
        active: true,
        currency: 'VND',
        customerPrice: 400000,
        id: 'rule-1',
        notes: 'standard',
        otherCostAmount: 20000,
        providerPayoutAmount: 280000,
        serviceId: 'service-1',
        vatBps: 800,
      }),
    ).toEqual({
      active: true,
      currency: 'VND',
      customerPrice: 400000,
      id: 'rule-1',
      notes: 'standard',
      otherCostAmount: 20000,
      providerPayoutAmount: 280000,
      serviceId: 'service-1',
      vatBps: 800,
    });
  });

  it('detects changed audit fields by serialized value', () => {
    expect(
      changedFields(
        { active: true, basePrice: 300000, nested: { value: 1 } },
        { active: true, basePrice: 400000, nested: { value: 2 }, newField: 'added' },
      ),
    ).toEqual(['basePrice', 'nested', 'newField']);
  });
});
