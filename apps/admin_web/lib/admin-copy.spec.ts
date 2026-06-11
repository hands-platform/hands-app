import { marketplaceDisplayText, partnerDisplayText } from './admin-copy';

describe('admin visible copy helpers', () => {
  it('keeps visible operations copy partner-led while preserving internal payload names elsewhere', () => {
    expect(partnerDisplayText('Provider accepted the provider request')).toBe(
      'Partner accepted the partner request',
    );
    expect(partnerDisplayText('3 PROVIDER(S) joined')).toBe('3 PARTNER(S) joined');
    expect(partnerDisplayText('preferredProviderId providerProfileId')).toBe(
      'preferredPartnerId partnerProfileId',
    );
  });

  it('rewrites legacy backup wording into marketplace wording for operators', () => {
    expect(marketplaceDisplayText('Backup partner joined the backup list')).toBe(
      'Marketplace partner joined the marketplace list',
    );
    expect(marketplaceDisplayText('backup-open backup-radius backupNotificationTraces')).toBe(
      'marketplace-open marketplace-radius candidate alert traces',
    );
  });

  it('removes automatic penalty language from marketplace closeout copy', () => {
    expect(marketplaceDisplayText('false penalties can create customer or partner penalties')).toBe(
      'incorrect automatic decisions can create customer or partner closeout decisions',
    );
  });
});
