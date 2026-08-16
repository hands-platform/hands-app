const disposableDatabasePattern = /^(?:tax[_-]policy[_-](?:it|integration|smoke)|massage[_-]vn[_-]tax[_-]policy[_-](?:it|integration|smoke))_[a-z0-9_-]+$/u;
const disposableSchemaPattern = /^tax_policy_(?:it|integration|smoke)_[a-z0-9_]+$/u;

export function assertTaxPolicyFixtureWriteTarget(databaseUrl, allowlistValue) {
  if (!databaseUrl) {
    throw new Error('Fixture Tax Policy writes require an explicit isolated DATABASE_URL.');
  }
  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('Fixture Tax Policy writes received an invalid DATABASE_URL.');
  }
  const database = decodeURIComponent(url.pathname.replace(/^\/+|\/+$/gu, ''));
  const schema = url.searchParams.get('schema')?.trim() ?? '';
  if (!disposableDatabasePattern.test(database) || !disposableSchemaPattern.test(schema)) {
    throw new Error(`Refusing fixture Tax Policy writes to non-disposable target ${database}:${schema}.`);
  }
  const exactTarget = `${database}:${schema}`;
  const allowlist = new Set(String(allowlistValue ?? '').split(',').map((value) => value.trim()).filter(Boolean));
  if (!allowlist.has(exactTarget)) {
    throw new Error(`Fixture Tax Policy target ${exactTarget} is not explicitly allowlisted.`);
  }
  return { database, schema };
}
