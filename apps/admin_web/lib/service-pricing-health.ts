import type { AdminServiceCatalogItem } from './admin-api';

type ServicePayoutRule = NonNullable<AdminServiceCatalogItem['payoutRules']>[number];

type ServicePricingHealthInput<TPolicy> = {
  readonly activeTaxPolicy: TPolicy;
  readonly actualCompanyCommission: (
    service: AdminServiceCatalogItem,
    rule: ServicePayoutRule,
    activeTaxPolicy: TPolicy,
  ) => number;
  readonly services: readonly AdminServiceCatalogItem[];
};

export type ServicePricingHealthItem = {
  readonly detail: string;
  readonly label: string;
  readonly ok: boolean;
  readonly value: string;
};

export function servicePricingHealth<TPolicy>({
  activeTaxPolicy,
  actualCompanyCommission,
  services,
}: ServicePricingHealthInput<TPolicy>): ServicePricingHealthItem[] {
  const active = services.filter((service) => service.active);
  const invalidMinimums = active.filter(
    (service) => service.basePrice <= 0 || service.basePrice % service.priceStep !== 0,
  );
  const missingBasePayoutRules = active.filter(
    (service) =>
      !(service.payoutRules ?? []).some((rule) => rule.active && rule.customerPrice === service.basePrice),
  );
  const invalidRules = active.flatMap((service) =>
    (service.payoutRules ?? []).filter(
      (rule) =>
        rule.customerPrice < service.basePrice ||
        rule.customerPrice % service.priceStep !== 0 ||
        rule.providerPayoutAmount > rule.customerPrice,
    ),
  );
  const lowCommissionRules = active.flatMap((service) =>
    (service.payoutRules ?? []).filter(
      (rule) => rule.active && actualCompanyCommission(service, rule, activeTaxPolicy) <= 0,
    ),
  );
  const groupedCount = new Set(active.map((service) => service.serviceGroupKey ?? slugify(service.name))).size;

  return [
    {
      label: 'Service groups',
      ok: groupedCount > 0,
      value: `${groupedCount} group(s)`,
      detail: 'Each service type can have many duration rows such as 60, 90, and 120 minutes.',
    },
    {
      label: 'Minimum price increments',
      ok: invalidMinimums.length === 0,
      value: `${invalidMinimums.length} invalid`,
      detail:
        invalidMinimums.length === 0
          ? 'All active minimum prices follow their configured price step.'
          : 'Fix active service minimum prices that do not match the required increment.',
    },
    {
      label: 'Base payout rules',
      ok: missingBasePayoutRules.length === 0 && active.length > 0,
      value: `${missingBasePayoutRules.length} missing`,
      detail:
        missingBasePayoutRules.length === 0 && active.length > 0
          ? 'Every active service has a payout rule for the minimum price.'
          : 'Add a payout rule at the minimum price for every active service.',
    },
    {
      label: 'Rule consistency',
      ok: invalidRules.length === 0,
      value: `${invalidRules.length} invalid`,
      detail:
        invalidRules.length === 0
          ? 'Payout rules are above minimum, on the right increment, and do not overpay Partners.'
          : 'Review payout rules with invalid customer price or Partner payout amount.',
    },
    {
      label: 'Company commission floor',
      ok: lowCommissionRules.length === 0,
      value: `${lowCommissionRules.length} low`,
      detail:
        lowCommissionRules.length === 0
          ? 'Active payout rules keep a positive projected company commission after VAT, withholding, and costs.'
          : 'Review payout rules where projected company commission is zero after tax/cost deductions.',
    },
  ];
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\u0111/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}
