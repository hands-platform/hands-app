import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GetMobileAppVersionDto, RegisterMobileDeviceDto, UnregisterMobileDeviceDto } from './mobile.dto';

describe('mobile DTOs', () => {
  it('normalizes Android/iOS/Web device registration payloads', async () => {
    const dto = plainToInstance(RegisterMobileDeviceDto, {
      token: ' fcm-token-1 ',
      platform: ' ios ',
      pushProvider: ' fcm ',
      appVersion: ' 1.2.3 ',
      osVersion: ' iOS 18 ',
      deviceModel: ' iPhone 16 ',
      locale: ' vi-VN ',
      timezone: ' Asia/Ho_Chi_Minh ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      token: 'fcm-token-1',
      platform: 'IOS',
      pushProvider: 'FCM',
      appVersion: '1.2.3',
      osVersion: 'iOS 18',
      deviceModel: 'iPhone 16',
      locale: 'vi-VN',
      timezone: 'Asia/Ho_Chi_Minh',
    });
  });

  it('allows Android and Web as platform-neutral registration inputs', async () => {
    await expect(
      validate(plainToInstance(RegisterMobileDeviceDto, { token: 'a', platform: 'ANDROID' })),
    ).resolves.toHaveLength(0);
    await expect(
      validate(plainToInstance(RegisterMobileDeviceDto, { token: 'w', platform: 'WEB' })),
    ).resolves.toHaveLength(0);
  });

  it('rejects unsupported mobile platforms', async () => {
    const dto = plainToInstance(RegisterMobileDeviceDto, {
      token: 'fcm-token-1',
      platform: 'desktop',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('platform');
  });

  it('rejects unsupported mobile push providers', async () => {
    const dto = plainToInstance(RegisterMobileDeviceDto, {
      token: 'fcm-token-1',
      platform: 'IOS',
      pushProvider: 'apns',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('pushProvider');
  });

  it('normalizes app version lookup query values', async () => {
    const dto = plainToInstance(GetMobileAppVersionDto, {
      appType: ' customer ',
      platform: ' android ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({ appType: 'CUSTOMER', platform: 'ANDROID' });
  });

  it('rejects unsupported app version lookup query values', async () => {
    const dto = plainToInstance(GetMobileAppVersionDto, {
      appType: 'partner',
      platform: 'desktop',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('platform');
  });

  it('trims unregister payloads', async () => {
    const dto = plainToInstance(UnregisterMobileDeviceDto, {
      token: ' fcm-token-1 ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.token).toBe('fcm-token-1');
  });
});
