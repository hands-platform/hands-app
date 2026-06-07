import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ProvidersController } from './providers.controller';

describe('provider request DTO validation', () => {
  function updateLocationBodyMetatype() {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      ProvidersController.prototype,
      'updateLocation',
    ) as unknown[];
    return paramTypes?.[1] as object | undefined;
  }

  it('uses a concrete DTO for partner location updates', () => {
    expect((updateLocationBodyMetatype() as { name?: string })?.name).toBe('UpdateProviderLocationDto');
  });

  it('strips unsupported partner location fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      { lat: 10.7769, lng: 106.7009, walletBalance: -100000 },
      { type: 'body', metatype: updateLocationBodyMetatype() as never, data: '' },
    );

    expect(transformed).toHaveProperty('lat', 10.7769);
    expect(transformed).not.toHaveProperty('walletBalance');
  });

  it('rejects non-numeric partner location coordinates', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        { lat: 10.7769, lng: '106.7009' },
        { type: 'body', metatype: updateLocationBodyMetatype() as never, data: '' },
      ),
    ).rejects.toThrow();
  });
});
