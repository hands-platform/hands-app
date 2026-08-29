import { readdirSync, readFileSync, statSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const root = resolve(process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ?? '.');
const smokePath = resolve(root, 'infra/scripts/api-smoke.mjs');
const source = readFileSync(smokePath, 'utf8');
const apiSourceRoot = resolve(root, 'apps/api/src');
const providerWalletGateHelperPath = resolve(
  root,
  'apps/provider_app/lib/src/features/earnings/presentation/provider_wallet_gate_helpers.dart',
);
const providerWalletGateTestPath = resolve(root, 'apps/provider_app/test/provider_wallet_gate_test.dart');
const providerRequestsScreenPath = resolve(
  root,
  'apps/provider_app/lib/src/features/booking/presentation/provider_requests_screen.dart',
);
const providerOpenBookingCardPath = resolve(
  root,
  'apps/provider_app/lib/src/features/booking/presentation/provider_marketplace_booking_card.dart',
);

const requiredCoverage = [
  {
    area: 'operational policy metadata',
    markers: [
      'assertOperationalPolicyMetadata',
      "'matching.provider_response_window_minutes'",
      "'matching.marketplace_partner_radius_meters'",
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
      'Customer final selection rejects preferred partner before acceptance',
      'First-pick valid acceptance should enter service with the preferred partner',
      'Customer final selection rejects inactive marketplace participant',
      'Partner must participate or accept before customer selection',
      'Hybrid booking did not switch from preferred to marketplace participant',
      'Admin booking monitor did not retain the selected marketplace participant record',
      'Admin booking detail did not expose marketplace participant identity and status',
    ],
  },
  {
    area: 'matching policy marketplace window',
    markers: [
      "'matching.provider_response_window_minutes'",
      "'matching.marketplace_partner_radius_meters'",
      'Direct booking should notify eligible marketplace partners',
      'trace.backupProviderRadiusMeters === 10000',
      "preferredAcceptPolicyMatched.status !== 'IN_SERVICE'",
      'Locked immediate marketplace policy should expose request to non-preferred partner',
      'Locked immediate marketplace request should keep 10km distance metadata',
    ],
  },
  {
    area: 'marketplace radius participation guard',
    markers: [
      'hybridBackupNotification.data?.backupProviderRadiusMeters !== 10000',
      'Only partners within 1km can participate in this booking',
      'Provider open bookings must expose only eligible 10km marketplace requests with distance metadata',
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
    area: 'immediate service lifecycle',
    markers: [
      'First-pick valid acceptance should enter service with the preferred partner',
      'Marketplace customer selection should enter service immediately',
      'Custom-price direct booking did not enter service with the selected partner',
    ],
  },
  {
    area: 'partner response lifecycle gate',
    markers: [
      'Partner response after matching is blocked',
      'Booking is already matched or no longer open for partner response',
      'Partner response after matching returned an unexpected error',
    ],
  },
  {
    area: 'booking closure metadata',
    markers: [
      'Cancelled booking did not expose the customer-safe cancellation result',
      'Cancelled booking did not retain admin closure evidence',
      'Matched booking customer direct cancel is blocked',
      'Matched booking direct cancel should route to chat evidence and admin review',
      'Admin no-show action did not record closure metadata',
      'No-show booking customer direct cancel is blocked',
      'Admin expiry action did not record closure metadata',
      'Expired booking customer direct cancel is blocked',
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
      'Tax policy version list did not return a bounded page',
      'Duplicate active default tax rule is rejected',
      'Overlapping amount-band tax rule is rejected',
      'Completed earning did not preserve withholding evidence',
      'completedCloseout.earning?.taxLogs?.length',
      'Draft payout batch withholding logs do not match earning evidence',
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
      'Payout processing requires transfer reference',
      'Payout batch paid closeout rejects same-admin approval',
      'Payout batch paid closeout rejects non-finance approver',
      'Payout paid wallet ledger was not recorded',
      'earning.payoutBatchId === payoutBatch.id',
    ],
  },
  {
    area: 'cash booking wallet debt',
    markers: [
      'Cash booking did not create a negative provider wallet',
      'PROVIDER_WALLET_NEGATIVE_CASH_FEE_DEBT',
      'Negative wallet blocks preferred Partner final acceptance',
      'Negative provider wallet blocks customer final selection of marketplace participant',
      'Negative wallet partner should still see marketplace request before settlement',
      'Negative wallet should allow marketplace participation before final selection',
      'Negative provider wallet holds payout batch creation',
      'assertNegativeWalletBlockResponse',
      'walletSettlementReference',
      'Bạn vẫn có thể xem và tham gia yêu cầu đặt lịch',
    ],
  },
  {
    area: 'negative wallet marketplace participation policy',
    markers: [
      'wallet.negative_balance_gate',
      'Negative wallet partner should still see marketplace request before settlement',
      'Negative wallet should not block marketplace participation before customer selection',
      'Negative provider wallet blocks customer final selection of marketplace participant',
      'preferred Partner final acceptance',
      'PROVIDER_DEPOSIT_OR_ADMIN_OFFSET',
    ],
  },
  {
    area: 'cash settlement operator flow',
    markers: [
      'Cash settlement queue did not expose the open wallet debt row',
      'Cash settlement summary did not expose open wallet debt totals',
      'Negative cash fee settlement requires a reference',
      'Approved deposit allocation should reuse deposit Wallet evidence without a duplicate debt-settled entry',
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

const authorityChecks = [
  checkNegativeWalletBlockCallSites(),
  checkNegativeWalletBookingFunctionBoundaries(),
  checkProviderMobileWalletGateBoundaries(),
];

const allChecks = [...checks, ...authorityChecks];
const failed = allChecks.filter((check) => check.status === 'FAIL');

console.log(
  JSON.stringify(
    {
      ok: failed.length === 0,
      purpose:
        'Static guard that api-smoke.mjs still covers HANDS critical pricing, tax, wallet debt, and settlement invariants.',
      smokePath,
      checks: allChecks,
    },
    null,
    2,
  ),
);

if (failed.length > 0) {
  process.exitCode = 1;
}

function checkNegativeWalletBlockCallSites() {
  const matches = findFilesContaining(apiSourceRoot, 'throwProviderWalletBlocked').map((file) =>
    relative(root, file).replaceAll('\\', '/'),
  );
  const allowedFiles = [
    'apps/api/src/bookings/bookings.service.ts',
    'apps/api/src/earnings/earnings.service.ts',
    'apps/api/src/provider-wallet/provider-wallet.policy.ts',
  ];
  const unexpectedFiles = matches.filter((file) => !allowedFiles.includes(file));
  const missingFiles = allowedFiles.filter((file) => !matches.includes(file));
  return {
    area: 'negative wallet block call site boundaries',
    status: unexpectedFiles.length === 0 && missingFiles.length === 0 ? 'PASS' : 'FAIL',
    markerCount: allowedFiles.length,
    missingMarkers: [
      ...missingFiles.map((file) => `missing expected call site: ${file}`),
      ...unexpectedFiles.map((file) => `unexpected call site: ${file}`),
    ],
  };
}

function checkNegativeWalletBookingFunctionBoundaries() {
  const bookingSource = readFileSync(resolve(root, 'apps/api/src/bookings/bookings.service.ts'), 'utf8');
  const joinBooking = sliceBetween(bookingSource, 'async joinBooking(', 'async selectProvider(');
  const selectProvider = sliceBetween(bookingSource, 'async selectProvider(', 'async updateParticipant(');
  const assertCustomerCanSelectProvider = sliceBetween(
    bookingSource,
    'private async assertCustomerCanSelectProvider(',
    'async updateParticipant(',
  );
  const updateParticipant = sliceBetween(
    bookingSource,
    'async updateParticipant(',
    'private async notifyBackupProviders(',
  );
  const customerFinalSelection = sliceBetween(
    bookingSource,
    'private async matchCustomerSelectedProvider(',
    'private async matchFirstPickAcceptedProvider(',
  );
  const firstPickFinalAcceptance = sliceBetween(
    bookingSource,
    'private async matchFirstPickAcceptedProvider(',
    'private async assertProviderHasNoOtherActiveBooking(',
  );
  const lifecycleStatus = sliceBetween(
    bookingSource,
    'async updateProviderBookingStatus(',
    'private async requireSelectedProvider(',
  );

  const missingMarkers = [];
  if (joinBooking.includes('assertProviderWalletCanFinalizeBooking')) {
    missingMarkers.push('joinBooking must not apply the final-acceptance wallet gate');
  }
  if (assertCustomerCanSelectProvider.includes('assertProviderWalletCanFinalizeBooking')) {
    missingMarkers.push('selectProvider pre-read must not make a non-atomic wallet decision');
  }
  if (!customerFinalSelection.includes('await this.assertProviderWalletCanFinalizeBooking(transaction')) {
    missingMarkers.push('customer final selection must enforce the wallet gate inside its transaction');
  }
  if (!firstPickFinalAcceptance.includes('await this.assertProviderWalletCanFinalizeBooking(transaction')) {
    missingMarkers.push('preferred Partner final acceptance must enforce the wallet gate inside its transaction');
  }
  if (updateParticipant.includes('ensureProviderWalletCanJoinMarketplace')) {
    missingMarkers.push('marketplace participant join or accept must not use the final-acceptance wallet gate');
  }
  const firstPickAcceptedBranch = updateParticipant.indexOf("responseRoute === 'first-pick-accepted'");
  const firstPickRejectedBranch = updateParticipant.indexOf("responseRoute === 'first-pick-rejected'");
  if (
    !updateParticipant.includes('bookingParticipantResponseRoute(') ||
    !updateParticipant.includes('booking.preferredProviderId') ||
    firstPickAcceptedBranch === -1 ||
    firstPickRejectedBranch === -1
  ) {
    missingMarkers.push('updateParticipant must preserve explicit preferred Partner response branches');
  }
  const serviceStartBranch = lifecycleStatus.indexOf('status === BookingStatus.IN_SERVICE');
  const serviceStartHelperCall = lifecycleStatus.indexOf(
    'return this.startProviderService({ bookingId, providerProfileId: provider.id });',
  );
  const serviceStartWalletGate = lifecycleStatus.indexOf(
    'await this.assertProviderWalletCanFinalizeBooking(tx, input.providerProfileId);',
  );
  if (
    serviceStartBranch === -1 ||
    serviceStartHelperCall === -1 ||
    serviceStartWalletGate === -1 ||
    serviceStartHelperCall < serviceStartBranch
  ) {
    missingMarkers.push('updateProviderBookingStatus must keep the negative-wallet service start gate');
  }

  return {
    area: 'negative wallet marketplace-only booking gate',
    status: missingMarkers.length === 0 ? 'PASS' : 'FAIL',
    markerCount: 4,
    missingMarkers,
  };
}

function checkProviderMobileWalletGateBoundaries() {
  const providerSource = readFileSync(providerWalletGateHelperPath, 'utf8');
  const providerWalletGateTest = readFileSync(providerWalletGateTestPath, 'utf8');
  const providerRequestsScreen = readFileSync(providerRequestsScreenPath, 'utf8');
  const providerOpenBookingCard = readFileSync(providerOpenBookingCardPath, 'utf8');
  const walletBlockDisplayMessage =
    'Phí HANDS chưa được thanh toán nên bạn chưa thể xác nhận nhận lịch này.';
  const missingMarkers = [];
  const joinBooking = sliceBetween(
    providerRequestsScreen,
    'Future<void> joinBooking(',
    'Future<void> respondToBooking(',
  );
  const respondToBooking = sliceBetween(
    providerRequestsScreen,
    'Future<void> respondToBooking(',
    'Future<void> handleBookingActionException(',
  );

  for (const [label, marker] of [
    ['partner app cash-fee block message', walletBlockDisplayMessage],
    [
      'partner app marketplace-only gate expression',
      'return marketplaceJoinBlocked && !isPreferredRequest && !isMatched;',
    ],
    ['partner app reads explicit settled-wallet marketplace flag', "summary['marketplaceJoinBlocked']"],
    ['partner app renders wallet settlement guidance', 'providerWalletBlockHintClean'],
  ]) {
    if (!providerSource.includes(marker)) {
      missingMarkers.push(`missing ${label}: ${marker}`);
    }
  }

  for (const [label, marker] of [
    ['partner app marketplace join endpoint path', '.joinBooking(bookingId)'],
  ]) {
    if (!joinBooking.includes(marker)) {
      missingMarkers.push(`missing ${label}: ${marker}`);
    }
  }

  if (joinBooking.includes('ensureWalletCanJoinMarketplace')) {
    missingMarkers.push('marketplace participation must not run the final-acceptance wallet gate');
  }

  if (respondToBooking.includes('ensureWalletCanJoinMarketplace')) {
    missingMarkers.push('direct first-pick accept/reject must not run marketplace wallet preflight');
  }

  for (const [label, marker] of [
    [
      'preferred request renders accept branch before marketplace wallet lock',
      'if (isPreferredRequest && !isMatched)',
    ],
    ['preferred request accept action is direct response', "label: const Text('Chấp nhận yêu cầu')"],
    ['marketplace participation remains an active click target', 'else if (!joined)'],
    ['marketplace action uses join only outside preferred branch', 'onPressed: loading ? null : onJoin'],
  ]) {
    if (!providerOpenBookingCard.includes(marker)) {
      missingMarkers.push(`missing ${label}: ${marker}`);
    }
  }

  for (const [label, marker] of [
    [
      'partner app wallet gate boundary test',
      'wallet gate blocks marketplace participation before final matching',
    ],
    [
      'direct first-pick remains unblocked',
      'Direct first-pick accept/reject is not marketplace participation.',
    ],
    [
      'explicit marketplace block remains enforceable',
      'Explicit marketplace policy can still block participation before settlement.',
    ],
    [
      'explicit marketplace policy blocks debt participation',
      'explicit marketplace policy blocks participation for wallet debt',
    ],
    [
      'already-matched workflow remains unblocked',
      'Already matched bookings are handled by service workflow.',
    ],
    ['partner app exact cash-fee block copy test', walletBlockDisplayMessage],
  ]) {
    if (!providerWalletGateTest.includes(marker)) {
      missingMarkers.push(`missing ${label}: ${marker}`);
    }
  }

  return {
    area: 'partner app negative wallet marketplace-only gate',
    status: missingMarkers.length === 0 ? 'PASS' : 'FAIL',
    markerCount: 16,
    missingMarkers,
  };
}

function findFilesContaining(dir, marker) {
  const matches = [];
  for (const entry of readdirSync(dir)) {
    const file = resolve(dir, entry);
    const stat = statSync(file);
    if (stat.isDirectory()) {
      matches.push(...findFilesContaining(file, marker));
      continue;
    }
    if (!file.endsWith('.ts')) {
      continue;
    }
    const content = readFileSync(file, 'utf8');
    if (content.includes(marker)) {
      matches.push(file);
    }
  }
  return matches;
}

function sliceBetween(sourceText, startMarker, endMarker) {
  const start = sourceText.indexOf(startMarker);
  if (start === -1) {
    return '';
  }
  const end = sourceText.indexOf(endMarker, start + startMarker.length);
  return sourceText.slice(start, end === -1 ? undefined : end);
}
