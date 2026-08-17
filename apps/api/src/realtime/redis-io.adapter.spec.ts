import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { RedisIoAdapter } from './redis-io.adapter';

const redisClients: Array<{
  connect: ReturnType<typeof vi.fn>;
  quit: ReturnType<typeof vi.fn>;
  status: string;
}> = [];

vi.mock('@socket.io/redis-adapter', () => ({ createAdapter: vi.fn(() => 'redis-adapter') }));
vi.mock('ioredis', () => ({
  default: class RedisFixture {
    status = 'wait';
    connect = vi.fn().mockResolvedValue(undefined);
    quit = vi.fn().mockResolvedValue(undefined);

    constructor() {
      redisClients.push(this);
    }
  },
}));

describe('RedisIoAdapter', () => {
  beforeEach(() => {
    redisClients.length = 0;
    vi.clearAllMocks();
  });

  it('fans out Socket.IO through dedicated Redis pub/sub clients and closes them', async () => {
    const server = { adapter: vi.fn() };
    vi.spyOn(IoAdapter.prototype, 'createIOServer').mockReturnValue(server);
    vi.spyOn(IoAdapter.prototype, 'close').mockResolvedValue(undefined);
    const adapter = new RedisIoAdapter({} as never, 'redis://localhost:6379');

    await adapter.connect();
    expect(redisClients).toHaveLength(2);
    expect(redisClients.every((client) => client.connect.mock.calls.length === 1)).toBe(true);
    expect(createAdapter).toHaveBeenCalledWith(redisClients[0], redisClients[1]);

    expect(adapter.createIOServer(0)).toBe(server);
    expect(server.adapter).toHaveBeenCalledWith('redis-adapter');

    await adapter.close(server as never);
    expect(redisClients.every((client) => client.quit.mock.calls.length === 1)).toBe(true);
  });

  it('refuses to create a Socket.IO server before Redis is connected', () => {
    const adapter = new RedisIoAdapter({} as never, 'redis://localhost:6379');
    expect(() => adapter.createIOServer(0)).toThrow('must connect before server creation');
  });
});
