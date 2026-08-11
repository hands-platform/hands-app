import { Injectable } from '@nestjs/common';
import { ProviderAvailabilityReason, ProviderStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import {
  ACTIVE_PROVIDER_AVAILABILITY_BOOKING_STATUSES,
  providerLastAppActivityAt,
  resolveProviderAvailability,
} from './provider-availability';

@Injectable()
export class ProviderAvailabilityLifecycleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisState: RedisStateService,
  ) {}

  async markBusy(providerProfileId: string, now = new Date()) {
    const updated = await this.prisma.providerProfile.update({
      where: { id: providerProfileId },
      data: {
        availabilityChangedAt: now,
        availabilityReason: ProviderAvailabilityReason.ACTIVE_BOOKING,
        status: ProviderStatus.ONLINE_BUSY,
      },
      select: { id: true, status: true },
    });
    await this.redisState.setProviderStatus(updated.id, updated.status);
    return updated.status;
  }

  async reconcile(providerProfileId: string, now = new Date()) {
    const provider = await this.prisma.providerProfile.findUnique({
      where: { id: providerProfileId },
      select: {
        id: true,
        availabilityChangedAt: true,
        availabilityIntent: true,
        availabilityReason: true,
        currentLocationUpdatedAt: true,
        sessions: {
          orderBy: { lastSeenAt: 'desc' },
          select: { lastSeenAt: true },
          take: 1,
        },
        workingHoursTimezone: true,
        workingHours: {
          orderBy: { weekday: 'asc' },
          select: { weekday: true, enabled: true, startMinute: true, endMinute: true },
        },
        selectedBookings: {
          where: { status: { in: [...ACTIVE_PROVIDER_AVAILABILITY_BOOKING_STATUSES] } },
          select: { id: true },
          take: 1,
        },
        user: {
          select: {
            createdAt: true,
            appSessions: {
              where: { role: Role.PROVIDER },
              orderBy: { lastSeenAt: 'desc' },
              select: { lastSeenAt: true },
              take: 1,
            },
            appUsageDailyAggregates: {
              where: { role: Role.PROVIDER },
              orderBy: { lastOccurredAt: 'desc' },
              select: { lastOccurredAt: true },
              take: 1,
            },
          },
        },
      },
    });
    if (!provider) return null;

    const resolution = resolveProviderAvailability({
      activeBookingCount: provider.selectedBookings.length,
      availabilityIntent: provider.availabilityIntent,
      lastAppActivityAt: providerLastAppActivityAt({
        appSessionLastSeenAt: provider.user.appSessions?.[0]?.lastSeenAt,
        currentLocationUpdatedAt: provider.currentLocationUpdatedAt,
        explicitAvailabilityChangedAt:
          provider.availabilityReason === ProviderAvailabilityReason.MANUAL_AVAILABLE ||
          provider.availabilityReason === ProviderAvailabilityReason.MANUAL_OFFLINE ||
          provider.availabilityReason === ProviderAvailabilityReason.ACTIVE_BOOKING
            ? provider.availabilityChangedAt
            : null,
        providerSessionLastSeenAt: provider.sessions?.[0]?.lastSeenAt,
        usageLastOccurredAt: provider.user.appUsageDailyAggregates[0]?.lastOccurredAt,
        userCreatedAt: provider.user.createdAt,
      }),
      now,
      timezone: provider.workingHoursTimezone,
      workingHours: provider.workingHours,
    });
    const updated = await this.prisma.providerProfile.update({
      where: { id: provider.id },
      data: {
        availabilityChangedAt: now,
        availabilityIntent: resolution.availabilityIntent,
        availabilityReason: resolution.availabilityReason,
        status: resolution.status,
      },
      select: { id: true, status: true },
    });
    await this.redisState.setProviderStatus(updated.id, updated.status);
    return updated.status;
  }
}
