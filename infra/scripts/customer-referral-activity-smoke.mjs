import { loadMergedEnv } from './lib/env-file.mjs';

const TARGET_CUSTOMER_PROFILE_ID = 'smoke_referral_customer_referred_profile';
const TARGET_CUSTOMER_USER_ID = 'smoke_referral_customer_referred_user';
const TARGET_CUSTOMER_PHONE = '+84909100011';
const REFERRED_CUSTOMER_PHONE = '+84909100013';
const REFERRED_CUSTOMER_NAME = 'Smoke Referred Customer Activity';

const envFile =
  process.argv.find((argument) => argument.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const dryRun = process.argv.includes('--dry-run');
const { env, envFileExists, envPath } = loadMergedEnv(envFile);
const apiBaseUrl = trimTrailingSlash(env.API_BASE_URL ?? 'http://localhost:3000/api');

assertLocalApi(apiBaseUrl);

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        action: 'customer-referral-activity-dry-run',
        apiBaseUrl,
        envFile: { exists: envFileExists, path: envPath },
        ok: true,
        referredCustomerPhone: REFERRED_CUSTOMER_PHONE,
        targetCustomerProfileId: TARGET_CUSTOMER_PROFILE_ID,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

try {
  const health = await request('/health');
  assertCondition(health.ok === true, `Local API is not healthy at ${apiBaseUrl}.`);

  const targetAuth = await mobileAuth(TARGET_CUSTOMER_PHONE);
  assertCondition(
    targetAuth.user?.id === TARGET_CUSTOMER_USER_ID &&
      targetAuth.user?.customerProfile?.id === TARGET_CUSTOMER_PROFILE_ID,
    'Target customer OTP session resolved to an unexpected profile.',
  );

  const referralCode = await request('/customer/referral-code', {
    headers: bearer(targetAuth.accessToken),
    method: 'POST',
  });
  assertCondition(referralCode.active === true && referralCode.code, 'Target referral code was not issued.');

  const referredAuth = await mobileAuth(REFERRED_CUSTOMER_PHONE);
  assertCondition(
    Boolean(referredAuth.user?.customerProfile?.id),
    'Referred customer profile was not created through mobile auth.',
  );
  assertCondition(
    referredAuth.user.customerProfile.id !== TARGET_CUSTOMER_PROFILE_ID,
    'The referred customer must not resolve to the target customer profile.',
  );

  await request('/customer/me', {
    body: JSON.stringify({ fullName: REFERRED_CUSTOMER_NAME }),
    headers: bearer(referredAuth.accessToken),
    method: 'PATCH',
  });

  const attribution = await request('/customer/referrals/claim', {
    body: JSON.stringify({
      code: referralCode.code,
      installSource: 'customer-detail-smoke',
      platform: 'android',
    }),
    headers: bearer(referredAuth.accessToken),
    method: 'POST',
  });
  assertCondition(
    attribution.referrerCustomerProfileId === TARGET_CUSTOMER_PROFILE_ID,
    'Referral claim did not resolve to the target customer.',
  );
  assertCondition(
    attribution.referredCustomerProfileId === referredAuth.user.customerProfile.id,
    'Referral claim returned an unexpected referred customer.',
  );

  const summary = await request('/customer/referrals/summary', {
    headers: bearer(targetAuth.accessToken),
  });
  assertCondition(
    summary.referralCode?.code === referralCode.code,
    'Referral summary returned another code.',
  );
  assertCondition(summary.totals?.referralCount >= 1, 'Referral summary did not count the smoke referral.');

  console.log(
    JSON.stringify(
      {
        action: 'customer-referral-activity-smoke',
        attribution: {
          id: attribution.id,
          installSource: attribution.installSource,
          platform: attribution.platform,
          status: attribution.status,
        },
        ok: true,
        referralCode: referralCode.code,
        referredCustomer: {
          id: referredAuth.user.customerProfile.id,
          name: REFERRED_CUSTOMER_NAME,
        },
        summary: summary.totals,
        targetCustomerProfileId: TARGET_CUSTOMER_PROFILE_ID,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        action: 'customer-referral-activity-smoke',
        error: error instanceof Error ? error.message : String(error),
        ok: false,
        targetCustomerProfileId: TARGET_CUSTOMER_PROFILE_ID,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}

async function mobileAuth(phone) {
  return request('/auth/verify-otp', {
    body: JSON.stringify({ otp: env.DEV_OTP ?? '123456', phone, role: 'CUSTOMER' }),
    method: 'POST',
  });
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

function bearer(accessToken) {
  assertCondition(Boolean(accessToken), 'Mobile auth did not return an access token.');
  return { authorization: `Bearer ${accessToken}` };
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertLocalApi(value) {
  const url = new URL(value);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('Customer referral activity smoke is restricted to a local API URL.');
  }
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/u, '');
}
