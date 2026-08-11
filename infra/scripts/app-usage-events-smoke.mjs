import { randomUUID } from 'node:crypto';

import { AppUsageEventType, AppUsageOrigin, PrismaClient, Role } from '@prisma/client';
import jwt from 'jsonwebtoken';

import { loadMergedEnv } from './lib/env-file.mjs';

const { env } = loadMergedEnv('.env');
const apiBaseUrl = trimTrailingSlash(env.API_BASE_URL ?? 'http://localhost:3000/api');
const databaseUrl = env.DATABASE_URL?.trim();
const accessSecret = usableSecret(env.JWT_ACCESS_SECRET) ?? 'dev-access-secret';

assertLocalTarget(apiBaseUrl, env.NODE_ENV);
assert(databaseUrl, 'DATABASE_URL is required for app usage event smoke.');
process.env.DATABASE_URL ??= databaseUrl;

const prisma = new PrismaClient();
const runId = `app-usage-smoke-${randomUUID()}`;
const customerDeviceId = `${runId}-customer-device`;
const providerDeviceId = `${runId}-provider-device`;
let customer;
let provider;
let aggregateDay;
let originalDailyAggregate = null;
let originalProviderDailyAggregate = null;
let originalProfileView = null;

try {
  customer = await prisma.customerProfile.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true, userId: true },
  });
  provider = await prisma.providerProfile.findFirst({
    where: { blockedAt: null, deletedAt: null },
    orderBy: { id: 'asc' },
    select: { id: true, userId: true },
  });
  assert(customer, 'A customer profile is required for app usage event smoke.');
  assert(provider, 'An available Partner profile is required for app usage event smoke.');

  aggregateDay = vietnamCalendarDay(new Date());
  originalDailyAggregate = await prisma.appUsageDailyAggregate.findUnique({
    where: {
      userId_role_day_origin: {
        day: aggregateDay,
        origin: AppUsageOrigin.PRODUCTION,
        role: Role.CUSTOMER,
        userId: customer.userId,
      },
    },
  });
  originalProviderDailyAggregate = await prisma.appUsageDailyAggregate.findUnique({
    where: {
      userId_role_day_origin: {
        day: aggregateDay,
        origin: AppUsageOrigin.PRODUCTION,
        role: Role.PROVIDER,
        userId: provider.userId,
      },
    },
  });

  originalProfileView = await prisma.customerProviderProfileView.findUnique({
    where: {
      customerProfileId_providerProfileId: {
        customerProfileId: customer.id,
        providerProfileId: provider.id,
      },
    },
  });

  const customerToken = signAccessToken(customer.userId, Role.CUSTOMER);
  const providerToken = signAccessToken(provider.userId, Role.PROVIDER);
  const adminToken = signAccessToken(`admin-${runId}`, Role.ADMIN);
  const appOpenIds = Array.from({ length: 8 }, (_, index) => `${runId}-open-${index + 1}`);
  const sessionStartIds = Array.from({ length: 3 }, (_, index) => `${runId}-session-${index + 1}`);
  const profileViewIds = Array.from({ length: 5 }, (_, index) => `${runId}-profile-${index + 1}`);
  const providerAppOpenIds = Array.from({ length: 4 }, (_, index) => `${runId}-provider-open-${index + 1}`);
  const providerSessionStartIds = Array.from(
    { length: 2 },
    (_, index) => `${runId}-provider-session-${index + 1}`,
  );

  for (const clientEventId of appOpenIds) {
    await postSessionEvent(
      customerToken,
      Role.CUSTOMER,
      customerDeviceId,
      AppUsageEventType.APP_OPEN,
      clientEventId,
    );
    await postSessionEvent(
      customerToken,
      Role.CUSTOMER,
      customerDeviceId,
      AppUsageEventType.APP_OPEN,
      clientEventId,
    );
  }
  for (const clientEventId of sessionStartIds) {
    await postSessionEvent(
      customerToken,
      Role.CUSTOMER,
      customerDeviceId,
      AppUsageEventType.SESSION_START,
      clientEventId,
    );
    await postSessionEvent(
      customerToken,
      Role.CUSTOMER,
      customerDeviceId,
      AppUsageEventType.SESSION_START,
      clientEventId,
    );
  }
  for (const clientEventId of profileViewIds) {
    await postProviderProfileView(customerToken, provider.id, clientEventId);
    await postProviderProfileView(customerToken, provider.id, clientEventId);
  }
  for (const clientEventId of providerAppOpenIds) {
    await postSessionEvent(
      providerToken,
      Role.PROVIDER,
      providerDeviceId,
      AppUsageEventType.APP_OPEN,
      clientEventId,
    );
    await postSessionEvent(
      providerToken,
      Role.PROVIDER,
      providerDeviceId,
      AppUsageEventType.APP_OPEN,
      clientEventId,
    );
  }
  for (const clientEventId of providerSessionStartIds) {
    await postSessionEvent(
      providerToken,
      Role.PROVIDER,
      providerDeviceId,
      AppUsageEventType.SESSION_START,
      clientEventId,
    );
    await postSessionEvent(
      providerToken,
      Role.PROVIDER,
      providerDeviceId,
      AppUsageEventType.SESSION_START,
      clientEventId,
    );
  }

  const eventCounts = await prisma.appUsageEvent.groupBy({
    by: ['eventType', 'role'],
    where: { clientEventId: { startsWith: runId } },
    _count: { _all: true },
  });
  const countByType = new Map(eventCounts.map((row) => [`${row.role}:${row.eventType}`, row._count._all]));
  const eventCount = (role, eventType) => countByType.get(`${role}:${eventType}`) ?? 0;
  assert(
    eventCount(Role.CUSTOMER, AppUsageEventType.APP_OPEN) === appOpenIds.length,
    'Customer APP_OPEN retry deduplication failed.',
  );
  assert(
    eventCount(Role.CUSTOMER, AppUsageEventType.SESSION_START) === sessionStartIds.length,
    'Customer SESSION_START retry deduplication failed.',
  );
  assert(
    eventCount(Role.CUSTOMER, AppUsageEventType.PROVIDER_PROFILE_VIEW) === profileViewIds.length,
    'PROVIDER_PROFILE_VIEW retry deduplication failed.',
  );
  assert(
    eventCount(Role.PROVIDER, AppUsageEventType.APP_OPEN) === providerAppOpenIds.length,
    'Partner APP_OPEN retry deduplication failed.',
  );
  assert(
    eventCount(Role.PROVIDER, AppUsageEventType.SESSION_START) === providerSessionStartIds.length,
    'Partner SESSION_START retry deduplication failed.',
  );

  const profileView = await prisma.customerProviderProfileView.findUniqueOrThrow({
    where: {
      customerProfileId_providerProfileId: {
        customerProfileId: customer.id,
        providerProfileId: provider.id,
      },
    },
  });
  assert(
    profileView.viewCount === (originalProfileView?.viewCount ?? 0) + profileViewIds.length,
    'Provider profile aggregate incremented more than once per client event.',
  );
  const providerDailyAggregate = await prisma.appUsageDailyAggregate.findUniqueOrThrow({
    where: {
      userId_role_day_origin: {
        day: aggregateDay,
        origin: AppUsageOrigin.PRODUCTION,
        role: Role.PROVIDER,
        userId: provider.userId,
      },
    },
  });
  assert(
    providerDailyAggregate.appOpenCount ===
      (originalProviderDailyAggregate?.appOpenCount ?? 0) + providerAppOpenIds.length,
    'Partner daily APP_OPEN aggregate is incomplete or duplicated.',
  );
  assert(
    providerDailyAggregate.sessionStartCount ===
      (originalProviderDailyAggregate?.sessionStartCount ?? 0) + providerSessionStartIds.length,
    'Partner daily SESSION_START aggregate is incomplete or duplicated.',
  );
  const dailyAggregate = await prisma.appUsageDailyAggregate.findUniqueOrThrow({
    where: {
      userId_role_day_origin: {
        day: aggregateDay,
        origin: AppUsageOrigin.PRODUCTION,
        role: Role.CUSTOMER,
        userId: customer.userId,
      },
    },
  });
  assert(
    dailyAggregate.appOpenCount === (originalDailyAggregate?.appOpenCount ?? 0) + appOpenIds.length,
    'Daily APP_OPEN aggregate is incomplete or duplicated.',
  );
  assert(
    dailyAggregate.sessionStartCount ===
      (originalDailyAggregate?.sessionStartCount ?? 0) + sessionStartIds.length,
    'Daily SESSION_START aggregate is incomplete or duplicated.',
  );
  assert(
    dailyAggregate.providerProfileViewCount ===
      (originalDailyAggregate?.providerProfileViewCount ?? 0) + profileViewIds.length,
    'Daily PROVIDER_PROFILE_VIEW aggregate is incomplete or duplicated.',
  );

  const summary = await requestJson('/admin/dashboard/start-shift-summary?dateRange=today', adminToken);
  const rankedCustomer = summary?.analytics?.customerRankings?.mostActive?.find(
    (row) => row.customerProfileId === customer.id,
  );
  assert(rankedCustomer, 'Smoke customer did not appear in the Start Shift activity ranking.');
  assert(rankedCustomer.appOpenEvents >= appOpenIds.length, 'Start Shift APP_OPEN count is incomplete.');
  assert(
    rankedCustomer.sessionStartEvents >= sessionStartIds.length,
    'Start Shift SESSION_START count is incomplete.',
  );
  assert(
    rankedCustomer.providerProfileViews >= profileViewIds.length,
    'Start Shift PROVIDER_PROFILE_VIEW count is incomplete.',
  );
  const rankedPartner = summary?.analytics?.partnerRankings?.mostActive?.find(
    (row) => row.providerProfileId === provider.id,
  );
  assert(rankedPartner, 'Smoke Partner did not appear in the Start Shift activity ranking.');
  assert(
    rankedPartner.appOpenEvents >= providerAppOpenIds.length,
    'Start Shift Partner APP_OPEN count is incomplete.',
  );
  assert(
    rankedPartner.sessionStartEvents >= providerSessionStartIds.length,
    'Start Shift Partner SESSION_START count is incomplete.',
  );
  const partnerOverview = await requestJson('/admin/partners/overview?range=today', adminToken);
  const overviewPartner = partnerOverview?.appActivity?.mostActive?.find(
    (row) => row.partnerId === provider.id,
  );
  assert(overviewPartner, 'Smoke Partner did not appear in Partner Overview app activity.');
  assert(
    overviewPartner.appOpenCount >= providerAppOpenIds.length,
    'Partner Overview APP_OPEN count is incomplete.',
  );
  assert(
    overviewPartner.sessionStartCount >= providerSessionStartIds.length,
    'Partner Overview SESSION_START count is incomplete.',
  );

  const partnerDirectoryQuery = new URLSearchParams({
    activity: 'app-active-7d',
    q: provider.id,
    take: '10',
  });
  const activeDirectoryRows = await requestJson(
    `/admin/partners/list-providers?${partnerDirectoryQuery}`,
    adminToken,
  );
  assert(Array.isArray(activeDirectoryRows), 'Partner Directory app activity response is not a list.');
  const activeDirectoryPartner = activeDirectoryRows.find((row) => row.id === provider.id);
  assert(activeDirectoryPartner, 'Smoke Partner did not appear in the app-active-7d directory filter.');
  assert(
    activeDirectoryPartner.appActivitySummary?.activityStatus === 'active',
    'Partner Directory did not classify the smoke Partner as app active.',
  );
  assert(
    activeDirectoryPartner.appActivitySummary?.lastActiveAt,
    'Partner Directory app activity response omitted lastActiveAt.',
  );
  const activeDirectorySummary = await requestJson(
    `/admin/partners/list-providers/summary?${partnerDirectoryQuery}`,
    adminToken,
  );
  assert(
    activeDirectorySummary?.totalCount >= 1,
    'Partner Directory app-active-7d summary did not include the smoke Partner.',
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'app-usage-events-live-smoke',
        verification: {
          appOpenEvents: eventCount(Role.CUSTOMER, AppUsageEventType.APP_OPEN),
          partnerAppOpenEvents: eventCount(Role.PROVIDER, AppUsageEventType.APP_OPEN),
          partnerDirectoryActiveCount: activeDirectorySummary.totalCount,
          partnerOverviewActiveRecords: overviewPartner.activeRecordCount,
          partnerRankingActiveRecords: rankedPartner.activeRecords,
          partnerSessionStartEvents: eventCount(Role.PROVIDER, AppUsageEventType.SESSION_START),
          profileViewEvents: eventCount(Role.CUSTOMER, AppUsageEventType.PROVIDER_PROFILE_VIEW),
          profileViewIncrement: profileViewIds.length,
          rankingActiveRecords: rankedCustomer.activeRecords,
          sessionStartEvents: eventCount(Role.CUSTOMER, AppUsageEventType.SESSION_START),
        },
      },
      null,
      2,
    ),
  );
} finally {
  if (customer && provider) {
    if (originalProfileView) {
      await prisma.customerProviderProfileView.update({
        where: { id: originalProfileView.id },
        data: {
          firstViewedAt: originalProfileView.firstViewedAt,
          lastViewedAt: originalProfileView.lastViewedAt,
          viewCount: originalProfileView.viewCount,
        },
      });
    } else {
      await prisma.customerProviderProfileView.deleteMany({
        where: {
          customerProfileId: customer.id,
          providerProfileId: provider.id,
        },
      });
    }
  }
  await prisma.appUsageEvent.deleteMany({ where: { clientEventId: { startsWith: runId } } });
  if (customer && aggregateDay) {
    if (originalDailyAggregate) {
      await prisma.appUsageDailyAggregate.update({
        where: { id: originalDailyAggregate.id },
        data: {
          appOpenCount: originalDailyAggregate.appOpenCount,
          firstOccurredAt: originalDailyAggregate.firstOccurredAt,
          lastOccurredAt: originalDailyAggregate.lastOccurredAt,
          providerProfileViewCount: originalDailyAggregate.providerProfileViewCount,
          sessionStartCount: originalDailyAggregate.sessionStartCount,
          totalEventCount: originalDailyAggregate.totalEventCount,
        },
      });
    } else {
      await prisma.appUsageDailyAggregate.deleteMany({
        where: {
          day: aggregateDay,
          origin: AppUsageOrigin.PRODUCTION,
          role: Role.CUSTOMER,
          userId: customer.userId,
        },
      });
    }
  }
  if (provider && aggregateDay) {
    if (originalProviderDailyAggregate) {
      await prisma.appUsageDailyAggregate.update({
        where: { id: originalProviderDailyAggregate.id },
        data: {
          appOpenCount: originalProviderDailyAggregate.appOpenCount,
          firstOccurredAt: originalProviderDailyAggregate.firstOccurredAt,
          lastOccurredAt: originalProviderDailyAggregate.lastOccurredAt,
          providerProfileViewCount: originalProviderDailyAggregate.providerProfileViewCount,
          sessionStartCount: originalProviderDailyAggregate.sessionStartCount,
          totalEventCount: originalProviderDailyAggregate.totalEventCount,
        },
      });
    } else {
      await prisma.appUsageDailyAggregate.deleteMany({
        where: {
          day: aggregateDay,
          origin: AppUsageOrigin.PRODUCTION,
          role: Role.PROVIDER,
          userId: provider.userId,
        },
      });
    }
  }
  await prisma.appSession.deleteMany({ where: { deviceId: { in: [customerDeviceId, providerDeviceId] } } });
  await prisma.$disconnect();
}

async function postSessionEvent(token, role, deviceId, eventType, clientEventId) {
  return requestJson('/app/session', token, {
    appVersion: 'smoke',
    clientEventId,
    deviceId,
    eventType,
    platform: 'smoke',
    role,
  });
}

async function postProviderProfileView(token, providerProfileId, clientEventId) {
  return requestJson(`/customer/partners/${providerProfileId}/view`, token, { clientEventId });
}

async function requestJson(path, token, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    method: body === undefined ? 'GET' : 'POST',
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${path}: ${text.slice(0, 500)}`);
  }
  return text ? JSON.parse(text) : null;
}

function signAccessToken(subject, role) {
  return jwt.sign({ activeRole: role, role, roles: [role], sub: subject }, accessSecret, {
    expiresIn: '5m',
  });
}

function usableSecret(value) {
  const normalized = value?.trim();
  if (!normalized || ['change-me', 'changeme', 'password', 'secret'].includes(normalized.toLowerCase())) {
    return null;
  }
  return normalized;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '');
}

function vietnamCalendarDay(value) {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).formatToParts(value);
  const part = (type) => Number(parts.find((item) => item.type === type)?.value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
}

function assertLocalTarget(value, nodeEnv) {
  const hostname = new URL(value).hostname;
  assert(
    ['127.0.0.1', 'localhost', '::1'].includes(hostname),
    'App usage smoke may only target a local API.',
  );
  assert(nodeEnv !== 'production', 'App usage smoke is disabled in production.');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
