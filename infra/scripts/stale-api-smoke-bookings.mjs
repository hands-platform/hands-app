import { BookingStatus, PrismaClient, Role } from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';
import {
  isLegacyApiSmokeCustomer,
  isStaleApiSmokeAddress,
  summarizeStaleApiSmokeBookings,
} from './lib/stale-api-smoke-bookings.mjs';

const { env } = loadMergedEnv('.env');
const apply = process.argv.includes('--apply');
const minimumAgeHours = positiveInteger(
  env.STALE_API_SMOKE_BOOKING_MIN_AGE_HOURS,
  24,
  'STALE_API_SMOKE_BOOKING_MIN_AGE_HOURS',
);
const databaseUrl = env.DATABASE_URL?.trim();
const legacySmokeCustomerPhone =
  env.API_SMOKE_CUSTOMER_PHONE?.trim() || env.CUSTOMER_DEMO_PHONE?.trim() || '+84900000001';
const activeStatuses = [
  BookingStatus.OPEN_MATCHING,
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
];

assert(databaseUrl, 'DATABASE_URL is required.');
if (apply && env.NODE_ENV === 'production') {
  assert(
    env.STALE_API_SMOKE_BOOKING_CONFIRM === 'EXPIRE_STALE_SMOKE_BOOKINGS',
    'Production apply requires STALE_API_SMOKE_BOOKING_CONFIRM=EXPIRE_STALE_SMOKE_BOOKINGS.',
  );
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const now = new Date();
const cutoff = new Date(now.getTime() - minimumAgeHours * 60 * 60_000);

try {
  const broadCandidates = await prisma.booking.findMany({
    where: {
      createdAt: { lt: cutoff },
      status: { in: activeStatuses },
      OR: [
        {
          addressSnapshot: {
            addressText: { endsWith: ' smoke flow', mode: 'insensitive' },
          },
        },
        {
          addressSnapshot: {
            addressText: { startsWith: 'Realtime smoke ', mode: 'insensitive' },
          },
        },
        {
          customerProfile: {
            user: {
              fullName: 'Demo Customer',
              phone: legacySmokeCustomerPhone,
            },
          },
        },
      ],
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      selectedProviderId: true,
      status: true,
      addressSnapshot: { select: { addressText: true } },
      customerProfile: {
        select: { user: { select: { fullName: true, phone: true } } },
      },
    },
  });
  const candidates = broadCandidates.flatMap((booking) => {
    const explicitSmokeAddress = isStaleApiSmokeAddress(booking.addressSnapshot?.addressText);
    const legacyDemoCustomer = isLegacyApiSmokeCustomer(
      booking.customerProfile.user,
      legacySmokeCustomerPhone,
    );
    if (!explicitSmokeAddress && !legacyDemoCustomer) return [];
    return [
      {
        ...booking,
        cleanupSource: explicitSmokeAddress ? 'explicit_smoke_address' : 'legacy_demo_customer',
      },
    ];
  });
  const candidateIds = candidates.map((booking) => booking.id);
  let expired = 0;

  if (apply && candidateIds.length > 0) {
    expired = (
      await prisma.booking.updateMany({
        where: {
          id: { in: candidateIds },
          status: { in: activeStatuses },
        },
        data: {
          closedAt: now,
          closedByRole: Role.SYSTEM,
          closedNote: 'Expired by the bounded local API smoke fixture cleanup.',
          closedReason: 'stale_api_smoke_fixture',
          status: BookingStatus.EXPIRED,
        },
      })
    ).count;
  }

  console.log(
    JSON.stringify(
      {
        apply,
        cutoff: cutoff.toISOString(),
        expired,
        minimumAgeHours,
        safeguards: {
          activeStatusOnly: true,
          explicitAddressOrLegacyDemoIdentityRequired: true,
          deletesRows: false,
          productionConfirmationRequired: true,
        },
        summary: summarizeStaleApiSmokeBookings(candidates),
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}

function positiveInteger(value, fallback, name) {
  const parsed = value?.trim() ? Number(value) : fallback;
  assert(Number.isInteger(parsed) && parsed > 0, `${name} must be a positive integer.`);
  return parsed;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
