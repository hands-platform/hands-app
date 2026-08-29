import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();

const rootsToScan = [
  'README.md',
  '.env.example',
  'apps',
  'docs',
  'infra',
  'packages',
  'docker-compose.yml',
  'docker-compose.prod.yml',
];

const ignoredDirs = new Set([
  '.git',
  '.next',
  '.dart_tool',
  'build',
  'coverage',
  'dist',
  'node_modules',
]);

const allowedExtensions = new Set([
  '.css',
  '.dart',
  '.env',
  '.example',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.prisma',
  '.ps1',
  '.sh',
  '.ts',
  '.tsx',
  '.txt',
  '.yml',
  '.yaml',
]);

const nonVietnamCity = String.fromCharCode(66, 97, 110, 103, 107, 111, 107);
const nonVietnamCountry = String.fromCharCode(84, 104, 97, 105, 108, 97, 110, 100);
const nonVietnamTimezone = `Asia/${nonVietnamCity}`;
const nonVietnamCurrencyCode = String.fromCharCode(84, 72, 66);
const nonVietnamCurrencyName = `${String.fromCharCode(84, 104, 97, 105)} Baht`;

const bannedPatterns = [
  {
    label: 'non-Vietnam city default',
    regex: new RegExp(`\\b${nonVietnamCity}\\b`, 'i'),
  },
  {
    label: 'non-Vietnam country default',
    regex: new RegExp(`\\b${nonVietnamCountry}\\b`, 'i'),
  },
  {
    label: 'non-Vietnam timezone',
    regex: new RegExp(`\\b${nonVietnamTimezone}\\b`, 'i'),
  },
  {
    label: 'non-Vietnam currency',
    regex: new RegExp(`\\b${nonVietnamCurrencyName}\\b|\\b${nonVietnamCurrencyCode}\\b`),
  },
];

function extensionOf(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const last = normalized.split('/').pop() ?? '';
  if (last === '.env.example') return '.env';
  const dotIndex = last.lastIndexOf('.');
  return dotIndex >= 0 ? last.slice(dotIndex) : '';
}

function shouldScanFile(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');
  if (
    normalizedPath.endsWith('/infra/scripts/check-vietnam-scope.mjs') ||
    normalizedPath.endsWith('/infra/scripts/check-admin-visible-copy.mjs')
  ) {
    return false;
  }
  return allowedExtensions.has(extensionOf(filePath));
}

function walk(path) {
  const stats = statSync(path);
  if (stats.isDirectory()) {
    const name = path.split(/[\\/]/).pop();
    if (ignoredDirs.has(name)) return [];
    return readdirSync(path).flatMap((entry) => walk(join(path, entry)));
  }
  return shouldScanFile(path) ? [path] : [];
}

const files = rootsToScan.flatMap((entry) => {
  try {
    return walk(join(root, entry));
  } catch {
    return [];
  }
});

const violations = [];

for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of bannedPatterns) {
      if (pattern.regex.test(line)) {
        violations.push({
          file: relative(root, file).replace(/\\/g, '/'),
          line: index + 1,
          rule: pattern.label,
          text: line.trim().slice(0, 180),
        });
      }
    }
  });
}

const result = {
  ok: violations.length === 0,
  purpose:
    'Static HANDS Vietnam scope guard: enforce the canonical Vietnam timezone and prevent accidental non-Vietnam region/currency defaults while allowing legitimate service names.',
  scannedFiles: files.length,
  violations,
};

console.log(JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exit(1);
}
