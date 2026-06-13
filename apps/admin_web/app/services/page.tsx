import { AdminPageTemplate } from '../../components/admin-page-template';
import { AdminAuditLog, AdminServiceCatalogItem, AdminTaxPolicyVersion, adminGet } from '../../lib/admin-api';
import { ServiceActionNoticeSection } from './service-action-notice-section';
import { ServiceBookingExposureGuardSection } from './service-booking-exposure-guard-section';
import { ServiceBookingFinanceTraceSection } from './service-booking-finance-trace-section';
import { ServiceBookingReadinessQueueSection } from './service-booking-readiness-queue-section';
import { ServiceCatalogSearchSection } from './service-catalog-search-section';
import { ServiceCreateFormsSection } from './service-create-forms-section';
import { ServiceDurationPricingMatrixSection } from './service-duration-pricing-matrix-section';
import { ServiceGroupEditGridSection } from './service-group-edit-grid-section';
import { ServicePayoutLedgerSection } from './service-payout-ledger-section';
import { ServicePricingHealthSection } from './service-pricing-health-section';
import { ServicePricePolicyPreviewSection } from './service-price-policy-preview-section';
import { ServicePricingAuditTrailSection } from './service-pricing-audit-trail-section';
import { ServiceTypeCoverageBoardSection } from './service-type-coverage-board-section';
import { buildServicePageModel } from './service-page-model';

type ServicesPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ServicesPage({ searchParams }: { searchParams?: ServicesPageSearchParams }) {
  const params = (await searchParams) ?? {};
  const [services, taxPolicies, auditLogs] = await Promise.all([
    adminGet<AdminServiceCatalogItem[]>('/admin/services', []),
    adminGet<AdminTaxPolicyVersion[]>('/admin/tax-policy-versions', []),
    adminGet<AdminAuditLog[]>('/admin/audit-logs', []),
  ]);
  const model = buildServicePageModel({
    auditLogs,
    params,
    services,
    taxPolicies,
  });

  return (
    <AdminPageTemplate
      actions={
        <>
          <span className="pill pill-success">{model.groupedServices.length} service type(s)</span>
          <span className="pill pill-info">{model.activeServices.length} active duration option(s)</span>
          <span className="pill pill-info">{model.payoutRuleCount} payout rule(s)</span>
          <span className={`pill ${model.activeTaxPolicy ? 'pill-success' : 'pill-warn'}`}>
            {model.activeTaxPolicy ? `Tax: ${model.activeTaxPolicy.name}` : 'No active tax policy'}
          </span>
        </>
      }
      description="Create a service name once, then manage duration options such as 60, 90, and 120 minutes with separate minimum prices and payout policies."
      title="Service catalog"
    >
      <ServiceCatalogSearchSection
        activeServiceCount={model.filteredActiveServices.length}
        groupCount={model.filteredGroupedServices.length}
        searchQuery={model.serviceSearchQuery}
      />

      <ServiceActionNoticeSection notice={model.actionNotice} />

      <ServiceBookingExposureGuardSection
        activeServiceCount={model.activeServices.length}
        blockedCount={model.blockedReadinessItems.length}
        payoutRuleCount={model.payoutRuleCount}
        policyCheckCount={model.pricePolicyPreviewSummary.policyCheckCount}
        traceGapCount={model.bookingTraceSummary.missingTraceCount}
        warningCount={model.warningReadinessItems.length}
      />

      <ServiceTypeCoverageBoardSection
        hiddenRowCount={model.hiddenServiceTypeCoverageRowCount}
        rows={model.serviceTypeCoverageRows}
        summary={model.serviceTypeCoverageSummary}
        visibleRows={model.visibleServiceTypeCoverageRows}
      />

      <ServicePricingAuditTrailSection rows={model.pricingAuditRows} />

      <ServicePricingHealthSection items={model.healthItems} />

      <ServiceBookingReadinessQueueSection
        blockedCount={model.blockedReadinessItems.length}
        items={model.readinessItems}
        warningCount={model.warningReadinessItems.length}
      />

      <ServiceDurationPricingMatrixSection
        activeTaxPolicy={model.activeTaxPolicy}
        hiddenGroupCount={model.hiddenServiceGroupCount}
        totalGroupCount={model.groupedServices.length}
        visibleGroups={model.visibleGroupedServices}
      />

      <ServicePayoutLedgerSection
        activeServiceCount={model.activeServices.length}
        hiddenRowCount={model.hiddenPayoutLedgerRowCount}
        rows={model.payoutLedgerRows}
        visibleRows={model.visiblePayoutLedgerRows}
      />

      <ServicePricePolicyPreviewSection
        hiddenRowCount={model.hiddenPricePolicyPreviewRowCount}
        rows={model.pricePolicyPreviewRows}
        summary={model.pricePolicyPreviewSummary}
        visibleRows={model.visiblePricePolicyPreviewRows}
      />

      <ServiceBookingFinanceTraceSection rows={model.bookingTraceRows} summary={model.bookingTraceSummary} />
      <ServiceCreateFormsSection />

      <ServiceGroupEditGridSection
        activeTaxPolicy={model.activeTaxPolicy}
        hiddenGroupCount={model.hiddenServiceGroupCount}
        visibleGroups={model.visibleGroupedServices}
      />
    </AdminPageTemplate>
  );
}
