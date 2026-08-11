import {
  ProviderAvailabilityIntent,
  ProviderAvailabilityReason,
  ProviderStatus,
} from '@prisma/client';
import { describe, expect, it } from 'vitest';
import {
  isProviderInactive,
  isProviderReadyForDispatchStatus,
  providerLastAppActivityAt,
  providerWorkingHoursSnapshot,
  resolveProviderAvailability,
  validateProviderWorkingHours,
} from './provider-availability';

const weekdaySchedule = Array.from({ length: 7 }, (_, index) => ({
  weekday: index + 1,
  enabled: index < 5,
  startMinute: 9 * 60,
  endMinute: 18 * 60,
}));

describe('provider availability', () => {
  it('resolves Vietnam weekday schedules without using the host timezone', () => {
    const snapshot = providerWorkingHoursSnapshot(
      weekdaySchedule,
      new Date('2026-07-20T03:00:00.000Z'),
    );

    expect(snapshot).toEqual({
      currentMinute: 600,
      currentWeekday: 1,
      scheduleConfigured: true,
      todayWindowLabel: '09:00-18:00',
      withinWorkingHours: true,
    });
  });

  it('keeps a manual offline intent offline during working hours', () => {
    const result = resolveProviderAvailability({
      availabilityIntent: ProviderAvailabilityIntent.OFFLINE,
      now: new Date('2026-07-20T03:00:00.000Z'),
      workingHours: weekdaySchedule,
    });

    expect(result.status).toBe(ProviderStatus.OFFLINE);
    expect(result.availabilityReason).toBe(ProviderAvailabilityReason.MANUAL_OFFLINE);
  });

  it('turns an available intent off outside saved working hours', () => {
    const result = resolveProviderAvailability({
      availabilityIntent: ProviderAvailabilityIntent.AVAILABLE,
      now: new Date('2026-07-20T13:30:00.000Z'),
      workingHours: weekdaySchedule,
    });

    expect(result.status).toBe(ProviderStatus.OFFLINE);
    expect(result.availabilityReason).toBe(ProviderAvailabilityReason.OUTSIDE_WORKING_HOURS);
  });

  it('gives an active booking priority over a manual available intent', () => {
    const result = resolveProviderAvailability({
      activeBookingCount: 1,
      availabilityIntent: ProviderAvailabilityIntent.AVAILABLE,
      now: new Date('2026-07-20T03:00:00.000Z'),
      workingHours: weekdaySchedule,
    });

    expect(result.status).toBe(ProviderStatus.ONLINE_BUSY);
    expect(result.availabilityReason).toBe(ProviderAvailabilityReason.ACTIVE_BOOKING);
  });

  it('marks a tracked Partner inactive at the exact seven-day boundary', () => {
    const now = new Date('2026-07-20T03:00:00.000Z');
    const result = resolveProviderAvailability({
      availabilityIntent: ProviderAvailabilityIntent.AVAILABLE,
      lastAppActivityAt: new Date('2026-07-13T03:00:00.000Z'),
      now,
      workingHours: weekdaySchedule,
    });

    expect(isProviderInactive(new Date('2026-07-13T03:00:00.000Z'), now)).toBe(true);
    expect(result.status).toBe(ProviderStatus.OFFLINE);
    expect(result.availabilityIntent).toBe(ProviderAvailabilityIntent.OFFLINE);
    expect(result.availabilityReason).toBe(ProviderAvailabilityReason.INACTIVE_7D);
  });

  it('uses the latest durable app, session, or location evidence for inactivity', () => {
    const latest = providerLastAppActivityAt({
      appSessionLastSeenAt: new Date('2026-07-18T03:00:00.000Z'),
      currentLocationUpdatedAt: new Date('2026-07-17T03:00:00.000Z'),
      explicitAvailabilityChangedAt: new Date('2026-07-19T03:00:00.000Z'),
      providerSessionLastSeenAt: new Date('2026-07-16T03:00:00.000Z'),
      usageLastOccurredAt: null,
      userCreatedAt: new Date('2026-07-01T03:00:00.000Z'),
    });

    expect(latest).toEqual(new Date('2026-07-19T03:00:00.000Z'));
  });

  it('falls back to account creation when a Partner has never emitted app telemetry', () => {
    const now = new Date('2026-07-20T03:00:00.000Z');
    const lastActivityAt = providerLastAppActivityAt({
      userCreatedAt: new Date('2026-07-13T03:00:00.000Z'),
    });

    expect(isProviderInactive(lastActivityAt, now)).toBe(true);
  });

  it('counts only immediately available Partners as dispatch-ready supply', () => {
    expect(isProviderReadyForDispatchStatus(ProviderStatus.ONLINE_AVAILABLE)).toBe(true);
    expect(isProviderReadyForDispatchStatus(ProviderStatus.ONLINE_BUSY)).toBe(false);
    expect(isProviderReadyForDispatchStatus(ProviderStatus.ONLINE_AVAILABLE_SOON)).toBe(false);
    expect(isProviderReadyForDispatchStatus(ProviderStatus.OFFLINE)).toBe(false);
  });

  it('requires exactly one valid schedule row per weekday', () => {
    expect(() => validateProviderWorkingHours(weekdaySchedule)).not.toThrow();
    expect(() => validateProviderWorkingHours(weekdaySchedule.slice(0, 6))).toThrow(
      'one row for each weekday',
    );
    expect(() =>
      validateProviderWorkingHours([...weekdaySchedule.slice(0, 6), weekdaySchedule[0]]),
    ).toThrow('duplicate weekdays');
  });
});
