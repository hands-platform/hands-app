import { Prisma } from '@prisma/client';

type AdminAuditTargetKind =
  | 'booking'
  | 'customer'
  | 'file'
  | 'payment'
  | 'provider'
  | 'provider_report'
  | 'provider_sanction'
  | 'review'
  | 'service'
  | 'service_group'
  | 'user';

export function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function adminAuditTarget(kind: AdminAuditTargetKind, id: string) {
  return `${kind}:${id}`;
}

export function customerAuditLogWhere(
  customerProfileId: string,
  customerUserId: string,
): Prisma.AdminAuditLogWhereInput {
  return {
    OR: [
      { target: adminAuditTarget('customer', customerProfileId) },
      { target: adminAuditTarget('user', customerUserId) },
      { metadata: { path: ['customerProfileId'], equals: customerProfileId } },
      { metadata: { path: ['customerUserId'], equals: customerUserId } },
      { metadata: { path: ['userId'], equals: customerUserId } },
    ],
  };
}

export function providerAuditLogWhere(providerProfileId: string): Prisma.AdminAuditLogWhereInput {
  return {
    OR: [
      { target: adminAuditTarget('provider', providerProfileId) },
      { metadata: { path: ['providerProfileId'], equals: providerProfileId } },
      { metadata: { path: ['partnerProfileId'], equals: providerProfileId } },
      { metadata: { path: ['providerId'], equals: providerProfileId } },
      { metadata: { path: ['preferredProviderId'], equals: providerProfileId } },
    ],
  };
}

export function bookingAuditLogWhere(
  bookingId: string,
  operationalPolicySince?: Date,
): Prisma.AdminAuditLogWhereInput {
  return {
    OR: [
      { target: adminAuditTarget('booking', bookingId) },
      { metadata: { path: ['bookingId'], equals: bookingId } },
      ...(operationalPolicySince
        ? [{ action: 'operational_policy.update', createdAt: { gte: operationalPolicySince } }]
        : []),
    ],
  };
}

export function paymentAuditLogWhere(paymentId: string, bookingId: string): Prisma.AdminAuditLogWhereInput {
  return {
    OR: [
      { target: adminAuditTarget('payment', paymentId) },
      { target: adminAuditTarget('booking', bookingId) },
      { metadata: { path: ['paymentId'], equals: paymentId } },
      { metadata: { path: ['bookingId'], equals: bookingId } },
    ],
  };
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

type ServiceAuditInput = Parameters<typeof serviceAuditSnapshot>[0];
type ServicePayoutRuleAuditInput = Parameters<typeof servicePayoutRuleAuditSnapshot>[0];

export function serviceUpdateAuditMetadata(
  beforeService: ServiceAuditInput,
  afterService: ServiceAuditInput,
  adjustedProviderPrices: number,
) {
  const before = serviceAuditSnapshot(beforeService);
  const after = serviceAuditSnapshot(afterService);
  return {
    before,
    after,
    changedFields: changedFields(before, after),
    adjustedProviderPrices,
  };
}

export function servicePayoutRuleAuditMetadata(
  service: ServiceAuditInput,
  beforeRule: ServicePayoutRuleAuditInput | null,
  afterRule: ServicePayoutRuleAuditInput,
) {
  const before = beforeRule ? servicePayoutRuleAuditSnapshot(beforeRule) : null;
  const after = servicePayoutRuleAuditSnapshot(afterRule);
  return {
    service: serviceAuditSnapshot(service),
    before,
    after,
    changedFields: changedFields(before ?? {}, after),
  };
}

export function bulkServicePayoutRuleAuditMetadata(
  service: ServiceAuditInput,
  savedRules: ServicePayoutRuleAuditInput[],
  existingRules: ServicePayoutRuleAuditInput[],
) {
  const existingByPrice = new Map(existingRules.map((rule) => [rule.customerPrice, rule]));
  return {
    service: serviceAuditSnapshot(service),
    ruleCount: savedRules.length,
    customerPrices: savedRules.map((rule) => rule.customerPrice).sort((left, right) => left - right),
    before: savedRules.map((rule) => {
      const existingRule = existingByPrice.get(rule.customerPrice);
      return existingRule ? servicePayoutRuleAuditSnapshot(existingRule) : null;
    }),
    after: savedRules.map(servicePayoutRuleAuditSnapshot),
    changedFieldsByPrice: savedRules.map((rule) => {
      const existingRule = existingByPrice.get(rule.customerPrice);
      return {
        customerPrice: rule.customerPrice,
        changedFields: changedFields(
          existingRule ? servicePayoutRuleAuditSnapshot(existingRule) : {},
          servicePayoutRuleAuditSnapshot(rule),
        ),
      };
    }),
  };
}
