import {
  bookingCreationFingerprint,
  bookingCreationLockKey,
  bookingCreationRequestFromMetadata,
  bookingCreationRequestMetadata,
} from './bookings.creation-idempotency';

describe('booking creation idempotency', () => {
  it('builds a customer-scoped advisory lock key', () => {
    expect(bookingCreationLockKey('customer-1', 'booking-request-1')).toBe(
      'customer-booking:customer-1:booking-request-1',
    );
  });

  it('creates the same fingerprint for semantically identical object key order', () => {
    const first = bookingCreationFingerprint({
      address: { line1: 'District 1', phone: '0865907184', name: 'Customer' },
      lat: 10.7769,
      lng: 106.7009,
      paymentMethod: 'CASH',
      serviceId: 'service-1',
    });
    const second = bookingCreationFingerprint({
      serviceId: 'service-1',
      paymentMethod: 'CASH',
      lng: 106.7009,
      lat: 10.7769,
      address: { name: 'Customer', phone: '0865907184', line1: 'District 1' },
    });

    expect(second).toBe(first);
  });

  it('reads the stored key and fingerprint only when both are present', () => {
    const request = bookingCreationRequestMetadata('booking-request-1', 'fingerprint-1');

    expect(bookingCreationRequestFromMetadata({ bookingCreationRequest: request })).toEqual(request);
    expect(
      bookingCreationRequestFromMetadata({ bookingCreationRequest: { idempotencyKey: 'booking-request-1' } }),
    ).toBeUndefined();
  });
});
