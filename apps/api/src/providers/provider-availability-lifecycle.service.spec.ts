import {
  ProviderAvailabilityIntent,
  ProviderAvailabilityReason,
  ProviderStatus,
} from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { ProviderAvailabilityLifecycleService } from './provider-availability-lifecycle.service';

describe('ProviderAvailabilityLifecycleService', () => {
  it('marks a selected Partner busy and mirrors the status to Redis', async () => {
    const now = new Date('2026-07-20T03:00:00.000Z');
    const prisma = {
      providerProfile: {
        update: vi.fn().mockResolvedValue({ id: 'partner-1', status: ProviderStatus.ONLINE_BUSY }),
      },
    };
    const redisState = { setProviderStatus: vi.fn() };
    const service = new ProviderAvailabilityLifecycleService(prisma as never, redisState as never);

    await expect(service.markBusy('partner-1', now)).resolves.toBe(ProviderStatus.ONLINE_BUSY);

    expect(prisma.providerProfile.update).toHaveBeenCalledWith({
      where: { id: 'partner-1' },
      data: {
        availabilityChangedAt: now,
        availabilityReason: ProviderAvailabilityReason.ACTIVE_BOOKING,
        status: ProviderStatus.ONLINE_BUSY,
      },
      select: { id: true, status: true },
    });
    expect(redisState.setProviderStatus).toHaveBeenCalledWith(
      'partner-1',
      ProviderStatus.ONLINE_BUSY,
    );
  });

  it('returns an available intent to ready after its active booking closes', async () => {
    const now = new Date('2026-07-20T03:00:00.000Z');
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'partner-1',
          availabilityIntent: ProviderAvailabilityIntent.AVAILABLE,
          currentLocationUpdatedAt: now,
          sessions: [],
          workingHoursTimezone: 'Asia/Ho_Chi_Minh',
          workingHours: [],
          selectedBookings: [],
          user: {
            appSessions: [],
            appUsageDailyAggregates: [],
            createdAt: new Date('2026-07-01T00:00:00.000Z'),
          },
        }),
        update: vi.fn().mockResolvedValue({
          id: 'partner-1',
          status: ProviderStatus.ONLINE_AVAILABLE,
        }),
      },
    };
    const redisState = { setProviderStatus: vi.fn() };
    const service = new ProviderAvailabilityLifecycleService(prisma as never, redisState as never);

    await expect(service.reconcile('partner-1', now)).resolves.toBe(
      ProviderStatus.ONLINE_AVAILABLE,
    );

    expect(prisma.providerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availabilityIntent: ProviderAvailabilityIntent.AVAILABLE,
          availabilityReason: ProviderAvailabilityReason.MANUAL_AVAILABLE,
          status: ProviderStatus.ONLINE_AVAILABLE,
        }),
      }),
    );
    expect(redisState.setProviderStatus).toHaveBeenCalledWith(
      'partner-1',
      ProviderStatus.ONLINE_AVAILABLE,
    );
  });
});
