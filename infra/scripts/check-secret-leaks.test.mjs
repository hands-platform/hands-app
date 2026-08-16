import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const scanner = join(dirname(fileURLToPath(import.meta.url)), 'check-secret-leaks.mjs');

test('rejects a tracked Playwright Admin Web session cookie', () => {
  const root = createTrackedRepo();
  try {
    const token = ['eyJ' + 'a'.repeat(40), 'b'.repeat(43)].join('.');
    writeFileSync(
      join(root, 'admin-storage.json'),
      JSON.stringify({ cookies: [{ name: 'hands_admin_session', value: token }], origins: [] }),
    );
    execFileSync('git', ['add', 'admin-storage.json'], { cwd: root });

    const result = spawnSync(process.execPath, [scanner, `--root=${root}`], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /signed Admin Web session cookie literal/);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('allows an empty Playwright storage state', () => {
  const root = createTrackedRepo();
  try {
    writeFileSync(
      join(root, 'admin-storage.json'),
      JSON.stringify({ cookies: [], origins: [] }),
    );
    execFileSync('git', ['add', 'admin-storage.json'], { cwd: root });

    const result = spawnSync(process.execPath, [scanner, `--root=${root}`], {
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

function createTrackedRepo() {
  const root = mkdtempSync(join(tmpdir(), 'hands-secret-scan-'));
  execFileSync('git', ['init', '--quiet'], { cwd: root });
  return root;
}
