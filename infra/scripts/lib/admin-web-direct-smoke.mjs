import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';

export async function runAdminWebDirectSmoke({ env, pages, repoRoot, session }) {
  await new Promise((resolveChild, rejectChild) => {
    const child = spawn(process.execPath, [resolve(repoRoot, 'infra', 'scripts', 'admin-web-smoke.mjs')], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ...env,
        ADMIN_WEB_SMOKE_COOKIE: session ? adminWebSmokeCookieHeader(env, session) : (env.ADMIN_WEB_SMOKE_COOKIE ?? ''),
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

export function adminWebSmokeCookieHeader(env, { sessionId, userId }) {
  const secret = env.ADMIN_WEB_SESSION_COOKIE_SECRET?.trim();
  if (!secret) throw new Error('ADMIN_WEB_SESSION_COOKIE_SECRET is required for Admin evidence smoke.');
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    exp: now + 300,
    iat: now,
    jti: sessionId,
    role: 'ADMIN',
    sessionVersion: 1,
    sub: userId,
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  const cookieName = env.ADMIN_WEB_SESSION_COOKIE_NAME?.trim() || 'hands_admin_session';
  return `${cookieName}=${payload}.${signature}`;
}
