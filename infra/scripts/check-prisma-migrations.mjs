import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const defaultMigrationsRoot = resolve(repoRoot, 'apps', 'api', 'prisma', 'migrations');

export function inspectPrismaMigrations(migrationsRoot = defaultMigrationsRoot) {
  const violations = [];
  const warnings = [];

  if (!existsSync(migrationsRoot)) {
    return resultFor({
      migrationsRoot,
      violations: [`Migration root does not exist: ${migrationsRoot}`],
      warnings,
    });
  }

  const lockPath = resolve(migrationsRoot, 'migration_lock.toml');
  if (!existsSync(lockPath)) {
    violations.push('migration_lock.toml is missing.');
  } else {
    const lockSource = readFileSync(lockPath, 'utf8');
    if (!/^\s*provider\s*=\s*["']postgresql["']\s*$/m.test(lockSource)) {
      violations.push('migration_lock.toml must declare provider = "postgresql".');
    }
  }

  const directories = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (directories.length === 0) {
    violations.push('No Prisma migration directories were found.');
  }

  const timestampGroups = new Map();
  const sqlHashes = new Map();
  const migrations = directories.map((directory) => {
    const nameMatch = /^(\d{14})_([a-z0-9][a-z0-9_]*)$/.exec(directory);
    if (!nameMatch) {
      violations.push(
        `${directory} must use the YYYYMMDDHHMMSS_snake_case migration directory format.`,
      );
    } else {
      const timestamp = nameMatch[1];
      timestampGroups.set(timestamp, [...(timestampGroups.get(timestamp) ?? []), directory]);
    }

    const sqlPath = resolve(migrationsRoot, directory, 'migration.sql');
    if (!existsSync(sqlPath)) {
      violations.push(`${directory}/migration.sql is missing.`);
      return { directory, sqlBytes: 0, sqlHash: null };
    }

    const sqlSource = readFileSync(sqlPath, 'utf8');
    const executableSql = sqlSource
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/--.*$/gm, '')
      .trim();
    if (!executableSql) {
      violations.push(`${directory}/migration.sql contains no executable SQL.`);
      return { directory, sqlBytes: Buffer.byteLength(sqlSource), sqlHash: null };
    }

    const normalizedSql = executableSql.replace(/\s+/g, ' ').trim().toLowerCase();
    const sqlHash = createHash('sha256').update(normalizedSql).digest('hex');
    sqlHashes.set(sqlHash, [...(sqlHashes.get(sqlHash) ?? []), directory]);
    return {
      directory,
      sqlBytes: Buffer.byteLength(sqlSource),
      sqlHash,
    };
  });

  for (const [timestamp, names] of timestampGroups) {
    if (names.length > 1) {
      warnings.push(
        `Timestamp ${timestamp} is shared by ${names.join(', ')}. Prisma orders these by the full directory name.`,
      );
    }
  }

  for (const names of sqlHashes.values()) {
    if (names.length > 1) {
      violations.push(`Duplicate migration SQL detected in: ${names.join(', ')}.`);
    }
  }

  return resultFor({ migrations, migrationsRoot, violations, warnings });
}

function resultFor({
  migrations = [],
  migrationsRoot,
  violations,
  warnings,
}) {
  return {
    ok: violations.length === 0,
    migrationCount: migrations.length,
    migrationsRoot: basename(migrationsRoot),
    migrations,
    violations,
    warnings,
  };
}

function isDirectExecution() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  const result = inspectPrismaMigrations();
  console[result.ok ? 'log' : 'error'](JSON.stringify(result, null, 2));
  if (!result.ok) {
    process.exitCode = 1;
  }
}
