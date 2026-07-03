import { financePersonName } from './finance-participant-label';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('finance participant labels', () => {
  it('prefers full name, then phone, then fallback for finance evidence rows', () => {
    expect(financePersonName({ fullName: 'Demo Customer', phone: '+84900000001' }, 'Unknown customer')).toBe(
      'Demo Customer',
    );
    expect(financePersonName({ fullName: null, phone: '+84900000001' }, 'Unknown customer')).toBe('+84900000001');
    expect(financePersonName({ fullName: '', phone: '' }, 'Unknown customer')).toBe('Unknown customer');
    expect(financePersonName(null, 'Unknown partner')).toBe('Unknown partner');
  });

  it.each([
    'app/finance-tax/booking-settlement-audit/page.tsx',
    'app/finance-tax/booking-settlement-audit/[id]/page.tsx',
    'app/finance-tax/coupon-finance/page.tsx',
    'app/finance-tax/general-ledger/page.tsx',
    'app/finance-tax/settlement-reversals/page.tsx',
    'app/finance-tax/settlement-reversals/[id]/page.tsx',
  ])('uses the shared participant label helper in %s', (sourcePath) => {
    const source = readFileSync(join(process.cwd(), sourcePath), 'utf8');

    expect(source).toContain('financePersonName');
    expect(source).not.toContain('function personName');
  });
});
