import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';
import { BookingsController } from './bookings.controller';

describe('booking request DTO validation', () => {
  function createCustomerBookingBodyMetatype() {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      BookingsController.prototype,
      'createCustomerBooking',
    ) as unknown[];
    return paramTypes?.[1] as object | undefined;
  }

  it('uses a concrete DTO for customer booking creation', () => {
    expect(createCustomerBookingBodyMetatype()?.constructor.name).toBe('Function');
    expect((createCustomerBookingBodyMetatype() as { name?: string })?.name).toBe(
      'CreateCustomerBookingDto',
    );
  });

  it('strips schedule input from customer booking creation payloads', async () => {
    const metatype = createCustomerBookingBodyMetatype();
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        serviceId: 'service-1',
        providerId: 'provider-1',
        address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
        lat: 10.7769,
        lng: 106.7009,
        paymentMethod: PaymentMethod.CASH,
        scheduledStartAt: '2026-06-01T10:00:00.000Z',
      },
      { type: 'body', metatype: metatype as never, data: '' },
    );

    expect(transformed).toHaveProperty('serviceId', 'service-1');
    expect(transformed).not.toHaveProperty('scheduledStartAt');
  });
});
