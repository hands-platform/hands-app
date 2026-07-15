import { ConfigService } from '@nestjs/config';
import { RedisStateService } from './redis-state.service';

const redis = vi.hoisted(() => ({
  quit: vi.fn(),
  set: vi.fn(),
}));

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
});
