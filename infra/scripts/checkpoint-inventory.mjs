import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const CHECKPOINT_UNITS = [
  {
    id: '01',
    name: 'Authority and static policy',
  },
  {
    id: '02',
    name: 'Database and shared contracts',
  },
  {
    id: '03',
    name: 'Identity, security, and notifications',
  },
  {
    id: '04',
    name: 'Booking marketplace lifecycle',
  },
  {
    id: '05',
    name: 'Finance lifecycle',
  },
  {
    id: '06',
    name: 'Admin operations surfaces',
  },
  {
    id: '07',
    name: 'Admin Finance and Analytics',
  },
  {
    id: '08',
    name: 'Customer and Partner apps',
  },
  {
    id: '09',
    name: 'Tooling, docs, and cleanup',
  },
];

const UNIT_NAMES = new Map(CHECKPOINT_UNITS.map((unit) => [unit.id, unit.name]));

const STATIC_POLICY_PATHS = [
  'infra/scripts/check-final-authority.',
  'infra/scripts/check-mobile-visible-copy.',
  'infra/scripts/check-api-policy-coverage.',
  'infra/scripts/check-operations-policy-consistency.',
  'infra/scripts/check-admin-visible-copy.',
  'infra/scripts/check-admin-query-guards.',
  'apps/admin_web/app/admin-page-shell-inventory.spec.',
  'apps/admin_web/app/admin-kpi-scope-guard.spec.',
  'apps/admin_web/lib/admin-navigation',
  'apps/admin_web/lib/admin-operator-access-model',
];

const IDENTITY_SECURITY_PATHS = [
  'apps/api/src/auth/',
  'apps/api/src/security/',
  'apps/api/src/redis/',
  'apps/api/src/health/',
  'apps/api/src/realtime/',
  'apps/api/src/notifications/',
  'apps/api/src/files/',
  'apps/api/src/admin/admin-operator-category.guard',
  'apps/api/src/admin/admin-route-guard-manifest',
  'apps/admin_web/app/api/admin/realtime-token/',
  'apps/admin_web/app/api/admin/session/',
  'apps/admin_web/lib/admin-api-token',
  'apps/admin_web/lib/admin-realtime-token',
  'apps/admin_web/lib/admin-session',
  'apps/admin_web/middleware.',
  'apps/admin_web/proxy.',
  'apps/admin_web/app/notifications/',
  'infra/scripts/check-admin-sensitive-exposure.',
  'infra/scripts/check-secret-leaks.',
  'infra/scripts/check-fcm-',
  'infra/scripts/fcm-',
  'infra/scripts/notification-',
  'infra/scripts/check-notification-',
  'infra/nginx/',
];

const API_FINANCE_SEGMENTS = [
  '/accounting',
  '/bank',
  '/cash',
  '/coupon',
  '/earning',
  '/finance',
  '/payment',
  '/payout',
  '/referral',
  '/settlement',
  '/tax',
  '/wallet',
  '/withdraw',
  '/withholding',
];

const API_BOOKING_SEGMENTS = [
  '/booking',
  '/chat',
  '/customer',
  '/location',
  '/matching',
  '/mobile',
  '/provider',
  '/review',
  '/service',
];

const ADMIN_IDENTITY_SECURITY_PATHS = [
  'apps/api/src/admin/admin-governance.',
  'apps/api/src/admin/admin-identity.',
  'apps/api/src/admin/admin-notification',
  'apps/api/src/admin/admin-operator',
  'apps/api/src/admin/admin-route-guard',
  'apps/api/src/admin/admin-system.',
];

const ADMIN_BOOKING_PATHS = [
  'apps/api/src/admin/admin-booking',
  'apps/api/src/admin/admin-catalog',
  'apps/api/src/admin/admin-customer',
  'apps/api/src/admin/admin-partner',
  'apps/api/src/admin/admin-provider',
  'apps/api/src/admin/admin-review',
];

const ADMIN_FINANCE_PATHS = [
  'apps/api/src/admin/admin-bank',
  'apps/api/src/admin/admin-coupon',
  'apps/api/src/admin/admin-finance',
  'apps/api/src/admin/admin-ledger',
  'apps/api/src/admin/admin-payment',
  'apps/api/src/admin/admin-payout',
  'apps/api/src/admin/admin-referral',
  'apps/api/src/admin/admin-settlement',
  'apps/api/src/admin/admin-wallet',
];

const ADMIN_ANALYTICS_PATHS = [
  'apps/api/src/admin/admin-analytics',
  'apps/api/src/admin/admin-marketing',
  'apps/api/src/admin/admin-usage',
];

const ADMIN_CROSS_CUTTING_PATHS = [
  'apps/api/src/admin/admin.controller',
  'apps/api/src/admin/admin.dto',
  'apps/api/src/admin/admin.module',
  'apps/api/src/admin/admin.service',
];

const FINANCE_SMOKE_PARTS = [
  'bank-deposit',
  'cash-booking',
  'finance',
  'manual-wallet',
  'payment-lifecycle',
  'payout',
  'referral-money',
  'settlement',
  'wallet-adjustment',
  'withdrawal',
  'withholding',
];

const ADMIN_FINANCE_ANALYTICS_PATHS = [
  'apps/admin_web/app/cash-settlements/',
  'apps/admin_web/app/earnings/',
  'apps/admin_web/app/finance-closeout/',
  'apps/admin_web/app/finance-overview/',
  'apps/admin_web/app/finance-tax/',
  'apps/admin_web/app/marketing-analytics/',
  'apps/admin_web/app/payments/',
  'apps/admin_web/app/payouts/',
  'apps/admin_web/app/refunds/',
  'apps/admin_web/app/usage-overview/',
  'apps/admin_web/app/wallet-adjustments/',
  'apps/admin_web/app/partners/overview/',
  'apps/admin_web/lib/finance',
];

const CROSS_CUTTING_PATHS = [
  'apps/api/src/admin/admin.controller',
  'apps/api/src/admin/admin.service',
  'apps/api/src/admin/admin.module',
  'apps/api/src/app.module',
  'apps/api/src/main.',
  'apps/admin_web/lib/admin-api.',
  'apps/admin_web/app/globals.css',
  'package-lock.json',
  'package.json',
];

const GENERATED_REVIEW_PATHS = ['.codex-audits/', '.playwright-cli/', '.tmp-', 'artifacts/', 'output/'];

function normalizedPath(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

function includesPathPrefix(path, prefixes) {
  return prefixes.some((prefix) => path.startsWith(prefix));
}

function includesSegment(path, segments) {
  return segments.some((segment) => path.includes(segment));
}

export function classifyCheckpointPath(inputPath) {
  const path = normalizedPath(inputPath);
  const unitIds = new Set();

  if (includesPathPrefix(path, STATIC_POLICY_PATHS)) {
    unitIds.add('01');
  }

  if (
    path.startsWith('apps/api/prisma/') ||
    path.startsWith('infra/supabase/') ||
    path.startsWith('packages/shared-types/')
  ) {
    unitIds.add('02');
  }

  if (includesPathPrefix(path, IDENTITY_SECURITY_PATHS)) {
    unitIds.add('03');
  }

  if (path.startsWith('apps/api/src/admin/')) {
    if (includesPathPrefix(path, ADMIN_IDENTITY_SECURITY_PATHS)) {
      unitIds.add('03');
    }
    if (includesPathPrefix(path, ADMIN_BOOKING_PATHS)) {
      unitIds.add('04');
    }
    if (includesPathPrefix(path, ADMIN_FINANCE_PATHS)) {
      unitIds.add('05');
    }
    if (includesPathPrefix(path, ADMIN_ANALYTICS_PATHS)) {
      unitIds.add('07');
    }
    if (includesPathPrefix(path, ADMIN_CROSS_CUTTING_PATHS)) {
      unitIds.add('03');
      unitIds.add('04');
      unitIds.add('05');
      unitIds.add('06');
      unitIds.add('07');
    }
    if (unitIds.size === 0) {
      unitIds.add('06');
    }
  } else if (path.startsWith('apps/api/src/')) {
    if (includesSegment(path, API_FINANCE_SEGMENTS)) {
      unitIds.add('05');
    }
    if (includesSegment(path, API_BOOKING_SEGMENTS)) {
      unitIds.add('04');
    }
    if (unitIds.size === 0) {
      unitIds.add('04');
    }
  }

  if (path.startsWith('infra/scripts/') && includesSegment(path, FINANCE_SMOKE_PARTS)) {
    unitIds.add('05');
  }

  if (
    path.startsWith('infra/scripts/') &&
    (path.includes('booking') ||
      path.includes('provider-availability') ||
      path.includes('provider-chat') ||
      path.includes('mobile-foundation'))
  ) {
    unitIds.add('04');
  }

  if (includesPathPrefix(path, ADMIN_FINANCE_ANALYTICS_PATHS)) {
    unitIds.add('07');
  } else if (path.startsWith('apps/admin_web/')) {
    unitIds.add('06');
  }

  if (path.startsWith('apps/public_web/')) {
    unitIds.add('06');
  }

  if (path.startsWith('apps/customer_app/') || path.startsWith('apps/provider_app/')) {
    unitIds.add('08');
  }

  if (
    path.startsWith('.github/') ||
    path.startsWith('.codex-audits/') ||
    path.startsWith('.playwright-cli/') ||
    path.startsWith('.tmp-') ||
    path.startsWith('artifacts/') ||
    path.startsWith('docs/') ||
    path.startsWith('output/') ||
    path.startsWith('infra/') ||
    path.startsWith('.env') ||
    path.startsWith('docker') ||
    path.startsWith('Dockerfile') ||
    path === 'apps/api/package.json' ||
    path === 'apps/api/vitest.config.mts' ||
    path === 'apps/admin_web/package.json' ||
    path === 'apps/public_web/package.json' ||
    path === 'eslint.config.mjs' ||
    path === 'justfile' ||
    path === 'package.json' ||
    path === 'package-lock.json' ||
    path.endsWith('.md')
  ) {
    unitIds.add('09');
  }

  const sortedUnitIds = [...unitIds].sort();
  const manualReview =
    sortedUnitIds.length > 1 ||
    includesPathPrefix(path, CROSS_CUTTING_PATHS) ||
    includesPathPrefix(path, GENERATED_REVIEW_PATHS);

  return {
    path,
    unitIds: sortedUnitIds,
    unitNames: sortedUnitIds.map((id) => UNIT_NAMES.get(id)),
    manualReview,
  };
}

export function parsePorcelainStatus(output) {
  const tokens = output.split('\0');
  const entries = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token) {
      continue;
    }
    const status = token.slice(0, 2);
    const path = token.slice(3);
    const entry = { status, path: normalizedPath(path) };

    if (status.includes('R') || status.includes('C')) {
      const sourcePath = tokens[index + 1];
      if (sourcePath) {
        entry.sourcePath = normalizedPath(sourcePath);
        index += 1;
      }
    }

    entries.push(entry);
  }

  return entries;
}

export function buildCheckpointInventory(entries) {
  const files = entries.map((entry) => ({
    ...entry,
    ...classifyCheckpointPath(entry.path),
  }));
  const statusCounts = files.reduce(
    (counts, file) => {
      const status = file.status;
      const key =
        status === '??'
          ? 'untracked'
          : status.includes('R')
            ? 'renamed'
            : status.includes('C')
              ? 'copied'
              : status.includes('D')
                ? 'deleted'
                : status.includes('A')
                  ? 'added'
                  : 'modified';
      counts[key] += 1;
      return counts;
    },
    {
      modified: 0,
      added: 0,
      deleted: 0,
      renamed: 0,
      copied: 0,
      untracked: 0,
    },
  );
  const unclassified = files.filter((file) => file.unitIds.length === 0);
  const manualReview = files.filter((file) => file.manualReview);
  const units = CHECKPOINT_UNITS.map((unit) => ({
    ...unit,
    count: files.filter((file) => file.unitIds.includes(unit.id)).length,
  }));

  return {
    ok: unclassified.length === 0,
    changedPathCount: files.length,
    statusCounts,
    manualReviewCount: manualReview.length,
    units,
    unclassified,
    manualReview,
    files,
  };
}

export function inspectCheckpointInventory(repoRoot = resolve(import.meta.dirname, '..', '..')) {
  const status = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
  return buildCheckpointInventory(parsePorcelainStatus(status));
}

export function pathsForCheckpointUnit(inventory, unitId) {
  if (!UNIT_NAMES.has(unitId)) {
    throw new Error(`Unknown checkpoint unit: ${unitId}`);
  }
  return inventory.files
    .filter((file) => file.unitIds.includes(unitId))
    .map((file) => file.path)
    .sort();
}

function isDirectExecution() {
  return process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectExecution()) {
  const inventory = inspectCheckpointInventory();
  const verbose = process.argv.includes('--verbose');
  const pathsOnly = process.argv.includes('--paths');
  const unitArgument = process.argv.find((argument) => argument.startsWith('--unit='));
  const selectedUnitId = unitArgument?.slice('--unit='.length);
  let selectedPaths = null;

  if (selectedUnitId) {
    try {
      selectedPaths = pathsForCheckpointUnit(inventory, selectedUnitId);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }

  if (pathsOnly) {
    if (!selectedUnitId || !selectedPaths) {
      console.error('--paths requires a valid --unit=<01-09> argument.');
      process.exitCode = 1;
    } else {
      console.log(selectedPaths.join('\n'));
    }
  } else {
    const report = {
      ok: inventory.ok,
      changedPathCount: inventory.changedPathCount,
      statusCounts: inventory.statusCounts,
      manualReviewCount: inventory.manualReviewCount,
      units: inventory.units,
      unclassified: inventory.unclassified,
      ...(selectedUnitId && selectedPaths
        ? {
            selectedUnit: {
              id: selectedUnitId,
              name: UNIT_NAMES.get(selectedUnitId),
              pathCount: selectedPaths.length,
              paths: verbose ? selectedPaths : selectedPaths.slice(0, 30),
              pathsOmitted: verbose ? 0 : Math.max(selectedPaths.length - 30, 0),
            },
          }
        : {}),
      ...(verbose
        ? { manualReview: inventory.manualReview }
        : {
            manualReviewPreview: inventory.manualReview.slice(0, 20),
            manualReviewOmitted: Math.max(inventory.manualReview.length - 20, 0),
          }),
    };
    console[inventory.ok ? 'log' : 'error'](JSON.stringify(report, null, 2));
  }
  if (!inventory.ok) {
    process.exitCode = 1;
  }
}
