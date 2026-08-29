import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ?? '.');
const violations = [];

checkRequiredAuthorityDoc();
checkNoContradictoryOperationsDocs();
checkNoContradictoryNegativeWalletWording();
checkOnDemandBookingContract();
checkAddressBasedBookingContract();
checkCustomerFinalSelectionContract();
checkNoAutomaticCloseoutPolicies();
checkNoTipContract();
checkPayoutBatchContract();
checkSupabaseDraftContract();
checkSupabaseBoundary();
checkLegacyRiskRoutesAreRedirectOnly();
checkMobileVisibleCopyGuardIsStrict();
checkAdminVisibleCopyGuardIsStrict();
checkAdminPeopleManagementIsFactual();
checkAdminDashboardOperationsCoverage();
checkBookingDetailIsSourceOfTruth();
checkOperationsPolicyControlPlane();
checkMarketplaceCompatibilityCopy();

console.log(
  JSON.stringify(
    {
      ok: violations.length === 0,
      purpose:
        'Static HANDS MVP final authority guard: NestJS business authority, on-demand booking, first-pick Partner priority, customer fallback selection, no tip flow, payout batch authority, and Partner visible copy.',
      violations,
    },
    null,
    2,
  ),
);

if (violations.length > 0) {
  process.exitCode = 1;
}

function checkRequiredAuthorityDoc() {
  const source = read('docs/architecture/hands-mvp-final-authority.md');
  const docsReadme = read('docs/README.md');
  requireMarkers('docs/architecture/hands-mvp-final-authority.md', source, [
    'Supabase is infrastructure. NestJS owns business rules',
    'Every booking must preserve an immutable `BookingAddressSnapshot`',
    'Customers may browse partners from any country',
    'Preferred partner gets first-pick priority, currently within the 10 minute response window',
    'default 10km, can participate during the matching window',
    'Customer final selection is required unless the first-pick Partner validly accepts first under API rules',
    'There is no automatic nearest-partner assignment',
    'Do not expose scheduled booking or calendar booking UX',
    'Tips are not part of the MVP',
    'customers do not directly cancel through a normal cancel button',
    'Negative partner wallet balances keep marketplace visibility and participation open as a warning state',
    'Partner payouts are weekly, monthly, or admin-selected batch cycles',
    'Admin is an Operations Command Center',
    'visible product copy should use `Partner`',
  ]);
  requireMarkers('docs/README.md', docsReadme, [
    '1. `HANDS_MVP_FINAL_AUTHORITY_RESET_PROMPT.md`',
    '2. `docs/architecture/hands-mvp-final-authority.md`',
    '3. `HANDS_CODEX_MASTER_REFACTOR_PROMPT.md`',
    '4. `docs/architecture/master-progress-roadmap.md`',
    '5. Current source code and smoke tests',
    '6. `README.md`',
    '7. Historical APK/research notes',
  ]);
}

function checkNoContradictoryOperationsDocs() {
  const partnerAcceptance = read('docs/architecture/partner-acceptance-operations.md');
  rejectMarker(
    'docs/architecture/partner-acceptance-operations.md',
    partnerAcceptance,
    'The partner can still see and join marketplace opportunities',
  );
  requireMarkers('docs/architecture/partner-acceptance-operations.md', partnerAcceptance, [
    'The partner can still see marketplace opportunities',
    'Marketplace requests can remain visible, but marketplace participation is blocked until settlement.',
    'Marketplace participation and customer final selection of that marketplace partner stay blocked until settlement.',
  ]);

  const reviews = read('docs/architecture/reviews.md');
  requireMarkers('docs/architecture/reviews.md', reviews, [
    'should not use customer or partner feedback as a people-ranking, risk-scoring, or automatic dispatch system',
    'must not drive automatic closeout decisions, badges, rankings, or dispatch priority',
  ]);
}

function checkNoContradictoryNegativeWalletWording() {
  const forbiddenPhrases = [
    'allow visibility and join intent',
    'visibility and join intent remain available',
    'Marketplace visibility and join intent',
    'marketplace visibility and join intent',
    'join intent stay available',
    'join intent open',
    'can still appear and join marketplace opportunities',
    'can still see and join marketplace opportunities',
    'can stay visible and show marketplace intent',
    'can see and join intent',
    'can browse and join',
    'can browse/join',
    'can still browse/join',
    'marketplace demand',
    'Unpaid HANDS fees must be settled before you can join this booking.',
    'final acceptance only',
    'blocks only configured final',
    'blocked only at configured final',
    'not a marketplace visibility blocker',
    'not a marketplace visibility gate',
    'Monitor open matching, quiet chat rooms, and partner assignment.',
    'Partner must stay hidden from assignment until account-control review is resolved.',
  ];

  for (const file of [
    ...listFiles('apps/admin_web/app', '.tsx'),
    ...listFiles('apps/api/src', '.ts'),
    ...listFiles('apps/customer_app/lib', '.dart'),
    ...listFiles('apps/provider_app/lib', '.dart'),
    'infra/scripts/api-smoke.mjs',
    'infra/scripts/admin-web-smoke.mjs',
    'infra/scripts/check-api-policy-coverage.mjs',
    ...listFiles('docs/architecture', '.md'),
  ]) {
    const source = read(file);
    for (const phrase of forbiddenPhrases) {
      rejectMarker(file, source, phrase);
    }
  }
}

function checkOnDemandBookingContract() {
  const controller = read('apps/api/src/bookings/bookings.controller.ts');
  const service = read('apps/api/src/bookings/bookings.service.ts');
  const smoke = read('infra/scripts/api-smoke.mjs');
  const realtimeSmoke = read('infra/scripts/realtime-smoke.mjs');
  const customerAppFiles = listFiles('apps/customer_app/lib', '.dart');

  rejectMarker('apps/api/src/bookings/bookings.controller.ts', controller, 'scheduledStartAt?:');
  rejectMarker('apps/api/src/bookings/bookings.service.ts', service, 'scheduledStartAt?:');
  for (const file of customerAppFiles) {
    rejectMarker(file, read(file), 'scheduledStartAt');
  }
  requireMarkers('apps/api/src/bookings/bookings.service.ts', service, [
    'HANDS MVP is on-demand only',
    'const timing = openBookingRequestTiming({',
  ]);
  requireMarkers(
    'apps/api/src/bookings/bookings.lifecycle.ts',
    read('apps/api/src/bookings/bookings.lifecycle.ts'),
    ['const openedAt = input.openedAt ?? new Date();', 'scheduledStartAt: openedAt'],
  );
  requireMarkers('infra/scripts/api-smoke.mjs', smoke, [
    'Customer-supplied scheduledStartAt should not create scheduled booking',
    'ignoredFutureScheduledStartAt',
  ]);
  rejectMarker('infra/scripts/api-smoke.mjs', smoke, 'scheduledStartAt: new Date(Date.now()');
  rejectMarker('infra/scripts/realtime-smoke.mjs', realtimeSmoke, 'scheduledStartAt: new Date(Date.now()');
}

function checkAddressBasedBookingContract() {
  const service = read('apps/api/src/bookings/bookings.service.ts');
  const customerApp = read('apps/customer_app/lib/main.dart');
  const smoke = read('infra/scripts/api-smoke.mjs');

  for (const marker of [
    'bookingAttemptCurrentLocationGateError',
    'customerBookingDistanceGateError',
    'Recent customer current location is required before booking',
    'Customer current location must be within',
  ]) {
    rejectMarker('apps/api/src/bookings/bookings.service.ts', service, marker);
  }

  rejectMarker(
    'apps/customer_app/lib/main.dart',
    customerApp,
    'Please refresh your current GPS before booking',
  );
  requireMarkers('apps/api/src/bookings/bookings.service.ts', service, [
    'const customerCurrentLocation = normalizeBookingAttemptCurrentLocation(',
    'preferredProviderBookingDistanceGateError',
    'bookingDistanceGateSnapshot',
  ]);
  requireMarkers('infra/scripts/api-smoke.mjs', smoke, [
    'Customer should be able to browse partners globally with long distance metadata',
    'Booking should open from the confirmed service address without requiring customer GPS',
    'Stale customer GPS should be ignored as optional evidence, not block address-based booking',
    'globalBrowseKeepsPartnerDiscoveryOpen: true',
  ]);
}

function checkCustomerFinalSelectionContract() {
  const policy = read('apps/api/src/matching/matching.policy.ts');
  const bookings = read('apps/api/src/bookings/bookings.service.ts');
  const participants = read('apps/api/src/bookings/bookings.participants.ts');
  const notifications = read('apps/api/src/bookings/bookings.notifications.ts');
  const smoke = read('infra/scripts/api-smoke.mjs');
  const adminSmoke = read('infra/scripts/admin-web-smoke.mjs');

  rejectMarker('apps/api/src/matching/matching.policy.ts', policy, 'AUTO_MATCH_ON_ACCEPT');
  requireMarkers('apps/api/src/matching/matching.policy.ts', policy, [
    "export const PREFERRED_ACCEPT_CUSTOMER_CONFIRM = 'FIRST_PICK_MATCHES_ON_ACCEPT';",
    'return PREFERRED_ACCEPT_CUSTOMER_CONFIRM;',
    'First-pick partner acceptance can match first under API rules',
  ]);
  requireMarkers('apps/api/src/bookings/bookings.service.ts', bookings, [
    'FIRST_PICK_ACCEPTED_FIRST',
    'Booking is already matched or no longer open for first-pick acceptance',
    'matchCustomerSelectedProvider',
    'notifyCustomerSelectedPartnerMatched',
  ]);
  requireMarkers('apps/api/src/bookings/bookings.participants.ts', participants, [
    'selectedProviderId: input.providerProfileId',
  ]);
  requireMarkers('apps/api/src/bookings/bookings.notifications.ts', notifications, [
    "type: 'booking.matched'",
    'The customer selected you for this booking.',
  ]);
  requireMarkers('infra/scripts/api-smoke.mjs', smoke, [
    'First-pick valid acceptance should enter service with the preferred partner',
    'preferredAcceptPolicyMatched.status !==',
    'selectedProviderId !== providerAuth.user.providerProfile.id',
  ]);
  requireMarkers('infra/scripts/admin-web-smoke.mjs', adminSmoke, [
    'Stage 3 choice',
    'customer final selection',
    'legacy Provider wording',
  ]);
}

function checkNoAutomaticCloseoutPolicies() {
  const matchingPolicy = read('apps/api/src/matching/matching.policy.ts');
  const adminService = read('apps/api/src/admin/admin.service.ts');
  const operationsPolicy = read('apps/admin_web/app/operations-policy/page.tsx');
  const smoke = read('infra/scripts/api-smoke.mjs');
  const partnerAcceptance = read('docs/architecture/partner-acceptance-operations.md');

  for (const [file, source] of [
    ['apps/api/src/matching/matching.policy.ts', matchingPolicy],
    ['apps/api/src/admin/admin.service.ts', adminService],
    ['apps/admin_web/app/operations-policy/page.tsx', operationsPolicy],
    ['infra/scripts/api-smoke.mjs', smoke],
    ['docs/architecture/partner-acceptance-operations.md', partnerAcceptance],
  ]) {
    for (const marker of [
      'AUTO_FEE_AFTER_MATCH',
      'AUTO_NO_SHOW_AFTER_EVIDENCE',
      'CANCELLATION_AUTO_FEE_AFTER_MATCH',
      'NO_SHOW_AUTO_AFTER_EVIDENCE',
      'Auto fee after match',
      'Auto no-show after evidence',
      'evidence-backed no-show automation',
      'evidence-assisted automation',
    ]) {
      rejectMarker(file, source, marker);
    }
  }

  requireMarkers('apps/api/src/matching/matching.policy.ts', matchingPolicy, [
    "export const CANCELLATION_ADMIN_FEE_REVIEW_AFTER_MATCH = 'ADMIN_FEE_REVIEW_AFTER_MATCH';",
    "export const NO_SHOW_EVIDENCE_ASSISTED_ADMIN_REVIEW = 'EVIDENCE_ASSISTED_ADMIN_REVIEW';",
    'Admin fee review after match',
    'Evidence-assisted admin review',
  ]);
  requireMarkers('apps/api/src/admin/admin.service.ts', adminService, [
    'evidence-assisted admin review is active',
    'No-show marked; evidence-assisted admin review active',
  ]);
}

function checkNoTipContract() {
  const prisma = read('apps/api/prisma/schema.prisma');
  const earnings = read('apps/api/src/earnings/earnings.service.ts');
  const adminApi = read('apps/admin_web/lib/admin-api.ts');
  for (const [file, source] of [
    ['apps/api/prisma/schema.prisma', prisma],
    ['apps/api/src/earnings/earnings.service.ts', earnings],
    ['apps/admin_web/lib/admin-api.ts', adminApi],
  ]) {
    rejectMarker(file, source, 'tipAmount');
  }
}

function checkPayoutBatchContract() {
  const earningsPolicy = read('apps/api/src/earnings/earnings.policy.ts');
  const matchingPolicy = read('apps/api/src/matching/matching.policy.ts');
  const adminEarnings = read('apps/admin_web/app/earnings/page.tsx');
  const adminEarningsLedger = read('apps/admin_web/app/earnings/earnings-ledger-section.tsx');
  const actionGatePolicyChecklist = read(
    'apps/admin_web/app/operations-policy/action-gate-policy-checklist.ts',
  );
  const operationsPolicyForm = read('apps/admin_web/app/operations-policy/operations-policy-form.tsx');
  const policyImpactDetails = read('apps/admin_web/app/operations-policy/policy-impact-details.ts');
  const smoke = read('infra/scripts/api-smoke.mjs');
  requireMarkers('apps/api/src/earnings/earnings.policy.ts', earningsPolicy, [
    'Positive partner earnings must be paid through payout batches',
  ]);
  requireMarkers('apps/api/src/matching/matching.policy.ts', matchingPolicy, [
    "export const PAYOUT_BATCH_CYCLE_POLICY_KEY = 'payout.batch_cycle_policy';",
    'Payout remains batch-based and admin-controlled',
  ]);
  requireMarkers('apps/admin_web/app/earnings/page.tsx', adminEarnings, ['return isCashDebt(earning);']);
  requireMarkers('apps/admin_web/app/earnings/earnings-ledger-section.tsx', adminEarningsLedger, [
    'payout batching, and cash',
  ]);
  requireMarkers('apps/admin_web/app/operations-policy/operations-policy-form.tsx', operationsPolicyForm, [
    'id={operationalPolicyAnchor(setting.key)}',
  ]);
  requireMarkers(
    'apps/admin_web/app/operations-policy/action-gate-policy-checklist.ts',
    actionGatePolicyChecklist,
    ['Payout batch cycle'],
  );
  requireMarkers('apps/admin_web/app/operations-policy/policy-impact-details.ts', policyImpactDetails, [
    "'payout.batch_cycle_policy':",
    'Positive partner earnings remain settlement-batch based.',
  ]);
  requireMarkers('infra/scripts/api-smoke.mjs', smoke, [
    "'payout.batch_cycle_policy'",
    'Positive partner earnings must be paid through payout batches',
    'Draft payout batch should not mark earnings paid',
  ]);
}

function checkSupabaseDraftContract() {
  const schema = read('infra/supabase/hands-core-schema.sql');
  for (const marker of ['scheduled_at', 'tip_amount_vnd', 'rating numeric', 'rating integer']) {
    rejectMarker('infra/supabase/hands-core-schema.sql', schema, marker);
  }
  requireMarkers('infra/supabase/hands-core-schema.sql', schema, [
    'feedback_record_count integer not null default 0',
    'requested_at timestamptz not null default now()',
    'create table if not exists public.booking_address_snapshots',
    'feedback_label text not null default',
    'booking address snapshots owner and selected Partner read',
  ]);
}

function checkSupabaseBoundary() {
  const allowedFlutterSupabaseFiles = new Set([
    normalize('apps/customer_app/lib/src/core/supabase_client_provider.dart'),
    normalize(
      'apps/customer_app/lib/src/features/auth/data/datasources/supabase_otp_auth_remote_datasource.dart',
    ),
    normalize('apps/customer_app/lib/src/features/auth/data/models/auth_session_model.dart'),
    normalize('apps/customer_app/lib/src/features/auth/presentation/providers/auth_providers.dart'),
    normalize('apps/provider_app/lib/src/core/supabase_client_provider.dart'),
    normalize(
      'apps/provider_app/lib/src/features/auth/data/datasources/supabase_otp_auth_remote_datasource.dart',
    ),
    normalize('apps/provider_app/lib/src/features/auth/data/models/auth_session_model.dart'),
    normalize('apps/provider_app/lib/src/features/auth/presentation/providers/auth_providers.dart'),
  ]);

  for (const file of [
    ...listFiles('apps/customer_app/lib', '.dart'),
    ...listFiles('apps/provider_app/lib', '.dart'),
  ]) {
    const source = read(file);
    if (!source.includes('supabase_flutter') && !source.includes('SupabaseClient')) {
      continue;
    }
    if (!allowedFlutterSupabaseFiles.has(normalize(file))) {
      fail(
        file,
        'Flutter Supabase usage must stay behind auth/core datasource boundaries and not inside screens/business features.',
      );
    }
  }

  for (const file of [
    ...listFiles('apps/customer_app/lib', '.dart'),
    ...listFiles('apps/provider_app/lib', '.dart'),
  ]) {
    const source = read(file);
    if (/\b_client\.(from|rpc|storage)\b/.test(source) || /\bSupabase\.instance\b/.test(source)) {
      fail(
        file,
        'Mobile app must not query Supabase business tables directly; call NestJS repositories/usecases instead.',
      );
    }
  }
}

function checkLegacyRiskRoutesAreRedirectOnly() {
  const nextConfig = read('apps/admin_web/next.config.ts');
  requireMarkers('apps/admin_web/next.config.ts', nextConfig, [
    "source: '/provider-risk'",
    "source: '/partner-risk'",
    "destination: '/partner-controls'",
  ]);

  for (const dir of ['apps/admin_web/app/provider-risk', 'apps/admin_web/app/partner-risk']) {
    for (const file of [...listFilesIfExists(dir, '.ts'), ...listFilesIfExists(dir, '.tsx')]) {
      fail(
        file,
        'Legacy risk route must stay redirect-only. Use /partner-controls or /partners for admin work.',
      );
    }
  }

  requireMarkers(
    'apps/admin_web/app/providers/legacy-provider-redirect.ts',
    read('apps/admin_web/app/providers/legacy-provider-redirect.ts'),
    ['buildLegacyPartnerQueryString', 'new URLSearchParams()'],
  );
  requireMarkers('apps/admin_web/app/providers/page.tsx', read('apps/admin_web/app/providers/page.tsx'), [
    'redirect(`/partners${buildLegacyPartnerQueryString(searchParams ? await searchParams : {})}`);',
  ]);
  requireMarkers(
    'apps/admin_web/app/providers/[id]/page.tsx',
    read('apps/admin_web/app/providers/[id]/page.tsx'),
    ['redirect(`/partners/${id}${buildLegacyPartnerQueryString(searchParams ? await searchParams : {})}`);'],
  );
}

function checkMobileVisibleCopyGuardIsStrict() {
  const source = read('infra/scripts/check-mobile-visible-copy.mjs');
  requireMarkers('infra/scripts/check-mobile-visible-copy.mjs', source, [
    "...listFiles('apps/customer_app/lib', '.dart')",
    "...listFiles('apps/provider_app/lib', '.dart')",
    'non-English Hangul visible copy',
    '\\u3131-\\u318e\\uac00-\\ud7a3',
    'legacy provider display wording',
    'legacy backup wording',
    'tip wording',
    'gratuity',
    'people scoring wording',
    'partner hierarchy wording',
    "value.includes('${') && !/\\s/.test(value)",
  ]);
  for (const testRoot of ["listFiles('apps/customer_app/test'", "listFiles('apps/provider_app/test'"]) {
    if (source.includes(testRoot)) {
      fail(
        'infra/scripts/check-mobile-visible-copy.mjs',
        'Mobile visible-copy guard must inspect production app sources rather than test descriptions.',
      );
    }
  }
}

function checkAdminVisibleCopyGuardIsStrict() {
  const source = read('infra/scripts/check-admin-visible-copy.mjs');
  requireMarkers('infra/scripts/check-admin-visible-copy.mjs', source, [
    'Static Admin visible-copy guard',
    'non-English Hangul visible copy',
    'non-Vietnam region default',
    'tip wording',
    'legacy therapist wording',
    'VIP wording',
    'people scoring wording',
    'partner hierarchy wording',
  ]);

  const verifyLocal = read('infra/scripts/verify-local.ps1');
  requireMarkers('infra/scripts/verify-local.ps1', verifyLocal, [
    'script syntax: admin visible copy',
    'admin visible copy',
    'npm.cmd run admin:visible-copy',
    '$failed = @($results | Where-Object { $_.Status -eq "FAIL" })',
  ]);

  const verifyScope = read('infra/scripts/verify-scope.ps1');
  requireMarkers('infra/scripts/verify-scope.ps1', verifyScope, [
    'admin visible copy',
    'script syntax: admin visible copy',
    'admin visible copy check',
    'api policy coverage',
    'npm.cmd run api:policy-coverage',
    '$failed = @($results | Where-Object { $_.Status -eq "FAIL" })',
  ]);

  const ci = read('.github/workflows/ci.yml');
  requireMarkers('.github/workflows/ci.yml', ci, [
    '- name: Test Admin Web',
    'run: npm run test --workspace @massage-vn/admin-web',
  ]);
  rejectMarker('.github/workflows/ci.yml', ci, 'Test Admin Web security');

  const setupDoctor = read('infra/scripts/setup-doctor.mjs');
  requireMarkers('infra/scripts/setup-doctor.mjs', setupDoctor, [
    'admin visible copy guard',
    'final authority guard',
    'vietnam scope guard',
    'admin query guard',
  ]);
}

function checkAdminPeopleManagementIsFactual() {
  const customerList = [
    read('apps/admin_web/app/customers/page.tsx'),
    read('apps/admin_web/app/customers/customer-list-model.ts'),
    read('apps/admin_web/app/customers/customer-management-view-model.ts'),
    read('apps/admin_web/app/customers/customers-table-section.tsx'),
  ].join('\n');
  const customerDetail = [
    read('apps/admin_web/app/customers/[id]/page.tsx'),
    read('apps/admin_web/app/customers/[id]/customer-booking-operation-board.tsx'),
    read('apps/admin_web/app/customers/[id]/customer-detail-overview-shell.tsx'),
  ].join('\n');
  const partnerList = [
    read('apps/admin_web/app/partners/page.tsx'),
    read('apps/admin_web/app/partners/partner-master-list-section.tsx'),
    read('apps/admin_web/app/partners/partner-master-row.ts'),
    read('apps/admin_web/app/partners/partner-filters.ts'),
  ].join('\n');
  const partnerOperationsList = read('apps/admin_web/app/partners/partner-operations-list-section.tsx');
  const partnerDetail = read('apps/admin_web/app/partners/[id]/page.tsx');
  const adminSmoke = read('infra/scripts/admin-web-smoke.mjs');

  requireMarkers('apps/admin_web/app/customers/page.tsx', customerList, [
    'Customer directory',
    'completed work',
    'Current situation',
    'allCustomerCount',
  ]);
  requireMarkers('apps/admin_web/app/customers/[id]/page.tsx', customerDetail, [
    'Profile and contact',
    'paymentTypeLabel',
    'Current / In Progress',
    'Pre-match Cancellations',
    'Partner Cancellations',
    'customer-chat-history-section',
    'retained messages remain available to operations',
  ]);
  requireMarkers('apps/admin_web/app/partners/page.tsx', partnerList, [
    'PartnerMasterListSection',
    'Work',
    'completed work',
  ]);
  requireMarkers('apps/admin_web/app/partners/partner-operations-list-section.tsx', partnerOperationsList, [
    'List-first partner control view',
    'row.completedWorkCount',
    'Last work',
  ]);
  requireMarkers(
    'apps/admin_web/app/partners/[id]/partner-detail-operating-ledger-section.tsx',
    read('apps/admin_web/app/partners/[id]/partner-detail-operating-ledger-section.tsx'),
    ['Partner operating ledger'],
  );
  requireMarkers('apps/admin_web/app/partners/[id]/page.tsx', partnerDetail, [
    'Partner chat retention ledger',
    'Customer final selection creates the Partner chat',
    'Mobile apps can hide completed-service chats',
  ]);
  requireMarkers('infra/scripts/admin-web-smoke.mjs', adminSmoke, [
    'non-English Hangul visible copy',
    'gratuity',
    'people scoring wording',
    'separate partner activity page wording',
    'operator risk scoring wording',
    'operator risk exposure wording',
    'List-first partner control view',
    'Profile and contact',
    'Booking history',
  ]);
}

function checkAdminDashboardOperationsCoverage() {
  const dashboard = read('apps/admin_web/app/page.tsx');
  const dashboardModel = read('apps/admin_web/app/dashboard-page-model.ts');
  const dashboardDoc = read('docs/architecture/operations-dashboard.md');
  const adminSmoke = read('infra/scripts/admin-web-smoke.mjs');
  const requiredDashboardMarkers = [
    'Shift Command',
    'Next action',
    'Remaining queues',
    'Money status',
    'Additional work',
    'Today result',
    'Demand and supply',
    'Customer choice',
    'In service',
    'Ready Partner location',
  ];

  requireMarkers('apps/admin_web/app/page.tsx', dashboard, requiredDashboardMarkers);
  requireMarkers('apps/admin_web/app/dashboard-page-model.ts', dashboardModel, [
    'Customer and Partner leaders',
  ]);
  requireMarkers('docs/architecture/operations-dashboard.md', dashboardDoc, [
    'Admin home page is the first shift screen',
    'Total booking volume',
    'Current matching pressure',
    'Completed services',
    'Cancelled bookings',
    'No-show follow-up',
    'Hourly demand',
    'Regional demand',
    'Active app presence',
    'Partner supply',
  ]);
  requireMarkers('infra/scripts/admin-web-smoke.mjs', adminSmoke, [
    'Shift Command',
    'Next action',
    'Remaining queues',
    'Money status',
    'Today result',
    'In service',
    'Open handoff',
  ]);
}

function checkBookingDetailIsSourceOfTruth() {
  const bookingDetail = read('apps/admin_web/app/bookings/[id]/page.tsx');
  const adminSmoke = read('infra/scripts/admin-web-smoke.mjs');
  const requiredBookingDetailMarkers = [
    'MVP authority contract',
    'NestJS business authority',
    'customer fallback partner choice',
    'wallet gate',
    'Connected operations records',
    'Operator action availability',
    'Booking gate reason',
    'Booking full record index',
    'Finance evidence',
    'Cash settlement desk',
    'Tax policy',
    'Location trail',
    'Communication and movement handoff',
    'Chat lifecycle and retention',
    'All customer chats',
    'All Partner chats',
    'Service pricing evidence',
  ];

  requireMarkers('apps/admin_web/app/bookings/[id]/page.tsx', bookingDetail, requiredBookingDetailMarkers);
  requireMarkers('infra/scripts/admin-web-smoke.mjs', adminSmoke, requiredBookingDetailMarkers);
}

function checkOperationsPolicyControlPlane() {
  const matchingPolicy = read('apps/api/src/matching/matching.policy.ts');
  const operationsPolicy = read('apps/admin_web/app/operations-policy/page.tsx');
  const policyEnforcementTrace = read('apps/admin_web/app/operations-policy/policy-enforcement-trace.ts');
  const operationsOwnerDecisionBacklog = read(
    'apps/admin_web/app/operations-policy/owner-decision-backlog.ts',
  );
  const operationsMatchingPlaybook = read('apps/admin_web/app/operations-policy/matching-playbook.ts');
  const operationsPolicyWorkspace = [
    operationsPolicy,
    read('apps/admin_web/app/operations-policy/operations-policy-final-partner-choice-section.tsx'),
    read('apps/admin_web/app/operations-policy/operations-policy-matching-stage-impact-section.tsx'),
    read('apps/admin_web/app/operations-policy/operations-policy-enforcement-trace-section.tsx'),
    read('apps/admin_web/app/operations-policy/operations-policy-form.tsx'),
    read('apps/admin_web/app/operations-policy/booking-acceptance-matrix.ts'),
  ].join('\n');
  const apiPolicyCoverage = read('infra/scripts/check-api-policy-coverage.mjs');
  const adminSmoke = read('infra/scripts/admin-web-smoke.mjs');

  requireMarkers('apps/api/src/matching/matching.policy.ts', matchingPolicy, [
    'export const DEFAULT_PROVIDER_RESPONSE_WINDOW_MINUTES = 10;',
    'export const DEFAULT_BACKUP_PROVIDER_RADIUS_METERS = 10000;',
    "export const MATCHING_PROVIDER_RESPONSE_WINDOW_MINUTES_KEY = 'matching.provider_response_window_minutes';",
    "export const MATCHING_BACKUP_PROVIDER_RADIUS_METERS_KEY = 'matching.backup_provider_radius_meters';",
    "export const WALLET_NEGATIVE_BALANCE_GATE_KEY = 'wallet.negative_balance_gate';",
    "export const PREFERRED_ACCEPT_CUSTOMER_CONFIRM = 'FIRST_PICK_MATCHES_ON_ACCEPT';",
    'First-pick partner acceptance can match first under API rules',
    'No policy can automatically assign the final partner.',
  ]);
  requireMarkers('apps/admin_web/app/operations-policy', operationsPolicyWorkspace, [
    'Final partner choice control matrix',
    'Current partner acceptance impact',
    'Matching stage impact preview',
    'Policy enforcement evidence',
    'operationalPolicyAnchor(setting.key)',
    'id={operationalPolicyAnchor(setting.key)}',
    'OPERATIONAL_POLICY_KEYS.providerResponseWindowMinutes',
    'OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters',
    'OPERATIONAL_POLICY_KEYS.walletNegativeGate',
    'Keep first-pick priority with customer fallback before production rollout.',
    'Customer fallback selection applies when first-pick does not validly match first.',
  ]);
  requireMarkers('apps/admin_web/app/operations-policy/policy-enforcement-trace.ts', policyEnforcementTrace, [
    "api: 'POST /customer/bookings'",
    "server: 'BookingsService.createBooking -> MatchingService.openBooking'",
    'Marketplace eligibility pipeline -> visibility check -> booking-address radius gate',
    'Negative wallet gates final acceptance and service start',
    'Cash-service company fee debt is enforced before final acceptance',
  ]);
  requireMarkers(
    'apps/admin_web/app/operations-policy/owner-decision-backlog.ts',
    operationsOwnerDecisionBacklog,
    [
      'Marketplace partner radius',
      'Negative wallet direct-request boundary',
      'href: operationalPolicyHref(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters)',
    ],
  );
  requireMarkers('apps/admin_web/app/operations-policy/matching-playbook.ts', operationsMatchingPlaybook, [
    'Customer picks one first-pick partner',
    'Marketplace partners can participate by policy',
    'displayPolicyByKey(OPERATIONAL_POLICY_KEYS.marketplaceRadiusMeters)',
    'Customer sees available partner choices',
    'Matched chat opens',
  ]);
  requireMarkers('infra/scripts/check-api-policy-coverage.mjs', apiPolicyCoverage, [
    'operational policy metadata',
    "'matching.provider_response_window_minutes'",
    "'matching.marketplace_partner_radius_meters'",
    "'wallet.negative_balance_gate'",
    'matching policy marketplace window',
    'marketplace radius participation guard',
    'negative wallet marketplace participation policy',
  ]);
  requireMarkers('infra/scripts/admin-web-smoke.mjs', adminSmoke, [
    'Operations Policy',
    'First-pick Partner response window',
    'Marketplace Partner radius',
    'Authoritative current status',
    'Demo evidence cannot authorize dispatch',
    'Read-only, no-write preview',
    'Booking action evidence gate',
    'Recent policy audit trail',
  ]);
}

function checkMarketplaceCompatibilityCopy() {
  const matchingPolicy = read('apps/api/src/matching/matching.policy.ts');
  const adminCopy = read('apps/admin_web/lib/admin-copy.ts');

  requireMarkers('apps/api/src/matching/matching.policy.ts', matchingPolicy, [
    'Compatibility: these saved policy keys keep the older internal "backup" naming.',
    'Product and Admin copy must present this flow as marketplace partner participation.',
    'Compatibility: existing settings store this key as backup_open_mode.',
    'Visible operations language must call it marketplace open mode.',
    'Marketplace partner radius',
    'Marketplace partner location freshness',
    'Marketplace partner invitation limit',
    'When marketplace partners can participate',
  ]);
  requireMarkers('apps/admin_web/lib/admin-copy.ts', adminCopy, [
    "replaceAll('backup partner', 'marketplace partner')",
    "replaceAll('backup participation', 'marketplace participation')",
    "replaceAll('backup request', 'marketplace request')",
    "replaceAll('backup open mode', 'marketplace open mode')",
    "replaceAll('backup_', 'marketplace_')",
    "replace(/\\bbackup\\b/g, 'marketplace')",
  ]);
}

function requireMarkers(file, source, markers) {
  for (const marker of markers) {
    if (!source.includes(marker)) {
      fail(file, `Missing required authority marker: ${marker}`);
    }
  }
}

function rejectMarker(file, source, marker) {
  if (source.includes(marker)) {
    fail(file, `Forbidden authority marker is present: ${marker}`);
  }
}

function fail(file, message) {
  violations.push({ file, message });
}

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function normalize(path) {
  return path.replaceAll('\\', '/');
}

function listFiles(dir, extension) {
  const absoluteDir = resolve(root, dir);
  return readdirSync(absoluteDir).flatMap((entry) => {
    const absolutePath = join(absoluteDir, entry);
    const relativePath = normalize(absolutePath.slice(root.length + 1));
    const stat = statSync(absolutePath);
    if (stat.isDirectory()) {
      return listFiles(relativePath, extension);
    }
    return relativePath.endsWith(extension) ? [relativePath] : [];
  });
}

function listFilesIfExists(dir, extension) {
  const absoluteDir = resolve(root, dir);
  if (!existsSync(absoluteDir)) {
    return [];
  }
  return listFiles(dir, extension);
}
