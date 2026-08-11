import jwt from 'jsonwebtoken';
import {
  BookingStatus,
  ManualWalletAdjustmentRequestStatus,
  PaymentMethod,
  PrismaClient,
  ProviderKycStatus,
  ProviderStatus,
  Role,
  VerificationStatus,
} from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';

const TARGET_CUSTOMER_PROFILE_ID = 'smoke_referral_customer_referred_profile';
const TARGET_CUSTOMER_USER_ID = 'smoke_referral_customer_referred_user';
const TARGET_CUSTOMER_PHONE = '+84909100011';
const SMOKE_PREFIX = 'HANDS customer detail smoke';
const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.CREATED,
  BookingStatus.OPEN_MATCHING,
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
];
const COMPLETED_MARKER = `${SMOKE_PREFIX} / completed`;
const REFUNDED_MARKER = `${SMOKE_PREFIX} / refunded`;
const CANCELLED_MARKER = `${SMOKE_PREFIX} / cancelled`;
const LIVE_MARKER = `${SMOKE_PREFIX} / live matched`;
const WALLET_ADJUSTMENTS = [
  {
    adjustmentType: 'PROMOTION_CREDIT',
    amount: 150_000,
    direction: 'CREDIT',
    reason: `${SMOKE_PREFIX}: promotion credit for customer detail verification.`,
  },
  {
    adjustmentType: 'ERROR_CORRECTION',
    amount: 25_000,
    direction: 'DEBIT',
    reason: `${SMOKE_PREFIX}: correction debit for customer detail verification.`,
  },
];

const envFile = process.argv.find((argument) => argument.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const verifyOnly = process.argv.includes('--verify-only');
const dryRun = process.argv.includes('--dry-run');
const { env, envFileExists, envPath } = loadMergedEnv(envFile);

if (env.DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

const apiBaseUrl = env.API_BASE_URL ?? 'http://localhost:3000/api';
assertLocalSmokeTarget(apiBaseUrl, env.NODE_ENV);

if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL is required for customer detail smoke data.');
}

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'dry-run',
        apiBaseUrl,
        envFile: { exists: envFileExists, path: envPath },
        targetCustomerProfileId: TARGET_CUSTOMER_PROFILE_ID,
        scenarios: ['completed', 'refunded', 'cancelled', 'live-matched'],
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const prisma = new PrismaClient();

async function main() {
  try {
    const target = await requireTargetCustomer();
    if (verifyOnly) {
      const verification = await verifyCustomerDetailSmoke(null);
      printResult('verify', verification);
      return;
    }

    await requireApiReady();
    const customerAuth = await mobileAuth(TARGET_CUSTOMER_PHONE, Role.CUSTOMER);
    assertCondition(
      customerAuth.user?.id === TARGET_CUSTOMER_USER_ID &&
        customerAuth.user?.customerProfile?.id === TARGET_CUSTOMER_PROFILE_ID,
      'Customer OTP session resolved to an unexpected profile.',
    );
    const { approverAuth, makerAuth } = await ensureAdminAuthPair();

    await enrichCustomerIdentity(customerAuth.accessToken);
    const selectedLocations = await ensureSelectedLocations(customerAuth.accessToken);
    await ensureCustomerDeviceSignals(customerAuth.accessToken);

    const providerCandidates = await findReadyProviderCandidates(4);
    assertCondition(providerCandidates.length >= 4, 'Four ready smoke Partners are required.');
    await ensurePartnerDiscoverySignals(customerAuth.accessToken, providerCandidates.slice(0, 4));

    const completedBooking = await ensureCompletedScenario({
      adminAuth: makerAuth,
      customerAuth,
      marker: COMPLETED_MARKER,
      providerCandidate: providerCandidates[0],
      selectedLocationId: selectedLocations[0].id,
    });
    const refundedBooking = await ensureCompletedScenario({
      adminAuth: makerAuth,
      approverAuth,
      customerAuth,
      marker: REFUNDED_MARKER,
      providerCandidate: providerCandidates[1],
      refund: true,
      selectedLocationId: selectedLocations[1].id,
    });
    const cancelledBooking = await ensureCancelledScenario({
      customerAuth,
      providerCandidate: providerCandidates[2],
      selectedLocationId: selectedLocations[0].id,
    });
    await ensureBookingGateEvidence(customerAuth.accessToken, providerCandidates[0].service.id);
    await ensureCustomerOpsNote(makerAuth.accessToken);
    await ensureWalletAdjustments(makerAuth, approverAuth);
    const liveBooking = await ensureLiveMatchedScenario({
      customerAuth,
      providerCandidate: providerCandidates[3],
      selectedLocationId: selectedLocations[1].id,
    });

    const verification = await verifyCustomerDetailSmoke(makerAuth.accessToken);
    printResult('seed', {
      ...verification,
      bookingIds: {
        cancelled: cancelledBooking.id,
        completed: completedBooking.id,
        live: liveBooking.id,
        refunded: refundedBooking.id,
      },
      customerName: target.user.fullName,
    });
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          targetCustomerProfileId: TARGET_CUSTOMER_PROFILE_ID,
          error: error instanceof Error ? error.message : String(error),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

async function requireTargetCustomer() {
  const target = await prisma.customerProfile.findUnique({
    where: { id: TARGET_CUSTOMER_PROFILE_ID },
    include: { user: true },
  });
  if (!target || target.userId !== TARGET_CUSTOMER_USER_ID || target.user.phone !== TARGET_CUSTOMER_PHONE) {
    throw new Error('Referral smoke target is missing. Run npm run referrals:smoke-seed once before this script.');
  }
  return target;
}

async function requireApiReady() {
  const health = await request('/health');
  if (health?.ok !== true) {
    throw new Error(`Local API is not healthy at ${apiBaseUrl}.`);
  }
}

async function enrichCustomerIdentity(accessToken) {
  await patchJson('/customer/me', accessToken, {
    email: 'smoke.customer.detail@hands.local',
    fullName: 'Smoke Customer Detail Profile',
  });
}

async function ensureSelectedLocations(accessToken) {
  const fixtures = [
    {
      addressText: '22 Le Thanh Ton, Ben Nghe Ward, District 1, Ho Chi Minh City, Vietnam',
      lat: 10.7769,
      lng: 106.7009,
    },
    {
      addressText: '15 Nguyen Hue, Ben Nghe Ward, District 1, Ho Chi Minh City, Vietnam',
      lat: 10.7746,
      lng: 106.7036,
    },
  ];
  const existing = await prisma.customerSelectedLocation.findMany({
    where: { customerProfileId: TARGET_CUSTOMER_PROFILE_ID },
    orderBy: { createdAt: 'asc' },
  });
  const rows = [...existing];
  for (const fixture of fixtures) {
    let row = rows.find((candidate) => candidate.addressText === fixture.addressText);
    if (!row) {
      row = await postJson('/customer/locations/selected', accessToken, fixture);
      rows.push(row);
    }
  }
  return fixtures.map((fixture) => rows.find((row) => row.addressText === fixture.addressText));
}

async function ensureCustomerDeviceSignals(accessToken) {
  await postJson('/app/session', accessToken, {
    appVersion: '2.6.0-smoke',
    deviceId: 'hands-customer-detail-smoke-device',
    deviceLanguage: 'vi-VN',
    lastLoginAddress: 'District 1, Ho Chi Minh City, Vietnam',
    metadata: { fixture: 'customer-detail-smoke', network: 'wifi' },
    platform: 'android',
    role: Role.CUSTOMER,
  });
  await patchJson('/notifications/device-token/register', accessToken, {
    platform: 'android',
    token: 'hands-customer-detail-smoke-push-token',
  });
}

async function findReadyProviderCandidates(limit) {
  const rows = await prisma.providerProfile.findMany({
    where: {
      blockedAt: null,
      deletedAt: null,
      kyc: { is: { status: ProviderKycStatus.APPROVED } },
      selectedBookings: { none: { status: { in: ACTIVE_BOOKING_STATUSES } } },
      verification: { is: { status: VerificationStatus.APPROVED } },
    },
    include: {
      services: {
        where: { active: true, service: { active: true } },
        include: { service: { include: { payoutRules: { where: { active: true } } } } },
      },
      user: true,
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    take: 40,
  });
  const candidates = [];
  for (const provider of rows) {
    const service = provider.services.find((providerService) =>
      providerService.service.payoutRules.some((rule) => rule.customerPrice === providerService.price),
    );
    if (!service || !provider.user.phone || !provider.user.roles.includes(Role.PROVIDER)) continue;
    const wallet = await prisma.providerWalletLedgerEntry.aggregate({
      where: { providerProfileId: provider.id },
      _sum: { amount: true },
    });
    if ((wallet._sum.amount ?? 0) < 0) continue;
    candidates.push({
      id: provider.id,
      displayName: provider.displayName,
      phone: provider.user.phone,
      service: {
        id: service.serviceId,
        name: service.service.name,
        price: service.price,
      },
    });
    if (candidates.length >= limit) break;
  }
  return candidates;
}

async function ensurePartnerDiscoverySignals(customerAccessToken, candidates) {
  const [favorites, views] = await Promise.all([
    getJson('/customer/partner-favorites', customerAccessToken),
    getJson('/customer/partner-profile-views', customerAccessToken),
  ]);
  const favoriteIds = new Set(favorites.map((row) => row.providerProfileId));
  const viewedIds = new Set(views.map((row) => row.providerProfileId));
  for (const candidate of candidates) {
    if (viewedIds.size < 4 && !viewedIds.has(candidate.id)) {
      await postJson(`/customer/partners/${candidate.id}/view`, customerAccessToken);
      viewedIds.add(candidate.id);
    }
    if (favoriteIds.size < 4 && !favoriteIds.has(candidate.id)) {
      await postJson(`/customer/partners/${candidate.id}/favorite`, customerAccessToken, { favorite: true });
      favoriteIds.add(candidate.id);
    }
  }
}

async function ensureCompletedScenario({
  adminAuth,
  approverAuth,
  customerAuth,
  marker,
  providerCandidate,
  refund = false,
  selectedLocationId,
}) {
  let booking = await findScenarioBooking(marker);
  const provider = booking
    ? await providerCandidateForBooking(booking, providerCandidate)
    : providerCandidate;
  const providerAuth = await prepareProvider(provider);
  if (!booking || isClosedBeforeCompletion(booking.status)) {
    booking = await postJson('/customer/bookings', customerAuth.accessToken, {
      currentLat: 10.7769,
      currentLng: 106.7009,
      currentLocationUpdatedAt: new Date().toISOString(),
      notes: marker,
      paymentMethod: PaymentMethod.MOMO,
      providerId: provider.id,
      selectedLocationId,
      serviceId: provider.service.id,
    });
  }

  booking = await advanceDigitalBookingAuthorization(booking, adminAuth.accessToken);
  booking = await ensureMatchedBooking(booking, customerAuth.accessToken, providerAuth.accessToken, provider.id);
  await ensureChatTranscript(booking.id, customerAuth.accessToken, providerAuth.accessToken, marker);
  booking = await completeBooking(booking, providerAuth.accessToken);
  booking = await findBooking(booking.id);

  if (booking.status === BookingStatus.COMPLETED && !booking.settlementSnapshot) {
    await postJson(`/admin/bookings/${booking.id}/closeout`, adminAuth.accessToken, {
      note: `${marker}: finance closeout verified through Admin API.`,
    });
    booking = await findBooking(booking.id);
  }
  await ensureBookingReviews(booking, customerAuth.accessToken, providerAuth.accessToken, marker);

  if (refund) {
    assertCondition(approverAuth, 'Refund scenario requires a finance approver.');
    booking = await ensureRefundedBooking(
      booking,
      adminAuth.accessToken,
      approverAuth.accessToken,
    );
  }
  return booking;
}

async function ensureCancelledScenario({ customerAuth, providerCandidate, selectedLocationId }) {
  let booking = await findScenarioBooking(CANCELLED_MARKER);
  if (!booking || ![BookingStatus.CANCELLED, BookingStatus.EXPIRED].includes(booking.status)) {
    if (!booking || !ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
      booking = await postJson('/customer/bookings', customerAuth.accessToken, {
        currentLat: 10.7769,
        currentLng: 106.7009,
        currentLocationUpdatedAt: new Date().toISOString(),
        notes: CANCELLED_MARKER,
        paymentMethod: PaymentMethod.CASH,
        selectedLocationId,
        serviceId: providerCandidate.service.id,
      });
    }
    booking = await postJson(`/customer/bookings/${booking.id}/cancel`, customerAuth.accessToken);
  }
  return findBooking(booking.id);
}

async function ensureLiveMatchedScenario({ customerAuth, providerCandidate, selectedLocationId }) {
  let booking = await findScenarioBooking(LIVE_MARKER);
  if (booking && ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
    const provider = await providerCandidateForBooking(booking, providerCandidate);
    const providerAuth = await prepareProvider(provider);
    booking = await ensureMatchedBooking(booking, customerAuth.accessToken, providerAuth.accessToken, provider.id);
    await ensureChatTranscript(booking.id, customerAuth.accessToken, providerAuth.accessToken, LIVE_MARKER);
    return findBooking(booking.id);
  }

  const providerAuth = await prepareProvider(providerCandidate);
  booking = await postJson('/customer/bookings', customerAuth.accessToken, {
    currentLat: 10.7746,
    currentLng: 106.7036,
    currentLocationUpdatedAt: new Date().toISOString(),
    notes: LIVE_MARKER,
    paymentMethod: PaymentMethod.CASH,
    providerId: providerCandidate.id,
    selectedLocationId,
    serviceId: providerCandidate.service.id,
  });
  booking = await ensureMatchedBooking(
    booking,
    customerAuth.accessToken,
    providerAuth.accessToken,
    providerCandidate.id,
  );
  await ensureChatTranscript(booking.id, customerAuth.accessToken, providerAuth.accessToken, LIVE_MARKER);
  return findBooking(booking.id);
}

async function prepareProvider(provider) {
  const auth = await mobileAuth(provider.phone, Role.PROVIDER);
  await postJson('/provider/online', auth.accessToken);
  await postJson('/provider/location', auth.accessToken, {
    addressText: 'District 1, Ho Chi Minh City, Vietnam',
    lat: 10.7769,
    lng: 106.7009,
  });
  return auth;
}

async function advanceDigitalBookingAuthorization(booking, adminAccessToken) {
  let current = await findBooking(booking.id);
  for (let attempt = 0; attempt < 3 && current.status === BookingStatus.CREATED; attempt += 1) {
    if (current.payment?.id) {
      await postJson(`/admin/payments/${current.payment.id}/sync`, adminAccessToken);
    }
    await sleep(250);
    current = await findBooking(current.id);
  }
  assertCondition(current.status !== BookingStatus.CREATED, `Payment authorization is still pending for ${current.id}.`);
  return current;
}

async function ensureMatchedBooking(booking, customerAccessToken, providerAccessToken, providerId) {
  let current = await findBooking(booking.id);
  if (current.status === BookingStatus.OPEN_MATCHING) {
    const participant = current.participants.find((row) => row.providerProfileId === providerId);
    if (!participant || !['ACCEPTED', 'SELECTED'].includes(participant.status)) {
      await postJson(`/provider/bookings/${current.id}/accept`, providerAccessToken);
      current = await findBooking(current.id);
    }
    if (current.status === BookingStatus.OPEN_MATCHING) {
      await postJson(`/customer/bookings/${current.id}/select-provider`, customerAccessToken, { providerId });
      current = await findBooking(current.id);
    }
  }
  assertCondition(
    [
      BookingStatus.MATCHED,
      BookingStatus.PROVIDER_ON_THE_WAY,
      BookingStatus.ARRIVED,
      BookingStatus.IN_SERVICE,
      BookingStatus.COMPLETED,
      BookingStatus.REFUNDED,
    ].includes(current.status),
    `Booking ${current.id} did not reach a matched state; current status is ${current.status}.`,
  );
  return current;
}

async function ensureChatTranscript(bookingId, customerAccessToken, providerAccessToken, marker) {
  const booking = await findBooking(bookingId);
  if (!booking.chatRoom?.id) return;
  const messages = booking.chatRoom.messages ?? [];
  const customerMessage = `${marker}: customer confirmed the address and lobby instructions.`;
  const providerMessage = `${marker}: Partner confirmed arrival timing and service preparation.`;
  if (!messages.some((message) => message.body === customerMessage)) {
    await postJson(`/chat/rooms/${booking.chatRoom.id}/messages`, customerAccessToken, {
      body: customerMessage,
    });
  }
  if (!messages.some((message) => message.body === providerMessage)) {
    await postJson(`/chat/rooms/${booking.chatRoom.id}/messages`, providerAccessToken, {
      body: providerMessage,
    });
  }
}

async function completeBooking(booking, providerAccessToken) {
  let current = await findBooking(booking.id);
  if ([BookingStatus.MATCHED, BookingStatus.PROVIDER_ON_THE_WAY, BookingStatus.ARRIVED].includes(current.status)) {
    await postJson(`/provider/bookings/${current.id}/start`, providerAccessToken);
    current = await findBooking(current.id);
  }
  if (current.status === BookingStatus.IN_SERVICE) {
    await postJson(`/provider/bookings/${current.id}/complete`, providerAccessToken, {
      addressText: 'District 1, Ho Chi Minh City, Vietnam',
      lat: 10.7769,
      lng: 106.7009,
    });
    current = await findBooking(current.id);
  }
  assertCondition(
    [BookingStatus.COMPLETED, BookingStatus.REFUNDED].includes(current.status),
    `Booking ${current.id} did not complete; current status is ${current.status}.`,
  );
  return current;
}

async function ensureBookingReviews(booking, customerAccessToken, providerAccessToken, marker) {
  const current = await findBooking(booking.id);
  if (!current.review) {
    await postJson('/customer/reviews', customerAccessToken, {
      bookingId: current.id,
      comment: `${marker}: clean, punctual service smoke review.`,
      rating: marker === REFUNDED_MARKER ? 3 : 5,
    });
  }
  if (!current.providerCustomerReview) {
    await postJson(`/provider/bookings/${current.id}/customer-evaluation`, providerAccessToken, {
      comment: `${marker}: customer communication and access instructions were verified.`,
    });
  }
}

async function ensureRefundedBooking(booking, adminAccessToken, approverAccessToken) {
  let current = await findBooking(booking.id);
  if (current.refunds.length === 0 && current.payment?.status === 'CAPTURED') {
    await postJson(
      `/admin/payments/${current.payment.id}/refund-request`,
      adminAccessToken,
      { reason: 'Customer detail smoke completed booking refund' },
    );
    await postJson(`/admin/payments/${current.payment.id}/refund`, approverAccessToken, {});
    current = await findBooking(current.id);
  }
  assertCondition(
    current.refunds.length > 0 && [BookingStatus.REFUNDED, BookingStatus.COMPLETED].includes(current.status),
    `Refund evidence was not created for booking ${current.id}.`,
  );
  return current;
}

async function ensureBookingGateEvidence(customerAccessToken, serviceId) {
  const existing = await prisma.adminAuditLog.findFirst({
    where: { action: 'booking.create.rejected', target: `customer:${TARGET_CUSTOMER_PROFILE_ID}` },
    orderBy: { createdAt: 'desc' },
  });
  if (existing && existing.metadata?.reasonCode === 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA') return;
  await expectRequestFailure(
    () =>
      postJson('/customer/bookings', customerAccessToken, {
        address: { line1: 'Customer detail smoke rejected location' },
        lat: 37.5665,
        lng: 126.978,
        notes: `${SMOKE_PREFIX}: intentional Vietnam service-area gate evidence.`,
        paymentMethod: PaymentMethod.CASH,
        serviceId,
      }),
    400,
  );
}

async function ensureCustomerOpsNote(adminAccessToken) {
  const existingRows = await prisma.adminAuditLog.findMany({
    where: { action: 'customer.ops_note.add', target: `customer:${TARGET_CUSTOMER_PROFILE_ID}` },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  if (existingRows.some((row) => row.metadata?.note === `${SMOKE_PREFIX}: identity and booking evidence reviewed.`)) {
    return;
  }
  await postJson(`/admin/customers/${TARGET_CUSTOMER_PROFILE_ID}/ops-note`, adminAccessToken, {
    note: `${SMOKE_PREFIX}: identity and booking evidence reviewed.`,
    preset: 'Smoke customer detail verification',
  });
}

async function ensureWalletAdjustments(makerAuth, approverAuth) {
  for (const adjustment of WALLET_ADJUSTMENTS) {
    let requestRow = await prisma.manualWalletAdjustmentRequest.findFirst({
      where: {
        ownerId: TARGET_CUSTOMER_PROFILE_ID,
        ownerType: 'CUSTOMER',
        reason: adjustment.reason,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!requestRow || requestRow.status === ManualWalletAdjustmentRequestStatus.REJECTED) {
      requestRow = await postJson('/admin/wallet-adjustment-requests', makerAuth.accessToken, {
        ...adjustment,
        currency: 'VND',
        ownerId: TARGET_CUSTOMER_PROFILE_ID,
        ownerType: 'CUSTOMER',
      });
    }
    if (requestRow.status === ManualWalletAdjustmentRequestStatus.REQUESTED) {
      await postJson(
        `/admin/wallet-adjustment-requests/${encodeURIComponent(requestRow.id)}/approve`,
        approverAuth.accessToken,
      );
    }
  }
}

async function findScenarioBooking(marker) {
  return prisma.booking.findFirst({
    where: { customerProfileId: TARGET_CUSTOMER_PROFILE_ID, notes: marker },
    orderBy: { createdAt: 'desc' },
    include: bookingSmokeInclude,
  });
}

async function findBooking(id) {
  return prisma.booking.findUniqueOrThrow({ where: { id }, include: bookingSmokeInclude });
}

const bookingSmokeInclude = {
  chatRoom: { include: { messages: { orderBy: { createdAt: 'asc' } } } },
  earning: true,
  participants: true,
  payment: true,
  providerCustomerReview: true,
  refunds: true,
  review: true,
  settlementSnapshot: true,
};

async function providerCandidateForBooking(booking, fallback) {
  const providerId = booking.selectedProviderId ?? booking.preferredProviderId;
  if (!providerId || providerId === fallback.id) return fallback;
  const provider = await prisma.providerProfile.findUniqueOrThrow({
    where: { id: providerId },
    include: {
      services: {
        where: { active: true, service: { active: true } },
        include: { service: { include: { payoutRules: { where: { active: true } } } } },
      },
      user: true,
    },
  });
  const service = provider.services.find((row) =>
    row.service.payoutRules.some((rule) => rule.customerPrice === row.price),
  );
  assertCondition(service && provider.user.phone, `Booking ${booking.id} Partner cannot be authenticated.`);
  return {
    id: provider.id,
    displayName: provider.displayName,
    phone: provider.user.phone,
    service: { id: service.serviceId, name: service.service.name, price: service.price },
  };
}

async function ensureAdminAuthPair() {
  let maker = await prisma.user.findFirst({
    where: { roles: { has: Role.ADMIN } },
    orderBy: { id: 'asc' },
  });
  if (!maker) {
    maker = await prisma.user.create({
      data: {
        fullName: 'Customer Detail Smoke Admin Maker',
        id: 'smoke_customer_detail_admin_maker_user',
        phone: '+84909100991',
        roles: [Role.ADMIN],
      },
    });
  }
  let approver = await prisma.user.findFirst({
    where: {
      id: { not: maker.id },
      AND: [{ roles: { has: Role.ADMIN } }, { roles: { has: Role.FINANCE_APPROVER } }],
    },
    orderBy: { id: 'asc' },
  });
  if (!approver) {
    approver = await prisma.user.upsert({
      where: { id: 'smoke_customer_detail_admin_approver_user' },
      update: { roles: { set: [Role.ADMIN, Role.FINANCE_APPROVER] } },
      create: {
        fullName: 'Customer Detail Smoke Finance Approver',
        id: 'smoke_customer_detail_admin_approver_user',
        phone: '+84909100992',
        roles: [Role.ADMIN, Role.FINANCE_APPROVER],
      },
    });
  }
  return { makerAuth: adminAuth(maker), approverAuth: adminAuth(approver) };
}

function adminAuth(user) {
  return {
    user,
    accessToken: jwt.sign(
      { activeRole: Role.ADMIN, roles: user.roles, sub: user.id },
      jwtAccessSecretFromEnv(env),
      { expiresIn: '20m' },
    ),
  };
}

async function mobileAuth(phone, role) {
  return request('/auth/verify-otp', {
    body: JSON.stringify({ otp: env.DEV_OTP ?? '123456', phone, role }),
    method: 'POST',
  });
}

async function verifyCustomerDetailSmoke(adminAccessToken) {
  const [profile, statusGroups, walletBalance, walletRequests] = await Promise.all([
    prisma.customerProfile.findUniqueOrThrow({
      where: { id: TARGET_CUSTOMER_PROFILE_ID },
      include: {
        favoriteProviders: true,
        providerReviews: true,
        reviews: true,
        selectedLocations: true,
        user: { include: { appSessions: true, notifications: true, pushDevices: true } },
        viewedProviders: true,
      },
    }),
    prisma.booking.groupBy({
      by: ['status'],
      where: { customerProfileId: TARGET_CUSTOMER_PROFILE_ID },
      _count: { _all: true },
    }),
    prisma.customerWalletLedgerEntry.aggregate({
      where: { customerProfileId: TARGET_CUSTOMER_PROFILE_ID },
      _sum: { amount: true },
    }),
    prisma.manualWalletAdjustmentRequest.count({
      where: { ownerId: TARGET_CUSTOMER_PROFILE_ID, ownerType: 'CUSTOMER' },
    }),
  ]);
  const bookingCount = statusGroups.reduce((sum, row) => sum + row._count._all, 0);
  const statusCounts = Object.fromEntries(statusGroups.map((row) => [row.status, row._count._all]));
  const notificationCount = profile.user.notifications.length;
  const assertions = {
    appSessions: profile.user.appSessions.length >= 1,
    bookings: bookingCount >= 4,
    email: profile.user.email === 'smoke.customer.detail@hands.local',
    favorites: profile.favoriteProviders.length >= 4,
    locations: profile.selectedLocations.length >= 2,
    notifications: notificationCount >= 4,
    providerReviews: profile.providerReviews.length >= 2,
    pushDevices: profile.user.pushDevices.length >= 1,
    reviews: profile.reviews.length >= 2,
    views: profile.viewedProviders.length >= 4,
    walletAdjustments: walletRequests >= 2,
  };
  const failedAssertions = Object.entries(assertions)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  if (failedAssertions.length > 0) {
    throw new Error(`Customer detail smoke verification failed: ${failedAssertions.join(', ')}.`);
  }

  let adminDetailVerified = null;
  if (adminAccessToken) {
    const detail = await getJson(
      `/admin/customers/${TARGET_CUSTOMER_PROFILE_ID}?includeDiagnostics=true`,
      adminAccessToken,
    );
    const adjustmentRows = await getJson(
      `/admin/wallet-adjustments?ownerType=CUSTOMER&ownerId=${encodeURIComponent(
        TARGET_CUSTOMER_PROFILE_ID,
      )}&take=10`,
      adminAccessToken,
    );
    adminDetailVerified = Boolean(
      detail?.id === TARGET_CUSTOMER_PROFILE_ID &&
        detail.bookings?.length >= 4 &&
        detail.auditLogs?.length >= 2 &&
        adjustmentRows.length >= 2,
    );
    assertCondition(adminDetailVerified, 'Admin customer detail API did not expose the seeded evidence.');
  }

  return {
    adminDetailVerified,
    counts: {
      appSessions: profile.user.appSessions.length,
      bookings: bookingCount,
      favorites: profile.favoriteProviders.length,
      locations: profile.selectedLocations.length,
      notifications: notificationCount,
      providerReviews: profile.providerReviews.length,
      pushDevices: profile.user.pushDevices.length,
      reviews: profile.reviews.length,
      views: profile.viewedProviders.length,
      walletAdjustmentRequests: walletRequests,
    },
    page: `http://localhost:3101/customers/${TARGET_CUSTOMER_PROFILE_ID}`,
    statusCounts,
    targetCustomerProfileId: TARGET_CUSTOMER_PROFILE_ID,
    walletBalance: walletBalance._sum.amount ?? 0,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
    error.status = response.status;
    throw error;
  }
  return body;
}

const getJson = (path, accessToken) =>
  request(path, { headers: { authorization: `Bearer ${accessToken}` } });

const postJson = (path, accessToken, body = {}) =>
  request(path, {
    body: JSON.stringify(body),
    headers: { authorization: `Bearer ${accessToken}` },
    method: 'POST',
  });

const patchJson = (path, accessToken, body = {}) =>
  request(path, {
    body: JSON.stringify(body),
    headers: { authorization: `Bearer ${accessToken}` },
    method: 'PATCH',
  });

async function expectRequestFailure(callback, expectedStatus) {
  try {
    await callback();
  } catch (error) {
    if (error?.status === expectedStatus) return error.message;
    throw error;
  }
  throw new Error(`Expected request to fail with HTTP ${expectedStatus}.`);
}

function jwtAccessSecretFromEnv(sourceEnv) {
  const configured = sourceEnv.JWT_ACCESS_SECRET?.trim();
  if (configured && !['change-me', 'changeme', 'secret', 'password'].includes(configured.toLowerCase())) {
    return configured;
  }
  return 'dev-access-secret';
}

function assertLocalSmokeTarget(value, nodeEnv) {
  const host = new URL(value).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    fail('Customer detail smoke data may only target a local API.');
  }
  if (nodeEnv === 'production') {
    fail('Customer detail smoke data is disabled when NODE_ENV=production.');
  }
}

function isClosedBeforeCompletion(status) {
  return [BookingStatus.CANCELLED, BookingStatus.EXPIRED, BookingStatus.NO_SHOW].includes(status);
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printResult(action, verification) {
  console.log(JSON.stringify({ ok: true, action, verification }, null, 2));
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}

await main();
