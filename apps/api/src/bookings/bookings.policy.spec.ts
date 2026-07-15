import { BadRequestException } from '@nestjs/common';
import { BookingStatus, ParticipantStatus, PaymentMethod } from '@prisma/client';

import {
  addProviderMatchingDistance,
  assertBookingPaymentMethod,
  assertBookingServiceId,
  assertCustomerDirectCancellationAllowed,
  assertPartnerResponseWindowOpen,
  assertProviderLifecycleTransitionAllowed,
  bookingAddressText,
  bookingDispatchCoordinates,
  bookingHasPartnerCommitment,
  calculateDistanceMeters,
  formatMatchingRadius,
  isMarketplaceParticipationWindowOpen,
  isMarketplacePartnerAction,
  isCustomerSelectableParticipantForFinalChoice,
  normalizeBookingCoordinate,
  providerLifecycleAllowedPreviousStatuses,
  providerLocationFreshEnough,
  vietnamBookingCoordinateGateError,
} from './bookings.policy';
import { BACKUP_OPEN_AFTER_FIRST_PICK_DELAY, BACKUP_OPEN_IMMEDIATE } from '../matching/matching.policy';

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

  it('does not allow final selection for rejected or expired participants', () => {
    expect(
      isCustomerSelectableParticipantForFinalChoice(
        { status: ParticipantStatus.REJECTED, providerProfileId: 'marketplace-partner' },
        'first-pick',
      ),
    ).toBe(false);
    expect(
      isCustomerSelectableParticipantForFinalChoice(
        { status: ParticipantStatus.EXPIRED, providerProfileId: 'marketplace-partner' },
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
    expect(() => assertBookingPaymentMethod(PaymentMethod.CARD)).not.toThrow();
    expect(() => assertBookingPaymentMethod(PaymentMethod.MOMO)).not.toThrow();
    expect(() => assertBookingPaymentMethod(PaymentMethod.VNPAY)).not.toThrow();
    expect(() => assertBookingPaymentMethod(PaymentMethod.BANK_TRANSFER)).toThrow(BadRequestException);
    expect(() => assertBookingPaymentMethod(PaymentMethod.CUSTOMER_WALLET)).toThrow(BadRequestException);
    expect(() => assertBookingPaymentMethod(PaymentMethod.MANUAL)).toThrow(BadRequestException);
    expect(() => assertBookingPaymentMethod('NOT_A_METHOD')).toThrow(BadRequestException);
    expect(normalizeBookingCoordinate('10.7769', 'lat')).toBe(10.7769);
    expect(() => normalizeBookingCoordinate(undefined, 'lng')).toThrow(BadRequestException);
    expect(vietnamBookingCoordinateGateError(10.7769, 106.7009)).toBeNull();
    expect(vietnamBookingCoordinateGateError(0, 0)).toEqual({
      message: 'Booking address must be inside Vietnam',
    });
  });

  it('checks partner location freshness for marketplace participation', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);

    expect(providerLocationFreshEnough(new Date(now - 9 * 60_000), 10)).toBe(true);
    expect(providerLocationFreshEnough(new Date(now - 11 * 60_000), 10)).toBe(false);
    expect(providerLocationFreshEnough('not-a-date', 10)).toBe(false);

    vi.restoreAllMocks();
  });

  it('formats marketplace radius for partner-facing block messages', () => {
    expect(formatMatchingRadius(10000)).toBe('10km');
    expect(formatMatchingRadius(750)).toBe('750m');
  });

  it('opens marketplace participation immediately when policy allows it', () => {
    expect(
      isMarketplaceParticipationWindowOpen(
        {
          preferredProviderId: 'first-pick',
          openedAt: new Date('2026-06-07T01:00:00.000Z'),
        },
        { backupOpenMode: BACKUP_OPEN_IMMEDIATE, providerResponseWindowMinutes: 10 },
      ),
    ).toBe(true);
  });

  it('keeps marketplace participation open when legacy delayed policy values are present', () => {
    const openedAt = new Date('2026-06-07T01:00:00.000Z');
    vi.spyOn(Date, 'now').mockReturnValue(openedAt.getTime() + 9 * 60_000);

    expect(
      isMarketplaceParticipationWindowOpen(
        { preferredProviderId: 'first-pick', openedAt },
        { backupOpenMode: BACKUP_OPEN_AFTER_FIRST_PICK_DELAY, providerResponseWindowMinutes: 10 },
      ),
    ).toBe(true);

    vi.spyOn(Date, 'now').mockReturnValue(openedAt.getTime() + 10 * 60_000);

    expect(
      isMarketplaceParticipationWindowOpen(
        { preferredProviderId: 'first-pick', openedAt },
        { backupOpenMode: BACKUP_OPEN_AFTER_FIRST_PICK_DELAY, providerResponseWindowMinutes: 10 },
      ),
    ).toBe(true);

    vi.restoreAllMocks();
  });

  it('keeps marketplace participation open even when legacy delayed opening evidence is missing', () => {
    expect(
      isMarketplaceParticipationWindowOpen(
        { preferredProviderId: 'first-pick', openedAt: null },
        { backupOpenMode: BACKUP_OPEN_AFTER_FIRST_PICK_DELAY, providerResponseWindowMinutes: 10 },
      ),
    ).toBe(true);
  });

  it('opens marketplace participation when there is no first-pick or first-pick declined', () => {
    const policy = { backupOpenMode: BACKUP_OPEN_AFTER_FIRST_PICK_DELAY, providerResponseWindowMinutes: 10 };

    expect(isMarketplaceParticipationWindowOpen({ preferredProviderId: null }, policy)).toBe(true);
    expect(
      isMarketplaceParticipationWindowOpen(
        {
          preferredProviderId: 'first-pick',
          openedAt: new Date('2026-06-07T01:00:00.000Z'),
          participants: [{ providerProfileId: 'first-pick', status: ParticipantStatus.REJECTED }],
        },
        policy,
      ),
    ).toBe(true);
  });

  it('rejects partner responses after matching closes or the request expires', () => {
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);

    expect(() =>
      assertPartnerResponseWindowOpen({ status: BookingStatus.OPEN_MATCHING, expiresAt: future }),
    ).not.toThrow();
    expect(() =>
      assertPartnerResponseWindowOpen({ status: BookingStatus.MATCHED, expiresAt: future }),
    ).toThrow(BadRequestException);
    expect(() =>
      assertPartnerResponseWindowOpen({ status: BookingStatus.OPEN_MATCHING, expiresAt: past }),
    ).toThrow(BadRequestException);
  });

  it('allows customer direct cancellation only before partner commitment', () => {
    expect(() =>
      assertCustomerDirectCancellationAllowed({
        status: BookingStatus.OPEN_MATCHING,
        selectedProviderId: null,
        participants: [{ status: ParticipantStatus.JOINED }],
      }),
    ).not.toThrow();

    expect(() =>
      assertCustomerDirectCancellationAllowed({
        status: BookingStatus.OPEN_MATCHING,
        selectedProviderId: null,
        participants: [{ status: ParticipantStatus.ACCEPTED }],
      }),
    ).toThrow('Matched bookings cannot be cancelled directly');

    expect(() =>
      assertCustomerDirectCancellationAllowed({
        status: BookingStatus.MATCHED,
        selectedProviderId: 'partner-1',
        participants: [{ status: ParticipantStatus.ACCEPTED }],
      }),
    ).toThrow('Matched bookings cannot be cancelled directly');

    expect(() =>
      assertCustomerDirectCancellationAllowed({
        status: BookingStatus.COMPLETED,
        selectedProviderId: 'partner-1',
        participants: [],
      }),
    ).toThrow('Booking cannot be cancelled in its current state');
  });

  it('detects booking partner commitment from status, final partner, or accepted participant', () => {
    expect(
      bookingHasPartnerCommitment({
        status: BookingStatus.OPEN_MATCHING,
        selectedProviderId: null,
        participants: [{ status: ParticipantStatus.JOINED }],
      }),
    ).toBe(false);
    expect(
      bookingHasPartnerCommitment({
        status: BookingStatus.OPEN_MATCHING,
        selectedProviderId: null,
        participants: [{ status: ParticipantStatus.ACCEPTED }],
      }),
    ).toBe(true);
    expect(
      bookingHasPartnerCommitment({
        status: BookingStatus.OPEN_MATCHING,
        selectedProviderId: 'partner-1',
        participants: [],
      }),
    ).toBe(true);
    expect(bookingHasPartnerCommitment({ status: BookingStatus.MATCHED, participants: [] })).toBe(true);
  });

  it('requires service completion to start from IN_SERVICE', () => {
    expect(() =>
      assertProviderLifecycleTransitionAllowed(BookingStatus.IN_SERVICE, [BookingStatus.IN_SERVICE]),
    ).not.toThrow();
    expect(() =>
      assertProviderLifecycleTransitionAllowed(BookingStatus.MATCHED, [BookingStatus.IN_SERVICE]),
    ).toThrow(BadRequestException);
  });

  it('keeps provider lifecycle previous-status rules centralized', () => {
    expect(providerLifecycleAllowedPreviousStatuses(BookingStatus.ARRIVED)).toEqual([
      BookingStatus.MATCHED,
      BookingStatus.PROVIDER_ON_THE_WAY,
    ]);
    expect(providerLifecycleAllowedPreviousStatuses(BookingStatus.IN_SERVICE)).toEqual([
      BookingStatus.MATCHED,
      BookingStatus.PROVIDER_ON_THE_WAY,
      BookingStatus.ARRIVED,
    ]);
    expect(providerLifecycleAllowedPreviousStatuses(BookingStatus.COMPLETED)).toEqual([
      BookingStatus.IN_SERVICE,
    ]);
    expect(providerLifecycleAllowedPreviousStatuses(BookingStatus.PROVIDER_ON_THE_WAY)).toBeNull();
  });
});
