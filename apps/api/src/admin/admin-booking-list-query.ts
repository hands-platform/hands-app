import { BookingStatus, Prisma } from '@prisma/client';

export type AdminBookingListQuery = {
  readonly dateFrom?: string;
  readonly dateRange?: string;
  readonly dateTo?: string;
  readonly statusGroup?: string;
  readonly take?: number | string | null;
};

export function adminBookingListDateWhere(
  query: AdminBookingListQuery,
): Prisma.BookingWhereInput | undefined {
  const bounds = adminBookingListDateBounds(query);
  if (!bounds) {
    return undefined;
  }

  const dateRange: { gte?: Date; lte?: Date } = {};
  if (Number.isFinite(bounds.startMs)) {
    dateRange.gte = new Date(bounds.startMs);
  }
  if (Number.isFinite(bounds.endMs)) {
    dateRange.lte = new Date(bounds.endMs);
  }

  return {
    OR: [
      { openedAt: dateRange },
      { createdAt: dateRange },
      { updatedAt: dateRange },
      { matchedAt: dateRange },
      { closedAt: dateRange },
      { expiresAt: dateRange },
    ],
  };
}

export function adminBookingListWhere(
  query: AdminBookingListQuery,
): Prisma.BookingWhereInput | undefined {
  const filters = [
    adminBookingListDateWhere(query),
    adminBookingListStatusGroupWhere(query.statusGroup),
  ].filter((filter): filter is Prisma.BookingWhereInput => Boolean(filter));

  if (filters.length === 0) {
    return undefined;
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return { AND: filters };
}

export function adminBookingListStatusGroupWhere(
  statusGroup?: string,
): Prisma.BookingWhereInput | undefined {
  switch (statusGroup) {
    case 'realtime':
      return {
        status: {
          in: [
            BookingStatus.CREATED,
            BookingStatus.OPEN_MATCHING,
            BookingStatus.MATCHED,
            BookingStatus.PROVIDER_ON_THE_WAY,
            BookingStatus.ARRIVED,
            BookingStatus.IN_SERVICE,
          ],
        },
      };
    case 'completed':
      return {
        status: {
          in: [BookingStatus.COMPLETED, BookingStatus.EXPIRED, BookingStatus.REFUNDED],
        },
      };
    case 'post-match-cancellations':
      return {
        status: {
          in: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
        },
      };
    default:
      return undefined;
  }
}

export function adminBookingListDateBounds(query: AdminBookingListQuery) {
  const nowMs = Date.now();
  const todayStartMs = startOfLocalDay(nowMs);
  const todayEndMs = endOfLocalDay(todayStartMs);

  switch (query.dateRange) {
    case 'today':
      return { startMs: todayStartMs, endMs: todayEndMs };
    case 'yesterday': {
      const startMs = addLocalDays(todayStartMs, -1);
      return { startMs, endMs: endOfLocalDay(startMs) };
    }
    case '7d':
      return { startMs: addLocalDays(todayStartMs, -6), endMs: todayEndMs };
    case '30d':
      return { startMs: addLocalDays(todayStartMs, -29), endMs: todayEndMs };
    case '90d':
      return { startMs: addLocalDays(todayStartMs, -89), endMs: todayEndMs };
    case 'custom':
      return adminBookingListCustomDateBounds(query.dateFrom, query.dateTo);
    default:
      return undefined;
  }
}

export function adminBookingListCustomDateBounds(dateFrom?: string, dateTo?: string) {
  const fromMs = parseAdminBookingListDate(dateFrom);
  const toMs = parseAdminBookingListDate(dateTo);

  if (fromMs === null && toMs === null) {
    return undefined;
  }

  const startMs = fromMs ?? Number.NEGATIVE_INFINITY;
  const endMs = toMs === null ? Number.POSITIVE_INFINITY : endOfLocalDay(toMs);

  return startMs <= endMs ? { startMs, endMs } : { startMs: endMs, endMs: startMs };
}

export function parseAdminBookingListDate(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const timestamp = new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function startOfLocalDay(timestamp: number) {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function endOfLocalDay(startMs: number) {
  return addLocalDays(startMs, 1) - 1;
}

export function addLocalDays(timestamp: number, days: number) {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}
