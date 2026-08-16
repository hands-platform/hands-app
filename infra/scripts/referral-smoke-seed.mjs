import {
  PrismaClient,
  ProviderStatus,
  ReferralAttributionStatus,
  ReferralAudience,
  ReferralFraudReviewStatus,
  ReferralRewardStatus,
  Role,
} from '@prisma/client';
import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const cleanupOnly = process.argv.includes('--cleanup');
const dryRun = process.argv.includes('--dry-run');
const allowMutation = process.argv.includes('--apply') && process.env.REFERRAL_SMOKE_ALLOW_MUTATION === 'confirmed';
const { env, envFileExists, envPath } = loadMergedEnv(envFile);

if (env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

const ids = {
  customerParentUser: 'smoke_referral_customer_parent_user',
  customerParentProfile: 'smoke_referral_customer_parent_profile',
  customerReferredUser: 'smoke_referral_customer_referred_user',
  customerReferredProfile: 'smoke_referral_customer_referred_profile',
  partnerParentUser: 'smoke_referral_partner_parent_user',
  partnerParentProfile: 'smoke_referral_partner_parent_profile',
  partnerReferredUser: 'smoke_referral_partner_referred_user',
  partnerReferredProfile: 'smoke_referral_partner_referred_profile',
  customerCode: 'smoke_referral_customer_code',
  partnerCode: 'smoke_referral_partner_code',
  customerAttribution: 'smoke_referral_customer_attribution',
  partnerAttribution: 'smoke_referral_partner_attribution',
  customerPendingReward: 'smoke_referral_customer_pending_reward',
  customerAvailableReward: 'smoke_referral_customer_available_reward',
  partnerPendingReward: 'smoke_referral_partner_pending_reward',
  partnerAvailableReward: 'smoke_referral_partner_available_reward',
};

const phones = {
  customerParent: '+84909100010',
  customerReferred: '+84909100011',
  partnerParent: '+84909100020',
  partnerReferred: '+84909100021',
};

const sourceKeys = {
  customerPending: 'smoke-referral:customer:pending',
  customerAvailable: 'smoke-referral:customer:available',
  partnerPending: 'smoke-referral:partner:pending',
  partnerAvailable: 'smoke-referral:partner:available',
};

const pages = [
  '/referrals/customers',
  '/referrals/customers/smoke_referral_customer_parent_profile',
  '/referrals/partners',
  '/referrals/partners/smoke_referral_partner_parent_profile',
];

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: cleanupOnly ? 'cleanup-dry-run' : 'seed-dry-run',
        envFile: { path: envPath, exists: envFileExists },
        ids,
        pages,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL is required for referral smoke seed.');
}

const prisma = new PrismaClient();
const now = new Date();
const fixtureRunId = process.env.REFERRAL_FIXTURE_RUN_ID ?? `referral-admin-${now.toISOString()}`;
const fixtureMetadata = { smoke: 'referral-admin', fixtureRunId };

try {
  if (!allowMutation) {
    fail('Referral smoke mutation is disabled. Use --dry-run, or explicitly pass --apply with REFERRAL_SMOKE_ALLOW_MUTATION=confirmed in an isolated test database.');
  }

  if (cleanupOnly) {
    fail('Cleanup is no longer performed by the seed. Run referrals:fixture-inventory and review the manifest instead.');
  } else {
    await seedSmokeData();
    const verification = await verifySmokeData();
    console.log(
      JSON.stringify(
        {
          ok: true,
          action: 'seed',
          envFile: { path: envPath, exists: envFileExists },
          pages,
          verification,
        },
        null,
        2,
      ),
    );
  }
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        envFile: { path: envPath, exists: envFileExists },
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

async function seedSmokeData() {
  await seedCustomers();
  await seedPartners();
  await seedCodes();
  await seedAttributions();
  await seedRewards();
}

async function seedCustomers() {
  await upsertUser({
    id: ids.customerParentUser,
    fullName: 'Smoke Referral Parent Customer',
    phone: phones.customerParent,
    roles: [Role.CUSTOMER],
  });
  await upsertUser({
    id: ids.customerReferredUser,
    fullName: 'Smoke Referral Referred Customer',
    phone: phones.customerReferred,
    roles: [Role.CUSTOMER],
  });

  await upsertCustomerProfile(ids.customerParentProfile, ids.customerParentUser);
  await upsertCustomerProfile(ids.customerReferredProfile, ids.customerReferredUser);
}

async function seedPartners() {
  await upsertUser({
    id: ids.partnerParentUser,
    fullName: 'Smoke Referral Parent Partner',
    phone: phones.partnerParent,
    roles: [Role.PROVIDER],
  });
  await upsertUser({
    id: ids.partnerReferredUser,
    fullName: 'Smoke Referral Referred Partner',
    phone: phones.partnerReferred,
    roles: [Role.PROVIDER],
  });

  await upsertProviderProfile({
    id: ids.partnerParentProfile,
    userId: ids.partnerParentUser,
    displayName: 'Smoke Referral Parent Partner',
    status: ProviderStatus.ONLINE_AVAILABLE,
  });
  await upsertProviderProfile({
    id: ids.partnerReferredProfile,
    userId: ids.partnerReferredUser,
    displayName: 'Smoke Referral Referred Partner',
    status: ProviderStatus.OFFLINE,
  });
}

async function seedCodes() {
  await prisma.referralCode.upsert({
    where: { code: 'SMOKECUSTREF' },
    update: {
      active: true,
      audience: ReferralAudience.CUSTOMER,
      ownerCustomerProfileId: ids.customerParentProfile,
      ownerProviderProfileId: null,
      metadata: fixtureMetadata,
    },
    create: {
      id: ids.customerCode,
      audience: ReferralAudience.CUSTOMER,
      code: 'SMOKECUSTREF',
      ownerCustomerProfileId: ids.customerParentProfile,
      metadata: fixtureMetadata,
    },
  });

  await prisma.referralCode.upsert({
    where: { code: 'SMOKEPARTREF' },
    update: {
      active: true,
      audience: ReferralAudience.PARTNER,
      ownerCustomerProfileId: null,
      ownerProviderProfileId: ids.partnerParentProfile,
      metadata: fixtureMetadata,
    },
    create: {
      id: ids.partnerCode,
      audience: ReferralAudience.PARTNER,
      code: 'SMOKEPARTREF',
      ownerProviderProfileId: ids.partnerParentProfile,
      metadata: fixtureMetadata,
    },
  });
}

async function seedAttributions() {
  await prisma.referralAttribution.upsert({
    where: {
      audience_referredCustomerProfileId: {
        audience: ReferralAudience.CUSTOMER,
        referredCustomerProfileId: ids.customerReferredProfile,
      },
    },
    update: {
      referralCodeId: ids.customerCode,
      referrerCustomerProfileId: ids.customerParentProfile,
      referrerProviderProfileId: null,
      referredProviderProfileId: null,
      installSource: 'referral-link',
      platform: 'android',
      status: ReferralAttributionStatus.QUALIFIED,
      fraudReviewStatus: ReferralFraudReviewStatus.CLEAR,
      metadata: fixtureMetadata,
    },
    create: {
      id: ids.customerAttribution,
      audience: ReferralAudience.CUSTOMER,
      referralCodeId: ids.customerCode,
      referrerCustomerProfileId: ids.customerParentProfile,
      referredCustomerProfileId: ids.customerReferredProfile,
      installSource: 'referral-link',
      platform: 'android',
      status: ReferralAttributionStatus.QUALIFIED,
      fraudReviewStatus: ReferralFraudReviewStatus.CLEAR,
      metadata: fixtureMetadata,
    },
  });

  await prisma.referralAttribution.upsert({
    where: {
      audience_referredProviderProfileId: {
        audience: ReferralAudience.PARTNER,
        referredProviderProfileId: ids.partnerReferredProfile,
      },
    },
    update: {
      referralCodeId: ids.partnerCode,
      referrerCustomerProfileId: null,
      referrerProviderProfileId: ids.partnerParentProfile,
      referredCustomerProfileId: null,
      installSource: 'referral-link',
      platform: 'ios',
      status: ReferralAttributionStatus.QUALIFIED,
      fraudReviewStatus: ReferralFraudReviewStatus.CLEAR,
      metadata: fixtureMetadata,
    },
    create: {
      id: ids.partnerAttribution,
      audience: ReferralAudience.PARTNER,
      referralCodeId: ids.partnerCode,
      referrerProviderProfileId: ids.partnerParentProfile,
      referredProviderProfileId: ids.partnerReferredProfile,
      installSource: 'referral-link',
      platform: 'ios',
      status: ReferralAttributionStatus.QUALIFIED,
      fraudReviewStatus: ReferralFraudReviewStatus.CLEAR,
      metadata: fixtureMetadata,
    },
  });
}

async function seedRewards() {
  await upsertReward({
    id: ids.customerPendingReward,
    amount: 25000,
    attributionId: ids.customerAttribution,
    availableAt: null,
    sourceKey: sourceKeys.customerPending,
    status: ReferralRewardStatus.PENDING,
    walletOwnerCustomerProfileId: ids.customerParentProfile,
  });
  await upsertReward({
    id: ids.customerAvailableReward,
    amount: 50000,
    attributionId: ids.customerAttribution,
    availableAt: now,
    sourceKey: sourceKeys.customerAvailable,
    status: ReferralRewardStatus.AVAILABLE,
    walletOwnerCustomerProfileId: ids.customerParentProfile,
  });
  await upsertReward({
    id: ids.partnerPendingReward,
    amount: 150000,
    attributionId: ids.partnerAttribution,
    availableAt: null,
    sourceKey: sourceKeys.partnerPending,
    status: ReferralRewardStatus.PENDING,
    walletOwnerProviderProfileId: ids.partnerParentProfile,
  });
  await upsertReward({
    id: ids.partnerAvailableReward,
    amount: 150000,
    attributionId: ids.partnerAttribution,
    availableAt: now,
    sourceKey: sourceKeys.partnerAvailable,
    status: ReferralRewardStatus.AVAILABLE,
    walletOwnerProviderProfileId: ids.partnerParentProfile,
  });
}

async function upsertUser({ fullName, id, phone, roles }) {
  await prisma.user.upsert({
    where: { id },
    update: {
      fullName,
      phone,
      roles: { set: roles },
    },
    create: {
      id,
      phone,
      fullName,
      roles,
    },
  });
}

async function upsertCustomerProfile(id, userId) {
  await prisma.customerProfile.upsert({
    where: { userId },
    update: {
      addresses: [
        {
          label: 'Referral smoke address',
          addressText: '22 Le Thanh Ton, Ben Nghe Ward, District 1, Ho Chi Minh City',
          lat: 10.7769,
          lng: 106.7009,
        },
      ],
    },
    create: {
      id,
      userId,
      addresses: [
        {
          label: 'Referral smoke address',
          addressText: '22 Le Thanh Ton, Ben Nghe Ward, District 1, Ho Chi Minh City',
          lat: 10.7769,
          lng: 106.7009,
        },
      ],
    },
  });
}

async function upsertProviderProfile({ displayName, id, status, userId }) {
  await prisma.providerProfile.upsert({
    where: { userId },
    update: {
      city: 'Ho Chi Minh City',
      currentLat: 10.7769,
      currentLng: 106.7009,
      currentLocationUpdatedAt: now,
      displayName,
      serviceArea: { cities: ['Ho Chi Minh City'], country: 'VN' },
      status,
    },
    create: {
      id,
      userId,
      city: 'Ho Chi Minh City',
      currentLat: 10.7769,
      currentLng: 106.7009,
      currentLocationUpdatedAt: now,
      displayName,
      serviceArea: { cities: ['Ho Chi Minh City'], country: 'VN' },
      status,
    },
  });
}

async function upsertReward({
  amount,
  attributionId,
  availableAt,
  id,
  sourceKey,
  status,
  walletOwnerCustomerProfileId = null,
  walletOwnerProviderProfileId = null,
}) {
  const data = {
    amount,
    attributionId,
    availableAt,
    calculationSnapshot: {
      ...fixtureMetadata,
      walletCreditCreated: false,
    },
    currency: 'VND',
    metadata: fixtureMetadata,
    notes: 'Smoke reward candidate for Admin referral UI verification.',
    qualifyingBookingId: null,
    sourceKey,
    status,
    walletLedgerReference: null,
    walletOwnerCustomerProfileId,
    walletOwnerProviderProfileId,
  };

  await prisma.referralReward.upsert({
    where: { sourceKey },
    update: {
      ...data,
      cancelledAt: null,
      heldAt: null,
      reversedAt: null,
    },
    create: {
      id,
      ...data,
    },
  });
}

async function verifySmokeData() {
  const [customerParent, partnerParent] = await Promise.all([
    prisma.customerProfile.findUnique({
      where: { id: ids.customerParentProfile },
      include: { referralsMade: { include: { rewards: true } }, referralCodes: true },
    }),
    prisma.providerProfile.findUnique({
      where: { id: ids.partnerParentProfile },
      include: { referralsMade: { include: { rewards: true } }, referralCodes: true },
    }),
  ]);

  assertCondition(customerParent?.referralsMade.length === 1, 'Customer parent referral was not seeded.');
  assertCondition(partnerParent?.referralsMade.length === 1, 'Partner parent referral was not seeded.');
  assertCondition(
    customerParent.referralsMade[0]?.rewards.length === 2,
    'Customer referral rewards should include pending and available candidates.',
  );
  assertCondition(
    partnerParent.referralsMade[0]?.rewards.length === 2,
    'Partner referral rewards should include pending and available candidates.',
  );
  assertCondition(
    [...customerParent.referralsMade[0].rewards, ...partnerParent.referralsMade[0].rewards].every(
      (reward) => reward.walletLedgerReference === null,
    ),
    'Referral smoke rewards must stay wallet-candidate-only.',
  );

  return {
    customerParentId: customerParent.id,
    customerRewards: countBy(customerParent.referralsMade[0].rewards, (reward) => reward.status),
    partnerParentId: partnerParent.id,
    partnerRewards: countBy(partnerParent.referralsMade[0].rewards, (reward) => reward.status),
  };
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
