import { BadRequestException } from '@nestjs/common';
import { ParticipantStatus, PaymentMethod } from '@prisma/client';

import {
  addProviderMatchingDistance,
  assertBookingPaymentMethod,
  assertBookingServiceId,
  bookingAddressText,
  bookingDispatchCoordinates,
  calculateDistanceMeters,
  formatMatchingRadius,
  isMarketplacePartnerAction,
  isCustomerSelectableParticipantForFinalChoice,
  normalizeBookingCoordinate,
  providerLocationFreshEnough,
  vietnamBookingCoordinateGateError,
} from './bookings.policy';

describe('booking policy helpers', () => {
  it('allows customer final selection for accepted partners and joined marketplace partners', () => {
    expect(
      isCustomerSelectableParticipantForFinalChoice(
        { status: ParticipantStatus.ACCEPTED, providerProfileId: 'first-pick' },
        'first-pick',
      ),
    ).toBe(true);
    expect(
      isCustomerSelectableParticipantForFinalChoice(
        { status: ParticipantStatus.JOINED, providerProfileId: 'marketplace-partner' },
        'first-pick',
      ),
    ).toBe(true);
  });

  it('does not allow final selection for the preferred partner until that partner accepts', () => {
    expect(
      isCustomerSelectableParticipantForFinalChoice(
        { status: ParticipantStatus.JOINED, providerProfileId: 'first-pick' },
        'first-pick',
      ),
    ).toBe(false);
  });

  it('applies marketplace wallet gate only to non-preferred partner actions', () => {
    expect(isMarketplacePartnerAction('first-pick', 'first-pick')).toBe(false);
    expect(isMarketplacePartnerAction('marketplace-partner', 'first-pick')).toBe(true);
    expect(isMarketplacePartnerAction('partner-without-first-pick', null)).toBe(true);
  });

  it('uses immutable booking address snapshot before mutable booking coordinates for dispatch distance', () => {
    const booking = {
      lat: 11,
      lng: 107,
      addressSnapshot: { latitude: 10.7769, longitude: 106.7009 },
    };

    expect(bookingDispatchCoordinates(booking)).toEqual({ lat: 10.7769, lng: 106.7009 });
    expect(addProviderMatchingDistance(booking, { currentLat: 10.7814, currentLng: 106.7051 }).distanceMeters).toBe(
      700,
    );
  });

  it('falls back to booking coordinates when address snapshot coordinates are incomplete', () => {
    expect(
      bookingDispatchCoordinates({
        lat: 10.7769,
        lng: 106.7009,
        addressSnapshot: { latitude: null, longitude: null },
      }),
    ).toEqual({ lat: 10.7769, lng: 106.7009 });
  });

  it('returns null distance when booking or partner coordinates are invalid', () => {
    expect(calculateDistanceMeters(10.7769, 106.7009, null, 106.7051)).toBeNull();
    expect(calculateDistanceMeters(Number.NaN, 106.7009, 10.7814, 106.7051)).toBeNull();
  });

  it('extracts address text from common address payload shapes', () => {
    expect(bookingAddressText({ address_text: 'District 1, Ho Chi Minh City' })).toBe(
      'District 1, Ho Chi Minh City',
    );
    expect(bookingAddressText('  Da Nang, Vietnam  ')).toBe('Da Nang, Vietnam');
    expect(bookingAddressText({ unknown: 'ignored' })).toBeNull();
  });

  it('keeps service id, payment method, coordinate, and Vietnam service area gates explicit', () => {
    expect(() => assertBookingServiceId('service-1')).not.toThrow();
    expect(() => assertBookingServiceId('')).toThrow(BadRequestException);
    expect(() => assertBookingPaymentMethod(PaymentMethod.CASH)).not.toThrow();
    expect(() => assertBookingPaymentMethod('CARD')).toThrow(BadRequestException);
    expect(normalizeBookingCoordinate('10.7769', 'lat')).toBe(10.7769);
    expect(() => normalizeBookingCoordinate(undefined, 'lng')).toThrow(BadRequestException);
    expect(vietnamBookingCoordinateGateError(10.7769, 106.7009)).toBeNull();
    expect(vietnamBookingCoordinateGateError(13.7563, 100.5018)).toEqual({
      message: 'Booking address must be inside Vietnam',
    });
  });

  it('checks partner location freshness for marketplace participation', () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now);

    expect(providerLocationFreshEnough(new Date(now - 9 * 60_000), 10)).toBe(true);
    expect(providerLocationFreshEnough(new Date(now - 11 * 60_000), 10)).toBe(false);
    expect(providerLocationFreshEnough('not-a-date', 10)).toBe(false);

    jest.restoreAllMocks();
  });

  it('formats marketplace radius for partner-facing block messages', () => {
    expect(formatMatchingRadius(10000)).toBe('10km');
    expect(formatMatchingRadius(750)).toBe('750m');
  });
});
