const BLOCKED_STATUSES = new Set([401, 403, 404]);

export function assessSupabaseLocationExposure(status) {
  if (status >= 200 && status < 300) {
    return {
      blocked: false,
      reason: 'anonymous request was accepted',
    };
  }

  if (BLOCKED_STATUSES.has(status)) {
    return {
      blocked: true,
      reason: 'anonymous request was denied',
    };
  }

  return {
    blocked: false,
    reason: 'endpoint result was inconclusive',
  };
}

export function normalizeSupabaseUrl(value) {
  const normalized = String(value ?? '').trim().replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('SUPABASE_URL is required.');
  }

  const url = new URL(normalized);
  if (url.protocol !== 'https:') {
    throw new Error('SUPABASE_URL must use https.');
  }

  return url.toString().replace(/\/$/, '');
}

export function buildSupabaseAnonymousHeaders(apiKey) {
  const normalized = String(apiKey ?? '').trim();
  if (!normalized) {
    throw new Error('SUPABASE_ANON_KEY is required.');
  }

  const headers = { apikey: normalized };
  if (normalized.split('.').length === 3) {
    headers.authorization = `Bearer ${normalized}`;
  }
  return headers;
}
