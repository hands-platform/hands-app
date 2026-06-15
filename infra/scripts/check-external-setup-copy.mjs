import { existsSync, readFileSync } from 'node:fs';

const files = [
  'apps/admin_web/app/setup/setup-page-data.ts',
  'apps/admin_web/app/operations-policy/page.tsx',
  'docs/architecture/external-account-migration.md',
  'docs/architecture/external-setup-checklist.md',
  'docs/architecture/operator-registration-plan.md',
  'docs/architecture/master-progress-roadmap.md',
  'docs/architecture/supabase-migration-runbook.md',
  'infra/env/README.md',
  'infra/scripts/external-registration-pack.mjs',
  'infra/setup/.generated/hands-external-registration-pack.md',
];

const violations = [];
const requiredVonageFiles = new Set([
  'apps/admin_web/app/setup/setup-page-data.ts',
  'apps/admin_web/app/operations-policy/page.tsx',
  'infra/scripts/external-registration-pack.mjs',
  'infra/setup/.generated/hands-external-registration-pack.md',
]);

for (const file of files) {
  if (!existsSync(file)) {
    violations.push({
      file,
      label: 'missing setup copy source',
      match: null,
      fix:
        file === 'infra/setup/.generated/hands-external-registration-pack.md'
          ? 'Run npm.cmd run external:pack:write before checking generated external setup copy.'
          : 'Restore the expected setup copy source file.',
    });
    continue;
  }

  const source = readFileSync(file, 'utf8');
  const twilioMatch = source.match(/\bTwilio\b|\btwilio\b/);
  if (twilioMatch) {
    violations.push({
      file,
      label: 'legacy SMS setup wording',
      match: twilioMatch[0],
      fix: 'Use Vonage as the deferred Phone Auth/SMS E2E path, with Viettel/FPT/custom SMS only as fallback options.',
    });
  }
  if (requiredVonageFiles.has(file) && !/\bVonage\b|\bvonage\b/.test(source)) {
    violations.push({
      file,
      label: 'missing Vonage setup wording',
      match: null,
      fix: 'Mention Vonage as the selected deferred SMS path so operators do not fill the wrong Supabase Phone Auth settings.',
    });
  }
  checkPaymentSetupOrder(file, source);
}

console.log(
  JSON.stringify(
    {
      ok: violations.length === 0,
      checkedFiles: files.length,
      violations,
    },
    null,
    2,
  ),
);

if (violations.length > 0) {
  process.exitCode = 1;
}

function checkPaymentSetupOrder(file, source) {
  const checks = [
    {
      file: 'infra/scripts/external-registration-pack.mjs',
      before: "category: 'Mobile release'",
      after: "category: 'Payments'",
      fix: 'Keep MoMo/VNPay registration items after storage, push, SMS, and mobile release setup.',
    },
    {
      file: 'infra/setup/.generated/hands-external-registration-pack.md',
      before: 'Mobile release: Android Play Console signing',
      after: 'Payments: MoMo merchant sandbox',
      fix: 'Regenerate the handoff pack after moving payment setup to the end.',
    },
    {
      file: 'docs/architecture/operator-registration-plan.md',
      before: 'Android release signing',
      after: 'Payments',
      fix: 'Keep payments last in the operator registration order.',
    },
    {
      file: 'docs/architecture/external-account-migration.md',
      before: /^\|\s*SMS\s*\|/m,
      after: '| Payments',
      fix: 'Keep payments after SMS/storage/push in the external account migration table.',
    },
    {
      file: 'docs/architecture/external-setup-checklist.md',
      before: '| Android signing',
      after: '| Payments',
      fix: 'Keep payments last in the external setup status table.',
    },
  ];
  const check = checks.find((candidate) => candidate.file === file);
  if (!check) {
    return;
  }

  const beforeIndex = patternIndex(source, check.before);
  const afterIndex = source.indexOf(check.after);
  if (beforeIndex === -1 || afterIndex === -1 || afterIndex < beforeIndex) {
    violations.push({
      file,
      label: 'payment setup should be last',
      match: afterIndex === -1 ? null : check.after,
      fix: check.fix,
    });
  }
}

function patternIndex(source, pattern) {
  if (pattern instanceof RegExp) {
    return source.search(pattern);
  }
  return source.indexOf(pattern);
}
