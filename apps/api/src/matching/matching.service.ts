import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { RedisStateService } from '../redis/redis-state.service';
import { resolveMatchingPolicy } from './matching.policy';

@Injectable()
export class MatchingService {
  constructor(
    private readonly redisState: RedisStateService,
    private readonly config: ConfigService,
    @InjectQueue('booking-timeouts') private readonly bookingTimeoutQueue: Queue,
  ) {}

  getPolicy() {
    return resolveMatchingPolicy(this.config);
  }

  openBooking(input: { booking?: unknown; payload?: unknown }) {
    const policy = this.getPolicy();
    return {
      id: getRecordId(input.booking) ?? 'dev-booking-id',
      status: 'OPEN_MATCHING',
      matchingPolicy: {
        sort: ['distance', 'availability'],
        travelBufferMinutes: policy.travelBufferMinutes,
        earlyAcceptWindowMinutes: policy.providerResponseWindowMinutes,
        preferredProviderResponseWindowMinutes: policy.providerResponseWindowMinutes,
        backupProviderRadiusMeters: policy.backupProviderRadiusMeters,
        finalSelection: 'CUSTOMER_SELECTS_PROVIDER',
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
    await this.redisState.openMatching(bookingId, payload);
  }

  async registerParticipant(bookingId: string, providerId: string) {
    await this.redisState.addParticipant(bookingId, providerId);
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
