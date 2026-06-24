export type ReferralAudienceSlug = 'customer' | 'partner';
export type ReferralPlatform = 'android' | 'ios' | 'web';
type ReferralEnv = Record<string, string | undefined>;

const DEFAULT_LOCAL_BASE_URL = 'http://localhost:3101';

export function normalizeReferralAudience(input: string): ReferralAudienceSlug | null {
  const normalized = input.trim().toLowerCase();
  if (normalized === 'customer' || normalized === 'customers') return 'customer';
  if (normalized === 'partner' || normalized === 'partners') return 'partner';
  return null;
}

export function referralPath(audience: ReferralAudienceSlug, code: string) {
  return `/r/${audience}/${encodeURIComponent(code)}`;
}

export function referralPublicBaseUrl(env: ReferralEnv = process.env) {
  return (
    env.REFERRAL_PUBLIC_BASE_URL?.trim() ||
    env.PUBLIC_WEB_URL?.trim() ||
    env.ADMIN_PUBLIC_URL?.trim() ||
    DEFAULT_LOCAL_BASE_URL
  ).replace(/\/$/, '');
}

export function referralShareUrl(audience: ReferralAudienceSlug, code: string, env: ReferralEnv = process.env) {
  return `${referralPublicBaseUrl(env)}${referralPath(audience, code)}`;
}

export function referralPlatformFromUserAgent(userAgent: string | null | undefined): ReferralPlatform {
  const value = (userAgent ?? '').toLowerCase();
  if (value.includes('android')) return 'android';
  if (/(iphone|ipad|ipod)/.test(value)) return 'ios';
  return 'web';
}

export function referralStoreUrl(
  audience: ReferralAudienceSlug,
  platform: ReferralPlatform,
  code: string,
  env: ReferralEnv = process.env,
) {
  if (platform === 'web') return null;

  const target = referralStoreBaseUrl(audience, platform, env);
  if (!target) return null;

  return appendReferralParams(target, audience, code, platform);
}

export function referralStoreSetupState(audience: ReferralAudienceSlug, env: ReferralEnv = process.env) {
  return {
    publicBase: isHttpsUrl(env.REFERRAL_PUBLIC_BASE_URL?.trim()),
    android: Boolean(referralStoreBaseUrl(audience, 'android', env)),
    ios: Boolean(referralStoreBaseUrl(audience, 'ios', env)),
  };
}

function referralStoreBaseUrl(
  audience: ReferralAudienceSlug,
  platform: Exclude<ReferralPlatform, 'web'>,
  env: ReferralEnv,
) {
  const audienceKey = audience.toUpperCase();
  const platformKey = platform.toUpperCase();
  return (
    env[`REFERRAL_${audienceKey}_${platformKey}_STORE_URL`]?.trim() ||
    env[`${audienceKey}_${platformKey}_STORE_URL`]?.trim() ||
    env[`${audienceKey}_${platformKey}_APP_URL`]?.trim() ||
    null
  );
}

function appendReferralParams(
  rawUrl: string,
  audience: ReferralAudienceSlug,
  code: string,
  platform: Exclude<ReferralPlatform, 'web'>,
) {
  const url = new URL(rawUrl);
  if (platform === 'android' && url.hostname.includes('play.google.com')) {
    url.searchParams.set('referrer', `referral_code=${code}&referral_audience=${audience}`);
    return url.toString();
  }

  url.searchParams.set('referral_code', code);
  url.searchParams.set('referral_audience', audience);
  return url.toString();
}

export function referralFallbackHtml({
  audience,
  code,
  shareUrl,
}: {
  readonly audience: ReferralAudienceSlug;
  readonly code: string;
  readonly shareUrl: string;
}) {
  const appLabel = audience === 'customer' ? 'HANDS Customer app' : 'HANDS Partner app';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(appLabel)} referral</title>
  <style>
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: #f8f7fa; color: #2f2b3d; }
    main { max-width: 680px; margin: 10vh auto; padding: 32px; background: #fff; border: 1px solid rgb(47 43 61 / 12%); border-radius: 8px; box-shadow: 0 4px 18px rgb(47 43 61 / 16%); }
    p { color: rgb(47 43 61 / 70%); line-height: 1.6; }
    code { display: inline-flex; padding: 4px 8px; border-radius: 6px; background: rgb(115 103 240 / 16%); color: #7367f0; font-weight: 700; }
    a { color: #7367f0; font-weight: 700; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(appLabel)} referral link</h1>
    <p>Referral code <code>${escapeHtml(code)}</code> is valid, but the app store URL for this device is not configured yet.</p>
    <p>Set the matching store URL environment variable, then this link will send Android and iOS visitors to the correct app download page.</p>
    <p><a href="${escapeHtml(shareUrl)}">${escapeHtml(shareUrl)}</a></p>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isHttpsUrl(value: string | undefined) {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}
