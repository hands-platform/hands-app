import { AppUsageEventType, AppUsageOrigin, Role } from '@prisma/client';

import {
  appUsageDailyAggregateBoundsUpdates,
  appUsageDailyAggregateUpsert,
  appUsageDay,
} from './app-usage-daily-aggregate';

describe('app usage daily aggregate', () => {
  it('uses the Vietnam calendar day around UTC midnight', () => {
    expect(appUsageDay(new Date('2026-07-18T18:30:00.000Z'))).toEqual(
      new Date('2026-07-19T00:00:00.000Z'),
    );
  });

  it('increments only the matching event counter and the total', () => {
    const occurredAt = new Date('2026-07-18T10:00:00.000Z');

    expect(
      appUsageDailyAggregateUpsert({
        eventType: AppUsageEventType.PROVIDER_PROFILE_VIEW,
        occurredAt,
        origin: AppUsageOrigin.PRODUCTION,
        role: Role.CUSTOMER,
        userId: 'customer-user-1',
      }),
    ).toEqual({
      create: {
        appOpenCount: 0,
        day: new Date('2026-07-18T00:00:00.000Z'),
        firstOccurredAt: occurredAt,
        lastOccurredAt: occurredAt,
        origin: AppUsageOrigin.PRODUCTION,
        providerProfileViewCount: 1,
        role: Role.CUSTOMER,
        sessionStartCount: 0,
        totalEventCount: 1,
        userId: 'customer-user-1',
      },
      update: {
        providerProfileViewCount: { increment: 1 },
        totalEventCount: { increment: 1 },
      },
      where: {
        userId_role_day_origin: {
          day: new Date('2026-07-18T00:00:00.000Z'),
          origin: AppUsageOrigin.PRODUCTION,
          role: Role.CUSTOMER,
          userId: 'customer-user-1',
        },
      },
    });
    expect(
      appUsageDailyAggregateBoundsUpdates({
        eventType: AppUsageEventType.PROVIDER_PROFILE_VIEW,
        occurredAt,
        origin: AppUsageOrigin.PRODUCTION,
        role: Role.CUSTOMER,
        userId: 'customer-user-1',
      }),
    ).toEqual([
      {
        data: { firstOccurredAt: occurredAt },
        where: expect.objectContaining({
          firstOccurredAt: { gt: occurredAt },
          origin: AppUsageOrigin.PRODUCTION,
        }),
      },
      {
        data: { lastOccurredAt: occurredAt },
        where: expect.objectContaining({
          lastOccurredAt: { lt: occurredAt },
          origin: AppUsageOrigin.PRODUCTION,
        }),
      },
    ]);
  });

  it('keeps production and synthetic events in separate daily aggregates', () => {
    const input = {
      eventType: AppUsageEventType.APP_OPEN,
      occurredAt: new Date('2026-07-18T10:00:00.000Z'),
      role: Role.CUSTOMER,
      userId: 'customer-user-1',
    };

    const production = appUsageDailyAggregateUpsert({ ...input, origin: AppUsageOrigin.PRODUCTION });
    const synthetic = appUsageDailyAggregateUpsert({ ...input, origin: AppUsageOrigin.SYNTHETIC });

    expect(production.where.userId_role_day_origin.origin).toBe(AppUsageOrigin.PRODUCTION);
    expect(synthetic.where.userId_role_day_origin.origin).toBe(AppUsageOrigin.SYNTHETIC);
    expect(production.where).not.toEqual(synthetic.where);
  });
});
