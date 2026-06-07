import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ProvidersController } from './providers.controller';

describe('provider request DTO validation', () => {
  function bodyMetatype(methodName: keyof ProvidersController, parameterIndex: number) {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      ProvidersController.prototype,
      methodName,
    ) as unknown[];
    return paramTypes?.[parameterIndex] as object | undefined;
  }

  it('uses a concrete DTO for partner location updates', () => {
    expect((bodyMetatype('updateLocation', 1) as { name?: string })?.name).toBe(
      'UpdateProviderLocationDto',
    );
  });

  it('uses concrete DTOs for partner profile, device, service, and verification payloads', () => {
    expect((bodyMetatype('updateProviderProfile', 1) as { name?: string })?.name).toBe(
      'UpdateProviderProfileDto',
    );
    expect((bodyMetatype('recordDeviceSession', 2) as { name?: string })?.name).toBe(
      'RecordProviderDeviceSessionDto',
    );
    expect((bodyMetatype('updateServicePrice', 2) as { name?: string })?.name).toBe(
      'UpdateProviderServicePriceDto',
    );
    expect((bodyMetatype('submitVerification', 1) as { name?: string })?.name).toBe(
      'SubmitProviderVerificationDto',
    );
  });

  it('strips unsupported partner location fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      { lat: 10.7769, lng: 106.7009, walletBalance: -100000 },
      { type: 'body', metatype: bodyMetatype('updateLocation', 1) as never, data: '' },
    );

    expect(transformed).toHaveProperty('lat', 10.7769);
    expect(transformed).not.toHaveProperty('walletBalance');
  });

  it('rejects non-numeric partner location coordinates', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        { lat: 10.7769, lng: '106.7009' },
        { type: 'body', metatype: bodyMetatype('updateLocation', 1) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('normalizes partner profile payloads and strips unsupported fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      { displayName: '  Linh Wellness  ', bio: '  Mobile massage partner  ', walletBalance: -1 },
      { type: 'body', metatype: bodyMetatype('updateProviderProfile', 1) as never, data: '' },
    );

    expect(transformed).toHaveProperty('displayName', 'Linh Wellness');
    expect(transformed).not.toHaveProperty('walletBalance');
  });

  it('requires a device id for partner device sessions', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      { deviceId: ' android-1 ', platform: ' android ', appVersion: ' 1.0.0 ', private: true },
      { type: 'body', metatype: bodyMetatype('recordDeviceSession', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('deviceId', 'android-1');
    expect(transformed).not.toHaveProperty('private');

    await expect(
      pipe.transform(
        { platform: 'android' },
        { type: 'body', metatype: bodyMetatype('recordDeviceSession', 2) as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('validates partner service price payloads', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      { price: '500000', active: true, providerPayoutAmount: 999999 },
      { type: 'body', metatype: bodyMetatype('updateServicePrice', 2) as never, data: '' },
    );

    expect(transformed).toHaveProperty('price', 500000);
    expect(transformed).not.toHaveProperty('providerPayoutAmount');
  });
});
