import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();

const checks = [
  {
    file: 'apps/admin_web/app/cash-settlements/page.tsx',
    requiredImport: 'formatRelativeTime',
    forbiddenPatterns: [
      {
        pattern: /function\s+relativeTime\s*\(/,
        message: 'Use formatRelativeTime from admin-format instead of a local relativeTime helper.',
      },
    ],
  },
  {
    file: 'apps/admin_web/app/earnings/page.tsx',
    requiredImport: 'formatRelativeTime',
    forbiddenPatterns: [
      {
        pattern: /function\s+relativeTime\s*\(/,
        message: 'Use formatRelativeTime from admin-format instead of a local relativeTime helper.',
      },
    ],
  },
  {
    file: 'apps/admin_web/app/payouts/page.tsx',
    requiredImport: 'formatRelativeTime',
    forbiddenPatterns: [
      {
        pattern: /function\s+relativeTime\s*\(/,
        message: 'Use formatRelativeTime from admin-format instead of a local relativeTime helper.',
      },
    ],
  },
  {
    file: 'apps/admin_web/app/services/page.tsx',
    requiredImport: 'formatRelativeTime',
    forbiddenPatterns: [
      {
        pattern: /function\s+relativeTime\s*\(/,
        message: 'Use formatRelativeTime from admin-format instead of a local relativeTime helper.',
      },
    ],
  },
  {
    file: 'apps/admin_web/app/operations-policy/page.tsx',
    requiredImport: 'formatRelativeTime',
    forbiddenPatterns: [
      {
        pattern: /function\s+relativeTime\s*\(/,
        message: 'Use formatRelativeTime from admin-format instead of a local relativeTime helper.',
      },
    ],
  },
  {
    file: 'apps/admin_web/app/finance-closeout/page.tsx',
    requiredImport: 'formatRelativeTime',
    forbiddenPatterns: [
      {
        pattern: /function\s+relativeTime\s*\(/,
        message: 'Use formatRelativeTime from admin-format instead of a local relativeTime helper.',
      },
    ],
  },
];

const failures = [];

for (const check of checks) {
  const source = readFileSync(join(repoRoot, check.file), 'utf8');
  if (!source.includes(check.requiredImport)) {
    failures.push(`${check.file}: missing shared formatter import ${check.requiredImport}`);
  }

  for (const forbidden of check.forbiddenPatterns) {
    if (forbidden.pattern.test(source)) {
      failures.push(`${check.file}: ${forbidden.message}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Admin shared format guard passed.');
