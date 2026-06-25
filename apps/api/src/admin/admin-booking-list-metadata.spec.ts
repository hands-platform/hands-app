import { BookingStatus } from '@prisma/client';
import {
  adminBookingListMetadataPayload,
  bookingServiceAddressText,
} from './admin-booking-list-metadata';

describe('admin booking list metadata', () => {
  it('prefers real booking address text over snapshot pin labels', () => {
    expect(
      bookingServiceAddressText({
        address: { formattedAddress: '88 Tran Phu, Da Nang' },
        addressSnapshot: {
          address: { label: 'Booking pin 16.0471, 108.2062' },
          addressText: null,
        },
        status: BookingStatus.OPEN_MATCHING,
      }),
    ).toBe('88 Tran Phu, Da Nang');
  });

  it('builds address text from parts before falling back to nested labels', () => {
    expect(
      bookingServiceAddressText({
        address: {
          address: { label: 'Selected pin 16.0471, 108.2062' },
          line1: '12 Nguyen Hue',
          city: 'Da Nang',
        },
        addressSnapshot: null,
        status: BookingStatus.CREATED,
      }),
    ).toBe('12 Nguyen Hue, Da Nang');
  });

  it('keeps booking list metadata to the fields needed by list UI', () => {
    expect(
      adminBookingListMetadataPayload({
        deviceLanguage: 'vi-VN',
        bookingGate: {
          bookingAddress: { lat: 10.7, lng: 106.7, addressText: 'Full address should stay detail-only' },
          customerCurrentLocation: { lat: 10.7, lng: 106.7 },
        },
        matchingPolicy: {
          providerResponseWindowMinutes: 10,
          marketplaceRadiusMeters: 10000,
          bookingMaxCustomerCurrentToAddressKm: 50,
        },
        backupNotificationTraces: [
          {
            stage: 'initial_open',
            createdAt: '2026-06-25T00:00:00.000Z',
            notifiedCount: 3,
            providers: [{ id: 'provider-1' }],
          },
        ],
      }),
    ).toEqual({
      deviceLanguage: 'vi-VN',
      matchingPolicy: {
        providerResponseWindowMinutes: 10,
        marketplaceRadiusMeters: 10000,
      },
      backupNotificationTraces: [
        {
          stage: 'initial_open',
          createdAt: '2026-06-25T00:00:00.000Z',
          notifiedCount: 3,
        },
      ],
    });
  });
});
