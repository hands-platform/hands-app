import Link from 'next/link';
import {
  AdminOperationalPolicySetting,
  AdminProvider,
  AdminProviderReport,
  AdminProviderSanction,
  adminGet,
} from '../../lib/admin-api';
import { marketplaceDisplayText as partnerDisplayText } from '../../lib/admin-copy';
import {
  formatDateTime,
  formatMoney,
  shortId as formatShortId,
} from '../../lib/admin-format';
import {
  createProviderReport,
  createProviderSanction,
  liftProviderSanction,
  updateProviderReport,
} from './actions';
import { readSearchParam } from '../../lib/date-range';
import { OPERATIONAL_POLICY_KEYS, readPositivePolicyNumber } from '../../lib/operations-policy';

type PartnerControlsSearchParams = Promise<Record<string, string | string[] | undefined>>;
type PartnerControlPolicy = {
  responseWindowMinutes: number;
  backupRadiusMeters: number;
  invitationLimit: number;
  locationFreshnessMinutes: number;
};

type PartnerControlBoardItem = {
  provider: AdminProvider;
  partner: string;
  status: string;
  walletBalance: number;
  reasons: string[];
  controls: Array<{ label: string; className: string }>;
  actionLabel: string;
  actionHref: string;
  operatorAction: string;
  priority: number;
};

type PartnerControlBoard = {
  metrics: PartnerControlCommandMetric[];
  items: PartnerControlBoardItem[];
};

const DEFAULT_PARTNER_CONTROL_POLICY: PartnerControlPolicy = {
  responseWindowMinutes: 10,
  backupRadiusMeters: 10000,
  invitationLimit: 50,
  locationFreshnessMinutes: 30,
};

export default async function PartnerControlsPage({
  searchParams,
}: {
  searchParams?: PartnerControlsSearchParams;
}) {
  const filters = buildFilters(searchParams ? await searchParams : {});
  const [providers, reports, sanctions, operationalPolicies] = await Promise.all([
    adminGet<AdminProvider[]>('/admin/partners?view=list', []),
    adminGet<AdminProviderReport[]>('/admin/partner-reports', []),
    adminGet<AdminProviderSanction[]>('/admin/partner-sanctions', []),
    adminGet<AdminOperationalPolicySetting[]>('/admin/operational-policy', []),
  ]);
  const controlPolicy = buildPartnerControlPolicy(operationalPolicies);
  const visibleReports = filterReports(reports, filters);
  const visibleSanctions = filterSanctions(sanctions, filters);
  const activeFilters = buildPartnerControlActiveFilters(filters);
  const providerOptions = providers.map((provider) => ({
    id: provider.id,
    label: partnerDisplayText(provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id),
  }));
  const summary = buildPartnerControlSummary(reports, sanctions, providers, controlPolicy);
  const providerWatchlist = buildPartnerControlWatchlist(providers, controlPolicy);
  const commandCenter = buildPartnerControlCommandCenter({
    reports,
    sanctions,
    watchlist: providerWatchlist,
  });
  const operatingBlocks = buildPartnerOperatingBlocks(providerWatchlist);
  const acceptanceUnblockBoard = buildBookingAcceptanceUnblockBoard(providerWatchlist, controlPolicy);
  const acceptanceUnblockPlaybook = buildAcceptanceUnblockPlaybook(acceptanceUnblockBoard);
  const partnerControlBoard = buildPartnerControlBoard(providers, providerWatchlist);

  return (
    <>
      <h1>Partner Controls</h1>
      <p className="muted">
        Track partner reports, account controls, booking blocks, payout holds, and operations follow-up in one
        operator view.
      </p>

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
            <h2>Partner control command center</h2>
            <p className="muted">
              One-screen review for finance blocks, account controls, document review, and investigation SLA.
            </p>
          </div>
          <span className={`pill ${commandCenter.urgentCount ? 'pill-danger' : 'pill-success'}`}>
            {commandCenter.urgentCount ? `${commandCenter.urgentCount} time-sensitive` : 'No time-sensitive lane'}
          </span>
          <Link className="text-link" href="/operations-policy">
            {controlPolicy.responseWindowMinutes}m first-pick / {formatDistance(controlPolicy.backupRadiusMeters)}{' '}
            marketplace radius / {controlPolicy.invitationLimit} invite cap / location{' '}
            {controlPolicy.locationFreshnessMinutes}m
          </Link>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 12 }}>
          {commandCenter.lanes.map((lane) => (
            <Link className={`ops-task-card ${lane.className}`} href={lane.href} key={lane.title}>
              <small>{lane.status}</small>
              <h3>{lane.title}</h3>
              <p>{lane.detail}</p>
              <div className="ops-task-breakdown">
                {lane.metrics.map((metric) => (
                  <span className={`ops-task-breakdown-item ${metric.tone}`} key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </span>
                ))}
              </div>
              <span className="ops-task-card-action">{lane.action}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Next operator actions</h2>
            <p className="muted">
              Sorted by saved report level, wallet impact, active controls, and how long the item has waited.
            </p>
          </div>
          <span className="pill pill-info">{commandCenter.nextActions.length} action(s)</span>
        </div>
        {commandCenter.nextActions.length ? (
          <div className="setup-stage-list" style={{ marginTop: 12 }}>
            {commandCenter.nextActions.map((action) => (
              <div className="setup-stage-item" key={action.id}>
                <span>{action.status}</span>
                <div>
                  <strong>{action.title}</strong>
                  <p className="muted">{action.detail}</p>
                  <p className="muted">{action.operatorAction}</p>
                  <div className="participant-list">
                    {action.tags.map((tag) => (
                      <span className={`pill ${tag.tone}`} key={`${action.id}-${tag.label}`}>
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
                <Link className="text-link" href={action.href}>
                  Open
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            No partner control action currently needs operator review.
          </p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Partner control board</h2>
            <p className="muted">
              Shows factual partner controls for booking blocks, wallet debt, payout gates, document gaps,
              location freshness, and device reachability.
            </p>
          </div>
          <span className="pill pill-info">{partnerControlBoard.items.length} partner(s)</span>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 12 }}>
          {partnerControlBoard.metrics.map((controlMetric) => (
            <div className="ops-task-card" key={controlMetric.label}>
              <small>{controlMetric.label}</small>
              <h3>{controlMetric.value}</h3>
              <div className="ops-task-breakdown">
                <span className={`ops-task-breakdown-item ${controlMetric.tone}`}>
                  <span>Control type</span>
                  <strong>{controlMetric.label}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
        {partnerControlBoard.items.length ? (
          <div className="setup-stage-list" style={{ marginTop: 12 }}>
            {partnerControlBoard.items.map((item) => (
              <div className="setup-stage-item" key={item.provider.id}>
                <span>{item.status}</span>
                <div>
                  <strong>{item.partner}</strong>
                  <p className="muted">
                    Wallet {formatMoney(item.walletBalance)} / {item.reasons.join(', ')}
                  </p>
                  <p className="muted">{item.operatorAction}</p>
                  <div className="participant-list">
                    {item.controls.map((control) => (
                      <span
                        className={`pill ${control.className}`}
                        key={`${item.provider.id}-${control.label}`}
                      >
                        {control.label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="actions">
                  <Link className="text-link" href={`/partners/${item.provider.id}`}>
                    Profile
                  </Link>
                  <Link className="text-link" href={item.actionHref}>
                    {item.actionLabel}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            No partner currently has an active account, wallet, document, payout, location, or device
            follow-up.
          </p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Marketplace and payout unblock board</h2>
            <p className="muted">
              Shows which partners cannot participate in marketplace bookings now, which issues only affect payout, and
              exactly where staff should clear the blocker.
            </p>
          </div>
          <span
            className={`pill ${
              acceptanceUnblockBoard.some((item) => item.blockingCount > 0) ? 'pill-danger' : 'pill-success'
            }`}
          >
            {acceptanceUnblockBoard.reduce((sum, item) => sum + item.blockingCount, 0)} blocking partner(s)
          </span>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 12 }}>
          {acceptanceUnblockBoard.map((item) => (
            <Link className={`ops-task-card ${item.className}`} href={item.href} key={item.id}>
              <small>{item.status}</small>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <p className="muted">
                <strong>Operator script:</strong> {item.operatorScript}
              </p>
              <p className="muted">
                <strong>Customer impact:</strong> {item.customerImpact}
              </p>
              <div className="ops-task-breakdown">
                {item.metrics.map((metric) => (
                  <span className={`ops-task-breakdown-item ${metric.tone}`} key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </span>
                ))}
              </div>
              {item.partnerSamples.length ? (
                <div className="participant-list" style={{ marginTop: 10 }}>
                  {item.partnerSamples.map((partner) => (
                    <span className="pill pill-info" key={`${item.id}-${partner}`}>
                      {partner}
                    </span>
                  ))}
                </div>
              ) : null}
              <span className="ops-task-card-action">{item.action}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Marketplace and payout unblock playbook</h2>
            <p className="muted">
              Step-by-step operating order for restoring partner marketplace and payout gates without mixing payout-only
              gates into customer discovery or marketplace participation decisions.
            </p>
          </div>
          <span
            className={`pill ${
              acceptanceUnblockPlaybook.some((step) => step.blockingCount) ? 'pill-warn' : 'pill-success'
            }`}
          >
            {acceptanceUnblockPlaybook.reduce((sum, step) => sum + step.blockingCount, 0)} active blocker(s)
          </span>
        </div>
        <div className="setup-stage-list" style={{ marginTop: 12 }}>
          {acceptanceUnblockPlaybook.map((step) => (
            <div className="setup-stage-item" key={step.id}>
              <span>{step.step}</span>
              <div>
                <strong>{step.title}</strong>
                <p className="muted">{step.detail}</p>
                <p className="muted">
                  <strong>Booking impact:</strong> {step.bookingImpact}
                </p>
                <p className="muted">
                  <strong>Payout impact:</strong> {step.payoutImpact}
                </p>
                <p className="muted">
                  <strong>Customer impact:</strong> {step.customerImpact}
                </p>
                <div className="participant-list">
                  <span className={`pill ${step.pillClass}`}>{step.status}</span>
                  <span className="pill pill-info">{step.owner}</span>
                  {step.partnerSamples.map((partner) => (
                    <span className="pill pill-neutral" key={`${step.id}-${partner}`}>
                      {partner}
                    </span>
                  ))}
                </div>
              </div>
              <Link className="text-link" href={step.href}>
                {step.action}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Partner operating block matrix</h2>
            <p className="muted">
              Explains why a partner may be held from paid work, payout, or dispatch-sensitive
              work, with the exact screen an operator should open next.
            </p>
          </div>
          <span className={`pill ${operatingBlocks.length ? 'pill-warn' : 'pill-success'}`}>
            {operatingBlocks.length ? `${operatingBlocks.length} block record(s)` : 'No block record'}
          </span>
        </div>
        {operatingBlocks.length ? (
          <div className="setup-stage-list" style={{ marginTop: 12 }}>
            {operatingBlocks.map((block) => (
              <div className="setup-stage-item" key={block.id}>
                <span>{block.impact}</span>
                <div>
                  <strong>{block.title}</strong>
                  <p className="muted">{block.reason}</p>
                  <p className="muted">{block.operatorAction}</p>
                  <div className="participant-list">
                    <span className={`pill ${block.tone}`}>{block.severity}</span>
                    <span className="pill pill-info">{block.partner}</span>
                  </div>
                </div>
                <div className="actions">
                  <Link className="text-link" href={block.href}>
                    Open
                  </Link>
                  <Link className="text-link" href={`/partners/${block.providerId}`}>
                    Profile
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            No partner currently has a control record that should block operations.
          </p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header" style={{ marginBottom: 12 }}>
          <div>
            <h2>Control filters</h2>
            <p className="muted">
              Dashboard links land here with the exact review lane already selected.
            </p>
            {activeFilters.length > 0 ? (
              <p className="muted">
                Active queue: {activeFilters.map((filter) => filter.description).join(' ')}
              </p>
            ) : (
              <p className="muted">No control filter is active. Showing every report and account-control lane.</p>
            )}
          </div>
          <span className={`pill ${activeFilters.length ? 'pill-warn' : 'pill-success'}`}>
            Showing {visibleReports.length} report(s), {visibleSanctions.length} account control(s)
          </span>
        </div>
        <form className="form-grid" action="/partner-controls">
          <label>
            Search
            <input name="q" defaultValue={filters.q} placeholder="Partner, phone, category, reason" />
          </label>
          <label>
            Report status
            <select name="status" defaultValue={filters.status}>
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="INVESTIGATING">Investigating</option>
              <option value="RESOLVED">Resolved</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </label>
          <label>
            Report level
            <select name="severity" defaultValue={filters.severity}>
              <option value="">All</option>
              <option value="HIGH_PLUS">Urgent + major reports</option>
              <option value="CRITICAL">Urgent</option>
              <option value="HIGH">Major</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </label>
          <label>
            Account control
            <select name="sanction" defaultValue={filters.sanction}>
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="LIFTED">Lifted</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </label>
          <div className="actions full-span">
            <button type="submit">Apply filters</button>
            <Link className="text-link" href="/partner-controls">
              Clear filters
            </Link>
          </div>
          {activeFilters.length > 0 ? (
            <div className="participant-list full-span">
              <span className="pill pill-info">Active filters</span>
              {activeFilters.map((filter) => (
                <span className="pill pill-warn" key={`${filter.kind}-${filter.value}`}>
                  {filter.label}
                </span>
              ))}
            </div>
          ) : null}
        </form>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>System control checklist</h2>
            <p className="muted">
              Factual partner follow-ups from wallet debt, account controls, onboarding gaps, devices, and
              recent report history.
            </p>
          </div>
          <span className="pill pill-info">{providerWatchlist.length} partner(s)</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Control signals</th>
              <th>Money / access</th>
              <th>Operator next step</th>
            </tr>
          </thead>
          <tbody>
            {providerWatchlist.map((item) => (
              <tr key={item.provider.id}>
                <td>
                  <Link className="text-link" href={`/partners/${item.provider.id}`}>
                    {adminProviderName(item.provider)}
                  </Link>
                  <p className="muted">{item.provider.user?.phone ?? 'No phone'}</p>
                  <span className={`pill ${watchSeverityPill(item.severity)}`}>{item.severity}</span>
                </td>
                <td>
                  <div className="participant-list">
                    {item.signals.map((signal) => (
                      <span className={`pill ${watchSignalPill(signal.kind)}`} key={signal.label}>
                        {signal.label}
                      </span>
                    ))}
                  </div>
                  <p className="muted">{item.detail}</p>
                </td>
                <td>
                  <strong>{formatMoney(item.walletBalance)}</strong>
                  <p className="muted">
                    {item.walletBalance < 0
                      ? `Settlement ref ${cashDebtSettlementReference(item.provider.id)}`
                      : 'No negative wallet balance in pending/available earnings.'}
                  </p>
                  {item.hasPayoutHold ? <span className="pill pill-danger">Payout hold active</span> : null}
                  {item.provider.blockedAt ? <span className="pill pill-danger">Account blocked</span> : null}
                </td>
                <td>
                  <div className="actions">
                    <Link className="text-link" href={`/partners/${item.provider.id}`}>
                      Partner detail
                    </Link>
                    {item.walletBalance < 0 ? (
                      <Link className="text-link" href="/cash-settlements">
                        Cash debt queue
                      </Link>
                    ) : null}
                    {item.openReportCount > 0 ? (
                      <Link
                        className="text-link"
                        href={`/partner-controls?q=${encodeURIComponent(item.provider.id)}`}
                      >
                        Report lane
                      </Link>
                    ) : null}
                  </div>
                  <p className="muted">{item.nextStep}</p>
                </td>
              </tr>
            ))}
            {!providerWatchlist.length ? (
              <tr>
                <td colSpan={4}>No partner control follow-ups are active.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Create partner report</h2>
            <p className="muted">
              Use this for customer complaints, staff findings, payout holds, or service safety notes.
            </p>
          </div>
        </div>
        <form className="form-grid" action={createProviderReport}>
          <label>
            Partner
            <select name="providerProfileId" required>
              <option value="">Choose partner</option>
              {providerOptions.map((provider) => (
                <option value={provider.id} key={provider.id}>
                  {provider.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Category
            <input name="category" placeholder="safety, payout, behavior, identity" required />
          </label>
          <label>
            Report level
            <select name="severity" defaultValue="MEDIUM">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">Major</option>
              <option value="CRITICAL">Urgent</option>
            </select>
          </label>
          <label>
            Source
            <select name="source" defaultValue="ADMIN">
              <option value="ADMIN">Admin</option>
              <option value="CUSTOMER">Customer</option>
              <option value="PROVIDER">Partner</option>
              <option value="SYSTEM">System</option>
            </select>
          </label>
          <label>
            Booking ID
            <input name="bookingId" placeholder="Optional booking id" />
          </label>
          <label className="full-span">
            Summary
            <input name="summary" placeholder="Short operator-readable report summary" required />
          </label>
          <label className="full-span">
            Details
            <textarea
              name="details"
              placeholder="Evidence, timeline, customer/partner statements, next step"
            />
          </label>
          <div className="actions full-span">
            <button type="submit">Create report</button>
          </div>
        </form>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="ops-section-header">
          <div>
            <h2>Reports</h2>
            <p className="muted">
              Open and investigating reports should be cleared before profile review or payout changes.
            </p>
          </div>
          <span className="pill pill-info">{visibleReports.length} shown</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Report</th>
              <th>Partner</th>
              <th>Status</th>
              <th>Account control</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleReports.map((report) => (
              <tr key={report.id}>
                <td>
                  <strong>{partnerDisplayText(report.summary)}</strong>
                  <p className="muted">
                    {report.category} / {report.source} / {formatDate(report.createdAt)}
                  </p>
                  {report.details ? <p className="muted">{partnerDisplayText(report.details)}</p> : null}
                  {report.bookingId ? (
                    <Link className="text-link" href={`/bookings/${report.bookingId}`}>
                      Booking {shortId(report.bookingId)}
                    </Link>
                  ) : null}
                </td>
                <td>
                  {report.providerProfile ? (
                    <Link className="text-link" href={`/partners/${report.providerProfile.id}`}>
                      {providerName(report.providerProfile)}
                    </Link>
                  ) : (
                    report.providerProfileId
                  )}
                  <p className="muted">{report.providerProfile?.user?.phone ?? 'No phone'}</p>
                </td>
                <td>
                  <span className={`pill ${severityPill(report.severity)}`}>{report.severity}</span>
                  <span className={`pill ${statusPill(report.status)}`} style={{ marginLeft: 6 }}>
                    {report.status}
                  </span>
                  {report.resolutionNote ? (
                    <p className="muted">{partnerDisplayText(report.resolutionNote)}</p>
                  ) : null}
                </td>
                <td>
                  <form className="actions" action={createProviderSanction}>
                    <input type="hidden" name="providerProfileId" value={report.providerProfileId} />
                    <input type="hidden" name="reportId" value={report.id} />
                    <select
                      name="type"
                      defaultValue={report.severity === 'CRITICAL' ? 'ACCOUNT_BLOCK' : 'WARNING'}
                    >
                      <option value="WARNING">Warning</option>
                      <option value="PAYOUT_HOLD">Payout hold</option>
                      <option value="ACCOUNT_BLOCK">Account block</option>
                      <option value="TRUST_BADGE_REMOVAL">Profile review hold</option>
                    </select>
                    <input
                      name="reason"
                      placeholder="Account control reason"
                      required
                      minLength={12}
                      maxLength={500}
                    />
                    <button type="submit">Apply</button>
                  </form>
                </td>
                <td>
                  <form className="actions" action={updateProviderReport}>
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="providerProfileId" value={report.providerProfileId} />
                    <select name="status" defaultValue={report.status}>
                      <option value="OPEN">Open</option>
                      <option value="INVESTIGATING">Investigating</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="DISMISSED">Dismissed</option>
                    </select>
                    <select name="severity" defaultValue={report.severity}>
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">Major</option>
                      <option value="CRITICAL">Urgent</option>
                    </select>
                    <input name="resolutionNote" placeholder="Resolution or follow-up note" />
                    <button type="submit">Update</button>
                  </form>
                </td>
              </tr>
            ))}
            {!visibleReports.length ? (
              <tr>
                <td colSpan={5}>{emptyPartnerControlMessage('report', activeFilters)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="ops-section-header">
          <div>
            <h2>Account controls</h2>
            <p className="muted">
              Active account controls restrict work or payout. Lift them only with a clear audit trail.
            </p>
          </div>
          <span className="pill pill-info">{visibleSanctions.length} shown</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Control</th>
              <th>Partner</th>
              <th>Linked report</th>
              <th>Timeline</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleSanctions.map((sanction) => (
              <tr key={sanction.id}>
                <td>
                  <span className={`pill ${sanction.status === 'ACTIVE' ? 'pill-danger' : 'pill-neutral'}`}>
                    {sanction.status}
                  </span>
                  <p>
                    <strong>{sanction.type}</strong>
                  </p>
                  <p className="muted">{partnerDisplayText(sanction.reason)}</p>
                </td>
                <td>
                  {sanction.providerProfile ? (
                    <Link className="text-link" href={`/partners/${sanction.providerProfile.id}`}>
                      {providerName(sanction.providerProfile)}
                    </Link>
                  ) : (
                    sanction.providerProfileId
                  )}
                  <p className="muted">{sanction.providerProfile?.user?.phone ?? 'No phone'}</p>
                </td>
                <td>
                  {sanction.report ? (
                    <>
                      <strong>{sanction.report.category}</strong>
                      <p className="muted">
                        {sanction.report.severity} / {sanction.report.status}
                      </p>
                      <p className="muted">{partnerDisplayText(sanction.report.summary)}</p>
                    </>
                  ) : (
                    <span className="muted">Manual account control</span>
                  )}
                </td>
                <td>
                  <p className="muted">Started: {formatDate(sanction.startsAt)}</p>
                  <p className="muted">Expires: {formatDate(sanction.expiresAt)}</p>
                  <p className="muted">Lifted: {formatDate(sanction.liftedAt)}</p>
                </td>
                <td>
                  {sanction.status === 'ACTIVE' ? (
                    <form action={liftProviderSanction}>
                      <input type="hidden" name="providerProfileId" value={sanction.providerProfileId} />
                      <input type="hidden" name="sanctionId" value={sanction.id} />
                      <button type="submit">Lift control</button>
                    </form>
                  ) : (
                    <span className="muted">Closed</span>
                  )}
                </td>
              </tr>
            ))}
            {!visibleSanctions.length ? (
              <tr>
                <td colSpan={5}>{emptyPartnerControlMessage('sanction', activeFilters)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}

type PartnerControlCommandCenterInput = {
  reports: AdminProviderReport[];
  sanctions: AdminProviderSanction[];
  watchlist: PartnerControlWatchItem[];
};

type PartnerControlCommandMetric = {
  label: string;
  value: string;
  tone:
    | 'ops-task-breakdown-ok'
    | 'ops-task-breakdown-info'
    | 'ops-task-breakdown-warn'
    | 'ops-task-breakdown-danger';
};

type PartnerControlNextAction = {
  id: string;
  priority: number;
  status: string;
  title: string;
  detail: string;
  operatorAction: string;
  href: string;
  tags: Array<{ label: string; tone: string }>;
};

type PartnerOperatingBlock = {
  id: string;
  providerId: string;
  partner: string;
  impact: string;
  severity: string;
  tone: string;
  title: string;
  reason: string;
  operatorAction: string;
  href: string;
  priority: number;
};

type BookingAcceptanceUnblockCard = {
  id: string;
  title: string;
  status: string;
  detail: string;
  operatorScript: string;
  customerImpact: string;
  action: string;
  href: string;
  className: string;
  blockingCount: number;
  partnerSamples: string[];
  metrics: PartnerControlCommandMetric[];
};

type AcceptanceUnblockPlaybookStep = {
  id: string;
  step: string;
  owner: string;
  title: string;
  status: string;
  pillClass: string;
  detail: string;
  bookingImpact: string;
  payoutImpact: string;
  customerImpact: string;
  action: string;
  href: string;
  blockingCount: number;
  partnerSamples: string[];
};

function buildPartnerControlBoard(
  providers: AdminProvider[],
  watchlist: PartnerControlWatchItem[],
): PartnerControlBoard {
  const watchByProvider = new Map(watchlist.map((item) => [item.provider.id, item]));
  const items = providers
    .map((provider) => buildPartnerControlBoardItem(provider, watchByProvider.get(provider.id)))
    .filter((item): item is PartnerControlBoardItem => Boolean(item))
    .sort((left, right) => right.priority - left.priority || left.partner.localeCompare(right.partner))
    .slice(0, 12);
  const bookingBlocked = items.filter((item) =>
    item.controls.some((control) => control.label === 'Booking blocked'),
  );
  const payoutGated = items.filter((item) =>
    item.controls.some((control) => control.label === 'Payout gated'),
  );
  const documentReview = items.filter((item) =>
    item.controls.some((control) => control.label === 'Documents'),
  );
  const locationFollowUp = items.filter((item) =>
    item.controls.some((control) => control.label === 'Location'),
  );

  return {
    metrics: [
      metric('Active controls', items.length, items.length ? 'warn' : 'ok'),
      metric('Booking blocks', bookingBlocked.length, bookingBlocked.length ? 'danger' : 'ok'),
      metric('Payout gates', payoutGated.length, payoutGated.length ? 'warn' : 'ok'),
      metric('Documents', documentReview.length, documentReview.length ? 'warn' : 'ok'),
      metric('Location checks', locationFollowUp.length, locationFollowUp.length ? 'info' : 'ok'),
    ],
    items,
  };
}

function buildPartnerControlBoardItem(
  provider: AdminProvider,
  watchItem: PartnerControlWatchItem | undefined,
): PartnerControlBoardItem | null {
  const walletBalance = providerUnsettledWalletBalance(provider);
  const activeSanctions = (provider.sanctions ?? []).filter((sanction) => sanction.status === 'ACTIVE');
  const reportsOpen = (provider.reports ?? []).filter((report) =>
    ['OPEN', 'INVESTIGATING'].includes(report.status),
  );
  const reasons = watchItem?.signals.map((signal) => signal.label) ?? [];
  const controls: PartnerControlBoardItem['controls'] = [];
  let priority = 0;

  if (
    provider.blockedAt ||
    walletBalance < 0 ||
    activeSanctions.some((sanction) => sanction.type === 'ACCOUNT_BLOCK')
  ) {
    controls.push({ label: 'Booking blocked', className: 'pill-danger' });
    priority += 100;
  }
  if (activeSanctions.some((sanction) => sanction.type === 'PAYOUT_HOLD')) {
    controls.push({ label: 'Payout gated', className: 'pill-warn' });
    priority += 80;
  }
  if (reportsOpen.length > 0 || activeSanctions.length > 0) {
    controls.push({ label: 'Reports', className: 'pill-info' });
    priority += 60;
  }
  if (
    !provider.kyc ||
    provider.kyc.status !== 'APPROVED' ||
    !(provider.bankAccounts ?? []).some((account) => account.status === 'APPROVED')
  ) {
    controls.push({ label: 'Documents', className: 'pill-warn' });
    priority += 40;
  }
  if (watchItem?.signals.some((signal) => signal.kind === 'LOCATION')) {
    controls.push({ label: 'Location', className: 'pill-info' });
    priority += 25;
  }
  if (watchItem?.signals.some((signal) => signal.kind === 'DEVICE')) {
    controls.push({ label: 'Device', className: 'pill-info' });
    priority += 20;
  }
  if (!watchItem && controls.length === 0) return null;

  const status = controls.some((control) => control.label === 'Booking blocked')
    ? 'Blocked'
    : controls.some((control) => control.label === 'Payout gated')
      ? 'Payout'
      : 'Review';
  const fallbackReasons = reasons.length ? reasons : controls.map((control) => control.label);

  return {
    provider,
    partner: partnerDisplayText(provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id),
    status,
    walletBalance,
    reasons: fallbackReasons.slice(0, 5),
    controls,
    actionLabel: reportsOpen.length || activeSanctions.length ? 'Open reports' : 'Open profile',
    actionHref:
      reportsOpen.length || activeSanctions.length
        ? `/partner-controls?q=${encodeURIComponent(provider.id)}`
        : `/partners/${provider.id}`,
    operatorAction:
      walletBalance < 0
        ? 'Collect the cash fee deposit or approve an auditable offset before this partner accepts more bookings.'
        : activeSanctions.length
          ? 'Review active account or payout controls and record the next operation decision.'
          : 'Open the partner profile and clear the missing document, location, or device follow-up.',
    priority,
  };
}

function buildPartnerControlCommandCenter(input: PartnerControlCommandCenterInput) {
  const openReports = input.reports.filter((report) => ['OPEN', 'INVESTIGATING'].includes(report.status));
  const urgentReports = openReports.filter((report) => ['CRITICAL', 'HIGH'].includes(report.severity));
  const overdueReports = openReports.filter((report) => reportAgeHours(report) >= reportSlaHours(report));
  const activeSanctions = input.sanctions.filter((sanction) => sanction.status === 'ACTIVE');
  const activePayoutHolds = activeSanctions.filter((sanction) => sanction.type === 'PAYOUT_HOLD');
  const activeAccountBlocks = activeSanctions.filter((sanction) => sanction.type === 'ACCOUNT_BLOCK');
  const walletDebtItems = input.watchlist.filter((item) => item.walletBalance < 0);
  const sharedDeviceItems = input.watchlist.filter((item) =>
    item.signals.some((signal) => signal.kind === 'DEVICE'),
  );

  const lanes = [
    {
      title: 'Safety triage',
      status: urgentReports.length ? 'URGENT' : 'CLEAR',
      detail: urgentReports.length
        ? 'Urgent or major reports need evidence review and a decision before profile review changes.'
        : 'No urgent or major partner report is currently open.',
      href: urgentReports.length ? '/partner-controls?severity=HIGH_PLUS' : '/partner-controls?status=OPEN',
      action: urgentReports.length ? 'Open urgent + major lane' : 'Review open reports',
      className: urgentReports.length ? 'ops-task-blocked' : 'ops-task-done',
      metrics: [
        metric('Urgent', urgentReports.filter((report) => report.severity === 'CRITICAL').length, 'danger'),
        metric('Major', urgentReports.filter((report) => report.severity === 'HIGH').length, 'warn'),
        metric('Open', openReports.length, openReports.length ? 'info' : 'ok'),
      ],
    },
    {
      title: 'Finance block',
      status: walletDebtItems.length ? 'BLOCKED' : 'CLEAR',
      detail: walletDebtItems.length
        ? 'Negative wallet partners must settle cash fee debt before marketplace participation or payout release.'
        : 'No partner wallet is currently blocked by cash fee debt.',
      href: walletDebtItems.length ? '/cash-settlements' : '/earnings',
      action: walletDebtItems.length ? 'Open cash settlements' : 'Review earnings',
      className: walletDebtItems.length ? 'ops-task-blocked' : 'ops-task-done',
      metrics: [
        metric('Wallets', walletDebtItems.length, walletDebtItems.length ? 'danger' : 'ok'),
        metric(
          'Debt',
          formatMoney(walletDebtItems.reduce((sum, item) => sum + Math.abs(item.walletBalance), 0)),
          walletDebtItems.length ? 'danger' : 'ok',
        ),
        metric('Payout holds', activePayoutHolds.length, activePayoutHolds.length ? 'warn' : 'ok'),
      ],
    },
    {
      title: 'Access controls',
      status: activeSanctions.length ? 'LIVE' : 'CLEAR',
      detail: activeSanctions.length
        ? 'Active account controls are live operating controls and need clean audit follow-up.'
        : 'No active account control is currently restricting partner operations.',
      href: activeSanctions.length ? '/partner-controls?sanction=ACTIVE' : '/partner-controls',
      action: activeSanctions.length ? 'Review active controls' : 'Open control board',
      className: activeSanctions.length ? 'ops-task-pending' : 'ops-task-done',
      metrics: [
        metric('Controls', activeSanctions.length, activeSanctions.length ? 'warn' : 'ok'),
        metric('Account blocks', activeAccountBlocks.length, activeAccountBlocks.length ? 'danger' : 'ok'),
        metric('Shared devices', sharedDeviceItems.length, sharedDeviceItems.length ? 'warn' : 'ok'),
      ],
    },
    {
      title: 'SLA aging',
      status: overdueReports.length ? 'OVERDUE' : 'ON TRACK',
      detail: overdueReports.length
        ? 'Some open investigations have passed the target review window.'
        : 'Open partner reports are inside their review windows.',
      href: overdueReports.length
        ? '/partner-controls?status=OPEN'
        : '/partner-controls?status=INVESTIGATING',
      action: overdueReports.length ? 'Clear overdue reports' : 'Review investigations',
      className: overdueReports.length ? 'ops-task-blocked' : 'ops-task-done',
      metrics: [
        metric('Overdue', overdueReports.length, overdueReports.length ? 'danger' : 'ok'),
        metric(
          'Investigating',
          openReports.filter((report) => report.status === 'INVESTIGATING').length,
          'info',
        ),
        metric('Oldest', oldestReportAgeLabel(openReports), overdueReports.length ? 'warn' : 'ok'),
      ],
    },
  ];

  return {
    urgentCount: urgentReports.length + walletDebtItems.length + overdueReports.length,
    lanes,
    nextActions: buildPartnerControlNextActions({
      openReports,
      activeSanctions,
      watchlist: input.watchlist,
    }),
  };
}

function buildPartnerOperatingBlocks(watchlist: PartnerControlWatchItem[]) {
  const blocks: PartnerOperatingBlock[] = [];

  for (const item of watchlist) {
    const partner = adminProviderName(item.provider);
    if (item.walletBalance < 0) {
      blocks.push({
        id: `${item.provider.id}-wallet`,
        providerId: item.provider.id,
        partner,
        impact: 'MARKETPLACE BLOCK',
        severity: 'Wallet debt',
        tone: 'pill-danger',
        title: `${partner} cannot participate in marketplace bookings`,
        reason: `${formatMoney(Math.abs(item.walletBalance))} cash/company fee debt is still open.`,
        operatorAction: `Confirm partner deposit, admin offset, or finance adjustment using ${cashDebtSettlementReference(item.provider.id)}.`,
        href: '/cash-settlements',
        priority: 110 + Math.min(20, Math.abs(item.walletBalance) / 100000),
      });
    }

    if (item.provider.blockedAt) {
      blocks.push({
        id: `${item.provider.id}-account-block`,
        providerId: item.provider.id,
        partner,
        impact: 'ACCOUNT BLOCK',
        severity: 'Blocked',
        tone: 'pill-danger',
        title: `${partner} account is blocked`,
        reason: item.provider.blockedReason || 'Partner account is restricted by an admin control.',
        operatorAction:
          'Review evidence and unblock only when the audit trail clearly explains the decision.',
        href: `/partners/${item.provider.id}`,
        priority: 105,
      });
    }

    if (item.hasPayoutHold) {
      blocks.push({
        id: `${item.provider.id}-payout-hold`,
        providerId: item.provider.id,
        partner,
        impact: 'PAYOUT BLOCK',
        severity: 'Payout hold',
        tone: 'pill-danger',
        title: `${partner} payout is on hold`,
        reason:
          'Active payout hold prevents normal payout processing until the underlying report is cleared.',
        operatorAction:
          'Open the payout and control lanes, resolve evidence, then lift the account control if appropriate.',
        href: '/payouts',
        priority: 92,
      });
    }

    if (item.openReportCount > 0) {
      blocks.push({
        id: `${item.provider.id}-open-report`,
        providerId: item.provider.id,
        partner,
        impact: 'REPORT REVIEW',
        severity: `${item.openReportCount} report(s)`,
        tone: item.severity === 'CRITICAL' || item.severity === 'HIGH' ? 'pill-danger' : 'pill-warn',
        title: `${partner} has open reports`,
        reason: 'Open reports can affect profile review, payout release, and future dispatch decisions.',
        operatorAction:
          'Move the report to investigating, resolve with notes, dismiss with evidence, or apply an account control.',
        href: `/partner-controls?q=${encodeURIComponent(item.provider.id)}`,
        priority: item.severity === 'CRITICAL' ? 88 : 78,
      });
    }

    const locationSignal = item.signals.find((signal) => signal.kind === 'LOCATION');
    if (locationSignal) {
      blocks.push({
        id: `${item.provider.id}-location`,
        providerId: item.provider.id,
        partner,
        impact: 'DISPATCH CHECK',
        severity: locationSignal.label,
        tone: 'pill-warn',
        title: `${partner} location needs refresh`,
        reason:
          'Distance sorting and configured invitation-radius decisions can be wrong when online location is missing or stale.',
        operatorAction:
          'Ask the partner to reopen the app and refresh location before dispatch-sensitive work.',
        href: `/partners/${item.provider.id}`,
        priority: 64,
      });
    }

    if (item.signals.some((signal) => signal.kind === 'KYC')) {
      blocks.push({
        id: `${item.provider.id}-kyc`,
        providerId: item.provider.id,
        partner,
        impact: 'LEVEL GATE',
        severity: 'KYC pending',
        tone: 'pill-warn',
        title: `${partner} KYC is not approved`,
        reason:
          'Partner can remain in onboarding, but activity level should not be upgraded without identity approval.',
        operatorAction: 'Review CCCD/CMND and selfie documents, then approve, reject, or request reupload.',
        href: `/partners/${item.provider.id}`,
        priority: 56,
      });
    }

    if (item.signals.some((signal) => signal.kind === 'BANK')) {
      blocks.push({
        id: `${item.provider.id}-bank`,
        providerId: item.provider.id,
        partner,
        impact: 'PAYOUT SETUP',
        severity: 'Bank pending',
        tone: 'pill-warn',
        title: `${partner} bank account is not approved`,
        reason:
          'Partner may work only if policy allows it, but payout cannot be released without a verified account.',
        operatorAction: 'Review bank name, account holder, QR/banking data, and account-change history.',
        href: `/partners/${item.provider.id}`,
        priority: 48,
      });
    }

    if (item.signals.some((signal) => signal.kind === 'TAX')) {
      blocks.push({
        id: `${item.provider.id}-tax`,
        providerId: item.provider.id,
        partner,
        impact: 'FIRST EARNING',
        severity: 'Tax pending',
        tone: 'pill-info',
        title: `${partner} tax profile is not approved`,
        reason:
          'Tax data should be requested after first earning, but tax rules must already exist in the system.',
        operatorAction:
          'Keep earning calculation policy active, then require tax profile before payout or wallet withdrawal.',
        href: '/tax-policy',
        priority: 36,
      });
    }
  }

  return blocks.sort((left, right) => right.priority - left.priority).slice(0, 18);
}

function buildBookingAcceptanceUnblockBoard(
  watchlist: PartnerControlWatchItem[],
  controlPolicy = DEFAULT_PARTNER_CONTROL_POLICY,
): BookingAcceptanceUnblockCard[] {
  const cashDebtItems = watchlist.filter((item) => item.walletBalance < 0);
  const accountBlockedItems = watchlist.filter(
    (item) => item.provider.blockedAt || item.signals.some((signal) => signal.kind === 'BLOCK'),
  );
  const locationItems = watchlist.filter((item) => item.signals.some((signal) => signal.kind === 'LOCATION'));
  const verificationItems = watchlist.filter((item) =>
    item.signals.some((signal) => ['KYC', 'BANK'].includes(signal.kind)),
  );
  const deviceItems = watchlist.filter((item) => partnerHasDeviceContactGap(item.provider));
  const taxItems = watchlist.filter((item) => item.signals.some((signal) => signal.kind === 'TAX'));

  return [
    {
      id: 'wallet-debt',
      title: 'Cash fee debt gates marketplace participation',
      status: cashDebtItems.length ? 'BLOCKING' : 'CLEAR',
      detail: cashDebtItems.length
        ? 'Partners with negative wallet balance can stay visible but cannot participate in marketplace requests or receive payout release until HANDS fee debt is settled.'
        : 'No partner is currently blocked by cash-service fee debt.',
      operatorScript:
        'Tell the partner their unpaid HANDS fee must be deposited or offset before marketplace participation or payout release unlocks.',
      customerImpact:
        'Customers can still see marketplace demand flow normally; the partner cannot participate in marketplace requests until fee settlement is cleared.',
      action: cashDebtItems.length ? 'Open settlement queue' : 'Review wallet policy',
      href: cashDebtItems.length ? '/cash-settlements' : '/operations-policy',
      className: cashDebtItems.length ? 'ops-task-blocked' : 'ops-task-done',
      blockingCount: cashDebtItems.length,
      partnerSamples: partnerSamples(cashDebtItems),
      metrics: [
        metric('Blocked', cashDebtItems.length, cashDebtItems.length ? 'danger' : 'ok'),
        metric(
          'Debt',
          formatMoney(cashDebtItems.reduce((sum, item) => sum + Math.abs(item.walletBalance), 0)),
          cashDebtItems.length ? 'danger' : 'ok',
        ),
        metric('Rule', 'Negative wallet', cashDebtItems.length ? 'warn' : 'ok'),
      ],
    },
    {
      id: 'account-controls',
      title: 'Account controls stop work',
      status: accountBlockedItems.length ? 'BLOCKING' : 'CLEAR',
      detail: accountBlockedItems.length
        ? 'Blocked accounts or active account controls must be reviewed before the partner receives work.'
        : 'No account block is currently holding partner work access.',
      operatorScript:
        'Keep the block active until evidence, notes, and the unblock reason are clear in the audit trail.',
      customerImpact: 'Customers will not see or match with partners under active account restrictions.',
      action: accountBlockedItems.length ? 'Review account blocks' : 'Open control board',
      href: accountBlockedItems.length ? '/partner-controls?sanction=ACTIVE' : '/partner-controls',
      className: accountBlockedItems.length ? 'ops-task-blocked' : 'ops-task-done',
      blockingCount: accountBlockedItems.length,
      partnerSamples: partnerSamples(accountBlockedItems),
      metrics: [
        metric('Blocked', accountBlockedItems.length, accountBlockedItems.length ? 'danger' : 'ok'),
        metric('Profile', accountBlockedItems.filter((item) => item.provider.blockedAt).length, 'info'),
        metric('Audit', 'Required', accountBlockedItems.length ? 'warn' : 'ok'),
      ],
    },
    {
      id: 'location-dispatch',
      title: 'Location freshness controls dispatch',
      status: locationItems.length ? 'DISPATCH HOLD' : 'READY',
      detail: locationItems.length
        ? `Distance ordering, ${formatDistance(
            controlPolicy.backupRadiusMeters,
          )} marketplace invitations, the ${controlPolicy.invitationLimit}-partner invite cap, and customer expectations depend on fresh partner location.`
        : 'Online partner locations are fresh enough for dispatch decisions.',
      operatorScript:
        'Ask the partner to reopen the app and refresh GPS before taking dispatch-sensitive bookings.',
      customerImpact:
        'Distance sorting and marketplace invitations can be inaccurate when the last location is stale.',
      action: locationItems.length ? 'Open partner profiles' : 'Review location policy',
      href: locationItems.length ? '/partners' : '/operations-policy',
      className: locationItems.length ? 'ops-task-pending' : 'ops-task-done',
      blockingCount: 0,
      partnerSamples: partnerSamples(locationItems),
      metrics: [
        metric('Stale/missing', locationItems.length, locationItems.length ? 'warn' : 'ok'),
        metric('Acceptance', 'Policy gate', locationItems.length ? 'warn' : 'ok'),
        metric(
          'Invite pool',
          `${formatDistance(controlPolicy.backupRadiusMeters)} / ${controlPolicy.invitationLimit}`,
          'info',
        ),
      ],
    },
    {
      id: 'verification-readiness',
      title: 'KYC and bank readiness',
      status: verificationItems.length ? 'BOOKING BLOCK' : 'READY',
      detail: verificationItems.length
        ? 'Identity or bank gaps hold paid work eligibility and marketplace participation until cleared.'
        : 'KYC and bank approval gaps are not blocking listed partners.',
      operatorScript:
        'Review CCCD/CMND, selfie, and bank evidence; reject with a specific reupload reason if anything is unclear.',
      customerImpact:
        'Paid work should only be accepted by partners who passed identity and payout readiness checks.',
      action: verificationItems.length ? 'Open acceptance-blocked partners' : 'Review partner levels',
      href: verificationItems.length ? '/partners?review=acceptance-blocked' : '/partners',
      className: verificationItems.length ? 'ops-task-blocked' : 'ops-task-done',
      blockingCount: verificationItems.length,
      partnerSamples: partnerSamples(verificationItems),
      metrics: [
        metric('Blocked', verificationItems.length, verificationItems.length ? 'danger' : 'ok'),
        metric('Work level', 'Level 2 gate', verificationItems.length ? 'danger' : 'ok'),
        metric('Payout', 'Requires bank', verificationItems.length ? 'warn' : 'ok'),
      ],
    },
    {
      id: 'device-contact',
      title: 'Push/contact readiness',
      status: deviceItems.length ? 'CONTACT CHECK' : 'READY',
      detail: deviceItems.length
        ? 'Partners without an enabled device can miss marketplace invitations and direct booking alerts.'
        : 'Partner device readiness does not show a broad notification follow-up.',
      operatorScript:
        'Confirm the partner has a current app session and enabled device before relying on push alerts.',
      customerImpact:
        'Marketplace supply may look available but fail to respond if the partner cannot receive alerts.',
      action: deviceItems.length ? 'Open app sessions' : 'Review sessions',
      href: '/app-sessions',
      className: deviceItems.length ? 'ops-task-pending' : 'ops-task-done',
      blockingCount: 0,
      partnerSamples: partnerSamples(deviceItems),
      metrics: [
        metric('Contact gaps', deviceItems.length, deviceItems.length ? 'warn' : 'ok'),
        metric('Push', 'Invite check', deviceItems.length ? 'warn' : 'ok'),
        metric('Fallback', 'Manual call', 'info'),
      ],
    },
    {
      id: 'tax-after-first-earning',
      title: 'Tax is a payout gate after first earning',
      status: taxItems.length ? 'PAYOUT GATE' : 'READY',
      detail:
        'Tax data should not block lightweight signup or first booking flow, but payout and withdrawal stay gated after first earning.',
      operatorScript:
        'Do not force tax data during initial signup; request it after first earning and before payout or withdrawal.',
      customerImpact:
        'Customers can book newer partners without extra signup friction, while finance remains protected before payout.',
      action: taxItems.length ? 'Open tax policy' : 'Review tax rules',
      href: '/tax-policy',
      className: taxItems.length ? 'ops-task-pending' : 'ops-task-done',
      blockingCount: 0,
      partnerSamples: partnerSamples(taxItems),
      metrics: [
        metric('Tax pending', taxItems.length, taxItems.length ? 'info' : 'ok'),
        metric('Acceptance', 'Not blocked', 'ok'),
        metric('Payout', 'Blocked later', taxItems.length ? 'warn' : 'ok'),
      ],
    },
  ];
}

function buildAcceptanceUnblockPlaybook(
  cards: BookingAcceptanceUnblockCard[],
): AcceptanceUnblockPlaybookStep[] {
  const byId = new Map(cards.map((card) => [card.id, card]));
  const card = (id: string) => byId.get(id);

  return [
    {
      id: 'playbook-wallet-debt',
      step: '1',
      owner: 'Finance',
      title: 'Clear negative wallet first',
      status: card('wallet-debt')?.status ?? 'UNKNOWN',
      pillClass: card('wallet-debt')?.blockingCount ? 'pill-danger' : 'pill-success',
      detail:
        'Negative wallet is the strongest marketplace gate because cash bookings create unpaid HANDS fee debt.',
      bookingImpact:
        'Keeps marketplace visibility available, but marketplace participation waits until deposit, admin offset, or earning offset is recorded.',
      payoutImpact:
        'Debt should be visible before payout so finance does not pay a partner while platform fees are unpaid.',
      customerImpact:
        'Customer final choice stays available only from actual eligible participants; fee-debt partners cannot enter the marketplace candidate list.',
      action: card('wallet-debt')?.action ?? 'Open settlement queue',
      href: card('wallet-debt')?.href ?? '/cash-settlements',
      blockingCount: card('wallet-debt')?.blockingCount ?? 0,
      partnerSamples: card('wallet-debt')?.partnerSamples ?? [],
    },
    {
      id: 'playbook-account-controls',
      step: '2',
      owner: 'Account ops',
      title: 'Resolve account controls',
      status: card('account-controls')?.status ?? 'UNKNOWN',
      pillClass: card('account-controls')?.blockingCount ? 'pill-danger' : 'pill-success',
      detail:
        'Account blocks and active account controls are deliberate operational controls and should stay above convenience.',
      bookingImpact: 'Blocks partner visibility and work access while the restriction is active.',
      payoutImpact: 'Payout holds should remain until the report or account control has a clean audit outcome.',
      customerImpact: 'Keeps customer bookings away from accounts with unresolved admin holds until documented review is complete.',
      action: card('account-controls')?.action ?? 'Review account blocks',
      href: card('account-controls')?.href ?? '/partner-controls?sanction=ACTIVE',
      blockingCount: card('account-controls')?.blockingCount ?? 0,
      partnerSamples: card('account-controls')?.partnerSamples ?? [],
    },
    {
      id: 'playbook-verification',
      step: '3',
      owner: 'KYC',
      title: 'Approve identity and bank readiness',
      status: card('verification-readiness')?.status ?? 'UNKNOWN',
      pillClass: card('verification-readiness')?.blockingCount ? 'pill-danger' : 'pill-success',
      detail:
        'KYC, required CCCD/selfie documents, and bank approval are the Level 2 work gate for paid bookings.',
      bookingImpact:
        'Holds preferred direct requests and marketplace participation until identity evidence and bank readiness are approved.',
      payoutImpact: 'Bank approval is required before payout; tax remains staged until first earning.',
      customerImpact: 'Keeps customer-facing booking flow simple while operators verify partner readiness before work access.',
      action: card('verification-readiness')?.action ?? 'Open acceptance-blocked partners',
      href: card('verification-readiness')?.href ?? '/partners?review=acceptance-blocked',
      blockingCount: card('verification-readiness')?.blockingCount ?? 0,
      partnerSamples: card('verification-readiness')?.partnerSamples ?? [],
    },
    {
      id: 'playbook-location',
      step: '4',
      owner: 'Dispatch',
      title: 'Refresh stale partner location',
      status: card('location-dispatch')?.status ?? 'UNKNOWN',
      pillClass: card('location-dispatch')?.blockingCount ? 'pill-danger' : 'pill-warn',
      detail:
        'Location freshness controls distance sorting and marketplace invite quality, but it is often solved by reopening the app.',
      bookingImpact:
        'Can weaken marketplace matching or make customer ETA expectations unreliable.',
      payoutImpact:
        'No direct payout impact, but location evidence may matter for disputes and no-show review.',
      customerImpact: 'Improves nearby partner ordering and reduces wasted waiting time.',
      action: card('location-dispatch')?.action ?? 'Open partner profiles',
      href: card('location-dispatch')?.href ?? '/partners?review=location',
      blockingCount: card('location-dispatch')?.blockingCount ?? 0,
      partnerSamples: card('location-dispatch')?.partnerSamples ?? [],
    },
    {
      id: 'playbook-device-contact',
      step: '5',
      owner: 'Ops',
      title: 'Confirm device and alert reachability',
      status: card('device-contact')?.status ?? 'UNKNOWN',
      pillClass: card('device-contact')?.blockingCount ? 'pill-danger' : 'pill-warn',
      detail:
        'In-app alerts are active now and OS push is deferred, so recent app sessions and enabled devices matter.',
      bookingImpact:
        'Does not always hard-block acceptance, but weakens response rate and marketplace participation.',
      payoutImpact: 'No direct payout impact.',
      customerImpact: 'Reduces missed partner requests during the 10 minute response window.',
      action: card('device-contact')?.action ?? 'Open app sessions',
      href: card('device-contact')?.href ?? '/app-sessions',
      blockingCount: card('device-contact')?.blockingCount ?? 0,
      partnerSamples: card('device-contact')?.partnerSamples ?? [],
    },
    {
      id: 'playbook-tax',
      step: '6',
      owner: 'Finance',
      title: 'Keep tax as post-first-earning payout gate',
      status: card('tax-after-first-earning')?.status ?? 'UNKNOWN',
      pillClass: card('tax-after-first-earning')?.blockingCount ? 'pill-warn' : 'pill-success',
      detail:
        'Tax policy must be configured from day one, but partner tax profile collection waits until first earning.',
      bookingImpact: 'Should not block first signup or first paid job.',
      payoutImpact:
        'Blocks payout and withdrawal after first earning until MST, address, and agreements are complete.',
      customerImpact: 'Reduces partner onboarding drop-off while finance remains controlled before payout.',
      action: card('tax-after-first-earning')?.action ?? 'Open tax policy',
      href: card('tax-after-first-earning')?.href ?? '/tax-policy',
      blockingCount: card('tax-after-first-earning')?.blockingCount ?? 0,
      partnerSamples: card('tax-after-first-earning')?.partnerSamples ?? [],
    },
  ];
}

function partnerSamples(items: PartnerControlWatchItem[], limit = 3) {
  return items.slice(0, limit).map((item) => adminProviderName(item.provider));
}

function partnerHasDeviceContactGap(provider: AdminProvider) {
  const devices = provider.devices ?? [];
  if (!devices.length) {
    return true;
  }
  return !devices.some((device) => device.enabled && !device.blockedAt);
}

function metric(
  label: string,
  value: string | number,
  tone: 'ok' | 'info' | 'warn' | 'danger',
): PartnerControlCommandMetric {
  const toneClass: Record<'ok' | 'info' | 'warn' | 'danger', PartnerControlCommandMetric['tone']> = {
    ok: 'ops-task-breakdown-ok',
    info: 'ops-task-breakdown-info',
    warn: 'ops-task-breakdown-warn',
    danger: 'ops-task-breakdown-danger',
  };

  return {
    label,
    value: typeof value === 'number' ? value.toString() : value,
    tone: toneClass[tone],
  };
}

function buildPartnerControlNextActions(input: {
  openReports: AdminProviderReport[];
  activeSanctions: AdminProviderSanction[];
  watchlist: PartnerControlWatchItem[];
}) {
  const actions: PartnerControlNextAction[] = [];

  for (const report of input.openReports) {
    const ageHours = reportAgeHours(report);
    const slaHours = reportSlaHours(report);
    actions.push({
      id: `report-${report.id}`,
      priority: severityPriority(report.severity) + (ageHours >= slaHours ? 30 : 0),
      status: ageHours >= slaHours ? 'OVERDUE' : report.severity,
      title: partnerDisplayText(report.summary),
      detail: `${providerNameOrId(report.providerProfile, report.providerProfileId)} / ${report.category} / ${report.status} / ${ageLabel(ageHours)} old`,
      operatorAction:
        ageHours >= slaHours
          ? `Past ${slaHours}h target. Add resolution note, assign account control, or dismiss with evidence.`
          : 'Review evidence and move to investigating, resolved, dismissed, or account control.',
      href: report.bookingId
        ? `/bookings/${report.bookingId}`
        : `/partner-controls?q=${encodeURIComponent(report.id)}`,
      tags: [
        { label: report.severity, tone: severityPill(report.severity) },
        { label: report.status, tone: statusPill(report.status) },
        { label: `${slaHours}h SLA`, tone: ageHours >= slaHours ? 'pill-danger' : 'pill-info' },
      ],
    });
  }

  for (const item of input.watchlist.filter((watch) => watch.walletBalance < 0)) {
    actions.push({
      id: `wallet-${item.provider.id}`,
      priority: 95 + Math.min(20, Math.abs(item.walletBalance) / 100000),
      status: 'WALLET',
      title: `${adminProviderName(item.provider)} cash fee debt`,
      detail: `${formatMoney(Math.abs(item.walletBalance))} must be settled or offset before marketplace participation or payout release.`,
      operatorAction: `Use ${cashDebtSettlementReference(item.provider.id)} and confirm finance settlement.`,
      href: '/cash-settlements',
      tags: [
        { label: 'Cash debt', tone: 'pill-danger' },
        { label: 'Booking blocked', tone: 'pill-danger' },
      ],
    });
  }

  for (const sanction of input.activeSanctions.slice(0, 12)) {
    actions.push({
      id: `sanction-${sanction.id}`,
      priority: sanction.type === 'ACCOUNT_BLOCK' ? 90 : sanction.type === 'PAYOUT_HOLD' ? 82 : 60,
      status: sanction.type,
      title: `${providerNameOrId(sanction.providerProfile, sanction.providerProfileId)} account control active`,
      detail: partnerDisplayText(sanction.reason),
      operatorAction:
        sanction.type === 'PAYOUT_HOLD'
          ? 'Resolve payout evidence before creating or paying payout batches.'
          : 'Keep or lift the account control only with a clear audit trail.',
      href: `/partner-controls?q=${encodeURIComponent(sanction.providerProfileId)}`,
      tags: [
        { label: sanction.status, tone: 'pill-danger' },
        { label: sanction.type, tone: sanction.type === 'WARNING' ? 'pill-warn' : 'pill-danger' },
      ],
    });
  }

  return actions.sort((left, right) => right.priority - left.priority).slice(0, 10);
}

function buildFilters(params: Record<string, string | string[] | undefined>) {
  return {
    q: readParam(params.q).toLowerCase(),
    status: readParam(params.status),
    severity: readParam(params.severity),
    sanction: readParam(params.sanction),
  };
}

function buildPartnerControlActiveFilters(filters: ReturnType<typeof buildFilters>) {
  return [
    filters.q
      ? {
          kind: 'search',
          value: filters.q,
          label: `Search: ${filters.q}`,
          description: 'Control rows are narrowed by partner, phone, category, reason, or report text.',
        }
      : null,
    filters.status
      ? {
          kind: 'status',
          value: filters.status,
          label: `Report: ${filters.status}`,
          description: controlFilterDescription('status', filters.status),
        }
      : null,
    filters.severity
      ? {
          kind: 'severity',
          value: filters.severity,
          label: `Report level: ${filters.severity === 'HIGH_PLUS' ? 'CRITICAL + HIGH' : filters.severity}`,
          description: controlFilterDescription('severity', filters.severity),
        }
      : null,
    filters.sanction
      ? {
          kind: 'sanction',
          value: filters.sanction,
          label: `Control: ${filters.sanction}`,
          description: controlFilterDescription('sanction', filters.sanction),
        }
      : null,
  ].filter(Boolean) as Array<{ kind: string; value: string; label: string; description: string }>;
}

function controlFilterDescription(kind: string, value: string) {
  if (kind === 'status' && value === 'OPEN') {
    return 'Open reports need triage before profile review or payout decisions.';
  }
  if (kind === 'status' && value === 'INVESTIGATING') {
    return 'Investigating reports need evidence, customer notes, or staff follow-up.';
  }
  if (kind === 'severity') {
    if (value === 'HIGH_PLUS') {
      return 'Urgent and major reports are prioritized together for safety review.';
    }
    return `${value.toLowerCase()} level reports are prioritized for operator review.`;
  }
  if (kind === 'sanction' && value === 'ACTIVE') {
    return 'Active account controls restrict work or payout and should be lifted only with a clear audit trail.';
  }
  if (kind === 'sanction') {
    return 'Account controls are narrowed to the selected lifecycle state.';
  }
  return 'Control board is narrowed by the active filter.';
}

function emptyPartnerControlMessage(kind: 'report' | 'sanction', activeFilters: Array<{ description: string }>) {
  const subject = kind === 'report' ? 'partner reports' : 'partner account controls';
  if (activeFilters.length === 0) {
    return `No ${subject} loaded yet.`;
  }
  return `No ${subject} match the active filters. Clear filters or switch investigation lane.`;
}

function readParam(value: string | string[] | undefined) {
  return readSearchParam(value);
}

function filterReports(reports: AdminProviderReport[], filters: ReturnType<typeof buildFilters>) {
  return reports.filter((report) => {
    if (filters.status && report.status !== filters.status) return false;
    if (filters.severity === 'HIGH_PLUS' && !['CRITICAL', 'HIGH'].includes(report.severity)) return false;
    if (filters.severity && filters.severity !== 'HIGH_PLUS' && report.severity !== filters.severity) {
      return false;
    }
    if (filters.q && !reportSearchText(report).includes(filters.q)) return false;
    return true;
  });
}

function filterSanctions(sanctions: AdminProviderSanction[], filters: ReturnType<typeof buildFilters>) {
  return sanctions.filter((sanction) => {
    if (filters.sanction && sanction.status !== filters.sanction) return false;
    if (filters.q && !sanctionSearchText(sanction).includes(filters.q)) return false;
    return true;
  });
}

function buildPartnerControlSummary(
  reports: AdminProviderReport[],
  sanctions: AdminProviderSanction[],
  providers: AdminProvider[],
  controlPolicy = DEFAULT_PARTNER_CONTROL_POLICY,
) {
  const watchlist = buildPartnerControlWatchlist(providers, controlPolicy);
  return [
    [
      'Open reports',
      reports.filter((report) => ['OPEN', 'INVESTIGATING'].includes(report.status)).length.toString(),
    ],
    [
      'Urgent / major',
      reports.filter((report) => ['CRITICAL', 'HIGH'].includes(report.severity)).length.toString(),
    ],
    ['Active controls', sanctions.filter((sanction) => sanction.status === 'ACTIVE').length.toString()],
    ['Blocked accounts', providers.filter((provider) => provider.blockedAt).length.toString()],
    ['Wallet debt', watchlist.filter((item) => item.walletBalance < 0).length.toString()],
    [
      'Location gaps',
      providers.filter((provider) => Boolean(providerLocationSignal(provider, controlPolicy))).length.toString(),
    ],
    [
      'Shared devices',
      watchlist.filter((item) => item.signals.some((signal) => signal.kind === 'DEVICE')).length.toString(),
    ],
    [
      'Onboarding gaps',
      watchlist
        .filter((item) => item.signals.some((signal) => ['KYC', 'BANK', 'TAX'].includes(signal.kind)))
        .length.toString(),
    ],
  ] as const;
}

type PartnerControlWatchItem = {
  provider: AdminProvider;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  signals: Array<{ kind: string; label: string }>;
  walletBalance: number;
  openReportCount: number;
  hasPayoutHold: boolean;
  detail: string;
  nextStep: string;
};

function buildPartnerControlWatchlist(
  providers: AdminProvider[],
  controlPolicy = DEFAULT_PARTNER_CONTROL_POLICY,
): PartnerControlWatchItem[] {
  const deviceUsage = buildDeviceUsage(providers);
  return providers
    .map((provider) => buildPartnerControlWatchItem(provider, deviceUsage, controlPolicy))
    .filter((item): item is PartnerControlWatchItem => Boolean(item))
    .sort((left, right) => watchSeverityRank(right.severity) - watchSeverityRank(left.severity));
}

function buildPartnerControlWatchItem(
  provider: AdminProvider,
  deviceUsage: Map<string, Set<string>>,
  controlPolicy = DEFAULT_PARTNER_CONTROL_POLICY,
): PartnerControlWatchItem | null {
  const walletBalance = providerUnsettledWalletBalance(provider);
  const openReportCount = (provider.reports ?? []).filter((report) =>
    ['OPEN', 'INVESTIGATING'].includes(report.status),
  ).length;
  const activeSanctions = (provider.sanctions ?? []).filter((sanction) => sanction.status === 'ACTIVE');
  const hasPayoutHold = activeSanctions.some((sanction) => sanction.type === 'PAYOUT_HOLD');
  const sharedDeviceCount = providerSharedDeviceCount(provider, deviceUsage);
  const signals: PartnerControlWatchItem['signals'] = [];

  if (provider.blockedAt) signals.push({ kind: 'BLOCK', label: 'Account blocked' });
  if (walletBalance < 0) signals.push({ kind: 'WALLET', label: 'Negative wallet' });
  if (hasPayoutHold) signals.push({ kind: 'PAYOUT', label: 'Payout hold' });
  if (openReportCount > 0) signals.push({ kind: 'REPORT', label: `${openReportCount} open report(s)` });
  if (sharedDeviceCount > 0) signals.push({ kind: 'DEVICE', label: `${sharedDeviceCount} shared device(s)` });
  const locationSignal = providerLocationSignal(provider, controlPolicy);
  if (locationSignal) {
    signals.push({ kind: 'LOCATION', label: locationSignal });
  }
  if (!provider.kyc || provider.kyc.status !== 'APPROVED')
    signals.push({ kind: 'KYC', label: 'KYC not approved' });
  if (!(provider.bankAccounts ?? []).some((account) => account.status === 'APPROVED')) {
    signals.push({ kind: 'BANK', label: 'Bank not approved' });
  }
  if (!provider.taxProfile || provider.taxProfile.status !== 'APPROVED') {
    signals.push({ kind: 'TAX', label: 'Tax not approved' });
  }

  if (!signals.length) return null;

  const severity =
    provider.blockedAt || walletBalance < 0 || hasPayoutHold
      ? 'CRITICAL'
      : openReportCount > 0 || sharedDeviceCount > 0
        ? 'HIGH'
        : ['KYC', 'BANK', 'LOCATION'].some((kind) => signals.some((signal) => signal.kind === kind))
          ? 'MEDIUM'
          : 'LOW';

  return {
    provider,
    severity,
    signals,
    walletBalance,
    openReportCount,
    hasPayoutHold,
    detail: partnerControlDetail({ walletBalance, openReportCount, sharedDeviceCount, signals }),
    nextStep: partnerControlNextStep({ walletBalance, hasPayoutHold, openReportCount, provider }, controlPolicy),
  };
}

function partnerControlDetail(input: {
  walletBalance: number;
  openReportCount: number;
  sharedDeviceCount: number;
  signals: Array<{ kind: string }>;
}) {
  if (input.walletBalance < 0) {
    return 'Partner can remain visible, but final cash/direct work gates wait until company fee debt is settled.';
  }
  if (input.openReportCount > 0) {
    return 'Open report history needs operator review before profile review, payout, or account changes.';
  }
  if (input.sharedDeviceCount > 0) {
    return 'Device overlap can indicate duplicate accounts or account sharing.';
  }
  if (input.signals.some((signal) => signal.kind === 'TAX')) {
    return 'Tax information can stay pending until first earning, but payout must remain gated.';
  }
  if (input.signals.some((signal) => signal.kind === 'LOCATION')) {
    return 'Online partner location is missing or stale, so dispatch distance and customer expectation can be wrong.';
  }
  return 'Partner has onboarding or compliance gaps that need staff follow-up.';
}

function partnerControlNextStep(
  input: {
    walletBalance: number;
    hasPayoutHold: boolean;
    openReportCount: number;
    provider: AdminProvider;
  },
  controlPolicy = DEFAULT_PARTNER_CONTROL_POLICY,
) {
  if (input.walletBalance < 0) {
    return `Confirm partner deposit or admin offset using ${cashDebtSettlementReference(input.provider.id)}.`;
  }
  if (input.hasPayoutHold) {
    return 'Resolve payout hold evidence before creating or paying payout batches.';
  }
  if (input.openReportCount > 0) {
    return 'Update report status with resolution note or apply an account control if needed.';
  }
  if (providerLocationSignal(input.provider, controlPolicy)) {
    return 'Ask the partner to reopen the app and refresh their current location before dispatch-sensitive work.';
  }
  return 'Complete missing verification data before enabling additional profile review or payout features.';
}

function providerLocationSignal(provider: AdminProvider, controlPolicy = DEFAULT_PARTNER_CONTROL_POLICY) {
  if (!provider.status.startsWith('ONLINE')) {
    return null;
  }
  if (
    provider.currentLat === null ||
    provider.currentLat === undefined ||
    provider.currentLng === null ||
    provider.currentLng === undefined
  ) {
    return 'Online location missing';
  }
  if (!provider.currentLocationUpdatedAt) {
    return 'Location timestamp missing';
  }

  const updatedAt = Date.parse(provider.currentLocationUpdatedAt);
  if (!Number.isFinite(updatedAt)) {
    return 'Location timestamp invalid';
  }
  return Date.now() - updatedAt > controlPolicy.locationFreshnessMinutes * 60_000
    ? `Location older than ${controlPolicy.locationFreshnessMinutes}m`
    : null;
}

function buildPartnerControlPolicy(settings: AdminOperationalPolicySetting[]): PartnerControlPolicy {
  return {
    responseWindowMinutes:
      readPositivePolicyNumber(settings, OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes) ??
      DEFAULT_PARTNER_CONTROL_POLICY.responseWindowMinutes,
    backupRadiusMeters:
      readPositivePolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters) ??
      DEFAULT_PARTNER_CONTROL_POLICY.backupRadiusMeters,
    invitationLimit:
      readPositivePolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceInvitationLimit) ??
      DEFAULT_PARTNER_CONTROL_POLICY.invitationLimit,
    locationFreshnessMinutes:
      readPositivePolicyNumber(settings, OPERATIONAL_POLICY_KEYS.marketplaceLocationFreshnessMinutes) ??
      DEFAULT_PARTNER_CONTROL_POLICY.locationFreshnessMinutes,
  };
}

function formatDistance(meters: number) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(meters % 1000 === 0 ? 0 : 1)}km`;
  }
  return `${meters}m`;
}

function buildDeviceUsage(providers: AdminProvider[]) {
  const usage = new Map<string, Set<string>>();
  for (const provider of providers) {
    for (const device of provider.devices ?? []) {
      if (!device.deviceId) continue;
      const set = usage.get(device.deviceId) ?? new Set<string>();
      set.add(provider.id);
      usage.set(device.deviceId, set);
    }
  }
  return usage;
}

function providerSharedDeviceCount(provider: AdminProvider, deviceUsage: Map<string, Set<string>>) {
  return (provider.devices ?? []).filter((device) => {
    const providers = deviceUsage.get(device.deviceId);
    return providers && providers.size > 1;
  }).length;
}

function providerUnsettledWalletBalance(provider: AdminProvider) {
  return (provider.earnings ?? [])
    .filter((earning) => ['PENDING', 'AVAILABLE'].includes(earning.status))
    .reduce((sum, earning) => sum + Number(earning.netAmount ?? 0), 0);
}

function adminProviderName(provider: AdminProvider) {
  return partnerDisplayText(provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id);
}

function watchSeverityRank(severity: PartnerControlWatchItem['severity']) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[severity] ?? 0;
}

function watchSeverityPill(severity: PartnerControlWatchItem['severity']) {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'pill-danger';
  if (severity === 'MEDIUM') return 'pill-warn';
  return 'pill-neutral';
}

function watchSignalPill(kind: string) {
  if (['BLOCK', 'WALLET', 'PAYOUT'].includes(kind)) return 'pill-danger';
  if (['REPORT', 'DEVICE', 'LOCATION', 'KYC', 'BANK'].includes(kind)) return 'pill-warn';
  return 'pill-neutral';
}

function cashDebtSettlementReference(providerProfileId: string) {
  return `HANDS-WALLET-${providerProfileId.slice(-8).toUpperCase()}`;
}

function reportSearchText(report: AdminProviderReport) {
  return [
    report.id,
    report.category,
    report.summary,
    report.details,
    report.providerProfile?.displayName,
    report.providerProfile?.user?.phone,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function sanctionSearchText(sanction: AdminProviderSanction) {
  return [
    sanction.id,
    sanction.type,
    sanction.reason,
    sanction.report?.summary,
    sanction.providerProfile?.displayName,
    sanction.providerProfile?.user?.phone,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function providerName(provider: NonNullable<AdminProviderReport['providerProfile']>) {
  return partnerDisplayText(provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id);
}

function providerNameOrId(
  provider:
    | AdminProviderReport['providerProfile']
    | AdminProviderSanction['providerProfile']
    | null
    | undefined,
  fallbackId: string,
) {
  return partnerDisplayText(provider?.displayName || provider?.user?.fullName || provider?.user?.phone || fallbackId);
}

function reportAgeHours(report: AdminProviderReport) {
  const createdAt = Date.parse(report.createdAt);
  if (Number.isNaN(createdAt)) {
    return 0;
  }
  return Math.max(0, Math.floor((Date.now() - createdAt) / 3_600_000));
}

function reportSlaHours(report: AdminProviderReport) {
  if (report.severity === 'CRITICAL') return 2;
  if (report.severity === 'HIGH') return 8;
  if (report.severity === 'MEDIUM') return 24;
  return 72;
}

function oldestReportAgeLabel(reports: AdminProviderReport[]) {
  if (!reports.length) {
    return '0h';
  }
  return ageLabel(Math.max(...reports.map(reportAgeHours)));
}

function ageLabel(hours: number) {
  if (hours < 24) {
    return `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days}d ${restHours}h` : `${days}d`;
}

function severityPriority(severity: string) {
  if (severity === 'CRITICAL') return 100;
  if (severity === 'HIGH') return 80;
  if (severity === 'MEDIUM') return 50;
  return 25;
}

function severityPill(severity: string) {
  if (severity === 'CRITICAL' || severity === 'HIGH') return 'pill-danger';
  if (severity === 'MEDIUM') return 'pill-warn';
  return 'pill-neutral';
}

function statusPill(status: string) {
  if (status === 'RESOLVED' || status === 'DISMISSED') return 'pill-success';
  if (status === 'INVESTIGATING') return 'pill-warn';
  return 'pill-info';
}

function shortId(value: string) {
  return formatShortId(value, { length: 8, ellipsis: true });
}

function formatDate(value?: string | null) {
  return formatDateTime(value, value ? 'Invalid' : 'None');
}
