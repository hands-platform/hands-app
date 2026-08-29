const DEFAULT_APP_SESSION_LIST_TAKE = 10;
const MAX_APP_SESSION_LIST_TAKE = 50;

export type SessionState = 'live' | 'recent' | 'stale' | 'expired';

export type SessionFilters = {
  readonly page: number;
  readonly pageSize: number;
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
    page: readSessionPage(params.page),
    pageSize: readSessionPageSize(params.pageSize),
    role: role === 'PARTNER' || role === 'PROVIDER' ? 'PROVIDER' : role === 'CUSTOMER' ? 'CUSTOMER' : null,
    state: isSessionState(state) ? state : null,
    platform: platform || null,
    q: q || null,
  };
}

export function buildAppSessionApiHref(filters: SessionFilters) {
  const params = new URLSearchParams({ take: String(filters.pageSize) });
  appendAppSessionFilterParams(params, filters);
  const skip = (filters.page - 1) * filters.pageSize;
  if (skip > 0) {
    params.set('skip', String(skip));
  }
  return `/admin/app-sessions?${params.toString()}`;
}

export function buildAppSessionSummaryApiHref(filters: SessionFilters) {
  const params = new URLSearchParams();
  appendAppSessionFilterParams(params, filters);
  const query = params.toString();
  return query ? `/admin/app-sessions/summary?${query}` : '/admin/app-sessions/summary';
}

export function buildAppSessionCanonicalPageHref(filters: SessionFilters, totalRows: number) {
  const safeTotalRows = Math.max(0, Math.trunc(totalRows));
  if (safeTotalRows === 0) return null;
  const totalPages = Math.max(1, Math.ceil(safeTotalRows / filters.pageSize));
  return filters.page > totalPages
    ? sessionFilterHref({ ...filters, page: totalPages })
    : null;
}

function appendAppSessionFilterParams(params: URLSearchParams, filters: SessionFilters) {
  if (filters.role) params.set('role', filters.role);
  params.set('state', filters.state ?? 'live');
  if (filters.platform) params.set('platform', filters.platform);
  if (filters.q) params.set('q', filters.q);
}

export function sessionFilterHref(filters: SessionFilters) {
  const params = new URLSearchParams();
  if (filters.role) params.set('role', filters.role);
  if (filters.state) params.set('state', filters.state);
  if (filters.platform) params.set('platform', filters.platform);
  if (filters.q) params.set('q', filters.q);
  if (filters.pageSize !== DEFAULT_APP_SESSION_LIST_TAKE) params.set('pageSize', String(filters.pageSize));
  if (filters.page > 1) params.set('page', String(filters.page));
  const query = params.toString();
  return query ? `/app-sessions?${query}` : '/app-sessions';
}

export function buildAppSessionServerPagination<T>(
  rows: readonly T[],
  filters: SessionFilters,
  totalRows: number,
) {
  const safeTotalRows = Math.max(0, Math.trunc(totalRows));
  const totalPages = Math.max(1, Math.ceil(safeTotalRows / filters.pageSize));
  const page = Math.min(filters.page, totalPages);
  const start = (page - 1) * filters.pageSize;

  return {
    from: rows.length === 0 ? 0 : start + 1,
    hrefForPage: (nextPage: number) => sessionFilterHref({ ...filters, page: nextPage }),
    page,
    pageSize: filters.pageSize,
    rows,
    to: rows.length === 0 ? 0 : Math.min(start + rows.length, safeTotalRows),
    totalPages,
    totalRows: safeTotalRows,
  };
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
    : 'Showing live Customer and Partner app sessions';
}

function singleParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function readSessionPage(value: string | string[] | undefined) {
  const page = Number.parseInt(singleParam(value) ?? '', 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

function readSessionPageSize(value: string | string[] | undefined) {
  const pageSize = Number.parseInt(singleParam(value) ?? '', 10);
  if (!Number.isFinite(pageSize) || pageSize <= 0) {
    return DEFAULT_APP_SESSION_LIST_TAKE;
  }
  return Math.min(Math.trunc(pageSize), MAX_APP_SESSION_LIST_TAKE);
}

function isSessionState(value: string | undefined): value is SessionState {
  return value === 'live' || value === 'recent' || value === 'stale' || value === 'expired';
}
