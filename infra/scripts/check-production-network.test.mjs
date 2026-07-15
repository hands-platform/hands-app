import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildProductionNetworkTargets,
  validateProductionHttpResult,
  validateProductionNetworkTarget,
} from './lib/production-network.mjs';

test('builds public, API readiness, and Admin network targets without retaining query strings', () => {
  assert.deepEqual(
    buildProductionNetworkTargets({
      ADMIN_PUBLIC_URL: 'https://admin.hands.vn/console?token=secret',
      API_PUBLIC_URL: 'https://api.hands.vn/v1',
      PUBLIC_WEB_URL: 'https://hands.vn/home',
    }),
    [
      { name: 'public-web', envMissing: false, url: 'https://hands.vn/' },
      { name: 'api-readiness', envMissing: false, url: 'https://api.hands.vn/api/health/ready' },
      { name: 'admin-web', envMissing: false, url: 'https://admin.hands.vn/' },
    ],
  );
});

test('marks missing network configuration explicitly', () => {
  assert.equal(buildProductionNetworkTargets({})[0].envMissing, true);
});

test('rejects HTTP and credential-bearing production URLs', () => {
  assert.throws(
    () => validateProductionNetworkTarget({ name: 'public-web', url: 'http://hands.vn/' }),
    /must use HTTPS/,
  );
  assert.throws(
    () => validateProductionNetworkTarget({ name: 'admin-web', url: 'https://user:pass@admin.hands.vn/' }),
    /must not include URL credentials/,
  );
});

test('rejects insecure redirects and non-success HTTP responses', () => {
  const target = { name: 'api-readiness', url: 'https://api.hands.vn/api/health/ready' };
  assert.throws(
    () => validateProductionHttpResult(target, { status: 200, url: 'http://api.hands.vn/api/health' }),
    /redirected to a non-HTTPS URL/,
  );
  assert.throws(
    () => validateProductionHttpResult(target, { status: 503, url: target.url }),
    /returned HTTP 503/,
  );
});
