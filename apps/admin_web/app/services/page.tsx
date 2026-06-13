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
import { ServiceActionNoticeSection } from './service-action-notice-section';
import { ServiceBookingExposureGuardSection } from './service-booking-exposure-guard-section';
import { ServiceBookingFinanceTraceSection } from './service-booking-finance-trace-section';
import { ServiceBookingReadinessQueueSection } from './service-booking-readiness-queue-section';
import { ServiceCatalogSearchSection } from './service-catalog-search-section';
import { ServiceCreateFormsSection } from './service-create-forms-section';
import { ServiceDurationPricingMatrixSection } from './service-duration-pricing-matrix-section';
import { ServiceGroupEditCard } from './service-group-edit-card';
import { ServicePayoutLedgerSection } from './service-payout-ledger-section';
import { ServicePricingHealthSection } from './service-pricing-health-section';
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
      <ServiceCatalogSearchSection
        activeServiceCount={filteredActiveServices.length}
        groupCount={filteredGroupedServices.length}
        searchQuery={serviceSearchQuery}
      />

      <ServiceActionNoticeSection notice={actionNotice} />

      <ServiceBookingExposureGuardSection
        activeServiceCount={activeServices.length}
        blockedCount={blockedReadinessItems.length}
        payoutRuleCount={payoutRuleCount}
        policyCheckCount={pricePolicyPreviewSummary.policyCheckCount}
        traceGapCount={bookingTraceSummary.missingTraceCount}
        warningCount={warningReadinessItems.length}
      />

      <ServiceTypeCoverageBoardSection
        hiddenRowCount={hiddenServiceTypeCoverageRowCount}
        rows={serviceTypeCoverageRows}
        summary={serviceTypeCoverageSummary}
        visibleRows={visibleServiceTypeCoverageRows}
      />

      <ServicePricingAuditTrailSection rows={pricingAuditRows} />

      <ServicePricingHealthSection items={healthItems} />

      <ServiceBookingReadinessQueueSection
        blockedCount={blockedReadinessItems.length}
        items={readinessItems}
        warningCount={warningReadinessItems.length}
      />

      <ServiceDurationPricingMatrixSection
        activeTaxPolicy={activeTaxPolicy}
        hiddenGroupCount={hiddenServiceGroupCount}
        totalGroupCount={groupedServices.length}
        visibleGroups={visibleGroupedServices}
      />

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
