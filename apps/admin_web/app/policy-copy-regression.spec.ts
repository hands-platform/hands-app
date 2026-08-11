import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('admin policy copy regression', () => {
  it('keeps cash debt copy aligned with final gate policy on large admin pages', () => {
    const source = readAdminWebSource([
      'app/page.tsx',
      'app/start-shift-operations-command-board.ts',
      'app/operations-policy/policy-enforcement-trace.ts',
      'app/cash-settlements/page.tsx',
      'app/cash-settlements/cash-settlement-open-debt-table-section.tsx',
      'app/partner-controls/page.tsx',
    ]);

    expect(source).not.toContain('before marketplace alerts and participation');
    expect(source).not.toContain('before marketplace alerts, participation, or payout release');
    expect(source).not.toContain('gates marketplace alerts and participation');
    expect(source).not.toContain('marketplace alerts and participation wait');

    expect(source).toContain('before final acceptance, service start, and payout release');
    expect(source).toContain(
      'Negative wallet keeps marketplace list visibility, but final acceptance, service start, and payout release wait for cash fee settlement.',
    );
  });

  it('keeps partner finance copy aligned with Level 2 and withdrawal policy', () => {
    const source = readAdminWebSource([
      'app/partners/[id]/page.tsx',
      'app/partners/[id]/partner-detail-acceptance-model.tsx',
      'app/partners/[id]/partner-detail-finance-gate-section.tsx',
      'app/partner-controls/page.tsx',
    ]);

    expect(source).not.toContain('Withdrawal bank');
    expect(source).not.toContain('Withdrawal bank account');
    expect(source).not.toContain('Legacy tax profile');
    expect(source).not.toContain('Legacy tax ');
    expect(source).not.toContain('Legacy tax record');
    expect(source).not.toContain('legacy tax records');
    expect(source).not.toContain('Bank payout review');
    expect(source).not.toContain('WITHDRAWAL BANK');

    expect(source).toContain('Withdrawal details');
    expect(source).toContain('Tax profile optional');
    expect(source).toContain('Optional tax record');
    expect(source).toContain(
      'Bank details are collected and approved when the Partner requests wallet withdrawal.',
    );
    expect(source).toContain(
      'Tax profile registration is not required for Vietnam MVP partner approval, matching, work, payout, or wallet withdrawal.',
    );
  });
});

function readAdminWebSource(relativePaths: string[]) {
  const root = adminWebRoot();
  return relativePaths.map((relativePath) => readFileSync(join(root, relativePath), 'utf8')).join('\n');
}

function adminWebRoot() {
  return process.cwd().replaceAll('\\', '/').endsWith('/apps/admin_web')
    ? process.cwd()
    : join(process.cwd(), 'apps/admin_web');
}
