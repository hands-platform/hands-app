import Link from 'next/link';
import { ArrowRight, Download, Filter, SlidersHorizontal, X } from 'lucide-react';
import type { AdminOperationalPolicySetting, AdminProvider } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { ConfirmDialog } from '../../components/confirm-dialog';
import {
  AdminFormControlButton,
  AdminFormControlLink,
  AdminFormSearch,
  AdminFormSelect,
} from '../../components/admin-form-controls';
import { buildCsvDataHref } from '../../lib/csv-export';
import { readSearchParam } from '../../lib/date-range';
import {
  buildPartnerExportSlug,
  buildProviderActiveFilters,
  buildProviderFilters,
  emptyProviderMessage,
  partnerSortLabel,
} from './partner-filters';
import { buildProviderOpsPolicy } from './partner-list-ops';
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
import { PartnerMasterListSection } from './partner-master-list-section';
import { PartnerOperationsListSection } from './partner-operations-list-section';
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
import { partnerReviewModeContent } from './partner-review-mode';
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
const PROVIDER_LIST_RENDER_LIMIT = 40;

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
  const [rawProviders, operationalPolicies] = await Promise.all([
    adminGet<AdminProvider[]>('/admin/partners?view=list', []),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);
  const opsPolicy = buildProviderOpsPolicy(operationalPolicies);
  const allProviders = sortProviders(rawProviders, opsPolicy, filters.sort, PARTNER_LIST_QUERY_DEPS);
  const providers = filterProviders(allProviders, filters, opsPolicy, PARTNER_LIST_QUERY_DEPS);
  const visibleProviders = providers.slice(0, PROVIDER_LIST_RENDER_LIMIT);
  const hiddenProviderCount = Math.max(providers.length - visibleProviders.length, 0);
  const summary = buildProviderSummary(providers, opsPolicy, PARTNER_LIST_QUERY_DEPS);
  const commandCenter = buildProviderCommandCenter(providers, opsPolicy, PARTNER_LIST_QUERY_DEPS);
  const reviewQueue = buildProviderReviewQueue(providers, opsPolicy, PARTNER_LIST_QUERY_DEPS);
  const priorityLane = buildProviderPriorityLane(providers, opsPolicy, {
    displayName: providerDisplayName,
    nextAction: nextProviderListAction,
  });
  const priorityLaneItems = buildPartnerChecklistLaneItems(priorityLane.items, {
    displayName: providerDisplayName,
  });
  const dispatchForecast = buildPartnerDispatchForecast(providers, opsPolicy, {
    dispatchReady: providerDispatchReady,
    hasHardAcceptanceBlocker: partnerHasHardAcceptanceBlocker,
  });
  const acceptanceBlockerBoard = buildPartnerAcceptanceBlockerBoard(
    providers,
    opsPolicy,
    PARTNER_LIST_QUERY_DEPS,
  );
  const kycReviewBoard = buildPartnerKycReviewBoard(providers, providerDisplayName);
  const shiftHandoff = buildPartnerShiftHandoff(providers, opsPolicy, PARTNER_LIST_QUERY_DEPS);
  const dispatchHandoff = buildPartnerDispatchHandoff(allProviders, opsPolicy, PARTNER_LIST_QUERY_DEPS);
  const dailyActionQueue = buildPartnerDailyActionQueue(providers, opsPolicy, {
    displayName: providerDisplayName,
    dispatchReady: providerDispatchReady,
  });
  const activeFilters = buildProviderActiveFilters(filters);
  const reviewModeContent = partnerReviewModeContent(filters.review);
  const filterSummary = buildPartnerFilterSummary(
    providers,
    allProviders,
    opsPolicy,
    activeFilters.length,
    PARTNER_LIST_QUERY_DEPS,
  );
  const partnerExportFilterLabel =
    activeFilters.length > 0 ? activeFilters.map((filter) => filter.label).join(' | ') : 'All partners';
  const partnerExportFileSlug = buildPartnerExportSlug(filters);
  const partnerOperationRows = visibleProviders.map((provider) =>
    buildPartnerOperationRow(provider, opsPolicy, {
      displayName: providerDisplayName,
      canAcceptBookingNow: partnerCanAcceptBookingNow,
    }),
  );
  const directReadyPartnerCount = providers.filter((provider) =>
    partnerCanAcceptBookingNow(provider, opsPolicy),
  ).length;
  const walletMarketplaceHoldCount = providers.filter(
    (provider) => providerUnsettledWalletBalance(provider) < 0,
  ).length;
  const partnerMasterRows = visibleProviders.map((provider) =>
    buildPartnerMasterRow(provider, opsPolicy, { displayName: providerDisplayName }),
  );
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
    <div className="partners-page">
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
      <h1>Partners</h1>
      <div className="card admin-mb-16">
        <form className="form-grid" action="/partners">
          <AdminFormSearch
            className="partner-filter-search"
            defaultValue={filters.q}
            label="Search"
            name="q"
            placeholder="Name, phone, city, partner id"
          />
          <AdminFormSelect
            className="partner-filter-select"
            defaultValue={filters.verification}
            label="Verification"
            name="verification"
            options={[
              { label: 'All', value: '' },
              { label: 'Approved', value: 'APPROVED' },
              { label: 'Submitted', value: 'SUBMITTED' },
              { label: 'Pending', value: 'PENDING' },
              { label: 'Rejected', value: 'REJECTED' },
              { label: 'Blocked', value: 'BLOCKED' },
            ]}
          />
          <AdminFormSelect
            className="partner-filter-select"
            defaultValue={filters.providerStatus}
            label="Partner status"
            name="providerStatus"
            options={[
              { label: 'All', value: '' },
              { label: 'Online available', value: 'ONLINE_AVAILABLE' },
              { label: 'Online busy', value: 'ONLINE_BUSY' },
              { label: 'Available soon', value: 'ONLINE_AVAILABLE_SOON' },
              { label: 'Offline', value: 'OFFLINE' },
            ]}
          />
          <AdminFormSelect
            className="partner-filter-select"
            defaultValue={filters.kyc}
            label="KYC"
            name="kyc"
            options={[
              { label: 'All', value: '' },
              { label: 'Approved', value: 'APPROVED' },
              { label: 'Pending', value: 'PENDING' },
              { label: 'Rejected', value: 'REJECTED' },
              { label: 'Draft', value: 'DRAFT' },
              { label: 'Missing', value: 'MISSING' },
            ]}
          />
          <AdminFormSelect
            className="partner-filter-select"
            defaultValue={filters.location}
            label="Location"
            name="location"
            options={[
              { label: 'All', value: '' },
              { label: 'Recent', value: 'recent' },
              { label: 'Stale', value: 'stale' },
              { label: 'Expired', value: 'expired' },
              { label: 'Missing', value: 'missing' },
            ]}
          />
          <AdminFormSelect
            className="partner-filter-select"
            defaultValue={filters.security}
            label="Device/session"
            name="security"
            options={[
              { label: 'All', value: '' },
              { label: 'Account blocked', value: 'account-blocked' },
              { label: 'Blocked device', value: 'blocked' },
              { label: 'Session check', value: 'session-check' },
              { label: 'Shared device', value: 'shared' },
              { label: 'No app device', value: 'missing' },
              { label: 'Clear', value: 'clear' },
            ]}
          />
          <AdminFormSelect
            className="partner-filter-select"
            defaultValue={filters.readiness}
            label="Readiness"
            name="readiness"
            options={[
              { label: 'All', value: '' },
              { label: 'Ready for dispatch', value: 'ready' },
              { label: 'Needs review', value: 'needs-review' },
              { label: 'Approved but offline', value: 'approved-offline' },
              { label: 'Push missing', value: 'push-missing' },
            ]}
          />
          <AdminFormSelect
            className="partner-filter-select"
            defaultValue={filters.bookingFlow}
            label="Booking flow"
            name="bookingFlow"
            options={[
              { label: 'All', value: '' },
              { label: 'Has active booking', value: 'active-booking' },
              { label: 'First-pick booking', value: 'first-pick' },
              { label: 'Marketplace participant', value: 'marketplace-joined' },
              { label: 'Customer final choice', value: 'final-partner' },
              { label: 'Chat room opened', value: 'chat-live' },
              { label: 'Matched but chat missing', value: 'chat-missing' },
              { label: 'Completed work', value: 'completed-work' },
              { label: 'No completed work', value: 'no-work' },
            ]}
          />
          <AdminFormSelect
            className="partner-filter-select"
            defaultValue={filters.review}
            label="Review queue"
            name="review"
            options={[
              { label: 'All', value: '' },
              { label: 'Unapproved Partners', value: 'unapproved' },
              { label: 'Unsettled Partners', value: 'unsettled' },
              { label: 'KYC updates', value: 'kyc' },
              { label: 'Document review', value: 'documents' },
              { label: 'Public media review', value: 'public-media' },
              { label: 'Bank payout review', value: 'bank' },
              { label: 'First earning payout setup', value: 'payout-setup' },
              { label: 'Cash fee debt', value: 'cash-debt' },
              { label: 'Tax profile review', value: 'tax' },
              { label: 'Device/session check', value: 'security' },
              { label: 'Reports/controls', value: 'reports' },
              { label: 'Account blocks', value: 'blocked' },
              { label: 'Location freshness', value: 'location' },
              { label: 'Push alert readiness', value: 'push' },
              { label: 'Direct request held', value: 'acceptance-blocked' },
              { label: 'Direct request ready', value: 'direct-ready' },
              { label: 'Marketplace ready', value: 'marketplace-ready' },
              { label: 'Marketplace repair', value: 'marketplace-blocked' },
            ]}
          />
          <AdminFormSelect
            className="partner-filter-select"
            defaultValue={filters.sort}
            label="Sort"
            name="sort"
            options={[
              { label: 'Checklist order', value: 'ops-priority' },
              { label: 'Last completed work', value: 'last-work' },
              { label: 'Booking count', value: 'booking-count' },
              { label: 'Completed work count', value: 'completed-count' },
              { label: 'Gross revenue', value: 'gross-revenue' },
              { label: 'Pending payout', value: 'pending-payout' },
              { label: 'Available payout', value: 'available-payout' },
              { label: 'Last app activity', value: 'last-activity' },
              { label: 'Location freshness', value: 'location-freshness' },
              { label: 'Wallet debt first', value: 'wallet-debt' },
              { label: 'Name', value: 'name' },
            ]}
          />
          <div className="actions full-span">
            <AdminFormControlButton className="partner-filter-button">
              <Filter aria-hidden="true" size={16} />
              Apply filters
            </AdminFormControlButton>
            <AdminFormControlLink className="partner-filter-link" href="/partners">
              <X aria-hidden="true" size={16} />
              Clear filters
            </AdminFormControlLink>
            <AdminFormControlLink
              className="partner-filter-link"
              download={`hands-partners-${partnerExportFileSlug}.csv`}
              href={partnerListCsvHref}
            >
              <Download aria-hidden="true" size={16} />
              Export visible CSV
            </AdminFormControlLink>
            <span className="muted">
              Showing {visibleProviders.length} of {providers.length} matching partners
              {providers.length !== allProviders.length ? ` (${allProviders.length} total)` : ''}
            </span>
            <AdminFormControlLink className="partner-filter-link" href="/operations-policy">
              <SlidersHorizontal aria-hidden="true" size={16} />
              Location freshness: {opsPolicy.staleLocationMinutes}m
            </AdminFormControlLink>
          </div>
          {activeFilters.length > 0 ? (
            <div className="full-span">
              <div className="participant-list">
                <span className="pill pill-info">Active filters</span>
                {activeFilters.map((filter) => (
                  <span className="pill pill-warn" key={`${filter.kind}-${filter.value}`}>
                    {filter.label}
                  </span>
                ))}
              </div>
              <p className="muted admin-mt-8">
                {activeFilters.map((filter) => filter.description).join(' ')}
              </p>
            </div>
          ) : (
            <p className="muted full-span">
              No partner filter is active. Showing the first {PROVIDER_LIST_RENDER_LIMIT} rows from the
              operator queue for faster loading.
            </p>
          )}
        </form>
      </div>
      {reviewModeContent ? (
        <section className="card admin-mb-16">
          <div className="ops-section-header">
            <div>
              <h2>{reviewModeContent.title}</h2>
              <p className="muted">{reviewModeContent.description}</p>
            </div>
            <span className="pill pill-warn">{reviewModeContent.badge}</span>
          </div>
          <p className="admin-mt-14">{reviewModeContent.detailFocus}</p>
          <div className="setup-stage-list admin-mt-14">
            {reviewModeContent.steps.map((step, index) => (
              <div className="setup-stage-item" key={step}>
                <span>{index + 1}</span>
                <div>
                  <strong>Operator check</strong>
                  <p className="muted">{step}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="card admin-mb-16">
        <div className="ops-section-header">
          <div>
            <h2>Current filter summary</h2>
            <p className="muted">
              A factual snapshot of the partner rows currently loaded on this page before export, review,
              dispatch checks, or account follow-up.
            </p>
          </div>
          <span className="pill pill-info">{partnerSortLabel(filters.sort)}</span>
        </div>
        <div className="service-trace-summary admin-mt-14">
          {filterSummary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small className="muted">{item.detail}</small>
              {item.href ? (
                <Link className="button button-secondary partner-summary-action" href={item.href}>
                  <ArrowRight aria-hidden="true" size={14} />
                  Open subset
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      <div className="grid admin-mb-16">
        {summary.map(([label, value]) => (
          <div className="card" key={label}>
            <p>{label}</p>
            <h2>{value}</h2>
          </div>
        ))}
      </div>
      <PartnerMasterListSection rows={partnerMasterRows} />
      <PartnerOperationsListSection
        directReadyCount={directReadyPartnerCount}
        hiddenPartnerCount={hiddenProviderCount}
        rows={partnerOperationRows}
        totalPartnerCount={providers.length}
        walletHoldCount={walletMarketplaceHoldCount}
      />
      <PartnerChecklistWorkQueueSection partnerName={providerDisplayName} queue={dailyActionQueue} />
      <PartnerDispatchHandoffSection handoff={dispatchHandoff} />
      <PartnerShiftHandoffSection handoff={shiftHandoff} />
      <PartnerCommandCenterSection lanes={commandCenter} />
      <PartnerMarketplaceHoldBoardSection board={acceptanceBlockerBoard} />
      <PartnerKycReviewBoardSection board={kycReviewBoard} />
      <PartnerDispatchForecastSection
        forecast={dispatchForecast}
        staleLocationMinutes={opsPolicy.staleLocationMinutes}
      />
      <PartnerReviewQueueSection queue={reviewQueue} />
      <PartnerChecklistLaneSection blockedCount={priorityLane.blockedCount} items={priorityLaneItems} />
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
    </div>
  );
}
