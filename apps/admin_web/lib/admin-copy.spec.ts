import {
  adminCountLabel,
  adminWorkflowStatusLabel,
  adminActionTitleText,
  marketplaceDisplayText,
  partnerDisplayText,
  partnerOperatingStatusLabel,
} from './admin-copy';

describe('admin visible copy helpers', () => {
  it('renders natural singular and plural count labels', () => {
    expect(adminCountLabel(0, 'booking')).toBe('0 bookings');
    expect(adminCountLabel(1, 'booking')).toBe('1 booking');
    expect(adminCountLabel(2, 'case', 'cases')).toBe('2 cases');
  });

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
      'Marketplace Partner joined the marketplace list',
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

  it('humanizes internal action slugs for operator titles', () => {
    expect(adminActionTitleText('provider.supabase_role_sync.skipped')).toBe(
      'Partner Supabase Role Sync Skipped',
    );
    expect(adminActionTitleText('booking.matched.first_pick_accepted')).toBe(
      'Booking Matched First Pick Accepted',
    );
    expect(adminActionTitleText('First-pick accepted')).toBe('First-pick accepted');
  });

  it('maps Partner operating enums to operator wording', () => {
    expect(partnerOperatingStatusLabel('DRAFT')).toBe('Profile draft');
    expect(partnerOperatingStatusLabel('DEFERRED')).toBe('Review postponed');
    expect(partnerOperatingStatusLabel('MANUAL_OFFLINE')).toBe('Taken offline by an operator');
    expect(partnerOperatingStatusLabel('missing')).toBe('Required information missing');
    expect(partnerOperatingStatusLabel('LEVEL_1_SIGNUP')).toBe('Level 1 signup');
  });

  it('maps workflow enums to consistent operator wording', () => {
    expect(adminWorkflowStatusLabel('OPEN')).toBe('Needs action');
    expect(adminWorkflowStatusLabel('HELD')).toBe('On hold');
    expect(adminWorkflowStatusLabel('REVIEW_REQUIRED')).toBe('Review required');
    expect(adminWorkflowStatusLabel('BANK_TRANSFER_PENDING')).toBe('Bank transfer pending');
  });
});
