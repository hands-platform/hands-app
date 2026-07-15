import assert from 'node:assert/strict';
import test from 'node:test';

import { checkSupabaseProjectReachability } from './lib/supabase-project-reachability.mjs';

test('reports a resolvable Supabase project with a responsive HTTPS endpoint', async () => {
  const result = await checkSupabaseProjectReachability('https://projectref.supabase.co', {
    lookup: async () => ({ address: '127.0.0.1' }),
    fetchImpl: async () => ({ status: 200 }),
  });

  assert.deepEqual(result, {
    dnsResolved: true,
    httpsReachable: true,
    reason: 'reachable',
  });
});

test('distinguishes DNS failure from HTTPS failure', async () => {
  const dnsFailure = await checkSupabaseProjectReachability('https://missing.supabase.co', {
    lookup: async () => {
      throw new Error('not found');
    },
  });
  assert.deepEqual(dnsFailure, {
    dnsResolved: false,
    httpsReachable: false,
    reason: 'dns_unresolved',
  });

  const httpsFailure = await checkSupabaseProjectReachability('https://projectref.supabase.co', {
    lookup: async () => ({ address: '127.0.0.1' }),
    fetchImpl: async () => {
      throw new Error('connection failed');
    },
  });
  assert.deepEqual(httpsFailure, {
    dnsResolved: true,
    httpsReachable: false,
    reason: 'https_unreachable',
  });
});

test('rejects an invalid project URL before network access', async () => {
  const result = await checkSupabaseProjectReachability('http://projectref.supabase.co');
  assert.equal(result.reason, 'invalid_url');
  assert.equal(result.dnsResolved, false);
});
