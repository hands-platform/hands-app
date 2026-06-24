import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');

const sources = {
  adminController: 'apps/api/src/admin/admin.controller.ts',
  adminRewardSpec: 'apps/api/src/admin/admin.service.spec.ts',
  adminService: 'apps/api/src/admin/admin.service.ts',
  referralService: 'apps/api/src/referrals/referrals.service.ts',
  schema: 'apps/api/prisma/schema.prisma',
};

const sourceText = Object.fromEntries(
  Object.entries(sources).map(([key, path]) => [key, readFileSync(resolve(repoRoot, path), 'utf8')]),
);
const automaticReleaseWritesLedger = detectsAutomaticWalletLedgerWrite(sourceText.referralService);
const hasNestAdminWalletCreditEndpoint = detectsNestAdminWalletCreditEndpoint(sourceText);

const checks = [
  {
    id: 'provider-wallet-ledger-model',
    ok: sourceText.schema.includes('model ProviderWalletLedgerEntry'),
    severity: 'info',
    detail: 'ProviderWalletLedgerEntry exists for Partner wallet ledger entries.',
  },
  {
    id: 'customer-wallet-ledger-model',
    ok: hasCustomerWalletLedger(sourceText.schema),
    severity: 'blocker',
    detail: 'CustomerWalletLedger model must exist before customer referral rewards can become wallet credits.',
  },
  {
    id: 'referral-reward-wallet-owner-links',
    ok:
      sourceText.schema.includes('walletOwnerCustomerProfileId') &&
      sourceText.schema.includes('walletOwnerProviderProfileId'),
    severity: 'info',
    detail: 'ReferralReward records already identify the future customer or Partner wallet owner.',
  },
  {
    id: 'referral-reward-ledger-reference',
    ok: sourceText.schema.includes('walletLedgerReference'),
    severity: 'info',
    detail: 'ReferralReward has walletLedgerReference for idempotent future wallet-credit linking.',
  },
  {
    id: 'automatic-release-writes-ledger',
    ok: automaticReleaseWritesLedger,
    severity: 'blocker',
    detail:
      automaticReleaseWritesLedger
        ? 'releaseAvailableRewards writes audited wallet ledger entries for available referral rewards.'
        : 'releaseAvailableRewards currently marks rewards AVAILABLE only; it does not create wallet ledger entries.',
  },
  {
    id: 'admin-guard-documents-candidate-only',
    ok: sourceText.adminRewardSpec.includes('without creating wallet ledger entries'),
    severity: 'info',
    detail: 'Admin reward hold/reverse tests explicitly guard the current candidate-only behavior.',
  },
  {
    id: 'nest-admin-wallet-credit-endpoint',
    ok: hasNestAdminWalletCreditEndpoint,
    severity: 'blocker',
    detail:
      hasNestAdminWalletCreditEndpoint
        ? 'NestJS admin credit endpoint exists for audited referral wallet credit.'
        : 'Future wallet credit must be implemented behind a NestJS admin credit endpoint, not from Admin Web or mobile clients.',
  },
];

const blockingChecks = checks.filter((check) => check.severity === 'blocker' && !check.ok);
const readyForAutomaticWalletCredit = blockingChecks.length === 0;
const decision = readyForAutomaticWalletCredit ? 'ready-for-api-wallet-credit-implementation' : readinessDecision();
const nextSteps = readinessNextSteps();

console.log(
  JSON.stringify(
    {
      ok: true,
      action: 'referral-wallet-credit-readiness',
      readyForAutomaticWalletCredit,
      decision,
      checks,
      nextSteps,
    },
    null,
    2,
  ),
);

function readinessDecision() {
  if (!hasCustomerWalletLedger(sourceText.schema)) {
    return 'blocked-by-missing-customer-wallet-ledger';
  }
  if (blockingChecks.some((check) => check.id === 'automatic-release-writes-ledger')) {
    return 'blocked-by-candidate-only-release';
  }
  if (blockingChecks.some((check) => check.id === 'nest-admin-wallet-credit-endpoint')) {
    return 'blocked-by-missing-admin-credit-endpoint';
  }
  return 'blocked-by-wallet-credit-readiness-gap';
}

function readinessNextSteps() {
  if (readyForAutomaticWalletCredit) {
    return [
      'Implement the audited NestJS admin credit endpoint with idempotent walletLedgerReference linking.',
      'Add wallet credit and reversal smoke coverage before enabling payout.',
    ];
  }

  const steps = [];

  if (!hasCustomerWalletLedger(sourceText.schema)) {
    steps.push('Add an audited CustomerWalletLedger model before customer referral wallet credit.');
  }
  if (blockingChecks.some((check) => check.id === 'automatic-release-writes-ledger')) {
    steps.push('Keep release, hold, and reverse actions candidate-only until wallet ledger smoke passes.');
  }
  if (blockingChecks.some((check) => check.id === 'nest-admin-wallet-credit-endpoint')) {
    steps.push('Add a NestJS admin credit endpoint and smoke before enabling referral payout.');
  }
  steps.push('Design Partner wallet credit and reversal source keys before Partner referral wallet credit.');

  return steps;
}

function hasCustomerWalletLedger(schemaSource) {
  return /\bmodel\s+CustomerWalletLedger(?:Entry)?\b/.test(schemaSource);
}

function detectsAutomaticWalletLedgerWrite(serviceSource) {
  const hasReleasePath = serviceSource.includes('releaseAvailableRewards');
  const writesReferralLedgerReference = serviceSource.includes('walletLedgerReference');
  const writesPartnerLedger =
    serviceSource.includes('providerWalletLedgerEntry.create') ||
    serviceSource.includes('providerWalletLedgerEntry.upsert') ||
    serviceSource.includes('ProviderWalletLedgerEntry');
  const writesCustomerLedger =
    serviceSource.includes('customerWalletLedgerEntry.create') ||
    serviceSource.includes('customerWalletLedger.create') ||
    serviceSource.includes('CustomerWalletLedger');

  return hasReleasePath && writesReferralLedgerReference && writesPartnerLedger && writesCustomerLedger;
}

function detectsNestAdminWalletCreditEndpoint(textBySource) {
  const controllerHasCreditRoute =
    textBySource.adminController.includes("referrals/rewards/:id/credit") &&
    textBySource.adminController.includes('creditReferralReward');
  const serviceHasCreditMethod =
    textBySource.adminService.includes('creditReferralReward') &&
    textBySource.adminService.includes('walletLedgerReference');

  return controllerHasCreditRoute && serviceHasCreditMethod;
}
