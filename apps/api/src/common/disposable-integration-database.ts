export type DisposableIntegrationDatabaseTarget = {
  database: string;
  databaseUrl: string;
  schema: string;
};

const DISPOSABLE_DATABASE_PATTERN =
  /^(?:(?:hands|finance[_-]approver)[_-](?:it|integration))_[a-z0-9_-]+$/u;
const DISPOSABLE_SCHEMA_PATTERN = /^hands_(?:it|integration)_[a-z0-9_]+$/u;

export function disposableIntegrationDatabaseTarget(
  databaseUrl: string | undefined,
  allowlistValue: string | undefined,
): DisposableIntegrationDatabaseTarget {
  if (!databaseUrl) {
    throw new Error('Database integration tests require an explicit DATABASE_URL');
  }

  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('Database integration tests received an invalid DATABASE_URL');
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/gu, ''));
  const schema = url.searchParams.get('schema')?.trim() ?? '';
  if (!database || !schema) {
    throw new Error('Database integration tests require exact database and schema names');
  }
  if (!DISPOSABLE_DATABASE_PATTERN.test(database) || !DISPOSABLE_SCHEMA_PATTERN.test(schema)) {
    throw new Error(`Refusing integration writes to non-disposable target ${database}:${schema}`);
  }

  const exactTarget = `${database}:${schema}`;
  const allowlist = new Set(
    String(allowlistValue ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
  );
  if (!allowlist.has(exactTarget)) {
    throw new Error(`Integration target ${exactTarget} is not explicitly allowlisted`);
  }

  return { database, databaseUrl, schema };
}
