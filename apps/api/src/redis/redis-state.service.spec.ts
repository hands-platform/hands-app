import { ConfigService } from '@nestjs/config';
import { RedisStateService } from './redis-state.service';

const redis = vi.hoisted(() => ({
  connect: vi.fn(),
  del: vi.fn(),
  eval: vi.fn(),
  get: vi.fn(),
  on: vi.fn(),
  publish: vi.fn(),
  quit: vi.fn(),
  set: vi.fn(),
  status: 'wait',
  subscribe: vi.fn(),
}));

describe('RedisStateService OTP consumption', () => {
  beforeEach(() => {
    redis.eval.mockReset();
  });

  it('compares and deletes an OTP and its attempt counter atomically', async () => {
    redis.eval.mockResolvedValue(1);
    const service = createService();

    await expect(service.consumeOtpIfMatches('+84900000000', '123456')).resolves.toBe(true);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('GET', KEYS[1]) == ARGV[1]"),
      2,
      'auth:otp:+84900000000',
      'auth:otp:attempts:+84900000000',
      '123456',
    );
  });

  it('does not consume a mismatched OTP', async () => {
    redis.eval.mockResolvedValue(0);
    const service = createService();

    await expect(service.consumeOtpIfMatches('+84900000000', '000000')).resolves.toBe(false);
  });
});

vi.mock('ioredis', () => ({
  default: vi.fn(function RedisMock() {
    return redis;
  }),
}));

function createService() {
  const config = {
    get: vi.fn((key: string) => (key === 'REDIS_URL' ? 'redis://localhost:6379' : undefined)),
  } as unknown as ConfigService;
  return new RedisStateService(config);
}

describe('RedisStateService refresh token revocation', () => {
  beforeEach(() => {
    redis.set.mockReset();
  });

  it('atomically consumes a refresh token only when its revocation key does not exist', async () => {
    redis.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    const service = createService();

    await expect(service.consumeRefreshToken('token-hash', 3600)).resolves.toBe(true);
    await expect(service.consumeRefreshToken('token-hash', 3600)).resolves.toBe(false);
    expect(redis.set).toHaveBeenNthCalledWith(
      1,
      'auth:refresh:revoked:token-hash',
      '1',
      'EX',
      3600,
      'NX',
    );
    expect(redis.set).toHaveBeenNthCalledWith(
      2,
      'auth:refresh:revoked:token-hash',
      '1',
      'EX',
      3600,
      'NX',
    );
  });

  it('records logout revocation without allowing a later consume to replace it', async () => {
    redis.set.mockResolvedValue('OK');
    const service = createService();

    await service.revokeRefreshToken('token-hash', 120.9);
    expect(redis.set).toHaveBeenCalledWith('auth:refresh:revoked:token-hash', '1', 'EX', 120);
  });

  it('stores and checks refresh family revocation separately from token hashes', async () => {
    redis.set.mockResolvedValue('OK');
    redis.get.mockResolvedValue('1');
    const service = createService();

    await service.revokeRefreshFamily('family-1', 120.9);
    await expect(service.isRefreshFamilyRevoked('family-1')).resolves.toBe(true);

    expect(redis.set).toHaveBeenCalledWith(
      'auth:refresh:family-revoked:family-1',
      '1',
      'EX',
      120,
    );
    expect(redis.get).toHaveBeenCalledWith('auth:refresh:family-revoked:family-1');
  });
});

describe('RedisStateService rate-limit buckets', () => {
  beforeEach(() => {
    redis.del.mockReset().mockResolvedValue(1);
  });

  it('clears only the requested namespaced rate-limit bucket', async () => {
    const service = createService();

    await service.clearRateLimit('admin-reauthentication:admin-1:session-1');

    expect(redis.del).toHaveBeenCalledWith(
      'rate-limit:admin-reauthentication:admin-1:session-1',
    );
  });
});

describe('RedisStateService Admin MFA replay protection', () => {
  beforeEach(() => {
    redis.set.mockReset();
  });

  it('atomically consumes each credential TOTP counter once', async () => {
    redis.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    const service = createService();

    await expect(service.consumeAdminMfaTotp('credential-1', 56_666_666)).resolves.toBe(true);
    await expect(service.consumeAdminMfaTotp('credential-1', 56_666_666)).resolves.toBe(false);
    expect(redis.set).toHaveBeenNthCalledWith(
      1,
      'auth:admin-mfa:totp:credential-1:56666666',
      '1',
      'EX',
      90,
      'NX',
    );
  });
});

describe('RedisStateService Admin socket revocation fan-out', () => {
  beforeEach(() => {
    redis.connect.mockReset().mockResolvedValue(undefined);
    redis.on.mockReset();
    redis.publish.mockReset().mockResolvedValue(1);
    redis.subscribe.mockReset().mockResolvedValue(1);
  });

  it('publishes session revocations on the dedicated channel', async () => {
    const service = createService();

    await service.publishAdminSocketRevocation({ id: 'session-1', scope: 'session' });

    expect(redis.publish).toHaveBeenCalledWith(
      'admin:socket-auth:revocations',
      JSON.stringify({ id: 'session-1', scope: 'session' }),
    );
  });

  it('publishes and receives mobile token-family revocations on the same channel', async () => {
    const service = createService();
    const listener = vi.fn();
    await service.subscribeAdminSocketRevocations(listener);

    await service.publishAdminSocketRevocation({ id: 'mobile-family-1', scope: 'mobile-family' });
    const messageHandler = redis.on.mock.calls.find(([event]) => event === 'message')?.[1];
    messageHandler?.(
      'admin:socket-auth:revocations',
      JSON.stringify({ id: 'mobile-family-1', scope: 'mobile-family' }),
    );

    expect(redis.publish).toHaveBeenCalledWith(
      'admin:socket-auth:revocations',
      JSON.stringify({ id: 'mobile-family-1', scope: 'mobile-family' }),
    );
    expect(listener).toHaveBeenCalledWith({ id: 'mobile-family-1', scope: 'mobile-family' });
  });

  it('removes a revocation listener when the Redis subscription fails', async () => {
    redis.subscribe.mockRejectedValueOnce(new Error('Redis unavailable'));
    const service = createService();
    const listener = vi.fn();

    await expect(service.subscribeAdminSocketRevocations(listener)).rejects.toThrow('Redis unavailable');

    redis.subscribe.mockResolvedValueOnce(1);
    await service.subscribeAdminSocketRevocations(listener);
    const messageHandler = redis.on.mock.calls.find(([event]) => event === 'message')?.[1];
    messageHandler?.(
      'admin:socket-auth:revocations',
      JSON.stringify({ id: 'session-1', scope: 'session' }),
    );

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reports subscription loss so Admin sockets can fail closed', async () => {
    const service = createService();
    const onUnavailable = vi.fn();
    await service.subscribeAdminSocketRevocations(vi.fn(), onUnavailable);
    const closeHandler = redis.on.mock.calls.find(([event]) => event === 'close')?.[1];

    closeHandler?.();

    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });
});
