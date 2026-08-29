import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertCouponSmokeInventoryMatches,
  assertCouponSmokePauseApplyOptions,
  assertReviewedCouponSmokeManifest,
  couponSmokeCandidateDigest,
  parseCouponSmokePauseArgs,
} from './coupon-smoke-pause-remediation.mjs';

const candidates = [{
  active: true,
  code: 'SMOKE123',
  endsAt: null,
  id: 'coupon-1',
  startsAt: null,
  usageCount: 1,
}];

test('apply requires an exact confirmation, reviewed manifest, and bounded reason', () => {
  assert.throws(
    () => assertCouponSmokePauseApplyOptions(parseCouponSmokePauseArgs(['--apply'])),
    /Apply requires/u,
  );
  assert.doesNotThrow(() => assertCouponSmokePauseApplyOptions(parseCouponSmokePauseArgs([
    '--apply',
    '--confirm=PAUSE_REVIEWED_ACTIVE_OPEN_ENDED_SMOKE_COUPONS',
    '--manifest=reviewed.json',
    '--reason=Pause legacy open-ended Smoke coupons',
  ])));
});

test('reviewed manifest digest and current inventory must match exactly', () => {
  const manifest = {
    schemaVersion: 1,
    mode: 'dry-run',
    candidateDigest: couponSmokeCandidateDigest(candidates),
    candidates,
  };
  assert.doesNotThrow(() => assertReviewedCouponSmokeManifest(manifest));
  assert.doesNotThrow(() => assertCouponSmokeInventoryMatches(candidates, candidates));
  assert.throws(
    () => assertCouponSmokeInventoryMatches(candidates, [{ ...candidates[0], usageCount: 2 }]),
    /stale/u,
  );
  assert.throws(
    () => assertReviewedCouponSmokeManifest({ ...manifest, candidateDigest: 'modified' }),
    /modified/u,
  );
});
