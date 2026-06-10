import type { AdminProvider } from '../../lib/admin-api';
import {
  buildPartnerAccountActionConfirmation,
  partnerAccountActionConfirmHref,
  readPartnerAccountConfirmationAction,
} from './partner-account-action-confirmation';

const partner = {
  id: 'partner-account-123456',
  displayName: 'Linh Wellness',
  status: 'OFFLINE',
  verification: { id: 'verification-1', status: 'APPROVED' },
} as AdminProvider;

describe('partner account action confirmation', () => {
  it('builds an approve confirmation for a loaded Partner', () => {
    const confirmation = buildPartnerAccountActionConfirmation([partner], 'approve', partner.id);

    expect(confirmation).toEqual({
      action: 'approve',
      cancelHref: '/partners',
      confirmLabel: 'Approve Partner',
      description: 'Approve Partner Linh Wellness after identity, profile, and operating readiness review.',
      disabled: false,
      hiddenInputs: [{ name: 'providerId', value: partner.id }],
      providerId: partner.id,
      textInputs: [],
      title: 'Approve Partner partner-?',
      tone: 'success',
    });
  });

  it('requires a review reason for reject and block actions', () => {
    const reject = buildPartnerAccountActionConfirmation([partner], 'reject', partner.id);
    const block = buildPartnerAccountActionConfirmation([partner], 'block', partner.id);

    expect(reject?.textInputs).toEqual([
      {
        label: 'Reason',
        maxLength: 500,
        minLength: 12,
        name: 'reason',
        placeholder: 'Partner rejection reason',
        required: true,
      },
    ]);
    expect(block?.textInputs[0]?.placeholder).toBe('Account block reason');
  });

  it('disables Supabase role sync until verification is approved', () => {
    const draftPartner = {
      ...partner,
      verification: { id: 'verification-1', status: 'SUBMITTED' },
    } as AdminProvider;

    const confirmation = buildPartnerAccountActionConfirmation([draftPartner], 'sync-role', draftPartner.id);

    expect(confirmation?.disabled).toBe(true);
    expect(confirmation?.tone).toBe('neutral');
    expect(confirmation?.description).toBe(
      'Partner verification must be approved before syncing the Supabase role.',
    );
  });

  it('returns null for unsupported actions or unloaded Partners', () => {
    expect(buildPartnerAccountActionConfirmation([partner], null, partner.id)).toBeNull();
    expect(buildPartnerAccountActionConfirmation([partner], 'approve', 'missing')).toBeNull();
  });

  it('reads only supported account confirmation actions', () => {
    expect(readPartnerAccountConfirmationAction('approve')).toBe('approve');
    expect(readPartnerAccountConfirmationAction('reject')).toBe('reject');
    expect(readPartnerAccountConfirmationAction('block')).toBe('block');
    expect(readPartnerAccountConfirmationAction('unblock')).toBe('unblock');
    expect(readPartnerAccountConfirmationAction('sync-role')).toBe('sync-role');
    expect(readPartnerAccountConfirmationAction('delete')).toBeNull();
  });

  it('encodes confirmation URLs', () => {
    expect(partnerAccountActionConfirmHref('partner 1', 'block')).toBe(
      '/partners?confirm=block&providerId=partner%201',
    );
    expect(
      partnerAccountActionConfirmHref('partner-detail-123456', 'approve', {
        baseHref: '/partners/partner-detail-123456?section=full',
      }),
    ).toBe('/partners/partner-detail-123456?section=full&confirm=approve&providerId=partner-detail-123456');
  });
});
