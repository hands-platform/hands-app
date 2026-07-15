import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildExternalSetupNextActions,
  referralReleaseReadiness,
  shouldCheckSupabaseReachability,
} from './lib/external-setup-report.mjs';

test('keeps recommended advisory gaps visible as next actions', () => {
  assert.deepEqual(
    buildExternalSetupNextActions({
      phase: 'advisory',
      requiredFailures: [],
      recommendedFailures: [{ fix: 'Configure the sandbox credential.' }],
    }),
    ['Configure the sandbox credential.'],
  );
});

test('deduplicates actions and retains push-specific verification commands', () => {
  const actions = buildExternalSetupNextActions({
    phase: 'push',
    requiredFailures: [{ fix: 'Configure Firebase.' }],
    recommendedFailures: [{ fix: 'Configure Firebase.' }],
  });

  assert.equal(actions.filter((action) => action === 'Configure Firebase.').length, 1);
  assert.ok(actions.some((action) => action.includes('fcm:credentials-check')));
  assert.ok(actions.some((action) => action.includes('fcm:push-smoke')));
});

test('includes Supabase reachability in the aggregate strict gate only', () => {
  assert.equal(shouldCheckSupabaseReachability({ phase: 'advisory', strict: true }), true);
  assert.equal(shouldCheckSupabaseReachability({ phase: 'advisory', strict: false }), false);
  assert.equal(shouldCheckSupabaseReachability({ phase: 'supabase-core', strict: false }), true);
  assert.equal(shouldCheckSupabaseReachability({ phase: 'payments', strict: true }), false);
});

test('keeps the current Android referral release independent from future iOS store links', () => {
  assert.deepEqual(
    referralReleaseReadiness({
      REFERRAL_PUBLIC_BASE_URL: 'https://hands.vn',
      REFERRAL_CUSTOMER_ANDROID_STORE_URL:
        'https://play.google.com/store/apps/details?id=com.massagevn.customer.customer_app',
      REFERRAL_PARTNER_ANDROID_STORE_URL:
        'https://play.google.com/store/apps/details?id=com.massagevn.provider.provider_app',
      REFERRAL_CUSTOMER_IOS_STORE_URL: '',
      REFERRAL_PARTNER_IOS_STORE_URL: '',
    }),
    { android: true, ios: false },
  );
});

test('rejects an Android referral URL for the wrong Play package', () => {
  assert.equal(
    referralReleaseReadiness({
      REFERRAL_PUBLIC_BASE_URL: 'https://hands.vn',
      REFERRAL_CUSTOMER_ANDROID_STORE_URL:
        'https://play.google.com/store/apps/details?id=com.example.wrong',
      REFERRAL_PARTNER_ANDROID_STORE_URL:
        'https://play.google.com/store/apps/details?id=com.massagevn.provider.provider_app',
    }).android,
    false,
  );
});
