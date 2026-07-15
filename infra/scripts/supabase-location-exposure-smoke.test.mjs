import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assessSupabaseLocationExposure,
  buildSupabaseAnonymousHeaders,
  normalizeSupabaseUrl,
} from './lib/supabase-location-exposure.mjs';

test('accepts only explicit anonymous access denial as blocked', () => {
  for (const status of [401, 403, 404]) {
    assert.equal(assessSupabaseLocationExposure(status).blocked, true);
  }
});

test('treats successful and inconclusive responses as failures', () => {
  for (const status of [200, 204, 400, 429, 500, 503]) {
    assert.equal(assessSupabaseLocationExposure(status).blocked, false);
  }
});

test('normalizes a secure Supabase URL without exposing credentials', () => {
  assert.equal(normalizeSupabaseUrl('https://project.supabase.co/'), 'https://project.supabase.co');
  assert.throws(() => normalizeSupabaseUrl('http://project.supabase.co'), /must use https/);
  assert.throws(() => normalizeSupabaseUrl(''), /required/);
});

test('does not misuse modern publishable keys as bearer JWTs', () => {
  assert.deepEqual(buildSupabaseAnonymousHeaders('sb_publishable_example'), {
    apikey: 'sb_publishable_example',
  });
  assert.deepEqual(buildSupabaseAnonymousHeaders('header.payload.signature'), {
    apikey: 'header.payload.signature',
    authorization: 'Bearer header.payload.signature',
  });
  assert.throws(() => buildSupabaseAnonymousHeaders(''), /required/);
});
