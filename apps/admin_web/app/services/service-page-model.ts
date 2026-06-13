import type { AdminAuditLog, AdminServiceCatalogItem, AdminTaxPolicyVersion } from '../../lib/admin-api';
import { formatMoney } from '../../lib/admin-format';
import { providerPriceImpact as buildProviderPriceImpact } from '../../lib/provider-price-impact';
import { serviceActionNotice } from '../../lib/service-action-notice';
import { serviceBasePayoutRule as basePayoutRule } from '../../lib/service-base-payout-rule';
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
import { servicePayoutFinance, actualCompanyCommission } from '../../lib/service-payout-finance';
import { servicePayoutLedgerRows } from '../../lib/service-payout-ledger-rows';
import { servicePricePolicyPreviewRows as buildServicePricePolicyPreviewRows } from '../../lib/service-price-policy-preview-rows';
import { servicePricePolicyPreviewSummary } from '../../lib/service-price-policy-preview-summary';
import { servicePricingAuditRows } from '../../lib/service-pricing-audit-rows';
import { servicePricingHealth as buildPricingHealth } from '../../lib/service-pricing-health';
import { serviceTypeCoverageRows as buildServiceTypeCoverageRows } from '../../lib/service-type-coverage-rows';
import { serviceTypeCoverageSummary as buildServiceTypeCoverageSummary } from '../../lib/service-type-coverage-summary';

type ServicePageParams = Record<string, string | string[] | undefined>;

type BuildServicePageModelInput = {
  readonly auditLogs: readonly AdminAuditLog[];
  readonly params: ServicePageParams;
  readonly services: readonly AdminServiceCatalogItem[];
  readonly taxPolicies: readonly AdminTaxPolicyVersion[];
};

const SERVICE_GROUP_RENDER_LIMIT = 40;
const SERVICE_ROW_RENDER_LIMIT = 80;

export function buildServicePageModel({
  auditLogs,
  params,
  services,
  taxPolicies,
}: BuildServicePageModelInput) {
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
  const visibleGroupedServices = filteredGroupedServices.slice(0, SERVICE_GROUP_RENDER_LIMIT);
  const visiblePayoutLedgerRows = payoutLedgerRows.slice(0, SERVICE_ROW_RENDER_LIMIT);
  const visiblePricePolicyPreviewRows = pricePolicyPreviewRows.slice(0, SERVICE_ROW_RENDER_LIMIT);

  return {
    actionNotice: serviceActionNotice(params),
    activeServices,
    activeTaxPolicy,
    bookingTraceRows,
    bookingTraceSummary,
    blockedReadinessItems,
    filteredActiveServices,
    filteredGroupedServices,
    groupedServices,
    healthItems,
    hiddenPayoutLedgerRowCount: hiddenCount(payoutLedgerRows, visiblePayoutLedgerRows),
    hiddenPricePolicyPreviewRowCount: hiddenCount(pricePolicyPreviewRows, visiblePricePolicyPreviewRows),
    hiddenServiceGroupCount: hiddenCount(filteredGroupedServices, visibleGroupedServices),
    hiddenServiceTypeCoverageRowCount: hiddenCount(serviceTypeCoverageRows, visibleServiceTypeCoverageRows),
    payoutLedgerRows,
    payoutRuleCount,
    pricePolicyPreviewRows,
    pricePolicyPreviewSummary,
    pricingAuditRows: servicePricingAuditRows(auditLogs),
    readinessItems,
    serviceSearchQuery,
    serviceTypeCoverageRows,
    serviceTypeCoverageSummary,
    visibleGroupedServices,
    visiblePayoutLedgerRows,
    visiblePricePolicyPreviewRows,
    visibleServiceTypeCoverageRows,
    warningReadinessItems,
  };
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

function hiddenCount<T>(allItems: readonly T[], visibleItems: readonly T[]) {
  return Math.max(allItems.length - visibleItems.length, 0);
}
