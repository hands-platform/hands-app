import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const earningsPolicyDistPath = '../../apps/api/dist/earnings/earnings.policy.js';
const matchingPolicyDistPath = '../../apps/api/dist/matching/matching.policy.js';
const providerWalletPolicyDistPath = '../../apps/api/dist/provider-wallet/provider-wallet.policy.js';

runApiBuild();

const {
  calculateProviderWalletDelta,
  calculateServicePayoutFeeFromRules,
} = require(earningsPolicyDistPath);
const {
  BACKUP_OPEN_IMMEDIATE,
  DEFAULT_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES,
  DEFAULT_BACKUP_PROVIDER_RADIUS_METERS,
  DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES,
  MATCHING_BACKUP_OPEN_MODE_KEY,
  MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT_KEY,
  MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY,
  MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY,
  MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY,
  MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER,
  MATCH_SOURCE_FIRST_PICK_ACCEPTED_FIRST,
  PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
  resolveMatchingPolicy,
} = require(matchingPolicyDistPath);
const {
  PROVIDER_WALLET_BLOCK_CODE,
  PROVIDER_WALLET_MARKETPLACE_BLOCK_DISPLAY_MESSAGE,
  PROVIDER_WALLET_SETTLEMENT_METHOD,
  providerWalletBlockedResponse,
} = require(providerWalletPolicyDistPath);

const emptyConfig = {
  get() {
    return undefined;
  },
};

assert.equal(
  calculateProviderWalletDelta({
    paymentMethod: 'MOMO',
    grossAmount: 500000,
    platformFee: 120000,
    withholdingAmount: 25000,
  }),
  355000,
  'non-cash bookings should credit customer price minus HANDS fee and withholding only',
);

assert.equal(
  calculateProviderWalletDelta({
    paymentMethod: 'CASH',
    grossAmount: 500000,
    platformFee: 120000,
    withholdingAmount: 25000,
  }),
  -145000,
  'cash bookings should create wallet debt only for HANDS fee and withholding',
);

const payoutFee = calculateServicePayoutFeeFromRules({
  grossAmount: 1700000,
  currency: 'VND',
  services: [
    { serviceId: 'svc-foot', serviceName: 'Foot Massage', price: 500000, quantity: 1 },
    { serviceId: 'svc-head', serviceName: 'Head Massage', price: 600000, quantity: 2 },
  ],
  payoutRules: [
    {
      id: 'rule-foot-500',
      serviceId: 'svc-foot',
      customerPrice: 500000,
      providerPayoutAmount: 380000,
      vatBps: 1000,
      otherCostAmount: 5000,
    },
    {
      id: 'rule-head-600',
      serviceId: 'svc-head',
      customerPrice: 600000,
      providerPayoutAmount: 450000,
      vatBps: 1000,
      otherCostAmount: 10000,
    },
  ],
});

assert.equal(payoutFee.platformFeeAmount, 420000, 'service payout rules should derive total HANDS fee');
assert.equal(payoutFee.ruleSnapshot.providerPayoutAmount, 1280000, 'provider payout should aggregate per option');
assert.equal(payoutFee.ruleSnapshot.vatAmount, 42000, 'VAT should be calculated from the HANDS fee');
assert.equal(payoutFee.ruleSnapshot.otherCostAmount, 25000, 'other costs should scale by service quantity');
assert.equal(
  payoutFee.ruleSnapshot.netCompanyFeeBeforeWithholding,
  353000,
  'net company fee should be visible after VAT and other costs',
);
assert.equal(payoutFee.ruleSnapshot.lines.length, 2, 'line-level service evidence should be retained');

assert.equal(
  calculateServicePayoutFeeFromRules({
    grossAmount: 500000,
    currency: 'VND',
    services: [{ serviceId: 'svc-foot', price: 500000, quantity: 1 }],
    payoutRules: [],
  }),
  null,
  'booking should fall back to platform policy when a service payout rule is missing',
);

assert.equal(
  calculateServicePayoutFeeFromRules({
    grossAmount: 0,
    currency: 'VND',
    services: [],
    payoutRules: [],
  }),
  null,
  'empty service lists should not create payout evidence',
);

const defaultMatchingPolicy = resolveMatchingPolicy(emptyConfig);
assert.equal(
  defaultMatchingPolicy.providerResponseWindowMinutes,
  DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES,
  'first-pick partner response window should default to 10 minutes',
);
assert.equal(
  defaultMatchingPolicy.backupProviderRadiusMeters,
  DEFAULT_BACKUP_PROVIDER_RADIUS_METERS,
  'marketplace participation radius should default to 10km from booking address',
);
assert.equal(
  defaultMatchingPolicy.backupProviderLocationMaxAgeMinutes,
  DEFAULT_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES,
  'marketplace partner location should default to 30 minutes freshness',
);
assert.equal(
  defaultMatchingPolicy.bookingServiceAreaRequired,
  true,
  'booking address snapshots should require an active Vietnam service area by default',
);
assert.equal(
  defaultMatchingPolicy.preferredAcceptMode,
  PREFERRED_ACCEPT_CUSTOMER_CONFIRM,
  'first-pick valid acceptance should stay prioritized with customer fallback selection',
);
assert.equal(
  defaultMatchingPolicy.backupOpenMode,
  BACKUP_OPEN_IMMEDIATE,
  'marketplace participation should be visible immediately by default during the first-pick window',
);
assert.equal(
  MATCH_SOURCE_FIRST_PICK_ACCEPTED_FIRST,
  'FIRST_PICK_ACCEPTED_FIRST',
  'first-pick match source should remain stable for audit, websocket, and Admin consumers',
);
assert.equal(
  MATCH_SOURCE_CUSTOMER_SELECTED_PARTNER,
  'CUSTOMER_SELECTED_PARTNER',
  'customer-selected match source should remain stable for audit, websocket, and Admin consumers',
);

const overriddenMatchingPolicy = resolveMatchingPolicy(emptyConfig, {
  [MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY]: 12,
  [MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY]: 15000,
  [MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY]: 45,
  [MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT_KEY]: 75,
  [MATCHING_BACKUP_OPEN_MODE_KEY]: BACKUP_OPEN_IMMEDIATE,
});
assert.equal(overriddenMatchingPolicy.providerResponseWindowMinutes, 12);
assert.equal(overriddenMatchingPolicy.backupProviderRadiusMeters, 15000);
assert.equal(overriddenMatchingPolicy.backupProviderLocationMaxAgeMinutes, 45);
assert.equal(overriddenMatchingPolicy.backupProviderInvitationLimit, 75);

const invalidMatchingPolicy = resolveMatchingPolicy(emptyConfig, {
  [MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY]: 60,
  [MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY]: 500,
  [MATCHING_BACKUP_PROVIDER_INVITATION_LIMIT_KEY]: 0,
});
assert.equal(
  invalidMatchingPolicy.providerResponseWindowMinutes,
  DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES,
  'out-of-range first-pick windows should fall back to safe defaults',
);
assert.equal(
  invalidMatchingPolicy.backupProviderRadiusMeters,
  DEFAULT_BACKUP_PROVIDER_RADIUS_METERS,
  'out-of-range marketplace radius should fall back to the 10km default',
);

const walletBlock = providerWalletBlockedResponse({
  providerProfileId: 'provider-profile-abc12345',
  walletBalance: -145000,
  currency: 'VND',
});
assert.equal(walletBlock.code, PROVIDER_WALLET_BLOCK_CODE);
assert.equal(walletBlock.displayMessage, PROVIDER_WALLET_MARKETPLACE_BLOCK_DISPLAY_MESSAGE);
assert.equal(walletBlock.walletBalance, -145000);
assert.equal(walletBlock.walletDebtAmount, 145000);
assert.equal(walletBlock.marketplaceVisibilityBlocked, false);
assert.equal(walletBlock.marketplaceJoinBlocked, false);
assert.equal(walletBlock.directFirstPickBlocked, true);
assert.equal(walletBlock.alreadyMatchedServiceBlocked, true);
assert.equal(walletBlock.payoutReleaseBlocked, true);
assert.equal(walletBlock.walletSettlementMethod, PROVIDER_WALLET_SETTLEMENT_METHOD);
assert.ok(walletBlock.walletSettlementReference.startsWith('HANDS-WALLET-'));
assert.ok(
  walletBlock.walletSettlementSteps.some((step) => step.includes(walletBlock.walletSettlementReference)),
  'wallet block response should include a reusable deposit reference in settlement steps',
);

console.log(
  'API domain smoke passed: wallet, service payout, VAT, matching, marketplace, and fee evidence policies.',
);

function runApiBuild() {
  const build = spawnSync(
    process.env.ComSpec ?? 'cmd.exe',
    ['/d', '/s', '/c', 'npm.cmd run build --workspace @massage-vn/api'],
    {
      cwd: fileURLToPath(new URL('../..', import.meta.url)),
      stdio: 'inherit',
      shell: false,
    },
  );
  if (build.status === 0) {
    return;
  }
  if (build.error) {
    console.error(build.error.message);
  }
  process.exit(build.status ?? 1);
}
