import { buildPartnerBankReviewTimeline } from './partner-detail-bank-review-timeline-model';

describe('buildPartnerBankReviewTimeline', () => {
  it('connects a previous correction request to the newly submitted primary bank account', () => {
    const timeline = buildPartnerBankReviewTimeline({
      bank: {
        createdAt: '2026-06-21T02:00:00.000Z',
        id: 'bank-new',
        status: 'PENDING_REVIEW',
      },
      bankAccounts: [
        {
          id: 'bank-new',
          status: 'PENDING_REVIEW',
        },
        {
          id: 'bank-old',
          rejectionReason: 'Account holder mismatch.',
          status: 'REJECTED',
        },
      ],
      logs: [
        {
          action: 'bank_account.submit',
          createdAt: '2026-06-21T02:00:00.000Z',
          id: 'log-submit',
          metadata: { bankAccountId: 'bank-new' },
          toStatus: 'PENDING_REVIEW',
        },
        {
          action: 'bank_account.rejected',
          actor: { fullName: 'Admin Hoa' },
          createdAt: '2026-06-20T03:00:00.000Z',
          id: 'log-reject',
          metadata: { bankAccountId: 'bank-old', reason: 'Account holder mismatch.' },
          toStatus: 'REJECTED',
        },
      ],
    });

    expect(timeline).toEqual([
      expect.objectContaining({
        actorLabel: 'Admin Hoa',
        detail: 'Reason: Account holder mismatch.',
        id: 'log-reject',
        title: 'Correction requested',
        tone: 'danger',
      }),
      expect.objectContaining({
        actorLabel: 'Partner app',
        detail: 'Partner submitted corrected bank details.',
        id: 'log-submit',
        title: 'Bank correction submitted',
        tone: 'info',
      }),
    ]);
  });

  it('renders current bank approval history without unrelated bank logs', () => {
    const timeline = buildPartnerBankReviewTimeline({
      bank: {
        id: 'bank-current',
        status: 'APPROVED',
      },
      bankAccounts: [{ id: 'bank-current', status: 'APPROVED' }],
      logs: [
        {
          action: 'bank_account.approved',
          actor: { phone: '+84865907184' },
          createdAt: '2026-06-22T03:00:00.000Z',
          id: 'log-approved',
          metadata: { bankAccountId: 'bank-current' },
          toStatus: 'APPROVED',
        },
        {
          action: 'bank_account.rejected',
          createdAt: '2026-06-20T03:00:00.000Z',
          id: 'log-other-bank',
          metadata: { bankAccountId: 'bank-other', reason: 'Ignored.' },
          toStatus: 'REJECTED',
        },
      ],
    });

    expect(timeline).toEqual([
      expect.objectContaining({
        actorLabel: '+84865907184',
        id: 'log-approved',
        title: 'Bank details approved',
        tone: 'success',
      }),
    ]);
  });
});
