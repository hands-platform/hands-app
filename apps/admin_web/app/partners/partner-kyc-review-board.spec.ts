import type { AdminProvider } from '../../lib/admin-api';
import { buildPartnerKycReviewBoard } from './partner-kyc-review-board';

function partner(input: Partial<AdminProvider> = {}): AdminProvider {
  return {
    id: 'partner-ready',
    displayName: 'Linh Wellness',
    verification: { id: 'verification-1', status: 'APPROVED' },
    kyc: { id: 'kyc-1', status: 'PENDING' },
    documents: [
      { id: 'doc-front', type: 'CCCD_FRONT', status: 'APPROVED' },
      { id: 'doc-back', type: 'CCCD_BACK', status: 'APPROVED' },
      { id: 'doc-selfie', type: 'SELFIE', status: 'APPROVED' },
    ],
    ...input,
  } as AdminProvider;
}

describe('partner KYC review board', () => {
  it('keeps document review and final KYC decisions in the correct operations order', () => {
    const board = buildPartnerKycReviewBoard(
      [
        partner({ id: 'ready', displayName: 'Ready Partner' }),
        partner({
          id: 'pending-document',
          displayName: 'Document Partner',
          documents: [
            { id: 'doc-front-2', type: 'CCCD_FRONT', status: 'PENDING_REVIEW' },
            { id: 'doc-back-2', type: 'CCCD_BACK', status: 'APPROVED' },
            { id: 'doc-selfie-2', type: 'SELFIE', status: 'APPROVED' },
          ],
        }),
        partner({
          id: 'missing-kyc',
          displayName: 'Missing Partner',
          kyc: undefined,
          documents: [],
        }),
        partner({
          id: 'missing-document',
          displayName: 'Incomplete Partner',
          documents: [
            { id: 'doc-front-4', type: 'CCCD_FRONT', status: 'PENDING_REVIEW' },
            { id: 'doc-back-4', type: 'CCCD_BACK', status: 'PENDING_REVIEW' },
          ],
        }),
        partner({
          id: 'rejected-kyc',
          displayName: 'Rejected Partner',
          kyc: { id: 'kyc-rejected', status: 'REJECTED' },
          documents: [
            { id: 'doc-front-3', type: 'CCCD_FRONT', status: 'APPROVED' },
            { id: 'doc-back-3', type: 'CCCD_BACK', status: 'APPROVED' },
            { id: 'doc-selfie-3', type: 'SELFIE', status: 'APPROVED' },
          ],
        }),
      ],
      (item) => item.displayName ?? item.id,
    );

    expect(board.openCount).toBe(5);
    expect(board.readyToApprove).toBe(2);
    expect(board.blockedByDocuments).toBe(1);
    expect(board.playbook.map((item) => item.title)).toEqual([
      'Review submitted KYC evidence',
      'Request missing KYC evidence',
      'Follow up rejected KYC',
      'Keep missing KYC out of paid dispatch',
    ]);
    expect(board.playbook[0]).toMatchObject({ status: '1ST', count: 2 });
    expect(board.cards.find((item) => item.title === 'Ready to approve')).toMatchObject({
      count: 2,
      tone: 'info',
      samples: ['Ready Partner', 'Document Partner'],
    });
    expect(board.cards.find((item) => item.title === 'Missing or rejected evidence')).toMatchObject({
      count: 1,
      tone: 'warn',
      samples: ['Incomplete Partner'],
    });
    expect(board.cards.find((item) => item.title === 'Missing KYC record')).toMatchObject({
      count: 1,
      tone: 'warn',
      samples: ['Missing Partner'],
    });
  });
});
