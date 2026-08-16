import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { CustomersController } from './customers/customers.controller';
import { FilesController } from './files/files.controller';
import { MobileController } from './mobile/mobile.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { ServicesController } from './services/services.controller';
import { UsersController } from './users/users.controller';

describe('remaining API request DTO validation', () => {
  function bodyMetatype(controller: object, methodName: string, parameterIndex: number) {
    const paramTypes = Reflect.getMetadata('design:paramtypes', controller, methodName) as unknown[];
    return paramTypes?.[parameterIndex] as object | undefined;
  }

  it('uses concrete DTOs for auth payloads', () => {
    expect((bodyMetatype(AuthController.prototype, 'requestOtp', 0) as { name?: string })?.name).toBe(
      'RequestOtpDto',
    );
    expect((bodyMetatype(AuthController.prototype, 'verifyOtp', 0) as { name?: string })?.name).toBe(
      'VerifyOtpDto',
    );
    expect((bodyMetatype(AuthController.prototype, 'refresh', 0) as { name?: string })?.name).toBe(
      'RefreshTokenDto',
    );
    expect(
      (bodyMetatype(AuthController.prototype, 'exchangeSupabaseSession', 0) as { name?: string })?.name,
    ).toBe('SupabaseExchangeDto');
  });

  it('uses concrete DTOs for customer, file, notification, user, and service payloads', () => {
    expect((bodyMetatype(CustomersController.prototype, 'previewCoupon', 0) as { name?: string })?.name).toBe(
      'PreviewCouponDto',
    );
    expect((bodyMetatype(CustomersController.prototype, 'createReview', 1) as { name?: string })?.name).toBe(
      'CreateCustomerReviewDto',
    );
    expect(
      (bodyMetatype(CustomersController.prototype, 'recordProviderProfileView', 2) as { name?: string })?.name,
    ).toBe('RecordProviderProfileViewDto');
    expect(
      (bodyMetatype(FilesController.prototype, 'createPresignedUpload', 1) as { name?: string })?.name,
    ).toBe('CreatePresignedUploadDto');
    expect((bodyMetatype(FilesController.prototype, 'completeUpload', 2) as { name?: string })?.name).toBe(
      'CompleteUploadDto',
    );
    expect(
      (bodyMetatype(NotificationsController.prototype, 'registerDeviceToken', 1) as { name?: string })?.name,
    ).toBe('RegisterDeviceTokenDto');
    expect(
      (bodyMetatype(NotificationsController.prototype, 'disableDeviceToken', 1) as { name?: string })?.name,
    ).toBe('DeleteDeviceTokenDto');
    expect((bodyMetatype(MobileController.prototype, 'registerDevice', 1) as { name?: string })?.name).toBe(
      'RegisterMobileDeviceDto',
    );
    expect((bodyMetatype(MobileController.prototype, 'unregisterDevice', 1) as { name?: string })?.name).toBe(
      'UnregisterMobileDeviceDto',
    );
    expect((bodyMetatype(MobileController.prototype, 'getAppVersion', 0) as { name?: string })?.name).toBe(
      'GetMobileAppVersionDto',
    );
    expect((bodyMetatype(UsersController.prototype, 'recordAppSession', 2) as { name?: string })?.name).toBe(
      'RecordAppSessionDto',
    );
    expect((bodyMetatype(UsersController.prototype, 'updateCustomerMe', 1) as { name?: string })?.name).toBe(
      'UpdateUserProfileDto',
    );
    expect((bodyMetatype(ServicesController.prototype, 'create', 0) as { name?: string })?.name).toBe(
      'CreateServiceDto',
    );
  });

  it('normalizes numeric and string API payloads while stripping unsupported fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const coupon = await pipe.transform(
      { code: ' HANDS100 ', serviceId: ' svc-1 ', subtotal: '500000', adminOnly: true },
      {
        type: 'body',
        metatype: bodyMetatype(CustomersController.prototype, 'previewCoupon', 0) as never,
        data: '',
      },
    );

    expect(coupon).toHaveProperty('code', 'HANDS100');
    expect(coupon).toHaveProperty('subtotal', 500000);
    expect(coupon).not.toHaveProperty('adminOnly');

    const service = await pipe.transform(
      { name: '  Foot Massage  ', durationMin: '60', basePrice: '450000', private: true },
      { type: 'body', metatype: bodyMetatype(ServicesController.prototype, 'create', 0) as never, data: '' },
    );

    expect(service).toHaveProperty('name', 'Foot Massage');
    expect(service).toHaveProperty('basePrice', 450000);
    expect(service).not.toHaveProperty('private');

    const session = await pipe.transform(
      {
        role: 'CUSTOMER',
        deviceId: ' hands-device-1 ',
        platform: ' android ',
        appVersion: ' 1.0.0 ',
        deviceLanguage: ' vi-VN ',
        lastLoginAddress: ' 123 Nguyen Hue, District 1 ',
        eventType: 'APP_OPEN',
        clientEventId: ' app-open-1 ',
        ignored: true,
      },
      {
        type: 'body',
        metatype: bodyMetatype(UsersController.prototype, 'recordAppSession', 2) as never,
        data: '',
      },
    );

    expect(session).toHaveProperty('deviceId', 'hands-device-1');
    expect(session).toHaveProperty('platform', 'android');
    expect(session).toHaveProperty('appVersion', '1.0.0');
    expect(session).toHaveProperty('deviceLanguage', 'vi-VN');
    expect(session).toHaveProperty('lastLoginAddress', '123 Nguyen Hue, District 1');
    expect(session).toHaveProperty('eventType', 'APP_OPEN');
    expect(session).toHaveProperty('clientEventId', 'app-open-1');
    expect(session).not.toHaveProperty('ignored');

    const mobileDevice = await pipe.transform(
      {
        token: ' fcm-token-ios ',
        platform: ' ios ',
        appVersion: ' 1.2.3 ',
        osVersion: ' iOS 18 ',
        private: true,
      },
      {
        type: 'body',
        metatype: bodyMetatype(MobileController.prototype, 'registerDevice', 1) as never,
        data: '',
      },
    );

    expect(mobileDevice).toHaveProperty('token', 'fcm-token-ios');
    expect(mobileDevice).toHaveProperty('platform', 'IOS');
    expect(mobileDevice).toHaveProperty('appVersion', '1.2.3');
    expect(mobileDevice).toHaveProperty('osVersion', 'iOS 18');
    expect(mobileDevice).not.toHaveProperty('private');

    const mobileVersionQuery = await pipe.transform(
      { appType: ' partner ', platform: ' ios ', ignored: true },
      {
        type: 'query',
        metatype: bodyMetatype(MobileController.prototype, 'getAppVersion', 0) as never,
        data: '',
      },
    );

    expect(mobileVersionQuery).toHaveProperty('appType', 'PARTNER');
    expect(mobileVersionQuery).toHaveProperty('platform', 'IOS');
    expect(mobileVersionQuery).not.toHaveProperty('ignored');
  });

  it('rejects invalid enums and required values before service logic runs', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        {
          contentType: 'image/jpeg',
          purpose: 'profile-image',
          visibility: 'PUBLIC',
        },
        {
          type: 'body',
          metatype: bodyMetatype(FilesController.prototype, 'createPresignedUpload', 1) as never,
          data: '',
        },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { refreshToken: 'x'.repeat(4097) },
        {
          type: 'body',
          metatype: bodyMetatype(AuthController.prototype, 'refresh', 0) as never,
          data: '',
        },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { supabaseAccessToken: 'x'.repeat(4097) },
        {
          type: 'body',
          metatype: bodyMetatype(AuthController.prototype, 'exchangeSupabaseSession', 0) as never,
          data: '',
        },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { sizeBytes: 10 * 1024 * 1024 + 1 },
        {
          type: 'body',
          metatype: bodyMetatype(FilesController.prototype, 'completeUpload', 2) as never,
          data: '',
        },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { token: 'push-token', platform: 'desktop' },
        {
          type: 'body',
          metatype: bodyMetatype(NotificationsController.prototype, 'registerDeviceToken', 1) as never,
          data: '',
        },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { token: 'push-token', platform: 'web' },
        {
          type: 'body',
          metatype: bodyMetatype(NotificationsController.prototype, 'registerDeviceToken', 1) as never,
          data: '',
        },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { refreshToken: '' },
        { type: 'body', metatype: bodyMetatype(AuthController.prototype, 'refresh', 0) as never, data: '' },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { token: 'push-token', platform: 'desktop' },
        {
          type: 'body',
          metatype: bodyMetatype(MobileController.prototype, 'registerDevice', 1) as never,
          data: '',
        },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { appType: 'FRANCHISE', platform: 'IOS' },
        {
          type: 'query',
          metatype: bodyMetatype(MobileController.prototype, 'getAppVersion', 0) as never,
          data: '',
        },
      ),
    ).rejects.toThrow();
  });
});
