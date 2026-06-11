import Link from 'next/link';

import { AdminSectionHeader } from '../../components/admin-page-template';

type PartnerMarketplaceHoldBoardTone = 'danger' | 'info' | 'ok' | 'warn';

type PartnerMarketplaceHoldBoardCard = {
  readonly count: number;
  readonly detail: string;
  readonly href: string;
  readonly operatorAction: string;
  readonly samples: readonly string[];
  readonly status: string;
  readonly title: string;
  readonly tone: PartnerMarketplaceHoldBoardTone;
};

export type PartnerMarketplaceHoldBoardSectionBoard = {
  readonly cards: readonly PartnerMarketplaceHoldBoardCard[];
  readonly eligibleNow: number;
  readonly hardBlocked: number;
  readonly marketplaceBlocked: number;
};

type PartnerMarketplaceHoldBoardSectionProps = {
  readonly board: PartnerMarketplaceHoldBoardSectionBoard;
};

export function PartnerMarketplaceHoldBoardSection({ board }: PartnerMarketplaceHoldBoardSectionProps) {
  return (
    <section className="card admin-mb-16">
      <AdminSectionHeader
        description="Shows why partners cannot join marketplace bookings before operators rely on them for booking recovery. Viewing marketplace requests is not treated as a partner action."
        status={
          <>
            <span className={`pill ${board.hardBlocked > 0 ? 'pill-danger' : 'pill-success'}`}>
              {board.hardBlocked} direct request held
            </span>
            <span className="pill pill-info">{board.eligibleNow} direct-ready</span>
            <span className={`pill ${board.marketplaceBlocked > 0 ? 'pill-warn' : 'pill-success'}`}>
              {board.marketplaceBlocked} marketplace held
            </span>
          </>
        }
        title="Partner marketplace hold board"
      />
      <div className="grid admin-mt-12">
        {board.cards.map((card) => (
          <Link className="card" href={card.href} key={card.title}>
            <p>{card.title}</p>
            <h2>{card.count}</h2>
            <span className={`signal ${partnerMarketplaceHoldToneClass(card.tone)}`}>{card.status}</span>
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
    </section>
  );
}

function partnerMarketplaceHoldToneClass(tone: PartnerMarketplaceHoldBoardTone) {
  if (tone === 'danger' || tone === 'warn') {
    return 'signal-warn';
  }
  if (tone === 'info') {
    return 'signal-info';
  }
  return 'signal-ok';
}
