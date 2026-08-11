import { describe, expect, it } from 'vitest';

import {
  adminNotificationDataScopeWhere,
  adminNotificationProductionDataWhere,
  normalizeAdminNotificationDataScope,
} from './admin-notification-production-data';

describe('admin notification production data', () => {
  it('requires an explicit production scope and excludes fixture markers', () => {
    expect(adminNotificationProductionDataWhere()).toEqual({
      AND: [
        { data: { path: ['dataScope'], equals: 'production' } },
        {
          NOT: {
            OR: [
              { data: { path: ['dataScope'], equals: 'synthetic' } },
              { data: { path: ['smokeFixture'], equals: true } },
              { data: { path: ['smoke'], equals: true } },
              { data: { path: ['fixture'], equals: true } },
            ],
          },
        },
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
    const production = {
      AND: [
        { data: { path: ['dataScope'], equals: 'production' } },
        { NOT: synthetic },
      ],
    };

    expect(adminNotificationDataScopeWhere('synthetic')).toEqual(synthetic);
    expect(adminNotificationDataScopeWhere('unknown')).toEqual({
      AND: [
        { NOT: production },
        { NOT: synthetic },
      ],
    });
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
