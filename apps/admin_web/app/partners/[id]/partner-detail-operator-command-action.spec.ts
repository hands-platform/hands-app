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
      '/partners/partner-detail-123456?section=control&control=work&confirm=approve&providerId=partner-detail-123456',
    );
    expect(
      partnerOperatorCommandActionHref('partner-detail-123456', {
        label: 'Reject profile',
        type: 'reject-profile',
      }),
    ).toContain('confirm=reject');
    expect(
      partnerOperatorCommandActionHref('partner-detail-123456', {
        label: 'Hold Partner',
        type: 'hold-account',
      }),
    ).toContain('confirm=block');
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
      '/partners/partner-detail-123456?section=control&control=work&providerId=partner-detail-123456&reviewAction=approve-kyc',
    );
    expect(
      partnerOperatorCommandActionHref('partner-detail-123456', {
        label: 'Reject KYC',
        type: 'reject-kyc',
      }),
    ).toContain('reviewAction=reject-kyc');
    expect(
      partnerOperatorCommandActionHref('partner-detail-123456', {
        bankAccountId: 'bank-account-123456',
        label: 'Approve bank',
        type: 'approve-bank',
      }),
    ).toBe(
      '/partners/partner-detail-123456?section=control&control=work&providerId=partner-detail-123456&reviewAction=approve-bank&bankAccountId=bank-account-123456',
    );
    expect(
      partnerOperatorCommandActionHref('partner-detail-123456', {
        bankAccountId: 'bank-account-123456',
        label: 'Reject bank',
        type: 'reject-bank',
      }),
    ).toContain('reviewAction=reject-bank&bankAccountId=bank-account-123456');
    expect(
      partnerOperatorCommandActionHref('partner-detail-123456', {
        label: 'Approve tax',
        type: 'approve-tax',
      }),
    ).toContain('reviewAction=approve-tax');
    expect(
      partnerOperatorCommandActionHref('partner-detail-123456', {
        label: 'Reject tax',
        type: 'reject-tax',
      }),
    ).toContain('reviewAction=reject-tax');
  });
});
