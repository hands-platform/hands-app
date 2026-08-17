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

  function rejectPreferredProviderBookingBodyMetatype() {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      BookingsController.prototype,
      'reject',
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

  function recordProviderBookingDetailViewBodyMetatype() {
    const paramTypes = Reflect.getMetadata(
      'design:paramtypes',
      BookingsController.prototype,
      'recordProviderBookingDetailView',
    ) as unknown[];
    return paramTypes?.[2] as object | undefined;
  }

  it('uses a concrete DTO for customer booking creation', () => {
    expect(createCustomerBookingBodyMetatype()?.constructor.name).toBe('Function');
    expect((createCustomerBookingBodyMetatype() as { name?: string })?.name).toBe('CreateCustomerBookingDto');
  });

  it('requires a stable idempotency key for customer booking creation', async () => {
    const metatype = createCustomerBookingBodyMetatype();
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    const booking = {
      address: { addressText: 'District 1, Ho Chi Minh City, Vietnam' },
      idempotencyKey: ' booking-request-1 ',
      lat: 10.7769,
      lng: 106.7009,
      paymentMethod: PaymentMethod.CASH,
      serviceId: 'service-1',
    };

    await expect(
      pipe.transform(booking, { type: 'body', metatype: metatype as never, data: '' }),
    ).resolves.toMatchObject({ idempotencyKey: 'booking-request-1' });
    await expect(
      pipe.transform(
        { ...booking, idempotencyKey: 'short' },
        { type: 'body', metatype: metatype as never, data: '' },
      ),
    ).rejects.toThrow();
  });

  it('uses a concrete DTO for partner post-match cancellation notes', () => {
    expect((cancelProviderBookingBodyMetatype() as { name?: string })?.name).toBe('CancelProviderBookingDto');
    expect((completeProviderBookingBodyMetatype() as { name?: string })?.name).toBe(
      'CompleteProviderBookingDto',
    );
  });

  it('validates an optional preferred partner rejection reason payload', async () => {
    const metatype = rejectPreferredProviderBookingBodyMetatype();
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform({}, { type: 'body', metatype: metatype as never, data: '' }),
    ).resolves.toEqual({});

    await expect(
      pipe.transform(
        { reasonCode: 'SCHEDULE_CONFLICT', reasonDetail: '   ' },
        { type: 'body', metatype: metatype as never, data: '' },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { reasonCode: 'UNKNOWN', reasonDetail: 'Cannot take this request.' },
        { type: 'body', metatype: metatype as never, data: '' },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        {
          reasonCode: 'TOO_FAR',
          reasonDetail: '  Travel time is outside my current range.  ',
        },
        { type: 'body', metatype: metatype as never, data: '' },
      ),
    ).resolves.toMatchObject({
      reasonCode: 'TOO_FAR',
      reasonDetail: 'Travel time is outside my current range.',
    });
  });

  it('requires a supported partner cancellation reason and detailed note', async () => {
    const metatype = cancelProviderBookingBodyMetatype();
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        {
          lat: 10.7769,
          lng: 106.7009,
          note: 'Arrived but could not find the customer.',
        },
        { type: 'body', metatype: metatype as never, data: '' },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        {
          lat: 10.7769,
          lng: 106.7009,
          reasonCode: 'NOT_A_REAL_REASON',
          note: 'Arrived but could not find the customer.',
        },
        { type: 'body', metatype: metatype as never, data: '' },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        {
          lat: 10.7769,
          lng: 106.7009,
          reasonCode: 'CUSTOMER_NOT_FOUND',
          note: '  Arrived but could not find the customer.  ',
        },
        { type: 'body', metatype: metatype as never, data: '' },
      ),
    ).resolves.toMatchObject({
      reasonCode: 'CUSTOMER_NOT_FOUND',
      note: 'Arrived but could not find the customer.',
    });
  });

  it('uses a concrete DTO for partner customer evaluations', () => {
    expect((createProviderCustomerReviewBodyMetatype() as { name?: string })?.name).toBe(
      'CreateProviderCustomerReviewDto',
    );
  });

  it('uses a concrete DTO for partner booking detail view telemetry', () => {
    expect((recordProviderBookingDetailViewBodyMetatype() as { name?: string })?.name).toBe(
      'RecordProviderBookingDetailViewDto',
    );
  });

  it('strips schedule input from customer booking creation payloads', async () => {
    const metatype = createCustomerBookingBodyMetatype();
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const transformed = await pipe.transform(
      {
        idempotencyKey: 'booking-request-schedule-1',
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
        idempotencyKey: 'booking-request-location-1',
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
          reasonCode: 'CUSTOMER_REQUESTED',
          note: 'Customer requested cancellation after matching.',
        },
        { type: 'body', metatype: cancelProviderBookingBodyMetatype() as never, data: '' },
      ),
    ).rejects.toThrow();

    const transformed = await pipe.transform(
      {
        lat: 10.7769,
        lng: 106.7009,
        reasonCode: 'CUSTOMER_REQUESTED',
        note: 'Customer requested cancellation after matching.',
        walletBalance: -100000,
      },
      { type: 'body', metatype: cancelProviderBookingBodyMetatype() as never, data: '' },
    );

    expect(transformed).toMatchObject({
      lat: 10.7769,
      lng: 106.7009,
      reasonCode: 'CUSTOMER_REQUESTED',
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

  it('validates partner booking detail view telemetry without accepting arbitrary fields', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    await expect(
      pipe.transform(
        { eventType: 'opened', durationSeconds: 20 },
        { type: 'body', metatype: recordProviderBookingDetailViewBodyMetatype() as never, data: '' },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        { eventType: 'closed', durationSeconds: 999999 },
        { type: 'body', metatype: recordProviderBookingDetailViewBodyMetatype() as never, data: '' },
      ),
    ).rejects.toThrow();

    const transformed = await pipe.transform(
      {
        durationSeconds: '95',
        eventType: 'closed',
        adminOnly: true,
      },
      { type: 'body', metatype: recordProviderBookingDetailViewBodyMetatype() as never, data: '' },
    );

    expect(transformed).toEqual({
      durationSeconds: 95,
      eventType: 'closed',
    });
  });
});
