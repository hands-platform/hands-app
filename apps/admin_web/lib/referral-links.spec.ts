import {
  normalizeReferralAudience,
  referralPath,
  referralPlatformFromUserAgent,
  referralShareUrl,
  referralStoreSetupState,
  referralStoreUrl,
} from './referral-links';

describe('referral link helpers', () => {
  it('normalizes supported referral audiences', () => {
    expect(normalizeReferralAudience('customer')).toBe('customer');
    expect(normalizeReferralAudience('partners')).toBe('partner');
    expect(normalizeReferralAudience('provider')).toBeNull();
  });

  it('builds stable public referral share URLs', () => {
    expect(referralPath('customer', 'AB C')).toBe('/r/customer/AB%20C');
    expect(referralShareUrl('partner', 'HANDSVN', { REFERRAL_PUBLIC_BASE_URL: 'https://hands.vn/' })).toBe(
      'https://hands.vn/r/partner/HANDSVN',
    );
  });

  it('detects mobile platform from user agent', () => {
    expect(referralPlatformFromUserAgent('Mozilla/5.0 Android')).toBe('android');
    expect(referralPlatformFromUserAgent('Mozilla/5.0 iPhone')).toBe('ios');
    expect(referralPlatformFromUserAgent('Mozilla/5.0 Windows')).toBe('web');
  });

  it('adds referral referrer metadata to Android Play Store URLs', () => {
    const url = referralStoreUrl('customer', 'android', 'CUST123', {
      REFERRAL_CUSTOMER_ANDROID_STORE_URL: 'https://play.google.com/store/apps/details?id=com.massagevn.customer',
    });

    expect(url).toBe(
      'https://play.google.com/store/apps/details?id=com.massagevn.customer&referrer=referral_code%3DCUST123%26referral_audience%3Dcustomer',
    );
  });

  it('adds referral metadata to non-Play Store app URLs', () => {
    const url = referralStoreUrl('partner', 'ios', 'PARTNER123', {
      PARTNER_IOS_APP_URL: 'https://apps.apple.com/app/hands-partner/id123',
    });

    expect(url).toBe(
      'https://apps.apple.com/app/hands-partner/id123?referral_code=PARTNER123&referral_audience=partner',
    );
  });

  it('reports per-platform store URL readiness for referral operators', () => {
    expect(
      referralStoreSetupState('customer', {
        REFERRAL_PUBLIC_BASE_URL: 'https://hands.vn',
        REFERRAL_CUSTOMER_ANDROID_STORE_URL: 'https://play.google.com/store/apps/details?id=com.massagevn.customer',
      }),
    ).toEqual({ android: true, ios: false, publicBase: true });

    expect(
      referralStoreSetupState('partner', {
        REFERRAL_PARTNER_ANDROID_STORE_URL: 'not-a-url',
        PARTNER_IOS_APP_URL: 'https://apps.apple.com/app/hands-partner/id123',
      }),
    ).toEqual({ android: false, ios: true, publicBase: false });
  });
});
