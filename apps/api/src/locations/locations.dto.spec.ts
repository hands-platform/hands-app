import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { LocationsController } from './locations.controller';

describe('location request DTO validation', () => {
  function saveSelectedLocationBodyMetatype() {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      LocationsController.prototype,
      'saveSelectedLocation',
    ) as unknown[];
    return paramTypes?.[1] as object | undefined;
  }

  it('uses a concrete DTO for customer selected locations', () => {
    expect((saveSelectedLocationBodyMetatype() as { name?: string })?.name).toBe(
      'SaveCustomerSelectedLocationDto',
    );
  });

  it('strips unsupported customer selected location fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        lat: 10.7769,
        lng: 106.7009,
        addressText: 'District 1, Ho Chi Minh City, Vietnam',
        providerId: 'not-allowed',
      },
      { type: 'body', metatype: saveSelectedLocationBodyMetatype() as never, data: '' },
    );

    expect(transformed).toHaveProperty('lat', 10.7769);
    expect(transformed).not.toHaveProperty('providerId');
  });

  it('rejects non-numeric customer selected location coordinates', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        { lat: '10.7769', lng: 106.7009, addressText: 'District 1, Ho Chi Minh City, Vietnam' },
        { type: 'body', metatype: saveSelectedLocationBodyMetatype() as never, data: '' },
      ),
    ).rejects.toThrow();
  });
});
