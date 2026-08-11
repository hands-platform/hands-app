import type { AdminProvider } from '../../lib/admin-api';
import {
  buildPartnerReviewActionConfirmation,
  partnerReviewActionConfirmHref,
  readPartnerReviewConfirmationAction,
} from './partner-review-action-confirmation';

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-review-123456',
    displayName: 'Linh Wellness',
    status: 'OFFLINE',
    kyc: { id: 'kyc-1', status: 'PENDING' },
    documents: [
      { id: 'document-front-123456', type: 'CCCD_FRONT', status: 'PENDING_REVIEW' },
      { id: 'document-back-123456', type: 'CCCD_BACK', status: 'APPROVED' },
      { id: 'document-selfie-123456', type: 'SELFIE', status: 'APPROVED' },
    ],
    bankAccounts: [
      {
        id: 'bank-account-123456',
        accountHolderName: 'Nguyen Thi Linh',
        bankName: 'VCB',
        isPrimary: true,
        status: 'PENDING_REVIEW',
      },
    ],
    taxProfile: { id: 'tax-1', status: 'PENDING' },
    user: {
      fileAssets: [
        {
          id: 'media-file-123456',
          contentType: 'image/jpeg',
          key: 'partners/linh/profile.jpg',
          purpose: 'PROFILE_PHOTO',
          reviewStatus: 'PENDING_REVIEW',
          uploadStatus: 'UPLOADED',
          visibility: 'PUBLIC',
        },
      ],
    },
    ...input,
  } as AdminProvider;
}

describe('partner review action confirmation', () => {
  it('builds a document approval confirmation with target hidden inputs', () => {
    const confirmation = buildPartnerReviewActionConfirmation([partner()], 'approve-document', {
      bankAccountId: '',
      documentId: 'document-front-123456',
      fileId: '',
      providerId: 'partner-review-123456',
    });

    expect(confirmation).toMatchObject({
      action: 'approve-document',
      confirmLabel: 'Approve document',
      disabled: false,
      hiddenInputs: [
        { name: 'providerId', value: 'partner-review-123456' },
        { name: 'documentId', value: 'document-front-123456' },
      ],
      textInputs: [],
      tone: 'success',
    });
    expect(confirmation?.description).toContain('CCCD front side');
  });

  it('requires a reason for rejection actions', () => {
    const confirmation = buildPartnerReviewActionConfirmation([partner()], 'reject-bank', {
      bankAccountId: 'bank-account-123456',
      documentId: '',
      fileId: '',
      providerId: 'partner-review-123456',
    });

    expect(confirmation?.textInputs).toEqual([
      {
        defaultValue: 'Withdrawal bank information is incorrect, so the payout cannot be sent.',
        label: 'Reason',
        maxLength: 500,
        minLength: 12,
        name: 'reason',
        placeholder: 'Partner withdrawal detail correction reason',
        required: true,
      },
    ]);
    expect(confirmation?.description).toContain('manual wallet withdrawal or deposit checks');
    expect(confirmation?.description).toContain('withdrawal details');
  });

  it('allows one overall KYC approval when required identity documents are submitted', () => {
    const confirmation = buildPartnerReviewActionConfirmation([partner()], 'approve-kyc', {
      bankAccountId: '',
      documentId: '',
      fileId: '',
      providerId: 'partner-review-123456',
    });

    expect(confirmation?.disabled).toBe(false);
    expect(confirmation?.tone).toBe('success');
    expect(confirmation?.description).toContain('after reviewing required identity evidence');
  });

  it('disables KYC approval until every required identity document is submitted', () => {
    const confirmation = buildPartnerReviewActionConfirmation(
      [
        partner({
          documents: [{ id: 'document-front-123456', type: 'CCCD_FRONT', status: 'PENDING_REVIEW' }],
        }),
      ],
      'approve-kyc',
      {
        bankAccountId: '',
        documentId: '',
        fileId: '',
        providerId: 'partner-review-123456',
      },
    );

    expect(confirmation?.disabled).toBe(true);
    expect(confirmation?.tone).toBe('neutral');
    expect(confirmation?.description).toContain('Required documents must be submitted first');
  });

  it('builds public media and tax confirmations', () => {
    const provider = partner();
    const mediaConfirmation = buildPartnerReviewActionConfirmation([provider], 'approve-media', {
      bankAccountId: '',
      documentId: '',
      fileId: 'media-file-123456',
      providerId: provider.id,
    });
    const taxConfirmation = buildPartnerReviewActionConfirmation([provider], 'reject-tax', {
      bankAccountId: '',
      documentId: '',
      fileId: '',
      providerId: provider.id,
    });

    expect(mediaConfirmation?.confirmLabel).toBe('Approve media');
    expect(mediaConfirmation?.hiddenInputs).toContainEqual({ name: 'fileId', value: 'media-file-123456' });
    expect(taxConfirmation?.confirmLabel).toBe('Reject tax');
    expect(taxConfirmation?.textInputs[0]?.placeholder).toBe('Tax rejection reason for Partner app correction');
  });

  it('returns null when the provider or target is not loaded', () => {
    expect(
      buildPartnerReviewActionConfirmation([partner()], 'approve-document', {
        bankAccountId: '',
        documentId: 'missing',
        fileId: '',
        providerId: 'partner-review-123456',
      }),
    ).toBeNull();
    expect(
      buildPartnerReviewActionConfirmation([partner()], 'approve-bank', {
        bankAccountId: 'bank-account-123456',
        documentId: '',
        fileId: '',
        providerId: 'missing',
      }),
    ).toBeNull();
  });

  it('reads only supported review confirmation actions', () => {
    expect(readPartnerReviewConfirmationAction('approve-document')).toBe('approve-document');
    expect(readPartnerReviewConfirmationAction('reject-media')).toBe('reject-media');
    expect(readPartnerReviewConfirmationAction('delete')).toBeNull();
  });

  it('encodes review confirmation URLs', () => {
    expect(
      partnerReviewActionConfirmHref('partner 1', 'reject-document', {
        documentId: 'document 1',
      }),
    ).toBe('/partners?providerId=partner+1&reviewAction=reject-document&documentId=document+1');
  });

  it('supports detail page confirmation URLs and cancel targets', () => {
    const confirmation = buildPartnerReviewActionConfirmation(
      [partner()],
      'approve-kyc',
      {
        bankAccountId: '',
        documentId: '',
        fileId: '',
        providerId: 'partner-review-123456',
      },
      { cancelHref: '/partners/partner-review-123456?section=full' },
    );

    expect(confirmation?.cancelHref).toBe('/partners/partner-review-123456?section=full');
    expect(
      partnerReviewActionConfirmHref('partner-review-123456', 'approve-kyc', {}, {
        baseHref: '/partners/partner-review-123456?section=full',
      }),
    ).toBe('/partners/partner-review-123456?section=full&providerId=partner-review-123456&reviewAction=approve-kyc');
  });

  it('builds Partner app correction copy for KYC rejection from detail', () => {
    const confirmation = buildPartnerReviewActionConfirmation(
      [partner()],
      'reject-kyc',
      {
        bankAccountId: '',
        documentId: '',
        fileId: '',
        providerId: 'partner-review-123456',
      },
      { cancelHref: '/partners/partner-review-123456?section=full' },
    );

    expect(confirmation?.description).toBe(
      'Reject KYC for Partner Linh Wellness and show the reason in the Partner app correction checklist for resubmission.',
    );
    expect(confirmation?.textInputs[0]?.placeholder).toBe('KYC rejection reason for Partner app correction');
  });
});
