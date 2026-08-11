import {
  BookingStatus,
  ProviderAvailabilityIntent,
  ProviderAvailabilityReason,
  ProviderStatus,
} from '@prisma/client';

export const PROVIDER_AVAILABILITY_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const PROVIDER_INACTIVITY_DAYS = 7;
export const ACTIVE_PROVIDER_AVAILABILITY_BOOKING_STATUSES = new Set<BookingStatus>([
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
]);

export type ProviderWorkingHourInput = {
  readonly weekday: number;
  readonly enabled: boolean;
  readonly startMinute: number;
  readonly endMinute: number;
};

export type ProviderAvailabilityResolution = {
  readonly activeBookingCount: number;
  readonly availabilityIntent: ProviderAvailabilityIntent;
  readonly availabilityReason: ProviderAvailabilityReason;
  readonly currentMinute: number;
  readonly currentWeekday: number;
  readonly scheduleConfigured: boolean;
  readonly status: ProviderStatus;
  readonly todayWindowLabel: string;
  readonly withinWorkingHours: boolean;
};

export type ProviderAppActivitySources = {
  readonly appSessionLastSeenAt?: Date | null;
  readonly currentLocationUpdatedAt?: Date | null;
  readonly explicitAvailabilityChangedAt?: Date | null;
  readonly providerSessionLastSeenAt?: Date | null;
  readonly usageLastOccurredAt?: Date | null;
  readonly userCreatedAt?: Date | null;
};

export function resolveProviderAvailability(input: {
  readonly activeBookingCount?: number;
  readonly availabilityIntent: ProviderAvailabilityIntent;
  readonly lastAppActivityAt?: Date | null;
  readonly now?: Date;
  readonly timezone?: string | null;
  readonly workingHours?: readonly ProviderWorkingHourInput[];
}): ProviderAvailabilityResolution {
  const now = input.now ?? new Date();
  const schedule = providerWorkingHoursSnapshot(
    input.workingHours ?? [],
    now,
    input.timezone || PROVIDER_AVAILABILITY_TIMEZONE,
  );
  const activeBookingCount = Math.max(0, Math.trunc(input.activeBookingCount ?? 0));

  if (activeBookingCount > 0) {
    return {
      ...schedule,
      activeBookingCount,
      availabilityIntent: input.availabilityIntent,
      availabilityReason: ProviderAvailabilityReason.ACTIVE_BOOKING,
      status: ProviderStatus.ONLINE_BUSY,
    };
  }

  if (isProviderInactive(input.lastAppActivityAt, now)) {
    return {
      ...schedule,
      activeBookingCount,
      availabilityIntent: ProviderAvailabilityIntent.OFFLINE,
      availabilityReason: ProviderAvailabilityReason.INACTIVE_7D,
      status: ProviderStatus.OFFLINE,
    };
  }

  if (input.availabilityIntent === ProviderAvailabilityIntent.OFFLINE) {
    return {
      ...schedule,
      activeBookingCount,
      availabilityIntent: input.availabilityIntent,
      availabilityReason: ProviderAvailabilityReason.MANUAL_OFFLINE,
      status: ProviderStatus.OFFLINE,
    };
  }

  if (schedule.scheduleConfigured && !schedule.withinWorkingHours) {
    return {
      ...schedule,
      activeBookingCount,
      availabilityIntent: input.availabilityIntent,
      availabilityReason: ProviderAvailabilityReason.OUTSIDE_WORKING_HOURS,
      status: ProviderStatus.OFFLINE,
    };
  }

  return {
    ...schedule,
    activeBookingCount,
    availabilityIntent: input.availabilityIntent,
    availabilityReason: ProviderAvailabilityReason.MANUAL_AVAILABLE,
    status: ProviderStatus.ONLINE_AVAILABLE,
  };
}

export function providerWorkingHoursSnapshot(
  workingHours: readonly ProviderWorkingHourInput[],
  now: Date,
  timezone = PROVIDER_AVAILABILITY_TIMEZONE,
) {
  const { minute, weekday } = zonedWeekdayAndMinute(now, timezone);
  const today = workingHours.find((row) => row.weekday === weekday) ?? null;
  const scheduleConfigured = workingHours.length > 0;
  const withinWorkingHours = !scheduleConfigured
    ? true
    : Boolean(today?.enabled && minute >= today.startMinute && minute < today.endMinute);

  return {
    currentMinute: minute,
    currentWeekday: weekday,
    scheduleConfigured,
    todayWindowLabel: !scheduleConfigured
      ? 'No schedule saved'
      : today?.enabled
        ? `${minuteLabel(today.startMinute)}-${minuteLabel(today.endMinute)}`
        : 'Day off',
    withinWorkingHours,
  };
}

export function isProviderInactive(lastAppActivityAt: Date | null | undefined, now = new Date()) {
  if (!lastAppActivityAt) return false;
  return lastAppActivityAt.getTime() <= now.getTime() - PROVIDER_INACTIVITY_DAYS * 24 * 60 * 60_000;
}

export function providerLastAppActivityAt(input: ProviderAppActivitySources) {
  const candidates = [
    input.appSessionLastSeenAt,
    input.currentLocationUpdatedAt,
    input.explicitAvailabilityChangedAt,
    input.providerSessionLastSeenAt,
    input.usageLastOccurredAt,
    input.userCreatedAt,
  ].filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()));

  return candidates.reduce<Date | null>(
    (latest, value) => (!latest || value.getTime() > latest.getTime() ? value : latest),
    null,
  );
}

export function isProviderReadyForDispatchStatus(status: ProviderStatus) {
  return status === ProviderStatus.ONLINE_AVAILABLE;
}

export function validateProviderWorkingHours(rows: readonly ProviderWorkingHourInput[]) {
  if (rows.length !== 7) {
    throw new Error('Working hours must contain one row for each weekday');
  }
  const weekdays = new Set<number>();
  for (const row of rows) {
    if (!Number.isInteger(row.weekday) || row.weekday < 1 || row.weekday > 7) {
      throw new Error('Working hours weekday must be between 1 and 7');
    }
    if (weekdays.has(row.weekday)) {
      throw new Error('Working hours cannot contain duplicate weekdays');
    }
    weekdays.add(row.weekday);
    if (
      !Number.isInteger(row.startMinute) ||
      !Number.isInteger(row.endMinute) ||
      row.startMinute < 0 ||
      row.startMinute > 1439 ||
      row.endMinute < 1 ||
      row.endMinute > 1440 ||
      row.startMinute >= row.endMinute
    ) {
      throw new Error('Working hours must use a valid same-day start and end time');
    }
  }
}

function zonedWeekdayAndMinute(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: timezone,
    weekday: 'short',
  }).formatToParts(value);
  const valueFor = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const weekday = WEEKDAY_BY_SHORT_NAME[valueFor('weekday')];
  const hour = Number(valueFor('hour'));
  const minute = Number(valueFor('minute'));
  if (!weekday || !Number.isInteger(hour) || !Number.isInteger(minute)) {
    throw new Error(`Unable to resolve provider working hours in ${timezone}`);
  }
  return { minute: hour * 60 + minute, weekday };
}

function minuteLabel(value: number) {
  if (value === 1440) return '24:00';
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const WEEKDAY_BY_SHORT_NAME: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};
