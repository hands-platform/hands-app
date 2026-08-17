import { disposableIntegrationDatabaseTarget } from './disposable-integration-database';

describe('Disposable database integration first-write guard', () => {
  it.each([
    'postgresql://postgres:postgres@localhost:5432/massage_vn?schema=public',
    'postgresql://postgres:postgres@localhost:5432/massage_vn?schema=hands_integration_run1',
    'postgresql://postgres:postgres@localhost:5432/hands_integration_run1?schema=public',
  ])('rejects a shared or partially disposable target before a write: %s', (databaseUrl) => {
    expect(() =>
      disposableIntegrationDatabaseTarget(
        databaseUrl,
        'hands_integration_run1:hands_integration_run1',
      ),
    ).toThrow(/Refusing|require/u);
  });

  it('rejects missing and non-allowlisted targets', () => {
    expect(() => disposableIntegrationDatabaseTarget(undefined, undefined)).toThrow(/DATABASE_URL/u);
    expect(() =>
      disposableIntegrationDatabaseTarget(
        'postgresql://localhost/hands_integration_run1?schema=hands_integration_run1',
        '',
      ),
    ).toThrow(/not explicitly allowlisted/u);
  });

  it('permits only the exact disposable database and schema pair', () => {
    expect(
      disposableIntegrationDatabaseTarget(
        'postgresql://localhost/finance_approver_it_run1?schema=hands_integration_run1',
        'finance_approver_it_run1:hands_integration_run1',
      ),
    ).toMatchObject({
      database: 'finance_approver_it_run1',
      schema: 'hands_integration_run1',
    });
  });
});
