import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  LEGACY_CUSTOMER_NOTIFICATION_TYPES,
  LEGACY_PROVIDER_NOTIFICATION_TYPES,
} from '../notifications/notification-target-role';
import { adminNotificationDataScopeSql } from './admin-notification-production-data';
import { adminQueueAgeDateWhere, adminQueueSortDirection } from './admin-queue-list';

export const ADMIN_NOTIFICATION_STALE_DEVICE_AGE_DAYS = 30;

export type AdminNotificationDeviceHealthQueryOptions = {
  readonly age?: string;
  readonly booking?: string;
  readonly from?: string;
  readonly sort?: string;
  readonly to?: string;
  readonly user?: string;
  readonly dataScope?: string;
  readonly scope?: string;
};

export type AdminNotificationStaleRoutePageRow = { readonly id: string };
export type AdminNotificationStaleRouteCountRow = { readonly count: number };

export type AdminNotificationDeviceHealthSummaryRow = {
  readonly disabledDevices: number;
  readonly disabledDeviceUsers: number;
  readonly staleDevices: number;
  readonly staleDeviceUsers: number;
};

export function adminNotificationStaleRoutePageQuery(
  options: AdminNotificationDeviceHealthQueryOptions,
  take: number,
  skip: number,
  now = new Date(),
) {
  const direction = adminQueueSortDirection(options.sort) === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  return Prisma.sql`
    WITH stale_route_notifications AS (
      ${adminNotificationStaleRouteFilteredSql(options, now)}
    )
    SELECT id
    FROM stale_route_notifications
    ORDER BY "createdAt" ${direction}, id ${direction}
    LIMIT ${take}
    OFFSET ${skip}
  `;
}

export function adminNotificationStaleRouteCountQuery(
  options: AdminNotificationDeviceHealthQueryOptions,
  now = new Date(),
) {
  return Prisma.sql`
    WITH stale_route_notifications AS (
      ${adminNotificationStaleRouteFilteredSql(options, now)}
    )
    SELECT COUNT(*)::integer AS count
    FROM stale_route_notifications
  `;
}

export function adminNotificationDeviceHealthSummaryQuery(
  options: AdminNotificationDeviceHealthQueryOptions,
  now = new Date(),
) {
  const conditions: Prisma.Sql[] = [adminNotificationDataScopeSql(options.dataScope)];
  const from = parseNotificationBoundary(options.from);
  const to = parseNotificationBoundary(options.to);
  if (from && to && from.getTime() >= to.getTime()) {
    throw new BadRequestException('Notification date range is invalid');
  }
  if (from) conditions.push(Prisma.sql`notification."createdAt" >= ${from}`);
  if (to) conditions.push(Prisma.sql`notification."createdAt" < ${to}`);

  const booking = normalizeQueryValue(options.booking);
  if (booking) conditions.push(Prisma.sql`notification."data"->>'bookingId' = ${booking}`);
  const user = normalizeQueryValue(options.user);
  if (user) conditions.push(Prisma.sql`notification."userId" = ${user}`);

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
    ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
    : Prisma.empty;
  const staleCutoff = new Date(
    now.getTime() - ADMIN_NOTIFICATION_STALE_DEVICE_AGE_DAYS * 24 * 60 * 60 * 1000,
  );

  return Prisma.sql`
    WITH notification_targets AS (
      SELECT DISTINCT
        notification."userId",
        COALESCE(
          notification.data->>'targetRole',
          CASE
            WHEN notification.type IN (${Prisma.join([...LEGACY_CUSTOMER_NOTIFICATION_TYPES])})
              THEN 'CUSTOMER'
            WHEN notification.type IN (${Prisma.join([...LEGACY_PROVIDER_NOTIFICATION_TYPES])})
              THEN 'PROVIDER'
            ELSE NULL
          END
        ) AS "targetRole"
      FROM "Notification" notification
      ${where}
    ),
    relevant_devices AS (
      SELECT DISTINCT
        device.id,
        device."userId",
        device.enabled,
        device."lastSeenAt"
      FROM notification_targets target
      INNER JOIN "PushDevice" device
        ON device."userId" = target."userId"
       AND (
         target."targetRole" IS NULL
         OR device.role::text = target."targetRole"
       )
    )
    SELECT
      COUNT(DISTINCT id) FILTER (
        WHERE enabled = FALSE
      )::integer AS "disabledDevices",
      COUNT(DISTINCT "userId") FILTER (
        WHERE enabled = FALSE
      )::integer AS "disabledDeviceUsers",
      COUNT(DISTINCT id) FILTER (
        WHERE enabled = TRUE AND "lastSeenAt" <= ${staleCutoff}
      )::integer AS "staleDevices",
      COUNT(DISTINCT "userId") FILTER (
        WHERE enabled = TRUE AND "lastSeenAt" <= ${staleCutoff}
      )::integer AS "staleDeviceUsers"
    FROM relevant_devices
  `;
}

function adminNotificationStaleRouteFilteredSql(
  options: AdminNotificationDeviceHealthQueryOptions,
  now: Date,
) {
  const conditions = notificationDeviceHealthConditions(options);
  const staleCutoff = new Date(
    now.getTime() - ADMIN_NOTIFICATION_STALE_DEVICE_AGE_DAYS * 24 * 60 * 60 * 1000,
  );
  return Prisma.sql`
    SELECT notification.id, notification."createdAt"
    FROM "Notification" notification
    WHERE ${Prisma.join(conditions, ' AND ')}
      AND EXISTS (
        SELECT 1
        FROM "PushDevice" device
        WHERE device."userId" = notification."userId"
          AND device.enabled = TRUE
          AND device."lastSeenAt" <= ${staleCutoff}
          AND (
            COALESCE(
              notification.data->>'targetRole',
              CASE
                WHEN notification.type IN (${Prisma.join([...LEGACY_CUSTOMER_NOTIFICATION_TYPES])}) THEN 'CUSTOMER'
                WHEN notification.type IN (${Prisma.join([...LEGACY_PROVIDER_NOTIFICATION_TYPES])}) THEN 'PROVIDER'
                ELSE NULL
              END
            ) IS NULL
            OR device.role::text = COALESCE(
              notification.data->>'targetRole',
              CASE
                WHEN notification.type IN (${Prisma.join([...LEGACY_CUSTOMER_NOTIFICATION_TYPES])}) THEN 'CUSTOMER'
                WHEN notification.type IN (${Prisma.join([...LEGACY_PROVIDER_NOTIFICATION_TYPES])}) THEN 'PROVIDER'
                ELSE NULL
              END
            )
          )
      )
      AND NOT (
        EXISTS (
          SELECT 1 FROM "NotificationDelivery" accepted
          WHERE accepted."notificationId" = notification.id
            AND accepted.status IN ('SENT', 'DELIVERED', 'SUCCESS')
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
        )
      )
  `;
}

function notificationDeviceHealthConditions(options: AdminNotificationDeviceHealthQueryOptions) {
  const conditions: Prisma.Sql[] = [adminNotificationDataScopeSql(options.dataScope)];
  const from = parseNotificationBoundary(options.from);
  const to = parseNotificationBoundary(options.to);
  if (from && to && from.getTime() >= to.getTime()) {
    throw new BadRequestException('Notification date range is invalid');
  }
  if (from) conditions.push(Prisma.sql`notification."createdAt" >= ${from}`);
  if (to) conditions.push(Prisma.sql`notification."createdAt" < ${to}`);
  appendNotificationDeviceHealthScope(conditions, options.scope);
  const booking = normalizeQueryValue(options.booking);
  if (booking) conditions.push(Prisma.sql`notification.data->>'bookingId' = ${booking}`);
  const user = normalizeQueryValue(options.user);
  if (user) conditions.push(Prisma.sql`notification."userId" = ${user}`);
  const ageWhere = adminQueueAgeDateWhere(options.age);
  if (ageWhere?.gte instanceof Date) conditions.push(Prisma.sql`notification."createdAt" >= ${ageWhere.gte}`);
  if (ageWhere?.gt instanceof Date) conditions.push(Prisma.sql`notification."createdAt" > ${ageWhere.gt}`);
  if (ageWhere?.lte instanceof Date) conditions.push(Prisma.sql`notification."createdAt" <= ${ageWhere.lte}`);
  if (ageWhere?.lt instanceof Date) conditions.push(Prisma.sql`notification."createdAt" < ${ageWhere.lt}`);
  return conditions;
}

function appendNotificationDeviceHealthScope(
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
