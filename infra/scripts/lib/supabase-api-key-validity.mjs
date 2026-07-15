import { normalizeSupabaseUrl } from './supabase-location-exposure.mjs';

export async function checkSupabaseApiKeyValidity(
  rawUrl,
  apiKey,
  { fetchImpl = fetch, timeoutMs = 5_000 } = {},
) {
  let projectUrl;
  try {
    projectUrl = normalizeSupabaseUrl(rawUrl);
  } catch {
    return invalid('invalid_url');
  }

  if (typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return invalid('missing_key');
  }

  try {
    const response = await fetchImpl(`${projectUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: { apikey: apiKey.trim() },
      redirect: 'error',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const valid = response.status >= 200 && response.status < 300;
    return {
      valid,
      status: response.status,
      reason: valid ? 'valid' : response.status === 401 ? 'unauthorized' : 'upstream_error',
    };
  } catch {
    return invalid('unreachable');
  }
}

function invalid(reason) {
  return {
    valid: false,
    status: null,
    reason,
  };
}
