import { AppUsageEventType, AppUsageOrigin, Prisma, Role } from '@prisma/client';

export const APP_USAGE_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const DEFAULT_APP_USAGE_RAW_RETENTION_DAYS = 90;

type DailyAggregateInput = {
  eventType: AppUsageEventType;
  occurredAt: Date;
  origin: AppUsageOrigin;
  role: Role;
  userId: string;
};

export function appUsageDay(occurredAt: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: APP_USAGE_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(occurredAt);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return new Date(Date.UTC(value('year'), value('month') - 1, value('day')));
}

export function appUsageDailyAggregateUpsert(input: DailyAggregateInput) {
  const day = appUsageDay(input.occurredAt);
  const eventCounts = {
    appOpenCount: input.eventType === AppUsageEventType.APP_OPEN ? 1 : 0,
    providerProfileViewCount: input.eventType === AppUsageEventType.PROVIDER_PROFILE_VIEW ? 1 : 0,
    sessionStartCount: input.eventType === AppUsageEventType.SESSION_START ? 1 : 0,
  };
  const update = {
    totalEventCount: { increment: 1 },
    ...(eventCounts.appOpenCount ? { appOpenCount: { increment: 1 } } : {}),
    ...(eventCounts.providerProfileViewCount
      ? { providerProfileViewCount: { increment: 1 } }
      : {}),
    ...(eventCounts.sessionStartCount ? { sessionStartCount: { increment: 1 } } : {}),
  };

  return {
    create: {
      ...eventCounts,
      day,
      firstOccurredAt: input.occurredAt,
      lastOccurredAt: input.occurredAt,
      origin: input.origin,
      role: input.role,
      totalEventCount: 1,
      userId: input.userId,
    },
    update,
    where: {
      userId_role_day_origin: {
        day,
        origin: input.origin,
        role: input.role,
        userId: input.userId,
      },
    },
  };
}

export function appUsageDailyAggregateBoundsUpdates(
  input: DailyAggregateInput,
): Prisma.AppUsageDailyAggregateUpdateManyArgs[] {
  const key = {
    day: appUsageDay(input.occurredAt),
    origin: input.origin,
    role: input.role,
    userId: input.userId,
  };

  return [
    {
      data: { firstOccurredAt: input.occurredAt },
      where: { ...key, firstOccurredAt: { gt: input.occurredAt } },
    },
    {
      data: { lastOccurredAt: input.occurredAt },
      where: { ...key, lastOccurredAt: { lt: input.occurredAt } },
    },
  ];
}
