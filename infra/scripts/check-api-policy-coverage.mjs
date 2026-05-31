import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ?? '.');
const smokePath = resolve(root, 'infra/scripts/api-smoke.mjs');
const source = readFileSync(smokePath, 'utf8');

const requiredCoverage = [
  {
    area: 'service pricing catalog',
    markers: [
      'service.priceStep !== 100000',
      'Admin service matrix is missing the base payout rule',
      'Atomic service duration set was not created correctly',
      'Admin duplicate service duration set is rejected atomically',
      'Admin payout rule outside service price step is rejected',
    ],
  },
  {
    area: 'booking payout rule guard',
    markers: [
      'Booking without a service payout rule is rejected',
      'Provider cannot activate a service price without an exact admin payout rule',
    ],
  },
  {
    area: 'booking address snapshot',
    markers: [
      'Customer booking detail should expose immutable address snapshot',
      'Admin booking detail should expose immutable address snapshot',
    ],
  },
  {
    area: 'customer final partner selection',
    markers: [
      '/customer/bookings/${preferredAcceptPolicyBooking.id}/select-provider',
      'Customer final confirmation did not match preferred accepted partner',
    ],
  },
  {
    area: 'tax policy and withholding',
    markers: [
      'Tax policy version list did not return an array',
      'Duplicate active default tax rule is rejected',
      'Overlapping amount-band tax rule is rejected',
      'Completed earning did not apply withholding policy',
      'Draft payout batch should include withholding logs',
    ],
  },
  {
    area: 'first earning payout setup',
    markers: ['First provider earning should notify payout tax setup requirements'],
  },
  {
    area: 'cash booking wallet debt',
    markers: [
      'Cash booking did not create a negative provider wallet',
      'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT',
      'Negative provider wallet blocks direct booking acceptance',
      'Negative provider wallet blocks customer final selection',
      'Negative provider wallet blocks open matching join',
      'Negative provider wallet blocks payout batch creation',
    ],
  },
  {
    area: 'negative wallet recovery policy',
    markers: [
      'wallet.negative_balance_gate',
      'ALLOW_ONE_RECOVERY_BOOKING',
      'Negative wallet recovery policy allows only one active booking',
    ],
  },
  {
    area: 'cash settlement operator flow',
    markers: [
      'Cash settlement queue did not expose the open wallet debt row',
      'Cash settlement summary did not expose open wallet debt totals',
      'Negative cash fee settlement requires a reference',
      'Cash fee settlement ledger was not recorded',
      'Cash fee settlement did not unblock provider wallet',
    ],
  },
  {
    area: 'admin traceability',
    markers: [
      "const adminBookingsAfterCashDebt = await getJson('/admin/bookings'",
      'Cash debt payment trace was not visible to admin',
      'Cash debt booking trace was not visible to booking monitor',
    ],
  },
];

const checks = requiredCoverage.map((check) => {
  const missingMarkers = check.markers.filter((marker) => !source.includes(marker));
  return {
    area: check.area,
    status: missingMarkers.length === 0 ? 'PASS' : 'FAIL',
    markerCount: check.markers.length,
    missingMarkers,
  };
});

const failed = checks.filter((check) => check.status === 'FAIL');

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      purpose:
        'Static guard that api-smoke.mjs still covers HANDS critical pricing, tax, wallet debt, and settlement invariants.',
      smokePath,
      checks,
    },
    null,
    2,
  ),
);

if (failed.length > 0) {
  process.exitCode = 1;
}
