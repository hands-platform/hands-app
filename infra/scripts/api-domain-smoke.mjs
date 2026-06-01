import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const policyDistPath = '../../apps/api/dist/earnings/earnings.policy.js';

const build = spawnSync(process.env.ComSpec ?? 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd run build --workspace @massage-vn/api'], {
  cwd: fileURLToPath(new URL('../..', import.meta.url)),
  stdio: 'inherit',
  shell: false,
});
if (build.status !== 0) {
  if (build.error) {
    console.error(build.error.message);
  }
  process.exit(build.status ?? 1);
}

const {
  calculateProviderWalletDelta,
  calculateServicePayoutFeeFromRules,
} = require(policyDistPath);

assert.equal(
  calculateProviderWalletDelta({
    paymentMethod: 'MOMO',
    grossAmount: 500000,
    platformFee: 120000,
    withholdingAmount: 25000,
    tipAmount: 10000,
  }),
  355000,
  'non-cash bookings should credit customer price minus HANDS fee and withholding without tips',
);

assert.equal(
  calculateProviderWalletDelta({
    paymentMethod: 'CASH',
    grossAmount: 500000,
    platformFee: 120000,
    withholdingAmount: 25000,
    tipAmount: 10000,
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

console.log('API domain smoke passed: wallet, service payout, VAT, and fee evidence policies.');
