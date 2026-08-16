import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./referral-fixture-inventory.mjs', import.meta.url), 'utf8');

test('referral fixture inventory is read-only and protects ledger-bearing rewards', () => {
  assert.match(source, /dry-run only/u);
  assert.match(source, /RETAIN_LEDGER_BEARING_FIXTURE/u);
  assert.match(source, /REVIEW_EXACT_DELETE_CANDIDATE/u);
  assert.match(source, /safeRestorePossible: false/u);
  assert.doesNotMatch(source, /\.(delete|deleteMany|update|updateMany|upsert)\(/u);
});
