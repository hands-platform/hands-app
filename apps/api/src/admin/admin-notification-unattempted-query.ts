import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  LEGACY_CUSTOMER_NOTIFICATION_TYPES,
  LEGACY_PROVIDER_NOTIFICATION_TYPES,
} from '../notifications/notification-target-role';
import {
  adminNotificationDataScopeSql,
  adminNotificationPushIntentSql,
} from './admin-notification-production-data';
import { adminQueueAgeDateWhere, adminQueueSortDirection } from './admin-queue-list';

export const ADMIN_NOTIFICATION_DELIVERY_GAP_MINUTES = 15;

export type AdminNotificationUnattemptedQueryOptions = {
  readonly age?: string;
  readonly booking?: string;
  readonly from?: string;
  readonly sort?: string;
  readonly to?: string;
  readonly user?: string;
  readonly q?: string;
  readonly recipientRole?: string;
  readonly channel?: string;
  readonly scope?: string;
  readonly dataScope?: string;
};

export type AdminNotificationUnattemptedDisposition =
  | 'awaiting-worker'
  | 'delivery-gap'
  | 'no-push-path'
  | 'unattempted';

export type AdminNotificationUnattemptedPageRow = {
  readonly id: string;
};

export type AdminNotificationUnattemptedCountRow = {
  readonly count: number;
};

export type AdminNotificationUnattemptedSummaryRow = {
  readonly awaitingWorker: number;
  readonly deliveryGaps: number;
  readonly noPushPath: number;
  readonly noPushPathNotificationCount: number;
  readonly noPushPathRecipientCount: number;
  readonly unattempted: number;
};

export type AdminNotificationRouteGroupPageRow = {
  readonly firstOccurredAt: Date;
  readonly id: string;
  readonly latestOccurredAt: Date;
  readonly notificationCount: number;
  readonly targetRole: string;
  readonly userId: string;
};

export function adminNotificationRouteGroupPageQuery(
  options: AdminNotificationUnattemptedQueryOptions,
  take: number,
  skip: number,
  now = new Date(),
) {
  const direction = adminQueueSortDirection(options.sort) === 'asc'
    ? Prisma.sql`ASC`
    : Prisma.sql`DESC`;

  return Prisma.sql`
    WITH no_push_path_notifications AS (
      ${adminNotificationUnattemptedFilteredSql(options, 'no-push-path', now)}
    ), grouped AS (
      SELECT
        no_push_path_notifications."userId",
        no_push_path_notifications."targetRole",
        (ARRAY_AGG(
          no_push_path_notifications.id
          ORDER BY no_push_path_notifications."createdAt" DESC, no_push_path_notifications.id DESC
        ))[1] AS id,
        MIN(no_push_path_notifications."createdAt") AS "firstOccurredAt",
        MAX(no_push_path_notifications."createdAt") AS "latestOccurredAt",
        COUNT(*)::integer AS "notificationCount"
      FROM no_push_path_notifications
      GROUP BY no_push_path_notifications."userId", no_push_path_notifications."targetRole"
    )
    SELECT *
    FROM grouped
    ORDER BY grouped."firstOccurredAt" ${direction}, grouped.id ${direction}
    LIMIT ${take}
    OFFSET ${skip}
  `;
}

export function adminNotificationRouteGroupCountQuery(
  options: AdminNotificationUnattemptedQueryOptions,
  now = new Date(),
) {
  return Prisma.sql`
    WITH no_push_path_notifications AS (
      ${adminNotificationUnattemptedFilteredSql(options, 'no-push-path', now)}
    )
    SELECT COUNT(*)::integer AS count
    FROM (
      SELECT 1
      FROM no_push_path_notifications
      GROUP BY no_push_path_notifications."userId", no_push_path_notifications."targetRole"
    ) recipient_routes
  `;
}

export function adminNotificationUnattemptedPageQuery(
  options: AdminNotificationUnattemptedQueryOptions,
  disposition: AdminNotificationUnattemptedDisposition,
  take: number,
  skip: number,
  now = new Date(),
) {
  const direction = adminQueueSortDirection(options.sort) === 'asc'
    ? Prisma.sql`ASC`
    : Prisma.sql`DESC`;

  return Prisma.sql`
    WITH unattempted_notifications AS (
      ${adminNotificationUnattemptedFilteredSql(options, disposition, now)}
    )
    SELECT unattempted_notifications.id
    FROM unattempted_notifications
    ORDER BY
      unattempted_notifications."createdAt" ${direction},
      unattempted_notifications.id ${direction}
    LIMIT ${take}
    OFFSET ${skip}
  `;
}

export function adminNotificationUnattemptedCountQuery(
  options: AdminNotificationUnattemptedQueryOptions,
  disposition: AdminNotificationUnattemptedDisposition,
  now = new Date(),
) {
  return Prisma.sql`
    WITH unattempted_notifications AS (
      ${adminNotificationUnattemptedFilteredSql(options, disposition, now)}
    )
    SELECT COUNT(*)::integer AS count
    FROM unattempted_notifications
  `;
}

export function adminNotificationUnattemptedSummaryQuery(
  options: AdminNotificationUnattemptedQueryOptions,
  now = new Date(),
) {
  const cutoff = new Date(
    now.getTime() - ADMIN_NOTIFICATION_DELIVERY_GAP_MINUTES * 60 * 1000,
  );
  return Prisma.sql`
    WITH unattempted_notifications AS (
      ${adminNotificationUnattemptedFilteredSql(options, 'unattempted', now)}
    ), no_push_path_notifications AS (
      ${adminNotificationUnattemptedFilteredSql(options, 'no-push-path', now)}
    )
    SELECT
      COUNT(*)::integer AS unattempted,
      COUNT(*) FILTER (
        WHERE "hasEnabledTargetDevice" AND "createdAt" <= ${cutoff}
      )::integer AS "deliveryGaps",
      COUNT(*) FILTER (
        WHERE "hasEnabledTargetDevice" AND "createdAt" > ${cutoff}
      )::integer AS "awaitingWorker",
      (SELECT COUNT(*)::integer FROM no_push_path_notifications) AS "noPushPath",
      (SELECT COUNT(*)::integer FROM no_push_path_notifications) AS "noPushPathNotificationCount",
      (
        SELECT COUNT(*)::integer
        FROM (
          SELECT 1
          FROM no_push_path_notifications
          GROUP BY "userId", "targetRole"
        ) recipient_routes
      ) AS "noPushPathRecipientCount"
    FROM unattempted_notifications
  `;
}

function adminNotificationUnattemptedFilteredSql(
  options: AdminNotificationUnattemptedQueryOptions,
  disposition: AdminNotificationUnattemptedDisposition,
  now: Date,
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
  appendNotificationActionScope(conditions, options.scope, now);

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
  const cutoff = new Date(
    now.getTime() - ADMIN_NOTIFICATION_DELIVERY_GAP_MINUTES * 60 * 1000,
  );
  const dispositionWhere =
    disposition === 'delivery-gap'
      ? Prisma.sql`
          unattempted."hasEnabledTargetDevice"
          AND unattempted."createdAt" <= ${cutoff}
        `
      : disposition === 'awaiting-worker'
        ? Prisma.sql`
            unattempted."hasEnabledTargetDevice"
            AND unattempted."createdAt" > ${cutoff}
          `
        : disposition === 'no-push-path'
          ? Prisma.sql`
              NOT unattempted."hasEnabledTargetDevice"
              AND NOT unattempted."isFullySuccessful"
            `
          : Prisma.sql`TRUE`;

  return Prisma.sql`
    WITH unattempted AS (
      SELECT
        notification.id,
        notification."userId",
        notification."createdAt",
        COALESCE(
          notification.data->>'targetRole',
          CASE
            WHEN notification.type IN (${Prisma.join([...LEGACY_CUSTOMER_NOTIFICATION_TYPES])})
              THEN 'CUSTOMER'
            WHEN notification.type IN (${Prisma.join([...LEGACY_PROVIDER_NOTIFICATION_TYPES])})
              THEN 'PROVIDER'
            ELSE 'UNKNOWN'
          END
        ) AS "targetRole",
        EXISTS (
          SELECT 1
          FROM "PushDevice" device
          WHERE device."userId" = notification."userId"
            AND device.enabled = TRUE
            AND (
              COALESCE(
                notification.data->>'targetRole',
                CASE
                  WHEN notification.type IN (${Prisma.join([...LEGACY_CUSTOMER_NOTIFICATION_TYPES])})
                    THEN 'CUSTOMER'
                  WHEN notification.type IN (${Prisma.join([...LEGACY_PROVIDER_NOTIFICATION_TYPES])})
                    THEN 'PROVIDER'
                  ELSE NULL
                END
              ) IS NULL
              OR device.role::text = COALESCE(
                notification.data->>'targetRole',
                CASE
                  WHEN notification.type IN (${Prisma.join([...LEGACY_CUSTOMER_NOTIFICATION_TYPES])})
                    THEN 'CUSTOMER'
                  WHEN notification.type IN (${Prisma.join([...LEGACY_PROVIDER_NOTIFICATION_TYPES])})
                    THEN 'PROVIDER'
                  ELSE NULL
                END
              )
            )
        ) AS "hasEnabledTargetDevice",
        EXISTS (
          SELECT 1
          FROM (
            SELECT DISTINCT ON (delivery."pushDeviceId") delivery.status
            FROM "NotificationDelivery" delivery
            WHERE delivery."notificationId" = notification.id
            ORDER BY delivery."pushDeviceId", delivery."attemptedAt" DESC, delivery.id DESC
          ) latest
          WHERE latest.status IN ('SENT', 'DELIVERED', 'SUCCESS')
        )
        AND NOT EXISTS (
          SELECT 1
          FROM (
            SELECT DISTINCT ON (delivery."pushDeviceId") delivery.status
            FROM "NotificationDelivery" delivery
            WHERE delivery."notificationId" = notification.id
            ORDER BY delivery."pushDeviceId", delivery."attemptedAt" DESC, delivery.id DESC
          ) latest
          WHERE latest.status NOT IN ('SENT', 'DELIVERED', 'SUCCESS')
        ) AS "isFullySuccessful"
      FROM "Notification" notification
      WHERE ${disposition === 'no-push-path'
        ? Prisma.sql`TRUE`
        : Prisma.sql`NOT EXISTS (
            SELECT 1
            FROM "NotificationDelivery" delivery
            WHERE delivery."notificationId" = notification.id
          )`}
      ${where}
    )
    SELECT
      unattempted.id,
      unattempted."userId",
      unattempted."createdAt",
      unattempted."targetRole",
      unattempted."hasEnabledTargetDevice",
      unattempted."isFullySuccessful"
    FROM unattempted
    WHERE ${dispositionWhere}
  `;
}

function appendNotificationActionScope(
  conditions: Prisma.Sql[],
  value: string | undefined,
  now: Date,
) {
  const scope = normalizeQueryValue(value)?.toLowerCase();
  if (!scope) return;
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (scope === 'all') return;
  if (scope === 'history') {
    conditions.push(Prisma.sql`notification."createdAt" < ${oneDayAgo}`);
    return;
  }
  if (scope === '15-60m') {
    conditions.push(Prisma.sql`notification."createdAt" >= ${oneHourAgo}`);
    return;
  }
  if (scope === '1-24h') {
    conditions.push(Prisma.sql`notification."createdAt" >= ${oneDayAgo}`);
    conditions.push(Prisma.sql`notification."createdAt" < ${oneHourAgo}`);
    return;
  }
  conditions.push(Prisma.sql`notification."createdAt" >= ${oneDayAgo}`);
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
  options: AdminNotificationUnattemptedQueryOptions,
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
  if (normalizeQueryValue(options.channel)) {
    conditions.push(Prisma.sql`FALSE`);
  }
}
