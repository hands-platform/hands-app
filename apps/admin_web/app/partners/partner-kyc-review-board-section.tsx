import { AdminActionCard, AdminSection } from '../../components/admin-surface';
import { AdminTextLink } from '../../components/admin-text-link';
import { StatusBadge } from '../../components/status-badge';

type PartnerKycReviewTone = 'danger' | 'info' | 'ok' | 'warn';

type PartnerKycReviewCard = {
  readonly count: number;
  readonly detail: string;
  readonly href: string;
  readonly operatorAction: string;
  readonly samples: readonly string[];
  readonly status: string;
  readonly title: string;
  readonly tone: PartnerKycReviewTone;
};

type PartnerKycReviewPlaybookStep = {
  readonly count: number;
  readonly detail: string;
  readonly href: string;
  readonly operatorAction: string;
  readonly status: string;
  readonly title: string;
};

export type PartnerKycReviewBoardSectionBoard = {
  readonly blockedByDocuments: number;
  readonly cards: readonly PartnerKycReviewCard[];
  readonly openCount: number;
  readonly playbook: readonly PartnerKycReviewPlaybookStep[];
  readonly readyToApprove: number;
};

type PartnerKycReviewBoardSectionProps = {
  readonly board: PartnerKycReviewBoardSectionBoard;
};

export function PartnerKycReviewBoardSection({ board }: PartnerKycReviewBoardSectionProps) {
  return (
    <AdminSection
      actions={
        <>
          <StatusBadge tone={board.openCount > 0 ? 'warning' : 'success'}>
            {board.openCount} KYC item(s)
          </StatusBadge>
          <StatusBadge tone="success">{board.readyToApprove} ready to approve</StatusBadge>
          <StatusBadge tone="danger">{board.blockedByDocuments} blocked by docs</StatusBadge>
        </>
      }
      className="admin-mb-16 partner-kyc-review-board-card"
      description="Tracks identity records, CCCD front/back, and selfie evidence before a partner can become dispatch-ready."
      title="KYC review board"
    >
      <div className="grid admin-mt-12">
        {board.cards.map((card) => (
          <AdminActionCard
            detail={card.detail}
            href={card.href}
            key={card.title}
            signalClassName={partnerKycReviewToneClass(card.tone)}
            signalLabel={card.status}
            title={card.title}
            value={card.count}
          >
            <p className="muted admin-mt-8">
              {card.operatorAction}
            </p>
            <div className="participant-list admin-mt-10">
              {card.samples.length > 0 ? (
                card.samples.map((sample) => (
                  <StatusBadge key={sample} tone="neutral">
                    {sample}
                  </StatusBadge>
                ))
              ) : (
                <StatusBadge tone="success">No immediate queue</StatusBadge>
              )}
            </div>
          </AdminActionCard>
        ))}
      </div>
      <div className="setup-stage-list admin-mt-14">
        {board.playbook.map((step) => (
          <div className="setup-stage-item" key={step.title}>
            <span>{step.status}</span>
            <div>
              <strong>{step.title}</strong>
              <p className="muted">{step.detail}</p>
              <p className="muted">{step.operatorAction}</p>
            </div>
            <AdminTextLink href={step.href}>
              {step.count}
            </AdminTextLink>
          </div>
        ))}
      </div>
    </AdminSection>
  );
}

function partnerKycReviewToneClass(tone: PartnerKycReviewTone) {
  if (tone === 'danger' || tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'info') {
    return 'signal-info';
  }
  return 'signal-ok';
}
