import Link from 'next/link';

import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminAuditLog, AdminServiceCatalogItem, AdminTaxPolicyVersion, adminGet } from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';
import { serviceActionNotice } from '../../lib/service-action-notice';
import { serviceBookingReadinessQueue as buildBookingReadinessQueue } from '../../lib/service-booking-readiness-queue';
import { serviceBookingTraceRows } from '../../lib/service-booking-trace-rows';
import { serviceBookingTraceSummary } from '../../lib/service-booking-trace-summary';
import {
  filterServiceGroups,
  filterServices,
  groupServices,
  readSingleParam,
  selectActiveTaxPolicy,
} from '../../lib/service-catalog-filters';
import { serviceDurationMatrix } from '../../lib/service-duration-matrix';
import { formatDurationList, missingStandardDurations } from '../../lib/service-group-display';
import { servicePayoutLedgerRows } from '../../lib/service-payout-ledger-rows';
import { actualCompanyCommission, servicePayoutFinance } from '../../lib/service-payout-finance';
import { servicePricePolicyPreviewRows as buildServicePricePolicyPreviewRows } from '../../lib/service-price-policy-preview-rows';
import { servicePricePolicyPreviewSummary } from '../../lib/service-price-policy-preview-summary';
import { servicePricingAuditRows } from '../../lib/service-pricing-audit-rows';
import { servicePricingHealth as buildPricingHealth } from '../../lib/service-pricing-health';
import { serviceTypeCoverageRows as buildServiceTypeCoverageRows } from '../../lib/service-type-coverage-rows';
import { serviceTypeCoverageSummary as buildServiceTypeCoverageSummary } from '../../lib/service-type-coverage-summary';
import { providerPriceImpact as buildProviderPriceImpact } from '../../lib/provider-price-impact';
import { ServiceBookingFinanceTraceSection } from './service-booking-finance-trace-section';
import { ServiceCreateFormsSection } from './service-create-forms-section';
import { ServiceGroupEditCard } from './service-group-edit-card';
import { ServicePayoutLedgerSection } from './service-payout-ledger-section';
import { ServicePricePolicyPreviewSection } from './service-price-policy-preview-section';
import { ServicePricingAuditTrailSection } from './service-pricing-audit-trail-section';
import { ServiceTypeCoverageBoardSection } from './service-type-coverage-board-section';

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
  const healthItems = buildPricingHealth({
    activeTaxPolicy,
    actualCompanyCommission,
    services,
  });
  const readinessItems = buildBookingReadinessQueue({
    activeTaxPolicy,
    actualCompanyCommission,
    formatMoney,
    providerPriceImpact,
    services,
  });
  const blockedReadinessItems = readinessItems.filter((item) => item.tone === 'blocked');
  const warningReadinessItems = readinessItems.filter((item) => item.tone === 'warning');
  const bookingTraceRows = serviceBookingTraceRows(services);
  const bookingTraceSummary = serviceBookingTraceSummary(bookingTraceRows);
  const pricePolicyPreviewRows = servicePricePolicyPreviewRows(filteredActiveServices, activeTaxPolicy);
  const pricePolicyPreviewSummary = servicePricePolicyPreviewSummary(pricePolicyPreviewRows);
  const payoutLedgerRows = servicePayoutLedgerRows({
    activeTaxPolicy,
    basePayoutRule,
    providerPriceImpact,
    servicePayoutFinance,
    services: filteredActiveServices,
  });
  const serviceTypeCoverageRows = buildServiceTypeCoverageRows({
    activeTaxPolicy,
    basePayoutRule,
    formatDurationList,
    groups: filteredGroupedServices,
    missingStandardDurations,
    providerPriceImpact,
    servicePayoutFinance,
  });
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
    <AdminPageTemplate
      actions={
        <>
          <span className="pill pill-success">{groupedServices.length} service type(s)</span>
          <span className="pill pill-info">{activeServices.length} active duration option(s)</span>
          <span className="pill pill-info">{payoutRuleCount} payout rule(s)</span>
          <span className={`pill ${activeTaxPolicy ? 'pill-success' : 'pill-warn'}`}>
            {activeTaxPolicy ? `Tax: ${activeTaxPolicy.name}` : 'No active tax policy'}
          </span>
        </>
      }
      description="Create a service name once, then manage duration options such as 60, 90, and 120 minutes with separate minimum prices and payout policies."
      title="Service catalog"
    >
      <section className="card admin-mb-16">
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
        <p className="muted admin-mt-10">
          {catalogScopeLabel}: showing {filteredGroupedServices.length} service type(s) and{' '}
          {filteredActiveServices.length} active duration option(s). Dashboard readiness cards still check the
          full catalog.
        </p>
      </section>

      {actionNotice ? (
        <section
          className="card admin-mb-16"
          style={{
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

      <section className="card admin-mb-16">
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
        <div className="actions admin-mt-12">
          <Link className="text-link" href="/bookings?view=pricing">
            Open pricing-check bookings
          </Link>
          <a className="text-link" href="/audit-log?bucket=Service%2FPricing">
            Review service pricing audit
          </a>
        </div>
      </section>

      <ServiceTypeCoverageBoardSection
        hiddenRowCount={hiddenServiceTypeCoverageRowCount}
        rows={serviceTypeCoverageRows}
        summary={serviceTypeCoverageSummary}
        visibleRows={visibleServiceTypeCoverageRows}
      />

      <ServicePricingAuditTrailSection rows={pricingAuditRows} />

      <section className="card admin-mb-16">
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

      <section className="card admin-mb-16">
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

      <section className="card admin-card-scroll admin-mb-16">
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
              const matrix = serviceDurationMatrix({
                activeTaxPolicy,
                basePayoutRule,
                items: group.items,
                servicePayoutFinance,
              });
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

      <ServicePayoutLedgerSection
        activeServiceCount={activeServices.length}
        hiddenRowCount={hiddenPayoutLedgerRowCount}
        rows={payoutLedgerRows}
        visibleRows={visiblePayoutLedgerRows}
      />

      <ServicePricePolicyPreviewSection
        hiddenRowCount={hiddenPricePolicyPreviewRowCount}
        rows={pricePolicyPreviewRows}
        summary={pricePolicyPreviewSummary}
        visibleRows={visiblePricePolicyPreviewRows}
      />

      <ServiceBookingFinanceTraceSection rows={bookingTraceRows} summary={bookingTraceSummary} />
      <ServiceCreateFormsSection />

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
          <ServiceGroupEditCard activeTaxPolicy={activeTaxPolicy} group={group} key={group.key} />
        ))}
      </section>
    </AdminPageTemplate>
  );
}

function servicePricePolicyPreviewRows(
  services: readonly AdminServiceCatalogItem[],
  activeTaxPolicy: AdminTaxPolicyVersion | undefined,
) {
  return buildServicePricePolicyPreviewRows({
    activeTaxPolicy,
    servicePayoutFinance,
    services,
  });
}

function basePayoutRule(service: AdminServiceCatalogItem) {
  return (
    (service.payoutRules ?? []).find((rule) => rule.active && rule.customerPrice === service.basePrice) ??
    null
  );
}

function providerPriceImpact(
  service: AdminServiceCatalogItem,
  activeTaxPolicy: AdminTaxPolicyVersion | undefined,
) {
  return buildProviderPriceImpact({
    activeTaxPolicy,
    actualCompanyCommission,
    service,
  });
}
