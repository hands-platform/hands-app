import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PROVIDER_LOCATION_TTL_SECONDS, ProviderCachedLocation } from '../locations/location-update-policy';
import { resolveMatchingPolicy } from '../matching/matching.policy';

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

  async getProviderLocation(providerId: string): Promise<ProviderCachedLocation | null> {
    const raw = await this.redis.get(`provider:${providerId}:location`);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as Partial<ProviderCachedLocation>;
      const lat = Number(parsed.lat);
      const lng = Number(parsed.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }
      return { lat, lng, recordedAt: parsed.recordedAt ?? null };
    } catch {
      return null;
    }
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

  async revokeRefreshToken(tokenHash: string, ttlSeconds: number) {
    await this.redis.set(`auth:refresh:revoked:${tokenHash}`, '1', 'EX', Math.max(1, Math.trunc(ttlSeconds)));
  }

  async consumeRefreshToken(tokenHash: string, ttlSeconds: number) {
    const result = await this.redis.set(
      `auth:refresh:revoked:${tokenHash}`,
      '1',
      'EX',
      Math.max(1, Math.trunc(ttlSeconds)),
      'NX',
    );
    return result === 'OK';
  }
}
