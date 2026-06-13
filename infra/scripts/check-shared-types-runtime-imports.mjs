import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv.find((arg) => arg.startsWith('--root='))?.slice('--root='.length) ?? '.');
const scannedRoots = ['apps/api/src', 'apps/admin_web/app', 'apps/admin_web/components', 'apps/admin_web/lib'];
const violations = [];

for (const file of scannedRoots.flatMap((entry) => listFiles(entry))) {
  const source = readFileSync(resolve(root, file), 'utf8');
  for (const violation of runtimeSharedTypesImports(file, source)) {
    violations.push(violation);
  }
}

const result = {
  ok: violations.length === 0,
  purpose:
    'Guard source-only shared TypeScript contracts from runtime imports until @massage-vn/shared-types has a compiled JS package entry.',
  scannedRoots,
  violations,
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exitCode = 1;
}

function runtimeSharedTypesImports(file, source) {
  const matches = [];
  const patterns = [
    {
      regex: /import\s+(?!type\b)[\s\S]*?\s+from\s+['"]@massage-vn\/shared-types['"]/g,
      message: 'Use source parsing or a type-only import until shared-types exposes compiled JS.',
    },
    {
      regex: /import\s*\(\s*['"]@massage-vn\/shared-types['"]\s*\)/g,
      message: 'Dynamic runtime import is blocked while shared-types is source-only.',
    },
    {
      regex: /require\s*\(\s*['"]@massage-vn\/shared-types['"]\s*\)/g,
      message: 'CommonJS runtime require is blocked while shared-types is source-only.',
    },
  ];

  for (const { regex, message } of patterns) {
    for (const match of source.matchAll(regex)) {
      matches.push({ file, index: match.index ?? -1, message });
    }
  }
  return matches;
}

function listFiles(path) {
  const absolutePath = resolve(root, path);
  if (!statSync(absolutePath).isDirectory()) {
    return [path];
  }
  return readdirSync(absolutePath).flatMap((entry) => {
    const child = join(path, entry).replaceAll('\\', '/');
    const absoluteChild = resolve(root, child);
    if (statSync(absoluteChild).isDirectory()) {
      return listFiles(child);
    }
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(child) ? [child] : [];
  });
}
