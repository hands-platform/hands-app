import { AdminServiceCatalogItem, adminGet } from '../../lib/admin-api';
import { createService, updatePayoutRule, updateService, upsertPayoutRule } from './actions';

export default async function ServicesPage() {
  const services = await adminGet<AdminServiceCatalogItem[]>('/admin/services', []);
  const activeServices = services.filter((service) => service.active);
  const payoutRuleCount = services.reduce((sum, service) => sum + (service.payoutRules?.length ?? 0), 0);
  const groupedServices = groupServices(services);
  const healthItems = buildPricingHealth(services);

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
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Pricing health</h2>
            <p className="muted">
              Providers can charge the minimum price or higher, but every configured customer price should have
              a payout rule so finance can separate provider payout, VAT, withholding, and actual commission.
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
        <h2>Create service duration</h2>
        <p className="muted">
          A service type is grouped by key, then each duration gets its own minimum customer price.
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
            Price step
            <input name="priceStep" type="number" min="100000" step="100000" defaultValue="100000" />
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
                      {service._count?.providers ?? 0} provider price row(s),{' '}
                      {service._count?.bookings ?? 0} booking row(s)
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
                        <input name="priceStep" type="number" min="100000" step="100000" defaultValue={service.priceStep} />
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
                        const fee = rule.customerPrice - rule.providerPayoutAmount;
                        const vat = Math.round((fee * rule.vatBps) / 10000);
                        const actualCommission = Math.max(0, fee - vat - rule.otherCostAmount);
                        return (
                          <div className="setup-stage-item" key={rule.id}>
                            <span>{rule.active ? 'ON' : 'OFF'}</span>
                            <div>
                              <strong>
                                Customer {formatMoney(rule.customerPrice, rule.currency)} / provider{' '}
                                {formatMoney(rule.providerPayoutAmount, rule.currency)}
                              </strong>
                              <p className="muted">
                                Fee {formatMoney(fee, rule.currency)} / VAT {formatBps(rule.vatBps)} ={' '}
                                {formatMoney(vat, rule.currency)} / other cost{' '}
                                {formatMoney(rule.otherCostAmount, rule.currency)}
                              </p>
                              <p className="muted">
                                Actual company commission before withholding:{' '}
                                {formatMoney(actualCommission, rule.currency)}
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
                                  <input name="vatBps" type="number" min="0" max="10000" defaultValue={rule.vatBps} />
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
                        <span className="muted">No payout rule yet. Earnings will fall back to the generic fee policy.</span>
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

function buildPricingHealth(services: AdminServiceCatalogItem[]) {
  const active = services.filter((service) => service.active);
  const invalidMinimums = active.filter(
    (service) => service.basePrice <= 0 || service.basePrice % service.priceStep !== 0,
  );
  const missingBasePayoutRules = active.filter(
    (service) =>
      !(service.payoutRules ?? []).some(
        (rule) => rule.active && rule.customerPrice === service.basePrice,
      ),
  );
  const invalidRules = active.flatMap((service) =>
    (service.payoutRules ?? []).filter(
      (rule) =>
        rule.customerPrice < service.basePrice ||
        rule.customerPrice % service.priceStep !== 0 ||
        rule.providerPayoutAmount > rule.customerPrice,
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
          ? 'Payout rules are above minimum, on the right increment, and do not overpay providers.'
          : 'Review payout rules with invalid customer price or provider payout amount.',
    },
  ];
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
