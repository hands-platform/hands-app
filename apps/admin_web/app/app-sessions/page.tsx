import Link from 'next/link';
import { AdminAppSession, adminGet } from '../../lib/admin-api';

type SessionState = 'live' | 'recent' | 'stale' | 'expired';

const LIVE_WINDOW_MS = 5 * 60_000;
const RECENT_WINDOW_MS = 30 * 60_000;
const STALE_WINDOW_MS = 24 * 60 * 60_000;

export default async function AppSessionsPage() {
  const sessions = await adminGet<AdminAppSession[]>('/admin/app-sessions', []);
  const summary = buildSessionSummary(sessions);
  const roleRows = buildRoleRows(sessions);
  const platformRows = buildPlatformRows(sessions);
  const versionRows = buildVersionRows(sessions);
  const riskRows = buildSessionRiskRows(sessions);

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

      <section className="grid" style={{ marginBottom: 16 }}>
        {summary.map(([label, value, detail]) => (
          <div className="card" key={label}>
            <p>{label}</p>
            <h2>{value}</h2>
            <span className="muted">{detail}</span>
          </div>
        ))}
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
