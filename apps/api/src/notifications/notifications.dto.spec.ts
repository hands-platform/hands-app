import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  DeleteDeviceTokenDto,
  ProviderChatNotificationReadDto,
  RegisterDeviceTokenDto,
} from './notifications.dto';

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

  it('keeps the legacy notification device endpoint open to iOS FCM tokens', async () => {
    const dto = plainToInstance(RegisterDeviceTokenDto, {
      token: ' fcm-token-ios ',
      platform: ' ios ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      token: 'fcm-token-ios',
      platform: 'ios',
    });
  });

  it('normalizes uppercase legacy notification platforms from mobile clients', async () => {
    const dto = plainToInstance(RegisterDeviceTokenDto, {
      token: ' fcm-token-ios ',
      platform: ' IOS ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      token: 'fcm-token-ios',
      platform: 'ios',
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

  it('trims and validates provider chat room read payloads', async () => {
    const dto = plainToInstance(ProviderChatNotificationReadDto, {
      chatRoomId: ' chat-room-1 ',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.chatRoomId).toBe('chat-room-1');
  });

  it('rejects empty provider chat room read payloads', async () => {
    const dto = plainToInstance(ProviderChatNotificationReadDto, {
      chatRoomId: '   ',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('chatRoomId');
  });
});
