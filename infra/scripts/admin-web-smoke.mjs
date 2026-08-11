import { loadMergedEnv } from './lib/env-file.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
const baseUrl = env.ADMIN_WEB_BASE_URL ?? 'http://127.0.0.1:3101';
const rawSmokeArgs = process.argv.slice(2).filter((value) => !value.startsWith('--env='));
const criticalSmokePaths = [
  '/',
  '/?details=all',
  '/calendar',
  '/bookings',
  '/bookings/completed',
  '/bookings/post-match-cancellations',
  '/customers',
  '/partners',
  '/reviews',
  '/vietnam-overview',
  '/vietnam-overview?view=period',
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
  '/usage-overview',
  '/partners/overview',
  '/marketing-analytics',
  '/finance-overview',
  '/finance-overview?view=flow',
  '/finance-overview?view=queues',
  '/finance-tax',
  '/finance-tax/payment-clearing',
  '/finance-tax/payment-clearing?range=all&review=open&age=48h',
  '/finance-tax/partner-bank-deposits',
  '/finance-tax/general-ledger',
  '/finance-tax/bank-reconciliation',
  '/finance-tax/bank-reconciliation?workspace=imports',
  '/finance-tax/bank-reconciliation?workspace=manual',
  '/finance-tax/booking-settlement-audit',
  '/finance-tax/coupon-finance',
  '/finance-tax/settlement-reversals',
  '/finance-tax/monthly-tax-closing',
  '/finance-tax/platform-vat',
  '/finance-tax/payment-fees',
  '/finance-tax/partner-withholding-tax',
  '/finance-tax/finance-approvers',
  '/finance-tax/approval-queue',
  '/finance-tax/approval-queue?view=bank-accounts',
  '/finance-tax/approval-queue?view=reconciliation',
  '/operations-policy',
  '/cash-settlements',
  '/finance-closeout',
  '/finance-closeout?view=operations&range=today',
  '/finance-closeout?view=settlement&settlementMode=batch',
  '/payouts',
  '/payouts?details=all',
  '/payouts?details=all&view=audit',
  '/payouts?details=all&view=records',
  '/wallet-adjustments',
  '/wallet-adjustments?view=records',
];
const runCriticalSmoke =
  rawSmokeArgs.includes('--critical') || env.ADMIN_WEB_SMOKE_MODE === 'critical';
const runBudgetSmoke =
  rawSmokeArgs.includes('--budget') || env.ADMIN_WEB_SMOKE_MODE === 'budget';
const enforceRouteBudget = rawSmokeArgs.includes('--enforce-budget');
const requestedSmokeArgs = rawSmokeArgs
  .filter((value) => value !== '--critical' && value !== '--budget' && value !== '--enforce-budget')
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
      'Live Bookings',
      'Customers',
      'Partner Operations',
      'Finance Overview',
      'Shift Command',
      'Next action',
      'Open queues',
      'Money status',
      'Today result',
      'In service',
      'Open handoff',
    ],
  },
  {
    path: '/?details=all',
    markers: [
      'HANDS Admin',
      'Shift Command',
      'Next action',
      'Open queues',
      'Money status',
      'Today result',
      'In service',
      'Open handoff',
    ],
  },
  {
    path: '/calendar',
    markers: [
      'Calendar',
      'No events today or in the next 7 days.',
      'Event Filters',
      'Shared operations planning',
      'Add Event',
    ],
  },
  {
    path: '/admin-operators',
    markers: [
      'Admin Operators',
      'Master admin control',
      'Category permissions',
      'Operator activity log',
      'Operator directory',
    ],
  },
  {
    path: '/?range=7d',
    markers: ['Shift Command', 'Next action', 'Open queues', 'Period result', 'Last 7 days'],
  },
  {
    path: '/usage-overview',
    markers: ['Customer Usage', 'Reporting period', 'Needs attention'],
  },
  {
    path: '/partners/overview',
    markers: ['Partner Operations', 'Partner filters', 'Current supply', 'Performance · selected period'],
  },
  {
    path: '/marketing-analytics',
    markers: [
      'Marketing Analytics',
      'Marketing filters',
      'Acquisition and booking trend',
      'Breakdown tables',
      'Dimension rows are not loaded by default',
      'No live ad API',
    ],
  },
  {
    path: '/referrals/customers',
    markers: ['Customer Referrals', 'Referral operations filters', 'Customer referral operations'],
  },
  {
    path: '/referrals/partners',
    markers: ['Partner Referrals', 'Referral operations filters', 'Partner referral parents'],
  },
  {
    path: '/bookings',
    markers: ['Live bookings', 'Booking queues', 'Work now', 'Monitor', 'Search bookings', 'Needs action'],
  },
  {
    path: '/bookings/completed',
    markers: [
      'Completed Bookings',
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
      'Booking workspace filters',
      'Current workspace:',
      'Cancellation Review',
      'Needs review',
      'Needs admin review',
      'No-show',
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
    markers: [
      'Booking Monitor',
      'Stage 3 choice',
      'customer final selection',
      'Booking workspace filters',
      'Current workspace:',
    ],
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
      'Customer filters',
      'Operational view',
      'Search customer',
      'Customer segment',
      'Sign-up Date',
      'Last activity',
      'Last address',
      'Bookings',
      'Attention',
      'Customer value',
      'Customer directory',
    ],
  },
  {
    path: '/chat-archive',
    markers: [
      'Chat Evidence Search',
      'Chat evidence filters',
      'Chat evidence index',
      'Export page preview CSV',
    ],
  },
  {
    path: '/chat-archive?sender=partner&range=30d',
    markers: ['Chat Evidence Search', 'Chat evidence filters', 'Sender', 'Chat evidence index'],
  },
  {
    path: '/chat-archive?status=no-message',
    markers: ['Chat Evidence Search', 'Room without messages', 'Chat evidence index', 'Empty room'],
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
      'Policy comparison',
      'Open change',
      'Live matching policy',
      'Operator decisions',
    ],
  },
  {
    path: '/operations-policy?details=all',
    markers: [
      'Operations Policy',
      'Advanced policy review',
      'Choose workspace',
      'Matching review',
      'Decision review',
      'Audit review',
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
    ],
  },
  {
    path: '/operations-handoff',
    markers: [
      'Operations History',
      'Operations history range',
      'Incomplete handoff',
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
      'Finance decision history',
      'Completed approvals, bank reconciliation decisions, refunds, executions, remittances, monthly close decisions, rejections, reversals, and resolved Finance SLA alerts only.',
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
      'Finance scope',
      'Today Movement',
      'Current Balances',
      'Records',
    ],
    forbiddenMarkers: ['Gross customer payment', 'Finance Priority Desk', 'Finance Action Lists'],
  },
  {
    path: '/finance-overview?view=flow',
    markers: [
      'Finance Overview',
      'Finance scope',
      'Money flow',
      'Gross customer payment',
      'Revenue &amp; Platform Fee',
    ],
    forbiddenMarkers: ['Finance Priority Desk', 'Finance Action Lists'],
  },
  {
    path: '/finance-overview?view=queues',
    markers: [
      'Finance Overview',
      'Finance scope',
      'Action queues',
      'Current Finance Queues',
      'Current unresolved queues across all dates',
    ],
    forbiddenMarkers: ['Finance Priority Desk', 'Gross customer payment'],
  },
  {
    path: '/finance-tax',
    markers: [
      'Tax &amp; Close Overview',
      'Accounting month',
      'Monthly closeout checks',
      'Accounting records',
      'Closeout gates',
    ],
  },
  {
    path: '/finance-tax/payment-clearing',
    markers: [
      'Booking Payment Clearing',
      'Payment clearing filters',
      'Clearing command board',
      'Booking &amp; payment',
      'Clearing event',
      'Status &amp; evidence',
    ],
  },
  {
    path: '/finance-tax/payment-clearing?range=all&review=open&age=48h',
    markers: [
      'Booking Payment Clearing',
      'Payment clearing filters',
      'SLA age: 48h+',
      '48h+',
      'Booking &amp; payment',
      'Status &amp; evidence',
    ],
  },
  {
    path: '/finance-tax/partner-bank-deposits',
    markers: [
      'Partner Bank Deposits',
      'Deposit history filters',
      'Deposit requests',
      'Bank evidence',
      'Bank reconciliation',
    ],
  },
  {
    path: '/finance-tax/general-ledger',
    markers: [
      'General Ledger',
      'General ledger filters',
      'Needs action',
      'Debit / Credit',
      'Status',
    ],
  },
  {
    path: '/finance-tax/bank-reconciliation',
    markers: [
      'Bank Reconciliation',
      'Bank reconciliation work',
      'Review unmatched',
      'Needs action',
      'Bank reconciliation filters',
    ],
  },
  {
    path: '/finance-tax/bank-reconciliation?range=all&review=unmatched',
    markers: [
      'Bank Reconciliation',
      'Bank reconciliation work',
      'Review unmatched',
      'Needs action',
      'Bank reconciliation filters',
    ],
  },
  {
    path: '/finance-tax/bank-reconciliation?workspace=imports',
    markers: [
      'Bank Reconciliation',
      'Bank reconciliation work',
      'Import statement',
      'CSV bank statement review',
      'Statement import history filters',
      'Bank statement import history',
    ],
  },
  {
    path: '/finance-tax/bank-reconciliation?workspace=manual',
    markers: [
      'Bank Reconciliation',
      'Bank reconciliation work',
      'Back to statement import',
      'Manual bank transaction import',
      'Bank import form',
    ],
  },
  {
    path: '/finance-tax/booking-settlement-audit',
    markers: [
      'Booking Settlement Audit',
      'Settlement audit command board',
      'Settlement audit filters',
      'Needs action',
      'Partner settlement',
      'HANDS revenue',
      'Review state',
    ],
  },
  {
    path: '/finance-tax/coupon-finance',
    markers: [
      'Coupon Finance',
      'Coupon finance command board',
      'Coupon review flags',
      'Coupon finance filters',
      'Current filtered totals',
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
      'Closed-period reversals',
      'Tax correction recorded',
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
      'Close blockers',
      'Needs review',
      'Next closeout step',
      'Monthly reconciliation',
      'Closing history',
    ],
  },
  {
    path: '/finance-tax/platform-vat',
    markers: [
      'Platform VAT',
      'Platform VAT period',
      'Company VAT register',
      'Platform fee gross',
      'Company output VAT',
      'Net platform revenue',
    ],
  },
  {
    path: '/finance-tax/payment-fees',
    markers: [
      'Payment Fees',
      'Payment fee period',
      'Applicable period policy',
      'Payment fee evidence by method',
      'Fee accounting classification',
      'Net processing fee',
    ],
  },
  {
    path: '/finance-tax/partner-withholding-tax',
    markers: [
      'Partner Withholding Tax',
      'Withholding tax period',
      'Partner withholding register',
      'Partner taxable revenue',
      'VAT withheld',
      'PIT withheld',
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
    path: '/finance-tax/company-bank-accounts',
    markers: [
      'Company Bank Accounts',
      'Bank account management',
      'Masked number',
      'Recent account changes',
    ],
  },
  {
    path: '/finance-tax/approval-queue',
    markers: [
      'Finance Approval Queue',
      'Policy approvals',
      'Bank account changes',
      'Withdrawal review',
      'Wallet adjustments',
      'Partner deposits',
      'Queue controls',
      'Oldest finance work',
    ],
  },
  {
    path: '/finance-tax/approval-queue?view=bank-accounts',
    markers: [
      'Finance Approval Queue',
      'Bank account changes',
      'Company bank account approval queue',
      'Current state',
      'Proposed state',
      'Maker &amp; reason',
    ],
  },
  {
    path: '/finance-tax/approval-queue?view=reconciliation',
    markers: [
      'Finance Approval Queue',
      'Deposit reconciliation',
      'Partner bank deposit reconciliation queue',
      'Rows per queue',
    ],
  },
  {
    path: '/finance-closeout',
    markers: [
      'Settlement Repair',
      'Settlement workspace',
      'Repair queue',
      'Repair queue filters',
      'Settlement backlog',
    ],
    forbiddenMarkers: ['Finance date range', 'Closeout reconciliation board'],
  },
  {
    path: '/finance-closeout?view=operations&range=today',
    markers: [
      'Settlement Repair',
      'Settlement workspace',
      'Operations closeout',
      'Finance date range',
      'Closeout reconciliation board',
      'Payment-to-earning checks',
      'Cash debt handoff',
      'Shift close action map',
      'Payout release checks',
    ],
    forbiddenMarkers: ['Settlement gap filters', 'Settlement backlog'],
  },
  {
    path: '/finance-closeout?view=settlement&settlementMode=batch',
    markers: [
      'Settlement Repair',
      'Settlement workspace',
      'Batch review',
      'Historical batch filters',
      'Historical settlement dry-run',
    ],
    forbiddenMarkers: [
      'Closeout reconciliation board',
      'Settlement gap filters',
      'Settlement backlog',
    ],
  },
  {
    path: '/finance-closeout?view=operations&range=7d',
    markers: [
      'Settlement Repair',
      'Finance date range',
      'Range:',
      'Last 7 days',
      'Closeout reconciliation board',
    ],
  },
  {
    path: '/coupons',
    markers: ['Coupons', 'Create coupons', 'Live checkout coupons', 'Coupon records'],
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
      'Customer or partner',
      'Find wallet owner',
      'Record filters',
      'Manual adjustment history',
    ],
  },
  {
    path: '/wallet-adjustments?view=records',
    markers: [
      'Wallet Adjustments',
      'Record filters',
      'Manual adjustment history',
      'Rows per page',
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
      'Callback review',
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
      'Payment operations',
    ],
  },
  {
    path: '/payments?review=callback-review',
    markers: [
      'Payments',
      'Payment operation filters',
      'Callback review',
      'Callbacks without verified gateway evidence.',
      'Payment operations',
    ],
  },
  {
    path: '/payments?review=callback-verified',
    markers: [
      'Payments',
      'Payment operation filters',
      'Callback verified',
      'Accepted callbacks with gateway evidence.',
      'Payment operations',
    ],
  },
  { path: '/refunds', markers: ['Refunds', 'Needs action', 'Refund operation filters', 'Refund operations'] },
  {
    path: '/refunds?range=7d',
    markers: ['Refunds', 'Refund operation filters', 'Refund date range', 'Last 7 days'],
  },
  { path: '/reviews', markers: ['Customer Reviews', 'Customer Review', 'Follow-up', 'Search Review'] },
  {
    path: '/notifications',
    markers: ['Notification Delivery', 'All delivery paths healthy', 'Review records and 24h+ history'],
  },
  {
    path: '/notifications?review=failed',
    markers: ['Notifications', 'Failed sends', 'Needs action', 'Retry gate'],
    followUps: [notificationFcmRetryFollowUp('failed', 'Retry gate')],
  },
  {
    path: '/notifications?review=disabled-device',
    markers: ['Notifications', 'Disabled devices', 'Needs action', 'Device recovery gate'],
    followUps: [notificationFcmDeviceFollowUp('disabled-device', 'Device recovery gate')],
  },
  {
    path: '/notifications?review=stale-device',
    markers: ['Notifications', 'Stale devices', 'Needs action', 'Token freshness gate'],
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
    path: '/notifications?review=unattempted',
    markers: [
      'Notifications',
      'Unattempted history',
      'Notification operation filters',
      'Needs action',
    ],
  },
  {
    path: '/notifications?review=fcm',
    markers: ['Notifications', 'FCM', 'FCM route', 'FCM route gate', 'Needs action'],
    followUps: [notificationFcmRetryFollowUp('fcm', 'FCM route gate', 'FCM retry confirmation')],
  },
  { path: '/notifications?review=no-show', markers: ['Notifications', 'No-show'] },
  {
    path: '/files',
    markers: ['Partners', 'Partner operations filters'],
  },
  {
    path: '/payouts',
    markers: [
      'Partner Payouts',
      'Payout date range',
      'Payout workspaces',
      'Operations',
      'Payout money flow',
      'Needs action',
      'Release blocker queue',
      'Partner finance queue',
      'Partner wallet withdrawal requests',
      'Payout batch list',
    ],
  },
  {
    path: '/payouts?range=all&withdrawalStatus=REVIEW_REQUIRED',
    markers: [
      'Partner Payouts',
      'Payout date range',
      'Payout workspaces',
      'Operations',
      'Partner wallet withdrawal requests',
    ],
  },
  {
    path: '/payouts?details=all',
    markers: [
      'Partner Payouts',
      'Payout date range',
      'Payout workspaces',
      'Release policy',
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
    ],
    forbiddenMarkers: ['Payout inclusion audit', 'Payout service evidence', 'Payout batch list'],
  },
  {
    path: '/payouts?details=all&view=audit',
    markers: [
      'Partner Payouts',
      'Payout date range',
      'Audit evidence',
      'Payout inclusion audit',
      'Payout service evidence',
      'Payout status lanes',
    ],
    forbiddenMarkers: ['Payout batch release policy desk', 'Payout batch list'],
  },
  {
    path: '/payouts?details=all&view=records',
    markers: [
      'Partner Payouts',
      'Payout date range',
      'Records',
      'Partner wallet withdrawal requests',
      'Payout batch list',
    ],
    forbiddenMarkers: ['Payout money flow', 'Payout batch release policy desk', 'Payout inclusion audit'],
  },
  {
    path: '/payouts?range=7d',
    markers: [
      'Partner Payouts',
      'Payout date range',
      'Last 7 days',
      'Payout workspaces',
      'Payout money flow',
      'Needs action',
      'Release blocker queue',
      'Partner wallet withdrawal requests',
    ],
  },
  {
    path: '/partner-controls',
    markers: [
      'Partner Controls',
      'Priority queue',
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
      'Partner directory',
      'Directory',
      'Partner directory filters',
      'Search Partner',
      'Partner sort',
    ],
  },
  {
    path: '/partners?details=all',
    markers: [
      'Partners',
      'Compact list',
      'List-first partner control view',
      'Partner operations list',
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
    markers: [
      'Partners',
      'KYC updates',
      'KYC review board',
      'Compact admin list',
      'Compact list',
    ],
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
    markers: ['Partners', 'Partner operations filters'],
  },
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
      'Setup Readiness',
      'System health',
      'Affected work',
      'Last checked',
      'Owning team',
      'Next action',
    ],
  },
  {
    path: '/vietnam-overview',
    markers: [
      'Vietnam Overview',
      'Live map',
      'Period report',
      'Realtime Vietnam operating map',
      'Realtime signal legend',
      'Active customers',
      'Ready Partners',
      'Active bookings',
    ],
  },
  {
    path: '/vietnam-overview?view=period',
    markers: [
      'Vietnam Overview',
      'Live map',
      'Period report',
      'Period metrics range',
      'Vietnam period report',
      'Period regional metrics',
      'National KPI cards above use exact aggregate queries.',
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
const ROUTE_BUDGET_WARN_MS = Number(env.ADMIN_WEB_SMOKE_WARN_MS ?? 2_000);
const ROUTE_BUDGET_WARN_BYTES = Number(env.ADMIN_WEB_SMOKE_WARN_BYTES ?? 256 * 1024);
const ENFORCE_ROUTE_BUDGET = enforceRouteBudget || env.ADMIN_WEB_SMOKE_ENFORCE_BUDGET === '1';
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
  // Wallet adjustment forms use Penalty as a finance/accounting adjustment type, not as people scoring copy.
  const isWalletAdjustmentSurface =
    path.startsWith('/wallet-adjustments') || /^\/customers\/[^/]+/.test(path);
  return isWalletAdjustmentSurface && label === 'people scoring wording' && /^penalty$/i.test(match);
}

for (const page of smokePages) {
  const body = await fetchPage(page.path);
  pageBodies.set(page.path, body);
  if (body.includes('>Access restricted<') || body.includes('Page content is hidden.')) {
    throw new Error(`${page.path} rendered the operator access-denied surface.`);
  }
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
const providerLinkMatch = providersBody.match(
  /href="\/(?:partners|providers)\/(?!overview(?:["/?]))([^"]+)"/,
);
if (providerLinkMatch) {
  const providerDetailPaths = [`/partners/${providerLinkMatch[1]}`, `/providers/${providerLinkMatch[1]}`];
  const providerOverviewMarkers = [
    'Fast operations overview',
    'Open full partner record',
    'Needs action',
    'Identity',
    'Booking command',
    'Payout readiness',
    'Next operator action',
    'Detail workspaces',
  ];
  for (const providerPath of providerDetailPaths) {
    const providerBody = await fetchPage(providerPath);
    const missingProviderMarkers = providerOverviewMarkers.filter((marker) => !providerBody.includes(marker));
    if (missingProviderMarkers.length > 0) {
      throw new Error(
        `${providerPath} is missing expected markers: ${missingProviderMarkers.join(', ')}`,
      );
    }
    assertNoLegacyVisibleLanguage(providerPath, providerBody);
    console.log(`PASS ${providerPath}`);
  }

  const providerFullPath = `/partners/${providerLinkMatch[1]}?section=full`;
  const providerFullBody = await fetchPage(providerFullPath);
  const providerFullMarkers = [
    'Current partner status',
    'Profile and KYC',
    'Work readiness',
    'Bookings and reputation',
    'Reviews and evaluations',
    'Wallet and payout',
    'Operations timeline',
    'System diagnostics',
    'Open technical diagnostics',
    'All Partner chats',
  ];
  const missingProviderFullMarkers = providerFullMarkers.filter(
    (marker) => !providerFullBody.includes(marker),
  );
  if (missingProviderFullMarkers.length > 0) {
    throw new Error(
      `${providerFullPath} is missing expected markers: ${missingProviderFullMarkers.join(', ')}`,
    );
  }
  assertNoLegacyVisibleLanguage(providerFullPath, providerFullBody);
  console.log(`PASS ${providerFullPath}`);

  const providerWorkspaceTargets = [
    {
      markers: ['Partner booking journey', 'Record date filter'],
      path: `/partners/${providerLinkMatch[1]}?section=bookings`,
    },
    {
      markers: ['Partner control records', 'Partner operator notes', 'Partner recent operations timeline'],
      path: `/partners/${providerLinkMatch[1]}?section=control&control=records`,
    },
    {
      markers: ['Partner finance records', 'Finance-only evidence', 'Partner wallet detail'],
      path: `/partners/${providerLinkMatch[1]}?section=dossier&dossier=finance`,
    },
    {
      markers: ['Partner device and session diagnostics', 'Device and session activity'],
      path: `/partners/${providerLinkMatch[1]}?section=access&access=diagnostics`,
    },
  ];
  for (const target of providerWorkspaceTargets) {
    const body = await fetchPage(target.path);
    const missing = target.markers.filter((marker) => !body.includes(marker));
    if (missing.length > 0) {
      throw new Error(`${target.path} is missing expected markers: ${missing.join(', ')}`);
    }
    assertNoLegacyVisibleLanguage(target.path, body);
    console.log(`PASS ${target.path}`);
  }
}

const customersBody = shouldRunDeepSection('/customers') ? await fetchPage('/customers') : '';
const customerLinkMatch = customersBody.match(/href="\/customers\/([^"]+)"/);
if (customerLinkMatch) {
  const customerPath = `/customers/${customerLinkMatch[1]}`;
  const customerBody = await fetchPage(customerPath);
  const customerMarkers = [
    'Customer Detail',
    'Current status',
    'Profile and contact',
    'Needs action',
    'Payment &amp; wallet',
    'Payment and wallet summary',
    'Adjust customer wallet',
    'Customer behavior',
    'Booking history',
    'Referral activity',
    'Customer app notifications',
    'Notification history',
    'Audit records',
    'Add operator note',
    'Operator note history',
    'Chat evidence',
    'Chat history',
  ];
  const missing = customerMarkers.filter((marker) => !customerBody.includes(marker));
  if (missing.length > 0) {
    throw new Error(`${customerPath} is missing expected markers: ${missing.join(', ')}`);
  }
  const unexpectedCustomerMarkers = [
    'Record date filter',
    'Customer workspace view',
    'Chat and system evidence',
    'System audit records',
  ].filter((marker) => customerBody.includes(marker));
  if (unexpectedCustomerMarkers.length > 0) {
    throw new Error(
      `${customerPath} includes deferred markers: ${unexpectedCustomerMarkers.join(', ')}`,
    );
  }
  assertNoLegacyVisibleLanguage(customerPath, customerBody);
  console.log(`PASS ${customerPath}`);

  const customerDiagnosticsPath = `${customerPath}?diagnostics=developer`;
  const customerDiagnosticsBody = await fetchPage(customerDiagnosticsPath);
  const missingCustomerDiagnosticsMarkers = [
    'Chat and system evidence',
    'System audit records',
    'System audit evidence',
  ].filter((marker) => !customerDiagnosticsBody.includes(marker));
  if (missingCustomerDiagnosticsMarkers.length > 0) {
    throw new Error(
      `${customerDiagnosticsPath} is missing expected markers: ${missingCustomerDiagnosticsMarkers.join(', ')}`,
    );
  }
  assertNoLegacyVisibleLanguage(customerDiagnosticsPath, customerDiagnosticsBody);
  console.log(`PASS ${customerDiagnosticsPath}`);
}

const bookingsBody = shouldRunDeepSection('/bookings') ? await fetchPage('/bookings') : '';
const bookingLinkMatch = bookingsBody.match(
  /href="\/bookings\/(?!completed(?:[/?#"]|$)|post-match-cancellations(?:[/?#"]|$))([^"?#/]+)(?:[?#][^"]*)?"/,
);
if (bookingLinkMatch) {
  const bookingPath = `/bookings/${bookingLinkMatch[1]}`;
  const bookingAuthorityContractMarkers = [
    'NestJS business authority',
    'MVP authority contract',
    'customer fallback partner choice',
    'wallet gate',
    'Connected operations records',
    'Operator action availability',
    'Booking gate reason',
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
  const bookingWorkspaceTargets = [
    {
      forbiddenMarkers: [
        'Booking workspace view',
        'Overview mode',
        'Booking review records',
        'Finance detail',
        'Booking lifecycle timeline',
        'Developer/System history',
        'Developer/System settlement',
        'Developer/System diagnostics',
      ],
      markers: [
        ...bookingAuthorityContractMarkers,
        'Booking sections',
        'Booking summary',
        'Needs action',
        'Customer / Partner / Chat',
        'Payment &amp; settlement',
        'Booking timeline',
        'Reviews &amp; notes',
        'Operational records',
        'Booking result',
        'Customer detail',
        'Matched Partner detail',
        'Money result',
        'Customer and Partner chat history',
        'Activity',
      ],
      path: bookingPath,
    },
    {
      forbiddenMarkers: ['>Access restricted<', 'Page content is hidden.'],
      markers: [
        'Booking sections',
        'Booking summary',
        'Booking full record index',
        'Developer/System diagnostics',
      ],
      path: `${bookingPath}?section=diagnostics`,
    },
  ];
  let bookingBody = '';
  for (const target of bookingWorkspaceTargets) {
    const body = await fetchPage(target.path);
    const missing = target.markers.filter((marker) => !body.includes(marker));
    if (missing.length > 0) {
      throw new Error(`${target.path} is missing expected markers: ${missing.join(', ')}`);
    }
    const unexpected = target.forbiddenMarkers.filter((marker) => body.includes(marker));
    if (unexpected.length > 0) {
      throw new Error(`${target.path} rendered another booking workspace: ${unexpected.join(', ')}`);
    }
    if (body.includes('>Access restricted<') || body.includes('Page content is hidden.')) {
      throw new Error(`${target.path} rendered the operator access-denied surface.`);
    }
    assertNoLegacyVisibleLanguage(target.path, body);
    console.log(`PASS ${target.path}`);
    if (target.path === bookingPath) bookingBody = body;
  }
  assertSelectedParticipantCountedInCustomerShortlist(bookingPath, bookingBody);
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
        'Record key',
        'Bank reconciliation matches',
      ],
      routePrefix: 'finance-tax/payment-clearing',
    },
    {
      listPath: '/finance-tax/general-ledger',
      markers: [
        'Journal Batch Detail',
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
