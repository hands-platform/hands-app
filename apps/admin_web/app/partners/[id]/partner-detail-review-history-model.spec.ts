import {
  buildPartnerReviewHistoryRows,
  partnerReviewStatusTransition,
} from './partner-detail-review-history-model';

describe('partner detail review history model', () => {
  it('maps latest review logs into display rows and limits the row count', () => {
    const rows = buildPartnerReviewHistoryRows({
      verificationLogs: Array.from({ length: 9 }, (_, index) => ({
        action: index === 0 ? 'kyc.approved' : 'document.reviewed',
        actor: index === 0 ? { fullName: 'Ops Lead', phone: '+84000000001' } : null,
        createdAt: '2026-06-13T03:15:00.000Z',
        fromStatus: index === 0 ? 'PENDING' : null,
        id: `review-log-${index}`,
        metadata: index === 0 ? { reason: 'Clear profile', documentType: 'KYC' } : null,
        toStatus: index === 0 ? 'APPROVED' : null,
      })),
    });

    expect(rows).toHaveLength(8);
    expect(rows[0]).toMatchObject({
      actorLabel: 'Ops Lead',
      id: 'review-log-0',
      preview: 'Reason: Clear profile / Document: KYC',
      statusLabel: 'PENDING -> APPROVED',
      title: 'Kyc Approved',
    });
    expect(rows[1]).toMatchObject({
      actorLabel: 'System',
      statusLabel: 'Decision recorded',
      title: 'Document Reviewed',
    });
  });

  it('formats status transition fallbacks', () => {
    expect(
      partnerReviewStatusTransition({
        action: 'review',
        createdAt: '2026-06-13T03:15:00.000Z',
        id: 'review-log',
        toStatus: 'REJECTED',
      }),
    ).toBe('New -> REJECTED');

    expect(
      partnerReviewStatusTransition({
        action: 'review',
        createdAt: '2026-06-13T03:15:00.000Z',
        fromStatus: 'PENDING',
        id: 'review-log',
      }),
    ).toBe('PENDING -> Unknown');
  });
});
