import { BookingStatus, PrismaClient, ProviderStatus } from '@prisma/client';
import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
const apiBaseUrl = String(env.API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/+$/, '');
const otp = env.PROVIDER_AVAILABILITY_SMOKE_OTP ?? env.DEV_OTP ?? '123456';
const configuredPhone = env.PROVIDER_AVAILABILITY_SMOKE_PHONE?.trim() || null;
const prisma = new PrismaClient();
const activeStatuses = [
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
];

let bookingBackup = null;
let providerBackup = null;
let smokeDeviceId = null;

try {
  await request('/health');
  const provider = await selectSmokeProvider();
  providerBackup = {
    id: provider.id,
    status: provider.status,
    availabilityIntent: provider.availabilityIntent,
    availabilityReason: provider.availabilityReason,
    availabilityChangedAt: provider.availabilityChangedAt,
    workingHoursTimezone: provider.workingHoursTimezone,
    workingHours: provider.workingHours,
  };

  const auth = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: provider.user.phone, otp, role: 'PROVIDER' }),
  });
  const headers = { authorization: `Bearer ${auth.accessToken}` };
  const allDay = scheduleForAllDays(0, 1440);
  const outside = outsideCurrentMinuteSchedule();
  const checks = [];

  smokeDeviceId = `provider-availability-smoke-${Date.now()}`;
  const deviceSession = await request('/partner/device-session', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      deviceId: smokeDeviceId,
      platform: 'smoke',
      appVersion: 'provider-availability-smoke',
    }),
  });
  if (deviceSession.blocked || deviceSession.providerBlocked || deviceSession.ok !== true) {
    throw new Error('Smoke Partner device session could not be activated');
  }
  checks.push({ step: 'device-session', ok: true });

  checks.push(snapshot('initial', await request('/provider/availability', { headers })));
  checks.push(
    assertAvailability(
      'manual-on',
      await request('/provider/online', { method: 'POST', headers }),
      ProviderStatus.ONLINE_AVAILABLE,
      'MANUAL_AVAILABLE',
    ),
  );
  checks.push(
    assertAvailability(
      'all-day-schedule',
      await request('/provider/availability', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ workingHours: allDay }),
      }),
      ProviderStatus.ONLINE_AVAILABLE,
      'MANUAL_AVAILABLE',
    ),
  );
  checks.push(
    assertAvailability(
      'outside-hours',
      await request('/provider/availability', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ workingHours: outside }),
      }),
      ProviderStatus.OFFLINE,
      'OUTSIDE_WORKING_HOURS',
    ),
  );
  checks.push(
    assertAvailability(
      'manual-on-held-by-schedule',
      await request('/provider/online', { method: 'POST', headers }),
      ProviderStatus.OFFLINE,
      'OUTSIDE_WORKING_HOURS',
    ),
  );
  checks.push(
    assertAvailability(
      'schedule-reopened',
      await request('/provider/availability', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ workingHours: allDay }),
      }),
      ProviderStatus.ONLINE_AVAILABLE,
      'MANUAL_AVAILABLE',
    ),
  );

  const activeBooking = await prisma.booking.findFirst({
    where: { status: { in: activeStatuses }, selectedProviderId: { not: provider.id } },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, selectedProviderId: true },
  });
  if (!activeBooking) throw new Error('No active seed booking is available for the Busy transition smoke');
  bookingBackup = activeBooking;
  await prisma.booking.update({
    where: { id: activeBooking.id },
    data: { selectedProviderId: provider.id },
  });
  checks.push(
    assertAvailability(
      'active-booking-busy',
      await request('/provider/online', { method: 'POST', headers }),
      ProviderStatus.ONLINE_BUSY,
      'ACTIVE_BOOKING',
    ),
  );

  await restoreBooking();
  checks.push(
    assertAvailability(
      'booking-closed-ready',
      await request('/provider/online', { method: 'POST', headers }),
      ProviderStatus.ONLINE_AVAILABLE,
      'MANUAL_AVAILABLE',
    ),
  );
  checks.push(
    assertAvailability(
      'manual-off',
      await request('/provider/offline', { method: 'POST', headers }),
      ProviderStatus.OFFLINE,
      'MANUAL_OFFLINE',
    ),
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        apiBaseUrl,
        provider: { id: provider.id, displayName: provider.displayName, phone: maskPhone(provider.user.phone) },
        checks,
        cleanup: 'Original Partner availability and working hours restored',
      },
      null,
      2,
    ),
  );
} finally {
  await restoreBooking();
  await restoreProvider();
  await prisma.$disconnect();
}

async function selectSmokeProvider() {
  return prisma.providerProfile.findFirstOrThrow({
    where: {
      deletedAt: null,
      status: ProviderStatus.OFFLINE,
      user: configuredPhone
        ? { phone: configuredPhone, roles: { has: 'PROVIDER' } }
        : { roles: { has: 'PROVIDER' } },
      selectedBookings: { none: { status: { in: activeStatuses } } },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      displayName: true,
      status: true,
      availabilityIntent: true,
      availabilityReason: true,
      availabilityChangedAt: true,
      workingHoursTimezone: true,
      workingHours: {
        orderBy: { weekday: 'asc' },
        select: { weekday: true, enabled: true, startMinute: true, endMinute: true },
      },
      user: { select: { phone: true } },
    },
  });
}

async function restoreBooking() {
  if (!bookingBackup) return;
  const backup = bookingBackup;
  bookingBackup = null;
  await prisma.booking.update({
    where: { id: backup.id },
    data: { selectedProviderId: backup.selectedProviderId },
  });
}

async function restoreProvider() {
  if (!providerBackup) return;
  const backup = providerBackup;
  providerBackup = null;
  await prisma.$transaction(async (tx) => {
    if (smokeDeviceId) {
      await tx.providerSession.deleteMany({
        where: { providerProfileId: backup.id, deviceId: smokeDeviceId },
      });
      await tx.providerDevice.deleteMany({
        where: { providerProfileId: backup.id, deviceId: smokeDeviceId },
      });
    }
    await tx.providerWorkingHour.deleteMany({ where: { providerProfileId: backup.id } });
    if (backup.workingHours.length > 0) {
      await tx.providerWorkingHour.createMany({
        data: backup.workingHours.map((row) => ({ ...row, providerProfileId: backup.id })),
      });
    }
    await tx.providerProfile.update({
      where: { id: backup.id },
      data: {
        status: backup.status,
        availabilityIntent: backup.availabilityIntent,
        availabilityReason: backup.availabilityReason,
        availabilityChangedAt: backup.availabilityChangedAt,
        workingHoursTimezone: backup.workingHoursTimezone,
      },
    });
  });
  smokeDeviceId = null;
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
}

function assertAvailability(step, response, status, reason) {
  if (response.status !== status || response.availabilityReason !== reason) {
    throw new Error(
      `${step} expected ${status}/${reason}, received ${response.status}/${response.availabilityReason}`,
    );
  }
  return snapshot(step, response);
}

function snapshot(step, response) {
  return {
    step,
    status: response.status,
    reason: response.availabilityReason,
    intent: response.availabilityIntent,
    scheduleConfigured: response.scheduleConfigured,
    withinWorkingHours: response.withinWorkingHours,
  };
}

function scheduleForAllDays(startMinute, endMinute) {
  return Array.from({ length: 7 }, (_, index) => ({
    weekday: index + 1,
    enabled: true,
    startMinute,
    endMinute,
  }));
}

function outsideCurrentMinuteSchedule() {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  const currentMinute = hour * 60 + minute;
  return currentMinute === 0 ? scheduleForAllDays(2, 3) : scheduleForAllDays(0, 1);
}

function maskPhone(phone) {
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}
