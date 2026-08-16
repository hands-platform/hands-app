import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  adminNotificationDataScopeSql,
  adminNotificationPushIntentSql,
} from './admin-notification-production-data';
import { adminQueueAgeDateWhere, adminQueueSortDirection } from './admin-queue-list';

export type AdminNotificationRetryQueryOptions = {
  readonly age?: string;
  readonly booking?: string;
  readonly from?: string;
  readonly sort?: string;
  readonly to?: string;
  readonly user?: string;
  readonly q?: string;
  readonly recipientRole?: string;
  readonly channel?: string;
  readonly failureCode?: string;
  readonly failureProvider?: string;
  readonly scope?: string;
  readonly dataScope?: string;
};

export type AdminNotificationRetryPageRow = {
  readonly id: string;
};

export type AdminNotificationRetryCountRow = {
  readonly count: number;
  readonly oldestOpenAt: Date | null;
};

export type AdminNotificationIncidentMode = 'all' | 'current' | 'historical';

export type AdminNotificationIncidentPageRow = {
  readonly affectedUserCount: number;
  readonly failureCode: string;
  readonly firstOccurredAt: Date;
  readonly id: string;
  readonly lastOccurredAt: Date;
  readonly notificationCount: number;
  readonly provider: string;
  readonly windowStartedAt: Date;
};

export type AdminNotificationIncidentSummaryRow = {
  readonly incidentCount: number;
  readonly notificationCount: number;
  readonly oldestOpenAt: Date | null;
};

export type AdminNotificationDeliveryDisposition = 'delivered' | 'failed' | 'skipped';

export function adminNotificationRetryPageQuery(
  options: AdminNotificationRetryQueryOptions,
  take: number,
  skip: number,
) {
  return adminNotificationDispositionPageQuery(options, 'failed', take, skip);
}

export function adminNotificationDispositionPageQuery(
  options: AdminNotificationRetryQueryOptions,
  disposition: AdminNotificationDeliveryDisposition,
  take: number,
  skip: number,
) {
  const direction = adminQueueSortDirection(options.sort) === 'asc'
    ? Prisma.sql`ASC`
    : Prisma.sql`DESC`;

  return Prisma.sql`
    WITH disposition_notifications AS (
      ${adminNotificationDispositionFilteredSql(options, disposition)}
    )
    SELECT disposition_notifications.id
    FROM disposition_notifications
    ORDER BY
      disposition_notifications."createdAt" ${direction},
      disposition_notifications.id ${direction}
    LIMIT ${take}
    OFFSET ${skip}
  `;
}

export function adminNotificationRetryCountQuery(
  options: AdminNotificationRetryQueryOptions,
) {
  return adminNotificationDispositionCountQuery(options, 'failed');
}

export function adminNotificationDispositionCountQuery(
  options: AdminNotificationRetryQueryOptions,
  disposition: AdminNotificationDeliveryDisposition,
) {
  return Prisma.sql`
    WITH disposition_notifications AS (
      ${adminNotificationDispositionFilteredSql(options, disposition)}
    )
    SELECT
      COUNT(*)::integer AS count,
      MIN(disposition_notifications."createdAt") AS "oldestOpenAt"
    FROM disposition_notifications
  `;
}

export function adminNotificationIncidentPageQuery(
  options: AdminNotificationRetryQueryOptions,
  mode: AdminNotificationIncidentMode,
  windowMinutes: number,
  historicalCutoffAt: Date,
  take: number,
  skip: number,
) {
  const direction = adminQueueSortDirection(options.sort) === 'asc'
    ? Prisma.sql`ASC`
    : Prisma.sql`DESC`;

  return Prisma.sql`
    WITH failed_paths AS (
      ${adminNotificationIncidentFilteredSql(options, mode, windowMinutes, historicalCutoffAt)}
    ), grouped AS (
      SELECT
        failed_paths.provider,
        failed_paths."failureCode",
        (ARRAY_AGG(failed_paths.id ORDER BY failed_paths."occurredAt" DESC, failed_paths.id DESC))[1] AS id,
        MIN(failed_paths."occurredAt") AS "firstOccurredAt",
        MAX(failed_paths."occurredAt") AS "lastOccurredAt",
        MIN(failed_paths."occurredAt") AS "windowStartedAt",
        COUNT(DISTINCT failed_paths.id)::integer AS "notificationCount",
        COUNT(DISTINCT failed_paths."userId")::integer AS "affectedUserCount"
      FROM failed_paths
      GROUP BY failed_paths.provider, failed_paths."failureCode"
    )
    SELECT *
    FROM grouped
    ORDER BY grouped."lastOccurredAt" ${direction}, grouped.id ${direction}
    LIMIT ${take}
    OFFSET ${skip}
  `;
}

export function adminNotificationIncidentSummaryQuery(
  options: AdminNotificationRetryQueryOptions,
  mode: AdminNotificationIncidentMode,
  windowMinutes: number,
  historicalCutoffAt: Date,
) {
  return Prisma.sql`
    WITH failed_paths AS (
      ${adminNotificationIncidentFilteredSql(options, mode, windowMinutes, historicalCutoffAt)}
    ), grouped AS (
      SELECT
        failed_paths.provider,
        failed_paths."failureCode",
        MIN(failed_paths."occurredAt") AS "firstOccurredAt",
        COUNT(DISTINCT failed_paths.id)::integer AS "notificationCount"
      FROM failed_paths
      GROUP BY failed_paths.provider, failed_paths."failureCode"
    )
    SELECT
      COUNT(*)::integer AS "incidentCount",
      COALESCE(SUM(grouped."notificationCount"), 0)::integer AS "notificationCount",
      MIN(grouped."firstOccurredAt") AS "oldestOpenAt"
    FROM grouped
  `;
}

function adminNotificationIncidentFilteredSql(
  options: AdminNotificationRetryQueryOptions,
  mode: AdminNotificationIncidentMode,
  _windowMinutes: number,
  historicalCutoffAt: Date,
) {
  const conditions: Prisma.Sql[] = [
    adminNotificationDataScopeSql(options.dataScope),
    adminNotificationPushIntentSql(),
  ];
  const from = parseNotificationBoundary(options.from);
  const to = parseNotificationBoundary(options.to);
  if (from && to && from.getTime() >= to.getTime()) {
    throw new BadRequestException('Notification date range is invalid');
  }
  if (from) conditions.push(Prisma.sql`notification."createdAt" >= ${from}`);
  if (to) conditions.push(Prisma.sql`notification."createdAt" < ${to}`);
  appendNotificationActionScope(conditions, options.scope);

  const booking = normalizeQueryValue(options.booking);
  if (booking) conditions.push(Prisma.sql`notification."data"->>'bookingId' = ${booking}`);
  const user = normalizeQueryValue(options.user);
  if (user) conditions.push(Prisma.sql`notification."userId" = ${user}`);
  appendNotificationRecordFilters(conditions, options);

  const ageWhere = adminQueueAgeDateWhere(options.age);
  if (ageWhere?.gte instanceof Date) conditions.push(Prisma.sql`notification."createdAt" >= ${ageWhere.gte}`);
  if (ageWhere?.gt instanceof Date) conditions.push(Prisma.sql`notification."createdAt" > ${ageWhere.gt}`);
  if (ageWhere?.lte instanceof Date) conditions.push(Prisma.sql`notification."createdAt" <= ${ageWhere.lte}`);
  if (ageWhere?.lt instanceof Date) conditions.push(Prisma.sql`notification."createdAt" < ${ageWhere.lt}`);

  const historyCondition = mode === 'historical'
    ? Prisma.sql`latest_delivery."attemptedAt" < ${historicalCutoffAt}`
    : mode === 'current'
      ? Prisma.sql`latest_delivery."attemptedAt" >= ${historicalCutoffAt}`
      : Prisma.sql`TRUE`;
  const failureProvider = normalizeFailureProvider(options.failureProvider);
  const failureCode = normalizeFailureCode(options.failureCode);
  if (failureProvider) {
    conditions.push(Prisma.sql`latest_delivery.provider::text = ${failureProvider}`);
  }
  if (failureCode) {
    conditions.push(Prisma.sql`COALESCE(
      NULLIF(latest_delivery.response->>'failureCode', ''),
      NULLIF(latest_delivery.response->'body'->'error'->>'status', ''),
      'UNCLASSIFIED_FAILURE'
    ) = ${failureCode}`);
  }

  return Prisma.sql`
    WITH latest_delivery AS (
      SELECT DISTINCT ON (delivery."notificationId", delivery."pushDeviceId")
        delivery."notificationId",
        delivery.provider,
        delivery.status,
        delivery.response,
        delivery."attemptedAt"
      FROM "NotificationDelivery" delivery
      ORDER BY
        delivery."notificationId",
        delivery."pushDeviceId",
        delivery."attemptedAt" DESC,
        delivery.id DESC
    )
    SELECT
      notification.id,
      notification."userId",
      latest_delivery.provider,
      COALESCE(
        NULLIF(latest_delivery.response->>'failureCode', ''),
        NULLIF(latest_delivery.response->'body'->'error'->>'status', ''),
        'UNCLASSIFIED_FAILURE'
      ) AS "failureCode",
      latest_delivery."attemptedAt" AS "occurredAt"
    FROM "Notification" notification
    INNER JOIN latest_delivery
      ON latest_delivery."notificationId" = notification.id
    WHERE latest_delivery.status = 'FAILED'
      AND ${historyCondition}
      AND ${Prisma.join(conditions, ' AND ')}
  `;
}

function adminNotificationDispositionFilteredSql(
  options: AdminNotificationRetryQueryOptions,
  disposition: AdminNotificationDeliveryDisposition,
) {
  const conditions: Prisma.Sql[] = [
    adminNotificationDataScopeSql(options.dataScope),
    adminNotificationPushIntentSql(),
  ];
  const from = parseNotificationBoundary(options.from);
  const to = parseNotificationBoundary(options.to);
  if (from && to && from.getTime() >= to.getTime()) {
    throw new BadRequestException('Notification date range is invalid');
  }
  if (from) conditions.push(Prisma.sql`notification."createdAt" >= ${from}`);
  if (to) conditions.push(Prisma.sql`notification."createdAt" < ${to}`);
  appendNotificationActionScope(conditions, options.scope);

  const booking = normalizeQueryValue(options.booking);
  if (booking) conditions.push(Prisma.sql`notification."data"->>'bookingId' = ${booking}`);
  const user = normalizeQueryValue(options.user);
  if (user) conditions.push(Prisma.sql`notification."userId" = ${user}`);
  appendNotificationRecordFilters(conditions, options);

  const ageWhere = adminQueueAgeDateWhere(options.age);
  if (ageWhere?.gte instanceof Date) {
    conditions.push(Prisma.sql`notification."createdAt" >= ${ageWhere.gte}`);
  }
  if (ageWhere?.gt instanceof Date) {
    conditions.push(Prisma.sql`notification."createdAt" > ${ageWhere.gt}`);
  }
  if (ageWhere?.lte instanceof Date) {
    conditions.push(Prisma.sql`notification."createdAt" <= ${ageWhere.lte}`);
  }
  if (ageWhere?.lt instanceof Date) {
    conditions.push(Prisma.sql`notification."createdAt" < ${ageWhere.lt}`);
  }

  const where = conditions.length
    ? Prisma.sql`AND ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;

  const dispositionWhere =
    disposition === 'delivered'
      ? Prisma.sql`delivery_state."hasSent" AND NOT delivery_state."hasFailed"`
      : disposition === 'skipped'
        ? Prisma.sql`
            NOT delivery_state."hasSent"
            AND NOT delivery_state."hasFailed"
            AND delivery_state."hasSkipped"
          `
        : Prisma.sql`delivery_state."hasFailed"`;
  const exactFailureWhere = notificationExactFailureWhere(options);

  return Prisma.sql`
    WITH latest_delivery AS (
      SELECT DISTINCT ON (delivery."notificationId", delivery."pushDeviceId")
        delivery."notificationId",
        delivery.provider,
        delivery.response,
        delivery.status
      FROM "NotificationDelivery" delivery
      ORDER BY
        delivery."notificationId",
        delivery."pushDeviceId",
        delivery."attemptedAt" DESC,
        delivery.id DESC
    ), delivery_state AS (
      SELECT
        latest_delivery."notificationId",
        BOOL_OR(latest_delivery.status IN ('SENT', 'DELIVERED', 'SUCCESS')) AS "hasSent",
        BOOL_OR(latest_delivery.status = 'FAILED') AS "hasFailed",
        BOOL_OR(latest_delivery.status = 'SKIPPED') AS "hasSkipped"
      FROM latest_delivery
      GROUP BY latest_delivery."notificationId"
    )
    SELECT notification.id, notification."createdAt"
    FROM "Notification" notification
    INNER JOIN delivery_state
      ON delivery_state."notificationId" = notification.id
    WHERE ${dispositionWhere}
      ${exactFailureWhere}
    ${where}
  `;
}

function notificationExactFailureWhere(options: AdminNotificationRetryQueryOptions) {
  const provider = normalizeFailureProvider(options.failureProvider);
  const failureCode = normalizeFailureCode(options.failureCode);
  if (!provider && !failureCode) return Prisma.empty;
  const filters: Prisma.Sql[] = [Prisma.sql`exact_delivery.status = 'FAILED'`];
  if (provider) filters.push(Prisma.sql`exact_delivery.provider::text = ${provider}`);
  if (failureCode) {
    filters.push(Prisma.sql`COALESCE(
      NULLIF(exact_delivery.response->>'failureCode', ''),
      NULLIF(exact_delivery.response->'body'->'error'->>'status', ''),
      'UNCLASSIFIED_FAILURE'
    ) = ${failureCode}`);
  }
  return Prisma.sql`AND EXISTS (
    SELECT 1
    FROM latest_delivery exact_delivery
    WHERE exact_delivery."notificationId" = notification.id
      AND ${Prisma.join(filters, ' AND ')}
  )`;
}

function appendNotificationActionScope(
  conditions: Prisma.Sql[],
  value: string | undefined,
  now = new Date(),
) {
  const scope = normalizeQueryValue(value)?.toLowerCase();
  if (!scope || scope === 'all') return;
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  conditions.push(
    scope === 'history'
      ? Prisma.sql`notification."createdAt" < ${oneDayAgo}`
      : Prisma.sql`notification."createdAt" >= ${oneDayAgo}`,
  );
}

export function normalizeAdminNotificationFailureProvider(value: string | undefined) {
  const normalized = normalizeQueryValue(value)?.toUpperCase();
  return normalized && isSafeNotificationFilterValue(normalized, 80) ? normalized : null;
}

export function normalizeAdminNotificationFailureCode(value: string | undefined) {
  const normalized = normalizeQueryValue(value);
  return normalized && isSafeNotificationFilterValue(normalized, 160) ? normalized : null;
}

function isSafeNotificationFilterValue(value: string, maxLength: number) {
  return value.length <= maxLength && !Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127;
  });
}

function normalizeFailureProvider(value: string | undefined) {
  const normalized = normalizeAdminNotificationFailureProvider(value);
  if (value && !normalized) throw new BadRequestException('Notification failure provider is invalid');
  return normalized;
}

function normalizeFailureCode(value: string | undefined) {
  const normalized = normalizeAdminNotificationFailureCode(value);
  if (value && !normalized) throw new BadRequestException('Notification failure code is invalid');
  return normalized;
}

function parseNotificationBoundary(value: string | undefined) {
  const normalized = normalizeQueryValue(value);
  if (!normalized) return null;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) {
    throw new BadRequestException('Notification date range is invalid');
  }
  return date;
}

function normalizeQueryValue(value: string | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function appendNotificationRecordFilters(
  conditions: Prisma.Sql[],
  options: AdminNotificationRetryQueryOptions,
) {
  const search = normalizeQueryValue(options.q);
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(Prisma.sql`(
      notification.id ILIKE ${pattern}
      OR notification."userId" ILIKE ${pattern}
      OR COALESCE(notification.data->>'bookingId', '') ILIKE ${pattern}
      OR EXISTS (
        SELECT 1 FROM "User" recipient
        LEFT JOIN "ProviderProfile" partner ON partner."userId" = recipient.id
        WHERE recipient.id = notification."userId"
          AND (COALESCE(recipient."fullName", '') ILIKE ${pattern} OR COALESCE(partner."displayName", '') ILIKE ${pattern})
      )
    )`);
  }
  const recipientRole = normalizeQueryValue(options.recipientRole)?.toUpperCase();
  if (['CUSTOMER', 'PROVIDER', 'ADMIN'].includes(recipientRole ?? '')) {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "User" recipient
      WHERE recipient.id = notification."userId"
        AND ${recipientRole}::"Role" = ANY(recipient.roles)
    )`);
  }
  const channel = normalizeQueryValue(options.channel)?.toUpperCase();
  if (channel === 'FCM' || channel === 'IN_APP_ONLY') {
    conditions.push(Prisma.sql`EXISTS (
      SELECT 1 FROM "NotificationDelivery" channel_delivery
      WHERE channel_delivery."notificationId" = notification.id
        AND channel_delivery.provider::text = ${channel}
    )`);
  }
}
