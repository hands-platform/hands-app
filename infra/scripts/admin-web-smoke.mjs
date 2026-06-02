const baseUrl = process.env.ADMIN_WEB_BASE_URL ?? 'http://localhost:3101';
const requestedSmokeArgs = process.argv
  .slice(2)
  .flatMap((value) => value.split(','))
  .map((path) => path.trim())
  .filter(Boolean);

const pages = [
  {
    path: '/',
    markers: [
      'HANDS Admin',
      'Operations Command Center',
      'Live Operations',
      'Booking Operations',
      'People Operations',
      'Money Operations',
      'Policy and Setup',
      'Evidence and Audit',
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
      'No-show signal',
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
      'Partner dispatch control',
      'Final-gate unblock quick order',
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
      'Acceptance Blocked',
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
      'Finance final-gate route',
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
      'Matching escalation board',
      'Matching flow timeline',
      'Marketplace participation',
      'Dispatch partner repair shortcuts',
      'Customer protection closeout board',
      'Booking operation filters',
      'Evidence filter',
      'Booking / stage',
      'Address / customer',
      'Payment / wallet',
      'Action status strip',
      'Stage 3 choice',
    ],
  },
  {
    path: '/bookings?view=matching',
    markers: [
      'Booking Monitor',
      'Matching ops',
      'Matching flow timeline',
      'Dispatch partner repair shortcuts',
    ],
  },
  { path: '/bookings?view=attention', markers: ['Booking Monitor', 'Follow-up queue'] },
  { path: '/bookings?view=first-pick', markers: ['Booking Monitor', 'Stage 1 first-pick'] },
  { path: '/bookings?view=marketplace', markers: ['Booking Monitor', 'Stage 2 marketplace'] },
  { path: '/bookings?view=customer-choice', markers: ['Booking Monitor', 'Stage 3 choice'] },
  { path: '/bookings?view=handoff-repair', markers: ['Booking Monitor', 'Stage 4 repair'] },
  { path: '/bookings?view=no-supply', markers: ['Booking Monitor', 'No supply'] },
  { path: '/bookings?view=address', markers: ['Booking Monitor', 'Address check'] },
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
      'Joined',
      'Recent access',
      'Last work',
      'Bookings',
      'Completed',
      'wallet view',
      'Frequent service / area',
      'Repeated partner',
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
    path: '/operations-policy',
    markers: [
      'Operations Policy',
      'Final partner choice control matrix',
      'Current partner acceptance impact',
      'Policy sensitivity preview',
      'Matching stage impact preview',
      'Owner decision backlog',
      'Current decision pressure',
      'Before saving this policy',
      'First-pick queue',
      'Live matching policy',
      'id="matching-stage-impact"',
      'id="policy-matching-provider-response-window-minutes"',
      'id="policy-matching-marketplace-provider-radius-meters"',
      'id="policy-wallet-negative-balance-gate"',
      'Change reason',
    ],
  },
  {
    path: '/operations-handoff',
    markers: [
      'Operations Handoff',
      'Handoff date range',
      'Immediate action queue',
      'Unified activity stream',
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
    markers: ['Cash Settlements', 'Cash settlement date range', 'Settlement command queue'],
  },
  {
    path: '/cash-settlements?range=7d',
    markers: ['Cash Settlements', 'Cash settlement date range', 'Last 7 days', 'Settlement command queue'],
  },
  {
    path: '/finance-closeout',
    markers: [
      'Finance Closeout',
      'Finance date range',
      'Closeout reconciliation board',
      'Payment-to-earning checks',
      'Cash debt handoff',
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
  { path: '/earnings', markers: ['Partner Earnings', 'Earnings date range', 'Money flow command center'] },
  {
    path: '/earnings?range=7d',
    markers: ['Partner Earnings', 'Earnings date range', 'Last 7 days', 'Money flow command center'],
  },
  { path: '/payments', markers: ['Payments', 'Payment operation filters', 'Payment date range'] },
  {
    path: '/payments?range=7d',
    markers: ['Payments', 'Payment operation filters', 'Payment date range', 'Last 7 days'],
  },
  { path: '/refunds', markers: ['Refunds', 'Refund command board'] },
  {
    path: '/refunds?range=7d',
    markers: ['Refunds', 'Refund operation filters', 'Refund date range', 'Last 7 days'],
  },
  { path: '/reviews', markers: ['Feedback And Reports', 'Feedback command board', 'Service follow-up'] },
  { path: '/notifications', markers: ['Notifications', 'Delivery operations queue', 'No-show alerts'] },
  {
    path: '/notifications?review=failed',
    markers: ['Notifications', 'Failed sends', 'Delivery operations queue'],
  },
  { path: '/notifications?review=no-show', markers: ['Notifications', 'No-show'] },
  { path: '/payouts', markers: ['Partner Payouts', 'Payout date range', 'Payout command queue'] },
  {
    path: '/payouts?range=7d',
    markers: ['Partner Payouts', 'Payout date range', 'Last 7 days', 'Payout command queue'],
  },
  {
    path: '/partner-controls',
    markers: [
      'Partner Controls',
      'Partner control board',
      'Final-gate unblock board',
      'Final-gate unblock playbook',
      'Partner control command center',
      'System control checklist',
    ],
  },
  {
    path: '/partner-risk',
    markers: ['Partner Controls', 'Partner control board', 'Final-gate unblock board'],
  },
  {
    path: '/provider-risk',
    markers: [
      'Partner Controls',
      'Partner control board',
      'Final-gate unblock board',
      'Final-gate unblock playbook',
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
  {
    path: '/audit-log?bucket=Finance%2FCloseout&range=7d',
    markers: ['Audit Log', 'Finance closeout trail', 'Last 7 days'],
  },
  {
    path: '/partners',
    markers: [
      'Partners',
      'Partner operations list',
      'Partner master list',
      'Compact admin list',
      'Partner ID',
      'Profile',
      'Name / activity name',
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
      'Partner checklist work queue',
      'List-first partner control view',
      'completed work',
      'last work',
      'Dispatch handoff links',
      'Dispatch capacity forecast',
      'Partner final-gate hold board',
      'KYC review board',
      'Marketplace participation eligibility',
      'Review queue',
    ],
  },
  { path: '/partners?review=kyc', markers: ['Partners', 'KYC review board', 'KYC updates'] },
  { path: '/partners?review=cash-debt', markers: ['Partners', 'Cash fee debt'] },
  {
    path: '/partners?review=acceptance-blocked',
    markers: ['Partners', 'Final gate held'],
  },
  { path: '/partners?review=direct-ready', markers: ['Partners', 'Direct request ready'] },
  { path: '/partners?review=marketplace-ready', markers: ['Partners', 'Marketplace ready'] },
  { path: '/partners?review=marketplace-blocked', markers: ['Partners', 'Marketplace blocked'] },
  { path: '/partners?review=reports', markers: ['Partners', 'Reports/controls'] },
  { path: '/partners?sort=last-work', markers: ['Partners', 'Sort: last completed work'] },
  { path: '/partners?sort=booking-count', markers: ['Partners', 'Sort: booking count'] },
  { path: '/partners?sort=gross-revenue', markers: ['Partners', 'Sort: gross revenue'] },
  { path: '/partners?sort=pending-payout', markers: ['Partners', 'Sort: pending payout'] },
  { path: '/partners?sort=available-payout', markers: ['Partners', 'Sort: available payout'] },
  {
    path: '/providers',
    markers: [
      'Partners',
      'Partner operations list',
      'Partner master list',
      'Name / activity name',
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
      'Partner checklist work queue',
      'Dispatch handoff links',
      'Dispatch capacity forecast',
      'Partner final-gate hold board',
      'KYC review board',
      'Marketplace participation eligibility',
      'Review queue',
    ],
  },
  { path: '/providers', markers: ['Partners', 'Partner operations list', 'Partner master list'] },
  { path: '/providers?review=cash-debt', markers: ['Partners', 'Cash fee debt'] },
  {
    path: '/services',
    markers: [
      'Service catalog',
      'Duration pricing matrix',
      'Customer booking exposure guard',
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
      'Runtime operations policy',
    ],
  },
  { path: '/tax-policy', markers: ['Tax policy', 'Policy checklist'] },
];

const requestedSmokePaths = ((process.env.ADMIN_WEB_SMOKE_PATHS ?? '') || requestedSmokeArgs.join(','))
  .split(',')
  .map((path) => path.trim())
  .filter(Boolean);
const smokePages =
  requestedSmokePaths.length > 0 ? pages.filter((page) => requestedSmokePaths.includes(page.path)) : pages;

if (requestedSmokePaths.length > 0 && smokePages.length === 0) {
  throw new Error(`No admin smoke pages matched ADMIN_WEB_SMOKE_PATHS=${requestedSmokePaths.join(',')}`);
}

async function fetchPage(path, redirectDepth = 0, attempt = 0) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
  } catch (error) {
    if (attempt < 6) {
      await delay(1_000 * (attempt + 1));
      return fetchPage(path, redirectDepth, attempt + 1);
    }
    throw error;
  }
  const body = await response.text();
  if ([307, 308].includes(response.status) && redirectDepth < 3) {
    const location = response.headers.get('location');
    if (location?.startsWith('/')) {
      return fetchPage(location, redirectDepth + 1);
    }
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

function assertNoLegacyVisibleLanguage(path, body) {
  const visibleText = visibleTextFromHtml(body);
  const bannedPatterns = [
    { label: 'legacy Provider wording', pattern: /\bProvider\b|\bPROVIDER\(S\)\b/ },
    { label: 'legacy backup wording', pattern: /\b[Bb]ackup\b/ },
    { label: 'legacy low-rating wording', pattern: /\bLow[- ]rating\b/i },
    {
      label: 'people scoring wording',
      pattern: /\b(score|scoring|ranking|ranked|VIP|tip|tips|penalty|penalties)\b/i,
    },
    { label: 'partner average feedback wording', pattern: /\bFeedback value\b/i },
    { label: 'person-rating wording', pattern: /\b(stars? or below|star \/)\b/i },
    { label: 'separate partner activity page wording', pattern: /\bPartner Activity\b/i },
    { label: 'operator risk scoring wording', pattern: /\b(risk score|risk rating|risk level)\b/i },
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
    const providerMarkers = [
      'Partner operator command queue',
      'Partner recent operations timeline',
      'Partner connected operations records',
      'Partner booking evidence bundles',
      'Partner operator notes',
      'Partner ops command center',
      'Partner master facts',
      'Partner full record index',
      'Partner operating ledger',
      'Partner operating checklist',
      'Factual work-control checklist',
      'Booking and chat records',
      'All partner chats',
      'Recent app and operations activity',
      'Partner daily activity digest',
      'Final booking gate decision',
      'Final-gate repair command',
      'Partner app block message',
      'Partner final-gate unblock playbook',
      'id="payout"',
      'id="kyc"',
      'id="service-pricing"',
      'id="bank"',
      'id="tax"',
      'id="location"',
    ];
    const missing = providerMarkers.filter((marker) => !providerBody.includes(marker));
    if (missing.length > 0) {
      throw new Error(`${providerPath} is missing expected markers: ${missing.join(', ')}`);
    }
    assertNoLegacyVisibleLanguage(providerPath, providerBody);
    console.log(`PASS ${providerPath}`);

    const filteredProviderBody = await fetchPage(`${providerPath}?range=30d`);
    const filteredProviderMarkers = ['Record date filter', 'Filtered booking archive', 'Filtered activity'];
    const missingFilteredProviderMarkers = filteredProviderMarkers.filter(
      (marker) => !filteredProviderBody.includes(marker),
    );
    if (missingFilteredProviderMarkers.length > 0) {
      throw new Error(
        `${providerPath}?range=30d is missing expected markers: ${missingFilteredProviderMarkers.join(', ')}`,
      );
    }
    assertNoLegacyVisibleLanguage(`${providerPath}?range=30d`, filteredProviderBody);
    console.log(`PASS ${providerPath}?range=30d`);
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
    'Customer operating ledger',
    'Customer activity action panel',
    'Customer information',
    'Customer account facts',
    'Customer wallet',
    'Saved addresses',
    'Booking and cancellation history',
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
    'Operator command queue',
    'Operator action availability',
    'Booking recent operations timeline',
    'Evidence packet for admin decision',
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
    'All partner chats',
    'Service pricing snapshot',
    'Open customer record',
    'Preferred, final, and marketplace shortlist.',
    'Booking stage snapshot',
    'Applied operations policy',
    'Booking address radius contract',
    'Policy pin source',
    '10km participation rule',
    'Marketplace radius',
    'Payment and refund',
    'Service feedback',
    'Finance trace',
    'Chat transcript',
    'Location trail',
    'Booking alert trace',
    'Dispatch candidate decision matrix',
    'Excluded partner groups',
    'Marketplace partner supply for this booking',
    'No-show alerts',
    'Attention checks',
    'Booking chronological activity',
  ];
  const missing = bookingMarkers.filter((marker) => !bookingBody.includes(marker));
  if (missing.length > 0) {
    throw new Error(`${bookingPath} is missing expected markers: ${missing.join(', ')}`);
  }
  assertNoLegacyVisibleLanguage(bookingPath, bookingBody);
  console.log(`PASS ${bookingPath}`);
}

console.log(`Admin web smoke passed for ${smokePages.length} page(s) at ${baseUrl}.`);
