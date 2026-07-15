import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

export async function runAdminWebDirectSmoke({ env, pages, repoRoot }) {
  await new Promise((resolveChild, rejectChild) => {
    const child = spawn(process.execPath, [resolve(repoRoot, 'infra', 'scripts', 'admin-web-smoke.mjs')], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...env,
        ADMIN_WEB_SMOKE_MODE: '',
        ADMIN_WEB_SMOKE_DIRECT_PAGES: JSON.stringify(pages),
        ADMIN_WEB_SMOKE_PATHS: '',
      },
      stdio: 'inherit',
    });
    child.once('error', rejectChild);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolveChild();
        return;
      }
      rejectChild(
        new Error(
          `Admin evidence smoke exited with ${signal ? `signal ${signal}` : `code ${code ?? 'unknown'}`}.`,
        ),
      );
    });
  });
}
