import { socketEventAllowed } from './socket-rate-limit';

describe('socketEventAllowed', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('uses a user-and-event bucket and rejects events above the limit', async () => {
    const store = { consumeRateLimit: vi.fn().mockResolvedValue({ count: 31 }) };

    await expect(
      socketEventAllowed(store, 'user-1', 'chat.message.create', 30),
    ).resolves.toBe(false);
    expect(store.consumeRateLimit).toHaveBeenCalledWith(
      'socket:chat.message.create:user-1',
      60_000,
    );
  });

  it('fails closed in production when shared rate-limit state is unavailable', async () => {
    process.env.NODE_ENV = 'production';

    await expect(socketEventAllowed(undefined, 'user-1', 'booking.join_room', 60)).resolves.toBe(
      false,
    );
    await expect(
      socketEventAllowed(
        { consumeRateLimit: vi.fn().mockRejectedValue(new Error('Redis unavailable')) },
        'user-1',
        'booking.join_room',
        60,
      ),
    ).resolves.toBe(false);
  });
});
