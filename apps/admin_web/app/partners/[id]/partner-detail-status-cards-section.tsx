import { AdminMetricGrid } from '../../../components/admin-page-template';

export type PartnerStatusCard = {
  readonly label: string;
  readonly value: string;
};

type PartnerDetailStatusCardsSectionProps = {
  readonly cards: readonly PartnerStatusCard[];
};

export function PartnerDetailStatusCardsSection({ cards }: PartnerDetailStatusCardsSectionProps) {
  return (
    <AdminMetricGrid
      ariaLabel="Partner status summary"
      className="partner-detail-metric-grid admin-mb-16"
      metrics={cards.map((card) => ({
        className: 'partner-detail-metric-card',
        label: card.label,
        value: card.value,
      }))}
    />
  );
}
