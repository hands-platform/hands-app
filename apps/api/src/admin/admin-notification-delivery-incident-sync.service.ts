import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import {
  NOTIFICATION_DELIVERY_INCIDENT_SYNC_GROUP_LIMIT,
  syncNotificationDeliveryIncidents,
} from './admin-notification-delivery-incident';

const DEFAULT_INTERVAL_MS = 5 * 60_000;
const MIN_INTERVAL_MS = 60_000;
const MAX_INTERVAL_MS = 60 * 60_000;
const MAX_GROUP_LIMIT = 50;
const SYNC_LEASE_NAME = 'notification-delivery-incident-sync-v1';
const SYNC_LEASE_SECONDS = 5 * 60;

@Injectable()
export class AdminNotificationDeliveryIncidentSyncService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AdminNotificationDeliveryIncidentSyncService.name);
  private readonly enabled: boolean;
  private readonly groupLimit: number;
  private readonly intervalMs: number;
  private inFlight: Promise<void> | undefined;
  private running = false;
  private stopping = false;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redisState: RedisStateService,
  ) {
    this.enabled = notificationDeliveryIncidentSyncEnabled(
      config.get<string>('NOTIFICATION_DELIVERY_INCIDENT_SYNC_ENABLED'),
    );
    this.groupLimit = notificationDeliveryIncidentSyncGroupLimit(
      config.get<string>('NOTIFICATION_DELIVERY_INCIDENT_SYNC_GROUP_LIMIT'),
    );
    this.intervalMs = notificationDeliveryIncidentSyncIntervalMs(
      config.get<string>('NOTIFICATION_DELIVERY_INCIDENT_SYNC_INTERVAL_MS'),
    );
  }

  onModuleInit() {
    if (!this.enabled) return;
    this.timer = setInterval(() => void this.startScheduledSync(), this.intervalMs);
    this.timer.unref();
    void this.startScheduledSync();
  }

  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearInterval(this.timer);
    await this.inFlight;
  }

  async syncBatch(now = new Date()) {
    if (this.running) return { skipped: true } as const;
    this.running = true;
    try {
      return {
        ...(await syncNotificationDeliveryIncidents(
          this.prisma,
          { groupLimit: this.groupLimit, includeSynthetic: false },
          now,
        )),
        skipped: false,
      } as const;
    } finally {
      this.running = false;
    }
  }

  private async runScheduledSync() {
    let leaseToken: string | null = null;
    try {
      leaseToken = await this.redisState.tryAcquireLease(SYNC_LEASE_NAME, SYNC_LEASE_SECONDS);
      if (!leaseToken) return;
      const result = await this.syncBatch();
      if (result.skipped) return;
      const changed = result.created + result.updated;
      if (changed > 0) {
        this.logger.log(
          `Notification delivery incidents synced: discovered=${result.discovered} created=${result.created} updated=${result.updated} unchanged=${result.unchanged} raceSkipped=${result.raceSkipped} lockedSkipped=${result.lockedSkipped} failed=${result.failed}`,
        );
      } else if (result.failed > 0) {
        this.logger.warn(
          `Notification delivery incident sync completed with failures: discovered=${result.discovered} failed=${result.failed}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Notification delivery incident sync failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      if (leaseToken) {
        await this.redisState.releaseLease(SYNC_LEASE_NAME, leaseToken).catch((error) => {
          this.logger.warn(
            `Notification delivery incident sync lease release failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }
    }
  }

  private async startScheduledSync() {
    if (this.stopping || this.inFlight) return;
    const inFlight = this.runScheduledSync();
    this.inFlight = inFlight;
    try {
      await inFlight;
    } finally {
      if (this.inFlight === inFlight) this.inFlight = undefined;
    }
  }
}

export function notificationDeliveryIncidentSyncEnabled(value?: string) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === 'true') return true;
  if (normalized === 'false') return false;
  throw new Error('NOTIFICATION_DELIVERY_INCIDENT_SYNC_ENABLED must be true or false');
}

export function notificationDeliveryIncidentSyncGroupLimit(value?: string) {
  return boundedInteger(
    value,
    NOTIFICATION_DELIVERY_INCIDENT_SYNC_GROUP_LIMIT,
    1,
    MAX_GROUP_LIMIT,
    'NOTIFICATION_DELIVERY_INCIDENT_SYNC_GROUP_LIMIT',
  );
}

export function notificationDeliveryIncidentSyncIntervalMs(value?: string) {
  return boundedInteger(
    value,
    DEFAULT_INTERVAL_MS,
    MIN_INTERVAL_MS,
    MAX_INTERVAL_MS,
    'NOTIFICATION_DELIVERY_INCIDENT_SYNC_INTERVAL_MS',
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
