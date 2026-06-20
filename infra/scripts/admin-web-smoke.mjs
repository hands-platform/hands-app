const baseUrl = process.env.ADMIN_WEB_BASE_URL ?? 'http://127.0.0.1:3101';
const rawSmokeArgs = process.argv.slice(2);
const criticalSmokePaths = [
  '/',
  '/bookings?view=marketplace',
  '/customers',
  '/partners',
  '/files',
  '/cash-settlements',
  '/operations-policy',
  '/setup',
];
const runCriticalSmoke =
  rawSmokeArgs.includes('--critical') || process.env.ADMIN_WEB_SMOKE_MODE === 'critical';
const requestedSmokeArgs = process.argv
  .slice(2)
  .filter((value) => value !== '--critical')
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
    hrefPattern: /href="([^"]*\/setup#notifications)"/,
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
      'Operations Command Center',
      'Shift Flow',
      'Start Shift',
      'Urgent Bookings',
      'Command',
      'Bookings',
      'Partners',
      'Customers',
      'Finance',
      'Policy',
      'Evidence and System',
      'Dashboard date range',
      'Operations command board',
      'Core operating counters',
      'Daily operations snapshot',
      'Live operations radar',
      'Evidence drilldown',
      'Booking evidence command queue',
      'Customer wait lane',
      'First-pick and 10km market',
      'Customer final choice lane',
      'Chat handoff lane',
      'Cash settlement lane',
      'Partner supply lane',
      'Alert and payout lane',
      'Setup readiness lane',
      'Matching wait now',
      'Active app customers',
      'Cash fee block',
      'Shift command briefing',
      'Opening shift checklist',
      'Total bookings',
      'Open matching',
      'Completed bookings',
      'Cancelled bookings',
      'No-show records',
      'Booking status control',
      'Customer app presence',
      'Live app customers',
      'Live active-booking customers',
      'Hourly booking demand',
      'Regional booking demand',
      'Top service areas inferred from booking address text',
      'Partner supply snapshot',
      'Supply pressure',
      'Customers in app',
      'Partners in app',
      'Online Partners',
      'Partner dispatch control',
      'Marketplace unblock quick order',
      'Operations checklist queue',
      'Matching ops',
      'Open matching timeline',
      '/operations-policy#policy-matching-provider-response-window-minutes',
      '/operations-policy#policy-wallet-negative-balance-gate',
      'API source',
      'Admin menu map',
      'Customer Management',
      'Partner Management',
      'Finance Operations',
      'Live Matching',
      'Customer Choice',
      'Chat Repair',
      'Failed Alerts',
      'KYC Review',
      'Direct Request Held',
      'Marketplace Ready',
      'Today operator order',
      'Live customer wait',
      'Cash fee settlement gate',
      'Service and payment mix',
      'Finance snapshot',
      'Partner readiness funnel',
      'Shift operating route',
      'Live booking route',
      'Matching policy route',
      'Customer support route',
      'Finance settlement route',
      'Partner supply route',
      'Alert and payout route',
      'Setup route',
    ],
  },
  {
    path: '/?range=7d',
    markers: ['HANDS Admin', 'Dashboard date range', 'Last 7 days', 'Hourly booking demand'],
  },
  {
    path: '/bookings',
    markers: [
      'Booking Monitor',
      'Booking operations command summary',
      'Primary command queue',
      'Booking operations route map',
      'Matching escalation board',
      'Matching flow timeline',
      'Marketplace participation',
      'Dispatch Partner repair shortcuts',
      'Customer protection closeout board',
      'Evidence readiness',
      'Booking operation filters',
      'Evidence filter',
      'Chat evidence',
      'Evidence missing',
      'Refund review',
      'Booking / stage',
      'Address / customer',
      'Payment / wallet',
      'Primary booking command',
      'Booking gate reason',
      'Action status strip',
      'Matching rule snapshot',
      'Applied operations policy',
      'First-pick window',
      'Marketplace radius',
      'Wallet gate',
      'Stage 3 choice',
    ],
  },
  {
    path: '/bookings?view=matching',
    markers: [
      'Booking Monitor',
      'Matching ops',
      'Matching flow timeline',
      'Dispatch Partner repair shortcuts',
    ],
  },
  { path: '/bookings?view=attention', markers: ['Booking Monitor', 'Follow-up queue'] },
  { path: '/bookings?view=first-pick', markers: ['Booking Monitor', 'Stage 1 first-pick'] },
  {
    path: '/bookings?view=marketplace',
    markers: [
      'Booking Monitor',
      'Stage 2 marketplace',
      'Marketplace booking coverage board',
      'Bookings with participant history',
      'Marketplace participant ledger',
      'Marketplace record boundary',
      'Actual participation rows',
      'Pre-finalization wallet gate',
      'Customer choice evidence',
      'Customer-selectable reason',
      'Why not selectable',
      'Marketplace operating queue',
      'First-pick timer control',
      'Partner participation pool',
      'Customer final selection lane',
      'Wallet unblock lane',
      'All participant records',
      'Selected marketplace Partner',
      'Customer final choice',
      'Marketplace participation gate',
      'Participant rows only',
      'Blocked wallet joins are not participant records',
      'Customer-selected final Partner only',
      'A negative-wallet Partner may see marketplace requests, but final acceptance, service start, and payout release wait until settlement.',
      'Participant evidence',
    ],
  },
  { path: '/bookings?view=customer-choice', markers: ['Booking Monitor', 'Stage 3 choice'] },
  { path: '/bookings?view=handoff-repair', markers: ['Booking Monitor', 'Stage 4 repair'] },
  { path: '/bookings?view=no-supply', markers: ['Booking Monitor', 'No supply'] },
  { path: '/bookings?view=chat-evidence', markers: ['Booking Monitor', 'Chat evidence'] },
  { path: '/bookings?view=evidence-missing', markers: ['Booking Monitor', 'Evidence missing'] },
  { path: '/bookings?view=refund-review', markers: ['Booking Monitor', 'Refund review'] },
  {
    path: '/bookings?view=blocked-create&gate=customer-gps',
    markers: ['Booking Monitor', 'Create gate filter', 'Optional GPS evidence'],
  },
  { path: '/bookings?view=address', markers: ['Booking Monitor', 'Address check'] },
  { path: '/bookings?view=manual-decision', markers: ['Booking Monitor', 'Manual decision'] },
  { path: '/bookings?view=payment', markers: ['Booking Monitor', 'Payment ops'] },
  { path: '/bookings?view=cash-debt', markers: ['Booking Monitor', 'Cash fee debt'] },
  { path: '/bookings?view=location', markers: ['Booking Monitor', 'Location ops'] },
  { path: '/bookings?view=chat', markers: ['Booking Monitor', 'Chat handoff'] },
  { path: '/bookings?view=chat-repair', markers: ['Booking Monitor', 'Chat repair'] },
  {
    path: '/bookings?view=all&evidence=money',
    markers: ['Booking Monitor', 'Evidence filter', 'Payment / wallet check'],
  },
  {
    path: '/bookings?view=all&evidence=chat',
    markers: ['Booking Monitor', 'Evidence filter', 'Chat archive check'],
  },
  {
    path: '/bookings?view=closeout',
    markers: ['Booking Monitor', 'Closeout ops', 'earning, tax, platform fee, or wallet ledger'],
  },
  {
    path: '/bookings?view=pricing',
    markers: ['Booking Monitor', 'Pricing ops', 'active service payout matrix'],
  },
  { path: '/bookings?view=expired', markers: ['Booking Monitor', 'Expired'] },
  { path: '/bookings?view=no-show', markers: ['Booking Monitor', 'No-show'] },
  {
    path: '/customers',
    markers: [
      'Customer Management',
      'Customer activity board',
      'All customers',
      'Customer ID',
      'Phone / email',
      'Booking flow',
      'Joined',
      'Recent access',
      'Last work',
      'Bookings',
      'Completed',
      'wallet view',
      'Frequent service / area',
      'Repeated Partner',
      'Total paid',
      'Payment',
      'Chat archive',
      'Admin memo',
      'Ops trail',
      'Memo',
      'Cancelled',
      'Saved addresses',
      'Open a row to see all customer details',
    ],
  },
  {
    path: '/chat-archive',
    markers: [
      'Chat Archive',
      'Chat archive index',
      'Chat integrity repair queue',
      'Message transcript preview',
      'Export messages CSV',
      'Admin retained',
    ],
  },
  {
    path: '/chat-archive?sender=partner&range=30d',
    markers: ['Chat Archive', 'Sender', 'Message transcript preview'],
  },
  {
    path: '/chat-archive?status=missing-room',
    markers: ['Chat Archive', 'Matched without room', 'Chat integrity repair queue', 'Missing room'],
  },
  {
    path: '/chat-archive?status=no-message',
    markers: ['Chat Archive', 'Room without messages', 'Chat integrity repair queue', 'Empty room'],
  },
  {
    path: '/customers?sort=last-work',
    markers: ['Customer Management', 'Sort: last completed work', 'All customers'],
  },
  {
    path: '/customers?sort=booking-count',
    markers: ['Customer Management', 'Sort: booking count', 'All customers'],
  },
  {
    path: '/customers?sort=completed-count',
    markers: ['Customer Management', 'Sort: completed work count', 'All customers'],
  },
  {
    path: '/customers?sort=captured-spend',
    markers: ['Customer Management', 'Sort: captured spend', 'All customers'],
  },
  {
    path: '/customers?sort=last-seen',
    markers: ['Customer Management', 'Sort: last app session', 'All customers'],
  },
  {
    path: '/customers?bookingFlow=first-pick',
    markers: ['Customer Management', 'Booking flow: First-pick pending', 'First-pick pending'],
  },
  {
    path: '/customers?bookingFlow=chat-missing',
    markers: ['Customer Management', 'Booking flow: Matched but chat missing', 'Matched but chat missing'],
  },
  {
    path: '/customers?bookingFlow=address-snapshot',
    markers: ['Customer Management', 'Booking flow: Address snapshot saved', 'Address snapshot saved'],
  },
  {
    path: '/operations-policy',
    markers: [
      'Operations Policy',
      'MVP authority baseline',
      'BookingAddressSnapshot',
      'No auto assignment',
      'Booking-address radius',
      'View demand, block finalization',
      'Final partner choice control matrix',
      'Current partner acceptance impact',
      'Policy sensitivity preview',
      'Matching stage impact preview',
      'Owner decision backlog',
      'Current decision pressure',
      'Action gate policy checklist',
      'Booking action evidence',
      'Cash fee clearance',
      'Payout batch cycle',
      'Policy enforcement trace',
      'API touchpoint: POST /customer/bookings',
      'Server owner: BookingsService.createBooking',
      'Live matching policy',
      'id="action-gate-policy-checklist"',
      'id="matching-stage-impact"',
      'Change reason',
    ],
  },
  {
    path: '/operations-handoff',
    markers: [
      'Operations Handoff',
      'Handoff date range',
      'Immediate action queue',
      'Finance handoff action map',
      'Unified activity stream',
      'Export activity CSV',
      'Shift brief',
      'Save handoff note',
      'Latest operator notes',
      'Booking handoff queue',
      'Customer handoff',
      'Partner handoff',
      'Finance and chat closeout',
    ],
  },
  {
    path: '/operations-handoff?range=7d',
    markers: ['Operations Handoff', 'Handoff date range', 'Last 7 days', 'Unified activity stream'],
  },
  {
    path: '/cash-settlements',
    markers: [
      'Cash Settlements',
      'Cash settlement date range',
      'Debt cause board',
      'Cash settlement execution desk',
      'Settlement priority board',
      'Cash fee settlement workflow',
      'Applied operations policy',
      'Cash clearance',
      'Wallet gate',
      'Cash settlement handoff map',
      'Confirm deposit / offset',
      'Settlement command queue',
    ],
  },
  {
    path: '/cash-settlements?range=7d',
    markers: [
      'Cash Settlements',
      'Cash settlement date range',
      'Last 7 days',
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
  { path: '/coupons', markers: ['Coupons', 'Campaign command board'] },
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
      'Payment action execution map',
      'Open detail',
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
  { path: '/refunds', markers: ['Refunds', 'Refund command board', 'Refund action execution map'] },
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
    markers: ['Notifications', 'FCM', 'FCM route', 'FCM route gate', 'npm.cmd run fcm:token-recovery-smoke'],
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
      'Payout action execution map',
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
      'Partner control board',
      'Marketplace and payout unblock board',
      'Marketplace and payout unblock playbook',
      'Partner control command center',
      'System control checklist',
    ],
  },
  {
    path: '/app-sessions',
    markers: [
      'App Sessions',
      'Session scope',
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
      'Partner operations list',
      'Compact admin list',
      'Partner ID',
      'Partner',
      'Phone',
      'Gender',
      'Current state',
      'Level',
      'Joined / recent access',
      'Location',
      'Bookings',
      'Feedback records',
      'Revenue',
      'Payout',
      'Account',
      'Booking flow',
      'List-first partner control view',
      'completed work',
      'Last work',
      'Booking access',
    ],
  },
  {
    path: '/partners?review=unapproved',
    markers: ['Partners', 'Unapproved Partners', 'Approval-first list', 'Partner operations list'],
  },
  {
    path: '/partners?review=unsettled',
    markers: ['Partners', 'Unsettled Partners', 'Settlement-first list', 'Partner operations list'],
  },
  { path: '/partners?review=kyc', markers: ['Partners', 'KYC review board', 'KYC updates'] },
  { path: '/partners?review=cash-debt', markers: ['Partners', 'Cash fee debt'] },
  {
    path: '/partners?review=acceptance-blocked',
    markers: ['Partners', 'Direct request held'],
  },
  { path: '/partners?review=direct-ready', markers: ['Partners', 'Direct request ready'] },
  { path: '/partners?review=marketplace-ready', markers: ['Partners', 'Marketplace ready'] },
  { path: '/partners?review=marketplace-blocked', markers: ['Partners', 'Marketplace repair'] },
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
      'Partner operations list',
      'Partner ID',
      'Partner',
      'Phone',
      'Gender',
      'Current state',
      'Level',
      'Joined / recent access',
      'Location',
      'Bookings',
      'Feedback records',
      'Revenue',
      'Payout',
      'Account',
      'Booking access',
    ],
  },
  { path: '/providers', markers: ['Partners', 'Partner operations list', 'Unapproved Partners'] },
  { path: '/providers?review=cash-debt', markers: ['Partners', 'Cash fee debt'] },
  {
    path: '/services',
    markers: [
      'Service catalog',
      'Duration pricing matrix',
      'Customer booking exposure guard',
      'Service type coverage board',
      'Missing duration options',
      'Pricing health',
      'Booking readiness queue',
      'Service payout ledger',
      'Partner payout',
      'VAT',
      'Withholding',
      'Actual company commission',
      'Create service with duration options',
      '60, 90, and 120 minute options',
      'Price step',
    ],
  },
  {
    path: '/setup',
    markers: [
      'External setup',
      'External registration handoff',
      'Current blockers',
      'Next operator actions',
      'Live readiness',
      'Verification commands',
      'Runtime operations policy',
    ],
  },
  {
    path: '/setup#notifications',
    markers: [
      'External setup',
      'FCM push notifications',
      'npm.cmd run notifications:push-data-contract',
      'npm.cmd run notifications:retry-audit-contract',
      'npm.cmd run fcm:token-recovery-smoke',
    ],
  },
  { path: '/tax-policy', markers: ['Tax policy', 'Policy checklist'] },
];

const explicitSmokePaths = ((process.env.ADMIN_WEB_SMOKE_PATHS ?? '') || requestedSmokeArgs.join(','))
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean);
const requestedSmokePaths =
  explicitSmokePaths.length > 0 ? explicitSmokePaths : runCriticalSmoke ? criticalSmokePaths : [];
const smokePages =
  requestedSmokePaths.length > 0 ? pages.filter((page) => requestedSmokePaths.includes(page.path)) : pages;
const FETCH_TIMEOUT_MS = Number(process.env.ADMIN_WEB_SMOKE_FETCH_TIMEOUT_MS ?? 20_000);

if (requestedSmokePaths.length > 0 && smokePages.length === 0) {
  throw new Error(`No admin smoke pages matched ADMIN_WEB_SMOKE_PATHS=${requestedSmokePaths.join(',')}`);
}

async function fetchPage(path, redirectDepth = 0, attempt = 0) {
  let response;
  let body;
  try {
    response = await fetch(`${baseUrl}${path}`, {
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
    .filter((rule) => rule.match);
  if (violations.length > 0) {
    throw new Error(
      `${path} contains visible banned operator wording: ${violations
        .map((rule) => `${rule.label} (${rule.match?.[0]})`)
        .join(', ')}`,
    );
  }
}

for (const page of smokePages) {
  const body = await fetchPage(page.path);
  const missing = page.markers.filter((marker) => !body.includes(marker));
  if (missing.length > 0) {
    throw new Error(`${page.path} is missing expected markers: ${missing.join(', ')}`);
  }
  assertNoLegacyVisibleLanguage(page.path, body);
  console.log(`PASS ${page.path}`);
  await runPageFollowUps(page, body);
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

const providersBody =
  shouldRunDeepSection('/partners') || shouldRunDeepSection('/providers')
    ? await fetchPage('/providers')
    : '';
const providerLinkMatch = providersBody.match(/href="\/(?:partners|providers)\/([^"]+)"/);
if (providerLinkMatch) {
  const providerDetailPaths = [`/partners/${providerLinkMatch[1]}`, `/providers/${providerLinkMatch[1]}`];
  for (const providerPath of providerDetailPaths) {
    const providerBody = await fetchPage(providerPath);
    const overviewMarkers = ['Fast operations overview', 'Open full dossier'];
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
      'Partner operator command queue',
      'Partner command snapshot',
      'Partner recent operations timeline',
      'Partner operations digest',
      'Partner booking journey',
      'Partner connected operations records',
      'Partner booking evidence bundles',
      'Partner operator notes',
      'Partner ops command center',
      'Partner master facts',
      'Partner full record index',
      'Partner operating ledger',
      'Partner operating checklist',
      'Factual work-control checklist',
      'Partner chat retention ledger',
      'Customer final selection creates the Partner chat',
      'Booking and chat records',
      'All Partner chats',
      'Recent app and operations activity',
      'Partner daily activity digest',
      'Marketplace booking gate decision',
      'Marketplace participation',
      'Direct first-pick',
      'Marketplace repair command',
      'Partner app block message',
      'Partner can view marketplace requests',
      'Partner marketplace/payout unblock playbook',
      'id="payout"',
      'id="kyc"',
      'id="service-pricing"',
      'id="bank"',
      'id="tax"',
      'id="location"',
    ];
    const missing = providerMarkers.filter((marker) => !fullProviderBody.includes(marker));
    if (missing.length > 0) {
      throw new Error(`${fullProviderPath} is missing expected markers: ${missing.join(', ')}`);
    }
    assertNoLegacyVisibleLanguage(fullProviderPath, fullProviderBody);
    console.log(`PASS ${fullProviderPath}`);

    const filteredProviderPath = `${providerPath}?section=full&range=30d`;
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

const customersBody = shouldRunDeepSection('/customers') ? await fetchPage('/customers') : '';
const customerLinkMatch = customersBody.match(/href="\/customers\/([^"]+)"/);
if (customerLinkMatch) {
  const customerPath = `/customers/${customerLinkMatch[1]}`;
  const customerBody = await fetchPage(customerPath);
  const customerMarkers = [
    'Customer detail',
    'Customer recent operations timeline',
    'Customer connected operations records',
    'Customer booking evidence bundles',
    'Customer operator command queue',
    'Customer full record index',
    'Customer operations digest',
    'Customer booking journey',
    'Customer operating ledger',
    'Customer activity action panel',
    'Customer information',
    'Customer account facts',
    'Wallet and payment',
    'Saved addresses',
    'Booking and cancellation history',
    'Customer chat retention ledger',
    'Matched bookings must create a chat room',
    'Chat history',
    'All customer chats',
    'Admin archive for every matched booking',
    'Customer chronological activity',
    'Customer daily activity digest',
    'Bookings and work',
    'Support trail',
    'Recent customer notifications',
    'Customer audit trail',
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
    'Filtered bookings',
    'Filtered chat rooms',
    'Filtered activity',
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
const bookingLinkMatch = bookingsBody.match(/href="\/bookings\/([^"]+)"/);
if (bookingLinkMatch) {
  const bookingPath = `/bookings/${bookingLinkMatch[1]}`;
  const bookingBody = await fetchPage(bookingPath);
  const bookingMarkers = [
    'Booking operations quick rail',
    'Booking command decision strip',
    'Primary booking command',
    'four-lane operator strip',
    'Marketplace participation and wallet evidence',
    'Participant evidence boundary',
    'Customer final Partner',
    'Chat evidence handoff',
    'Wallet/cash fee gate',
    'Operator command queue',
    'Operator action availability',
    'Booking gate reason',
    'MVP authority contract',
    'NestJS business authority',
    'address snapshot',
    'customer fallback partner choice',
    'wallet gate',
    'Booking recent operations timeline',
    'Request timestamp',
    'Evidence packet for admin decision',
    'Chat evidence decision board',
    'Retained chat evidence is the first place operators should look',
    'Manual outcome decision readiness',
    'Decision note presets',
    'Booking full evidence bundle',
    'Connected operations records',
    'Chat evidence',
    'Location evidence',
    'Payment evidence',
    'Operator note evidence',
    'Booking handoff checklist',
    'Booking full record index',
    'Service and pricing',
    'Finance trace',
    'Payout batch eligibility',
    'Earnings ledger',
    'Cash settlement desk',
    'Tax policy',
    'Location trail',
    'Communication and movement',
    'Booking operating ledger',
    'Service/Pricing',
    'Refund',
    'Cash settlement',
    'Operator notes',
    'Closeout readiness',
    'Operating timeline',
    'Communication and movement handoff',
    'Chat lifecycle and retention',
    'All customer chats',
    'All Partner chats',
    'Service pricing snapshot',
    'Open customer record',
    'Preferred Partner',
    'Matching rule snapshot',
    'Booking stage snapshot',
    'Applied operations policy',
    'Action evidence gate',
    'Action button execution map',
    'Payment sync',
    'Cash fee clearance',
    'First-pick expiry',
    'No-show evidence requirement',
    'Payout batch cycle',
    'Booking address radius contract',
    'BookingAddressSnapshot',
    'Policy pin source',
    '10km participation rule',
    'Marketplace radius',
    'Partner app message when wallet debt blocks final acceptance and service start',
    'Payment and refund',
    'Cash fee settlement path',
    'Service feedback',
    'Finance trace',
    'Chat transcript',
    'Location trail',
    'Booking alert trace',
    'Booking-address supply check',
    'Operational supply blockers',
    'Marketplace Partner supply for this booking',
    'Actual marketplace participant ledger',
    'Participation evidence',
    'Actual participant rows only',
    'Negative wallet blocks final acceptance and service start',
    'No view-only activity log',
    'Customer-selected final Partner only',
    'First-pick requirement',
    'Customer shortlist',
    'Customer eligibility matrix',
    'customer-selectable',
    'Customer-selectable reason',
    'Why not selectable',
    'retained final selected row',
    'First-pick Partner',
    'Booking-address radius',
    'Marketplace visibility is not retained as activity; wallet gates stop blocked Partners before a participant row is created.',
    'No-show alerts',
    'Attention checks',
    'Booking chronological activity',
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

console.log(`Admin web smoke passed for ${smokePages.length} page(s) at ${baseUrl}.`);

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
