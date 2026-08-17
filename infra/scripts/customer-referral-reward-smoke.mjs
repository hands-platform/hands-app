import jwt from 'jsonwebtoken';
import {
  BookingStatus,
  PaymentMethod,
  PrismaClient,
  ProviderKycStatus,
  Role,
  VerificationStatus,
} from '@prisma/client';

import { loadMergedEnv } from './lib/env-file.mjs';

const REFERRER_CUSTOMER_PROFILE_ID = 'smoke_referral_customer_referred_profile';
const REFERRER_CUSTOMER_PHONE = '+84909100011';
const REFERRED_CUSTOMER_PHONE = '+84909100013';
const REFERRED_CUSTOMER_NAME = 'Smoke Referred Customer Activity';
const BOOKING_MARKER = 'HANDS customer referral reward smoke / qualifying completed booking';
const LOCATION_ADDRESS = '28 Le Loi, Ben Nghe Ward, District 1, Ho Chi Minh City, Vietnam';
const LOCATION_LAT = 10.7731;
const LOCATION_LNG = 106.7008;
const ACTIVE_BOOKING_STATUSES = [
  BookingStatus.CREATED,
  BookingStatus.OPEN_MATCHING,
  BookingStatus.MATCHED,
  BookingStatus.PROVIDER_ON_THE_WAY,
  BookingStatus.ARRIVED,
  BookingStatus.IN_SERVICE,
];
const bookingVerificationInclude = {
  earning: true,
  payment: true,
  referralRewards: true,
  settlementSnapshot: true,
};

const envFile =
  process.argv.find((argument) => argument.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const dryRun = process.argv.includes('--dry-run');
const verifyOnly = process.argv.includes('--verify-only');
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
const apiBaseUrl = trimTrailingSlash(env.API_BASE_URL ?? 'http://localhost:3000/api');

if (env.DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

assertLocalSmokeTarget(apiBaseUrl, env.NODE_ENV);
assertCondition(Boolean(process.env.DATABASE_URL), 'DATABASE_URL is required for referral reward verification.');

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        action: 'customer-referral-reward-dry-run',
        apiBaseUrl,
        bookingMarker: BOOKING_MARKER,
        envFile: { exists: envFileExists, path: envPath },
        mutations: verifyOnly
          ? []
          : [
              'NestJS customer selected location',
              'NestJS customer CASH booking',
              'NestJS Partner accept/start/complete',
              'NestJS Admin booking closeout',
            ],
        ok: true,
        referredCustomerPhone: REFERRED_CUSTOMER_PHONE,
        referrerCustomerProfileId: REFERRER_CUSTOMER_PROFILE_ID,
        verifyOnly,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const prisma = new PrismaClient();

try {
  await assertApiReady();
  const referrerAuth = await mobileAuth(REFERRER_CUSTOMER_PHONE, Role.CUSTOMER);
  const referredAuth = await mobileAuth(REFERRED_CUSTOMER_PHONE, Role.CUSTOMER);
  const referredCustomerProfileId = referredAuth.user?.customerProfile?.id;

  assertCondition(
    referrerAuth.user?.customerProfile?.id === REFERRER_CUSTOMER_PROFILE_ID,
    'Referrer OTP session resolved to an unexpected customer profile.',
  );
  assertCondition(Boolean(referredCustomerProfileId), 'Referred customer profile was not found.');

  const attribution = await requireCustomerAttribution(referredCustomerProfileId);
  const policy = await requireCustomerReferralPolicy();
  let booking = await findSmokeBooking(referredCustomerProfileId);

  if (!verifyOnly && !booking) {
    const location = await ensureCustomerLocation(referredCustomerProfileId, referredAuth.accessToken);
    const provider = await findReadyProviderCandidate();
    const providerAuth = await prepareProvider(provider);

    booking = await postJson('/customer/bookings', referredAuth.accessToken, {
      currentLat: LOCATION_LAT,
      currentLng: LOCATION_LNG,
      currentLocationUpdatedAt: new Date().toISOString(),
      notes: BOOKING_MARKER,
      paymentMethod: PaymentMethod.CASH,
      providerId: provider.id,
      selectedLocationId: location.id,
      serviceId: provider.service.id,
    });
    booking = await advanceBookingToCompletion(booking.id, provider, providerAuth.accessToken);
  } else if (!verifyOnly && booking && booking.status !== BookingStatus.COMPLETED) {
    assertCondition(
      ACTIVE_BOOKING_STATUSES.includes(booking.status),
      `Existing referral smoke booking cannot be resumed from ${booking.status}.`,
    );
    const provider = await providerCandidateForBooking(booking);
    const providerAuth = await prepareProvider(provider);
    booking = await advanceBookingToCompletion(booking.id, provider, providerAuth.accessToken);
  }

  assertCondition(Boolean(booking), 'Qualifying referral smoke booking does not exist.');
  booking = await findBooking(booking.id);
  assertCondition(booking.status === BookingStatus.COMPLETED, 'Qualifying booking is not completed.');

  let reward = await rewardForBooking(attribution.id, booking.id);
  if (!verifyOnly && !reward) {
    const admin = await requireAdminActor();
    await postJson(`/admin/bookings/${booking.id}/closeout`, adminAuthToken(admin), {
      note: `${BOOKING_MARKER}: referral reward amount verification.`,
    });
    booking = await findBooking(booking.id);
    reward = await rewardForBooking(attribution.id, booking.id);
  }

  assertCondition(Boolean(reward), 'Completed booking closeout did not create a customer referral reward.');
  const expected = await expectedRewardAmount({ booking, policy, reward });
  assertCondition(
    reward.amount === expected.amount,
    `Referral reward amount mismatch. Expected ${expected.amount} VND, received ${reward.amount} VND.`,
  );
  assertCondition(
    reward.walletOwnerCustomerProfileId === REFERRER_CUSTOMER_PROFILE_ID,
    'Referral reward was assigned to an unexpected customer wallet owner.',
  );
  assertCondition(
    reward.calculationSnapshot?.bookingId === booking.id &&
      reward.calculationSnapshot?.rewardAmountSnapshot === reward.amount,
    'Referral reward calculation snapshot does not match the qualifying booking.',
  );

  const [summary, walletLedgerCount] = await Promise.all([
    getJson('/customer/referrals/summary', referrerAuth.accessToken),
    prisma.customerWalletLedgerEntry.count({ where: { referralRewardId: reward.id } }),
  ]);
  assertCondition(summary.totals?.rewardCount >= 1, 'Customer referral summary did not expose the reward.');
  assertCondition(
    (summary.totals?.pendingAmount ?? 0) +
        (summary.totals?.availableAmount ?? 0) +
        (summary.totals?.rewardedAmount ?? 0) >=
      reward.amount,
    'Customer referral summary amount is lower than the qualifying reward.',
  );
  if (reward.status === 'PENDING') {
    assertCondition(walletLedgerCount === 0, 'Pending referral reward must not credit the wallet before release.');
  }

  console.log(
    JSON.stringify(
      {
        action: verifyOnly ? 'customer-referral-reward-verify' : 'customer-referral-reward-smoke',
        booking: {
          customerPaymentAmount: booking.settlementSnapshot?.customerPaymentAmount ?? booking.payment?.amount,
          id: booking.id,
          paymentMethod: booking.payment?.method,
          paymentStatus: booking.payment?.status,
          platformFeeGross: booking.earning?.platformFee,
          status: booking.status,
        },
        calculation: expected,
        ok: true,
        page: `http://localhost:3101/customers/${REFERRER_CUSTOMER_PROFILE_ID}#customer-referral-context`,
        policy: {
          commissionPercentBps: policy.commissionPercentBps,
          holdPeriodDays: policy.holdPeriodDays,
          perRewardCapAmount: policy.perRewardCapAmount,
          totalRewardCapAmount: policy.totalRewardCapAmount,
        },
        referredCustomer: {
          id: referredCustomerProfileId,
          name: referredAuth.user?.fullName ?? REFERRED_CUSTOMER_NAME,
        },
        referral: {
          attributionId: attribution.id,
          referrerCustomerProfileId: REFERRER_CUSTOMER_PROFILE_ID,
        },
        reward: {
          amount: reward.amount,
          availableAt: reward.availableAt,
          currency: reward.currency,
          id: reward.id,
          status: reward.status,
          walletCredited: walletLedgerCount > 0,
        },
        summary: summary.totals,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        action: 'customer-referral-reward-smoke',
        error: error instanceof Error ? error.message : String(error),
        ok: false,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

async function assertApiReady() {
  const health = await request('/health');
  assertCondition(health.ok === true, `Local API is not healthy at ${apiBaseUrl}.`);
}

async function requireCustomerAttribution(referredCustomerProfileId) {
  const attribution = await prisma.referralAttribution.findFirst({
    where: {
      audience: 'CUSTOMER',
      referredCustomerProfileId,
      referrerCustomerProfileId: REFERRER_CUSTOMER_PROFILE_ID,
    },
    orderBy: { createdAt: 'desc' },
  });
  assertCondition(
    attribution && ['REGISTERED', 'QUALIFIED'].includes(attribution.status),
    'Active customer referral attribution is missing. Run customers:referral-activity-smoke first.',
  );
  return attribution;
}

async function requireCustomerReferralPolicy() {
  const policy = await prisma.referralPolicy.findUnique({ where: { audience: 'CUSTOMER' } });
  assertCondition(policy?.enabled, 'Customer referral policy is disabled or missing.');
  assertCondition(
    policy.rewardMode === 'COMMISSION_PERCENT' && Number.isInteger(policy.commissionPercentBps),
    'Customer referral policy must use a commission percentage.',
  );
  return policy;
}

async function ensureCustomerLocation(customerProfileId, accessToken) {
  const existing = await prisma.customerSelectedLocation.findFirst({
    where: { customerProfileId, addressText: LOCATION_ADDRESS },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) return existing;
  return postJson('/customer/locations/selected', accessToken, {
    addressText: LOCATION_ADDRESS,
    lat: LOCATION_LAT,
    lng: LOCATION_LNG,
  });
}

async function findReadyProviderCandidate() {
  const providers = await prisma.providerProfile.findMany({
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
    orderBy: { updatedAt: 'desc' },
    take: 40,
  });

  for (const provider of providers) {
    const service = provider.services.find((row) =>
      row.service.payoutRules.some(
        (rule) => rule.customerPrice === row.price && rule.providerPayoutAmount < rule.customerPrice,
      ),
    );
    if (!service || !provider.user.phone || !provider.user.roles.includes(Role.PROVIDER)) continue;
    const wallet = await prisma.providerWalletLedgerEntry.aggregate({
      where: { providerProfileId: provider.id },
      _sum: { amount: true },
    });
    if ((wallet._sum.amount ?? 0) < 0) continue;
    return providerCandidate(provider, service);
  }
  throw new Error('A ready Partner with a positive platform fee service is required.');
}

async function providerCandidateForBooking(booking) {
  const providerId = booking.selectedProviderId ?? booking.preferredProviderId;
  assertCondition(Boolean(providerId), `Booking ${booking.id} does not have a Partner.`);
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
  const service = provider.services.find((row) => row.serviceId === booking.serviceId);
  assertCondition(service && provider.user.phone, `Booking ${booking.id} Partner cannot be authenticated.`);
  return providerCandidate(provider, service);
}

function providerCandidate(provider, providerService) {
  return {
    id: provider.id,
    phone: provider.user.phone,
    service: { id: providerService.serviceId, price: providerService.price },
  };
}

async function prepareProvider(provider) {
  const auth = await mobileAuth(provider.phone, Role.PROVIDER);
  await postJson('/provider/online', auth.accessToken);
  await postJson('/provider/location', auth.accessToken, {
    addressText: LOCATION_ADDRESS,
    lat: LOCATION_LAT,
    lng: LOCATION_LNG,
  });
  return auth;
}

async function advanceBookingToCompletion(bookingId, provider, providerAccessToken) {
  let booking = await findBooking(bookingId);
  if (booking.status === BookingStatus.OPEN_MATCHING) {
    await postJson(`/provider/bookings/${booking.id}/accept`, providerAccessToken);
    booking = await findBooking(booking.id);
  }
  assertCondition(
    [
      BookingStatus.MATCHED,
      BookingStatus.PROVIDER_ON_THE_WAY,
      BookingStatus.ARRIVED,
      BookingStatus.IN_SERVICE,
      BookingStatus.COMPLETED,
    ].includes(booking.status),
    `Booking ${booking.id} did not match the preferred Partner; status is ${booking.status}.`,
  );
  assertCondition(
    booking.selectedProviderId === provider.id,
    `Booking ${booking.id} selected an unexpected Partner.`,
  );

  if ([BookingStatus.MATCHED, BookingStatus.PROVIDER_ON_THE_WAY, BookingStatus.ARRIVED].includes(booking.status)) {
    await postJson(`/provider/bookings/${booking.id}/start`, providerAccessToken);
    booking = await findBooking(booking.id);
  }
  if (booking.status === BookingStatus.IN_SERVICE) {
    await postJson(`/provider/bookings/${booking.id}/complete`, providerAccessToken, {
      addressText: LOCATION_ADDRESS,
      lat: LOCATION_LAT,
      lng: LOCATION_LNG,
    });
    booking = await findBooking(booking.id);
  }
  assertCondition(booking.status === BookingStatus.COMPLETED, `Booking ${booking.id} did not complete.`);
  return booking;
}

async function requireAdminActor() {
  const admin = await prisma.user.findFirst({
    where: { roles: { has: Role.ADMIN } },
    orderBy: { id: 'asc' },
  });
  assertCondition(Boolean(admin), 'An existing Admin actor is required for booking closeout.');
  return admin;
}

function adminAuthToken(admin) {
  return jwt.sign(
    { activeRole: Role.ADMIN, roles: admin.roles, sub: admin.id },
    jwtAccessSecretFromEnv(env),
    { expiresIn: '20m' },
  );
}

async function expectedRewardAmount({ booking, policy, reward }) {
  const platformFeeGross = booking.earning?.platformFee ?? 0;
  const platformFeeVatRateBps = metadataWholeBps(policy.metadata, 'platformFeeVatRateBps') ?? 800;
  const companyOutputVat = Math.round(
    (platformFeeGross * platformFeeVatRateBps) / (10_000 + platformFeeVatRateBps),
  );
  const platformFeeNetRevenue = platformFeeGross - companyOutputVat;
  const uncappedReward = Math.round(
    (platformFeeNetRevenue * policy.commissionPercentBps) / 10_000,
  );
  const perRewardCapped = policy.perRewardCapAmount
    ? Math.min(uncappedReward, policy.perRewardCapAmount)
    : uncappedReward;
  const priorRewards = await prisma.referralReward.aggregate({
    where: {
      id: { not: reward.id },
      status: { notIn: ['CANCELLED', 'REVERSED'] },
      walletOwnerCustomerProfileId: REFERRER_CUSTOMER_PROFILE_ID,
      attribution: { audience: 'CUSTOMER' },
    },
    _sum: { amount: true },
  });
  const priorRewardAmount = priorRewards._sum.amount ?? 0;
  const lifetimeRemaining = policy.totalRewardCapAmount
    ? Math.max(policy.totalRewardCapAmount - priorRewardAmount, 0)
    : perRewardCapped;

  return {
    amount: Math.min(perRewardCapped, lifetimeRemaining),
    companyOutputVat,
    lifetimePriorRewardAmount: priorRewardAmount,
    platformFeeGross,
    platformFeeNetRevenue,
    platformFeeVatRateBps,
    referralRateBps: policy.commissionPercentBps,
    uncappedReward,
  };
}

function metadataWholeBps(metadata, key) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = metadata[key];
  return Number.isInteger(value) && value >= 0 && value <= 10_000 ? value : null;
}

async function findSmokeBooking(customerProfileId) {
  return prisma.booking.findFirst({
    where: { customerProfileId, notes: { startsWith: BOOKING_MARKER } },
    orderBy: { createdAt: 'desc' },
    include: bookingVerificationInclude,
  });
}

async function findBooking(id) {
  return prisma.booking.findUniqueOrThrow({ where: { id }, include: bookingVerificationInclude });
}

async function rewardForBooking(attributionId, bookingId) {
  return prisma.referralReward.findFirst({
    where: { attributionId, qualifyingBookingId: bookingId },
    orderBy: { createdAt: 'desc' },
  });
}

async function mobileAuth(phone, role) {
  return request('/auth/verify-otp', {
    body: JSON.stringify({ otp: env.DEV_OTP ?? '123456', phone, role }),
    method: 'POST',
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers ?? {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      `${options.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`,
    );
    error.status = response.status;
    throw error;
  }
  return body;
}

function getJson(path, accessToken) {
  return request(path, { headers: { authorization: `Bearer ${accessToken}` } });
}

let bookingRequestSequence = 0;

function postJson(path, accessToken, body = {}) {
  return request(path, {
    body: JSON.stringify(withBookingIdempotencyKey(path, body)),
    headers: { authorization: `Bearer ${accessToken}` },
    method: 'POST',
  });
}

function withBookingIdempotencyKey(path, body) {
  if (path !== '/customer/bookings' || body.idempotencyKey) return body;
  bookingRequestSequence += 1;
  return {
    ...body,
    idempotencyKey: `referral-smoke-booking-${Date.now()}-${process.pid}-${bookingRequestSequence}`,
  };
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
    throw new Error('Customer referral reward smoke may only target a local API.');
  }
  if (nodeEnv === 'production') {
    throw new Error('Customer referral reward smoke is disabled when NODE_ENV=production.');
  }
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/u, '');
}
