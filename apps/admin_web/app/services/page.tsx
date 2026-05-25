import { AdminServiceCatalogItem, AdminTaxPolicyVersion, adminGet } from '../../lib/admin-api';
import {
  bulkUpsertPayoutRules,
  createService,
  createServiceDurationSet,
  updatePayoutRule,
  updateService,
  upsertPayoutRule,
} from './actions';

type ServicesPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ServicesPage({ searchParams }: { searchParams?: ServicesPageSearchParams }) {
  const params = (await searchParams) ?? {};
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
  const bookingTraceRows = serviceBookingTraceRows(services);
  const actionNotice = serviceActionNotice(params);

  return (
    <>
      <section className="toolbar">
        <div>
          <h1>Service catalog</h1>
          <p className="muted">
            Create a service name once, then manage duration options such as 60, 90, and 120 minutes with
            separate minimum prices and payout policies.
          </p>
        </div>
        <div className="actions">
          <span className="pill pill-success">{groupedServices.length} service type(s)</span>
          <span className="pill pill-info">{activeServices.length} active duration option(s)</span>
          <span className="pill pill-info">{payoutRuleCount} payout rule(s)</span>
          <span className={`pill ${activeTaxPolicy ? 'pill-success' : 'pill-warn'}`}>
            {activeTaxPolicy ? `Tax: ${activeTaxPolicy.name}` : 'No active tax policy'}
          </span>
        </div>
      </section>

      {actionNotice ? (
        <section
          className="card"
          style={{
            marginBottom: 16,
            borderColor: actionNotice.tone === 'success' ? '#b8ddb0' : '#f0c7c2',
            background: actionNotice.tone === 'success' ? '#f4fbf1' : '#fff5f3',
          }}
        >
          <div className="risk-watch-header">
            <div>
              <h2>{actionNotice.title}</h2>
              <p className="muted">{actionNotice.detail}</p>
            </div>
            <span className={`pill ${actionNotice.tone === 'success' ? 'pill-success' : 'pill-danger'}`}>
              {actionNotice.tone === 'success' ? 'Saved' : 'Blocked'}
            </span>
          </div>
        </section>
      ) : null}

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

      <section className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <div className="risk-watch-header">
          <div>
            <h2>Duration pricing matrix</h2>
            <p className="muted">
              One row is one service name. Each duration cell shows customer minimum, provider payout, and
              projected company commission after VAT, withholding, and other configured costs.
            </p>
          </div>
          <span className="pill pill-info">60 / 90 / 120 min</span>
        </div>
        <table className="table service-matrix">
          <thead>
            <tr>
              <th>Service</th>
              <th>60 min</th>
              <th>90 min</th>
              <th>120 min</th>
              <th>Policy state</th>
            </tr>
          </thead>
          <tbody>
            {groupedServices.map((group) => {
              const matrix = serviceDurationMatrix(group.items, activeTaxPolicy);
              return (
                <tr key={group.key}>
                  <td>
                    <strong>{group.label}</strong>
                    <p className="muted">{group.key}</p>
                  </td>
                  {[60, 90, 120].map((duration) => {
                    const cell = matrix.byDuration.get(duration);
                    return (
                      <td key={`${group.key}-${duration}`}>
                        {cell ? (
                          <div className="service-matrix-cell">
                            <strong>{formatMoney(cell.service.basePrice, 'VND')}</strong>
                            <span className={cell.baseRule ? 'pill pill-success' : 'pill pill-danger'}>
                              {cell.baseRule ? 'Payout ready' : 'Payout missing'}
                            </span>
                            <small>
                              Provider{' '}
                              {cell.baseRule
                                ? formatMoney(cell.baseRule.providerPayoutAmount, cell.baseRule.currency)
                                : 'not set'}
                            </small>
                            <small>
                              Commission{' '}
                              {cell.baseRule
                                ? formatMoney(cell.finance.actualCompanyCommission, cell.baseRule.currency)
                                : '-'}
                            </small>
                          </div>
                        ) : (
                          <span className="pill pill-neutral">Not configured</span>
                        )}
                      </td>
                    );
                  })}
                  <td>
                    <div className="service-matrix-cell">
                      <span className={`pill ${matrix.blockedCount ? 'pill-danger' : 'pill-success'}`}>
                        {matrix.blockedCount ? `${matrix.blockedCount} blocked` : 'Bookable'}
                      </span>
                      <small>{matrix.activeCount} active duration option(s)</small>
                      <small>{matrix.payoutRuleCount} payout rule(s)</small>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <div className="risk-watch-header">
          <div>
            <h2>Service payout ledger</h2>
            <p className="muted">
              Finance view for the current minimum price of every active duration option. This is the fastest
              way to confirm customer price, provider payout, tax/cost assumptions, and customer-app
              visibility before providers start selling.
            </p>
          </div>
          <span className="pill pill-info">{activeServices.length} active option(s)</span>
        </div>
        <table className="table service-ledger">
          <thead>
            <tr>
              <th>Service option</th>
              <th>Customer price</th>
              <th>Provider payout</th>
              <th>Gross fee</th>
              <th>Tax / cost</th>
              <th>Actual company commission</th>
              <th>Provider visibility</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {servicePayoutLedgerRows(activeServices, activeTaxPolicy).map((row) => (
              <tr key={row.service.id}>
                <td>
                  <strong>{row.service.name}</strong>
                  <p className="muted">
                    {row.service.durationMin} min / {row.service.serviceGroupKey ?? slugify(row.service.name)}
                  </p>
                </td>
                <td>{formatMoney(row.service.basePrice, row.currency)}</td>
                <td>{row.baseRule ? formatMoney(row.baseRule.providerPayoutAmount, row.currency) : '-'}</td>
                <td>{row.baseRule ? formatMoney(row.finance.fee, row.currency) : '-'}</td>
                <td>
                  {row.baseRule ? (
                    <div className="service-matrix-cell">
                      <small>VAT {formatMoney(row.finance.vatAmount, row.currency)}</small>
                      <small>Withholding {formatMoney(row.finance.withholdingAmount, row.currency)}</small>
                      <small>Other {formatMoney(row.baseRule.otherCostAmount, row.currency)}</small>
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  <span className={`pill ${row.commissionTone}`}>
                    {row.baseRule ? formatMoney(row.finance.actualCompanyCommission, row.currency) : 'Missing rule'}
                  </span>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <span className={`pill ${row.hiddenProviders ? 'pill-warn' : 'pill-success'}`}>
                      {row.visibleProviders} visible / {row.hiddenProviders} hidden
                    </span>
                    <small>{row.totalProviderRows} provider price row(s)</small>
                  </div>
                </td>
                <td>
                  <span className={`pill ${row.actionTone}`}>{row.action}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <div className="risk-watch-header">
          <div>
            <h2>Recent booking finance trace</h2>
            <p className="muted">
              Links service pricing to booking payment, provider earning, tax log, platform fee log, and wallet
              movement. Use this after changing a price policy to confirm real bookings are producing the
              expected finance records.
            </p>
          </div>
          <span className="pill pill-info">{bookingTraceRows.length} trace row(s)</span>
        </div>
        {bookingTraceRows.length ? (
          <table className="table service-trace">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Service price</th>
                <th>Payment</th>
                <th>Earning</th>
                <th>Tax / fee logs</th>
                <th>Wallet movement</th>
                <th>Trace status</th>
              </tr>
            </thead>
            <tbody>
              {bookingTraceRows.map((row) => (
                <tr key={`${row.service.id}-${row.bookingService.id}`}>
                  <td>
                    <strong>{row.service.name}</strong>
                    <p className="muted">
                      {row.service.durationMin} min / {row.booking?.id.slice(0, 8) ?? row.bookingService.bookingId.slice(0, 8)}
                    </p>
                    <p className="muted">{row.booking?.status ?? 'UNKNOWN'}</p>
                  </td>
                  <td>
                    <strong>{formatMoney(row.bookingService.price, row.currency)}</strong>
                    <p className="muted">Qty {row.bookingService.quantity}</p>
                  </td>
                  <td>
                    {row.booking?.payment ? (
                      <div className="service-matrix-cell">
                        <strong>{formatMoney(row.booking.payment.amount, row.booking.payment.currency)}</strong>
                        <small>
                          {row.booking.payment.method} / {row.booking.payment.status}
                        </small>
                      </div>
                    ) : (
                      <span className="pill pill-warn">No payment</span>
                    )}
                  </td>
                  <td>
                    {row.booking?.earning ? (
                      <div className="service-matrix-cell">
                        <strong>{formatMoney(row.booking.earning.netAmount, row.booking.earning.currency)}</strong>
                        <small>Gross {formatMoney(row.booking.earning.grossAmount, row.booking.earning.currency)}</small>
                        <small>Fee {formatMoney(row.booking.earning.platformFee, row.booking.earning.currency)}</small>
                        <small>Tax {formatMoney(row.booking.earning.withholdingAmount, row.booking.earning.currency)}</small>
                      </div>
                    ) : (
                      <span className="pill pill-warn">No earning</span>
                    )}
                  </td>
                  <td>
                    <div className="service-matrix-cell">
                      <small>{row.taxLogCount} tax log(s)</small>
                      <small>{row.platformFeeLogCount} fee log(s)</small>
                      <small>Tax held {formatMoney(row.taxWithheldAmount, row.currency)}</small>
                      <small>Platform fee {formatMoney(row.platformFeeAmount, row.currency)}</small>
                    </div>
                  </td>
                  <td>
                    <div className="service-matrix-cell">
                      <strong>{formatMoney(row.walletAmount, row.currency)}</strong>
                      <small>{row.walletEntryCount} wallet row(s)</small>
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${row.traceTone}`}>{row.traceStatus}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No recent booking service rows were found for the current service catalog.</p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Create service with duration options</h2>
        <p className="muted">
          This creates one service type with 60, 90, and 120 minute options. Leave a duration blank if that
          option should not be sold yet. Add provider payout amounts now so each option can be booked
          immediately.
        </p>
        <form action={createServiceDurationSet} className="form-grid">
          <label>
            Group key (optional)
            <input name="serviceGroupKey" placeholder="auto from name, e.g. leg_massage" />
          </label>
          <label>
            Service name
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
        <h2>Add one duration option</h2>
        <p className="muted">
          Use this when an existing service type needs another duration. The group key connects the option
          to the parent service name in the customer app.
        </p>
        <form action={createService} className="form-grid">
          <label>
            Group key
            <input name="serviceGroupKey" placeholder="leg_massage" />
          </label>
          <label>
            Service name
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
                <p className="muted">
                  {formatDurationList(group.items)} option(s) / {formatGroupPriceRange(group.items)}
                </p>
              </div>
              <div className="actions">
                <span className="pill pill-info">{group.key}</span>
                <span
                  className={`pill ${
                    missingStandardDurations(group.items).length === 0 ? 'pill-success' : 'pill-warn'
                  }`}
                >
                  {missingStandardDurations(group.items).length === 0
                    ? '60/90/120 ready'
                    : `Missing ${missingStandardDurations(group.items).join('/')}`}
                </span>
              </div>
            </div>

            <div className="setup-stage-list">
              {group.items.map((service) => (
                <div className="setup-stage-item" key={service.id}>
                  <span>{service.active ? 'ON' : 'OFF'}</span>
                  <div>
                    <strong>{service.durationMin} min option</strong>
                    <p className="muted">
                      Minimum {formatMoney(service.basePrice, 'VND')} / step{' '}
                      {formatMoney(service.priceStep, 'VND')}
                    </p>
                    <p className="muted">
                      {service._count?.providers ?? 0} provider price row(s), {service._count?.bookings ?? 0}{' '}
                      booking row(s)
                    </p>
                    <ProviderPriceImpact service={service} activeTaxPolicy={activeTaxPolicy} />

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

                    <h3>Price ladder coverage</h3>
                    <p className="muted">
                      Providers may set prices at these increments. Booking stays blocked for any exact
                      customer price without an active payout rule.
                    </p>
                    <div className="participant-list" style={{ marginBottom: 12 }}>
                      {priceLadderCoverage(service).map((item) => (
                        <span
                          className={`pill ${item.rule ? 'pill-success' : 'pill-warn'}`}
                          key={`${service.id}-${item.price}`}
                        >
                          {formatMoney(item.price, 'VND')}
                          {item.rule
                            ? ` -> ${formatMoney(item.rule.providerPayoutAmount, item.rule.currency)}`
                            : ' missing'}
                        </span>
                      ))}
                    </div>

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

                    <h3>Bulk payout ladder import</h3>
                    <p className="muted">
                      Paste one row per customer price as <code>customerPrice,providerPayout</code>. This is
                      saved atomically so partial payout ladders do not leak into booking.
                    </p>
                    <form action={bulkUpsertPayoutRules} className="form-grid compact-form">
                      <input type="hidden" name="serviceId" value={service.id} />
                      <label className="full-span">
                        Price ladder rows
                        <textarea
                          name="rules"
                          rows={4}
                          defaultValue={bulkPayoutRuleExample(service)}
                          spellCheck={false}
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
                        <input name="notes" placeholder="Internal finance memo for this ladder import" />
                      </label>
                      <button type="submit">Import payout ladder</button>
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

function serviceActionNotice(params: Record<string, string | string[] | undefined>) {
  const status = readSingleParam(params.status);
  const reason = readSingleParam(params.reason);
  if (!status || !reason) {
    return null;
  }

  const savedMessages: Record<string, { title: string; detail: string }> = {
    'service-created': {
      title: 'Service option created',
      detail: 'The new service duration option and any base payout rule have been saved.',
    },
    'duration-set-created': {
      title: 'Duration set created',
      detail: 'The service type was created with the valid duration options that passed pricing checks.',
    },
    'service-updated': {
      title: 'Service option updated',
      detail: 'The service duration option was updated and the catalog has been refreshed.',
    },
    'payout-rule-saved': {
      title: 'Payout rule saved',
      detail: 'The customer price now has a provider payout rule for booking and finance checks.',
    },
    'payout-rule-updated': {
      title: 'Payout rule updated',
      detail: 'The payout rule was updated and pricing health has been recalculated.',
    },
    'bulk-payout-rules-saved': {
      title: 'Payout ladder saved',
      detail: 'The service now has the imported customer price and provider payout rows.',
    },
  };

  const blockedMessages: Record<string, { title: string; detail: string }> = {
    'missing-service-fields': {
      title: 'Required service fields are missing',
      detail: 'Enter a service name, duration, and minimum customer price before saving.',
    },
    'missing-duration-prices': {
      title: 'No duration price was entered',
      detail: 'Enter at least one duration price, such as 60, 90, or 120 minutes, before creating a set.',
    },
    'invalid-duration-set': {
      title: 'Duration set pricing is invalid',
      detail:
        'Every filled duration must follow the configured price step, and provider payout cannot exceed the customer price.',
    },
    'invalid-service-pricing': {
      title: 'Service pricing is invalid',
      detail: 'Minimum prices must be positive and match the configured price step, usually 100,000 VND.',
    },
    'missing-payout-fields': {
      title: 'Payout fields are missing',
      detail: 'Enter both the customer price and provider payout before saving a payout rule.',
    },
    'missing-bulk-payout-fields': {
      title: 'Bulk payout import is empty',
      detail: 'Paste at least one customer price and provider payout row before importing.',
    },
    'invalid-bulk-payout': {
      title: 'Bulk payout import is invalid',
      detail:
        'Each row must be customerPrice,providerPayoutAmount. Provider payout cannot exceed the customer price.',
    },
    'invalid-payout': {
      title: 'Provider payout is too high',
      detail: 'Provider payout cannot be greater than the customer price for the same service option.',
    },
    'api-rejected': {
      title: 'API rejected the service update',
      detail:
        'The backend did not save this change. Recheck the price step, payout rule, duplicate service values, or API connection.',
    },
  };

  if (status === 'saved') {
    return { tone: 'success' as const, ...(savedMessages[reason] ?? savedMessages['service-updated']) };
  }
  if (status === 'blocked') {
    return {
      tone: 'danger' as const,
      ...(blockedMessages[reason] ?? {
        title: 'Service action blocked',
        detail: 'Review the service pricing and payout values, then try again.',
      }),
    };
  }
  return null;
}

function readSingleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function ProviderPriceImpact({
  service,
  activeTaxPolicy,
}: {
  service: AdminServiceCatalogItem;
  activeTaxPolicy: AdminTaxPolicyVersion | undefined;
}) {
  const impact = providerPriceImpact(service, activeTaxPolicy);
  const visibleRows = impact.rows.filter((row) => row.state === 'bookable').length;
  const hiddenRows = impact.rows.length - visibleRows;

  return (
    <div className="service-impact-card">
      <div className="risk-watch-header">
        <div>
          <h3>Provider price impact</h3>
          <p className="muted">
            Shows which provider prices are visible in the customer app for this exact duration option.
          </p>
        </div>
        <span className={`pill ${hiddenRows ? 'pill-warn' : 'pill-success'}`}>
          {visibleRows} visible / {hiddenRows} hidden
        </span>
      </div>
      <div className="participant-list">
        <span className="pill pill-info">{impact.rows.length} loaded row(s)</span>
        <span className={impact.unsupportedCount ? 'pill pill-warn' : 'pill pill-success'}>
          {impact.unsupportedCount} missing payout
        </span>
        <span className={impact.belowMinimumCount ? 'pill pill-danger' : 'pill pill-success'}>
          {impact.belowMinimumCount} below minimum
        </span>
        <span className={impact.inactiveOrBlockedCount ? 'pill pill-neutral' : 'pill pill-success'}>
          {impact.inactiveOrBlockedCount} inactive/blocked
        </span>
      </div>
      {impact.rows.length ? (
        <div className="setup-stage-list">
          {impact.rows.slice(0, 6).map((row) => (
            <div className="setup-stage-item" key={row.id}>
              <span>{row.state === 'bookable' ? 'SHOW' : 'HIDE'}</span>
              <div>
                <strong>{row.providerName}</strong>
                <p className="muted">
                  Customer {formatMoney(row.price, row.currency)} / provider{' '}
                  {row.rule ? formatMoney(row.rule.providerPayoutAmount, row.currency) : 'not configured'}
                </p>
                <p className="muted">{row.reason}</p>
                {row.rule ? (
                  <p className="muted">
                    Commission projection:{' '}
                    {formatMoney(
                      servicePayoutFinance(service, row.rule, activeTaxPolicy).actualCompanyCommission,
                      row.currency,
                    )}
                  </p>
                ) : null}
              </div>
              <small>{row.providerStatus}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">No provider has configured a price for this duration yet.</p>
      )}
    </div>
  );
}

function servicePayoutLedgerRows(
  services: AdminServiceCatalogItem[],
  activeTaxPolicy: AdminTaxPolicyVersion | undefined,
) {
  return services
    .slice()
    .sort(
      (left, right) =>
        (left.serviceGroupKey ?? left.name).localeCompare(right.serviceGroupKey ?? right.name) ||
        left.durationMin - right.durationMin,
    )
    .map((service) => {
      const baseRule = basePayoutRule(service);
      const finance = baseRule
        ? servicePayoutFinance(service, baseRule, activeTaxPolicy)
        : {
            fee: 0,
            vatAmount: 0,
            withholdingAmount: 0,
            taxRuleLabel: null,
            actualCompanyCommission: 0,
          };
      const impact = providerPriceImpact(service, activeTaxPolicy);
      const visibleProviders = impact.rows.filter((row) => row.state === 'bookable').length;
      const hiddenProviders = impact.rows.length - visibleProviders;
      const commissionTone = !baseRule
        ? 'pill-danger'
        : finance.actualCompanyCommission <= 0
          ? 'pill-warn'
          : 'pill-success';
      const action = !baseRule
        ? 'Add payout rule'
        : finance.actualCompanyCommission <= 0
          ? 'Review margin'
          : hiddenProviders
            ? 'Fix hidden prices'
            : 'Ready';
      const actionTone = action === 'Ready' ? 'pill-success' : action === 'Review margin' ? 'pill-warn' : 'pill-danger';

      return {
        service,
        baseRule,
        finance,
        currency: baseRule?.currency ?? 'VND',
        visibleProviders,
        hiddenProviders,
        totalProviderRows: impact.rows.length,
        commissionTone,
        action,
        actionTone,
      };
    });
}

function serviceBookingTraceRows(services: AdminServiceCatalogItem[]) {
  return services
    .flatMap((service) =>
      (service.bookings ?? []).map((bookingService) => {
        const booking = bookingService.booking;
        const currency =
          booking?.payment?.currency ?? booking?.earning?.currency ?? booking?.taxLogs?.[0]?.currency ?? 'VND';
        const taxWithheldAmount = (booking?.taxLogs ?? []).reduce(
          (sum, log) => sum + log.withholdingAmount,
          0,
        );
        const platformFeeAmount = (booking?.platformFeeLogs ?? []).reduce(
          (sum, log) => sum + log.platformFeeAmount,
          0,
        );
        const walletAmount = (booking?.walletLedgerEntries ?? []).reduce((sum, entry) => sum + entry.amount, 0);
        const paymentReady = Boolean(booking?.payment);
        const earningReady = Boolean(booking?.earning);
        const taxReady = taxWithheldAmount > 0 || (booking?.taxLogs?.length ?? 0) > 0;
        const walletReady = (booking?.walletLedgerEntries?.length ?? 0) > 0;
        const missingParts = [
          paymentReady ? null : 'payment',
          earningReady ? null : 'earning',
          taxReady ? null : 'tax',
          walletReady ? null : 'wallet',
        ].filter(Boolean);
        const traceStatus = missingParts.length ? `Missing ${missingParts.join('/')}` : 'Complete';
        const traceTone = missingParts.length ? 'pill-warn' : 'pill-success';

        return {
          service,
          bookingService,
          booking,
          currency,
          taxLogCount: booking?.taxLogs?.length ?? 0,
          platformFeeLogCount: booking?.platformFeeLogs?.length ?? 0,
          taxWithheldAmount,
          platformFeeAmount,
          walletEntryCount: booking?.walletLedgerEntries?.length ?? 0,
          walletAmount,
          traceStatus,
          traceTone,
        };
      }),
    )
    .sort((left, right) => {
      const leftCreatedAt = left.booking?.createdAt ? new Date(left.booking.createdAt).getTime() : 0;
      const rightCreatedAt = right.booking?.createdAt ? new Date(right.booking.createdAt).getTime() : 0;
      return rightCreatedAt - leftCreatedAt || left.service.name.localeCompare(right.service.name);
    })
    .slice(0, 24);
}

function serviceDurationMatrix(
  items: AdminServiceCatalogItem[],
  activeTaxPolicy: AdminTaxPolicyVersion | undefined,
) {
  const byDuration = new Map<
    number,
    {
      service: AdminServiceCatalogItem;
      baseRule: NonNullable<AdminServiceCatalogItem['payoutRules']>[number] | null;
      finance: ReturnType<typeof servicePayoutFinance>;
    }
  >();

  for (const service of items) {
    const baseRule = basePayoutRule(service);
    byDuration.set(service.durationMin, {
      service,
      baseRule,
      finance: baseRule
        ? servicePayoutFinance(service, baseRule, activeTaxPolicy)
        : {
            fee: 0,
            vatAmount: 0,
            withholdingAmount: 0,
            taxRuleLabel: null,
            actualCompanyCommission: 0,
          },
    });
  }

  const activeItems = items.filter((item) => item.active);
  return {
    byDuration,
    activeCount: activeItems.length,
    payoutRuleCount: items.reduce((sum, item) => sum + (item.payoutRules?.length ?? 0), 0),
    blockedCount: activeItems.filter(
      (item) =>
        !(item.payoutRules ?? []).some(
          (rule) => rule.active && rule.customerPrice === item.basePrice,
        ),
    ).length,
  };
}

function basePayoutRule(service: AdminServiceCatalogItem) {
  return (
    (service.payoutRules ?? []).find((rule) => rule.active && rule.customerPrice === service.basePrice) ?? null
  );
}

function formatDurationList(items: AdminServiceCatalogItem[]) {
  return items
    .map((item) => item.durationMin)
    .sort((left, right) => left - right)
    .map((duration) => `${duration} min`)
    .join(', ');
}

function missingStandardDurations(items: AdminServiceCatalogItem[]) {
  const configured = new Set(items.filter((item) => item.active).map((item) => item.durationMin));
  return [60, 90, 120].filter((duration) => !configured.has(duration));
}

function formatGroupPriceRange(items: AdminServiceCatalogItem[]) {
  const prices = items.filter((item) => item.active).map((item) => item.basePrice);
  if (prices.length === 0) {
    return 'no active price';
  }
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatMoney(min, 'VND') : `${formatMoney(min, 'VND')} - ${formatMoney(max, 'VND')}`;
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
      const providerPriceRows = providerPriceImpact(service, activeTaxPolicy).rows.filter(
        (row) => row.state !== 'bookable',
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

      for (const row of providerPriceRows) {
        items.push({
          serviceId: service.id,
          title: `${service.name} / ${service.durationMin} min`,
          status: row.state === 'below_minimum' ? 'BLOCKED' : 'HIDDEN',
          detail: `${row.providerName} price ${formatMoney(row.price, row.currency)}: ${row.reason}`,
          action:
            row.state === 'missing_payout'
              ? 'Add an active payout rule for this exact provider customer price.'
              : row.state === 'below_minimum'
                ? 'Ask the provider to raise the price or lower the admin minimum price intentionally.'
                : 'No customer action needed unless this provider should be visible.',
          tone: row.state === 'below_minimum' ? 'blocked' : 'warning',
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

function providerPriceImpact(
  service: AdminServiceCatalogItem,
  activeTaxPolicy: AdminTaxPolicyVersion | undefined,
) {
  const activeRules = new Map(
    (service.payoutRules ?? [])
      .filter((rule) => rule.active)
      .map((rule) => [rule.customerPrice, rule] as const),
  );
  const rows = (service.providers ?? [])
    .slice()
    .sort((left, right) => {
      const leftName = left.providerProfile?.displayName ?? left.providerProfileId;
      const rightName = right.providerProfile?.displayName ?? right.providerProfileId;
      return Number(right.active) - Number(left.active) || left.price - right.price || leftName.localeCompare(rightName);
    })
    .map((providerService) => {
      const rule = activeRules.get(providerService.price) ?? null;
      const providerName = providerService.providerProfile?.displayName ?? 'Unnamed provider';
      const providerStatus = providerService.providerProfile?.status ?? 'UNKNOWN';
      const providerBlocked = Boolean(providerService.providerProfile?.blockedAt);
      let state: 'bookable' | 'missing_payout' | 'below_minimum' | 'inactive' = 'bookable';
      let reason = 'Customer can book this provider price.';

      if (!providerService.active || providerBlocked) {
        state = 'inactive';
        reason = providerBlocked ? 'Provider account is blocked.' : 'Provider price row is inactive.';
      } else if (providerService.price < service.basePrice) {
        state = 'below_minimum';
        reason = 'Provider price is below the admin minimum, so it must stay hidden.';
      } else if (!rule) {
        state = 'missing_payout';
        reason = 'No active payout rule exists for this exact customer price, so booking stays hidden.';
      } else if (actualCompanyCommission(service, rule, activeTaxPolicy) <= 0) {
        state = 'missing_payout';
        reason = 'Payout rule exists, but projected company commission is not positive.';
      }

      return {
        id: providerService.id,
        providerName,
        providerStatus,
        price: providerService.price,
        currency: rule?.currency ?? 'VND',
        rule,
        state,
        reason,
      };
    });

  return {
    rows,
    unsupportedCount: rows.filter((row) => row.state === 'missing_payout').length,
    belowMinimumCount: rows.filter((row) => row.state === 'below_minimum').length,
    inactiveOrBlockedCount: rows.filter((row) => row.state === 'inactive').length,
  };
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

function priceLadderCoverage(service: AdminServiceCatalogItem) {
  const activeRules = new Map(
    (service.payoutRules ?? [])
      .filter((rule) => rule.active)
      .map((rule) => [rule.customerPrice, rule] as const),
  );
  const priceStep = Math.max(100000, service.priceStep || 100000);
  const prices = new Set<number>();
  for (let index = 0; index < 4; index += 1) {
    prices.add(service.basePrice + priceStep * index);
  }
  for (const rule of service.payoutRules ?? []) {
    prices.add(rule.customerPrice);
  }

  return [...prices]
    .sort((left, right) => left - right)
    .map((price) => ({
      price,
      rule: activeRules.get(price) ?? null,
    }));
}

function bulkPayoutRuleExample(service: AdminServiceCatalogItem) {
  const priceStep = Math.max(100000, service.priceStep || 100000);
  const existingRows = (service.payoutRules ?? [])
    .filter((rule) => rule.active)
    .sort((left, right) => left.customerPrice - right.customerPrice)
    .slice(0, 4)
    .map((rule) => `${rule.customerPrice},${rule.providerPayoutAmount}`);
  if (existingRows.length > 0) {
    return existingRows.join('\n');
  }
  return [0, 1, 2]
    .map((index) => {
      const customerPrice = service.basePrice + priceStep * index;
      const providerPayout = Math.max(0, customerPrice - Math.round(customerPrice * 0.2));
      return `${customerPrice},${providerPayout}`;
    })
    .join('\n');
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
