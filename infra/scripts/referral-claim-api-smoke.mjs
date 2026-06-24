import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, ReferralAttributionStatus, ReferralAudience, Role } from '@prisma/client';
import { loadMergedEnv } from './lib/env-file.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const dryRun = process.argv.includes('--dry-run');
const { env, envFileExists, envPath } = loadMergedEnv(envFile);

const apiBaseUrl = trimTrailingSlash(
  env.REFERRAL_CLAIM_SMOKE_API_BASE_URL ?? env.API_BASE_URL ?? env.ADMIN_API_BASE_URL ?? 'http://localhost:3000/api',
);
const otp = nonEmptyString(env.REFERRAL_CLAIM_SMOKE_OTP) ?? nonEmptyString(env.DEV_OTP) ?? '123456';

const ids = {
  customerUser: 'smoke_referral_claim_customer_user',
  customerProfile: 'smoke_referral_claim_customer_profile',
  partnerUser: 'smoke_referral_claim_partner_user',
  partnerProfile: 'smoke_referral_claim_partner_profile',
};

const phones = {
  customer: '+84909100012',
  partner: '+84909100022',
};

const claimPlan = [
  {
    audience: ReferralAudience.CUSTOMER,
    code: 'SMOKECUSTREF',
    endpoint: '/customer/referrals/claim',
    expectedProfileId: ids.customerProfile,
    installSource: 'referral-link',
    phone: phones.customer,
    platform: 'android',
    role: Role.CUSTOMER,
  },
  {
    audience: ReferralAudience.PARTNER,
    code: 'SMOKEPARTREF',
    endpoint: '/partner/referrals/claim',
    expectedProfileId: ids.partnerProfile,
    installSource: 'referral-link',
    phone: phones.partner,
    platform: 'ios',
    role: Role.PROVIDER,
  },
];

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'referral-claim-api-dry-run',
        apiBaseUrl,
        envFile: { path: envPath, exists: envFileExists },
        ids,
        seedScript: 'referral-smoke-seed.mjs',
        claims: claimPlan.map(({ audience, code, endpoint, platform, role }) => ({
          audience,
          code,
          endpoint,
          platform,
          role,
        })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

if (env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}
if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL is required for referral claim API smoke verification.');
}

const prisma = new PrismaClient();

try {
  runSeedScript();
  await resetClaimActors();
  await seedClaimActors();

  const results = [];
  for (const claim of claimPlan) {
    results.push(await verifyClaim(claim));
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'referral-claim-api-smoke',
        apiBaseUrl,
        envFile: { path: envPath, exists: envFileExists },
        results,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        action: 'referral-claim-api-smoke',
        apiBaseUrl,
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

function runSeedScript() {
  const seedScript = resolve(scriptDir, 'referral-smoke-seed.mjs');
  const result = spawnSync(process.execPath, [seedScript, `--env=${envFile}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(
      `referral-smoke-seed.mjs failed before claim API smoke: ${JSON.stringify({
        status: result.status,
        stdout: result.stdout?.slice(0, 1000),
        stderr: result.stderr?.slice(0, 1000),
      })}`,
    );
  }
}

async function resetClaimActors() {
  await prisma.referralAttribution.deleteMany({
    where: {
      OR: [
        { referredCustomerProfileId: ids.customerProfile },
        { referredProviderProfileId: ids.partnerProfile },
      ],
    },
  });
  await prisma.customerProfile.deleteMany({ where: { id: ids.customerProfile } });
  await prisma.providerProfile.deleteMany({ where: { id: ids.partnerProfile } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.customerUser, ids.partnerUser] } } });
}

async function seedClaimActors() {
  await prisma.user.createMany({
    data: [
      {
        id: ids.customerUser,
        fullName: 'Smoke Referral Claim Customer',
        phone: phones.customer,
        roles: [Role.CUSTOMER],
      },
      {
        id: ids.partnerUser,
        fullName: 'Smoke Referral Claim Partner',
        phone: phones.partner,
        roles: [Role.PROVIDER],
      },
    ],
  });
  await prisma.customerProfile.create({
    data: {
      id: ids.customerProfile,
      userId: ids.customerUser,
      addresses: [
        {
          label: 'Referral claim smoke address',
          addressText: '85/9 Pham Viet Chanh, Thanh My Tay, Ho Chi Minh City',
          lat: 10.801,
          lng: 106.715,
        },
      ],
    },
  });
  await prisma.providerProfile.create({
    data: {
      id: ids.partnerProfile,
      userId: ids.partnerUser,
      city: 'Ho Chi Minh City',
      currentLat: 10.801,
      currentLng: 106.715,
      currentLocationUpdatedAt: new Date(),
      displayName: 'Smoke Referral Claim Partner',
      serviceArea: { cities: ['Ho Chi Minh City'], country: 'VN' },
    },
  });
}

async function verifyClaim(claim) {
  const auth = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: claim.phone, otp, role: claim.role }),
  });
  assertCondition(Boolean(auth.accessToken), `${claim.audience} auth did not return an access token.`);

  const response = await request(claim.endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${auth.accessToken}` },
    body: JSON.stringify({
      code: claim.code,
      installSource: claim.installSource,
      platform: claim.platform,
    }),
  });
  assertCondition(response.status === ReferralAttributionStatus.REGISTERED, `${claim.audience} claim was not REGISTERED.`);
  assertCondition(response.referralCode?.code === claim.code, `${claim.audience} claim returned the wrong code.`);

  const attribution = await prisma.referralAttribution.findFirst({
    where:
      claim.audience === ReferralAudience.CUSTOMER
        ? { audience: ReferralAudience.CUSTOMER, referredCustomerProfileId: claim.expectedProfileId }
        : { audience: ReferralAudience.PARTNER, referredProviderProfileId: claim.expectedProfileId },
    select: {
      id: true,
      audience: true,
      fraudReviewStatus: true,
      installSource: true,
      platform: true,
      status: true,
      referralCode: { select: { code: true } },
    },
  });
  assertCondition(Boolean(attribution), `${claim.audience} attribution was not created.`);
  assertCondition(
    attribution.status === ReferralAttributionStatus.REGISTERED,
    `${claim.audience} attribution must start as REGISTERED.`,
  );
  assertCondition(attribution.installSource === claim.installSource, `${claim.audience} installSource mismatch.`);
  assertCondition(attribution.platform === claim.platform, `${claim.audience} platform mismatch.`);
  assertCondition(attribution.referralCode.code === claim.code, `${claim.audience} DB code mismatch.`);

  return {
    audience: claim.audience,
    attributionId: attribution.id,
    code: attribution.referralCode.code,
    endpoint: claim.endpoint,
    fraudReviewStatus: attribution.fraudReviewStatus,
    installSource: attribution.installSource,
    platform: attribution.platform,
    status: attribution.status,
  };
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
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

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, '');
}
