export type FinanceApproverIntegrationDatabaseTarget = {
  database: string;
  databaseUrl: string;
  schema: string;
};

const DISPOSABLE_DATABASE_PATTERN = /^(?:finance[_-]approver[_-](?:it|integration)|massage[_-]vn[_-]finance[_-]approver[_-](?:it|integration))_[a-z0-9_-]+$/u;
const DISPOSABLE_SCHEMA_PATTERN = /^finance_approver_(?:it|integration)_[a-z0-9_]+$/u;

export function financeApproverIntegrationDatabaseTarget(
  databaseUrl: string | undefined,
  allowlistValue: string | undefined,
): FinanceApproverIntegrationDatabaseTarget {
  if (!databaseUrl) {
    throw new Error('Finance approver integration tests require an explicit DATABASE_URL');
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('Finance approver integration tests received an invalid DATABASE_URL');
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/gu, ''));
  const schema = url.searchParams.get('schema')?.trim() ?? '';
  if (!database || !schema) {
    throw new Error('Finance approver integration tests require exact database and schema names');
  }
  if (!DISPOSABLE_DATABASE_PATTERN.test(database) || !DISPOSABLE_SCHEMA_PATTERN.test(schema)) {
    throw new Error(
      `Refusing Finance approver integration writes to non-disposable target ${database}:${schema}`,
    );
  }

  const allowlist = new Set(
    String(allowlistValue ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const exactTarget = `${database}:${schema}`;
  if (!allowlist.has(exactTarget)) {
    throw new Error(`Finance approver integration target ${exactTarget} is not explicitly allowlisted`);
  }

  return { database, databaseUrl, schema };
}

export function quotedDisposableSchema(target: FinanceApproverIntegrationDatabaseTarget) {
  if (!DISPOSABLE_SCHEMA_PATTERN.test(target.schema)) {
    throw new Error('Refusing to quote a non-disposable Finance approver integration schema');
  }
  return `"${target.schema}"`;
}
