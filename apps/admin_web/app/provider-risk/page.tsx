import Link from 'next/link';
import { AdminProvider, AdminProviderReport, AdminProviderSanction, adminGet } from '../../lib/admin-api';
import {
  createProviderReport,
  createProviderSanction,
  liftProviderSanction,
  updateProviderReport,
} from './actions';

type RiskSearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ProviderRiskPage({ searchParams }: { searchParams?: RiskSearchParams }) {
  const filters = buildFilters(searchParams ? await searchParams : {});
  const [providers, reports, sanctions] = await Promise.all([
    adminGet<AdminProvider[]>('/admin/providers', []),
    adminGet<AdminProviderReport[]>('/admin/provider-reports', []),
    adminGet<AdminProviderSanction[]>('/admin/provider-sanctions', []),
  ]);
  const visibleReports = filterReports(reports, filters);
  const visibleSanctions = filterSanctions(sanctions, filters);
  const activeFilters = buildRiskActiveFilters(filters);
  const providerOptions = providers.map((provider) => ({
    id: provider.id,
    label: provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id,
  }));
  const summary = buildRiskSummary(reports, sanctions, providers);
  const providerWatchlist = buildProviderRiskWatchlist(providers);
  const commandCenter = buildRiskCommandCenter({
    reports,
    sanctions,
    watchlist: providerWatchlist,
  });

  return (
    <>
      <h1>Partner Risk</h1>
      <p className="muted">
        Track partner reports, active sanctions, account blocks, payout holds, and safety follow-up in one
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
        <div className="risk-watch-header">
          <div>
            <h2>Risk command center</h2>
            <p className="muted">
              One-screen triage for safety, finance blocks, account controls, and investigation SLA.
            </p>
          </div>
          <span className={`pill ${commandCenter.urgentCount ? 'pill-danger' : 'pill-success'}`}>
            {commandCenter.urgentCount ? `${commandCenter.urgentCount} urgent` : 'No urgent lane'}
          </span>
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
        <div className="risk-watch-header">
          <div>
            <h2>Next operator actions</h2>
            <p className="muted">
              Prioritized by severity, wallet impact, active sanctions, and how long the item has waited.
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
            No risk action currently needs operator review.
          </p>
        )}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header" style={{ marginBottom: 12 }}>
          <div>
            <h2>Risk operation filters</h2>
            <p className="muted">
              Dashboard links land here with the exact investigation lane already selected.
            </p>
            {activeFilters.length > 0 ? (
              <p className="muted">
                Active queue: {activeFilters.map((filter) => filter.description).join(' ')}
              </p>
            ) : (
              <p className="muted">No risk filter is active. Showing every report and sanction lane.</p>
            )}
          </div>
          <span className={`pill ${activeFilters.length ? 'pill-warn' : 'pill-success'}`}>
            Showing {visibleReports.length} report(s), {visibleSanctions.length} sanction(s)
          </span>
        </div>
        <form className="form-grid" action="/provider-risk">
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
            Severity
            <select name="severity" defaultValue={filters.severity}>
              <option value="">All</option>
              <option value="HIGH_PLUS">Critical + high</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </label>
          <label>
            Sanction
            <select name="sanction" defaultValue={filters.sanction}>
              <option value="">All</option>
              <option value="ACTIVE">Active</option>
              <option value="LIFTED">Lifted</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </label>
          <div className="actions full-span">
            <button type="submit">Apply filters</button>
            <Link className="text-link" href="/provider-risk">
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
        <div className="risk-watch-header">
          <div>
            <h2>System risk watchlist</h2>
            <p className="muted">
              Automatic partner signals from wallet debt, sanctions, onboarding gaps, devices, and recent
              report history.
            </p>
          </div>
          <span className="pill pill-info">{providerWatchlist.length} partner(s)</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Partner</th>
              <th>Risk signals</th>
              <th>Money / access</th>
              <th>Operator next step</th>
            </tr>
          </thead>
          <tbody>
            {providerWatchlist.map((item) => (
              <tr key={item.provider.id}>
                <td>
                  <Link className="text-link" href={`/providers/${item.provider.id}`}>
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
                    <Link className="text-link" href={`/providers/${item.provider.id}`}>
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
                        href={`/provider-risk?q=${encodeURIComponent(item.provider.id)}`}
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
                <td colSpan={4}>No automatic partner risk signals are active.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Create partner report</h2>
            <p className="muted">
              Use this for customer complaints, staff findings, payout risks, or safety notes.
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
            Severity
            <select name="severity" defaultValue="MEDIUM">
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
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
        <div className="risk-watch-header">
          <div>
            <h2>Reports</h2>
            <p className="muted">
              Open and investigating reports should be cleared before partner trust upgrades.
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
              <th>Sanction</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {visibleReports.map((report) => (
              <tr key={report.id}>
                <td>
                  <strong>{report.summary}</strong>
                  <p className="muted">
                    {report.category} / {report.source} / {formatDate(report.createdAt)}
                  </p>
                  {report.details ? <p className="muted">{report.details}</p> : null}
                  {report.bookingId ? (
                    <Link className="text-link" href={`/bookings/${report.bookingId}`}>
                      Booking {shortId(report.bookingId)}
                    </Link>
                  ) : null}
                </td>
                <td>
                  {report.providerProfile ? (
                    <Link className="text-link" href={`/providers/${report.providerProfile.id}`}>
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
                  {report.resolutionNote ? <p className="muted">{report.resolutionNote}</p> : null}
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
                      <option value="TRUST_BADGE_REMOVAL">Trust badge removal</option>
                    </select>
                    <input
                      name="reason"
                      placeholder="Sanction reason"
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
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                    <input name="resolutionNote" placeholder="Resolution or follow-up note" />
                    <button type="submit">Update</button>
                  </form>
                </td>
              </tr>
            ))}
            {!visibleReports.length ? (
              <tr>
                <td colSpan={5}>{emptyRiskMessage('report', activeFilters)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="risk-watch-header">
          <div>
            <h2>Sanctions</h2>
            <p className="muted">
              Active sanctions are operational controls. Lift them only with a clear audit trail.
            </p>
          </div>
          <span className="pill pill-info">{visibleSanctions.length} shown</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Sanction</th>
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
                  <p className="muted">{sanction.reason}</p>
                </td>
                <td>
                  {sanction.providerProfile ? (
                    <Link className="text-link" href={`/providers/${sanction.providerProfile.id}`}>
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
                      <p className="muted">{sanction.report.summary}</p>
                    </>
                  ) : (
                    <span className="muted">Manual sanction</span>
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
                      <button type="submit">Lift sanction</button>
                    </form>
                  ) : (
                    <span className="muted">Closed</span>
                  )}
                </td>
              </tr>
            ))}
            {!visibleSanctions.length ? (
              <tr>
                <td colSpan={5}>{emptyRiskMessage('sanction', activeFilters)}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </>
  );
}

type RiskCommandCenterInput = {
  reports: AdminProviderReport[];
  sanctions: AdminProviderSanction[];
  watchlist: ProviderRiskWatchItem[];
};

type RiskCommandMetric = {
  label: string;
  value: string;
  tone:
    | 'ops-task-breakdown-ok'
    | 'ops-task-breakdown-info'
    | 'ops-task-breakdown-warn'
    | 'ops-task-breakdown-danger';
};

type RiskNextAction = {
  id: string;
  priority: number;
  status: string;
  title: string;
  detail: string;
  operatorAction: string;
  href: string;
  tags: Array<{ label: string; tone: string }>;
};

function buildRiskCommandCenter(input: RiskCommandCenterInput) {
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
        ? 'Critical or high reports need evidence review and a decision before partner trust changes.'
        : 'No critical or high partner report is currently open.',
      href: urgentReports.length ? '/provider-risk?severity=HIGH_PLUS' : '/provider-risk?status=OPEN',
      action: urgentReports.length ? 'Open critical + high lane' : 'Review open reports',
      className: urgentReports.length ? 'ops-task-blocked' : 'ops-task-done',
      metrics: [
        metric('Critical', urgentReports.filter((report) => report.severity === 'CRITICAL').length, 'danger'),
        metric('High', urgentReports.filter((report) => report.severity === 'HIGH').length, 'warn'),
        metric('Open', openReports.length, openReports.length ? 'info' : 'ok'),
      ],
    },
    {
      title: 'Finance block',
      status: walletDebtItems.length ? 'BLOCKED' : 'CLEAR',
      detail: walletDebtItems.length
        ? 'Negative wallet partners must settle cash fee debt before accepting more bookings.'
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
        ? 'Active sanctions are live operating controls and need clean audit follow-up.'
        : 'No active sanction is currently restricting partner operations.',
      href: activeSanctions.length ? '/provider-risk?sanction=ACTIVE' : '/provider-risk',
      action: activeSanctions.length ? 'Review active sanctions' : 'Open risk board',
      className: activeSanctions.length ? 'ops-task-pending' : 'ops-task-done',
      metrics: [
        metric('Sanctions', activeSanctions.length, activeSanctions.length ? 'warn' : 'ok'),
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
      href: overdueReports.length ? '/provider-risk?status=OPEN' : '/provider-risk?status=INVESTIGATING',
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
    nextActions: buildRiskNextActions({
      openReports,
      activeSanctions,
      watchlist: input.watchlist,
    }),
  };
}

function metric(
  label: string,
  value: string | number,
  tone: 'ok' | 'info' | 'warn' | 'danger',
): RiskCommandMetric {
  const toneClass: Record<'ok' | 'info' | 'warn' | 'danger', RiskCommandMetric['tone']> = {
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

function buildRiskNextActions(input: {
  openReports: AdminProviderReport[];
  activeSanctions: AdminProviderSanction[];
  watchlist: ProviderRiskWatchItem[];
}) {
  const actions: RiskNextAction[] = [];

  for (const report of input.openReports) {
    const ageHours = reportAgeHours(report);
    const slaHours = reportSlaHours(report);
    actions.push({
      id: `report-${report.id}`,
      priority: severityPriority(report.severity) + (ageHours >= slaHours ? 30 : 0),
      status: ageHours >= slaHours ? 'OVERDUE' : report.severity,
      title: report.summary,
      detail: `${providerNameOrId(report.providerProfile, report.providerProfileId)} / ${report.category} / ${report.status} / ${ageLabel(ageHours)} old`,
      operatorAction:
        ageHours >= slaHours
          ? `Past ${slaHours}h target. Add resolution note, assign sanction, or dismiss with evidence.`
          : 'Review evidence and move to investigating, resolved, dismissed, or sanction.',
      href: report.bookingId
        ? `/bookings/${report.bookingId}`
        : `/provider-risk?q=${encodeURIComponent(report.id)}`,
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
      detail: `${formatMoney(Math.abs(item.walletBalance))} must be settled or offset before new booking acceptance.`,
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
      title: `${providerNameOrId(sanction.providerProfile, sanction.providerProfileId)} sanction active`,
      detail: sanction.reason,
      operatorAction:
        sanction.type === 'PAYOUT_HOLD'
          ? 'Resolve payout evidence before creating or paying payout batches.'
          : 'Keep or lift the sanction only with a clear audit trail.',
      href: `/provider-risk?q=${encodeURIComponent(sanction.providerProfileId)}`,
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

function buildRiskActiveFilters(filters: ReturnType<typeof buildFilters>) {
  return [
    filters.q
      ? {
          kind: 'search',
          value: filters.q,
          label: `Search: ${filters.q}`,
          description: 'Risk rows are narrowed by partner, phone, category, reason, or report text.',
        }
      : null,
    filters.status
      ? {
          kind: 'status',
          value: filters.status,
          label: `Report: ${filters.status}`,
          description: riskFilterDescription('status', filters.status),
        }
      : null,
    filters.severity
      ? {
          kind: 'severity',
          value: filters.severity,
          label: `Severity: ${filters.severity === 'HIGH_PLUS' ? 'CRITICAL + HIGH' : filters.severity}`,
          description: riskFilterDescription('severity', filters.severity),
        }
      : null,
    filters.sanction
      ? {
          kind: 'sanction',
          value: filters.sanction,
          label: `Sanction: ${filters.sanction}`,
          description: riskFilterDescription('sanction', filters.sanction),
        }
      : null,
  ].filter(Boolean) as Array<{ kind: string; value: string; label: string; description: string }>;
}

function riskFilterDescription(kind: string, value: string) {
  if (kind === 'status' && value === 'OPEN') {
    return 'Open reports need triage before partner trust or payout decisions.';
  }
  if (kind === 'status' && value === 'INVESTIGATING') {
    return 'Investigating reports need evidence, customer notes, or staff follow-up.';
  }
  if (kind === 'severity') {
    if (value === 'HIGH_PLUS') {
      return 'Critical and high severity reports are prioritized together for safety review.';
    }
    return `${value.toLowerCase()} severity reports are prioritized for safety review.`;
  }
  if (kind === 'sanction' && value === 'ACTIVE') {
    return 'Active sanctions are live operating controls and should be lifted only with a clear audit trail.';
  }
  if (kind === 'sanction') {
    return 'Sanctions are narrowed to the selected lifecycle state.';
  }
  return 'Risk board is narrowed by the active filter.';
}

function emptyRiskMessage(kind: 'report' | 'sanction', activeFilters: Array<{ description: string }>) {
  const subject = kind === 'report' ? 'partner reports' : 'partner sanctions';
  if (activeFilters.length === 0) {
    return `No ${subject} loaded yet.`;
  }
  return `No ${subject} match the active filters. Clear filters or switch investigation lane.`;
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '').trim() : (value ?? '').trim();
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

function buildRiskSummary(
  reports: AdminProviderReport[],
  sanctions: AdminProviderSanction[],
  providers: AdminProvider[],
) {
  const watchlist = buildProviderRiskWatchlist(providers);
  return [
    [
      'Open reports',
      reports.filter((report) => ['OPEN', 'INVESTIGATING'].includes(report.status)).length.toString(),
    ],
    [
      'Critical / high',
      reports.filter((report) => ['CRITICAL', 'HIGH'].includes(report.severity)).length.toString(),
    ],
    ['Active sanctions', sanctions.filter((sanction) => sanction.status === 'ACTIVE').length.toString()],
    ['Blocked accounts', providers.filter((provider) => provider.blockedAt).length.toString()],
    ['Wallet debt', watchlist.filter((item) => item.walletBalance < 0).length.toString()],
    [
      'Location gaps',
      providers.filter((provider) => Boolean(providerLocationSignal(provider))).length.toString(),
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

type ProviderRiskWatchItem = {
  provider: AdminProvider;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  signals: Array<{ kind: string; label: string }>;
  walletBalance: number;
  openReportCount: number;
  hasPayoutHold: boolean;
  detail: string;
  nextStep: string;
};

function buildProviderRiskWatchlist(providers: AdminProvider[]): ProviderRiskWatchItem[] {
  const deviceUsage = buildDeviceUsage(providers);
  return providers
    .map((provider) => buildProviderRiskWatchItem(provider, deviceUsage))
    .filter((item): item is ProviderRiskWatchItem => Boolean(item))
    .sort((left, right) => watchSeverityRank(right.severity) - watchSeverityRank(left.severity));
}

function buildProviderRiskWatchItem(
  provider: AdminProvider,
  deviceUsage: Map<string, Set<string>>,
): ProviderRiskWatchItem | null {
  const walletBalance = providerUnsettledWalletBalance(provider);
  const openReportCount = (provider.reports ?? []).filter((report) =>
    ['OPEN', 'INVESTIGATING'].includes(report.status),
  ).length;
  const activeSanctions = (provider.sanctions ?? []).filter((sanction) => sanction.status === 'ACTIVE');
  const hasPayoutHold = activeSanctions.some((sanction) => sanction.type === 'PAYOUT_HOLD');
  const sharedDeviceCount = providerSharedDeviceCount(provider, deviceUsage);
  const signals: ProviderRiskWatchItem['signals'] = [];

  if (provider.blockedAt) signals.push({ kind: 'BLOCK', label: 'Account blocked' });
  if (walletBalance < 0) signals.push({ kind: 'WALLET', label: 'Negative wallet' });
  if (hasPayoutHold) signals.push({ kind: 'PAYOUT', label: 'Payout hold' });
  if (openReportCount > 0) signals.push({ kind: 'REPORT', label: `${openReportCount} open report(s)` });
  if (sharedDeviceCount > 0) signals.push({ kind: 'DEVICE', label: `${sharedDeviceCount} shared device(s)` });
  const locationSignal = providerLocationSignal(provider);
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
    detail: providerRiskDetail({ walletBalance, openReportCount, sharedDeviceCount, signals }),
    nextStep: providerRiskNextStep({ walletBalance, hasPayoutHold, openReportCount, provider }),
  };
}

function providerRiskDetail(input: {
  walletBalance: number;
  openReportCount: number;
  sharedDeviceCount: number;
  signals: Array<{ kind: string }>;
}) {
  if (input.walletBalance < 0) {
    return 'Partner cannot safely accept more cash/direct work until company fee debt is settled.';
  }
  if (input.openReportCount > 0) {
    return 'Open report history needs operator review before trust, payout, or account changes.';
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

function providerRiskNextStep(input: {
  walletBalance: number;
  hasPayoutHold: boolean;
  openReportCount: number;
  provider: AdminProvider;
}) {
  if (input.walletBalance < 0) {
    return `Confirm partner deposit or admin offset using ${cashDebtSettlementReference(input.provider.id)}.`;
  }
  if (input.hasPayoutHold) {
    return 'Resolve payout hold evidence before creating or paying payout batches.';
  }
  if (input.openReportCount > 0) {
    return 'Update report status with resolution note or apply a sanction if needed.';
  }
  if (providerLocationSignal(input.provider)) {
    return 'Ask the partner to reopen the app and refresh their current location before accepting bookings.';
  }
  return 'Complete missing verification data before enabling higher trust or payout features.';
}

function providerLocationSignal(provider: AdminProvider) {
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
  return Date.now() - updatedAt > 30 * 60_000 ? 'Location stale' : null;
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
  return provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id;
}

function watchSeverityRank(severity: ProviderRiskWatchItem['severity']) {
  return { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 }[severity] ?? 0;
}

function watchSeverityPill(severity: ProviderRiskWatchItem['severity']) {
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

function formatMoney(value: number, currency = 'VND') {
  return `${new Intl.NumberFormat('vi-VN').format(value)} ${currency}`;
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
  return provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id;
}

function providerNameOrId(
  provider:
    | AdminProviderReport['providerProfile']
    | AdminProviderSanction['providerProfile']
    | null
    | undefined,
  fallbackId: string,
) {
  return provider?.displayName || provider?.user?.fullName || provider?.user?.phone || fallbackId;
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
  return value.length > 12 ? `${value.slice(0, 8)}...` : value;
}

function formatDate(value?: string | null) {
  if (!value) return 'None';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : 'Invalid';
}
