import { assertTaxPolicyFixtureWriteEnvironment } from './tax-policy-fixture-write-guard';

describe('Tax Policy fixture first-write guard', () => {
  it.each([
    'postgresql://localhost/massage_vn?schema=public',
    'postgresql://localhost/massage_vn?schema=tax_policy_smoke_run1',
    'postgresql://localhost/tax_policy_smoke_run1?schema=public',
  ])('rejects shared and partially disposable targets: %s', (databaseUrl) => {
    expect(() => assertTaxPolicyFixtureWriteEnvironment(
      databaseUrl,
      'tax_policy_smoke_run1:tax_policy_smoke_run1',
    )).toThrow(/Refusing/u);
  });

  it('rejects unknown and non-allowlisted targets', () => {
    expect(() => assertTaxPolicyFixtureWriteEnvironment(undefined, undefined)).toThrow(/DATABASE_URL/u);
    expect(() => assertTaxPolicyFixtureWriteEnvironment(
      'postgresql://localhost/tax_policy_smoke_run1?schema=tax_policy_smoke_run1',
      '',
    )).toThrow(/not explicitly allowlisted/u);
  });

  it('permits an exact disposable and allowlisted target', () => {
    expect(assertTaxPolicyFixtureWriteEnvironment(
      'postgresql://localhost/tax_policy_smoke_run1?schema=tax_policy_smoke_run1',
      'tax_policy_smoke_run1:tax_policy_smoke_run1',
    )).toEqual({ database: 'tax_policy_smoke_run1', schema: 'tax_policy_smoke_run1' });
  });
});
