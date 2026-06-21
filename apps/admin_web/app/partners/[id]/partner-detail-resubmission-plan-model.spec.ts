import {
  buildProviderResubmissionPlan,
  providerDocumentResubmissionInstruction,
} from './partner-detail-resubmission-plan-model';

describe('partner detail resubmission plan model', () => {
  it('collects rejected KYC, document, bank, and tax correction rows', () => {
    const plan = buildProviderResubmissionPlan({
      bankAccounts: [
        {
          bankName: 'VCB',
          rejectionReason: 'Account holder mismatch.',
          status: 'REJECTED',
        },
      ],
      documents: [
        {
          rejectionReason: 'Front image is blurry.',
          status: 'REJECTED',
          type: 'CCCD_FRONT',
        },
        {
          rejectionReason: 'Ignored pending doc.',
          status: 'PENDING',
          type: 'SELFIE',
        },
      ],
      kyc: {
        rejectionReason: 'Identity fields do not match.',
        status: 'REJECTED',
      },
      taxProfile: {
        rejectionReason: 'Tax code missing.',
        status: 'REJECTED',
      },
    });

    expect(plan.items).toHaveLength(4);
    expect(plan.items.map((item) => item.operatorAction)).toEqual(['KYC', 'Doc', 'Bank', 'Tax']);
    expect(plan.items[1]).toMatchObject({
      providerInstruction:
        'Ask for a clear front-side CCCD/CMND image with readable number, full name, and no glare.',
      reason: 'Front image is blurry.',
      status: 'REJECTED',
    });
    expect(plan.items[2]).toMatchObject({
      providerInstruction:
        'Ask the Partner to correct wallet bank details. When resubmitted, the bank row returns to pending review for manual wallet checks.',
      target: 'VCB bank account',
    });
  });

  it('uses fallback reasons when rejection notes are missing', () => {
    const plan = buildProviderResubmissionPlan({
      bankAccounts: [{ bankName: 'VCB', status: 'REJECTED' }],
      documents: [{ status: 'REJECTED', type: 'SELFIE' }],
      kyc: { status: 'REJECTED' },
      taxProfile: { status: 'REJECTED' },
    });

    expect(plan.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'No rejection reason was saved.' }),
        expect.objectContaining({ reason: 'No document rejection reason was saved.' }),
        expect.objectContaining({ reason: 'No bank rejection reason was saved.' }),
        expect.objectContaining({ reason: 'No tax rejection reason was saved.' }),
      ]),
    );
  });

  it('maps document-specific resubmission instructions', () => {
    expect(providerDocumentResubmissionInstruction('CCCD_BACK')).toContain('back-side');
    expect(providerDocumentResubmissionInstruction('SELFIE')).toContain('live selfie');
    expect(providerDocumentResubmissionInstruction('BANK_QR')).toContain('bank QR');
    expect(providerDocumentResubmissionInstruction('PROFILE_PHOTO')).toContain('clearer replacement');
  });
});
