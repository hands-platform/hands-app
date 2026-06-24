import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..', '..');

describe('referral claim API smoke contract', () => {
  it('exposes a scoped smoke command for customer and Partner referral claim attribution', () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/referral-claim-api-smoke.mjs'), 'utf8');

    expect(packageJson.scripts?.['referrals:claim-api-smoke']).toBe(
      'node infra/scripts/referral-claim-api-smoke.mjs',
    );
    expect(scriptSource).toContain('referral-smoke-seed.mjs');
    expect(scriptSource).toContain('/customer/referrals/claim');
    expect(scriptSource).toContain('/partner/referrals/claim');
    expect(scriptSource).toContain('smoke_referral_claim_customer_profile');
    expect(scriptSource).toContain('smoke_referral_claim_partner_profile');
    expect(scriptSource).toContain('SMOKECUSTREF');
    expect(scriptSource).toContain('SMOKEPARTREF');
    expect(scriptSource).toContain('ReferralAttributionStatus.REGISTERED');
    expect(scriptSource).toContain('--dry-run');
  });
});
