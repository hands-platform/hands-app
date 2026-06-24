import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..', '..', '..', '..');

describe('referral wallet credit readiness contract', () => {
  it('exposes a read-only referral wallet credit readiness smoke before wallet payout is enabled', () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    const scriptPath = resolve(root, 'infra/scripts/referral-wallet-credit-readiness.mjs');

    expect(packageJson.scripts?.['referrals:wallet-credit-readiness']).toBe(
      'node infra/scripts/referral-wallet-credit-readiness.mjs',
    );
    expect(existsSync(scriptPath)).toBe(true);

    const scriptSource = readFileSync(scriptPath, 'utf8');
    expect(scriptSource).toContain('readyForAutomaticWalletCredit');
    expect(scriptSource).toContain('ProviderWalletLedgerEntry');
    expect(scriptSource).toContain('CustomerWalletLedger');
    expect(scriptSource).toContain('walletLedgerReference');
    expect(scriptSource).toContain('automatic-release-writes-ledger');
    expect(scriptSource).toContain('without creating wallet ledger entries');
    expect(scriptSource).toContain('blocked-by-missing-customer-wallet-ledger');
    expect(scriptSource).toContain('blocked-by-candidate-only-release');
    expect(scriptSource).toContain('NestJS admin credit endpoint');
  });
});
