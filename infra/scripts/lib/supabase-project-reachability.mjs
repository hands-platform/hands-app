import { lookup as dnsLookup } from 'node:dns/promises';

import { normalizeSupabaseUrl } from './supabase-location-exposure.mjs';

export async function checkSupabaseProjectReachability(
  rawUrl,
  { lookup = dnsLookup, fetchImpl = fetch, timeoutMs = 5_000 } = {},
) {
  let projectUrl;
  try {
    projectUrl = normalizeSupabaseUrl(rawUrl);
  } catch {
    return unreachable('invalid_url');
  }

  const hostname = new URL(projectUrl).hostname;
  try {
    await lookup(hostname);
  } catch {
    return unreachable('dns_unresolved');
  }

  try {
    const response = await fetchImpl(`${projectUrl}/auth/v1/health`, {
      method: 'GET',
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return {
      dnsResolved: true,
      httpsReachable: response.status >= 200 && response.status < 500,
      reason: response.status >= 200 && response.status < 500 ? 'reachable' : 'upstream_error',
    };
  } catch {
    return {
      dnsResolved: true,
      httpsReachable: false,
      reason: 'https_unreachable',
    };
  }
}

function unreachable(reason) {
  return {
    dnsResolved: false,
    httpsReachable: false,
    reason,
  };
}
