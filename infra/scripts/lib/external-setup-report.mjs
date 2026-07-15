const pushNextActions = [
  'Run npm.cmd run fcm:credentials-check to verify Firebase Admin credential file contents.',
  'Run npm.cmd run fcm:token-smoke -- --dry-run to verify token registration smoke inputs.',
  'Run npm.cmd run fcm:push-smoke -- --dry-run for config-only readiness after Firebase Admin credentials are configured.',
];

export const referralAndroidPackageIds = {
  customer: 'com.massagevn.customer.customer_app',
  partner: 'com.massagevn.provider.provider_app',
};

export function buildExternalSetupNextActions({
  phase,
  requiredFailures,
  recommendedFailures,
  dockerContractCommand = 'npm.cmd run docker:contract',
}) {
  const actions = [...requiredFailures, ...recommendedFailures].map((check) => check.fix);
  if (phase === 'push') {
    actions.push(
      pushNextActions[0],
      `Run ${dockerContractCommand} to verify Docker service URLs and Firebase Admin credential mount paths.`,
      ...pushNextActions.slice(1),
    );
  }
  return [...new Set(actions)];
}

export function shouldCheckSupabaseReachability({ phase, strict }) {
  if (phase === 'advisory') {
    return strict;
  }
  return ['supabase-core', 'supabase-auth', 'production'].includes(phase);
}

export function referralReleaseReadiness(env) {
  return {
    android:
      isSecureUrl(env.REFERRAL_PUBLIC_BASE_URL) &&
      isPlayStoreUrl(env.REFERRAL_CUSTOMER_ANDROID_STORE_URL, referralAndroidPackageIds.customer) &&
      isPlayStoreUrl(env.REFERRAL_PARTNER_ANDROID_STORE_URL, referralAndroidPackageIds.partner),
    ios:
      isSecureUrl(env.REFERRAL_CUSTOMER_IOS_STORE_URL) &&
      isSecureUrl(env.REFERRAL_PARTNER_IOS_STORE_URL),
  };
}

function isPlayStoreUrl(value, expectedPackageId) {
  try {
    const url = new URL(String(value ?? '').trim());
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.hostname === 'play.google.com' &&
      url.pathname === '/store/apps/details' &&
      url.searchParams.get('id') === expectedPackageId
    );
  } catch {
    return false;
  }
}

function isSecureUrl(value) {
  try {
    const url = new URL(String(value ?? '').trim());
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}
