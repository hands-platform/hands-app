import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { resolveMatchingPolicy } from '../matching/matching.policy';

const PROVIDER_LOCATION_TTL_SECONDS = 60 * 10;
const OTP_TTL_SECONDS = 60 * 5;

@Injectable()
export class RedisStateService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly activeMatchingTtlSeconds: number;

  constructor(config: ConfigService) {
    this.activeMatchingTtlSeconds = resolveMatchingPolicy(config).providerResponseWindowMinutes * 60;
    this.redis = new Redis(config.get<string>('REDIS_URL') ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }

  async ping() {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }
    return this.redis.ping();
  }

  setProviderStatus(providerId: string, status: string) {
    return this.redis.hset('providers:status', providerId, status);
  }

  getProviderStatus(providerId: string) {
    return this.redis.hget('providers:status', providerId);
  }

  async setProviderLocation(providerId: string, location: { lat: number; lng: number; recordedAt?: string }) {
    await this.redis.set(
      `provider:${providerId}:location`,
      JSON.stringify({ ...location, recordedAt: location.recordedAt ?? new Date().toISOString() }),
      'EX',
      PROVIDER_LOCATION_TTL_SECONDS,
    );
  }

  async openMatching(bookingId: string, payload: unknown, ttlSeconds = this.activeMatchingTtlSeconds) {
    await this.redis.set(
      `matching:${bookingId}`,
      JSON.stringify(payload),
      'EX',
      ttlSeconds,
    );
    await this.redis.sadd('matching:active', bookingId);
  }

  async closeMatching(bookingId: string) {
    await this.redis.del(`matching:${bookingId}`);
    await this.redis.srem('matching:active', bookingId);
  }

  async addParticipant(bookingId: string, providerId: string, ttlSeconds = this.activeMatchingTtlSeconds) {
    await this.redis.sadd(`matching:${bookingId}:participants`, providerId);
    await this.redis.expire(`matching:${bookingId}:participants`, ttlSeconds);
  }

  async setOtp(phone: string, otp: string) {
    await this.redis.set(`auth:otp:${phone}`, otp, 'EX', OTP_TTL_SECONDS);
  }

  getOtp(phone: string) {
    return this.redis.get(`auth:otp:${phone}`);
  }

  consumeOtp(phone: string) {
    return this.redis.del(`auth:otp:${phone}`);
  }
}
