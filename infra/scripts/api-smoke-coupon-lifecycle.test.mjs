import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('./api-smoke.mjs', import.meta.url), 'utf8');

test('coupon smoke uses a bounded paused fixture and pauses it after checkout evidence', () => {
  const start = source.indexOf('const couponCode = `smoke${Date.now()}`;');
  const end = source.indexOf('const cancellableMomoBooking', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);

  const couponFlow = source.slice(start, end);
  assert.match(couponFlow, /active:\s*false/);
  assert.match(couponFlow, /startsAt:\s*couponSmokeStartedAt/);
  assert.match(couponFlow, /endsAt:\s*couponSmokeEndsAt/);
  assert.match(couponFlow, /patchJson\(`\/admin\/coupons\/\$\{coupon\.id\}`[^]*\{ active: true \}/);
  assert.match(couponFlow, /patchJson\(`\/admin\/coupons\/\$\{coupon\.id\}`[^]*\{ active: false \}/);
  assert.doesNotMatch(couponFlow, /deleteJson\([^)]*coupon/i);
});
