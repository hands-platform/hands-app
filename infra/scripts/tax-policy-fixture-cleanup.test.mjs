import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./tax-policy-fixture-cleanup.mjs', import.meta.url), 'utf8');

test('tax policy fixture cleanup is dry-run only and protects active or referenced policies', () => {
  assert.match(source, /dry-run only/u);
  assert.match(source, /RETAIN_AND_MANUAL_REVIEW/u);
  assert.match(source, /MANUAL_DELETE_CANDIDATE/u);
  assert.doesNotMatch(source, /taxPolicyVersion\.(delete|deleteMany|update|updateMany)\(/u);
});

