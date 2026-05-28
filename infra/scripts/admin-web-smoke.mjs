const baseUrl = process.env.ADMIN_WEB_BASE_URL ?? 'http://localhost:3101';

const pages = [
  {
    path: '/',
    markers: [
      'HANDS Admin',
      'Shift command briefing',
      'Opening shift checklist',
      'Total bookings',
      'Open matching',
      'Completed bookings',
      'Cancelled bookings',
      'No-show signal',
      'Hourly booking demand',
      'Regional booking demand',
      'Customers in app',
      'Partners in app',
      'Partner dispatch control',
      'Matching ops',
      'API source',
    ],
  },
  {
    path: '/bookings',
    markers: [
      'Booking Monitor',
      'Matching escalation board',
      'Dispatch partner repair shortcuts',
      'Customer protection closeout board',
      'Booking operation filters',
    ],
  },
  { path: '/bookings?view=matching', markers: ['Booking Monitor', 'Matching ops', 'Dispatch partner repair shortcuts'] },
  { path: '/bookings?view=closeout', markers: ['Booking Monitor', 'Closeout ops'] },
  { path: '/bookings?view=expired', markers: ['Booking Monitor', 'Expired'] },
  { path: '/bookings?view=no-show', markers: ['Booking Monitor', 'No-show'] },
  {
    path: '/operations-policy',
    markers: [
      'Operations Policy',
      'Booking acceptance control matrix',
      'Current partner acceptance impact',
      'Policy sensitivity preview',
      'Live matching policy',
      'Change reason',
    ],
  },
  { path: '/cash-settlements', markers: ['Cash Settlements', 'Settlement command queue'] },
  { path: '/coupons', markers: ['Coupons', 'Campaign command board'] },
  { path: '/earnings', markers: ['Partner Earnings', 'Money flow command center'] },
  { path: '/payments', markers: ['Payments', 'Payment operation filters'] },
  { path: '/refunds', markers: ['Refunds', 'Refund command board'] },
  { path: '/reviews', markers: ['Reviews And Reports', 'Review command board'] },
  { path: '/notifications', markers: ['Notifications', 'Delivery operations queue', 'No-show alerts'] },
  { path: '/notifications?review=no-show', markers: ['Notifications', 'No-show'] },
  { path: '/payouts', markers: ['Partner Payouts', 'Payout command queue'] },
  {
    path: '/partner-risk',
    markers: ['Partner Risk', 'Partner risk scorecard', 'Booking acceptance unblock board', 'Risk operation filters'],
  },
  {
    path: '/provider-risk',
    markers: ['Partner Risk', 'Partner risk scorecard', 'Booking acceptance unblock board', 'Risk operation filters'],
  },
  {
    path: '/app-sessions',
    markers: ['App Sessions', 'Session scope', 'Session command board', 'Latest app sessions'],
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
  {
    path: '/partners',
    markers: [
      'Partner Verification',
      'Dispatch handoff links',
      'Dispatch capacity forecast',
      'Partner acceptance blocker board',
      'KYC review board',
      'Backup matching eligibility',
      'Review queue',
    ],
  },
  { path: '/partners?review=kyc', markers: ['Partner Verification', 'KYC review board', 'KYC updates'] },
  { path: '/partners?review=cash-debt', markers: ['Partner Verification', 'Cash fee debt'] },
  {
    path: '/partners?review=acceptance-blocked',
    markers: ['Partner Verification', 'Booking acceptance blocked'],
  },
  { path: '/partners?review=direct-ready', markers: ['Partner Verification', 'Direct request ready'] },
  { path: '/partners?review=backup-ready', markers: ['Partner Verification', '10km backup ready'] },
  { path: '/partners?review=backup-blocked', markers: ['Partner Verification', '10km backup blocked'] },
  {
    path: '/providers',
    markers: [
      'Partner Verification',
      'Dispatch handoff links',
      'Dispatch capacity forecast',
      'Partner acceptance blocker board',
      'KYC review board',
      'Backup matching eligibility',
      'Review queue',
    ],
  },
  { path: '/providers?review=cash-debt', markers: ['Partner Verification', 'Cash fee debt'] },
  { path: '/services', markers: ['Service catalog', 'Duration pricing matrix'] },
  {
    path: '/setup',
    markers: ['External setup', 'External registration handoff', 'Current blockers', 'Runtime operations policy'],
  },
  { path: '/tax-policy', markers: ['Tax policy', 'Policy health'] },
];

async function fetchPage(path, redirectDepth = 0) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
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

for (const page of pages) {
  const body = await fetchPage(page.path);
  const missing = page.markers.filter((marker) => !body.includes(marker));
  if (missing.length > 0) {
    throw new Error(`${page.path} is missing expected markers: ${missing.join(', ')}`);
  }
  console.log(`PASS ${page.path}`);
}

const providersBody = await fetchPage('/providers');
const providerLinkMatch = providersBody.match(/href="\/(?:partners|providers)\/([^"]+)"/);
if (providerLinkMatch) {
  const providerDetailPaths = [`/partners/${providerLinkMatch[1]}`, `/providers/${providerLinkMatch[1]}`];
  for (const providerPath of providerDetailPaths) {
    const providerBody = await fetchPage(providerPath);
    const providerMarkers = ['Partner ops command center', 'Booking acceptance decision'];
    const missing = providerMarkers.filter((marker) => !providerBody.includes(marker));
    if (missing.length > 0) {
      throw new Error(`${providerPath} is missing expected markers: ${missing.join(', ')}`);
    }
    console.log(`PASS ${providerPath}`);
  }
}

const bookingsBody = await fetchPage('/bookings');
const bookingLinkMatch = bookingsBody.match(/href="\/bookings\/([^"]+)"/);
if (bookingLinkMatch) {
  const bookingPath = `/bookings/${bookingLinkMatch[1]}`;
  const bookingBody = await fetchPage(bookingPath);
  const bookingMarkers = ['Applied operations policy', 'Backup partner supply for this booking'];
  const missing = bookingMarkers.filter((marker) => !bookingBody.includes(marker));
  if (missing.length > 0) {
    throw new Error(`${bookingPath} is missing expected markers: ${missing.join(', ')}`);
  }
  console.log(`PASS ${bookingPath}`);
}

console.log(`Admin web smoke passed for ${pages.length} page(s) at ${baseUrl}.`);
