import Link from 'next/link';
import { AdminAppSession, adminGet } from '../../lib/admin-api';

type SessionState = 'live' | 'recent' | 'stale' | 'expired';
type AppSessionsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;
type SessionFilters = {
  role: 'CUSTOMER' | 'PROVIDER' | null;
  state: SessionState | null;
  platform: string | null;
};
type SessionCommandCard = {
  title: string;
  value: string;
  status: string;
  detail: string;
  action: string;
  tone: 'ops-task-done' | 'ops-task-pending' | 'ops-task-blocked';
};

const LIVE_WINDOW_MS = 5 * 60_000;
const RECENT_WINDOW_MS = 30 * 60_000;
const STALE_WINDOW_MS = 24 * 60 * 60_000;

export default async function AppSessionsPage({
  searchParams,
}: {
  searchParams?: AppSessionsPageSearchParams;
}) {
  const filters = buildSessionFilters((await searchParams) ?? {});
  const allSessions = await adminGet<AdminAppSession[]>('/admin/app-sessions', []);
  const sessions = filterSessions(allSessions, filters);
  const summary = buildSessionSummary(sessions);
  const roleRows = buildRoleRows(sessions);
  const platformRows = buildPlatformRows(sessions);
  const versionRows = buildVersionRows(sessions);
  const riskRows = buildSessionRiskRows(sessions);
  const commandCards = buildSessionCommandCards(sessions, riskRows);
  const activeFilterLabel = sessionFilterLabel(filters);

  return (
    <>
      <section className="toolbar">
        <div>
          <h1>App Sessions</h1>
          <p className="muted">
            Customer and partner app heartbeat view for live operations, support, and version follow-up.
          </p>
        </div>
        <div className="actions">
          <Link className="text-link" href="/">
            Dashboard
          </Link>
          <Link className="text-link" href="/notifications">
            Notifications
          </Link>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Session scope</h2>
            <p className="muted">
              {activeFilterLabel}. Showing {sessions.length} of {allSessions.length} heartbeat record(s).
            </p>
          </div>
          <Link className="text-link" href="/app-sessions">
            Clear filters
          </Link>
        </div>
        <div className="actions" style={{ marginTop: 12, justifyContent: 'flex-start' }}>
          {sessionQuickFilters.map((item) => (
            <Link
              className={`pill ${item.href === sessionFilterHref(filters) ? 'pill-success' : 'pill-info'}`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="grid" style={{ marginBottom: 16 }}>
        {summary.map(([label, value, detail]) => (
          <div className="card" key={label}>
            <p>{label}</p>
            <h2>{value}</h2>
            <span className="muted">{detail}</span>
          </div>
        ))}
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Session command board</h2>
            <p className="muted">
              Live demand, partner supply, push reachability, and shared-device risk for the current shift.
            </p>
          </div>
          <span className={`pill ${riskRows.length ? 'pill-warn' : 'pill-success'}`}>
            {riskRows.length ? `${riskRows.length} risk item(s)` : 'Clear'}
          </span>
        </div>
        <div className="ops-task-grid" style={{ marginTop: 12 }}>
          {commandCards.map((card) => (
            <div className={`ops-task-card ${card.tone}`} key={card.title}>
              <small>{card.status}</small>
              <h3>{card.title}</h3>
              <strong>{card.value}</strong>
              <p>{card.detail}</p>
              <span className="ops-task-card-action">{card.action}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="detail-grid" style={{ marginBottom: 16 }}>
        <div className="card">
          <h2>Role split</h2>
          <table className="table">
            <tbody>
              {roleRows.map((row) => (
                <InfoRow
                  key={row.role}
                  label={row.role}
                  value={`${row.live} live / ${row.total} total`}
                  detail={`${row.recent} recent, ${row.stale} stale, ${row.expired} expired`}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Platform and version</h2>
          <table className="table">
            <tbody>
              {platformRows.map((row) => (
                <InfoRow
                  key={row.platform}
                  label={row.platform}
                  value={`${row.total} session(s)`}
                  detail={`${row.live} live session(s) right now`}
                />
              ))}
              {versionRows.slice(0, 4).map((row) => (
                <InfoRow
                  key={`version-${row.version}`}
                  label={`Version ${row.version}`}
                  value={`${row.total} session(s)`}
                  detail={`${row.live} live, ${row.customer} customer, ${row.partner} partner`}
                />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" style={{ marginBottom: 16 }}>
        <div className="risk-watch-header">
          <div>
            <h2>Session risk queue</h2>
            <p className="muted">
              Watch old app versions, stale sessions, missing push readiness, and duplicate device usage.
            </p>
          </div>
          <span className={`pill ${riskRows.length ? 'pill-warn' : 'pill-success'}`}>
            {riskRows.length ? `${riskRows.length} review` : 'No session risk'}
          </span>
        </div>
        {riskRows.length ? (
          <div className="ops-task-grid" style={{ marginTop: 12 }}>
            {riskRows.slice(0, 12).map((item) => (
              <div className={`ops-task-card ${item.tone}`} key={item.key}>
                <small>{item.status}</small>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <span className="ops-task-card-action">{item.action}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No visible session issue in the latest heartbeat snapshot.</p>
        )}
      </section>

      <section className="card">
        <div className="risk-watch-header">
          <div>
            <h2>Latest app sessions</h2>
            <p className="muted">
              Sorted by last heartbeat. Live means the session expiry is still in the future.
            </p>
          </div>
          <span className="pill pill-info">{sessions.length} loaded</span>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>State</th>
              <th>Platform</th>
              <th>Version</th>
              <th>Last seen</th>
              <th>Device</th>
            </tr>
          </thead>
          <tbody>
            {sessions.slice(0, 80).map((session) => {
              const state = sessionState(session);
              const partnerId = session.user?.providerProfile?.id;
              return (
                <tr key={session.id}>
                  <td>
                    <strong>{sessionUserLabel(session)}</strong>
                    <div className="muted">{session.user?.phone ?? session.userId}</div>
                  </td>
                  <td>{session.role === 'PROVIDER' ? 'PARTNER' : session.role}</td>
                  <td>
                    <span className={`pill ${sessionStatePill(state)}`}>{state}</span>
                  </td>
                  <td>{session.platform ?? 'unknown'}</td>
                  <td>{session.appVersion ?? 'unknown'}</td>
                  <td>
                    {formatRelativeTime(session.lastSeenAt)}
                    <div className="muted">{formatDateTime(session.lastSeenAt)}</div>
                  </td>
                  <td>
                    <code>{shortDeviceId(session.deviceId)}</code>
                    <div className="muted">{session.ipAddress ?? 'no ip'}</div>
                    {partnerId ? (
                      <Link className="text-link" href={`/partners/${partnerId}`}>
                        Open partner
                      </Link>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </>
  );
}

const sessionQuickFilters = [
  { label: 'All sessions', href: '/app-sessions' },
  { label: 'Live customers', href: '/app-sessions?role=CUSTOMER&state=live' },
  { label: 'Live partners', href: '/app-sessions?role=PROVIDER&state=live' },
  { label: 'Recent customers', href: '/app-sessions?role=CUSTOMER&state=recent' },
  { label: 'Stale sessions', href: '/app-sessions?state=stale' },
  { label: 'Expired sessions', href: '/app-sessions?state=expired' },
];

function buildSessionFilters(params: Record<string, string | string[] | undefined>): SessionFilters {
  const role = singleParam(params.role)?.toUpperCase();
  const state = singleParam(params.state)?.toLowerCase();
  const platform = singleParam(params.platform)?.toLowerCase() ?? null;

  return {
    role: role === 'PARTNER' || role === 'PROVIDER' ? 'PROVIDER' : role === 'CUSTOMER' ? 'CUSTOMER' : null,
    state: isSessionState(state) ? state : null,
    platform,
  };
}

function filterSessions(sessions: AdminAppSession[], filters: SessionFilters) {
  return sessions.filter((session) => {
    if (filters.role && session.role !== filters.role) {
      return false;
    }

    if (filters.state && sessionState(session) !== filters.state) {
      return false;
    }

    if (filters.platform && (session.platform ?? 'unknown').toLowerCase() !== filters.platform) {
      return false;
    }

    return true;
  });
}

function sessionFilterLabel(filters: SessionFilters) {
  const parts = [
    filters.role === 'PROVIDER' ? 'partner sessions' : filters.role === 'CUSTOMER' ? 'customer sessions' : null,
    filters.state ? `${filters.state} heartbeat` : null,
    filters.platform ? `${filters.platform} platform` : null,
  ].filter(Boolean);

  return parts.length ? `Filtered to ${parts.join(', ')}` : 'Showing all customer, partner, and admin app sessions';
}

function sessionFilterHref(filters: SessionFilters) {
  const params = new URLSearchParams();
  if (filters.role) params.set('role', filters.role);
  if (filters.state) params.set('state', filters.state);
  if (filters.platform) params.set('platform', filters.platform);
  const query = params.toString();
  return query ? `/app-sessions?${query}` : '/app-sessions';
}

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isSessionState(value: string | undefined): value is SessionState {
  return value === 'live' || value === 'recent' || value === 'stale' || value === 'expired';
}

function InfoRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <tr>
      <td>
        <strong>{label}</strong>
        <div className="muted">{detail}</div>
      </td>
      <td>{value}</td>
    </tr>
  );
}

function buildSessionSummary(sessions: AdminAppSession[]): Array<[string, string, string]> {
  const states = sessions.map(sessionState);
  const live = states.filter((state) => state === 'live').length;
  const recent = states.filter((state) => state === 'recent').length;
  const stale = states.filter((state) => state === 'stale').length;
  const expired = states.filter((state) => state === 'expired').length;
  const liveCustomers = sessions.filter(
    (session) => session.role === 'CUSTOMER' && sessionState(session) === 'live',
  );
  const livePartners = sessions.filter(
    (session) => session.role === 'PROVIDER' && sessionState(session) === 'live',
  );

  return [
    ['Live customers', liveCustomers.length.toString(), 'Customers actively seen within the session window.'],
    ['Live partners', livePartners.length.toString(), 'Partners actively seen within the session window.'],
    ['Recent sessions', recent.toString(), 'Seen in the last 30 minutes but not live now.'],
    ['Stale sessions', stale.toString(), 'Seen within 24 hours but outside the recent window.'],
    ['Expired sessions', expired.toString(), 'Older than the operational freshness window.'],
    ['Loaded sessions', sessions.length.toString(), `${live} live session(s) in this snapshot.`],
  ];
}

function buildSessionCommandCards(
  sessions: AdminAppSession[],
  riskRows: ReturnType<typeof buildSessionRiskRows>,
): SessionCommandCard[] {
  const liveCustomers = sessions.filter(
    (session) => session.role === 'CUSTOMER' && sessionState(session) === 'live',
  );
  const recentCustomers = sessions.filter(
    (session) => session.role === 'CUSTOMER' && sessionState(session) === 'recent',
  );
  const livePartners = sessions.filter(
    (session) => session.role === 'PROVIDER' && sessionState(session) === 'live',
  );
  const recentPartners = sessions.filter(
    (session) => session.role === 'PROVIDER' && sessionState(session) === 'recent',
  );
  const disabledPushUsers = sessions.filter(
    (session) =>
      (session.user?.pushDevices ?? []).length > 0 &&
      !(session.user?.pushDevices ?? []).some((device) => device.enabled),
  );
  const sharedDeviceRisk = riskRows.filter((row) => row.status === 'SHARED DEVICE').length;
  const expiredSessions = sessions.filter((session) => sessionState(session) === 'expired');

  return [
    {
      title: 'Customer demand signal',
      value: `${liveCustomers.length} live`,
      status: liveCustomers.length ? 'ACTIVE' : 'QUIET',
      detail: `${recentCustomers.length} customer session(s) were seen recently but are not live now.`,
      action: liveCustomers.length ? 'Watch matching wait and payment holds' : 'Monitor campaign and support channels',
      tone: liveCustomers.length ? 'ops-task-pending' : 'ops-task-done',
    },
    {
      title: 'Partner supply signal',
      value: `${livePartners.length} live`,
      status: livePartners.length ? 'AVAILABLE' : 'LOW SUPPLY',
      detail: `${recentPartners.length} partner session(s) were recently active but not live now.`,
      action: livePartners.length ? 'Compare against open matching demand' : 'Prompt partners to open the app',
      tone: livePartners.length ? 'ops-task-done' : 'ops-task-blocked',
    },
    {
      title: 'Push reachability',
      value: `${disabledPushUsers.length} issue(s)`,
      status: disabledPushUsers.length ? 'FIX TOKENS' : 'READY',
      detail: 'Users with only disabled push tokens may miss booking, chat, payout, or KYC updates.',
      action: disabledPushUsers.length ? 'Open notifications and refresh app tokens' : 'No push action needed',
      tone: disabledPushUsers.length ? 'ops-task-pending' : 'ops-task-done',
    },
    {
      title: 'Shared device safety',
      value: `${sharedDeviceRisk} device(s)`,
      status: sharedDeviceRisk ? 'REVIEW' : 'CLEAR',
      detail: 'Multiple accounts on one device can indicate family phones, staff testing, or account misuse.',
      action: sharedDeviceRisk ? 'Review account safety before dispatching' : 'No duplicate device risk visible',
      tone: sharedDeviceRisk ? 'ops-task-blocked' : 'ops-task-done',
    },
    {
      title: 'Expired app heartbeat',
      value: `${expiredSessions.length} expired`,
      status: expiredSessions.length ? 'STALE' : 'FRESH',
      detail: 'Old sessions should not be treated as live customer demand or partner supply.',
      action: expiredSessions.length ? 'Use current location and push state before dispatch' : 'Session snapshot is fresh',
      tone: expiredSessions.length ? 'ops-task-pending' : 'ops-task-done',
    },
  ];
}

function buildRoleRows(sessions: AdminAppSession[]) {
  const roles = new Map<
    string,
    { role: string; total: number; live: number; recent: number; stale: number; expired: number }
  >();
  for (const session of sessions) {
    const role = session.role === 'PROVIDER' ? 'PARTNER' : session.role;
    const row = roles.get(role) ?? { role, total: 0, live: 0, recent: 0, stale: 0, expired: 0 };
    row.total += 1;
    row[sessionState(session)] += 1;
    roles.set(role, row);
  }
  return [...roles.values()].sort((left, right) => right.total - left.total);
}

function buildPlatformRows(sessions: AdminAppSession[]) {
  const rows = new Map<string, { platform: string; total: number; live: number }>();
  for (const session of sessions) {
    const platform = session.platform ?? 'unknown';
    const row = rows.get(platform) ?? { platform, total: 0, live: 0 };
    row.total += 1;
    if (sessionState(session) === 'live') row.live += 1;
    rows.set(platform, row);
  }
  return [...rows.values()].sort(
    (left, right) => right.total - left.total || left.platform.localeCompare(right.platform),
  );
}

function buildVersionRows(sessions: AdminAppSession[]) {
  const rows = new Map<
    string,
    { version: string; total: number; live: number; customer: number; partner: number }
  >();
  for (const session of sessions) {
    const version = session.appVersion ?? 'unknown';
    const row = rows.get(version) ?? { version, total: 0, live: 0, customer: 0, partner: 0 };
    row.total += 1;
    if (sessionState(session) === 'live') row.live += 1;
    if (session.role === 'CUSTOMER') row.customer += 1;
    if (session.role === 'PROVIDER') row.partner += 1;
    rows.set(version, row);
  }
  return [...rows.values()].sort(
    (left, right) => right.total - left.total || left.version.localeCompare(right.version),
  );
}

function buildSessionRiskRows(sessions: AdminAppSession[]) {
  const rows: Array<{
    key: string;
    status: string;
    title: string;
    detail: string;
    action: string;
    tone: string;
  }> = [];
  const byDevice = new Map<string, AdminAppSession[]>();

  for (const session of sessions) {
    const state = sessionState(session);
    const label = sessionUserLabel(session);
    if (state === 'expired') {
      rows.push({
        key: `expired-${session.id}`,
        status: 'EXPIRED',
        title: `${label} has an old session`,
        detail: `Last seen ${formatRelativeTime(session.lastSeenAt)} on ${session.platform ?? 'unknown platform'}.`,
        action: 'Ask user to reopen the app',
        tone: 'ops-task-pending',
      });
    }
    if (
      (session.user?.pushDevices ?? []).length > 0 &&
      !(session.user?.pushDevices ?? []).some((device) => device.enabled)
    ) {
      rows.push({
        key: `push-${session.id}`,
        status: 'PUSH DISABLED',
        title: `${label} may miss alerts`,
        detail: 'All known push devices are disabled even though app session history exists.',
        action: 'Open notifications',
        tone: 'ops-task-pending',
      });
    }
    const group = byDevice.get(session.deviceId) ?? [];
    group.push(session);
    byDevice.set(session.deviceId, group);
  }

  for (const [deviceId, group] of byDevice) {
    const userCount = new Set(group.map((session) => session.userId)).size;
    if (userCount > 1) {
      rows.push({
        key: `duplicate-${deviceId}`,
        status: 'SHARED DEVICE',
        title: 'Multiple accounts share one app device',
        detail: `${userCount} user accounts used ${shortDeviceId(deviceId)}.`,
        action: 'Review account safety',
        tone: 'ops-task-blocked',
      });
    }
  }

  return rows.sort((left, right) => left.status.localeCompare(right.status));
}

function sessionState(session: AdminAppSession): SessionState {
  if (session.active && session.expiresAt && Date.parse(session.expiresAt) >= Date.now()) {
    return 'live';
  }

  const lastSeen = Date.parse(session.lastSeenAt);
  if (!Number.isFinite(lastSeen)) {
    return 'expired';
  }

  const age = Date.now() - lastSeen;
  if (age <= LIVE_WINDOW_MS) return 'live';
  if (age <= RECENT_WINDOW_MS) return 'recent';
  if (age <= STALE_WINDOW_MS) return 'stale';
  return 'expired';
}

function sessionStatePill(state: SessionState) {
  if (state === 'live') return 'pill-success';
  if (state === 'recent') return 'pill-info';
  if (state === 'stale') return 'pill-warn';
  return 'pill-danger';
}

function sessionUserLabel(session: AdminAppSession) {
  return (
    session.user?.providerProfile?.displayName ??
    session.user?.fullName ??
    session.user?.phone ??
    session.userId
  );
}

function shortDeviceId(deviceId: string) {
  return deviceId.length > 24 ? `${deviceId.slice(0, 12)}...${deviceId.slice(-6)}` : deviceId;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Bangkok',
  }).format(new Date(value));
}

function formatRelativeTime(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return 'unknown';
  }
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));
  if (diffMinutes < 1) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 48) return `${diffHours}h ago`;
  return `${Math.round(diffHours / 24)}d ago`;
}
