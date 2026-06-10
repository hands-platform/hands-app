import Link from 'next/link';
import { AdminPageTemplate, AdminSectionHeader } from '../../components/admin-page-template';
import type { AdminAppSession } from '../../lib/admin-api';
import { adminGet } from '../../lib/admin-api';
import { formatDateTime, formatRelativeTime } from '../../lib/admin-format';
import {
  AppSessionsBreakdownSection,
  type AppSessionPlatformRow,
  type AppSessionRoleRow,
  type AppSessionVersionRow,
} from './app-sessions-breakdown-section';
import {
  AppSessionsCommandBoardSection,
  type SessionCommandCard,
} from './app-sessions-command-board-section';
import { AppSessionsCheckQueueSection, type SessionCheckQueueItem } from './app-sessions-check-queue-section';
import { AppSessionsScopeSection, type AppSessionQuickFilter } from './app-sessions-scope-section';
import { AppSessionsTableSection, type AppSessionTableRow } from './app-sessions-table-section';

type SessionState = 'live' | 'recent' | 'stale' | 'expired';
type AppSessionsPageSearchParams = Promise<Record<string, string | string[] | undefined>>;
type SessionFilters = {
  role: 'CUSTOMER' | 'PROVIDER' | null;
  state: SessionState | null;
  platform: string | null;
};
type SessionRoleAccumulator = {
  expired: number;
  live: number;
  recent: number;
  role: string;
  stale: number;
  total: number;
};
type SessionPlatformAccumulator = {
  live: number;
  platform: string;
  total: number;
};
type SessionVersionAccumulator = {
  customer: number;
  live: number;
  partner: number;
  total: number;
  version: string;
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
  const checkRows = buildSessionCheckRows(sessions);
  const commandCards = buildSessionCommandCards(sessions, checkRows);
  const sessionRows = buildAppSessionTableRows(sessions);
  const activeFilterLabel = sessionFilterLabel(filters);

  return (
    <AdminPageTemplate
      actions={
        <>
          <Link className="text-link" href="/">
            Dashboard
          </Link>
          <Link className="text-link" href="/notifications">
            Notifications
          </Link>
        </>
      }
      description="Customer and Partner app heartbeat view for live operations, support, and version follow-up."
      metrics={summary.map(([label, value, detail]) => ({ helper: detail, label, value }))}
      title="App Sessions"
    >

      <AppSessionsScopeSection
        activeFilterHref={sessionFilterHref(filters)}
        activeFilterLabel={activeFilterLabel}
        loadedCount={sessions.length}
        quickFilters={sessionQuickFilters}
        totalCount={allSessions.length}
      />

      <AppSessionsCommandBoardSection cards={commandCards} checkCount={checkRows.length} />

      <AppSessionsBreakdownSection
        platformRows={platformRows}
        roleRows={roleRows}
        versionRows={versionRows}
      />

      <AppSessionsCheckQueueSection items={checkRows} />

      <section className="card">
        <AdminSectionHeader
          description="Sorted by last heartbeat. Live means the session expiry is still in the future."
          status={<span className="pill pill-info">{sessions.length} loaded</span>}
          title="Latest app sessions"
        />
        <AppSessionsTableSection emptyMessage="No app sessions loaded." rows={sessionRows} />
      </section>
    </AdminPageTemplate>
  );
}

function buildAppSessionTableRows(sessions: readonly AdminAppSession[]): AppSessionTableRow[] {
  return sessions.slice(0, 80).map((session) => {
    const state = sessionState(session);
    const partnerId = session.user?.providerProfile?.id;

    return {
      appVersionLabel: session.appVersion ?? 'unknown',
      deviceIdLabel: shortDeviceId(session.deviceId),
      id: session.id,
      ipAddressLabel: session.ipAddress ?? 'no ip',
      lastSeenAtLabel: formatDateTime(session.lastSeenAt),
      partnerHref: partnerId ? `/partners/${partnerId}` : null,
      platformLabel: session.platform ?? 'unknown',
      relativeLastSeenLabel: formatRelativeTime(session.lastSeenAt),
      roleLabel: session.role === 'PROVIDER' ? 'PARTNER' : session.role,
      stateLabel: state,
      statePillClassName: sessionStatePill(state),
      userLabel: sessionUserLabel(session),
      userPhoneLabel: session.user?.phone ?? session.userId,
    };
  });
}

const sessionQuickFilters: AppSessionQuickFilter[] = [
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
    filters.role === 'PROVIDER'
      ? 'partner sessions'
      : filters.role === 'CUSTOMER'
        ? 'customer sessions'
        : null,
    filters.state ? `${filters.state} heartbeat` : null,
    filters.platform ? `${filters.platform} platform` : null,
  ].filter(Boolean);

  return parts.length
    ? `Filtered to ${parts.join(', ')}`
    : 'Showing all customer, partner, and admin app sessions';
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
  checkRows: ReturnType<typeof buildSessionCheckRows>,
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
  const sharedDeviceChecks = checkRows.filter((row) => row.status === 'SHARED DEVICE').length;
  const expiredSessions = sessions.filter((session) => sessionState(session) === 'expired');

  return [
    {
      title: 'Customer demand records',
      value: `${liveCustomers.length} live`,
      status: liveCustomers.length ? 'ACTIVE' : 'QUIET',
      detail: `${recentCustomers.length} customer session(s) were seen recently but are not live now.`,
      action: liveCustomers.length
        ? 'Check matching wait and payment holds'
        : 'Monitor campaign and support channels',
      tone: liveCustomers.length ? 'ops-task-pending' : 'ops-task-done',
    },
    {
      title: 'Partner supply records',
      value: `${livePartners.length} live`,
      status: livePartners.length ? 'AVAILABLE' : 'LOW SUPPLY',
      detail: `${recentPartners.length} partner session(s) were recently active but not live now.`,
      action: livePartners.length
        ? 'Compare against open matching demand'
        : 'Prompt partners to open the app',
      tone: livePartners.length ? 'ops-task-done' : 'ops-task-blocked',
    },
    {
      title: 'Push reachability',
      value: `${disabledPushUsers.length} issue(s)`,
      status: disabledPushUsers.length ? 'FIX TOKENS' : 'READY',
      detail: 'Users with only disabled push tokens may miss booking, chat, payout, or KYC updates.',
      action: disabledPushUsers.length
        ? 'Open notifications and refresh app tokens'
        : 'No push action needed',
      tone: disabledPushUsers.length ? 'ops-task-pending' : 'ops-task-done',
    },
    {
      title: 'Shared device records',
      value: `${sharedDeviceChecks} device(s)`,
      status: sharedDeviceChecks ? 'REVIEW' : 'CLEAR',
      detail: 'Multiple accounts are recorded on the same device. Use the rows as factual device history.',
      action: sharedDeviceChecks
        ? 'Open account and device notes before making an operations decision'
        : 'No shared device record visible',
      tone: sharedDeviceChecks ? 'ops-task-blocked' : 'ops-task-done',
    },
    {
      title: 'Expired app heartbeat',
      value: `${expiredSessions.length} expired`,
      status: expiredSessions.length ? 'STALE' : 'FRESH',
      detail: 'Old sessions should not be treated as live customer demand or partner supply.',
      action: expiredSessions.length
        ? 'Use current location and push state before dispatch'
        : 'Session snapshot is fresh',
      tone: expiredSessions.length ? 'ops-task-pending' : 'ops-task-done',
    },
  ];
}

function buildRoleRows(sessions: AdminAppSession[]): AppSessionRoleRow[] {
  const roles = new Map<string, SessionRoleAccumulator>();
  for (const session of sessions) {
    const role = session.role === 'PROVIDER' ? 'PARTNER' : session.role;
    const row = roles.get(role) ?? { role, total: 0, live: 0, recent: 0, stale: 0, expired: 0 };
    row.total += 1;
    row[sessionState(session)] += 1;
    roles.set(role, row);
  }
  return [...roles.values()].sort((left, right) => right.total - left.total);
}

function buildPlatformRows(sessions: AdminAppSession[]): AppSessionPlatformRow[] {
  const rows = new Map<string, SessionPlatformAccumulator>();
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

function buildVersionRows(sessions: AdminAppSession[]): AppSessionVersionRow[] {
  const rows = new Map<string, SessionVersionAccumulator>();
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

function buildSessionCheckRows(sessions: AdminAppSession[]): SessionCheckQueueItem[] {
  const rows: SessionCheckQueueItem[] = [];
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
        title: 'Shared app device needs account review',
        detail: `${userCount} user accounts used ${shortDeviceId(deviceId)}.`,
        action: 'Review account and device notes',
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
