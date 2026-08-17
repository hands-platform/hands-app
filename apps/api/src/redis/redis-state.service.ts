import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PROVIDER_LOCATION_TTL_SECONDS, ProviderCachedLocation } from '../locations/location-update-policy';
import { resolveMatchingPolicy } from '../matching/matching.policy';

const OTP_TTL_SECONDS = 60 * 5;
const OTP_SEND_COOLDOWN_SECONDS = 60;
const ADMIN_MFA_TOTP_REPLAY_TTL_SECONDS = 90;
const ADMIN_SOCKET_REVOCATION_CHANNEL = 'admin:socket-auth:revocations';

export type AdminSocketRevocation = {
  id: string;
  scope: 'mobile-family' | 'session' | 'user';
};

@Injectable()
export class RedisStateService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly subscriber: Redis;
  private readonly activeMatchingTtlSeconds: number;
  private readonly adminSocketRevocationListeners = new Set<(event: AdminSocketRevocation) => void>();
  private readonly adminSocketRevocationUnavailableListeners = new Set<() => void>();
  private adminSocketRevocationSubscribed = false;

  constructor(config: ConfigService) {
    this.activeMatchingTtlSeconds = resolveMatchingPolicy(config).providerResponseWindowMinutes * 60;
    const redisUrl = config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
    const options = {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    } as const;
    this.redis = new Redis(redisUrl, options);
    this.subscriber = new Redis(redisUrl, options);
    this.subscriber.on('message', (channel, raw) => {
      if (channel !== ADMIN_SOCKET_REVOCATION_CHANNEL) return;
      const event = parseAdminSocketRevocation(raw);
      if (!event) return;
      for (const listener of this.adminSocketRevocationListeners) listener(event);
    });
    this.subscriber.on('close', () => {
      if (!this.adminSocketRevocationSubscribed) return;
      this.adminSocketRevocationSubscribed = false;
      for (const listener of this.adminSocketRevocationUnavailableListeners) listener();
    });
  }

  async onModuleDestroy() {
    await Promise.allSettled([this.redis.quit(), this.subscriber.quit()]);
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

  async consumeRateLimit(key: string, windowMs: number) {
    const now = Date.now();
    const result = await this.redis.eval(
      [
        "local count = redis.call('INCR', KEYS[1])",
        "local ttl = redis.call('PTTL', KEYS[1])",
        "if count == 1 or ttl < 0 then",
        "  redis.call('PEXPIRE', KEYS[1], ARGV[1])",
        '  ttl = tonumber(ARGV[1])',
        'end',
        'return {count, ttl}',
      ].join('\n'),
      1,
      `rate-limit:${key}`,
      Math.max(1, Math.trunc(windowMs)),
    );
    const [count, ttl] = Array.isArray(result) ? result : [0, windowMs];
    return {
      count: Number(count),
      resetAt: now + Math.max(1, Number(ttl)),
    };
  }

  clearRateLimit(key: string) {
    return this.redis.del(`rate-limit:${key}`);
  }

  async consumeAdminMfaTotp(credentialId: string, counter: number) {
    const result = await this.redis.set(
      `auth:admin-mfa:totp:${credentialId}:${counter}`,
      '1',
      'EX',
      ADMIN_MFA_TOTP_REPLAY_TTL_SECONDS,
      'NX',
    );
    return result === 'OK';
  }

  async subscribeAdminSocketRevocations(
    listener: (event: AdminSocketRevocation) => void,
    onUnavailable?: () => void,
  ) {
    this.adminSocketRevocationListeners.add(listener);
    if (onUnavailable) this.adminSocketRevocationUnavailableListeners.add(onUnavailable);
    try {
      if (!this.adminSocketRevocationSubscribed) {
        if (this.subscriber.status === 'wait') await this.subscriber.connect();
        await this.subscriber.subscribe(ADMIN_SOCKET_REVOCATION_CHANNEL);
        this.adminSocketRevocationSubscribed = true;
      }
    } catch (error) {
      this.adminSocketRevocationListeners.delete(listener);
      if (onUnavailable) this.adminSocketRevocationUnavailableListeners.delete(onUnavailable);
      throw error;
    }
    return () => {
      const removed = this.adminSocketRevocationListeners.delete(listener);
      if (onUnavailable) this.adminSocketRevocationUnavailableListeners.delete(onUnavailable);
      return removed;
    };
  }

  publishAdminSocketRevocation(event: AdminSocketRevocation) {
    return this.redis.publish(ADMIN_SOCKET_REVOCATION_CHANNEL, JSON.stringify(event));
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
    await this.redis.eval(
      [
        "redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])",
        "redis.call('SADD', KEYS[2], ARGV[3])",
        'return 1',
      ].join('\n'),
      2,
      `matching:${bookingId}`,
      'matching:active',
      JSON.stringify(payload),
      Math.max(1, Math.trunc(ttlSeconds)),
      bookingId,
    );
  }

  async closeMatching(bookingId: string) {
    await this.redis.eval(
      [
        "redis.call('DEL', KEYS[1])",
        "redis.call('SREM', KEYS[2], ARGV[1])",
        'return 1',
      ].join('\n'),
      2,
      `matching:${bookingId}`,
      'matching:active',
      bookingId,
    );
  }

  async addParticipant(bookingId: string, providerId: string, ttlSeconds = this.activeMatchingTtlSeconds) {
    await this.redis.eval(
      [
        "local added = redis.call('SADD', KEYS[1], ARGV[1])",
        "redis.call('EXPIRE', KEYS[1], ARGV[2])",
        'return added',
      ].join('\n'),
      1,
      `matching:${bookingId}:participants`,
      providerId,
      Math.max(1, Math.trunc(ttlSeconds)),
    );
  }

  async setOtp(phone: string, otp: string) {
    await this.redis.set(`auth:otp:${phone}`, otp, 'EX', OTP_TTL_SECONDS);
  }

  async reserveOtpSend(phone: string) {
    const result = await this.redis.set(
      `auth:otp:send-cooldown:${phone}`,
      '1',
      'EX',
      OTP_SEND_COOLDOWN_SECONDS,
      'NX',
    );
    return result === 'OK';
  }

  async incrementOtpAttempts(phone: string) {
    const key = `auth:otp:attempts:${phone}`;
    const count = await this.redis.eval(
      [
        "local count = redis.call('INCR', KEYS[1])",
        "local ttl = redis.call('TTL', KEYS[1])",
        "if count == 1 or ttl < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
        'return count',
      ].join('\n'),
      1,
      key,
      OTP_TTL_SECONDS,
    );
    return Number(count);
  }

  getOtp(phone: string) {
    return this.redis.get(`auth:otp:${phone}`);
  }

  async consumeOtpIfMatches(phone: string, otp: string) {
    const result = await this.redis.eval(
      `if redis.call('GET', KEYS[1]) == ARGV[1] then
         redis.call('DEL', KEYS[1], KEYS[2])
         return 1
       end
       return 0`,
      2,
      `auth:otp:${phone}`,
      `auth:otp:attempts:${phone}`,
      otp,
    );
    return Number(result) === 1;
  }

  async consumeOtp(phone: string) {
    await this.redis.del(`auth:otp:${phone}`, `auth:otp:attempts:${phone}`);
  }

  async revokeRefreshToken(tokenHash: string, ttlSeconds: number) {
    await this.redis.set(`auth:refresh:revoked:${tokenHash}`, '1', 'EX', Math.max(1, Math.trunc(ttlSeconds)));
  }

  async revokeRefreshFamily(familyId: string, ttlSeconds: number) {
    await this.redis.set(
      `auth:refresh:family-revoked:${familyId}`,
      '1',
      'EX',
      Math.max(1, Math.trunc(ttlSeconds)),
    );
  }

  async isRefreshFamilyRevoked(familyId: string) {
    return (await this.redis.get(`auth:refresh:family-revoked:${familyId}`)) === '1';
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

function parseAdminSocketRevocation(raw: string): AdminSocketRevocation | null {
  try {
    const value = JSON.parse(raw) as Partial<AdminSocketRevocation>;
    if (
      (value.scope !== 'mobile-family' && value.scope !== 'session' && value.scope !== 'user') ||
      typeof value.id !== 'string' ||
      !value.id
    ) {
      return null;
    }
    return { id: value.id, scope: value.scope };
  } catch {
    return null;
  }
}
