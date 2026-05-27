const baseUrl = process.env.ADMIN_WEB_BASE_URL ?? 'http://localhost:3101';

const pages = [
  { path: '/', markers: ['HANDS Admin', 'Shift command briefing', 'Partner dispatch control', 'API source'] },
  { path: '/bookings', markers: ['Booking Monitor', 'Customer protection closeout board', 'Booking operation filters'] },
  { path: '/bookings?view=closeout', markers: ['Booking Monitor', 'Closeout ops'] },
  { path: '/bookings?view=expired', markers: ['Booking Monitor', 'Expired'] },
  { path: '/bookings?view=no-show', markers: ['Booking Monitor', 'No-show'] },
  { path: '/operations-policy', markers: ['Operations Policy', 'Live matching policy'] },
  { path: '/cash-settlements', markers: ['Cash Settlements', 'Settlement command queue'] },
  { path: '/earnings', markers: ['Partner Earnings', 'Money flow command center'] },
  { path: '/payments', markers: ['Payments', 'Payment operation filters'] },
  { path: '/refunds', markers: ['Refunds', 'Refund command board'] },
  { path: '/reviews', markers: ['Reviews And Reports', 'Review command board'] },
  { path: '/notifications', markers: ['Notifications', 'Delivery operations queue'] },
  { path: '/payouts', markers: ['Partner Payouts', 'Payout command queue'] },
  { path: '/partner-risk', markers: ['Partner Risk', 'Risk operation filters'] },
  { path: '/provider-risk', markers: ['Partner Risk', 'Risk operation filters'] },
  { path: '/app-sessions', markers: ['App Sessions', 'Latest app sessions'] },
  { path: '/providers', markers: ['Partner Verification', 'Review queue'] },
  { path: '/providers?review=cash-debt', markers: ['Partner Verification', 'Cash fee debt'] },
  { path: '/services', markers: ['Service catalog', 'Duration pricing matrix'] },
  { path: '/setup', markers: ['External setup', 'External registration handoff'] },
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
const providerLinkMatch = providersBody.match(/href="\/providers\/([^"]+)"/);
if (providerLinkMatch) {
  const providerPath = `/providers/${providerLinkMatch[1]}`;
  const providerBody = await fetchPage(providerPath);
  const providerMarkers = ['Partner ops command center', 'Booking acceptance decision'];
  const missing = providerMarkers.filter((marker) => !providerBody.includes(marker));
  if (missing.length > 0) {
    throw new Error(`${providerPath} is missing expected markers: ${missing.join(', ')}`);
  }
  console.log(`PASS ${providerPath}`);
}

console.log(`Admin web smoke passed for ${pages.length} page(s) at ${baseUrl}.`);
