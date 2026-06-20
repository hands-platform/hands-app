import type { AdminProvider } from '../../lib/admin-api';
import type { ActionMenuItem } from '../../components/action-menu';
import {
  partnerAccountActionMenuItems,
  partnerBankReviewActionMenuItems,
  partnerDocumentReviewActionMenuItems,
  partnerKycReviewActionMenuItems,
  partnerPublicMediaReviewActionMenuItems,
  partnerTaxReviewActionMenuItems,
} from './partner-action-menu-items';

describe('partner action menu items', () => {
  it('builds account actions for an approved open Partner', () => {
    const actions = partnerAccountActionMenuItems(provider({ verification: { id: 'verification-1', status: 'APPROVED' } }));

    expect(actions.map((action) => action.label)).toEqual([
      'Approve',
      'Reject',
      'Sync role',
      'Hold',
      'Open detail',
    ]);
    expect(actions[2]).toEqual(
      expect.objectContaining({
        disabled: false,
        href: '/partners?confirm=sync-role&providerId=partner-1',
        tone: 'info',
      }),
    );
    expect(actions[3]).toEqual(
      expect.objectContaining({
        href: '/partners?confirm=block&providerId=partner-1',
        tone: 'warning',
      }),
    );
  });

  it('uses release hold instead of hold for a held Partner', () => {
    const actions = partnerAccountActionMenuItems(provider({ blockedAt: '2026-06-09T10:00:00.000Z' }));

    expect(actions.map((action) => action.label)).toContain('Release hold');
    expect(actions.map((action) => action.label)).not.toContain('Hold');
  });

  it('builds review actions with disabled states matching current review status', () => {
    const documentActions = partnerDocumentReviewActionMenuItems('partner-1', {
      id: 'document-1',
      status: 'APPROVED',
      type: 'ID_CARD_FRONT',
    });
    const bankActions = partnerBankReviewActionMenuItems('partner-1', {
      accountHolderName: 'Linh Wellness',
      accountNumberMasked: '****6789',
      bankName: 'VCB',
      id: 'bank-1',
      isPrimary: true,
      status: 'REJECTED',
    });
    const mediaActions = partnerPublicMediaReviewActionMenuItems('partner-1', {
      contentType: 'image/png',
      id: 'file-1',
      key: 'partners/partner-1/profile.png',
      purpose: 'profile',
      reviewStatus: 'PENDING_REVIEW',
      url: 'https://example.test/media.png',
      visibility: 'PUBLIC',
    });

    expect(documentActions[0]).toEqual(expect.objectContaining({ disabled: true, label: 'Approve doc' }));
    expect(documentActions[1]).toEqual(expect.objectContaining({ disabled: false, label: 'Reject doc' }));
    expect(bankActions[0]).toEqual(expect.objectContaining({ disabled: false, label: 'Approve bank' }));
    expect(bankActions[1]).toEqual(expect.objectContaining({ disabled: true, label: 'Reject bank' }));
    expect(linkHrefs(mediaActions)).toEqual([
      '/partners?providerId=partner-1&reviewAction=approve-media&fileId=file-1',
      '/partners?providerId=partner-1&reviewAction=reject-media&fileId=file-1',
    ]);
  });

  it('builds KYC and tax review actions from Partner state', () => {
    const actions = partnerKycReviewActionMenuItems(provider({ kyc: { id: 'kyc-1', status: 'DRAFT' } }), false);
    const taxActions = partnerTaxReviewActionMenuItems(
      provider({
        taxProfile: {
          id: 'tax-1',
          legalName: 'Linh Wellness',
          registeredAddress: 'District 1, Ho Chi Minh City',
          status: 'APPROVED',
        },
      }),
    );

    expect(actions[0]).toEqual(expect.objectContaining({ disabled: true, label: 'Approve KYC' }));
    expect(actions[1]).toEqual(expect.objectContaining({ disabled: false, label: 'Reject KYC' }));
    expect(taxActions[0]).toEqual(expect.objectContaining({ disabled: true, label: 'Approve tax' }));
    expect(taxActions[1]).toEqual(expect.objectContaining({ disabled: false, label: 'Reject tax' }));
  });
});

function provider(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    displayName: 'Linh Wellness',
    id: 'partner-1',
    status: 'ONLINE_AVAILABLE',
    ...input,
  };
}

function linkHrefs(actions: readonly ActionMenuItem[]): readonly string[] {
  return actions.flatMap((action) => (action.kind === 'link' ? [action.href] : []));
}
