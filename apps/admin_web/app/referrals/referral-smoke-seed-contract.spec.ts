import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..', '..');

describe('referral smoke seed contract', () => {
  it('exposes an idempotent seed command for customer and Partner referral admin UI checks', () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/referral-smoke-seed.mjs'), 'utf8');

    expect(packageJson.scripts?.['referrals:smoke-seed']).toBe(
      'node infra/scripts/referral-smoke-seed.mjs',
    );
    expect(scriptSource).toContain('smoke_referral_customer_parent_profile');
    expect(scriptSource).toContain('smoke_referral_partner_parent_profile');
    expect(scriptSource).toContain('/referrals/customers/smoke_referral_customer_parent_profile');
    expect(scriptSource).toContain('/referrals/partners/smoke_referral_partner_parent_profile');
    expect(scriptSource).toContain('--dry-run');
    expect(scriptSource).toContain('ReferralRewardStatus.PENDING');
    expect(scriptSource).toContain('ReferralRewardStatus.AVAILABLE');
    expect(scriptSource).toContain('walletLedgerReference: null');
    expect(scriptSource).toContain('sourceKey');
    expect(scriptSource).toContain('REFERRAL_SMOKE_ALLOW_MUTATION');
    expect(scriptSource).toContain('fixtureRunId');
    expect(scriptSource).not.toContain('seedPolicies()');
    expect(scriptSource).not.toContain('customerWalletLedgerEntry.deleteMany');
  });
});
