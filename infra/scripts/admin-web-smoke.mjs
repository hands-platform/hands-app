import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
const baseUrl = env.ADMIN_WEB_BASE_URL ?? 'http://127.0.0.1:3101';
const rawSmokeArgs = process.argv.slice(2).filter((value) => !value.startsWith('--env='));
const criticalSmokePaths = [
  '/',
  '/?details=all',
  '/?details=booking',
  '/?details=operations',
  '/?details=operations&operations=analysis',
  '/?details=operations&operations=partner',
  '/?details=operations&operations=closeout',
  '/calendar',
  '/bookings',
  '/bookings/completed',
  '/bookings/post-match-cancellations',
  '/customers',
  '/partners',
  '/reviews',
  '/vietnam-overview',
  '/marketing-analytics',
  '/operations-policy',
  '/operations-policy?details=all',
  '/operations-policy?details=matching',
  '/operations-policy?details=matching&matching=supply',
  '/operations-policy?details=matching&matching=simulation',
  '/operations-policy?details=decisions',
  '/operations-policy?details=decisions&decision=evidence',
  '/operations-policy?details=audit',
];
const budgetSmokePaths = [
  '/',
  '/bookings',
  '/bookings/completed',
  '/bookings/post-match-cancellations',
  '/customers',
  '/partners',
  '/reviews',
  '/notifications',
  '/finance-overview',
  '/finance-tax',
  '/finance-tax/payment-clearing',
  '/finance-tax/general-ledger',
  '/finance-tax/bank-reconciliation',
  '/finance-tax/booking-settlement-audit',
  '/finance-tax/coupon-finance',
  '/finance-tax/settlement-reversals',
  '/finance-tax/monthly-tax-closing',
  '/finance-tax/platform-vat',
  '/finance-tax/payment-fees',
  '/finance-tax/partner-withholding-tax',
  '/finance-tax/finance-approvers',
  '/operations-policy',
  '/cash-settlements',
  '/finance-closeout',
  '/wallet-adjustments',
];
const runCriticalSmoke =
  rawSmokeArgs.includes('--critical') || env.ADMIN_WEB_SMOKE_MODE === 'critical';
const runBudgetSmoke =
  rawSmokeArgs.includes('--budget') || env.ADMIN_WEB_SMOKE_MODE === 'budget';
const requestedSmokeArgs = rawSmokeArgs
  .filter((value) => value !== '--critical' && value !== '--budget')
  .flatMap((value) => value.split(','))
  .map((path) => path.trim())
  .filter(Boolean);

function notificationRetryFollowUp(
  review,
  gateMarker,
  label = `${review} retry confirmation`,
  supportMarkers = ['FCM setup'],
  supportFollowUps = [],
) {
  return notificationConfirmationFollowUp({
    action: 'retry',
    actionMarker: 'Retry notification',
    gateMarker,
    label,
    review,
    supportFollowUps,
    supportMarkers,
  });
}

function notificationDeviceFollowUp(
  review,
  gateMarker,
  label = `${review} device confirmation`,
  supportMarkers = ['FCM setup'],
  supportFollowUps = [],
) {
  return notificationConfirmationFollowUp({
    action: 'enable-device',
    actionMarker: 'Re-enable device',
    gateMarker,
    label,
    review,
    supportFollowUps,
    supportMarkers,
  });
}

function notificationConfirmationFollowUp({
  action,
  actionMarker,
  gateMarker,
  label,
  review,
  supportFollowUps,
  supportMarkers,
}) {
  return {
    hrefPattern: new RegExp(
      `href="([^"]*\\/notifications\\?review=${review}(?:&amp;|&)[^"]*confirm=${action}[^"]*)"`,
    ),
    label,
    markers: [actionMarker, gateMarker, ...supportMarkers, 'Audit trail'],
    noMatchMarkers: notificationEmptyQueueMarkers(review),
    optional: true,
    supportFollowUps,
  };
}

function notificationEmptyQueueMarkers(review) {
  const emptyMarker = 'No notifications currently match this queue';
  if (review === 'failed') {
    return [emptyMarker, 'latest delivery attempts that returned an FCM push failure.'];
  }
  if (review === 'stale-device') {
    return [emptyMarker, 'delivery attempts made with old push token timestamps.'];
  }
  return [];
}

const notificationFcmSupportFollowUps = [
  {
    hrefPattern: /href="([^"]*\/setup\?commands=all#notifications)"/,
    label: 'FCM setup support link',
    markers: ['External setup', 'FCM push notifications', 'npm.cmd run fcm:token-recovery-smoke'],
  },
  {
    hrefPattern: /href="([^"]*\/audit-log\?bucket=Notification[^"]*)"/,
    label: 'notification audit support link',
    markers: ['Audit Log', 'Notification delivery trail'],
  },
];

function notificationFcmRetryFollowUp(review, gateMarker, label = `${review} retry confirmation`) {
  return notificationRetryFollowUp(review, gateMarker, label, ['FCM setup'], notificationFcmSupportFollowUps);
}

function notificationFcmStaleRetryFollowUp(review, gateMarker, label = `${review} retry confirmation`) {
  return notificationRetryFollowUp(
    review,
    gateMarker,
    label,
    ['FCM setup', 'Device audit'],
    notificationFcmSupportFollowUps,
  );
}

function notificationFcmDeviceFollowUp(review, gateMarker, label = `${review} device confirmation`) {
  return notificationDeviceFollowUp(
    review,
    gateMarker,
    label,
    ['FCM setup'],
    notificationFcmSupportFollowUps,
  );
}

const pages = [
  {
    path: '/',
    markers: [
      'HANDS Admin',
      'Calendar',
      'Vietnam Overview',
      'Marketing Analytics',
      'Bookings',
      'All Bookings',
      'Completed',
      'Post-match Cancellations',
      'Partners',
      'Customers',
      'Finance',
      'Start Shift',
      'Needs action now',
      'Live now',
      'Money status',
      'Today work',
      'Today result',
      'Booking requests',
      'Matching exceptions',
      'Waiting for Partner',
      'Completed',
      'Cancelled',
      'Customers in app',
      'Partners in app',
      'Ready Partners',
      'Payment holds',
      'Cash debt',
      'Diagnostics',
      'Booking diagnostics',
      'Operations diagnostics',
    ],
  },
  {
    path: '/?details=all',
    markers: [
      'HANDS Admin',
      'Start Shift',
      'Needs action now',
      'Live now',
      'Money status',
      'Today work',
      'Today result',
      'Booking requests',
      'Matching exceptions',
      'Waiting for Partner',
      'Completed',
      'Cancelled',
      'Customers in app',
      'Partners in app',
      'Ready Partners',
      'Payment holds',
      'Cash debt',
      'Diagnostics',
      'Choose workspace',
      'Booking diagnostics',
      'Operations diagnostics',
      'Booking records',
      'Finance records',
      'Operations History',
    ],
  },
  {
    path: '/?details=booking',
    markers: [
      'HANDS Admin',
      'Start Shift',
      'Booking diagnostics',
      'Dispatch evidence map',
      'Retained evidence signals',
      'Evidence queue shortcuts',
      'Booking loaded',
    ],
  },
  {
    path: '/?details=operations',
    markers: [
      'HANDS Admin',
      'Start Shift',
      'Full diagnostics',
      'Operations diagnostics workspace',
      'Live operations radar',
      'Shift command briefing',
      'Opening shift checklist',
      'Matching control room',
    ],
  },
  {
    path: '/?details=operations&operations=analysis',
    markers: [
      'HANDS Admin',
      'Start Shift',
      'Demand analysis',
      'Policy outcome pulse',
      'Booking attention cockpit',
      'Hourly booking demand',
      'Regional booking demand',
    ],
  },
  {
    path: '/?details=operations&operations=partner',
    markers: [
      'HANDS Admin',
      'Start Shift',
      'Partner readiness',
      'Partner supply status',
      'Partner approval funnel',
      'Partner dispatch control',
      'Marketplace unblock quick order',
    ],
  },
  {
    path: '/?details=operations&operations=closeout',
    markers: [
      'HANDS Admin',
      'Start Shift',
      'Closeout queues',
      'Today command lanes',
      'Operations checklist queue',
      'Finance closeout status',
    ],
  },
  {
    path: '/calendar',
    markers: [
      'Calendar',
      'Visible events',
      'Mini calendar',
      'Event Filters',
      'Shared operations planning',
      'Add Event',
    ],
  },
  {
    path: '/?range=7d',
    markers: ['Start Shift', 'Needs action now', 'Today result', 'Last 7 days'],
  },
  {
    path: '/marketing-analytics',
    markers: [
      'Marketing Analytics',
      'Marketing filters',
      'Acquisition funnel',
      'Breakdown tables',
      'Dimension rows are not loaded by default',
      'No live ad API',
    ],
  },
  {
    path: '/bookings',
    markers: [
      'Booking Monitor',
      'Active bookings',
      'Open matching',
      'Matched',
      'Follow-up queue',
      'Booking workspace filters',
      'Live / Today Bookings',
      'Live In Progress',
      'Request Time',
      'Customer',
      'Requested',
      'Participating',
      'Country',
      'Service Type',
      'Address',
    ],
  },
  {
    path: '/bookings/completed',
    markers: [
      'Completed Bookings',
      'Closeout Records',
      'Booking workspace filters',
      'Completed',
      'Completed Bookings',
      'Payment ops',
      'Closeout ops',
    ],
  },
  {
    path: '/bookings/post-match-cancellations',
    markers: [
      'Post-match Cancellations',
      'Cancellation Review / Needs Action',
      'Cancellation Records / Resolved',
      'Evidence missing',
      'Booking workspace filters',
    ],
  },
  {
    path: '/bookings?view=matching',
    markers: [
      'Booking Monitor',
      'Matching ops',
      'Booking workspace filters',
      'Current workspace:',
    ],
  },
  { path: '/bookings?view=attention', markers: ['Booking Monitor', 'Follow-up queue'] },
  { path: '/bookings?view=first-pick', markers: ['Booking Monitor', 'Stage 1 first-pick'] },
  {
    path: '/bookings?view=marketplace',
    markers: [
      'Booking Monitor',
      'Stage 2 marketplace',
      'Booking workspace filters',
      'Current workspace:',
    ],
  },
  {
    path: '/bookings?view=customer-choice',
    markers: ['Booking Monitor', 'Stage 3 choice', 'Booking workspace filters', 'Current workspace:'],
  },
  { path: '/bookings?view=handoff-repair', markers: ['Booking Monitor', 'Stage 4 repair'] },
  { path: '/bookings?view=no-supply', markers: ['Booking Monitor', 'No supply'] },
  {
    path: '/bookings/post-match-cancellations?view=chat-evidence',
    markers: ['Post-match Cancellations', 'Chat evidence', 'Booking workspace filters'],
  },
  {
    path: '/bookings/post-match-cancellations?view=evidence-missing',
    markers: ['Post-match Cancellations', 'Evidence missing', 'Booking workspace filters'],
  },
  {
    path: '/bookings/completed?view=refund-review',
    markers: ['Completed Bookings', 'Refund review', 'Booking workspace filters'],
  },
  {
    path: '/bookings?view=blocked-create&gate=customer-gps',
    markers: ['Booking Monitor', 'Blocked create', 'Booking workspace filters', 'Current workspace:'],
  },
  { path: '/bookings?view=address', markers: ['Booking Monitor', 'Address check'] },
  {
    path: '/bookings/post-match-cancellations?view=manual-decision',
    markers: ['Post-match Cancellations', 'Manual decision', 'Booking workspace filters'],
  },
  {
    path: '/bookings/completed?view=payment',
    markers: ['Completed Bookings', 'Payment ops', 'Booking workspace filters'],
  },
  {
    path: '/bookings/completed?view=cash-debt',
    markers: ['Completed Bookings', 'Cash debt', 'Booking workspace filters'],
  },
  { path: '/bookings?view=location', markers: ['Booking Monitor', 'Location ops'] },
  { path: '/bookings?view=chat', markers: ['Booking Monitor', 'Chat live'] },
  { path: '/bookings?view=chat-repair', markers: ['Booking Monitor', 'Chat repair'] },
  {
    path: '/bookings?view=all&evidence=money',
    markers: ['Booking Monitor', 'All bookings', 'Booking workspace filters'],
  },
  {
    path: '/bookings?view=all&evidence=chat',
    markers: ['Booking Monitor', 'All bookings', 'Booking workspace filters'],
  },
  {
    path: '/bookings/completed?view=closeout',
    markers: ['Completed Bookings', 'Closeout ops', 'Booking workspace filters'],
  },
  {
    path: '/bookings/completed?view=pricing',
    markers: ['Completed Bookings', 'Pricing ops', 'Booking workspace filters'],
  },
  {
    path: '/bookings/completed?view=expired',
    markers: ['Completed Bookings', 'Expired', 'Booking workspace filters'],
  },
  {
    path: '/bookings/post-match-cancellations?view=no-show',
    markers: ['Post-match Cancellations', 'No-show', 'Booking workspace filters'],
  },
  {
    path: '/customers',
    markers: [
      'Customers',
      'Total customers',
      'Joined today',
      'Active today',
      'Active in 30 days',
      'Customer operations filters',
      'Sign-up Date',
      'Reservation risk / history',
      'Last Login Date',
      'Reservation count sort',
      'Customer directory',
      'Customer',
      'Country',
      'Gender',
      'Last Login Address',
      'Last Completed',
      'Total Wallet Amount',
    ],
  },
  {
    path: '/chat-archive',
    markers: [
      'Chat Evidence Search',
      'Chat evidence filters',
      'Chat integrity repair queue',
      'Chat evidence index',
      'Chat window previews',
    ],
  },
  {
    path: '/chat-archive?sender=partner&range=30d',
    markers: ['Chat Evidence Search', 'Chat evidence filters', 'Sender', 'Chat evidence index'],
  },
  {
    path: '/chat-archive?status=missing-room',
    markers: ['Chat Evidence Search', 'Matched without room', 'Chat integrity repair queue', 'Missing room'],
  },
  {
    path: '/chat-archive?status=no-message',
    markers: ['Chat Evidence Search', 'Room without messages', 'Chat integrity repair queue', 'Empty room'],
  },
  {
    path: '/customers?sort=booking-count',
    markers: ['Customers', 'Sorted by reservations many first', 'Customer directory'],
  },
  {
    path: '/customers?sort=booking-count-asc',
    markers: ['Customers', 'Sorted by reservations few first', 'Customer directory'],
  },
  {
    path: '/customers?joinedRange=today',
    markers: ['Customers', 'Sign-up date: Today', 'Customer directory'],
  },
  {
    path: '/customers?lastBookingRange=7d',
    markers: ['Customers', 'Last reservation: Last 7 days', 'Customer directory'],
  },
  {
    path: '/customers?lastLoginRange=30d',
    markers: ['Customers', 'Last login date: Last month', 'Customer directory'],
  },
  {
    path: '/operations-policy',
    markers: [
      'Operations Policy',
      'MVP authority baseline',
      'Confirmed service address required',
      'No auto assignment',
      'Action gate policy checklist',
      'Action gate policies are aligned',
      'Live matching policy',
      'Operator decisions',
      'Live matching policy',
      'Operator decisions',
      'Change reason',
    ],
  },
  {
    path: '/operations-policy?details=all',
    markers: [
      'Operations Policy',
      'MVP authority baseline',
      'Confirmed service address required',
      'No auto assignment',
      'Advanced policy review',
      'Choose workspace',
      'Matching review',
      'Decision review',
      'Audit review',
      'Live matching policy',
      'Operator decisions',
    ],
  },
  {
    path: '/operations-policy?details=matching',
    markers: [
      'Operations Policy',
      'Matching workspace',
      'Policy editor',
      'Booking matching playbook',
      'Live matching policy',
      'Change reason',
    ],
  },
  {
    path: '/operations-policy?details=matching&matching=supply',
    markers: [
      'Operations Policy',
      'Supply evidence',
      'Final partner choice control matrix',
      'Current partner acceptance impact',
      'Policy sensitivity preview',
      'Matching stage impact preview',
      'Open policy editor',
    ],
  },
  {
    path: '/operations-policy?details=matching&matching=simulation',
    markers: [
      'Operations Policy',
      'Simulation',
      'Live policy simulator',
      'Policy change impact',
      'Policy impact drill-down',
      'Policy outcome effect',
      'Open policy editor',
    ],
  },
  {
    path: '/operations-policy?details=decisions',
    markers: [
      'Operations Policy',
      'Operator decisions',
      'Recommended next choices',
      'Decision editor',
      'Change reason',
    ],
  },
  {
    path: '/operations-policy?details=decisions&decision=evidence',
    markers: [
      'Operations Policy',
      'Operator decisions',
      'Live evidence',
      'Owner decision backlog',
      'Current decision pressure',
      'Open decision editor',
    ],
  },
  {
    path: '/operations-policy?details=audit',
    markers: [
      'Operations Policy',
      'Policy enforcement evidence',
      'API touchpoint: POST /customer/bookings',
      'Server owner: BookingsService.createBooking',
      'Recent policy audit trail',
      'id="action-gate-policy-checklist"',
    ],
  },
  {
    path: '/operations-handoff',
    markers: [
      'Operations History',
      'Operations history range',
      'Review order',
      'Operations review checklist',
      'Historical issue signals',
      'Finance history review',
      'Period brief',
      'Operations history notes',
      'Detailed history lists',
      'Load full history details',
    ],
  },
  {
    path: '/operations-handoff?range=7d',
    markers: ['Operations History', 'Operations history range', 'Last 7 days', 'Detailed history lists'],
  },
  {
    path: '/operations-handoff?details=all&range=7d',
    markers: [
      'Operations History',
      'Operations history range',
      'Unified activity stream',
      'Booking history queue',
      'Customer history',
      'Partner history',
      'Finance and chat closeout',
    ],
  },
  {
    path: '/cash-settlements',
    markers: [
      'Cash Settlements',
      'Cash settlement date range',
      'Open cash fee debt rows',
      'Open full operations view',
    ],
  },
  {
    path: '/cash-settlements?range=7d',
    markers: [
      'Cash Settlements',
      'Cash settlement date range',
      'Last 7 days',
      'Open cash fee debt rows',
      'Open full operations view',
    ],
  },
  {
    path: '/cash-settlements?view=full',
    markers: [
      'Cash Settlements',
      'Cash settlement date range',
      'Debt cause board',
      'Cash settlement execution desk',
      'Settlement priority board',
      'Cash fee settlement workflow',
      'Applied operations policy',
      'Cash clearance',
      'Cash settlement handoff map',
      'Settlement command queue',
    ],
  },
  {
    path: '/finance-overview',
    markers: [
      'Finance Overview',
      'Finance range',
      'Finance Priority Desk',
      'Core Finance KPI',
      'Finance Action Lists',
    ],
  },
  {
    path: '/finance-tax',
    markers: [
      'Tax Overview',
      'Tax finance operating model',
      'Finance operations priority desk',
      'Finance tax workspaces',
      'Summary API',
    ],
  },
  {
    path: '/finance-tax/payment-clearing',
    markers: [
      'Booking Payment Clearing',
      'Payment clearing filters',
      'Payment clearing rows',
      'Payment',
      'Clearing type',
      'Status',
    ],
  },
  {
    path: '/finance-tax/general-ledger',
    markers: [
      'General Ledger',
      'General ledger filters',
      'Journal batches',
      'Debit / Credit',
      'Status',
    ],
  },
  {
    path: '/finance-tax/bank-reconciliation',
    markers: [
      'Bank Reconciliation',
      'Bank reconciliation filters',
      'Manual bank transaction import',
      'Company bank transactions',
      'Transaction',
      'Match',
    ],
  },
  {
    path: '/finance-tax/booking-settlement-audit',
    markers: [
      'Booking Settlement Audit',
      'Settlement audit filters',
      'Booking settlement records',
      'Partner tax',
      'HANDS fee',
      'Status',
    ],
  },
  {
    path: '/finance-tax/coupon-finance',
    markers: [
      'Coupon Finance',
      'Coupon finance filters',
      'Coupon settlement rows',
      'Coupon policy',
      'Amounts',
      'Review',
    ],
  },
  {
    path: '/finance-tax/settlement-reversals',
    markers: [
      'Settlement Reversals',
      'Settlement reversal filters',
      'Settlement reversal rows',
      'Original',
      'Evidence',
      'Status',
    ],
  },
  {
    path: '/finance-tax/monthly-tax-closing',
    markers: [
      'Monthly Tax Closing',
      'Monthly closing period',
      'Monthly closing action',
      'Closeout risk queue',
      'Stored monthly closing rows',
    ],
  },
  {
    path: '/finance-tax/platform-vat',
    markers: [
      'Platform VAT',
      'Platform VAT period',
      'VAT rate breakdown',
      'Platform fee gross',
      'Company VAT',
      'Net revenue',
    ],
  },
  {
    path: '/finance-tax/payment-fees',
    markers: [
      'Payment Fees',
      'Payment fee period',
      'Active payment fee policy',
      'Historical remediation preview',
      'Fees by payer',
      'Fees by treatment',
    ],
  },
  {
    path: '/finance-tax/partner-withholding-tax',
    markers: [
      'Partner Withholding Tax',
      'Withholding tax period',
      'Partner monthly withholding rows',
      'Gross revenue',
      'VAT / PIT',
      'Total withheld',
    ],
  },
  {
    path: '/finance-tax/finance-approvers',
    markers: [
      'Finance Approvers',
      'Approver command board',
      'Finance approver operating rule',
      'Finance approver directory',
      'Dual-control guard',
    ],
  },
  {
    path: '/finance-closeout',
    markers: [
      'Finance Closeout',
      'Finance date range',
      'Closeout reconciliation board',
      'Payment-to-earning checks',
      'Cash debt handoff',
      'Shift close action map',
      'Payout release checks',
    ],
  },
  {
    path: '/finance-closeout?range=7d',
    markers: [
      'Finance Closeout',
      'Finance date range',
      'Range:',
      'Last 7 days',
      'Closeout reconciliation board',
    ],
  },
  {
    path: '/coupons',
    markers: ['Coupons', 'Create coupons', 'Live checkout coupons', 'Upcoming coupon launches', 'Coupon records'],
  },
  {
    path: '/earnings',
    markers: [
      'Partner Earnings',
      'Earnings date range',
      'Money flow command center',
      'Earning batch state filters',
    ],
  },
  {
    path: '/wallet-adjustments',
    markers: [
      'Wallet Adjustments',
      'Manual adjustment request',
      'Manual adjustment history',
      'Accounting preview',
      'Owner profile id',
    ],
  },
  {
    path: '/earnings?range=7d',
    markers: [
      'Partner Earnings',
      'Earnings date range',
      'Last 7 days',
      'Money flow command center',
      'Earning batch state filters',
    ],
  },
  {
    path: '/earnings?batchState=ready',
    markers: ['Partner Earnings', 'Earning batch state filters', 'Batch ready', 'Recent earnings ledger'],
  },
  {
    path: '/payments',
    markers: [
      'Payments',
      'Payment operation filters',
      'Payment date range',
      'Payment callback attempt ledger',
      'Payment operations',
    ],
  },
  {
    path: '/payments?range=7d',
    markers: ['Payments', 'Payment operation filters', 'Payment date range', 'Last 7 days'],
  },
  {
    path: '/payments?review=missing-ref',
    markers: [
      'Payments',
      'Payment operation filters',
      'Missing refs',
      'authorized payments that do not yet have a gateway reference.',
      'Payment callback attempt ledger',
    ],
  },
  {
    path: '/payments?review=callback-review',
    markers: [
      'Payments',
      'Payment operation filters',
      'Callback review',
      'Callbacks without verified gateway evidence.',
      'Payment callback attempt ledger',
    ],
  },
  {
    path: '/payments?review=callback-verified',
    markers: [
      'Payments',
      'Payment operation filters',
      'Callback verified',
      'Accepted callbacks with gateway evidence.',
      'Payment callback attempt ledger',
    ],
  },
  { path: '/refunds', markers: ['Refunds', 'Refund command board', 'Refund operation filters', 'Refund operations'] },
  {
    path: '/refunds?range=7d',
    markers: ['Refunds', 'Refund operation filters', 'Refund date range', 'Last 7 days'],
  },
  { path: '/reviews', markers: ['Customer Reviews', 'Customer Review', 'Follow-up', 'Search Review'] },
  { path: '/notifications', markers: ['Notifications', 'Delivery operations queue', 'No-show alerts'] },
  {
    path: '/notifications?review=failed',
    markers: ['Notifications', 'Failed sends', 'Delivery operations queue', 'Retry gate'],
    followUps: [notificationFcmRetryFollowUp('failed', 'Retry gate')],
  },
  {
    path: '/notifications?review=disabled-device',
    markers: ['Notifications', 'Disabled devices', 'Delivery operations queue', 'Device recovery gate'],
    followUps: [notificationFcmDeviceFollowUp('disabled-device', 'Device recovery gate')],
  },
  {
    path: '/notifications?review=stale-device',
    markers: ['Notifications', 'Stale devices', 'Delivery operations queue', 'Token freshness gate'],
    followUps: [notificationFcmStaleRetryFollowUp('stale-device', 'Token freshness gate')],
  },
  {
    path: '/notifications?review=needs-retry',
    markers: ['Notifications', 'Needs retry', 'Notification operation filters', 'Recovery decision gate'],
    followUps: [
      notificationFcmRetryFollowUp('needs-retry', 'Recovery decision gate'),
      notificationFcmDeviceFollowUp('needs-retry', 'Recovery decision gate'),
    ],
  },
  {
    path: '/notifications?review=pending',
    markers: ['Notifications', 'Pending', 'Notification operation filters', 'Worker path gate'],
    followUps: [notificationRetryFollowUp('pending', 'Worker path gate', 'pending retry confirmation', [])],
  },
  {
    path: '/notifications?review=fcm',
    markers: ['Notifications', 'FCM', 'FCM route', 'FCM route gate', 'Delivery operations queue'],
    followUps: [notificationFcmRetryFollowUp('fcm', 'FCM route gate', 'FCM retry confirmation')],
  },
  { path: '/notifications?review=no-show', markers: ['Notifications', 'No-show'] },
  {
    path: '/files',
    markers: [
      'Files',
      'Central review board for Partner verification files and public profile media.',
      'Total files',
      'Needs review',
      'Public media',
      'Private files',
      'Review queue',
      'Search files',
      'Open Partner',
    ],
  },
  {
    path: '/files?review=needs-review',
    markers: ['Files', 'Needs review', 'Queue: Needs review', 'Review queue'],
  },
  {
    path: '/files?kind=private-verification',
    markers: ['Files', 'Private files', 'Queue: Private files', 'Review queue'],
  },
  {
    path: '/files?q=smoke',
    markers: ['Files', 'Search: smoke', 'Review queue'],
  },
  {
    path: '/payouts',
    markers: [
      'Partner Payouts',
      'Payout date range',
      'Payout batch release policy desk',
      'Applied operations policy',
      'Payout batch cycle',
      'Cash clearance',
      'Wallet gate',
      'Payout release cycle board',
      'Marketplace and payout unblock bridge',
      'Final acceptance gate',
      'Cash debt must stay out of payout',
      'Partners can see marketplace requests while the wallet is negative.',
      'Payout command queue',
      'Payout inclusion audit',
      'Payout batch list',
    ],
  },
  {
    path: '/payouts?range=7d',
    markers: [
      'Partner Payouts',
      'Payout date range',
      'Last 7 days',
      'Payout batch release policy desk',
      'Applied operations policy',
      'Marketplace and payout unblock bridge',
      'Final acceptance gate',
      'Payout command queue',
    ],
  },
  {
    path: '/partner-controls',
    markers: [
      'Partner Controls',
      'Partner control command center',
      'Partner control workspaces',
    ],
  },
  {
    path: '/partner-controls?details=controls',
    markers: ['Partner Controls', 'Partner control board', 'System control checklist'],
  },
  {
    path: '/partner-controls?details=all',
    markers: ['Partner Controls', 'Partner control workspaces'],
  },
  {
    path: '/partner-controls?details=reports',
    markers: ['Partner Controls', 'Create partner report', 'Reports'],
  },
  {
    path: '/partner-controls?details=sanctions',
    markers: ['Partner Controls', 'Account controls'],
  },
  {
    path: '/partner-controls?status=OPEN',
    markers: ['Partner Controls', 'Reports', 'Report status'],
  },
  {
    path: '/partner-controls?sanction=ACTIVE',
    markers: ['Partner Controls', 'Account controls'],
  },
  {
    path: '/partner-controls?review=cash-debt',
    markers: ['Partner Controls', 'Partner control board', 'System control checklist'],
  },
  {
    path: '/app-sessions',
    markers: [
      'App Sessions',
      'App session filters',
      'Session command board',
      'Session check queue',
      'Latest app sessions',
    ],
  },
  {
    path: '/app-sessions?role=CUSTOMER&state=live',
    markers: ['App Sessions', 'Filtered to customer sessions, live heartbeat', 'Latest app sessions'],
  },
  {
    path: '/app-sessions?role=PROVIDER&state=live',
    markers: ['App Sessions', 'Filtered to partner sessions, live heartbeat', 'Latest app sessions'],
  },
  { path: '/audit-log', markers: ['Audit Log', 'Audit command board'] },
  { path: '/audit-log?range=7d', markers: ['Audit Log', 'Date range', 'Last 7 days'] },
  { path: '/audit-log?bucket=Finance%2FCloseout', markers: ['Audit Log', 'Finance closeout trail'] },
  { path: '/audit-log?bucket=Notification', markers: ['Audit Log', 'Notification delivery trail'] },
  {
    path: '/audit-log?bucket=Finance%2FCloseout&range=7d',
    markers: ['Audit Log', 'Finance closeout trail', 'Last 7 days'],
  },
  {
    path: '/partners',
    markers: [
      'Partners',
      'Unapproved Partners',
      'Unsettled Partners',
      'Compact admin list',
      'Partner',
      'Gender',
      'State',
      'Level',
      'Access',
      'Location',
      'Work',
      'Wallet',
      'Account',
      'Partner operations filters',
      'Partner sort',
    ],
  },
  {
    path: '/partners?review=unapproved',
    markers: ['Partners', 'Unapproved Partners', 'Approval-first list'],
  },
  {
    path: '/partners?review=unsettled',
    markers: ['Partners', 'Unsettled Partners', 'Settlement-first list'],
  },
  {
    path: '/partners?review=kyc',
    markers: ['Partners', 'KYC updates', 'Load operations analysis', 'Compact admin list'],
  },
  {
    path: '/partners?review=kyc&details=all',
    markers: ['Partners', 'KYC updates', 'KYC review board', 'Compact list'],
  },
  { path: '/partners?review=cash-debt', markers: ['Partners', 'Cash fee debt'] },
  {
    path: '/partners?review=acceptance-blocked',
    markers: ['Partners', 'Direct request held'],
  },
  { path: '/partners?review=direct-ready', markers: ['Partners', 'Direct request ready'] },
  {
    path: '/partners?review=marketplace-ready',
    markers: ['Partners', 'Marketplace ready', 'Partner operations filters'],
  },
  { path: '/partners?review=marketplace-blocked', markers: ['Partners', 'Dispatch repair'] },
  { path: '/partners?review=reports', markers: ['Partners', 'Reports/controls'] },
  {
    path: '/partners?bookingFlow=first-pick',
    markers: ['Partners', 'Booking flow: First-pick booking', 'First-pick booking'],
  },
  {
    path: '/partners?bookingFlow=chat-missing',
    markers: ['Partners', 'Booking flow: Matched but chat missing', 'Matched but chat missing'],
  },
  {
    path: '/partners?bookingFlow=completed-work',
    markers: ['Partners', 'Booking flow: Completed work', 'Completed work'],
  },
  { path: '/partners?sort=last-work', markers: ['Partners', 'Sort: last completed work'] },
  { path: '/partners?sort=booking-count', markers: ['Partners', 'Sort: booking count'] },
  { path: '/partners?sort=gross-revenue', markers: ['Partners', 'Sort: gross revenue'] },
  { path: '/partners?sort=pending-payout', markers: ['Partners', 'Sort: pending payout'] },
  { path: '/partners?sort=available-payout', markers: ['Partners', 'Sort: available payout'] },
  {
    path: '/providers',
    markers: [
      'Partners',
      'Unapproved Partners',
      'Unsettled Partners',
      'Partner',
      'Gender',
      'State',
      'Level',
      'Access',
      'Location',
      'Work',
      'Wallet',
      'Account',
    ],
  },
  { path: '/providers', markers: ['Partners', 'Compact admin list', 'Unapproved Partners'] },
  { path: '/providers?review=cash-debt', markers: ['Partners', 'Cash fee debt'] },
  {
    path: '/services',
    markers: [
      'Service catalog',
      'Add service',
      'service type(s)',
      'active option(s)',
      'payout rule(s)',
      'Prices use 100,000 VND steps.',
    ],
  },
  {
    path: '/setup',
    markers: [
      'External setup',
      'Current blockers',
      'Production deferred',
      'Master progress control',
      'Phase A',
      'Phase B',
      'Phase C',
      'Phase D',
      'Phase E',
    ],
  },
  {
    path: '/vietnam-overview',
    markers: [
      'Vietnam Overview',
      'Realtime operating map',
      'Realtime Vietnam operating map',
      'Realtime signal legend',
      'Active customers',
      'Ready Partners',
      'Active bookings',
      'Period metrics range',
    ],
  },
  {
    path: '/setup?commands=all#notifications',
    markers: [
      'External setup',
      'FCM push notifications',
      'npm.cmd run notifications:push-data-contract',
      'npm.cmd run notifications:retry-audit-contract',
      'npm.cmd run fcm:token-recovery-smoke',
    ],
  },
  { path: '/tax-policy', markers: ['Tax policy', 'Policy checklist'] },
  { path: '/tax-policy?details=all', markers: ['Tax Policy', 'Tax policy workspaces'] },
  { path: '/tax-policy?details=editor', markers: ['Tax Policy', 'Create policy version'] },
  { path: '/tax-policy?details=audit', markers: ['Tax Policy', 'Tax policy audit summary'] },
  { path: '/tax-policy?details=records', markers: ['Tax Policy', 'Settlement record consistency'] },
];

const directSmokePages = parseDirectSmokePages(env.ADMIN_WEB_SMOKE_DIRECT_PAGES);
pages.push(...directSmokePages);
const runDirectSmoke = directSmokePages.length > 0;

const explicitSmokePaths = (
  (env.ADMIN_WEB_SMOKE_PATHS ?? '') ||
  requestedSmokeArgs.join(',') ||
  directSmokePages.map((page) => page.path).join(',')
)
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean);
const requestedSmokePaths =
  explicitSmokePaths.length > 0
    ? explicitSmokePaths
    : runCriticalSmoke
      ? criticalSmokePaths
      : runBudgetSmoke
        ? budgetSmokePaths
        : [];
const smokePages =
  runBudgetSmoke && requestedSmokePaths.length > 0
    ? requestedSmokePaths.map((path) => pages.find((page) => page.path === path) ?? { path, markers: [] })
    : requestedSmokePaths.length > 0
      ? pages.filter((page) => requestedSmokePaths.includes(page.path))
      : pages;
const FETCH_TIMEOUT_MS = Number(env.ADMIN_WEB_SMOKE_FETCH_TIMEOUT_MS ?? 20_000);
const ROUTE_BUDGET_WARN_MS = Number(env.ADMIN_WEB_SMOKE_WARN_MS ?? 5_000);
const ROUTE_BUDGET_WARN_BYTES = Number(env.ADMIN_WEB_SMOKE_WARN_BYTES ?? 2_000_000);
const ENFORCE_ROUTE_BUDGET = env.ADMIN_WEB_SMOKE_ENFORCE_BUDGET === '1';
const pageBodies = new Map();
const routeMetrics = [];
const smokeCookieHeader = await loadSmokeCookieHeader();

if (!runBudgetSmoke && requestedSmokePaths.length > 0 && smokePages.length === 0) {
  throw new Error(`No admin smoke pages matched ADMIN_WEB_SMOKE_PATHS=${requestedSmokePaths.join(',')}`);
}

async function fetchPage(path, redirectDepth = 0, attempt = 0) {
  const startedAt = Date.now();
  let response;
  let body;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      headers: smokeCookieHeader ? { cookie: smokeCookieHeader } : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if ([307, 308].includes(response.status) && redirectDepth < 3) {
      const location = response.headers.get('location');
      if (location?.startsWith('/')) {
        return fetchPage(location, redirectDepth + 1);
      }
    }
    body = await response.text();
    routeMetrics.push({
      bytes: Buffer.byteLength(body, 'utf8'),
      durationMs: Date.now() - startedAt,
      path,
      status: response.status,
    });
  } catch (error) {
    if (attempt < 6) {
      await delay(1_000 * (attempt + 1));
      return fetchPage(path, redirectDepth, attempt + 1);
    }
    throw new Error(`${path} failed after ${attempt + 1} attempt(s): ${error.message}`);
  }
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${body.slice(0, 240)}`);
  }
  return body;
}

async function loadSmokeCookieHeader() {
  if (env.ADMIN_WEB_SMOKE_COOKIE?.trim()) {
    return env.ADMIN_WEB_SMOKE_COOKIE.trim();
  }

  const email = env.ADMIN_WEB_LOGIN_EMAIL?.trim();
  const password = env.ADMIN_WEB_LOGIN_PASSWORD;
  if (!email || !password) {
    return null;
  }

  const response = await fetch(`${baseUrl}/api/admin/session/login`, {
    body: JSON.stringify({ email, password }),
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    method: 'POST',
    redirect: 'manual',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Admin web smoke login failed with ${response.status}: ${body.slice(0, 160)}`);
  }

  const setCookie = response.headers.get('set-cookie');
  const sessionCookie = setCookie?.split(';')[0]?.trim();
  if (!sessionCookie) {
    throw new Error('Admin web smoke login did not return a session cookie.');
  }

  console.log('Admin web smoke session acquired.');
  return sessionCookie;
}

function parseDirectSmokePages(rawValue) {
  if (!rawValue?.trim()) {
    return [];
  }

  let parsed;
  try {
    parsed = JSON.parse(rawValue);
  } catch {
    throw new Error('ADMIN_WEB_SMOKE_DIRECT_PAGES must be valid JSON.');
  }

  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > 20) {
    throw new Error('ADMIN_WEB_SMOKE_DIRECT_PAGES must contain between 1 and 20 page assertions.');
  }

  return parsed.map((page, index) => {
    if (!page || typeof page !== 'object' || Array.isArray(page)) {
      throw new Error(`ADMIN_WEB_SMOKE_DIRECT_PAGES[${index}] must be an object.`);
    }
    if (
      typeof page.path !== 'string' ||
      !page.path.startsWith('/') ||
      page.path.startsWith('//') ||
      page.path.includes('\\') ||
      page.path.includes('..') ||
      /%2e/i.test(page.path) ||
      /\s/.test(page.path)
    ) {
      throw new Error(`ADMIN_WEB_SMOKE_DIRECT_PAGES[${index}].path must be a local admin route.`);
    }
    if (!Array.isArray(page.markers) || page.markers.length === 0 || page.markers.length > 30) {
      throw new Error(`ADMIN_WEB_SMOKE_DIRECT_PAGES[${index}].markers must contain 1 to 30 strings.`);
    }

    const markers = page.markers.map((marker, markerIndex) => {
      if (typeof marker !== 'string' || marker.trim().length === 0 || marker.length > 500) {
        throw new Error(
          `ADMIN_WEB_SMOKE_DIRECT_PAGES[${index}].markers[${markerIndex}] must be a non-empty string up to 500 characters.`,
        );
      }
      return marker;
    });

    return { path: page.path, markers };
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shouldRunDeepSection(pathPrefix) {
  if (requestedSmokePaths.length === 0) {
    return true;
  }
  return requestedSmokePaths.some(
    (path) => path === pathPrefix || path.startsWith(`${pathPrefix}/`) || path.startsWith(`${pathPrefix}?`),
  );
}

function visibleTextFromHtml(body) {
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function assertNoLegacyVisibleLanguage(path, body) {
  const visibleText = visibleTextFromHtml(body);
  const bannedPatterns = [
    { label: 'non-English Hangul visible copy', pattern: /[가-힣]/ },
    { label: 'legacy Provider wording', pattern: /\bProvider\b|\bPROVIDER\(S\)\b/ },
    { label: 'legacy backup wording', pattern: /\b[Bb]ackup\b/ },
    { label: 'legacy low-rating wording', pattern: /\bLow[- ]rating\b/i },
    {
      label: 'people scoring wording',
      pattern: /\b(score|scoring|ranking|ranked|VIP|tip|tips|gratuity|penalty|penalties)\b/i,
    },
    { label: 'partner average feedback wording', pattern: /\bFeedback value\b/i },
    { label: 'person-rating wording', pattern: /\b(stars? or below|star \/)\b/i },
    { label: 'separate partner activity page wording', pattern: /\bPartner Activity\b/i },
    { label: 'operator risk scoring wording', pattern: /\b(risk score|risk rating|risk level)\b/i },
    { label: 'negative wallet exception wording', pattern: /\bRecovery supervision\b/i },
    {
      label: 'operator risk exposure wording',
      pattern: /\b(payout risk|booking risk|customer risk|partner risk|provider risk)\b/i,
    },
    {
      label: 'judgmental account wording',
      pattern: /\b(account misuse|fraud|misuse|abuse controls|suspicious|trusted partner)\b/i,
    },
    {
      label: 'partner hierarchy wording',
      pattern:
        /\b(trusted|trust review|trusted badge|trust badge|partner badge|profile badge|promoted into)\b/i,
    },
  ];
  const violations = bannedPatterns
    .map((rule) => ({ ...rule, match: visibleText.match(rule.pattern) }))
    .filter((rule) => rule.match)
    .filter((rule) => !isAllowedVisibleLanguageViolation(path, rule.label, rule.match?.[0] ?? ''));
  if (violations.length > 0) {
    throw new Error(
      `${path} contains visible banned operator wording: ${violations
        .map((rule) => `${rule.label} (${rule.match?.[0]})`)
        .join(', ')}`,
    );
  }
}

function isAllowedVisibleLanguageViolation(path, label, match) {
  // Wallet adjustment uses Penalty as a finance/accounting adjustment type, not as partner scoring copy.
  return path.startsWith('/wallet-adjustments') && label === 'people scoring wording' && /^penalty$/i.test(match);
}

for (const page of smokePages) {
  const body = await fetchPage(page.path);
  pageBodies.set(page.path, body);
  if (!runBudgetSmoke) {
    const visibleText = runDirectSmoke ? visibleTextFromHtml(body) : '';
    const missing = page.markers.filter(
      (marker) => !body.includes(marker) && (!runDirectSmoke || !visibleText.includes(marker)),
    );
    if (missing.length > 0) {
      throw new Error(`${page.path} is missing expected markers: ${missing.join(', ')}`);
    }
    assertNoLegacyVisibleLanguage(page.path, body);
    await runPageFollowUps(page, body);
  }
  console.log(`PASS ${page.path}`);
}

async function runPageFollowUps(page, body) {
  for (const followUp of page.followUps ?? []) {
    const match = body.match(followUp.hrefPattern);
    if (!match?.[1]) {
      if (followUp.optional) {
        if (followUp.noMatchMarkers?.length > 0) {
          const missing = followUp.noMatchMarkers.filter((marker) => !body.includes(marker));
          if (missing.length > 0) {
            throw new Error(
              `${page.path} has no follow-up link for ${followUp.label} and is missing no-match markers: ${missing.join(
                ', ',
              )}`,
            );
          }
          console.log(`PASS ${page.path} ${followUp.label}: no matching rows`);
          continue;
        }
        console.log(`SKIP ${page.path} ${followUp.label}: no matching link`);
        continue;
      }
      throw new Error(`${page.path} is missing follow-up link for ${followUp.label}`);
    }

    const followUpPath = decodeHtmlAttribute(match[1]);
    if (!followUpPath.startsWith('/')) {
      throw new Error(`${page.path} follow-up ${followUp.label} must stay in the admin app: ${followUpPath}`);
    }

    const followUpBody = await fetchPage(followUpPath);
    const missing = followUp.markers.filter((marker) => !followUpBody.includes(marker));
    if (missing.length > 0) {
      throw new Error(`${followUpPath} is missing expected markers: ${missing.join(', ')}`);
    }
    assertNoLegacyVisibleLanguage(followUpPath, followUpBody);
    console.log(`PASS ${followUpPath}`);
    await runSupportFollowUps(followUp, followUpPath, followUpBody);
  }
}

async function runSupportFollowUps(followUp, parentPath, body) {
  for (const supportFollowUp of followUp.supportFollowUps ?? []) {
    const match = body.match(supportFollowUp.hrefPattern);
    if (!match?.[1]) {
      throw new Error(`${parentPath} is missing support link for ${supportFollowUp.label}`);
    }

    const supportPath = decodeHtmlAttribute(match[1]);
    if (!supportPath.startsWith('/')) {
      throw new Error(
        `${parentPath} support link ${supportFollowUp.label} must stay in the admin app: ${supportPath}`,
      );
    }

    const supportBody = await fetchPage(supportPath);
    const missing = supportFollowUp.markers.filter((marker) => !supportBody.includes(marker));
    if (missing.length > 0) {
      throw new Error(`${supportPath} is missing expected markers: ${missing.join(', ')}`);
    }
    assertNoLegacyVisibleLanguage(supportPath, supportBody);
    console.log(`PASS ${supportPath}`);
  }
}

if (!runBudgetSmoke && !runDirectSmoke) {
const providersBody =
  shouldRunDeepSection('/partners') || shouldRunDeepSection('/providers')
    ? await fetchPage('/providers')
    : '';
const providerLinkMatch = providersBody.match(/href="\/(?:partners|providers)\/([^"]+)"/);
if (providerLinkMatch) {
  const providerDetailPaths = [`/partners/${providerLinkMatch[1]}`, `/providers/${providerLinkMatch[1]}`];
  for (const providerPath of providerDetailPaths) {
    const providerBody = await fetchPage(providerPath);
    const overviewMarkers = ['Fast operations overview', 'Detail workspaces'];
    const missingOverviewMarkers = overviewMarkers.filter((marker) => !providerBody.includes(marker));
    if (missingOverviewMarkers.length > 0) {
      throw new Error(
        `${providerPath} is missing expected overview markers: ${missingOverviewMarkers.join(', ')}`,
      );
    }
    assertNoLegacyVisibleLanguage(providerPath, providerBody);
    console.log(`PASS ${providerPath}`);

    const fullProviderPath = `${providerPath}?section=full`;
    const fullProviderBody = await fetchPage(fullProviderPath);
    const providerMarkers = [
      'Partner detail workspaces',
      'Choose workspace',
      'Control',
      'Bookings',
      'Access',
      'Dossier',
      'All Partner chats',
    ];
    const missing = providerMarkers.filter((marker) => !fullProviderBody.includes(marker));
    if (missing.length > 0) {
      throw new Error(`${fullProviderPath} is missing expected markers: ${missing.join(', ')}`);
    }
    assertNoLegacyVisibleLanguage(fullProviderPath, fullProviderBody);
    console.log(`PASS ${fullProviderPath}`);

    if (providerPath.startsWith('/partners/')) {
      const workspaceChecks = [
        {
          query: 'section=control',
          markers: ['Partner control workspace', 'Control workspace view', 'Partner operator command queue'],
          excludedMarkers: ['Partner operations digest'],
        },
        {
          query: 'section=control&control=reference',
          markers: ['Partner control workspace', 'Developer reference', 'Partner operations digest'],
        },
        {
          query: 'section=bookings',
          markers: ['Booking and chat evidence', 'Partner booking journey', 'Partner chat retention ledger'],
        },
        {
          query: 'section=access',
          markers: ['App activity and readiness', 'Recent app and operations activity', 'Marketplace booking gate decision'],
        },
        {
          query: 'section=dossier',
          markers: ['Partner approval dossier', 'Dossier workspace view', 'Partner registration dossier'],
          excludedMarkers: ['Partner wallet detail'],
        },
        {
          query: 'section=dossier&dossier=finance',
          markers: ['Partner finance records', 'Finance records', 'Partner wallet detail'],
          excludedMarkers: ['Partner registration dossier'],
        },
      ];

      for (const workspace of workspaceChecks) {
        const workspacePath = `${providerPath}?${workspace.query}`;
        const workspaceBody = await fetchPage(workspacePath);
        const missingWorkspaceMarkers = workspace.markers.filter(
          (marker) => !workspaceBody.includes(marker),
        );
        if (missingWorkspaceMarkers.length > 0) {
          throw new Error(
            `${workspacePath} is missing expected markers: ${missingWorkspaceMarkers.join(', ')}`,
          );
        }
        const unexpectedWorkspaceMarkers = (workspace.excludedMarkers ?? []).filter((marker) =>
          workspaceBody.includes(marker),
        );
        if (unexpectedWorkspaceMarkers.length > 0) {
          throw new Error(
            `${workspacePath} includes deferred markers: ${unexpectedWorkspaceMarkers.join(', ')}`,
          );
        }
        assertNoLegacyVisibleLanguage(workspacePath, workspaceBody);
        console.log(`PASS ${workspacePath}`);
      }

      const filteredProviderPath = `${providerPath}?section=bookings&range=30d`;
      const filteredProviderBody = await fetchPage(filteredProviderPath);
      const filteredProviderMarkers = ['Record date filter', 'Filtered booking archive', 'Filtered activity'];
      const missingFilteredProviderMarkers = filteredProviderMarkers.filter(
        (marker) => !filteredProviderBody.includes(marker),
      );
      if (missingFilteredProviderMarkers.length > 0) {
        throw new Error(
          `${filteredProviderPath} is missing expected markers: ${missingFilteredProviderMarkers.join(', ')}`,
        );
      }
      assertNoLegacyVisibleLanguage(filteredProviderPath, filteredProviderBody);
      console.log(`PASS ${filteredProviderPath}`);
    }
  }
}

const customersBody = shouldRunDeepSection('/customers') ? await fetchPage('/customers') : '';
const customerLinkMatch = customersBody.match(/href="\/customers\/([^"]+)"/);
if (customerLinkMatch) {
  const customerPath = `/customers/${customerLinkMatch[1]}`;
  const customerBody = await fetchPage(customerPath);
  const customerMarkers = [
    'Customer Detail',
    'Customer operating picture',
    'Customer booking situation board',
    'Current / In Progress',
    'Completed',
    'Pre-match Cancellations',
    'Partner Cancellations',
    'Payment Type',
    'Customer operator command queue',
    'Customer activity action panel',
    'Customer contact and evidence',
    'Customer account operations',
    'Saved addresses',
    'Chat and audit record',
    'All customer chats',
    'Record archive summary',
    'Matched booking chat archives retained for admin evidence',
    'Customer notification delivery rows',
    'Audit logs',
  ];
  const missing = customerMarkers.filter((marker) => !customerBody.includes(marker));
  if (missing.length > 0) {
    throw new Error(`${customerPath} is missing expected markers: ${missing.join(', ')}`);
  }
  assertNoLegacyVisibleLanguage(customerPath, customerBody);
  console.log(`PASS ${customerPath}`);

  const filteredCustomerBody = await fetchPage(`${customerPath}?range=7d`);
  const filteredCustomerMarkers = [
    'Record date filter',
    'Preset',
    'Record type',
    'Sort order',
    'Apply filter',
  ];
  const missingFilteredCustomerMarkers = filteredCustomerMarkers.filter(
    (marker) => !filteredCustomerBody.includes(marker),
  );
  if (missingFilteredCustomerMarkers.length > 0) {
    throw new Error(
      `${customerPath}?range=7d is missing expected markers: ${missingFilteredCustomerMarkers.join(', ')}`,
    );
  }
  assertNoLegacyVisibleLanguage(`${customerPath}?range=7d`, filteredCustomerBody);
  console.log(`PASS ${customerPath}?range=7d`);
}

const bookingsBody = shouldRunDeepSection('/bookings') ? await fetchPage('/bookings') : '';
const bookingLinkMatch = bookingsBody.match(
  /href="\/bookings\/(?!completed(?:[/?#"]|$)|post-match-cancellations(?:[/?#"]|$))([^"?#/]+)(?:[?#][^"]*)?"/,
);
if (bookingLinkMatch) {
  const bookingPath = `/bookings/${bookingLinkMatch[1]}`;
  const bookingBody = await fetchPage(bookingPath);
  const bookingMarkers = [
    'NestJS business authority',
    'MVP authority contract',
    'customer fallback partner choice',
    'wallet gate',
    'Unified booking detail',
    'Customer detail',
    'Matched Partner detail',
    'Finance and system detail',
    'Booking review records',
    'Customer and Partner chat history',
    'Booking lifecycle timeline',
    'Connected operations records',
    'Operator action availability',
    'Booking gate reason',
    'Booking full record index',
    'Service / Price',
    'Finance evidence',
    'Cash settlement desk',
    'Tax policy',
    'Location trail',
    'Communication and movement handoff',
    'Chat lifecycle and retention',
    'All customer chats',
    'All Partner chats',
    'Service pricing evidence',
    'Open customer record',
    'Open Partner',
    'Payment record',
    'Partner earning',
    'Participating',
  ];
  const missing = bookingMarkers.filter((marker) => !bookingBody.includes(marker));
  if (missing.length > 0) {
    throw new Error(`${bookingPath} is missing expected markers: ${missing.join(', ')}`);
  }
  assertSelectedParticipantCountedInCustomerShortlist(bookingPath, bookingBody);
  assertNoLegacyVisibleLanguage(bookingPath, bookingBody);
  console.log(`PASS ${bookingPath}`);
}

const paymentsBody = shouldRunDeepSection('/payments') ? await fetchPage('/payments') : '';
const paymentLinkMatch = paymentsBody.match(/href="\/payments\/([^"]+)"/);
if (paymentLinkMatch) {
  const paymentPath = `/payments/${paymentLinkMatch[1]}`;
  const paymentBody = await fetchPage(paymentPath);
  const paymentMarkers = [
    'Payment operation detail',
    'Payment action execution map',
    'Gateway callback attempt timeline',
    'Linked booking evidence',
    'Money ledger',
    'Chat and operation evidence',
    'Payment audit trail',
  ];
  const missing = paymentMarkers.filter((marker) => !paymentBody.includes(marker));
  if (missing.length > 0) {
    throw new Error(`${paymentPath} is missing expected markers: ${missing.join(', ')}`);
  }
  assertNoLegacyVisibleLanguage(paymentPath, paymentBody);
  console.log(`PASS ${paymentPath}`);
}

await runFinanceDetailRouteSmoke();

}
if (runBudgetSmoke) {
  await runBudgetDetailRoutes();
}
printRouteBudgetSummary();
console.log(`Admin web smoke passed for ${smokePages.length} page(s) at ${baseUrl}.`);

async function runFinanceDetailRouteSmoke() {
  const financeDetailSmokeTargets = [
    {
      listPath: '/finance-tax/payment-clearing',
      markers: [
        'Payment Clearing Detail',
        'Clearing overview',
        'Clearing evidence hub',
        'Source key',
        'Bank reconciliation matches',
      ],
      routePrefix: 'finance-tax/payment-clearing',
    },
    {
      listPath: '/finance-tax/general-ledger',
      markers: [
        'General Ledger Detail',
        'Journal batch overview',
        'Journal evidence hub',
        'Double-entry check',
        'Journal entries',
      ],
      routePrefix: 'finance-tax/general-ledger',
    },
    {
      listPath: '/finance-tax/bank-reconciliation',
      markers: [
        'Bank Reconciliation Detail',
        'Bank transaction overview',
        'Bank evidence hub',
        'Transfer reference',
        'Manual reconciliation match',
        'Reconciliation matches',
      ],
      routePrefix: 'finance-tax/bank-reconciliation',
    },
    {
      listPath: '/finance-tax/booking-settlement-audit',
      markers: [
        'Booking Settlement Audit Detail',
        'Settlement record overview',
        'Settlement evidence hub',
        'Accounting amount breakdown',
        'Coupon and policy record',
      ],
      routePrefix: 'finance-tax/booking-settlement-audit',
    },
    {
      listPath: '/finance-tax/settlement-reversals?range=all',
      markers: [
        'Settlement Reversal Detail',
        'Refund after payout evidence',
        'Original settlement lock',
        'Reversal accounting impact',
      ],
      routePrefix: 'finance-tax/settlement-reversals',
      smokePath: '/finance-tax/settlement-reversals',
    },
  ];

  for (const target of financeDetailSmokeTargets) {
    if (!shouldRunDeepSection(target.smokePath ?? target.listPath)) continue;

    const listBody = pageBodies.get(target.listPath) ?? (await fetchPage(target.listPath));
    const detailPath = firstDetailPath(listBody, target.routePrefix);
    if (!detailPath) continue;

    const detailBody = await fetchPage(detailPath);
    const missing = target.markers.filter((marker) => !detailBody.includes(marker));
    if (missing.length > 0) {
      throw new Error(`${detailPath} is missing expected markers: ${missing.join(', ')}`);
    }
    assertNoLegacyVisibleLanguage(detailPath, detailBody);
    console.log(`PASS ${detailPath}`);
  }
}

async function runBudgetDetailRoutes() {
  for (const path of [
    firstDetailPath(pageBodies.get('/bookings'), 'bookings'),
    firstDetailPath(pageBodies.get('/bookings/completed'), 'bookings'),
    firstDetailPath(pageBodies.get('/bookings/post-match-cancellations'), 'bookings'),
    firstDetailPath(pageBodies.get('/customers'), 'customers'),
    firstDetailPath(pageBodies.get('/partners'), 'partners'),
    firstDetailPath(pageBodies.get('/finance-tax/payment-clearing'), 'finance-tax/payment-clearing'),
    firstDetailPath(pageBodies.get('/finance-tax/general-ledger'), 'finance-tax/general-ledger'),
    firstDetailPath(pageBodies.get('/finance-tax/bank-reconciliation'), 'finance-tax/bank-reconciliation'),
    firstDetailPath(pageBodies.get('/finance-tax/booking-settlement-audit'), 'finance-tax/booking-settlement-audit'),
    firstDetailPath(pageBodies.get('/finance-tax/settlement-reversals'), 'finance-tax/settlement-reversals'),
  ].filter(Boolean)) {
    await fetchPage(path);
    console.log(`PASS ${path}`);
  }
}

function firstDetailPath(body, routePrefix) {
  if (!body) return null;
  const ignoredSegments = new Set(['completed', 'post-match-cancellations']);
  const detailLinkPattern = new RegExp(`href="/${routePrefix}/([^"#?]+)[^"]*"`, 'g');
  for (const match of body.matchAll(detailLinkPattern)) {
    const id = decodeHtmlAttribute(match[1] ?? '').trim();
    if (!id || ignoredSegments.has(id)) continue;
    return `/${routePrefix}/${id}`;
  }
  return null;
}

function printRouteBudgetSummary() {
  if (routeMetrics.length === 0) {
    return;
  }

  console.log('Admin route budget summary:');
  for (const metric of routeMetrics) {
    const sizeKb = Math.round(metric.bytes / 1024);
    const flags = [
      metric.durationMs > ROUTE_BUDGET_WARN_MS ? `>${ROUTE_BUDGET_WARN_MS}ms` : null,
      metric.bytes > ROUTE_BUDGET_WARN_BYTES
        ? `>${Math.round(ROUTE_BUDGET_WARN_BYTES / 1024)}KB`
        : null,
    ].filter(Boolean);
    console.log(
      `BUDGET ${metric.path} ${metric.status} ${metric.durationMs}ms ${sizeKb}KB${flags.length ? ` WARN ${flags.join(',')}` : ''}`,
    );
  }

  const budgetFailures = routeMetrics.filter(
    (metric) => metric.durationMs > ROUTE_BUDGET_WARN_MS || metric.bytes > ROUTE_BUDGET_WARN_BYTES,
  );
  if (ENFORCE_ROUTE_BUDGET && budgetFailures.length > 0) {
    throw new Error(
      `Admin route budget exceeded: ${budgetFailures
        .map((metric) => `${metric.path} ${metric.durationMs}ms/${Math.round(metric.bytes / 1024)}KB`)
        .join('; ')}`,
    );
  }
}

function assertSelectedParticipantCountedInCustomerShortlist(path, body) {
  const visibleText = visibleTextFromHtml(body);
  if (!visibleText.includes('SELECTED participant row retained.')) {
    return;
  }
  if (/Customer shortlist\s+0 customer-selectable\b/.test(visibleText)) {
    throw new Error(
      `${path} shows a selected participant row, but the customer shortlist count is still 0 customer-selectable.`,
    );
  }
}
