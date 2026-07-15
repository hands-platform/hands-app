import { loadMergedEnv } from './lib/env-file.mjs';
import {
  assessSupabaseLocationExposure,
  buildSupabaseAnonymousHeaders,
  normalizeSupabaseUrl,
} from './lib/supabase-location-exposure.mjs';

const envFile = process.argv.find((arg) => arg.startsWith('--env='))?.slice('--env='.length) ?? '.env';
const { env } = loadMergedEnv(envFile);
const supabaseUrl = normalizeSupabaseUrl(env.SUPABASE_URL);
const anonKey = String(env.SUPABASE_ANON_KEY ?? '').trim();

if (!anonKey) {
  throw new Error('SUPABASE_ANON_KEY is required.');
}

const headers = buildSupabaseAnonymousHeaders(anonKey);
const checks = [
  {
    label: 'provider location table',
    request: () =>
      fetch(`${supabaseUrl}/rest/v1/provider_locations?select=provider_id&limit=1`, {
        headers,
        signal: AbortSignal.timeout(10_000),
      }),
  },
  {
    label: 'nearby provider RPC',
    request: () =>
      fetch(`${supabaseUrl}/rest/v1/rpc/nearby_providers`, {
        method: 'POST',
        headers: {
          ...headers,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          input_lat: 21.0285,
          input_lng: 105.8542,
          radius_meters: 1_000,
        }),
        signal: AbortSignal.timeout(10_000),
      }),
  },
];

const results = [];
for (const check of checks) {
  try {
    const response = await check.request();
    const assessment = assessSupabaseLocationExposure(response.status);
    results.push({
      endpoint: check.label,
      status: response.status,
      blocked: assessment.blocked,
    });
  } catch {
    results.push({
      endpoint: check.label,
      status: null,
      blocked: false,
      error: 'network_error',
    });
  }
}

const failed = results.filter((result) => !result.blocked);
console.log(JSON.stringify({ ok: failed.length === 0, checks: results }, null, 2));

if (failed.length > 0) {
  console.error(
    `Supabase anonymous location exposure check failed: ${failed.map((item) => item.endpoint).join(', ')}`,
  );
  process.exitCode = 1;
}
