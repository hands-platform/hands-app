import { BookingStatus } from '@prisma/client';
import {
  adminBookingListMetadataPayload,
  bookingServiceAddressText,
  protectAdminBookingListItem,
  withAdminBookingListMetadata,
} from './admin-booking-list-metadata';

describe('admin booking list metadata', () => {
  it('classifies live, anomalous, backlog, and explicit test records on the server', () => {
    const now = new Date('2026-07-18T05:00:00.000Z');
    const liveBoundary = new Date('2026-07-17T05:00:00.000Z');

    expect(
      withAdminBookingListMetadata(
        {
          id: 'booking-live',
          status: BookingStatus.IN_SERVICE,
          updatedAt: liveBoundary,
        },
        now,
      ),
    ).toMatchObject({
      dataClass: 'live',
      lastEventAt: liveBoundary,
      scopeEnd: now,
      scopeStart: liveBoundary,
      sourceUpdatedAt: liveBoundary,
    });
    expect(
      withAdminBookingListMetadata(
        {
          id: 'booking-stale',
          status: BookingStatus.MATCHED,
          updatedAt: new Date(liveBoundary.getTime() - 1),
        },
        now,
      ).dataClass,
    ).toBe('anomaly');
    expect(
      withAdminBookingListMetadata(
        {
          id: 'booking-closed',
          status: BookingStatus.COMPLETED,
          updatedAt: new Date('2026-07-01T05:00:00.000Z'),
        },
        now,
      ).dataClass,
    ).toBe('backlog');
    expect(
      withAdminBookingListMetadata(
        {
          id: 'seed-booking',
          status: BookingStatus.OPEN_MATCHING,
          updatedAt: now,
        },
        now,
      ).dataClass,
    ).toBe('test');
    expect(
      withAdminBookingListMetadata(
        {
          id: 'booking-explicit-fixture',
          metadata: { smokeFixture: true },
          status: BookingStatus.OPEN_MATCHING,
          updatedAt: now,
        },
        now,
      ).dataClass,
    ).toBe('test');
  });

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
        postMatchCancellation: {
          reasonCode: 'CUSTOMER_NOT_FOUND',
          reasonLabel: 'Could not meet customer',
          detail: 'This detail remains on the booking detail page.',
          requiresAdminReview: true,
          autoApproved: false,
          minutesAfterMatch: 30,
        },
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
      postMatchCancellation: {
        reasonCode: 'CUSTOMER_NOT_FOUND',
        reasonLabel: 'Could not meet customer',
        requiresAdminReview: true,
        autoApproved: false,
      },
    });
  });

  it('removes exact booking PII from list responses while keeping a safe area summary', () => {
    const protectedBooking = protectAdminBookingListItem({
      address: {
        street: '12 Nguyen Hue',
        ward: 'Ben Nghe',
        district: 'District 1',
        city: 'Ho Chi Minh City',
      },
      addressSnapshot: {
        addressText: '12 Nguyen Hue, Ben Nghe, District 1, Ho Chi Minh City',
        latitude: 10.7756,
        longitude: 106.7019,
      },
      customerProfile: {
        id: 'customer-1',
        user: { fullName: 'Synthetic Customer', phone: '+84912345678' },
      },
      lat: 10.7756,
      lng: 106.7019,
    });

    expect(protectedBooking).toMatchObject({
      address: null,
      addressSnapshot: {
        addressText: 'Ben Nghe, District 1, Ho Chi Minh City',
        latitude: null,
        longitude: null,
      },
      customerProfile: {
        user: { phone: '+84*****5678' },
      },
      lat: null,
      lng: null,
      serviceAddressText: 'Ben Nghe, District 1, Ho Chi Minh City',
    });
    expect(JSON.stringify(protectedBooking)).not.toContain('+84912345678');
    expect(JSON.stringify(protectedBooking)).not.toContain('12 Nguyen Hue');
    expect(JSON.stringify(protectedBooking)).not.toContain('10.7756');
  });

  it('does not derive a list address from an unstructured full address', () => {
    const protectedBooking = protectAdminBookingListItem({
      address: { formattedAddress: '12 Nguyen Hue, District 1, Ho Chi Minh City' },
      addressSnapshot: { addressText: '12 Nguyen Hue, District 1, Ho Chi Minh City' },
    });

    expect(protectedBooking.serviceAddressText).toBeNull();
    expect(JSON.stringify(protectedBooking)).not.toContain('12 Nguyen Hue');
  });
});
