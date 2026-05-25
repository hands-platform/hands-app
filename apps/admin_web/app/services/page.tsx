import { AdminServiceCatalogItem, AdminTaxPolicyVersion, adminGet } from '../../lib/admin-api';
import {
  createService,
  createServiceDurationSet,
  updatePayoutRule,
  updateService,
  upsertPayoutRule,
} from './actions';

export default async function ServicesPage() {
  const services = await adminGet<AdminServiceCatalogItem[]>('/admin/services', []);
  const taxPolicies = await adminGet<AdminTaxPolicyVersion[]>('/admin/tax-policy-versions', []);
  const activeServices = services.filter((service) => service.active);
  const payoutRuleCount = services.reduce((sum, service) => sum + (service.payoutRules?.length ?? 0), 0);
  const groupedServices = groupServices(services);
  const activeTaxPolicy = selectActiveTaxPolicy(taxPolicies);
  const healthItems = buildPricingHealth(services, activeTaxPolicy);
  const readinessItems = buildBookingReadinessQueue(services, activeTaxPolicy);
  const blockedReadinessItems = readinessItems.filter((item) => item.tone === 'blocked');
  const warningReadinessItems = readinessItems.filter((item) => item.tone === 'warning');

  return (
    <>
      <section className="toolbar">
        <div>
          <h1>Service pricing</h1>
          <p className="muted">
            Manage service types, duration options, admin minimum customer prices, and provider payout rules.
          </p>
        </div>
        <div className="actions">
          <span className="pill pill-success">{activeServices.length} active service rows</span>
          <span className="pill pill-info">{payoutRuleCount} payout rule(s)</span>
          <span className={`pill ${activeTaxPolicy ? 'pill-success' : 'pill-warn'}`}>
            {activeTaxPolicy ? `Tax: ${activeTaxPolicy.name}` : 'No active tax policy'}
          </span>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Pricing health</h2>
            <p className="muted">
              Providers can charge the minimum price or higher, but every configured customer price should
              have a payout rule so finance can separate provider payout, VAT, withholding, and actual
              commission.
            </p>
          </div>
          <span className={`pill ${healthItems.every((item) => item.ok) ? 'pill-success' : 'pill-warn'}`}>
            {healthItems.every((item) => item.ok) ? 'Ready' : 'Review'}
          </span>
        </div>
        <div className="setup-stage-list">
          {healthItems.map((item) => (
            <div className="setup-stage-item" key={item.label}>
              <span>{item.ok ? 'OK' : 'CHECK'}</span>
              <div>
                <strong>{item.label}</strong>
                <p className="muted">{item.detail}</p>
              </div>
              <small>{item.value}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Booking readiness queue</h2>
            <p className="muted">
              Shows services that can block customer booking or create an unsafe finance result before
              providers start using those prices.
            </p>
          </div>
          <div className="actions">
            <span className={blockedReadinessItems.length ? 'pill pill-danger' : 'pill pill-success'}>
              {blockedReadinessItems.length} blocked
            </span>
            <span className={warningReadinessItems.length ? 'pill pill-warn' : 'pill pill-success'}>
              {warningReadinessItems.length} warning
            </span>
          </div>
        </div>
        {readinessItems.length ? (
          <div className="setup-stage-list">
            {readinessItems.slice(0, 12).map((item) => (
              <div className="setup-stage-item" key={`${item.serviceId}-${item.title}-${item.detail}`}>
                <span>{item.status}</span>
                <div>
                  <strong>{item.title}</strong>
                  <p className="muted">{item.detail}</p>
                  <p className="muted">{item.action}</p>
                </div>
                <small>{item.serviceId.slice(0, 8)}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            All active service rows have a base payout rule and a positive projected company commission.
          </p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Create 60/90/120 duration set</h2>
        <p className="muted">
          Use this for common service types. Add provider payout amounts now so each duration can be booked
          immediately after creation.
        </p>
        <form action={createServiceDurationSet} className="form-grid">
          <label>
            Group key
            <input name="serviceGroupKey" placeholder="leg_massage" required />
          </label>
          <label>
            Name
            <input name="name" placeholder="Leg Massage" required />
          </label>
          <label>
            60 min minimum
            <input name="basePrice60" type="number" min="100000" step="100000" placeholder="500000" />
          </label>
          <label>
            60 min provider payout
            <input name="providerPayoutAmount60" type="number" min="0" step="1000" placeholder="380000" />
          </label>
          <label>
            90 min minimum
            <input name="basePrice90" type="number" min="100000" step="100000" placeholder="700000" />
          </label>
          <label>
            90 min provider payout
            <input name="providerPayoutAmount90" type="number" min="0" step="1000" placeholder="540000" />
          </label>
          <label>
            120 min minimum
            <input name="basePrice120" type="number" min="100000" step="100000" placeholder="900000" />
          </label>
          <label>
            120 min provider payout
            <input name="providerPayoutAmount120" type="number" min="0" step="1000" placeholder="700000" />
          </label>
          <label>
            Price step
            <input name="priceStep" type="number" min="100000" step="100000" defaultValue="100000" />
          </label>
          <label>
            VAT bps
            <input name="vatBps" type="number" min="0" max="10000" defaultValue="0" />
          </label>
          <label>
            Other cost
            <input name="otherCostAmount" type="number" min="0" defaultValue="0" />
          </label>
          <label>
            Display order
            <input name="displayOrder" type="number" defaultValue="100" />
          </label>
          <label className="full-span">
            Description
            <input name="description" placeholder="Shown in customer/provider apps" />
          </label>
          <button type="submit">Create duration set</button>
        </form>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Create service duration</h2>
        <p className="muted">
          A service type is grouped by key, then each duration gets its own minimum customer price. Add the
          base payout rule here when possible; otherwise bookings stay blocked until finance completes it.
        </p>
        <form action={createService} className="form-grid">
          <label>
            Group key
            <input name="serviceGroupKey" placeholder="leg_massage" />
          </label>
          <label>
            Name
            <input name="name" placeholder="Leg Massage" required />
          </label>
          <label>
            Duration
            <input name="durationMin" type="number" min="1" placeholder="60" required />
          </label>
          <label>
            Minimum price
            <input name="basePrice" type="number" min="100000" step="100000" placeholder="500000" required />
          </label>
          <label>
            Provider payout
            <input name="providerPayoutAmount" type="number" min="0" step="1000" placeholder="380000" />
          </label>
          <label>
            Price step
            <input name="priceStep" type="number" min="100000" step="100000" defaultValue="100000" />
          </label>
          <label>
            VAT bps
            <input name="vatBps" type="number" min="0" max="10000" defaultValue="0" />
          </label>
          <label>
            Other cost
            <input name="otherCostAmount" type="number" min="0" defaultValue="0" />
          </label>
          <label>
            Display order
            <input name="displayOrder" type="number" defaultValue="100" />
          </label>
          <label className="full-span">
            Description
            <input name="description" placeholder="Shown in customer/provider apps" />
          </label>
          <button type="submit">Create service</button>
        </form>
      </section>

      <section className="grid">
        {groupedServices.map((group) => (
          <article className="card" key={group.key}>
            <div className="toolbar" style={{ marginBottom: 12 }}>
              <div>
                <h2>{group.label}</h2>
                <p className="muted">{group.items.length} duration option(s)</p>
              </div>
              <span className="pill pill-info">{group.key}</span>
            </div>

            <div className="setup-stage-list">
              {group.items.map((service) => (
                <div className="setup-stage-item" key={service.id}>
                  <span>{service.active ? 'ON' : 'OFF'}</span>
                  <div>
                    <strong>
                      {service.name} / {service.durationMin} min
                    </strong>
                    <p className="muted">
                      Minimum {formatMoney(service.basePrice, 'VND')} / step{' '}
                      {formatMoney(service.priceStep, 'VND')}
                    </p>
                    <p className="muted">
                      {service._count?.providers ?? 0} provider price row(s), {service._count?.bookings ?? 0}{' '}
                      booking row(s)
                    </p>

                    <form action={updateService} className="form-grid compact-form">
                      <input type="hidden" name="serviceId" value={service.id} />
                      <label>
                        Group key
                        <input name="serviceGroupKey" defaultValue={service.serviceGroupKey ?? ''} />
                      </label>
                      <label>
                        Name
                        <input name="name" defaultValue={service.name} />
                      </label>
                      <label>
                        Duration
                        <input name="durationMin" type="number" min="1" defaultValue={service.durationMin} />
                      </label>
                      <label>
                        Minimum price
                        <input
                          name="basePrice"
                          type="number"
                          min="100000"
                          step={service.priceStep}
                          defaultValue={service.basePrice}
                        />
                      </label>
                      <label>
                        Price step
                        <input
                          name="priceStep"
                          type="number"
                          min="100000"
                          step="100000"
                          defaultValue={service.priceStep}
                        />
                      </label>
                      <label>
                        Display order
                        <input name="displayOrder" type="number" defaultValue={service.displayOrder} />
                      </label>
                      <label className="full-span">
                        Description
                        <input name="description" defaultValue={service.description ?? ''} />
                      </label>
                      <label>
                        Active
                        <input name="active" type="checkbox" defaultChecked={service.active} />
                      </label>
                      <button type="submit">Update service</button>
                    </form>

                    <h3>Payout matrix</h3>
                    <div className="setup-stage-list" style={{ marginBottom: 12 }}>
                      {(service.payoutRules ?? []).map((rule) => {
                        const finance = servicePayoutFinance(service, rule, activeTaxPolicy);
                        return (
                          <div className="setup-stage-item" key={rule.id}>
                            <span>{rule.active ? 'ON' : 'OFF'}</span>
                            <div>
                              <strong>
                                Customer {formatMoney(rule.customerPrice, rule.currency)} / provider{' '}
                                {formatMoney(rule.providerPayoutAmount, rule.currency)}
                              </strong>
                              <p className="muted">
                                Fee {formatMoney(finance.fee, rule.currency)} / VAT {formatBps(rule.vatBps)} ={' '}
                                {formatMoney(finance.vatAmount, rule.currency)} / other cost{' '}
                                {formatMoney(rule.otherCostAmount, rule.currency)}
                              </p>
                              <p className="muted">
                                Withholding projection {formatMoney(finance.withholdingAmount, rule.currency)}
                                {finance.taxRuleLabel ? ` via ${finance.taxRuleLabel}` : ' (no active rule)'}
                              </p>
                              <p className="muted">
                                Actual company commission after VAT/withholding/other:{' '}
                                {formatMoney(finance.actualCompanyCommission, rule.currency)}
                              </p>
                              <form action={updatePayoutRule} className="form-grid compact-form">
                                <input type="hidden" name="ruleId" value={rule.id} />
                                <label>
                                  Customer price
                                  <input
                                    name="customerPrice"
                                    type="number"
                                    min={service.basePrice}
                                    step={service.priceStep}
                                    defaultValue={rule.customerPrice}
                                  />
                                </label>
                                <label>
                                  Provider payout
                                  <input
                                    name="providerPayoutAmount"
                                    type="number"
                                    min="0"
                                    step="1000"
                                    defaultValue={rule.providerPayoutAmount}
                                  />
                                </label>
                                <label>
                                  VAT bps
                                  <input
                                    name="vatBps"
                                    type="number"
                                    min="0"
                                    max="10000"
                                    defaultValue={rule.vatBps}
                                  />
                                </label>
                                <label>
                                  Other cost
                                  <input
                                    name="otherCostAmount"
                                    type="number"
                                    min="0"
                                    defaultValue={rule.otherCostAmount}
                                  />
                                </label>
                                <label>
                                  Notes
                                  <input name="notes" defaultValue={rule.notes ?? ''} />
                                </label>
                                <label>
                                  Active
                                  <input name="active" type="checkbox" defaultChecked={rule.active} />
                                </label>
                                <button type="submit">Update payout</button>
                              </form>
                            </div>
                            <small>{rule.id.slice(0, 8)}</small>
                          </div>
                        );
                      })}
                      {(service.payoutRules ?? []).length === 0 ? (
                        <span className="muted">
                          No payout rule yet. Bookings are blocked until a base payout rule is configured.
                        </span>
                      ) : null}
                    </div>

                    <form action={upsertPayoutRule} className="form-grid compact-form">
                      <input type="hidden" name="serviceId" value={service.id} />
                      <label>
                        Customer price
                        <input
                          name="customerPrice"
                          type="number"
                          min={service.basePrice}
                          step={service.priceStep}
                          defaultValue={service.basePrice}
                        />
                      </label>
                      <label>
                        Provider payout
                        <input
                          name="providerPayoutAmount"
                          type="number"
                          min="0"
                          step="1000"
                          defaultValue={Math.max(0, service.basePrice - Math.round(service.basePrice * 0.2))}
                        />
                      </label>
                      <label>
                        VAT bps
                        <input name="vatBps" type="number" min="0" max="10000" defaultValue="0" />
                      </label>
                      <label>
                        Other cost
                        <input name="otherCostAmount" type="number" min="0" defaultValue="0" />
                      </label>
                      <label className="full-span">
                        Notes
                        <input name="notes" placeholder="Internal finance memo" />
                      </label>
                      <button type="submit">Upsert payout rule</button>
                    </form>
                  </div>
                  <small>{service.id.slice(0, 8)}</small>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

function groupServices(services: AdminServiceCatalogItem[]) {
  const groups = new Map<string, AdminServiceCatalogItem[]>();
  for (const service of services) {
    const key = service.serviceGroupKey ?? slugify(service.name);
    groups.set(key, [...(groups.get(key) ?? []), service]);
  }

  return [...groups.entries()].map(([key, items]) => ({
    key,
    label: items[0]?.name ?? key,
    items: items.sort((left, right) => left.durationMin - right.durationMin),
  }));
}

function buildPricingHealth(
  services: AdminServiceCatalogItem[],
  activeTaxPolicy: AdminTaxPolicyVersion | undefined,
) {
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
  const groupedCount = new Set(active.map((service) => service.serviceGroupKey ?? slugify(service.name)))
    .size;

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
          ? 'Payout rules are above minimum, on the right increment, and do not overpay providers.'
          : 'Review payout rules with invalid customer price or provider payout amount.',
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

function buildBookingReadinessQueue(
  services: AdminServiceCatalogItem[],
  activeTaxPolicy: AdminTaxPolicyVersion | undefined,
) {
  return services
    .filter((service) => service.active)
    .flatMap((service) => {
      const items: Array<{
        serviceId: string;
        title: string;
        status: string;
        detail: string;
        action: string;
        tone: 'blocked' | 'warning';
      }> = [];
      const basePayoutRule = (service.payoutRules ?? []).find(
        (rule) => rule.active && rule.customerPrice === service.basePrice,
      );
      const invalidRules = (service.payoutRules ?? []).filter(
        (rule) =>
          rule.customerPrice < service.basePrice ||
          rule.customerPrice % service.priceStep !== 0 ||
          rule.providerPayoutAmount > rule.customerPrice,
      );
      const lowCommissionRules = (service.payoutRules ?? []).filter(
        (rule) => rule.active && actualCompanyCommission(service, rule, activeTaxPolicy) <= 0,
      );

      if (!basePayoutRule) {
        items.push({
          serviceId: service.id,
          title: `${service.name} / ${service.durationMin} min`,
          status: 'BLOCKED',
          detail: `Base price ${formatMoney(service.basePrice, 'VND')} has no active payout rule.`,
          action: 'Add an active payout rule at the minimum customer price before customers can book.',
          tone: 'blocked',
        });
      }

      for (const rule of invalidRules) {
        items.push({
          serviceId: service.id,
          title: `${service.name} / ${service.durationMin} min`,
          status: 'INVALID',
          detail: `Customer ${formatMoney(rule.customerPrice, rule.currency)} / provider ${formatMoney(
            rule.providerPayoutAmount,
            rule.currency,
          )}`,
          action:
            'Customer price must respect the minimum and step, and provider payout cannot exceed customer price.',
          tone: 'blocked',
        });
      }

      for (const rule of lowCommissionRules) {
        items.push({
          serviceId: service.id,
          title: `${service.name} / ${service.durationMin} min`,
          status: 'LOW FEE',
          detail: `Projected company commission is ${formatMoney(
            actualCompanyCommission(service, rule, activeTaxPolicy),
            rule.currency,
          )} for customer price ${formatMoney(rule.customerPrice, rule.currency)}.`,
          action: 'Adjust provider payout, VAT/cost assumptions, or tax policy before scaling this price.',
          tone: 'warning',
        });
      }

      return items;
    })
    .sort((left, right) => {
      const leftScore = left.tone === 'blocked' ? 0 : 1;
      const rightScore = right.tone === 'blocked' ? 0 : 1;
      return leftScore - rightScore || left.title.localeCompare(right.title);
    });
}

function selectActiveTaxPolicy(policies: AdminTaxPolicyVersion[]) {
  const now = Date.now();
  return policies
    .filter((policy) => {
      if (policy.status !== 'ACTIVE') {
        return false;
      }
      const startsAt = new Date(policy.effectiveFrom).getTime();
      const endsAt = policy.effectiveTo ? new Date(policy.effectiveTo).getTime() : Number.POSITIVE_INFINITY;
      return startsAt <= now && endsAt >= now;
    })
    .sort(
      (left, right) => new Date(right.effectiveFrom).getTime() - new Date(left.effectiveFrom).getTime(),
    )[0];
}

function estimateWithholding(
  policy: AdminTaxPolicyVersion | undefined,
  service: AdminServiceCatalogItem,
  grossAmount: number,
) {
  const rule = selectTaxRule(policy?.rules ?? [], {
    grossAmount,
    serviceTypes: [service.serviceGroupKey, service.name].filter(Boolean).map(String),
  });
  if (!policy || !rule) {
    return { withholdingAmount: 0, ruleLabel: null };
  }
  const withholdingAmount = Math.max(
    0,
    Math.min(grossAmount, Math.round((grossAmount * rule.rateBps) / 10000) + rule.fixedAmount),
  );
  return {
    withholdingAmount,
    ruleLabel: `${rule.scope}${rule.serviceType ? `:${rule.serviceType}` : ''} ${formatBps(rule.rateBps)}`,
  };
}

function actualCompanyCommission(
  service: AdminServiceCatalogItem,
  rule: NonNullable<AdminServiceCatalogItem['payoutRules']>[number],
  activeTaxPolicy: AdminTaxPolicyVersion | undefined,
) {
  return servicePayoutFinance(service, rule, activeTaxPolicy).actualCompanyCommission;
}

function servicePayoutFinance(
  service: AdminServiceCatalogItem,
  rule: NonNullable<AdminServiceCatalogItem['payoutRules']>[number],
  activeTaxPolicy: AdminTaxPolicyVersion | undefined,
) {
  const fee = rule.customerPrice - rule.providerPayoutAmount;
  const taxableFee = Math.max(0, fee);
  const vatAmount = Math.round((taxableFee * rule.vatBps) / 10000);
  const tax = estimateWithholding(activeTaxPolicy, service, rule.customerPrice);
  return {
    fee,
    vatAmount,
    withholdingAmount: tax.withholdingAmount,
    taxRuleLabel: tax.ruleLabel,
    actualCompanyCommission: fee - vatAmount - tax.withholdingAmount - rule.otherCostAmount,
  };
}

function selectTaxRule(
  rules: NonNullable<AdminTaxPolicyVersion['rules']>,
  input: { grossAmount: number; serviceTypes: string[] },
) {
  const serviceTypes = new Set(input.serviceTypes.map((value) => value.toLowerCase()));
  const prioritized = [...rules]
    .filter((rule) => rule.active)
    .sort(
      (left, right) =>
        taxRulePriority(right, serviceTypes, input.grossAmount) -
        taxRulePriority(left, serviceTypes, input.grossAmount),
    );
  return prioritized.find((rule) => taxRulePriority(rule, serviceTypes, input.grossAmount) > 0) ?? null;
}

function taxRulePriority(
  rule: NonNullable<AdminTaxPolicyVersion['rules']>[number],
  serviceTypes: Set<string>,
  grossAmount: number,
) {
  if (rule.scope === 'SERVICE_TYPE') {
    return rule.serviceType && serviceTypes.has(rule.serviceType.toLowerCase()) ? 30 : 0;
  }
  if (rule.scope === 'AMOUNT_BAND') {
    const aboveMin = rule.minGrossAmount == null || grossAmount >= rule.minGrossAmount;
    const belowMax = rule.maxGrossAmount == null || grossAmount <= rule.maxGrossAmount;
    return aboveMin && belowMax ? 20 : 0;
  }
  if (rule.scope === 'DEFAULT') {
    return 10;
  }
  return 0;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ${currency}`;
}

function formatBps(value: number) {
  return `${(value / 100).toFixed(2)}%`;
}
