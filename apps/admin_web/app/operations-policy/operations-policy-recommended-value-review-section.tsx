import type { PolicyRecommendationReview } from './policy-recommendation-review';

type OperationsPolicyRecommendedValueReviewSectionProps = {
  readonly review: PolicyRecommendationReview;
};

export function OperationsPolicyRecommendedValueReviewSection({
  review,
}: OperationsPolicyRecommendedValueReviewSectionProps) {
  return (
    <section className="card admin-mb-16">
      <div className="ops-section-header">
        <div>
          <h2>Recommended value review</h2>
          <p className="muted">
            Compares current policy values with the HANDS recommended baseline. Differences are allowed, but
            operators should know the likely tradeoff before keeping them.
          </p>
        </div>
        <span className={`pill ${review.warningCount ? 'pill-warn' : 'pill-success'}`}>
          {review.warningCount ? `${review.warningCount} owner choice(s)` : 'Aligned'}
        </span>
      </div>
      <div className="service-trace-summary admin-mt-12">
        {review.summary.map((item) => (
          <div key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </div>
        ))}
      </div>
      <div className="ops-task-grid admin-mt-14">
        {review.cards.map((card) => (
          <div className={`ops-task-card ${card.className}`} key={card.key}>
            <span className={`pill ${card.pillClass}`}>{card.status}</span>
            <h3>{card.label}</h3>
            <p>{card.detail}</p>
            <small>{card.operatorAction}</small>
          </div>
        ))}
      </div>
    </section>
  );
}
