import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';

import { inspectPrismaMigrations } from './check-prisma-migrations.mjs';

function withMigrationRoot(run) {
  const root = mkdtempSync(resolve(tmpdir(), 'hands-prisma-migrations-'));
  try {
    run(root);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
}

function writeMigration(root, name, sql) {
  const directory = resolve(root, name);
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, 'migration.sql'), sql);
}

test('accepts ordered PostgreSQL migration directories with executable SQL', () => {
  withMigrationRoot((root) => {
    writeFileSync(resolve(root, 'migration_lock.toml'), 'provider = "postgresql"\n');
    writeMigration(root, '20260728090000_add_example', 'CREATE TABLE "Example" ("id" TEXT PRIMARY KEY);\n');

    const result = inspectPrismaMigrations(root);

    assert.equal(result.ok, true);
    assert.equal(result.migrationCount, 1);
    assert.deepEqual(result.violations, []);
  });
});

test('rejects malformed, missing, empty, and duplicate migration SQL', () => {
  withMigrationRoot((root) => {
    writeFileSync(resolve(root, 'migration_lock.toml'), 'provider = "sqlite"\n');
    writeMigration(root, 'bad-name', '-- comments only\n');
    writeMigration(root, '20260728091000_first_copy', 'ALTER TABLE "Example" ADD COLUMN "name" TEXT;\n');
    writeMigration(root, '20260728092000_second_copy', 'ALTER  TABLE "Example"\nADD COLUMN "name" TEXT;\n');
    mkdirSync(resolve(root, '20260728093000_missing_sql'));

    const result = inspectPrismaMigrations(root);

    assert.equal(result.ok, false);
    assert.ok(result.violations.some((violation) => violation.includes('provider = "postgresql"')));
    assert.ok(result.violations.some((violation) => violation.includes('YYYYMMDDHHMMSS_snake_case')));
    assert.ok(result.violations.some((violation) => violation.includes('contains no executable SQL')));
    assert.ok(result.violations.some((violation) => violation.includes('Duplicate migration SQL')));
    assert.ok(result.violations.some((violation) => violation.includes('migration.sql is missing')));
  });
});

test('reports shared timestamps as a deterministic-order warning', () => {
  withMigrationRoot((root) => {
    writeFileSync(resolve(root, 'migration_lock.toml'), 'provider = "postgresql"\n');
    writeMigration(root, '20260728094000_first', 'CREATE TABLE "First" ("id" TEXT);\n');
    writeMigration(root, '20260728094000_second', 'CREATE TABLE "Second" ("id" TEXT);\n');

    const result = inspectPrismaMigrations(root);

    assert.equal(result.ok, true);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /full directory name/);
  });
});
