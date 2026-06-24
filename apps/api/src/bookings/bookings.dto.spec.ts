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

  function cancelProviderBookingBodyMetatype() {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      BookingsController.prototype,
      'cancelProviderBooking',
    ) as unknown[];
    return paramTypes?.[2] as object | undefined;
  }

  function completeProviderBookingBodyMetatype() {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      BookingsController.prototype,
      'complete',
    ) as unknown[];
    return paramTypes?.[2] as object | undefined;
  }

  function createProviderCustomerReviewBodyMetatype() {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      BookingsController.prototype,
      'createProviderCustomerReview',
    ) as unknown[];
    return paramTypes?.[2] as object | undefined;
  }

  it('uses a concrete DTO for customer booking creation', () => {
    expect(createCustomerBookingBodyMetatype()?.constructor.name).toBe('Function');
    expect((createCustomerBookingBodyMetatype() as { name?: string })?.name).toBe(
      'CreateCustomerBookingDto',
    );
  });

  it('uses a concrete DTO for partner post-match cancellation notes', () => {
    expect((cancelProviderBookingBodyMetatype() as { name?: string })?.name).toBe(
      'CancelProviderBookingDto',
    );
    expect((completeProviderBookingBodyMetatype() as { name?: string })?.name).toBe(
      'CompleteProviderBookingDto',
    );
  });

  it('uses a concrete DTO for partner customer evaluations', () => {
    expect((createProviderCustomerReviewBodyMetatype() as { name?: string })?.name).toBe(
      'CreateProviderCustomerReviewDto',
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

  it('allows saved customer location booking payloads without duplicate address coordinates', async () => {
    const metatype = createCustomerBookingBodyMetatype();
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        serviceId: 'service-1',
        selectedLocationId: 'saved-location-1',
        paymentMethod: PaymentMethod.CASH,
      },
      { type: 'body', metatype: metatype as never, data: '' },
    );

    expect(transformed).toMatchObject({
      paymentMethod: PaymentMethod.CASH,
      selectedLocationId: 'saved-location-1',
      serviceId: 'service-1',
    });
  });

  it('requires partner action coordinates and strips unsupported fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        {
          note: 'Customer requested cancellation after matching.',
        },
        { type: 'body', metatype: cancelProviderBookingBodyMetatype() as never, data: '' },
      ),
    ).rejects.toThrow();

    const transformed = await pipe.transform(
      {
        lat: 10.7769,
        lng: 106.7009,
        note: 'Customer requested cancellation after matching.',
        walletBalance: -100000,
      },
      { type: 'body', metatype: cancelProviderBookingBodyMetatype() as never, data: '' },
    );

    expect(transformed).toMatchObject({
      lat: 10.7769,
      lng: 106.7009,
      note: 'Customer requested cancellation after matching.',
    });
    expect(transformed).not.toHaveProperty('walletBalance');
  });

  it('requires text-only partner customer evaluations and trims comments', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        { comment: '   ' },
        { type: 'body', metatype: createProviderCustomerReviewBodyMetatype() as never, data: '' },
      ),
    ).rejects.toThrow();

    const transformed = await pipe.transform(
      {
        comment: '  Polite customer and smooth service closeout.  ',
        rating: 5,
      },
      { type: 'body', metatype: createProviderCustomerReviewBodyMetatype() as never, data: '' },
    );

    expect(transformed).toEqual({
      comment: 'Polite customer and smooth service closeout.',
    });
  });
});
