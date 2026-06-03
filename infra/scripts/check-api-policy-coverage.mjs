import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ?? '.');
const smokePath = resolve(root, 'infra/scripts/api-smoke.mjs');
const source = readFileSync(smokePath, 'utf8');

const requiredCoverage = [
  {
    area: 'operational policy metadata',
    markers: [
      'assertOperationalPolicyMetadata',
      "'matching.provider_response_window_minutes'",
      "'matching.backup_provider_radius_meters'",
      "'wallet.negative_balance_gate'",
      "'cash.settlement_clearance_policy'",
      "'payout.batch_cycle_policy'",
      "'notification.partner_alert_channel'",
    ],
  },
  {
    area: 'service pricing catalog',
    markers: [
      'service.priceStep !== 100000',
      'Admin service matrix is missing the base payout rule',
      'Atomic service duration set was not created correctly',
      'Admin duplicate service duration set is rejected atomically',
      'Admin service price step below HANDS VND unit is rejected',
      'Admin service base price outside configured step is rejected',
      'Admin payout rule outside service price step is rejected',
      'Admin payout above customer price is rejected',
    ],
  },
  {
    area: 'booking payout rule guard',
    markers: [
      'Booking without a service payout rule is rejected',
      'Provider price below admin minimum is rejected',
      'Provider price outside the admin price step is rejected',
      'Provider cannot activate a service price without an exact admin payout rule',
    ],
  },
  {
    area: 'booking address snapshot',
    markers: [
      'Customer booking detail should expose immutable address snapshot',
      'Admin booking detail should expose immutable address snapshot',
      'Customer should be able to browse partners globally with long distance metadata',
      'Booking should open from the confirmed service address without requiring customer GPS',
      'Stale customer GPS should be ignored as optional evidence, not block address-based booking',
      'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
      'Service area gate rejection should create an operations audit log',
      'Selected-location-only booking should create an immutable dispatch snapshot',
    ],
  },
  {
    area: 'on-demand booking only',
    markers: [
      'Customer-supplied scheduledStartAt should not create scheduled booking',
      'ignoredFutureScheduledStartAt',
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
    area: 'matching policy marketplace window',
    markers: [
      "'matching.provider_response_window_minutes'",
      "'matching.backup_provider_radius_meters'",
      'Direct booking should notify eligible marketplace partners',
      'trace.backupProviderRadiusMeters === 10000',
      "acceptedButWaiting.status !== 'OPEN_MATCHING' || acceptedButWaiting.selectedProviderId !== null",
      'Delayed marketplace booking snapshot should hide request from non-preferred partner',
      'Delayed marketplace partner join',
      'First-pick decline should immediately expose delayed marketplace request',
    ],
  },
  {
    area: 'marketplace radius join guard',
    markers: [
      'hybridBackupNotification.data?.backupProviderRadiusMeters !== 10000',
      'Only partners within 1km can join this booking',
      'Provider open bookings must expose only joinable 10km requests with distance metadata',
    ],
  },
  {
    area: 'admin chat retention after completion',
    markers: [
      'Completed booking did not retain admin chat archive',
      'Admin chat archive did not retain completed booking messages',
      "'/admin/chat-archive'",
    ],
  },
  {
    area: 'booking closure metadata',
    markers: [
      'Cancelled booking did not record customer closure metadata',
      'Matched booking customer direct cancel is blocked',
      'Matched booking direct cancel should route to chat evidence and admin review',
      'Admin no-show action did not record closure metadata',
      'Admin expiry action did not record closure metadata',
      'Admin booking monitor did not expose customer cancellation metadata',
    ],
  },
  {
    area: 'partner device and account access controls',
    markers: [
      'Provider device session was not recorded correctly',
      'Blocked provider device was not rejected by device-session',
      'Unblocked provider device still appears blocked',
      'Blocked provider account cannot go online',
      'Blocked provider account was not rejected by device-session',
      'Unblocked provider account still appears blocked',
      'Shared partner device should create a session check without blocking app access',
    ],
  },
  {
    area: 'tax policy and withholding',
    markers: [
      'Tax policy version list did not return an array',
      'Duplicate active default tax rule is rejected',
      'Overlapping amount-band tax rule is rejected',
      'Completed earning did not apply withholding policy',
      'completedCloseout.earning?.taxLogs?.length',
      'Draft payout batch should include withholding logs',
    ],
  },
  {
    area: 'earning closeout persistence',
    markers: [
      'completedCloseout.earning?.platformFeeLogs?.length',
      'completedCloseout.earning?.walletLedgerEntries?.length',
      'Completed earning service payout line does not match the selected service option',
      'Completed earning service payout snapshot does not match the admin pricing rule',
    ],
  },
  {
    area: 'first earning payout setup',
    markers: ['First provider earning should notify payout tax setup requirements'],
  },
  {
    area: 'payout batch release authority',
    markers: [
      'Positive partner earnings must be paid through payout batches',
      'Draft payout batch should not mark earnings paid',
      'Payout paid status requires transfer reference',
      'Payout paid wallet ledger was not recorded',
      'earning.payoutBatchId === payoutBatch.id',
    ],
  },
  {
    area: 'cash booking wallet debt',
    markers: [
      'Cash booking did not create a negative provider wallet',
      'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT',
      'Negative provider wallet holds direct final acceptance',
      'Negative provider wallet blocks customer final selection',
      'Negative provider wallet blocks service start',
      'Negative provider wallet should allow marketplace join intent before final acceptance',
      'Negative provider wallet holds payout batch creation',
    ],
  },
  {
    area: 'negative wallet final acceptance policy',
    markers: [
      'wallet.negative_balance_gate',
      'Negative provider wallet blocks customer final selection',
      'Negative provider wallet blocks customer final partner selection',
      'Negative provider wallet blocks service start',
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
