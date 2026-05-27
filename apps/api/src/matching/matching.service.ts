import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import {
  MATCHING_BACKUP_OPEN_MODE_KEY,
  MATCHING_PREFERRED_ACCEPT_MODE_KEY,
  resolveMatchingPolicy,
} from './matching.policy';

@Injectable()
export class MatchingService {
  constructor(
    private readonly redisState: RedisStateService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue('booking-timeouts') private readonly bookingTimeoutQueue: Queue,
  ) {}

  async getPolicy() {
    const settings = await this.prisma.operationalPolicySetting.findMany({
      where: {
        OR: [
          { category: { in: ['Matching'] } },
          { key: { in: [MATCHING_PREFERRED_ACCEPT_MODE_KEY, MATCHING_BACKUP_OPEN_MODE_KEY] } },
        ],
      },
      select: { key: true, value: true },
    });
    return resolveMatchingPolicy(
      this.config,
      Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
    );
  }

  openBooking(input: {
    booking?: unknown;
    payload?: unknown;
    policy?: Awaited<ReturnType<MatchingService['getPolicy']>>;
  }) {
    const policy = input.policy ?? resolveMatchingPolicy(this.config);
    return {
      id: getRecordId(input.booking) ?? 'dev-booking-id',
      status: 'OPEN_MATCHING',
      matchingPolicy: {
        sort: ['distance', 'availability'],
        travelBufferMinutes: policy.travelBufferMinutes,
        earlyAcceptWindowMinutes: policy.providerResponseWindowMinutes,
        preferredProviderResponseWindowMinutes: policy.providerResponseWindowMinutes,
        backupProviderRadiusMeters: policy.backupProviderRadiusMeters,
        backupProviderLocationMaxAgeMinutes: policy.backupProviderLocationMaxAgeMinutes,
        backupProviderInvitationLimit: policy.backupProviderInvitationLimit,
        preferredAcceptMode: policy.preferredAcceptMode,
        backupOpenMode: policy.backupOpenMode,
        finalSelection: 'CUSTOMER_SELECTS_PARTNER',
      },
      input,
    };
  }

  async scheduleBookingTimeout(bookingId: string, expiresAt: Date) {
    const delay = Math.max(expiresAt.getTime() - Date.now(), 0);
    await this.bookingTimeoutQueue.add(
      'booking-timeout',
      { bookingId },
      {
        delay,
        jobId: `booking-timeout-${bookingId}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async registerActiveBooking(bookingId: string, payload: unknown) {
    const policy = getPolicyFromPayload(payload) ?? (await this.getPolicy());
    await this.redisState.openMatching(bookingId, payload, policy.providerResponseWindowMinutes * 60);
  }

  async registerParticipant(
    bookingId: string,
    providerId: string,
    policy?: Awaited<ReturnType<MatchingService['getPolicy']>>,
  ) {
    policy ??= await this.getPolicy();
    await this.redisState.addParticipant(bookingId, providerId, policy.providerResponseWindowMinutes * 60);
  }

  async closeBooking(bookingId: string) {
    await this.redisState.closeMatching(bookingId);
  }

  joinBooking(bookingId: string, participant: unknown) {
    return { bookingId, participant, event: 'provider.joined' };
  }

  selectFinalProvider(bookingId: string, booking: unknown) {
    return { bookingId, booking, status: 'MATCHED', finalSelection: 'CUSTOMER_SELECTED' };
  }

  completeBooking(bookingId: string, booking: unknown) {
    return { bookingId, booking, status: 'COMPLETED' };
  }
}

function getRecordId(value: unknown) {
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') {
    return value.id;
  }
  return undefined;
}

function getPolicyFromPayload(
  payload: unknown,
): Awaited<ReturnType<MatchingService['getPolicy']>> | undefined {
  if (!payload || typeof payload !== 'object' || !('matchingPolicy' in payload)) {
    return undefined;
  }
  const policy = payload.matchingPolicy;
  if (!policy || typeof policy !== 'object') {
    return undefined;
  }
  const providerResponseWindowMinutes = Number(
    'preferredProviderResponseWindowMinutes' in policy
      ? policy.preferredProviderResponseWindowMinutes
      : 'providerResponseWindowMinutes' in policy
        ? policy.providerResponseWindowMinutes
        : undefined,
  );
  const backupProviderRadiusMeters = Number(
    'backupProviderRadiusMeters' in policy ? policy.backupProviderRadiusMeters : undefined,
  );
  const travelBufferMinutes = Number(
    'travelBufferMinutes' in policy ? policy.travelBufferMinutes : undefined,
  );
  const backupProviderLocationMaxAgeMinutes = Number(
    'backupProviderLocationMaxAgeMinutes' in policy
      ? policy.backupProviderLocationMaxAgeMinutes
      : undefined,
  );
  const backupProviderInvitationLimit = Number(
    'backupProviderInvitationLimit' in policy ? policy.backupProviderInvitationLimit : undefined,
  );
  const preferredAcceptMode =
    'preferredAcceptMode' in policy && typeof policy.preferredAcceptMode === 'string'
      ? policy.preferredAcceptMode
      : undefined;
  const backupOpenMode =
    'backupOpenMode' in policy && typeof policy.backupOpenMode === 'string'
      ? policy.backupOpenMode
      : undefined;

  if (
    !Number.isFinite(providerResponseWindowMinutes) ||
    !Number.isFinite(backupProviderRadiusMeters) ||
    !Number.isFinite(travelBufferMinutes) ||
    !Number.isFinite(backupProviderLocationMaxAgeMinutes) ||
    !Number.isFinite(backupProviderInvitationLimit) ||
    !preferredAcceptMode ||
    !backupOpenMode
  ) {
    return undefined;
  }

  return {
    providerResponseWindowMinutes,
    backupProviderRadiusMeters,
    backupProviderLocationMaxAgeMinutes,
    backupProviderInvitationLimit,
    travelBufferMinutes,
    preferredAcceptMode,
    backupOpenMode,
  } as Awaited<ReturnType<MatchingService['getPolicy']>>;
}
