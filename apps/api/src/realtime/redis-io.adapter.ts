import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server, ServerOptions } from 'socket.io';

const REDIS_SOCKET_CLIENT_OPTIONS = {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
} as const;

export class RedisIoAdapter extends IoAdapter {
  private adapterFactory: ReturnType<typeof createAdapter> | null = null;
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private closed = false;

  constructor(app: INestApplicationContext, redisUrl: string) {
    super(app);
    this.publisher = new Redis(redisUrl, REDIS_SOCKET_CLIENT_OPTIONS);
    this.subscriber = new Redis(redisUrl, REDIS_SOCKET_CLIENT_OPTIONS);
  }

  async connect() {
    await Promise.all([connectRedis(this.publisher), connectRedis(this.subscriber)]);
    this.adapterFactory = createAdapter(this.publisher, this.subscriber);
  }

  override createIOServer(port: number, options?: ServerOptions) {
    if (!this.adapterFactory) {
      throw new Error('Socket.IO Redis adapter must connect before server creation');
    }
    const server = super.createIOServer(port, options) as Server;
    server.adapter(this.adapterFactory);
    return server;
  }

  override async close(server: Server) {
    try {
      await super.close(server);
    } finally {
      if (!this.closed) {
        this.closed = true;
        await Promise.allSettled([this.publisher.quit(), this.subscriber.quit()]);
      }
    }
  }
}

function connectRedis(client: Redis) {
  return client.status === 'wait' ? client.connect() : Promise.resolve();
}
