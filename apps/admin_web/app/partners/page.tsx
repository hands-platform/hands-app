import { ArrowRight } from 'lucide-react';
import type { AdminOperationalPolicySetting, AdminProvider, AdminProviderSummary } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminMetricGrid, AdminPageTemplate } from '../../components/admin-page-template';
import { AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { buildCsvDataHref } from '../../lib/csv-export';
import { readSearchParam } from '../../lib/date-range';
import {
  buildPartnerExportSlug,
  buildPartnerDataHrefs,
  buildProviderActiveFilters,
  buildProviderFilters,
  emptyProviderMessage,
  partnerRowsPagination,
  partnerHasAdvancedOperationalFilters,
  partnerSortLabel,
} from './partner-filters';
import { buildProviderOpsPolicy, buildProviderOpsPolicyApiHref } from './partner-list-ops';
import { partnerUnsettledWalletBalance as providerUnsettledWalletBalance } from './partner-activity-facts';
import {
  filterPartners as filterProviders,
  partnerHasOpenControl as hasOpenPartnerControl,
  sortPartners as sortProviders,
  type PartnerListQueryDeps,
} from './partner-list-query';
import {
  partnerBackupMatchingEligibility,
  partnerCanAcceptBookingNow,
  partnerHasHardAcceptanceBlocker,
  providerActionHint,
  providerDispatchReady,
  providerReviewIssues,
} from './partner-list-readiness';
import { nextPartnerListAction as nextProviderListAction } from './partner-list-actions';
import {
  buildPartnerFilterSummary,
  buildPartnerReviewQueue as buildProviderReviewQueue,
  buildPartnerSummary as buildProviderSummary,
} from './partner-list-summary';
import { buildPartnerCommandCenter as buildProviderCommandCenter } from './partner-command-center';
import { PartnerCommandCenterSection } from './partner-command-center-section';
import { buildPartnerAcceptanceBlockerBoard } from './partner-acceptance-blocker-board';
import { PartnerMarketplaceHoldBoardSection } from './partner-marketplace-hold-board-section';
import { buildPartnerDailyActionQueue } from './partner-daily-action-queue';
import { buildPartnerDispatchForecast } from './partner-dispatch-forecast';
import { PartnerDispatchForecastSection } from './partner-dispatch-forecast-section';
import { buildPartnerDispatchHandoff } from './partner-dispatch-handoff';
import { buildPartnerKycReviewBoard } from './partner-kyc-review-board';
import { PartnerKycReviewBoardSection } from './partner-kyc-review-board-section';
import { PartnerReviewQueueSection } from './partner-review-queue-section';
import { buildPartnerShiftHandoff } from './partner-shift-handoff';
import { PartnerShiftHandoffSection } from './partner-shift-handoff-section';
import { PartnerLegacyOperationsTableSection } from './partner-legacy-operations-table-section';
import { buildPartnerOperationRow } from './partner-operation-row';
import { buildPartnerExportRows, PARTNER_EXPORT_COLUMNS } from './partner-export-rows';
import { PartnerFilterBoard } from './partner-filter-board';
import { PartnerMasterListSection } from './partner-master-list-section';
import { PartnerOperationsListSection } from './partner-operations-list-section';
import { PartnerPrimaryListTabs } from './partner-primary-list-tabs';
import { buildPartnerMasterRow } from './partner-master-row';
import { buildPartnerOpsBadges } from './partner-ops-badges';
import { PartnerChecklistLaneSection } from './partner-checklist-lane-section';
import { PartnerChecklistWorkQueueSection } from './partner-checklist-work-queue-section';
import { PartnerDispatchHandoffSection } from './partner-dispatch-handoff-section';
import { PartnerLocationCell } from './partner-location-cell';
import { PartnerSecurityCell } from './partner-security-cell';
import { PartnerActionsCell } from './partner-actions-cell';
import { PartnerServicesCell } from './partner-services-cell';
import { PartnerFilesCell } from './partner-files-cell';
import { PartnerPushDevicesCell } from './partner-push-devices-cell';
import { PartnerOnboardingCell } from './partner-onboarding-cell';
import { PartnerOpsReadinessCell } from './partner-ops-readiness-cell';
import { providerDisplayName } from './partner-display';
import {
  partnerPrimaryListMode,
  partnerReviewModeContent,
  shouldRenderPartnerDeepOpsSections,
  shouldRenderPartnerOperationsList,
} from './partner-review-mode';
import {
  buildPartnerChecklistLaneItems,
  buildPartnerPriorityLane as buildProviderPriorityLane,
} from './partner-priority-lane-model';
import {
  buildPartnerAccountActionConfirmation,
  readPartnerAccountConfirmationAction,
} from './partner-account-action-confirmation';
import {
  buildPartnerReviewActionConfirmation,
  readPartnerReviewConfirmationAction,
} from './partner-review-action-confirmation';
import {
  buildPartnerPushDeviceActionConfirmation,
  readPartnerPushDeviceConfirmationAction,
} from './partner-push-device-action-confirmation';
import {
  partnerAccountActionMenuItems,
  partnerBankReviewActionMenuItems,
  partnerDocumentReviewActionMenuItems,
  partnerKycReviewActionMenuItems,
  partnerPublicMediaReviewActionMenuItems,
  partnerTaxReviewActionMenuItems,
} from './partner-action-menu-items';
import {
  partnerAccountServerAction,
  partnerPushDeviceServerAction,
  partnerReviewServerAction,
} from './partner-server-actions';
type ProvidersPageSearchParams = Promise<Record<string, string | string[] | undefined>>;

const PARTNER_LIST_QUERY_DEPS: PartnerListQueryDeps = {
  canAcceptBookingNow: partnerCanAcceptBookingNow,
  dispatchReady: providerDispatchReady,
  displayName: providerDisplayName,
  hasHardAcceptanceBlocker: partnerHasHardAcceptanceBlocker,
  marketplaceEligibility: partnerBackupMatchingEligibility,
};

export default async function ProvidersPage({ searchParams }: { searchParams?: ProvidersPageSearchParams }) {
  const params = searchParams ? await searchParams : {};
  const filters = buildProviderFilters(params);
  const dataHrefs = buildPartnerDataHrefs(filters);
  const [rawProviders, providerDirectorySummary, operationalPolicies] = await Promise.all([
    adminGet<AdminProvider[]>(dataHrefs.listHref, []),
    adminGet<AdminProviderSummary>(dataHrefs.summaryHref, { totalCount: 0 }),
    adminGet<AdminOperationalPolicySetting[]>(buildProviderOpsPolicyApiHref(), []),
  ]);
  const opsPolicy = buildProviderOpsPolicy(operationalPolicies);
  const allProviders = dataHrefs.listIsServerPaginated
    ? rawProviders
    : sortProviders(rawProviders, opsPolicy, filters.sort, PARTNER_LIST_QUERY_DEPS);
  const providers = dataHrefs.listIsServerPaginated
    ? allProviders
    : filterProviders(allProviders, filters, opsPolicy, PARTNER_LIST_QUERY_DEPS);
  const activeFilters = buildProviderActiveFilters(filters);
  const partnerDirectoryTotalCount =
    dataHrefs.summaryMatchesVisibleFilter
      ? providerDirectorySummary.totalCount || rawProviders.length
      : providers.length;
  const providerPagination = partnerRowsPagination(providers, filters, {
    serverPaginated: dataHrefs.listIsServerPaginated,
    totalRows: partnerDirectoryTotalCount,
  });
  const visibleProviders = providerPagination.rows;
  const hiddenProviderCount = Math.max(partnerDirectoryTotalCount - visibleProviders.length, 0);
  const showDeepPartnerOpsSections = shouldRenderPartnerDeepOpsSections(filters.review);
  const showPartnerOperationsList = shouldRenderPartnerOperationsList(filters.review);
  const deepPartnerOps = showDeepPartnerOpsSections
    ? (() => {
        const priorityLane = buildProviderPriorityLane(providers, opsPolicy, {
          displayName: providerDisplayName,
          nextAction: nextProviderListAction,
        });

        return {
          acceptanceBlockerBoard: buildPartnerAcceptanceBlockerBoard(
            providers,
            opsPolicy,
            PARTNER_LIST_QUERY_DEPS,
          ),
          commandCenter: buildProviderCommandCenter(providers, opsPolicy, PARTNER_LIST_QUERY_DEPS),
          dailyActionQueue: buildPartnerDailyActionQueue(providers, opsPolicy, {
            displayName: providerDisplayName,
            dispatchReady: providerDispatchReady,
          }),
          dispatchForecast: buildPartnerDispatchForecast(providers, opsPolicy, {
            dispatchReady: providerDispatchReady,
            hasHardAcceptanceBlocker: partnerHasHardAcceptanceBlocker,
          }),
          dispatchHandoff: buildPartnerDispatchHandoff(allProviders, opsPolicy, PARTNER_LIST_QUERY_DEPS),
          filterSummary: buildPartnerFilterSummary(
            providers,
            allProviders,
            opsPolicy,
            activeFilters.length,
            PARTNER_LIST_QUERY_DEPS,
          ),
          kycReviewBoard: buildPartnerKycReviewBoard(providers, providerDisplayName),
          priorityLane,
          priorityLaneItems: buildPartnerChecklistLaneItems(priorityLane.items, {
            displayName: providerDisplayName,
          }),
          reviewQueue: buildProviderReviewQueue(providers, opsPolicy, PARTNER_LIST_QUERY_DEPS),
          shiftHandoff: buildPartnerShiftHandoff(providers, opsPolicy, PARTNER_LIST_QUERY_DEPS),
          summary: buildProviderSummary(providers, opsPolicy, PARTNER_LIST_QUERY_DEPS),
        };
      })()
    : null;
  const partnerExportFilterLabel =
    activeFilters.length > 0 ? activeFilters.map((filter) => filter.label).join(' | ') : 'All partners';
  const partnerExportFileSlug = buildPartnerExportSlug(filters);
  const partnerOperationRows = visibleProviders.map((provider) =>
    buildPartnerOperationRow(provider, opsPolicy, {
      displayName: providerDisplayName,
      canAcceptBookingNow: partnerCanAcceptBookingNow,
    }),
  );
  const directReadyPartnerCount = showPartnerOperationsList
    ? providers.filter((provider) => partnerCanAcceptBookingNow(provider, opsPolicy)).length
    : 0;
  const settlementWarningPartnerCount = showPartnerOperationsList
    ? providers.filter((provider) => providerUnsettledWalletBalance(provider) < 0).length
    : 0;
  const partnerMasterRows = visibleProviders.map((provider) =>
    buildPartnerMasterRow(provider, opsPolicy, { displayName: providerDisplayName }),
  );
  const partnerMasterPagination = { ...providerPagination, rows: partnerMasterRows };
  const partnerListMode = partnerPrimaryListMode(filters.review);
  const partnerReviewContent = partnerReviewModeContent(filters.review);
  const partnerPageTitle = partnerReviewContent?.title ?? 'Partners';
  const partnerMasterListMode =
    filters.review === 'unapproved' || filters.review === 'unsettled' ? filters.review : 'default';
  const showAdvancedPartnerFilters = partnerHasAdvancedOperationalFilters(filters);
  const partnerExportRows = buildPartnerExportRows({
    filterLabel: partnerExportFilterLabel,
    filters,
    masterRows: partnerMasterRows,
    operationRows: partnerOperationRows,
    fallbackOperationRow: (provider) =>
      buildPartnerOperationRow(provider, opsPolicy, {
        displayName: providerDisplayName,
        canAcceptBookingNow: partnerCanAcceptBookingNow,
      }),
  });
  const partnerListCsvHref = buildCsvDataHref(partnerExportRows, [...PARTNER_EXPORT_COLUMNS]);
  const accountConfirmation = buildPartnerAccountActionConfirmation(
    allProviders,
    readPartnerAccountConfirmationAction(readSearchParam(params.confirm)),
    readSearchParam(params.providerId),
  );
  const reviewConfirmation = buildPartnerReviewActionConfirmation(
    allProviders,
    readPartnerReviewConfirmationAction(readSearchParam(params.reviewAction)),
    {
      bankAccountId: readSearchParam(params.bankAccountId),
      documentId: readSearchParam(params.documentId),
      fileId: readSearchParam(params.fileId),
      providerId: readSearchParam(params.providerId),
    },
  );
  const pushDeviceConfirmation = buildPartnerPushDeviceActionConfirmation(
    allProviders,
    readPartnerPushDeviceConfirmationAction(readSearchParam(params.pushAction)),
    readSearchParam(params.pushDeviceId),
  );

  return (
    <AdminPageTemplate
      contentClassName="partners-page"
      description={
        partnerReviewContent?.description ??
        'Partner directory aligned to the Vuexy management table using live onboarding, wallet, app session, location, and booking data.'
      }
      title={partnerPageTitle}
    >
      {accountConfirmation ? (
        <ConfirmDialog
          action={partnerAccountServerAction(accountConfirmation.action)}
          cancelHref={accountConfirmation.cancelHref}
          confirmLabel={accountConfirmation.confirmLabel}
          description={accountConfirmation.description}
          disabled={accountConfirmation.disabled}
          hiddenInputs={accountConfirmation.hiddenInputs}
          id={`partner-account-action-${accountConfirmation.action}-${accountConfirmation.providerId}`}
          textInputs={accountConfirmation.textInputs}
          title={accountConfirmation.title}
          tone={accountConfirmation.tone}
        />
      ) : null}
      {reviewConfirmation ? (
        <ConfirmDialog
          action={partnerReviewServerAction(reviewConfirmation.action)}
          cancelHref={reviewConfirmation.cancelHref}
          confirmLabel={reviewConfirmation.confirmLabel}
          description={reviewConfirmation.description}
          disabled={reviewConfirmation.disabled}
          hiddenInputs={reviewConfirmation.hiddenInputs}
          id={`partner-review-action-${reviewConfirmation.action}-${reviewConfirmation.providerId}`}
          textInputs={reviewConfirmation.textInputs}
          title={reviewConfirmation.title}
          tone={reviewConfirmation.tone}
        />
      ) : null}
      {pushDeviceConfirmation ? (
        <ConfirmDialog
          action={partnerPushDeviceServerAction(pushDeviceConfirmation.action)}
          cancelHref={pushDeviceConfirmation.cancelHref}
          confirmLabel={pushDeviceConfirmation.confirmLabel}
          description={pushDeviceConfirmation.description}
          disabled={pushDeviceConfirmation.disabled}
          hiddenInputs={pushDeviceConfirmation.hiddenInputs}
          id={`partner-push-device-action-${pushDeviceConfirmation.action}-${pushDeviceConfirmation.pushDeviceId}`}
          title={pushDeviceConfirmation.title}
          tone={pushDeviceConfirmation.tone}
        />
      ) : null}
      <PartnerPrimaryListTabs activeMode={partnerListMode} />
      <PartnerFilterBoard
        activeFilters={activeFilters}
        csvDownloadName={`hands-partners-${partnerExportFileSlug}.csv`}
        csvHref={partnerListCsvHref}
        filteredCount={visibleProviders.length}
        filters={filters}
        locationFreshnessLabel={`Location freshness: ${opsPolicy.staleLocationMinutes}m`}
        showAdvancedFilters={showAdvancedPartnerFilters}
        totalCount={partnerDirectoryTotalCount}
      />
      {deepPartnerOps ? (
        <>
          <AdminSection
            actions={<StatusBadge tone="info">{partnerSortLabel(filters.sort)}</StatusBadge>}
            className="admin-mb-16 partner-current-filter-summary-card"
            description="Current partner rows loaded on this page before export, review, dispatch checks, or account follow-up."
            title="Current filter summary"
          >
            <AdminTraceSummary
              className="admin-mt-14"
              metrics={deepPartnerOps.filterSummary.map((item) => ({
                action: item.href ? (
                  <AdminFormControlLink className="button-secondary partner-summary-action" href={item.href}>
                    <ArrowRight aria-hidden="true" size={14} />
                    Open subset
                  </AdminFormControlLink>
                ) : null,
                detail: item.detail,
                label: item.label,
                value: item.value,
              }))}
            />
          </AdminSection>
          <AdminMetricGrid
            className="admin-mb-16 partner-deep-summary-grid"
            metrics={deepPartnerOps.summary.map(([label, value]) => ({
              helper: 'Current filtered partner set',
              label,
              value,
            }))}
          />
        </>
      ) : null}
      <PartnerMasterListSection
        filters={filters}
        mode={partnerMasterListMode}
        pagination={partnerMasterPagination}
      />
      {showPartnerOperationsList ? (
        <PartnerOperationsListSection
          directReadyCount={directReadyPartnerCount}
          hiddenPartnerCount={hiddenProviderCount}
          rows={partnerOperationRows}
          settlementWarningCount={settlementWarningPartnerCount}
          totalPartnerCount={providers.length}
        />
      ) : null}
      {deepPartnerOps ? (
        <>
          <PartnerChecklistWorkQueueSection
            partnerName={providerDisplayName}
            queue={deepPartnerOps.dailyActionQueue}
          />
          <PartnerDispatchHandoffSection handoff={deepPartnerOps.dispatchHandoff} />
          <PartnerShiftHandoffSection handoff={deepPartnerOps.shiftHandoff} />
          <PartnerCommandCenterSection lanes={deepPartnerOps.commandCenter} />
          <PartnerMarketplaceHoldBoardSection board={deepPartnerOps.acceptanceBlockerBoard} />
          <PartnerKycReviewBoardSection board={deepPartnerOps.kycReviewBoard} />
          <PartnerDispatchForecastSection
            forecast={deepPartnerOps.dispatchForecast}
            staleLocationMinutes={opsPolicy.staleLocationMinutes}
          />
          <PartnerReviewQueueSection queue={deepPartnerOps.reviewQueue} />
          <PartnerChecklistLaneSection
            blockedCount={deepPartnerOps.priorityLane.blockedCount}
            items={deepPartnerOps.priorityLaneItems}
          />
          <PartnerLegacyOperationsTableSection
            emptyMessage={emptyProviderMessage(activeFilters)}
            hiddenPartnerCount={hiddenProviderCount}
            partnerName={providerDisplayName}
            providers={visibleProviders}
            renderActions={(provider) => (
              <PartnerActionsCell
                actions={partnerAccountActionMenuItems(provider)}
                partnerName={providerDisplayName(provider)}
              />
            )}
            renderFiles={(provider) => (
              <PartnerFilesCell
                partnerName={providerDisplayName(provider)}
                provider={provider}
                publicMediaActions={partnerPublicMediaReviewActionMenuItems}
              />
            )}
            renderLocation={(provider) => <PartnerLocationCell provider={provider} opsPolicy={opsPolicy} />}
            renderOnboarding={(provider) => (
              <PartnerOnboardingCell
                bankActions={partnerBankReviewActionMenuItems}
                documentActions={partnerDocumentReviewActionMenuItems}
                kycActions={partnerKycReviewActionMenuItems}
                partnerName={providerDisplayName(provider)}
                provider={provider}
                taxActions={partnerTaxReviewActionMenuItems}
              />
            )}
            renderOpsReadiness={(provider) => (
              <PartnerOpsReadinessCell
                actionHint={providerActionHint(provider, opsPolicy)}
                eligibility={partnerBackupMatchingEligibility(provider, opsPolicy)}
                hasOpenControl={hasOpenPartnerControl(provider)}
                issues={providerReviewIssues(provider, opsPolicy)}
                nextAction={nextProviderListAction(provider, opsPolicy)}
                opsBadges={buildPartnerOpsBadges(provider, opsPolicy, {
                  canAcceptBookingNow: partnerCanAcceptBookingNow,
                })}
                opsPolicy={opsPolicy}
                provider={provider}
              />
            )}
            renderPushDevices={(provider) => <PartnerPushDevicesCell provider={provider} />}
            renderSecurity={(provider) => <PartnerSecurityCell provider={provider} />}
            renderServices={(provider) => <PartnerServicesCell provider={provider} />}
          />
        </>
      ) : null}
    </AdminPageTemplate>
  );
}
