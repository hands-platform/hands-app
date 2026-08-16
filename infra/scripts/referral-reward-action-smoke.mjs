import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import jwt from 'jsonwebtoken';
import {
  AdminUserProvenance,
  CustomerWalletLedgerType,
  PrismaClient,
  ProviderWalletLedgerType,
  ReferralRewardStatus,
  Role,
} from '@prisma/client';
import { loadMergedEnv } from './lib/env-file.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');
const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const dryRun = process.argv.includes('--dry-run');
const { env, envFileExists, envPath } = loadMergedEnv(envFile);

const apiBaseUrl = trimTrailingSlash(
  env.REFERRAL_SMOKE_API_BASE_URL ?? env.API_BASE_URL ?? env.ADMIN_API_BASE_URL ?? 'http://localhost:3000/api',
);
const adminWebBaseUrl = trimTrailingSlash(
  env.REFERRAL_SMOKE_ADMIN_WEB_BASE_URL ?? env.ADMIN_WEB_BASE_URL ?? 'http://localhost:3101',
);
const adminPhone = nonEmptyString(env.REFERRAL_SMOKE_ADMIN_PHONE) ?? nonEmptyString(env.ADMIN_DEMO_PHONE) ?? '+84900000099';

const ids = {
  customerCreditReward: 'smoke_referral_customer_available_reward',
  customerHoldReward: 'smoke_referral_customer_pending_reward',
  partnerCreditReward: 'smoke_referral_partner_available_reward',
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
    walletCreditCreated: false,
    walletOwner: null,
  },
  {
    action: 'referral_reward.credit',
    expectedStatus: ReferralRewardStatus.CREDITED,
    reason: 'Smoke credit referral reward candidate.',
    rewardId: ids.customerCreditReward,
    route: '/admin/referrals/rewards/smoke_referral_customer_available_reward/credit',
    walletCreditCreated: true,
    walletOwner: 'CUSTOMER',
  },
  {
    action: 'referral_reward.credit',
    expectedStatus: ReferralRewardStatus.CREDITED,
    reason: 'Smoke credit Partner referral reward candidate.',
    rewardId: ids.partnerCreditReward,
    route: '/admin/referrals/rewards/smoke_referral_partner_available_reward/credit',
    walletCreditCreated: true,
    walletOwner: 'PARTNER',
  },
  {
    action: 'referral_reward.reverse',
    expectedStatus: ReferralRewardStatus.REVERSED,
    reason: 'Smoke reverse referral reward candidate.',
    rewardId: ids.partnerReverseReward,
    route: '/admin/referrals/rewards/smoke_referral_partner_pending_reward/reverse',
    walletCreditCreated: false,
    walletOwner: null,
  },
];

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'reward-action-dry-run',
        adminWebBaseUrl,
        apiBaseUrl,
        envFile: { path: envPath, exists: envFileExists },
        ids,
        seedScript: 'referral-smoke-seed.mjs',
        actions: actionPlan.map(({ action, expectedStatus, rewardId, route, walletCreditCreated, walletOwner }) => ({
          action,
          expectedStatus,
          rewardId,
          route,
          walletCreditCreated,
          walletOwner,
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

  const adminAuth = await createSmokeAdminAuth(adminPhone);
  const accessToken = adminAuth.accessToken;
  assertCondition(Boolean(accessToken), 'Admin auth did not return an access token.');

  const actionResults = [];
  for (const plan of actionPlan) {
    actionResults.push(await postJson(plan.route, accessToken, { reason: plan.reason }));
  }

  for (const [index, result] of actionResults.entries()) {
    const plan = actionPlan[index];
    assertCondition(
      result?.status === plan.expectedStatus,
      `${plan.action} did not return ${plan.expectedStatus} status.`,
    );
  }

  const verification = await verifyRewardActions();
  const adminWebCookieHeader = await loadAdminWebSmokeCookieHeader();
  const adminWebEvidence = await verifyAdminWebDecisionEvidence(adminWebCookieHeader);
  console.log(
    JSON.stringify(
      {
        ok: true,
        action: 'reward-action-smoke',
        adminWebBaseUrl,
        apiBaseUrl,
        envFile: { path: envPath, exists: envFileExists },
        customerParentDetail: `/referrals/customers/${ids.customerParentProfile}`,
        partnerParentDetail: `/referrals/partners/${ids.partnerParentProfile}`,
        adminWebEvidence,
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
        adminWebBaseUrl,
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

async function createSmokeAdminAuth(phone) {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing && existing.adminUserProvenance !== AdminUserProvenance.FIXTURE) {
    throw new Error(`Refusing to grant smoke finance roles to non-fixture user ${existing.id}.`);
  }
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          adminUserProvenance: AdminUserProvenance.FIXTURE,
          fixtureKind: 'REFERRAL_REWARD_ACTION_SMOKE',
          fixtureRunId: ids.customerCreditReward,
          fullName: existing.fullName ?? 'HANDS Referral Smoke Admin',
          roles: { set: Array.from(new Set([...existing.roles, Role.ADMIN, Role.FINANCE_APPROVER])) },
        },
      })
    : await prisma.user.create({
        data: {
          adminUserProvenance: AdminUserProvenance.FIXTURE,
          fixtureKind: 'REFERRAL_REWARD_ACTION_SMOKE',
          fixtureRunId: ids.customerCreditReward,
          phone,
          fullName: 'HANDS Referral Smoke Admin',
          roles: [Role.ADMIN, Role.FINANCE_APPROVER],
        },
      });

  return {
    user,
    accessToken: jwt.sign(
      { sub: user.id, activeRole: Role.ADMIN, roles: user.roles },
      jwtAccessSecretFromEnv(env),
      { expiresIn: '30m' },
    ),
  };
}

function jwtAccessSecretFromEnv(sourceEnv) {
  const trimmed = sourceEnv.JWT_ACCESS_SECRET?.trim();
  if (trimmed && !['change-me', 'changeme', 'secret', 'password'].includes(trimmed.toLowerCase())) {
    return trimmed;
  }
  if (sourceEnv.NODE_ENV === 'production') {
    throw new Error('JWT_ACCESS_SECRET must be configured before running referral reward action smoke in production.');
  }
  return 'dev-access-secret';
}

async function verifyRewardActions() {
  const rewards = await prisma.referralReward.findMany({
    where: { id: { in: actionPlan.map((action) => action.rewardId) } },
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      walletLedgerReference: true,
    },
  });
  const rewardsById = new Map(rewards.map((reward) => [reward.id, reward]));
  const customerWalletLedgers = await prisma.customerWalletLedgerEntry.findMany({
    where: {
      sourceKey: {
        in: actionPlan
          .filter((action) => action.walletOwner === 'CUSTOMER')
          .map((action) => referralWalletCreditSourceKey(action.rewardId)),
      },
    },
    select: {
      amount: true,
      customerProfileId: true,
      currency: true,
      id: true,
      referralRewardId: true,
      sourceKey: true,
      type: true,
    },
  });
  const customerWalletLedgersBySourceKey = new Map(
    customerWalletLedgers.map((ledger) => [ledger.sourceKey, ledger]),
  );
  const providerWalletLedgers = await prisma.providerWalletLedgerEntry.findMany({
    where: {
      sourceKey: {
        in: actionPlan
          .filter((action) => action.walletOwner === 'PARTNER')
          .map((action) => referralWalletCreditSourceKey(action.rewardId)),
      },
    },
    select: {
      id: true,
      amount: true,
      currency: true,
      metadata: true,
      providerProfileId: true,
      sourceKey: true,
      type: true,
    },
  });
  const providerWalletLedgersBySourceKey = new Map(
    providerWalletLedgers.map((ledger) => [ledger.sourceKey, ledger]),
  );

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
    const ledgerSourceKey = referralWalletCreditSourceKey(expected.rewardId);
    const customerWalletLedger = customerWalletLedgersBySourceKey.get(ledgerSourceKey);
    const providerWalletLedger = providerWalletLedgersBySourceKey.get(ledgerSourceKey);
    if (expected.walletCreditCreated) {
      assertCondition(
        typeof reward.walletLedgerReference === 'string' && reward.walletLedgerReference.length > 0,
        `Reward ${expected.rewardId} should have a wallet ledger reference.`,
      );
      if (expected.walletOwner === 'CUSTOMER') {
        assertCondition(Boolean(customerWalletLedger), `Missing customer wallet ledger ${ledgerSourceKey}.`);
        assertCondition(
          customerWalletLedger.id === reward.walletLedgerReference,
          `Reward ${expected.rewardId} wallet ledger reference mismatch.`,
        );
        assertCondition(
          customerWalletLedger.type === CustomerWalletLedgerType.CUSTOMER_REFERRAL_EARNED,
          `Reward ${expected.rewardId} ledger type mismatch.`,
        );
        assertCondition(
          customerWalletLedger.referralRewardId === expected.rewardId,
          `Reward ${expected.rewardId} ledger should link back to the reward.`,
        );
        assertCondition(
          customerWalletLedger.customerProfileId === ids.customerParentProfile,
          `Reward ${expected.rewardId} ledger should credit the referral parent customer.`,
        );
      } else if (expected.walletOwner === 'PARTNER') {
        assertCondition(Boolean(providerWalletLedger), `Missing Partner wallet ledger ${ledgerSourceKey}.`);
        assertCondition(
          providerWalletLedger.id === reward.walletLedgerReference,
          `Reward ${expected.rewardId} wallet ledger reference mismatch.`,
        );
        assertCondition(
          providerWalletLedger.type === ProviderWalletLedgerType.PARTNER_REFERRAL_EARNED,
          `Reward ${expected.rewardId} ledger type mismatch.`,
        );
        assertCondition(
          providerWalletLedger.providerProfileId === ids.partnerParentProfile,
          `Reward ${expected.rewardId} ledger should credit the referral parent Partner.`,
        );
        assertCondition(
          providerWalletLedger.metadata?.referralRewardId === expected.rewardId,
          `Reward ${expected.rewardId} ledger metadata should link back to the reward.`,
        );
      }
    } else {
      assertCondition(
        reward.walletLedgerReference === null,
        `Reward ${expected.rewardId} should remain wallet-candidate-only.`,
      );
    }

    const auditLog = auditLogs.find(
      (log) =>
        log.action === expected.action &&
        log.target === `referral_reward:${expected.rewardId}` &&
        log.metadata?.status === expected.expectedStatus,
    );
    assertCondition(Boolean(auditLog), `Missing audit log for ${expected.action} ${expected.rewardId}`);
    assertCondition(
      auditLog.metadata?.walletCreditCreated === expected.walletCreditCreated,
      `Audit log ${expected.action} must record walletCreditCreated=${expected.walletCreditCreated}.`,
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
      walletLedgerSourceKey: expected.walletCreditCreated ? ledgerSourceKey : null,
    };
  });

  const journals = await verifyReferralRewardJournals({
    customerWalletLedgersBySourceKey,
    providerWalletLedgersBySourceKey,
    rewardsById,
  });

  return { journals, verified };
}

async function verifyReferralRewardJournals({
  customerWalletLedgersBySourceKey,
  providerWalletLedgersBySourceKey,
  rewardsById,
}) {
  const walletCreditActions = actionPlan.filter((action) => action.walletCreditCreated);
  const journalSourceKeys = walletCreditActions.map((action) =>
    referralRewardJournalSourceKey(action.rewardId, 'wallet-credit'),
  );
  const journals = await prisma.accountingJournalBatch.findMany({
    where: { sourceKey: { in: journalSourceKeys } },
    select: {
      entries: {
        select: {
          accountCode: true,
          amount: true,
          side: true,
        },
      },
      id: true,
      sourceKey: true,
      sourceType: true,
      status: true,
      totalCredit: true,
      totalDebit: true,
    },
  });
  const journalsBySourceKey = new Map(journals.map((journal) => [journal.sourceKey, journal]));

  return walletCreditActions.map((action) => {
    const reward = rewardsById.get(action.rewardId);
    assertCondition(Boolean(reward), `Missing reward while verifying referral journal: ${action.rewardId}`);

    const ledgerSourceKey = referralWalletCreditSourceKey(action.rewardId);
    const walletLedger =
      action.walletOwner === 'CUSTOMER'
        ? customerWalletLedgersBySourceKey.get(ledgerSourceKey)
        : providerWalletLedgersBySourceKey.get(ledgerSourceKey);
    assertCondition(Boolean(walletLedger), `Missing wallet ledger while verifying referral journal: ${ledgerSourceKey}`);

    const journalSourceKey = referralRewardJournalSourceKey(action.rewardId, 'wallet-credit');
    const journal = journalsBySourceKey.get(journalSourceKey);
    assertCondition(Boolean(journal), `Missing referral reward journal: ${journalSourceKey}`);
    assertCondition(journal.sourceType === 'REFERRAL_REWARD', `Referral journal ${journalSourceKey} sourceType mismatch.`);
    assertCondition(journal.status === 'POSTED', `Referral journal ${journalSourceKey} must be POSTED.`);
    assertBalancedAccountingJournal(`Referral reward journal ${action.rewardId}`, journal);

    const ownerAccountPrefix = action.walletOwner.toLowerCase();
    assertJournalEntry(`Referral reward journal ${action.rewardId}`, journal, {
      accountCode: `${ownerAccountPrefix}_referral_reward_expense`,
      amount: reward.amount,
      side: 'DEBIT',
    });
    assertJournalEntry(`Referral reward journal ${action.rewardId}`, journal, {
      accountCode: `${ownerAccountPrefix}_wallet_liability`,
      amount: walletLedger.amount,
      side: 'CREDIT',
    });

    return {
      entryCount: journal.entries.length,
      journalId: journal.id,
      rewardId: action.rewardId,
      sourceKey: journal.sourceKey,
      totalCredit: journal.totalCredit,
      totalDebit: journal.totalDebit,
    };
  });
}

function assertBalancedAccountingJournal(label, journal) {
  if (!journal?.entries?.length) {
    throw new Error(`${label} did not include journal entries: ${JSON.stringify(journal)}`);
  }
  const totalDebitFromEntries = accountingJournalEntryTotal(journal.entries, 'DEBIT');
  const totalCreditFromEntries = accountingJournalEntryTotal(journal.entries, 'CREDIT');
  if (
    journal.totalDebit !== journal.totalCredit ||
    journal.totalDebit !== totalDebitFromEntries ||
    journal.totalCredit !== totalCreditFromEntries
  ) {
    throw new Error(
      `${label} is not balanced: ${JSON.stringify({
        batchCredit: journal.totalCredit,
        batchDebit: journal.totalDebit,
        entryCredit: totalCreditFromEntries,
        entryDebit: totalDebitFromEntries,
        entries: journal.entries,
      })}`,
    );
  }
}

function assertJournalEntry(label, journal, expected) {
  const found = journal.entries?.some(
    (entry) =>
      entry.accountCode === expected.accountCode &&
      entry.amount === expected.amount &&
      entry.side === expected.side,
  );
  if (!found) {
    throw new Error(
      `${label} is missing expected journal entry: ${JSON.stringify({
        expected,
        entries: journal.entries,
      })}`,
    );
  }
}

function accountingJournalEntryTotal(entries, side) {
  return entries
    .filter((entry) => entry.side === side)
    .reduce((total, entry) => total + Number(entry.amount ?? 0), 0);
}

async function verifyAdminWebDecisionEvidence(adminWebCookieHeader) {
  const customerParentDetail = `/referrals/customers/${ids.customerParentProfile}`;
  const partnerParentDetail = `/referrals/partners/${ids.partnerParentProfile}`;
  const pages = [
    {
      path: customerParentDetail,
      expected: [
        'Decision evidence',
        'Latest decision Credit by',
        'Smoke credit referral reward candidate.',
        'Latest decision Hold by',
        'Smoke hold referral reward candidate.',
      ],
    },
    {
      path: partnerParentDetail,
      expected: [
        'Decision evidence',
        'Latest decision Credit by',
        'Smoke credit Partner referral reward candidate.',
        'Latest decision Reverse by',
        'Smoke reverse referral reward candidate.',
      ],
    },
  ];

  const verified = [];
  for (const page of pages) {
    const html = await requestAdminWebHtml(page.path, adminWebCookieHeader);
    for (const expectedText of page.expected) {
      assertCondition(
        html.includes(expectedText),
        `Admin Web ${page.path} is missing referral reward decision evidence: ${expectedText}`,
      );
    }
    verified.push({ path: page.path, expected: page.expected });
  }

  return { verified };
}

async function requestAdminWebHtml(path, adminWebCookieHeader) {
  const response = await fetch(`${adminWebBaseUrl}${path}`, {
    headers: adminWebCookieHeader ? { cookie: adminWebCookieHeader } : {},
    redirect: 'manual',
  });
  const body = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`GET ${path} failed from Admin Web: ${response.status} ${body.slice(0, 500)}`);
  }
  return body;
}

async function loadAdminWebSmokeCookieHeader() {
  if (env.ADMIN_WEB_SMOKE_COOKIE?.trim()) {
    return env.ADMIN_WEB_SMOKE_COOKIE.trim();
  }

  const email = env.ADMIN_WEB_LOGIN_EMAIL?.trim();
  const password = env.ADMIN_WEB_LOGIN_PASSWORD;
  if (!email || !password) {
    return null;
  }

  const response = await fetch(`${adminWebBaseUrl}/api/admin/session/login`, {
    body: JSON.stringify({ email, password }),
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    method: 'POST',
    redirect: 'manual',
  });
  const body = await response.text().catch(() => '');
  if (!response.ok) {
    throw new Error(`Admin Web smoke login failed with ${response.status}: ${body.slice(0, 160)}`);
  }

  const setCookie = response.headers.get('set-cookie');
  const sessionCookie = setCookie?.split(';')[0]?.trim();
  if (!sessionCookie) {
    throw new Error('Admin Web smoke login did not return a session cookie.');
  }
  return sessionCookie;
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

function referralWalletCreditSourceKey(rewardId) {
  return `referral:wallet-credit:${rewardId}`;
}

function referralRewardJournalSourceKey(rewardId, action) {
  return `accounting-journal:referral-${action}:${rewardId}`;
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
