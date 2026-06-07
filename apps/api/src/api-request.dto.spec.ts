import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { AuthController } from './auth/auth.controller';
import { CustomersController } from './customers/customers.controller';
import { FilesController } from './files/files.controller';
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
    expect((bodyMetatype(FilesController.prototype, 'createPresignedUpload', 1) as { name?: string })?.name).toBe(
      'CreatePresignedUploadDto',
    );
    expect((bodyMetatype(FilesController.prototype, 'completeUpload', 2) as { name?: string })?.name).toBe(
      'CompleteUploadDto',
    );
    expect(
      (bodyMetatype(NotificationsController.prototype, 'registerDeviceToken', 1) as { name?: string })?.name,
    ).toBe('RegisterDeviceTokenDto');
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
      { type: 'body', metatype: bodyMetatype(CustomersController.prototype, 'previewCoupon', 0) as never, data: '' },
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
  });

  it('rejects invalid enums and required values before service logic runs', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

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
        { refreshToken: '' },
        { type: 'body', metatype: bodyMetatype(AuthController.prototype, 'refresh', 0) as never, data: '' },
      ),
    ).rejects.toThrow();
  });
});
