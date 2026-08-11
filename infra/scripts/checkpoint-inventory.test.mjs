import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCheckpointInventory,
  classifyCheckpointPath,
  pathsForCheckpointUnit,
  parsePorcelainStatus,
} from './checkpoint-inventory.mjs';

test('classifies representative checkpoint paths by functional ownership', () => {
  assert.deepEqual(classifyCheckpointPath('apps/api/prisma/schema.prisma').unitIds, ['02']);
  assert.deepEqual(classifyCheckpointPath('apps/api/src/auth/auth.service.ts').unitIds, ['03']);
  assert.deepEqual(classifyCheckpointPath('apps/api/src/bookings/bookings.service.ts').unitIds, ['04']);
  assert.deepEqual(classifyCheckpointPath('apps/api/src/payments/payments.service.ts').unitIds, ['05']);
  assert.deepEqual(classifyCheckpointPath('apps/api/src/admin/admin-booking.routes.ts').unitIds, ['04']);
  assert.deepEqual(classifyCheckpointPath('apps/api/src/admin/admin-finance.routes.ts').unitIds, ['05']);
  assert.deepEqual(classifyCheckpointPath('apps/api/src/admin/admin-usage-overview.ts').unitIds, ['07']);
  assert.deepEqual(classifyCheckpointPath('apps/api/src/admin/admin-system.controller.ts').unitIds, ['03']);
  assert.deepEqual(classifyCheckpointPath('apps/admin_web/app/customers/page.tsx').unitIds, ['06']);
  assert.deepEqual(classifyCheckpointPath('apps/admin_web/app/finance-tax/page.tsx').unitIds, ['07']);
  assert.deepEqual(classifyCheckpointPath('apps/public_web/app/page.tsx').unitIds, ['06']);
  assert.deepEqual(classifyCheckpointPath('apps/customer_app/lib/src/bootstrap.dart').unitIds, ['08']);
  assert.deepEqual(classifyCheckpointPath('.github/workflows/ci.yml').unitIds, ['09']);
  assert.deepEqual(classifyCheckpointPath('apps/api/package.json').unitIds, ['09']);
  assert.deepEqual(classifyCheckpointPath('eslint.config.mjs').unitIds, ['09']);
});

test('marks cross-cutting and generated paths for manual hunk review', () => {
  const adminApi = classifyCheckpointPath('apps/admin_web/lib/admin-api.ts');
  const adminService = classifyCheckpointPath('apps/api/src/admin/admin.service.ts');
  const generatedOutput = classifyCheckpointPath('output/playwright/example.png');
  const auditImage = classifyCheckpointPath('.codex-audits/example.png');

  assert.equal(adminApi.manualReview, true);
  assert.deepEqual(adminApi.unitIds, ['06']);
  assert.equal(adminService.manualReview, true);
  assert.deepEqual(adminService.unitIds, ['03', '04', '05', '06', '07']);
  assert.equal(generatedOutput.manualReview, true);
  assert.deepEqual(generatedOutput.unitIds, ['09']);
  assert.equal(auditImage.manualReview, true);
  assert.deepEqual(auditImage.unitIds, ['09']);
});

test('parses modified, untracked, deleted, and renamed porcelain entries', () => {
  const entries = parsePorcelainStatus(
    [
      ' M apps/api/src/auth/auth.service.ts',
      '?? docs/new.md',
      ' D old-file.ts',
      'R  new-name.ts',
      'old-name.ts',
      '',
    ].join('\0'),
  );

  assert.deepEqual(entries, [
    { status: ' M', path: 'apps/api/src/auth/auth.service.ts' },
    { status: '??', path: 'docs/new.md' },
    { status: ' D', path: 'old-file.ts' },
    { status: 'R ', path: 'new-name.ts', sourcePath: 'old-name.ts' },
  ]);
});

test('fails inventory when a changed path has no checkpoint owner', () => {
  const inventory = buildCheckpointInventory([{ status: ' M', path: 'unknown/example.bin' }]);

  assert.equal(inventory.ok, false);
  assert.equal(inventory.unclassified.length, 1);
});

test('summarizes working tree status types without losing paths', () => {
  const inventory = buildCheckpointInventory([
    { status: ' M', path: 'package.json' },
    { status: ' D', path: 'docs/removed.md' },
    { status: '??', path: 'docs/new.md' },
  ]);

  assert.equal(inventory.changedPathCount, 3);
  assert.deepEqual(inventory.statusCounts, {
    modified: 1,
    added: 0,
    deleted: 1,
    renamed: 0,
    copied: 0,
    untracked: 1,
  });
});

test('lists sorted paths for a selected checkpoint unit', () => {
  const inventory = buildCheckpointInventory([
    { status: ' M', path: 'apps/api/src/auth/z.service.ts' },
    { status: ' M', path: 'apps/api/src/auth/a.service.ts' },
    { status: ' M', path: 'apps/api/src/payments/payment.service.ts' },
  ]);

  assert.deepEqual(pathsForCheckpointUnit(inventory, '03'), [
    'apps/api/src/auth/a.service.ts',
    'apps/api/src/auth/z.service.ts',
  ]);
  assert.throws(() => pathsForCheckpointUnit(inventory, '99'), /Unknown checkpoint unit/);
});
