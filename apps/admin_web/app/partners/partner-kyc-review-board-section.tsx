import Link from 'next/link';

import { AdminSection } from '../../components/admin-surface';

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
          <span className={`pill ${board.openCount > 0 ? 'pill-warn' : 'pill-success'}`}>
            {board.openCount} KYC item(s)
          </span>
          <span className="pill pill-success">{board.readyToApprove} ready to approve</span>
          <span className="pill pill-danger">{board.blockedByDocuments} blocked by docs</span>
        </>
      }
      className="admin-mb-16 partner-kyc-review-board-card"
      description="Tracks identity records, CCCD front/back, and selfie evidence before a partner can become dispatch-ready."
      title="KYC review board"
    >
      <div className="grid admin-mt-12">
        {board.cards.map((card) => (
          <Link className="card" href={card.href} key={card.title}>
            <p>{card.title}</p>
            <h2>{card.count}</h2>
            <span className={`signal ${partnerKycReviewToneClass(card.tone)}`}>{card.status}</span>
            <p className="muted admin-mt-8">
              {card.detail}
            </p>
            <p className="muted admin-mt-8">
              {card.operatorAction}
            </p>
            <div className="participant-list admin-mt-10">
              {card.samples.length > 0 ? (
                card.samples.map((sample) => (
                  <span className="pill" key={sample}>
                    {sample}
                  </span>
                ))
              ) : (
                <span className="pill pill-success">No immediate queue</span>
              )}
            </div>
          </Link>
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
            <Link className="text-link" href={step.href}>
              {step.count}
            </Link>
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
