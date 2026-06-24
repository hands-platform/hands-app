import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..', '..');

describe('referral public link smoke contract', () => {
  it('exposes a scoped smoke command for customer and Partner public referral links', () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/referral-public-link-smoke.mjs'), 'utf8');

    expect(packageJson.scripts?.['referrals:public-link-smoke']).toBe(
      'node infra/scripts/referral-public-link-smoke.mjs',
    );
    expect(scriptSource).toContain('/r/customer/SMOKECUSTREF');
    expect(scriptSource).toContain('/r/partner/SMOKEPARTREF');
    expect(scriptSource).toContain('Android');
    expect(scriptSource).toContain('iPhone');
    expect(scriptSource).toContain('referral_code');
    expect(scriptSource).toContain('referral_audience');
    expect(scriptSource).toContain('REFERRAL_CUSTOMER_ANDROID_STORE_URL');
    expect(scriptSource).toContain('REFERRAL_PARTNER_IOS_STORE_URL');
    expect(scriptSource).toContain('--dry-run');
  });
});
