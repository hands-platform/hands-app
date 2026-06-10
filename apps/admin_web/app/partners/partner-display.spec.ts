import type { AdminProvider } from '../../lib/admin-api';
import { providerDisplayName } from './partner-display';

describe('providerDisplayName', () => {
  it('uses the saved display name first', () => {
    expect(
      providerDisplayName({
        displayName: 'Linh Wellness',
        id: 'partner-1',
      } as AdminProvider),
    ).toBe('Linh Wellness');
  });

  it('falls back to user full name, phone, and id in order', () => {
    expect(
      providerDisplayName({
        id: 'partner-2',
        user: { fullName: 'Nguyen Linh', phone: '+84900000000' },
      } as AdminProvider),
    ).toBe('Nguyen Linh');
    expect(
      providerDisplayName({
        id: 'partner-3',
        user: { phone: '+84900000001' },
      } as AdminProvider),
    ).toBe('+84900000001');
    expect(providerDisplayName({ id: 'partner-4' } as AdminProvider)).toBe('partner-4');
  });

  it('normalizes legacy Provider wording through Admin copy rules', () => {
    expect(
      providerDisplayName({
        displayName: 'Provider Backup lane',
        id: 'partner-5',
      } as AdminProvider),
    ).toBe('Partner Marketplace lane');
  });
});
