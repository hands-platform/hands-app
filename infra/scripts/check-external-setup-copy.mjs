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
