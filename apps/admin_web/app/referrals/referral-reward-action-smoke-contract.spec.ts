import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..', '..');

describe('referral reward action smoke contract', () => {
  it('exposes a scoped smoke command for referral reward decisions and audit trails', () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const scriptSource = readFileSync(resolve(root, 'infra/scripts/referral-reward-action-smoke.mjs'), 'utf8');

    expect(packageJson.scripts?.['referrals:reward-action-smoke']).toBe(
      'node infra/scripts/referral-reward-action-smoke.mjs',
    );
    expect(scriptSource).toContain('referral-smoke-seed.mjs');
    expect(scriptSource).toContain('/admin/referrals/rewards/smoke_referral_customer_pending_reward/hold');
    expect(scriptSource).toContain('/admin/referrals/rewards/smoke_referral_customer_available_reward/credit');
    expect(scriptSource).toContain('/admin/referrals/rewards/smoke_referral_partner_pending_reward/reverse');
    expect(scriptSource).toContain('referral_reward.hold');
    expect(scriptSource).toContain('referral_reward.credit');
    expect(scriptSource).toContain('referral_reward.reverse');
    expect(scriptSource).toContain('customerWalletLedgerEntry');
    expect(scriptSource).toContain('ReferralRewardStatus.REWARDED');
    expect(scriptSource).toContain('walletCreditCreated');
    expect(scriptSource).toContain('smoke_referral_customer_parent_profile');
    expect(scriptSource).toContain('smoke_referral_partner_parent_profile');
  });
});
