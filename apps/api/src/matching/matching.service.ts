import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import { BOOKING_TIMEOUT_QUEUE_NAME, bookingTimeoutJob } from './booking-timeout.queue';
import type { BookingMatchSource, MatchingPolicy } from './matching.policy';
import {
  MATCHING_BACKUP_OPEN_MODE_KEY,
  MATCHING_PREFERRED_ACCEPT_MODE_KEY,
  MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER,
  resolveMatchingPolicy,
  resolveMatchingPolicyFromPayload,
} from './matching.policy';

@Injectable()
export class MatchingService {
  constructor(
    private readonly redisState: RedisStateService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue(BOOKING_TIMEOUT_QUEUE_NAME) private readonly bookingTimeoutQueue: Queue,
  ) {}

  async getPolicy() {
    const settings = await this.prisma.operationalPolicySetting.findMany({
      where: {
        OR: [
          { category: { in: ['Matching', 'Booking'] } },
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
      matchingPolicy: matchingPolicySnapshot(policy),
      input,
    };
  }

  async scheduleBookingTimeout(bookingId: string, expiresAt: Date) {
    const job = bookingTimeoutJob(bookingId, expiresAt);
    await this.bookingTimeoutQueue.add(job.name, job.data, job.options);
  }

  async registerActiveBooking(bookingId: string, payload: unknown) {
    const policy = resolveMatchingPolicyFromPayload(payload) ?? (await this.getPolicy());
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

  selectFinalProvider(
    bookingId: string,
    booking: unknown,
    matchSource: BookingMatchSource = MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER,
  ) {
    return {
      bookingId,
      booking,
      event: 'booking.matched',
      status: 'MATCHED',
      matchSource,
      finalSelection:
        matchSource === MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER ? 'CUSTOMER_SELECTED' : 'FIRST_PICK_ACCEPTED',
    };
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

function matchingPolicySnapshot(policy: MatchingPolicy) {
  return {
    sort: ['distance', 'availability'],
    travelBufferMinutes: policy.travelBufferMinutes,
    earlyAcceptWindowMinutes: policy.providerResponseWindowMinutes,
    preferredProviderResponseWindowMinutes: policy.providerResponseWindowMinutes,
    marketplaceRadiusMeters: policy.backupProviderRadiusMeters,
    marketplaceLocationMaxAgeMinutes: policy.backupProviderLocationMaxAgeMinutes,
    marketplaceInvitationLimit: policy.backupProviderInvitationLimit,
    marketplaceOpenMode: policy.backupOpenMode,
    backupProviderRadiusMeters: policy.backupProviderRadiusMeters,
    backupProviderLocationMaxAgeMinutes: policy.backupProviderLocationMaxAgeMinutes,
    backupProviderInvitationLimit: policy.backupProviderInvitationLimit,
    bookingMaxCustomerCurrentToAddressKm: policy.bookingMaxCustomerCurrentToAddressKm,
    bookingMaxPreferredProviderDistanceKm: policy.bookingMaxPreferredProviderDistanceKm,
    bookingCurrentLocationFreshnessMinutes: policy.bookingCurrentLocationFreshnessMinutes,
    bookingDistanceGateEnabled: policy.bookingDistanceGateEnabled,
    bookingServiceAreaRequired: policy.bookingServiceAreaRequired,
    preferredAcceptMode: policy.preferredAcceptMode,
    backupOpenMode: policy.backupOpenMode,
    finalSelection: 'CUSTOMER_SELECTS_PARTNER',
  };
}
