import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();

const checks = [
  {
    root: 'apps/admin_web/app/cash-settlements',
    owners: [
      {
        file: 'apps/admin_web/app/cash-settlements/cash-settlement-page-rows.ts',
        formatter: 'formatRelativeTime',
      },
      {
        file: 'apps/admin_web/app/cash-settlements/cash-settlement-page-summary.ts',
        formatter: 'formatRelativeTime',
      },
    ],
  },
  {
    root: 'apps/admin_web/app/earnings',
    owners: [
      {
        file: 'apps/admin_web/app/earnings/earnings-page-model.ts',
        formatter: 'formatRelativeTime',
      },
    ],
  },
  {
    root: 'apps/admin_web/app/payouts',
    owners: [
      {
        file: 'apps/admin_web/app/payouts/page.tsx',
        formatter: 'formatRelativeTime',
      },
    ],
  },
  {
    root: 'apps/admin_web/app/services',
    owners: [],
  },
  {
    root: 'apps/admin_web/app/operations-policy',
    owners: [
      {
        file: 'apps/admin_web/app/operations-policy/operations-policy-audit-trail-section.tsx',
        formatter: 'formatRelativeTime',
      },
      {
        file: 'apps/admin_web/app/operations-policy/policy-drilldown.ts',
        formatter: 'formatRelativeTime',
      },
      {
        file: 'apps/admin_web/app/operations-policy/policy-related-bookings.ts',
        formatter: 'formatRelativeTime',
      },
    ],
  },
  {
    root: 'apps/admin_web/app/finance-closeout',
    owners: [
      {
        file: 'apps/admin_web/app/finance-closeout/finance-closeout-cash-debt-handoff-section.tsx',
        formatter: 'formatRelativeTime',
      },
      {
        file: 'apps/admin_web/app/finance-closeout/finance-closeout-settlement-backlog-section.tsx',
        formatter: 'formatRelativeAge',
      },
      {
        file: 'apps/admin_web/app/finance-closeout/page.tsx',
        formatter: 'formatRelativeAge',
      },
    ],
  },
];

const failures = [];

function collectSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(path);
    }
    if (
      !entry.isFile() ||
      !/\.(?:ts|tsx)$/.test(entry.name) ||
      /\.(?:spec|test)\.(?:ts|tsx)$/.test(entry.name)
    ) {
      return [];
    }
    return [path];
  });
}

function importsSharedFormatter(source, formatter) {
  return new RegExp(
    `import\\s*\\{[\\s\\S]*?\\b${formatter}\\b[\\s\\S]*?\\}\\s*from\\s*['"][^'"]*admin-format['"]`,
  ).test(source);
}

const localRelativeTimePattern = /(?:function\s+relativeTime\s*\(|(?:const|let|var)\s+relativeTime\s*=)/;

for (const check of checks) {
  const rootPath = join(repoRoot, check.root);
  if (!statSync(rootPath).isDirectory()) {
    failures.push(`${check.root}: shared formatter guard root is missing`);
    continue;
  }

  for (const owner of check.owners) {
    const source = readFileSync(join(repoRoot, owner.file), 'utf8');
    if (!importsSharedFormatter(source, owner.formatter)) {
      failures.push(`${owner.file}: missing shared formatter import ${owner.formatter}`);
    }
  }

  for (const sourcePath of collectSourceFiles(rootPath)) {
    const source = readFileSync(sourcePath, 'utf8');
    if (localRelativeTimePattern.test(source)) {
      failures.push(
        `${sourcePath.slice(repoRoot.length + 1)}: use admin-format instead of a local relativeTime helper`,
      );
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Admin shared format guard passed.');
