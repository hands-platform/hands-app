import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { runCouponSmokeLifecycle } from './lib/coupon-smoke-lifecycle.mjs';

const source = await readFile(new URL('./api-smoke.mjs', import.meta.url), 'utf8');

test('coupon smoke uses a bounded paused fixture and the explicit audited state routes', () => {
  const start = source.indexOf('const couponCode = `smoke${Date.now()}`;');
  const end = source.indexOf('const cancellableMomoBooking', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const couponFlow = source.slice(start, end);
  assert.match(couponFlow, /active:\s*false/);
  assert.match(couponFlow, /startsAt:\s*couponSmokeStartedAt/);
  assert.match(couponFlow, /endsAt:\s*couponSmokeEndsAt/);
  assert.match(couponFlow, /runCouponSmokeLifecycle/);
  assert.match(couponFlow, /postJson\(`\/admin\/coupons\/\$\{coupon\.id\}\/activate`/);
  assert.match(couponFlow, /postJson\(`\/admin\/coupons\/\$\{coupon\.id\}\/pause`/);
  assert.doesNotMatch(couponFlow, /deleteJson\([^)]*coupon/i);
});

test('coupon lifecycle pauses after success and returns the lifecycle result', async () => {
  const events = [];

  await assert.doesNotReject(async () => {
    const result = await runCouponSmokeLifecycle({
      launchEnabled: true,
      activate: async () => events.push('activate'),
      pause: async () => events.push('pause'),
      run: async () => {
        events.push('run');
        return 'complete';
      },
    });
    assert.equal(result, 'complete');
  });
  assert.deepEqual(events, ['activate', 'run', 'pause']);
});

test('coupon lifecycle pauses when downstream work fails immediately after activation', async () => {
  const lifecycleFailure = new Error('booking creation failed');
  let pauseCalls = 0;

  await assert.rejects(
    runCouponSmokeLifecycle({
      launchEnabled: true,
      activate: async () => undefined,
      pause: async () => { pauseCalls += 1; },
      run: async () => { throw lifecycleFailure; },
    }),
    lifecycleFailure,
  );
  assert.equal(pauseCalls, 1);
});

test('coupon lifecycle retries one unavailable pause request', async () => {
  let pauseCalls = 0;

  await assert.doesNotReject(
    runCouponSmokeLifecycle({
      launchEnabled: true,
      activate: async () => undefined,
      pause: async () => {
        pauseCalls += 1;
        if (pauseCalls === 1) throw new Error('API unavailable');
      },
      run: async () => undefined,
    }),
  );
  assert.equal(pauseCalls, 2);
});

test('coupon lifecycle exposes both downstream and exhausted cleanup failures', async () => {
  const lifecycleFailure = new Error('payment evidence failed');

  await assert.rejects(
    runCouponSmokeLifecycle({
      launchEnabled: true,
      activate: async () => undefined,
      pause: async () => { throw new Error('API unavailable'); },
      run: async () => { throw lifecycleFailure; },
    }),
    (error) => {
      assert.ok(error instanceof AggregateError);
      assert.equal(error.errors[0], lifecycleFailure);
      assert.match(error.errors[1]?.message ?? '', /cleanup failed after 2 pause attempts/);
      return true;
    },
  );
});

test('coupon lifecycle refuses to activate while the first-launch gate is off', async () => {
  let activationCalls = 0;

  await assert.rejects(
    runCouponSmokeLifecycle({
      activate: async () => { activationCalls += 1; },
      launchEnabled: false,
      pause: async () => undefined,
      run: async () => undefined,
    }),
    /disabled for the current launch/,
  );
  assert.equal(activationCalls, 0);
});
