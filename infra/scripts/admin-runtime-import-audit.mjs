import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, relative, resolve, sep } from 'node:path';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const adminRoot = resolve(repoRoot, 'apps', 'admin_web');
const sourceRoots = ['app', 'components', 'lib'].map((folder) => resolve(adminRoot, folder));
const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];
const nextEntryNames = new Set([
  'default',
  'error',
  'global-error',
  'layout',
  'loading',
  'middleware',
  'not-found',
  'page',
  'route',
  'template',
]);
const keepCandidates = new Set(['apps/admin_web/lib/admin-hidden-route-policy.ts']);
const deferredDeleteCandidates = new Set(['apps/admin_web/app/bookings/booking-empty-message.ts']);

const allFiles = sourceRoots.flatMap((root) => walk(root)).filter(isSourceFile);
const productionFiles = allFiles.filter((file) => !isTestFile(file));
const testFiles = allFiles.filter(isTestFile);
const productionSet = new Set(productionFiles.map(normalizePath));
const testSet = new Set(testFiles.map(normalizePath));
const productionRoots = productionFiles.filter(isNextRuntimeEntry);
const productionReachable = collectReachable(productionRoots, productionSet);
const testReachable = collectReachable(testFiles, new Set([...productionSet, ...testSet]));

const candidates = productionFiles
  .filter((file) => !productionReachable.has(normalizePath(file)))
  .map((file) => {
    const normalized = normalizePath(file);
    const relativeFile = relative(repoRoot, file).split(sep).join('/');
    return {
      classification: classifyCandidate(relativeFile, testReachable.has(normalized)),
      file: relativeFile,
      lines: lineCount(file),
    };
  })
  .sort((left, right) => left.classification.localeCompare(right.classification) || left.file.localeCompare(right.file));

const summary = candidates.reduce(
  (result, candidate) => {
    result[candidate.classification] += 1;
    result.lines += candidate.lines;
    return result;
  },
  { DELETE_CANDIDATE: 0, KEEP: 0, TEST_ONLY: 0, lines: 0 },
);

process.stdout.write(
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      productionEntryCount: productionRoots.length,
      productionReachableCount: productionReachable.size,
      candidateCount: candidates.length,
      summary,
      candidates,
    },
    null,
    2,
  )}\n`,
);

function walk(root) {
  if (!existsSync(root)) {
    return [];
  }
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(root, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function isSourceFile(file) {
  return sourceExtensions.includes(extname(file)) && !file.endsWith('.d.ts');
}

function isTestFile(file) {
  return /\.(spec|test)\.[jt]sx?$/.test(file);
}

function isNextRuntimeEntry(file) {
  const name = file.slice(file.lastIndexOf(sep) + 1).replace(/\.[^.]+$/, '');
  return nextEntryNames.has(name);
}

function collectReachable(entries, allowedFiles) {
  const reachable = new Set();
  const pending = [...entries];
  while (pending.length > 0) {
    const file = pending.pop();
    const normalized = normalizePath(file);
    if (reachable.has(normalized) || !allowedFiles.has(normalized)) {
      continue;
    }
    reachable.add(normalized);
    for (const dependency of readRelativeDependencies(file)) {
      const resolved = resolveDependency(file, dependency);
      if (resolved && allowedFiles.has(normalizePath(resolved)) && !reachable.has(normalizePath(resolved))) {
        pending.push(resolved);
      }
    }
  }
  return reachable;
}

function readRelativeDependencies(file) {
  const source = readFileSync(file, 'utf8');
  const dependencies = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]?.startsWith('.')) {
        dependencies.add(match[1]);
      }
    }
  }
  return dependencies;
}

function resolveDependency(importer, dependency) {
  const base = resolve(dirname(importer), dependency);
  const candidates = [
    base,
    ...sourceExtensions.map((extension) => `${base}${extension}`),
    ...sourceExtensions.map((extension) => resolve(base, `index${extension}`)),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function lineCount(file) {
  const source = readFileSync(file, 'utf8');
  return source.length === 0 ? 0 : source.split(/\r?\n/).length;
}

function normalizePath(file) {
  return resolve(file).toLowerCase();
}

function classifyCandidate(relativeFile, isTestReachable) {
  if (keepCandidates.has(relativeFile)) {
    return 'KEEP';
  }
  if (deferredDeleteCandidates.has(relativeFile)) {
    return 'DELETE_CANDIDATE';
  }
  return isTestReachable ? 'TEST_ONLY' : 'DELETE_CANDIDATE';
}
