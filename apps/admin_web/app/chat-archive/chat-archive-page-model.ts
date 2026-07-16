import {
  type DetailDateFilters,
  readDetailDateFilters,
} from '../../lib/detail-date-filter';
import { readSearchParam } from '../../lib/date-range';

const CHAT_ARCHIVE_DEFAULT_TAKE = 10;

export type ChatArchiveFilters = {
  readonly q: string;
  readonly sender: string;
  readonly status: string;
};

export type ChatArchiveLoadPlan = {
  readonly activePage: number;
  readonly archiveHref: string;
  readonly archivePageHref: (page: number) => string;
  readonly archivePageSize: number;
  readonly archiveSummaryHref: string;
  readonly dateFilters: DetailDateFilters;
  readonly filters: ChatArchiveFilters;
};

export function buildChatArchiveLoadPlan(
  params: Record<string, string | string[] | undefined>,
): ChatArchiveLoadPlan {
  const normalizedParams = { ...params };
  const directBookingId = readSearchParam(normalizedParams.bookingId).trim();
  if (directBookingId && !readSearchParam(normalizedParams.q)) {
    normalizedParams.q = directBookingId;
  }
  if (!readSearchParam(normalizedParams.range)) {
    normalizedParams.range = directBookingId ? 'all' : 'today';
  }

  const filters = readChatArchiveFilters(normalizedParams);
  const dateFilters = readDetailDateFilters(normalizedParams);
  const hasExplicitDateBounds = Boolean(readSearchParam(params.from) || readSearchParam(params.to));
  const activePage = readChatArchivePage(normalizedParams.page);

  return {
    activePage,
    archiveHref: buildChatArchiveApiHref(filters, dateFilters, hasExplicitDateBounds, activePage),
    archivePageHref: (page) => buildChatArchivePageHref(filters, dateFilters, page),
    archivePageSize: CHAT_ARCHIVE_DEFAULT_TAKE,
    archiveSummaryHref: buildChatArchiveSummaryApiHref(filters, dateFilters, hasExplicitDateBounds),
    dateFilters,
    filters,
  };
}

export function readChatArchiveFilters(
  params: Record<string, string | string[] | undefined>,
): ChatArchiveFilters {
  return {
    q: readSearchParam(params.q).trim(),
    sender: readSearchParam(params.sender).trim(),
    status: normalizeChatArchiveStatus(readSearchParam(params.status)),
  };
}

function normalizeChatArchiveStatus(value: string) {
  const status = value.trim();
  return ['active', 'completed', 'closed', 'no-message'].includes(status) ? status : '';
}

function buildChatArchiveApiHref(
  filters: ChatArchiveFilters,
  dateFilters: DetailDateFilters,
  hasExplicitDateBounds: boolean,
  activePage: number,
) {
  const params = new URLSearchParams();
  appendDateParams(params, dateFilters, hasExplicitDateBounds);
  if (filters.status) params.set('status', filters.status);
  if (filters.sender) params.set('sender', filters.sender);
  if (filters.q) params.set('q', filters.q);
  params.set('take', String(CHAT_ARCHIVE_DEFAULT_TAKE));
  const skip = (activePage - 1) * CHAT_ARCHIVE_DEFAULT_TAKE;
  if (skip > 0) params.set('skip', String(skip));
  return `/admin/chat-archive?${params.toString()}`;
}

function buildChatArchiveSummaryApiHref(
  filters: ChatArchiveFilters,
  dateFilters: DetailDateFilters,
  hasExplicitDateBounds: boolean,
) {
  const params = new URLSearchParams();
  appendDateParams(params, dateFilters, hasExplicitDateBounds);
  if (filters.status) params.set('status', filters.status);
  if (filters.sender) params.set('sender', filters.sender);
  if (filters.q) params.set('q', filters.q);
  return `/admin/chat-archive/summary?${params.toString()}`;
}

function buildChatArchivePageHref(
  filters: ChatArchiveFilters,
  dateFilters: DetailDateFilters,
  activePage: number,
) {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.sender) params.set('sender', filters.sender);
  if (filters.status) params.set('status', filters.status);
  const range = dateFilters.range || 'today';
  params.set('range', range);
  if (range === 'custom') {
    if (dateFilters.from) params.set('from', dateFilters.from);
    if (dateFilters.to) params.set('to', dateFilters.to);
  }
  if (activePage > 1) params.set('page', String(activePage));
  const query = params.toString();
  return query ? `/chat-archive?${query}` : '/chat-archive';
}

function readChatArchivePage(value: string | string[] | undefined) {
  const raw = readSearchParam(value);
  const page = Number.parseInt(raw, 10);
  if (!Number.isFinite(page)) return 1;
  return Math.max(1, page);
}

function appendDateParams(
  params: URLSearchParams,
  dateFilters: DetailDateFilters,
  hasExplicitDateBounds: boolean,
) {
  const dateRange = hasExplicitDateBounds ? 'custom' : dateFilters.range || 'today';
  params.set('dateRange', dateRange);
  if (dateRange === 'custom') {
    if (dateFilters.from) params.set('dateFrom', dateFilters.from);
    if (dateFilters.to) params.set('dateTo', dateFilters.to);
  }
}
