import {
  type DetailDateFilters,
  readDetailDateFilters,
} from '../../lib/detail-date-filter';
import { readSearchParam } from '../../lib/date-range';

const CHAT_ARCHIVE_DEFAULT_TAKE = 50;
const CHAT_REPAIR_BOOKING_DEFAULT_TAKE = 100;

export type ChatArchiveFilters = {
  readonly q: string;
  readonly sender: string;
  readonly status: string;
};

export type ChatArchiveLoadPlan = {
  readonly archiveHref: string;
  readonly dateFilters: DetailDateFilters;
  readonly filters: ChatArchiveFilters;
  readonly repairBookingsHref: string;
};

export function buildChatArchiveLoadPlan(
  params: Record<string, string | string[] | undefined>,
): ChatArchiveLoadPlan {
  const normalizedParams = { ...params };
  if (!readSearchParam(normalizedParams.range)) {
    normalizedParams.range = 'today';
  }

  const filters = readChatArchiveFilters(normalizedParams);
  const dateFilters = readDetailDateFilters(normalizedParams);
  const hasExplicitDateBounds = Boolean(readSearchParam(params.from) || readSearchParam(params.to));

  return {
    archiveHref: buildChatArchiveApiHref(filters, dateFilters, hasExplicitDateBounds),
    dateFilters,
    filters,
    repairBookingsHref: buildRepairBookingsApiHref(dateFilters, hasExplicitDateBounds),
  };
}

export function readChatArchiveFilters(
  params: Record<string, string | string[] | undefined>,
): ChatArchiveFilters {
  return {
    q: readSearchParam(params.q).trim(),
    sender: readSearchParam(params.sender).trim(),
    status: readSearchParam(params.status).trim(),
  };
}

function buildChatArchiveApiHref(
  filters: ChatArchiveFilters,
  dateFilters: DetailDateFilters,
  hasExplicitDateBounds: boolean,
) {
  const params = new URLSearchParams();
  appendDateParams(params, dateFilters, hasExplicitDateBounds);
  if (filters.status) params.set('status', filters.status);
  if (filters.sender) params.set('sender', filters.sender);
  if (filters.q) params.set('q', filters.q);
  params.set('take', String(CHAT_ARCHIVE_DEFAULT_TAKE));
  return `/admin/chat-archive?${params.toString()}`;
}

function buildRepairBookingsApiHref(dateFilters: DetailDateFilters, hasExplicitDateBounds: boolean) {
  const params = new URLSearchParams();
  appendDateParams(params, dateFilters, hasExplicitDateBounds);
  params.set('take', String(CHAT_REPAIR_BOOKING_DEFAULT_TAKE));
  return `/admin/bookings?${params.toString()}`;
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
