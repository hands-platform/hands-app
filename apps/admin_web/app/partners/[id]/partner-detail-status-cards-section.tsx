export type PartnerStatusCard = {
  readonly label: string;
  readonly value: string;
};

type PartnerDetailStatusCardsSectionProps = {
  readonly cards: readonly PartnerStatusCard[];
};

export function PartnerDetailStatusCardsSection({ cards }: PartnerDetailStatusCardsSectionProps) {
  return (
    <section className="partner-detail-metric-grid admin-mb-16" aria-label="Partner status summary">
      {cards.map((card) => (
        <div className="partner-detail-metric-card" key={card.label}>
          <span>{card.label}</span>
          <h2>{card.value}</h2>
        </div>
      ))}
    </section>
  );
}
