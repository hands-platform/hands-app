import {
  adminAuditTarget,
  bookingAuditLogWhere,
  changedFields,
  customerAuditLogWhere,
  paymentAuditLogWhere,
  providerAuditLogWhere,
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

  it('builds stable admin audit targets', () => {
    expect(adminAuditTarget('booking', 'booking-1')).toBe('booking:booking-1');
    expect(adminAuditTarget('provider_sanction', 'sanction-1')).toBe(
      'provider_sanction:sanction-1',
    );
  });

  it('builds customer and provider audit log filters', () => {
    expect(customerAuditLogWhere('customer-1', 'user-1')).toMatchObject({
      OR: [
        { target: 'customer:customer-1' },
        { target: 'user:user-1' },
        { metadata: { path: ['customerProfileId'], equals: 'customer-1' } },
        { metadata: { path: ['customerUserId'], equals: 'user-1' } },
        { metadata: { path: ['userId'], equals: 'user-1' } },
      ],
    });
    expect(providerAuditLogWhere('provider-1')).toMatchObject({
      OR: expect.arrayContaining([
        { target: 'provider:provider-1' },
        { metadata: { path: ['partnerProfileId'], equals: 'provider-1' } },
      ]),
    });
  });

  it('builds booking and payment audit log filters', () => {
    const since = new Date('2026-06-11T00:00:00.000Z');
    expect(bookingAuditLogWhere('booking-1', since)).toMatchObject({
      OR: expect.arrayContaining([
        { target: 'booking:booking-1' },
        { metadata: { path: ['bookingId'], equals: 'booking-1' } },
        { action: 'operational_policy.update', createdAt: { gte: since } },
      ]),
    });
    expect(paymentAuditLogWhere('payment-1', 'booking-1')).toMatchObject({
      OR: [
        { target: 'payment:payment-1' },
        { target: 'booking:booking-1' },
        { metadata: { path: ['paymentId'], equals: 'payment-1' } },
        { metadata: { path: ['bookingId'], equals: 'booking-1' } },
      ],
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
