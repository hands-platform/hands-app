import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, ReferralRewardStatus } from '@prisma/client';
import { loadMergedEnv } from './lib/env-file.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const dryRun = process.argv.includes('--dry-run');
const { env, envFileExists, envPath } = loadMergedEnv(envFile);

const apiBaseUrl = trimTrailingSlash(
  env.REFERRAL_SMOKE_API_BASE_URL ?? env.API_BASE_URL ?? env.ADMIN_API_BASE_URL ?? 'http://localhost:3000/api',
);
const adminPhone = nonEmptyString(env.REFERRAL_SMOKE_ADMIN_PHONE) ?? nonEmptyString(env.ADMIN_DEMO_PHONE) ?? '+84900000099';
const adminOtp = nonEmptyString(env.REFERRAL_SMOKE_ADMIN_OTP) ?? nonEmptyString(env.ADMIN_DEMO_OTP) ?? '123456';

const ids = {
  customerHoldReward: 'smoke_referral_customer_pending_reward',
  customerParentProfile: 'smoke_referral_customer_parent_profile',
  partnerReverseReward: 'smoke_referral_partner_pending_reward',
  partnerParentProfile: 'smoke_referral_partner_parent_profile',
};

const actionPlan = [
  {
    action: 'referral_reward.hold',
    expectedStatus: ReferralRewardStatus.HELD,
    reason: 'Smoke hold referral reward candidate.',
    rewardId: ids.customerHoldReward,
    route: '/admin/referrals/rewards/smoke_referral_customer_pending_reward/hold',
  },
  {
    action: 'referral_reward.reverse',
    expectedStatus: ReferralRewardStatus.REVERSED,
    reason: 'Smoke reverse referral reward candidate.',
    rewardId: ids.partnerReverseReward,
    route: '/admin/referrals/rewards/smoke_referral_partner_pending_reward/reverse',
  },
];

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'reward-action-dry-run',
        apiBaseUrl,
        envFile: { path: envPath, exists: envFileExists },
        ids,
        seedScript: 'referral-smoke-seed.mjs',
        actions: actionPlan.map(({ action, expectedStatus, rewardId, route }) => ({
          action,
          expectedStatus,
          rewardId,
          route,
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
  fail('DATABASE_URL is required for referral reward action smoke verification.');
}

const prisma = new PrismaClient();

try {
  runSeedScript();

  const adminAuth = await request('/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ phone: adminPhone, otp: adminOtp, role: 'ADMIN' }),
  });
  const accessToken = adminAuth.accessToken;
  assertCondition(Boolean(accessToken), 'Admin auth did not return an access token.');

  const holdResult = await postJson(actionPlan[0].route, accessToken, { reason: actionPlan[0].reason });
  const reverseResult = await postJson(actionPlan[1].route, accessToken, { reason: actionPlan[1].reason });

  assertCondition(holdResult?.status === ReferralRewardStatus.HELD, 'Hold action did not return HELD status.');
  assertCondition(
    reverseResult?.status === ReferralRewardStatus.REVERSED,
    'Reverse action did not return REVERSED status.',
  );

  const verification = await verifyRewardActions();
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'reward-action-smoke',
        apiBaseUrl,
        envFile: { path: envPath, exists: envFileExists },
        customerParentDetail: `/referrals/customers/${ids.customerParentProfile}`,
        partnerParentDetail: `/referrals/partners/${ids.partnerParentProfile}`,
        verification,
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
      `referral-smoke-seed.mjs failed before reward action smoke: ${JSON.stringify({
        status: result.status,
        stdout: result.stdout?.slice(0, 1000),
        stderr: result.stderr?.slice(0, 1000),
      })}`,
    );
  }
}

async function verifyRewardActions() {
  const rewards = await prisma.referralReward.findMany({
    where: { id: { in: actionPlan.map((action) => action.rewardId) } },
    select: {
      id: true,
      status: true,
      walletLedgerReference: true,
    },
  });
  const rewardsById = new Map(rewards.map((reward) => [reward.id, reward]));

  const auditLogs = await prisma.adminAuditLog.findMany({
    where: {
      action: { in: actionPlan.map((action) => action.action) },
      target: { in: actionPlan.map((action) => `referral_reward:${action.rewardId}`) },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      action: true,
      metadata: true,
      target: true,
    },
    take: 20,
  });

  const verified = actionPlan.map((expected) => {
    const reward = rewardsById.get(expected.rewardId);
    assertCondition(Boolean(reward), `Missing reward after action: ${expected.rewardId}`);
    assertCondition(
      reward.status === expected.expectedStatus,
      `Reward ${expected.rewardId} status mismatch: expected ${expected.expectedStatus}, got ${reward.status}`,
    );
    assertCondition(
      reward.walletLedgerReference === null,
      `Reward ${expected.rewardId} should remain wallet-candidate-only.`,
    );

    const auditLog = auditLogs.find(
      (log) =>
        log.action === expected.action &&
        log.target === `referral_reward:${expected.rewardId}` &&
        log.metadata?.status === expected.expectedStatus,
    );
    assertCondition(Boolean(auditLog), `Missing audit log for ${expected.action} ${expected.rewardId}`);
    assertCondition(
      auditLog.metadata?.walletCreditCreated === false,
      `Audit log ${expected.action} must record walletCreditCreated=false.`,
    );
    assertCondition(
      String(auditLog.metadata?.reason ?? '').includes(expected.reason),
      `Audit log ${expected.action} must include the smoke reason.`,
    );

    return {
      action: expected.action,
      auditTarget: auditLog.target,
      rewardId: reward.id,
      status: reward.status,
      walletCreditCreated: auditLog.metadata.walletCreditCreated,
      walletLedgerReference: reward.walletLedgerReference,
    };
  });

  return { verified };
}

async function postJson(path, accessToken, body = {}) {
  return request(path, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(body),
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
