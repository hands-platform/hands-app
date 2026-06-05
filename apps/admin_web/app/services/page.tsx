import Link from 'next/link';

import { AdminAuditLog, AdminServiceCatalogItem, AdminTaxPolicyVersion, adminGet } from '../../lib/admin-api';
import { formatDateTime, formatMoney, formatRelativeTime } from '../../lib/admin-format';
import {
  bulkUpsertPayoutRules,
  createService,
  createServiceDurationSet,
  updatePayoutRule,
  updateService,
  upsertPayoutRule,
} from './actions';

type ServicesPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const SERVICE_GROUP_RENDER_LIMIT = 40;
const SERVICE_ROW_RENDER_LIMIT = 80;

export default async function ServicesPage({ searchParams }: { searchParams?: ServicesPageSearchParams }) {
  const params = (await searchParams) ?? {};
  const [services, taxPolicies, auditLogs] = await Promise.all([
    adminGet<AdminServiceCatalogItem[]>('/admin/services', []),
    adminGet<AdminTaxPolicyVersion[]>('/admin/tax-policy-versions', []),
    adminGet<AdminAuditLog[]>('/admin/audit-logs', []),
  ]);
  const activeServices = services.filter((service) => service.active);
  const payoutRuleCount = services.reduce((sum, service) => sum + (service.payoutRules?.length ?? 0), 0);
  const groupedServices = groupServices(services);
  const serviceSearchQuery = (readSingleParam(params.q) ?? '').trim();
  const filteredGroupedServices = filterServiceGroups(groupedServices, serviceSearchQuery);
  const filteredActiveServices = filterServices(activeServices, serviceSearchQuery);
  const activeTaxPolicy = selectActiveTaxPolicy(taxPolicies);
  const healthItems = buildPricingHealth(services, activeTaxPolicy);
  const readinessItems = buildBookingReadinessQueue(services, activeTaxPolicy);
  const blockedReadinessItems = readinessItems.filter((item) => item.tone === 'blocked');
  const warningReadinessItems = readinessItems.filter((item) => item.tone === 'warning');
  const bookingTraceRows = serviceBookingTraceRows(services);
  const bookingTraceSummary = serviceBookingTraceSummary(bookingTraceRows);
  const pricePolicyPreviewRows = servicePricePolicyPreviewRows(filteredActiveServices, activeTaxPolicy);
  const pricePolicyPreviewSummary = servicePricePolicyPreviewSummary(pricePolicyPreviewRows);
  const payoutLedgerRows = servicePayoutLedgerRows(filteredActiveServices, activeTaxPolicy);
  const serviceTypeCoverageRows = buildServiceTypeCoverageRows(filteredGroupedServices, activeTaxPolicy);
  const serviceTypeCoverageSummary = buildServiceTypeCoverageSummary(serviceTypeCoverageRows);
  const visibleServiceTypeCoverageRows = serviceTypeCoverageRows.slice(0, SERVICE_GROUP_RENDER_LIMIT);
  const hiddenServiceTypeCoverageRowCount = Math.max(
    serviceTypeCoverageRows.length - visibleServiceTypeCoverageRows.length,
    0,
  );
  const visibleGroupedServices = filteredGroupedServices.slice(0, SERVICE_GROUP_RENDER_LIMIT);
  const hiddenServiceGroupCount = Math.max(filteredGroupedServices.length - visibleGroupedServices.length, 0);
  const visiblePayoutLedgerRows = payoutLedgerRows.slice(0, SERVICE_ROW_RENDER_LIMIT);
  const hiddenPayoutLedgerRowCount = Math.max(payoutLedgerRows.length - visiblePayoutLedgerRows.length, 0);
  const visiblePricePolicyPreviewRows = pricePolicyPreviewRows.slice(0, SERVICE_ROW_RENDER_LIMIT);
  const hiddenPricePolicyPreviewRowCount = Math.max(
    pricePolicyPreviewRows.length - visiblePricePolicyPreviewRows.length,
    0,
  );
  const pricingAuditRows = servicePricingAuditRows(auditLogs);
  const actionNotice = serviceActionNotice(params);
  const catalogScopeLabel = serviceSearchQuery ? `Filtered by "${serviceSearchQuery}"` : 'All service types';

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

      <section className="card" style={{ marginBottom: 16 }}>
        <form className="form-grid compact-form" action="/services">
          <label className="full-span">
            Find service type, duration, group key, or price
            <input
              name="q"
              placeholder="foot massage, 90, 450000, deep_tissue"
              defaultValue={serviceSearchQuery}
            />
          </label>
          <button type="submit">Search catalog</button>
          {serviceSearchQuery ? (
            <a className="pill pill-neutral" href="/services">
              Clear search
            </a>
          ) : null}
        </form>
        <p className="muted" style={{ marginTop: 10 }}>
          {catalogScopeLabel}: showing {filteredGroupedServices.length} service type(s) and{' '}
          {filteredActiveServices.length} active duration option(s). Dashboard readiness cards still check the
          full catalog.
        </p>
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
          <div className="ops-section-header">
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
        <div className="ops-section-header">
          <div>
            <h2>Customer booking exposure guard</h2>
            <p className="muted">
              Customer and partner apps only expose service options backed by an active payout rule. Use this
              guard before opening a new service type or changing partner prices.
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
        <div className="service-trace-summary">
          <div>
            <span>Active duration options</span>
            <strong>{activeServices.length}</strong>
          </div>
          <div>
            <span>Rules configured</span>
            <strong>{payoutRuleCount}</strong>
          </div>
          <div>
            <span>Trace gaps</span>
            <strong>{bookingTraceSummary.missingTraceCount}</strong>
          </div>
          <div>
            <span>Projected policy checks</span>
            <strong>{pricePolicyPreviewSummary.policyCheckCount}</strong>
          </div>
        </div>
        <div className="actions" style={{ marginTop: 12 }}>
          <Link className="text-link" href="/bookings?view=pricing">
            Open pricing-check bookings
          </Link>
          <a className="text-link" href="/audit-log?bucket=Service%2FPricing">
            Review service pricing audit
          </a>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <div className="ops-section-header">
          <div>
            <h2>Service type coverage board</h2>
            <p className="muted">
              Checks each service name as one operating unit: duration options, minimum-price payout rules,
              partner price visibility, and projected company commission.
            </p>
          </div>
          <div className="actions">
            <span
              className={
                serviceTypeCoverageSummary.blockedCount ? 'pill pill-danger' : 'pill pill-success'
              }
            >
              {serviceTypeCoverageSummary.blockedCount} blocked
            </span>
            <span
              className={
                serviceTypeCoverageSummary.warningCount ? 'pill pill-warn' : 'pill pill-success'
              }
            >
              {serviceTypeCoverageSummary.warningCount} warning
            </span>
            <span className="pill pill-info">{serviceTypeCoverageSummary.readyCount} ready</span>
          </div>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 12 }}>
          <div>
            <span>Service types checked</span>
            <strong>{serviceTypeCoverageRows.length}</strong>
          </div>
          <div>
            <span>Missing duration options</span>
            <strong>{serviceTypeCoverageSummary.missingDurationCount}</strong>
          </div>
          <div>
            <span>Missing base payout</span>
            <strong>{serviceTypeCoverageSummary.missingBasePayoutCount}</strong>
          </div>
          <div>
            <span>Hidden partner prices</span>
            <strong>{serviceTypeCoverageSummary.hiddenPartnerPriceCount}</strong>
          </div>
          <div>
            <span>Net company fee</span>
            <strong>
              {formatMoney(serviceTypeCoverageSummary.netCompanyFee, serviceTypeCoverageSummary.currency)}
            </strong>
          </div>
        </div>
        {visibleServiceTypeCoverageRows.length ? (
          <table className="table service-trace" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Service type</th>
                <th>Duration coverage</th>
                <th>Payout coverage</th>
                <th>Partner price visibility</th>
                <th>Finance snapshot</th>
                <th>Next action</th>
              </tr>
            </thead>
            <tbody>
              {visibleServiceTypeCoverageRows.map((row) => (
                <tr key={row.key}>
                  <td>
                    <strong>{row.label}</strong>
                    <p className="muted">{row.key}</p>
                  </td>
                  <td>
                    <div className="service-matrix-cell">
                      <span className={`pill ${row.missingDurations.length ? 'pill-warn' : 'pill-success'}`}>
                        {row.activeDurationLabels || 'No active duration'}
                      </span>
                      <small>
                        Missing duration options:{' '}
                        {row.missingDurations.length
                          ? row.missingDurations.map((duration) => `${duration} min`).join(', ')
                          : 'none'}
                      </small>
                    </div>
                  </td>
                  <td>
                    <div className="service-matrix-cell">
                      <span
                        className={`pill ${row.missingBasePayoutCount ? 'pill-danger' : 'pill-success'}`}
                      >
                        {row.missingBasePayoutCount} missing base payout
                      </span>
                      <small>{row.activeOptionCount} active option(s)</small>
                      <small>{row.payoutRuleCount} payout rule(s)</small>
                    </div>
                  </td>
                  <td>
                    <div className="service-matrix-cell">
                      <span className={`pill ${row.hiddenPartnerPriceCount ? 'pill-warn' : 'pill-success'}`}>
                        {row.visiblePartnerPriceCount} visible / {row.hiddenPartnerPriceCount} hidden
                      </span>
                      <small>{row.belowMinimumCount} below minimum</small>
                      <small>{row.missingPayoutPriceCount} missing payout rule</small>
                    </div>
                  </td>
                  <td>
                    <div className="service-matrix-cell">
                      <strong>{formatMoney(row.netCompanyFee, row.currency)}</strong>
                      <small>Customer min {formatMoney(row.customerMinimumTotal, row.currency)}</small>
                      <small>Partner payout {formatMoney(row.partnerPayoutTotal, row.currency)}</small>
                    </div>
                  </td>
                  <td>
                    <span className={`pill ${row.tone}`}>{row.statusLabel}</span>
                    <p className="muted">{row.nextAction}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No service type matches the current catalog search.</p>
        )}
        {hiddenServiceTypeCoverageRowCount ? (
          <p className="muted">
            Showing first {visibleServiceTypeCoverageRows.length} of {serviceTypeCoverageRows.length} service
            type(s). Search by service name or group key to narrow the board.
          </p>
        ) : null}
      </section>

      <section className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <div className="ops-section-header">
          <div>
            <h2>Recent pricing audit trail</h2>
            <p className="muted">
              Tracks who changed service prices, partner payout amounts, VAT, other costs, and duration
              settings. Use this before investigating unexpected commission or payout changes.
            </p>
          </div>
          <a className="text-link" href="/audit-log?bucket=Service%2FPricing">
            Open service audit
          </a>
        </div>
        {pricingAuditRows.length ? (
          <table className="table service-trace">
            <thead>
              <tr>
                <th>When</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Target</th>
                <th>Changed fields</th>
                <th>Pricing snapshot</th>
              </tr>
            </thead>
            <tbody>
              {pricingAuditRows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{relativeTime(row.createdAt)}</strong>
                    <p className="muted">{formatDateTime(row.createdAt)}</p>
                  </td>
                  <td>
                    <span className="pill pill-warn">{humanizeAuditAction(row.action)}</span>
                  </td>
                  <td>{row.actorName}</td>
                  <td>
                    <strong>{row.targetShort}</strong>
                    <p className="muted">{row.target}</p>
                  </td>
                  <td>
                    <div className="participant-list">
                      {row.changedFields.map((field) => (
                        <span className="pill pill-info" key={`${row.id}-${field}`}>
                          {field}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="service-matrix-cell">
                      <small>{row.serviceLabel}</small>
                      <small>{row.priceLabel}</small>
                      <small>{row.payoutLabel}</small>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No recent service pricing audit event has been recorded yet.</p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Pricing health</h2>
            <p className="muted">
              Partners can charge the minimum price or higher, but every configured customer price should have
              a payout rule so finance can separate partner payout, VAT, withholding, and actual commission.
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
        <div className="ops-section-header">
          <div>
            <h2>Booking readiness queue</h2>
            <p className="muted">
              Shows services that can block customer booking or create a negative finance result before
              partners start using those prices.
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
        <div className="ops-section-header">
          <div>
            <h2>Duration pricing matrix</h2>
            <p className="muted">
              One row is one service name. Each duration cell shows customer minimum, partner payout, and
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
            {visibleGroupedServices.map((group) => {
              const matrix = serviceDurationMatrix(group.items, activeTaxPolicy);
              return (
                <tr key={group.key}>
                  <td>
                    <strong>{group.label}</strong>
                    <p className="muted">{group.key}</p>
                  </td>
                  {[60, 90, 120].map((duration) => {
                    const cell = matrix.byDuration.get(duration);
                    const cellCurrency = cell?.baseRule?.currency ?? 'VND';
                    const cellTaxAndCost = cell?.baseRule
                      ? cell.finance.vatAmount +
                        cell.finance.withholdingAmount +
                        cell.baseRule.otherCostAmount
                      : 0;
                    return (
                      <td key={`${group.key}-${duration}`}>
                        {cell ? (
                          <div className="service-matrix-cell">
                            <strong>Customer {formatMoney(cell.service.basePrice, cellCurrency)}</strong>
                            <span className={cell.baseRule ? 'pill pill-success' : 'pill pill-danger'}>
                              {cell.baseRule ? 'Payout ready' : 'Payout missing'}
                            </span>
                            <small>
                              Partner{' '}
                              {cell.baseRule
                                ? formatMoney(cell.baseRule.providerPayoutAmount, cell.baseRule.currency)
                                : 'not set'}
                            </small>
                            <small>
                              Gross HANDS fee{' '}
                              {cell.baseRule ? formatMoney(cell.finance.fee, cellCurrency) : '-'}
                            </small>
                            <small>
                              VAT / withholding / cost{' '}
                              {cell.baseRule ? formatMoney(cellTaxAndCost, cellCurrency) : '-'}
                            </small>
                            <small>
                              Net company fee{' '}
                              {cell.baseRule
                                ? formatMoney(cell.finance.actualCompanyCommission, cellCurrency)
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
                      <small>
                        Customer minimum total{' '}
                        {formatMoney(matrix.totals.customerMinimum, matrix.totals.currency)}
                      </small>
                      <small>
                        Partner payout total{' '}
                        {formatMoney(matrix.totals.providerPayout, matrix.totals.currency)}
                      </small>
                      <small>
                        Gross HANDS fee total {formatMoney(matrix.totals.grossFee, matrix.totals.currency)}
                      </small>
                      <small>
                        Tax / cost total {formatMoney(matrix.totals.taxAndCost, matrix.totals.currency)}
                      </small>
                      <small>
                        Net company fee total{' '}
                        {formatMoney(matrix.totals.netCompanyFee, matrix.totals.currency)}
                      </small>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {hiddenServiceGroupCount ? (
          <p className="muted">
            Showing first {visibleGroupedServices.length} of {groupedServices.length} service type(s) to keep
            the operations page responsive. Full totals above still use the complete catalog.
          </p>
        ) : null}
      </section>

      <section className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <div className="ops-section-header">
          <div>
            <h2>Service payout ledger</h2>
            <p className="muted">
              Finance view for the current minimum price of every active duration option. This is the fastest
              way to confirm customer price, partner payout, tax/cost assumptions, and customer-app visibility
              before partners start selling.
            </p>
          </div>
          <span className="pill pill-info">{activeServices.length} active option(s)</span>
        </div>
        <table className="table service-ledger">
          <thead>
            <tr>
              <th>Service option</th>
              <th>Customer price</th>
              <th>Partner payout</th>
              <th>Gross fee</th>
              <th>Tax / cost</th>
              <th>Actual company commission</th>
              <th>Partner visibility</th>
              <th>Next action</th>
            </tr>
          </thead>
          <tbody>
            {visiblePayoutLedgerRows.map((row) => (
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
                    {row.baseRule
                      ? formatMoney(row.finance.actualCompanyCommission, row.currency)
                      : 'Missing rule'}
                  </span>
                </td>
                <td>
                  <div className="service-matrix-cell">
                    <span className={`pill ${row.hiddenProviders ? 'pill-warn' : 'pill-success'}`}>
                      {row.visibleProviders} visible / {row.hiddenProviders} hidden
                    </span>
                    <small>{row.totalProviderRows} partner price row(s)</small>
                  </div>
                </td>
                <td>
                  <span className={`pill ${row.actionTone}`}>{row.action}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hiddenPayoutLedgerRowCount ? (
          <p className="muted">
            Showing first {visiblePayoutLedgerRows.length} of {payoutLedgerRows.length} active option(s). Full
            finance totals still include every active option.
          </p>
        ) : null}
      </section>

      <section className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <div className="ops-section-header">
          <div>
            <h2>Price policy change preview</h2>
            <p className="muted">
              Before changing service prices, compare the current minimum price against common one-step
              scenarios. This helps avoid accidentally creating zero-margin prices or partner payouts that
              create cash booking closeout problems.
            </p>
          </div>
          <span
            className={`pill ${pricePolicyPreviewSummary.policyCheckCount ? 'pill-warn' : 'pill-success'}`}
          >
            {pricePolicyPreviewSummary.policyCheckCount} policy check(s)
          </span>
        </div>
        <div className="service-trace-summary">
          <div>
            <span>Previewed options</span>
            <strong>{pricePolicyPreviewRows.length}</strong>
          </div>
          <div>
            <span>Current commission</span>
            <strong>
              {formatMoney(pricePolicyPreviewSummary.currentCommission, pricePolicyPreviewSummary.currency)}
            </strong>
          </div>
          <div>
            <span>Customer + step</span>
            <strong>
              {formatMoney(
                pricePolicyPreviewSummary.customerStepCommission,
                pricePolicyPreviewSummary.currency,
              )}
            </strong>
          </div>
          <div>
            <span>Partner + step</span>
            <strong>
              {formatMoney(
                pricePolicyPreviewSummary.providerStepCommission,
                pricePolicyPreviewSummary.currency,
              )}
            </strong>
          </div>
          <div>
            <span>Both + step</span>
            <strong>
              {formatMoney(
                pricePolicyPreviewSummary.balancedStepCommission,
                pricePolicyPreviewSummary.currency,
              )}
            </strong>
          </div>
          <div>
            <span>Missing base rule</span>
            <strong>{pricePolicyPreviewSummary.missingBaseRuleCount}</strong>
          </div>
        </div>
        {pricePolicyPreviewRows.length ? (
          <table className="table service-trace">
            <thead>
              <tr>
                <th>Service option</th>
                <th>Current policy</th>
                <th>Customer + step</th>
                <th>Partner + step</th>
                <th>Both + step</th>
                <th>Check</th>
              </tr>
            </thead>
            <tbody>
              {visiblePricePolicyPreviewRows.map((row) => (
                <tr key={row.service.id}>
                  <td>
                    <strong>{row.service.name}</strong>
                    <p className="muted">
                      {row.service.durationMin} min / step {formatMoney(row.priceStep, row.currency)}
                    </p>
                  </td>
                  <td>
                    {row.baseRule ? (
                      <div className="service-matrix-cell">
                        <strong>{formatMoney(row.baseRule.customerPrice, row.currency)}</strong>
                        <small>Partner {formatMoney(row.baseRule.providerPayoutAmount, row.currency)}</small>
                        <small>
                          Commission {formatMoney(row.currentFinance.actualCompanyCommission, row.currency)}
                        </small>
                      </div>
                    ) : (
                      <span className="pill pill-danger">Missing base payout</span>
                    )}
                  </td>
                  <td>
                    <ScenarioPreviewCell scenario={row.customerStepScenario} />
                  </td>
                  <td>
                    <ScenarioPreviewCell scenario={row.providerStepScenario} />
                  </td>
                  <td>
                    <ScenarioPreviewCell scenario={row.balancedStepScenario} />
                  </td>
                  <td>
                    <span className={`pill ${row.checkTone}`}>{row.checkLabel}</span>
                    <p className="muted">{row.nextAction}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="muted">No active service option is available for price policy preview.</p>
        )}
        {hiddenPricePolicyPreviewRowCount ? (
          <p className="muted">
            Showing first {visiblePricePolicyPreviewRows.length} of {pricePolicyPreviewRows.length} preview
            row(s). Check summaries above still use the full active catalog.
          </p>
        ) : null}
      </section>

      <section className="card" style={{ marginBottom: 16, overflowX: 'auto' }}>
        <div className="ops-section-header">
          <div>
            <h2>Recent booking finance trace</h2>
            <p className="muted">
              Links service pricing to booking payment, partner earning, tax log, platform fee log, and wallet
              movement. Use this after changing a price policy to confirm real bookings are producing the
              expected finance records.
            </p>
          </div>
          <span className="pill pill-info">{bookingTraceRows.length} trace row(s)</span>
        </div>
        <div className="service-trace-summary">
          <div>
            <span>Payment total</span>
            <strong>{formatMoney(bookingTraceSummary.paymentAmount, bookingTraceSummary.currency)}</strong>
          </div>
          <div>
            <span>Partner net</span>
            <strong>
              {formatMoney(bookingTraceSummary.providerNetAmount, bookingTraceSummary.currency)}
            </strong>
          </div>
          <div>
            <span>Platform fee</span>
            <strong>
              {formatMoney(bookingTraceSummary.platformFeeAmount, bookingTraceSummary.currency)}
            </strong>
          </div>
          <div>
            <span>Withholding</span>
            <strong>
              {formatMoney(bookingTraceSummary.withholdingAmount, bookingTraceSummary.currency)}
            </strong>
          </div>
          <div>
            <span>Wallet movement</span>
            <strong>{formatMoney(bookingTraceSummary.walletAmount, bookingTraceSummary.currency)}</strong>
          </div>
          <div>
            <span>Missing trace</span>
            <strong>{bookingTraceSummary.missingTraceCount} row(s)</strong>
          </div>
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
                      {row.service.durationMin} min /{' '}
                      {row.booking?.id.slice(0, 8) ?? row.bookingService.bookingId.slice(0, 8)}
                    </p>
                    <p className="muted">{row.booking?.status ?? 'UNKNOWN'}</p>
                    {row.booking ? (
                      <a className="text-link" href={`/bookings/${row.booking.id}`}>
                        Open booking
                      </a>
                    ) : null}
                  </td>
                  <td>
                    <strong>{formatMoney(row.bookingService.price, row.currency)}</strong>
                    <p className="muted">Qty {row.bookingService.quantity}</p>
                  </td>
                  <td>
                    {row.booking?.payment ? (
                      <div className="service-matrix-cell">
                        <strong>
                          {formatMoney(row.booking.payment.amount, row.booking.payment.currency)}
                        </strong>
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
                        <strong>
                          {formatMoney(row.booking.earning.netAmount, row.booking.earning.currency)}
                        </strong>
                        <small>
                          Gross {formatMoney(row.booking.earning.grossAmount, row.booking.earning.currency)}
                        </small>
                        <small>
                          Fee {formatMoney(row.booking.earning.platformFee, row.booking.earning.currency)}
                        </small>
                        <small>
                          Tax{' '}
                          {formatMoney(row.booking.earning.withholdingAmount, row.booking.earning.currency)}
                        </small>
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
          option should not be sold yet. Add partner payout amounts now so each option can be booked
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
            60 min partner payout
            <input name="providerPayoutAmount60" type="number" min="0" step="1000" placeholder="380000" />
          </label>
          <label>
            90 min minimum
            <input name="basePrice90" type="number" min="100000" step="100000" placeholder="700000" />
          </label>
          <label>
            90 min partner payout
            <input name="providerPayoutAmount90" type="number" min="0" step="1000" placeholder="540000" />
          </label>
          <label>
            120 min minimum
            <input name="basePrice120" type="number" min="100000" step="100000" placeholder="900000" />
          </label>
          <label>
            120 min partner payout
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
            <input name="description" placeholder="Shown in customer/partner apps" />
          </label>
          <button type="submit">Create duration set</button>
        </form>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Add one duration option</h2>
        <p className="muted">
          Use this when an existing service type needs another duration. The group key connects the option to
          the parent service name in the customer app.
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
            Partner payout
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
            <input name="description" placeholder="Shown in customer/partner apps" />
          </label>
          <button type="submit">Create service</button>
        </form>
      </section>

      <section className="grid">
        {hiddenServiceGroupCount ? (
          <article className="card">
            <h2>Large catalog mode</h2>
            <p className="muted">
              Editing is capped to the first {visibleGroupedServices.length} service type(s) on this page so
              admin operations stay fast. The full catalog remains included in health, booking readiness, and
              finance summaries.
            </p>
          </article>
        ) : null}
        {visibleGroupedServices.map((group) => (
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
                      {service._count?.providers ?? 0} partner price row(s), {service._count?.bookings ?? 0}{' '}
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
                      Partners may set prices at these increments. Booking stays blocked for any exact
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
                                Customer {formatMoney(rule.customerPrice, rule.currency)} / partner{' '}
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
                                  Partner payout
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
                        Partner payout
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

function filterServiceGroups(groups: ReturnType<typeof groupServices>, query: string) {
  if (!query) {
    return groups;
  }

  const search = query.toLowerCase();
  return groups
    .map((group) => {
      const groupMatches = [group.key, group.label].join(' ').toLowerCase().includes(search);
      if (groupMatches) {
        return group;
      }

      const items = group.items.filter((service) => serviceSearchText(service).includes(search));
      return items.length ? { ...group, items } : null;
    })
    .filter(Boolean) as ReturnType<typeof groupServices>;
}

function filterServices(services: AdminServiceCatalogItem[], query: string) {
  if (!query) {
    return services;
  }
  const search = query.toLowerCase();
  return services.filter((service) => serviceSearchText(service).includes(search));
}

function serviceSearchText(service: AdminServiceCatalogItem) {
  return [
    service.id,
    service.name,
    service.description,
    service.serviceGroupKey,
    service.durationMin,
    service.basePrice,
    service.priceStep,
    service.active ? 'active' : 'inactive',
  ]
    .filter((value) => value !== null && value !== undefined)
    .map(String)
    .join(' ')
    .toLowerCase();
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
      detail: 'The customer price now has a partner payout rule for booking and finance checks.',
    },
    'payout-rule-updated': {
      title: 'Payout rule updated',
      detail: 'The payout rule was updated and pricing health has been recalculated.',
    },
    'bulk-payout-rules-saved': {
      title: 'Payout ladder saved',
      detail: 'The service now has the imported customer price and partner payout rows.',
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
        'Every filled duration must follow the configured price step, and partner payout cannot exceed the customer price.',
    },
    'invalid-service-pricing': {
      title: 'Service pricing is invalid',
      detail: 'Minimum prices must be positive and match the configured price step, usually 100,000 VND.',
    },
    'missing-payout-fields': {
      title: 'Payout fields are missing',
      detail: 'Enter both the customer price and partner payout before saving a payout rule.',
    },
    'missing-bulk-payout-fields': {
      title: 'Bulk payout import is empty',
      detail: 'Paste at least one customer price and partner payout row before importing.',
    },
    'invalid-bulk-payout': {
      title: 'Bulk payout import is invalid',
      detail:
        'Each row must be customerPrice,providerPayoutAmount. Partner payout cannot exceed the customer price.',
    },
    'invalid-payout': {
      title: 'Partner payout is too high',
      detail: 'Partner payout cannot be greater than the customer price for the same service option.',
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

function servicePricingAuditRows(logs: AdminAuditLog[]) {
  return logs
    .filter((log) => isServicePricingAuditAction(log.action))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, 8)
    .map((log) => {
      const metadata = readMetadataObject(log.metadata);
      const before = readMetadataObject(metadata.before);
      const after = readMetadataObject(metadata.after);
      const service = readMetadataObject(metadata.service);
      const changedFields = readChangedFields(metadata.changedFields);
      const targetShort = shortTarget(log.target);
      const serviceLabel =
        typeof service.name === 'string'
          ? `${service.name}${typeof service.durationMin === 'number' ? ` / ${service.durationMin} min` : ''}`
          : typeof after.name === 'string'
            ? `${after.name}${typeof after.durationMin === 'number' ? ` / ${after.durationMin} min` : ''}`
            : targetShort;
      const priceLabel =
        typeof after.customerPrice === 'number'
          ? `Customer ${formatMoney(after.customerPrice, String(after.currency ?? 'VND'))}`
          : typeof after.basePrice === 'number'
            ? `Base ${formatMoney(after.basePrice, 'VND')}`
            : 'No customer price snapshot';
      const payoutLabel =
        typeof after.providerPayoutAmount === 'number'
          ? `Partner ${formatMoney(after.providerPayoutAmount, String(after.currency ?? 'VND'))}`
          : typeof before.providerPayoutAmount === 'number'
            ? `Previous partner ${formatMoney(before.providerPayoutAmount, String(before.currency ?? 'VND'))}`
            : 'No partner payout snapshot';

      return {
        id: log.id,
        action: log.action,
        target: log.target,
        targetShort,
        createdAt: log.createdAt,
        actorName: log.actor?.fullName ?? log.actor?.phone ?? 'System',
        changedFields: changedFields.length ? changedFields : ['created'],
        serviceLabel,
        priceLabel,
        payoutLabel,
      };
    });
}

function isServicePricingAuditAction(action: string) {
  return action.startsWith('service.') || action.startsWith('service_payout_rule.');
}

function readMetadataObject(metadata: unknown): Record<string, unknown> {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>;
  }
  return {};
}

function readChangedFields(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((field): field is string => typeof field === 'string');
}

function humanizeAuditAction(action: string) {
  return action
    .split('.')
    .map((part) => part.replace(/_/g, ' '))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' / ');
}

function shortTarget(target: string) {
  const [scope, id] = target.split(':');
  return id ? `${scope}:${id.slice(0, 8)}` : target;
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
      <div className="ops-section-header">
        <div>
          <h3>Partner price impact</h3>
          <p className="muted">
            Shows which partner prices are visible in the customer app for this exact duration option.
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
                  Customer {formatMoney(row.price, row.currency)} / partner{' '}
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
        <p className="muted">No partner has configured a price for this duration yet.</p>
      )}
    </div>
  );
}

type ServicePayoutRule = NonNullable<AdminServiceCatalogItem['payoutRules']>[number];

type PricePolicyScenario = {
  label: string;
  customerPrice: number;
  providerPayoutAmount: number;
  currency: string;
  finance: ReturnType<typeof servicePayoutFinance>;
  tone: string;
  status: string;
};

function ScenarioPreviewCell({ scenario }: { scenario: PricePolicyScenario | null }) {
  if (!scenario) {
    return <span className="pill pill-danger">No base rule</span>;
  }

  return (
    <div className="service-matrix-cell">
      <span className={`pill ${scenario.tone}`}>{scenario.status}</span>
      <strong>{formatMoney(scenario.customerPrice, scenario.currency)}</strong>
      <small>Partner {formatMoney(scenario.providerPayoutAmount, scenario.currency)}</small>
      <small>Commission {formatMoney(scenario.finance.actualCompanyCommission, scenario.currency)}</small>
      <small>Tax {formatMoney(scenario.finance.withholdingAmount, scenario.currency)}</small>
    </div>
  );
}

function servicePricePolicyPreviewRows(
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
      const priceStep = Math.max(100000, service.priceStep || 100000);
      const currentFinance = baseRule
        ? servicePayoutFinance(service, baseRule, activeTaxPolicy)
        : emptyFinancePreview();
      const customerStepScenario = baseRule
        ? buildPricePolicyScenario(service, baseRule, activeTaxPolicy, {
            label: 'Customer price + step',
            customerPrice: baseRule.customerPrice + priceStep,
            providerPayoutAmount: baseRule.providerPayoutAmount,
          })
        : null;
      const providerStepScenario = baseRule
        ? buildPricePolicyScenario(service, baseRule, activeTaxPolicy, {
            label: 'Partner payout + step',
            customerPrice: baseRule.customerPrice,
            providerPayoutAmount: baseRule.providerPayoutAmount + priceStep,
          })
        : null;
      const balancedStepScenario = baseRule
        ? buildPricePolicyScenario(service, baseRule, activeTaxPolicy, {
            label: 'Customer and partner + step',
            customerPrice: baseRule.customerPrice + priceStep,
            providerPayoutAmount: baseRule.providerPayoutAmount + priceStep,
          })
        : null;
      const scenarios = [customerStepScenario, providerStepScenario, balancedStepScenario].filter(
        Boolean,
      ) as PricePolicyScenario[];
      const flaggedScenarios = scenarios.filter(
        (scenario) =>
          scenario.providerPayoutAmount > scenario.customerPrice ||
          scenario.finance.actualCompanyCommission <= 0,
      );
      const checkLabel = !baseRule
        ? 'Missing base rule'
        : flaggedScenarios.length
          ? `${flaggedScenarios.length} check(s)`
          : 'Positive preview';
      const checkTone = !baseRule ? 'pill-danger' : flaggedScenarios.length ? 'pill-warn' : 'pill-success';
      const nextAction = !baseRule
        ? 'Add the base payout rule first.'
        : flaggedScenarios.length
          ? 'Review partner payout or tax/cost assumptions before saving a price change.'
          : 'These one-step scenarios keep a positive projected company commission.';

      return {
        service,
        baseRule,
        priceStep,
        currency: baseRule?.currency ?? 'VND',
        currentFinance,
        customerStepScenario,
        providerStepScenario,
        balancedStepScenario,
        checkLabel,
        checkTone,
        nextAction,
      };
    });
}

function servicePricePolicyPreviewSummary(rows: ReturnType<typeof servicePricePolicyPreviewRows>) {
  const currency = rows.find((row) => row.currency)?.currency ?? 'VND';
  return rows.reduce(
    (summary, row) => ({
      currency: summary.currency,
      currentCommission: summary.currentCommission + row.currentFinance.actualCompanyCommission,
      customerStepCommission:
        summary.customerStepCommission + (row.customerStepScenario?.finance.actualCompanyCommission ?? 0),
      providerStepCommission:
        summary.providerStepCommission + (row.providerStepScenario?.finance.actualCompanyCommission ?? 0),
      balancedStepCommission:
        summary.balancedStepCommission + (row.balancedStepScenario?.finance.actualCompanyCommission ?? 0),
      missingBaseRuleCount: summary.missingBaseRuleCount + (row.baseRule ? 0 : 1),
      policyCheckCount:
        summary.policyCheckCount +
        [row.customerStepScenario, row.providerStepScenario, row.balancedStepScenario].filter(
          (scenario) =>
            scenario &&
            (scenario.providerPayoutAmount > scenario.customerPrice ||
              scenario.finance.actualCompanyCommission <= 0),
        ).length,
    }),
    {
      currency,
      currentCommission: 0,
      customerStepCommission: 0,
      providerStepCommission: 0,
      balancedStepCommission: 0,
      missingBaseRuleCount: 0,
      policyCheckCount: 0,
    },
  );
}

function buildPricePolicyScenario(
  service: AdminServiceCatalogItem,
  baseRule: ServicePayoutRule,
  activeTaxPolicy: AdminTaxPolicyVersion | undefined,
  input: { label: string; customerPrice: number; providerPayoutAmount: number },
): PricePolicyScenario {
  const scenarioRule = {
    ...baseRule,
    customerPrice: input.customerPrice,
    providerPayoutAmount: input.providerPayoutAmount,
  };
  const finance = servicePayoutFinance(service, scenarioRule, activeTaxPolicy);
  const overpaysProvider = input.providerPayoutAmount > input.customerPrice;
  const hasPositiveCommission = finance.actualCompanyCommission > 0;
  return {
    label: input.label,
    customerPrice: input.customerPrice,
    providerPayoutAmount: input.providerPayoutAmount,
    currency: baseRule.currency,
    finance,
    tone: overpaysProvider ? 'pill-danger' : hasPositiveCommission ? 'pill-success' : 'pill-warn',
    status: overpaysProvider ? 'Overpays' : hasPositiveCommission ? 'Positive' : 'Check margin',
  };
}

function emptyFinancePreview() {
  return {
    fee: 0,
    vatAmount: 0,
    withholdingAmount: 0,
    taxRuleLabel: null,
    actualCompanyCommission: 0,
  };
}

function buildServiceTypeCoverageRows(
  groups: ReturnType<typeof groupServices>,
  activeTaxPolicy: AdminTaxPolicyVersion | undefined,
) {
  return groups
    .map((group) => {
      const activeItems = group.items.filter((item) => item.active);
      const missingDurations = missingStandardDurations(group.items);
      const missingBasePayoutCount = activeItems.filter((service) => !basePayoutRule(service)).length;
      const payoutRuleCount = group.items.reduce((sum, service) => sum + (service.payoutRules?.length ?? 0), 0);
      const providerImpactRows = activeItems.flatMap((service) => providerPriceImpact(service, activeTaxPolicy).rows);
      const visiblePartnerPriceCount = providerImpactRows.filter((row) => row.state === 'bookable').length;
      const belowMinimumCount = providerImpactRows.filter((row) => row.state === 'below_minimum').length;
      const missingPayoutPriceCount = providerImpactRows.filter((row) => row.state === 'missing_payout').length;
      const inactivePartnerPriceCount = providerImpactRows.filter((row) => row.state === 'inactive').length;
      const hiddenPartnerPriceCount = belowMinimumCount + missingPayoutPriceCount + inactivePartnerPriceCount;
      const financeRows = activeItems
        .map((service) => {
          const rule = basePayoutRule(service);
          if (!rule) {
            return null;
          }

          return {
            service,
            rule,
            finance: servicePayoutFinance(service, rule, activeTaxPolicy),
          };
        })
        .filter(
          (
            row,
          ): row is {
            service: AdminServiceCatalogItem;
            rule: ServicePayoutRule;
            finance: ReturnType<typeof servicePayoutFinance>;
          } => row !== null,
        );
      const lowCommissionCount = financeRows.filter((row) => row.finance.actualCompanyCommission <= 0).length;
      const currency = financeRows[0]?.rule.currency ?? 'VND';
      const totals = financeRows.reduce(
        (summary, row) => ({
          customerMinimumTotal: summary.customerMinimumTotal + row.service.basePrice,
          partnerPayoutTotal: summary.partnerPayoutTotal + row.rule.providerPayoutAmount,
          netCompanyFee: summary.netCompanyFee + row.finance.actualCompanyCommission,
        }),
        { customerMinimumTotal: 0, partnerPayoutTotal: 0, netCompanyFee: 0 },
      );
      const activeDurationLabels = formatDurationList(activeItems);
      let tone = 'pill-success';
      let statusLabel = 'Ready';
      let nextAction = 'Ready for customer booking with configured duration and payout coverage.';

      if (missingBasePayoutCount > 0) {
        tone = 'pill-danger';
        statusLabel = 'Base payout missing';
        nextAction = 'Add payout rules at the minimum customer price for every active duration option.';
      } else if (belowMinimumCount > 0) {
        tone = 'pill-danger';
        statusLabel = 'Partner price blocked';
        nextAction = 'Raise partner prices below the admin minimum or intentionally lower the service minimum.';
      } else if (missingPayoutPriceCount > 0) {
        tone = 'pill-warn';
        statusLabel = 'Partner price hidden';
        nextAction = 'Add payout rules for active partner prices that should be visible to customers.';
      } else if (lowCommissionCount > 0) {
        tone = 'pill-warn';
        statusLabel = 'Commission check';
        nextAction = 'Adjust partner payout, VAT, withholding, or other cost assumptions before scaling.';
      } else if (missingDurations.length > 0) {
        tone = 'pill-warn';
        statusLabel = 'Duration gap';
        nextAction = 'Add missing 60, 90, or 120 minute options when this service type should be complete.';
      }

      return {
        key: group.key,
        label: group.label,
        activeOptionCount: activeItems.length,
        activeDurationLabels,
        missingDurations,
        missingBasePayoutCount,
        payoutRuleCount,
        visiblePartnerPriceCount,
        hiddenPartnerPriceCount,
        belowMinimumCount,
        missingPayoutPriceCount,
        inactivePartnerPriceCount,
        lowCommissionCount,
        customerMinimumTotal: totals.customerMinimumTotal,
        partnerPayoutTotal: totals.partnerPayoutTotal,
        netCompanyFee: totals.netCompanyFee,
        currency,
        tone,
        statusLabel,
        nextAction,
      };
    })
    .sort((left, right) => {
      const priority = (row: { tone: string }) =>
        row.tone === 'pill-danger' ? 0 : row.tone === 'pill-warn' ? 1 : 2;

      return priority(left) - priority(right) || left.label.localeCompare(right.label);
    });
}

function buildServiceTypeCoverageSummary(rows: ReturnType<typeof buildServiceTypeCoverageRows>) {
  const currency = rows.find((row) => row.currency)?.currency ?? 'VND';

  return rows.reduce(
    (summary, row) => ({
      currency: summary.currency,
      blockedCount: summary.blockedCount + (row.tone === 'pill-danger' ? 1 : 0),
      warningCount: summary.warningCount + (row.tone === 'pill-warn' ? 1 : 0),
      readyCount: summary.readyCount + (row.tone === 'pill-success' ? 1 : 0),
      missingDurationCount: summary.missingDurationCount + row.missingDurations.length,
      missingBasePayoutCount: summary.missingBasePayoutCount + row.missingBasePayoutCount,
      hiddenPartnerPriceCount: summary.hiddenPartnerPriceCount + row.hiddenPartnerPriceCount,
      netCompanyFee: summary.netCompanyFee + row.netCompanyFee,
    }),
    {
      currency,
      blockedCount: 0,
      warningCount: 0,
      readyCount: 0,
      missingDurationCount: 0,
      missingBasePayoutCount: 0,
      hiddenPartnerPriceCount: 0,
      netCompanyFee: 0,
    },
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
      const actionTone =
        action === 'Ready' ? 'pill-success' : action === 'Review margin' ? 'pill-warn' : 'pill-danger';

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
          booking?.payment?.currency ??
          booking?.earning?.currency ??
          booking?.taxLogs?.[0]?.currency ??
          'VND';
        const taxWithheldAmount = (booking?.taxLogs ?? []).reduce(
          (sum, log) => sum + log.withholdingAmount,
          0,
        );
        const platformFeeAmount = (booking?.platformFeeLogs ?? []).reduce(
          (sum, log) => sum + log.platformFeeAmount,
          0,
        );
        const walletAmount = (booking?.walletLedgerEntries ?? []).reduce(
          (sum, entry) => sum + entry.amount,
          0,
        );
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

function serviceBookingTraceSummary(rows: ReturnType<typeof serviceBookingTraceRows>) {
  const currency = rows.find((row) => row.currency)?.currency ?? 'VND';
  return rows.reduce(
    (summary, row) => ({
      currency: summary.currency,
      paymentAmount: summary.paymentAmount + (row.booking?.payment?.amount ?? 0),
      providerNetAmount: summary.providerNetAmount + (row.booking?.earning?.netAmount ?? 0),
      platformFeeAmount: summary.platformFeeAmount + row.platformFeeAmount,
      withholdingAmount: summary.withholdingAmount + row.taxWithheldAmount,
      walletAmount: summary.walletAmount + row.walletAmount,
      missingTraceCount: summary.missingTraceCount + (row.traceStatus === 'Complete' ? 0 : 1),
    }),
    {
      currency,
      paymentAmount: 0,
      providerNetAmount: 0,
      platformFeeAmount: 0,
      withholdingAmount: 0,
      walletAmount: 0,
      missingTraceCount: 0,
    },
  );
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
  const totals = [...byDuration.values()].reduce(
    (summary, cell) => {
      if (!cell.baseRule) {
        return summary;
      }

      return {
        currency: cell.baseRule.currency,
        customerMinimum: summary.customerMinimum + cell.service.basePrice,
        providerPayout: summary.providerPayout + cell.baseRule.providerPayoutAmount,
        grossFee: summary.grossFee + cell.finance.fee,
        taxAndCost:
          summary.taxAndCost +
          cell.finance.vatAmount +
          cell.finance.withholdingAmount +
          cell.baseRule.otherCostAmount,
        netCompanyFee: summary.netCompanyFee + cell.finance.actualCompanyCommission,
      };
    },
    {
      currency: 'VND',
      customerMinimum: 0,
      providerPayout: 0,
      grossFee: 0,
      taxAndCost: 0,
      netCompanyFee: 0,
    },
  );

  return {
    byDuration,
    activeCount: activeItems.length,
    payoutRuleCount: items.reduce((sum, item) => sum + (item.payoutRules?.length ?? 0), 0),
    blockedCount: activeItems.filter(
      (item) =>
        !(item.payoutRules ?? []).some((rule) => rule.active && rule.customerPrice === item.basePrice),
    ).length,
    totals,
  };
}

function basePayoutRule(service: AdminServiceCatalogItem) {
  return (
    (service.payoutRules ?? []).find((rule) => rule.active && rule.customerPrice === service.basePrice) ??
    null
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
          ? 'Payout rules are above minimum, on the right increment, and do not overpay partners.'
          : 'Review payout rules with invalid customer price or partner payout amount.',
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
              ? 'Add an active payout rule for this exact partner customer price.'
              : row.state === 'below_minimum'
                ? 'Ask the partner to raise the price or lower the admin minimum price intentionally.'
                : 'No customer action needed unless this partner should be visible.',
          tone: row.state === 'below_minimum' ? 'blocked' : 'warning',
        });
      }

      for (const rule of invalidRules) {
        items.push({
          serviceId: service.id,
          title: `${service.name} / ${service.durationMin} min`,
          status: 'INVALID',
          detail: `Customer ${formatMoney(rule.customerPrice, rule.currency)} / partner ${formatMoney(
            rule.providerPayoutAmount,
            rule.currency,
          )}`,
          action:
            'Customer price must respect the minimum and step, and partner payout cannot exceed customer price.',
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
          action: 'Adjust partner payout, VAT/cost assumptions, or tax policy before scaling this price.',
          tone: 'warning',
        });
      }

      return items;
    })
    .sort((left, right) => {
      const leftPriority = left.tone === 'blocked' ? 0 : 1;
      const rightPriority = right.tone === 'blocked' ? 0 : 1;
      return leftPriority - rightPriority || left.title.localeCompare(right.title);
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
      return (
        Number(right.active) - Number(left.active) ||
        left.price - right.price ||
        leftName.localeCompare(rightName)
      );
    })
    .map((providerService) => {
      const rule = activeRules.get(providerService.price) ?? null;
      const providerName = providerService.providerProfile?.displayName ?? 'Unnamed partner';
      const providerStatus = providerService.providerProfile?.status ?? 'UNKNOWN';
      const providerBlocked = Boolean(providerService.providerProfile?.blockedAt);
      let state: 'bookable' | 'missing_payout' | 'below_minimum' | 'inactive' = 'bookable';
      let reason = 'Customer can book this partner price.';

      if (!providerService.active || providerBlocked) {
        state = 'inactive';
        reason = providerBlocked ? 'Partner account is blocked.' : 'Partner price row is inactive.';
      } else if (providerService.price < service.basePrice) {
        state = 'below_minimum';
        reason = 'Partner price is below the admin minimum, so it must stay hidden.';
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
    .replace(/\u0111/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function relativeTime(value: string) {
  return formatRelativeTime(value, { justNow: 'Updated just now' });
}

function formatBps(value: number) {
  return `${(value / 100).toFixed(2)}%`;
}
