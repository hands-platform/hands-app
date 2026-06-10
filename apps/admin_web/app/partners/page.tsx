import Link from 'next/link';
import type {
  AdminOperationalPolicySetting,
  AdminProvider,
} from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { ConfirmDialog } from '../../components/confirm-dialog';
import { buildCsvDataHref } from '../../lib/csv-export';
import { readSearchParam } from '../../lib/date-range';
import {
  buildPartnerExportSlug,
  buildProviderActiveFilters,
  buildProviderFilters,
  emptyProviderMessage,
  partnerSortLabel,
} from './partner-filters';
import {
  buildProviderOpsPolicy,
} from './partner-list-ops';
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
import {
  nextPartnerListAction as nextProviderListAction,
} from './partner-list-actions';
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
import {
  buildPartnerExportRows,
  PARTNER_EXPORT_COLUMNS,
} from './partner-export-rows';
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
    <>
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
      <div className="card" style={{ marginBottom: 16 }}>
        <form className="form-grid" action="/partners">
          <label>
            Search
            <input name="q" defaultValue={filters.q} placeholder="Name, phone, city, partner id" />
          </label>
          <label>
            Verification
            <select name="verification" defaultValue={filters.verification}>
              <option value="">All</option>
              <option value="APPROVED">Approved</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </label>
          <label>
            Partner status
            <select name="providerStatus" defaultValue={filters.providerStatus}>
              <option value="">All</option>
              <option value="ONLINE_AVAILABLE">Online available</option>
              <option value="ONLINE_BUSY">Online busy</option>
              <option value="ONLINE_AVAILABLE_SOON">Available soon</option>
              <option value="OFFLINE">Offline</option>
            </select>
          </label>
          <label>
            KYC
            <select name="kyc" defaultValue={filters.kyc}>
              <option value="">All</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
              <option value="DRAFT">Draft</option>
              <option value="MISSING">Missing</option>
            </select>
          </label>
          <label>
            Location
            <select name="location" defaultValue={filters.location}>
              <option value="">All</option>
              <option value="recent">Recent</option>
              <option value="stale">Stale</option>
              <option value="expired">Expired</option>
              <option value="missing">Missing</option>
            </select>
          </label>
          <label>
            Device/session
            <select name="security" defaultValue={filters.security}>
              <option value="">All</option>
              <option value="account-blocked">Account blocked</option>
              <option value="blocked">Blocked device</option>
              <option value="session-check">Session check</option>
              <option value="shared">Shared device</option>
              <option value="missing">No app device</option>
              <option value="clear">Clear</option>
            </select>
          </label>
          <label>
            Readiness
            <select name="readiness" defaultValue={filters.readiness}>
              <option value="">All</option>
              <option value="ready">Ready for dispatch</option>
              <option value="needs-review">Needs review</option>
              <option value="approved-offline">Approved but offline</option>
              <option value="push-missing">Push missing</option>
            </select>
          </label>
          <label>
            Booking flow
            <select name="bookingFlow" defaultValue={filters.bookingFlow}>
              <option value="">All</option>
              <option value="active-booking">Has active booking</option>
              <option value="first-pick">First-pick booking</option>
              <option value="marketplace-joined">Marketplace participant</option>
              <option value="final-partner">Customer final choice</option>
              <option value="chat-live">Chat room opened</option>
              <option value="chat-missing">Matched but chat missing</option>
              <option value="completed-work">Completed work</option>
              <option value="no-work">No completed work</option>
            </select>
          </label>
          <label>
            Review queue
            <select name="review" defaultValue={filters.review}>
              <option value="">All</option>
              <option value="kyc">KYC updates</option>
              <option value="documents">Document review</option>
              <option value="public-media">Public media review</option>
              <option value="bank">Bank payout review</option>
              <option value="payout-setup">First earning payout setup</option>
              <option value="cash-debt">Cash fee debt</option>
              <option value="tax">Tax profile review</option>
              <option value="security">Device/session check</option>
              <option value="reports">Reports/controls</option>
              <option value="blocked">Account blocks</option>
              <option value="location">Location freshness</option>
              <option value="push">Push alert readiness</option>
              <option value="acceptance-blocked">Direct request held</option>
              <option value="direct-ready">Direct request ready</option>
              <option value="marketplace-ready">Marketplace ready</option>
              <option value="marketplace-blocked">Marketplace repair</option>
            </select>
          </label>
          <label>
            Sort
            <select name="sort" defaultValue={filters.sort}>
              <option value="ops-priority">Checklist order</option>
              <option value="last-work">Last completed work</option>
              <option value="booking-count">Booking count</option>
              <option value="completed-count">Completed work count</option>
              <option value="gross-revenue">Gross revenue</option>
              <option value="pending-payout">Pending payout</option>
              <option value="available-payout">Available payout</option>
              <option value="last-activity">Last app activity</option>
              <option value="location-freshness">Location freshness</option>
              <option value="wallet-debt">Wallet debt first</option>
              <option value="name">Name</option>
            </select>
          </label>
          <div className="actions full-span">
            <button type="submit">Apply filters</button>
            <Link className="text-link" href="/partners">
              Clear filters
            </Link>
            <a
              className="text-link"
              download={`hands-partners-${partnerExportFileSlug}.csv`}
              href={partnerListCsvHref}
            >
              Export visible CSV
            </a>
            <span className="muted">
              Showing {visibleProviders.length} of {providers.length} matching partners
              {providers.length !== allProviders.length ? ` (${allProviders.length} total)` : ''}
            </span>
            <Link className="text-link" href="/operations-policy">
              Location freshness: {opsPolicy.staleLocationMinutes}m
            </Link>
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
              <p className="muted" style={{ marginTop: 8 }}>
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
      <section className="card" style={{ marginBottom: 16 }}>
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
        <div className="service-trace-summary" style={{ marginTop: 14 }}>
          {filterSummary.map((item) => (
            <div key={item.label}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <small className="muted">{item.detail}</small>
              {item.href ? (
                <Link className="text-link" href={item.href}>
                  Open subset
                </Link>
              ) : null}
            </div>
          ))}
        </div>
      </section>
      <div className="grid" style={{ marginBottom: 16 }}>
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
    </>
  );
}
