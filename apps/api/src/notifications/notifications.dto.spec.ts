import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeleteDeviceTokenDto, RegisterDeviceTokenDto } from './notifications.dto';

describe('notification DTOs', () => {
  it('trims and accepts Android/iOS device token registration payloads', async () => {
    const dto = plainToInstance(RegisterDeviceTokenDto, {
      token: ' fcm-token-1 ',
      platform: ' android ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      token: 'fcm-token-1',
      platform: 'android',
    });
  });

  it('rejects unsupported push platforms before device registration', async () => {
    const dto = plainToInstance(RegisterDeviceTokenDto, {
      token: 'fcm-token-1',
      platform: 'web',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('platform');
  });

  it('rejects oversized device tokens', async () => {
    const dto = plainToInstance(RegisterDeviceTokenDto, {
      token: 'x'.repeat(513),
      platform: 'ios',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('token');
  });

  it('trims delete device token payloads', async () => {
    const dto = plainToInstance(DeleteDeviceTokenDto, {
      token: ' fcm-token-1 ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.token).toBe('fcm-token-1');
  });
});
