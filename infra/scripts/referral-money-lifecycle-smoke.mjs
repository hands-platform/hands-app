import { randomUUID } from 'node:crypto';

import {
  AdminUserProvenance,
  AccountingJournalSourceType,
  PrismaClient,
  ReferralAudience,
  ReferralAttributionStatus,
  ReferralRewardStatus,
  Role,
} from '@prisma/client';
import jwt from 'jsonwebtoken';

import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
if (env.DATABASE_URL && !process.env.DATABASE_URL) {
  process.env.DATABASE_URL = env.DATABASE_URL;
}

const apiBaseUrl = (env.API_BASE_URL ?? 'http://localhost:3000/api').replace(/\/$/, '');
const runId = `referral_money_smoke_${randomUUID()}`;
const ids = {
  actor: `${runId}_actor`,
  approver: `${runId}_approver`,
  customerUser: `${runId}_customer_user`,
  customerProfile: `${runId}_customer_profile`,
  providerUser: `${runId}_provider_user`,
  providerProfile: `${runId}_provider_profile`,
  customerCode: `${runId}_customer_code`,
  customerAttribution: `${runId}_customer_attribution`,
  partnerCode: `${runId}_partner_code`,
  partnerAttribution: `${runId}_partner_attribution`,
  customerReward: `${runId}_customer_reward`,
  customerCashoutReward: `${runId}_customer_cashout_reward`,
  partnerReversalReward: `${runId}_partner_reversal_reward`,
  partnerCashoutReward: `${runId}_partner_cashout_reward`,
  uncreditedReward: `${runId}_uncredited_reward`,
};
const rewardIds = [
  ids.customerReward,
  ids.customerCashoutReward,
  ids.partnerReversalReward,
  ids.partnerCashoutReward,
  ids.uncreditedReward,
];
const prisma = new PrismaClient({ datasources: { db: { url: requiredEnv('DATABASE_URL') } } });

assertLocalFixtureMode();

try {
  await request('/health');
  await cleanup();
  await seed();

  const actorToken = adminToken(ids.actor, [Role.ADMIN, Role.MASTER_ADMIN]);
  const approverToken = adminToken(ids.approver, [Role.ADMIN, Role.FINANCE_APPROVER]);
  const customerToken = accessToken(ids.customerUser, Role.CUSTOMER);
  const providerToken = accessToken(ids.providerUser, Role.PROVIDER);

  await creditReward(actorToken, ids.customerReward, 25_000);
  const customerNotificationCountAfterCredit = await customerNotificationCount();
  await expectFailure(`/admin/referrals/rewards/${ids.customerReward}/credit`, {
    body: { reason: 'Duplicate customer reward credit replay.' },
    expectedStatus: 400,
    method: 'POST',
    token: actorToken,
  });
  assertCondition(
    (await customerNotificationCount()) === customerNotificationCountAfterCredit,
    'Duplicate customer reward credit emitted another notification.',
  );
  await reverseReward(actorToken, ids.customerReward);

  await creditReward(actorToken, ids.customerCashoutReward, 28_000);
  const requestedCustomerCashout = await request(
    `/customer/referrals/rewards/${ids.customerCashoutReward}/cashout`,
    {
      method: 'POST',
      token: customerToken,
    },
  );
  assertCondition(
    requestedCustomerCashout.status === ReferralRewardStatus.CASHOUT_REQUESTED,
    'Customer referral cashout request did not enter the requested state.',
  );
  const replayedCustomerCashout = await request(
    `/customer/referrals/rewards/${ids.customerCashoutReward}/cashout`,
    {
      method: 'POST',
      token: customerToken,
    },
  );
  assertCondition(
    replayedCustomerCashout.status === ReferralRewardStatus.CASHOUT_REQUESTED,
    'Customer referral cashout request replay was not idempotent.',
  );
  const approvedCustomerCashout = await request(
    `/admin/referrals/rewards/${ids.customerCashoutReward}/cashout-approve`,
    {
      body: { reason: 'Local smoke customer referral cashout approval.' },
      method: 'POST',
      token: actorToken,
    },
  );
  assertCondition(
    approvedCustomerCashout.status === ReferralRewardStatus.CASHOUT_APPROVED,
    'Customer referral cashout was not moved into the approved state.',
  );
  await expectFailure(`/admin/referrals/rewards/${ids.customerCashoutReward}/cashout-paid`, {
    body: {
      approvalAdminId: ids.actor,
      reason: 'Same actor must not close a customer referral cashout.',
      transferRef: `${runId}-customer-same-actor`,
    },
    expectedStatus: 400,
    method: 'POST',
    token: actorToken,
  });
  const paidCustomerCashout = await request(
    `/admin/referrals/rewards/${ids.customerCashoutReward}/cashout-paid`,
    {
      body: {
        approvalAdminId: ids.approver,
        reason: 'Local smoke customer referral cashout transfer.',
        transferRef: `${runId}-customer-bank-transfer`,
      },
      method: 'POST',
      token: actorToken,
    },
  );
  assertCondition(
    paidCustomerCashout.status === ReferralRewardStatus.PAID,
    'Customer referral cashout was not marked paid.',
  );
  await expectFailure(`/admin/referrals/rewards/${ids.customerCashoutReward}/cashout-paid`, {
    body: {
      approvalAdminId: ids.approver,
      reason: 'Duplicate customer paid closeout replay.',
      transferRef: `${runId}-customer-bank-transfer`,
    },
    expectedStatus: 400,
    method: 'POST',
    token: actorToken,
  });

  await creditReward(actorToken, ids.partnerReversalReward, 90_000);
  await reverseReward(actorToken, ids.partnerReversalReward);

  await creditReward(actorToken, ids.partnerCashoutReward, 93_000);
  const requestedCashout = await request(
    `/partner/referrals/rewards/${ids.partnerCashoutReward}/cashout`,
    {
      method: 'POST',
      token: providerToken,
    },
  );
  assertCondition(
    requestedCashout.status === ReferralRewardStatus.CASHOUT_REQUESTED,
    'Partner referral cashout request did not enter the requested state.',
  );
  const replayedCashoutRequest = await request(
    `/provider/referrals/rewards/${ids.partnerCashoutReward}/cashout`,
    {
      method: 'POST',
      token: providerToken,
    },
  );
  assertCondition(
    replayedCashoutRequest.status === ReferralRewardStatus.CASHOUT_REQUESTED,
    'Partner referral cashout request replay was not idempotent.',
  );
  const approvedCashout = await request(`/admin/referrals/rewards/${ids.partnerCashoutReward}/cashout-approve`, {
    body: { reason: 'Local smoke referral cashout approval.' },
    method: 'POST',
    token: actorToken,
  });
  assertCondition(
    approvedCashout.status === ReferralRewardStatus.CASHOUT_APPROVED,
    'Referral cashout was not moved into the approved state.',
  );
  await expectFailure(`/admin/referrals/rewards/${ids.partnerCashoutReward}/cashout-paid`, {
    body: {
      approvalAdminId: ids.actor,
      reason: 'Same actor must not close a referral cashout.',
      transferRef: `${runId}-same-actor`,
    },
    expectedStatus: 400,
    method: 'POST',
    token: actorToken,
  });
  const paidCashout = await request(`/admin/referrals/rewards/${ids.partnerCashoutReward}/cashout-paid`, {
    body: {
      approvalAdminId: ids.approver,
      reason: 'Local smoke referral cashout bank transfer.',
      transferRef: `${runId}-bank-transfer`,
    },
    method: 'POST',
    token: actorToken,
  });
  assertCondition(paidCashout.status === ReferralRewardStatus.PAID, 'Referral cashout was not marked paid.');
  await expectFailure(`/admin/referrals/rewards/${ids.partnerCashoutReward}/cashout-paid`, {
    body: {
      approvalAdminId: ids.approver,
      reason: 'Duplicate paid closeout replay.',
      transferRef: `${runId}-bank-transfer`,
    },
    expectedStatus: 400,
    method: 'POST',
    token: actorToken,
  });

  const uncreditedReversal = await request(`/admin/referrals/rewards/${ids.uncreditedReward}/reverse`, {
    body: { reason: 'Local smoke uncredited reward reversal.' },
    method: 'POST',
    token: actorToken,
  });
  assertCondition(
    uncreditedReversal.status === ReferralRewardStatus.REVERSED && !uncreditedReversal.walletLedgerReference,
    'Uncredited referral reversal should not create a wallet ledger.',
  );

  const verification = await verifyLifecycle();
  console.log(
    JSON.stringify(
      {
        ok: true,
        checks: {
          cashoutBankClearingPosted: verification.cashoutBankClearing === 93_000,
          cashoutPaidDualApproval: true,
          customerCashoutBankClearingPosted: verification.customerCashoutBankClearing === 28_000,
          customerCashoutPaidDualApproval: true,
          customerCashoutRequestApi: true,
          customerCashoutRequestReplayIdempotent: true,
          customerCreditNotificationOnce: customerNotificationCountAfterCredit === 1,
          cashoutRequestApi: true,
          cashoutRequestReplayIdempotent: true,
          customerCreditReversalBalanced: verification.customerBalance === 0,
          duplicateCreditBlocked: true,
          duplicatePaidCloseoutBlocked: true,
          journalsBalanced: verification.journalsBalanced,
          partnerBusinessWithholdingPayable: verification.businessWithholdingPayable === 7_000,
          partnerCreditReversalClearedWithholding: verification.reversalWithholdingNet === 0,
          partnerWalletReturnedToZero: verification.partnerBalance === 0,
          sameActorPaidCloseoutBlocked: true,
          uncreditedReversalHasNoLedger: verification.uncreditedLedgerCount === 0,
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await cleanup().catch((error) => {
    console.error(`Referral money smoke cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
  await prisma.$disconnect();
}

async function seed() {
  await prisma.user.createMany({
    data: [
      {
        id: ids.actor,
        phone: smokePhone('01'),
        fullName: 'Referral Smoke Master',
        roles: [Role.ADMIN, Role.MASTER_ADMIN],
        adminUserProvenance: AdminUserProvenance.FIXTURE,
        fixtureKind: 'REFERRAL_MONEY_SMOKE',
        fixtureRunId: runId,
      },
      {
        id: ids.approver,
        phone: smokePhone('02'),
        fullName: 'Referral Smoke Approver',
        roles: [Role.ADMIN, Role.FINANCE_APPROVER],
        adminUserProvenance: AdminUserProvenance.FIXTURE,
        fixtureKind: 'REFERRAL_MONEY_SMOKE',
        fixtureRunId: runId,
      },
      { id: ids.customerUser, phone: smokePhone('03'), fullName: 'Referral Smoke Customer', roles: [Role.CUSTOMER] },
      { id: ids.providerUser, phone: smokePhone('04'), fullName: 'Referral Smoke Partner', roles: [Role.PROVIDER] },
    ],
  });
  await prisma.customerProfile.create({ data: { id: ids.customerProfile, userId: ids.customerUser } });
  await prisma.providerProfile.create({
    data: { id: ids.providerProfile, userId: ids.providerUser, displayName: 'Referral Smoke Partner' },
  });
  await prisma.referralCode.createMany({
    data: [
      {
        id: ids.customerCode,
        audience: ReferralAudience.CUSTOMER,
        code: `CR${runId.replaceAll('-', '').slice(-18)}`,
        ownerCustomerProfileId: ids.customerProfile,
      },
      {
        id: ids.partnerCode,
        audience: ReferralAudience.PARTNER,
        code: `PR${runId.replaceAll('-', '').slice(-18)}`,
        ownerProviderProfileId: ids.providerProfile,
      },
    ],
  });
  await prisma.referralAttribution.createMany({
    data: [
      {
        id: ids.customerAttribution,
        audience: ReferralAudience.CUSTOMER,
        referralCodeId: ids.customerCode,
        referrerCustomerProfileId: ids.customerProfile,
        status: ReferralAttributionStatus.QUALIFIED,
      },
      {
        id: ids.partnerAttribution,
        audience: ReferralAudience.PARTNER,
        referralCodeId: ids.partnerCode,
        referrerProviderProfileId: ids.providerProfile,
        status: ReferralAttributionStatus.QUALIFIED,
      },
    ],
  });
  await prisma.referralReward.createMany({
    data: [
      rewardFixture({
        amount: 25_000,
        attributionId: ids.customerAttribution,
        id: ids.customerReward,
        taxPolicySnapshot: 'CUSTOMER_SERVICE_CREDIT_ONLY',
        walletOwnerCustomerProfileId: ids.customerProfile,
      }),
      rewardFixture({
        amount: 28_000,
        attributionId: ids.customerAttribution,
        id: ids.customerCashoutReward,
        taxPolicySnapshot: 'CUSTOMER_SERVICE_CREDIT_ONLY',
        walletOwnerCustomerProfileId: ids.customerProfile,
      }),
      rewardFixture({
        amount: 100_000,
        attributionId: ids.partnerAttribution,
        id: ids.partnerReversalReward,
        taxPolicySnapshot: 'INDIVIDUAL_COMMISSION_PIT_10',
        walletOwnerProviderProfileId: ids.providerProfile,
      }),
      rewardFixture({
        amount: 100_000,
        attributionId: ids.partnerAttribution,
        id: ids.partnerCashoutReward,
        taxPolicySnapshot: 'BUSINESS_SERVICE_VAT5_PIT2',
        walletOwnerProviderProfileId: ids.providerProfile,
      }),
      rewardFixture({
        amount: 15_000,
        attributionId: ids.customerAttribution,
        id: ids.uncreditedReward,
        taxPolicySnapshot: 'CUSTOMER_SERVICE_CREDIT_ONLY',
        walletOwnerCustomerProfileId: ids.customerProfile,
      }),
    ],
  });
}

function rewardFixture(input) {
  return {
    amount: input.amount,
    attributionId: input.attributionId,
    availableAt: new Date(Date.now() - 60_000),
    calculationSnapshot: { localSmoke: true, runId, taxPolicySnapshot: input.taxPolicySnapshot },
    currency: 'VND',
    id: input.id,
    sourceKey: `${runId}:${input.id}`,
    status: ReferralRewardStatus.AVAILABLE,
    walletOwnerCustomerProfileId: input.walletOwnerCustomerProfileId ?? null,
    walletOwnerProviderProfileId: input.walletOwnerProviderProfileId ?? null,
  };
}

async function creditReward(token, rewardId, expectedWalletAmount) {
  const reward = await request(`/admin/referrals/rewards/${rewardId}/credit`, {
    body: { reason: 'Local smoke referral wallet credit.' },
    method: 'POST',
    token,
  });
  assertCondition(
    reward.status === ReferralRewardStatus.CREDITED && Boolean(reward.walletLedgerReference),
    `Referral reward ${rewardId} was not credited.`,
  );
  const ledger = await walletLedgerForReward(rewardId, 'credit');
  assertCondition(ledger?.amount === expectedWalletAmount, `Referral reward ${rewardId} net wallet amount mismatch.`);
}

async function reverseReward(token, rewardId) {
  const reward = await request(`/admin/referrals/rewards/${rewardId}/reverse`, {
    body: { reason: 'Local smoke credited referral reversal.' },
    method: 'POST',
    token,
  });
  assertCondition(
    reward.status === ReferralRewardStatus.REVERSED && Boolean(reward.walletLedgerReference),
    `Referral reward ${rewardId} was not reversed through its wallet.`,
  );
}

async function walletLedgerForReward(rewardId, action) {
  const sourceKey = `referral:wallet-${action}:${rewardId}`;
  return prisma.customerWalletLedgerEntry.findUnique({ where: { sourceKey } }).then(async (customerLedger) =>
    customerLedger ?? prisma.providerWalletLedgerEntry.findUnique({ where: { sourceKey } }),
  );
}

async function verifyLifecycle() {
  const [customerAggregate, partnerAggregate, journals, customerLedgers, providerLedgers] = await Promise.all([
    prisma.customerWalletLedgerEntry.aggregate({
      where: { customerProfileId: ids.customerProfile },
      _sum: { amount: true },
    }),
    prisma.providerWalletLedgerEntry.aggregate({
      where: { providerProfileId: ids.providerProfile },
      _sum: { amount: true },
    }),
    prisma.accountingJournalBatch.findMany({
      where: { sourceType: AccountingJournalSourceType.REFERRAL_REWARD, sourceId: { in: rewardIds } },
      include: { entries: true },
    }),
    prisma.customerWalletLedgerEntry.findMany({ where: { customerProfileId: ids.customerProfile } }),
    prisma.providerWalletLedgerEntry.findMany({ where: { providerProfileId: ids.providerProfile } }),
  ]);
  assertCondition(journals.length === 8, `Expected 8 referral journals, received ${journals.length}.`);
  const journalsBalanced = journals.every((journal) => {
    const debit = journal.entries.filter((entry) => entry.side === 'DEBIT').reduce((sum, entry) => sum + entry.amount, 0);
    const credit = journal.entries.filter((entry) => entry.side === 'CREDIT').reduce((sum, entry) => sum + entry.amount, 0);
    return debit > 0 && debit === credit && journal.totalDebit === debit && journal.totalCredit === credit;
  });
  assertCondition(journalsBalanced, 'A referral accounting journal is not balanced.');

  const entriesFor = (rewardId) => journals.filter((journal) => journal.sourceId === rewardId).flatMap((journal) => journal.entries);
  const accountNet = (entries, accountCode) =>
    entries
      .filter((entry) => entry.accountCode === accountCode)
      .reduce((total, entry) => total + (entry.side === 'CREDIT' ? entry.amount : -entry.amount), 0);
  const reversalEntries = entriesFor(ids.partnerReversalReward);
  const cashoutEntries = entriesFor(ids.partnerCashoutReward);
  const customerCashoutEntries = entriesFor(ids.customerCashoutReward);
  const uncreditedLedgerCount = [...customerLedgers, ...providerLedgers].filter(
    (ledger) => ledger.sourceKey?.includes(ids.uncreditedReward),
  ).length;
  const result = {
    businessWithholdingPayable:
      accountNet(cashoutEntries, 'referral_vat_withholding_payable') +
      accountNet(cashoutEntries, 'referral_pit_withholding_payable'),
    cashoutBankClearing: accountNet(cashoutEntries, 'referral_cashout_bank_clearing'),
    customerCashoutBankClearing: accountNet(
      customerCashoutEntries,
      'referral_cashout_bank_clearing',
    ),
    customerBalance: customerAggregate._sum.amount ?? 0,
    journalsBalanced,
    partnerBalance: partnerAggregate._sum.amount ?? 0,
    reversalWithholdingNet:
      accountNet(reversalEntries, 'referral_vat_withholding_payable') +
      accountNet(reversalEntries, 'referral_pit_withholding_payable'),
    uncreditedLedgerCount,
  };
  assertCondition(result.customerBalance === 0, 'Customer referral wallet did not return to zero after reversal.');
  assertCondition(result.partnerBalance === 0, 'Partner referral wallet did not return to zero after reversal and cashout.');
  assertCondition(result.businessWithholdingPayable === 7_000, 'Partner business VAT/PIT withholding payable mismatch.');
  assertCondition(result.reversalWithholdingNet === 0, 'Partner referral reversal did not clear prior withholding payable.');
  assertCondition(result.cashoutBankClearing === 93_000, 'Referral cashout bank clearing amount mismatch.');
  assertCondition(
    result.customerCashoutBankClearing === 28_000,
    'Customer referral cashout bank clearing amount mismatch.',
  );
  assertCondition(result.uncreditedLedgerCount === 0, 'Uncredited referral reversal created a wallet ledger.');
  return result;
}

function customerNotificationCount() {
  return prisma.notification.count({ where: { userId: ids.customerUser } });
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options.method ?? 'GET'} ${path.split('?')[0]} failed with ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function expectFailure(path, options) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json().catch(() => ({}));
  assertCondition(
    response.status === options.expectedStatus,
    `Expected ${options.expectedStatus} from ${path}, received ${response.status}: ${JSON.stringify(body)}`,
  );
  return body;
}

async function cleanup() {
  await prisma.notification.deleteMany({ where: { userId: { in: [ids.customerUser, ids.providerUser] } } });
  await prisma.adminAuditLog.deleteMany({ where: { actorId: { in: [ids.actor, ids.approver] } } });
  await prisma.accountingJournalBatch.deleteMany({
    where: { sourceType: AccountingJournalSourceType.REFERRAL_REWARD, sourceId: { in: rewardIds } },
  });
  await prisma.customerWalletLedgerEntry.deleteMany({ where: { customerProfileId: ids.customerProfile } });
  await prisma.providerWalletLedgerEntry.deleteMany({ where: { providerProfileId: ids.providerProfile } });
  await prisma.referralReward.deleteMany({ where: { id: { in: rewardIds } } });
  await prisma.referralAttribution.deleteMany({
    where: { id: { in: [ids.customerAttribution, ids.partnerAttribution] } },
  });
  await prisma.referralCode.deleteMany({ where: { id: { in: [ids.customerCode, ids.partnerCode] } } });
  await prisma.customerProfile.deleteMany({ where: { id: ids.customerProfile } });
  await prisma.providerProfile.deleteMany({ where: { id: ids.providerProfile } });
  await prisma.user.deleteMany({ where: { id: { in: [ids.actor, ids.approver, ids.customerUser, ids.providerUser] } } });
}

function adminToken(userId, roles) {
  return jwt.sign({ sub: userId, activeRole: Role.ADMIN, roles }, jwtAccessSecret(), { expiresIn: '10m' });
}

function accessToken(userId, activeRole) {
  return jwt.sign({ sub: userId, activeRole, roles: [activeRole] }, jwtAccessSecret(), {
    expiresIn: '10m',
  });
}

function jwtAccessSecret() {
  return env.JWT_ACCESS_SECRET?.trim() || 'dev-access-secret';
}

function assertLocalFixtureMode() {
  assertCondition(
    env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'production',
    'Referral money lifecycle smoke cannot run in production.',
  );
  const databaseUrl = new URL(requiredEnv('DATABASE_URL'));
  const apiUrl = new URL(apiBaseUrl);
  const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
  assertCondition(localHosts.has(databaseUrl.hostname) && localHosts.has(apiUrl.hostname), 'Referral smoke refuses remote targets.');
}

function smokePhone(suffix) {
  return `+84967${String(Date.now()).slice(-5)}${suffix}`;
}

function requiredEnv(key) {
  const value = env[key]?.trim();
  assertCondition(Boolean(value), `${key} is required for referral money lifecycle smoke.`);
  return value;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}
