import {
  PARTNER_ACTIVE_LOCATION_MIN_INTERVAL_MINUTES,
  PARTNER_IDLE_LOCATION_MIN_DISTANCE_METERS,
  PARTNER_IDLE_LOCATION_MIN_INTERVAL_MINUTES,
  isVietnamServiceAreaCoordinate,
  providerLocationUpdateDecision,
} from './location-update-policy';

describe('providerLocationUpdateDecision', () => {
  const now = new Date('2026-06-22T12:00:00.000Z');

  it('allows the first provider location update', () => {
    expect(
      providerLocationUpdateDecision({
        previous: null,
        next: { lat: 10.7769, lng: 106.7009 },
        now,
        hasActiveBookingContext: false,
      }),
    ).toEqual({ allowed: true });
  });

  it('blocks idle updates that are too recent and nearby', () => {
    const decision = providerLocationUpdateDecision({
      previous: {
        lat: 10.7769,
        lng: 106.7009,
        recordedAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      },
      next: { lat: 10.7769, lng: 106.7109 },
      now,
      hasActiveBookingContext: false,
    });

    expect(decision).toEqual({ allowed: false, reason: 'TOO_FREQUENT_IDLE_LOCATION_UPDATE' });
  });

  it('allows idle updates after the minimum idle interval', () => {
    const decision = providerLocationUpdateDecision({
      previous: {
        lat: 10.7769,
        lng: 106.7009,
        recordedAt: new Date(
          now.getTime() - PARTNER_IDLE_LOCATION_MIN_INTERVAL_MINUTES * 60 * 1000,
        ).toISOString(),
      },
      next: { lat: 10.7769, lng: 106.7109 },
      now,
      hasActiveBookingContext: false,
    });

    expect(decision).toEqual({ allowed: true });
  });

  it('allows idle updates when the partner moved far enough', () => {
    const decision = providerLocationUpdateDecision({
      previous: {
        lat: 10.7769,
        lng: 106.7009,
        recordedAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
      },
      next: { lat: 10.7769, lng: 106.7009 + 0.04 },
      now,
      hasActiveBookingContext: false,
    });

    expect(decision).toEqual({ allowed: true });
    expect(PARTNER_IDLE_LOCATION_MIN_DISTANCE_METERS).toBe(3000);
  });

  it('blocks active-booking updates before the active interval passes', () => {
    const decision = providerLocationUpdateDecision({
      previous: {
        lat: 10.7769,
        lng: 106.7009,
        recordedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(),
      },
      next: { lat: 10.7769, lng: 106.7409 },
      now,
      hasActiveBookingContext: true,
    });

    expect(decision).toEqual({
      allowed: false,
      reason: 'TOO_FREQUENT_ACTIVE_BOOKING_LOCATION_UPDATE',
    });
  });

  it('allows active-booking updates after the active interval passes', () => {
    const decision = providerLocationUpdateDecision({
      previous: {
        lat: 10.7769,
        lng: 106.7009,
        recordedAt: new Date(
          now.getTime() - PARTNER_ACTIVE_LOCATION_MIN_INTERVAL_MINUTES * 60 * 1000,
        ).toISOString(),
      },
      next: { lat: 10.7769, lng: 106.7409 },
      now,
      hasActiveBookingContext: true,
    });

    expect(decision).toEqual({ allowed: true });
  });

  it('identifies coordinates inside the active Vietnam service area only', () => {
    expect(isVietnamServiceAreaCoordinate(10.7769, 106.7009)).toBe(true);
    expect(isVietnamServiceAreaCoordinate(21.0278, 105.8342)).toBe(true);
    expect(isVietnamServiceAreaCoordinate(37.5665, 126.978)).toBe(false);
    expect(isVietnamServiceAreaCoordinate(Number.NaN, 106.7009)).toBe(false);
  });
});
