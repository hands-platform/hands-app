import Link from 'next/link';
import {
  AdminProvider,
  AdminProviderReport,
  AdminProviderSanction,
  adminGet,
} from '../../lib/admin-api';
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
  const providerOptions = providers.map((provider) => ({
    id: provider.id,
    label: provider.displayName || provider.user?.fullName || provider.user?.phone || provider.id,
  }));
  const summary = buildRiskSummary(reports, sanctions, providers);

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
        </form>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Create provider report</h2>
            <p className="muted">Use this for customer complaints, staff findings, payout risks, or safety notes.</p>
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
            <textarea name="details" placeholder="Evidence, timeline, customer/provider statements, next step" />
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
            <p className="muted">Open and investigating reports should be cleared before provider trust upgrades.</p>
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
                    <select name="type" defaultValue={report.severity === 'CRITICAL' ? 'ACCOUNT_BLOCK' : 'WARNING'}>
                      <option value="WARNING">Warning</option>
                      <option value="PAYOUT_HOLD">Payout hold</option>
                      <option value="ACCOUNT_BLOCK">Account block</option>
                      <option value="TRUST_BADGE_REMOVAL">Trust badge removal</option>
                    </select>
                    <input name="reason" placeholder="Sanction reason" required minLength={12} maxLength={500} />
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
                <td colSpan={5}>No provider reports match the current filters.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="card">
        <div className="risk-watch-header">
          <div>
            <h2>Sanctions</h2>
            <p className="muted">Active sanctions are operational controls. Lift them only with a clear audit trail.</p>
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
                <td colSpan={5}>No provider sanctions match the current filters.</td>
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

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? '').trim() : (value ?? '').trim();
}

function filterReports(
  reports: AdminProviderReport[],
  filters: ReturnType<typeof buildFilters>,
) {
  return reports.filter((report) => {
    if (filters.status && report.status !== filters.status) return false;
    if (filters.severity && report.severity !== filters.severity) return false;
    if (filters.q && !reportSearchText(report).includes(filters.q)) return false;
    return true;
  });
}

function filterSanctions(
  sanctions: AdminProviderSanction[],
  filters: ReturnType<typeof buildFilters>,
) {
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
  return [
    ['Open reports', reports.filter((report) => ['OPEN', 'INVESTIGATING'].includes(report.status)).length.toString()],
    ['Critical / high', reports.filter((report) => ['CRITICAL', 'HIGH'].includes(report.severity)).length.toString()],
    ['Active sanctions', sanctions.filter((sanction) => sanction.status === 'ACTIVE').length.toString()],
    ['Blocked accounts', providers.filter((provider) => provider.blockedAt).length.toString()],
  ] as const;
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
