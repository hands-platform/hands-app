import { AdminActionCard, AdminSection } from '../../components/admin-surface';
import { PillClassBadge, StatusBadge } from '../../components/status-badge';

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
    <AdminSection
      actions={
        <>
          <PillClassBadge pillClass={board.hardBlocked > 0 ? 'pill-danger' : 'pill-success'}>
            {board.hardBlocked} direct request held
          </PillClassBadge>
          <StatusBadge tone="info">{board.eligibleNow} direct-ready</StatusBadge>
          <PillClassBadge pillClass={board.marketplaceBlocked > 0 ? 'pill-warn' : 'pill-success'}>
            {board.marketplaceBlocked} dispatch repair
          </PillClassBadge>
        </>
      }
      className="admin-mb-16 partner-marketplace-hold-board-card"
      description="Shows why partners need dispatch repair before operators rely on booking participation. Viewing marketplace requests is not treated as a partner action."
      title="Partner dispatch repair board"
    >
      <div className="grid admin-mt-12">
        {board.cards.map((card) => (
          <AdminActionCard
            detail={card.detail}
            href={card.href}
            key={card.title}
            signalClassName={partnerMarketplaceHoldToneClass(card.tone)}
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
    </AdminSection>
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
