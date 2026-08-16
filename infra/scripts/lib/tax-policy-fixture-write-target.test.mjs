import assert from 'node:assert/strict';
import test from 'node:test';

import { assertTaxPolicyFixtureWriteTarget } from './tax-policy-fixture-write-target.mjs';

test('Tax Policy smoke target guard fails closed for shared and partially isolated targets', () => {
  const allowlist = 'tax_policy_smoke_run1:tax_policy_smoke_run1';
  assert.throws(() => assertTaxPolicyFixtureWriteTarget(
    'postgresql://localhost/massage_vn?schema=public',
    allowlist,
  ), /non-disposable/u);
  assert.throws(() => assertTaxPolicyFixtureWriteTarget(
    'postgresql://localhost/tax_policy_smoke_run1?schema=public',
    allowlist,
  ), /non-disposable/u);
  assert.throws(() => assertTaxPolicyFixtureWriteTarget(
    'postgresql://localhost/tax_policy_smoke_run1?schema=tax_policy_smoke_run1',
    '',
  ), /not explicitly allowlisted/u);
});

test('Tax Policy smoke target guard accepts only the exact disposable allowlist entry', () => {
  assert.deepEqual(assertTaxPolicyFixtureWriteTarget(
    'postgresql://localhost/tax_policy_smoke_run1?schema=tax_policy_smoke_run1',
    'tax_policy_smoke_run1:tax_policy_smoke_run1',
  ), { database: 'tax_policy_smoke_run1', schema: 'tax_policy_smoke_run1' });
});
