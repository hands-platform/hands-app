import {
  ProviderAvailabilityIntent,
  ProviderAvailabilityReason,
  ProviderStatus,
} from '@prisma/client';
import {
  ProviderAvailabilityReconciliationService,
  providerAvailabilityReconciliationBatchSize,
  providerAvailabilityReconciliationEnabled,
  providerAvailabilityReconciliationIntervalMs,
} from './provider-availability-reconciliation.service';

describe('ProviderAvailabilityReconciliationService', () => {
  it('moves an available Partner offline outside the saved working window', async () => {
    const provider = providerFixture();
    const prisma = prismaFixture([provider], 1);
    const redisState = { setProviderStatus: vi.fn().mockResolvedValue(undefined) };
    const service = reconciliationService(prisma, redisState);
    const now = new Date('2026-07-20T13:30:00.000Z');

    const result = await service.reconcileBatch(now);

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { id: 'asc' },
        take: 100,
      }),
    );
    expect(prisma.providerProfile.updateMany).toHaveBeenCalledWith({
      where: {
        id: provider.id,
        status: ProviderStatus.ONLINE_AVAILABLE,
        availabilityIntent: ProviderAvailabilityIntent.AVAILABLE,
        availabilityReason: ProviderAvailabilityReason.MANUAL_AVAILABLE,
        availabilityChangedAt: provider.availabilityChangedAt,
      },
      data: {
        status: ProviderStatus.OFFLINE,
        availabilityIntent: ProviderAvailabilityIntent.AVAILABLE,
        availabilityReason: ProviderAvailabilityReason.OUTSIDE_WORKING_HOURS,
        availabilityChangedAt: now,
      },
    });
    expect(redisState.setProviderStatus).toHaveBeenCalledWith(
      provider.id,
      ProviderStatus.OFFLINE,
    );
    expect(result).toEqual({ processed: 1, raceSkipped: 0, skipped: false, updated: 1 });
  });

  it('turns a Partner off at exactly seven days without app activity', async () => {
    const now = new Date('2026-07-20T03:00:00.000Z');
    const provider = providerFixture({
      availabilityChangedAt: new Date('2026-07-13T03:00:00.000Z'),
      currentLocationUpdatedAt: null,
      user: {
        appUsageDailyAggregates: [{ lastOccurredAt: new Date('2026-07-13T03:00:00.000Z') }],
      },
      workingHours: [],
    });
    const prisma = prismaFixture([provider], 1);
    const redisState = { setProviderStatus: vi.fn().mockResolvedValue(undefined) };
    const service = reconciliationService(prisma, redisState);

    await service.reconcileBatch(now);

    expect(prisma.providerProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availabilityIntent: ProviderAvailabilityIntent.OFFLINE,
          availabilityReason: ProviderAvailabilityReason.INACTIVE_7D,
          status: ProviderStatus.OFFLINE,
        }),
      }),
    );
    expect(redisState.setProviderStatus).toHaveBeenCalledWith(
      provider.id,
      ProviderStatus.OFFLINE,
    );
  });

  it('turns a never-tracked Partner off seven days after account creation', async () => {
    const now = new Date('2026-07-20T03:00:00.000Z');
    const provider = providerFixture({
      availabilityChangedAt: new Date('2026-07-13T03:00:00.000Z'),
      currentLocationUpdatedAt: null,
      sessions: [],
      user: {
        appSessions: [],
        appUsageDailyAggregates: [],
        createdAt: new Date('2026-07-13T03:00:00.000Z'),
      },
      workingHours: [],
    });
    const prisma = prismaFixture([provider], 1);
    const redisState = { setProviderStatus: vi.fn().mockResolvedValue(undefined) };
    const service = reconciliationService(prisma, redisState);

    await service.reconcileBatch(now);

    expect(prisma.providerProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availabilityIntent: ProviderAvailabilityIntent.OFFLINE,
          availabilityReason: ProviderAvailabilityReason.INACTIVE_7D,
          status: ProviderStatus.OFFLINE,
        }),
      }),
    );
  });

  it('keeps a Partner available when a recent legacy Partner session proves app activity', async () => {
    const now = new Date('2026-07-20T03:00:00.000Z');
    const provider = providerFixture({
      currentLocationUpdatedAt: new Date('2026-07-10T03:00:00.000Z'),
      sessions: [{ lastSeenAt: new Date('2026-07-19T03:00:00.000Z') }],
      user: {
        appSessions: [],
        appUsageDailyAggregates: [],
        createdAt: new Date('2026-06-01T03:00:00.000Z'),
      },
      workingHours: [],
    });
    const prisma = prismaFixture([provider], 1);
    const redisState = { setProviderStatus: vi.fn().mockResolvedValue(undefined) };
    const service = reconciliationService(prisma, redisState);

    const result = await service.reconcileBatch(now);

    expect(prisma.providerProfile.updateMany).not.toHaveBeenCalled();
    expect(redisState.setProviderStatus).toHaveBeenCalledWith(
      provider.id,
      ProviderStatus.ONLINE_AVAILABLE,
    );
    expect(result.updated).toBe(0);
  });

  it('keeps a manually reactivated Partner available when older telemetry is stale', async () => {
    const now = new Date('2026-07-20T03:00:00.000Z');
    const provider = providerFixture({
      availabilityChangedAt: new Date('2026-07-20T02:59:00.000Z'),
      currentLocationUpdatedAt: new Date('2026-07-10T03:00:00.000Z'),
      sessions: [],
      user: {
        appSessions: [],
        appUsageDailyAggregates: [],
        createdAt: new Date('2026-06-01T03:00:00.000Z'),
      },
      workingHours: [],
    });
    const prisma = prismaFixture([provider], 1);
    const redisState = { setProviderStatus: vi.fn().mockResolvedValue(undefined) };
    const service = reconciliationService(prisma, redisState);

    const result = await service.reconcileBatch(now);

    expect(prisma.providerProfile.updateMany).not.toHaveBeenCalled();
    expect(redisState.setProviderStatus).toHaveBeenCalledWith(
      provider.id,
      ProviderStatus.ONLINE_AVAILABLE,
    );
    expect(result.updated).toBe(0);
  });

  it('does not overwrite Redis when a concurrent state change wins the DB race', async () => {
    const provider = providerFixture();
    const prisma = prismaFixture([provider], 0);
    const redisState = { setProviderStatus: vi.fn().mockResolvedValue(undefined) };
    const service = reconciliationService(prisma, redisState);

    const result = await service.reconcileBatch(new Date('2026-07-20T13:30:00.000Z'));

    expect(result.raceSkipped).toBe(1);
    expect(result.updated).toBe(0);
    expect(redisState.setProviderStatus).not.toHaveBeenCalled();
  });

  it('waits for the active reconciliation batch during module shutdown', async () => {
    let releaseFind: (value: unknown[]) => void = () => undefined;
    const findManyResult = new Promise<unknown[]>((resolve) => {
      releaseFind = resolve;
    });
    const prisma = prismaFixture([], 0);
    prisma.providerProfile.findMany.mockReturnValue(findManyResult);
    const service = reconciliationService(prisma, {
      setProviderStatus: vi.fn().mockResolvedValue(undefined),
    });

    service.onModuleInit();
    expect(prisma.providerProfile.findMany).toHaveBeenCalledOnce();
    let shutdownCompleted = false;
    const shutdown = service.onModuleDestroy().then(() => {
      shutdownCompleted = true;
    });
    await Promise.resolve();
    expect(shutdownCompleted).toBe(false);

    releaseFind([]);
    await shutdown;
    expect(shutdownCompleted).toBe(true);
  });
});

describe('provider availability reconciliation settings', () => {
  it('uses bounded operational defaults', () => {
    expect(providerAvailabilityReconciliationEnabled()).toBe(true);
    expect(providerAvailabilityReconciliationBatchSize()).toBe(100);
    expect(providerAvailabilityReconciliationIntervalMs()).toBe(60_000);
  });

  it('rejects unsafe or ambiguous values', () => {
    expect(() => providerAvailabilityReconciliationEnabled('yes')).toThrow('true or false');
    expect(() => providerAvailabilityReconciliationBatchSize('501')).toThrow('between 1 and 500');
    expect(() => providerAvailabilityReconciliationIntervalMs('1000')).toThrow(
      'between 30000 and 900000',
    );
  });
});

function reconciliationService(
  prisma: ReturnType<typeof prismaFixture>,
  redisState: { setProviderStatus: ReturnType<typeof vi.fn> },
) {
  return new ProviderAvailabilityReconciliationService(
    { get: vi.fn().mockReturnValue(undefined) } as never,
    prisma as never,
    redisState as never,
  );
}

function prismaFixture(providers: Array<ReturnType<typeof providerFixture>>, updateCount: number) {
  return {
    providerProfile: {
      findMany: vi.fn().mockResolvedValue(providers),
      updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
    },
  };
}

function providerFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 'partner-1',
    status: ProviderStatus.ONLINE_AVAILABLE,
    availabilityIntent: ProviderAvailabilityIntent.AVAILABLE,
    availabilityReason: ProviderAvailabilityReason.MANUAL_AVAILABLE,
    availabilityChangedAt: new Date('2026-07-19T00:00:00.000Z'),
    currentLocationUpdatedAt: new Date(),
    sessions: [],
    workingHoursTimezone: 'Asia/Ho_Chi_Minh',
    workingHours: Array.from({ length: 7 }, (_, index) => ({
      weekday: index + 1,
      enabled: index < 5,
      startMinute: 9 * 60,
      endMinute: 18 * 60,
    })),
    selectedBookings: [],
    user: {
      appSessions: [],
      appUsageDailyAggregates: [{ lastOccurredAt: new Date() }],
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    },
    ...overrides,
  };
}
