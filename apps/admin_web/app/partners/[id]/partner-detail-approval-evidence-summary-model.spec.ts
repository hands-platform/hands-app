import {
  approvalEvidenceStatusTone,
  buildPartnerApprovalEvidenceSummaryRows,
} from './partner-detail-approval-evidence-summary-model';

const kycEvidence = {
  allRequiredApproved: false,
  decisionChecklist: [],
  nextAction: 'Review KYC evidence.',
  rows: [
    {
      fileLabel: 'front.jpg',
      label: 'CCCD front',
      status: 'APPROVED',
      type: 'CCCD_FRONT',
    },
    {
      fileLabel: 'selfie.jpg',
      label: 'Selfie',
      rejectionReason: 'Blurry image',
      status: 'REJECTED',
      type: 'SELFIE',
    },
  ],
};

describe('partner detail approval evidence summary model', () => {
  it('maps KYC, document, bank, and tax evidence summary rows', () => {
    const rows = buildPartnerApprovalEvidenceSummaryRows({
      hasFirstRevenue: true,
      kycEvidence,
      primaryBank: {
        accountHolderName: 'Tran Linh',
        accountNumberMasked: '****1234',
        bankName: 'VCB',
        status: 'APPROVED',
      },
      provider: {
        id: 'partner-1',
        kyc: {
          cccdNumberLast4: '6789',
          status: 'PENDING',
          submittedAt: '2026-06-13T03:15:00.000Z',
        },
        taxProfile: {
          legalName: 'Tran Linh',
          registeredAddress: 'Da Nang',
          status: 'APPROVED',
          taxCodeLast4: '2222',
        },
      },
    });

    expect(rows).toHaveLength(4);
    expect(rows.find((row) => row.id === 'kyc-evidence-summary')).toMatchObject({
      detail: expect.stringContaining('****6789'),
      status: 'PENDING',
      tone: 'pill-warn',
    });
    expect(rows.find((row) => row.id === 'document-evidence-summary')).toMatchObject({
      detail: '1/2 required document(s) approved; 1 rejected.',
      status: 'REJECTED',
      tone: 'pill-danger',
    });
    expect(rows.find((row) => row.id === 'bank-evidence-summary')).toMatchObject({
      detail: 'VCB / Tran Linh / ****1234.',
      title: 'Withdrawal details ready',
      status: 'APPROVED',
      tone: 'pill-success',
    });
    expect(rows.find((row) => row.id === 'tax-evidence-summary')).toMatchObject({
      title: 'Optional tax profile approved',
      status: 'APPROVED',
      tone: 'pill-success',
    });
  });

  it('keeps tax and withdrawal evidence deferred until the wallet flow requests them', () => {
    const rows = buildPartnerApprovalEvidenceSummaryRows({
      hasFirstRevenue: false,
      kycEvidence: { ...kycEvidence, rows: [] },
      primaryBank: null,
      provider: { id: 'partner-1' },
    });

    expect(rows.find((row) => row.id === 'kyc-evidence-summary')).toMatchObject({
      status: 'MISSING',
      tone: 'pill-danger',
    });
    expect(rows.find((row) => row.id === 'bank-evidence-summary')).toMatchObject({
      title: 'Withdrawal details on request',
      detail: 'Collected only when the Partner requests wallet withdrawal/deposit or manual settlement.',
      status: 'ON_REQUEST',
      tone: 'pill-neutral',
    });
    expect(rows.find((row) => row.id === 'tax-evidence-summary')).toMatchObject({
      title: 'Tax profile optional',
      status: 'DEFERRED',
      tone: 'pill-neutral',
    });
  });

  it('maps approval status tones', () => {
    expect(approvalEvidenceStatusTone('APPROVED')).toBe('pill-success');
    expect(approvalEvidenceStatusTone('REJECTED')).toBe('pill-danger');
    expect(approvalEvidenceStatusTone('MISSING')).toBe('pill-danger');
    expect(approvalEvidenceStatusTone('DEFERRED')).toBe('pill-neutral');
    expect(approvalEvidenceStatusTone('PENDING')).toBe('pill-warn');
  });
});
