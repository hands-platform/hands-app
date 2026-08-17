import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

import { buildReleaseReadinessReport } from './lib/release-readiness-report.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const envArg = process.argv.find((arg) => arg.startsWith('--env='));
const timeoutArg = process.argv.find((arg) => arg.startsWith('--timeout-ms='));

const setup = runJson([
  resolve(repoRoot, 'infra', 'scripts', 'check-external-setup.mjs'),
  '--strict',
  ...(envArg ? [envArg] : []),
]);
const network = runJson([
  resolve(repoRoot, 'infra', 'scripts', 'check-production-network.mjs'),
  ...(envArg ? [envArg] : []),
  ...(timeoutArg ? [timeoutArg] : []),
]);
const financeGovernance = runJson([
  resolve(repoRoot, 'infra', 'scripts', 'check-finance-approver-governance.mjs'),
  '--release',
  ...(envArg ? [envArg] : []),
]);
const report = buildReleaseReadinessReport(setup, network, financeGovernance);

console.log(JSON.stringify(report, null, 2));
if (!report.ok) {
  process.exitCode = 1;
}

function runJson(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
    maxBuffer: 5 * 1024 * 1024,
  });
  if (result.error) {
    throw result.error;
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`Release readiness child check returned invalid JSON: ${args[0]}`);
  }
}
