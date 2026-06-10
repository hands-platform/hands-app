import { partnerOperatorCommandActionHref } from './partner-detail-operator-command-action';

describe('partner detail operator command action', () => {
  it('keeps plain navigation commands as local links', () => {
    expect(
      partnerOperatorCommandActionHref('partner-detail-123456', {
        href: '#documents',
        label: 'Open docs',
        type: 'link',
      }),
    ).toBe('#documents');
  });

  it('routes account commands through Partner account confirmations', () => {
    expect(
      partnerOperatorCommandActionHref('partner-detail-123456', {
        label: 'Approve profile',
        type: 'approve-profile',
      }),
    ).toBe(
      '/partners/partner-detail-123456?section=full&confirm=approve&providerId=partner-detail-123456',
    );
    expect(
      partnerOperatorCommandActionHref('partner-detail-123456', {
        label: 'Sync role',
        type: 'sync-role',
      }),
    ).toContain('confirm=sync-role');
    expect(
      partnerOperatorCommandActionHref('partner-detail-123456', {
        label: 'Unblock',
        type: 'unblock-account',
      }),
    ).toContain('confirm=unblock');
  });

  it('routes review commands through Partner review confirmations', () => {
    expect(
      partnerOperatorCommandActionHref('partner-detail-123456', {
        label: 'Approve KYC',
        type: 'approve-kyc',
      }),
    ).toBe(
      '/partners/partner-detail-123456?section=full&providerId=partner-detail-123456&reviewAction=approve-kyc',
    );
    expect(
      partnerOperatorCommandActionHref('partner-detail-123456', {
        bankAccountId: 'bank-account-123456',
        label: 'Approve bank',
        type: 'approve-bank',
      }),
    ).toBe(
      '/partners/partner-detail-123456?section=full&providerId=partner-detail-123456&reviewAction=approve-bank&bankAccountId=bank-account-123456',
    );
    expect(
      partnerOperatorCommandActionHref('partner-detail-123456', {
        label: 'Approve tax',
        type: 'approve-tax',
      }),
    ).toContain('reviewAction=approve-tax');
  });
});
