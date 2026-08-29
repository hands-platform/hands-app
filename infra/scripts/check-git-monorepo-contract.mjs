import { existsSync, lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
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
const expectedNodeWorkspaces = [
  'apps/api',
  'apps/admin_web',
  'apps/public_web',
  'packages/shared-types',
];
const ignoredDirs = new Set([
  '.git',
  '.next',
  '.dart_tool',
  'build',
  'coverage',
  'dist',
  'logs',
  'node_modules',
]);

const violations = [];

function fail(rule, detail) {
  violations.push({ rule, detail });
}

function slash(path) {
  return path.replace(/\\/g, '/');
}

function comparablePath(path) {
  const normalized = resolve(path);
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
}

function samePath(left, right) {
  return comparablePath(left) === comparablePath(right);
}

function isPathInside(path, parent) {
  const pathFromParent = relative(parent, path);
  return (
    pathFromParent !== '' &&
    pathFromParent !== '..' &&
    !pathFromParent.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromParent)
  );
}

function gitOutput(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

let gitTopLevel = null;
let gitDir = null;
let gitCommonDir = null;
try {
  gitTopLevel = resolve(gitOutput(['rev-parse', '--show-toplevel']));
  gitDir = gitOutput(['rev-parse', '--git-dir']);
  gitCommonDir = gitOutput(['rev-parse', '--git-common-dir']);
} catch (error) {
  fail('git-root-readable', `Unable to read current Git root: ${error.message}`);
}

if (gitTopLevel && gitTopLevel !== resolve(root)) {
  fail('run-from-repo-root', `Run from Git top-level ${slash(gitTopLevel)}.`);
}

const rootGitEntry = join(root, '.git');
const resolvedGitDir = gitDir ? resolve(root, gitDir) : null;
const resolvedGitCommonDir = gitCommonDir ? resolve(root, gitCommonDir) : null;
let gitLayout = null;

if (!existsSync(rootGitEntry)) {
  fail('root-git-dir-exists', 'Expected existing .git entry at repository root.');
} else {
  const rootGitStats = lstatSync(rootGitEntry);

  if (rootGitStats.isSymbolicLink()) {
    fail('history-owned-by-root-git-dir', 'Root .git must not be a symbolic link.');
  } else if (rootGitStats.isDirectory()) {
    gitLayout = 'root';
    if (
      !resolvedGitDir ||
      !resolvedGitCommonDir ||
      !samePath(resolvedGitDir, rootGitEntry) ||
      !samePath(resolvedGitCommonDir, rootGitEntry)
    ) {
      fail(
        'history-owned-by-root-git-dir',
        `Expected root .git to own Git history, got gitDir=${gitDir ?? '<missing>'} and gitCommonDir=${gitCommonDir ?? '<missing>'}.`,
      );
    }
  } else if (rootGitStats.isFile()) {
    gitLayout = 'linked-worktree';
    const gitFileMatch = readFileSync(rootGitEntry, 'utf8').trim().match(/^gitdir:\s*(.+)$/i);
    const linkedGitDir = gitFileMatch ? resolve(root, gitFileMatch[1]) : null;
    const linkedWorktreesRoot = resolvedGitCommonDir
      ? join(resolvedGitCommonDir, 'worktrees')
      : null;
    const commonDirIsRootGitDirectory =
      resolvedGitCommonDir &&
      existsSync(resolvedGitCommonDir) &&
      lstatSync(resolvedGitCommonDir).isDirectory() &&
      basename(resolvedGitCommonDir) === '.git';

    if (
      !linkedGitDir ||
      !resolvedGitDir ||
      !resolvedGitCommonDir ||
      !samePath(linkedGitDir, resolvedGitDir) ||
      !commonDirIsRootGitDirectory ||
      !linkedWorktreesRoot ||
      !isPathInside(resolvedGitDir, linkedWorktreesRoot)
    ) {
      fail(
        'history-owned-by-root-git-dir',
        `Expected a Git-managed linked worktree under <common .git>/worktrees, got gitDir=${gitDir ?? '<missing>'} and gitCommonDir=${gitCommonDir ?? '<missing>'}.`,
      );
    }
  } else {
    fail('history-owned-by-root-git-dir', 'Root .git must be a directory or Git worktree pointer file.');
  }
}

if (existsSync(join(root, '.gitmodules'))) {
  fail('no-submodule-boundary', '.gitmodules exists; nested Git/submodule workflow is not part of HANDS.');
}

for (const item of expectedRoots) {
  if (!existsSync(join(root, item))) {
    fail('required-monorepo-root-present', `${item} is missing.`);
  }
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const workspaces = packageJson.workspaces ?? [];
for (const workspace of expectedNodeWorkspaces) {
  if (!workspaces.includes(workspace)) {
    fail('node-workspace-declared', `${workspace} is missing from package.json workspaces.`);
  }
}

const unexpectedWorkspaces = workspaces.filter((workspace) => !expectedNodeWorkspaces.includes(workspace));
if (unexpectedWorkspaces.length > 0) {
  fail('node-workspace-contract', `Unexpected Node workspaces: ${unexpectedWorkspaces.join(', ')}`);
}

function findNestedGitEntries(path) {
  const stats = statSync(path);
  if (!stats.isDirectory()) {
    return [];
  }

  const name = path.split(/[\\/]/).pop();
  if (name && ignoredDirs.has(name)) {
    return [];
  }

  const entries = readdirSync(path, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(path, entry.name);
    if (entry.name === '.git' && fullPath !== join(root, '.git')) {
      return [slash(relative(root, fullPath))];
    }
    if (entry.isDirectory()) {
      return findNestedGitEntries(fullPath);
    }
    return [];
  });
}

const nestedGitEntries = findNestedGitEntries(root);
for (const entry of nestedGitEntries) {
  fail('no-nested-git-boundary', `${entry} must not own separate Git history inside this monorepo.`);
}

const result = {
  ok: violations.length === 0,
  purpose:
    'Guard HANDS as one history-preserving Git monorepo without creating, deleting, moving, or nesting .git directories.',
  gitTopLevel: gitTopLevel ? slash(gitTopLevel) : null,
  gitDir,
  gitCommonDir,
  gitLayout,
  expectedRoots,
  nodeWorkspaces: workspaces,
  nestedGitEntries,
  violations,
};

console[result.ok ? 'log' : 'error'](JSON.stringify(result, null, 2));

if (!result.ok) {
  process.exit(1);
}
