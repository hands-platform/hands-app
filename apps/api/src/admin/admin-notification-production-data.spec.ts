import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  adminNotificationDataScopeValueSql,
  adminNotificationDataScopeWhere,
  adminNotificationPushIntentSql,
  adminNotificationProductionDataWhere,
  normalizeAdminNotificationDataScope,
} from './admin-notification-production-data';

describe('admin notification production data', () => {
  it('requires an explicit production scope and excludes fixture markers', () => {
    expect(adminNotificationProductionDataWhere()).toEqual({
      AND: [
        { data: { path: ['dataScope'], equals: 'production' } },
        notificationNonSyntheticWhere(),
      ],
    });
  });

  it('keeps synthetic and unknown records in explicit, non-overlapping scopes', () => {
    const synthetic = {
      OR: [
        { data: { path: ['dataScope'], equals: 'synthetic' } },
        { data: { path: ['smokeFixture'], equals: true } },
        { data: { path: ['smoke'], equals: true } },
        { data: { path: ['fixture'], equals: true } },
      ],
    };
    expect(adminNotificationDataScopeWhere('synthetic')).toEqual(synthetic);
    expect(adminNotificationDataScopeWhere('unknown')).toEqual({
      AND: [
        {
          OR: [
            { data: { path: ['dataScope'], equals: Prisma.AnyNull } },
            {
              AND: [
                notificationJsonValueIsNot(['dataScope'], 'production'),
                notificationJsonValueIsNot(['dataScope'], 'synthetic'),
              ],
            },
          ],
        },
        notificationNonSyntheticWhere(),
      ],
    });
  });

  it('classifies every row into one canonical SQL scope', () => {
    const sql = adminNotificationDataScopeValueSql().strings.join(' ');

    expect(sql).toContain("THEN 'synthetic'");
    expect(sql).toContain("THEN 'production'");
    expect(sql).toContain("ELSE 'unknown'");
    expect(sql).toContain("data->>'smokeFixture'");
  });

  it('requires declared push intent or actual legacy push-delivery evidence', () => {
    const sql = adminNotificationPushIntentSql().strings.join(' ');

    expect(sql).toContain("IN ('PUSH', 'PUSH_AND_IN_APP')");
    expect(sql).toContain("NOT IN (\n        'IN_APP_ONLY', 'PUSH', 'PUSH_AND_IN_APP'");
    expect(sql).toContain('FROM "NotificationDelivery" push_intent_delivery');
    expect(sql).toContain("<> 'IN_APP_ONLY'");
  });

  it('normalizes supported scopes and rejects unsupported values', () => {
    expect(normalizeAdminNotificationDataScope(undefined)).toBe('production');
    expect(normalizeAdminNotificationDataScope(' Synthetic ')).toBe('synthetic');
    expect(normalizeAdminNotificationDataScope('unknown')).toBe('unknown');
    expect(() => normalizeAdminNotificationDataScope('all')).toThrow(
      'Notification data scope is invalid',
    );
  });
});

function notificationNonSyntheticWhere() {
  return {
    AND: [
      notificationJsonValueIsNot(['dataScope'], 'synthetic'),
      notificationJsonValueIsNot(['smokeFixture'], true),
      notificationJsonValueIsNot(['smoke'], true),
      notificationJsonValueIsNot(['fixture'], true),
    ],
  };
}

function notificationJsonValueIsNot(path: string[], value: string | boolean) {
  return {
    OR: [
      { data: { path, equals: Prisma.AnyNull } },
      { NOT: { data: { path, equals: value } } },
    ],
  };
}
