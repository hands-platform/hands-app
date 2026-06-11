export type PartnerStatusCard = {
  readonly label: string;
  readonly value: string;
};

type PartnerDetailStatusCardsSectionProps = {
  readonly cards: readonly PartnerStatusCard[];
};

export function PartnerDetailStatusCardsSection({ cards }: PartnerDetailStatusCardsSectionProps) {
  return (
    <div className="grid admin-mb-16">
      {cards.map((card) => (
        <div className="card" key={card.label}>
          <p>{card.label}</p>
          <h2>{card.value}</h2>
        </div>
      ))}
    </div>
  );
}
