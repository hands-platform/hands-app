const DEFAULT_APP_SESSION_LIST_TAKE = 10;

export type SessionState = 'live' | 'recent' | 'stale' | 'expired';

export type SessionFilters = {
  readonly platform: string | null;
  readonly q: string | null;
  readonly role: 'CUSTOMER' | 'PROVIDER' | null;
  readonly state: SessionState | null;
};

export function buildSessionFilters(params: Record<string, string | string[] | undefined>): SessionFilters {
  const role = singleParam(params.role)?.toUpperCase();
  const state = singleParam(params.state)?.toLowerCase();
  const platform = singleParam(params.platform)?.trim().toLowerCase() ?? null;
  const q = singleParam(params.q)?.trim() ?? null;

  return {
    role: role === 'PARTNER' || role === 'PROVIDER' ? 'PROVIDER' : role === 'CUSTOMER' ? 'CUSTOMER' : null,
    state: isSessionState(state) ? state : null,
    platform: platform || null,
    q: q || null,
  };
}

export function buildAppSessionApiHref(filters: SessionFilters) {
  const params = new URLSearchParams({ take: String(DEFAULT_APP_SESSION_LIST_TAKE) });
  if (filters.role) params.set('role', filters.role);
  params.set('state', filters.state ?? 'live');
  if (filters.platform) params.set('platform', filters.platform);
  if (filters.q) params.set('q', filters.q);
  return `/admin/app-sessions?${params.toString()}`;
}

export function sessionFilterHref(filters: SessionFilters) {
  const params = new URLSearchParams();
  if (filters.role) params.set('role', filters.role);
  if (filters.state) params.set('state', filters.state);
  if (filters.platform) params.set('platform', filters.platform);
  if (filters.q) params.set('q', filters.q);
  const query = params.toString();
  return query ? `/app-sessions?${query}` : '/app-sessions';
}

export function sessionFilterLabel(filters: SessionFilters) {
  const parts = [
    filters.role === 'PROVIDER'
      ? 'partner sessions'
      : filters.role === 'CUSTOMER'
        ? 'customer sessions'
        : null,
    filters.state ? `${filters.state} heartbeat` : null,
    filters.platform ? `${filters.platform} platform` : null,
    filters.q ? `search "${filters.q}"` : null,
  ].filter(Boolean);

  return parts.length
    ? `Filtered to ${parts.join(', ')}`
    : 'Showing live customer, partner, and admin app sessions';
}

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isSessionState(value: string | undefined): value is SessionState {
  return value === 'live' || value === 'recent' || value === 'stale' || value === 'expired';
}
