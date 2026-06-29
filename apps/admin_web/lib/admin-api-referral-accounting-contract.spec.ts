import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..');
const adminApiSource = readFileSync(resolve(root, 'apps/admin_web/lib/admin-api.ts'), 'utf8');

const referralAccountingRewardStatuses = [
  'APPROVED',
  'LOCKED',
  'CREDITED',
  'USED_FOR_SERVICE',
  'OFFSET',
  'CASHOUT_REQUESTED',
  'CASHOUT_APPROVED',
  'PAID',
  'TAX_REVIEW_REQUIRED',
] as const;

const providerReferralWalletLedgerTypes = [
  'PARTNER_REFERRAL_EARNED',
  'PARTNER_REFERRAL_TAX_WITHHELD',
  'OFFSET_PLATFORM_FEE',
  'OFFSET_PARTNER_TAX',
  'OFFSET_NEGATIVE_WALLET',
  'PARTNER_REFERRAL_CASHOUT',
  'PARTNER_REFERRAL_REVERSED',
] as const;

describe('admin api referral accounting contract', () => {
  it('keeps referral reward status and provider wallet ledger unions aligned with API accounting enums', () => {
    for (const status of referralAccountingRewardStatuses) {
      expect(adminApiSource).toContain(`| '${status}'`);
    }

    for (const type of providerReferralWalletLedgerTypes) {
      expect(adminApiSource).toContain(`| '${type}'`);
    }
  });
});
