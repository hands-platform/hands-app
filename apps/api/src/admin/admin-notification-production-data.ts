import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export type AdminNotificationDataScope = 'production' | 'synthetic' | 'unknown';

export function adminNotificationDataScopeSql(
  value: string | undefined,
  notification = Prisma.sql`notification`,
) {
  const scope = normalizeAdminNotificationDataScope(value);
  const synthetic = adminNotificationSyntheticDataSql(notification);
  const production = Prisma.sql`
    LOWER(COALESCE(${notification}.data->>'dataScope', '')) = 'production'
    AND NOT (${synthetic})
  `;

  if (scope === 'synthetic') return synthetic;
  if (scope === 'unknown') {
    return Prisma.sql`NOT (${production}) AND NOT (${synthetic})`;
  }
  return production;
}

export function adminNotificationDataScopeWhere(
  value: string | undefined,
): Prisma.NotificationWhereInput {
  const scope = normalizeAdminNotificationDataScope(value);
  const syntheticWhere = adminNotificationSyntheticDataWhere();
  const nonSyntheticWhere = adminNotificationNonSyntheticDataWhere();
  const productionWhere: Prisma.NotificationWhereInput = {
    AND: [
      { data: { path: ['dataScope'], equals: 'production' } },
      nonSyntheticWhere,
    ],
  };

  if (scope === 'synthetic') return syntheticWhere;
  if (scope === 'unknown') {
    return {
      AND: [
        {
          OR: [
            { data: { path: ['dataScope'], equals: Prisma.AnyNull } },
            {
              AND: [
                adminNotificationJsonValueIsNot({ path: ['dataScope'], equals: 'production' }),
                adminNotificationJsonValueIsNot({ path: ['dataScope'], equals: 'synthetic' }),
              ],
            },
          ],
        },
        nonSyntheticWhere,
      ],
    };
  }
  return productionWhere;
}

export function adminNotificationPushIntentSql(
  notification = Prisma.sql`notification`,
) {
  return Prisma.sql`(
    UPPER(COALESCE(${notification}.data->>'deliveryIntent', '')) IN ('PUSH', 'PUSH_AND_IN_APP')
    OR (
      UPPER(COALESCE(${notification}.data->>'deliveryIntent', '')) NOT IN (
        'IN_APP_ONLY', 'PUSH', 'PUSH_AND_IN_APP'
      )
      AND EXISTS (
        SELECT 1
        FROM "NotificationDelivery" push_intent_delivery
        WHERE push_intent_delivery."notificationId" = ${notification}.id
          AND UPPER(push_intent_delivery.provider::text) <> 'IN_APP_ONLY'
      )
    )
  )`;
}

export function adminNotificationProductionDataSql(notification = Prisma.sql`notification`) {
  return adminNotificationDataScopeSql('production', notification);
}

export function adminNotificationProductionDataWhere(): Prisma.NotificationWhereInput {
  return adminNotificationDataScopeWhere('production');
}

export function normalizeAdminNotificationDataScope(
  value: string | undefined,
): AdminNotificationDataScope {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === 'production') return 'production';
  if (normalized === 'synthetic' || normalized === 'unknown') return normalized;
  throw new BadRequestException('Notification data scope is invalid');
}

function adminNotificationSyntheticDataSql(notification: Prisma.Sql) {
  return Prisma.sql`(
    LOWER(COALESCE(${notification}.data->>'dataScope', '')) = 'synthetic'
    OR LOWER(COALESCE(${notification}.data->>'smokeFixture', 'false')) = 'true'
    OR LOWER(COALESCE(${notification}.data->>'smoke', 'false')) = 'true'
    OR LOWER(COALESCE(${notification}.data->>'fixture', 'false')) = 'true'
  )`;
}

function adminNotificationSyntheticDataWhere(): Prisma.NotificationWhereInput {
  return {
    OR: [
      { data: { path: ['dataScope'], equals: 'synthetic' } },
      { data: { path: ['smokeFixture'], equals: true } },
      { data: { path: ['smoke'], equals: true } },
      { data: { path: ['fixture'], equals: true } },
    ],
  };
}

function adminNotificationNonSyntheticDataWhere(): Prisma.NotificationWhereInput {
  return {
    AND: [
      adminNotificationJsonValueIsNot({ path: ['dataScope'], equals: 'synthetic' }),
      adminNotificationJsonValueIsNot({ path: ['smokeFixture'], equals: true }),
      adminNotificationJsonValueIsNot({ path: ['smoke'], equals: true }),
      adminNotificationJsonValueIsNot({ path: ['fixture'], equals: true }),
    ],
  };
}

function adminNotificationJsonValueIsNot(
  filter: Prisma.JsonNullableFilterBase<'Notification'>,
): Prisma.NotificationWhereInput {
  return {
    OR: [
      { data: { path: filter.path, equals: Prisma.AnyNull } },
      { NOT: { data: filter } },
    ],
  };
}
