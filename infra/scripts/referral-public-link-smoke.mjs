import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const dryRun = process.argv.includes('--dry-run');
const { env, envFileExists, envPath } = loadMergedEnv(envFile);

const baseUrl = trimTrailingSlash(
  env.REFERRAL_PUBLIC_LINK_SMOKE_BASE_URL ??
    env.ADMIN_WEB_BASE_URL ??
    env.REFERRAL_PUBLIC_BASE_URL ??
    'http://127.0.0.1:3101',
);

const cases = [
  {
    audience: 'customer',
    code: 'SMOKECUSTREF',
    envKey: 'REFERRAL_CUSTOMER_ANDROID_STORE_URL',
    path: '/r/customer/SMOKECUSTREF',
    platform: 'android',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; HANDS Referral Smoke)',
  },
  {
    audience: 'customer',
    code: 'SMOKECUSTREF',
    envKey: 'REFERRAL_CUSTOMER_IOS_STORE_URL',
    path: '/r/customer/SMOKECUSTREF',
    platform: 'ios',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  },
  {
    audience: 'partner',
    code: 'SMOKEPARTREF',
    envKey: 'REFERRAL_PARTNER_ANDROID_STORE_URL',
    path: '/r/partner/SMOKEPARTREF',
    platform: 'android',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; HANDS Partner Referral Smoke)',
  },
  {
    audience: 'partner',
    code: 'SMOKEPARTREF',
    envKey: 'REFERRAL_PARTNER_IOS_STORE_URL',
    path: '/r/partner/SMOKEPARTREF',
    platform: 'ios',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
  },
];

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'referral-public-link-dry-run',
        baseUrl,
        envFile: { path: envPath, exists: envFileExists },
        cases: cases.map((testCase) => ({
          audience: testCase.audience,
          code: testCase.code,
          envKey: testCase.envKey,
          path: testCase.path,
          platform: testCase.platform,
          storeUrlConfigured: Boolean(storeEnvValue(testCase.audience, testCase.platform)),
        })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

try {
  const results = [];
  for (const testCase of cases) {
    results.push(await verifyReferralLink(testCase));
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'referral-public-link-smoke',
        baseUrl,
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
        action: 'referral-public-link-smoke',
        baseUrl,
        envFile: { path: envPath, exists: envFileExists },
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}

async function verifyReferralLink(testCase) {
  const response = await fetch(`${baseUrl}${testCase.path}`, {
    headers: { 'user-agent': testCase.userAgent },
    redirect: 'manual',
  });
  const storeUrlConfigured = Boolean(storeEnvValue(testCase.audience, testCase.platform));

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    assertCondition(Boolean(location), `${testCase.path} redirected without a Location header.`);
    assertReferralMetadata(location, testCase);

    return {
      audience: testCase.audience,
      code: testCase.code,
      mode: 'redirect',
      path: testCase.path,
      platform: testCase.platform,
      status: response.status,
      target: location,
    };
  }

  if (response.status === 200) {
    const body = await response.text();
    assertCondition(
      body.includes(`${testCase.code}`) && body.includes('referral link') && body.includes('app store URL'),
      `${testCase.path} fallback page did not include referral setup guidance.`,
    );
    assertCondition(
      !storeUrlConfigured,
      `${testCase.path} returned fallback HTML even though ${testCase.envKey} appears configured. Restart Admin Web with the updated env or verify the store URL.`,
    );

    return {
      audience: testCase.audience,
      code: testCase.code,
      mode: 'fallback',
      path: testCase.path,
      platform: testCase.platform,
      status: response.status,
      target: null,
    };
  }

  throw new Error(`${testCase.path} returned unexpected status ${response.status}.`);
}

function assertReferralMetadata(location, testCase) {
  const url = new URL(location, baseUrl);
  const referrer = url.searchParams.get('referrer');
  if (referrer) {
    assertCondition(
      referrer.includes(`referral_code=${testCase.code}`) &&
        referrer.includes(`referral_audience=${testCase.audience}`),
      `${testCase.path} redirect referrer did not preserve referral_code/referral_audience.`,
    );
    return;
  }

  assertCondition(
    url.searchParams.get('referral_code') === testCase.code,
    `${testCase.path} redirect did not include referral_code.`,
  );
  assertCondition(
    url.searchParams.get('referral_audience') === testCase.audience,
    `${testCase.path} redirect did not include referral_audience.`,
  );
}

function storeEnvValue(audience, platform) {
  const audienceKey = audience.toUpperCase();
  const platformKey = platform.toUpperCase();
  return (
    nonEmptyString(env[`REFERRAL_${audienceKey}_${platformKey}_STORE_URL`]) ??
    nonEmptyString(env[`${audienceKey}_${platformKey}_STORE_URL`]) ??
    nonEmptyString(env[`${audienceKey}_${platformKey}_APP_URL`])
  );
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function trimTrailingSlash(value) {
  return String(value).replace(/\/+$/, '');
}
