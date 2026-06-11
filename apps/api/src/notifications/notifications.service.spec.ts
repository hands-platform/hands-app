import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService device tokens', () => {
  it('registers an FCM token for the authenticated provider user', async () => {
    const prisma = {
      pushDevice: {
        upsert: jest.fn().mockResolvedValue({ id: 'device-1' }),
      },
    };
    const queue = { add: jest.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(
      service.registerDeviceToken(
        { id: 'user-1', roles: [Role.PROVIDER] },
        { token: 'fcm-token-1', platform: 'android' },
      ),
    ).resolves.toEqual({ id: 'device-1' });

    expect(prisma.pushDevice.upsert).toHaveBeenCalledWith({
      where: { token: 'fcm-token-1' },
      update: {
        userId: 'user-1',
        role: Role.PROVIDER,
        platform: 'android',
        enabled: true,
        lastSeenAt: expect.any(Date),
      },
      create: {
        userId: 'user-1',
        role: Role.PROVIDER,
        token: 'fcm-token-1',
        platform: 'android',
        lastSeenAt: expect.any(Date),
      },
    });
  });

  it('disables only the authenticated user device token', async () => {
    const prisma = {
      pushDevice: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const queue = { add: jest.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(
      service.disableDeviceToken(
        { id: 'user-1', roles: [Role.CUSTOMER] },
        { token: 'fcm-token-1' },
      ),
    ).resolves.toEqual({ ok: true, disabled: 1 });

    expect(prisma.pushDevice.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', token: 'fcm-token-1' },
      data: { enabled: false, lastSeenAt: expect.any(Date) },
    });
  });
});
