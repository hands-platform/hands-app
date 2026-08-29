import { buildPartnerReviewControlPanel } from './partner-detail-review-control-panel-model';

const readyDossier = {
  blockers: 0,
  items: [
    {
      detail: 'Identity evidence is clear.',
      label: 'KYC evidence',
      ok: true,
    },
  ],
  ready: true,
};

describe('partner detail review control panel model', () => {
  it('builds a clear approval panel when dossier and account state are ready', () => {
    const panel = buildPartnerReviewControlPanel({
      cashDebtAmount: 0,
      dossier: readyDossier,
      provider: {
        id: 'partner-1',
        kyc: { submittedAt: '2026-06-13T03:15:00.000Z' },
        user: { createdAt: '2026-06-12T03:15:00.000Z' },
      },
      resubmissionPlan: { items: [] },
      reviewHistoryRows: [
        {
          action: 'kyc.approved',
          actorLabel: 'Ops Lead',
          atLabel: '13 Jun 2026, 10:15',
          id: 'review-log-1',
          statusLabel: 'PENDING -> APPROVED',
          title: 'Kyc Approved',
        },
      ],
      reviewIssues: [],
    });

    expect(panel).toMatchObject({
      status: 'Review clear',
      tone: 'pill-success',
    });
    expect(panel.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Submitted', value: '13 Jun 2026, 10:15' }),
        expect.objectContaining({ label: 'Latest review', value: '13 Jun 2026, 10:15' }),
      ]),
    );
    expect(panel.items.find((item) => item.id === 'approval-decision')).toMatchObject({
      status: 'READY',
      tone: 'pill-success',
    });
    expect(panel.items.find((item) => item.id === 'approval-decision')?.detail).toContain(
      'service profile',
    );
    expect(panel.items.find((item) => item.id === 'approval-decision')?.detail).not.toContain('bank');
    expect(panel.items.find((item) => item.id === 'approval-decision')?.detail).not.toContain('tax');
    expect(panel.items.find((item) => item.id === 'resubmission-needs')?.detail).not.toContain('bank');
    expect(panel.items.find((item) => item.id === 'resubmission-needs')?.detail).not.toContain('tax');
  });

  it('prioritizes account hold and resubmission context for operator decisions', () => {
    const panel = buildPartnerReviewControlPanel({
      cashDebtAmount: 250000,
      dossier: {
        blockers: 1,
        items: [
          {
            detail: 'Required CCCD/selfie documents are not all approved.',
            label: 'KYC evidence',
            ok: false,
          },
        ],
        ready: false,
      },
      provider: {
        blockedAt: '2026-06-13T03:15:00.000Z',
        blockedReason: 'Needs corrected documents.',
        id: 'partner-1',
        user: { createdAt: '2026-06-12T03:15:00.000Z' },
      },
      resubmissionPlan: {
        items: [{ reason: 'Front image is blurry.', target: 'CCCD front' }],
      },
      reviewHistoryRows: [],
      reviewIssues: [{ label: 'KYC missing', severity: 'high' }],
    });

    expect(panel).toMatchObject({
      reviewIssues: [{ label: 'KYC missing', severity: 'high' }],
      status: 'Partner on hold',
      tone: 'pill-danger',
    });
    expect(panel.items.find((item) => item.id === 'approval-decision')).toMatchObject({
      detail: 'Partner remains on hold. Release hold or record the required correction before approval.',
      status: 'HOLD',
      tone: 'pill-danger',
    });
    expect(panel.items.find((item) => item.id === 'settlement-warning')).toMatchObject({
      status: 'WARNING',
      tone: 'pill-warn',
    });
    expect(panel.items.find((item) => item.id === 'booking-access-state')?.detail).not.toContain('bank');
  });
});
