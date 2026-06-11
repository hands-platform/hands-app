import { Role } from '@prisma/client';
import {
  pushDeviceDisableInput,
  pushDeviceRegistrationInput,
  resolvePushDeviceRole,
} from './notification-device-token';

describe('notification device token helpers', () => {
  it('resolves the stored push device role from authenticated roles', () => {
    expect(resolvePushDeviceRole([Role.CUSTOMER, Role.PROVIDER])).toBe(Role.CUSTOMER);
    expect(resolvePushDeviceRole([Role.PROVIDER])).toBe(Role.PROVIDER);
    expect(resolvePushDeviceRole([Role.ADMIN])).toBe(Role.ADMIN);
  });

  it('builds authenticated token registration upsert input', () => {
    const lastSeenAt = new Date('2026-06-11T00:00:00.000Z');

    expect(
      pushDeviceRegistrationInput(
        { id: 'user-1', roles: [Role.PROVIDER] },
        { token: 'fcm-token-1', platform: 'android' },
        lastSeenAt,
      ),
    ).toEqual({
      where: { token: 'fcm-token-1' },
      update: {
        userId: 'user-1',
        role: Role.PROVIDER,
        platform: 'android',
        enabled: true,
        lastSeenAt,
      },
      create: {
        userId: 'user-1',
        role: Role.PROVIDER,
        token: 'fcm-token-1',
        platform: 'android',
        lastSeenAt,
      },
    });
  });

  it('builds authenticated token disable input', () => {
    const lastSeenAt = new Date('2026-06-11T00:00:00.000Z');

    expect(pushDeviceDisableInput('user-1', 'fcm-token-1', lastSeenAt)).toEqual({
      where: { userId: 'user-1', token: 'fcm-token-1' },
      data: { enabled: false, lastSeenAt },
    });
  });
});
