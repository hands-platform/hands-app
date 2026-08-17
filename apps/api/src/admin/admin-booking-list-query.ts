import { BookingStatus, ParticipantStatus, Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';
import { adminQueueAgeDateWhere } from './admin-queue-list';
import { DEFAULT_START_SHIFT_ACTION_SLA_MINUTES } from '../matching/matching.policy';

export type AdminBookingListQuery = {
  readonly age?: string | null;
  readonly cancellationReason?: string | null;
  readonly dateFrom?: string;
  readonly dateRange?: string;
  readonly dateTo?: string;
  readonly page?: number | string | null;
  readonly pageSize?: number | string | null;
  readonly q?: string | null;
  readonly statusGroup?: string;
  readonly sort?: string | null;
  readonly sla?: string | null;
  readonly take?: number | string | null;
};

export const ADMIN_BOOKING_NEEDS_ACTION_STALE_MINUTES = 30;
export const ADMIN_BOOKING_LIVE_MAX_AGE_HOURS = 24;
export const ADMIN_BOOKING_RESOLVED_STATUSES = [
  BookingStatus.COMPLETED,
  BookingStatus.CANCELLED,
  BookingStatus.NO_SHOW,
  BookingStatus.EXPIRED,
  BookingStatus.REFUNDED,
] as const;
const DAY_MS = 24 * 60 * 60_000;
const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60_000;
const ADMIN_BOOKING_LIVE_STATUS_GROUPS = new Set([
  'realtime',
  'matching',
  'in-service',
  'preferred-pending',
  'marketplace-active',
  'customer-choice',
  'no-supply',
  'handoff-repair',
  'matched',
  'matching-delays',
  'needs-action',
]);
export const ADMIN_POST_MATCH_CANCELLATION_REASON_CODES = [
  'CUSTOMER_REQUESTED',
  'CUSTOMER_NOT_FOUND',
  'SAFETY_CONCERN',
  'SERVICE_CANNOT_BE_PROVIDED',
  'OTHER',
] as const;

export type AdminPostMatchCancellationReasonCode =
  (typeof ADMIN_POST_MATCH_CANCELLATION_REASON_CODES)[number];
export type AdminPostMatchCancellationReasonFilter =
  | AdminPostMatchCancellationReasonCode
  | 'LEGACY';

export type AdminBookingListWhereOptions = {
  readonly matchingDelayBefore?: Date;
  readonly now?: Date;
};

const ADMIN_POST_MATCH_CANCELLATION_REASON_CODE_SET = new Set<string>(
  [...ADMIN_POST_MATCH_CANCELLATION_REASON_CODES, 'LEGACY'],
);

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

  if (query.statusGroup === 'usage-unresolved') {
    return { createdAt: dateRange };
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
  options: AdminBookingListWhereOptions = {},
): Prisma.BookingWhereInput | undefined {
  const filters = [
    query.statusGroup === 'usage-unresolved'
      ? adminBookingVerifiedProductionWhere()
      : adminBookingProductionDataWhere(),
    adminBookingListDateWhere(query),
    adminBookingListAgeWhere(query.age),
    adminBookingListFreshnessWhere(query.statusGroup),
    adminBookingListStatusGroupWhere(query.statusGroup, options),
    adminBookingListCancellationReasonWhere(query.cancellationReason),
    adminBookingListSearchWhere(query.q),
  ].filter((filter): filter is Prisma.BookingWhereInput => Boolean(filter));

  if (filters.length === 0) {
    return undefined;
  }

  if (filters.length === 1) {
    return filters[0];
  }

  return { AND: filters };
}

export function adminBookingListFreshnessWhere(
  statusGroup?: string,
): Prisma.BookingWhereInput | undefined {
  if (!statusGroup) {
    return undefined;
  }

  const staleBefore = new Date(Date.now() - ADMIN_BOOKING_LIVE_MAX_AGE_HOURS * 60 * 60_000);
  if (statusGroup === 'data-anomaly') {
    return { updatedAt: { lt: staleBefore } };
  }
  return ADMIN_BOOKING_LIVE_STATUS_GROUPS.has(statusGroup)
    ? { updatedAt: { gte: staleBefore } }
    : undefined;
}

export function adminBookingProductionDataWhere(): Prisma.BookingWhereInput {
  const fixtureIds: Prisma.BookingWhereInput[] = ['smoke', 'seed-'].flatMap((prefix) => [
    { id: { startsWith: prefix, mode: Prisma.QueryMode.insensitive } },
    { customerProfileId: { startsWith: prefix, mode: Prisma.QueryMode.insensitive } },
  ]);
  const optionalFixtureIds: Prisma.BookingWhereInput[] = [
    'preferredProviderId',
    'selectedProviderId',
  ].map((field) => ({
    OR: [
      { [field]: null },
      {
        NOT: {
          OR: ['smoke', 'seed-'].map((prefix) => ({
            [field]: { startsWith: prefix, mode: Prisma.QueryMode.insensitive },
          })),
        },
      },
    ],
  }));

  return {
    AND: [
      { NOT: { OR: fixtureIds } },
      ...optionalFixtureIds,
      adminBookingJsonValueIsNot({ path: ['smokeFixture'], equals: true }),
      { metadata: { path: ['auditFixture'], equals: Prisma.AnyNull } },
      adminBookingJsonValueIsNot({ path: ['smoke'], equals: true }),
      adminBookingJsonValueIsNot({ path: ['smoke'], string_contains: 'smoke' }),
      adminBookingJsonValueIsNot({ path: ['fixture'], string_contains: 'smoke' }),
    ],
  };
}

export function adminBookingProductionDataSql(booking = Prisma.sql`booking`) {
  return Prisma.sql`
    LOWER(${booking}.id) NOT LIKE 'smoke%'
    AND LOWER(${booking}.id) NOT LIKE 'seed-%'
    AND LOWER(${booking}."customerProfileId") NOT LIKE 'smoke%'
    AND LOWER(${booking}."customerProfileId") NOT LIKE 'seed-%'
    AND LOWER(COALESCE(${booking}."preferredProviderId", '')) NOT LIKE 'smoke%'
    AND LOWER(COALESCE(${booking}."preferredProviderId", '')) NOT LIKE 'seed-%'
    AND LOWER(COALESCE(${booking}."selectedProviderId", '')) NOT LIKE 'smoke%'
    AND LOWER(COALESCE(${booking}."selectedProviderId", '')) NOT LIKE 'seed-%'
    AND LOWER(COALESCE(${booking}.metadata #>> '{smokeFixture}', 'false')) <> 'true'
    AND ${booking}.metadata #>> '{auditFixture}' IS NULL
    AND LOWER(COALESCE(${booking}.metadata #>> '{smoke}', 'false')) <> 'true'
    AND LOWER(COALESCE(${booking}.metadata #>> '{smoke}', '')) NOT LIKE '%smoke%'
    AND LOWER(COALESCE(${booking}.metadata #>> '{fixture}', '')) NOT LIKE '%smoke%'
  `;
}

export function adminBookingExplicitFixtureMetadataWhere(): Prisma.BookingWhereInput {
  return {
    AND: [
      adminBookingJsonValueIsNot({ path: ['smokeFixture'], equals: true }),
      { metadata: { path: ['auditFixture'], equals: Prisma.AnyNull } },
      adminBookingJsonValueIsNot({ path: ['dataOrigin'], equals: 'SYNTHETIC' }),
    ],
  };
}

export function adminBookingExplicitFixtureMetadataSql(booking = Prisma.sql`booking`) {
  return Prisma.sql`
    LOWER(COALESCE(${booking}.metadata #>> '{smokeFixture}', 'false')) <> 'true'
    AND ${booking}.metadata #>> '{auditFixture}' IS NULL
    AND UPPER(COALESCE(${booking}.metadata #>> '{dataOrigin}', 'PRODUCTION')) <> 'SYNTHETIC'
  `;
}

export function adminBookingVerifiedProductionWhere(): Prisma.BookingWhereInput {
  return {
    AND: [
      { metadata: { path: ['dataOrigin'], equals: 'PRODUCTION' } },
      adminBookingJsonValueIsNot({ path: ['smokeFixture'], equals: true }),
      { metadata: { path: ['auditFixture'], equals: Prisma.AnyNull } },
      { metadata: { path: ['smoke'], equals: Prisma.AnyNull } },
      { metadata: { path: ['fixture'], equals: Prisma.AnyNull } },
      { customerProfile: { is: { user: { is: { fixtureKind: null } } } } },
      {
        OR: [
          { preferredProviderId: null },
          { preferredProvider: { is: { user: { is: { fixtureKind: null } } } } },
        ],
      },
      {
        OR: [
          { selectedProviderId: null },
          { selectedProvider: { is: { user: { is: { fixtureKind: null } } } } },
        ],
      },
    ],
  };
}

export function adminBookingVerifiedProductionSql(booking = Prisma.sql`booking`) {
  return Prisma.sql`
    UPPER(COALESCE(${booking}.metadata #>> '{dataOrigin}', 'UNKNOWN')) = 'PRODUCTION'
    AND LOWER(COALESCE(${booking}.metadata #>> '{smokeFixture}', 'false')) <> 'true'
    AND ${booking}.metadata #>> '{auditFixture}' IS NULL
    AND ${booking}.metadata #>> '{smoke}' IS NULL
    AND ${booking}.metadata #>> '{fixture}' IS NULL
    AND NOT (${adminBookingFixtureOwnerSql(booking)})
  `;
}

export function adminBookingUnknownOriginSql(booking = Prisma.sql`booking`) {
  return Prisma.sql`
    UPPER(COALESCE(NULLIF(${booking}.metadata #>> '{dataOrigin}', ''), 'UNKNOWN')) <> 'SYNTHETIC'
    AND LOWER(COALESCE(${booking}.metadata #>> '{smokeFixture}', 'false')) <> 'true'
    AND ${booking}.metadata #>> '{auditFixture}' IS NULL
    AND ${booking}.metadata #>> '{smoke}' IS NULL
    AND ${booking}.metadata #>> '{fixture}' IS NULL
    AND (
      UPPER(COALESCE(NULLIF(${booking}.metadata #>> '{dataOrigin}', ''), 'UNKNOWN')) <> 'PRODUCTION'
      OR ${adminBookingFixtureOwnerSql(booking)}
    )
  `;
}

function adminBookingFixtureOwnerSql(booking: Prisma.Sql) {
  return Prisma.sql`
    EXISTS (
      SELECT 1
      FROM "CustomerProfile" booking_customer
      INNER JOIN "User" booking_customer_user ON booking_customer_user.id = booking_customer."userId"
      WHERE booking_customer.id = ${booking}."customerProfileId"
        AND booking_customer_user."fixtureKind" IS NOT NULL
    )
    OR EXISTS (
      SELECT 1
      FROM "ProviderProfile" booking_partner
      INNER JOIN "User" booking_partner_user ON booking_partner_user.id = booking_partner."userId"
      WHERE booking_partner.id IN (${booking}."preferredProviderId", ${booking}."selectedProviderId")
        AND booking_partner_user."fixtureKind" IS NOT NULL
    )
  `;
}

function adminBookingJsonValueIsNot(
  filter: Prisma.JsonNullableFilterBase<'Booking'>,
): Prisma.BookingWhereInput {
  return {
    OR: [
      { metadata: { path: filter.path, equals: Prisma.AnyNull } },
      { NOT: { metadata: filter } },
    ],
  };
}

export function adminBookingListCancellationReasonWhere(
  value?: string | null,
): Prisma.BookingWhereInput | undefined {
  const reasonCode = normalizeAdminPostMatchCancellationReason(value);
  if (reasonCode === 'LEGACY') {
    return {
      AND: ADMIN_POST_MATCH_CANCELLATION_REASON_CODES.map((code) =>
        adminBookingJsonValueIsNot({
          path: ['postMatchCancellation', 'reasonCode'],
          equals: code,
        }),
      ),
    };
  }
  return reasonCode
    ? {
        metadata: {
          path: ['postMatchCancellation', 'reasonCode'],
          equals: reasonCode,
        },
      }
    : undefined;
}

export function normalizeAdminPostMatchCancellationReason(
  value?: string | null,
): AdminPostMatchCancellationReasonFilter | null {
  const normalized = value?.trim().toUpperCase();
  return normalized && ADMIN_POST_MATCH_CANCELLATION_REASON_CODE_SET.has(normalized)
    ? (normalized as AdminPostMatchCancellationReasonFilter)
    : null;
}

export function adminBookingListAgeWhere(age?: string | null): Prisma.BookingWhereInput | undefined {
  const dateWhere = adminQueueAgeDateWhere(age);
  return dateWhere ? { createdAt: dateWhere } : undefined;
}

export function adminBookingListStatusGroupWhere(
  statusGroup?: string,
  options: AdminBookingListWhereOptions = {},
): Prisma.BookingWhereInput | undefined {
  switch (statusGroup) {
    case 'realtime':
    case 'data-anomaly':
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
    case 'matching':
      return {
        status: { in: [BookingStatus.CREATED, BookingStatus.OPEN_MATCHING] },
      };
    case 'usage-unresolved':
      return { status: { notIn: [...ADMIN_BOOKING_RESOLVED_STATUSES] } };
    case 'in-service':
      return { status: BookingStatus.IN_SERVICE };
    case 'preferred-pending':
      return {
        status: BookingStatus.OPEN_MATCHING,
        preferredProviderId: { not: null },
        providerRequestEvents: {
          none: {
            eventType: {
              in: ['PREFERRED_PROVIDER_REJECTED', 'PREFERRED_PROVIDER_NO_RESPONSE'],
            },
          },
        },
      };
    case 'marketplace-active':
      return { status: BookingStatus.OPEN_MATCHING };
    case 'customer-choice':
      return {
        status: BookingStatus.OPEN_MATCHING,
        participants: {
          some: {
            respondedAt: { not: null },
            status: { in: [ParticipantStatus.JOINED, ParticipantStatus.ACCEPTED] },
          },
        },
      };
    case 'no-supply':
      return {
        status: BookingStatus.OPEN_MATCHING,
        openedAt: { lte: adminBookingMatchingDelayBefore(options) },
        participants: {
          none: {
            respondedAt: { not: null },
            status: { in: [ParticipantStatus.JOINED, ParticipantStatus.ACCEPTED] },
          },
        },
      };
    case 'handoff-repair':
      return {
        status: {
          in: [
            BookingStatus.MATCHED,
            BookingStatus.PROVIDER_ON_THE_WAY,
            BookingStatus.ARRIVED,
            BookingStatus.IN_SERVICE,
          ],
        },
        selectedProviderId: { not: null },
        chatRoom: { is: null },
      };
    case 'pre-match-cancellations':
      return {
        status: BookingStatus.CANCELLED,
        matchedAt: null,
        selectedProviderId: null,
        closedReason: 'customer_cancelled',
      };
    case 'preferred-rejected':
      return {
        status: BookingStatus.CANCELLED,
        providerRequestEvents: { some: { eventType: 'PREFERRED_PROVIDER_REJECTED' } },
      };
    case 'preferred-no-response':
      return {
        status: BookingStatus.EXPIRED,
        providerRequestEvents: { some: { eventType: 'PREFERRED_PROVIDER_NO_RESPONSE' } },
      };
    case 'matched':
      return {
        status: {
          in: [
            BookingStatus.MATCHED,
            BookingStatus.PROVIDER_ON_THE_WAY,
            BookingStatus.ARRIVED,
          ],
        },
        selectedProviderId: { not: null },
      };
    case 'matching-delays': {
      const now = options.now ?? new Date();
      return {
        status: BookingStatus.OPEN_MATCHING,
        OR: [
          { expiresAt: { lte: now } },
          {
            openedAt: { lte: adminBookingMatchingDelayBefore(options) },
            participants: {
              none: {
                respondedAt: { not: null },
                status: { in: [ParticipantStatus.JOINED, ParticipantStatus.ACCEPTED] },
              },
            },
          },
        ],
      };
    }
    case 'needs-action': {
      const now = options.now ?? new Date();
      const staleBefore = new Date(now.getTime() - ADMIN_BOOKING_NEEDS_ACTION_STALE_MINUTES * 60_000);
      return {
        AND: [
          adminBookingListStatusGroupWhere('realtime', options) ?? {},
          {
            OR: [
              { updatedAt: { lt: staleBefore } },
              {
                expiresAt: { lt: now },
                status: { in: [BookingStatus.CREATED, BookingStatus.OPEN_MATCHING] },
              },
              { chatRoom: { is: null }, status: BookingStatus.MATCHED },
            ],
          },
        ],
      };
    }
    case 'completed':
      return {
        status: {
          in: [BookingStatus.COMPLETED, BookingStatus.EXPIRED, BookingStatus.REFUNDED],
        },
      };
    case 'post-match-cancellations':
      return {
        AND: [
          {
            status: {
              in: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW],
            },
          },
          {
            OR: [{ matchedAt: { not: null } }, { selectedProviderId: { not: null } }],
          },
        ],
      };
    default:
      return undefined;
  }
}

export function adminBookingListDefaultSort(statusGroup?: string | null) {
  return statusGroup === 'needs-action' ||
    statusGroup === 'matching-delays' ||
    statusGroup === 'handoff-repair' ||
    statusGroup === 'no-supply' ||
    statusGroup === 'data-anomaly'
    ? 'oldest'
    : 'newest';
}

function adminBookingMatchingDelayBefore(options: AdminBookingListWhereOptions) {
  return (
    options.matchingDelayBefore ??
    new Date(
      (options.now ?? new Date()).getTime() -
        DEFAULT_START_SHIFT_ACTION_SLA_MINUTES.matchingDelays * 60_000,
    )
  );
}

export function adminBookingListSearchWhere(value?: string | null): Prisma.BookingWhereInput | undefined {
  const q = value?.trim();
  if (!q) {
    return undefined;
  }

  const textFilter: Prisma.StringFilter = {
    contains: q,
    mode: Prisma.QueryMode.insensitive,
  };
  const userFilter: Prisma.UserWhereInput = {
    OR: [{ fullName: textFilter }, { phone: textFilter }],
  };

  return {
    OR: [
      { id: textFilter },
      { customerProfileId: textFilter },
      { preferredProviderId: textFilter },
      { selectedProviderId: textFilter },
      { customerProfile: { is: { user: { is: userFilter } } } },
      {
        preferredProvider: {
          is: { OR: [{ displayName: textFilter }, { user: { is: userFilter } }] },
        },
      },
      {
        selectedProvider: {
          is: { OR: [{ displayName: textFilter }, { user: { is: userFilter } }] },
        },
      },
      { addressSnapshot: { is: { addressText: textFilter } } },
    ],
  };
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

  if (fromMs === null || toMs === null) {
    throw new BadRequestException('Custom date range requires valid from and to dates');
  }
  if (fromMs > toMs) {
    throw new BadRequestException('Custom date from must be on or before date to');
  }
  if (toMs - fromMs > 89 * DAY_MS) {
    throw new BadRequestException('Custom date range cannot exceed 90 days');
  }

  return { startMs: fromMs, endMs: endOfLocalDay(toMs) };
}

export function parseAdminBookingListDate(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const timestamp =
    Date.UTC(yearNumber, monthNumber - 1, dayNumber) - VIETNAM_UTC_OFFSET_MS;
  const localDate = new Date(timestamp + VIETNAM_UTC_OFFSET_MS);
  return localDate.getUTCFullYear() === yearNumber &&
    localDate.getUTCMonth() === monthNumber - 1 &&
    localDate.getUTCDate() === dayNumber
    ? timestamp
    : null;
}

export function startOfLocalDay(timestamp: number) {
  return Math.floor((timestamp + VIETNAM_UTC_OFFSET_MS) / DAY_MS) * DAY_MS - VIETNAM_UTC_OFFSET_MS;
}

export function endOfLocalDay(startMs: number) {
  return addLocalDays(startMs, 1) - 1;
}

export function addLocalDays(timestamp: number, days: number) {
  return timestamp + days * DAY_MS;
}
