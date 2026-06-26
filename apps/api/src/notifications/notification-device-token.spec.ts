import { Role } from '@prisma/client';
import {
  pushDeviceDisableInput,
  pushDeviceRegistrationInput,
  resolvePushDeviceRole,
} from './notification-device-token';

describe('notification device token helpers', () => {
  it('resolves the stored push device role from authenticated roles', () => {
    expect(resolvePushDeviceRole([Role.CUSTOMER, Role.PROVIDER])).toBe(Role.CUSTOMER);
    expect(resolvePushDeviceRole([Role.CUSTOMER, Role.PROVIDER], Role.PROVIDER)).toBe(Role.PROVIDER);
    expect(resolvePushDeviceRole([Role.CUSTOMER], Role.PROVIDER)).toBe(Role.CUSTOMER);
    expect(resolvePushDeviceRole([Role.PROVIDER])).toBe(Role.PROVIDER);
    expect(resolvePushDeviceRole([Role.ADMIN])).toBeNull();
  });

  it('uses the active authenticated role for multi-role token registration', () => {
    const lastSeenAt = new Date('2026-06-11T00:00:00.000Z');

    expect(
      pushDeviceRegistrationInput(
        { id: 'user-1', activeRole: Role.PROVIDER, roles: [Role.CUSTOMER, Role.PROVIDER] },
        { token: 'fcm-token-1', platform: 'android' },
        lastSeenAt,
      ),
    ).toMatchObject({
      update: { role: Role.PROVIDER },
      create: { role: Role.PROVIDER },
    });
  });

  it('builds authenticated token registration upsert input', () => {
    const lastSeenAt = new Date('2026-06-11T00:00:00.000Z');

    expect(
      pushDeviceRegistrationInput(
        { id: 'user-1', roles: [Role.PROVIDER] },
        { token: ' fcm-token-1 ', platform: ' ANDROID ' },
        lastSeenAt,
      ),
    ).toEqual({
      where: { token: 'fcm-token-1' },
      update: {
        userId: 'user-1',
        role: Role.PROVIDER,
        platform: 'android',
        pushProvider: 'FCM',
        enabled: true,
        lastSeenAt,
      },
      create: {
        userId: 'user-1',
        role: Role.PROVIDER,
        token: 'fcm-token-1',
        platform: 'android',
        pushProvider: 'FCM',
        lastSeenAt,
      },
    });
  });

  it('adds optional mobile metadata to authenticated token registration input', () => {
    const lastSeenAt = new Date('2026-06-11T00:00:00.000Z');

    expect(
      pushDeviceRegistrationInput(
        { id: 'user-1', roles: [Role.CUSTOMER] },
        {
          token: 'fcm-token-1',
          platform: 'ios',
          pushProvider: 'FCM',
          appVersion: '1.2.3',
          osVersion: 'iOS 18',
          deviceModel: 'iPhone 16',
          locale: 'vi-VN',
          timezone: 'Asia/Ho_Chi_Minh',
        },
        lastSeenAt,
      ),
    ).toMatchObject({
      update: {
        platform: 'ios',
        pushProvider: 'FCM',
        appVersion: '1.2.3',
        osVersion: 'iOS 18',
        deviceModel: 'iPhone 16',
        locale: 'vi-VN',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      create: {
        platform: 'ios',
        pushProvider: 'FCM',
        appVersion: '1.2.3',
        osVersion: 'iOS 18',
        deviceModel: 'iPhone 16',
        locale: 'vi-VN',
        timezone: 'Asia/Ho_Chi_Minh',
      },
    });
  });

  it('omits undefined optional mobile metadata from authenticated token registration input', () => {
    const lastSeenAt = new Date('2026-06-11T00:00:00.000Z');
    const input = pushDeviceRegistrationInput(
      { id: 'user-1', roles: [Role.CUSTOMER] },
      {
        token: 'fcm-token-1',
        platform: 'ios',
        pushProvider: 'FCM',
        appVersion: undefined,
        osVersion: undefined,
        deviceModel: undefined,
        locale: undefined,
        timezone: undefined,
      },
      lastSeenAt,
    );

    for (const field of ['appVersion', 'osVersion', 'deviceModel', 'locale', 'timezone']) {
      expect(input.update).not.toHaveProperty(field);
      expect(input.create).not.toHaveProperty(field);
    }

    expect(input).toMatchObject({
      update: {
        platform: 'ios',
        pushProvider: 'FCM',
      },
      create: {
        platform: 'ios',
        pushProvider: 'FCM',
      },
    });
  });

  it('rejects registration input without a customer or provider role', () => {
    expect(() =>
      pushDeviceRegistrationInput(
        { id: 'admin-1', roles: [Role.ADMIN] },
        { token: 'fcm-token-1', platform: 'ios' },
      ),
    ).toThrow('Push device registration requires a customer or provider role');
  });

  it('builds authenticated token disable input', () => {
    const lastSeenAt = new Date('2026-06-11T00:00:00.000Z');

    expect(pushDeviceDisableInput('user-1', ' fcm-token-1 ', lastSeenAt)).toEqual({
      where: { userId: 'user-1', token: 'fcm-token-1' },
      data: { enabled: false, lastSeenAt },
    });
  });
});
