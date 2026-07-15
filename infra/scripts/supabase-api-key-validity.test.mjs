import assert from 'node:assert/strict';
import test from 'node:test';

import { checkSupabaseApiKeyValidity } from './lib/supabase-api-key-validity.mjs';

test('accepts a key only when the Supabase Auth settings endpoint authorizes it', async () => {
  const result = await checkSupabaseApiKeyValidity(
    'https://projectref.supabase.co',
    'sb_publishable_example',
    { fetchImpl: async () => ({ status: 200 }) },
  );

  assert.deepEqual(result, { valid: true, status: 200, reason: 'valid' });
});

test('reports a stale or mismatched Supabase key without exposing it', async () => {
  const result = await checkSupabaseApiKeyValidity(
    'https://projectref.supabase.co',
    'sb_secret_stale',
    { fetchImpl: async () => ({ status: 401 }) },
  );

  assert.deepEqual(result, { valid: false, status: 401, reason: 'unauthorized' });
  assert.equal(JSON.stringify(result).includes('sb_secret_stale'), false);
});

test('fails closed for missing keys and unreachable endpoints', async () => {
  const missing = await checkSupabaseApiKeyValidity('https://projectref.supabase.co', '');
  const unreachable = await checkSupabaseApiKeyValidity(
    'https://projectref.supabase.co',
    'sb_publishable_example',
    {
      fetchImpl: async () => {
        throw new Error('offline');
      },
    },
  );

  assert.deepEqual(missing, { valid: false, status: null, reason: 'missing_key' });
  assert.deepEqual(unreachable, { valid: false, status: null, reason: 'unreachable' });
});
