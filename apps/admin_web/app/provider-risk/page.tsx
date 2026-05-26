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

  return (
    <>
      <h1>Provider Risk</h1>
      <p className="muted">
        Track provider reports, active sanctions, account blocks, payout holds, and safety follow-up in one
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
            <input name="q" defaultValue={filters.q} placeholder="Provider, phone, category, reason" />
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
              Automatic provider signals from wallet debt, sanctions, onboarding gaps, devices, and recent
              report history.
            </p>
          </div>
          <span className="pill pill-info">{providerWatchlist.length} provider(s)</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Provider</th>
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
                      Provider detail
                    </Link>
                    {item.walletBalance < 0 ? (
                      <Link className="text-link" href="/earnings">
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
                <td colSpan={4}>No automatic provider risk signals are active.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Create provider report</h2>
            <p className="muted">
              Use this for customer complaints, staff findings, payout risks, or safety notes.
            </p>
          </div>
        </div>
        <form className="form-grid" action={createProviderReport}>
          <label>
            Provider
            <select name="providerProfileId" required>
              <option value="">Choose provider</option>
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
              <option value="PROVIDER">Provider</option>
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
              placeholder="Evidence, timeline, customer/provider statements, next step"
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
              Open and investigating reports should be cleared before provider trust upgrades.
            </p>
          </div>
          <span className="pill pill-info">{visibleReports.length} shown</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Report</th>
              <th>Provider</th>
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
              <th>Provider</th>
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
          description: 'Risk rows are narrowed by provider, phone, category, reason, or report text.',
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
          label: `Severity: ${filters.severity}`,
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
    return 'Open reports need triage before provider trust or payout decisions.';
  }
  if (kind === 'status' && value === 'INVESTIGATING') {
    return 'Investigating reports need evidence, customer notes, or staff follow-up.';
  }
  if (kind === 'severity') {
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
  const subject = kind === 'report' ? 'provider reports' : 'provider sanctions';
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
    if (filters.severity && report.severity !== filters.severity) return false;
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
        : ['KYC', 'BANK'].some((kind) => signals.some((signal) => signal.kind === kind))
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
    return 'Provider cannot safely accept more cash/direct work until company fee debt is settled.';
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
  return 'Provider has onboarding or compliance gaps that need staff follow-up.';
}

function providerRiskNextStep(input: {
  walletBalance: number;
  hasPayoutHold: boolean;
  openReportCount: number;
  provider: AdminProvider;
}) {
  if (input.walletBalance < 0) {
    return `Confirm provider deposit or admin offset using ${cashDebtSettlementReference(input.provider.id)}.`;
  }
  if (input.hasPayoutHold) {
    return 'Resolve payout hold evidence before creating or paying payout batches.';
  }
  if (input.openReportCount > 0) {
    return 'Update report status with resolution note or apply a sanction if needed.';
  }
  return 'Complete missing verification data before enabling higher trust or payout features.';
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
  if (['REPORT', 'DEVICE', 'KYC', 'BANK'].includes(kind)) return 'pill-warn';
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
