import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const contractScript = fileURLToPath(
  new URL('./check-git-monorepo-contract.mjs', import.meta.url),
);
const expectedRoots = [
  'apps/api',
  'apps/admin_web',
  'apps/public_web',
  'apps/customer_app',
  'apps/provider_app',
  'packages/shared-types',
  'infra',
  'docs',
];

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function createRepository(path) {
  mkdirSync(path, { recursive: true });
  git(path, ['init']);

  for (const root of expectedRoots) {
    mkdirSync(join(path, root), { recursive: true });
    writeFileSync(join(path, root, '.gitkeep'), '');
  }

  writeFileSync(
    join(path, 'package.json'),
    `${JSON.stringify(
      {
        private: true,
        workspaces: [
          'apps/api',
          'apps/admin_web',
          'apps/public_web',
          'packages/shared-types',
        ],
      },
      null,
      2,
    )}\n`,
  );
  git(path, ['add', '.']);
  git(path, [
    '-c',
    'user.name=HANDS Contract Test',
    '-c',
    'user.email=hands-contract@example.invalid',
    'commit',
    '-m',
    'fixture',
  ]);
}

function runContract(cwd) {
  const result = spawnSync(process.execPath, [contractScript], {
    cwd,
    encoding: 'utf8',
  });
  const output = (result.stdout || result.stderr).trim();
  return { ...result, report: JSON.parse(output) };
}

function withTemporaryDirectory(run) {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'hands-monorepo-contract-'));
  try {
    return run(temporaryDirectory);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

test('accepts a repository whose root .git directory owns history', () => {
  withTemporaryDirectory((temporaryDirectory) => {
    const repository = join(temporaryDirectory, 'repository');
    createRepository(repository);

    const result = runContract(repository);

    assert.equal(result.status, 0);
    assert.equal(result.report.ok, true);
    assert.equal(result.report.gitLayout, 'root');
  });
});

test('accepts a Git-managed linked worktree sharing the root repository history', () => {
  withTemporaryDirectory((temporaryDirectory) => {
    const repository = join(temporaryDirectory, 'repository');
    const worktree = join(temporaryDirectory, 'worktree');
    createRepository(repository);
    git(repository, ['worktree', 'add', '-b', 'contract-worktree', worktree]);

    const result = runContract(worktree);

    assert.equal(result.status, 0);
    assert.equal(result.report.ok, true);
    assert.equal(result.report.gitLayout, 'linked-worktree');
    assert.match(result.report.gitDir, /[/\\]\.git[/\\]worktrees[/\\]/);
  });
});

test('still rejects a nested Git boundary inside the monorepo', () => {
  withTemporaryDirectory((temporaryDirectory) => {
    const repository = join(temporaryDirectory, 'repository');
    createRepository(repository);
    const nestedGitEntry = join(repository, 'apps/api/vendor/.git');
    mkdirSync(dirname(nestedGitEntry), { recursive: true });
    writeFileSync(nestedGitEntry, 'gitdir: ../../../../unrelated-history\n');

    const result = runContract(repository);

    assert.equal(result.status, 1);
    assert.equal(result.report.ok, false);
    assert.ok(
      result.report.violations.some(
        ({ rule, detail }) =>
          rule === 'no-nested-git-boundary' && detail.includes('apps/api/vendor/.git'),
      ),
    );
  });
});

test('rejects a worktree pointer whose Git directory was moved outside common .git/worktrees', () => {
  withTemporaryDirectory((temporaryDirectory) => {
    const repository = join(temporaryDirectory, 'repository');
    const worktree = join(temporaryDirectory, 'worktree');
    const forgedGitDirectory = join(temporaryDirectory, 'forged-git-directory');
    createRepository(repository);
    git(repository, ['worktree', 'add', '-b', 'contract-worktree', worktree]);

    const gitFile = join(worktree, '.git');
    const gitFileMatch = readFileSync(gitFile, 'utf8').trim().match(/^gitdir:\s*(.+)$/i);
    assert.ok(gitFileMatch);
    renameSync(resolve(worktree, gitFileMatch[1]), forgedGitDirectory);
    writeFileSync(join(forgedGitDirectory, 'commondir'), `${join(repository, '.git')}\n`);
    rmSync(gitFile, { force: true });
    writeFileSync(gitFile, `gitdir: ${forgedGitDirectory}\n`);

    const result = runContract(worktree);

    assert.equal(result.status, 1);
    assert.equal(result.report.ok, false);
    assert.ok(
      result.report.violations.some(({ rule }) => rule === 'history-owned-by-root-git-dir'),
    );
  });
});
