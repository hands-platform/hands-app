import Link from 'next/link';
import {
  AdminProvider,
  AdminOperationalPolicySetting,
  adminGet,
  providerDocumentLabel,
  providerDocumentReviewHint,
} from '../../lib/admin-api';
import { buildCsvDataHref } from '../../lib/csv-export';
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
import { readSearchParam } from '../../lib/date-range';

type AdminPushDevice = NonNullable<NonNullable<AdminProvider['user']>['pushDevices']>[number];
type AdminProviderPublicMedia = NonNullable<NonNullable<AdminProvider['user']>['fileAssets']>[number];
type ProviderLocationState = 'recent' | 'stale' | 'expired' | 'missing';
type ProviderSecurityState = 'clear' | 'account-blocked' | 'blocked' | 'session-check' | 'shared' | 'missing';
const CLOSED_BOOKING_STATUSES = ['CANCELLED', 'EXPIRED', 'REFUNDED', 'NO_SHOW'];
type ProviderCommandLane = {
  title: string;
  status: string;
  tone: 'ok' | 'info' | 'warn' | 'danger';
  detail: string;
  href: string;
  metrics: Array<{ label: string; value: string }>;
};
type PartnerDispatchForecast = {
  totals: Array<{
    label: string;
    value: string;
    detail: string;
    tone: ProviderCommandLane['tone'];
    href: string;
  }>;
  blockers: Array<{
    label: string;
    count: number;
    detail: string;
    href: string;
    tone: ProviderCommandLane['tone'];
  }>;
  supplyLanes: Array<{
    city: string;
    total: number;
    ready: number;
    online: number;
    locationNeedsRefresh: number;
    blocked: number;
  }>;
};
type PartnerAcceptanceBlockerBoard = {
  hardBlocked: number;
  eligibleNow: number;
  cards: Array<{
    title: string;
    count: number;
    status: string;
    detail: string;
    operatorAction: string;
    href: string;
    tone: ProviderCommandLane['tone'];
    samples: string[];
  }>;
};
type PartnerKycReviewBoard = {
  openCount: number;
  readyToApprove: number;
  blockedByDocuments: number;
  playbook: Array<{
    status: string;
    title: string;
    count: number;
    detail: string;
    operatorAction: string;
    href: string;
  }>;
  cards: Array<{
    title: string;
    count: number;
    status: string;
    detail: string;
    operatorAction: string;
    href: string;
    tone: ProviderCommandLane['tone'];
    samples: string[];
  }>;
};
type PartnerShiftHandoff = {
  tone: ProviderCommandLane['tone'];
  label: string;
  headline: string;
  detail: string;
  primaryAction: { label: string; href: string };
  stats: Array<{
    label: string;
    value: string;
    detail: string;
    href: string;
    tone: ProviderCommandLane['tone'];
  }>;
  actions: Array<{
    title: string;
    scope: string;
    detail: string;
    operatorAction: string;
    href: string;
    tone: ProviderCommandLane['tone'];
    samples: string[];
  }>;
};
type PartnerDispatchHandoff = {
  headline: string;
  detail: string;
  policyLabel: string;
  links: Array<{
    title: string;
    value: string;
    detail: string;
    href: string;
    tone: ProviderCommandLane['tone'];
  }>;
};
type PartnerDailyActionQueue = {
  urgentCount: number;
  blockedCount: number;
  dispatchReadyCount: number;
  rows: Array<{
    provider: AdminProvider;
    action: ProviderListAction;
    href: string;
    lane: string;
    sla: string;
    age: string;
    tone: ProviderCommandLane['tone'];
  }>;
};
type PartnerKycState = {
  status: string;
  missingDocuments: string[];
  pendingDocuments: number;
  rejectedDocuments: number;
  readyToApprove: boolean;
  blockedByDocuments: boolean;
  needsReview: boolean;
  detail: string;
  operatorAction: string;
};
type ProviderFilters = {
  q: string;
  verification: string;
  providerStatus: string;
  kyc: string;
  location: string;
  security: string;
  readiness: string;
  review: string;
  sort: string;
};
type ProvidersPageSearchParams = Promise<Record<string, string | string[] | undefined>>;
type ProviderOpsPolicy = {
  staleLocationMinutes: number;
  expiredLocationHours: number;
  backupRadiusMeters: number;
  responseWindowMinutes: number;
};

const MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY =
  'matching.backup_provider_location_max_age_minutes';
const MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY = 'matching.backup_provider_radius_meters';
const MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY = 'matching.provider_response_window_minutes';
const DEFAULT_PROVIDER_OPS_POLICY: ProviderOpsPolicy = {
  staleLocationMinutes: 30,
  expiredLocationHours: 24,
  backupRadiusMeters: 10000,
  responseWindowMinutes: 10,
};
const PROVIDER_LIST_RENDER_LIMIT = 40;
const REQUIRED_KYC_DOCUMENTS = ['CCCD_FRONT', 'CCCD_BACK', 'SELFIE'];

export default async function ProvidersPage({ searchParams }: { searchParams?: ProvidersPageSearchParams }) {
  const filters = buildProviderFilters(searchParams ? await searchParams : {});
  const [rawProviders, operationalPolicies] = await Promise.all([
    adminGet<AdminProvider[]>('/admin/partners', []),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);
  const opsPolicy = buildProviderOpsPolicy(operationalPolicies);
  const allProviders = sortProviders(rawProviders, opsPolicy, filters.sort);
  const providers = filterProviders(allProviders, filters, opsPolicy);
  const visibleProviders = providers.slice(0, PROVIDER_LIST_RENDER_LIMIT);
  const hiddenProviderCount = Math.max(providers.length - visibleProviders.length, 0);
  const summary = buildProviderSummary(providers, opsPolicy);
  const commandCenter = buildProviderCommandCenter(providers, opsPolicy);
  const reviewQueue = buildProviderReviewQueue(providers, opsPolicy);
  const priorityLane = buildProviderPriorityLane(providers, opsPolicy);
  const dispatchForecast = buildPartnerDispatchForecast(providers, opsPolicy);
  const acceptanceBlockerBoard = buildPartnerAcceptanceBlockerBoard(providers, opsPolicy);
  const kycReviewBoard = buildPartnerKycReviewBoard(providers);
  const shiftHandoff = buildPartnerShiftHandoff(providers, opsPolicy);
  const dispatchHandoff = buildPartnerDispatchHandoff(allProviders, opsPolicy);
  const dailyActionQueue = buildPartnerDailyActionQueue(providers, opsPolicy);
  const activeFilters = buildProviderActiveFilters(filters);
  const filterSummary = buildPartnerFilterSummary(providers, allProviders, opsPolicy, activeFilters.length);
  const partnerOperationRows = visibleProviders.map((provider) =>
    buildPartnerOperationRow(provider, opsPolicy),
  );
  const partnerMasterRows = visibleProviders.map((provider) => buildPartnerMasterRow(provider, opsPolicy));
  const partnerExportRows = providers.map((provider) => {
    const master = buildPartnerMasterRow(provider, opsPolicy);
    const operations = buildPartnerOperationRow(provider, opsPolicy);
    return {
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
      next_operator_status: operations.nextAction.status,
      next_operator_action: operations.nextAction.operatorAction,
      account_state: master.accountBlocked ? 'Blocked' : 'Open',
      account_note: master.accountNote,
    };
  });
  const partnerListCsvHref = buildCsvDataHref(partnerExportRows, [
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
    'next_operator_status',
    'next_operator_action',
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
              <option value="acceptance-blocked">Booking acceptance blocked</option>
              <option value="direct-ready">Direct request ready</option>
              <option value="marketplace-ready">Marketplace ready</option>
              <option value="marketplace-blocked">Marketplace blocked</option>
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
              download={`hands-partners-${filters.sort}.csv`}
              href={partnerListCsvHref}
            >
              Export CSV
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
        <div className="risk-watch-header">
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
        <div className="risk-watch-header">
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
                <th>Location</th>
                <th>Bookings</th>
                <th>Feedback records</th>
                <th>Revenue</th>
                <th>Payout</th>
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
                    <p className="muted">
                      {row.noShowCount} no-show
                    </p>
                  </td>
                  <td>
                    <strong>{row.reviewCount} review(s)</strong>
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
                  <td colSpan={15}>
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
        <div className="risk-watch-header">
          <div>
            <h2>Partner operations list</h2>
            <p className="muted">
              List-first partner control view. Operators can check onboarding, booking acceptance, completed
              work, last work, wallet, location, push, services, and app activity before opening the full
              partner record.
            </p>
          </div>
          <div className="participant-list">
            <span className="pill pill-info">{providers.length} partner(s)</span>
            <span className="pill pill-success">
              {providers.filter((provider) => partnerCanAcceptBookingNow(provider, opsPolicy)).length} can
              accept
            </span>
            <span className="pill pill-warn">
              {providers.filter((provider) => providerUnsettledWalletBalance(provider) < 0).length} wallet
              hold
            </span>
          </div>
        </div>
        <div style={{ marginTop: 14, overflowX: 'auto' }}>
          <table className="table service-trace">
            <thead>
              <tr>
                <th>Partner</th>
                <th>Basic checklist</th>
                <th>Booking acceptance</th>
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
                        ? 'Company fee settlement is required before new booking acceptance.'
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
                  <td colSpan={8}>
                    <strong>No partners found</strong>
                    <p className="muted">Change the filters or clear search to view partner records.</p>
                  </td>
                </tr>
              ) : null}
              {hiddenProviderCount > 0 ? (
                <tr>
                  <td colSpan={8}>
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
        <div className="risk-watch-header">
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
                <th>Age signal</th>
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
        <div className="risk-watch-header">
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
        <div className="risk-watch-header">
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
        <div className="risk-watch-header">
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
        <div className="risk-watch-header">
          <div>
            <h2>Partner acceptance blocker board</h2>
            <p className="muted">
              Shows why partners cannot accept direct bookings or join marketplace matching before operators
              try to dispatch them. Marketplace participation eligibility is checked with the same booking-readiness
              gates shown below.
            </p>
          </div>
          <div className="participant-list">
            <span
              className={`pill ${acceptanceBlockerBoard.hardBlocked > 0 ? 'pill-danger' : 'pill-success'}`}
            >
              {acceptanceBlockerBoard.hardBlocked} hard blocked
            </span>
            <span className="pill pill-info">{acceptanceBlockerBoard.eligibleNow} can accept now</span>
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
        <div className="risk-watch-header">
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
        <div className="risk-watch-header">
          <div>
            <h2>Dispatch capacity forecast</h2>
            <p className="muted">
              Converts the filtered partner list into dispatch capacity, recovery work, and city-level supply
              signals for direct requests and marketplace matching.
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
                    <strong>No city signal yet</strong>
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
        <div className="risk-watch-header">
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
        <div className="risk-watch-header">
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
                            {device.platform} / {device.enabled ? 'enabled' : 'disabled'} /{' '}
                            {maskToken(device.token)}
                          </p>
                          {!device.enabled ? (
                            <p className="muted" style={{ marginBottom: 4 }}>
                              Last failure: {readFailureCode(device) ?? 'Unknown'} /{' '}
                              {readFailureStatus(device) ?? 'FAILED'}
                            </p>
                          ) : null}
                          {readLastAttempt(device) ? (
                            <p className="muted" style={{ marginBottom: 4 }}>
                              Last attempt: {new Date(readLastAttempt(device) as string).toLocaleString()}
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
                          <span className="pill pill-info">{file.purpose ?? 'PROVIDER_VERIFICATION'}</span>
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
                          {file.uploadedAt ? ` / uploaded ${new Date(file.uploadedAt).toLocaleString()}` : ''}
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
        {REQUIRED_KYC_DOCUMENTS.map((documentType) => {
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
                  ? ` / uploaded ${new Date(document.fileAsset.uploadedAt).toLocaleString()}`
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
            {file.uploadedAt ? ` / uploaded ${new Date(file.uploadedAt).toLocaleString()}` : ''}
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

function maskToken(token: string) {
  if (token.length <= 10) {
    return token;
  }
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function readFailureCode(device: AdminPushDevice) {
  return device.deliveries?.[0]?.response?.body?.error?.details?.[0]?.errorCode;
}

function readFailureStatus(device: AdminPushDevice) {
  return device.deliveries?.[0]?.status;
}

function readLastAttempt(device: AdminPushDevice) {
  return device.deliveries?.[0]?.attemptedAt;
}

function hasHealthyPush(provider: AdminProvider) {
  return (provider.user?.pushDevices ?? []).some((device) => device.enabled);
}

function hasApprovedBankAccount(provider: AdminProvider) {
  return (provider.bankAccounts ?? []).some((account) => account.status === 'APPROVED');
}

function providerPublicMedia(provider: AdminProvider): AdminProviderPublicMedia[] {
  return provider.user?.fileAssets ?? [];
}

function providerPublicMediaNeedsReview(provider: AdminProvider) {
  return providerPublicMedia(provider).some((file) =>
    ['PENDING_REVIEW', 'REJECTED'].includes(file.reviewStatus ?? 'PENDING_REVIEW'),
  );
}

function publicMediaReviewPillClass(status?: string) {
  if (status === 'APPROVED') return 'pill-success';
  if (status === 'REJECTED') return 'pill-danger';
  return 'pill-warn';
}

type ProviderListAction = {
  status: string;
  detail: string;
  operatorAction: string;
  tone: 'done' | 'pending' | 'blocked';
  priority: number;
};

type PartnerOpsBadge = {
  label: string;
  detail: string;
  tone: 'success' | 'danger' | 'warn' | 'info' | 'neutral';
};
type PartnerOperationChecklistItem = {
  label: string;
  status: string;
  tone: ProviderCommandLane['tone'] | 'neutral';
};
type PartnerOperationRow = {
  provider: AdminProvider;
  name: string;
  phone: string;
  checklist: PartnerOperationChecklistItem[];
  acceptanceLabel: string;
  acceptanceDetail: string;
  acceptanceTone: ProviderCommandLane['tone'];
  completedWorkCount: number;
  lastWorkAt: string | null;
  walletBalance: number;
  locationState: ProviderLocationState;
  lastActivityAt: string | null;
  nextAction: ProviderListAction;
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

function buildPartnerOperationRow(
  provider: AdminProvider,
  opsPolicy: ProviderOpsPolicy,
): PartnerOperationRow {
  const walletBalance = providerUnsettledWalletBalance(provider);
  const locationState = providerLocationStatus(provider, opsPolicy);
  const canAccept = partnerCanAcceptBookingNow(provider, opsPolicy);
  const backupEligibility = partnerBackupMatchingEligibility(provider, opsPolicy);
  const completedWorkCount = providerCompletedWorkCount(provider);
  const firstRevenue = providerHasFirstRevenueSignal(provider);
  const taxStatus = provider.taxProfile?.status ?? (firstRevenue ? 'MISSING' : 'deferred');
  const nextAction = nextProviderListAction(provider, opsPolicy);

  return {
    provider,
    name: providerDisplayName(provider),
    phone: provider.user?.phone ?? provider.id,
    checklist: [
      {
        label: 'KYC',
        status:
          provider.kyc?.status === 'APPROVED' && hasApprovedRequiredKycDocuments(provider)
            ? 'ok'
            : (provider.kyc?.status ?? 'missing'),
        tone:
          provider.kyc?.status === 'APPROVED' && hasApprovedRequiredKycDocuments(provider)
            ? 'ok'
            : provider.kyc?.status === 'REJECTED'
              ? 'danger'
              : 'warn',
      },
      {
        label: 'Bank',
        status: hasApprovedBankAccount(provider) ? 'ok' : (provider.bankAccounts?.[0]?.status ?? 'missing'),
        tone: hasApprovedBankAccount(provider) ? 'ok' : 'warn',
      },
      {
        label: 'Tax',
        status: taxStatus,
        tone: provider.taxProfile?.status === 'APPROVED' ? 'ok' : firstRevenue ? 'warn' : 'neutral',
      },
      {
        label: 'Wallet',
        status: walletBalance < 0 ? 'settlement needed' : 'clear',
        tone: walletBalance < 0 ? 'danger' : 'ok',
      },
      {
        label: 'Location',
        status: locationState,
        tone: locationState === 'recent' ? 'ok' : locationState === 'stale' ? 'warn' : 'neutral',
      },
      {
        label: 'Push',
        status: hasHealthyPush(provider) ? 'ready' : 'missing',
        tone: hasHealthyPush(provider) ? 'ok' : 'warn',
      },
      {
        label: 'Services',
        status:
          providerActiveServiceCount(provider) > 0
            ? `${providerActiveServiceCount(provider)} active`
            : 'none',
        tone: providerActiveServiceCount(provider) > 0 ? 'ok' : 'warn',
      },
      {
        label: 'App',
        status: partnerHasAppActivity(provider) ? 'seen' : 'not seen',
        tone: partnerHasAppActivity(provider) ? 'ok' : 'neutral',
      },
    ],
    acceptanceLabel: canAccept ? 'Can accept bookings' : 'Acceptance on hold',
    acceptanceDetail: canAccept
      ? backupEligibility.eligible
        ? `Ready for direct requests and ${formatDistanceMeters(opsPolicy.backupRadiusMeters)} marketplace matching.`
        : 'Ready for direct requests. Marketplace participation depends on booking location and policy.'
      : partnerAcceptBlockerSummary(provider, opsPolicy),
    acceptanceTone: canAccept ? 'ok' : 'warn',
    completedWorkCount,
    lastWorkAt: providerLastCompletedWorkAt(provider),
    walletBalance,
    locationState,
    lastActivityAt: partnerLastActivityAt(provider),
    nextAction,
  };
}

function buildPartnerMasterRow(provider: AdminProvider, opsPolicy: ProviderOpsPolicy): PartnerMasterRow {
  const bookingRows = providerBookingRows(provider);
  const earnings = provider.earnings ?? [];
  const displayName = providerDisplayName(provider);
  const lastSeenAt = partnerLastSessionAt(provider);
  const accountBlocked = Boolean(provider.blockedAt);
  const closedRows = bookingRows.filter((booking) => CLOSED_BOOKING_STATUSES.includes(booking.status));

  return {
    provider,
    initials: partnerInitials(displayName),
    displayName,
    legalName: marketplaceDisplayText(provider.legalName ?? provider.user?.fullName ?? 'Legal name not saved'),
    phone: provider.user?.phone ?? 'No phone',
    gender: provider.gender ?? 'Not saved',
    status: provider.status,
    online: provider.status !== 'OFFLINE',
    level: provider.level ?? 'LEVEL_1_SIGNUP',
    kycStatus: provider.kyc?.status ?? 'DRAFT',
    joinedAt: provider.user?.createdAt ?? null,
    lastSeenAt,
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
    accountBlocked,
    accountNote: accountBlocked ? (provider.blockedReason ?? 'No block reason saved') : 'Normal account',
  };
}

function providerBookingRows(provider: AdminProvider) {
  const records = new Map<string, NonNullable<AdminProvider['selectedBookings']>[number]>();
  for (const booking of provider.preferredBookings ?? []) {
    records.set(booking.id, booking);
  }
  for (const booking of provider.selectedBookings ?? []) {
    records.set(booking.id, booking);
  }
  for (const participant of provider.participants ?? []) {
    if (participant.booking) records.set(participant.booking.id, participant.booking);
  }
  return [...records.values()];
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

function partnerOperationPillClass(tone: PartnerOperationChecklistItem['tone']) {
  if (tone === 'ok') return 'pill-success';
  if (tone === 'danger') return 'pill-danger';
  if (tone === 'warn') return 'pill-warn';
  if (tone === 'info') return 'pill-info';
  return 'pill-neutral';
}

function providerActiveServiceCount(provider: AdminProvider) {
  return (provider.services ?? []).filter((service) => service.active !== false).length;
}

function partnerHasAppActivity(provider: AdminProvider) {
  return Boolean((provider.sessions ?? []).length || (provider.devices ?? []).length);
}

function providerCompletedWorkCount(provider: AdminProvider) {
  return (provider.earnings ?? []).filter((earning) => {
    if (earning.booking?.status === 'COMPLETED') return true;
    return ['AVAILABLE', 'PAID'].includes(earning.status);
  }).length;
}

function providerGrossRevenue(provider: AdminProvider) {
  return (provider.earnings ?? []).reduce((sum, earning) => sum + Number(earning.grossAmount ?? 0), 0);
}

function providerPendingPayout(provider: AdminProvider) {
  return (provider.earnings ?? [])
    .filter((earning) => ['PENDING', 'AVAILABLE'].includes(earning.status))
    .reduce((sum, earning) => sum + Number(earning.netAmount ?? 0), 0);
}

function providerAvailablePayout(provider: AdminProvider) {
  return (provider.earnings ?? [])
    .filter((earning) => earning.status === 'AVAILABLE')
    .reduce((sum, earning) => sum + Number(earning.netAmount ?? 0), 0);
}

function providerLastCompletedWorkAt(provider: AdminProvider) {
  return latestTimestamp(
    (provider.earnings ?? [])
      .filter(
        (earning) =>
          earning.booking?.status === 'COMPLETED' || ['AVAILABLE', 'PAID'].includes(earning.status),
      )
      .flatMap((earning) => [
        earning.booking?.scheduledStartAt,
        earning.paidAt,
        earning.availableAt,
        earning.createdAt,
      ]),
  );
}

function partnerLastActivityAt(provider: AdminProvider) {
  return latestTimestamp([
    provider.currentLocationUpdatedAt,
    provider.nextAvailableAt,
    ...(provider.sessions ?? []).flatMap((session) => [session.lastSeenAt, session.loggedInAt]),
    ...(provider.devices ?? []).flatMap((device) => [device.lastSeenAt, device.updatedAt, device.createdAt]),
    ...(provider.user?.pushDevices ?? []).map((device) => device.createdAt),
    ...(provider.earnings ?? []).flatMap((earning) => [
      earning.booking?.scheduledStartAt,
      earning.createdAt,
      earning.availableAt,
      earning.paidAt,
    ]),
  ]);
}

function partnerLastSessionAt(provider: AdminProvider) {
  return latestTimestamp([
    ...(provider.sessions ?? []).flatMap((session) => [session.lastSeenAt, session.loggedInAt]),
    ...(provider.devices ?? []).flatMap((device) => [device.lastSeenAt, device.updatedAt, device.createdAt]),
  ]);
}

function latestTimestamp(values: Array<string | null | undefined>) {
  const latest = values
    .map((value) => {
      if (!value) return null;
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) ? { value, timestamp } : null;
    })
    .filter(Boolean)
    .sort((left, right) => (right?.timestamp ?? 0) - (left?.timestamp ?? 0))[0];

  return latest?.value ?? null;
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
      label: canAccept ? 'Accept ready' : 'Accept blocked',
      tone: canAccept ? 'success' : 'danger',
      detail: canAccept
        ? 'Partner can accept a direct booking now.'
        : partnerAcceptBlockerSummary(provider, opsPolicy),
    },
    {
      label: backupEligibility.eligible ? 'Marketplace ready' : 'Marketplace blocked',
      tone: backupEligibility.eligible ? 'success' : 'warn',
      detail: backupEligibility.eligible
        ? `Can join marketplace matching within ${formatDistanceMeters(opsPolicy.backupRadiusMeters)}.`
        : backupEligibility.blockers.map((blocker) => blocker.label).join(', ') ||
          'Marketplace matching is blocked by policy.',
    },
    {
      label: walletBalance < 0 ? 'Cash debt' : 'Wallet clear',
      tone: walletBalance < 0 ? 'danger' : 'success',
      detail:
        walletBalance < 0
          ? `Partner owes ${formatProviderMoney(Math.abs(walletBalance))} before accepting new bookings.`
          : 'No negative wallet balance is blocking booking acceptance.',
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

function partnerAcceptBlockerSummary(provider: AdminProvider, opsPolicy: ProviderOpsPolicy) {
  const blockers: string[] = [];
  const locationState = providerLocationStatus(provider, opsPolicy);
  const securityState = providerSecurityStatus(provider);

  if (provider.blockedAt) blockers.push('account blocked');
  if (provider.verification?.status !== 'APPROVED') {
    blockers.push(`verification ${provider.verification?.status ?? 'DRAFT'}`);
  }
  if (provider.kyc?.status !== 'APPROVED') blockers.push(`KYC ${provider.kyc?.status ?? 'MISSING'}`);
  if (!hasApprovedRequiredKycDocuments(provider)) blockers.push('identity documents');
  if (!hasApprovedBankAccount(provider)) blockers.push('bank account');
  if (providerUnsettledWalletBalance(provider) < 0) blockers.push('cash fee debt');
  if (provider.status !== 'ONLINE_AVAILABLE') blockers.push(`status ${provider.status}`);
  if (locationState !== 'recent') blockers.push(`location ${locationState}`);
  if (!hasHealthyPush(provider)) blockers.push('push missing');
  if (!['clear', 'missing'].includes(securityState))
    blockers.push(providerSecurityLabel(securityState).toLowerCase());

  return blockers.length ? `Blocked by: ${blockers.join(', ')}.` : 'Booking acceptance is blocked by policy.';
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
      <div className="risk-watch-header">
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

function partnerDetailActionHref(provider: AdminProvider, action: ProviderListAction) {
  const anchorByStatus: Record<string, string> = {
    ACCOUNT: 'payout',
    PROFILE: 'kyc',
    DOCUMENTS: 'documents',
    KYC: 'kyc',
    VERIFY: 'kyc',
    'CASH DEBT': 'payout',
    MEDIA: 'media',
    BANK: 'bank',
    TAX: 'tax',
    'TAX ADDRESS': 'tax',
    TERMS: 'tax',
    DEVICE: 'location',
    SECURITY: 'location',
    LOCATION: 'location',
    PUSH: 'location',
    SUPABASE: 'kyc',
  };
  const anchor = anchorByStatus[action.status];
  return anchor ? `/partners/${provider.id}#${anchor}` : `/partners/${provider.id}`;
}

function nextProviderListAction(
  provider: AdminProvider,
  opsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
): ProviderListAction {
  const missingDocuments = missingApprovedRequiredKycDocuments(provider);
  const primaryBank = provider.bankAccounts?.[0];
  const firstRevenueSignal = providerHasFirstRevenueSignal(provider);
  const agreementsAccepted = provider.agreements?.length ?? 0;
  const locationState = providerLocationStatus(provider, opsPolicy);
  const securityState = providerSecurityStatus(provider);
  const walletBalance = providerUnsettledWalletBalance(provider);

  if (provider.blockedAt) {
    return {
      status: 'ACCOUNT',
      detail: `Partner account is blocked${provider.blockedReason ? `: ${provider.blockedReason}` : '.'}`,
      operatorAction: 'Unblock only after identity, safety, payout, or policy issue is resolved.',
      tone: 'blocked',
      priority: 120,
    };
  }
  if (!provider.displayName?.trim() || !provider.legalName?.trim()) {
    return {
      status: 'PROFILE',
      detail: 'Basic profile is incomplete.',
      operatorAction: 'Ask partner to complete display name and legal name before approval.',
      tone: 'blocked',
      priority: 100,
    };
  }
  if (missingDocuments.length > 0) {
    return {
      status: 'DOCUMENTS',
      detail: `Missing or unapproved: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`,
      operatorAction: 'Open detail and review each typed KYC document.',
      tone: 'blocked',
      priority: 95,
    };
  }
  if (provider.kyc?.status !== 'APPROVED') {
    return {
      status: 'KYC',
      detail: `KYC status is ${provider.kyc?.status ?? 'MISSING'}.`,
      operatorAction: 'Approve or reject KYC with a clear reason.',
      tone: 'blocked',
      priority: provider.kyc?.status === 'REJECTED' ? 92 : 90,
    };
  }
  if (provider.verification?.status !== 'APPROVED') {
    return {
      status: 'VERIFY',
      detail: `Partner verification is ${provider.verification?.status ?? 'DRAFT'}.`,
      operatorAction: 'Approve partner verification when identity review is complete.',
      tone: 'blocked',
      priority: 86,
    };
  }
  if (walletBalance < 0) {
    return {
      status: 'CASH DEBT',
      detail: `Wallet is negative by ${formatProviderMoney(Math.abs(walletBalance))}.`,
      operatorAction: 'Confirm partner fee deposit or settle the cash fee debt from Earnings.',
      tone: 'blocked',
      priority: 85,
    };
  }
  if (providerPublicMediaNeedsReview(provider)) {
    return {
      status: 'MEDIA',
      detail: 'Public profile or gallery media is waiting for admin review.',
      operatorAction: 'Approve safe, original public media or reject unclear uploads with a reason.',
      tone: 'pending',
      priority: 84,
    };
  }
  if (!hasApprovedBankAccount(provider)) {
    return {
      status: 'BANK',
      detail: `Primary bank account is ${primaryBank?.status ?? 'missing'}.`,
      operatorAction: 'Approve or reject bank details before payout readiness.',
      tone: 'blocked',
      priority: primaryBank?.status === 'REJECTED' ? 82 : 80,
    };
  }
  if (firstRevenueSignal && provider.taxProfile?.status !== 'APPROVED') {
    return {
      status: 'TAX',
      detail: `Partner has first earning, but tax profile is ${provider.taxProfile?.status ?? 'missing'}.`,
      operatorAction: 'Approve/reject freelance tax profile before the partner can withdraw earnings.',
      tone: 'blocked',
      priority: provider.taxProfile?.status === 'REJECTED' ? 76 : 74,
    };
  }
  if (firstRevenueSignal && !provider.residentialAddress?.trim()) {
    return {
      status: 'TAX ADDRESS',
      detail: 'Partner has first earning, but residential/tax address is missing.',
      operatorAction: 'Ask partner to add the address needed for tax and payout records.',
      tone: 'blocked',
      priority: 72,
    };
  }
  if (firstRevenueSignal && agreementsAccepted < 5) {
    return {
      status: 'TERMS',
      detail: `Payout agreements are ${agreementsAccepted}/5.`,
      operatorAction: 'Ask partner to accept missing payout/tax/location agreements.',
      tone: 'blocked',
      priority: 70,
    };
  }
  if (securityState === 'account-blocked') {
    return {
      status: 'ACCOUNT',
      detail: 'The partner account is blocked by admin policy.',
      operatorAction: 'Open partner detail and unblock only after the recorded issue is resolved.',
      tone: 'blocked',
      priority: 69,
    };
  }
  if (securityState === 'blocked') {
    return {
      status: 'DEVICE',
      detail: 'At least one partner app device is blocked.',
      operatorAction: 'Open partner detail and decide whether to unblock or keep the device blocked.',
      tone: 'blocked',
      priority: 68,
    };
  }
  if (securityState === 'session-check' || securityState === 'shared') {
    return {
      status: 'SECURITY',
      detail:
        securityState === 'shared'
          ? 'A device appears on more than one partner profile.'
          : 'Recent partner session has a session check record.',
      operatorAction: 'Review device/session history before relying on this partner for dispatch.',
      tone: 'blocked',
      priority: 67,
    };
  }
  if (locationState !== 'recent') {
    return {
      status: 'LOCATION',
      detail: providerLocationAgeLabel(provider.currentLocationUpdatedAt),
      operatorAction: 'Ask partner to open the app and refresh current location.',
      tone: locationState === 'missing' ? 'blocked' : 'pending',
      priority: locationState === 'missing' ? 66 : 58,
    };
  }
  if (!hasHealthyPush(provider)) {
    return {
      status: 'PUSH',
      detail: 'No enabled push device is available for request alerts.',
      operatorAction: 'Ask partner to reopen the app and register alerts.',
      tone: 'pending',
      priority: 54,
    };
  }
  if (!provider.user?.supabaseUserId) {
    return {
      status: 'SUPABASE',
      detail: 'Partner is still on Nest auth only.',
      operatorAction: 'Sync/link Supabase role after Supabase OTP login is active.',
      tone: 'pending',
      priority: 35,
    };
  }
  return {
    status: 'CLEAR',
    detail: 'No partner operation blocker is visible.',
    operatorAction: 'Monitor dispatch and service quality.',
    tone: 'done',
    priority: 0,
  };
}

function missingApprovedRequiredKycDocuments(provider: AdminProvider) {
  const approvedDocuments = new Set(
    (provider.documents ?? [])
      .filter((document) => document.status === 'APPROVED')
      .map((document) => document.type),
  );
  return REQUIRED_KYC_DOCUMENTS.filter((type) => !approvedDocuments.has(type));
}

function providerKycDocumentStatus(provider: AdminProvider, documentType: string) {
  const document = (provider.documents ?? []).find((item) => item.type === documentType);
  return document?.status ?? 'MISSING';
}

function kycDocumentPillClass(status: string) {
  if (status === 'APPROVED') return 'pill-success';
  if (status === 'REJECTED') return 'pill-danger';
  if (status === 'PENDING_REVIEW') return 'pill-warn';
  return 'pill-neutral';
}

function partnerKycState(provider: AdminProvider): PartnerKycState {
  const status = provider.kyc?.status ?? 'MISSING';
  const missingDocuments = missingApprovedRequiredKycDocuments(provider);
  const requiredDocumentStatuses = REQUIRED_KYC_DOCUMENTS.map((type) =>
    providerKycDocumentStatus(provider, type),
  );
  const pendingDocuments = requiredDocumentStatuses.filter((documentStatus) =>
    ['PENDING_REVIEW', 'UPLOADED'].includes(documentStatus),
  ).length;
  const rejectedDocuments = requiredDocumentStatuses.filter(
    (documentStatus) => documentStatus === 'REJECTED',
  ).length;
  const blockedByDocuments = status !== 'APPROVED' && missingDocuments.length > 0;
  const readyToApprove = Boolean(provider.kyc) && status !== 'APPROVED' && missingDocuments.length === 0;
  const needsReview =
    status !== 'APPROVED' || blockedByDocuments || pendingDocuments > 0 || rejectedDocuments > 0;

  if (!provider.kyc) {
    return {
      status,
      missingDocuments,
      pendingDocuments,
      rejectedDocuments,
      readyToApprove,
      blockedByDocuments,
      needsReview,
      detail: 'No KYC record is stored yet.',
      operatorAction: 'Ask the partner to submit CCCD number, CCCD front/back, and selfie evidence.',
    };
  }

  if (readyToApprove) {
    return {
      status,
      missingDocuments,
      pendingDocuments,
      rejectedDocuments,
      readyToApprove,
      blockedByDocuments,
      needsReview,
      detail: 'KYC record and required identity documents are ready.',
      operatorAction: 'Review the detail page, then approve or reject KYC.',
    };
  }

  if (blockedByDocuments) {
    return {
      status,
      missingDocuments,
      pendingDocuments,
      rejectedDocuments,
      readyToApprove,
      blockedByDocuments,
      needsReview,
      detail: `Missing approved evidence: ${missingDocuments.map(providerDocumentLabel).join(', ')}.`,
      operatorAction: 'Approve uploaded evidence first, or reject with a clear resubmission reason.',
    };
  }

  if (status === 'REJECTED' || rejectedDocuments > 0) {
    return {
      status,
      missingDocuments,
      pendingDocuments,
      rejectedDocuments,
      readyToApprove,
      blockedByDocuments,
      needsReview,
      detail: 'KYC or required evidence was rejected.',
      operatorAction: 'Wait for partner resubmission, then re-check the full evidence set.',
    };
  }

  return {
    status,
    missingDocuments,
    pendingDocuments,
    rejectedDocuments,
    readyToApprove,
    blockedByDocuments,
    needsReview,
    detail: status === 'APPROVED' ? 'KYC is approved.' : 'KYC is waiting for operator attention.',
    operatorAction: status === 'APPROVED' ? 'No KYC action required.' : 'Review KYC status and evidence.',
  };
}

function partnerNeedsKycReview(provider: AdminProvider) {
  return partnerKycState(provider).needsReview;
}

function providerListActionPillClass(tone: ProviderListAction['tone']) {
  if (tone === 'done') return 'pill-success';
  if (tone === 'blocked') return 'pill-danger';
  return 'pill-warn';
}

function marketplaceDisplayText(value: string) {
  return value
    .replace(/\bbackup\b/g, 'marketplace')
    .replace(/\bBackup\b/g, 'Marketplace')
    .replace(/\bProvider\b/g, 'Partner')
    .replace(/\bprovider\b/g, 'partner');
}

function providerDisplayName(provider: AdminProvider) {
  return marketplaceDisplayText(provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id);
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

function providerUnsettledWalletBalance(provider: AdminProvider) {
  return (provider.earnings ?? [])
    .filter((earning) => ['PENDING', 'AVAILABLE'].includes(earning.status) && !earning.payoutBatchId)
    .reduce((sum, earning) => sum + numberValue(earning.netAmount), 0);
}

function providerHasFirstRevenueSignal(provider: AdminProvider) {
  return (provider.earnings ?? []).some((earning) =>
    ['PENDING', 'AVAILABLE', 'PAID'].includes(earning.status),
  );
}

function providerPayoutSetupNeedsReview(provider: AdminProvider) {
  if (!providerHasFirstRevenueSignal(provider)) {
    return false;
  }

  return (
    provider.taxProfile?.status !== 'APPROVED' ||
    !provider.residentialAddress?.trim() ||
    (provider.agreements?.length ?? 0) < 5
  );
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value) || 0;
  return 0;
}

function formatProviderMoney(value: number, currency = 'VND') {
  return `${new Intl.NumberFormat('vi-VN').format(value)} ${currency}`;
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
    )}. New booking acceptance stays blocked until finance settles the cash fee debt.`;
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
  const blockers: Array<{ label: string; severity: 'hard' | 'soft' }> = [];
  const locationState = providerLocationStatus(provider, opsPolicy);
  const securityState = providerSecurityStatus(provider);
  const walletBalance = providerUnsettledWalletBalance(provider);

  if (provider.blockedAt) {
    blockers.push({ label: 'account blocked', severity: 'hard' });
  }
  if (provider.verification?.status !== 'APPROVED') {
    blockers.push({ label: `verification ${provider.verification?.status ?? 'DRAFT'}`, severity: 'hard' });
  }
  if (provider.kyc?.status !== 'APPROVED') {
    blockers.push({ label: `KYC ${provider.kyc?.status ?? 'MISSING'}`, severity: 'hard' });
  }
  if (!hasApprovedRequiredKycDocuments(provider)) {
    blockers.push({ label: 'identity documents', severity: 'hard' });
  }
  if (!hasApprovedBankAccount(provider)) {
    blockers.push({ label: 'bank account', severity: 'hard' });
  }
  if (walletBalance < 0) {
    blockers.push({ label: 'wallet debt', severity: 'hard' });
  }
  if (provider.status !== 'ONLINE_AVAILABLE') {
    blockers.push({ label: 'not online available', severity: 'soft' });
  }
  if (locationState !== 'recent') {
    blockers.push({
      label: `location ${locationState}`,
      severity: locationState === 'missing' ? 'hard' : 'soft',
    });
  }
  if (!hasHealthyPush(provider)) {
    blockers.push({ label: 'push missing', severity: 'soft' });
  }
  if (!['clear', 'missing'].includes(securityState)) {
    blockers.push({ label: providerSecurityLabel(securityState).toLowerCase(), severity: 'hard' });
  }

  const eligible = blockers.length === 0;

  return {
    eligible,
    blockers,
    detail: eligible
      ? `Can receive marketplace alerts and join eligible bookings within ${formatDistanceMeters(
          opsPolicy.backupRadiusMeters,
        )} during the ${opsPolicy.responseWindowMinutes}m first-pick window.`
      : `Not ready for marketplace matching until blockers are resolved. Distance is still checked per booking within ${formatDistanceMeters(
          opsPolicy.backupRadiusMeters,
        )}.`,
    operatorAction: eligible
      ? 'For a live booking, confirm the booking address is inside radius before asking this partner to join.'
      : 'Fix the listed blockers before relying on this partner for marketplace participation or customer shortlist recovery.',
  };
}

function hasApprovedRequiredKycDocuments(provider: AdminProvider) {
  return missingApprovedRequiredKycDocuments(provider).length === 0;
}

function buildProviderCommandCenter(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
): ProviderCommandLane[] {
  const verificationReview = providers.filter(
    (provider) => provider.verification?.status !== 'APPROVED',
  ).length;
  const kycReview = providers.filter((provider) =>
    ['PENDING', 'REJECTED', 'MISSING'].includes(provider.kyc?.status ?? 'MISSING'),
  ).length;
  const documentsReview = providers.filter((provider) =>
    (provider.documents ?? []).some((document) => ['PENDING_REVIEW', 'REJECTED'].includes(document.status)),
  ).length;
  const publicMediaReview = providers.filter(providerPublicMediaNeedsReview).length;
  const readyNow = providers.filter((provider) => providerDispatchReady(provider, opsPolicy)).length;
  const online = providers.filter((provider) => provider.status === 'ONLINE_AVAILABLE').length;
  const locationFresh = providers.filter(
    (provider) => providerLocationStatus(provider, opsPolicy) === 'recent',
  ).length;
  const pushReady = providers.filter((provider) => hasHealthyPush(provider)).length;
  const bankReview = providers.filter((provider) => !hasApprovedBankAccount(provider)).length;
  const payoutSetupReview = providers.filter(providerPayoutSetupNeedsReview).length;
  const taxReview = providers.filter(providerTaxNeedsReview).length;
  const walletDebt = providers.filter((provider) => providerUnsettledWalletBalance(provider) < 0).length;
  const accountBlocks = providers.filter((provider) => Boolean(provider.blockedAt)).length;
  const openControlItems = providers.filter((provider) => hasOpenPartnerControl(provider)).length;
  const deviceFollowUp = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'session-check', 'shared'].includes(providerSecurityStatus(provider)),
  ).length;
  const supabasePending = providers.filter((provider) => !provider.user?.supabaseUserId).length;

  return [
    {
      title: 'Onboarding pipeline',
      status: verificationReview + kycReview + documentsReview > 0 ? 'Review needed' : 'Clean',
      tone: verificationReview > 0 || kycReview > 0 ? 'warn' : documentsReview > 0 ? 'info' : 'ok',
      detail:
        verificationReview + kycReview + documentsReview > 0
          ? 'Partners are waiting for identity, verification, or document decisions.'
          : 'No filtered partner is blocked by onboarding review.',
      href: verificationReview > 0 ? '/partners?review=kyc' : '/partners?review=documents',
      metrics: [
        providerCommandMetric('verification', verificationReview),
        providerCommandMetric('KYC', kycReview),
        providerCommandMetric('documents', documentsReview),
        providerCommandMetric('media', publicMediaReview),
      ],
    },
    {
      title: 'Dispatch readiness',
      status: `${readyNow}/${providers.length} ready`,
      tone: readyNow === providers.length ? 'ok' : readyNow > 0 ? 'info' : 'warn',
      detail:
        readyNow > 0
          ? 'Some partners can receive requests now; keep location and push freshness high.'
          : 'No partner in this filtered list is fully ready for dispatch.',
      href: readyNow > 0 ? '/partners?readiness=ready' : '/partners?review=location',
      metrics: [
        providerCommandMetric('online', online),
        providerCommandMetric(`fresh <=${opsPolicy.staleLocationMinutes}m`, locationFresh),
        providerCommandMetric('push ready', pushReady),
        providerCommandMetric('Supabase pending', supabasePending),
      ],
    },
    {
      title: 'Payout and tax',
      status: walletDebt > 0 || payoutSetupReview > 0 ? 'Finance action' : 'Stable',
      tone: walletDebt > 0 ? 'danger' : payoutSetupReview > 0 || taxReview > 0 ? 'warn' : 'ok',
      detail:
        walletDebt > 0
          ? 'Cash fee debt can block partners from accepting new bookings.'
          : 'First-earning payout, bank, and freelance tax readiness are under control.',
      href: walletDebt > 0 ? '/partners?review=cash-debt' : '/partners?review=payout-setup',
      metrics: [
        providerCommandMetric('bank', bankReview),
        providerCommandMetric('tax', taxReview),
        providerCommandMetric('first earning', payoutSetupReview),
        providerCommandMetric('wallet debt', walletDebt),
      ],
    },
    {
      title: 'Reports and devices',
      status: accountBlocks > 0 || openControlItems > 0 || deviceFollowUp > 0 ? 'Investigate' : 'Clear',
      tone: accountBlocks > 0 || openControlItems > 0 ? 'danger' : deviceFollowUp > 0 ? 'warn' : 'ok',
      detail:
        accountBlocks > 0 || openControlItems > 0
          ? 'Account blocks, reports, or active account controls need operator attention.'
          : 'No filtered partner has open reports, active account controls, or device follow-up items.',
      href: openControlItems > 0 ? '/partner-controls' : '/partners?review=security',
      metrics: [
        providerCommandMetric('blocked', accountBlocks),
        providerCommandMetric('open reports', openControlItems),
        providerCommandMetric('device checks', deviceFollowUp),
        providerCommandMetric(
          'shared device',
          providers.filter((provider) => providerSecurityStatus(provider) === 'shared').length,
        ),
      ],
    },
  ];
}

function buildPartnerShiftHandoff(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
): PartnerShiftHandoff {
  const acceptReady = providers.filter((provider) => partnerCanAcceptBookingNow(provider, opsPolicy));
  const backupReady = providers.filter(
    (provider) => partnerBackupMatchingEligibility(provider, opsPolicy).eligible,
  );
  const hardBlocked = providers.filter(partnerHasHardAcceptanceBlocker);
  const cashDebt = providers.filter((provider) => providerUnsettledWalletBalance(provider) < 0);
  const readyKyc = providers.filter((provider) => partnerKycState(provider).readyToApprove);
  const kycBlocked = providers.filter((provider) => {
    const kycState = partnerKycState(provider);
    return (
      kycState.blockedByDocuments || kycState.rejectedDocuments > 0 || provider.kyc?.status === 'REJECTED'
    );
  });
  const locationRefresh = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
  );
  const pushMissing = providers.filter((provider) => !hasHealthyPush(provider));
  const payoutSetup = providers.filter(providerPayoutSetupNeedsReview);
  const accountControlFollowUp = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'session-check', 'shared'].includes(providerSecurityStatus(provider)),
  );
  const publicMedia = providers.filter(providerPublicMediaNeedsReview);

  const actions = [
    cashDebt.length
      ? {
          title: 'Collect cash-fee debt before more bookings',
          scope: 'Finance gate',
          detail: `${cashDebt.length} partner(s) have negative wallet balance from cash-service fee or tax debt.`,
          operatorAction:
            'Collect company fee deposit, record evidence, or offset from available earnings before allowing acceptance.',
          href: '/partners?review=cash-debt',
          tone: 'danger' as const,
          samples: partnerSampleNames(cashDebt),
        }
      : null,
    readyKyc.length
      ? {
          title: 'Approve KYC records that are ready',
          scope: 'KYC review',
          detail: `${readyKyc.length} partner(s) have required CCCD/selfie evidence ready for admin decision.`,
          operatorAction:
            'Open each detail page, verify evidence, then approve or reject with a clear reason.',
          href: '/partners?review=kyc',
          tone: 'warn' as const,
          samples: partnerSampleNames(readyKyc),
        }
      : null,
    kycBlocked.length
      ? {
          title: 'Request KYC resubmission where evidence is blocked',
          scope: 'Identity blocker',
          detail: `${kycBlocked.length} partner(s) cannot move forward because identity evidence is missing or rejected.`,
          operatorAction:
            'Use rejection reasons and resubmission guidance before the partner can become dispatch-ready.',
          href: '/partners?review=documents',
          tone: 'warn' as const,
          samples: partnerSampleNames(kycBlocked),
        }
      : null,
    payoutSetup.length
      ? {
          title: 'Finish first-earning payout and tax setup',
          scope: 'Payout gate',
          detail: `${payoutSetup.length} partner(s) have revenue signal but still need tax, address, or agreement readiness.`,
          operatorAction:
            'Ask for tax profile/address/terms only after first revenue, then approve before withdrawal.',
          href: '/partners?review=payout-setup',
          tone: 'warn' as const,
          samples: partnerSampleNames(payoutSetup),
        }
      : null,
    accountControlFollowUp.length
      ? {
          title: 'Review device or account controls before dispatch',
          scope: 'Control gate',
          detail: `${accountControlFollowUp.length} partner(s) have blocked devices, session checks, shared devices, or account block state.`,
          operatorAction: 'Open partner control history before relying on them for customer bookings.',
          href: '/partners?review=security',
          tone: 'danger' as const,
          samples: partnerSampleNames(accountControlFollowUp),
        }
      : null,
    locationRefresh.length
      ? {
          title: 'Refresh partner locations for dispatch accuracy',
          scope: 'Location',
          detail: `${locationRefresh.length} partner(s) need a current location before direct request or marketplace matching.`,
          operatorAction: `Ask partners to open the app; location must be fresh within ${opsPolicy.staleLocationMinutes} minutes.`,
          href: '/partners?review=location',
          tone: acceptReady.length ? ('info' as const) : ('warn' as const),
          samples: partnerSampleNames(locationRefresh),
        }
      : null,
    pushMissing.length
      ? {
          title: 'Repair request alert readiness',
          scope: 'Alerts',
          detail: `${pushMissing.length} partner(s) have no enabled push device, so urgent booking alerts may be missed.`,
          operatorAction:
            'Ask partners to reopen the app and register notifications before relying on push outreach.',
          href: '/partners?review=push',
          tone: 'info' as const,
          samples: partnerSampleNames(pushMissing),
        }
      : null,
    publicMedia.length
      ? {
          title: 'Moderate public partner media',
          scope: 'Profile',
          detail: `${publicMedia.length} partner(s) have profile/gallery media waiting for admin review.`,
          operatorAction:
            'Approve original, safe media or reject unclear uploads before final visual redesign.',
          href: '/partners?review=public-media',
          tone: 'info' as const,
          samples: partnerSampleNames(publicMedia),
        }
      : null,
    acceptReady.length
      ? {
          title: 'Keep ready partners warm for live requests',
          scope: 'Dispatch supply',
          detail: `${acceptReady.length} partner(s) can accept direct bookings now; ${backupReady.length} are also marketplace-ready.`,
          operatorAction: 'Use these partners first when matching demand spikes or customer wait time rises.',
          href: '/partners?review=direct-ready',
          tone: 'ok' as const,
          samples: partnerSampleNames(acceptReady),
        }
      : null,
  ].filter((item): item is PartnerShiftHandoff['actions'][number] => Boolean(item));

  const topAction =
    actions.find((item) => item.tone === 'danger') ??
    actions.find((item) => item.tone === 'warn') ??
    actions[0];
  const tone =
    cashDebt.length || accountControlFollowUp.length
      ? 'danger'
      : hardBlocked.length || readyKyc.length || payoutSetup.length
        ? 'warn'
        : acceptReady.length
          ? 'ok'
          : 'info';

  return {
    tone,
    label:
      tone === 'danger'
        ? 'Immediate check'
        : tone === 'warn'
          ? 'Action needed'
          : tone === 'ok'
            ? 'Dispatch ready'
            : 'Monitor',
    headline: topAction?.title ?? 'No urgent partner operation item',
    detail:
      topAction?.operatorAction ??
      'The current filtered partner queue has no immediate blocker. Keep monitoring booking demand, location freshness, and cash debt.',
    primaryAction: {
      label: topAction ? 'Open partner work queue' : 'Open dispatch-ready partners',
      href: topAction?.href ?? '/partners?review=direct-ready',
    },
    stats: [
      {
        label: 'Can accept now',
        value: acceptReady.length.toString(),
        detail: `${backupReady.length} marketplace-ready within current policy gates.`,
        href: '/partners?review=direct-ready',
        tone: acceptReady.length ? 'ok' : 'warn',
      },
      {
        label: 'Hard blocked',
        value: hardBlocked.length.toString(),
        detail: 'Account, KYC, bank, wallet, device/session, or identity blockers.',
        href: '/partners?review=acceptance-blocked',
        tone: hardBlocked.length ? 'danger' : 'ok',
      },
      {
        label: 'Cash debt',
        value: cashDebt.length.toString(),
        detail: 'Negative wallet blocks new booking acceptance.',
        href: '/partners?review=cash-debt',
        tone: cashDebt.length ? 'danger' : 'ok',
      },
      {
        label: 'KYC ready',
        value: readyKyc.length.toString(),
        detail: 'Identity evidence ready for admin decision.',
        href: '/partners?review=kyc',
        tone: readyKyc.length ? 'warn' : 'ok',
      },
      {
        label: 'Location refresh',
        value: locationRefresh.length.toString(),
        detail: `Fresh location policy is ${opsPolicy.staleLocationMinutes} minutes.`,
        href: '/partners?review=location',
        tone: locationRefresh.length ? 'warn' : 'ok',
      },
      {
        label: 'Payout setup',
        value: payoutSetup.length.toString(),
        detail: 'First-revenue tax/address/agreement gate.',
        href: '/partners?review=payout-setup',
        tone: payoutSetup.length ? 'warn' : 'ok',
      },
    ],
    actions: actions.slice(0, 6),
  };
}

function buildPartnerDispatchHandoff(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
): PartnerDispatchHandoff {
  const directReady = providers.filter((provider) => partnerCanAcceptBookingNow(provider, opsPolicy));
  const backupReady = providers.filter(
    (provider) => partnerBackupMatchingEligibility(provider, opsPolicy).eligible,
  );
  const acceptanceBlocked = providers.filter((provider) => !partnerCanAcceptBookingNow(provider, opsPolicy));
  const cashDebt = providers.filter((provider) => providerUnsettledWalletBalance(provider) < 0);
  const locationRefresh = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
  );
  const pushRepair = providers.filter((provider) => !hasHealthyPush(provider));
  const reportReview = providers.filter((provider) => hasOpenPartnerControl(provider));

  return {
    headline:
      'When Bookings shows matching pressure, jump from here to the exact partner lane that can unblock dispatch.',
    detail: `Current policy: first partner response window ${opsPolicy.responseWindowMinutes}m, marketplace radius ${formatDistanceMeters(
      opsPolicy.backupRadiusMeters,
    )}, fresh location within ${opsPolicy.staleLocationMinutes}m.`,
    policyLabel: 'Edit dispatch policy',
    links: [
      {
        title: 'Matching queue',
        value: 'Open',
        detail: 'Live bookings waiting for preferred response, marketplace supply, or customer selection.',
        href: '/bookings?view=matching',
        tone: 'info',
      },
      {
        title: 'Direct ready',
        value: directReady.length.toString(),
        detail: 'Partners who can accept the first customer request immediately.',
        href: '/partners?review=direct-ready',
        tone: directReady.length ? 'ok' : 'warn',
      },
      {
        title: 'Marketplace ready',
        value: backupReady.length.toString(),
        detail: 'Partners eligible to receive marketplace alerts and join the customer shortlist.',
        href: '/partners?review=marketplace-ready',
        tone: backupReady.length ? 'ok' : 'warn',
      },
      {
        title: 'Acceptance blocked',
        value: acceptanceBlocked.length.toString(),
        detail: 'Partners blocked by KYC, bank, wallet, location, push, or control gates.',
        href: '/partners?review=acceptance-blocked',
        tone: acceptanceBlocked.length ? 'danger' : 'ok',
      },
      {
        title: 'Cash fee debt',
        value: cashDebt.length.toString(),
        detail: 'Negative wallet partners cannot accept bookings until company commission is settled.',
        href: '/cash-settlements',
        tone: cashDebt.length ? 'danger' : 'ok',
      },
      {
        title: 'Location refresh',
        value: locationRefresh.length.toString(),
        detail: 'Partners who must reopen the app before distance-based matching uses their location.',
        href: '/partners?review=location',
        tone: locationRefresh.length ? 'warn' : 'ok',
      },
      {
        title: 'Push repair',
        value: pushRepair.length.toString(),
        detail: 'Partners who may miss direct or marketplace request alerts.',
        href: '/partners?review=push',
        tone: pushRepair.length ? 'warn' : 'ok',
      },
      {
        title: 'Reports desk',
        value: reportReview.length.toString(),
        detail: 'Partners with reports or account controls that should be checked before dispatch.',
        href: '/partner-controls',
        tone: reportReview.length ? 'danger' : 'info',
      },
    ],
  };
}

function buildPartnerDailyActionQueue(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
): PartnerDailyActionQueue {
  const actionRows = providers
    .map((provider) => {
      const action = nextProviderListAction(provider, opsPolicy);
      return {
        provider,
        action,
        href: partnerDetailActionHref(provider, action),
        lane: partnerDailyActionLane(action.status),
        sla: partnerDailyActionSla(action),
        age: partnerDailyActionAgeSignal(provider, action),
        tone: partnerDailyActionTone(action),
      };
    })
    .filter((row) => row.action.tone !== 'done')
    .sort((left, right) => {
      if (left.action.priority !== right.action.priority) {
        return right.action.priority - left.action.priority;
      }
      return providerDisplayName(left.provider).localeCompare(providerDisplayName(right.provider));
    });

  return {
    urgentCount: actionRows.filter((row) => row.action.priority >= 85).length,
    blockedCount: actionRows.filter((row) => row.action.tone === 'blocked').length,
    dispatchReadyCount: providers.filter((provider) => providerDispatchReady(provider, opsPolicy)).length,
    rows: actionRows.slice(0, 10),
  };
}

function partnerDailyActionTone(action: ProviderListAction): ProviderCommandLane['tone'] {
  if (action.tone === 'blocked' && action.priority >= 85) return 'danger';
  if (action.tone === 'blocked') return 'warn';
  if (action.tone === 'pending') return 'info';
  return 'ok';
}

function partnerDailyActionLane(status: string) {
  const laneByStatus: Record<string, string> = {
    ACCOUNT: 'Safety',
    PROFILE: 'Onboarding',
    DOCUMENTS: 'KYC evidence',
    KYC: 'KYC decision',
    VERIFY: 'Partner approval',
    'CASH DEBT': 'Cash settlement',
    MEDIA: 'Public profile',
    BANK: 'Bank payout',
    TAX: 'Tax payout',
    'TAX ADDRESS': 'Tax payout',
    TERMS: 'Legal consent',
    DEVICE: 'Device control',
    SECURITY: 'Account review',
    LOCATION: 'Dispatch readiness',
    PUSH: 'Alert readiness',
    SUPABASE: 'Auth migration',
  };
  return laneByStatus[status] ?? 'Operations';
}

function partnerDailyActionSla(action: ProviderListAction) {
  if (action.priority >= 90) return 'Same shift';
  if (action.priority >= 80) return 'Today';
  if (action.priority >= 65) return 'Before next booking';
  if (action.priority >= 50) return 'Before dispatch';
  return 'Backlog';
}

function partnerDailyActionAgeSignal(provider: AdminProvider, action: ProviderListAction) {
  if (action.status === 'LOCATION') {
    return providerLocationAgeLabel(provider.currentLocationUpdatedAt);
  }
  if (action.status === 'KYC' || action.status === 'DOCUMENTS') {
    return providerSubmittedAgeLabel(provider.kyc?.submittedAt ?? provider.verification?.submittedAt);
  }
  if (action.status === 'VERIFY') {
    return providerSubmittedAgeLabel(provider.verification?.submittedAt);
  }
  if (action.status === 'BANK') {
    return providerReviewedAgeLabel(provider.bankAccounts?.[0]?.reviewedAt);
  }
  if (action.status === 'CASH DEBT') {
    return 'Blocks acceptance now.';
  }
  if (action.status === 'PUSH') {
    return latestPushAgeLabel(provider);
  }
  if (action.status === 'DEVICE' || action.status === 'SECURITY' || action.status === 'ACCOUNT') {
    return latestSecurityAgeLabel(provider);
  }
  if (action.status === 'TAX' || action.status === 'TAX ADDRESS' || action.status === 'TERMS') {
    return 'Required after first earning.';
  }
  return 'Review when queue reaches this row.';
}

function providerSubmittedAgeLabel(value?: string | null) {
  if (!value) return 'No submitted timestamp.';
  return `Submitted ${formatRelativeAge(value)}.`;
}

function providerReviewedAgeLabel(value?: string | null) {
  if (!value) return 'No review timestamp.';
  return `Reviewed ${formatRelativeAge(value)}.`;
}

function latestPushAgeLabel(provider: AdminProvider) {
  const latestPushTime = (provider.user?.pushDevices ?? [])
    .map((device) => Date.parse(device.createdAt ?? ''))
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0];
  return latestPushTime
    ? `Latest push device ${formatRelativeAge(new Date(latestPushTime).toISOString())}.`
    : 'No push device registered.';
}

function latestSecurityAgeLabel(provider: AdminProvider) {
  const latestSession = provider.sessions?.[0];
  if (latestSession?.lastSeenAt) {
    return `Last session ${formatRelativeAge(latestSession.lastSeenAt)}.`;
  }
  const blockedDevice = (provider.devices ?? []).find((device) => device.blockedAt);
  if (blockedDevice?.blockedAt) {
    return `Device blocked ${formatRelativeAge(blockedDevice.blockedAt)}.`;
  }
  return 'No recent session signal.';
}

function partnerSampleNames(providers: AdminProvider[], limit = 4) {
  return providers.slice(0, limit).map(providerDisplayName);
}

function providerDashboardTone(tone: ProviderCommandLane['tone']) {
  if (tone === 'danger') return 'danger';
  if (tone === 'warn') return 'warn';
  if (tone === 'info') return 'info';
  return 'ok';
}

function partnerShiftCardClass(tone: ProviderCommandLane['tone']) {
  if (tone === 'danger') return 'ops-task-blocked';
  if (tone === 'warn') return 'ops-task-pending';
  return 'ops-task-done';
}

function partnerShiftPillClass(tone: ProviderCommandLane['tone']) {
  if (tone === 'danger') return 'pill-danger';
  if (tone === 'warn') return 'pill-warn';
  if (tone === 'info') return 'pill-info';
  return 'pill-success';
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

function providerCommandMetric(label: string, value: number) {
  return { label, value: value.toString() };
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

function buildPartnerDispatchForecast(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
): PartnerDispatchForecast {
  const readyNow = providers.filter((provider) => providerDispatchReady(provider, opsPolicy)).length;
  const online = providers.filter((provider) => provider.status === 'ONLINE_AVAILABLE').length;
  const bookingBase = providers.filter((provider) => !partnerHasHardAcceptanceBlocker(provider)).length;
  const locationNeedsRefresh = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
  ).length;
  const pushMissing = providers.filter((provider) => !hasHealthyPush(provider)).length;
  const walletDebt = providers.filter((provider) => providerUnsettledWalletBalance(provider) < 0).length;
  const deviceSessionFollowUp = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'session-check', 'shared'].includes(providerSecurityStatus(provider)),
  ).length;
  const hardBlocked = providers.filter((provider) => partnerHasHardAcceptanceBlocker(provider)).length;
  const payoutLocked = providers.filter(providerPayoutSetupNeedsReview).length;
  const approvedOffline = providers.filter(
    (provider) => !partnerHasHardAcceptanceBlocker(provider) && provider.status !== 'ONLINE_AVAILABLE',
  ).length;
  const recoverableNow = providers.filter((provider) => {
    if (providerDispatchReady(provider, opsPolicy)) return false;
    if (partnerHasHardAcceptanceBlocker(provider)) return false;
    if (!['clear', 'missing'].includes(providerSecurityStatus(provider))) return false;
    return (
      provider.status !== 'ONLINE_AVAILABLE' ||
      providerLocationStatus(provider, opsPolicy) !== 'recent' ||
      !hasHealthyPush(provider)
    );
  }).length;

  return {
    totals: [
      {
        label: 'Ready now',
        value: `${readyNow}/${providers.length}`,
        detail: 'Approved, online, fresh location, clear device checks, and push-ready partners.',
        tone: readyNow > 0 ? 'ok' : 'warn',
        href: '/partners?readiness=ready',
      },
      {
        label: 'Recoverable today',
        value: recoverableNow.toString(),
        detail:
          'Approved partners likely recoverable by going online, refreshing location, or enabling push.',
        tone: recoverableNow > 0 ? 'info' : 'ok',
        href: recoverableNow > 0 ? '/partners?readiness=approved-offline' : '/partners',
      },
      {
        label: 'Online capacity',
        value: `${online}/${bookingBase}`,
        detail:
          'Partners currently online versus the pool that has passed identity, bank, wallet, and control gates.',
        tone: online > 0 ? 'info' : bookingBase > 0 ? 'warn' : 'danger',
        href: '/partners?providerStatus=ONLINE_AVAILABLE',
      },
      {
        label: 'Hard blockers',
        value: hardBlocked.toString(),
        detail:
          'Identity, account, cash debt, or device/session blockers that should not be bypassed by dispatch.',
        tone: hardBlocked > 0 ? 'danger' : 'ok',
        href: walletDebt > 0 ? '/partners?review=cash-debt' : '/partners?review=security',
      },
    ],
    blockers: [
      {
        label: 'Location refresh',
        count: locationNeedsRefresh,
        detail: `Partner location is missing, expired, or older than ${opsPolicy.staleLocationMinutes} minutes.`,
        href: '/partners?review=location',
        tone: locationNeedsRefresh > 0 ? 'warn' : 'ok',
      },
      {
        label: 'Push alerts missing',
        count: pushMissing,
        detail: 'Direct booking and marketplace matching alerts may not reach these partners.',
        href: '/partners?review=push',
        tone: pushMissing > 0 ? 'warn' : 'ok',
      },
      {
        label: 'Approved but offline',
        count: approvedOffline,
        detail: 'Approved partners who can become useful supply once they open the Partner app.',
        href: '/partners?readiness=approved-offline',
        tone: approvedOffline > 0 ? 'info' : 'ok',
      },
      {
        label: 'Wallet debt',
        count: walletDebt,
        detail: 'Cash fee debt blocks accepting bookings until settlement is confirmed.',
        href: '/partners?review=cash-debt',
        tone: walletDebt > 0 ? 'danger' : 'ok',
      },
      {
        label: 'Payout/tax lock',
        count: payoutLocked,
        detail: 'First-earning partners who still need tax, bank, address, or agreement completion.',
        href: '/partners?review=payout-setup',
        tone: payoutLocked > 0 ? 'warn' : 'ok',
      },
      {
        label: 'Device/session review',
        count: deviceSessionFollowUp,
        detail: 'Blocked, shared, checked, or account-blocked partner devices/sessions.',
        href: '/partners?review=security',
        tone: deviceSessionFollowUp > 0 ? 'danger' : 'ok',
      },
    ],
    supplyLanes: buildPartnerSupplyLanes(providers, opsPolicy),
  };
}

function buildPartnerAcceptanceBlockerBoard(
  providers: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
): PartnerAcceptanceBlockerBoard {
  const cashDebt = providers.filter((provider) => providerUnsettledWalletBalance(provider) < 0);
  const accountOrSecurity = providers.filter(
    (provider) =>
      Boolean(provider.blockedAt) ||
      ['account-blocked', 'blocked', 'session-check', 'shared'].includes(providerSecurityStatus(provider)),
  );
  const locationHold = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
  );
  const pushHold = providers.filter((provider) => !hasHealthyPush(provider));
  const onboardingHold = providers.filter(
    (provider) =>
      provider.verification?.status !== 'APPROVED' ||
      provider.kyc?.status !== 'APPROVED' ||
      !hasApprovedRequiredKycDocuments(provider),
  );
  const bankBookingHold = providers.filter((provider) => !hasApprovedBankAccount(provider));
  const firstEarningPayoutGate = providers.filter(providerPayoutSetupNeedsReview);
  const hardBlocked = providers.filter((provider) => partnerHasHardAcceptanceBlocker(provider)).length;
  const eligibleNow = providers.filter((provider) => partnerCanAcceptBookingNow(provider, opsPolicy)).length;

  return {
    hardBlocked,
    eligibleNow,
    cards: [
      {
        title: 'Cash fee settlement',
        count: cashDebt.length,
        status: cashDebt.length ? 'Blocks accept' : 'Clear',
        detail:
          'Negative wallet from cash bookings blocks booking acceptance until HANDS fee settlement is posted.',
        operatorAction: 'Open the cash debt queue and confirm settlement before allowing more booking work.',
        href: '/partners?review=cash-debt',
        tone: cashDebt.length ? 'danger' : 'ok',
        samples: partnerBlockerSamples(cashDebt),
      },
      {
        title: 'Account and device controls',
        count: accountOrSecurity.length,
        status: accountOrSecurity.length ? 'Do not dispatch' : 'Clear',
        detail:
          'Blocked accounts, blocked devices, shared devices, or session checks must stay out of matching.',
        operatorAction:
          'Resolve account controls in Partner Controls before overriding any booking decision.',
        href: '/partner-controls',
        tone: accountOrSecurity.length ? 'danger' : 'ok',
        samples: partnerBlockerSamples(accountOrSecurity),
      },
      {
        title: 'Location freshness',
        count: locationHold.length,
        status: locationHold.length ? 'Needs app open' : 'Fresh',
        detail: `Marketplace matching uses the last location. Partners older than ${opsPolicy.staleLocationMinutes} minutes need an app-open refresh before 10km dispatch.`,
        operatorAction:
          'Ask partners to open the app so location refreshes before they receive or join requests.',
        href: '/partners?review=location',
        tone: locationHold.length ? 'warn' : 'ok',
        samples: partnerBlockerSamples(locationHold),
      },
      {
        title: 'Push alert reachability',
        count: pushHold.length,
        status: pushHold.length ? 'Alert gap' : 'Ready',
        detail: 'Partners without enabled push devices may miss first-pick and marketplace participation prompts.',
        operatorAction:
          'Use in-app refresh, token registration, or direct contact before relying on them for demand.',
        href: '/partners?review=push',
        tone: pushHold.length ? 'warn' : 'ok',
        samples: partnerBlockerSamples(pushHold),
      },
      {
        title: 'Identity and onboarding',
        count: onboardingHold.length,
        status: onboardingHold.length ? 'Review needed' : 'Approved',
        detail:
          'Partners should not receive paid jobs until verification, KYC, and required identity documents are approved.',
        operatorAction: 'Review KYC, documents, public media, and partner approval status in one queue.',
        href: '/partners?review=kyc',
        tone: onboardingHold.length ? 'warn' : 'ok',
        samples: partnerBlockerSamples(onboardingHold),
      },
      {
        title: 'Bank booking gate',
        count: bankBookingHold.length,
        status: bankBookingHold.length ? 'Blocks booking' : 'Approved',
        detail: 'A partner needs at least one approved bank account before receiving paid booking work.',
        operatorAction:
          'Approve or reject bank account evidence so booking readiness matches API enforcement.',
        href: '/partners?review=bank',
        tone: bankBookingHold.length ? 'warn' : 'ok',
        samples: partnerBlockerSamples(bankBookingHold),
      },
      {
        title: 'First earning payout gate',
        count: firstEarningPayoutGate.length,
        status: firstEarningPayoutGate.length ? 'Payout locked' : 'Deferred',
        detail:
          'Tax and full payout setup are requested after first earning, not before signup, to reduce onboarding drop-off.',
        operatorAction:
          'Keep booking work possible, but block withdrawals until tax, address, bank, and terms are complete.',
        href: '/partners?review=payout-setup',
        tone: firstEarningPayoutGate.length ? 'info' : 'ok',
        samples: partnerBlockerSamples(firstEarningPayoutGate),
      },
    ],
  };
}

function buildPartnerKycReviewBoard(providers: AdminProvider[]): PartnerKycReviewBoard {
  const missingKyc = providers.filter((provider) => !provider.kyc);
  const pendingKyc = providers.filter((provider) => provider.kyc?.status === 'PENDING');
  const rejectedKyc = providers.filter((provider) => provider.kyc?.status === 'REJECTED');
  const blockedByDocuments = providers.filter((provider) => partnerKycState(provider).blockedByDocuments);
  const readyToApprove = providers.filter((provider) => partnerKycState(provider).readyToApprove);
  const pendingRequiredDocuments = providers.filter((provider) =>
    REQUIRED_KYC_DOCUMENTS.some((type) =>
      ['PENDING_REVIEW', 'UPLOADED'].includes(providerKycDocumentStatus(provider, type)),
    ),
  );
  const openCount = providers.filter(partnerNeedsKycReview).length;

  return {
    openCount,
    readyToApprove: readyToApprove.length,
    blockedByDocuments: blockedByDocuments.length,
    playbook: [
      {
        status: pendingRequiredDocuments.length ? '1ST' : 'OK',
        title: 'Review uploaded identity files first',
        count: pendingRequiredDocuments.length,
        detail:
          'CCCD front/back and selfie evidence should be approved or rejected before the final KYC decision.',
        operatorAction:
          'Check file type, face/ID consistency, image clarity, and reject with a specific resubmission reason when unclear.',
        href: '/partners?review=documents',
      },
      {
        status: readyToApprove.length ? '2ND' : 'OK',
        title: 'Approve complete KYC records',
        count: readyToApprove.length,
        detail:
          'These partners already have approved required evidence and only need the final KYC status decision.',
        operatorAction:
          'Approve when legal name, CCCD last four, selfie, and profile identity are consistent.',
        href: '/partners?review=kyc',
      },
      {
        status: rejectedKyc.length ? 'FOLLOW' : 'OK',
        title: 'Follow up rejected KYC',
        count: rejectedKyc.length,
        detail:
          'Rejected KYC should not disappear from operations until the partner has clear instructions and uploads corrected evidence.',
        operatorAction: 'Use the partner detail resubmission guidance so support can send a precise message.',
        href: '/partners?review=kyc',
      },
      {
        status: missingKyc.length ? 'BLOCK' : 'OK',
        title: 'Keep missing KYC out of paid dispatch',
        count: missingKyc.length,
        detail:
          'Minimal signup is allowed, but partners without KYC cannot accept paid requests or marketplace matching.',
        operatorAction:
          'Let onboarding stay light, then prompt KYC before the partner becomes activity-ready.',
        href: '/partners?review=acceptance-blocked',
      },
    ],
    cards: [
      {
        title: 'Ready to approve',
        count: readyToApprove.length,
        status: readyToApprove.length ? 'Decision needed' : 'Clear',
        detail: 'KYC record exists and all required CCCD/selfie evidence is already approved.',
        operatorAction: 'Open partner detail and make the final approve/reject decision.',
        href: '/partners?review=kyc',
        tone: readyToApprove.length ? 'info' : 'ok',
        samples: partnerBlockerSamples(readyToApprove),
      },
      {
        title: 'Blocked by identity documents',
        count: blockedByDocuments.length,
        status: blockedByDocuments.length ? 'Evidence gap' : 'Clear',
        detail: 'At least one required CCCD front, CCCD back, or selfie document is not approved yet.',
        operatorAction: 'Approve uploaded evidence first, or reject with a resubmission reason.',
        href: '/partners?review=kyc',
        tone: blockedByDocuments.length ? 'warn' : 'ok',
        samples: partnerBlockerSamples(blockedByDocuments),
      },
      {
        title: 'Pending document review',
        count: pendingRequiredDocuments.length,
        status: pendingRequiredDocuments.length ? 'Check files' : 'Clear',
        detail: 'Required identity evidence is uploaded and waiting for document-level review.',
        operatorAction: 'Review file type, face/ID match, and file quality before approving KYC.',
        href: '/partners?review=documents',
        tone: pendingRequiredDocuments.length ? 'warn' : 'ok',
        samples: partnerBlockerSamples(pendingRequiredDocuments),
      },
      {
        title: 'Missing KYC record',
        count: missingKyc.length,
        status: missingKyc.length ? 'Not submitted' : 'Clear',
        detail: 'Partner signed up but has not submitted CCCD number and identity review data.',
        operatorAction: 'Keep signup friction low, but block paid dispatch until KYC is submitted.',
        href: '/partners?review=kyc',
        tone: missingKyc.length ? 'warn' : 'ok',
        samples: partnerBlockerSamples(missingKyc),
      },
      {
        title: 'Rejected KYC',
        count: rejectedKyc.length,
        status: rejectedKyc.length ? 'Needs resubmit' : 'Clear',
        detail: 'Rejected KYC should stay visible until the partner uploads corrected evidence.',
        operatorAction: 'Confirm rejection reason is specific enough for partner support follow-up.',
        href: '/partners?review=kyc',
        tone: rejectedKyc.length ? 'danger' : 'ok',
        samples: partnerBlockerSamples(rejectedKyc),
      },
      {
        title: 'Pending KYC',
        count: pendingKyc.length,
        status: pendingKyc.length ? 'Review queue' : 'Clear',
        detail: 'Submitted KYC records still need an operator decision.',
        operatorAction: 'Prioritize partners with complete evidence and recent activity first.',
        href: '/partners?review=kyc',
        tone: pendingKyc.length ? 'info' : 'ok',
        samples: partnerBlockerSamples(pendingKyc),
      },
    ],
  };
}

function partnerHasHardAcceptanceBlocker(provider: AdminProvider) {
  return (
    Boolean(provider.blockedAt) ||
    provider.verification?.status !== 'APPROVED' ||
    provider.kyc?.status !== 'APPROVED' ||
    !hasApprovedRequiredKycDocuments(provider) ||
    !hasApprovedBankAccount(provider) ||
    providerUnsettledWalletBalance(provider) < 0 ||
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

function partnerBlockerSamples(providers: AdminProvider[]) {
  return providers.slice(0, 3).map(providerDisplayName);
}

function buildPartnerSupplyLanes(providers: AdminProvider[], opsPolicy: ProviderOpsPolicy) {
  const lanes = new Map<string, PartnerDispatchForecast['supplyLanes'][number]>();

  for (const provider of providers) {
    const city = provider.city?.trim() || 'Unknown city';
    const lane = lanes.get(city) ?? {
      city,
      total: 0,
      ready: 0,
      online: 0,
      locationNeedsRefresh: 0,
      blocked: 0,
    };

    lane.total += 1;
    if (providerDispatchReady(provider, opsPolicy)) {
      lane.ready += 1;
    }
    if (provider.status === 'ONLINE_AVAILABLE') {
      lane.online += 1;
    }
    if (providerLocationStatus(provider, opsPolicy) !== 'recent') {
      lane.locationNeedsRefresh += 1;
    }
    if (
      provider.blockedAt ||
      provider.verification?.status !== 'APPROVED' ||
      providerUnsettledWalletBalance(provider) < 0 ||
      ['account-blocked', 'blocked', 'session-check', 'shared'].includes(providerSecurityStatus(provider))
    ) {
      lane.blocked += 1;
    }
    lanes.set(city, lane);
  }

  return Array.from(lanes.values())
    .sort((left, right) => {
      if (left.ready !== right.ready) return right.ready - left.ready;
      if (left.online !== right.online) return right.online - left.online;
      if (left.total !== right.total) return right.total - left.total;
      return left.city.localeCompare(right.city);
    })
    .slice(0, 6);
}

function buildProviderSummary(providers: AdminProvider[], opsPolicy: ProviderOpsPolicy) {
  const accountBlocked = providers.filter((provider) => Boolean(provider.blockedAt)).length;
  const approved = providers.filter((provider) => provider.verification?.status === 'APPROVED').length;
  const online = providers.filter((provider) => provider.status === 'ONLINE_AVAILABLE').length;
  const recentLocation = providers.filter(
    (provider) => providerLocationStatus(provider, opsPolicy) === 'recent',
  ).length;
  const staleLocation = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
  ).length;
  const pushReady = providers.filter((provider) => hasHealthyPush(provider)).length;
  const pushDisabled = providers.filter((provider) =>
    (provider.user?.pushDevices ?? []).some((device) => !device.enabled),
  ).length;
  const publicMediaReview = providers.filter(providerPublicMediaNeedsReview).length;
  const payoutSetupReview = providers.filter(providerPayoutSetupNeedsReview).length;
  const walletDebt = providers.filter((provider) => providerUnsettledWalletBalance(provider) < 0).length;
  const openControlItems = providers.filter((provider) => hasOpenPartnerControl(provider)).length;
  const deviceFollowUp = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'session-check', 'shared'].includes(providerSecurityStatus(provider)),
  ).length;
  const readyNow = providers.filter((provider) => providerDispatchReady(provider, opsPolicy)).length;

  return [
    ['Total partners', providers.length.toString()],
    ['Account blocked', accountBlocked.toString()],
    ['Approved', approved.toString()],
    ['Online now', online.toString()],
    [`Recent location <=${opsPolicy.staleLocationMinutes}m`, recentLocation.toString()],
    ['Location needs review', staleLocation.toString()],
    ['Push ready', pushReady.toString()],
    ['Push needs review', pushDisabled.toString()],
    ['Public media review', publicMediaReview.toString()],
    ['First earning setup', payoutSetupReview.toString()],
    ['Wallet debt', walletDebt.toString()],
    ['Open reports', openControlItems.toString()],
    ['Device checks', deviceFollowUp.toString()],
    ['Ready for dispatch', readyNow.toString()],
  ] as const;
}

function buildPartnerFilterSummary(
  providers: AdminProvider[],
  allProviders: AdminProvider[],
  opsPolicy: ProviderOpsPolicy,
  activeFilterCount: number,
) {
  const directReady = providers.filter((provider) => partnerCanAcceptBookingNow(provider, opsPolicy)).length;
  const backupReady = providers.filter(
    (provider) => partnerBackupMatchingEligibility(provider, opsPolicy).eligible,
  ).length;
  const walletDebt = providers.filter((provider) => providerUnsettledWalletBalance(provider) < 0).length;
  const locationNeedsRefresh = providers.filter(
    (provider) => providerLocationStatus(provider, opsPolicy) !== 'recent',
  ).length;
  const kycOrDocumentWork = providers.filter(
    (provider) =>
      partnerNeedsKycReview(provider) ||
      missingApprovedRequiredKycDocuments(provider).length > 0 ||
      (provider.documents ?? []).some((document) => ['PENDING_REVIEW', 'REJECTED'].includes(document.status)),
  ).length;
  const pushReady = providers.filter((provider) => hasHealthyPush(provider)).length;

  return [
    {
      label: 'Filtered rows',
      value: `${providers.length}/${allProviders.length}`,
      detail:
        activeFilterCount > 0
          ? `${activeFilterCount} active filter(s) are narrowing the partner list`
          : 'No active filters, full partner list is available for export',
    },
    {
      label: 'Direct ready',
      value: directReady.toString(),
      detail: 'Can accept a direct customer request with current policy gates',
      href: '/partners?review=direct-ready',
    },
    {
      label: 'Marketplace ready',
      value: backupReady.toString(),
      detail: 'Can join open marketplace matching under current operating policy',
      href: '/partners?review=marketplace-ready',
    },
    {
      label: 'Wallet settlement',
      value: walletDebt.toString(),
      detail: 'Negative wallet balance blocks new booking acceptance',
      href: '/partners?review=cash-debt',
    },
    {
      label: 'Location refresh',
      value: locationNeedsRefresh.toString(),
      detail: `Location older than ${opsPolicy.staleLocationMinutes}m, expired, or missing`,
      href: '/partners?review=location',
    },
    {
      label: 'KYC/doc work',
      value: kycOrDocumentWork.toString(),
      detail: 'Identity, selfie, or required document items needing completion or review',
      href: '/partners?review=kyc',
    },
    {
      label: 'Push reachable',
      value: pushReady.toString(),
      detail: 'Partners with an enabled push device for request alerts',
      href: '/partners?review=push',
    },
  ];
}

function buildProviderReviewQueue(providers: AdminProvider[], opsPolicy: ProviderOpsPolicy) {
  const accountBlocks = providers.filter((provider) => Boolean(provider.blockedAt)).length;
  const kycNeedsReview = providers.filter(partnerNeedsKycReview).length;
  const documentNeedsReview = providers.filter((provider) =>
    (provider.documents ?? []).some((document) => ['PENDING_REVIEW', 'REJECTED'].includes(document.status)),
  ).length;
  const publicMediaNeedsReview = providers.filter(providerPublicMediaNeedsReview).length;
  const bankNeedsReview = providers.filter((provider) => !hasApprovedBankAccount(provider)).length;
  const payoutSetupNeedsReview = providers.filter(providerPayoutSetupNeedsReview).length;
  const cashDebtNeedsReview = providers.filter(
    (provider) => providerUnsettledWalletBalance(provider) < 0,
  ).length;
  const taxNeedsReview = providers.filter(providerTaxNeedsReview).length;
  const locationNeedsReview = providers.filter((provider) =>
    ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy)),
  ).length;
  const pushNeedsReview = providers.filter((provider) => !hasHealthyPush(provider)).length;
  const securityNeedsReview = providers.filter((provider) =>
    ['account-blocked', 'blocked', 'session-check', 'shared'].includes(providerSecurityStatus(provider)),
  ).length;
  const reportNeedsReview = providers.filter((provider) => hasOpenPartnerControl(provider)).length;
  const directReady = providers.filter((provider) => partnerCanAcceptBookingNow(provider, opsPolicy)).length;
  const backupReady = providers.filter(
    (provider) => partnerBackupMatchingEligibility(provider, opsPolicy).eligible,
  ).length;
  const acceptanceBlocked = providers.filter(
    (provider) => !partnerCanAcceptBookingNow(provider, opsPolicy),
  ).length;

  const items = [
    {
      label: 'Booking acceptance blocked',
      count: acceptanceBlocked,
      href: '/partners?review=acceptance-blocked',
      detail:
        'Partners who cannot accept direct requests now because identity, bank, wallet, location, push, or control gates are not satisfied.',
    },
    {
      label: 'Account blocks',
      count: accountBlocks,
      href: '/partners?review=blocked',
      detail:
        'Partners blocked by admin cannot go online, refresh location, or appear in customer discovery.',
    },
    {
      label: 'KYC updates',
      count: kycNeedsReview,
      href: '/partners?review=kyc',
      detail:
        'Partners with missing, pending, rejected, or document-blocked identity verification need admin review.',
    },
    {
      label: 'Document review',
      count: documentNeedsReview,
      href: '/partners?review=documents',
      detail: 'Typed CCCD, selfie, or portfolio documents are waiting for approval or rejection handling.',
    },
    {
      label: 'Public media review',
      count: publicMediaNeedsReview,
      href: '/partners?review=public-media',
      detail: 'Uploaded public profile and gallery images must be approved before customers can see them.',
    },
    {
      label: 'Bank payout review',
      count: bankNeedsReview,
      href: '/partners?review=bank',
      detail: 'At least one bank account must be approved before partners can receive paid booking work.',
    },
    {
      label: 'First earning payout setup',
      count: payoutSetupNeedsReview,
      href: '/partners?review=payout-setup',
      detail:
        'Partners with first revenue who still need tax profile, tax address, or payout agreements before withdrawal.',
    },
    {
      label: 'Cash fee debt',
      count: cashDebtNeedsReview,
      href: '/partners?review=cash-debt',
      detail:
        'Partners with negative wallet balance cannot accept bookings until HANDS fee settlement is confirmed.',
    },
    {
      label: 'Tax profile review',
      count: taxNeedsReview,
      href: '/partners?review=tax',
      detail: 'Freelance tax profiles should be approved only after MST and registered address are checked.',
    },
    {
      label: 'Device/session review',
      count: securityNeedsReview,
      href: '/partners?review=security',
      detail: 'Blocked, shared, or checked partner app devices need operator review.',
    },
    {
      label: 'Reports and account controls',
      count: reportNeedsReview,
      href: '/partners?review=reports',
      detail:
        'Open reports or active account controls should be reviewed before dispatch and profile review changes.',
    },
    {
      label: 'Location freshness',
      count: locationNeedsReview,
      href: '/partners?review=location',
      detail: `Partners with missing, expired, or older-than-${opsPolicy.staleLocationMinutes}m locations should reopen the Partner app before dispatch.`,
    },
    {
      label: 'Push alert readiness',
      count: pushNeedsReview,
      href: '/partners?review=push',
      detail: 'Partners without enabled push devices may miss direct requests and marketplace matching alerts.',
    },
    {
      label: 'Direct request ready',
      count: directReady,
      href: '/partners?review=direct-ready',
      detail: 'Partners who can receive and accept a preferred direct booking right now.',
    },
    {
      label: 'Marketplace ready',
      count: backupReady,
      href: '/partners?review=marketplace-ready',
      detail: 'Partners who can receive marketplace alerts and join customer shortlists under current policy.',
    },
  ];

  const totalOpen = items
    .filter((item) => !['Direct request ready', 'Marketplace ready'].includes(item.label))
    .reduce((sum, item) => sum + item.count, 0);

  return { items, totalOpen };
}

function providerTaxNeedsReview(provider: AdminProvider) {
  const taxStatus = provider.taxProfile?.status ?? 'MISSING';
  if (['PENDING_REVIEW', 'REJECTED'].includes(taxStatus)) {
    return true;
  }

  return providerHasFirstRevenueSignal(provider) && taxStatus !== 'APPROVED';
}

function providerTaxPillClass(provider: AdminProvider) {
  if (provider.taxProfile?.status === 'APPROVED') {
    return 'pill-success';
  }
  if (providerTaxNeedsReview(provider)) {
    return provider.taxProfile?.status === 'REJECTED' ? 'pill-danger' : 'pill-warn';
  }
  return 'pill-neutral';
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

function hasOpenPartnerControl(provider: AdminProvider) {
  return (
    (provider.reports ?? []).some((report) => ['OPEN', 'INVESTIGATING'].includes(report.status)) ||
    (provider.sanctions ?? []).some((sanction) => sanction.status === 'ACTIVE')
  );
}

function sortProviders(
  providers: AdminProvider[],
  opsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
  sort = 'ops-priority',
) {
  return [...providers].sort((left, right) => {
    if (sort === 'last-work') {
      return dateMs(providerLastCompletedWorkAt(right)) - dateMs(providerLastCompletedWorkAt(left));
    }
    if (sort === 'completed-count') {
      return (
        providerCompletedWorkCount(right) - providerCompletedWorkCount(left) ||
        dateMs(providerLastCompletedWorkAt(right)) - dateMs(providerLastCompletedWorkAt(left))
      );
    }
    if (sort === 'booking-count') {
      return (
        providerBookingRows(right).length - providerBookingRows(left).length ||
        dateMs(providerLastCompletedWorkAt(right)) - dateMs(providerLastCompletedWorkAt(left))
      );
    }
    if (sort === 'gross-revenue') {
      return providerGrossRevenue(right) - providerGrossRevenue(left);
    }
    if (sort === 'pending-payout') {
      return providerPendingPayout(right) - providerPendingPayout(left);
    }
    if (sort === 'available-payout') {
      return providerAvailablePayout(right) - providerAvailablePayout(left);
    }
    if (sort === 'last-activity') {
      return dateMs(partnerLastActivityAt(right)) - dateMs(partnerLastActivityAt(left));
    }
    if (sort === 'location-freshness') {
      return dateMs(right.currentLocationUpdatedAt) - dateMs(left.currentLocationUpdatedAt);
    }
    if (sort === 'wallet-debt') {
      return providerUnsettledWalletBalance(left) - providerUnsettledWalletBalance(right);
    }
    if (sort === 'name') {
      return providerDisplayName(left).localeCompare(providerDisplayName(right));
    }
    const leftPriority = providerPriority(left, opsPolicy);
    const rightPriority = providerPriority(right, opsPolicy);
    if (leftPriority !== rightPriority) {
      return rightPriority - leftPriority;
    }

    return (left.displayName || left.user?.fullName || left.user?.phone || '').localeCompare(
      right.displayName || right.user?.fullName || right.user?.phone || '',
    );
  });
}

function buildProviderFilters(params: Record<string, string | string[] | undefined>): ProviderFilters {
  return {
    q: readParam(params.q),
    verification: readParam(params.verification),
    providerStatus: readParam(params.providerStatus),
    kyc: readParam(params.kyc),
    location: readParam(params.location),
    security: normalizeProviderSecurityFilter(readParam(params.security)),
    readiness: readParam(params.readiness),
    review: normalizePartnerReviewFilter(readParam(params.review)),
    sort: readPartnerSort(readParam(params.sort)),
  };
}

function buildProviderActiveFilters(filters: ProviderFilters) {
  return [
    filters.q
      ? {
          kind: 'search',
          value: filters.q,
          label: `Search: ${filters.q}`,
          description: 'Partner list is narrowed by name, phone, location, service, report, or control text.',
        }
      : null,
    filters.verification
      ? {
          kind: 'verification',
          value: filters.verification,
          label: `Verification: ${filters.verification}`,
          description: providerFilterDescription('verification', filters.verification),
        }
      : null,
    filters.providerStatus
      ? {
          kind: 'providerStatus',
          value: filters.providerStatus,
          label: `Status: ${filters.providerStatus}`,
          description: providerFilterDescription('providerStatus', filters.providerStatus),
        }
      : null,
    filters.kyc
      ? {
          kind: 'kyc',
          value: filters.kyc,
          label: `KYC: ${filters.kyc}`,
          description: providerFilterDescription('kyc', filters.kyc),
        }
      : null,
    filters.location
      ? {
          kind: 'location',
          value: filters.location,
          label: `Location: ${filters.location}`,
          description: providerFilterDescription('location', filters.location),
        }
      : null,
    filters.security
      ? {
          kind: 'security',
          value: filters.security,
          label: `Device/session: ${providerSecurityLabel(filters.security as ProviderSecurityState)}`,
          description: providerFilterDescription('security', filters.security),
        }
      : null,
    filters.readiness
      ? {
          kind: 'readiness',
          value: filters.readiness,
          label: `Readiness: ${filters.readiness}`,
          description: providerFilterDescription('readiness', filters.readiness),
        }
      : null,
    filters.review
      ? {
          kind: 'review',
          value: filters.review,
          label: `Review: ${partnerReviewFilterLabel(filters.review)}`,
          description: providerFilterDescription('review', filters.review),
        }
      : null,
    filters.sort !== 'ops-priority'
      ? {
          kind: 'sort',
          value: filters.sort,
          label: `Sort: ${partnerSortLabel(filters.sort)}`,
          description: 'Partner list sort order is changed for a specific checklist review.',
        }
      : null,
  ].filter(Boolean) as Array<{ kind: string; value: string; label: string; description: string }>;
}

function providerFilterDescription(kind: string, value: string) {
  if (kind === 'verification' && value === 'SUBMITTED') {
    return 'Submitted identity files are waiting for admin approval or rejection.';
  }
  if (kind === 'verification' && value === 'APPROVED') {
    return 'Approved partners can progress toward dispatch if other readiness checks pass.';
  }
  if (kind === 'verification' && value === 'BLOCKED') {
    return 'Blocked partner accounts cannot receive customer requests.';
  }
  if (kind === 'providerStatus') {
    return 'Partner availability is narrowed to the selected online/offline state.';
  }
  if (kind === 'kyc') {
    return 'KYC review is narrowed to the selected identity state.';
  }
  if (kind === 'location') {
    return 'Location freshness is narrowed so dispatch can check stale or missing partner pins.';
  }
  if (kind === 'security') {
    return 'Device/session review is narrowed to device, session, or account control state.';
  }
  if (kind === 'readiness') {
    return 'Readiness shows whether a partner can safely appear in customer discovery and dispatch.';
  }
  if (kind === 'review' && value === 'push') {
    return 'Push readiness highlights partners whose devices cannot reliably receive booking alerts.';
  }
  if (kind === 'review' && value === 'reports') {
    return 'Report review highlights partners with open reports or active account controls.';
  }
  if (kind === 'review' && value === 'public-media') {
    return 'Public media review highlights uploaded partner photos that are pending or rejected.';
  }
  if (kind === 'review' && value === 'payout-setup') {
    return 'First earning payout setup highlights partners who have earned revenue but still need tax profile, address, or agreements before withdrawal.';
  }
  if (kind === 'review' && value === 'cash-debt') {
    return 'Cash fee debt highlights partners blocked from accepting bookings because HANDS commission was not settled.';
  }
  if (kind === 'review' && value === 'acceptance-blocked') {
    return 'Booking acceptance blocked highlights partners who cannot currently accept preferred or marketplace matching work.';
  }
  if (kind === 'review' && value === 'direct-ready') {
    return 'Direct request ready highlights partners who can accept a preferred customer request immediately.';
  }
  if (kind === 'review' && value === 'marketplace-ready') {
    return 'Marketplace ready highlights partners who can receive availability alerts and join customer shortlists.';
  }
  if (kind === 'review' && value === 'marketplace-blocked') {
    return 'Marketplace blocked highlights partners excluded from open matching until blockers are resolved.';
  }
  if (kind === 'review') {
    return 'Review queue focuses the table on one operational approval lane.';
  }
  return 'Partner list is narrowed by the active filter.';
}

function emptyProviderMessage(activeFilters: Array<{ description: string }>) {
  if (activeFilters.length === 0) {
    return 'No partners loaded. Start the API and seed data to populate this table.';
  }
  return 'No partners match the active filters. Clear filters or switch to another review lane.';
}

function readParam(value: string | string[] | undefined) {
  return readSearchParam(value);
}

function normalizePartnerReviewFilter(value: string) {
  if (value === 'risk') return 'reports';
  if (value === 'backup-ready') return 'marketplace-ready';
  if (value === 'backup-blocked') return 'marketplace-blocked';
  return value;
}

function normalizeProviderSecurityFilter(value: string) {
  if (value === 'suspicious') return 'session-check';
  return value;
}

function readPartnerSort(value: string) {
  return [
    'ops-priority',
    'last-work',
    'booking-count',
    'completed-count',
    'gross-revenue',
    'pending-payout',
    'available-payout',
    'last-activity',
    'location-freshness',
    'wallet-debt',
    'name',
  ].includes(value)
    ? value
    : 'ops-priority';
}

function partnerSortLabel(sort: string) {
  if (sort === 'last-work') return 'last completed work';
  if (sort === 'booking-count') return 'booking count';
  if (sort === 'completed-count') return 'completed work count';
  if (sort === 'gross-revenue') return 'gross revenue';
  if (sort === 'pending-payout') return 'pending payout';
  if (sort === 'available-payout') return 'available payout';
  if (sort === 'last-activity') return 'last app activity';
  if (sort === 'location-freshness') return 'location freshness';
  if (sort === 'wallet-debt') return 'wallet debt first';
  if (sort === 'name') return 'name';
  return 'checklist order';
}

function partnerReviewFilterLabel(review: string) {
  const labels: Record<string, string> = {
    kyc: 'KYC updates',
    documents: 'Document review',
    'public-media': 'Public media review',
    bank: 'Bank payout review',
    'payout-setup': 'First earning payout setup',
    'cash-debt': 'Cash fee debt',
    tax: 'Tax profile review',
    security: 'Device/session check',
    reports: 'Reports/controls',
    blocked: 'Account blocks',
    location: 'Location freshness',
    push: 'Push alert readiness',
    'acceptance-blocked': 'Booking acceptance blocked',
    'direct-ready': 'Direct request ready',
    'marketplace-ready': 'Marketplace ready',
    'marketplace-blocked': 'Marketplace blocked',
  };
  return labels[review] ?? review;
}

function filterProviders(
  providers: AdminProvider[],
  filters: ProviderFilters,
  opsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
) {
  const search = filters.q.toLowerCase();

  return providers.filter((provider) => {
    if (search && !providerSearchText(provider).includes(search)) {
      return false;
    }
    if (filters.verification === 'BLOCKED') {
      if (!provider.blockedAt) return false;
    } else if (filters.verification && (provider.verification?.status ?? 'DRAFT') !== filters.verification) {
      return false;
    }
    if (filters.providerStatus && provider.status !== filters.providerStatus) {
      return false;
    }
    if (filters.kyc && (provider.kyc?.status ?? 'MISSING') !== filters.kyc) {
      return false;
    }
    if (filters.location && providerLocationStatus(provider, opsPolicy) !== filters.location) {
      return false;
    }
    if (filters.security && providerSecurityStatus(provider) !== filters.security) {
      return false;
    }
    if (filters.readiness && providerReadiness(provider, opsPolicy) !== filters.readiness) {
      return false;
    }
    if (filters.review && !providerMatchesReviewQueue(provider, filters.review, opsPolicy)) {
      return false;
    }
    return true;
  });
}

function providerMatchesReviewQueue(
  provider: AdminProvider,
  review: string,
  opsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
) {
  if (review === 'blocked') {
    return Boolean(provider.blockedAt);
  }
  if (review === 'kyc') {
    return partnerNeedsKycReview(provider);
  }
  if (review === 'documents') {
    return (provider.documents ?? []).some((document) =>
      ['PENDING_REVIEW', 'REJECTED'].includes(document.status),
    );
  }
  if (review === 'public-media') {
    return providerPublicMediaNeedsReview(provider);
  }
  if (review === 'bank') {
    return !hasApprovedBankAccount(provider);
  }
  if (review === 'payout-setup') {
    return providerPayoutSetupNeedsReview(provider);
  }
  if (review === 'cash-debt') {
    return providerUnsettledWalletBalance(provider) < 0;
  }
  if (review === 'tax') {
    return providerTaxNeedsReview(provider);
  }
  if (review === 'security') {
    return ['account-blocked', 'blocked', 'session-check', 'shared'].includes(providerSecurityStatus(provider));
  }
  if (review === 'reports') {
    return hasOpenPartnerControl(provider);
  }
  if (review === 'location') {
    return ['stale', 'expired', 'missing'].includes(providerLocationStatus(provider, opsPolicy));
  }
  if (review === 'push') {
    return !hasHealthyPush(provider);
  }
  if (review === 'acceptance-blocked') {
    return !partnerCanAcceptBookingNow(provider, opsPolicy);
  }
  if (review === 'direct-ready') {
    return partnerCanAcceptBookingNow(provider, opsPolicy);
  }
  if (review === 'marketplace-ready') {
    return partnerBackupMatchingEligibility(provider, opsPolicy).eligible;
  }
  if (review === 'marketplace-blocked') {
    return !partnerBackupMatchingEligibility(provider, opsPolicy).eligible;
  }
  return true;
}

function providerSearchText(provider: AdminProvider) {
  return [
    provider.id,
    provider.displayName,
    provider.legalName,
    provider.city,
    provider.residentialAddress,
    provider.blockedReason,
    provider.user?.fullName,
    provider.user?.phone,
    provider.devices?.map((device) => device.deviceId).join(' '),
    providerPublicMedia(provider)
      .map((file) => `${file.purpose} ${file.reviewStatus ?? ''} ${file.reviewReason ?? ''} ${file.key}`)
      .join(' '),
    provider.sessions?.map((session) => `${session.deviceId ?? ''} ${session.ipAddress ?? ''}`).join(' '),
    provider.reports
      ?.map((report) => `${report.category} ${report.summary} ${report.details ?? ''}`)
      .join(' '),
    provider.sanctions?.map((sanction) => `${sanction.type} ${sanction.reason}`).join(' '),
    provider.services?.map((item) => item.service?.name).join(' '),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function providerReadiness(provider: AdminProvider, opsPolicy = DEFAULT_PROVIDER_OPS_POLICY) {
  if (provider.blockedAt) {
    return 'needs-review';
  }
  if (providerDispatchReady(provider, opsPolicy)) {
    return 'ready';
  }
  if (!partnerHasHardAcceptanceBlocker(provider) && provider.status !== 'ONLINE_AVAILABLE') {
    return 'approved-offline';
  }
  if (!partnerHasHardAcceptanceBlocker(provider) && !hasHealthyPush(provider)) {
    return 'push-missing';
  }
  return 'needs-review';
}

function providerPriority(provider: AdminProvider, opsPolicy = DEFAULT_PROVIDER_OPS_POLICY) {
  if (provider.blockedAt) {
    return 0;
  }
  if (['account-blocked', 'blocked', 'session-check', 'shared'].includes(providerSecurityStatus(provider))) {
    return 0;
  }
  if (providerDispatchReady(provider, opsPolicy)) {
    return 4;
  }
  if (!partnerHasHardAcceptanceBlocker(provider) && provider.status === 'ONLINE_AVAILABLE') {
    return 3;
  }
  if (!partnerHasHardAcceptanceBlocker(provider)) {
    return 2;
  }
  return 1;
}

function providerSecurityStatus(provider: AdminProvider): ProviderSecurityState {
  if (provider.blockedAt) {
    return 'account-blocked';
  }
  if ((provider.devices ?? []).some((device) => Boolean(device.blockedAt))) {
    return 'blocked';
  }
  if ((provider.sessions ?? []).some((session) => session.suspicious)) {
    return 'session-check';
  }
  if (sharedDeviceIds(provider).size > 0) {
    return 'shared';
  }
  if (!(provider.devices ?? []).length && !(provider.sessions ?? []).length) {
    return 'missing';
  }
  return 'clear';
}

function sharedDeviceIds(provider: AdminProvider) {
  return new Set((provider.sharedDeviceMatches ?? []).map((match) => match.deviceId).filter(Boolean));
}

function providerSecurityLabel(status: ProviderSecurityState) {
  if (status === 'account-blocked') return 'Account blocked';
  if (status === 'blocked') return 'Device blocked';
  if (status === 'session-check') return 'Session check';
  if (status === 'shared') return 'Shared device';
  if (status === 'missing') return 'No app device';
  return 'Device clear';
}

function providerSecurityPillClass(status: ProviderSecurityState) {
  if (status === 'clear') return 'pill-success';
  if (status === 'missing') return 'pill-neutral';
  return 'pill-danger';
}

function providerLocationStatus(
  provider: AdminProvider,
  opsPolicy = DEFAULT_PROVIDER_OPS_POLICY,
): ProviderLocationState {
  if (!hasProviderCoordinate(provider) || !provider.currentLocationUpdatedAt) {
    return 'missing';
  }

  const updatedAt = new Date(provider.currentLocationUpdatedAt).getTime();
  if (!Number.isFinite(updatedAt)) {
    return 'missing';
  }

  const ageMs = Date.now() - updatedAt;
  if (ageMs > opsPolicy.expiredLocationHours * 60 * 60_000) {
    return 'expired';
  }
  if (ageMs > opsPolicy.staleLocationMinutes * 60_000) {
    return 'stale';
  }
  return 'recent';
}

function buildProviderOpsPolicy(settings: AdminOperationalPolicySetting[]): ProviderOpsPolicy {
  return {
    staleLocationMinutes:
      readPolicyNumber(settings, MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY) ??
      DEFAULT_PROVIDER_OPS_POLICY.staleLocationMinutes,
    expiredLocationHours: DEFAULT_PROVIDER_OPS_POLICY.expiredLocationHours,
    backupRadiusMeters:
      readPolicyNumber(settings, MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY) ??
      DEFAULT_PROVIDER_OPS_POLICY.backupRadiusMeters,
    responseWindowMinutes:
      readPolicyNumber(settings, MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY) ??
      DEFAULT_PROVIDER_OPS_POLICY.responseWindowMinutes,
  };
}

function readPolicyNumber(settings: AdminOperationalPolicySetting[], key: string) {
  const setting = settings.find((item) => item.key === key);
  if (!setting) return null;
  const parsed = Number(setting.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function hasProviderCoordinate(provider: AdminProvider) {
  if (provider.currentLat === null || provider.currentLat === undefined) {
    return false;
  }
  if (provider.currentLng === null || provider.currentLng === undefined) {
    return false;
  }
  return Number.isFinite(Number(provider.currentLat)) && Number.isFinite(Number(provider.currentLng));
}

function formatDistanceMeters(distanceMeters: number) {
  if (distanceMeters >= 1000) {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(distanceMeters / 1000)}km`;
  }
  return `${new Intl.NumberFormat('en-US').format(distanceMeters)}m`;
}

function providerLocationLabel(status: ProviderLocationState) {
  if (status === 'recent') {
    return 'Location recent';
  }
  if (status === 'stale') {
    return 'Location stale';
  }
  if (status === 'expired') {
    return 'Too old';
  }
  return 'No location';
}

function providerLocationPillClass(status: ProviderLocationState) {
  if (status === 'recent') {
    return 'pill-success';
  }
  if (status === 'stale') {
    return 'pill-warn';
  }
  if (status === 'expired') {
    return 'pill-info';
  }
  return 'pill-neutral';
}

function providerLocationAgeLabel(value?: string | null) {
  if (!value) {
    return 'Partner app has not shared a location.';
  }

  const updatedAt = new Date(value).getTime();
  if (!Number.isFinite(updatedAt)) {
    return 'Saved location time is invalid.';
  }

  const ageMinutes = Math.max(0, Math.round((Date.now() - updatedAt) / 60_000));
  if (ageMinutes < 1) {
    return 'Updated just now.';
  }
  if (ageMinutes < 60) {
    return `Updated ${ageMinutes}m ago.`;
  }

  const ageHours = Math.round(ageMinutes / 60);
  return `Updated ${ageHours}h ago.`;
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string | null) {
  if (!value) {
    return 'not recorded';
  }
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'invalid time';
  }
  return new Date(timestamp).toLocaleString();
}

function dateMs(value?: string | null) {
  if (!value) {
    return 0;
  }
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatRelativeAge(value?: string | null) {
  if (!value) {
    return 'with no timestamp';
  }
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) {
    return 'at an invalid time';
  }
  const diffMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}
