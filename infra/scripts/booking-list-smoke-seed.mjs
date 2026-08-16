import {
  BookingMatchSource,
  BookingStatus,
  EarningStatus,
  ParticipantStatus,
  PaymentMethod,
  PaymentStatus,
  ProviderStatus,
  ProviderWalletLedgerType,
  PrismaClient,
  Role,
} from '@prisma/client';
import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const cleanupOnly = process.argv.includes('--cleanup');
const adminVisible = process.argv.includes('--admin-visible');
const { env, envFileExists, envPath } = loadMergedEnv(envFile);

if (env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL is required for booking list smoke seed.');
}
if (adminVisible && env.NODE_ENV === 'production') {
  fail('Admin-visible booking fixtures cannot run in production.');
}

const prisma = new PrismaClient();
const now = new Date();
const fixturePrefix = adminVisible ? 'audit_booking_list' : 'smoke_booking_list';
const fixtureLabel = adminVisible ? 'Audit' : 'Smoke';
const fixturePhonePrefix = adminVisible ? '+849090081' : '+849090080';
const fixtureMetadata = adminVisible
  ? { auditFixture: 'booking-list' }
  : { smoke: 'booking-list' };

const ids = {
  customerUser: `${fixturePrefix}_customer_user`,
  customerProfile: `${fixturePrefix}_customer_profile`,
  preferredProviderUser: `${fixturePrefix}_preferred_provider_user`,
  preferredProviderProfile: `${fixturePrefix}_preferred_provider_profile`,
  marketplaceProviderUser: `${fixturePrefix}_marketplace_provider_user`,
  marketplaceProviderProfile: `${fixturePrefix}_marketplace_provider_profile`,
  resolvedProviderUser: `${fixturePrefix}_resolved_provider_user`,
  resolvedProviderProfile: `${fixturePrefix}_resolved_provider_profile`,
  service: `${fixturePrefix}_service`,
  openMatchingBooking: `${fixturePrefix}_open_matching_booking`,
  preMatchCancelledBooking: `${fixturePrefix}_pre_match_cancelled_booking`,
  inServiceBooking: `${fixturePrefix}_in_service_booking`,
  completedBooking: `${fixturePrefix}_completed_booking`,
  pendingCancellationBooking: `${fixturePrefix}_pending_cancellation_booking`,
  approvedCancellationBooking: `${fixturePrefix}_approved_cancellation_booking`,
};

const bookingIds = [
  ids.openMatchingBooking,
  ids.preMatchCancelledBooking,
  ids.inServiceBooking,
  ids.completedBooking,
  ids.pendingCancellationBooking,
  ids.approvedCancellationBooking,
];
const smokeUserIds = [
  ids.customerUser,
  ids.preferredProviderUser,
  ids.marketplaceProviderUser,
  ids.resolvedProviderUser,
];
const providerProfileIds = [
  ids.preferredProviderProfile,
  ids.marketplaceProviderProfile,
  ids.resolvedProviderProfile,
];
const earningIds = bookingIds.map((bookingId) => `${bookingId}_earning`);
const paymentIds = bookingIds.map((bookingId) => `${bookingId}_payment`);
const ledgerSourceKeys = [
  `earning:${ids.approvedCancellationBooking}_earning:post-match-cancellation-approval`,
];

try {
  await cleanupSmokeData();

  if (cleanupOnly) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          action: 'cleanup',
          envFile: { path: envPath, exists: envFileExists },
          removedBookingIds: bookingIds,
        },
        null,
        2,
      ),
    );
  } else {
    await seedSmokeData();
    const verification = await verifySmokeData();
    console.log(
      JSON.stringify(
        {
          ok: true,
          action: 'seed',
          adminVisible,
          envFile: { path: envPath, exists: envFileExists },
          pages: [
            '/bookings?dateRange=today',
            '/bookings?dateRange=today&view=pre-match-cancelled',
            '/bookings/completed?dateRange=today',
            '/bookings/post-match-cancellations?dateRange=today',
          ],
          verification,
        },
        null,
        2,
      ),
    );
  }
} catch (error) {
  let cleanupError = null;
  try {
    await cleanupSmokeData();
  } catch (caughtCleanupError) {
    cleanupError = caughtCleanupError instanceof Error ? caughtCleanupError.message : String(caughtCleanupError);
  }
  console.error(
    JSON.stringify(
      {
        ok: false,
        envFile: { path: envPath, exists: envFileExists },
        error: error instanceof Error ? error.message : String(error),
        cleanupError,
        residualFixtureIds: cleanupError ? Object.values(ids) : [],
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

async function seedSmokeData() {
  await prisma.massageService.create({
    data: {
      id: ids.service,
      serviceGroupKey: 'smoke-booking-list',
      name: 'Aromatherapy Massage',
      description: `${fixtureLabel}-only service for admin booking list UI checks.`,
      durationMin: 90,
      basePrice: 500000,
      priceStep: 100000,
      displayOrder: 999,
      active: true,
    },
  });

  await createCustomer();
  await createProvider({
    id: ids.preferredProviderProfile,
    userId: ids.preferredProviderUser,
    displayName: 'Linh Tran',
    phone: `${fixturePhonePrefix}01`,
    status: ProviderStatus.ONLINE_AVAILABLE,
  });
  await createProvider({
    id: ids.marketplaceProviderProfile,
    userId: ids.marketplaceProviderUser,
    displayName: 'Mai Nguyen',
    phone: `${fixturePhonePrefix}02`,
    status: ProviderStatus.ONLINE_BUSY,
  });
  await createProvider({
    id: ids.resolvedProviderProfile,
    userId: ids.resolvedProviderUser,
    displayName: 'An Pham',
    phone: `${fixturePhonePrefix}03`,
    status: ProviderStatus.OFFLINE,
  });

  await createOpenMatchingBooking();
  await createPreMatchCancelledBooking();
  await createInServiceBooking();
  await createCompletedBooking();
  await createPendingCancellationBooking();
  await createApprovedCancellationBooking();
}

async function createCustomer() {
  await prisma.user.create({
    data: {
      id: ids.customerUser,
      phone: `${fixturePhonePrefix}00`,
      fullName: `HANDS ${fixtureLabel} Customer`,
      roles: [Role.CUSTOMER],
      customerProfile: {
        create: {
          id: ids.customerProfile,
          addresses: [
            {
              label: 'Home',
              addressText: '22 Le Thanh Ton, Ben Nghe Ward, District 1, Ho Chi Minh City',
              lat: 10.7769,
              lng: 106.7009,
            },
          ],
        },
      },
      appSessions: {
        create: {
          role: Role.CUSTOMER,
          deviceId: `${fixturePrefix}-customer-ios`,
          platform: 'ios',
          appVersion: '1.0.0-smoke',
          deviceLanguage: 'vi-VN',
          lastLoginAddress: 'District 1, Ho Chi Minh City',
          active: true,
          lastSeenAt: minutesAgo(5),
        },
      },
    },
  });
}

async function createProvider({ displayName, id, phone, status, userId }) {
  await prisma.user.create({
    data: {
      id: userId,
      phone,
      fullName: displayName,
      roles: [Role.PROVIDER],
      providerProfile: {
        create: {
          id,
          displayName,
          city: 'Ho Chi Minh City',
          status,
          currentLat: 10.7769,
          currentLng: 106.7009,
          currentLocationUpdatedAt: minutesAgo(10),
          serviceArea: { cities: ['Ho Chi Minh City'], country: 'VN' },
          services: {
            create: {
              serviceId: ids.service,
              price: 500000,
              active: true,
            },
          },
        },
      },
      appSessions: {
        create: {
          role: Role.PROVIDER,
          deviceId: `${userId}-android`,
          platform: 'android',
          appVersion: '1.0.0-smoke',
          deviceLanguage: 'vi-VN',
          lastLoginAddress: 'Ho Chi Minh City',
          active: status !== ProviderStatus.OFFLINE,
          lastSeenAt: status === ProviderStatus.OFFLINE ? daysAgo(35) : minutesAgo(8),
        },
      },
    },
  });
}

async function createOpenMatchingBooking() {
  const openedAt = minutesAgo(22);
  await createBooking({
    id: ids.openMatchingBooking,
    status: BookingStatus.OPEN_MATCHING,
    preferredProviderId: ids.preferredProviderProfile,
    openedAt,
    createdAt: openedAt,
    scheduledStartAt: minutesFromNow(50),
    scheduledEndAt: minutesFromNow(140),
    participants: [
      {
        providerProfileId: ids.preferredProviderProfile,
        status: ParticipantStatus.JOINED,
        distanceMeters: 1800,
        providerStatusAtJoin: ProviderStatus.ONLINE_AVAILABLE,
        joinedAt: minutesAgo(20),
      },
      {
        providerProfileId: ids.marketplaceProviderProfile,
        status: ParticipantStatus.ACCEPTED,
        distanceMeters: 2600,
        providerStatusAtJoin: ProviderStatus.ONLINE_AVAILABLE,
        joinedAt: minutesAgo(15),
        respondedAt: minutesAgo(13),
      },
    ],
    metadata: {
      ...fixtureMetadata,
      deviceLanguage: 'vi-VN',
      bookingListStage: 'open-matching',
    },
  });
}

async function createPreMatchCancelledBooking() {
  const openedAt = minutesAgo(70);
  const closedAt = minutesAgo(58);
  await createBooking({
    id: ids.preMatchCancelledBooking,
    status: BookingStatus.CANCELLED,
    preferredProviderId: ids.preferredProviderProfile,
    openedAt,
    createdAt: openedAt,
    closedAt,
    closedByRole: Role.CUSTOMER,
    closedReason: 'customer_cancelled',
    closedNote: `${fixtureLabel}: customer cancelled before a Partner was matched.`,
    scheduledStartAt: minutesFromNow(40),
    scheduledEndAt: minutesFromNow(130),
    payment: {
      amount: 500000,
      id: `${ids.preMatchCancelledBooking}_payment`,
      method: PaymentMethod.CASH,
      providerRef: null,
      status: PaymentStatus.RELEASED,
    },
    participants: [
      {
        providerProfileId: ids.preferredProviderProfile,
        status: ParticipantStatus.EXPIRED,
        distanceMeters: 1800,
        providerStatusAtJoin: ProviderStatus.ONLINE_AVAILABLE,
        joinedAt: minutesAgo(68),
        respondedAt: closedAt,
      },
      {
        providerProfileId: ids.marketplaceProviderProfile,
        status: ParticipantStatus.EXPIRED,
        distanceMeters: 2600,
        providerStatusAtJoin: ProviderStatus.ONLINE_AVAILABLE,
        joinedAt: minutesAgo(64),
        respondedAt: closedAt,
      },
    ],
    metadata: {
      ...fixtureMetadata,
      deviceLanguage: 'vi-VN',
      bookingListStage: 'pre-match-cancelled',
    },
  });
}

async function createInServiceBooking() {
  const openedAt = minutesAgo(95);
  const matchedAt = minutesAgo(55);
  await createBooking({
    id: ids.inServiceBooking,
    status: BookingStatus.IN_SERVICE,
    selectedProviderId: ids.marketplaceProviderProfile,
    openedAt,
    createdAt: openedAt,
    matchedAt,
    matchSource: BookingMatchSource.CUSTOMER_SELECTED_PARTNER,
    scheduledStartAt: minutesAgo(25),
    scheduledEndAt: minutesFromNow(65),
    payment: {
      amount: 500000,
      id: `${ids.inServiceBooking}_payment`,
      method: PaymentMethod.MOMO,
      providerRef: `${ids.inServiceBooking}_provider_ref`,
      status: PaymentStatus.AUTHORIZED,
    },
    participants: [
      {
        providerProfileId: ids.preferredProviderProfile,
        status: ParticipantStatus.ACCEPTED,
        distanceMeters: 1800,
        providerStatusAtJoin: ProviderStatus.ONLINE_AVAILABLE,
        joinedAt: minutesAgo(85),
        respondedAt: minutesAgo(82),
      },
      {
        providerProfileId: ids.marketplaceProviderProfile,
        status: ParticipantStatus.SELECTED,
        distanceMeters: 2400,
        providerStatusAtJoin: ProviderStatus.ONLINE_BUSY,
        joinedAt: minutesAgo(75),
        respondedAt: matchedAt,
      },
    ],
    chatMessages: [
      {
        body: `${fixtureLabel}: customer confirmed the service address.`,
        createdAt: minutesAgo(52),
        senderId: ids.customerUser,
      },
      {
        body: `${fixtureLabel}: Partner is starting the service.`,
        createdAt: minutesAgo(12),
        senderId: ids.marketplaceProviderUser,
      },
    ],
    metadata: {
      ...fixtureMetadata,
      deviceLanguage: 'vi-VN',
      bookingListStage: 'in-service',
    },
  });
}

async function createCompletedBooking() {
  const openedAt = minutesAgo(180);
  const matchedAt = minutesAgo(145);
  const closedAt = minutesAgo(35);
  await createBooking({
    id: ids.completedBooking,
    status: BookingStatus.COMPLETED,
    selectedProviderId: ids.preferredProviderProfile,
    openedAt,
    createdAt: openedAt,
    matchedAt,
    closedAt,
    closedByRole: Role.PROVIDER,
    closedReason: 'service_completed',
    closedNote: `${fixtureLabel}: service completed; closeout reconciliation still needs review.`,
    matchSource: BookingMatchSource.FIRST_PICK_ACCEPTED_FIRST,
    scheduledStartAt: minutesAgo(130),
    scheduledEndAt: minutesAgo(40),
    payment: {
      amount: 500000,
      id: `${ids.completedBooking}_payment`,
      method: PaymentMethod.MOMO,
      providerRef: `${ids.completedBooking}_provider_ref`,
      status: PaymentStatus.CAPTURED,
    },
    earning: {
      grossAmount: 500000,
      id: `${ids.completedBooking}_earning`,
      netAmount: 420000,
      platformFee: 50000,
      status: EarningStatus.AVAILABLE,
      withholdingAmount: 30000,
    },
    participants: [
      {
        providerProfileId: ids.preferredProviderProfile,
        status: ParticipantStatus.SELECTED,
        distanceMeters: 1800,
        providerStatusAtJoin: ProviderStatus.ONLINE_AVAILABLE,
        joinedAt: minutesAgo(170),
        respondedAt: matchedAt,
      },
      {
        providerProfileId: ids.marketplaceProviderProfile,
        status: ParticipantStatus.REJECTED,
        distanceMeters: 2600,
        providerStatusAtJoin: ProviderStatus.ONLINE_AVAILABLE,
        joinedAt: minutesAgo(166),
        respondedAt: minutesAgo(160),
      },
    ],
    chatMessages: [
      {
        body: `${fixtureLabel}: Partner arrived and completed the booking.`,
        createdAt: minutesAgo(42),
        senderId: ids.preferredProviderUser,
      },
    ],
    locationSnapshots: [
      {
        providerProfileId: ids.preferredProviderProfile,
        addressText: '33 Nguyen Dinh Chieu, Sai Gon, Ho Chi Minh City',
        lat: 10.7778,
        lng: 106.7012,
        recordedAt: closedAt,
      },
    ],
    metadata: {
      ...fixtureMetadata,
      deviceLanguage: 'vi-VN',
      bookingListStage: 'completed-closeout',
    },
  });
}

async function createPendingCancellationBooking() {
  const openedAt = minutesAgo(170);
  const matchedAt = minutesAgo(120);
  const closedAt = minutesAgo(72);
  await createBooking({
    id: ids.pendingCancellationBooking,
    status: BookingStatus.CANCELLED,
    selectedProviderId: ids.marketplaceProviderProfile,
    openedAt,
    createdAt: openedAt,
    matchedAt,
    closedAt,
    closedByRole: Role.PROVIDER,
    closedReason: 'partner_cancelled',
    closedNote: `${fixtureLabel}: Partner cancelled from chat after the 15 minute auto-approval window.`,
    matchSource: BookingMatchSource.CUSTOMER_SELECTED_PARTNER,
    scheduledStartAt: minutesAgo(100),
    scheduledEndAt: minutesAgo(10),
    payment: {
      amount: 500000,
      id: `${ids.pendingCancellationBooking}_payment`,
      method: PaymentMethod.MOMO,
      providerRef: `${ids.pendingCancellationBooking}_provider_ref`,
      status: PaymentStatus.AUTHORIZED,
    },
    earning: {
      grossAmount: 500000,
      id: `${ids.pendingCancellationBooking}_earning`,
      netAmount: -50000,
      platformFee: 50000,
      status: EarningStatus.PENDING,
      withholdingAmount: 0,
    },
    participants: [
      {
        providerProfileId: ids.marketplaceProviderProfile,
        status: ParticipantStatus.SELECTED,
        distanceMeters: 2400,
        providerStatusAtJoin: ProviderStatus.ONLINE_BUSY,
        joinedAt: minutesAgo(150),
        respondedAt: matchedAt,
      },
      {
        providerProfileId: ids.preferredProviderProfile,
        status: ParticipantStatus.ACCEPTED,
        distanceMeters: 1800,
        providerStatusAtJoin: ProviderStatus.ONLINE_AVAILABLE,
        joinedAt: minutesAgo(152),
        respondedAt: minutesAgo(149),
      },
    ],
    chatMessages: [
      {
        body: `${fixtureLabel}: Partner says they cannot continue after matching.`,
        createdAt: closedAt,
        senderId: ids.marketplaceProviderUser,
      },
      {
        body: `${fixtureLabel}: customer asks admin to review the cancellation.`,
        createdAt: new Date(closedAt.getTime() + 60_000),
        senderId: ids.customerUser,
      },
    ],
    locationSnapshots: [
      {
        providerProfileId: ids.marketplaceProviderProfile,
        addressText: '85/9 Pham Viet Chanh, Thanh My Tay, Ho Chi Minh City',
        lat: 10.7791,
        lng: 106.6997,
        recordedAt: closedAt,
      },
    ],
    metadata: {
      ...fixtureMetadata,
      deviceLanguage: 'vi-VN',
      bookingListStage: 'post-match-cancel-pending',
    },
  });
}

async function createApprovedCancellationBooking() {
  const openedAt = minutesAgo(150);
  const matchedAt = minutesAgo(105);
  const closedAt = minutesAgo(98);
  const earningId = `${ids.approvedCancellationBooking}_earning`;
  await createBooking({
    id: ids.approvedCancellationBooking,
    status: BookingStatus.CANCELLED,
    selectedProviderId: ids.resolvedProviderProfile,
    openedAt,
    createdAt: openedAt,
    matchedAt,
    closedAt,
    closedByRole: Role.ADMIN,
    closedReason: 'post_match_cancellation_approved',
    closedNote: `${fixtureLabel}: admin approved cancellation inside the 15 minute window.`,
    matchSource: BookingMatchSource.CUSTOMER_SELECTED_PARTNER,
    scheduledStartAt: minutesAgo(95),
    scheduledEndAt: minutesAgo(5),
    payment: {
      amount: 500000,
      id: `${ids.approvedCancellationBooking}_payment`,
      method: PaymentMethod.MOMO,
      providerRef: `${ids.approvedCancellationBooking}_provider_ref`,
      status: PaymentStatus.RELEASED,
    },
    earning: {
      grossAmount: 500000,
      id: earningId,
      netAmount: 0,
      platformFee: 50000,
      status: EarningStatus.CANCELLED,
      withholdingAmount: 0,
    },
    participants: [
      {
        providerProfileId: ids.resolvedProviderProfile,
        status: ParticipantStatus.SELECTED,
        distanceMeters: 3100,
        providerStatusAtJoin: ProviderStatus.ONLINE_AVAILABLE,
        joinedAt: minutesAgo(130),
        respondedAt: matchedAt,
      },
      {
        providerProfileId: ids.marketplaceProviderProfile,
        status: ParticipantStatus.ACCEPTED,
        distanceMeters: 2400,
        providerStatusAtJoin: ProviderStatus.ONLINE_BUSY,
        joinedAt: minutesAgo(132),
        respondedAt: minutesAgo(128),
      },
    ],
    chatMessages: [
      {
        body: `${fixtureLabel}: Partner cancelled quickly after matching.`,
        createdAt: closedAt,
        senderId: ids.resolvedProviderUser,
      },
      {
        body: `${fixtureLabel}: admin restored the Partner fee for this cancellation.`,
        createdAt: new Date(closedAt.getTime() + 60_000),
        senderId: ids.customerUser,
      },
    ],
    locationSnapshots: [
      {
        providerProfileId: ids.resolvedProviderProfile,
        addressText: 'Hem 1 Duong So 9, An Khanh, Ho Chi Minh City',
        lat: 10.7756,
        lng: 106.7041,
        recordedAt: closedAt,
      },
    ],
    metadata: {
      ...fixtureMetadata,
      deviceLanguage: 'vi-VN',
      bookingListStage: 'post-match-cancel-approved',
    },
    walletLedger: {
      amount: 50000,
      earningId,
      notes: `${fixtureLabel}: restored post-match cancellation fee.`,
      sourceKey: ledgerSourceKeys[0],
      type: ProviderWalletLedgerType.REFUND_REVERSAL,
    },
  });
}

async function createBooking({
  chatMessages = [],
  closedAt,
  closedByRole,
  closedNote,
  closedReason,
  createdAt,
  earning,
  id,
  locationSnapshots = [],
  matchSource,
  matchedAt,
  metadata,
  openedAt,
  participants,
  payment,
  preferredProviderId,
  scheduledEndAt,
  scheduledStartAt,
  selectedProviderId,
  status,
  walletLedger,
}) {
  const address = {
    addressText: '22 Le Thanh Ton, Ben Nghe Ward, District 1, Ho Chi Minh City',
    city: 'Ho Chi Minh City',
    country: 'VN',
    district: 'District 1',
    line1: '22 Le Thanh Ton',
    ward: 'Ben Nghe Ward',
  };
  const lat = 10.7769;
  const lng = 106.7009;
  const chatRoomId = `${id}_chat_room`;

  await prisma.booking.create({
    data: {
      id,
      customerProfileId: ids.customerProfile,
      preferredProviderId,
      selectedProviderId,
      status,
      scheduledStartAt,
      scheduledEndAt,
      address,
      lat,
      lng,
      notes: `${fixtureLabel} seed for admin booking list UI verification.`,
      metadata,
      travelBufferMin: 30,
      earlyAcceptMin: 20,
      openedAt,
      expiresAt: status === BookingStatus.OPEN_MATCHING ? minutesFromNow(8) : null,
      matchedAt,
      matchSource,
      closedAt,
      closedByRole,
      closedReason,
      closedNote,
      createdAt,
      addressSnapshot: {
        create: {
          customerProfileId: ids.customerProfile,
          address,
          addressText: address.addressText,
          latitude: lat,
          longitude: lng,
          source: fixturePrefix,
          createdAt,
        },
      },
      services: {
        create: {
          serviceId: ids.service,
          quantity: 1,
          price: 500000,
        },
      },
      participants: {
        create: participants,
      },
      ...(locationSnapshots.length > 0
        ? {
            snapshots: {
              create: locationSnapshots,
            },
          }
        : {}),
      ...(payment
        ? {
            payment: {
              create: {
                id: payment.id,
                method: payment.method,
                status: payment.status,
                amount: payment.amount,
                currency: 'VND',
                providerRef: payment.providerRef,
                rawMeta: fixtureMetadata,
              },
            },
          }
        : {}),
      ...(earning
        ? {
            earning: {
              create: {
                id: earning.id,
                providerProfileId: selectedProviderId,
                grossAmount: earning.grossAmount,
                platformFee: earning.platformFee,
                withholdingAmount: earning.withholdingAmount,
                netAmount: earning.netAmount,
                currency: 'VND',
                status: earning.status,
                availableAt: earning.status === EarningStatus.AVAILABLE ? closedAt ?? now : null,
              },
            },
          }
        : {}),
      ...(chatMessages.length > 0
        ? {
            chatRoom: {
              create: {
                id: chatRoomId,
                messages: { create: chatMessages },
              },
            },
          }
        : {}),
    },
  });

  if (walletLedger) {
    await prisma.providerWalletLedgerEntry.create({
      data: {
        providerProfileId: selectedProviderId,
        bookingId: id,
        earningId: walletLedger.earningId,
        type: walletLedger.type,
        sourceKey: walletLedger.sourceKey,
        amount: walletLedger.amount,
        currency: 'VND',
        reference: id,
        notes: walletLedger.notes,
        metadata: fixtureMetadata,
      },
    });
  }
}

async function verifySmokeData() {
  const rows = await prisma.booking.findMany({
    where: { id: { in: bookingIds } },
    include: {
      addressSnapshot: true,
      chatRoom: { include: { messages: true } },
      earning: true,
      participants: true,
      payment: true,
      services: true,
      snapshots: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  assertCondition(rows.length === bookingIds.length, 'Not all smoke bookings were seeded.');
  const preMatchCancelled = rows.find((booking) => booking.id === ids.preMatchCancelledBooking);
  assertCondition(
    preMatchCancelled?.matchedAt === null &&
      preMatchCancelled.selectedProviderId === null &&
      preMatchCancelled.payment?.status === PaymentStatus.RELEASED &&
      preMatchCancelled.earning === null,
    'Pre-match cancellation must release payment without Partner earnings.',
  );
  assertCondition(
    rows.every((booking) => booking.addressSnapshot?.addressText?.includes('Ho Chi Minh City')),
    'Smoke bookings should expose real service addresses.',
  );
  assertCondition(
    rows.find((booking) => booking.id === ids.completedBooking)?.snapshots.length === 1,
    'Completed smoke booking should include one booking action location snapshot.',
  );
  assertCondition(
    rows.find((booking) => booking.id === ids.pendingCancellationBooking)?.snapshots.length === 1,
    'Pending cancellation smoke booking should include one booking action location snapshot.',
  );
  assertCondition(
    rows.find((booking) => booking.id === ids.approvedCancellationBooking)?.snapshots.length === 1,
    'Approved cancellation smoke booking should include one booking action location snapshot.',
  );
  assertCondition(
    [ids.completedBooking, ids.pendingCancellationBooking, ids.approvedCancellationBooking].every((bookingId) =>
      rows
        .find((booking) => booking.id === bookingId)
        ?.snapshots.every((snapshot) => snapshot.addressText?.includes('Ho Chi Minh City')),
    ),
    'Booking action location snapshots should include operator-readable address text.',
  );

  return {
    totalBookings: rows.length,
    byStatus: countBy(rows, (booking) => booking.status),
    rows: rows.map((booking) => ({
      id: booking.id,
      status: booking.status,
      addressText: booking.addressSnapshot?.addressText,
      participantCount: booking.participants.length,
      chatMessageCount: booking.chatRoom?.messages.length ?? 0,
      paymentStatus: booking.payment?.status ?? null,
      earningStatus: booking.earning?.status ?? null,
      locationSnapshotCount: booking.snapshots.length,
      locationSnapshotAddressText: booking.snapshots.map((snapshot) => snapshot.addressText ?? null),
    })),
  };
}

async function cleanupSmokeData() {
  const chatRooms = await prisma.chatRoom.findMany({
    where: { bookingId: { in: bookingIds } },
    select: { id: true },
  });
  const chatRoomIds = chatRooms.map((room) => room.id);

  await prisma.chatMessage.deleteMany({ where: { chatRoomId: { in: chatRoomIds } } });
  await prisma.chatRoom.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.providerWalletLedgerEntry.deleteMany({
    where: {
      OR: [
        { bookingId: { in: bookingIds } },
        { earningId: { in: earningIds } },
        { sourceKey: { in: ledgerSourceKeys } },
      ],
    },
  });
  await prisma.bookingOpsTask.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.adminAuditLog.deleteMany({
    where: { target: { in: bookingIds.map((bookingId) => `booking:${bookingId}`) } },
  });
  const providerTaxLogs = await prisma.providerTaxLog.findMany({
    where: {
      OR: [
        { bookingId: { in: bookingIds } },
        { earningId: { in: earningIds } },
        { providerProfileId: { in: providerProfileIds } },
      ],
    },
    select: { id: true },
  });
  await prisma.withholdingLog.deleteMany({
    where: { providerTaxLogId: { in: providerTaxLogs.map((log) => log.id) } },
  });
  await prisma.providerTaxLog.deleteMany({
    where: {
      OR: [
        { bookingId: { in: bookingIds } },
        { earningId: { in: earningIds } },
        { providerProfileId: { in: providerProfileIds } },
      ],
    },
  });
  await prisma.providerPlatformFeeLog.deleteMany({
    where: {
      OR: [
        { bookingId: { in: bookingIds } },
        { earningId: { in: earningIds } },
        { providerProfileId: { in: providerProfileIds } },
      ],
    },
  });
  await prisma.bookingAddressSnapshot.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.locationSnapshot.deleteMany({
    where: {
      OR: [{ bookingId: { in: bookingIds } }, { providerProfileId: { in: providerProfileIds } }],
    },
  });
  await prisma.bookingParticipant.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.bookingService.deleteMany({ where: { bookingId: { in: bookingIds } } });
  await prisma.providerEarning.deleteMany({
    where: { OR: [{ bookingId: { in: bookingIds } }, { id: { in: earningIds } }] },
  });
  await prisma.payment.deleteMany({
    where: { OR: [{ bookingId: { in: bookingIds } }, { id: { in: paymentIds } }] },
  });
  await prisma.booking.deleteMany({ where: { id: { in: bookingIds } } });
  await prisma.providerService.deleteMany({ where: { providerProfileId: { in: providerProfileIds } } });
  await prisma.appSession.deleteMany({ where: { userId: { in: smokeUserIds } } });
  await prisma.pushDevice.deleteMany({ where: { userId: { in: smokeUserIds } } });
  await prisma.customerProfile.deleteMany({ where: { id: ids.customerProfile } });
  await prisma.providerProfile.deleteMany({ where: { id: { in: providerProfileIds } } });
  await prisma.user.deleteMany({ where: { id: { in: smokeUserIds } } });
  await prisma.massageService.deleteMany({ where: { id: ids.service } });
}

function minutesAgo(minutes) {
  return new Date(now.getTime() - minutes * 60_000);
}

function minutesFromNow(minutes) {
  return new Date(now.getTime() + minutes * 60_000);
}

function daysAgo(days) {
  return new Date(now.getTime() - days * 24 * 60 * 60_000);
}

function countBy(rows, getKey) {
  return rows.reduce((counts, row) => {
    const key = getKey(row);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
