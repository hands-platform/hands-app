import {
  financeApproverIntegrationDatabaseTarget,
  quotedDisposableSchema,
} from './finance-approver-integration-db-guard';

describe('Finance approver integration database first-write guard', () => {
  it.each([
    'postgresql://postgres:postgres@localhost:5432/massage_vn?schema=public',
    'postgresql://postgres:postgres@localhost:5432/massage_vn?schema=finance_approver_it_run1',
    'postgresql://postgres:postgres@localhost:5432/finance_approver_it_run1?schema=public',
  ])('rejects a shared or partially disposable target before a write: %s', (databaseUrl) => {
    expect(() =>
      financeApproverIntegrationDatabaseTarget(
        databaseUrl,
        'finance_approver_it_run1:finance_approver_it_run1',
      ),
    ).toThrow(/Refusing|require/u);
  });

  it('rejects unknown and non-allowlisted targets', () => {
    expect(() => financeApproverIntegrationDatabaseTarget(undefined, undefined)).toThrow(/DATABASE_URL/u);
    expect(() =>
      financeApproverIntegrationDatabaseTarget(
        'postgresql://localhost/finance_approver_it_run1?schema=finance_approver_it_run1',
        '',
      ),
    ).toThrow(/not explicitly allowlisted/u);
  });

  it('permits only the exact disposable database and schema pair', () => {
    const target = financeApproverIntegrationDatabaseTarget(
      'postgresql://localhost/finance_approver_it_run1?schema=finance_approver_it_run1',
      'finance_approver_it_run1:finance_approver_it_run1',
    );

    expect(target).toMatchObject({
      database: 'finance_approver_it_run1',
      schema: 'finance_approver_it_run1',
    });
    expect(quotedDisposableSchema(target)).toBe('"finance_approver_it_run1"');
  });
});
