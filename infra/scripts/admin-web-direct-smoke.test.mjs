import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';

import { adminWebSmokeCookieHeader } from './lib/admin-web-direct-smoke.mjs';

test('builds a signed Admin smoke cookie for the disposable session', () => {
  const secret = 'smoke-cookie-secret-with-enough-entropy';
  const header = adminWebSmokeCookieHeader(
    { ADMIN_WEB_SESSION_COOKIE_NAME: 'smoke_admin', ADMIN_WEB_SESSION_COOKIE_SECRET: secret },
    { sessionId: 'session-1', userId: 'admin-1' },
  );
  const value = header.slice('smoke_admin='.length);
  const [payload, signature] = value.split('.');
  const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));

  assert.equal(decoded.jti, 'session-1');
  assert.equal(decoded.sub, 'admin-1');
  assert.equal(signature, createHmac('sha256', secret).update(payload).digest('base64url'));
});
