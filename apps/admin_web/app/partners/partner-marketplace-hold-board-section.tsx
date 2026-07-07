import { AdminFilterChipGroup } from '../../components/admin-filter-chip-group';
import { AdminActionCard, AdminDetailGrid, AdminSection } from '../../components/admin-surface';
import { StatusBadge } from '../../components/status-badge';

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
          <StatusBadge tone={board.hardBlocked > 0 ? 'danger' : 'success'}>
            {board.hardBlocked} direct request held
          </StatusBadge>
          <StatusBadge tone="info">{board.eligibleNow} direct-ready</StatusBadge>
          <StatusBadge tone={board.marketplaceBlocked > 0 ? 'warning' : 'success'}>
            {board.marketplaceBlocked} dispatch repair
          </StatusBadge>
        </>
      }
      className="admin-mb-16 partner-marketplace-hold-board-card"
      description="Shows why partners need dispatch repair before operators rely on booking participation. Viewing marketplace requests is not treated as a partner action."
      title="Partner dispatch repair board"
    >
      <AdminDetailGrid className="admin-mt-12">
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
            <AdminFilterChipGroup ariaLabel={`${card.title} samples`} className="admin-mt-10">
              {card.samples.length > 0 ? (
                card.samples.map((sample) => (
                  <StatusBadge key={sample} tone="neutral">
                    {sample}
                  </StatusBadge>
                ))
              ) : (
                <StatusBadge tone="success">No immediate queue</StatusBadge>
              )}
            </AdminFilterChipGroup>
          </AdminActionCard>
        ))}
      </AdminDetailGrid>
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
