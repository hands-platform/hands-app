import { ArrowRight } from 'lucide-react';
import type {
  AdminOperationalPolicySetting,
  AdminPartnerWalletDebtPage,
  AdminProvider,
  AdminProviderSummary,
} from '../../lib/admin-api';
import { adminGetResult } from '../../lib/admin-api';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { AdminFormControlLink } from '../../components/admin-form-controls';
import { AdminTraceSummary } from '../../components/admin-overview-card';
import { AdminMetricGrid, AdminPageTemplate } from '../../components/admin-page-template';
import { AdminErrorState, AdminSection } from '../../components/admin-surface';
import { DateTimeText } from '../../components/date-time-text';
import { StatusBadge } from '../../components/status-badge';
import { readSearchParam } from '../../lib/date-range';
import { OPERATIONAL_POLICY_CACHE_OPTIONS } from '../../lib/operations-policy';
import {
  buildPartnerExportHref,
  buildPartnerExportSlug,
  buildPartnerDataHrefs,
  buildPartnerListHref,
  buildPartnerSnapshotFirstHref,
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
import { buildPartnerMasterRow } from './partner-master-row';
import { PartnerChecklistLaneSection } from './partner-checklist-lane-section';
import { PartnerChecklistWorkQueueSection } from './partner-checklist-work-queue-section';
import { PartnerDispatchHandoffSection } from './partner-dispatch-handoff-section';
import { providerDisplayName } from './partner-display';
import { partnerDeepOpsAvailable, partnerReviewModeContent, shouldLoadPartnerDeepOps } from './partner-review-mode';
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
  const currentHref = buildPartnerListHref(filters, { page: filters.page });
  const snapshotCursorFallback: AdminPartnerWalletDebtPage = {
    generatedAt: '',
    items: [],
    page: {
      currentCursor: '',
      hasNextPage: false,
      nextCursor: null,
      offset: 0,
      returned: 0,
      snapshotCursor: '',
      totalCount: 0,
    },
    snapshotAt: '',
  };
  const [providersResult, summaryResult, operationalPoliciesResult] = await Promise.all([
    adminGetResult<AdminProvider[] | AdminPartnerWalletDebtPage>(
      dataHrefs.listHref,
      dataHrefs.listUsesSnapshotCursor ? snapshotCursorFallback : [],
    ),
    dataHrefs.listUsesSnapshotCursor
      ? Promise.resolve({
          data: { totalCount: 0 } as AdminProviderSummary,
          ok: true,
          status: 200,
        })
      : adminGetResult<AdminProviderSummary>(dataHrefs.summaryHref, { totalCount: 0 }),
    adminGetResult<AdminOperationalPolicySetting[]>(
      buildProviderOpsPolicyApiHref(),
      [],
      OPERATIONAL_POLICY_CACHE_OPTIONS,
    ),
  ]);
  const partnerReviewContent = partnerReviewModeContent(filters.review);
  const partnerPageTitle =
    filters.review === 'approval-pending'
      ? 'Approvals'
      : filters.review === 'unapproved'
        ? 'Onboarding Blockers'
        : (partnerReviewContent?.title ?? 'Directory');

  if (!providersResult.ok || !summaryResult.ok) {
    return (
      <AdminPageTemplate
        contentClassName="partners-page"
        description={
          partnerReviewContent?.description ??
          'Search by partner name, phone, or ID, then open a profile to review status and restrictions.'
        }
        title={partnerPageTitle}
      >
        <AdminErrorState
          action={
            <AdminFormControlLink
              href={dataHrefs.listUsesSnapshotCursor ? buildPartnerSnapshotFirstHref(filters) : currentHref}
            >
              {dataHrefs.listUsesSnapshotCursor ? 'Restart snapshot' : 'Refresh'}
            </AdminFormControlLink>
          }
          message={
            dataHrefs.listUsesSnapshotCursor
              ? 'The wallet debt snapshot could not be loaded or has expired. Restart it before making an operational decision.'
              : 'Partner data could not be loaded. Refresh before using this directory for an operational decision.'
          }
          title={
            dataHrefs.listUsesSnapshotCursor ? 'Wallet debt snapshot unavailable' : 'Unable to load Partners'
          }
        />
      </AdminPageTemplate>
    );
  }

  const snapshotPage = dataHrefs.listUsesSnapshotCursor
    ? (providersResult.data as AdminPartnerWalletDebtPage)
    : null;
  const rawProviders = snapshotPage ? snapshotPage.items : (providersResult.data as AdminProvider[]);
  const providerDirectorySummary = snapshotPage
    ? { generatedAt: snapshotPage.generatedAt, totalCount: snapshotPage.page.totalCount }
    : summaryResult.data;
  const opsPolicy = buildProviderOpsPolicy(operationalPoliciesResult.data);
  const allProviders = dataHrefs.listIsServerPaginated
    ? rawProviders
    : sortProviders(rawProviders, opsPolicy, filters.sort, PARTNER_LIST_QUERY_DEPS);
  const providers = dataHrefs.listIsServerPaginated
    ? allProviders
    : filterProviders(allProviders, filters, opsPolicy, PARTNER_LIST_QUERY_DEPS);
  const activeFilters = buildProviderActiveFilters(filters);
  const partnerDirectoryTotalCount = dataHrefs.summaryMatchesVisibleFilter
    ? providerDirectorySummary.totalCount || rawProviders.length
    : providers.length;
  const providerPagination = snapshotPage
    ? {
        from: partnerDirectoryTotalCount === 0 ? 0 : snapshotPage.page.offset + 1,
        page: Math.floor(snapshotPage.page.offset / filters.pageSize) + 1,
        pageSize: filters.pageSize,
        rows: providers,
        to: snapshotPage.page.offset + providers.length,
        totalPages: Math.max(1, Math.ceil(partnerDirectoryTotalCount / filters.pageSize)),
        totalRows: partnerDirectoryTotalCount,
      }
    : partnerRowsPagination(providers, filters, {
        serverPaginated: dataHrefs.listIsServerPaginated,
        totalRows: partnerDirectoryTotalCount,
      });
  const visibleProviders = providerPagination.rows;
  const operationalPolicyAvailable = operationalPoliciesResult.ok;
  const hiddenProviderCount = Math.max(partnerDirectoryTotalCount - visibleProviders.length, 0);
  const detailsMode = readSearchParam(params.details);
  const deepPartnerOpsAvailable =
    operationalPolicyAvailable && partnerDeepOpsAvailable(filters.review);
  const showDeepPartnerOpsSections =
    operationalPolicyAvailable && shouldLoadPartnerDeepOps(filters.review, detailsMode);
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
    buildPartnerMasterRow(provider, opsPolicy, {
      displayName: providerDisplayName,
      operationalPolicyAvailable,
    }),
  );
  const partnerMasterPagination = { ...providerPagination, rows: partnerMasterRows };
  const partnerMasterListMode =
    filters.review === 'approval-pending' || filters.review === 'unapproved' || filters.review === 'unsettled'
      ? filters.review
      : 'default';
  const showAdvancedPartnerFilters = partnerHasAdvancedOperationalFilters(filters);
  const partnerListCsvHref = buildPartnerExportHref(filters, snapshotPage?.page.currentCursor);
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
      actions={
        <>
          <span className="admin-page-refresh-status">
            Updated <DateTimeText fallback="time unavailable" value={providerDirectorySummary.generatedAt} />
          </span>
          <AdminFormControlLink className="button-secondary" href={currentHref}>
            Refresh
          </AdminFormControlLink>
          {deepPartnerOpsAvailable ? (
            <AdminFormControlLink
              href={showDeepPartnerOpsSections ? compactPartnerListHref : deepPartnerOpsHref}
            >
              {showDeepPartnerOpsSections ? 'Compact list' : 'Load operations analysis'}
            </AdminFormControlLink>
          ) : null}
        </>
      }
      contentClassName="partners-page"
      description={
        partnerReviewContent?.description ??
        'Search by partner name, phone, or ID, then open a profile to review status and restrictions.'
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
      {!operationalPoliciesResult.ok ? (
        <AdminErrorState
          action={<AdminFormControlLink href={currentHref}>Retry policy</AdminFormControlLink>}
          className="admin-mb-16"
          message="Location and readiness signals use fallback thresholds and are not confirmed current policy. Partner records remain available for non-policy decisions."
          title="Operational policy unavailable"
        />
      ) : null}
      {filters.review !== 'approval-pending' || partnerDirectoryTotalCount > 0 ? (
        <PartnerFilterBoard
          activeFilters={activeFilters}
          ageCounts={providerDirectorySummary.queueAgeCounts}
          queueSla={providerDirectorySummary.queueSla}
          csvDownloadName={`hands-partners-${partnerExportFileSlug}.csv`}
          csvHref={partnerListCsvHref}
          filteredCount={visibleProviders.length}
          filters={filters}
          locationFreshnessLabel={
            operationalPoliciesResult.ok
              ? `Location freshness: ${opsPolicy.staleLocationMinutes}m`
              : 'Location freshness: unavailable'
          }
          showAdvancedFilters={showAdvancedPartnerFilters}
          totalCount={partnerDirectoryTotalCount}
        />
      ) : null}
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
                    <AdminFormControlLink
                      className="button-secondary partner-summary-action"
                      href={item.href}
                    >
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
        snapshotPage={
          snapshotPage ? { ...snapshotPage.page, snapshotAt: snapshotPage.snapshotAt } : undefined
        }
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
