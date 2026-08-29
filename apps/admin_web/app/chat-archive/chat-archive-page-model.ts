import { readSearchParam } from '../../lib/date-range';

const CHAT_ARCHIVE_DEFAULT_TAKE = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
export const CHAT_ARCHIVE_QUERY_MAX_LENGTH = 120;

export type ChatArchiveDateRange = 'all' | 'today' | '7d' | '30d' | 'custom';

export type ChatArchiveDateFilters = {
  readonly from: string;
  readonly label: string;
  readonly range: ChatArchiveDateRange;
  readonly to: string;
};

export type ChatArchiveFilters = {
  readonly q: string;
  readonly sender: string;
  readonly sort: 'newest' | 'oldest';
  readonly status: string;
};

export type ChatArchiveLoadPlan = {
  readonly activePage: number;
  readonly archiveHref: string | null;
  readonly archivePageHref: (page: number) => string;
  readonly archivePageSize: number;
  readonly archiveSummaryHref: string | null;
  readonly currentHref: string;
  readonly dateFilters: ChatArchiveDateFilters;
  readonly filters: ChatArchiveFilters;
  readonly needsCanonicalFilterRedirect: boolean;
  readonly needsCanonicalPageRedirect: boolean;
  readonly validationError: string | null;
};

export function buildChatArchiveLoadPlan(
  params: Record<string, string | string[] | undefined>,
): ChatArchiveLoadPlan {
  const normalizedParams = { ...params };
  const directBookingId = readSearchParam(normalizedParams.bookingId).trim();
  if (directBookingId && !readSearchParam(normalizedParams.q)) {
    normalizedParams.q = directBookingId;
  }
  if (!readSearchParam(normalizedParams.range) && (readSearchParam(params.from) || readSearchParam(params.to))) {
    normalizedParams.range = 'custom';
  }

  const filters = readChatArchiveFilters(normalizedParams);
  const dateFilters = readChatArchiveDateFilters(normalizedParams);
  const validationError = validateChatArchiveDateFilters(dateFilters);
  const pageState = readChatArchivePage(normalizedParams.page);
  const archivePageHref = (page: number) => buildChatArchivePageHref(filters, dateFilters, page);
  const hasUnknownFilter =
    !isAllowedChatArchiveStatus(readSearchParam(params.status)) ||
    !isAllowedChatArchiveSender(readSearchParam(params.sender)) ||
    !isAllowedChatArchiveRange(readSearchParam(params.range)) ||
    !isAllowedChatArchiveSort(readSearchParam(params.sort));
  const queryNeedsCanonicalRedirect = readSearchParam(params.q) !== filters.q;

  return {
    activePage: pageState.page,
    archiveHref: validationError ? null : buildChatArchiveApiHref(filters, dateFilters, pageState.page),
    archivePageHref,
    archivePageSize: CHAT_ARCHIVE_DEFAULT_TAKE,
    archiveSummaryHref: validationError ? null : buildChatArchiveSummaryApiHref(filters, dateFilters),
    currentHref: archivePageHref(pageState.page),
    dateFilters,
    filters,
    needsCanonicalFilterRedirect:
      hasUnknownFilter ||
      queryNeedsCanonicalRedirect ||
      (dateFilters.range !== 'custom' && Boolean(readSearchParam(params.from) || readSearchParam(params.to))),
    needsCanonicalPageRedirect: pageState.needsCanonicalRedirect,
    validationError,
  };
}

export function readChatArchiveFilters(
  params: Record<string, string | string[] | undefined>,
): ChatArchiveFilters {
  return {
    q: normalizeChatArchiveQuery(readSearchParam(params.q)),
    sender: normalizeChatArchiveSender(readSearchParam(params.sender)),
    sort: readSearchParam(params.sort).trim().toLowerCase() === 'oldest' ? 'oldest' : 'newest',
    status: normalizeChatArchiveStatus(readSearchParam(params.status)),
  };
}

export function normalizeChatArchiveQuery(value: string) {
  return value.trim().slice(0, CHAT_ARCHIVE_QUERY_MAX_LENGTH);
}

function readChatArchiveDateFilters(
  params: Record<string, string | string[] | undefined>,
): ChatArchiveDateFilters {
  const range = normalizeChatArchiveRange(readSearchParam(params.range));
  const from = readSearchParam(params.from).trim();
  const to = readSearchParam(params.to).trim();
  return {
    from,
    label: chatArchiveDateLabel(range, from, to),
    range,
    to,
  };
}

function normalizeChatArchiveRange(value: string): ChatArchiveDateRange {
  const range = value.trim().toLowerCase();
  return range === 'today' || range === '7d' || range === '30d' || range === 'custom' ? range : 'all';
}

function normalizeChatArchiveStatus(value: string) {
  const status = value.trim().toLowerCase();
  return ['active', 'completed', 'closed'].includes(status) ? status : '';
}

function normalizeChatArchiveSender(value: string) {
  const sender = value.trim().toLowerCase();
  return ['customer', 'partner', 'admin'].includes(sender) ? sender : '';
}

function isAllowedChatArchiveStatus(value: string) {
  const status = value.trim().toLowerCase();
  return status === '' || ['active', 'completed', 'closed'].includes(status);
}

function isAllowedChatArchiveSender(value: string) {
  const sender = value.trim().toLowerCase();
  return sender === '' || ['customer', 'partner', 'admin'].includes(sender);
}

function isAllowedChatArchiveRange(value: string) {
  const range = value.trim().toLowerCase();
  return range === '' || ['all', 'today', '7d', '30d', 'custom'].includes(range);
}

function isAllowedChatArchiveSort(value: string) {
  const sort = value.trim().toLowerCase();
  return sort === '' || sort === 'newest' || sort === 'oldest';
}

function validateChatArchiveDateFilters(filters: ChatArchiveDateFilters) {
  if (filters.range !== 'custom') return null;
  const fromMs = parseDate(filters.from);
  const toMs = parseDate(filters.to);
  if (fromMs === null || toMs === null) {
    return 'Custom date range requires valid From and To dates.';
  }
  if (fromMs > toMs) {
    return 'From date must be on or before To date.';
  }
  if (toMs - fromMs > 89 * DAY_MS) {
    return 'Custom date range cannot exceed 90 days.';
  }
  return null;
}

function parseDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? timestamp
    : null;
}

function buildChatArchiveApiHref(
  filters: ChatArchiveFilters,
  dateFilters: ChatArchiveDateFilters,
  activePage: number,
) {
  const params = buildApiParams(filters, dateFilters);
  params.set('take', String(CHAT_ARCHIVE_DEFAULT_TAKE));
  const skip = (activePage - 1) * CHAT_ARCHIVE_DEFAULT_TAKE;
  if (skip > 0) params.set('skip', String(skip));
  return `/admin/chat-archive?${params.toString()}`;
}

function buildChatArchiveSummaryApiHref(
  filters: ChatArchiveFilters,
  dateFilters: ChatArchiveDateFilters,
) {
  return `/admin/chat-archive/summary?${buildApiParams(filters, dateFilters).toString()}`;
}

function buildApiParams(filters: ChatArchiveFilters, dateFilters: ChatArchiveDateFilters) {
  const params = new URLSearchParams();
  params.set('dateRange', dateFilters.range);
  if (dateFilters.range === 'custom') {
    params.set('dateFrom', dateFilters.from);
    params.set('dateTo', dateFilters.to);
  }
  if (filters.status) params.set('status', filters.status);
  if (filters.sender) params.set('sender', filters.sender);
  if (filters.q) params.set('q', filters.q);
  params.set('sort', filters.sort);
  return params;
}

function buildChatArchivePageHref(
  filters: ChatArchiveFilters,
  dateFilters: ChatArchiveDateFilters,
  activePage: number,
) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.sender) params.set('sender', filters.sender);
  if (filters.status) params.set('status', filters.status);
  if (dateFilters.range !== 'all') params.set('range', dateFilters.range);
  if (dateFilters.range === 'custom') {
    if (dateFilters.from) params.set('from', dateFilters.from);
    if (dateFilters.to) params.set('to', dateFilters.to);
  }
  if (filters.sort !== 'newest') params.set('sort', filters.sort);
  if (activePage > 1) params.set('page', String(activePage));
  const query = params.toString();
  return query ? `/chat-archive?${query}` : '/chat-archive';
}

function readChatArchivePage(value: string | string[] | undefined) {
  const raw = readSearchParam(value).trim();
  if (!raw) return { needsCanonicalRedirect: false, page: 1 };
  if (!/^[1-9]\d*$/u.test(raw)) return { needsCanonicalRedirect: true, page: 1 };
  const page = Number(raw);
  if (!Number.isSafeInteger(page)) return { needsCanonicalRedirect: true, page: 1 };
  return { needsCanonicalRedirect: false, page };
}

function chatArchiveDateLabel(range: ChatArchiveDateRange, from: string, to: string) {
  if (range === 'today') return 'Today';
  if (range === '7d') return 'Last 7 days';
  if (range === '30d') return 'Last 30 days';
  if (range === 'custom') return from && to ? `${from} to ${to}` : 'Custom date range';
  return 'All dates';
}
