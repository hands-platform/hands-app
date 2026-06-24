import { Role } from '@prisma/client';
import { MobileService } from './mobile.service';

describe('MobileService device registration', () => {
  it('registers an Android device through the shared notification token upsert path', async () => {
    const prisma = {};
    const notifications = { registerDeviceToken: jest.fn().mockResolvedValue({ id: 'device-1' }) };
    const service = new MobileService(prisma as never, notifications as never);

    await expect(
      service.registerDevice(
        { id: 'customer-user-1', roles: [Role.CUSTOMER] },
        {
          token: 'fcm-token-android',
          platform: 'ANDROID',
          appVersion: '1.0.0',
          osVersion: 'Android 15',
          deviceModel: 'Pixel 9',
          locale: 'vi-VN',
          timezone: 'Asia/Ho_Chi_Minh',
        },
      ),
    ).resolves.toEqual({ id: 'device-1' });

    expect(notifications.registerDeviceToken).toHaveBeenCalledWith(
      { id: 'customer-user-1', roles: [Role.CUSTOMER] },
      {
        token: 'fcm-token-android',
        platform: 'android',
        pushProvider: 'FCM',
        appVersion: '1.0.0',
        osVersion: 'Android 15',
        deviceModel: 'Pixel 9',
        locale: 'vi-VN',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    );
  });

  it('registers an iOS device without changing the active provider role', async () => {
    const prisma = {};
    const notifications = { registerDeviceToken: jest.fn().mockResolvedValue({ id: 'device-2' }) };
    const service = new MobileService(prisma as never, notifications as never);
    const user = { id: 'multi-role-user', activeRole: Role.PROVIDER, roles: [Role.CUSTOMER, Role.PROVIDER] };

    await service.registerDevice(user, {
      token: 'fcm-token-ios',
      platform: 'IOS',
      pushProvider: 'FCM',
    });

    expect(notifications.registerDeviceToken).toHaveBeenCalledWith(
      user,
      expect.objectContaining({ platform: 'ios', pushProvider: 'FCM' }),
    );
  });

  it('unregisters a device by disabling the authenticated token', async () => {
    const prisma = {};
    const notifications = { disableDeviceToken: jest.fn().mockResolvedValue({ ok: true, disabled: 1 }) };
    const service = new MobileService(prisma as never, notifications as never);

    await expect(
      service.unregisterDevice({ id: 'user-1', roles: [Role.CUSTOMER] }, { token: 'fcm-token-1' }),
    ).resolves.toEqual({ ok: true, disabled: 1 });

    expect(notifications.disableDeviceToken).toHaveBeenCalledWith(
      { id: 'user-1', roles: [Role.CUSTOMER] },
      { token: 'fcm-token-1' },
    );
  });
});

describe('MobileService app versions', () => {
  it('returns a default app version policy when no row exists', async () => {
    const prisma = { appVersionPolicy: { findUnique: jest.fn().mockResolvedValue(null) } };
    const notifications = {};
    const service = new MobileService(prisma as never, notifications as never);

    await expect(service.getAppVersion({ appType: 'CUSTOMER', platform: 'ANDROID' })).resolves.toEqual({
      appType: 'CUSTOMER',
      platform: 'ANDROID',
      minimumSupportedVersion: null,
      latestVersion: null,
      forceUpdate: false,
      updateUrl: null,
      releaseNotes: null,
      source: 'DEFAULT',
    });

    expect(prisma.appVersionPolicy.findUnique).toHaveBeenCalledWith({
      where: { appType_platform: { appType: 'CUSTOMER', platform: 'ANDROID' } },
    });
  });

  it('returns a default app version policy when the configured row is inactive', async () => {
    const prisma = {
      appVersionPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          appType: 'CUSTOMER',
          platform: 'IOS',
          minimumSupportedVersion: '9.9.9',
          latestVersion: '9.9.9',
          forceUpdate: true,
          updateUrl: 'https://apps.apple.com/app/hands-customer',
          releaseNotes: 'Disabled policy should not block clients.',
          isActive: false,
        }),
      },
    };
    const notifications = {};
    const service = new MobileService(prisma as never, notifications as never);

    await expect(service.getAppVersion({ appType: 'CUSTOMER', platform: 'IOS' })).resolves.toEqual({
      appType: 'CUSTOMER',
      platform: 'IOS',
      minimumSupportedVersion: null,
      latestVersion: null,
      forceUpdate: false,
      updateUrl: null,
      releaseNotes: null,
      source: 'DEFAULT',
    });
  });

  it('returns platform-specific iOS app version policy rows', async () => {
    const prisma = {
      appVersionPolicy: {
        findUnique: jest.fn().mockResolvedValue({
          appType: 'PARTNER',
          platform: 'IOS',
          minimumSupportedVersion: '1.0.0',
          latestVersion: '1.2.0',
          forceUpdate: true,
          updateUrl: 'https://apps.apple.com/app/hands-partner',
          releaseNotes: 'Update required.',
          isActive: true,
        }),
      },
    };
    const notifications = {};
    const service = new MobileService(prisma as never, notifications as never);

    await expect(service.getAppVersion({ appType: 'PARTNER', platform: 'IOS' })).resolves.toEqual({
      appType: 'PARTNER',
      platform: 'IOS',
      minimumSupportedVersion: '1.0.0',
      latestVersion: '1.2.0',
      forceUpdate: true,
      updateUrl: 'https://apps.apple.com/app/hands-partner',
      releaseNotes: 'Update required.',
      source: 'DATABASE',
    });
  });
});
