const baseUrl = process.env.ADMIN_WEB_BASE_URL ?? 'http://localhost:3101';

const pages = [
  { path: '/', markers: ['HANDS Admin', 'API source'] },
  { path: '/bookings', markers: ['Booking Monitor', 'Booking operation filters'] },
  { path: '/cash-settlements', markers: ['Cash Settlements', 'Settlement command queue'] },
  { path: '/earnings', markers: ['Provider Earnings', 'Money flow command center'] },
  { path: '/payments', markers: ['Payments', 'Payment operation filters'] },
  { path: '/payouts', markers: ['Provider Payouts', 'Payout command queue'] },
  { path: '/provider-risk', markers: ['Partner Risk', 'Risk operation filters'] },
  { path: '/providers', markers: ['Partner Verification', 'Review queue'] },
  { path: '/services', markers: ['Service catalog', 'Duration pricing matrix'] },
  { path: '/setup', markers: ['External setup', 'External registration handoff'] },
  { path: '/tax-policy', markers: ['Tax policy', 'Policy health'] },
];

async function fetchPage(path) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: 'manual' });
  const body = await response.text();
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

console.log(`Admin web smoke passed for ${pages.length} page(s) at ${baseUrl}.`);
