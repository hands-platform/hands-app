import { BadRequestException } from '@nestjs/common';
import { AppUsageEventType, AppUsageOrigin, Role } from '@prisma/client';

import { UsersService } from './users.service';

describe('UsersService app usage events', () => {
  const authenticatedCustomer = {
    id: 'user-1',
    roles: [Role.CUSTOMER],
  };

  it('records a session start once while preserving the AppSession response', async () => {
    const now = new Date('2026-07-18T10:00:00.000Z');
    vi.useFakeTimers().setSystemTime(now);
    const session = { id: 'session-1', userId: 'user-1' };
    const transaction = {
      appSession: { upsert: vi.fn().mockResolvedValue(session) },
      appUsageDailyAggregate: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: vi.fn().mockResolvedValue({ id: 'daily-1' }),
      },
      appUsageEvent: {
        create: vi.fn().mockResolvedValue({ id: 'event-1' }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new UsersService(prisma as never);

    await expect(
      service.recordAppSession(authenticatedCustomer, {
        role: Role.CUSTOMER,
        deviceId: 'device-1',
        eventType: AppUsageEventType.SESSION_START,
        clientEventId: 'session-start-1',
      }),
    ).resolves.toBe(session);

    expect(transaction.appUsageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        clientEventId: 'session-start-1',
        deviceId: 'device-1',
        eventType: AppUsageEventType.SESSION_START,
        occurredAt: now,
        origin: AppUsageOrigin.PRODUCTION,
        role: Role.CUSTOMER,
        userId: 'user-1',
      }),
      select: { id: true },
    });
    expect(transaction.appUsageDailyAggregate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          sessionStartCount: 1,
          totalEventCount: 1,
          userId: 'user-1',
        }),
      }),
    );
    expect(transaction.appUsageDailyAggregate.updateMany).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('ignores a client-supplied origin and records the authenticated event as production', async () => {
    const transaction = {
      appSession: { upsert: vi.fn().mockResolvedValue({ id: 'session-1' }) },
      appUsageDailyAggregate: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: vi.fn().mockResolvedValue({ id: 'daily-1' }),
      },
      appUsageEvent: {
        create: vi.fn().mockResolvedValue({ id: 'event-1' }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new UsersService(prisma as never);

    await service.recordAppSession(authenticatedCustomer, {
      clientEventId: 'origin-spoof-1',
      deviceId: 'device-1',
      eventType: AppUsageEventType.APP_OPEN,
      origin: AppUsageOrigin.SYNTHETIC,
      role: Role.CUSTOMER,
    } as never);

    expect(transaction.appUsageEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ origin: AppUsageOrigin.PRODUCTION }),
      select: { id: true },
    });
    expect(transaction.appUsageDailyAggregate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ origin: AppUsageOrigin.PRODUCTION }),
      }),
    );
  });

  it('does not duplicate an app usage event when the client retries the same event id', async () => {
    const transaction = {
      appSession: { upsert: vi.fn().mockResolvedValue({ id: 'session-1' }) },
      appUsageDailyAggregate: { updateMany: vi.fn(), upsert: vi.fn() },
      appUsageEvent: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          eventType: AppUsageEventType.APP_OPEN,
          userId: 'user-1',
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new UsersService(prisma as never);

    await service.recordAppSession(authenticatedCustomer, {
      deviceId: 'device-1',
      eventType: AppUsageEventType.APP_OPEN,
      clientEventId: 'app-open-1',
    });

    expect(transaction.appUsageEvent.create).not.toHaveBeenCalled();
    expect(transaction.appUsageDailyAggregate.upsert).not.toHaveBeenCalled();
    expect(transaction.appSession.upsert).toHaveBeenCalledOnce();
  });

  it('keeps legacy heartbeat calls event-free', async () => {
    const transaction = {
      appSession: { upsert: vi.fn().mockResolvedValue({ id: 'session-1' }) },
      appUsageDailyAggregate: { updateMany: vi.fn(), upsert: vi.fn() },
      appUsageEvent: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new UsersService(prisma as never);

    await service.recordAppSession(authenticatedCustomer, { deviceId: 'device-1' });

    expect(transaction.appUsageEvent.findUnique).not.toHaveBeenCalled();
    expect(transaction.appUsageEvent.create).not.toHaveBeenCalled();
  });

  it('preserves the first customer marketing attribution on later app opens', async () => {
    const transaction = {
      appSession: {
        findUnique: vi.fn().mockResolvedValue({
          metadata: {
            marketingAttribution: {
              source: 'google',
              campaignId: 'first-touch',
              capturedAt: '2026-07-20T01:00:00.000Z',
            },
          },
        }),
        upsert: vi.fn().mockResolvedValue({ id: 'session-1' }),
      },
      appUsageDailyAggregate: { updateMany: vi.fn(), upsert: vi.fn() },
      appUsageEvent: {
        create: vi.fn(),
        findUnique: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new UsersService(prisma as never);

    await service.recordAppSession(authenticatedCustomer, {
      deviceId: 'device-1',
      metadata: {
        marketingAttribution: {
          source: 'tiktok',
          campaignId: 'later-touch',
          capturedAt: '2026-07-23T01:00:00.000Z',
        },
      },
    });

    expect(transaction.appSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          metadata: {
            marketingAttribution: {
              source: 'google',
              campaignId: 'first-touch',
              capturedAt: '2026-07-20T01:00:00.000Z',
            },
          },
        }),
      }),
    );
  });

  it('rejects a client event id already assigned to another user or event type', async () => {
    const transaction = {
      appSession: { upsert: vi.fn().mockResolvedValue({ id: 'session-1' }) },
      appUsageDailyAggregate: { updateMany: vi.fn(), upsert: vi.fn() },
      appUsageEvent: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          eventType: AppUsageEventType.PROVIDER_PROFILE_VIEW,
          userId: 'user-2',
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new UsersService(prisma as never);

    await expect(
      service.recordAppSession(authenticatedCustomer, {
        deviceId: 'device-1',
        eventType: AppUsageEventType.APP_OPEN,
        clientEventId: 'event-collision',
      }),
    ).rejects.toThrow(new BadRequestException('clientEventId is already assigned to another app event'));

    expect(transaction.appUsageEvent.create).not.toHaveBeenCalled();
  });
});
