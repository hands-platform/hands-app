import Link from 'next/link';
import {
  AdminProvider,
  AdminOperationalPolicySetting,
  adminGet,
  providerDocumentLabel,
  providerDocumentReviewHint,
} from '../../lib/admin-api';
import { compactValue, formatDateTime, formatMoney as formatProviderMoney } from '../../lib/admin-format';
import { marketplaceDisplayText } from '../../lib/admin-copy';
import { buildCsvDataHref } from '../../lib/csv-export';
import { ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS } from '../../lib/operations-policy';
import {
  approveProvider,
  approveProviderBankAccount,
  approveProviderDocument,
  approveProviderKyc,
  approveProviderTaxProfile,
  approvePublicProviderMedia,
  blockProviderAccount,
  enablePushDevice,
  rejectProvider,
  rejectProviderBankAccount,
  rejectProviderDocument,
  rejectProviderKyc,
  rejectProviderTaxProfile,
  rejectPublicProviderMedia,
  syncSupabaseProviderRole,
  unblockProviderAccount,
} from './actions';
import {
  buildPartnerExportSlug,
  buildProviderActiveFilters,
  buildProviderFilters,
  emptyProviderMessage,
  partnerBookingFlowFilterLabel,
  partnerReviewFilterLabel,
  partnerSortLabel,
  providerSecurityLabel,
} from './partner-filters';
import {
  DEFAULT_PROVIDER_OPS_POLICY,
  buildProviderOpsPolicy,
  dateMs,
  formatBytes,
  formatDate,
  formatDistanceMeters,
  hasProviderCoordinate,
  providerLocationAgeLabel,
  providerLocationLabel,
  providerLocationPillClass,
  providerLocationStatus,
} from './partner-list-ops';
import type { ProviderLocationState, ProviderOpsPolicy } from './partner-list-ops';
import {
  hasApprovedBankAccount,
  hasHealthyPush,
  maskToken,
  providerPublicMedia,
  providerPublicMediaNeedsReview,
  publicMediaReviewPillClass,
  readFailureCode,
  readFailureStatus,
  readLastAttempt,
} from './partner-list-profile';
import {
  kycDocumentPillClass,
  missingApprovedRequiredKycDocuments,
  partnerKycState,
  providerKycDocumentStatus,
} from './partner-kyc-facts';
import {
  partnerHasFirstRevenueSignal as providerHasFirstRevenueSignal,
  partnerTaxNeedsReview as providerTaxNeedsReview,
  partnerTaxPillClass as providerTaxPillClass,
} from './partner-finance-readiness-facts';
import {
  partnerAvailablePayout as providerAvailablePayout,
  partnerBookingRows as providerBookingRows,
  partnerCompletedWorkCount as providerCompletedWorkCount,
  partnerGrossRevenue as providerGrossRevenue,
  partnerLastSessionAt,
  partnerPendingPayout as providerPendingPayout,
  partnerUnsettledWalletBalance as providerUnsettledWalletBalance,
} from './partner-activity-facts';
import { buildPartnerMarketplaceEligibility } from './partner-marketplace-eligibility';
import {
  partnerSecurityPillClass as providerSecurityPillClass,
  partnerSecurityStatus as providerSecurityStatus,
  sharedPartnerDeviceIds as sharedDeviceIds,
} from './partner-security-facts';
import {
  filterPartners as filterProviders,
  partnerHasOpenControl as hasOpenPartnerControl,
  sortPartners as sortProviders,
  type PartnerListQueryDeps,
} from './partner-list-query';
import {
  nextPartnerListAction as nextProviderListAction,
  partnerListActionPillClass as providerListActionPillClass,
} from './partner-list-actions';
import {
  buildPartnerFilterSummary,
  buildPartnerReviewQueue as buildProviderReviewQueue,
  buildPartnerSummary as buildProviderSummary,
} from './partner-list-summary';
import {
  buildPartnerCommandCenter as buildProviderCommandCenter,
  type PartnerCommandLane as ProviderCommandLane,
} from './partner-command-center';
import { buildPartnerAcceptanceBlockerBoard } from './partner-acceptance-blocker-board';
import {
  buildPartnerDailyActionQueue,
  partnerDetailActionHref,
} from './partner-daily-action-queue';
import { buildPartnerDispatchForecast } from './partner-dispatch-forecast';
import { buildPartnerDispatchHandoff } from './partner-dispatch-handoff';
import { buildPartnerKycReviewBoard } from './partner-kyc-review-board';
import {
  buildPartnerShiftHandoff,
  partnerShiftCardClass,
  partnerShiftPillClass,
} from './partner-shift-handoff';
import {
  buildPartnerOperationRow,
  partnerAcceptBlockerSummary,
  partnerOperationPillClass,
} from './partner-operation-row';

const CLOSED_BOOKING_STATUSES = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'];
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
  const filters = buildProviderFilters(searchParams ? await searchParams : {});
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
  const priorityLane = buildProviderPriorityLane(providers, opsPolicy);
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
  const partnerMasterRows = visibleProviders.map((provider) => buildPartnerMasterRow(provider, opsPolicy));
  const partnerExportRows = partnerMasterRows.map((master, index) => {
    const provider = master.provider;
    const operations =
      partnerOperationRows[index] ??
      buildPartnerOperationRow(provider, opsPolicy, {
        displayName: providerDisplayName,
        canAcceptBookingNow: partnerCanAcceptBookingNow,
      });
    return {
      export_filter: partnerExportFilterLabel,
      export_sort: partnerSortLabel(filters.sort),
      search_filter: filters.q ? 'Applied' : 'None',
      booking_flow_filter: filters.bookingFlow ? partnerBookingFlowFilterLabel(filters.bookingFlow) : 'All',
      review_filter: filters.review ? partnerReviewFilterLabel(filters.review) : 'All',
      readiness_filter: filters.readiness || 'All',
      partner_id: provider.id,
      display_name: master.displayName,
      legal_name: master.legalName,
      phone: master.phone,
      gender: master.gender,
      status: master.status,
      level: master.level,
      kyc_status: master.kycStatus,
      verification_status: provider.verification?.status ?? 'DRAFT',
      joined_at: master.joinedAt ?? '',
      recent_access_at: master.lastSeenAt ?? '',
      latest_session_device: master.latestSessionDevice,
      latest_session_platform: master.latestSessionPlatform,
      latest_session_ip: master.latestSessionIp,
      latest_session_app_version: master.latestSessionAppVersion,
      location_state: master.locationState,
      location_updated_at: provider.currentLocationUpdatedAt ?? '',
      booking_count: master.bookingCount,
      completed_work_count: master.completedCount,
      closed_booking_count: master.closedCount,
      customer_closed_count: master.customerClosedCount,
      admin_closed_count: master.adminClosedCount,
      partner_closed_count: master.partnerClosedCount,
      no_show_count: master.noShowCount,
      feedback_record_count: master.reviewCount,
      gross_revenue_vnd: master.grossRevenue,
      platform_fee_vnd: master.platformFee,
      pending_payout_vnd: master.pendingPayout,
      available_payout_vnd: master.availablePayout,
      wallet_balance_vnd: operations.walletBalance,
      can_accept_booking: operations.acceptanceLabel,
      acceptance_detail: operations.acceptanceDetail,
      can_view_marketplace_requests: operations.marketplaceCanView ? 'yes' : 'no',
      can_receive_marketplace_alerts: operations.marketplaceCanReceiveAlerts ? 'yes' : 'no',
      can_participate_marketplace: operations.marketplaceCanParticipate ? 'yes' : 'no',
      marketplace_partner_app_message: operations.marketplacePartnerAppMessage ?? '',
      next_operator_status: operations.nextAction.status,
      next_operator_action: operations.nextAction.operatorAction,
      admin_memo_count: master.auditLogCount,
      latest_memo: master.latestAuditTitle,
      latest_memo_detail: master.latestAuditDetail,
      account_state: master.accountBlocked ? 'Blocked' : 'Open',
      account_note: master.accountNote,
    };
  });
  const partnerListCsvHref = buildCsvDataHref(partnerExportRows, [
    'export_filter',
    'export_sort',
    'search_filter',
    'booking_flow_filter',
    'review_filter',
    'readiness_filter',
    'partner_id',
    'display_name',
    'legal_name',
    'phone',
    'gender',
    'status',
    'level',
    'kyc_status',
    'verification_status',
    'joined_at',
    'recent_access_at',
    'latest_session_device',
    'latest_session_platform',
    'latest_session_ip',
    'latest_session_app_version',
    'location_state',
    'location_updated_at',
    'booking_count',
    'completed_work_count',
    'closed_booking_count',
    'customer_closed_count',
    'admin_closed_count',
    'partner_closed_count',
    'no_show_count',
    'feedback_record_count',
    'gross_revenue_vnd',
    'platform_fee_vnd',
    'pending_payout_vnd',
    'available_payout_vnd',
    'wallet_balance_vnd',
    'can_accept_booking',
    'acceptance_detail',
    'can_view_marketplace_requests',
    'can_receive_marketplace_alerts',
    'can_participate_marketplace',
    'marketplace_partner_app_message',
    'next_operator_status',
    'next_operator_action',
    'admin_memo_count',
    'latest_memo',
    'latest_memo_detail',
    'account_state',
    'account_note',
  ]);

  return (
    <>
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
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Partner master list</h2>
            <p className="muted">
              Compact admin list for ID, profile, contact, onboarding level, app status, location freshness,
              booking volume, feedback records, revenue, payout readiness, and account state.
            </p>
          </div>
          <span className="pill pill-info">{partnerMasterRows.length} visible row(s)</span>
        </div>
        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table className="table service-trace">
            <thead>
              <tr>
                <th>Partner ID</th>
                <th>Profile</th>
                <th>Name / activity name</th>
                <th>Phone</th>
                <th>Gender</th>
                <th>Current state</th>
                <th>Level</th>
                <th>Joined / recent access</th>
                <th>Device / IP</th>
                <th>Location</th>
                <th>Bookings</th>
                <th>Feedback records</th>
                <th>Revenue</th>
                <th>Payout</th>
                <th>Ops trail</th>
                <th>Account</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {partnerMasterRows.map((row) => (
                <tr key={row.provider.id}>
                  <td>
                    <code>{row.provider.id}</code>
                  </td>
                  <td>
                    <div
                      className="media-thumb"
                      aria-label={`${row.displayName} profile thumbnail placeholder`}
                    >
                      {row.initials}
                    </div>
                  </td>
                  <td>
                    <strong>{row.displayName}</strong>
                    <p className="muted">{row.legalName}</p>
                  </td>
                  <td>{row.phone}</td>
                  <td>{row.gender}</td>
                  <td>
                    <span className={`pill ${row.online ? 'pill-success' : 'pill-neutral'}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <strong>{row.level}</strong>
                    <p className="muted">KYC {row.kycStatus}</p>
                  </td>
                  <td>
                    <strong>{row.joinedAt ? formatDate(row.joinedAt) : 'Not recorded'}</strong>
                    <p className="muted">
                      Recent access: {row.lastSeenAt ? formatDate(row.lastSeenAt) : 'No session'}
                    </p>
                  </td>
                  <td>
                    <strong>{row.latestSessionDevice}</strong>
                    <p className="muted">{row.latestSessionIp}</p>
                  </td>
                  <td>
                    <strong>{providerLocationLabel(row.locationState)}</strong>
                    <p className="muted">{providerLocationAgeLabel(row.provider.currentLocationUpdatedAt)}</p>
                  </td>
                  <td>
                    <strong>{row.bookingCount} total</strong>
                    <p className="muted">
                      {row.completedCount} completed / {row.closedCount} closed
                    </p>
                    <p className="muted">
                      Customer {row.customerClosedCount} / admin {row.adminClosedCount} / partner{' '}
                      {row.partnerClosedCount}
                    </p>
                    <p className="muted">{row.noShowCount} no-show</p>
                  </td>
                  <td>
                    <strong>{row.reviewCount} feedback record(s)</strong>
                    <p className="muted">Open detail to read factual feedback records</p>
                  </td>
                  <td>
                    <strong>{formatProviderMoney(row.grossRevenue)}</strong>
                    <p className="muted">Platform fee {formatProviderMoney(row.platformFee)}</p>
                  </td>
                  <td>
                    <strong>{formatProviderMoney(row.pendingPayout)}</strong>
                    <p className="muted">Available {formatProviderMoney(row.availablePayout)}</p>
                  </td>
                  <td>
                    <strong>{row.auditLogCount} memo/event(s)</strong>
                    <p className="muted">{row.latestAuditTitle}</p>
                    <p className="muted">{row.latestAuditDetail}</p>
                  </td>
                  <td>
                    <span className={`pill ${row.accountBlocked ? 'pill-danger' : 'pill-success'}`}>
                      {row.accountBlocked ? 'Blocked' : 'Open'}
                    </span>
                    <p className="muted">{row.accountNote}</p>
                  </td>
                  <td>
                    <Link className="text-link" href={`/partners/${row.provider.id}`}>
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
              {partnerMasterRows.length === 0 ? (
                <tr>
                  <td colSpan={17}>
                    <strong>No partner rows found</strong>
                    <p className="muted">Change the filters or clear search to view partner records.</p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Partner operations list</h2>
            <p className="muted">
              List-first partner control view. Operators can check onboarding, direct and marketplace
              readiness, completed work, last work, wallet, location, push, services, and app activity before
              opening the full partner record.
            </p>
          </div>
          <div className="participant-list">
            <span className="pill pill-info">{providers.length} partner(s)</span>
            <span className="pill pill-success">
              {providers.filter((provider) => partnerCanAcceptBookingNow(provider, opsPolicy)).length} can
              receive direct requests
            </span>
            <span className="pill pill-warn">
              {providers.filter((provider) => providerUnsettledWalletBalance(provider) < 0).length} wallet
              marketplace hold
            </span>
          </div>
        </div>
        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table className="table service-trace">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Basic checklist</th>
                <th>Direct request gate</th>
                <th>Matching flow</th>
                <th>Marketplace access</th>
                <th>Work history</th>
                <th>Money</th>
                <th>App/location</th>
                <th>Next operator check</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {partnerOperationRows.map((row) => (
                <tr key={row.provider.id}>
                  <td>
                    <strong>{row.name}</strong>
                    <p className="muted">{row.phone}</p>
                    <div className="participant-list" style={{ marginTop: 6 }}>
                      <span className="pill pill-info">{row.provider.level ?? 'LEVEL_1_SIGNUP'}</span>
                      <span className={`pill ${row.provider.blockedAt ? 'pill-danger' : 'pill-success'}`}>
                        {row.provider.blockedAt ? 'Account blocked' : 'Account open'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="participant-list">
                      {row.checklist.map((item) => (
                        <span className={`pill ${partnerOperationPillClass(item.tone)}`} key={item.label}>
                          {item.label}: {item.status}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`signal ${providerCommandToneClass(row.acceptanceTone)}`}>
                      {row.acceptanceLabel}
                    </span>
                    <p className="muted" style={{ marginTop: 8 }}>
                      {row.acceptanceDetail}
                    </p>
                  </td>
                  <td>
                    <div className="participant-list">
                      {row.matchingFlow.map((item) => (
                        <span className={`pill ${partnerOperationPillClass(item.tone)}`} key={item.label}>
                          {item.label}: {item.status}
                        </span>
                      ))}
                    </div>
                    <p className="muted" style={{ marginTop: 8 }}>
                      {row.matchingFlowDetail}
                    </p>
                  </td>
                  <td>
                    <span className={`signal ${providerCommandToneClass(row.marketplaceAccessTone)}`}>
                      {row.marketplaceAccessLabel}
                    </span>
                    <p className="muted" style={{ marginTop: 8 }}>
                      {row.marketplaceAccessDetail}
                    </p>
                    {row.marketplacePartnerAppMessage ? (
                      <p className="muted" style={{ marginTop: 8 }}>
                        Partner app message: {row.marketplacePartnerAppMessage}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <strong>{row.completedWorkCount} completed</strong>
                    <p className="muted">Last work: {row.lastWorkAt ? formatDate(row.lastWorkAt) : 'none'}</p>
                    <p className="muted">
                      First revenue: {providerHasFirstRevenueSignal(row.provider) ? 'yes' : 'no'}
                    </p>
                  </td>
                  <td>
                    <strong>{formatProviderMoney(row.walletBalance)}</strong>
                    <p className="muted">
                      {row.walletBalance < 0
                        ? 'Company fee settlement is required before marketplace alerts and participation.'
                        : 'No negative wallet balance.'}
                    </p>
                    <p className="muted">
                      Tax:{' '}
                      {row.provider.taxProfile?.status ??
                        (providerHasFirstRevenueSignal(row.provider) ? 'MISSING' : 'deferred')}
                    </p>
                  </td>
                  <td>
                    <strong>{providerLocationLabel(row.locationState)}</strong>
                    <p className="muted">{providerLocationAgeLabel(row.provider.currentLocationUpdatedAt)}</p>
                    <p className="muted">
                      Last app activity:{' '}
                      {row.lastActivityAt ? formatDate(row.lastActivityAt) : 'not recorded'}
                    </p>
                  </td>
                  <td>
                    <strong>{row.nextAction.status}</strong>
                    <p className="muted">{row.nextAction.detail}</p>
                    <p className="muted">{row.nextAction.operatorAction}</p>
                  </td>
                  <td>
                    <Link className="text-link" href={`/partners/${row.provider.id}`}>
                      Open all records
                    </Link>
                  </td>
                </tr>
              ))}
              {partnerOperationRows.length === 0 ? (
                <tr>
                  <td colSpan={10}>
                    <strong>No partners found</strong>
                    <p className="muted">Change the filters or clear search to view partner records.</p>
                  </td>
                </tr>
              ) : null}
              {hiddenProviderCount > 0 ? (
                <tr>
                  <td colSpan={10}>
                    <p className="muted">
                      {hiddenProviderCount} more partner row(s) are hidden for page speed. Use search or
                      filters to narrow this list.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Partner checklist work queue</h2>
            <p className="muted">
              Compact follow-up list for the current partner filter. It groups acceptance holds, payout/tax
              gates, location freshness, push readiness, and KYC updates so operators can process records
              without opening every detail page.
            </p>
          </div>
          <div className="participant-list">
            <span className={`pill ${dailyActionQueue.urgentCount ? 'pill-danger' : 'pill-success'}`}>
              {dailyActionQueue.urgentCount} urgent
            </span>
            <span className={`pill ${dailyActionQueue.blockedCount ? 'pill-warn' : 'pill-success'}`}>
              {dailyActionQueue.blockedCount} blocked
            </span>
            <span className="pill pill-info">{dailyActionQueue.dispatchReadyCount} dispatch-ready</span>
          </div>
        </div>
        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table className="table service-trace">
            <thead>
              <tr>
                <th>Order</th>
                <th>Partner</th>
                <th>Work lane</th>
                <th>Current blocker</th>
                <th>Operator move</th>
                <th>SLA</th>
                <th>Record age</th>
                <th>Open</th>
              </tr>
            </thead>
            <tbody>
              {dailyActionQueue.rows.map((row, index) => (
                <tr key={`${row.provider.id}-${row.action.status}`}>
                  <td>
                    <span className={`pill ${partnerShiftPillClass(row.tone)}`}>#{index + 1}</span>
                  </td>
                  <td>
                    <strong>{providerDisplayName(row.provider)}</strong>
                    <p className="muted">{row.provider.user?.phone ?? row.provider.id}</p>
                  </td>
                  <td>{row.lane}</td>
                  <td>
                    <strong>{row.action.status}</strong>
                    <p className="muted">{row.action.detail}</p>
                  </td>
                  <td>{row.action.operatorAction}</td>
                  <td>{row.sla}</td>
                  <td>{row.age}</td>
                  <td>
                    <Link className="text-link" href={row.href}>
                      Open partner
                    </Link>
                  </td>
                </tr>
              ))}
              {dailyActionQueue.rows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <strong>No partner work queue items</strong>
                    <p className="muted">
                      The current filter has no visible blockers. Keep monitoring dispatch demand and live
                      booking pressure.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Dispatch handoff links</h2>
            <p className="muted">{dispatchHandoff.headline}</p>
            <p className="muted">{dispatchHandoff.detail}</p>
          </div>
          <Link className="text-link" href="/operations-policy">
            {dispatchHandoff.policyLabel}
          </Link>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 14 }}>
          {dispatchHandoff.links.map((item) => (
            <Link
              className={`ops-task-breakdown-item ops-task-breakdown-${providerDashboardTone(item.tone)}`}
              href={item.href}
              key={item.title}
            >
              <span>{item.title}</span>
              <strong>{item.value}</strong>
              <small>{item.detail}</small>
            </Link>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Partner shift handoff</h2>
            <p className="muted">
              The first operator read for this partner queue. It turns KYC, wallet debt, dispatch readiness,
              location freshness, push readiness, and payout setup into a practical work order.
            </p>
          </div>
          <span className={`signal ${providerCommandToneClass(shiftHandoff.tone)}`}>
            {shiftHandoff.label}
          </span>
        </div>
        <div className="ops-task-note" style={{ marginTop: 14 }}>
          <div className="ops-row">
            <div>
              <span className="pill pill-info">Next best partner move</span>
              <strong>{shiftHandoff.headline}</strong>
              <p className="muted">{shiftHandoff.detail}</p>
            </div>
            <Link className="text-link" href={shiftHandoff.primaryAction.href}>
              {shiftHandoff.primaryAction.label}
            </Link>
          </div>
        </div>
        <div className="service-trace-summary" style={{ marginTop: 14 }}>
          {shiftHandoff.stats.map((stat) => (
            <Link
              className={`ops-task-breakdown-item ops-task-breakdown-${providerDashboardTone(stat.tone)}`}
              href={stat.href}
              key={stat.label}
            >
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
              <small>{stat.detail}</small>
            </Link>
          ))}
        </div>
        <div className="ops-task-grid" style={{ marginTop: 14 }}>
          {shiftHandoff.actions.map((item) => (
            <Link
              className={`ops-task-card ${partnerShiftCardClass(item.tone)}`}
              href={item.href}
              key={item.title}
            >
              <span className={`pill ${partnerShiftPillClass(item.tone)}`}>{item.scope}</span>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <small>{item.operatorAction}</small>
              <div className="participant-list" style={{ marginTop: 10 }}>
                {item.samples.length ? (
                  item.samples.map((sample) => (
                    <span className="pill" key={`${item.title}-${sample}`}>
                      {sample}
                    </span>
                  ))
                ) : (
                  <span className="pill pill-success">No immediate partner sample</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Partner command center</h2>
            <p className="muted">
              Operator overview across onboarding, dispatch readiness, payout/tax readiness, and report
              follow-up.
            </p>
          </div>
          <span className="pill pill-info">Daily control view</span>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          {commandCenter.map((lane) => (
            <Link className="card" href={lane.href} key={lane.title}>
              <p>{lane.title}</p>
              <h2>{lane.status}</h2>
              <span className={`signal ${providerCommandToneClass(lane.tone)}`}>
                {providerCommandToneLabel(lane.tone)}
              </span>
              <p className="muted" style={{ marginTop: 8 }}>
                {lane.detail}
              </p>
              <div className="participant-list" style={{ marginTop: 10 }}>
                {lane.metrics.map((item) => (
                  <span className="pill" key={item.label}>
                    {item.label}: {item.value}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Partner marketplace hold board</h2>
            <p className="muted">
              Shows why partners cannot join marketplace bookings before operators rely on them for
              booking recovery. Viewing marketplace requests is not treated as a partner action.
            </p>
          </div>
          <div className="participant-list">
            <span
              className={`pill ${acceptanceBlockerBoard.hardBlocked > 0 ? 'pill-danger' : 'pill-success'}`}
            >
              {acceptanceBlockerBoard.hardBlocked} direct request held
            </span>
            <span className="pill pill-info">{acceptanceBlockerBoard.eligibleNow} direct-ready</span>
            <span
              className={`pill ${
                acceptanceBlockerBoard.marketplaceBlocked > 0 ? 'pill-warn' : 'pill-success'
              }`}
            >
              {acceptanceBlockerBoard.marketplaceBlocked} marketplace held
            </span>
          </div>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          {acceptanceBlockerBoard.cards.map((card) => (
            <Link className="card" href={card.href} key={card.title}>
              <p>{card.title}</p>
              <h2>{card.count}</h2>
              <span className={`signal ${providerCommandToneClass(card.tone)}`}>{card.status}</span>
              <p className="muted" style={{ marginTop: 8 }}>
                {card.detail}
              </p>
              <p className="muted" style={{ marginTop: 8 }}>
                {card.operatorAction}
              </p>
              <div className="participant-list" style={{ marginTop: 10 }}>
                {card.samples.length > 0 ? (
                  card.samples.map((sample) => (
                    <span className="pill" key={sample}>
                      {sample}
                    </span>
                  ))
                ) : (
                  <span className="pill pill-success">No immediate queue</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>KYC review board</h2>
            <p className="muted">
              Tracks identity records, CCCD front/back, and selfie evidence before a partner can become
              dispatch-ready.
            </p>
          </div>
          <div className="participant-list">
            <span className={`pill ${kycReviewBoard.openCount > 0 ? 'pill-warn' : 'pill-success'}`}>
              {kycReviewBoard.openCount} KYC item(s)
            </span>
            <span className="pill pill-success">{kycReviewBoard.readyToApprove} ready to approve</span>
            <span className="pill pill-danger">{kycReviewBoard.blockedByDocuments} blocked by docs</span>
          </div>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          {kycReviewBoard.cards.map((card) => (
            <Link className="card" href={card.href} key={card.title}>
              <p>{card.title}</p>
              <h2>{card.count}</h2>
              <span className={`signal ${providerCommandToneClass(card.tone)}`}>{card.status}</span>
              <p className="muted" style={{ marginTop: 8 }}>
                {card.detail}
              </p>
              <p className="muted" style={{ marginTop: 8 }}>
                {card.operatorAction}
              </p>
              <div className="participant-list" style={{ marginTop: 10 }}>
                {card.samples.length > 0 ? (
                  card.samples.map((sample) => (
                    <span className="pill" key={sample}>
                      {sample}
                    </span>
                  ))
                ) : (
                  <span className="pill pill-success">No immediate queue</span>
                )}
              </div>
            </Link>
          ))}
        </div>
        <div className="setup-stage-list" style={{ marginTop: 14 }}>
          {kycReviewBoard.playbook.map((step) => (
            <div className="setup-stage-item" key={step.title}>
              <span>{step.status}</span>
              <div>
                <strong>{step.title}</strong>
                <p className="muted">{step.detail}</p>
                <p className="muted">{step.operatorAction}</p>
              </div>
              <Link className="text-link" href={step.href}>
                {step.count}
              </Link>
            </div>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Dispatch capacity forecast</h2>
            <p className="muted">
              Converts the filtered partner list into dispatch capacity, recovery work, and city-level supply
              records for direct requests and marketplace matching.
            </p>
          </div>
          <Link className="text-link" href="/operations-policy">
            Policy: fresh location {'<='} {opsPolicy.staleLocationMinutes}m
          </Link>
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          {dispatchForecast.totals.map((item) => (
            <Link className="card" href={item.href} key={item.label}>
              <p>{item.label}</p>
              <h2>{item.value}</h2>
              <span className={`signal ${providerCommandToneClass(item.tone)}`}>
                {providerCommandToneLabel(item.tone)}
              </span>
              <p className="muted" style={{ marginTop: 8 }}>
                {item.detail}
              </p>
            </Link>
          ))}
        </div>
        <div className="grid" style={{ marginTop: 12 }}>
          <div className="card">
            <h3>Dispatch blockers</h3>
            <div className="setup-stage-list" style={{ marginTop: 12 }}>
              {dispatchForecast.blockers.map((item) => (
                <div className="setup-stage-item" key={item.label}>
                  <span>{item.count ? 'FIX' : 'OK'}</span>
                  <div>
                    <strong>{item.label}</strong>
                    <p className="muted">{item.detail}</p>
                  </div>
                  <Link className="text-link" href={item.href}>
                    {item.count}
                  </Link>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <h3>City supply lanes</h3>
            <p className="muted">
              Use this to see which partner onboarding, location refresh, or push registration records need
              operator attention.
            </p>
            <div className="setup-stage-list" style={{ marginTop: 12 }}>
              {dispatchForecast.supplyLanes.map((lane) => (
                <div className="setup-stage-item" key={lane.city}>
                  <span>{lane.ready ? 'LIVE' : 'CHECK'}</span>
                  <div>
                    <strong>{lane.city}</strong>
                    <p className="muted">
                      {lane.ready}/{lane.total} ready, {lane.online} online, {lane.locationNeedsRefresh} need
                      location refresh, {lane.blocked} blocked.
                    </p>
                  </div>
                  <Link className="text-link" href={`/partners?q=${encodeURIComponent(lane.city)}`}>
                    Open
                  </Link>
                </div>
              ))}
              {dispatchForecast.supplyLanes.length === 0 ? (
                <div className="setup-stage-item">
                  <span>EMPTY</span>
                  <div>
                    <strong>No city data yet</strong>
                    <p className="muted">Partner city data will appear here once profiles are filled.</p>
                  </div>
                  <small>0</small>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Review queue</h2>
            <p className="muted">
              Grouped partner records for KYC, documents, payout readiness, device alerts, and dispatch
              location freshness.
            </p>
          </div>
          <span className={`pill ${reviewQueue.totalOpen === 0 ? 'pill-success' : 'pill-warn'}`}>
            {reviewQueue.totalOpen} open item(s)
          </span>
        </div>
        <div className="setup-stage-list">
          {reviewQueue.items.map((item) => (
            <div className="setup-stage-item" key={item.label}>
              <span>{item.count ? 'CHECK' : 'OK'}</span>
              <div>
                <strong>{item.label}</strong>
                <p className="muted">{item.detail}</p>
              </div>
              {item.href ? (
                <Link className="text-link" href={item.href}>
                  {item.count}
                </Link>
              ) : (
                <small>{item.count}</small>
              )}
            </div>
          ))}
        </div>
      </section>
      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Partner checklist lane</h2>
            <p className="muted">
              Suggested operator order for fixing factual blockers from profile, KYC, document, bank, tax,
              wallet, location, and push readiness.
            </p>
          </div>
          <span className={`pill ${priorityLane.blockedCount === 0 ? 'pill-success' : 'pill-danger'}`}>
            {priorityLane.blockedCount} blocked
          </span>
        </div>
        <div className="setup-stage-list">
          {priorityLane.items.map((item) => (
            <div className="setup-stage-item" key={item.provider.id}>
              <span>{item.action.status}</span>
              <div>
                <strong>
                  <Link className="text-link" href={partnerDetailActionHref(item.provider, item.action)}>
                    {providerDisplayName(item.provider)}
                  </Link>
                </strong>
                <p className="muted">{item.action.detail}</p>
                <p className="muted">{item.action.operatorAction}</p>
              </div>
              <small>
                {item.action.tone === 'done' ? 'OK' : item.action.tone === 'blocked' ? 'Fix' : 'Check'}
              </small>
            </div>
          ))}
          {priorityLane.items.length === 0 ? (
            <div className="setup-stage-item">
              <span>OK</span>
              <div>
                <strong>No partners need immediate attention</strong>
                <p className="muted">The current filtered list has no blocking partner operation items.</p>
              </div>
              <small>Clear</small>
            </div>
          ) : null}
        </div>
      </section>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Status</th>
              <th>Onboarding</th>
              <th>Ops readiness</th>
              <th>Location</th>
              <th>Device/session</th>
              <th>Push Devices</th>
              <th>Files</th>
              <th>Services</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleProviders.map((provider) => (
              <tr id={`provider-${provider.id}`} key={provider.id}>
                <td>
                  <Link className="text-link" href={`/partners/${provider.id}`}>
                    {providerDisplayName(provider)}
                  </Link>
                  <p className="muted">{provider.user?.phone ?? provider.id}</p>
                </td>
                <td>
                  {provider.verification?.status ?? 'DRAFT'}
                  {provider.verification?.rejectionReason ? (
                    <p className="muted">{provider.verification.rejectionReason}</p>
                  ) : null}
                  <p className="muted" style={{ marginTop: 4 }}>
                    Queue status: {provider.status}
                  </p>
                  {provider.blockedAt ? (
                    <p className="muted" style={{ marginTop: 4 }}>
                      Account blocked: {provider.blockedReason ?? 'No reason saved'}
                    </p>
                  ) : null}
                </td>
                <td>
                  <ProviderOnboardingCell provider={provider} />
                </td>
                <td>
                  <ProviderNextActionCell provider={provider} opsPolicy={opsPolicy} />
                  <PartnerOpsBadgeList provider={provider} opsPolicy={opsPolicy} />
                  <ProviderIssuePills provider={provider} opsPolicy={opsPolicy} />
                  <p className="muted">{providerActionHint(provider, opsPolicy)}</p>
                  <PartnerBackupEligibilityCell provider={provider} opsPolicy={opsPolicy} />
                  {hasOpenPartnerControl(provider) ? (
                    <Link
                      className="text-link"
                      href={`/partner-controls?q=${encodeURIComponent(provider.id)}`}
                    >
                      Open reports
                    </Link>
                  ) : null}
                </td>
                <td>
                  <ProviderLocationCell provider={provider} opsPolicy={opsPolicy} />
                </td>
                <td>
                  <ProviderSecurityCell provider={provider} />
                </td>
                <td>
                  {provider.user?.pushDevices?.length
                    ? provider.user.pushDevices.map((device) => (
                        <div key={device.id} style={{ marginBottom: 8 }}>
                          <p className="muted" style={{ marginBottom: 4 }}>
                            {device.platform} / {device.enabled ? 'enabled' : 'disabled'} / Token hidden
                          </p>
                          {!device.enabled ? (
                            <p className="muted" style={{ marginBottom: 4 }}>
                              Last failure: {readFailureCode(device) ?? 'Unknown'} /{' '}
                              {readFailureStatus(device) ?? 'FAILED'}
                            </p>
                          ) : null}
                          {readLastAttempt(device) ? (
                            <p className="muted" style={{ marginBottom: 4 }}>
                              Last attempt: {formatDateTime(readLastAttempt(device))}
                            </p>
                          ) : null}
                          {!device.enabled ? (
                            <form action={enablePushDevice}>
                              <input type="hidden" name="pushDeviceId" value={device.id} />
                              <button type="submit">Re-enable</button>
                            </form>
                          ) : null}
                        </div>
                      ))
                    : 'None'}
                </td>
                <td>
                  {provider.verification?.files?.length ? (
                    provider.verification.files.map((file) => (
                      <div key={file.id} className="provider-file-row">
                        <div className="participant-list" style={{ marginBottom: 6 }}>
                          <span className="pill pill-info">{file.purpose ?? 'Partner verification'}</span>
                          <span
                            className={`pill ${
                              file.uploadStatus === 'UPLOADED' ? 'pill-success' : 'pill-warn'
                            }`}
                          >
                            {file.uploadStatus ?? 'PENDING'}
                          </span>
                        </div>
                        <p className="muted">
                          {file.contentType}
                          {file.sizeBytes ? ` / ${formatBytes(file.sizeBytes)}` : ''}
                          {file.uploadedAt ? ` / uploaded ${formatDateTime(file.uploadedAt)}` : ''}
                        </p>
                        <p className="muted">
                          {file.key}
                          {' / '}
                          <Link className="text-link" href={`/partners/${provider.id}#documents`}>
                            open detail to view
                          </Link>
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="muted">No private verification files.</p>
                  )}
                  <ProviderPublicMediaQueueCell provider={provider} />
                </td>
                <td>
                  {provider.services
                    ?.map((item) => item.service?.name)
                    .filter(Boolean)
                    .join(', ') || 'None'}
                </td>
                <td>
                  <div className="actions">
                    <form action={approveProvider}>
                      <input type="hidden" name="providerId" value={provider.id} />
                      <button type="submit">Approve</button>
                    </form>
                    <form action={rejectProvider}>
                      <input type="hidden" name="providerId" value={provider.id} />
                      <input
                        name="reason"
                        placeholder="Partner rejection reason"
                        required
                        minLength={12}
                        maxLength={500}
                      />
                      <button type="submit">Reject</button>
                    </form>
                    <form action={syncSupabaseProviderRole}>
                      <input type="hidden" name="providerId" value={provider.id} />
                      <button type="submit" disabled={provider.verification?.status !== 'APPROVED'}>
                        Sync Supabase role
                      </button>
                    </form>
                    {provider.blockedAt ? (
                      <form action={unblockProviderAccount}>
                        <input type="hidden" name="providerId" value={provider.id} />
                        <button type="submit">Unblock account</button>
                      </form>
                    ) : (
                      <form action={blockProviderAccount}>
                        <input type="hidden" name="providerId" value={provider.id} />
                        <input
                          name="reason"
                          placeholder="Account block reason"
                          required
                          minLength={12}
                          maxLength={500}
                        />
                        <button type="submit">Block account</button>
                      </form>
                    )}
                    <Link className="text-link" href={`/partners/${provider.id}`}>
                      Open detail
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {hiddenProviderCount > 0 ? (
              <tr>
                <td colSpan={10}>
                  <p className="muted">
                    {hiddenProviderCount} more partner row(s) are hidden for page speed. Use filters or search
                    to narrow the queue.
                  </p>
                </td>
              </tr>
            ) : null}
            {providers.length === 0 && (
              <tr>
                <td colSpan={10}>{emptyProviderMessage(activeFilters)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function ProviderOnboardingCell({ provider }: { provider: AdminProvider }) {
  const primaryBank = provider.bankAccounts?.[0];
  const missingAgreements = 5 - (provider.agreements?.length ?? 0);
  const documents = provider.documents ?? [];
  const canApproveKyc = hasApprovedRequiredKycDocuments(provider);
  const kycState = partnerKycState(provider);
  const taxNeedsReview = providerTaxNeedsReview(provider);
  const taxStatus = provider.taxProfile?.status ?? (taxNeedsReview ? 'MISSING' : 'DEFERRED');

  return (
    <div>
      <div className="participant-list" style={{ marginBottom: 8 }}>
        <span className="pill pill-info">{provider.level ?? 'LEVEL_1_SIGNUP'}</span>
        <span className={`pill ${provider.kyc?.status === 'APPROVED' ? 'pill-success' : 'pill-warn'}`}>
          KYC {provider.kyc?.status ?? 'DRAFT'}
        </span>
        <span className={`pill ${primaryBank?.status === 'APPROVED' ? 'pill-success' : 'pill-neutral'}`}>
          Bank {primaryBank?.status ?? 'MISSING'}
        </span>
        <span className={`pill ${providerTaxPillClass(provider)}`}>Tax {taxStatus}</span>
      </div>
      <p className="muted" style={{ marginBottom: 8 }}>
        {provider.legalName ? `Legal: ${marketplaceDisplayText(provider.legalName)}` : 'Legal name not saved'}
        {provider.kyc?.cccdNumberLast4 ? ` / CCCD ****${provider.kyc.cccdNumberLast4}` : ''}
      </p>
      <div className="participant-list" style={{ marginBottom: 8 }}>
        {ADMIN_PARTNER_REQUIRED_KYC_DOCUMENTS.map((documentType) => {
          const documentStatus = providerKycDocumentStatus(provider, documentType);
          return (
            <span className={`pill ${kycDocumentPillClass(documentStatus)}`} key={documentType}>
              {providerDocumentLabel(documentType)} {documentStatus}
            </span>
          );
        })}
      </div>
      <p className="muted" style={{ marginBottom: 8 }}>
        {kycState.operatorAction}
      </p>
      <p className="muted" style={{ marginBottom: 8 }}>
        Agreements: {provider.agreements?.length ?? 0}/5
        {missingAgreements > 0 ? ` (${missingAgreements} missing)` : ''}
      </p>
      {primaryBank ? (
        <p className="muted" style={{ marginBottom: 8 }}>
          {marketplaceDisplayText(primaryBank.bankName)} / {primaryBank.accountNumberMasked ?? 'no account'} /{' '}
          {marketplaceDisplayText(primaryBank.accountHolderName)}
        </p>
      ) : null}
      {provider.taxProfile ? (
        <p className="muted" style={{ marginBottom: 8 }}>
          Tax code ****{provider.taxProfile.taxCodeLast4 ?? '----'} / {provider.taxProfile.registeredAddress}
        </p>
      ) : null}
      {documents.length ? (
        <div style={{ marginBottom: 10 }}>
          <p className="muted" style={{ marginBottom: 6 }}>
            Typed documents
          </p>
          {documents.map((document) => (
            <div key={document.id} className="provider-file-row">
              <div className="participant-list" style={{ marginBottom: 6 }}>
                <span className="pill pill-info">{providerDocumentLabel(document.type)}</span>
                <span className={`pill ${document.status === 'APPROVED' ? 'pill-success' : 'pill-warn'}`}>
                  {document.status}
                </span>
              </div>
              <p className="muted" style={{ marginBottom: 6 }}>
                {providerDocumentReviewHint(document.type)}
              </p>
              <p className="muted" style={{ marginBottom: 6 }}>
                {document.fileAsset?.contentType ?? 'unknown file'}
                {document.fileAsset?.sizeBytes ? ` / ${formatBytes(document.fileAsset.sizeBytes)}` : ''}
                {document.fileAsset?.uploadedAt
                  ? ` / uploaded ${formatDateTime(document.fileAsset.uploadedAt)}`
                  : ''}
              </p>
              <p className="muted" style={{ marginBottom: 6 }}>
                {marketplaceDisplayText(document.fileAsset?.key ?? 'No file key')}
                {document.fileAsset?.id ? (
                  <>
                    {' / '}
                    <Link className="text-link" href={`/partners/${provider.id}#documents`}>
                      open detail to view
                    </Link>
                  </>
                ) : null}
              </p>
              <div className="actions">
                <form action={approveProviderDocument}>
                  <input type="hidden" name="providerId" value={provider.id} />
                  <input type="hidden" name="documentId" value={document.id} />
                  <button type="submit" disabled={document.status === 'APPROVED'}>
                    Approve doc
                  </button>
                </form>
                <form action={rejectProviderDocument}>
                  <input type="hidden" name="providerId" value={provider.id} />
                  <input type="hidden" name="documentId" value={document.id} />
                  <input
                    name="reason"
                    placeholder="Document rejection reason"
                    required
                    minLength={12}
                    maxLength={500}
                  />
                  <button type="submit" disabled={document.status === 'REJECTED'}>
                    Reject doc
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ marginBottom: 8 }}>
          No typed partner documents yet.
        </p>
      )}
      <div className="actions">
        <form action={approveProviderKyc}>
          <input type="hidden" name="providerId" value={provider.id} />
          <button type="submit" disabled={provider.kyc?.status === 'APPROVED' || !canApproveKyc}>
            Approve KYC
          </button>
        </form>
        <form action={rejectProviderKyc}>
          <input type="hidden" name="providerId" value={provider.id} />
          <input name="reason" placeholder="KYC rejection reason" required minLength={12} maxLength={500} />
          <button type="submit" disabled={!provider.kyc || provider.kyc.status === 'REJECTED'}>
            Reject KYC
          </button>
        </form>
        {primaryBank ? (
          <>
            <form action={approveProviderBankAccount}>
              <input type="hidden" name="providerId" value={provider.id} />
              <input type="hidden" name="bankAccountId" value={primaryBank.id} />
              <button type="submit" disabled={primaryBank.status === 'APPROVED'}>
                Approve bank
              </button>
            </form>
            <form action={rejectProviderBankAccount}>
              <input type="hidden" name="providerId" value={provider.id} />
              <input type="hidden" name="bankAccountId" value={primaryBank.id} />
              <input
                name="reason"
                placeholder="Bank rejection reason"
                required
                minLength={12}
                maxLength={500}
              />
              <button type="submit" disabled={primaryBank.status === 'REJECTED'}>
                Reject bank
              </button>
            </form>
          </>
        ) : null}
        {provider.taxProfile ? (
          <>
            <form action={approveProviderTaxProfile}>
              <input type="hidden" name="providerId" value={provider.id} />
              <button type="submit" disabled={provider.taxProfile.status === 'APPROVED'}>
                Approve tax
              </button>
            </form>
            <form action={rejectProviderTaxProfile}>
              <input type="hidden" name="providerId" value={provider.id} />
              <input
                name="reason"
                placeholder="Tax rejection reason"
                required
                minLength={12}
                maxLength={500}
              />
              <button type="submit" disabled={provider.taxProfile.status === 'REJECTED'}>
                Reject tax
              </button>
            </form>
          </>
        ) : null}
      </div>
      {!canApproveKyc ? (
        <p className="muted" style={{ marginTop: 8 }}>
          KYC approval unlocks after CCCD front, CCCD back, and selfie documents are approved.
        </p>
      ) : null}
    </div>
  );
}

function ProviderPublicMediaQueueCell({ provider }: { provider: AdminProvider }) {
  const media = providerPublicMedia(provider);
  if (!media.length) {
    return (
      <p className="muted" style={{ marginTop: 8 }}>
        No public profile media uploaded.
      </p>
    );
  }

  return (
    <div style={{ marginTop: 10 }}>
      <p className="muted" style={{ marginBottom: 6 }}>
        Public media review
      </p>
      {media.slice(0, 4).map((file) => (
        <div key={file.id} className="provider-file-row">
          <div className="participant-list" style={{ marginBottom: 6 }}>
            <span className="pill pill-info">{file.purpose}</span>
            <span className={`pill ${publicMediaReviewPillClass(file.reviewStatus)}`}>
              {file.reviewStatus ?? 'PENDING_REVIEW'}
            </span>
          </div>
          <p className="muted" style={{ marginBottom: 6 }}>
            {file.contentType}
            {file.sizeBytes ? ` / ${formatBytes(file.sizeBytes)}` : ''}
            {file.uploadedAt ? ` / uploaded ${formatDateTime(file.uploadedAt)}` : ''}
          </p>
          <p className="muted" style={{ marginBottom: 6 }}>
            {file.url ? (
              <a href={file.url} target="_blank" rel="noreferrer">
                {file.key}
              </a>
            ) : (
              file.key
            )}
          </p>
          {file.reviewReason ? (
            <p className="muted" style={{ marginBottom: 6 }}>
              Reason: {file.reviewReason}
            </p>
          ) : null}
          <div className="actions">
            <form action={approvePublicProviderMedia}>
              <input type="hidden" name="providerId" value={provider.id} />
              <input type="hidden" name="fileId" value={file.id} />
              <button type="submit" disabled={file.reviewStatus === 'APPROVED'}>
                Approve media
              </button>
            </form>
            <form action={rejectPublicProviderMedia}>
              <input type="hidden" name="providerId" value={provider.id} />
              <input type="hidden" name="fileId" value={file.id} />
              <input
                name="reason"
                placeholder="Media rejection reason"
                required
                minLength={12}
                maxLength={500}
              />
              <button type="submit" disabled={file.reviewStatus === 'REJECTED'}>
                Reject media
              </button>
            </form>
          </div>
        </div>
      ))}
      {media.length > 4 ? (
        <Link className="text-link" href={`/partners/${provider.id}#media`}>
          Review {media.length - 4} more media item(s)
        </Link>
      ) : null}
    </div>
  );
}

type PartnerOpsBadge = {
  label: string;
  detail: string;
  tone: 'success' | 'danger' | 'warn' | 'info' | 'neutral';
};
type PartnerMasterRow = {
  provider: AdminProvider;
  initials: string;
  displayName: string;
  legalName: string;
  phone: string;
  gender: string;
  status: string;
  online: boolean;
  level: string;
  kycStatus: string;
  joinedAt: string | null;
  lastSeenAt: string | null;
  latestSessionDevice: string;
  latestSessionPlatform: string;
  latestSessionIp: string;
  latestSessionAppVersion: string;
  locationState: ProviderLocationState;
  bookingCount: number;
  completedCount: number;
  closedCount: number;
  customerClosedCount: number;
  adminClosedCount: number;
  partnerClosedCount: number;
  noShowCount: number;
  reviewCount: number;
  grossRevenue: number;
  platformFee: number;
  pendingPayout: number;
  availablePayout: number;
  auditLogCount: number;
  latestAuditTitle: string;
  latestAuditDetail: string;
  accountBlocked: boolean;
  accountNote: string;
};

function ProviderNextActionCell({
  provider,
  opsPolicy,
}: {
  provider: AdminProvider;
  opsPolicy: ProviderOpsPolicy;
}) {
  const action = nextProviderListAction(provider, opsPolicy);
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="participant-list" style={{ marginBottom: 6 }}>
        <span className={`pill ${providerListActionPillClass(action.tone)}`}>{action.status}</span>
      </div>
      <p className="muted" style={{ marginBottom: 4 }}>
        {action.detail}
      </p>
      <p className="muted" style={{ marginBottom: 8 }}>
        {action.operatorAction}
      </p>
    </div>
  );
}

function PartnerOpsBadgeList({
  provider,
  opsPolicy,
}: {
  provider: AdminProvider;
  opsPolicy: ProviderOpsPolicy;
}) {
  const badges = partnerOpsBadges(provider, opsPolicy);

  return (
    <div className="participant-list" style={{ marginBottom: 8 }}>
      {badges.map((badge) => (
        <span
          className={`pill ${partnerOpsBadgePillClass(badge.tone)}`}
          key={badge.label}
          title={badge.detail}
        >
          {badge.label}
        </span>
      ))}
    </div>
  );
}

function buildPartnerMasterRow(provider: AdminProvider, opsPolicy: ProviderOpsPolicy): PartnerMasterRow {
  const bookingRows = providerBookingRows(provider);
  const earnings = provider.earnings ?? [];
  const displayName = providerDisplayName(provider);
  const lastSeenAt = partnerLastSessionAt(provider);
  const latestSessionFacts = partnerLatestSessionFacts(provider);
  const accountBlocked = Boolean(provider.blockedAt);
  const closedRows = bookingRows.filter((booking) => CLOSED_BOOKING_STATUSES.includes(booking.status));
  const latestAuditLog = latestProviderAuditLog(provider);

  return {
    provider,
    initials: partnerInitials(displayName),
    displayName,
    legalName: marketplaceDisplayText(
      provider.legalName ?? provider.user?.fullName ?? 'Legal name not saved',
    ),
    phone: provider.user?.phone ?? 'No phone',
    gender: provider.gender ?? 'Not saved',
    status: provider.status,
    online: provider.status !== 'OFFLINE',
    level: provider.level ?? 'LEVEL_1_SIGNUP',
    kycStatus: provider.kyc?.status ?? 'DRAFT',
    joinedAt: provider.user?.createdAt ?? null,
    lastSeenAt,
    latestSessionDevice: latestSessionFacts.device,
    latestSessionPlatform: latestSessionFacts.platform,
    latestSessionIp: latestSessionFacts.ip,
    latestSessionAppVersion: latestSessionFacts.appVersion,
    locationState: providerLocationStatus(provider, opsPolicy),
    bookingCount: bookingRows.length,
    completedCount:
      bookingRows.filter((booking) => booking.status === 'COMPLETED').length ||
      providerCompletedWorkCount(provider),
    closedCount: closedRows.length,
    customerClosedCount: closedRows.filter((booking) => booking.closedByRole === 'CUSTOMER').length,
    adminClosedCount: closedRows.filter((booking) => booking.closedByRole === 'ADMIN').length,
    partnerClosedCount: closedRows.filter((booking) => booking.closedByRole === 'PROVIDER').length,
    noShowCount: bookingRows.filter((booking) => booking.status === 'NO_SHOW').length,
    reviewCount: Number(provider.reviewCount ?? 0),
    grossRevenue: providerGrossRevenue(provider),
    platformFee: earnings.reduce((sum, earning) => sum + Number(earning.platformFee ?? 0), 0),
    pendingPayout: providerPendingPayout(provider),
    availablePayout: providerAvailablePayout(provider),
    auditLogCount: provider.auditLogCount ?? provider.auditLogs?.length ?? 0,
    latestAuditTitle: latestAuditLog?.action ?? 'No internal note',
    latestAuditDetail: latestAuditLog
      ? compactValue(latestAuditLog.metadata, 96)
      : 'No partner memo or audit event saved yet',
    accountBlocked,
    accountNote: accountBlocked ? (provider.blockedReason ?? 'No block reason saved') : 'Normal account',
  };
}

function latestProviderAuditLog(provider: AdminProvider) {
  const logs = [...(provider.auditLogs ?? [])].sort(
    (left, right) => dateMs(right.createdAt) - dateMs(left.createdAt),
  );
  return logs.find((log) => log.action === 'provider.ops_note.add') ?? logs[0] ?? null;
}

function partnerLatestSessionFacts(provider: AdminProvider) {
  const latestSession = provider.sessions?.[0];
  const latestDevice = provider.devices?.[0];
  const platform = latestDevice?.platform ?? 'Unknown platform';
  const appVersion = latestSession?.appVersion ?? latestDevice?.appVersion;
  const appVersionLabel = appVersion ? `v${appVersion}` : 'No app version';
  const deviceId = latestSession?.deviceId ?? latestDevice?.deviceId;

  return {
    device: deviceId ? `${platform} / ${appVersionLabel} / ${maskToken(deviceId)}` : 'No session',
    platform,
    ip: latestSession?.ipAddress ?? 'No IP recorded',
    appVersion: appVersion ?? 'No app version',
  };
}

function partnerInitials(value: string) {
  const parts = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (!parts.length) return 'P';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function ProviderIssuePills({
  provider,
  opsPolicy,
}: {
  provider: AdminProvider;
  opsPolicy: ProviderOpsPolicy;
}) {
  const issues = providerReviewIssues(provider, opsPolicy);
  if (!issues.length) {
    return (
      <div className="participant-list" style={{ marginBottom: 8 }}>
        <span className="pill pill-success">No blocking issues</span>
      </div>
    );
  }

  return (
    <div className="participant-list" style={{ marginBottom: 8 }}>
      {issues.slice(0, 5).map((issue) => (
        <span className={`pill ${issue.severity === 'high' ? 'pill-danger' : 'pill-warn'}`} key={issue.label}>
          {issue.label}
        </span>
      ))}
      {issues.length > 5 ? <span className="pill pill-info">+{issues.length - 5} more</span> : null}
    </div>
  );
}

function partnerOpsBadges(provider: AdminProvider, opsPolicy: ProviderOpsPolicy): PartnerOpsBadge[] {
  const walletBalance = providerUnsettledWalletBalance(provider);
  const locationState = providerLocationStatus(provider, opsPolicy);
  const kycState = partnerKycState(provider);
  const securityState = providerSecurityStatus(provider);
  const backupEligibility = partnerBackupMatchingEligibility(provider, opsPolicy);
  const canAccept = partnerCanAcceptBookingNow(provider, opsPolicy);
  const hasPush = hasHealthyPush(provider);
  const hasBank = hasApprovedBankAccount(provider);
  const verificationApproved = provider.verification?.status === 'APPROVED';
  const authLinked = Boolean(provider.user?.supabaseUserId);
  const hasOpenControlItem = hasOpenPartnerControl(provider);

  return [
    {
      label: canAccept ? 'Direct request ready' : 'Direct request held',
      tone: canAccept ? 'success' : 'danger',
      detail: canAccept
        ? 'Partner can receive and accept a preferred direct booking now.'
        : partnerAcceptBlockerSummary(provider, opsPolicy),
    },
    {
      label: backupEligibility.eligible ? 'Marketplace ready' : 'Marketplace repair',
      tone: backupEligibility.eligible ? 'success' : 'warn',
      detail: backupEligibility.eligible
        ? `Can participate in marketplace matching within ${formatDistanceMeters(opsPolicy.backupRadiusMeters)}.`
        : backupEligibility.blockers.map((blocker) => blocker.label).join(', ') ||
          'Marketplace participation needs policy repair.',
    },
    {
      label: walletBalance < 0 ? 'Cash debt' : 'Wallet clear',
      tone: walletBalance < 0 ? 'danger' : 'success',
      detail:
        walletBalance < 0
          ? `Partner owes ${formatProviderMoney(Math.abs(walletBalance))} before marketplace alerts and participation.`
          : 'No negative wallet balance is gating marketplace alerts or participation.',
    },
    {
      label:
        verificationApproved && kycState.status === 'APPROVED' && hasApprovedRequiredKycDocuments(provider)
          ? 'KYC ok'
          : 'KYC needed',
      tone:
        verificationApproved && kycState.status === 'APPROVED' && hasApprovedRequiredKycDocuments(provider)
          ? 'success'
          : 'warn',
      detail:
        verificationApproved && kycState.status === 'APPROVED' && hasApprovedRequiredKycDocuments(provider)
          ? 'Verification, KYC, and required identity documents are approved.'
          : kycState.operatorAction,
    },
    {
      label: hasBank ? 'Bank ok' : 'Bank needed',
      tone: hasBank ? 'success' : 'warn',
      detail: hasBank
        ? 'At least one approved bank account is available.'
        : 'Approve a bank account before payout readiness.',
    },
    {
      label: providerLocationLabel(locationState),
      tone: locationState === 'recent' ? 'success' : locationState === 'missing' ? 'neutral' : 'warn',
      detail: providerLocationAgeLabel(provider.currentLocationUpdatedAt),
    },
    {
      label: hasPush ? 'Push ready' : 'Push missing',
      tone: hasPush ? 'success' : 'info',
      detail: hasPush
        ? 'At least one enabled push device is registered.'
        : 'Ask the partner to open the app and register alerts.',
    },
    {
      label: authLinked ? 'Supabase linked' : 'Nest auth only',
      tone: authLinked ? 'success' : 'neutral',
      detail: authLinked
        ? 'Partner user is linked to Supabase auth.'
        : 'Partner can still operate in Nest auth, but Supabase migration is pending.',
    },
    {
      label: hasOpenControlItem ? 'Report follow-up' : providerSecurityLabel(securityState),
      tone: hasOpenControlItem || !['clear', 'missing'].includes(securityState) ? 'danger' : 'success',
      detail: hasOpenControlItem
        ? 'There is an unresolved report or account-control item for this partner.'
        : providerSecurityLabel(securityState),
    },
  ];
}

function partnerOpsBadgePillClass(tone: PartnerOpsBadge['tone']) {
  if (tone === 'success') return 'pill-success';
  if (tone === 'danger') return 'pill-danger';
  if (tone === 'warn') return 'pill-warn';
  if (tone === 'info') return 'pill-info';
  return 'pill-neutral';
}

function PartnerBackupEligibilityCell({
  provider,
  opsPolicy,
}: {
  provider: AdminProvider;
  opsPolicy: ProviderOpsPolicy;
}) {
  const eligibility = partnerBackupMatchingEligibility(provider, opsPolicy);

  return (
    <div className="card" style={{ marginTop: 10, padding: 12 }}>
      <div className="ops-section-header">
        <div>
          <strong>Marketplace participation eligibility</strong>
          <p className="muted">{eligibility.detail}</p>
        </div>
        <span className={`pill ${eligibility.eligible ? 'pill-success' : 'pill-warn'}`}>
          {eligibility.eligible ? 'Candidate ready' : 'Excluded'}
        </span>
      </div>
      <div className="participant-list" style={{ marginTop: 8 }}>
        <span className="pill pill-info">Radius: {formatDistanceMeters(opsPolicy.backupRadiusMeters)}</span>
        <span className="pill pill-info">First window: {opsPolicy.responseWindowMinutes}m</span>
        <span className="pill pill-info">Location: {opsPolicy.staleLocationMinutes}m fresh</span>
      </div>
      {eligibility.blockers.length ? (
        <div className="participant-list" style={{ marginTop: 8 }}>
          {eligibility.blockers.map((blocker) => (
            <span
              className={`pill ${blocker.severity === 'hard' ? 'pill-danger' : 'pill-warn'}`}
              key={blocker.label}
            >
              {blocker.label}
            </span>
          ))}
        </div>
      ) : null}
      <p className="muted" style={{ marginTop: 8 }}>
        {eligibility.operatorAction}
      </p>
    </div>
  );
}

function buildProviderPriorityLane(providers: AdminProvider[], opsPolicy: ProviderOpsPolicy) {
  const ordered = providers
    .map((provider) => ({ provider, action: nextProviderListAction(provider, opsPolicy) }))
    .filter((item) => item.action.tone !== 'done')
    .sort((left, right) => {
      if (left.action.priority !== right.action.priority) {
        return right.action.priority - left.action.priority;
      }
      return providerDisplayName(left.provider).localeCompare(providerDisplayName(right.provider));
    });

  return {
    items: ordered.slice(0, 6),
    blockedCount: ordered.filter((item) => item.action.tone === 'blocked').length,
  };
}

function providerDisplayName(provider: AdminProvider) {
  return marketplaceDisplayText(
    provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id,
  );
}

function ProviderLocationCell({
  provider,
  opsPolicy,
}: {
  provider: AdminProvider;
  opsPolicy: ProviderOpsPolicy;
}) {
  const status = providerLocationStatus(provider, opsPolicy);
  const hasCoordinate = hasProviderCoordinate(provider);

  return (
    <div>
      <div className="participant-list" style={{ marginBottom: 8 }}>
        <span className={`pill ${providerLocationPillClass(status)}`}>{providerLocationLabel(status)}</span>
      </div>
      <p className="muted" style={{ marginBottom: 4 }}>
        {providerLocationAgeLabel(provider.currentLocationUpdatedAt)}
      </p>
      {hasCoordinate ? (
        <p className="muted">
          {Number(provider.currentLat).toFixed(4)}, {Number(provider.currentLng).toFixed(4)}
        </p>
      ) : (
        <p className="muted">No saved coordinates yet.</p>
      )}
    </div>
  );
}

function ProviderSecurityCell({ provider }: { provider: AdminProvider }) {
  const status = providerSecurityStatus(provider);
  const blockedDevices = (provider.devices ?? []).filter((device) => Boolean(device.blockedAt));
  const sessionCheckSessions = (provider.sessions ?? []).filter((session) => session.suspicious);
  const sharedDevices = sharedDeviceIds(provider);
  const latestDevice = provider.devices?.[0];
  const latestSession = provider.sessions?.[0];

  return (
    <div>
      <div className="participant-list" style={{ marginBottom: 8 }}>
        <span className={`pill ${providerSecurityPillClass(status)}`}>{providerSecurityLabel(status)}</span>
      </div>
      <p className="muted" style={{ marginBottom: 4 }}>
        {latestDevice
          ? `Last app device: ${maskToken(latestDevice.deviceId)} / ${latestDevice.platform ?? 'unknown'}`
          : 'No partner app device recorded yet.'}
      </p>
      {provider.blockedAt ? (
        <p className="muted" style={{ marginBottom: 4 }}>
          Account block: {provider.blockedReason ?? 'No reason saved'} / {formatDate(provider.blockedAt)}
        </p>
      ) : null}
      {latestSession ? (
        <p className="muted" style={{ marginBottom: 4 }}>
          Last session: {latestSession.ipAddress ?? 'no IP'} / {formatDate(latestSession.lastSeenAt)}
        </p>
      ) : null}
      {blockedDevices.length ? <p className="muted">{blockedDevices.length} blocked device(s)</p> : null}
      {sessionCheckSessions.length ? (
        <p className="muted">{sessionCheckSessions.length} session check(s)</p>
      ) : null}
      {sharedDevices.size ? <p className="muted">{sharedDevices.size} shared device id(s)</p> : null}
      <Link className="text-link" href={`/partners/${provider.id}`}>
        Review device/session
      </Link>
    </div>
  );
}

function providerActionHint(provider: AdminProvider, opsPolicy = DEFAULT_PROVIDER_OPS_POLICY) {
  if (provider.blockedAt) {
    return 'This partner account is blocked and cannot go online, update location, or appear to customers.';
  }
  if (provider.verification?.status !== 'APPROVED') {
    return 'Review verification before this partner can safely take customer requests.';
  }
  if (providerPublicMediaNeedsReview(provider)) {
    return 'Approve public profile media before customers can see the latest uploaded images.';
  }
  const walletBalance = providerUnsettledWalletBalance(provider);
  if (walletBalance < 0) {
    return `Partner wallet is negative by ${formatProviderMoney(
      Math.abs(walletBalance),
    )}. They can see marketplace requests, but cannot receive marketplace alerts or participate until finance settles the cash fee debt.`;
  }
  if (provider.status !== 'ONLINE_AVAILABLE') {
    return 'Partner is approved but not currently online for direct or marketplace requests.';
  }
  const locationState = providerLocationStatus(provider, opsPolicy);
  if (locationState === 'missing') {
    return 'Partner is online, but no location has been saved yet. Ask them to reopen the Partner app.';
  }
  if (locationState === 'expired') {
    return 'Partner has an old saved location. They should go online again before dispatch.';
  }
  if (locationState === 'stale') {
    return `Partner is live, but the last location is older than ${opsPolicy.staleLocationMinutes} minutes. Confirm before dispatch.`;
  }
  if (!hasHealthyPush(provider)) {
    return 'Partner is live, but push registration should be checked before relying on alerts.';
  }
  const securityState = providerSecurityStatus(provider);
  if (securityState !== 'clear') {
    return 'Partner has a device/session follow-up item. Review it before dispatching customer bookings.';
  }
  if (!provider.user?.supabaseUserId) {
    return 'Partner is operational in Nest auth. Supabase role sync will become available after Supabase OTP login links this phone.';
  }
  return 'Partner is ready for direct requests and marketplace matching.';
}

function partnerBackupMatchingEligibility(provider: AdminProvider, opsPolicy = DEFAULT_PROVIDER_OPS_POLICY) {
  return buildPartnerMarketplaceEligibility(provider, opsPolicy);
}

function hasApprovedRequiredKycDocuments(provider: AdminProvider) {
  return missingApprovedRequiredKycDocuments(provider).length === 0;
}

function providerDashboardTone(tone: ProviderCommandLane['tone']) {
  if (tone === 'danger') return 'danger';
  if (tone === 'warn') return 'warn';
  if (tone === 'info') return 'info';
  return 'ok';
}

function providerDispatchReady(provider: AdminProvider, opsPolicy = DEFAULT_PROVIDER_OPS_POLICY) {
  return (
    !partnerHasHardAcceptanceBlocker(provider) &&
    provider.status === 'ONLINE_AVAILABLE' &&
    providerLocationStatus(provider, opsPolicy) === 'recent' &&
    providerSecurityStatus(provider) === 'clear' &&
    hasHealthyPush(provider)
  );
}

function providerCommandToneClass(tone: ProviderCommandLane['tone']) {
  if (tone === 'danger' || tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'info') {
    return 'signal-info';
  }
  return 'signal-ok';
}

function providerCommandToneLabel(tone: ProviderCommandLane['tone']) {
  if (tone === 'danger') {
    return 'Immediate check';
  }
  if (tone === 'warn') {
    return 'Monitor';
  }
  if (tone === 'info') {
    return 'Info';
  }
  return 'Clear';
}

function partnerHasHardAcceptanceBlocker(provider: AdminProvider) {
  return (
    Boolean(provider.blockedAt) ||
    provider.verification?.status !== 'APPROVED' ||
    provider.kyc?.status !== 'APPROVED' ||
    !hasApprovedRequiredKycDocuments(provider) ||
    !hasApprovedBankAccount(provider) ||
    ['account-blocked', 'blocked', 'session-check', 'shared'].includes(providerSecurityStatus(provider))
  );
}

function partnerCanAcceptBookingNow(provider: AdminProvider, opsPolicy: ProviderOpsPolicy) {
  return (
    !partnerHasHardAcceptanceBlocker(provider) &&
    provider.status === 'ONLINE_AVAILABLE' &&
    providerLocationStatus(provider, opsPolicy) === 'recent' &&
    hasHealthyPush(provider)
  );
}

function providerReviewIssues(provider: AdminProvider, opsPolicy = DEFAULT_PROVIDER_OPS_POLICY) {
  const issues: Array<{ label: string; severity: 'high' | 'medium' }> = [];
  const kycStatus = provider.kyc?.status ?? 'MISSING';
  const bankStatus = hasApprovedBankAccount(provider)
    ? 'APPROVED'
    : (provider.bankAccounts?.[0]?.status ?? 'MISSING');
  const taxStatus = provider.taxProfile?.status ?? 'MISSING';

  if (provider.blockedAt) {
    issues.push({ label: 'account blocked', severity: 'high' });
  }
  if (provider.verification?.status !== 'APPROVED') {
    issues.push({ label: 'verification review', severity: 'high' });
  }
  if (providerPublicMedia(provider).some((file) => file.reviewStatus === 'REJECTED')) {
    issues.push({ label: 'media rejected', severity: 'medium' });
  } else if (providerPublicMediaNeedsReview(provider)) {
    issues.push({ label: 'media pending', severity: 'medium' });
  }
  if (kycStatus !== 'APPROVED') {
    issues.push({ label: `KYC ${kycStatus}`, severity: kycStatus === 'REJECTED' ? 'high' : 'medium' });
  }
  const missingRequiredDocuments = missingApprovedRequiredKycDocuments(provider);
  if (missingRequiredDocuments.length > 0) {
    issues.push({
      label: `identity docs ${missingRequiredDocuments.length}/3 missing`,
      severity: 'high',
    });
  }
  if ((provider.documents ?? []).some((document) => document.status === 'REJECTED')) {
    issues.push({ label: 'document rejected', severity: 'high' });
  } else if ((provider.documents ?? []).some((document) => document.status === 'PENDING_REVIEW')) {
    issues.push({ label: 'document pending', severity: 'medium' });
  }
  if (bankStatus !== 'APPROVED') {
    issues.push({
      label: `bank ${bankStatus}`,
      severity: bankStatus === 'REJECTED' ? 'high' : 'medium',
    });
  }
  if (providerTaxNeedsReview(provider)) {
    issues.push({ label: `tax ${taxStatus}`, severity: taxStatus === 'REJECTED' ? 'high' : 'medium' });
  }
  if (providerHasFirstRevenueSignal(provider) && !provider.residentialAddress?.trim()) {
    issues.push({ label: 'tax address missing', severity: 'high' });
  }
  if (providerHasFirstRevenueSignal(provider) && (provider.agreements?.length ?? 0) < 5) {
    issues.push({ label: `terms ${(provider.agreements?.length ?? 0).toString()}/5`, severity: 'high' });
  }
  const walletBalance = providerUnsettledWalletBalance(provider);
  if (walletBalance < 0) {
    issues.push({ label: `cash debt ${formatProviderMoney(Math.abs(walletBalance))}`, severity: 'high' });
  }
  const locationState = providerLocationStatus(provider, opsPolicy);
  if (locationState !== 'recent') {
    issues.push({
      label: `location ${locationState}`,
      severity: locationState === 'missing' ? 'high' : 'medium',
    });
  }
  const securityState = providerSecurityStatus(provider);
  if (securityState === 'blocked') {
    issues.push({ label: 'device blocked', severity: 'high' });
  } else if (securityState === 'session-check') {
    issues.push({ label: 'session check', severity: 'high' });
  } else if (securityState === 'shared') {
    issues.push({ label: 'shared device', severity: 'high' });
  } else if (securityState === 'missing') {
    issues.push({ label: 'device missing', severity: 'medium' });
  }
  if (!hasHealthyPush(provider)) {
    issues.push({ label: 'push missing', severity: 'medium' });
  }
  if (!provider.user?.supabaseUserId) {
    issues.push({ label: 'Supabase role pending', severity: 'medium' });
  }
  const openReports = (provider.reports ?? []).filter((report) =>
    ['OPEN', 'INVESTIGATING'].includes(report.status),
  ).length;
  const activeSanctions = (provider.sanctions ?? []).filter(
    (sanction) => sanction.status === 'ACTIVE',
  ).length;
  if (openReports > 0) {
    issues.push({ label: `${openReports} open report(s)`, severity: 'high' });
  }
  if (activeSanctions > 0) {
    issues.push({ label: `${activeSanctions} active control(s)`, severity: 'high' });
  }

  return issues;
}
