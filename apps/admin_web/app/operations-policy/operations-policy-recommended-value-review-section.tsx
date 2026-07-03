import { AdminSection } from '../../components/admin-surface';
import { PillClassBadge } from '../../components/status-badge';
import type { PolicyRecommendationReview } from './policy-recommendation-review';

type OperationsPolicyRecommendedValueReviewSectionProps = {
  readonly review: PolicyRecommendationReview;
};

export function OperationsPolicyRecommendedValueReviewSection({
  review,
}: OperationsPolicyRecommendedValueReviewSectionProps) {
  const visibleCards = review.cards.filter((card) => card.status !== 'Recommended');

  return (
    <AdminSection
      className="admin-mb-16"
      description="Compares current policy values with the HANDS recommended baseline. Differences are allowed, but operators should know the likely tradeoff before keeping them."
      status={
        <PillClassBadge pillClass={review.warningCount ? 'pill-warn' : 'pill-success'}>
          {review.warningCount ? `${review.warningCount} owner choice(s)` : 'Aligned'}
        </PillClassBadge>
      }
      title="Recommended value review"
    >
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
        {visibleCards.map((card) => (
          <div className={`ops-task-card ${card.className}`} key={card.key}>
            <PillClassBadge pillClass={card.pillClass}>{card.status}</PillClassBadge>
            <h3>{card.label}</h3>
            <p>{card.detail}</p>
            <small>{card.operatorAction}</small>
          </div>
        ))}
        {visibleCards.length === 0 ? (
          <div className="ops-task-card ops-task-done">
            <span className="pill pill-success">Aligned</span>
            <h3>Recommended values are aligned</h3>
            <p>Current policy values match the recommended baseline for the loaded review set.</p>
            <small>Review this again before changing live matching or booking gates.</small>
          </div>
        ) : null}
      </div>
    </AdminSection>
  );
}
