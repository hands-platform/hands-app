import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderAvailabilityReason, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import {
  ACTIVE_PROVIDER_AVAILABILITY_BOOKING_STATUSES,
  providerLastAppActivityAt,
  resolveProviderAvailability,
} from './provider-availability';

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 30_000;
const MAX_INTERVAL_MS = 15 * 60_000;
const MAX_BATCH_SIZE = 500;

@Injectable()
export class ProviderAvailabilityReconciliationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ProviderAvailabilityReconciliationService.name);
  private readonly batchSize: number;
  private readonly enabled: boolean;
  private readonly intervalMs: number;
  private cursor: string | undefined;
  private inFlight: Promise<void> | undefined;
  private running = false;
  private stopping = false;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisState: RedisStateService,
  ) {
    this.enabled = providerAvailabilityReconciliationEnabled(
      config.get<string>('PROVIDER_AVAILABILITY_RECONCILIATION_ENABLED'),
    );
    this.batchSize = providerAvailabilityReconciliationBatchSize(
      config.get<string>('PROVIDER_AVAILABILITY_RECONCILIATION_BATCH_SIZE'),
    );
    this.intervalMs = providerAvailabilityReconciliationIntervalMs(
      config.get<string>('PROVIDER_AVAILABILITY_RECONCILIATION_INTERVAL_MS'),
    );
  }

  onModuleInit() {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.startScheduledBatch(), this.intervalMs);
    this.timer.unref();
    void this.startScheduledBatch();
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }

  async reconcileBatch(now = new Date()) {
    if (this.running) {
      return { processed: 0, raceSkipped: 0, skipped: true, updated: 0 };
    }

    this.running = true;
    try {
      const providers = await this.prisma.providerProfile.findMany({
        where: {
          deletedAt: null,
          ...(this.cursor ? { id: { gt: this.cursor } } : {}),
        },
        orderBy: { id: 'asc' },
        take: this.batchSize,
        select: {
          id: true,
          status: true,
          availabilityIntent: true,
          availabilityReason: true,
          availabilityChangedAt: true,
          currentLocationUpdatedAt: true,
          sessions: {
            orderBy: { lastSeenAt: 'desc' },
            select: { lastSeenAt: true },
            take: 1,
          },
          workingHoursTimezone: true,
          workingHours: {
            orderBy: { weekday: 'asc' },
            select: {
              weekday: true,
              enabled: true,
              startMinute: true,
              endMinute: true,
            },
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

      let raceSkipped = 0;
      let updated = 0;
      for (const provider of providers) {
        const resolution = resolveProviderAvailability({
          activeBookingCount: provider.selectedBookings.length,
          availabilityIntent: provider.availabilityIntent,
          lastAppActivityAt: providerLastAppActivityAt({
            appSessionLastSeenAt: provider.user.appSessions?.[0]?.lastSeenAt,
            currentLocationUpdatedAt: provider.currentLocationUpdatedAt,
            explicitAvailabilityChangedAt:
              provider.availabilityReason === ProviderAvailabilityReason.MANUAL_AVAILABLE ||
              provider.availabilityReason === ProviderAvailabilityReason.MANUAL_OFFLINE
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
        const changed =
          provider.status !== resolution.status ||
          provider.availabilityIntent !== resolution.availabilityIntent ||
          provider.availabilityReason !== resolution.availabilityReason;

        if (changed) {
          const result = await this.prisma.providerProfile.updateMany({
            where: {
              id: provider.id,
              status: provider.status,
              availabilityIntent: provider.availabilityIntent,
              availabilityReason: provider.availabilityReason,
              availabilityChangedAt: provider.availabilityChangedAt,
            },
            data: {
              status: resolution.status,
              availabilityIntent: resolution.availabilityIntent,
              availabilityReason: resolution.availabilityReason,
              availabilityChangedAt: now,
            },
          });
          if (result.count !== 1) {
            raceSkipped += 1;
            continue;
          }
          updated += 1;
        }

        await this.redisState.setProviderStatus(provider.id, resolution.status);
      }

      this.cursor =
        providers.length === this.batchSize ? providers[providers.length - 1]?.id : undefined;
      return {
        processed: providers.length,
        raceSkipped,
        skipped: false,
        updated,
      };
    } finally {
      this.running = false;
    }
  }

  private async runScheduledBatch() {
    try {
      const result = await this.reconcileBatch();
      if (result.updated || result.raceSkipped) {
        this.logger.log(
          `Partner availability reconciled: processed=${result.processed} updated=${result.updated} raceSkipped=${result.raceSkipped}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Partner availability reconciliation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async startScheduledBatch() {
    if (this.stopping || this.inFlight) return;
    const inFlight = this.runScheduledBatch();
    this.inFlight = inFlight;
    try {
      await inFlight;
    } finally {
      if (this.inFlight === inFlight) this.inFlight = undefined;
    }
  }
}

export function providerAvailabilityReconciliationEnabled(value?: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error('PROVIDER_AVAILABILITY_RECONCILIATION_ENABLED must be true or false');
}

export function providerAvailabilityReconciliationBatchSize(value?: string) {
  return boundedInteger(
    value,
    DEFAULT_BATCH_SIZE,
    1,
    MAX_BATCH_SIZE,
    'PROVIDER_AVAILABILITY_RECONCILIATION_BATCH_SIZE',
  );
}

export function providerAvailabilityReconciliationIntervalMs(value?: string) {
  return boundedInteger(
    value,
    DEFAULT_INTERVAL_MS,
    MIN_INTERVAL_MS,
    MAX_INTERVAL_MS,
    'PROVIDER_AVAILABILITY_RECONCILIATION_INTERVAL_MS',
  );
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  name: string,
) {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}
