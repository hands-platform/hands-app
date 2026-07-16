import { ArrowRight } from 'lucide-react';
import type { AdminOperationalPolicySetting, AdminProvider, AdminProviderSummary } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminMetricGrid, AdminPageTemplate } from '../../components/admin-page-template';
import { AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';
import { readSearchParam } from '../../lib/date-range';
import {
  buildPartnerExportHref,
  buildPartnerExportSlug,
  buildPartnerDataHrefs,
  buildPartnerListHref,
  buildProviderActiveFilters,
  buildProviderFilters,
  partnerRowsPagination,
  partnerHasAdvancedOperationalFilters,
  partnerSortLabel,
} from './partner-filters';
import { buildProviderOpsPolicy, buildProviderOpsPolicyApiHref } from './partner-list-ops';
import { partnerUnsettledWalletBalance as providerUnsettledWalletBalance } from './partner-activity-facts';
import {
  filterPartners as filterProviders,
  sortPartners as sortProviders,
  type PartnerListQueryDeps,
} from './partner-list-query';
import {
  partnerBackupMatchingEligibility,
  partnerCanAcceptBookingNow,
  partnerHasHardAcceptanceBlocker,
  providerDispatchReady,
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
import { buildPartnerOperationRow } from './partner-operation-row';
import { PartnerFilterBoard } from './partner-filter-board';
import { PartnerMasterListSection } from './partner-master-list-section';
import { PartnerOperationsListSection } from './partner-operations-list-section';
import { PartnerPrimaryListTabs } from './partner-primary-list-tabs';
import { buildPartnerMasterRow } from './partner-master-row';
import { PartnerChecklistLaneSection } from './partner-checklist-lane-section';
import { PartnerChecklistWorkQueueSection } from './partner-checklist-work-queue-section';
import { PartnerDispatchHandoffSection } from './partner-dispatch-handoff-section';
import { providerDisplayName } from './partner-display';
import {
  partnerPrimaryListMode,
  partnerDeepOpsAvailable,
  partnerReviewModeContent,
  shouldLoadPartnerDeepOps,
} from './partner-review-mode';
import {
  buildPartnerChecklistLaneItems,
  buildPartnerPriorityLane as buildProviderPriorityLane,
} from './partner-priority-lane-model';
import {
  buildPartnerAccountActionConfirmation,
  readPartnerAccountConfirmationAction,
} from './partner-account-action-confirmation';
import { partnerDirectoryMetricMeta, partnerFilterSummaryMetricMeta } from './partner-metric-meta';
import {
  buildPartnerReviewActionConfirmation,
  readPartnerReviewConfirmationAction,
} from './partner-review-action-confirmation';
import {
  buildPartnerPushDeviceActionConfirmation,
  readPartnerPushDeviceConfirmationAction,
} from './partner-push-device-action-confirmation';
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
  const detailsMode = readSearchParam(params.details);
  const deepPartnerOpsAvailable = partnerDeepOpsAvailable(filters.review);
  const showDeepPartnerOpsSections = shouldLoadPartnerDeepOps(filters.review, detailsMode);
  const showGeneralPartnerDeepOps = showDeepPartnerOpsSections && filters.review !== 'kyc';
  const showPartnerOperationsList = showGeneralPartnerDeepOps;
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
  const partnerExportFileSlug = buildPartnerExportSlug(filters);
  const partnerOperationRows = showPartnerOperationsList
    ? visibleProviders.map((provider) =>
        buildPartnerOperationRow(provider, opsPolicy, {
          displayName: providerDisplayName,
          canAcceptBookingNow: partnerCanAcceptBookingNow,
        }),
      )
    : [];
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
  const partnerListCsvHref = buildPartnerExportHref(filters);
  const compactPartnerListHref = buildPartnerListHref(filters);
  const deepPartnerOpsHref = `${compactPartnerListHref}${compactPartnerListHref.includes('?') ? '&' : '?'}details=all`;
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
      actions={deepPartnerOpsAvailable ? (
        <AdminFormControlLink href={showDeepPartnerOpsSections ? compactPartnerListHref : deepPartnerOpsHref}>
          {showDeepPartnerOpsSections ? 'Compact list' : 'Load operations analysis'}
        </AdminFormControlLink>
      ) : undefined}
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
            description="Active filters split ready supply, pending approval, dispatch risk, and retained partner records."
            title="Partner action snapshot"
          >
            <AdminTraceSummary
              className="admin-mt-14"
              metrics={deepPartnerOps.filterSummary.map((item) => {
                const meta = partnerFilterSummaryMetricMeta(item.label);

                return {
                  action: item.href ? (
                    <AdminFormControlLink className="button-secondary partner-summary-action" href={item.href}>
                      <ArrowRight aria-hidden="true" size={14} />
                      Open subset
                    </AdminFormControlLink>
                  ) : null,
                  detail: item.detail,
                  ...meta,
                  label: item.label,
                  value: item.value,
                };
              })}
            />
          </AdminSection>
          <AdminMetricGrid
            className="admin-mb-16 partner-deep-summary-grid"
            metrics={deepPartnerOps.summary.map(([label, value]) => {
              const meta = partnerDirectoryMetricMeta(label);

              return {
                helper: `${meta.scope} partner signal`,
                ...meta,
                label,
                value,
              };
            })}
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
          {showGeneralPartnerDeepOps ? (
            <>
              <PartnerChecklistWorkQueueSection
                partnerName={providerDisplayName}
                queue={deepPartnerOps.dailyActionQueue}
              />
              <PartnerDispatchHandoffSection handoff={deepPartnerOps.dispatchHandoff} />
              <PartnerShiftHandoffSection handoff={deepPartnerOps.shiftHandoff} />
              <PartnerCommandCenterSection lanes={deepPartnerOps.commandCenter} />
              <PartnerMarketplaceHoldBoardSection board={deepPartnerOps.acceptanceBlockerBoard} />
            </>
          ) : null}
          <PartnerKycReviewBoardSection board={deepPartnerOps.kycReviewBoard} />
          {showGeneralPartnerDeepOps ? (
            <>
              <PartnerDispatchForecastSection
                forecast={deepPartnerOps.dispatchForecast}
                staleLocationMinutes={opsPolicy.staleLocationMinutes}
              />
              <PartnerReviewQueueSection queue={deepPartnerOps.reviewQueue} />
              <PartnerChecklistLaneSection
                blockedCount={deepPartnerOps.priorityLane.blockedCount}
                items={deepPartnerOps.priorityLaneItems}
              />
            </>
          ) : null}
        </>
      ) : null}
    </AdminPageTemplate>
  );
}
