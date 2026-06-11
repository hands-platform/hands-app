import { Prisma } from '@prisma/client';

export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function serviceAuditSnapshot(
  service: Pick<
    Prisma.MassageServiceGetPayload<object>,
    'id' | 'serviceGroupKey' | 'name' | 'durationMin' | 'basePrice' | 'priceStep' | 'displayOrder' | 'active'
  >,
) {
  return {
    id: service.id,
    serviceGroupKey: service.serviceGroupKey,
    name: service.name,
    durationMin: service.durationMin,
    basePrice: service.basePrice,
    priceStep: service.priceStep,
    displayOrder: service.displayOrder,
    active: service.active,
  };
}

export function servicePayoutRuleAuditSnapshot(
  rule: Pick<
    Prisma.ServicePayoutRuleGetPayload<object>,
    | 'id'
    | 'serviceId'
    | 'customerPrice'
    | 'providerPayoutAmount'
    | 'vatBps'
    | 'otherCostAmount'
    | 'currency'
    | 'active'
    | 'notes'
  >,
) {
  return {
    id: rule.id,
    serviceId: rule.serviceId,
    customerPrice: rule.customerPrice,
    providerPayoutAmount: rule.providerPayoutAmount,
    vatBps: rule.vatBps,
    otherCostAmount: rule.otherCostAmount,
    currency: rule.currency,
    active: rule.active,
    notes: rule.notes,
  };
}

export function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}
