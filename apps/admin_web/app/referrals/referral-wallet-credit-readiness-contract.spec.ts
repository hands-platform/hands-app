import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

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
    expect(scriptSource).toContain('nest-admin-wallet-credit-endpoint');
    expect(scriptSource).toContain('blocked-by-missing-admin-credit-endpoint');
    expect(scriptSource).toContain('NestJS admin credit endpoint');
  });

  it('does not keep resolved customer wallet ledger work in next steps', () => {
    const output = execFileSync('node', ['infra/scripts/referral-wallet-credit-readiness.mjs'], {
      cwd: root,
      encoding: 'utf8',
    });
    const readiness = JSON.parse(output);

    expect(readiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'customer-wallet-ledger-model', ok: true }),
      ]),
    );
    expect(readiness.nextSteps).not.toContain(
      'Add an audited CustomerWalletLedger model before customer referral wallet credit.',
    );
  });

  it('keeps automatic referral payout blocked while admin credit remains manual', () => {
    const output = execFileSync('node', ['infra/scripts/referral-wallet-credit-readiness.mjs'], {
      cwd: root,
      encoding: 'utf8',
    });
    const readiness = JSON.parse(output);

    expect(readiness.readyForAutomaticWalletCredit).toBe(false);
    expect(readiness.decision).toBe('blocked-by-candidate-only-release');
    expect(readiness.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'automatic-release-writes-ledger', ok: false }),
        expect.objectContaining({ id: 'nest-admin-wallet-credit-endpoint', ok: true }),
      ]),
    );
    expect(readiness.nextSteps).not.toContain(
      'Implement the audited NestJS admin credit endpoint with idempotent walletLedgerReference linking.',
    );
    expect(readiness.nextSteps).not.toContain(
      'Add a NestJS admin credit endpoint and smoke before enabling referral payout.',
    );
  });
});
